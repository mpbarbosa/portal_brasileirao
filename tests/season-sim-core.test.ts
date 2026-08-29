import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_SEED,
  buildStrengthModel,
  createPoissonSampler,
  createRng,
  isRemainingFixture,
  predictMatchOutcome,
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

// --- One fixture, closed form -----------------------------------------------------

/** A division with a season's worth of results behind it, so the strengths are
 *  something other than the prior: the first club beats everyone, the last loses
 *  to everyone, and the middle draws. */
const FORMED: Match[] = singleRoundRobin(TEN).map((fixture) => {
  const rank = (code: string) => Number(code.slice(1));
  const home = rank(fixture.homeCode);
  const away = rank(fixture.awayCode);
  return {
    ...fixture,
    status: "FINISHED" as const,
    homeGoals: home < away ? 2 : 1,
    awayGoals: home < away ? 0 : 1,
  };
});

test("the three results sum to one", () => {
  const outcome = predictMatchOutcome(TEN, FORMED, "C2", "C7");
  const sum = outcome.homeWin + outcome.draw + outcome.awayWin;
  assert.ok(Math.abs(sum - 1) < 1e-9, `summed to ${sum}`);
});

test("it is exact, so two calls on one snapshot cannot differ", () => {
  assert.deepEqual(
    predictMatchOutcome(TEN, FORMED, "C2", "C7"),
    predictMatchOutcome(TEN, FORMED, "C2", "C7"),
  );
});

test("a stronger side is likelier to win, and the stronger it is the likelier", () => {
  const nearEven = predictMatchOutcome(TEN, FORMED, "C4", "C5");
  const lopsided = predictMatchOutcome(TEN, FORMED, "C0", "C9");
  assert.ok(lopsided.homeWin > nearEven.homeWin);
  assert.ok(lopsided.homeWin > lopsided.awayWin);
  assert.ok(lopsided.expectedHomeGoals > lopsided.expectedAwayGoals);
});

test("with nothing played, the two sides are exactly level — no mando is invented", () => {
  const outcome = predictMatchOutcome(TEN, singleRoundRobin(TEN), "C0", "C9");
  assert.ok(Math.abs(outcome.homeWin - outcome.awayWin) < 1e-12);
  // Not `assert.equal`: both are sums over the same 81 cells but accumulated in
  // different orders — home goals vary down the outer loop, away goals across
  // the inner — so they land 5e-16 apart. The symmetry is exact in the model
  // and inexact in the float, which is a property of the summation and not of
  // the mando.
  assert.ok(Math.abs(outcome.expectedHomeGoals - outcome.expectedAwayGoals) < 1e-12);
});

test("the mando shows up as an edge to the home side between equals", () => {
  // Every home side has won 2-0 all season, so the model has a large mando and
  // no reason to separate the clubs on anything else.
  const allHomeWins = singleRoundRobin(TEN).map((fixture) => ({
    ...fixture,
    status: "FINISHED" as const,
    homeGoals: 2,
    awayGoals: 0,
  }));
  const outcome = predictMatchOutcome(TEN, allHomeWins, "C3", "C4");
  assert.ok(outcome.homeWin > outcome.awayWin, `${outcome.homeWin} vs ${outcome.awayWin}`);
  assert.ok(outcome.expectedHomeGoals > outcome.expectedAwayGoals);
});

