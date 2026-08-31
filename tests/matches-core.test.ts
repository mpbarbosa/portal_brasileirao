import assert from "node:assert/strict";
import { test } from "node:test";

import {
  compareForFeed,
  currentRound,
  matchesForRound,
  mergeByFreshness,
  roundsOf,
} from "@/matches-core";
import type { Match } from "@/src/types";

/** The instant the newer-stamped regression below was read off the provider.
 *  Every merge test shares it so "past" and "future" kickoff mean one thing. */
const MERGE_NOW = Date.parse("2026-08-31T12:53:50Z");

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

  const merged = mergeByFreshness(held, regressed, MERGE_NOW);

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

  const merged = mergeByFreshness(held, incoming, MERGE_NOW);

  assert.equal(merged.find((entry) => entry.id === "554986")?.status, "FINISHED");
  assert.equal(merged.find((entry) => entry.id === "554982")?.status, "FINISHED");
  assert.equal(merged.find((entry) => entry.id === "554982")?.homeGoals, 3);
});

test("incoming decides which fixtures exist — a dropped one is not resurrected", () => {
  const held = [
    match({ id: "kept", lastUpdated: "2026-08-31T00:00:00Z" }),
    match({ id: "gone", lastUpdated: "2026-08-31T00:00:00Z" }),
  ];

  const merged = mergeByFreshness(held, [match({ id: "kept" })], MERGE_NOW);

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
    // Kickoff ahead of `now`, so this is a re-scheduled fixture rather than a
    // self-contradictory one and only the stamp rule is in play. Its incoherent
    // twin is the last test in this file.
    [match({ id: "554986", status: "SCHEDULED", kickoff: "2026-09-20T19:00:00Z" })],
    MERGE_NOW,
  );

  assert.equal(merged[0].status, "SCHEDULED");
});

test("an unstamped held record never displaces a stamped incoming one", () => {
  const merged = mergeByFreshness(
    [match({ id: "554986", status: "FINISHED" })],
    [match({ id: "554986", status: "POSTPONED", lastUpdated: "2026-08-31T00:00:00Z" })],
    MERGE_NOW,
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
    MERGE_NOW,
  );

  assert.equal(merged[0].status, "SCHEDULED");
});

test("the first fill has nothing to compare against and passes straight through", () => {
  const incoming = [match({ id: "554986", status: "FINISHED" })];

  assert.deepEqual(mergeByFreshness([], incoming, MERGE_NOW), incoming);
});

/**
 * The regression that defeated the stamp comparison, replayed.
 *
 * Read off `/v4/competitions/BSA/matches?matchday=25` at 2026-08-31T12:53:50Z:
 * `554986` came back TIMED with no score, stamped `2026-08-31T08:25:09Z` —
 * *newer* than the `FINISHED 1-1` copy stamped `2026-08-30T23:37:19Z` that the
 * app was holding. Three correctly-finished records in the same response shared
 * that stamp, so it was one generation that lost two results, not a replay of
 * an older one. Confirmed red against the pre-fix merge.
 */
const KICKOFF_PAST = "2026-08-30T21:30:00Z";

const heldResult = () =>
  match({
    id: "554986",
    kickoff: KICKOFF_PAST,
    status: "FINISHED",
    homeGoals: 1,
    awayGoals: 1,
    lastUpdated: "2026-08-30T23:37:19Z",
  });

test("a result is not withdrawn by a newer record calling the match unplayed", () => {
  const merged = mergeByFreshness(
    [heldResult()],
    [
      match({
        id: "554986",
        kickoff: KICKOFF_PAST,
        status: "SCHEDULED",
        lastUpdated: "2026-08-31T08:25:09Z",
      }),
    ],
    MERGE_NOW,
  );

  assert.equal(merged[0].status, "FINISHED");
  assert.equal(merged[0].homeGoals, 1);
  assert.equal(merged[0].awayGoals, 1);
});

/** The objection the stamp rule was written against, and the reason this rule
 *  tests coherence rather than ranking statuses: a genuine void must still land,
 *  or a voided result is pinned for ever. */
