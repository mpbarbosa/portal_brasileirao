/**
 * The refusals `scripts/sync-cartola-scouts.ts` writes through, moved here so each
 * one can be tested. That script starts a sync the moment it is imported, so for
 * as long as these lived in it not one of them had ever been run by a test — and
 * the first test written for the aliasing guard found it could not fire.
 *
 * Nothing here reads a module. The club list, the seed fixtures, the snapshot date
 * and the counter columns arrive as arguments, and `log` is how the coverage and
 * goals lines reach the console, so they print in the order they always did
 * relative to a refusal. Every message is the script's, verbatim.
 */
import { lastRoundWithResult } from "@/rank-history-core";
import type { Club, ClubScouts, Match, ScoutHistoryEntry } from "@/src/types";

/** The counter columns a club's scouts carry — every numeric field of `ClubScouts`. */
export type ScoutCounterField = Exclude<keyof ClubScouts, "clubCode">;

/** What the checks need of a club: its identity and the name a refusal prints. */
export type ScoutsClub = Pick<Club, "code" | "shortName">;

export interface ScoutsValidationInput {
  totals: Map<string, ClubScouts>;
  history: Map<string, ScoutHistoryEntry[]>;
  /** The rodadas caRtola has published and this run read. */
  rounds: number;
  clubs: ScoutsClub[];
  /** The seed fixtures, which bound the denominator and supply the goals band. */
  matches: Match[];
  snapshotDate: string;
  counterFields: readonly ScoutCounterField[];
  /** Where the coverage and goals lines go. Silent when absent. */
  log?: (line: string) => void;
}

/** Finished matches this club has played in rounds 1..`round`, from the seed. */
export function playedThrough(matches: Match[], clubCode: string, round: number): number {
  return matches.filter(
    (match) =>
      match.round <= round &&
      match.status === "FINISHED" &&
      match.homeGoals !== null &&
      match.awayGoals !== null &&
      (match.homeCode === clubCode || match.awayCode === clubCode),
  ).length;
}

/**
 * Refuse to write rather than write something plausible.
 *
 * The bar is what a season of football guarantees, in the spirit of
 * `lineupsReconcile`: there is no scoreline for these counters to agree with,
 * so the checks are structural. The goals band is the one real cross-check —
 * against the seed's own goals-for, loose because the source genuinely
 * undercounts by the own goals it files elsewhere and by the matches it never
 * records at all, which measured 6.8% across the 2026 season.
 *
 * **The band is division-wide, and that is a bound on what it can see rather
 * than a flaw in it.** Athletico-PR losing two whole matches is 0.6% of a total
 * already expected to run ~7% short, and its own 10.8% would sit inside the
 * band even applied per club. The evidence for a lost match is in the *window*,
 * which is why the coverage check above looks there instead.
 */
