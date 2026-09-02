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
import path from "node:path";

import { lastRoundWithResult } from "@/rank-history-core";
import { CLUBS } from "@/src/data/clubs";
import { SEED_MATCHES, SNAPSHOT_DATE } from "@/src/data/matches";
import type { ClubScouts } from "@/src/types";

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

  const scouts = accumulate(snapshots);
  validate(scouts, snapshots.length);
  write(scouts, snapshots.length);
}

/* ------------------------------------------------------------------ reading */

type Snapshot = Map<string, Record<string, string>>;

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

    snapshots.push(parseCsv(await response.text()));
    // Polite rather than necessary: raw.githubusercontent does not throttle the
    // way CBF does, and 38 requests is not a reason to find out.
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  if (snapshots.length === 0) {
    throw new Error(`No rodada file found under ${RAW}/${season}/ — is the season published?`);
  }
  return snapshots;
}

/**
 * A minimal CSV reader, quoted fields included.
 *
 * Hand-written rather than a dependency: this is the only CSV this repository
 * reads, and the app ships no parsing library. Quotes matter — a player's
 * `atletas.nome` carries commas.
 */
function parseCsv(text: string): Snapshot {
  const rows = splitRows(text);
  const header = rows[0];
  if (!header) throw new Error("Empty CSV.");

  const idIndex = header.indexOf("atletas.atleta_id");
  const clubIndex = header.indexOf("atletas.clube.id.full.name");
  if (idIndex < 0 || clubIndex < 0) {
    throw new Error("CSV is missing atletas.atleta_id or atletas.clube.id.full.name.");
  }

  const out: Snapshot = new Map();
  for (const row of rows.slice(1)) {
    if (row.length <= idIndex) continue;
    const record: Record<string, string> = {};
    header.forEach((name, index) => {
      record[name] = row[index] ?? "";
    });
    out.set(row[idIndex] ?? "", record);
  }
  return out;
}

function splitRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value !== ""));
}

/* --------------------------------------------------------------- accumulating */

function count(record: Record<string, string> | undefined, column: string): number {
  const raw = (record?.[column] ?? "").trim();
  if (raw === "") return 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

/** Season totals per club, by differencing consecutive snapshots. */
function accumulate(snapshots: Snapshot[]): Map<string, ClubScouts> {
  const totals = new Map<string, ClubScouts>();

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
        const delta = count(record, column) - count(before, column);
        // Positive only: a negative delta is a player leaving, never an action
        // being undone.
        if (delta > 0) entry[field] += delta;
      }

      totals.set(club.code, entry);
    }
  });

  // The denominator comes from **our own** fixture list, not from the source.
  // caRtola carries no fixtures at all, and a match count inferred from
  // appearances cannot separate a window holding two rounds from one holding a
  // heavily-rotated eleven.
  for (const [code, entry] of totals) {
    entry.matches = playedThrough(code, snapshots.length);
  }
  return totals;
}

/** Finished matches this club has played in rounds 1..`round`, from the seed. */
function playedThrough(clubCode: string, round: number): number {
  return SEED_MATCHES.filter(
    (match) =>
      match.round <= round &&
      match.status === "FINISHED" &&
      match.homeGoals !== null &&
      match.awayGoals !== null &&
      (match.homeCode === clubCode || match.awayCode === clubCode),
  ).length;
}

/* ---------------------------------------------------------------- validating */

/**
 * Refuse to write rather than write something plausible.
 *
 * The bar is what a season of football guarantees, in the spirit of
 * `lineupsReconcile`: there is no scoreline for these counters to agree with,
 * so the checks are structural. The goals band is the one real cross-check —
 * against the seed's own goals-for, loose because the source genuinely
 * undercounts by the own goals it files elsewhere and by players who have left
 * the division, which measured 7% across the 2026 season.
 */
