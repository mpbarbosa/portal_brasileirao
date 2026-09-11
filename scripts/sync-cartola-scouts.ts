/**
 * sync-cartola-scouts.ts
 * ----------------------
 * Regenerate `src/data/club-scouts.ts` — every club's season scout counters,
 * the per-action figures (finalizações, desarmes, faltas, cartões, defesas) that
 * **no provider this app can reach reports at any tier**.
 *
 * Source: `henriquepgomide/caRtola` (MIT), which commits a CSV snapshot of the
 * Cartola FC market roughly weekly. Read here, on a workstation, and committed —
 * production never fetches it, exactly as for `broadcasts.ts` and `goals.ts`.
 *
 * `docs/data-sources.md` assessed this source and **rejected it for fixtures**,
 * correctly: it carries no scoreline, no status and no kickoff, and it is a week
 * behind. None of that binds a season aggregate. A rate measured through round
 * 24 is still true on the Saturday of round 25; a *scoreline* a week old is not.
 *
 * Usage:  npx tsx scripts/sync-cartola-scouts.ts
 *         npx tsx scripts/sync-cartola-scouts.ts --season 2026
 *         npx tsx scripts/sync-cartola-scouts.ts --season 2027 --allow-fewer-rounds  # a new season
 *
 * ## Two properties of the source that decide the whole shape of this script
 *
 * **1. The counters are cumulative season totals, not per-round.** A round's
 * figures exist only as the difference between two consecutive snapshots.
 *
 * **2. A counter follows the player through a transfer, so summing one snapshot
 * by club is wrong** — and wrong in a way that looks like data. Measured on the
 * 2026 round-24 file against our own seed: Botafogo's `GS` sums to **5** against
 * 37 conceded, Internacional's to **39** against 28, because a goalkeeper's
 * whole season moves with him to the new badge. Differencing the snapshots and
 * attributing each increment to the club the player was listed at **in that
 * snapshot** fixes it: goals-against then matched the seed exactly for 12 of 20
 * clubs, total error 24 across 611 goals.
 *
 * Only positive increments are counted. A negative one means a player left and
 * a new id took his place in the file, never that an action was undone.
 *
 * ## What this script deliberately does not write
 *
 * **Gols sofridos and gols contra**, both of which the source carries. The
 * standings and `src/data/goals.ts` answer those authoritatively and this copy
 * is measurably worse. A second, wronger answer to a question already on the
 * page is how the two come to disagree in front of a reader.
 *
 * ## What it cannot fix, and why nothing here plots a rodada
 *
 * The snapshot is weekly and a midweek round falls between two of them, so a
 * round's actions can land in a neighbouring window. Measured across the 2026
 * season to round 24: of 470 club-rounds, **441 windows held exactly one match,
 * 19 held none and 10 held two** — 94% right. That is fine for a season total,
 * which is the sum either way, and it is not fine for a bar per rodada, where a
 * club that played would draw an empty column. Season aggregates are therefore
 * the only thing this file carries.
 */
import { existsSync, writeFileSync } from "node:fs";

import { counterValue, fewerRoundsRefusal, parseCsv, type Snapshot } from "@/cartola-csv-core";
import path from "node:path";

import { validateScouts } from "@/scouts-validation-core";
import { CLUBS } from "@/src/data/clubs";
import { SEED_MATCHES, SNAPSHOT_DATE } from "@/src/data/matches";
import type { ClubScouts, ScoutHistoryEntry } from "@/src/types";

const ROOT = process.cwd();
const RAW = "https://raw.githubusercontent.com/henriquepgomide/caRtola/master/data/01_raw";

/**
 * caRtola's club abbreviation to our club **slug**.
 *
 * Hand-written, and it may not be replaced by a `tla` join however much it
 * looks like one. `docs/data-sources.md` records why: our Coritiba is `COR`,
 * which is caRtola's **Corinthians**, so the join silently merges two clubs and
 * produces numbers rather than an error. Four more disagree without colliding
 * (`FBP`/GRE, `PAU`/SAO, `SCI`/INT, `CRE`/REM).
 *
 * Keyed on the slug rather than the code because the code is an opaque upstream
 * id: `1783` cannot be checked by reading, and `flamengo` can.
 */
