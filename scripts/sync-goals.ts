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
 *   npx tsx scripts/sync-goals.ts --fixture=554775:831919   # not in the listing
 *
 * Existing entries are kept unless --replace is passed, so a narrow range tops
 * the file up instead of wiping the season.
 *
 * `--fixture=<ourId>:<cbfId>` reaches a match the Onde Assistir listing does
 * not carry — a rescheduled fixture can be missing from it entirely. See the
 * flag's own comment for what that does and does not bypass.
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

import { buildAgent, CBF_HOST, cbfFixtureListing, getJson, sleep } from "@/scripts/cbf-api";
import {
  type CbfAtleta,
  attachSubstitutions,
  sidesWithoutStartingKeeper,
  lineupsFromAtletas,
  lineupsReconcile,
} from "@/escalacao-core";
import { joinMatch, SERIE_A_CATEGORIA_ID, type CbfFixture } from "@/broadcast-core";
import {
  assessCbfGoals,
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
  parseSumulaSubstitutions,
  parseSumulaScores,
  sumulaMinutes,
  sumulaUrlFrom,
  type SumulaDocumento,
} from "@/sumula-core";
import { renderEscalacoesFile, renderGoalsFile } from "@/scripts/sync-goals-files";
import type { Club, Goal, Lineup, Match } from "@/src/types";

const ROOT = process.cwd();

