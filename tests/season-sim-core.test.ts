import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_SEED,
  buildStrengthModel,
  createPoissonSampler,
  createRng,
  isRemainingFixture,
  projectSeason,
  remainingFixtures,
} from "@/season-sim-core";
import type { FixtureSampler } from "@/season-sim-core";
import { computeStandings } from "@/standings-core";
import type { Club, Match } from "@/src/types";

/** The floor `projectSeason` clamps to; asserted below rather than imported,
 *  so a change to it has to be a deliberate edit in two places. */
const MIN_ITERATIONS = 200;

const club = (code: string, shortName = code): Club => ({
  code,
  name: `${shortName} FC`,
  shortName,
  state: "SP",
});

const match = (overrides: Partial<Match> & Pick<Match, "homeCode" | "awayCode">): Match => ({
  id: `${overrides.homeCode}-${overrides.awayCode}-${overrides.round ?? 1}`,
  round: 1,
  kickoff: "2026-04-11T19:00:00Z",
  status: "FINISHED",
  homeGoals: 0,
  awayGoals: 0,
  ...overrides,
});

/** A four-club division, so a G4 is everybody and a Z4 is everybody — the two
 *  zones are exercised separately below on a division big enough to have an
 *  outside. */
const CLUBS = [club("AAA"), club("BBB"), club("CCC"), club("DDD")];

/** A ten-club division playing a single round-robin: 45 fixtures, enough that a
 *  zone has an inside and an outside. */
const TEN = Array.from({ length: 10 }, (_, i) => club(`C${i}`, `Club ${i}`));

const singleRoundRobin = (clubs: Club[]): Match[] => {
  const fixtures: Match[] = [];
  let round = 1;
  for (let i = 0; i < clubs.length; i += 1) {
    for (let j = i + 1; j < clubs.length; j += 1) {
      fixtures.push(
        match({
          homeCode: clubs[i].code,
          awayCode: clubs[j].code,
          round,
          status: "SCHEDULED",
          homeGoals: null,
          awayGoals: null,
        }),
      );
      round += 1;
    }
  }
  return fixtures;
};

// --- Which fixtures get simulated -----------------------------------------------

test("a cancelled fixture is never played and never simulated", () => {
  assert.equal(
    isRemainingFixture(match({ homeCode: "AAA", awayCode: "BBB", status: "CANCELLED" })),
    false,
  );
});

test("a postponed fixture will be played, so it is simulated", () => {
  assert.equal(
    isRemainingFixture(
      match({
        homeCode: "AAA",
        awayCode: "BBB",
        status: "POSTPONED",
        homeGoals: null,
        awayGoals: null,
      }),
    ),
    true,
  );
});

test("a live fixture is simulated, because the app carries no match minute", () => {
  assert.equal(
    isRemainingFixture(
      match({ homeCode: "AAA", awayCode: "BBB", status: "LIVE", homeGoals: 1, awayGoals: 0 }),
    ),
    true,
  );
});

test("a finished fixture with both scores is not simulated", () => {
  assert.equal(
    isRemainingFixture(match({ homeCode: "AAA", awayCode: "BBB", homeGoals: 2, awayGoals: 1 })),
    false,
  );
});

test("a finished fixture missing a score is simulated — it was played and we do not know how", () => {
  assert.equal(
    isRemainingFixture(match({ homeCode: "AAA", awayCode: "BBB", homeGoals: null })),
    true,
  );
});

test("a fixture naming a club the table does not have is dropped, not simulated", () => {
  const fixtures = [
    match({ homeCode: "AAA", awayCode: "ZZZ", status: "SCHEDULED", homeGoals: null, awayGoals: null }),
    match({ homeCode: "AAA", awayCode: "BBB", status: "SCHEDULED", homeGoals: null, awayGoals: null }),
  ];
  const remaining = remainingFixtures(CLUBS, fixtures);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].awayCode, "BBB");
});

// --- The RNG ---------------------------------------------------------------------

test("the RNG is seeded, uniform in [0, 1), and reproducible", () => {
  const a = createRng(7);
  const b = createRng(7);
  const drawsA = Array.from({ length: 500 }, () => a());
  const drawsB = Array.from({ length: 500 }, () => b());
  assert.deepEqual(drawsA, drawsB);
  for (const draw of drawsA) {
    assert.ok(draw >= 0 && draw < 1, `${draw} outside [0, 1)`);
  }
  assert.notDeepEqual(drawsA, Array.from({ length: 500 }, createRng(8)));
});

// --- The strength model ----------------------------------------------------------

test("an unplayed season gives every club league-average strength and no mando", () => {
  const fixtures = singleRoundRobin(CLUBS);
  const model = buildStrengthModel(computeStandings(CLUBS, fixtures), fixtures);
  assert.equal(model.homeFactor, 1);
  assert.equal(model.awayFactor, 1);
  for (const code of CLUBS.map((c) => c.code)) {
    assert.equal(model.clubs.get(code)?.attack, 1);
    assert.equal(model.clubs.get(code)?.defense, 1);
  }
});

