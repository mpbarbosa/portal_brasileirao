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
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";

import { buildAgent, CBF_HOST, getJson, sleep } from "@/scripts/cbf-api";
import { type CbfAtleta, lineupsFromAtletas, lineupsReconcile } from "@/escalacao-core";
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
import {
  parseSumulaGoals,
  parseSumulaScores,
  sumulaMinutes,
  sumulaUrlFrom,
  type SumulaDocumento,
} from "@/sumula-core";
import type { Club, Goal, Lineup, LineupPlayer, Match } from "@/src/types";

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
    /**
     * `atletas` is 23 a side and is the escalação — the same lesson
     * `documentos` records one field down: it has been in every response this
     * script has ever read, and was simply not declared. Narrowing to what you
     * need is right; re-read the payload before concluding a feature needs a
     * second request.
     */
    mandante?: { id?: string; nome?: string; gols?: string | null; atletas?: CbfAtleta[] };
    visitante?: { id?: string; nome?: string; gols?: string | null; atletas?: CbfAtleta[] };
    registros?: CbfRegistro[];
    /**
     * The three PDFs CBF publishes per match — súmula, boletim financeiro,
     * relatório de jogo.
     *
     * **Already in every response this script reads; it simply was not
     * declared.** Narrowing an interface to what you need is right, and the
     * cost shows up exactly here: the minute looked like it needed a second
     * request and needs none. See `sumulaUrlFrom` for why the entry is chosen
     * by URL suffix rather than by its title.
     */
    documentos?: SumulaDocumento[];
  };
}

// ---------------------------------------------------------------------------
// The súmula, and the minute only it carries
// ---------------------------------------------------------------------------

/**
 * Read a súmula and turn it into text.
 *
 * **`pdftotext -layout` is a hard dependency of this step and a soft one of the
 * script**, which is the right way round. It is poppler, it is not in
 * `package.json`, and a workstation without it must still be able to sync
 * goals — so a missing binary costs the minutes and nothing else. The same
 * bargain the whole minute feature strikes: absent, never wrong.
 *
 * `-layout` is not decoration. The Gols table is columns held apart by runs of
 * spaces, and without it the scorer, the club and the period arrive
 * concatenated in reading order with nothing to split on.
 */
const sumulaText = async (url: string, agent: https.Agent): Promise<string | null> => {
  const bytes: Buffer | null = await new Promise((resolve) => {
    https
      .get(url, { agent }, (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          resolve(null);
          return;
        }
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(chunk as Buffer));
        response.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", () => resolve(null));
  });
  if (!bytes) return null;

  const dir = mkdtempSync(path.join(os.tmpdir(), "sumula-"));
  const pdf = path.join(dir, "s.pdf");
  writeFileSync(pdf, bytes);
  try {
    return execFileSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8", maxBuffer: 8 << 20 });
  } catch {
    return null;
  }
};

/**
 * `conteudo.cbf.com.br` is a **different edge** from `www` — it kept answering
 * throughout a 72-minute socket-level ban on `www` and `cms`. That is why the
 * minute is reachable at all, and it is not a licence: two requests one evening
 * is no evidence an edge tolerates a sweep, and it is the same organisation.
 * Paced like `www`, at roughly one request a second.
 */
const SUMULA_PACE_MS = 900;

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

const readExistingLineups = async (): Promise<Record<string, Lineup[]>> => {
  try {
    const existing = (await import("@/src/data/escalacoes")) as {
      ESCALACOES?: Record<string, Lineup[]>;
    };
    return { ...(existing.ESCALACOES ?? {}) };
  } catch {
    return {};
  }
};

const goals: Record<string, Goal[]> = replace ? {} : await readExisting();
const before = Object.keys(goals).length;

/**
 * The escalações ride along on the request this script already makes.
 *
 * A `sync-escalacoes.ts` would have walked the same listing, resolved the same
 * join and fetched the same `/api/cbf/jogos/{id}` a second time — a second copy
 * of ~250 lines, and twice the traffic against a host that throttles at the
 * **socket** with no 429 to tell you. The escalação is in the payload already on
 * the wire, so it is read here. The cost is a command called `sync-goals` that
 * also writes `escalacoes.ts`, which is stated in both files and in CLAUDE.md;
 * the benefit is that the two files can never disagree about which matches are
 * covered.
 */
const escalacoes: Record<string, Lineup[]> = replace ? {} : await readExistingLineups();
const lineupsBefore = Object.keys(escalacoes).length;
const noLineup: string[] = [];