function validate(totals: Map<string, ClubScouts>, rounds: number): void {
  // **The seed must reach at least as far as caRtola does, and this is the one
  // refusal the goals band cannot stand in for.**
  //
  // The numerators come from caRtola and the denominator from our own fixture
  // list, and the two advance on different schedules — caRtola weekly, the seed
  // whenever somebody runs `sync-seed-data`. Sync a round the seed has not
  // recorded and every rate is divided by a round too few.
  //
  // Measured by reproducing the mismatch one round earlier, against data
  // already on disk (scouts through 24 over a seed through 23): **every club's
  // finalizações inflated, 4.3%–4.5%, mean 4.4%**. Nothing about the output
  // looks wrong — twenty plausible rates, the right ranks, six rows.
  //
  // And the goals band moves the *reassuring* way, which is why this cannot be
  // left to it: the scout total rises while the seed total does not, so the
  // shortfall goes 7.0% -> 3.1% — further inside -2%..15%. A gate that reports
  // more comfortably as the thing it guards gets worse is not a gate.
  //
  // The reverse is fine and is not refused: a seed *ahead* of caRtola still
  // counts only rounds 1..`rounds`, because `playedThrough` bounds on the round
  // rather than on the snapshot date.
  const seedLastRound = lastRoundWithResult(SEED_MATCHES);
  if (seedLastRound === null || seedLastRound < rounds) {
    throw new Error(
      `caRtola publishes rodada ${rounds} but the seed's last round with a ` +
        `result is ${seedLastRound ?? "none"} (snapshot ${SNAPSHOT_DATE}). ` +
        `Every rate would divide by a round too few and inflate by roughly 4%. ` +
        `Run \`npx tsx scripts/sync-seed-data.ts\` and \`npm run sync-rank-history\` first.`,
    );
  }

  const expected = CLUBS.length;
  if (totals.size !== expected) {
    throw new Error(`Got ${totals.size} clubs, expected ${expected}.`);
  }

  let scoutGoals = 0;
  let seedGoals = 0;

  for (const entry of totals.values()) {
    const club = CLUBS.find((candidate) => candidate.code === entry.clubCode);
    const name = club?.shortName ?? entry.clubCode;

    if (entry.matches <= 0) {
      throw new Error(`${name} has no finished match in rounds 1..${rounds}.`);
    }
    for (const field of Object.values(COUNTERS)) {
      const value = entry[field];
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${name}.${field} is ${value}, which is not a count.`);
      }
    }

    // A band rather than a value: this catches a mis-parsed column, which is
    // the failure that produces numbers instead of an exception.
    const shots =
      (entry.goals + entry.shotsSaved + entry.shotsOff + entry.shotsWoodwork) / entry.matches;
    if (shots < 3 || shots > 30) {
      throw new Error(`${name} averages ${shots.toFixed(1)} finalizações a game, which is not football.`);
    }

    scoutGoals += entry.goals;
    seedGoals += goalsForThrough(entry.clubCode, rounds);
  }

  const shortfall = seedGoals === 0 ? 0 : (seedGoals - scoutGoals) / seedGoals;
  console.log(
    `Goals: ${scoutGoals} counted against ${seedGoals} in the seed ` +
      `(${(100 * shortfall).toFixed(1)}% short — own goals and departed players).`,
  );
  if (shortfall < -0.02 || shortfall > 0.15) {
    throw new Error(
      `Scout goals are ${(100 * shortfall).toFixed(1)}% off the seed's, outside the -2%..15% band. ` +
        `Either the snapshots are misaligned with the seed or a column moved.`,
    );
  }
}

function goalsForThrough(clubCode: string, round: number): number {
  let goals = 0;
  for (const match of SEED_MATCHES) {
    if (match.round > round || match.status !== "FINISHED") continue;
    if (match.homeGoals === null || match.awayGoals === null) continue;
    if (match.homeCode === clubCode) goals += match.homeGoals;
    else if (match.awayCode === clubCode) goals += match.awayGoals;
  }
  return goals;
}

/* ------------------------------------------------------------------ writing */

function write(totals: Map<string, ClubScouts>, rounds: number): void {
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
 * \`matches\` is the number of finished matches these counters cover, and is
 * **not** a club's \`played\` in the live table: the source is weekly, so by
 * Saturday the table holds a round these figures do not. Dividing by the live
 * count understates every rate by exactly the amount that reads as a form dip.
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

  remindAboutTheLog(rounds, previousRound);
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
