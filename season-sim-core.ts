/**
 * **Projeção** — each club's odds of finishing champion, inside the G4 and
 * inside the Z4, estimated by simulating the fixtures that have not been played.
 *
 * Pure, like every other `*-core` module: clubs and matches in, probabilities
 * out. No network, no clock, no `Math.random` — the RNG is seeded, so the same
 * snapshot and the same seed give the same numbers every time. That is not a
 * testing convenience but a requirement of serving them: a table whose título
 * column moved on refresh, with no match having been played, would read as the
 * model changing its mind rather than as sampling noise.
 *
 * `docs/brasileirao-pro-proposal.md` rejected the Pro prototype's confident
 * percentages and named the replacement in the same breath: "a título/rebaixamento
 * projection computed from an explicit, documented Monte Carlo over remaining
 * fixtures". This is that, and the model it uses is documented here rather than
 * left as a number on a page.
 *
 * **It re-runs `computeStandings` once per iteration rather than keeping its own
 * tally**, which is the argument `rank-history-core.ts` already makes and the
 * more important one here: the CBF tie-breakers decide a position, so a
 * simulated table ranked by a second implementation of them would disagree with
 * the Classificação it claims to project. The cost is an allocation-free loop
 * over the season — see `simulateSeason` for how the working array avoids
 * rebuilding 380 objects per iteration.
 *
 * **Two entry points, one model.** `projectSeason` samples the whole remaining
 * season; `predictMatchOutcome` sums a single fixture in closed form, with no
 * RNG. Both read the same `buildScoreGrid`, so a prognosis on a match page and
 * the projection in the Classificação cannot come to disagree about who is
 * likely to win — which is the failure a second module would eventually
 * produce, and the reason the sibling repo's split (its narrator in
 * `predict-core.ts`, its model in `qualification-sim-core.ts`) puts the *model*
 * on this side of the line.
 *
 * The framing throughout is **simulado**. Nothing here is a forecast, and no
 * caller should present it as one.
 */
import { ZONE_DEPTH, computeStandings, countsTowardStandings } from "@/standings-core";
import type { Club, ClubCode, Match, StandingsRow } from "@/src/types";

// --- Seeded RNG ----------------------------------------------------------------
// mulberry32: small, fast, and good enough for sampling scorelines. The point is
// reproducibility, so `Math.random` is not an option anywhere in this file.

export type Rng = () => number; // uniform in [0, 1)

export const createRng = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// --- Which fixtures are still to be played --------------------------------------

/**
 * A fixture the projection has to invent a result for: anything that does not
 * already count toward the table and is still going to be played.
 *
 * Three of the five statuses need their own sentence, because the obvious rule
 * — "not FINISHED" — is wrong for two of them:
 *
 * - **CANCELLED is excluded.** It will never be played, so awarding points for
 *   it would inflate every club it touches.
 * - **POSTPONED is included.** A Série A fixture that is adiado is rescheduled,
 *   not dropped; a club a game short is going to play that game. Leaving it out
 *   would permanently cost that club the points, which is the opposite of the
 *   honest reading — and it is the same distinction `pointsPercentage` draws
 *   when it calls a postponed fixture the difference between a bad campaign and
 *   a short one.
 * - **LIVE is included, and simulated from 0-0 rather than from the score on
 *   the board.** This app deliberately carries no match minute (`live-core.ts`
 *   explains why at length), so a partial score cannot be told from a final one:
 *   1-0 five minutes in and 1-0 with five to go are the same payload here, and
 *   crediting the lead would assert a safety the data cannot support. Fresh is
 *   the choice consistent with `countsTowardStandings`, which excludes the same
 *   fixture from the real table for the same reason. At most one round is ever
 *   in this state.
 *
 * A FINISHED fixture missing a score also lands here. That is a defect upstream
 * rather than a status, but the honest treatment is identical: it was played and
 * we do not know how it went.
 */
export const isRemainingFixture = (match: Match): boolean =>
  !countsTowardStandings(match) && match.status !== "CANCELLED";

/**
 * The fixtures a projection will sample: remaining, and naming two clubs the
 * table actually has. `computeStandings` drops a fixture referencing an unknown
 * club rather than throwing, so simulating one would burn work to produce goals
 * that are silently discarded — and would make the fixture count reported to the
 * caller a number nothing acted on.
 */
export const remainingFixtures = (clubs: Club[], matches: Match[]): Match[] => {
  const known = new Set<ClubCode>(clubs.map((club) => club.code));
  return matches.filter(
    (match) =>
      isRemainingFixture(match) && known.has(match.homeCode) && known.has(match.awayCode),
  );
};

