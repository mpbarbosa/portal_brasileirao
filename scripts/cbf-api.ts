/**
 * cbf-api.ts
 * ----------
 * The HTTP half of talking to CBF: completing their broken certificate chain,
 * and reading JSON off an endpoint that is undocumented, unversioned and
 * occasionally hostile.
 *
 * Extracted when `sync-goals.ts` would have made a **second** copy of the TLS
 * dance — the point at which `commons-api.ts` was extracted for Wikimedia, and
 * the lesson recorded there is that the two copies which already existed had
 * silently drifted. There is no judgement in this file, only transport; the
 * rules that decide what a payload *means* stay in `broadcast-core.ts` and
 * `goals-core.ts`, where they can be unit-tested without a network.
 *
 * **Never import this from anything the server runs.** Production does not call
 * CBF — see `docs/data-sources.md`.
 */
import http from "node:http";
import https from "node:https";
import tls from "node:tls";

export const CBF_HOST = "www.cbf.com.br";

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Every CBF host serves a valid Sectigo certificate but omits the intermediate,
 * so Node cannot build a chain and fetch fails with
 * UNABLE_TO_VERIFY_LEAF_SIGNATURE. Browsers paper over this by fetching the
 * intermediate from the certificate's AIA extension; Node does not.
 *
 * So do what the browser does: read the caIssuers URI off the leaf, download
 * that intermediate, and trust it *in addition to* the real roots. Verification
 * stays on — this completes the chain CBF should have sent, it does not skip
 * checking it.
 */
const caIssuerUri = (host: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host, port: 443, servername: host, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate(true);
        socket.end();

        const uri = cert?.infoAccess?.["CA Issuers - URI"]?.[0];
        if (!uri) {
          reject(new Error("leaf certificate advertises no CA Issuers URI"));
          return;
        }
        resolve(uri);
      },
    );
    socket.once("error", reject);
    socket.setTimeout(15_000, () => {
      socket.destroy();
      reject(new Error("timed out reading the certificate"));
    });
  });

/**
 * CA certificates are distributed over plain HTTP by convention, and that is
 * fine: a certificate is self-authenticating — it carries its issuer's
 * signature — and the chain built from it is still verified against the real
 * root store below. Nothing is trusted because of how it arrived.
 */
const download = (url: string): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const client = url.startsWith("http://") ? http : https;
    client
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`${url} responded ${response.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });

const derToPem = (der: Buffer): string =>
  `-----BEGIN CERTIFICATE-----\n${der
    .toString("base64")
    .replace(/(.{64})/g, "$1\n")
    .trim()}\n-----END CERTIFICATE-----\n`;

export const buildAgent = async (host: string = CBF_HOST): Promise<https.Agent> => {
  const uri = await caIssuerUri(host);
  console.log(`==> Completing CBF's certificate chain from ${uri}`);

  const der = await download(uri);
  // Sectigo serves DER; tolerate a PEM body just in case.
  const pem = der.toString("utf8").includes("BEGIN CERTIFICATE")
    ? der.toString("utf8")
    : derToPem(der);

  return new https.Agent({ ca: [...tls.rootCertificates, pem] });
};

/**
 * A network error carrying whether trying again could plausibly help.
 *
 * A 5xx is worth another go; a 4xx will not fix itself, and retrying it four
 * times just makes a wrong URL take eight seconds to report.
 */
interface RetryableError extends Error {
  retryable?: boolean;
}

const getJsonOnce = <T>(url: string, agent: https.Agent): Promise<T> =>
  new Promise((resolve, reject) => {
    https
      .get(url, { agent, headers: { Accept: "application/json" } }, (response) => {
        if (response.statusCode !== 200) {
          const error: RetryableError = new Error(`${url} responded ${response.statusCode}`);
          error.retryable = (response.statusCode ?? 0) >= 500;
          reject(error);
          return;
        }

        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => {
          try {
            resolve(JSON.parse(body) as T);
          } catch (cause) {
            reject(new Error(`${url} did not return JSON: ${String(cause)}`));
          }
        });
      })
      .on("error", reject);
  });