test("the modal scoreline carries its own probability, and it is the largest one", () => {
  const outcome = predictMatchOutcome(TEN, FORMED, "C2", "C7");
  const { homeGoals, awayGoals, probability } = outcome.mostLikelyScore;
  assert.ok(Number.isInteger(homeGoals) && homeGoals >= 0 && homeGoals <= 8);
  assert.ok(Number.isInteger(awayGoals) && awayGoals >= 0 && awayGoals <= 8);
  assert.ok(probability > 0 && probability < 1);
  // It is the tallest bar of a long tail, not a prediction: nothing about a
  // football match makes one scoreline likely, and the copy has to be able to
  // say so.
  assert.ok(probability < 0.35, `modal scoreline at ${probability} is implausibly certain`);
  // And it really is the tallest. Asserting only the three lines above is what
  // this test did first, and a deliberate mutation that stopped searching for
  // the maximum — leaving the modal cell pinned at 0-0 — passed all of them:
  // 0-0 is an integer pair in range with a small positive probability. The
  // grid is private, so the maximum is established against the sampler drawing
  // from the same cells.
  const sampler = createPoissonSampler(computeStandings(TEN, FORMED), FORMED);
  const fixture = match({
    homeCode: "C2",
    awayCode: "C7",
    status: "SCHEDULED",
    homeGoals: null,
    awayGoals: null,
  });
  const rng = createRng(77);
  const seen = new Map<string, number>();
  const draws = 40_000;
  for (let i = 0; i < draws; i += 1) {
    const score = sampler(fixture, rng);
    const key = `${score.homeGoals}-${score.awayGoals}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  let empirical = "";
  let best = -1;
  for (const [key, count] of seen) {
    if (count > best) {
      best = count;
      empirical = key;
    }
  }
  assert.equal(`${homeGoals}-${awayGoals}`, empirical);
  assert.ok(
    Math.abs(best / draws - probability) < 0.01,
    `modal ${empirical} drawn ${best / draws} against a stated ${probability}`,
  );
});

test("a club the table does not have degrades to league average rather than throwing", () => {
  const outcome = predictMatchOutcome(TEN, FORMED, "C0", "NOPE");
  const sum = outcome.homeWin + outcome.draw + outcome.awayWin;
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.ok(outcome.expectedAwayGoals > 0);
});

test("the closed form agrees with the sampler — one model, two ways of reading it", () => {
  // The whole reason `buildScoreGrid` is a named thing: `projectSeason` samples
  // these cells and `predictMatchOutcome` sums them, so the two must land on the
  // same numbers. If they ever stop doing so, one of them has grown its own
  // model and this is what says so.
  //
  // It has already earned its place. The first version of `predictMatchOutcome`
  // reported λ and μ as the expected goals — the parameters the Poisson was
  // built from — and this went red on the goals assertions while every
  // probability assertion passed. The grid truncates at eight and applies the
  // Dixon–Coles τ before renormalising, so its mean is not λ; on this fixture
  // the gap is 0.08 and on the away side λ is the clamp rather than an
  // expectation at all. Nothing else here could have seen it: the value was
  // plausible, self-consistent and wrong.
  const closed = predictMatchOutcome(TEN, FORMED, "C2", "C7");
  const sampler = createPoissonSampler(computeStandings(TEN, FORMED), FORMED);
  const fixture = match({
    homeCode: "C2",
    awayCode: "C7",
    status: "SCHEDULED",
    homeGoals: null,
    awayGoals: null,
  });

  const draws = 40_000;
  const rng = createRng(2026);
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let homeGoals = 0;
  let awayGoals = 0;
  for (let i = 0; i < draws; i += 1) {
    const score = sampler(fixture, rng);
    homeGoals += score.homeGoals;
    awayGoals += score.awayGoals;
    if (score.homeGoals > score.awayGoals) homeWin += 1;
    else if (score.homeGoals < score.awayGoals) awayWin += 1;
    else draw += 1;
  }

  // 40,000 draws puts the standard error near 0.0025, so 0.01 is four sigma and
  // a real divergence between the two paths cannot hide under it.
  assert.ok(Math.abs(homeWin / draws - closed.homeWin) < 0.01, `home ${homeWin / draws} vs ${closed.homeWin}`);
  assert.ok(Math.abs(draw / draws - closed.draw) < 0.01, `draw ${draw / draws} vs ${closed.draw}`);
  assert.ok(Math.abs(awayWin / draws - closed.awayWin) < 0.01, `away ${awayWin / draws} vs ${closed.awayWin}`);
  assert.ok(Math.abs(homeGoals / draws - closed.expectedHomeGoals) < 0.05);
  assert.ok(Math.abs(awayGoals / draws - closed.expectedAwayGoals) < 0.05);
});
