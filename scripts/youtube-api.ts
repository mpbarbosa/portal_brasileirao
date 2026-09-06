/**
 * scripts/youtube-api.ts
 * ----------------------
 * Talking to YouTube over HTTP: the OAuth dance that gets a token, the
 * resumable upload that puts an mp4 on a channel, the thumbnail, and oEmbed's
 * read-back.
 *
 * The transport half only — every rule about *what* may be published lives in
 * `youtube-upload-core.ts`, which is pure. Same split as `commons-core.ts` and
 * `scripts/commons-api.ts`, and it exists for the same reason: the judgement
 * has to be testable without a channel.
 *
 * **This never runs in production**, like `cbf-api.ts`. It is a workstation
 * script; the deployed app has no idea YouTube has an API.
 *
 * **No `googleapis` dependency.** That package is tens of megabytes and a whole
 * generated client to reach two endpoints, against a repo that ships no UI
 * dependency at all and hand-writes its HCT colour maths to avoid one. The
 * three requests below are the whole of what is needed.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { GOOGLE_AUTHORIZE_URL, GOOGLE_TOKEN_URL, newVerifier, challengeFor } from "@/oauth-core";

/**
 * Uploading, and setting a thumbnail, and nothing else.
 *
 * `youtube.upload` covers `videos.insert` **and** `thumbnails.set`, so the
 * broader `youtube.force-ssl` buys nothing here and would ask a reviewer — and
 * the consent screen — for the ability to edit and delete a channel's videos.
 * Read-back goes through oEmbed, which needs no scope at all.
 */
export const UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";

/**
 * Where the refresh token lives: **outside the repository**, always.
 *
 * This checkout is shared by several sessions and `git add -A` is one keystroke
 * away from committing a credential that grants upload rights on a real
 * channel. Nothing under the working tree is an acceptable default, and an
 * override is read from the environment rather than from a flag so it cannot
 * end up in a shell history beside a public command.
 */
export const tokenFile = (): string =>
  process.env.YOUTUBE_TOKEN_FILE ?? join(homedir(), ".config", "portal-brasileirao", "youtube.json");

export interface StoredCredentials {
  clientId: string;
  clientSecret: string;
  /** Absent until `authorize` has run once. */
  refreshToken?: string;
}

export const readCredentials = (): StoredCredentials | null => {
  try {
    const parsed: unknown = JSON.parse(readFileSync(tokenFile(), "utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const clientId = record.clientId;
    const clientSecret = record.clientSecret;
    if (typeof clientId !== "string" || typeof clientSecret !== "string") return null;
    const refreshToken = typeof record.refreshToken === "string" ? record.refreshToken : undefined;
    return { clientId, clientSecret, refreshToken };
  } catch {
    return null;
  }
};

/**
 * Written through a sibling and renamed, `match-state-store.ts`' rule: a write
 * interrupted mid-flight would leave truncated JSON where a credential was, and
 * the next run would report a missing token rather than a damaged file.
 */
export const writeCredentials = async (credentials: StoredCredentials): Promise<void> => {
  const path = tokenFile();
  await mkdir(dirname(path), { recursive: true });
  const staging = `${path}.incoming`;
  await writeFile(staging, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
  await rename(staging, path);
};

/**
 * A loopback listener that catches exactly one authorization code.
 *
 * The port is ephemeral — `listen(0)` — which is why the **Desktop app** client
 * type is the one to create: it accepts any `http://127.0.0.1:<port>` redirect,
 * so nothing has to be registered in the console and no port has to be kept
 * free on a workstation running several dev servers.
 */
const catchCode = async (
  state: string,
): Promise<{ redirectUri: string; code: Promise<string>; close: () => void }> => {
  let settle: (code: string) => void = () => {};
  let fail: (reason: Error) => void = () => {};
  const code = new Promise<string>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });

  const server = createServer((request, response) => {
    const asked = new URL(request.url ?? "/", "http://127.0.0.1");
    if (asked.pathname !== "/") {
      response.writeHead(404).end();
      return;
    }
    const answer = (message: string): void => {
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end(`${message}\n`);
    };

    // The `state` check comes first: a mismatch means this request is not the
    // one we sent, so nothing it carries may be believed — including its error.
    if (asked.searchParams.get("state") !== state) {
      answer("state não confere — recomece a autorização.");
      fail(new Error("o redirect voltou com outro `state`"));
      return;
    }
    const refused = asked.searchParams.get("error");
    if (refused !== null) {
      answer(`o Google recusou: ${refused}`);
      fail(new Error(`o Google recusou a autorização: ${refused}`));
      return;
    }
    const granted = asked.searchParams.get("code");
    if (granted === null) {
      answer("sem `code` na volta.");
      fail(new Error("o redirect voltou sem `code`"));
      return;
    }
    answer("Autorizado. Pode fechar esta aba e voltar ao terminal.");
    settle(granted);
  });

  server.on("error", (reason) => fail(reason));

  const port = await new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address !== "object" || address === null) {
        reject(new Error("o listener local não reportou uma porta"));
        return;
      }
      resolve(address.port);
    });
  });

  return {
    redirectUri: `http://127.0.0.1:${port}`,
    code,
    close: () => server.close(),
  };
};

