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
  /**
   * URL-safe name for readable addresses (`/clube/flamengo`). Derived, not
   * upstream — absent when the name yields nothing usable, in which case the
   * URL falls back to `code`.
   */
  slug?: string;
  /** Crest image URL, hosted by the data provider. Transparent PNG. */
  crest?: string;
  /**
   * Instagram handle, without the `@` and without the profile URL around it.
   * The address is derived by `instagramUrl`, so it is written once.
   */
  instagram?: string;
  /** The club's official site, normalised to an HTTPS origin. */
  website?: string;
  /** Home state (e.g. "RJ"). Absent for clubs derived from a provider that
   *  doesn't carry it — render it conditionally. */
  state?: string;
}

/**
 * Postponed and cancelled are first-class here rather than folded into
 * SCHEDULED: Série A rounds get moved often enough that collapsing them would
 * misreport a round as still playable.
 */
/** A highlights package, and the channel that published it. */
export interface Highlight {
  url: string;
  /** Publisher, shown as the link's label — "ge tv", "CazéTV". */
  channel: string;
}

/** Where a match is played. Not from the data provider — merged from the CBF
 *  sync, which reports it as "Stadium - City - UF". */
export interface Venue {
  stadium: string;
  city: string;
  /** Two-letter state code, e.g. "RJ". */
  state: string;
}

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
  /**
   * Where to watch. Not from the data provider — none of them carry it — but
   * merged in from `src/data/broadcasts.ts`. Absent means unknown, which is the
   * common case.
   */
  broadcasters?: string[];
  /** Where it is played. Merged from `src/data/venues.ts`; also absent for most. */
  venue?: Venue;
  /**
   * Links to the match's highlights, merged from `src/data/highlights.ts`.
   * Several broadcasters publish their own package for the same match, so this
   * is a list. Absent for nearly every match, in which case the page offers a
   * search instead.
   */
  highlights?: Highlight[];
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
 * A player, as much as the provider knows. Every field beyond id and name is
 * optional: squad listings, the person endpoint and the scorer table each carry
 * a different subset, and the card renders whatever it has.
 */
export interface Player {
  id: string;
  name: string;
  shirtNumber?: number;
  /** Raw upstream position, in English — translate with `positionLabel`. */
  position?: string;
  nationality?: string;
  /** ISO date, used to derive an age. */
  dateOfBirth?: string;
  club?: Club;
}

/**
 * A row of the top-scorer table (artilharia).
 *
 * `assists` and `penalties` are nullable because the upstream reports them
 * inconsistently — most entries carry no penalty count at all. Null means "not
 * reported", which is not the same as zero, and the UI must not render it as 0.
 */
export interface Scorer {
  /** Rank in the list, 1-based. */
  position: number;
  playerId: string;
  playerName: string;
  club: Club;
  goals: number;
  assists: number | null;
  penalties: number | null;
  playedMatches: number | null;
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