// --- The model ------------------------------------------------------------------
// Two independent Poissons with the Dixon–Coles correction, over each club's
// current form. Every parameter below is estimated from the snapshot rather than
// written down, so the model has nothing in it that a reader cannot check against
// the table.
//
// **Not a bivariate Poisson**, which this comment called it until 2026-09-03. That
// is a different model — Karlis & Ntzoufras, with a shared covariance component —
// and the only dependence between the two sides here is `dixonColesTau`, which
// touches the four lowest scorelines and leaves every other cell of the grid a
// product of two independent marginals. The arithmetic was always Dixon–Coles; the
// name was not, in three places, and it travelled out of the repository before
// anybody read it against the code.

/** Goals per club per match before any has been played — the only number here
 *  that is not read from the data, and it is used only while there is no data to
 *  read. Série A has sat close to this for years. */
const LEAGUE_AVG_GOALS = 1.3;

/** Clamp on a single fixture's expected goals, so a club with one 5-0 in a tiny
 *  sample cannot be projected to score five every week. */
const MIN_EXPECTED_GOALS = 0.15;
const MAX_EXPECTED_GOALS = 5;

/** Scoreline grid cap. P(9 goals by one side) is far below the noise floor of
 *  any iteration count this module will be run at. */
const MAX_GOALS_PER_SIDE = 8;

/**
 * Pseudo-matches of the league baseline mixed into each club's own rate. It is
 * what stops round 2 being read as a form line: at 1.5 a club with two matches
 * played is roughly 57% its own record and 43% the league's.
 */
const DEFAULT_PRIOR_WEIGHT = 1.5;

/**
 * Dixon–Coles low-score correlation. Negative lifts the exact draws (0-0, 1-1)
 * and tempers 1-0/0-1, correcting independent Poisson's well-known shortfall of
 * draws — which matters more in a 38-round league than in a group stage, because
 * a draw is a point and points are what the whole projection is about. 0
 * disables the correction.
 */
const DEFAULT_RHO = -0.13;

/**
 * Pseudo-matches mixed into the home-advantage estimate, in *fixtures*. Twenty
 * is about half a round: enough that the first weekend of a season does not set
 * the mando de campo, negligible by the time anything is being projected.
 */
const HOME_PRIOR_MATCHES = 20;

export interface ModelOptions {
  priorWeight?: number;
  rho?: number;
}

export interface ClubStrength {
  /** Multiplicative, 1.0 = league average. Above 1 scores more than average. */
  attack: number;
  /** Above 1 *concedes* more than average, i.e. a weaker defence. */
  defense: number;
}

