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
  /**
   * The club's hymn on YouTube, stored as the **video id alone** (11 chars).
   * The watch address is derived by `hymnUrl`, so a pasted link loses the
   * `&list=RD…&start_radio=1` radio parameters instead of persisting them.
   */
  hymn?: string;
  /**
   * The club's article on the Portuguese Wikipedia, stored as the **title
   * alone** ("Sociedade Esportiva Palmeiras"). The address is derived by
   * `wikipediaUrl`, so the edition is written once and a pasted link's
   * `?action=…` or `#História` does not persist.
   */
  wikipedia?: string;
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

/**
 * Facts about a stadium that no data provider carries and CBF's feed does not
 * either: the official name, how many it holds, when it opened, and where to
 * read more. Hand-maintained in `src/data/stadiums.ts`, keyed by the stadium's
 * slug, and every field beyond `name` is optional — the page renders what it
 * has rather than an empty row.
 */
/**
 * A photograph of a ground, hosted on Wikimedia Commons.
 *
 * Stored as the file's **title alone** — "ARENA MRV.jpg" — exactly as
 * `wikipedia` stores an article title, for the same reason: the address is one
 * function's business rather than nineteen copies of a CDN path. The bytes are
 * fetched from Commons at render time rather than committed, which is what
 * `Club.crest` already does with the provider's CDN.
 *
 * The last three fields are **not decoration**. Every licence Commons issues
 * except CC0 requires the photographer to be named wherever the picture is
 * shown, so a photo without its credit line is a photo we are not entitled to
 * publish. That is why `credit`, `license` and `licenseUrl` are required while
 * everything else about a stadium is optional: an image can be absent, but it
 * cannot be present and unattributed.
 *
 * `credit` is what Commons says to write, not who Commons says took it. Where a
 * file carries an explicit `Attribution` field the photographer has dictated a
 * form — "Arne Müseler / www.arne-mueseler.com" — and that form is the one with
 * legal force, so it is copied verbatim rather than reduced to a name.
 */
export interface StadiumPhoto {
  /** Commons file title, without the `File:` prefix. */
  file: string;
  /**
   * What the photograph shows, in pt-BR. Written by hand after looking at the
   * image, because this is the page's only content image and the heading above
   * it already says the stadium's name — an alt reading "Arena MRV" would tell
   * a screen-reader user nothing they had not just been told.
   */
  alt: string;
  /** The attribution line, verbatim from Commons. */
  credit: string;
  /** Licence short name, as Commons spells it: "CC BY-SA 4.0". */
  license: string;
  /** Where that licence is written down. */
  licenseUrl: string;
}

export interface StadiumFacts {
  /**
   * The name to display: the popular one a reader would say out loud, properly
   * cased. Deliberately *not* CBF's string, which is stored verbatim in
   * `venues.ts` and drifts (`ARENA MRV`), nor the official name below, which
   * almost nobody uses — "Estádio Jornalista Mário Filho" is the Maracanã.
   */
  name: string;
  /** The formal name, when it differs from `name` enough to be worth saying. */
  officialName?: string;
  /** Seated capacity for football, as reported by the source that was checked. */
  capacity?: number;
  /** Year of inauguration. Absent where the source does not state one. */
  opened?: number;
  /**
   * The stadium's article on the Portuguese Wikipedia, stored as the **title
   * alone**, exactly as `Club.wikipedia` is. The address is derived by
   * `wikipediaUrl`, which is shared rather than reimplemented.
   */
  wikipedia?: string;
  /** A photograph of the ground. Absent where none was found under a licence
   *  that allows republishing. */
  photo?: StadiumPhoto;
}

/**
 * A stadium as the app knows it: identity and location derived from the
 * fixtures played there, enriched by the curated facts above.
 *
 * `slug` is the identity, derived from CBF's venue string. It has to be, because
 * that string is all that ties a fixture to a stadium — there is no venue id
 * anywhere in the data.
 */
export interface Stadium {
  slug: string;
  name: string;
  city: string;
  state: string;
  officialName?: string;
  capacity?: number;
  opened?: number;
  wikipedia?: string;
  photo?: StadiumPhoto;
  /** Clubs that hosted a match here, most fixtures first. Usually one; the
   *  Maracanã has two, which is why this is a list and not a field. */
  homeClubs: Club[];
  /** How many fixtures in the loaded season name this stadium. */
  matchCount: number;
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
 * A club's place in the classificação after one round. `played` rides along
 * because a postponed fixture leaves a club a game short of its rivals, which
 * is the difference between "dropped four places" and "has a game in hand".
 */
export interface RankAtRound {
  round: number;
  position: number;
  points: number;
  played: number;
}

/**
 * One club's campanha: its position after every round played so far, oldest
 * first. `clubCode` is the identity; `shortName` rides along for display only,
 * exactly as `tla` does on `Club`.
 */
export interface ClubRankHistory {
  clubCode: ClubCode;
  shortName: string;
  entries: RankAtRound[];
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
 * One club's elenco: every player the provider lists for it.
 *
 * A squad is not addressable upstream on its own — it arrives embedded in the
 * competition's team list, which is why one request yields all twenty. The club
 * rides along whole rather than as a code, exactly as `Scorer` carries one: the
 * page renders crest and name straight from this and needs no second lookup.
 *
 * `players` may be **empty**. A club whose squad upstream has not filled in is
 * still a club in the championship, and dropping it would hide the club rather
 * than the gap.
 */
export interface Squad {
  club: Club;
  players: Player[];
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
