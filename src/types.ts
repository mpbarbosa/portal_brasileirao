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

/**
 * Current conditions at a ground, from Open-Meteo. Everything but the
 * temperature and the description is optional, because the payload is somebody
 * else's and `parseWeather` narrows it field by field rather than trusting a
 * shape.
 */
export type WeatherKind = "clear" | "cloudy" | "rain" | "storm" | "snow" | "fog";

export interface WeatherSnapshot {
  /** Degrees Celsius. The one field without which there is no card. */
  temperature: number;
  /** Sensação térmica, where reported. */
  feelsLike?: number;
  /** Relative humidity, percent. */
  humidity?: number;
  /** Wind speed in km/h. */
  windSpeed?: number;
  /** pt-BR description of the sky, e.g. "Pancadas de chuva". */
  label: string;
  /** Which of the six skies to draw. A category rather than a character: the
   *  app draws its marks as SVG in `currentColor`, and `☀` is
   *  emoji-presentation on several platforms. */
  kind: WeatherKind;
  /** Daylight at the ground when the reading was taken. Changes the mark for a
   *  clear sky and nothing else — the word is true either way. */
  day: boolean;
  /** ISO-8601 instant the reading was taken, so the page can say how old it is
   *  rather than implying it is live. */
  readAt: string;
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
  /**
   * Where the ground is, as `[latitude, longitude]` in decimal degrees.
   *
   * From Wikidata's `P625`, joined on the `wikipedia` title above — the same
   * article the capacity and inauguration were read out of, so the whole file
   * still rests on one source. A tuple rather than `{ lat, lng }` because the
   * order is the universal one and two named fields invite a call site that
   * swaps them silently.
   *
   * It exists for the **clima no estádio**: Open-Meteo answers for a point, and
   * no provider this app reaches carries a venue coordinate at any tier. Absent
   * where none was verified, in which case the page simply says nothing about
   * the weather — the same rule `opened` follows.
   */
  coordinates?: readonly [number, number];
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

/**
 * One goal, and who scored it.
 *
 * **No football-data tier this app can reach carries goal events.** Verified
 * twice: a BSA match object and a Premier League one — both TIER_ONE, both free
 * — return `area, competition, season, id, utcDate, status, venue, matchday,
 * stage, group, lastUpdated, homeTeam, awayTeam, score, odds, referees` and no
 * `goals` key at all. Not an empty array; absent. So this is the same kind of
 * field as `broadcasters` and `venue`: merged in from a local file that a
 * workstation script writes, never fetched by the running app.
 *
 * The source is CBF's own match endpoint, `/api/cbf/jogos/{id_jogo}`, whose
 * `registros` array carries goals and cards together — see
 * `docs/data-sources.md`.
 */
/**
 * One player on a team sheet for one match.
 *
 * `shirt` is a string because it is an identifier printed on a back, not a
 * quantity: CBF sends `"1"`, and a club may field `"07"`. `escalacao-core.ts`
 * sorts numerically anyway, so the display form survives without the sort
 * putting 10 before 9.
 *
 * `keeper` and `starter` are present-or-absent rather than `false`, the rule
 * `Goal.kind` follows: on a 23-man sheet twelve `starter: false` entries is the
 * word "false" twelve times to say nothing.
 */
export interface LineupPlayer {
  name: string;
  shirt: string;
  keeper?: true;
  starter?: true;
}

/**
 * One substitution, ready to print.
 *
 * Names rather than shirts, because the shirt is how the two sources were
 * *joined* and not what a reader wants: the súmula truncates a long name to
 * `"82 - Riquelme Avellar da Silva Fo..."`, so the number is the only complete
 * thing in that table, and the escalação beside it is what turns it back into a
 * person.
 *
 * `minute` is a rendered label — `"70'"`, `"45+2'"`, `"Intervalo"` — for the
 * reason `Goal.minute` is one: CBF's clock conventions, including that a
 * half-time substitution has no minute at all, belong in `sumula-core.ts` and
 * nowhere else.
 */
export interface Substitution {
  on: string;
  off: string;
  minute: string;
}

/** One club's escalação for one match. */
export interface Lineup {
  clubCode: ClubCode;
  players: LineupPlayer[];
  /**
   * The substitutions this club made, in the order the súmula lists them.
   *
   * Absent where the súmula was not read — a match synced before CBF published
   * it, or one whose table did not reconcile against the match API's own count.
   * Absent is never "made none": a club that used no substitutes is vanishingly
   * rare and would still be an empty list, which is why the sync writes nothing
   * rather than an empty array it cannot tell apart.
   */
  subs?: Substitution[];
}

export interface Goal {
  /**
   * The club the goal **counts for**, as one of our codes.
   *
   * Deliberately not "the scorer's club", and the difference is the whole of
   * why `sync-goals.ts` reconciles every match against its own scoreline: an
   * own goal is the one case where those two clubs differ, and attributing it
   * to the scorer would put a goal on the wrong side of the scoreboard while
   * still looking perfectly plausible.
   */
  clubCode: ClubCode;
  /**
   * The scorer, as CBF's short name for them ("Vitor Roque", "Lopez").
   *
   * CBF's casing drifts — some entries arrive fully capitalised — so a name
   * that is entirely uppercase is title-cased on the way in, the same
   * normalisation `channelsOf` performs on "sportv". Accents that CBF simply
   * omits are **not** restored, because that would be guessing at a name rather
   * than fixing a casing convention.
   */
  scorer: string;
  /**
   * What kind of goal, where it is worth saying. Absent for an ordinary one —
   * the common case, and annotating it "normal" would put a word on nearly
   * every row to distinguish nothing.
   */
  kind?: GoalKind;
  /**
   * When it was scored, ready to print: `"12'"`, `"48'"`, `"45+1'"`.
   *
   * **A rendered label rather than a period and a number, and that is a
   * boundary decision rather than a shortcut.** The alternative is carrying
   * `period`, `minute` and `added` and re-deriving the label at the point of
   * render — which would put CBF's clock conventions, including that the second
   * half restarts at `00:00` and that stoppage counts on from 45, into the app.
   * They belong in `sumula-core.ts`, which is the adapter that measured them,
   * and nowhere else. `scorer` is a normalised display string for the same
   * reason.
   *
   * **Absent for most goals, and that is the honest state rather than a gap.**
   * The minute comes from the súmula, which CBF publishes after the fact and
   * separately from the match API — so a goal recorded before its súmula
   * existed simply has no minute, and a re-sync fills it in. Nothing renders a
   * placeholder: the same rule `Club.coach` follows for a club between
   * managers.
   */
  minute?: string;
}

/**
 * The qualifiers worth printing beside a scorer.
 *
 * These are CBF's four `resultado` codes less the ordinary one, and the mapping
 * is **read off CBF's own súmula** rather than inferred — every match report
 * prints its legend at the foot of the Gols table:
 *
 *     NR = Normal | PN = Pênalti | CT = Contra | FT = Falta
 *
 * `own` is the load-bearing one, and not merely because of how the row reads:
 * **it changes which club the goal counts for.** CBF files an own goal under
 * the club of the player who scored it, so the goal counts for the *other*
 * side — see `goalsFromRegistros`, which is where the flip happens.
 */
export type GoalKind = "penalty" | "own" | "freekick";

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
   * The goals, and who scored them, merged from `src/data/goals.ts`.
   *
   * Absent means "not synced", never "goalless" — a 0-0 and a match nobody has
   * run the sync for are both an empty list here, so the page reads the
   * scoreline to tell them apart rather than inferring from this.
   */
  goals?: Goal[];
  /**
   * The escalações, merged from `src/data/escalacoes.ts` — both sides or
   * neither, because `lineupsReconcile` refuses a match that does not carry two
   * complete team sheets.
   *
   * Absent means "not synced", exactly as it does for `goals` above, and for the
   * same reason: a fixture nobody has run the sync for and a fixture CBF has not
   * published a sheet for are the same absence here.
   */
  lineups?: Lineup[];
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
  /**
   * When the provider last touched *this record*, verbatim from football-data.
   *
   * It exists because upstream regresses individual records: the same URL, four
   * minutes apart, served fixture 554986 as FINISHED 1-1 stamped
   * `2026-08-30T23:37:19Z` and then as TIMED with no score stamped
   * `2026-08-30T10:20:34Z`, while a different fixture in the very same pair of
   * responses moved *forward*. `mergeByFreshness` is what reads it, and this
   * stamp is the only honest way to tell those two apart — status ordering
   * would be a guess about what upstream meant, where this is what upstream
   * said.
   *
   * Live-only, like `referees` directly above: `sync-seed-data` writes an
   * explicit field list, so the frozen snapshot carries none of these and the
   * end-to-end suite never sees one. Absent means the provider claimed nothing,
   * which loses every comparison rather than winning by default.
   */
  lastUpdated?: string;
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
  /**
   * Where the recorded position puts the player on the **wrong line** — the
   * groupings `lineOf` reads, not a difference of shading within one. A
   * volante reported as `Defence` renders among the Defensores, which is a
   * claim about what he does rather than a nuance of it.
   *
   * **The bar is two sources agreeing, because a position is arguable where a
   * placeholder name is not.** An entry needs the club's own squad section
   * *and* an article's stated role to say the same thing, joined on exact date
   * of birth. Where they disagree, or where the article hedges, the provider's
   * value stands: Jesse Lingard's article says "meio-campista ou atacante"
   * against a club listing of atacantes, so he is left alone. This file
   * corrects what is wrong, never what is debatable — and that sentence is the
   * whole of what keeps it from becoming a matter of taste.
   *
   * In the **provider's** vocabulary (`Defensive Midfield`, `Left Winger`), so
   * `lineOf` places it and `positionLabel` captions it exactly as an uncorrected
   * value. Prefer the specific role where a source states one: `positionLabel`
   * then earns a caption the broad word would not have.
   */
  position?: string;
  /**
   * Where the recorded **date of birth** is factually wrong.
   *
   * ISO `YYYY-MM-DD`, the provider's own spelling, so `ageOn` and
   * `birthDateLabel` read it exactly as they read an uncorrected one. It is
   * doubly visible: the card prints both **Idade** and **Nascimento** from this
   * field, so a wrong value is wrong twice.
   *
   * **This is the one field whose evidence cannot be the usual join, and that
   * is the thing to understand before adding an entry.** Every other correction
   * here is trusted because it was joined to the player on exact date of birth
   * — which is unavailable precisely when the date is what is wrong. So the
   * bar is different in kind rather than merely higher: **the article must be
   * established as this player by something other than the date** (the club and
   * role it names, matching the row), and **several independent sources must
   * agree against the provider**. Wikidata's `P569`, and the article in more
   * than one language, are what settled the two entries here; a single
   * disagreeing article is not evidence, because pt.wikipedia was itself the
   * outlier three times in the same sweep.
   *
   * Both directions were found in one pass, so neither side is presumed right:
   * the provider is wrong for the two players recorded here, and pt.wikipedia
   * is wrong for three others who are therefore *not* recorded anywhere.
   */
  dateOfBirth?: string;
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
   * - `open-meteo` — live weather. A **second upstream**, named separately
   *   because it fails independently: the weather being unreachable says
   *   nothing about the scores, and one banner covering both would claim
   *   otherwise.
   * - `placeholder` — seed fixtures, because no provider token is configured.
   * - `fallback` — seed fixtures, because the upstream failed or is disabled.
   *
   * The last two are deliberately distinct: one is "not set up", the other is
   * "set up and currently broken", and only the second is worth alerting on.
   */
  source: "football-data" | "open-meteo" | "placeholder" | "fallback";
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
