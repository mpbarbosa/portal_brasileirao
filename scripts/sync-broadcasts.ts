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
import path from "node:path";

import { buildAgent, CBF_HOST, getJson, sleep } from "@/scripts/cbf-api";
import {
  channelsOf,
  joinMatch,
  SERIE_A_CATEGORIA_ID,
  venueFromLocal,
  type CbfFixture,
} from "@/broadcast-core";
import {
  clubsFromMatches,
  mapMatches,
  matchesUrl,
  type MatchesResponse,
} from "@/football-data-core";
import type { Club, Venue } from "@/src/types";

const ROOT = process.cwd();

/** Quote a value for the generated source. */
const ts = (value: string) => JSON.stringify(value);

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

// The TLS dance and the JSON reader live in scripts/cbf-api.ts, shared with
// sync-goals.ts — a second copy of them is where drift starts, which is the
// lesson scripts/commons-api.ts records for Wikimedia.

// ---------------------------------------------------------------------------
// Existing file
// ---------------------------------------------------------------------------

const readExistingVenues = (): Record<string, Venue> => {
  try {
    const source = readFileSync(path.join(ROOT, "src/data/venues.ts"), "utf8");
    const entries: Record<string, Venue> = {};

    for (const line of source.split("\n")) {
      const entry =
        /"(\d+)"\s*:\s*\{\s*stadium:\s*"([^"]*)",\s*city:\s*"([^"]*)",\s*state:\s*"([^"]*)"/.exec(
          line,
        );
      if (entry) entries[entry[1]] = { stadium: entry[2], city: entry[3], state: entry[4] };
    }

    return entries;
  } catch {
    return {};
  }
};

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
const venues: Record<string, Venue> = replace ? {} : readExistingVenues();
const before = Object.keys(broadcasts).length;
let joined = 0;
const unmatched: string[] = [];

for (const jogo of serieA) {
  const id = joinMatch(ourMatches, ourClubs, jogo);
  if (!id) {
    unmatched.push(`${jogo.data} ${jogo.hora} ${jogo.mandante?.nome} x ${jogo.visitante?.nome}`);
    continue;
  }

  // A fixture can be listed with a venue but no channels yet, so these are
  // recorded independently rather than one gating the other.
  const venue = venueFromLocal(jogo.local);
  if (venue) venues[id] = venue;

  const channels = channelsOf(jogo);
  if (channels.length > 0) {
    broadcasts[id] = channels;
    joined += 1;
  }

  console.log(
    `    ${id}  ${jogo.mandante?.nome} x ${jogo.visitante?.nome}  ->  ` +
      `${channels.join(", ") || "(no channels)"}${venue ? `  @ ${venue.stadium}` : ""}`,
  );
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

const venueIds = Object.keys(venues).sort((a, b) => Number(a) - Number(b));

writeFileSync(
  path.join(ROOT, "src/data/venues.ts"),
  `import type { Venue } from "@/src/types";

/**
 * GENERATED by scripts/sync-broadcasts.ts — but safe to hand-edit.
 *
 * Stadium, city and state per match, keyed by **our** match id. The data
 * provider carries no venue field at all, so this comes from CBF's Onde
 * Assistir feed, which reports it as "Stadium - City - UF".
 *
 * Values are verbatim: CBF's casing and accents drift (\`ARENA MRV\`,
 * \`Sao Paulo\` without the tilde) and correcting them would mean guessing at
 * proper names.
 *
 * Last synced ${generatedOn}.
 */
export const VENUES: Record<string, Venue> = {
${venueIds
  .map(
    (id) =>
      `  "${id}": { stadium: ${ts(venues[id].stadium)}, city: ${ts(venues[id].city)}, ` +
      `state: ${ts(venues[id].state)} },`,
  )
  .join("\n")}
};
`,
);

console.log("");
console.log(
  `Wrote src/data/broadcasts.ts — ${ids.length} fixture(s) (${before} before, ${joined} synced this run)`,
);
console.log(`Wrote src/data/venues.ts     — ${venueIds.length} venue(s)`);