test("a result voided to POSTPONED still wins, however recently we held it", () => {
  const merged = mergeByFreshness(
    [heldResult()],
    [
      match({
        id: "554986",
        kickoff: KICKOFF_PAST,
        status: "POSTPONED",
        lastUpdated: "2026-08-31T08:25:09Z",
      }),
    ],
    MERGE_NOW,
  );

  assert.equal(merged[0].status, "POSTPONED");
});

test("a result voided to CANCELLED still wins", () => {
  const merged = mergeByFreshness(
    [heldResult()],
    [
      match({
        id: "554986",
        kickoff: KICKOFF_PAST,
        status: "CANCELLED",
        lastUpdated: "2026-08-31T08:25:09Z",
      }),
    ],
    MERGE_NOW,
  );

  assert.equal(merged[0].status, "CANCELLED");
});

/** Nothing is withdrawn when the incoming record carries a score, so a
 *  correction to the scoreline is not the shape this rule refuses. */
test("a corrected scoreline still wins", () => {
  const merged = mergeByFreshness(
    [heldResult()],
    [
      match({
        id: "554986",
        kickoff: KICKOFF_PAST,
        status: "FINISHED",
        homeGoals: 2,
        awayGoals: 1,
        lastUpdated: "2026-08-31T08:25:09Z",
      }),
    ],
    MERGE_NOW,
  );

  assert.equal(merged[0].homeGoals, 2);
  assert.equal(merged[0].awayGoals, 1);
});

/** A fixture moved to a future date is coherent — it says the match will be
 *  played, and names a time that has not arrived. Only a past kickoff makes
 *  "scheduled, no score" contradict itself. */
test("a fixture re-scheduled to a future kickoff still wins", () => {
  const merged = mergeByFreshness(
    [heldResult()],
    [
      match({
        id: "554986",
        kickoff: "2026-09-20T19:00:00Z",
        status: "SCHEDULED",
        lastUpdated: "2026-08-31T08:25:09Z",
      }),
    ],
    MERGE_NOW,
  );

  assert.equal(merged[0].status, "SCHEDULED");
  assert.equal(merged[0].kickoff, "2026-09-20T19:00:00Z");
});

test("with no result held there is nothing to withhold and upstream wins", () => {
  const merged = mergeByFreshness(
    [
      match({
        id: "554986",
        kickoff: KICKOFF_PAST,
        status: "LIVE",
        lastUpdated: "2026-08-30T23:37:19Z",
      }),
    ],
    [
      match({
        id: "554986",
        kickoff: KICKOFF_PAST,
        status: "SCHEDULED",
        lastUpdated: "2026-08-31T08:25:09Z",
      }),
    ],
    MERGE_NOW,
  );

  assert.equal(merged[0].status, "SCHEDULED");
});

/** An unusable kickoff cannot be shown to be past, and this rule overrules the
 *  provider — so it declines to fire, the same direction `kickoffValue` sorts
 *  such a fixture. */
test("an unparseable kickoff is not treated as past, so upstream wins", () => {
  const merged = mergeByFreshness(
    [heldResult()],
    [
      match({
        id: "554986",
        kickoff: "sometime",
        status: "SCHEDULED",
        lastUpdated: "2026-08-31T08:25:09Z",
      }),
    ],
    MERGE_NOW,
  );

  assert.equal(merged[0].status, "SCHEDULED");
});

/** The twin of "with no stamp on either side the newest response wins": that
 *  collapse is about the *stamp*, and coherence does not depend on one. Where
 *  upstream claims nothing, an incoherent record still loses. */
test("coherence does not need a stamp to refuse a withdrawal", () => {
  const merged = mergeByFreshness(
    [match({ id: "554986", kickoff: KICKOFF_PAST, status: "FINISHED", homeGoals: 1, awayGoals: 1 })],
    [match({ id: "554986", kickoff: KICKOFF_PAST, status: "SCHEDULED" })],
    MERGE_NOW,
  );

  assert.equal(merged[0].status, "FINISHED");
});
