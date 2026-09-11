import assert from "node:assert/strict";
import { test } from "node:test";

import {
  goalsForThrough,
  playedThrough,
  type ScoutCounterField,
  type ScoutsValidationInput,
  validateScoutHistory,
  validateScouts,
} from "@/scouts-validation-core";
import type { ClubScouts, Match, ScoutHistoryEntry } from "@/src/types";

const FIELDS: readonly ScoutCounterField[] = [
  "goals", "shotsSaved", "shotsOff", "shotsWoodwork", "tackles",
  "foulsCommitted", "yellowCards", "redCards", "saves",
];
const CLUBS = [
  { code: "A", shortName: "Alfa" },
  { code: "B", shortName: "Beta" },
];

const fixture = (round: number, home: string, away: string, homeGoals: number, awayGoals: number): Match => ({
  id: `${round}-${home}-${away}`,
  round,
  kickoff: "2026-04-11T19:00:00Z",
  status: "FINISHED",
  homeCode: home,
  awayCode: away,
  homeGoals,
  awayGoals,
});

/** Two rodadas: Alfa beats Beta 1-0 twice, so the seed credits Alfa two goals. */
const SEED: Match[] = [fixture(1, "A", "B", 1, 0), fixture(2, "B", "A", 0, 1)];

const scouts = (clubCode: string, overrides: Partial<ClubScouts>): ClubScouts => ({
  clubCode,
  matches: 2,
  goals: 0,
  shotsSaved: 0,
  shotsOff: 0,
  shotsWoodwork: 0,
  tackles: 20,
  foulsCommitted: 25,
  yellowCards: 4,
  redCards: 0,
  saves: 6,
  ...overrides,
});

/** A season that passes every check, built fresh so a test can break one thing. */
const valid = (): ScoutsValidationInput & { lines: string[] } => {
  const lines: string[] = [];
  return {
    totals: new Map([
      ["A", scouts("A", { goals: 2, shotsSaved: 6, shotsOff: 6, saves: 4 })],
      ["B", scouts("B", { shotsSaved: 4, shotsOff: 4, saves: 8 })],
    ]),
    history: new Map<string, ScoutHistoryEntry[]>([
      ["A", [[1, 1, 3, 3, 0, 2], [2, 2, 6, 6, 0, 4]]],
      ["B", [[1, 0, 2, 2, 0, 4], [2, 0, 4, 4, 0, 8]]],
    ]),
    rounds: 2,
    clubs: CLUBS,
    matches: SEED,
    snapshotDate: "2026-09-07",
    counterFields: FIELDS,
    log: (line) => lines.push(line),
    lines,
  };
};

const withTotal = <I extends ScoutsValidationInput>(input: I, code: string, overrides: Partial<ClubScouts>): I => {
  input.totals.set(code, { ...(input.totals.get(code) as ClubScouts), ...overrides });
  return input;
};

test("a consistent season passes, and reports its coverage and goals", () => {
  const input = valid();
  validateScouts(input);
  assert.deepEqual(input.lines, [
    "Coverage: every club's counters cover all 2 rodadas.",
    "Goals: 2 counted against 2 in the seed (0.0% short — own goals, and matches the source never recorded).",
  ]);
});

test("the seed has to reach as far as caRtola does", () => {
  assert.throws(
    () => validateScouts({ ...valid(), rounds: 3 }),
    /caRtola publishes rodada 3 but the seed's last round with a result is 2 \(snapshot 2026-09-07\)/,
  );
});

test("a club missing from the totals is refused", () => {
  const input = valid();
  input.totals.delete("B");
  assert.throws(() => validateScouts(input), /Got 1 clubs, expected 2\./);
});

test("a club whose counters cover no match is refused", () => {
  assert.throws(() => validateScouts(withTotal(valid(), "A", { matches: 0 })), /Alfa has no finished match in rounds 1\.\.2\./);
});

