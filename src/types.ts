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
  /**
   * The head coach's name, as the provider spells it ("Filipe Luís").
   *
   * A bare string, like the four fields above, because nothing here looks the
   * coach up — the club page prints the name and stops. It carries no id for
   * the same reason `Player.club` carries no coach: an identifier nothing
   * dereferences is a field that has to be kept in step for no reader's
   * benefit.
   *
   * **Only the teams endpoint reports it.** Fixtures and standings carry a club
   * without one, which is why this is optional in the ordinary case rather than
   * only when a club is between coaches — see `/api/coaches` in `server.ts` for
   * where the club page gets it from.
   */
  coach?: string;
  /** Home state (e.g. "RJ"). Absent for clubs derived from a provider that
   *  doesn't carry it — render it conditionally. */
  state?: string;
  /**
   * The club's sede as one line ("Rua Álvaro Chaves 41, Bairro Laranjeiras Rio
   * de Janeiro, RJ 22231-220"), already cleaned by `clubAddress` — see there
   * for why the raw upstream string cannot be rendered as it arrives, and why
   * this is a line rather than parsed components. Absent for a club whose
   * provider does not carry one, and for one whose address is nothing but the
   * city; render it conditionally.
   */
  address?: string;
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

/**
 * A photograph of a player, from Wikimedia Commons.
 *
 * Deliberately the same shape as `StadiumPhoto`, and deliberately **not** the
 * same type: the two carry different `alt` conventions and are keyed by
 * different things, and folding them together would invite one page's rules
 * onto the other's data. What they do share is the part that is not negotiable
 * — `credit`, `license` and `licenseUrl` are **required** here as they are
 * there, because a player may have no photograph but may not have an
 * unattributed one.
 */
export interface PlayerPhoto {
  /** Commons file title, without the `File:` prefix. */
  file: string;
  /**
   * What the picture shows, in pt-BR. Written by hand after looking at the
   * image — never from the file name.
   *
   * The convention differs from a stadium's, where the heading already names
   * the ground. Here the card names the player beside the photo, so the alt
   * says what is *visible about this picture* rather than repeating the name:
   * which shirt, which era. Free photographs of footballers are usually years
   * old and taken at a previous club or on international duty, and a reader who
   * cannot see it is owed that rather than being left to assume it is current.
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

/**
 * A match official, as football-data reports one.
 *
 * `role` carries the **provider's own vocabulary** (`REFEREE`) rather than a
 * Portuguese label, exactly as `Player.position` carries the English word:
 * translation is a display concern and belongs at the edge, in
 * `refereeRoleLabel`.
 *
 * Neither the upstream `id` nor its `nationality` is kept. The id leads
 * nowhere — `/api/players/:id` answers about footballers, and an official is
 * not one — and the nationality is `Brazil` for 156 of the 157 entries the
 * division carries, so printing it would be the same word on every page. The
 * one exception is an upstream error rather than a fact worth surfacing: a
 * French official is recorded against Coritiba × Chapecoense.
 */
export interface Referee {
  name: string;
  role: string;
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
  /**
   * The officials, from the provider's `referees` array — the one field on this
   * interface that comes from **no local file at all**.
   *
   * That makes it **live-only**: `src/data/matches.ts` carries no officials, so
   * it is absent for every fixture the end-to-end suite sees, which boots with
   * `DISABLE_FOOTBALL_DATA=true`. Green e2e is therefore not evidence that this
   * renders; `tests/football-data-core.test.ts` covers the mapping against a
   * captured payload instead, which is what `CLAUDE.md` prescribes for a live
   * path.
   *
   * Absent rather than empty when upstream reports nobody, which it does for
   * 223 of the season's 380 fixtures — including finished ones, so this fills
   * in retroactively rather than at kickoff.
   */
  referees?: Referee[];
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
 * A correction to what the provider reports about one player, in
 * `src/data/player-overrides.ts`. Every field is optional and an absent one
 * means "upstream is right about this"; nothing here fills a gap, because an
 * absent value on `Player` is already rendered as an absence rather than a
 * blank.
 *
 * **The per-field rules are different, and they are the whole of the file's
 * discipline.** They live here rather than in the data file because this is
 * where a reader looks to find out what a field means.
 */
export interface PlayerOverride {
  /**
   * Where the recorded value is **not a name at all** — a placeholder, a
   * duplicated surname, a test string somebody typed into a database. Not a
   * place to prefer one spelling to another: the provider's nicknames and
   * single names are what every other football site shows the same reader, and
   * an ambiguous real name (three Guilhermes in one squad) stays as it is.
   */
  name?: string;
  /**
   * Where the recorded nationality is **factually wrong**, checked against a
   * source that states it — Wikidata `P27`, or the article's own infobox — and
   * joined to the player on exact date of birth, since a name match cannot tell
   * two people apart.
   *
   * In the **provider's** vocabulary ("Brazil"), never the pt-BR label:
   * `nationalityLabel` still translates, so a country reaches the page one way
   * rather than two. That also keeps the "every nationality in the snapshot is
   * mapped" test meaningful for corrected values.
   *
   * Absence of an article is not evidence of an error. Two base players in this
   * division carry surprising nationalities and have no article in any
   * language; they are unverified, and unverified stays untouched.
   */
  nationality?: string;
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

/**
 * What `/api/health` reports about the process answering.
 *
 * Deliberately **not** an `ApiEnvelope`: this describes the server, not the
 * championship, so there is no `source` to distinguish and nothing to degrade
 * to. Every field but `status` is optional because the endpoint genuinely
 * omits them — running from source there is no bundler to stamp a build time —
 * and because the client reading this may be a different build from the server
 * answering it. `health-core.ts` narrows the body; the **Rodapé** renders only
 * the fields that arrived.
 */
export interface Health {
  /** `"ok"` from every build so far. Anything else is shown verbatim. */
  status: string;
  /** The commit that was built, or `"dev"` when running from source. */
  sha: string | null;
  /** ISO instant the bundle was built. Absent under `tsx`. */
  builtAt: string | null;
  /** Seconds the process has been up. */
  uptime: number | null;
  /** The **configured** provider — `"football-data"` or `"seed"`. Not a claim
   *  that the last upstream request succeeded; that is the envelope's job. */
  provider: string | null;
}