export interface StrengthModel {
  /** Goals per club per match across the division. */
  baseline: number;
  /**
   * Mando de campo, as a multiplier on the home side's expected goals — and its
   * mirror on the away side's. **Estimated from the snapshot, never assumed.**
   * Brasileirão's home advantage is large and real, and the sibling model this
   * was ported from has none at all because a World Cup group stage barely has
   * one; carrying that over would have quietly biased every fixture in the
   * league. Reading it out of the same finished matches the strengths come from
   * means it shrinks to 1.0 on an empty season instead of asserting a number.
   */
  homeFactor: number;
  awayFactor: number;
  clubs: Map<ClubCode, ClubStrength>;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const NEUTRAL: ClubStrength = { attack: 1, defense: 1 };

/**
 * Estimate attack, defence and mando de campo from the finished matches.
 *
 * The strengths are venue-neutral — a club's goals for and against, wherever
 * they were scored — and the home/away split rides on top as one division-wide
 * pair of factors. That is the standard simplification, and the alternative
 * (four rates per club) needs roughly twice the matches to estimate at the same
 * noise, which is exactly what a projection does not have in April.
 */
export const buildStrengthModel = (
  rows: StandingsRow[],
  matches: Match[],
  priorWeight = DEFAULT_PRIOR_WEIGHT,
): StrengthModel => {
  let totalGoals = 0;
  let totalClubMatches = 0;
  for (const row of rows) {
    totalGoals += row.goalsFor;
    totalClubMatches += row.played;
  }
  const baseline = totalClubMatches > 0 ? totalGoals / totalClubMatches : LEAGUE_AVG_GOALS;

  let homeGoals = 0;
  let awayGoals = 0;
  let played = 0;
  for (const match of matches) {
    if (!countsTowardStandings(match)) continue;
    homeGoals += match.homeGoals;
    awayGoals += match.awayGoals;
    played += 1;
  }
  // Shrunk toward the baseline by HOME_PRIOR_MATCHES pseudo-fixtures, so both
  // factors are exactly 1 when nothing has been played.
  const homeMean = (homeGoals + HOME_PRIOR_MATCHES * baseline) / (played + HOME_PRIOR_MATCHES);
  const awayMean = (awayGoals + HOME_PRIOR_MATCHES * baseline) / (played + HOME_PRIOR_MATCHES);

  const weight = Math.max(0, priorWeight);
  const clubs = new Map<ClubCode, ClubStrength>();
  for (const row of rows) {
    const attack = (row.goalsFor + weight * baseline) / (row.played + weight);
    const defense = (row.goalsAgainst + weight * baseline) / (row.played + weight);
    clubs.set(row.club.code, { attack: attack / baseline, defense: defense / baseline });
  }

  return {
    baseline,
    homeFactor: homeMean / baseline,
    awayFactor: awayMean / baseline,
    clubs,
  };
};

/** Poisson pmf for k = 0..max, iteratively (p_k = p_{k-1}·λ/k) — no factorials. */
const poissonPmf = (lambda: number, max: number): number[] => {
  const pmf = new Array<number>(max + 1);
  pmf[0] = Math.exp(-lambda);
  for (let k = 1; k <= max; k += 1) pmf[k] = (pmf[k - 1] * lambda) / k;
  return pmf;
};

/** Dixon–Coles τ, which touches only the four lowest scorelines. */
const dixonColesTau = (
  home: number,
  away: number,
  lambda: number,
  mu: number,
  rho: number,
): number => {
  if (home === 0 && away === 0) return 1 - lambda * mu * rho;
  if (home === 0 && away === 1) return 1 + lambda * rho;
  if (home === 1 && away === 0) return 1 + mu * rho;
  if (home === 1 && away === 1) return 1 - rho;
  return 1;
};

/**
 * One fixture's full scoreline grid: each side's expected goals, and the
 * normalised probability of every scoreline from 0-0 to 8-8.
 *
 * It is a *grid* rather than three win/draw/loss numbers because goal
 * difference and goals scored are the third and fourth CBF tie-breakers: a
 * projection that sampled only the result would rank its simulated tables by a
 * rule the real one does not use.
 *
 * **Both consumers read these same cells**, which is the whole reason the grid
 * is a named thing. `buildScoreDistribution` lays them end to end into a
 * cumulative table for the RNG; `predictMatchOutcome` sums them directly, with
 * no RNG at all. A prognosis on a match page and the projection in the
 * Classificação are therefore the same model by construction rather than by
 * agreement — and `the closed form agrees with the sampler` in the test file is
 * what would notice if that ever stopped being true.
 */
interface ScoreGrid {
  /** The Poisson parameters the cells were built from — λ for the home side,
   *  μ for the away. Internal: they are *not* the distribution's mean once the
   *  grid is truncated and Dixon–Coles-corrected, so nothing outside this
   *  module should report them as expected goals. See `MatchOutcome`. */
  lambda: number;
  mu: number;
  /** Parallel arrays over the 81 cells; `prob` sums to 1. */
  homeGoals: number[];
  awayGoals: number[];
  prob: number[];
}

const buildScoreGrid = (
  model: StrengthModel,
  homeCode: ClubCode,
  awayCode: ClubCode,
  rho: number,
): ScoreGrid => {
  // A club the table does not have takes league-average strength rather than
  // throwing, which is `computeStandings`' rule for the same situation: one
  // unrecognised code should degrade a number, not blank a page.
  const home = model.clubs.get(homeCode) ?? NEUTRAL;
  const away = model.clubs.get(awayCode) ?? NEUTRAL;
  // λ = baseline · attack(self) · defence(opponent) · mando. Mirrored for away.
  const lambda = clamp(
    model.baseline * home.attack * away.defense * model.homeFactor,
    MIN_EXPECTED_GOALS,
    MAX_EXPECTED_GOALS,
  );
  const mu = clamp(
    model.baseline * away.attack * home.defense * model.awayFactor,
    MIN_EXPECTED_GOALS,
    MAX_EXPECTED_GOALS,
  );

  const pmfHome = poissonPmf(lambda, MAX_GOALS_PER_SIDE);
  const pmfAway = poissonPmf(mu, MAX_GOALS_PER_SIDE);

  const size = (MAX_GOALS_PER_SIDE + 1) ** 2;
  const homeGoals = new Array<number>(size);
  const awayGoals = new Array<number>(size);
  const prob = new Array<number>(size);
  let total = 0;
  let i = 0;
  for (let x = 0; x <= MAX_GOALS_PER_SIDE; x += 1) {
    for (let y = 0; y <= MAX_GOALS_PER_SIDE; y += 1) {
      const weight = pmfHome[x] * pmfAway[y] * Math.max(0, dixonColesTau(x, y, lambda, mu, rho));
      homeGoals[i] = x;
      awayGoals[i] = y;
      prob[i] = weight;
      total += weight;
      i += 1;
    }
  }
  for (let k = 0; k < size; k += 1) prob[k] /= total;

  return { lambda, mu, homeGoals, awayGoals, prob };
};

/** The grid laid end to end as a cumulative table, so one RNG draw picks a
 *  scoreline. Built once per matchup and reused across every iteration. */
interface ScoreDistribution {
  cumulative: number[];
  homeGoals: number[];
  awayGoals: number[];
}

const buildScoreDistribution = (
  model: StrengthModel,
  homeCode: ClubCode,
  awayCode: ClubCode,
  rho: number,
): ScoreDistribution => {
  const { homeGoals, awayGoals, prob } = buildScoreGrid(model, homeCode, awayCode, rho);
  const cumulative = new Array<number>(prob.length);
  let running = 0;
  for (let k = 0; k < prob.length; k += 1) {
    running += prob[k];
    cumulative[k] = running;
  }
  cumulative[prob.length - 1] = 1; // absorb float drift, so no draw falls off the end
  return { cumulative, homeGoals, awayGoals };
};

/** A sampled scoreline. */
export interface SampledScore {
  homeGoals: number;
  awayGoals: number;
}

/**
 * Turns a fixture into a scoreline. Swapping the model — Elo, market odds — is
 * passing a different one of these, without touching the harness below.
 */
export type FixtureSampler = (match: Match, rng: Rng) => SampledScore;

/**
 * The default sampler: the Dixon–Coles model above — two independent Poissons with
 * the τ correction, not a bivariate Poisson — built from the current table, with
 * each matchup's distribution memoised. A pair meets twice
 * in a season and the two fixtures are different distributions, because the
 * mando is on opposite sides — so the key carries both codes in order.
 */
export const createPoissonSampler = (
  rows: StandingsRow[],
  matches: Match[],
  options: ModelOptions = {},
): FixtureSampler => {
  const rho = options.rho ?? DEFAULT_RHO;
  const model = buildStrengthModel(rows, matches, options.priorWeight ?? DEFAULT_PRIOR_WEIGHT);
  const cache = new Map<string, ScoreDistribution>();

  return (match, rng) => {
    const key = `${match.homeCode}|${match.awayCode}`;
    let dist = cache.get(key);
    if (!dist) {
      dist = buildScoreDistribution(model, match.homeCode, match.awayCode, rho);
      cache.set(key, dist);
    }
    // Binary search the cumulative table: 81 cells is seven steps rather than
    // forty, and this runs once per remaining fixture per iteration.
    const u = rng();
    const { cumulative, homeGoals, awayGoals } = dist;
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (u <= cumulative[mid]) hi = mid;
      else lo = mid + 1;
    }
    return { homeGoals: homeGoals[lo], awayGoals: awayGoals[lo] };
  };
};

