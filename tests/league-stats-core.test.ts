import assert from "node:assert/strict";
import { test } from "node:test";

import { bestAttacks, bestDefences, leagueSummary } from "@/league-stats-core";
import { computeStandings } from "@/standings-core";
import type { Club, Match } from "@/src/types";

const club = (code: string, shortName = code): Club => ({
  code,
  name: `${shortName} FC`,
  shortName,
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

test("the season's totals divide by matches finished, never by fixtures scheduled", () => {
  const matches = [
    match({ homeCode: "AAA", awayCode: "BBB", homeGoals: 3, awayGoals: 1 }),
    match({ homeCode: "BBB", awayCode: "CCC", homeGoals: 0, awayGoals: 2 }),
    // Two fixtures still to play, and one live: none of them counts.
    match({ homeCode: "CCC", awayCode: "AAA", status: "SCHEDULED", homeGoals: null, awayGoals: null }),
    match({ homeCode: "AAA", awayCode: "CCC", status: "LIVE", homeGoals: 4, awayGoals: 4 }),
  ];

  const summary = leagueSummary(matches);

  assert.equal(summary.played, 2);
  assert.equal(summary.goals, 6);
  assert.equal(summary.goalsPerMatch, 3);
  // The live 4x4 is excluded from both, or the average would read 7.
  assert.equal(summary.homeWins, 1);
  assert.equal(summary.homeWinShare, 50);
});

test("a season that has not started reports nothing, not zero", () => {
  // A zero average claims the season is producing no goals; the truth is that
  // it has not begun. Same rule as `pointsPercentage` refusing to divide by no
  // games, and `computeRankHistory` stopping at the last round with a result.
  const summary = leagueSummary([
    match({ homeCode: "AAA", awayCode: "BBB", status: "SCHEDULED", homeGoals: null, awayGoals: null }),
  ]);

  assert.equal(summary.played, 0);
  assert.equal(summary.goals, 0);
  assert.equal(summary.goalsPerMatch, null);
  assert.equal(summary.homeWinShare, null);
  assert.notEqual(summary.goalsPerMatch, 0);
});

test("a draw counts as played and as no home win", () => {
  const summary = leagueSummary([
    match({ homeCode: "AAA", awayCode: "BBB", homeGoals: 1, awayGoals: 1 }),
  ]);

  assert.equal(summary.played, 1);
  assert.equal(summary.homeWins, 0);
  assert.equal(summary.homeWinShare, 0);
});

test("the leaderboards rank by goals, longest attack and meanest defence", () => {
  const matches = [
    match({ homeCode: "AAA", awayCode: "BBB", homeGoals: 5, awayGoals: 0 }),
    match({ homeCode: "BBB", awayCode: "CCC", homeGoals: 1, awayGoals: 2 }),
  ];
  const rows = computeStandings(CLUBS, matches);

  assert.deepEqual(bestAttacks(rows).map((r) => r.club.code), ["AAA", "CCC", "BBB"]);
  assert.deepEqual(bestDefences(rows).map((r) => r.club.code), ["AAA", "CCC", "BBB"]);
});

test("a club with no match played cannot lead the defence on nothing", () => {
  // The sharpest form of absence-is-not-zero here: an unplayed club has
  // conceded none, so ranking it would put it top of the meanest defence with
  // no evidence at all — and unlike a blank average that looks like an answer.
  const matches = [match({ homeCode: "AAA", awayCode: "BBB", homeGoals: 2, awayGoals: 1 })];
  const rows = computeStandings(CLUBS, matches);

  const defences = bestDefences(rows);
  assert.equal(defences.some((row) => row.club.code === "CCC"), false);
  // AAA conceded one and BBB two, so AAA leads — CCC is simply not ranked.
  assert.equal(defences[0].club.code, "AAA");
  assert.deepEqual(defences.map((row) => row.club.code), ["AAA", "BBB"]);
  assert.equal(bestAttacks(rows).some((row) => row.club.code === "CCC"), false);
});

test("leaderboards are deterministic when clubs tie, and do not mutate the input", () => {
  const matches = [
    match({ homeCode: "BBB", awayCode: "AAA", homeGoals: 1, awayGoals: 1 }),
    match({ homeCode: "CCC", awayCode: "AAA", homeGoals: 1, awayGoals: 1 }),
  ];
  const rows = computeStandings(CLUBS, matches);
  const order = rows.map((row) => row.club.code);

  // AAA scored twice; BBB and CCC once each and tie, so the name decides.
  assert.deepEqual(bestAttacks(rows).map((r) => r.club.code), ["AAA", "BBB", "CCC"]);
  assert.deepEqual(rows.map((row) => row.club.code), order);
});

test("asking for fewer than the table holds returns that many", () => {
  const matches = [match({ homeCode: "AAA", awayCode: "BBB", homeGoals: 2, awayGoals: 1 })];
  const rows = computeStandings(CLUBS, matches);

  assert.equal(bestAttacks(rows, 1).length, 1);
  assert.equal(bestDefences(rows, 10).length, 2);
});
