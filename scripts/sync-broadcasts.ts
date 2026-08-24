/**
 * sync-broadcasts.ts
 * ------------------
 * Regenerate src/data/broadcasts.ts from CBF's "Onde assistir" API.
 *
 * Run by hand, like sync-seed-data.ts. Production never calls CBF: the endpoint
 * is undocumented, unversioned, internal to their own site, and governed by
 * their Termos de uso. Reading it here means a change on their side breaks a
 * script on a workstation instead of a page for readers.
 *
 * Usage:
 *   npx tsx scripts/sync-broadcasts.ts                    # today
 *   npx tsx scripts/sync-broadcasts.ts 2026-08-30         # one day
 *   npx tsx scripts/sync-broadcasts.ts 2026-08-30 2026-09-01
 *
 * Existing entries are kept: the script merges rather than replaces, so a
 * narrow date range tops the file up instead of wiping the rest of the season.
 * Pass --replace to start clean.
 *
 * Exit codes:
 *   0  broadcasts.ts written (or already current).
 *   1  bad arguments, upstream failure, or nothing could be joined.
 */
import { readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import tls from "node:tls";

import {
  channelsOf,
  joinMatch,
  SERIE_A_CATEGORIA_ID,
  type CbfFixture,
} from "@/broadcast-core";
import {
  clubsFromMatches,
  mapMatches,
  matchesUrl,
  type MatchesResponse,
} from "@/football-data-core";
import type { Club } from "@/src/types";

const ROOT = process.cwd();
const CBF_HOST = "www.cbf.com.br";

/** The join rules live in broadcast-core so they can be unit-tested; this file
 *  only adds the network and the file writing. */
interface CbfJogo extends CbfFixture {
  id_jogo?: string;
  rodada?: string;
  local?: string;
  visitante?: { nome?: string };
}

interface CbfResponse {
  jogos?: CbfJogo[];
  meta?: { current_page?: number; last_page?: number; total?: string };
}

// ---------------------------------------------------------------------------
// TLS
// ---------------------------------------------------------------------------

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
const caIssuerUri = async (): Promise<string> =>
  new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: CBF_HOST, port: 443, servername: CBF_HOST, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate(true);
        socket.end();

        const info = cert?.infoAccess?.["CA Issuers - URI"];
        const uri = info?.[0];
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

const buildAgent = async (): Promise<https.Agent> => {
  const uri = await caIssuerUri();
  console.log(`==> Completing CBF's certificate chain from ${uri}`);

  const der = await download(uri);
  // Sectigo serves DER; tolerate a PEM body just in case.
  const pem = der.toString("utf8").includes("BEGIN CERTIFICATE")
    ? der.toString("utf8")
    : derToPem(der);

  return new https.Agent({ ca: [...tls.rootCertificates, pem] });
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getJsonOnce = <T>(url: string, agent: https.Agent): Promise<T> =>
  new Promise((resolve, reject) => {
    https
      .get(url, { agent, headers: { Accept: "application/json" } }, (response) => {
        if (response.statusCode !== 200) {
          const error = new Error(`${url} responded ${response.statusCode}`);
          // Mark 5xx as worth retrying; a 4xx will not fix itself.
          (error as { retryable?: boolean }).retryable = (response.statusCode ?? 0) >= 500;
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
 * CBF's endpoint returns an occasional 502 under sequential requests — a real
 * run walked six pages and failed on the seventh. Without a retry a single
 * blip aborts the whole sync, so transient failures back off and try again.
 */
const getJson = async <T>(url: string, agent: https.Agent, attempts = 4): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await getJsonOnce<T>(url, agent);
    } catch (error) {
      lastError = error;
      const retryable = (error as { retryable?: boolean }).retryable ?? true;
      if (!retryable || attempt === attempts) break;

      const wait = 1000 * 2 ** (attempt - 1);
      console.warn(`    ${(error as Error).message} — retrying in ${wait}ms`);
      await sleep(wait);
    }
  }

  throw lastError;
};

// ---------------------------------------------------------------------------
// Existing file
// ---------------------------------------------------------------------------

const readExisting = (): Record<string, string[]> => {
  try {
    const source = readFileSync(path.join(ROOT, "src/data/broadcasts.ts"), "utf8");
    const body = source.slice(source.indexOf("{"), source.lastIndexOf("}") + 1);
    const entries: Record<string, string[]> = {};

    for (const line of body.split("\n")) {
      const entry = /"(\d+)"\s*:\s*\[([^\]]*)\]/.exec(line);
      if (!entry) continue;
      const channels = [...entry[2].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      if (channels.length) entries[entry[1]] = channels;
    }

    return entries;
  } catch {
    return {};
  }
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const args = process.argv.slice(2);
const replace = args.includes("--replace");
const dates = args.filter((arg) => !arg.startsWith("--"));

for (const date of dates) {
  if (!isDate(date)) {
    console.error(`Error: expected YYYY-MM-DD, got "${date}"`);
    process.exit(1);
  }
}

const today = new Date().toISOString().slice(0, 10);
const from = dates[0] ?? today;
const to = dates[1] ?? from;

const token = (() => {
  if (process.env.FOOTBALL_DATA_TOKEN) return process.env.FOOTBALL_DATA_TOKEN;
  try {
    const env = readFileSync(path.join(ROOT, ".env"), "utf8");
    return /^FOOTBALL_DATA_TOKEN\s*=\s*"?([^"\n]*)"?/m.exec(env)?.[1] ?? "";
  } catch {
    return "";
  }
})();

if (!token) {
  console.error("Error: FOOTBALL_DATA_TOKEN is not set — needed to join CBF fixtures to ours.");
  process.exit(1);
}

console.log(`==> Fetching our fixtures`);
const ourResponse = await fetch(matchesUrl(), { headers: { "X-Auth-Token": token } });
if (!ourResponse.ok) {
  console.error(`Error: football-data responded ${ourResponse.status}`);
  process.exit(1);
}
const ourRaw = (await ourResponse.json()) as MatchesResponse;
const ourMatches = mapMatches(ourRaw);
const ourClubs: Club[] = clubsFromMatches(ourRaw);
console.log(`    ${ourMatches.length} fixtures, ${ourClubs.length} clubs`);

const agent = await buildAgent();

console.log(`==> Fetching CBF broadcasts for ${from} .. ${to}`);

// CBF ignores per_page and serves 15 at a time, so walk the pages. A silent
// first-page-only read would look identical to "no broadcast listed".
const MAX_PAGES = 60;
const jogos: CbfJogo[] = [];
let page = 1;
let lastPage = 1;
do {
  const url =
    `https://${CBF_HOST}/api/cbf/onde-assistir/jogos` +
    `?dataInicio=${from}&dataTermino=${to}&page=${page}`;
  const body = await getJson<CbfResponse>(url, agent);
  jogos.push(...(body.jogos ?? []));
  lastPage = Number(body.meta?.last_page ?? 1);
  page += 1;

  // Pace the walk. This is someone else's undocumented endpoint, and hammering
  // it sequentially is what provoked the 502 in the first place.
  if (page <= lastPage) await sleep(400);
} while (page <= lastPage && page <= MAX_PAGES);

if (lastPage > MAX_PAGES) {
  // Never truncate quietly: a short read is indistinguishable from a quiet
  // weekend, and the missing fixtures would simply show no channels.
  console.error(
    `Error: CBF reports ${lastPage} pages but the cap is ${MAX_PAGES}. ` +
      `Narrow the date range and run again — a partial read would silently drop fixtures.`,
  );
  process.exit(1);
}

const serieA = jogos.filter((jogo) => jogo.competicao?.categoria_id === SERIE_A_CATEGORIA_ID);
console.log(
  `    ${jogos.length} fixtures across ${lastPage} page(s), ${serieA.length} in Série A`,
);

const broadcasts = replace ? {} : readExisting();
const before = Object.keys(broadcasts).length;
let joined = 0;
const unmatched: string[] = [];

for (const jogo of serieA) {
  const channels = channelsOf(jogo);
  if (channels.length === 0) continue;

  const id = joinMatch(ourMatches, ourClubs, jogo);
  if (!id) {
    unmatched.push(`${jogo.data} ${jogo.hora} ${jogo.mandante?.nome} x ${jogo.visitante?.nome}`);
    continue;
  }

  broadcasts[id] = channels;
  joined += 1;
  console.log(`    ${id}  ${jogo.mandante?.nome} x ${jogo.visitante?.nome}  ->  ${channels.join(", ")}`);
}

if (unmatched.length) {
  // Loud, because a silent skip looks identical to "no broadcast listed".
  console.warn(`    ${unmatched.length} Série A fixture(s) could not be joined:`);
  for (const line of unmatched) console.warn(`      ${line}`);
}

if (joined === 0 && serieA.length > 0) {
  console.error("Error: Série A fixtures were listed but none could be joined — check the club name matching.");
  process.exit(1);
}

const ids = Object.keys(broadcasts).sort((a, b) => Number(a) - Number(b));
const generatedOn = new Date().toISOString().slice(0, 10);

writeFileSync(
  path.join(ROOT, "src/data/broadcasts.ts"),
  `/**
 * GENERATED by scripts/sync-broadcasts.ts — but safe to hand-edit.
 *
 * The script merges rather than replaces, so entries added by hand survive a
 * later sync (use --replace to start clean). Transcribing from a screenshot
 * remains a supported way to add a fixture.
 *
 * Source: CBF's Onde Assistir API, an undocumented internal endpoint. It is read
 * here, on a workstation, and never by the running app — see
 * docs/data-sources.md.
 *
 * Keyed by **our** match id: CBF's ids are its own, and its three-letter codes
 * are not unique across competitions (one day's page showed \`ATH\` as both
 * Athletic Club in Série B and Athletico-PR in Série A).
 *
 * Last synced ${generatedOn}.
 */
export const BROADCASTS: Record<string, string[]> = {
${ids.map((id) => `  "${id}": [${broadcasts[id].map((c) => `"${c}"`).join(", ")}],`).join("\n")}
};
`,
);

console.log("");
console.log(
  `Wrote src/data/broadcasts.ts — ${ids.length} fixture(s) (${before} before, ${joined} synced this run)`,
);