// --- One fixture, closed form ----------------------------------------------------
// The same grid, summed instead of sampled. No RNG: this is exact, so the same
// snapshot gives the same prognosis to the last digit, and it costs one grid
// rather than ten thousand seasons.

export interface MatchOutcome {
  /** The three results, summing to 1. */
  homeWin: number;
  draw: number;
  awayWin: number;
  /**
   * Expected goals for each side, carried out because "espera-se 1,7 × 0,8"
   * says something a probability triple does not.
   *
   * **This is the mean of the grid, not λ**, and the difference is not
   * pedantry. λ and μ are the *parameters* the Poisson was built from; the grid
   * then truncates at eight goals a side, applies the Dixon–Coles τ and
   * renormalises, so the distribution the reader is actually being shown has a
   * different mean — and where the clamp bites, λ is not a mean of anything at
   * all. Measured on the frozen snapshot the gap is 0.0014, which is why
   * reporting λ looks correct; measured on a lopsided fixture it is 0.08, and
   * on a side pinned at `MIN_EXPECTED_GOALS` the reported number is the clamp
   * rather than the expectation. The sibling repo this model came from reports
   * λ. Summing the cells costs one pass over 81 numbers and cannot disagree
   * with the probabilities and the modal scoreline beside it, which come from
   * those same cells.
   */
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  /**
   * The single most likely scoreline, **with its own probability**, which is
   * the field to render beside it rather than drop.
   *
   * It is routinely under 12%: a football match has a long tail of scorelines
   * and the modal one is only the tallest of many short bars. Printing "placar
   * mais provável 1-1" with that number withheld reads as a prediction, and the
   * number is the whole of what makes it a *modal* value instead. Same rule the
   * artilharia follows for an unreported tally and `live-core.ts` for the match
   * minute: show the reader what the data actually supports.
   */
  mostLikelyScore: {
    homeGoals: number;
    awayGoals: number;
    probability: number;
  };
}