test("a club that scores more than the division reads as a stronger attack", () => {
  const fixtures = [
    match({ homeCode: "AAA", awayCode: "BBB", homeGoals: 4, awayGoals: 0 }),
    match({ homeCode: "AAA", awayCode: "CCC", homeGoals: 3, awayGoals: 0 }),
    match({ homeCode: "BBB", awayCode: "CCC", homeGoals: 0, awayGoals: 0 }),
    match({ homeCode: "DDD", awayCode: "BBB", homeGoals: 1, awayGoals: 1 }),
  ];
  const model = buildStrengthModel(computeStandings(CLUBS, fixtures), fixtures);
  const strong = model.clubs.get("AAA");
  const weak = model.clubs.get("BBB");
  assert.ok(strong && weak);
  assert.ok(strong.attack > 1, `expected AAA attack above average, got ${strong.attack}`);
  assert.ok(strong.attack > weak.attack);
  // BBB conceded four and three; a defence above 1 is a leakier one.
  assert.ok(weak.defense > strong.defense);
});

test("mando de campo is read out of the finished matches, not assumed", () => {
  // Every home side wins 2-0 across a full round-robin, so the division's home
  // mean is 2 and its away mean 0 before shrinkage. The factors must straddle 1.
  const fixtures = singleRoundRobin(TEN).map((fixture) => ({
    ...fixture,
    status: "FINISHED" as const,
    homeGoals: 2,
    awayGoals: 0,
  }));
  const model = buildStrengthModel(computeStandings(TEN, fixtures), fixtures);
  assert.ok(model.homeFactor > 1, `home factor ${model.homeFactor}`);
  assert.ok(model.awayFactor < 1, `away factor ${model.awayFactor}`);
  // Shrinkage keeps it short of the raw 2.0/0.0 the sample alone would give.
  assert.ok(model.homeFactor < 2);
  assert.ok(model.awayFactor > 0);
});

// --- The sampler -----------------------------------------------------------------

test("the sampler returns scorelines within the grid and is reproducible", () => {
  const fixtures = singleRoundRobin(TEN);
  const sampler = createPoissonSampler(computeStandings(TEN, fixtures), fixtures);
  const draw = () => {
    const rng = createRng(11);
    return fixtures.map((fixture) => sampler(fixture, rng));
  };
  const first = draw();
  assert.deepEqual(first, draw());
  for (const score of first) {
    assert.ok(Number.isInteger(score.homeGoals) && score.homeGoals >= 0 && score.homeGoals <= 8);
    assert.ok(Number.isInteger(score.awayGoals) && score.awayGoals >= 0 && score.awayGoals <= 8);
  }
});

test("the same pair meeting twice are different fixtures, because the mando swaps", () => {
  const played = singleRoundRobin(TEN).map((fixture) => ({
    ...fixture,
    status: "FINISHED" as const,
    homeGoals: 2,
    awayGoals: 0,
  }));
  const sampler = createPoissonSampler(computeStandings(TEN, played), played);
  const home = match({ homeCode: "C0", awayCode: "C1", status: "SCHEDULED", homeGoals: null, awayGoals: null });
  const away = match({ homeCode: "C1", awayCode: "C0", status: "SCHEDULED", homeGoals: null, awayGoals: null });
  // Over many draws the home side of each fixture must outscore the away side,
  // and the two orientations must not produce the identical stream.
  const tally = (fixture: Match) => {
    const rng = createRng(3);
    let forHome = 0;
    let forAway = 0;
    for (let i = 0; i < 400; i += 1) {
      const score = sampler(fixture, rng);
      forHome += score.homeGoals;
      forAway += score.awayGoals;
    }
    return { forHome, forAway };
  };
  const a = tally(home);
  const b = tally(away);
  assert.ok(a.forHome > a.forAway);
  assert.ok(b.forHome > b.forAway);
});

// --- The projection ---------------------------------------------------------------

test("a decided season projects itself: every probability is a 0 or a 1", () => {
  const fixtures = [
    match({ homeCode: "AAA", awayCode: "BBB", homeGoals: 3, awayGoals: 0 }),
    match({ homeCode: "CCC", awayCode: "DDD", homeGoals: 0, awayGoals: 1 }),
    match({ homeCode: "AAA", awayCode: "CCC", homeGoals: 2, awayGoals: 0 }),
    match({ homeCode: "BBB", awayCode: "DDD", homeGoals: 0, awayGoals: 2 }),
  ];
  const projection = projectSeason(CLUBS, fixtures, { iterations: MIN_ITERATIONS });
  assert.equal(projection.remaining, 0);
  // Nothing to sample, so one run is the whole distribution and the reported
  // count says so rather than echoing the request back.
  assert.equal(projection.iterations, 1);
  const table = computeStandings(CLUBS, fixtures);
  for (const entry of projection.odds) {
    for (const share of entry.positionOdds) {
      assert.ok(share === 0 || share === 1, `expected a certainty, got ${share}`);
    }
    const actual = table.find((row) => row.club.code === entry.club.code);
    assert.ok(actual);
    assert.equal(entry.averagePosition, actual.position);
    assert.equal(entry.averagePoints, actual.points);
  }
  assert.equal(projection.odds[0].title, 1);
});


