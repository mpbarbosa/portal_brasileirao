/**
 * Single source of truth for shapes shared between the server and the client.
 * Extend here before adding fields to seed data or components.
 */

export type ClubCode = string;

export interface Club {
  /** Short uppercase code used as the stable key everywhere (e.g. "FLA"). */
  code: ClubCode;
  name: string;
  shortName: string;
  state: string;
}

export type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED";

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
  source: "placeholder" | "fallback";
  note: string;
  updatedAt: string;
  data: T;
}
