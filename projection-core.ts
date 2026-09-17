/**
 * **Projeção** on the Classificação — what `season-sim-core.ts` computes, cut
 * down to what the page reads and put into words.
 *
 * Its own module rather than more exports on `season-sim-core.ts`, because the
 * two run in different places: the simulation is **server-side**, and this is
 * what the client imports. `projectSeason` takes about 330ms for its 10,000
 * iterations over a full season (measured 2026-09-17 on this workstation,
 * against production's payload with 113 fixtures left) — main-thread time a
 * phone would spend two or three times over on every load. So the server runs
 * it once per state of the results and serves the answer, and the bundle
 * carries only the type import below, which the compiler erases.
 *
 * Pure: payload in, payload out, like every other `*-core` module.
 */
import type { SeasonProjection } from "@/season-sim-core";
import type { ClubCode, Match } from "@/src/types";

/** One club's three headline odds. Positions and average points stay on the
 *  server: nothing renders them, and a field nothing dereferences is upkeep. */
export interface ProjectedClub {
  code: ClubCode;
  title: number;
  g4: number;
  z4: number;
}

export interface ProjectionPayload {
  /** How many samples the answer rests on — `SeasonProjection.iterations`. */
  iterations: number;
  /** Fixtures still to be played. Zero means the season is decided. */
  remaining: number;
  /** Fixtures already counted. Zero means the model has read nothing but its prior. */
  played: number;
  /** In the order of the current Classificação. */
  clubs: ProjectedClub[];
}

export const toProjectionPayload = (projection: SeasonProjection, played: number): ProjectionPayload => ({
  iterations: projection.iterations,
  remaining: projection.remaining,
  played,
  clubs: projection.odds.map((odds) => ({
    code: odds.club.code,
    title: odds.title,
    g4: odds.g4,
    z4: odds.z4,
  })),
});

/**
 * What the projection depends on, as one string: every fixture's status and
 * score, and the clubs. The simulation is seeded, so two equal keys give equal
 * answers and the server may keep the last one for as long as the key holds.
 *
 * **Every field of every fixture, not only the finished ones.** A postponed or
 * re-scheduled fixture changes what is left to invent without changing a single
 * result, and a key built from results alone would serve the old answer.
 */
export const projectionKey = (clubCodes: readonly ClubCode[], matches: readonly Match[]): string =>
  `${clubCodes.join(",")}|${matches
    .map((match) => `${match.id}:${match.status}:${match.homeCode}:${match.awayCode}:${match.homeGoals}:${match.awayGoals}`)
    .join(";")}`;

/**
 * A probability as the page prints it: whole percent, and never a rounding that
 * claims certainty. `0.9996` is not "100%" — a club that can still miss the G4
 * has not reached it — and `0.004` is not "0%". Only a true 0 or 1, which the
 * simulation produces when no sample went the other way, prints as one.
 */
export const oddsLabel = (probability: number): string => {
  if (probability <= 0) return "0%";
  if (probability >= 1) return "100%";
  if (probability < 0.005) return "<1%";
  if (probability >= 0.995) return ">99%";
  return `${Math.round(probability * 100)}%`;
};

/** Below this a club is left off a board: it would print as "<1%". */
export const BOARD_FLOOR = 0.005;

export type ProjectionField = "title" | "g4" | "z4";

/**
 * The clubs worth naming for one of the three questions, most likely first.
 *
 * Ties keep the table's order — the payload's order — since `Array.prototype.sort`
 * is stable; that is what puts the club above in the Classificação first when two
 * clubs are both certain of the Z4.
 */
export const projectionBoard = (clubs: readonly ProjectedClub[], field: ProjectionField): ProjectedClub[] =>
  clubs.filter((club) => club[field] >= BOARD_FLOOR).sort((a, b) => b[field] - a[field]);

/** Whether there is anything to project: something played, something left. */
export const hasProjection = (payload: ProjectionPayload): boolean =>
  payload.played > 0 && payload.remaining > 0;
