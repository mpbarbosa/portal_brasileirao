import assert from "node:assert/strict";
import { test } from "node:test";

import { computeRankHistory, lastRoundWithResult, positionAfterRound } from "@/rank-history-core";
import { computeStandings } from "@/standings-core";
import type { Club, Match } from "@/src/types";

const club = (code: string, shortName = code): Club => ({
  code,
  name: `${shortName} FC`,
  shortName,
  state: "SP",
});

const CLUBS = [club("AAA"), club("BBB"), club("CCC"), club("DDD")];

const match = (
  overrides: Partial<Match> & Pick<Match, "homeCode" | "awayCode" | "round">,
): Match => ({
  id: `r${overrides.round}-${overrides.homeCode}-${overrides.awayCode}`,
  kickoff: "2026-04-11T19:00:00Z",
  status: "FINISHED",
  homeGoals: 0,
  awayGoals: 0,
  ...overrides,
});

/** AAA wins both rounds; BBB wins round 1 then loses; CCC/DDD trail. */
const SEASON: Match[] = [
  match({ round: 1, homeCode: "AAA", awayCode: "CCC", homeGoals: 1, awayGoals: 0 }),
  match({ round: 1, homeCode: "BBB", awayCode: "DDD", homeGoals: 3, awayGoals: 0 }),
  match({ round: 2, homeCode: "AAA", awayCode: "BBB", homeGoals: 2, awayGoals: 0 }),
  match({ round: 2, homeCode: "CCC", awayCode: "DDD", homeGoals: 1, awayGoals: 0 }),
];

const historyFor = (code: string, matches = SEASON) => {
  const found = computeRankHistory(CLUBS, matches).find((entry) => entry.clubCode === code);
  assert.ok(found, `no history for ${code}`);
  return found;
};

test("reports the last round that produced a result", () => {
  assert.equal(lastRoundWithResult(SEASON), 2);
  assert.equal(lastRoundWithResult([]), null);
  assert.equal(
    lastRoundWithResult([
      match({ round: 7, homeCode: "AAA", awayCode: "BBB", status: "SCHEDULED", homeGoals: null, awayGoals: null }),
    ]),
    null,
  );
});

test("records a position for every club at every played round", () => {
  const history = computeRankHistory(CLUBS, SEASON);

  assert.equal(history.length, CLUBS.length);
  for (const club of history) {
    assert.deepEqual(
      club.entries.map((entry) => entry.round),
      [1, 2],
    );
  }
});

test("tracks a club rising and another falling across rounds", () => {
  // Round 1: BBB leads on goal difference (+3), AAA second (+1).
  // Round 2: AAA beats BBB, so AAA leads on points and BBB drops.
  assert.deepEqual(
    historyFor("BBB").entries.map((entry) => entry.position),
    [1, 2],
  );
  assert.deepEqual(
    historyFor("AAA").entries.map((entry) => entry.position),
    [2, 1],
  );
  assert.deepEqual(
    historyFor("AAA").entries.map((entry) => entry.points),
    [3, 6],
  );
});

test("stops at the last played round rather than padding the season", () => {
  const withFuture = [
    ...SEASON,
    match({ round: 3, homeCode: "AAA", awayCode: "DDD", status: "SCHEDULED", homeGoals: null, awayGoals: null }),
  ];

  assert.deepEqual(
    historyFor("AAA", withFuture).entries.map((entry) => entry.round),
    [1, 2],
  );
});

test("a club whose fixture was postponed carries fewer played than its rivals", () => {
  const postponed = [
    SEASON[0],
    match({ round: 1, homeCode: "BBB", awayCode: "DDD", status: "POSTPONED", homeGoals: null, awayGoals: null }),
  ];

  assert.equal(historyFor("AAA", postponed).entries[0].played, 1);
  assert.equal(historyFor("BBB", postponed).entries[0].played, 0);
});

test("includes clubs with no result yet, ranked below those with points", () => {
  const openingRound = [SEASON[0]];
  const history = computeRankHistory(CLUBS, openingRound);

  assert.equal(history.length, CLUBS.length);
  assert.equal(historyFor("AAA", openingRound).entries[0].position, 1);
  assert.equal(historyFor("BBB", openingRound).entries[0].points, 0);
  assert.equal(historyFor("BBB", openingRound).entries[0].played, 0);
});

test("returns an empty campaign when nothing has been played", () => {
  const history = computeRankHistory(CLUBS, []);

  assert.equal(history.length, CLUBS.length);
  for (const club of history) assert.deepEqual(club.entries, []);
});

test("the final round agrees with the table computed directly", () => {
  const table = computeStandings(CLUBS, SEASON);
  const history = computeRankHistory(CLUBS, SEASON);

  for (const row of table) {
    const last = history.find((entry) => entry.clubCode === row.club.code)?.entries.at(-1);
    assert.equal(last?.position, row.position, `${row.club.shortName} position`);
    assert.equal(last?.points, row.points, `${row.club.shortName} points`);
  }
});

test("a round outside the history has no position rather than the nearest one", () => {
  const history = historyFor("AAA");

  assert.equal(positionAfterRound(history, 2), 1);
  assert.equal(positionAfterRound(history, 38), null);
  assert.equal(positionAfterRound(history, 0), null);
});