/**
 * The one interactive step: sends you to Google, catches the code on a loopback
 * port, and stores the refresh token.
 *
 * `access_type=offline` **with** `prompt=consent` is what makes Google return a
 * refresh token at all. Without the prompt it withholds one on every
 * authorization after the first, so re-running this — which is exactly what
 * somebody does after deleting the token file — would appear to work and leave
 * an access token good for an hour and nothing to renew it with.
 *
 * PKCE comes from `oauth-core.ts` rather than from a second implementation. That
 * module's `authorizeUrl` is deliberately **not** reused: it hard-codes the
 * sign-in scopes, and widening a function the production sign-in depends on to
 * serve a workstation script is how a scope reaches a consent screen nobody
 * meant to change.
 */
export const authorize = async (credentials: StoredCredentials): Promise<string> => {
  const state = randomBytes(16).toString("base64url");
  const verifier = newVerifier();
  const listener = await catchCode(state);

  try {
    const url = new URL(GOOGLE_AUTHORIZE_URL);
    url.searchParams.set("client_id", credentials.clientId);
    url.searchParams.set("redirect_uri", listener.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", UPLOAD_SCOPE);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challengeFor(verifier));
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");

    console.log("\nAbra este endereço e autorize:\n");
    console.log(`  ${url.toString()}\n`);

    const code = await listener.code;

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: listener.redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(`troca do código falhou (${response.status}): ${JSON.stringify(payload)}`);
    }
    const refreshToken = payload.refresh_token;
    if (typeof refreshToken !== "string") {
      throw new Error(
        "o Google não devolveu `refresh_token` — revogue o acesso do app em " +
          "myaccount.google.com/permissions e autorize de novo",
      );
    }
    await writeCredentials({ ...credentials, refreshToken });
    return refreshToken;
  } finally {
    listener.close();
  }
};

/** An access token from the stored refresh token. Good for about an hour. */
export const accessToken = async (credentials: StoredCredentials): Promise<string> => {
  if (credentials.refreshToken === undefined) {
    throw new Error("sem `refreshToken` guardado — rode `authorize` primeiro");
  }
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      `renovação do token falhou (${response.status}): ${JSON.stringify(payload)}` +
        "\nSe a tela de permissão OAuth está em «Teste», o refresh token expira em 7 dias" +
        " — publique o app ou rode `authorize` de novo.",
    );
  }
  const token = payload.access_token;
  if (typeof token !== "string") throw new Error("resposta sem `access_token`");
  return token;
};

/**
 * `videos.insert`, resumable.
 *
 * Resumable rather than `uploadType=media` even though these renders are four
 * megabytes and go up in one PUT: the metadata and the bytes travel as separate
 * requests, so a rejected title fails **before** anything is uploaded and says
 * so, where the single-request forms answer after the transfer.
 *
 * Costs **1600 units** of the project's 10,000/day. Six uploads is the whole
 * budget, which is worth knowing before pointing this at twenty clubs.
 */
export const uploadVideo = async (
  token: string,
  body: unknown,
  mp4: string,
): Promise<string> => {
  const bytes = await readFile(mp4);

  const start = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-upload-content-length": String(bytes.byteLength),
        "x-upload-content-type": "video/mp4",
      },
      body: JSON.stringify(body),
    },
  );
  if (!start.ok) {
    throw new Error(`videos.insert recusou os metadados (${start.status}): ${await start.text()}`);
  }
  const session = start.headers.get("location");
  if (session === null) throw new Error("videos.insert não devolveu a URL da sessão");

  const sent = await fetch(session, {
    method: "PUT",
    headers: { "content-type": "video/mp4", "content-length": String(bytes.byteLength) },
    body: new Uint8Array(bytes),
  });
  if (!sent.ok) throw new Error(`o envio falhou (${sent.status}): ${await sent.text()}`);

  const created = (await sent.json()) as Record<string, unknown>;
  const id = created.id;
  if (typeof id !== "string") throw new Error("o YouTube não devolveu um id");
  return id;
};

/**
 * `thumbnails.set`. 50 units.
 *
 * Needs a **phone-verified channel** independently of the API — an unverified
 * one answers 403 here while the upload itself succeeded, so this is called
 * after the video exists and its failure is reported without losing the id.
 */
export const setThumbnail = async (token: string, videoId: string, png: string): Promise<void> => {
  const bytes = await readFile(png);
  const response = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "image/png" },
      body: new Uint8Array(bytes),
    },
  );
  if (!response.ok) {
    throw new Error(`thumbnails.set falhou (${response.status}): ${await response.text()}`);
  }
};

/**
 * oEmbed, which needs no token and costs nothing from the daily quota.
 *
 * Returns the raw status alongside the payload because **403 is meaningful**:
 * `src/data/club-videos.ts` records that a video which is not public yet answers
 * 403 rather than 404, so the caller can tell "not published" from "no such
 * video" and say which.
 */
export const oembed = async (videoId: string): Promise<{ status: number; payload: unknown }> => {
  const target = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`,
  )}&format=json`;
  const response = await fetch(target);
  if (!response.ok) return { status: response.status, payload: null };
  return { status: response.status, payload: await response.json() };
};