/**
 * Read JSON, retrying with a widening delay.
 *
 * **CBF throttles, and it does so at the socket rather than with a status
 * code.** Fetching a few hundred match payloads back to back — roughly one
 * every 250ms — got the host to stop completing TLS altogether: every
 * subsequent connection failed with `ECONNRESET` *before* the handshake, and
 * plain `curl` was refused the same way for some minutes afterwards. There is
 * no 429 and no `Retry-After` to read; the connection simply stops being
 * accepted, which is indistinguishable from the host being down.
 *
 * So callers should pace themselves deliberately (`sleep` between requests) and
 * treat a run as something that takes minutes. The backoff here recovers from a
 * blip; it will not talk its way out of a block.
 *
 * **Both ends of that are now measured.** The ban came from ~250ms pacing and
 * held for roughly **72 minutes**, during which plain `curl` was refused
 * identically. At **~1 request/second** a full-season sync — 26 weekly windows
 * plus 19 single-day re-runs, several hundred requests — ran start to finish
 * with no refusal at all. So the limit is a *rate*, not a total, and one second
 * is comfortably inside it. That is why the sleeps in `sync-goals.ts` are not
 * an abundance of caution.
 *
 * Worth knowing during an outage: the ban is **per host**. `www` and `cms` both
 * stop completing TLS while `conteudo` (súmulas, crests) and `bid` (player
 * photos) keep answering, and TCP to `www:443` still connects — it is an edge
 * rule, not a network drop, which is why it reads as a dead host.
 */
export const getJson = async <T>(
  url: string,
  agent: https.Agent,
  attempts = 4,
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await getJsonOnce<T>(url, agent);
    } catch (error) {
      lastError = error;
      const retryable = (error as RetryableError).retryable ?? true;
      if (!retryable || attempt === attempts) break;

      const wait = 1000 * 2 ** (attempt - 1);
      console.warn(`    ${(error as Error).message} — retrying in ${wait}ms`);
      await sleep(wait);
    }
  }

  throw lastError;
};

/** One page of CBF's fixture listing. Only the parts the walk reads. */
interface ListingPage<T> {
  jogos?: T[];
  meta?: { last_page?: number | string };
}

/** More pages than any window a sync asks for; beyond it, narrow the window. */
export const LISTING_MAX_PAGES = 60;

/**
 * The pause between two pages. This is someone else's undocumented endpoint, and
 * walking it back to back is what provoked a 502 in the first place. The two
 * copies of this walk had drifted to different pauses; the slower one is kept.
 */
export const LISTING_PAUSE_MS = 600;

/**
 * Read every page of a paginated listing, refusing one longer than the cap.
 *
 * **A short read is refused rather than returned**, because a first-page-only
 * read looks identical to a quiet weekend: the fixtures it drops simply show no
 * channels and no goals. It is refused as soon as the first page states how
 * many there are, not after fetching the pages the refusal would discard.
 *
 * The page reader is a parameter so the walk is testable without CBF
 * (`tests/cbf-listing.test.ts`); `cbfFixtureListing` is the real one.
 */
export const walkListing = async <T>(
  readPage: (page: number) => Promise<ListingPage<T>>,
  { maxPages = LISTING_MAX_PAGES, pauseMs = LISTING_PAUSE_MS } = {},
): Promise<{ jogos: T[]; lastPage: number }> => {
  const jogos: T[] = [];
  let lastPage = 1;

  for (let page = 1; ; page += 1) {
    const body = await readPage(page);
    jogos.push(...(body.jogos ?? []));
    lastPage = Number(body.meta?.last_page ?? 1);

    if (lastPage > maxPages) {
      throw new Error(
        `CBF reports ${lastPage} pages but the cap is ${maxPages}. ` +
          "Narrow the date range and run again — a partial read would silently drop fixtures.",
      );
    }
    if (page >= lastPage) break;
    await sleep(pauseMs);
  }

  return { jogos, lastPage };
};

/**
 * Every fixture CBF lists between two dates, all pages of it. CBF ignores
 * `per_page` and serves fifteen at a time.
 *
 * The listing is keyed by **local** date while our kickoffs are UTC, so a
 * 00:30Z fixture is listed under the previous day — a window aimed at one
 * fixture has to allow for that.
 *
 * Shared by `sync-broadcasts.ts` and `sync-goals.ts`, which carried a copy of
 * this walk each until the copies were found pacing differently.
 */
export const cbfFixtureListing = <T>(from: string, to: string, agent: https.Agent) =>
  walkListing<T>((page) =>
    getJson<ListingPage<T>>(
      `https://${CBF_HOST}/api/cbf/onde-assistir/jogos` +
        `?dataInicio=${from}&dataTermino=${to}&page=${page}`,
      agent,
    ),
  );