const CLUB_BY_ABBREVIATION: Record<string, string> = {
  BAH: "bahia",
  BOT: "botafogo",
  CAM: "atletico-mg",
  CAP: "athletico-pr",
  CFC: "coritiba",
  CHA: "chapecoense",
  COR: "corinthians",
  CRU: "cruzeiro",
  FLA: "flamengo",
  FLU: "fluminense",
  GRE: "gremio",
  INT: "internacional",
  MIR: "mirassol",
  PAL: "palmeiras",
  RBB: "bragantino",
  REM: "clube-do-remo",
  SAN: "santos",
  SAO: "sao-paulo",
  VAS: "vasco-da-gama",
  VIT: "vitoria",
};

/** The scout columns this script reads, and the field each becomes. */
const COUNTERS = {
  G: "goals",
  FD: "shotsSaved",
  FF: "shotsOff",
  FT: "shotsWoodwork",
  DS: "tackles",
  FC: "foulsCommitted",
  CA: "yellowCards",
  CV: "redCards",
  DE: "saves",
} as const satisfies Record<string, keyof ClubScouts>;

type CounterField = (typeof COUNTERS)[keyof typeof COUNTERS];

/**
 * The source's own per-player match count — the **denominator's** source, and
 * deliberately not one of `COUNTERS`.
 *
 * It is read for one question the scout columns cannot answer: how many matches
 * a club's counters actually cover. See `accumulate`.
 */
const GAMES = "atletas.jogos_num";

const season = seasonArgument();
const CLUB_BY_SLUG = new Map(CLUBS.map((club) => [club.slug, club]));
let previousRound: number | null = null;

main().catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

async function main(): Promise<void> {
  // Read before anything is written, or it reports the value this run is about
  // to produce and no sync ever looks like it advanced.
  previousRound = await committedRound();

  const snapshots = await readSeason();
  console.log(`Read ${snapshots.length} snapshots for ${season} (rodada 1..${snapshots.length}).`);

  // Before anything is accumulated or written: see `fewerRoundsRefusal`.
  const refusal = fewerRoundsRefusal(
    snapshots.length,
    previousRound,
    process.argv.includes("--allow-fewer-rounds"),
  );
  if (refusal) throw new Error(refusal);

  const { totals, history } = accumulate(snapshots);
  validate(totals, history, snapshots.length);
  write(totals, history, snapshots.length);
}

/* ------------------------------------------------------------------ reading */

/**
 * Every round file from 1 upward, stopping at the first that is not published.
 *
 * **Contiguity is a hard requirement, not a tidiness check.** A gap does not
 * fail: differencing round 6 against round 8 succeeds and quietly attributes two
 * rounds of actions to one window, which is invisible in the output and changes
 * every rate that follows. So the walk stops at the first absence rather than
 * skipping it, and a 404 at round 1 is an error.
 */