/** One fixture as the Onde Assistir listing reports it — the join key plus CBF's own id. */
interface CbfJogo extends CbfFixture {
  id_jogo?: string;
  visitante?: { nome?: string };
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
    mandante?: {
      id?: string;
      nome?: string;
      gols?: string | null;
      atletas?: CbfAtleta[];
      /** Only its LENGTH is read: the count the súmula must agree with. */
      alteracoes?: unknown[];
    };
    visitante?: {
      id?: string;
      nome?: string;
      gols?: string | null;
      atletas?: CbfAtleta[];
      alteracoes?: unknown[];
    };
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

/**
 * `--fixture <ourId>:<cbfId>` — a fixture the Onde Assistir listing does not
 * carry, named directly.
 *
 * **A rescheduled match can be absent from that listing entirely**, and the
 * listing is the only route this script has to a `id_jogo`. Measured on
 * `554775` (Flamengo x Mirassol, rodada 4, played 2026-09-02 after being
 * postponed): swept 2026-08-20..2026-09-30, 219 fixtures over 15 pages, **zero**
 * rows naming those two clubs — while `/api/cbf/jogos/831919` serves the match
 * in full, team sheets and all. So the data was reachable and the join was not,
 * and without this flag such a fixture can never be synced.
 *
 * **It bypasses the join, not the checking.** The scoreline check further down
 * — CBF's own score against ours — is what proves an id names the fixture it
 * claims to, and it is untouched: a wrong id is refused there exactly as a
 * mis-joined one is. That check is the whole reason naming an id by hand is
 * safe, so do not "simplify" it away for forced fixtures.
 */
const forced = args
  .filter((arg) => arg.startsWith("--fixture="))
  .map((arg) => arg.slice("--fixture=".length));

const forcedPairs = forced.map((pair) => {
  const match = /^(\d+):(\d+)$/.exec(pair);
  if (!match) {
    console.error(`Error: expected --fixture=<ourId>:<cbfId>, got "${pair}"`);
    process.exit(1);
  }
  return { ourId: match[1], cbfId: match[2] };
});

/**
 * With `--fixture` and no dates there is nothing to walk, and walking anyway
 * would spend a page request on today's listing to ignore every row in it.
 */
const listingWanted = forcedPairs.length === 0 || dates.length > 0;

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

if (listingWanted) console.log(`==> Fetching CBF fixtures for ${from} .. ${to}`);

// Every page, paced, and refused rather than truncated: a short read would
// simply show no goals for the fixtures it dropped.
const { jogos, lastPage } = listingWanted
  ? await cbfFixtureListing<CbfJogo>(from, to, agent)
  : { jogos: [] as CbfJogo[], lastPage: 1 };

const serieA = jogos.filter((jogo) => jogo.competicao?.categoria_id === SERIE_A_CATEGORIA_ID);
if (listingWanted) {
  console.log(`    ${jogos.length} fixtures across ${lastPage} page(s), ${serieA.length} in Série A`);
}

/**
 * One list for the loop, so a fixture named with `--fixture` runs through
 * exactly the same body — the vocabulary check, both reconciliations, the
 * súmula, the substitutions. A second loop for forced fixtures is how the two
 * paths come to apply different rules.
 *
 * `ourId` is set only for a forced fixture; where it is absent the join runs as
 * it always has.
 */
const targets: { jogo: CbfJogo; ourId?: string }[] = [
  ...serieA.map((jogo) => ({ jogo }) as { jogo: CbfJogo; ourId?: string }),
  ...forcedPairs.map(({ ourId, cbfId }) => ({ jogo: { id_jogo: cbfId } as CbfJogo, ourId })),
];
if (forcedPairs.length > 0) {
  console.log(`    ${forcedPairs.length} fixture(s) named directly with --fixture`);
}

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
const noSubs: string[] = [];
const noKeeper: string[] = [];

const unjoined: string[] = [];
const unknownCodes = new Map<string, string>();
/** Matches recorded without a minute, and why. Never a reason to refuse one. */
const withoutMinutes: string[] = [];
const unreconciled: string[] = [];
let written = 0;
let goalless = 0;

for (const { jogo, ourId } of targets) {
  const id = ourId ?? joinMatch(ourMatches, ourClubs, jogo);
  // A forced fixture has no listing row to name itself with, so it borrows our
  // own record — which is also the only description of it that exists here.
  const label = ourId
    ? `--fixture ${ourId}:${jogo.id_jogo}`
    : `${jogo.data} ${jogo.hora} ${jogo.mandante?.nome} x ${jogo.visitante?.nome}`;

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

  // Every refusal between CBF's payload and a recorded goal list, in the order the
  // rule needs them — the vocabulary first, then a score, then CBF against itself,
  // then CBF against us. See `assessCbfGoals`, where each branch is tested.
  const verdict = assessCbfGoals(
    detail.registros ?? [],
    { home: detail.mandante?.gols, away: detail.visitante?.gols },
    { homeCbfId, awayCbfId, homeCode: ours.homeCode, awayCode: ours.awayCode },
    { homeGoals: ours.homeGoals, awayGoals: ours.awayGoals },
  );
  if (!verdict.ok) {
    for (const code of verdict.unknownCodes) unknownCodes.set(code, label);
    unreconciled.push(`${label} — ${verdict.reason}`);
    continue;
  }
  const scored = verdict.goals;

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

  /**
   * The súmula, fetched **once** and read twice — for the goal minutes below
   * and for the substitutions just above them.
   *
   * It moved above the 0-0 skip when substitutions landed, and that is a
   * deliberate widening rather than a refactor: a goalless match has no minutes
   * to look up but it does have substitutions, so leaving the fetch where it was
   * would have silently excluded every 0-0 from the one feature that is mostly
   * about time. The cost is one extra PDF per goalless fixture.
   */
  const sumulaUrl = sumulaUrlFrom(detail.documentos);
  let sumula: string | null = null;
  if (sumulaUrl) {
    sumula = await sumulaText(sumulaUrl, agent);
    await sleep(SUMULA_PACE_MS);
  }

  if (lineupsReconcile(lineups)) {
    /**
     * Substitutions ride on the sheet rather than being their own record,
     * because a change is only meaningful against the eleven it changed — and
     * because the shirt number is the join, so one cannot be resolved without
     * the other.
     *
     * `attachSubstitutions` is all-or-nothing per fixture. Failing here leaves
     * the escalação recorded without `subs`, which is the same soft failure the
     * minutes take: a sheet with no changes listed is honest, a sheet missing
     * one change is a lie about the match.
     */
    const expected: Record<string, number> = {
      [ours.homeCode]: detail.mandante?.alteracoes?.length ?? 0,
      [ours.awayCode]: detail.visitante?.alteracoes?.length ?? 0,
    };
    const teams = [
      { code: ours.homeCode, cbfName: String(detail.mandante?.nome ?? "") },
      { code: ours.awayCode, cbfName: String(detail.visitante?.nome ?? "") },
    ];
    const withSubs = sumula
      ? attachSubstitutions(lineups, parseSumulaSubstitutions(sumula), teams, expected)
      : null;
    if (!withSubs && sumula) {
      noSubs.push(`${label} — súmula's Substituições did not line up with the match API`);
    } else if (!sumula) {
      noSubs.push(`${label} — no súmula to read substitutions from`);
    }
    // Recorded, never refused — see `sidesWithoutStartingKeeper`. Four sides of
    // the season reach this, and three of them are perfect sheets whose keeper
    // CBF simply did not flag.
    const keeperless = sidesWithoutStartingKeeper(lineups);
    if (keeperless.length > 0) {
      noKeeper.push(`${label} — no goalkeeper among the eleven: ${keeperless.join(", ")}`);
    }
    escalacoes[id] = withSubs ?? lineups;
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
  let minutes: string[] | null = null;
  if (sumula) {
    minutes = sumulaMinutes(scored.length, parseSumulaGoals(sumula), parseSumulaScores(sumula));
    if (!minutes) withoutMinutes.push(`${label} — súmula did not line up with the goal list`);
  } else if (sumulaUrl) {
    withoutMinutes.push(`${label} — súmula could not be read`);
  } else {
    withoutMinutes.push(`${label} — no súmula published yet`);
  }

  goals[id] = minutes
    ? scored.map((goal, index) => ({ ...goal, minute: minutes[index] }))
    : scored;
  written += 1;
  console.log(
    `    ${id}  ${detail.mandante?.nome ?? "?"} x ${detail.visitante?.nome ?? "?"}  ->  ` +
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

writeFileSync(
  path.join(ROOT, "src/data/goals.ts"),
  // The file's whole shape lives in `scripts/sync-goals-files.ts`, beside the
  // escalações renderer, so the tuples this writes and the tuples `decodeGoals`
  // reads back cannot come to disagree.
  renderGoalsFile(goals, generatedOn),
);

console.log(
  `\n==> Wrote src/data/goals.ts — ${ids.length} match(es) ` +
    `(${before} before, ${written} written this run, ${goalless} goalless)`,
);

// ---------------------------------------------------------------------------
// The escalações, from the same payloads
// ---------------------------------------------------------------------------

const lineupIds = Object.keys(escalacoes).sort((a, b) => Number(a) - Number(b));

writeFileSync(
  path.join(ROOT, "src/data/escalacoes.ts"),
  // The file's whole shape — the encoding, the prose and where the newlines go
  // — is `scripts/sync-goals-files.ts`, so the tuples this writes and the tuples
  // `decodeLineups` reads back cannot come to disagree. It used to be a heredoc
  // here enumerating each field by hand, which is how adding
  // `Substitution.onShirt` to the type left the writer emitting the three
  // fields it already knew: a resync then produced a file identical to the one
  // it replaced, and the new field looked broken rather than unwritten.
  renderEscalacoesFile(escalacoes, generatedOn),
);

console.log(
  `==> Wrote src/data/escalacoes.ts — ${lineupIds.length} match(es) ` +
    `(${lineupsBefore} before, ${lineupIds.length - lineupsBefore} added this run)`,
);

if (noSubs.length) {
  console.warn(`\n    ${noSubs.length} team sheet(s) recorded WITHOUT substitutions:`);
  for (const line of noSubs) console.warn(`      ${line}`);
  console.warn(
    `    Not a failure — the sheets are recorded and correct. A re-run picks the\n` +
      `    changes up once CBF publishes a súmula whose table agrees with the API.`,
  );
}

if (noKeeper.length) {
  console.warn(`\n    ${noKeeper.length} team sheet(s) whose eleven names NO goalkeeper:`);
  for (const line of noKeeper) console.warn(`      ${line}`);
  console.warn(
    `    Not a failure, and not repairable here. CBF marks two goleiros a side and\n` +
      `    occasionally flags only the reserve; the sheet is otherwise complete and the\n` +
      `    page simply prints no (GOL). Do NOT infer the keeper from shirt 1 — it is a\n` +
      `    convention rather than a law, and a wrong (GOL) is a claim about a person.`,
  );
}

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