test("counters covering more matches than the seed played are refused", () => {
  assert.throws(
    () => validateScouts(withTotal(valid(), "A", { matches: 3 })),
    /Alfa's counters cover 3 matches but the seed records only 2 played in rounds 1\.\.2/,
  );
});

test("counters covering fewer matches are reported, not refused", () => {
  const input = withTotal(valid(), "A", { matches: 1 });
  input.history.set("A", [[1, 1, 3, 3, 0, 2], [1, 2, 6, 6, 0, 4]]);
  validateScouts(input);
  assert.match(input.lines[0], /Coverage: 1 club\(s\) short of the fixture list — Alfa 1\/2\./);
});

test("a counter that is not a whole, non-negative number is refused", () => {
  assert.throws(() => validateScouts(withTotal(valid(), "A", { tackles: -1 })), /Alfa\.tackles is -1, which is not a count\./);
  assert.throws(() => validateScouts(withTotal(valid(), "B", { redCards: 1.5 })), /Beta\.redCards is 1\.5, which is not a count\./);
});

test("a shot rate no football match produces is refused", () => {
  assert.throws(
    () => validateScouts(withTotal(valid(), "B", { shotsSaved: 0, shotsOff: 0 })),
    /Beta averages 0\.0 finalizações a game, which is not football\./,
  );
});

test("scout goals far off the seed's are refused", () => {
  // Half the seed's goals: the misaligned snapshots or moved column the band exists for.
  assert.throws(() => validateScouts(withTotal(valid(), "A", { goals: 1 })), /Scout goals are 50\.0% off the seed's, outside the -2%\.\.15% band\./);
});

test("a history without a row for every rodada is refused", () => {
  const input = valid();
  input.history.set("A", [[2, 2, 6, 6, 0, 4]]);
  assert.throws(() => validateScoutHistory(CLUBS, input.totals, input.history, 2), /Alfa has 1 history rows for 2 rodadas\./);
});

test("a cumulative counter that falls is refused", () => {
  const input = valid();
  input.history.set("A", [[1, 1, 3, 3, 0, 2], [2, 2, 2, 6, 0, 4]]);
  assert.throws(() => validateScoutHistory(CLUBS, input.totals, input.history, 2), /Alfa field 2 falls from 3 to 2 at rodada 2\./);
});

test("a history row that is not a count is refused", () => {
  const input = valid();
  input.history.set("B", [[1, -1, 2, 2, 0, 4], [2, 0, 4, 4, 0, 8]]);
  assert.throws(() => validateScoutHistory(CLUBS, input.totals, input.history, 2), /Beta rodada 1 field 1 is -1, which is not a count\./);
});

test("identical NON-zero rows — the aliasing bug — are refused", () => {
  // Pushing the running total by reference repeats the season's final counters on
  // every row. The guard compared rodada 1 with zero, so a season that scored at all
  // "moved" and this passed; it is the case the guard was written for.
  const input = valid();
  input.history.set("A", [[2, 2, 6, 6, 0, 4], [2, 2, 6, 6, 0, 4]]);
  assert.throws(() => validateScoutHistory(CLUBS, input.totals, input.history, 2), /Alfa's counters never change across 2 rodadas/);
});

test("a last history row that is not the season aggregate is refused", () => {
  const input = valid();
  input.history.set("B", [[1, 0, 2, 2, 0, 4], [2, 0, 4, 4, 0, 9]]);
  assert.throws(() => validateScoutHistory(CLUBS, input.totals, input.history, 2), /Beta's rodada 2 history row is \[2, 0, 4, 4, 0, 9\] but the season aggregate is \[2, 0, 4, 4, 0, 8\]/);
});

test("the seed readers count finished, scored matches up to the round", () => {
  const seed = [...SEED, { ...fixture(3, "A", "B", 5, 0), status: "SCHEDULED" as const }];
  assert.equal(playedThrough(seed, "A", 1), 1);
  assert.equal(playedThrough(seed, "A", 3), 2);
  assert.equal(goalsForThrough(seed, "A", 3), 2);
  assert.equal(goalsForThrough(seed, "B", 3), 0);
});
