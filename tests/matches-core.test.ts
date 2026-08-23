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

const NOW = Date.parse("2026-08-23T12:00:00Z");
const past = (id: string, round: number, status: Match["status"] = "FINISHED") =>
  match({ id, round, status, kickoff: "2026-03-01T19:00:00Z" });
const future = (id: string, round: number, status: Match["status"] = "SCHEDULED") =>
  match({ id, round, status, kickoff: "2026-08-30T19:00:00Z" });

test("current round is the round of the next fixture still to come", () => {
  const matches = [past("r1", 1), future("r2", 2), future("r3", 3)];

  assert.equal(currentRound(matches, NOW), 2);
});

test("a match in progress wins over any upcoming fixture", () => {
  const matches = [
    future("r5", 5),
    match({ id: "live", round: 4, status: "LIVE", kickoff: "2026-08-23T11:00:00Z" }),
  ];

  assert.equal(currentRound(matches, NOW), 4);
});

test("a stale postponement does not pin the view to an old round", () => {
  // Real data: a February fixture still marked POSTPONED in August must not
  // make round 4 the default view when round 25 is next up.
  const matches = [past("r4a", 4), past("r4b", 4, "POSTPONED"), future("r25", 25)];

  assert.equal(currentRound(matches, NOW), 25);
});

test("current round falls back to the last round with a result", () => {
  const matches = [past("r1", 1), past("r2", 2)];

  assert.equal(currentRound(matches, NOW), 2);
});

test("an all-past fixture list with a lingering postponement still resolves", () => {
  const matches = [past("r1", 1), past("r2", 2), past("r2b", 2, "POSTPONED")];

  assert.equal(currentRound(matches, NOW), 2);
});

test("current round is null with no fixtures", () => {
  assert.equal(currentRound([], NOW), null);
});

test("a postponed match that has been rescheduled ahead becomes the current round", () => {
  const matches = [
    past("r1a", 1),
    match({ id: "r1b", round: 1, status: "POSTPONED", kickoff: "2026-08-25T19:00:00Z" }),
    match({ id: "r2", round: 2, status: "SCHEDULED", kickoff: "2026-08-28T19:00:00Z" }),
  ];

  assert.equal(currentRound(matches, NOW), 1);
});

test("a cancelled match is never treated as upcoming", () => {
  const matches = [
    past("r1a", 1),
    match({ id: "r1b", round: 1, status: "CANCELLED", kickoff: "2026-08-25T19:00:00Z" }),
    match({ id: "r2", round: 2, status: "SCHEDULED", kickoff: "2026-08-28T19:00:00Z" }),
  ];

  assert.equal(currentRound(matches, NOW), 2);
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
