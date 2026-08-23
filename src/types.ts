/**
 * Single source of truth for shapes shared between the server and the client.
 * Extend here before adding fields to seed data or components.
 */

export type ClubCode = string;

export interface Club {
  /**
   * Stable unique key. For provider-derived clubs this is the upstream numeric
   * id as a string — NOT the three-letter abbreviation, which is not unique:
   * Corinthians and Coritiba both report `tla: "COR"`, so keying on it merges
   * two clubs into one row.
   */
  code: ClubCode;
  name: string;
  shortName: string;
  /** Three-letter abbreviation for badges/compact display. Not an identity. */
  tla?: string;
  /** Home state (e.g. "RJ"). Absent for clubs derived from a provider that
   *  doesn't carry it — render it conditionally. */
  state?: string;
}

/**
 * Postponed and cancelled are first-class here rather than folded into
 * SCHEDULED: Série A rounds get moved often enough that collapsing them would
 * misreport a round as still playable.
 */
export type MatchStatus =
  | "SCHEDULED"
  | "LIVE"
  | "FINISHED"
  | "POSTPONED"
  | "CANCELLED";

export interface Match {
  id: string;
  round: number;
  /** ISO-8601 kickoff instant, always UTC. */
  kickoff: string;
  status: MatchStatus;
  homeCode: ClubCode;
  awayCode: ClubCode;
  /** Null until the match has a score to report. */
  homeGoals: number | null;
  awayGoals: number | null;
}

export interface StandingsRow {
  position: number;
  club: Club;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

/**
 * Envelope every externally-backed endpoint returns. `source` names the
 * provider that actually answered, so a client can label degraded data instead
 * of silently presenting stale numbers as live ones.
 */
export interface ApiEnvelope<T> {
  /**
   * - `football-data` — live upstream data.
   * - `placeholder` — seed fixtures, because no provider token is configured.
   * - `fallback` — seed fixtures, because the upstream failed or is disabled.
   *
   * The last two are deliberately distinct: one is "not set up", the other is
   * "set up and currently broken", and only the second is worth alerting on.
   */
  source: "football-data" | "placeholder" | "fallback";
  note: string;
  updatedAt: string;
  data: T;
}
