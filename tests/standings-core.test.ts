import assert from "node:assert/strict";
import { test } from "node:test";

import {
  compareRows,
  computeStandings,
  countsTowardStandings,
  pointsPercentage,
  pointsPercentageLabel,
} from "@/standings-core";
import type { Club, Match, StandingsRow } from "@/src/types";

const club = (code: string, shortName = code): Club => ({
  code,
  name: `${shortName} FC`,
  shortName,
  state: "SP",
});

const CLUBS = [club("AAA"), club("BBB"), club("CCC")];

const match = (overrides: Partial<Match> & Pick<Match, "homeCode" | "awayCode">): Match => ({
  id: `${overrides.homeCode}-${overrides.awayCode}`,
  round: 1,
  kickoff: "2026-04-11T19:00:00Z",
  status: "FINISHED",
  homeGoals: 0,
  awayGoals: 0,
  ...overrides,
});

test("counts only finished matches carrying both scores", () => {
  assert.equal(countsTowardStandings(match({ homeCode: "AAA", awayCode: "BBB" })), true);
  assert.equal(
    countsTowardStandings(match({ homeCode: "AAA", awayCode: "BBB", status: "SCHEDULED" })),
    false,
  );
  assert.equal(
    countsTowardStandings(
      match({ homeCode: "AAA", awayCode: "BBB", status: "LIVE", homeGoals: 1, awayGoals: 0 }),
    ),
    false,
  );
  assert.equal(
    countsTowardStandings(match({ homeCode: "AAA", awayCode: "BBB", homeGoals: null })),
    false,
  );
});

test("awards three points for a win and one for a draw", () => {
  const table = computeStandings(CLUBS, [
    match({ homeCode: "AAA", awayCode: "BBB", homeGoals: 2, awayGoals: 0 }),
    match({ homeCode: "BBB", awayCode: "CCC", homeGoals: 1, awayGoals: 1 }),
  ]);

  const byCode = new Map(table.map((row) => [row.club.code, row]));
  assert.equal(byCode.get("AAA")?.points, 3);
  assert.equal(byCode.get("BBB")?.points, 1);
  assert.equal(byCode.get("CCC")?.points, 1);
  assert.equal(byCode.get("BBB")?.played, 2);
  assert.equal(byCode.get("AAA")?.goalDifference, 2);
  assert.equal(byCode.get("BBB")?.goalDifference, -2);
});

test("includes clubs with no finished match as zeroed rows", () => {
  const table = computeStandings(CLUBS, []);

  assert.equal(table.length, 3);
  assert.ok(table.every((row) => row.played === 0 && row.points === 0));
  assert.deepEqual(
    table.map((row) => row.position),
    [1, 2, 3],
  );
});

test("ignores fixtures referencing an unknown club", () => {
  const table = computeStandings(CLUBS, [
    match({ homeCode: "AAA", awayCode: "ZZZ", homeGoals: 5, awayGoals: 0 }),
  ]);

  assert.ok(table.every((row) => row.played === 0));
});

test("breaks ties by wins, then goal difference, then goals scored", () => {
  const row = (overrides: Partial<StandingsRow>): StandingsRow => ({
    position: 0,
    club: club("XXX"),
    played: 3,
    wins: 1,
    draws: 0,
    losses: 2,
    goalsFor: 1,
    goalsAgainst: 1,
    goalDifference: 0,
    points: 3,
    ...overrides,
  });

  // Same points, more wins wins.
  assert.ok(compareRows(row({ wins: 2 }), row({ wins: 1 })) < 0);
  // Same points and wins, better goal difference wins.
  assert.ok(compareRows(row({ goalDifference: 4 }), row({ goalDifference: 1 })) < 0);
  // Same points, wins and difference, more goals scored wins.
  assert.ok(compareRows(row({ goalsFor: 9 }), row({ goalsFor: 2 })) < 0);
});

test("orders fully-level clubs by name so the table is deterministic", () => {
  const table = computeStandings([club("ZZZ", "Zebra"), club("AAA", "Abelha")], []);

  assert.deepEqual(
    table.map((row) => row.club.shortName),
    ["Abelha", "Zebra"],
  );
});

test("aproveitamento is the share of points taken of those available", () => {
  // Nine of a possible nine.
  assert.equal(pointsPercentage({ points: 9, played: 3 }), 100);
  // Three wins and three draws out of six: 12 of 18.
  assert.equal(Math.round(pointsPercentage({ points: 12, played: 6 })!), 67);
  assert.equal(pointsPercentage({ points: 0, played: 5 }), 0);
});

test("a club that has played nothing has no aproveitamento, not zero", () => {
  assert.equal(pointsPercentage({ points: 0, played: 0 }), null);
  assert.equal(pointsPercentageLabel({ points: 0, played: 0 }), null);
  // The distinction the null exists for: taken nothing from five is 0%.
  assert.equal(pointsPercentageLabel({ points: 0, played: 5 }), "0%");
});

test("aproveitamento reads a club with a game in hand honestly", () => {
  // Same three wins, one club a postponed fixture short. The points column
  // calls them equal; this one does not.
  const played = { points: 9, played: 4 };
  const short = { points: 9, played: 3 };
  assert.equal(played.points, short.points);
  assert.ok(pointsPercentage(short)! > pointsPercentage(played)!);
});

test("the aproveitamento label is a whole percentage", () => {
  assert.equal(pointsPercentageLabel({ points: 12, played: 6 }), "67%");
  assert.equal(pointsPercentageLabel({ points: 9, played: 3 }), "100%");
  // The tightest non-perfect campaign a 38-round season allows still rounds
  // short of 100, so the rounding cannot claim a club dropped nothing.
  assert.equal(pointsPercentageLabel({ points: 112, played: 38 }), "98%");
});