export function validateScouts(input: ScoutsValidationInput): void {
  const { totals, history, rounds, clubs, matches, snapshotDate, counterFields } = input;
  const log = input.log ?? (() => {});
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
  const seedLastRound = lastRoundWithResult(matches);
  if (seedLastRound === null || seedLastRound < rounds) {
    throw new Error(
      `caRtola publishes rodada ${rounds} but the seed's last round with a ` +
        `result is ${seedLastRound ?? "none"} (snapshot ${snapshotDate}). ` +
        `Every rate would divide by a round too few and inflate by roughly 4%. ` +
        `Run \`npx tsx scripts/sync-seed-data.ts\` and \`npm run sync-rank-history\` first.`,
    );
  }

  const expected = clubs.length;
  if (totals.size !== expected) {
    throw new Error(`Got ${totals.size} clubs, expected ${expected}.`);
  }

  let scoutGoals = 0;
  let seedGoals = 0;
  const short: string[] = [];

  for (const entry of totals.values()) {
    const club = clubs.find((candidate) => candidate.code === entry.clubCode);
    const name = club?.shortName ?? entry.clubCode;

    if (entry.matches <= 0) {
      throw new Error(`${name} has no finished match in rounds 1..${rounds}.`);
    }

    // **The seed is the BOUND on the denominator, no longer its value.** The
    // counters cannot cover a match nobody played, so exceeding this means
    // either the seed is behind the source or the `jogos_num` step rule has let
    // a transfer through — and both inflate every rate for this club, which is
    // the direction that reads as form rather than as a defect.
    //
    // Falling short is NOT refused: it is caRtola not recording a fixture, and
    // the rates are now right about it because the denominator followed. It is
    // reported instead, because a club described on fewer matches than it
    // played is worth knowing about and may be recoverable on a later sync.
    const played = playedThrough(matches, entry.clubCode, rounds);
    if (entry.matches > played) {
      throw new Error(
        `${name}'s counters cover ${entry.matches} matches but the seed records only ` +
          `${played} played in rounds 1..${rounds}. Sync the seed first, or a transfer ` +
          `has been read as a step in jogos_num.`,
      );
    }
    if (entry.matches < played) short.push(`${name} ${entry.matches}/${played}`);
    for (const field of counterFields) {
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
    seedGoals += goalsForThrough(matches, entry.clubCode, rounds);
  }

  log(
    short.length === 0
      ? `Coverage: every club's counters cover all ${rounds} rodadas.`
      : `Coverage: ${short.length} club(s) short of the fixture list — ${short.join(", ")}. ` +
          `Rates divide by what is covered, so they are right; the source has not ` +
          `recorded those matches.`,
  );

  const shortfall = seedGoals === 0 ? 0 : (seedGoals - scoutGoals) / seedGoals;
  log(
    `Goals: ${scoutGoals} counted against ${seedGoals} in the seed ` +
      `(${(100 * shortfall).toFixed(1)}% short — own goals, and matches the source never recorded).`,
  );
  if (shortfall < -0.02 || shortfall > 0.15) {
    throw new Error(
      `Scout goals are ${(100 * shortfall).toFixed(1)}% off the seed's, outside the -2%..15% band. ` +
        `Either the snapshots are misaligned with the seed or a column moved.`,
    );
  }

  validateScoutHistory(clubs, totals, history, rounds);
}

/**
 * The rastro's own checks, and the first of them is the one that matters.
 *
 * **A history whose last rodada does not reproduce the aggregate is not a
 * history of this season**, and that single assertion catches every failure this
 * file can produce on its own: the aliasing bug in `accumulate` (which yields a
 * flat rastro whose last row *does* match, and is caught by the strict-increase
 * check below instead), a denominator taken from the wrong round, and a club
 * whose rows were built from a different snapshot walk.
 *
 * Cumulative therefore means **non-decreasing**, which is not a tidiness check:
 * only positive deltas are counted upstream, so a counter that falls means the
 * walk lost its place. And **strictly increasing somewhere** is the aliasing
 * guard — twenty-five identical rows satisfy non-decreasing perfectly.
 */
export function validateScoutHistory(
  clubs: ScoutsClub[],
  totals: Map<string, ClubScouts>,
  history: Map<string, ScoutHistoryEntry[]>,
  rounds: number,
): void {
  for (const club of clubs) {
    const name = club.shortName;
    const rows = history.get(club.code);
    if (!rows || rows.length !== rounds) {
      throw new Error(
        `${name} has ${rows?.length ?? 0} history rows for ${rounds} rodadas.`,
      );
    }

    let moved = false;
    for (let round = 0; round < rows.length; round += 1) {
      const row = rows[round];
      const before = round > 0 ? rows[round - 1] : undefined;
      if (!row) throw new Error(`${name} has no history row for rodada ${round + 1}.`);

      for (let field = 0; field < row.length; field += 1) {
        const value = row[field] ?? -1;
        if (!Number.isInteger(value) || value < 0) {
          throw new Error(
            `${name} rodada ${round + 1} field ${field} is ${value}, which is not a count.`,
          );
        }
        const previous = before?.[field] ?? 0;
        if (value < previous) {
          throw new Error(
            `${name} field ${field} falls from ${previous} to ${value} at rodada ` +
              `${round + 1}. These counters are cumulative; a fall means the ` +
              `snapshot walk lost its place.`,
          );
        }
        // Field 0 is `matches`, which `playedThrough` recomputes per round and
        // which therefore advances even when the counters are aliased. Only a
        // counter moving is evidence the capture copied anything.
        //
        // **Between two rows, never against zero.** This compared rodada 1 with
        // an implicit 0, so any season that scored at all "moved" on its first
        // row — and the aliasing it exists to catch writes identical NON-zero
        // rows, the final totals repeated, which therefore passed. The guard
        // could not fire on the one failure it was written for; its first test
        // is what found that.
        if (field > 0 && before !== undefined && value > previous) moved = true;
      }
    }

    if (!moved && rounds > 1) {
      throw new Error(
        `${name}'s counters never change across ${rounds} rodadas. That is what ` +
          `pushing the running total by reference produces — copy the counters ` +
          `at capture in \`accumulate\`.`,
      );
    }

    const last = rows[rows.length - 1];
    const total = totals.get(club.code);
    if (!last || !total) throw new Error(`${name} has no last history row or no total.`);
    const expected: ScoutHistoryEntry = [
      total.matches,
      total.goals,
      total.shotsSaved,
      total.shotsOff,
      total.shotsWoodwork,
      total.saves,
    ];
    for (let field = 0; field < expected.length; field += 1) {
      if (last[field] !== expected[field]) {
        throw new Error(
          `${name}'s rodada ${rounds} history row is [${last.join(", ")}] but the ` +
            `season aggregate is [${expected.join(", ")}]. The two files would ` +
            `describe different seasons.`,
        );
      }
    }
  }
}

export function goalsForThrough(matches: Match[], clubCode: string, round: number): number {
  let goals = 0;
  for (const match of matches) {
    if (match.round > round || match.status !== "FINISHED") continue;
    if (match.homeGoals === null || match.awayGoals === null) continue;
    if (match.homeCode === clubCode) goals += match.homeGoals;
    else if (match.awayCode === clubCode) goals += match.awayGoals;
  }
  return goals;
}