test("every club's position odds sum to one, and every position is claimed once", () => {
  const fixtures = singleRoundRobin(TEN);
  const projection = projectSeason(TEN, fixtures, { iterations: 500 });
  assert.equal(projection.remaining, 45);

  for (const entry of projection.odds) {
    const sum = entry.positionOdds.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `${entry.club.code} sums to ${sum}`);
    assert.equal(entry.positionOdds.length, TEN.length);
  }
  // Read the other way: each position is filled in exactly one club's simulation
  // per iteration, so a column sums to 1 too. This is what catches a harness
  // that double-counts a club or loses one.
  for (let position = 0; position < TEN.length; position += 1) {
    const column = projection.odds.reduce((sum, entry) => sum + entry.positionOdds[position], 0);
    assert.ok(Math.abs(column - 1) < 1e-9, `position ${position + 1} sums to ${column}`);
  }
});

test("the headline numbers are the position odds, not a second tally", () => {
  const projection = projectSeason(TEN, singleRoundRobin(TEN), { iterations: 500 });
  const depth = 4;
  for (const entry of projection.odds) {
    assert.equal(entry.title, entry.positionOdds[0]);
    assert.equal(
      entry.g4,
      entry.positionOdds.slice(0, depth).reduce((a, b) => a + b, 0),
    );
    assert.equal(
      entry.z4,
      entry.positionOdds.slice(TEN.length - depth).reduce((a, b) => a + b, 0),
    );
  }
});

test("the same seed gives the same projection, and a different one does not", () => {
  const fixtures = singleRoundRobin(TEN);
  const a = projectSeason(TEN, fixtures, { iterations: 400, seed: 42 });
  const b = projectSeason(TEN, fixtures, { iterations: 400, seed: 42 });
  const c = projectSeason(TEN, fixtures, { iterations: 400, seed: 43 });
  assert.deepEqual(a.odds, b.odds);
  assert.notDeepEqual(a.odds, c.odds);
  assert.equal(a.seed, 42);
});

test("a runaway leader with two rounds left is overwhelmingly likely champion", () => {
  // C0 has taken every point available; the chasing pack is level on nothing.
  const played = singleRoundRobin(TEN)
    .filter((fixture) => fixture.homeCode === "C0" || fixture.awayCode === "C0")
    .map((fixture) => ({
      ...fixture,
      status: "FINISHED" as const,
      homeGoals: fixture.homeCode === "C0" ? 3 : 0,
      awayGoals: fixture.homeCode === "C0" ? 0 : 3,
    }));
  const rest = singleRoundRobin(TEN).filter(
    (fixture) => fixture.homeCode !== "C0" && fixture.awayCode !== "C0",
  );
  const projection = projectSeason(TEN, [...played, ...rest], { iterations: 2000 });
  const leader = projection.odds.find((entry) => entry.club.code === "C0");
  assert.ok(leader);
  assert.ok(leader.title > 0.9, `leader's título odds were ${leader.title}`);
  assert.equal(leader.z4, 0);
});

test("the caller's fixtures are never mutated", () => {
  const fixtures = singleRoundRobin(TEN);
  const before = JSON.parse(JSON.stringify(fixtures));
  projectSeason(TEN, fixtures, { iterations: 300 });
  assert.deepEqual(fixtures, before);
});

test("the iteration count is clamped rather than trusted", () => {
  const fixtures = singleRoundRobin(TEN);
  assert.equal(projectSeason(TEN, fixtures, { iterations: 1 }).iterations, 200);
  assert.equal(projectSeason(TEN, fixtures, { iterations: 1e9, sampler: () => ({ homeGoals: 0, awayGoals: 0 }) }).iterations, 50_000);
});

test("the model is pluggable — a sampler that always draws 0-0 leaves the table where it was", () => {
  const goalless: FixtureSampler = () => ({ homeGoals: 0, awayGoals: 0 });
  const played = [match({ homeCode: "C0", awayCode: "C1", homeGoals: 1, awayGoals: 0 })];
  const fixtures = [
    ...played,
    ...singleRoundRobin(TEN).filter(
      (fixture) => !(fixture.homeCode === "C0" && fixture.awayCode === "C1"),
    ),
  ];
  const projection = projectSeason(TEN, fixtures, { iterations: 200, sampler: goalless });
  // Every remaining fixture is a goalless draw, so the outcome is deterministic:
  // C0 is the only club with a win and must be champion every time.
  const leader = projection.odds.find((entry) => entry.club.code === "C0");
  assert.ok(leader);
  assert.equal(leader.title, 1);
});

test("the default seed is stable, so a served projection does not move on refresh", () => {
  assert.equal(DEFAULT_SEED, 20_260_829);
});