/**
 * The **Projeção** narrowed to a single fixture: win, draw and loss
 * probabilities, each side's expected goals, and the modal scoreline.
 *
 * Named for the season term rather than given one of its own, because it is
 * the same model at a different scope — and because `CONTEXT.md` rules out the
 * two words that would otherwise be reached for here. "Prognóstico" and
 * "previsão" both claim knowledge of the result; the sibling repo ships this
 * as a "Prognóstico simulado" and that qualifier is doing all the work.
 *
 * Deterministic and exact — it sums `buildScoreGrid`'s 81 cells rather than
 * sampling them, so there is no seed and no iteration count, and two calls on
 * one snapshot cannot differ. It is the *same grid* `projectSeason` samples, so
 * a match page and the Classificação cannot come to describe different models;
 * that is the entire reason this lives here rather than in a module of its own.
 *
 * Takes clubs and matches like `projectSeason`, and builds the strength model
 * per call. That is O(clubs + matches) and negligible beside the grid, and it
 * keeps the two entry points impossible to feed inconsistently — a caller
 * cannot hand this a model fitted to one payload while the table beside it was
 * fitted to another.
 *
 * **This is the model, not the sentence.** Turning an outcome into pt-BR prose
 * is a separate job for a separate module (the sibling repo keeps its narrator
 * in `predict-core.ts` for that reason), and the copy has to carry the
 * *simulado* framing that `CONTEXT.md`'s **Projeção** entry makes a condition of
 * showing any of this to a reader.
 */
export const predictMatchOutcome = (
  clubs: Club[],
  matches: Match[],
  homeCode: ClubCode,
  awayCode: ClubCode,
  options: ModelOptions = {},
): MatchOutcome => {
  const model = buildStrengthModel(
    computeStandings(clubs, matches),
    matches,
    options.priorWeight ?? DEFAULT_PRIOR_WEIGHT,
  );
  const grid = buildScoreGrid(model, homeCode, awayCode, options.rho ?? DEFAULT_RHO);

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let expectedHomeGoals = 0;
  let expectedAwayGoals = 0;
  let modal = 0;
  for (let i = 0; i < grid.prob.length; i += 1) {
    const share = grid.prob[i];
    if (grid.homeGoals[i] > grid.awayGoals[i]) homeWin += share;
    else if (grid.homeGoals[i] < grid.awayGoals[i]) awayWin += share;
    else draw += share;
    expectedHomeGoals += share * grid.homeGoals[i];
    expectedAwayGoals += share * grid.awayGoals[i];
    if (share > grid.prob[modal]) modal = i;
  }

  return {
    homeWin,
    draw,
    awayWin,
    expectedHomeGoals,
    expectedAwayGoals,
    mostLikelyScore: {
      homeGoals: grid.homeGoals[modal],
      awayGoals: grid.awayGoals[modal],
      probability: grid.prob[modal],
    },
  };
};

// --- The harness ----------------------------------------------------------------

export interface SeasonOdds {
  club: Club;
  /**
   * Probability of finishing in each position, index 0 = 1º. Always one entry
   * per club in the division, summing to 1.
   *
   * The three headline numbers below are all derived from this array rather
   * than tallied alongside it, for the reason `pointsPercentage` is derived
   * from points and played: two counts of the same thing can disagree, and one
   * cannot.
   */
  positionOdds: number[];
  /** Champion. */
  title: number;
  /** Inside the G4 — the Libertadores places. */
  g4: number;
  /** Inside the Z4 — the relegation zone, counted in from the bottom. */
  z4: number;
  averagePoints: number;
  averagePosition: number;
}

