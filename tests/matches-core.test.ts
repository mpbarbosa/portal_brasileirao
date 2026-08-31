import assert from "node:assert/strict";
import { test } from "node:test";

import {
  compareForFeed,
  currentRound,
  matchesForRound,
  mergeByFreshness,
  roundsOf,
  isAwaitingResult,
} from "@/matches-core";
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

/**
 * The regression these guard is the one the user reported: fixture 554986
 * finished 1-1 and the Partida page said "A realizar", because the fill behind
 * it had landed on upstream's stale copy of that record.
 */
test("a record the provider stamps older does not displace a fresher one", () => {
  const held = [
    match({
      id: "554986",
      status: "FINISHED",
      homeGoals: 1,
      awayGoals: 1,
      lastUpdated: "2026-08-30T23:37:19Z",
    }),
  ];
  const regressed = [
    match({ id: "554986", status: "SCHEDULED", lastUpdated: "2026-08-30T10:20:34Z" }),
  ];

  const merged = mergeByFreshness(held, regressed);

  assert.equal(merged[0].status, "FINISHED");
  assert.equal(merged[0].homeGoals, 1);
});

/** The other half of the same response, and the reason this is per fixture
 *  rather than "prefer the newer response": one record went backwards while
 *  another went forwards. */
test("a record the provider stamps newer is taken, in the same merge", () => {
  const held = [
    match({ id: "554986", status: "FINISHED", lastUpdated: "2026-08-30T23:37:19Z" }),
    match({ id: "554982", status: "LIVE", lastUpdated: "2026-08-31T00:32:15Z" }),
  ];
  const incoming = [
    match({ id: "554986", status: "SCHEDULED", lastUpdated: "2026-08-30T10:20:34Z" }),
    match({
      id: "554982",
      status: "FINISHED",
      homeGoals: 3,
      awayGoals: 2,
      lastUpdated: "2026-08-31T00:40:35Z",
    }),
  ];

  const merged = mergeByFreshness(held, incoming);

  assert.equal(merged.find((entry) => entry.id === "554986")?.status, "FINISHED");
  assert.equal(merged.find((entry) => entry.id === "554982")?.status, "FINISHED");
  assert.equal(merged.find((entry) => entry.id === "554982")?.homeGoals, 3);
});

test("incoming decides which fixtures exist — a dropped one is not resurrected", () => {
  const held = [
    match({ id: "kept", lastUpdated: "2026-08-31T00:00:00Z" }),
    match({ id: "gone", lastUpdated: "2026-08-31T00:00:00Z" }),
  ];

  const merged = mergeByFreshness(held, [match({ id: "kept" })]);

  assert.deepEqual(
    merged.map((entry) => entry.id),
    ["kept"],
  );
});

/** Without stamps there is nothing to compare, so the behaviour has to collapse
 *  back to what this app did before the merge existed. The seed snapshot
 *  carries no stamps at all, which makes this the end-to-end suite's path. */
test("with no stamp on either side the newest response wins", () => {
  const merged = mergeByFreshness(
    [match({ id: "554986", status: "FINISHED", homeGoals: 1, awayGoals: 1 })],
    [match({ id: "554986", status: "SCHEDULED" })],
  );

  assert.equal(merged[0].status, "SCHEDULED");
});

test("an unstamped held record never displaces a stamped incoming one", () => {
  const merged = mergeByFreshness(
    [match({ id: "554986", status: "FINISHED" })],
    [match({ id: "554986", status: "POSTPONED", lastUpdated: "2026-08-31T00:00:00Z" })],
  );

  assert.equal(merged[0].status, "POSTPONED");
});

/** An unparseable stamp is "no claim", not "the epoch" — held as a distinct
 *  case because reading it as a date would make it beat every real stamp
 *  or lose to every one, depending on which way `NaN` fell out. */
test("an unparseable stamp loses to a real one", () => {
  const merged = mergeByFreshness(
    [match({ id: "554986", status: "FINISHED", lastUpdated: "not a date" })],
    [match({ id: "554986", status: "SCHEDULED", lastUpdated: "2026-08-30T10:20:34Z" })],
  );

  assert.equal(merged[0].status, "SCHEDULED");
});

test("the first fill has nothing to compare against and passes straight through", () => {
  const incoming = [match({ id: "554986", status: "FINISHED" })];

  assert.deepEqual(mergeByFreshness([], incoming), incoming);
});

const KICKOFF = Date.parse("2026-08-30T21:30:00Z");
const DAY = 24 * 60 * 60 * 1000;

/**
 * The Partida page polls on this. Every branch is a request the app either
 * spends or does not, so each is pinned rather than left to reading.
 */
test("a finished match has nothing left to say", () => {
  assert.equal(
    isAwaitingResult(match({ id: "1", status: "FINISHED", kickoff: "2026-08-30T21:30:00Z" }), KICKOFF + DAY),
    false,
  );
});

test("a cancelled match has nothing left to say either", () => {
  assert.equal(
    isAwaitingResult(match({ id: "1", status: "CANCELLED", kickoff: "2026-08-30T21:30:00Z" }), KICKOFF),
    false,
  );
});

test("a live match is asked about", () => {
  assert.equal(
    isAwaitingResult(match({ id: "1", status: "LIVE", kickoff: "2026-08-30T21:30:00Z" }), KICKOFF),
    true,
  );
});

/**
 * The regression this exists for: upstream had 554986 finished while still
 * reporting it SCHEDULED, and that lasted about five hours — so a late bound of
 * `LATE_GRACE_MS` (three) would have stopped asking before the answer arrived.
 */
test("a kickoff long past keeps its page asking — there is no late bound", () => {
  const stuck = match({ id: "554986", status: "SCHEDULED", kickoff: "2026-08-30T21:30:00Z" });

  assert.equal(isAwaitingResult(stuck, KICKOFF + 5 * 60 * 60 * 1000), true);
  assert.equal(isAwaitingResult(stuck, KICKOFF + 30 * DAY), true);
});

test("a fixture within a day of kickoff is asked about", () => {
  assert.equal(
    isAwaitingResult(match({ id: "1", kickoff: "2026-08-30T21:30:00Z" }), KICKOFF - DAY + 1000),
    true,
  );
});

/** The half that stops every match page polling for ever. */
test("a fixture more than a day out is not", () => {
  assert.equal(
    isAwaitingResult(match({ id: "1", kickoff: "2026-08-30T21:30:00Z" }), KICKOFF - DAY - 1000),
    false,
  );
});

/** Postponed is deliberately not concluded: it will acquire a new kickoff, and
 *  that is worth learning. */
test("a postponed fixture whose kickoff has passed is still asked about", () => {
  assert.equal(
    isAwaitingResult(match({ id: "1", status: "POSTPONED", kickoff: "2026-08-30T21:30:00Z" }), KICKOFF + DAY),
    true,
  );
});

test("an unreadable kickoff is a reason to look again, not to stop", () => {
  assert.equal(isAwaitingResult(match({ id: "1", kickoff: "not a date" }), KICKOFF), true);
});
