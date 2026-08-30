/**
 * sync-goals.ts
 * -------------
 * Regenerate src/data/goals.ts — who scored, per match — from CBF's own match
 * endpoint.
 *
 * Run by hand, like sync-broadcasts.ts, and for the same reason: the endpoint
 * is undocumented, unversioned, internal to CBF's site and governed by their
 * Termos de uso. Production never calls it.
 *
 * **Why this exists at all.** football-data carries no goal events at any tier
 * this app can reach — verified against a live Série A match *and* a live
 * Premier League one, both free TIER_ONE, both answering 200 with no `goals`
 * key. CBF's `/api/cbf/jogos/{id_jogo}` carries them in a `registros` array.
 *
 * Usage:
 *   npx tsx scripts/sync-goals.ts 2026-08-23 2026-08-24   # a date range
 *   npx tsx scripts/sync-goals.ts 2026-08-23              # one day
 *   npx tsx scripts/sync-goals.ts --replace 2026-03-01 2026-08-31
 *
 * Existing entries are kept unless --replace is passed, so a narrow range tops
 * the file up instead of wiping the season.
 *
 * **This is a slow script on purpose.** CBF throttles at the socket — see
 * `scripts/cbf-api.ts` — so it paces itself at roughly one match a second and a
 * full season takes several minutes. Do not "optimise" the sleep away.
 *
 * Exit codes:
 *   0  goals.ts written, everything that was fetched reconciled.
 *   1  bad arguments, upstream failure, nothing joinable, or — the interesting
 *      one — some matches did not reconcile or used a `resultado` code the
 *      vocabulary does not know. The file is still written with the matches
 *      that *did* reconcile, because that data is verified correct; the exit
 *      code and the report are what say the run was incomplete.
 */
import { writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";

import { buildAgent, CBF_HOST, getJson, sleep } from "@/scripts/cbf-api";
import { joinMatch, SERIE_A_CATEGORIA_ID, type CbfFixture } from "@/broadcast-core";
import {
  goalsFromRegistros,
  goalsReconcile,
  isKnownGoalResult,
  GOAL_TIPO,
  type CbfRegistro,
} from "@/goals-core";
import {
  clubsFromMatches,
  mapMatches,
  matchesUrl,
  type MatchesResponse,
} from "@/football-data-core";
import type { Club, Goal, Match } from "@/src/types";

const ROOT = process.cwd();

/** One fixture as the Onde Assistir listing reports it — the join key plus CBF's own id. */
interface CbfJogo extends CbfFixture {
  id_jogo?: string;
  visitante?: { nome?: string };
}

interface CbfListResponse {
  jogos?: CbfJogo[];
  meta?: { last_page?: number };
}

/** One match as `/api/cbf/jogos/{id}` reports it. Only the parts used here. */
interface CbfMatchResponse {
  jogo?: {
    mandante?: { id?: string; nome?: string; gols?: string | null };
    visitante?: { id?: string; nome?: string; gols?: string | null };
    registros?: CbfRegistro[];
  };
}

// ---------------------------------------------------------------------------
// Arguments
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

// ---------------------------------------------------------------------------
// Our fixtures, for the join
// ---------------------------------------------------------------------------

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

console.log("==> Fetching our fixtures");
const ourResponse = await fetch(matchesUrl(), { headers: { "X-Auth-Token": token } });
if (!ourResponse.ok) {
  console.error(`Error: football-data responded ${ourResponse.status}`);
  process.exit(1);
}
const ourRaw = (await ourResponse.json()) as MatchesResponse;
const ourMatches: Match[] = mapMatches(ourRaw);
const ourClubs: Club[] = clubsFromMatches(ourRaw);
console.log(`    ${ourMatches.length} fixtures, ${ourClubs.length} clubs`);

// ---------------------------------------------------------------------------
// CBF's fixture list, for the ids
// ---------------------------------------------------------------------------

const agent = await buildAgent();

console.log(`==> Fetching CBF fixtures for ${from} .. ${to}`);

const MAX_PAGES = 60;
const jogos: CbfJogo[] = [];
let page = 1;
let lastPage = 1;
do {
  const url =
    `https://${CBF_HOST}/api/cbf/onde-assistir/jogos` +
    `?dataInicio=${from}&dataTermino=${to}&page=${page}`;
  const body = await getJson<CbfListResponse>(url, agent);
  jogos.push(...(body.jogos ?? []));
  lastPage = Number(body.meta?.last_page ?? 1);
  page += 1;
  if (page <= lastPage) await sleep(600);
} while (page <= lastPage && page <= MAX_PAGES);

if (lastPage > MAX_PAGES) {
  // Never truncate quietly: a short read is indistinguishable from a quiet
  // weekend, and the missing fixtures would simply show no goals.
  console.error(
    `Error: CBF reports ${lastPage} pages but the cap is ${MAX_PAGES}. ` +
      `Narrow the date range and run again — a partial read would silently drop fixtures.`,
  );
  process.exit(1);
}

const serieA = jogos.filter((jogo) => jogo.competicao?.categoria_id === SERIE_A_CATEGORIA_ID);
console.log(`    ${jogos.length} fixtures across ${lastPage} page(s), ${serieA.length} in Série A`);

// ---------------------------------------------------------------------------
// The goals
// ---------------------------------------------------------------------------

const readExisting = async (): Promise<Record<string, Goal[]>> => {
  try {
    const existing = (await import("@/src/data/goals")) as { GOALS?: Record<string, Goal[]> };
    return { ...(existing.GOALS ?? {}) };
  } catch {
    return {};
  }
};

const goals: Record<string, Goal[]> = replace ? {} : await readExisting();
const before = Object.keys(goals).length;

const unjoined: string[] = [];
const unknownCodes = new Map<string, string>();
const unreconciled: string[] = [];
let written = 0;
let goalless = 0;

for (const jogo of serieA) {
  const id = joinMatch(ourMatches, ourClubs, jogo);
  const label = `${jogo.data} ${jogo.hora} ${jogo.mandante?.nome} x ${jogo.visitante?.nome}`;

  if (!id || !jogo.id_jogo) {
    unjoined.push(label);
    continue;
  }

  const ours = ourMatches.find((match) => match.id === id);
  if (!ours || ours.homeGoals === null || ours.awayGoals === null) {
    // Not played yet. Nothing to record, and not a problem to report.
    continue;
  }

  const body = await getJson<CbfMatchResponse>(
    `https://${CBF_HOST}/api/cbf/jogos/${jogo.id_jogo}`,
    agent,
  );
  // Deliberate, and load-bearing — see the header. CBF stops completing TLS
  // altogether if this loop runs flat out.
  await sleep(900);

  const detail = body.jogo;
  const homeCbfId = detail?.mandante?.id;
  const awayCbfId = detail?.visitante?.id;
  if (!detail || !homeCbfId || !awayCbfId) {
    unreconciled.push(`${label} — CBF returned no usable match detail`);
    continue;
  }

  const registros = detail.registros ?? [];

  // Check the vocabulary *before* trusting any of it. A `resultado` this
  // build has never seen might be an own goal, and an own goal counts for the
  // club that did not score it — so an unrecognised code is a reason to skip
  // the match, not to shrug and file the goal as ordinary.
  const strange = registros.filter(
    (registro) =>
      (registro.tipo ?? "").trim().toUpperCase() === GOAL_TIPO &&
      !isKnownGoalResult(registro.resultado),
  );
  if (strange.length > 0) {
    for (const registro of strange) {
      unknownCodes.set(String(registro.resultado), label);
    }
    unreconciled.push(
      `${label} — unknown resultado ${strange.map((r) => JSON.stringify(r.resultado)).join(", ")}`,
    );
    continue;
  }

  const scored = goalsFromRegistros(registros, {
    homeCbfId,
    awayCbfId,
    homeCode: ours.homeCode,
    awayCode: ours.awayCode,
  });

  // Two checks, each catching a different failure.
  //
  // The first is CBF against itself: do the goals it lists add up to the score
  // it reports? This is what would catch an own goal filed under the club that
  // scored it rather than the club it counts for.
  const cbfHome = Number(detail.mandante?.gols);
  const cbfAway = Number(detail.visitante?.gols);
  if (!goalsReconcile(scored, ours.homeCode, ours.awayCode, cbfHome, cbfAway)) {
    unreconciled.push(
      `${label} — CBF lists ${scored.length} goal(s) against its own ${cbfHome}x${cbfAway}`,
    );
    continue;
  }

  // The second is CBF against us: a disagreement here means the join picked the
  // wrong fixture, which would attach one match's goals to another.
  if (cbfHome !== ours.homeGoals || cbfAway !== ours.awayGoals) {
    unreconciled.push(
      `${label} — CBF says ${cbfHome}x${cbfAway}, we have ${ours.homeGoals}x${ours.awayGoals}`,
    );
    continue;
  }

  if (scored.length === 0) {
    // A real 0-0. Recording an empty array would be indistinguishable from
    // "not synced" to every reader of the file, so it is left out.
    goalless += 1;
    console.log(`    ${id}  ${label}  ->  0x0, nothing to record`);
    continue;
  }

  goals[id] = scored;
  written += 1;
  console.log(
    `    ${id}  ${jogo.mandante?.nome} x ${jogo.visitante?.nome}  ->  ` +
      scored.map((goal) => goal.scorer + (goal.kind ? ` (${goal.kind})` : "")).join(", "),
  );
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (unjoined.length) {
  console.warn(`    ${unjoined.length} Série A fixture(s) could not be joined:`);
  for (const line of unjoined) console.warn(`      ${line}`);
}

if (unreconciled.length) {
  console.warn(`\n    ${unreconciled.length} match(es) were NOT recorded:`);
  for (const line of unreconciled) console.warn(`      ${line}`);
}

if (unknownCodes.size) {
  console.warn(
    `\n    CBF used ${unknownCodes.size} resultado code(s) this build does not know:`,
  );
  for (const [code, where] of unknownCodes) console.warn(`      ${code}  (first seen: ${where})`);
  console.warn(
    `    Add them to GOAL_KINDS in goals-core.ts — and work out whether each one\n` +
      `    changes which club the goal counts for before deciding what it maps to.`,
  );
}

const ids = Object.keys(goals).sort((a, b) => Number(a) - Number(b));
const generatedOn = new Date().toISOString().slice(0, 10);

const render = (goal: Goal): string =>
  "{ " +
  [
    `clubCode: ${JSON.stringify(goal.clubCode)}`,
    `scorer: ${JSON.stringify(goal.scorer)}`,
    ...(goal.kind ? [`kind: ${JSON.stringify(goal.kind)}`] : []),
  ].join(", ") +
  " }";

writeFileSync(
  path.join(ROOT, "src/data/goals.ts"),
  `import type { Goal } from "@/src/types";

/**
 * GENERATED by scripts/sync-goals.ts — but safe to hand-edit.
 *
 * Who scored, per match. **No football-data tier this app can reach carries
 * goal events** — verified against a live Série A match and a live Premier
 * League one, both free, both answering with no \`goals\` key at all — so this
 * comes from CBF's own match endpoint, read on a workstation and never by the
 * running app. See \`docs/data-sources.md\`.
 *
 * Keyed by **our** match id, for the reason \`broadcasts.ts\` is: CBF's ids are
 * its own.
 *
 * **Every entry here has been reconciled against its own scoreline** — the
 * goals attributed to each club add up to that club's score, checked both
 * against CBF's reported score and against ours — and the sync refuses to write
 * one that does not. A missing match means "not synced, or did not reconcile",
 * never "goalless": a real 0-0 is deliberately absent rather than an empty
 * array, since the two would be indistinguishable here.
 *
 * Last synced ${generatedOn}.
 */
export const GOALS: Record<string, Goal[]> = {
${ids.map((id) => `  ${JSON.stringify(id)}: [\n${goals[id].map((goal) => `    ${render(goal)},`).join("\n")}\n  ],`).join("\n")}
};
`,
);

console.log(
  `\n==> Wrote src/data/goals.ts — ${ids.length} match(es) ` +
    `(${before} before, ${written} written this run, ${goalless} goalless)`,
);

if (unreconciled.length || unknownCodes.size) {
  console.error(
    `\nError: ${unreconciled.length} match(es) were skipped. The file above is correct as far\n` +
      `as it goes — every entry in it reconciles — but this run was incomplete.`,
  );
  process.exit(1);
}
