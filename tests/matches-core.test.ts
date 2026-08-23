import assert from "node:assert/strict";
import { test } from "node:test";

import { compareForFeed, currentRound, matchesForRound, roundsOf } from "@/matches-core";
import type { Match } from "@/src/types";

const match = (overrides: Partial<Match> & Pick<Match, "id">): Match => ({
  round: 1,
  kickoff: "2026-04-11T19:00:00Z",
  status: "SCHEDULED",
  homeCode: "AAA",
  awayCode: "BBB",
  homeGoals: null,
  awayGoals: null,
  ...overrides,
});

test("feed order puts live first, then scheduled, then finished", () => {
  const feed = [
    match({ id: "finished", status: "FINISHED" }),
    match({ id: "scheduled" }),
    match({ id: "live", status: "LIVE" }),
  ].sort(compareForFeed);

  assert.deepEqual(
    feed.map((entry) => entry.id),
    ["live", "scheduled", "finished"],
  );
});

test("matches within a round are chronological", () => {
  const round = matchesForRound(
    [
      match({ id: "late", kickoff: "2026-04-12T21:00:00Z" }),
      match({ id: "early", kickoff: "2026-04-12T16:00:00Z" }),
      match({ id: "other-round", round: 2 }),
    ],
    1,
  );

  assert.deepEqual(
    round.map((entry) => entry.id),
    ["early", "late"],
  );
});

test("an unparseable kickoff sorts last instead of throwing", () => {
  const round = matchesForRound(
    [match({ id: "broken", kickoff: "not-a-date" }), match({ id: "valid" })],
    1,
  );

  assert.deepEqual(
    round.map((entry) => entry.id),
    ["valid", "broken"],
  );
});

test("rounds are listed once, in ascending order", () => {
  assert.deepEqual(
    roundsOf([match({ id: "a", round: 3 }), match({ id: "b", round: 1 }), match({ id: "c", round: 3 })]),
    [1, 3],
  );
});

test("current round is the earliest with an unfinished match", () => {
  const matches = [
    match({ id: "r1", round: 1, status: "FINISHED" }),
    match({ id: "r2", round: 2, status: "SCHEDULED" }),
    match({ id: "r3", round: 3, status: "SCHEDULED" }),
  ];

  assert.equal(currentRound(matches), 2);
});

test("current round falls back to the last round when the season is over", () => {
  const matches = [
    match({ id: "r1", round: 1, status: "FINISHED" }),
    match({ id: "r2", round: 2, status: "FINISHED" }),
  ];

  assert.equal(currentRound(matches), 2);
});

test("current round is null with no fixtures", () => {
  assert.equal(currentRound([]), null);
});

test("a postponed match keeps its round current — it is still coming", () => {
  const matches = [
    match({ id: "r1a", round: 1, status: "FINISHED" }),
    match({ id: "r1b", round: 1, status: "POSTPONED" }),
    match({ id: "r2", round: 2, status: "SCHEDULED" }),
  ];

  assert.equal(currentRound(matches), 1);
});

test("a cancelled match does not pin its round as current", () => {
  const matches = [
    match({ id: "r1a", round: 1, status: "FINISHED" }),
    match({ id: "r1b", round: 1, status: "CANCELLED" }),
    match({ id: "r2", round: 2, status: "SCHEDULED" }),
  ];

  assert.equal(currentRound(matches), 2);
});

test("feed order places postponed after scheduled and cancelled last", () => {
  const feed = [
    match({ id: "cancelled", status: "CANCELLED" }),
    match({ id: "finished", status: "FINISHED" }),
    match({ id: "postponed", status: "POSTPONED" }),
    match({ id: "scheduled" }),
    match({ id: "live", status: "LIVE" }),
  ].sort(compareForFeed);

  assert.deepEqual(
    feed.map((entry) => entry.id),
    ["live", "scheduled", "postponed", "finished", "cancelled"],
  );
});