async function readSeason(): Promise<Snapshot[]> {
  const snapshots: Snapshot[] = [];

  for (let round = 1; round <= 38; round += 1) {
    const url = `${RAW}/${season}/rodada-${round}.csv`;
    const response = await fetch(url);

    if (response.status === 404) break;
    if (!response.ok) {
      throw new Error(`${url} answered ${response.status} ${response.statusText}`);
    }

    // Every column the walk reads is required, so a rename upstream refuses the
    // round instead of reading as zeros. `GAMES` is the denominator's source, so
    // its absence would make every club cover no matches at all; the counters'
    // absence would publish a division of zeros. See `cartola-csv-core.ts`.
    snapshots.push(parseCsv(await response.text(), [GAMES, ...Object.keys(COUNTERS)]));
    // Polite rather than necessary: raw.githubusercontent does not throttle the
    // way CBF does, and 38 requests is not a reason to find out.
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  if (snapshots.length === 0) {
    throw new Error(`No rodada file found under ${RAW}/${season}/ — is the season published?`);
  }
  return snapshots;
}

/* --------------------------------------------------------------- accumulating */

/**
 * Season totals per club, by differencing consecutive snapshots — and the same
 * totals **as they stood after each one**, which is the rastro the Perfil
 * scatters draw.
 *
 * The history costs one extra pass over twenty clubs per snapshot and no extra
 * request: this loop already walks every snapshot in order and already holds the
 * running totals, and until now it threw away every state but the last.
 *
 * **The counters must be COPIED at capture, and a reference is the bug to look
 * for.** `totals` holds mutated objects — `entry[field] += delta` writes through
 * the same reference every round — so pushing `entry` itself stores an alias and
 * every round of every club ends up holding the *final* totals. The output is a
 * perfectly flat rastro, which reads as a club with no form rather than as a
 * defect, and nothing else in this file would refuse it. `validate` asserts a
 * strict increase somewhere for exactly that reason.
 */
function accumulate(snapshots: Snapshot[]): {
  totals: Map<string, ClubScouts>;
  history: Map<string, ScoutHistoryEntry[]>;
} {
  const totals = new Map<string, ClubScouts>();
  const history = new Map<string, ScoutHistoryEntry[]>(CLUBS.map((club) => [club.code, []]));
  // Matches each club's counters actually cover, cumulative. See the block above
  // `entry.matches` below for why this is not `playedThrough`.
  const covered = new Map<string, number>(CLUBS.map((club) => [club.code, 0]));

  const blank = (clubCode: string): ClubScouts => ({
    clubCode,
    matches: 0,
    goals: 0,
    shotsSaved: 0,
    shotsOff: 0,
    shotsWoodwork: 0,
    tackles: 0,
    foulsCommitted: 0,
    yellowCards: 0,
    redCards: 0,
    saves: 0,
  });

  snapshots.forEach((snapshot, index) => {
    const previous = index > 0 ? snapshots[index - 1] : undefined;
    // Matches counted in THIS window, per club: the largest step any one of its
    // players took in `jogos_num`.
    const stepped = new Map<string, number>();

    for (const [playerId, record] of snapshot) {
      const abbreviation = record["atletas.clube.id.full.name"] ?? "";
      const slug = CLUB_BY_ABBREVIATION[abbreviation];
      if (!slug) {
        // An error rather than a skip. An unmapped abbreviation is either a
        // club we do not know about or a source that has changed its
        // vocabulary, and both are things to look at — where a silent zero is
        // a club rendering an empty perfil for nobody's attention.
        throw new Error(
          `Unmapped caRtola club "${abbreviation}" (rodada ${index + 1}). ` +
            `Add it to CLUB_BY_ABBREVIATION.`,
        );
      }
      const club = CLUB_BY_SLUG.get(slug);
      if (!club) throw new Error(`CLUB_BY_ABBREVIATION maps ${abbreviation} to unknown slug ${slug}.`);

      const before = previous?.get(playerId);
      const entry = totals.get(club.code) ?? blank(club.code);

      for (const [column, field] of Object.entries(COUNTERS) as [string, CounterField][]) {
        const delta = counterValue(record, column) - counterValue(before, column);
        // Positive only: a negative delta is a player leaving, never an action
        // being undone.
        if (delta > 0) entry[field] += delta;
      }

      // **Only a player present in BOTH snapshots has a measurable step.**
      // Reading an absent player's cumulative total as one imports his whole
      // season: unfiltered, Botafogo came to 29 matches covered against 24
      // played and São Paulo to 32, off single windows reporting steps of 7 and
      // 9. Filtered, no window in 2026 steps by more than 1 and no club's
      // coverage exceeds its fixtures — the direction that has to hold, since
      // the counters cannot cover a match nobody played. `validate` refuses the
      // other direction rather than trusting this comment.
      if (index === 0 || before) {
        const step = counterValue(record, GAMES) - counterValue(before, GAMES);
        if (step > 0) stepped.set(club.code, Math.max(stepped.get(club.code) ?? 0, step));
      }

      totals.set(club.code, entry);
    }

    // Every club, not only the ones `totals` has seen. In practice caRtola lists
    // all twenty from rodada 1, so this is defensive — but a club-round missing
    // from the middle of a history is a hole the drawing would have to guess
    // about, where a row of zeros is a club that has done nothing yet.
    for (const club of CLUBS) {
      // Carried forward before the row is pushed, so a rodada's row states the
      // coverage that rodada reached rather than the one before it.
      const total = (covered.get(club.code) ?? 0) + (stepped.get(club.code) ?? 0);
      covered.set(club.code, total);

      const entry = totals.get(club.code);
      history.get(club.code)?.push([
        total,
        entry?.goals ?? 0,
        entry?.shotsSaved ?? 0,
        entry?.shotsOff ?? 0,
        entry?.shotsWoodwork ?? 0,
        entry?.saves ?? 0,
      ]);
    }
  });

  // **The denominator is what the COUNTERS cover, and not what the fixture list
  // says was played.** Those differ, because caRtola does not always record a
  // match at all — and the gap is silent, since the rates it produces are
  // twenty plausible numbers in the right order.
  //
  // Measured on 2026: Athletico-PR's windows 2 and 5 are zero across all five
  // counters, and they are exactly its two fixtures played out of round order
  // (r2 on 19/02, after r3; r5 on 29/03, after r6-r8). The actions are **lost
  // rather than shifted** into a neighbouring window — the club's scout goals
  // are 33 against 37 in the seed, its own goals in favour are 0 and fully
  // known (`goals.ts` covers 23 of its 25 and the two it misses are both 0-0),
  // and the 4-goal gap is precisely round 5's 4-1. So 219 finalizações were
  // divided by 25 where the counted matches give 23: **8,8 a game reported
  // against 9,5, which is 17º de 20 against 14º** — on a card whose whole
  // purpose is reading one club against the division. 20 club-matches are
  // uncovered across the division, which together with the own goals accounts
  // for essentially all of the goals band's 6.8%.
  //
  // `jogos_num` is the source's own per-player match count, so the matches a
  // club had counted in a window is the largest step any of its players took
  // across it. That is the appearance count the comment this replaces
  // rejected, and the objection was right about a different statistic: a *sum*
  // over players cannot separate a window holding two rounds from one holding a
  // heavily-rotated eleven, and a *maximum* is not being asked to — eleven
  // players start, so one of them stepped by exactly the number played.
  //
  // `playedThrough` survives, in `validateScouts`, as the bound this must not exceed.
  for (const [code, entry] of totals) {
    entry.matches = covered.get(code) ?? 0;
  }
  return { totals, history };
}

/* ---------------------------------------------------------------- validating */

/**
 * Refuse to write rather than write something plausible — every refusal lives in
 * `scouts-validation-core.ts`, where each is tested; this binds them to the
 * committed club list, the seed and this script's counter columns.
 */
function validate(
  totals: Map<string, ClubScouts>,
  history: Map<string, ScoutHistoryEntry[]>,
  rounds: number,
): void {
  validateScouts({
    totals,
    history,
    rounds,
    clubs: CLUBS,
    matches: SEED_MATCHES,
    snapshotDate: SNAPSHOT_DATE,
    counterFields: Object.values(COUNTERS),
    log: (line) => console.log(line),
  });
}

/* ------------------------------------------------------------------ writing */

function write(
  totals: Map<string, ClubScouts>,
  history: Map<string, ScoutHistoryEntry[]>,
  rounds: number,
): void {
  const ordered = [...totals.values()].sort((a, b) => {
    const left = CLUBS.find((club) => club.code === a.clubCode)?.shortName ?? a.clubCode;
    const right = CLUBS.find((club) => club.code === b.clubCode)?.shortName ?? b.clubCode;
    return left.localeCompare(right, "pt-BR");
  });

  const generatedOn = new Date().toISOString().slice(0, 10);
  const body = ordered
    .map((entry) => {
      const name = CLUBS.find((club) => club.code === entry.clubCode)?.shortName ?? "";
      return (
        `  // ${name}\n` +
        `  { clubCode: ${JSON.stringify(entry.clubCode)}, matches: ${entry.matches}, ` +
        `goals: ${entry.goals}, shotsSaved: ${entry.shotsSaved}, shotsOff: ${entry.shotsOff}, ` +
        `shotsWoodwork: ${entry.shotsWoodwork}, tackles: ${entry.tackles}, ` +
        `foulsCommitted: ${entry.foulsCommitted}, yellowCards: ${entry.yellowCards}, ` +
        `redCards: ${entry.redCards}, saves: ${entry.saves} },`
      );
    })
    .join("\n");

  writeFileSync(
    path.join(ROOT, "src/data/club-scouts.ts"),
    `import type { ClubScouts } from "@/src/types";

/**
 * GENERATED by \`npx tsx scripts/sync-cartola-scouts.ts\` — do not hand-edit.
 *
 * Season ${season}, rodadas 1..${rounds}, from caRtola's snapshots of the
 * Cartola FC market (MIT, \`henriquepgomide/caRtola\`). Written ${generatedOn}
 * against the seed snapshot ${SNAPSHOT_DATE}.
 *
 * These are the per-action counters **no provider this app can reach reports at
 * any tier** — finalizações, desarmes, faltas, cartões, defesas. Read on a
 * workstation and committed; production never fetches caRtola, exactly as it
 * never fetches CBF.
 *
 * \`matches\` is the number of finished matches these counters actually cover,
 * read from the source's own per-player \`jogos_num\`. It is **not** a club's
 * \`played\` in the live table — the source is weekly, so by Saturday the table
 * holds a round these figures do not, and dividing by the live count
 * understates every rate by the amount that reads as a form dip.
 *
 * It is **not the fixture list either, and may sit below it**: caRtola does not
 * always record a match at all. 13 of the 20 clubs are short in 2026, Botafogo
 * by three. Dividing by what was played rather than by what was counted put
 * Athletico-PR at 8,8 finalizações a game (17º de 20) where the covered matches
 * give 9,5 (14º). A club well short of its fixtures is described on a smaller
 * sample than the division around it — the rate is right, the sample is thinner.
 *
 * Stale by construction, like \`rank-history.ts\`. Regenerate after a
 * \`sync-seed-data\` run, or when caRtola publishes a further rodada.
 */
export const CLUB_SCOUTS: ClubScouts[] = [
${body}
];

/** The last rodada these counters cover. */
export const CLUB_SCOUTS_THROUGH_ROUND = ${rounds};
`,
  );

  console.log(
    `Wrote src/data/club-scouts.ts — ${ordered.length} clubs through rodada ${rounds}.`,
  );

  writeHistory(history, rounds, generatedOn);

  remindAboutTheLog(rounds, previousRound);
}

/**
 * The rastro's data file, written by the same run and never on its own.
 *
 * **Two files, one write, and that is what stops them describing different
 * seasons.** `CLUB_SCOUTS_HISTORY_THROUGH_ROUND` comes from the same `rounds`
 * variable as `CLUB_SCOUTS_THROUGH_ROUND` a few lines up, so the pair cannot
 * drift the way `rank-history.ts` can drift from `matches.ts` — which needs two
 * commands run in the right order and a paragraph in `CLAUDE.md` asking for it.
 *
 * **One line per club and no whitespace inside a row**, which is the opposite of
 * every other generated file here and is deliberate: this is 760 rows nobody
 * reads, and the pretty form costs 64 kB of source and 3.6 kB gzipped on the
 * client bundle for a legibility no reader wants. The club's name is a comment
 * above its line, because `1769` cannot be checked by reading and `Palmeiras`
 * can — `CLUB_BY_ABBREVIATION`'s rule one file over.
 */
function writeHistory(
  history: Map<string, ScoutHistoryEntry[]>,
  rounds: number,
  generatedOn: string,
): void {
  const body = [...CLUBS]
    .sort((a, b) => a.shortName.localeCompare(b.shortName, "pt-BR"))
    .map((club) => {
      const rows = history.get(club.code) ?? [];
      const packed = rows.map((row) => `[${row.join(",")}]`).join(",");
      return `  // ${club.shortName}\n  ${JSON.stringify(club.code)}: [${packed}],`;
    })
    .join("\n");

  writeFileSync(
    path.join(ROOT, "src/data/club-scouts-history.ts"),
    `import type { ClubCode, ScoutHistoryEntry } from "@/src/types";

/**
 * GENERATED by \`npx tsx scripts/sync-cartola-scouts.ts\` — do not hand-edit.
 *
 * Season ${season}, rodadas 1..${rounds}, written ${generatedOn} against the seed
 * snapshot ${SNAPSHOT_DATE}. Same run, same source and same snapshots as
 * \`club-scouts.ts\`; the last rodada here reproduces that file exactly, and the
 * sync refuses to write when it does not.
 *
 * **Each row is CUMULATIVE through its rodada, not that rodada's own figures.**
 * caRtola publishes weekly and a midweek round falls between two snapshots, so a
 * single round's actions can land in a neighbouring window — measured across the
 * ${season} season to rodada 24: of 470 club-rounds, 441 windows held exactly one
 * match, 19 held none and 10 held two. That is fatal to a per-rodada figure,
 * where a club that played would read as a club that did not, and survivable
 * cumulatively: the error is at most one match's worth and the next snapshot
 * absorbs it.
 *
 * The rodada is the **array index** — index 0 is rodada 1 — and the tuple is
 * \`[matches, goals, shotsSaved, shotsOff, shotsWoodwork, saves]\`, where
 * \`matches\` is what the counters **cover** through that rodada rather than what
 * the fixture list says was played, and so does not always step by one. Which
 * \`ScoutHistoryEntry\` states and \`tsc\` holds. Only the counters the Perfil
 * scatters draw are carried; see that type for why.
 *
 * Stale by construction, like \`club-scouts.ts\` beside it.
 */
export const CLUB_SCOUTS_HISTORY: Record<ClubCode, ScoutHistoryEntry[]> = {
${body}
};

/** The last rodada this history covers. Always \`CLUB_SCOUTS_THROUGH_ROUND\`. */
export const CLUB_SCOUTS_HISTORY_THROUGH_ROUND = ${rounds};
`,
  );

  console.log(
    `Wrote src/data/club-scouts-history.ts — ${CLUBS.length} clubs × ${rounds} rodadas.`,
  );
}

/**
 * Ask for a fresh reading in `docs/perfil-ataque.md`, at the one moment the
 * person who could write a good one has the rates in front of them.
 *
 * **This is deliberately a printed line and not a test.** The obvious form —
 * fail `test:unit` when a sync lands with no fresh entry — was proposed, built
 * and dropped: `test:unit` runs in `check` and `deploy` is `needs: [check,
 * e2e]`, so a missing paragraph would hold a release, and its only remedy is
 * for somebody to write prose. Whoever met it could **satisfy** it without
 * being able to **fix** it, which is filler by design. Same family as the
 * `page.route` stub `src/useAccount.ts` records: a check that passes for the
 * wrong reason converts an open question into a false answer.
 *
 * Two conditions, and each removes something somebody would otherwise have to
 * remember:
 *
 * - **Only when a rodada actually advanced.** Printed on a re-run that changed
 *   nothing, the line is wallpaper within a week.
 * - **Only when the document exists.** It is added by a separate pull request,
 *   so until that lands this must not name a file that is not there — which
 *   would be the stale claim the log itself is written to avoid. That makes the
 *   merge order between the two self-resolving rather than something either
 *   author has to hold in their head.
 */
function remindAboutTheLog(rounds: number, previous: number | null): void {
  if (previous !== null && rounds <= previous) return;
  if (!existsSync(path.join(ROOT, "docs/perfil-ataque.md"))) return;

  console.log(
    `\n==> A fresh reading is owed in docs/perfil-ataque.md\n` +
      `    Rodada ${rounds} just landed. Append an entry ABOVE every existing\n` +
      `    \`## Rodada\` heading, in the form \`## Rodada ${rounds} — <what changed>\`.\n` +
      `    Rule 1: name clubs and shapes, never a rate — the page computes\n` +
      `    those, and \`npm run test:unit\` refuses a decimal, a percentage\n` +
      `    or a \`Nº\` rank in that file.`,
  );
}

/**
 * The rodada the committed file already covers, or null on a first run.
 *
 * Read before the write, and through a dynamic import so a missing file is a
 * `null` rather than a crash — this script is what *creates* that file, so it
 * must run on a checkout that does not yet have one.
 */
async function committedRound(): Promise<number | null> {
  try {
    const existing = (await import("@/src/data/club-scouts")) as {
      CLUB_SCOUTS_THROUGH_ROUND?: number;
    };
    return existing.CLUB_SCOUTS_THROUGH_ROUND ?? null;
  } catch {
    return null;
  }
}

function seasonArgument(): string {
  const index = process.argv.indexOf("--season");
  if (index < 0) return String(new Date().getUTCFullYear());
  const value = process.argv[index + 1];
  if (!value || !/^\d{4}$/.test(value)) {
    throw new Error("--season takes a four-digit year.");
  }
  return value;
}