const unjoined: string[] = [];
const unknownCodes = new Map<string, string>();
/** Matches recorded without a minute, and why. Never a reason to refuse one. */
const withoutMinutes: string[] = [];
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

  /**
   * The escalação, recorded here and not further down, because everything below
   * this point is about goals and two of those branches `continue`.
   *
   * In particular a 0-0 skips out a few lines from now — and a goalless match
   * has a perfectly good team sheet. Reading the lineup after the scoreline
   * check above is also what makes it trustworthy: that check is the one that
   * proves the join picked *this* fixture, so a lineup written before it could
   * be another match's eleven.
   *
   * A match refused earlier for an unknown `resultado` gets no lineup either.
   * Its team sheet is probably fine, but a partial record of a match this script
   * has declared it does not understand is not worth the branch.
   */
  const sides = {
    homeCbfId,
    awayCbfId,
    homeCode: ours.homeCode,
    awayCode: ours.awayCode,
  };
  const lineups = lineupsFromAtletas(detail.mandante, detail.visitante, sides);
  if (lineupsReconcile(lineups)) {
    escalacoes[id] = lineups;
  } else if (lineups.length > 0 || (detail.mandante?.atletas?.length ?? 0) > 0) {
    noLineup.push(
      `${label} — team sheet incomplete (` +
        lineups
          .map((l) => `${l.clubCode}: ${l.players.filter((p) => p.starter).length}/11`)
          .join(", ") +
        ")",
    );
  } else {
    noLineup.push(`${label} — CBF published no team sheet`);
  }

  if (scored.length === 0) {
    // A real 0-0. Recording an empty array would be indistinguishable from
    // "not synced" to every reader of the file, so it is left out.
    goalless += 1;
    console.log(`    ${id}  ${label}  ->  0x0, nothing to record`);
    continue;
  }

  /**
   * The minute, from the one source that has it.
   *
   * Everything here fails **soft**: no `documentos`, no súmula published yet,
   * a PDF that will not fetch, no `pdftotext` on this machine, or a parse that
   * does not line up with the API's goal list — every one of those records the
   * match exactly as it would have been recorded before, without minutes.
   * A goal with no minute is the ordinary state; a goal with the *wrong*
   * minute would be a plausible lie, which is why `sumulaMinutes` refuses
   * rather than doing its best.
   */
  const sumulaUrl = sumulaUrlFrom(detail.documentos);
  let minutes: string[] | null = null;
  if (sumulaUrl) {
    const text = await sumulaText(sumulaUrl, agent);
    await sleep(SUMULA_PACE_MS);
    if (text) {
      minutes = sumulaMinutes(scored.length, parseSumulaGoals(text), parseSumulaScores(text));
      if (!minutes) withoutMinutes.push(`${label} — súmula did not line up with the goal list`);
    } else {
      withoutMinutes.push(`${label} — súmula could not be read`);
    }
  } else {
    withoutMinutes.push(`${label} — no súmula published yet`);
  }

  goals[id] = minutes
    ? scored.map((goal, index) => ({ ...goal, minute: minutes[index] }))
    : scored;
  written += 1;
  console.log(
    `    ${id}  ${jogo.mandante?.nome} x ${jogo.visitante?.nome}  ->  ` +
      goals[id]
        .map(
          (goal) =>
            goal.scorer + (goal.kind ? ` (${goal.kind})` : "") + (goal.minute ? ` ${goal.minute}` : ""),
        )
        .join(", "),
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

if (withoutMinutes.length) {
  console.warn(`\n    ${withoutMinutes.length} match(es) recorded WITHOUT minutes:`);
  for (const line of withoutMinutes) console.warn(`      ${line}`);
  console.warn(
    `    Not a failure — the goals are recorded and correct. A re-run picks the\n` +
      `    minutes up once CBF publishes the súmula, and \`pdftotext\` (poppler)\n` +
      `    must be on PATH for any of them to be read at all.`,
  );
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
    ...(goal.minute ? [`minute: ${JSON.stringify(goal.minute)}`] : []),
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

// ---------------------------------------------------------------------------
// The escalações, from the same payloads
// ---------------------------------------------------------------------------

const lineupIds = Object.keys(escalacoes).sort((a, b) => Number(a) - Number(b));

const renderPlayer = (player: LineupPlayer): string =>
  "{ " +
  [
    `name: ${JSON.stringify(player.name)}`,
    `shirt: ${JSON.stringify(player.shirt)}`,
    ...(player.keeper ? ["keeper: true"] : []),
    ...(player.starter ? ["starter: true"] : []),
  ].join(", ") +
  " }";

writeFileSync(
  path.join(ROOT, "src/data/escalacoes.ts"),
  `import type { Lineup } from "@/src/types";

/**
 * GENERATED by scripts/sync-goals.ts — the same run that writes goals.ts.
 *
 * **One script, because the escalação is in the payload the goals already
 * arrive in.** A second sync would have walked the same listing, resolved the
 * same join and re-fetched every match — doubling the traffic against a host
 * that throttles at the socket with no 429 to warn you.
 *
 * Who started and who was on the bench, keyed by **our** match id. Every entry
 * carries two complete sheets of eleven starters; \`lineupsReconcile\` refuses
 * anything less, so an absent match means "not synced or not published", never
 * "no lineup".
 *
 * Generated ${generatedOn}.
 */
export const ESCALACOES: Record<string, Lineup[]> = {
${lineupIds
  .map(
    (id) =>
      `  ${JSON.stringify(id)}: [\n` +
      escalacoes[id]
        .map(
          (lineup) =>
            `    {\n      clubCode: ${JSON.stringify(lineup.clubCode)},\n` +
            `      players: [\n` +
            lineup.players.map((player) => `        ${renderPlayer(player)},`).join("\n") +
            `\n      ],\n    },`,
        )
        .join("\n") +
      `\n  ],`,
  )
  .join("\n")}
};
`,
);

console.log(
  `==> Wrote src/data/escalacoes.ts — ${lineupIds.length} match(es) ` +
    `(${lineupsBefore} before, ${lineupIds.length - lineupsBefore} added this run)`,
);

if (noLineup.length) {
  console.warn(`\n    ${noLineup.length} match(es) recorded WITHOUT a team sheet:`);
  for (const line of noLineup) console.warn(`      ${line}`);
  console.warn(
    `    Not a failure — the goals for those matches are recorded and correct.\n` +
      `    A re-run picks the sheet up once CBF publishes a complete one.`,
  );
}

if (unreconciled.length || unknownCodes.size) {
  console.error(
    `\nError: ${unreconciled.length} match(es) were skipped. The file above is correct as far\n` +
      `as it goes — every entry in it reconciles — but this run was incomplete.`,
  );
  process.exit(1);
}