export interface SeasonProjection {
  /**
   * How many samples the answer actually rests on — the requested count,
   * clamped, except on a decided season where it is **1**. With no fixture left
   * to invent, every iteration recomputes the identical table, so one sample is
   * the whole distribution and ten thousand of it is ten thousand copies of one
   * answer. Reporting the request rather than the work would be a number nothing
   * was measured with, in the state this app sits in between seasons.
   */
  iterations: number;
  seed: number;
  /** Fixtures invented per iteration. Zero means the season is decided and
   *  every probability below is a 0 or a 1. */
  remaining: number;
  /** One entry per club, in the order the current Classificação puts them. */
  odds: SeasonOdds[];
}

export interface ProjectionOptions extends ModelOptions {
  iterations?: number;
  seed?: number;
  /** Override the model. Defaults to `createPoissonSampler`. */
  sampler?: FixtureSampler;
}

/**
 * 10,000 iterations. The standard error on a probability near ½ is then about
 * 0.5pp, which is under the rounding of any way this could be shown to a
 * reader — a projection printed to the whole percent should not move when the
 * iteration count does.
 */
const DEFAULT_ITERATIONS = 10_000;
const MIN_ITERATIONS = 200;
const MAX_ITERATIONS = 50_000;

/** Any constant would do; it is named so a caller can see the number it is
 *  reproducing rather than finding a bare literal in a diff. */
export const DEFAULT_SEED = 20_260_829;

/**
 * Run the projection.
 *
 * The loop allocates nothing. `working` holds one FINISHED clone of each
 * remaining fixture, created once, and each iteration overwrites its two score
 * fields in place — 380 objects for the whole run rather than 380 per
 * iteration. `computeStandings` only reads its arguments, so handing it the
 * same array 10,000 times is safe, and the clones mean the caller's `matches`
 * is never touched.
 */
export const projectSeason = (
  clubs: Club[],
  matches: Match[],
  options: ProjectionOptions = {},
): SeasonProjection => {
  const iterations = Math.round(
    clamp(options.iterations ?? DEFAULT_ITERATIONS, MIN_ITERATIONS, MAX_ITERATIONS),
  );
  const seed = options.seed ?? DEFAULT_SEED;

  const current = computeStandings(clubs, matches);
  const remaining = remainingFixtures(clubs, matches);
  const sampler = options.sampler ?? createPoissonSampler(current, matches, options);
  const rng = createRng(seed);

  const working: Match[] = remaining.map((match) => ({
    ...match,
    status: "FINISHED" as const,
    homeGoals: 0,
    awayGoals: 0,
  }));
  const played = matches.filter(countsTowardStandings);
  const simulated: Match[] = [...played, ...working];

  // See `SeasonProjection.iterations`: nothing to sample means one run is the
  // whole distribution. One code path either way — the loop simply runs once.
  const runs = remaining.length === 0 ? 1 : iterations;

  const total = clubs.length;
  const counts = new Map<ClubCode, number[]>(
    clubs.map((club) => [club.code, new Array<number>(total).fill(0)]),
  );
  const pointsTotal = new Map<ClubCode, number>(clubs.map((club) => [club.code, 0]));

  for (let n = 0; n < runs; n += 1) {
    for (let f = 0; f < working.length; f += 1) {
      const score = sampler(remaining[f], rng);
      working[f].homeGoals = score.homeGoals;
      working[f].awayGoals = score.awayGoals;
    }
    const table = computeStandings(clubs, simulated);
    for (const row of table) {
      const tally = counts.get(row.club.code);
      if (tally) tally[row.position - 1] += 1;
      pointsTotal.set(row.club.code, (pointsTotal.get(row.club.code) ?? 0) + row.points);
    }
  }

  const odds: SeasonOdds[] = current.map((row) => {
    const tally = counts.get(row.club.code) ?? new Array<number>(total).fill(0);
    const positionOdds = tally.map((count) => count / runs);

    let title = 0;
    let g4 = 0;
    let z4 = 0;
    let averagePosition = 0;
    for (let i = 0; i < positionOdds.length; i += 1) {
      const share = positionOdds[i];
      const position = i + 1;
      averagePosition += share * position;
      if (position === 1) title += share;
      if (position <= ZONE_DEPTH) g4 += share;
      if (position > total - ZONE_DEPTH) z4 += share;
    }

    return {
      club: row.club,
      positionOdds,
      title,
      g4,
      z4,
      averagePoints: (pointsTotal.get(row.club.code) ?? 0) / runs,
      averagePosition,
    };
  });

  return { iterations: runs, seed, remaining: remaining.length, odds };
};
