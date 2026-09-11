/**
 * Pure football-data.org (v4) adapter: URL building and response mapping, with
 * no network calls — `server.ts` performs the fetches and passes payloads in,
 * so every shape below is unit-testable without mocking HTTP.
 *
 * Campeonato Brasileiro Série A is competition code `BSA` (id 2013), which sits
 * on football-data's free TIER_ONE plan. Série B/C/D and the Copa do Brasil do
 * not — switching `competition` to those needs a paid token.
 *
 * Upstream docs: https://www.football-data.org/documentation/quickstart
 */
import { slugify } from "@/slug-core";
import { isFiniteNumber } from "@/narrow-core";
import type {
  Club,
  Match,
  MatchStatus,
  Player,
  Referee,
  Scorer,
  Squad,
  StandingsRow,
} from "@/src/types";

export const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";
export const BSA_COMPETITION = "BSA";

/** football-data authenticates with a bare token header, not a bearer scheme. */
export const authHeaders = (token: string): Record<string, string> => ({
  "X-Auth-Token": token,
});

export const standingsUrl = (competition: string = BSA_COMPETITION): string =>
  `${FOOTBALL_DATA_BASE}/competitions/${competition}/standings`;

export const matchesUrl = (competition: string = BSA_COMPETITION): string =>
  `${FOOTBALL_DATA_BASE}/competitions/${competition}/matches`;

/**
 * Every club in the competition, each with its `squad` embedded.
 *
 * One request for all twenty elencos, which is the only reason the Jogadores
 * page is affordable on a 10 req/minute budget — the per-team endpoint would be
 * twenty. The seed generator already calls this URL for club addresses and
 * websites, so the snapshot costs nothing extra either.
 */
export const teamsUrl = (competition: string = BSA_COMPETITION): string =>
  `${FOOTBALL_DATA_BASE}/competitions/${competition}/teams`;

/** A single person. One request each, so callers must cache. */
export const personUrl = (id: string): string =>
  `${FOOTBALL_DATA_BASE}/persons/${encodeURIComponent(id)}`;

/**
 * Whether a string could be a person id this provider issued: digits only.
 *
 * Checked before `personUrl` is built rather than left for upstream to refuse,
 * because a request that can only answer 404 still spends one of the ten a
 * minute — and `/api/players/:id` takes the id straight from a URL anybody can
 * type.
 */
export const isPersonId = (id: string): boolean => /^\d+$/.test(id);

/**
 * A request the provider answered with something other than a 2xx, keeping the
 * status — which is the whole difference between "the provider is failing" and
 * "the provider told us this does not exist".
 */
export class ProviderStatusError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`${url} respondeu ${status}`);
    this.name = "ProviderStatusError";
  }
}

/**
 * Whether a failed request was really an answer: a **404**, which football-data
 * sends for an id nobody issued — measured 2026-09-11, `/v4/persons/99999999`
 * answered `{"message":"The resource you are looking for does not exist.",
 * "error":404}`. Only 404. A 403 is a tier this token cannot reach and a 429 is
 * the budget: both are the provider declining to answer, never answering no, and
 * counting either as an absence would cache a lie for an hour.
 */
export const isNoSuchResource = (cause: unknown): boolean =>
  cause instanceof ProviderStatusError && cause.status === 404;

/** Upstream defaults to 10 scorers; the table shows more than that. */
export const SCORERS_LIMIT = 20;

export const scorersUrl = (
  competition: string = BSA_COMPETITION,
  limit: number = SCORERS_LIMIT,
): string => `${FOOTBALL_DATA_BASE}/competitions/${competition}/scorers?limit=${limit}`;

/* Upstream shapes, narrowed to the fields this app reads. */

/**
 * The head coach, as a team object reports one.
 *
 * `name` is the whole name and is what upstream fills in; `firstName` and
 * `lastName` are the split form, and `lastName` is frequently null for a
 * Brazilian coach known by one name. All three are read, because a coach whose
 * split fields are populated and whose `name` is not would otherwise vanish —
 * and a club between coaches reports no `coach` at all, which is an absence and
 * not an error.
 */
interface RawCoach {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

interface RawTeam {
  id?: number;
  name?: string;
  shortName?: string;
  tla?: string | null;
  crest?: string | null;
  /**
   * **Only the teams endpoint carries this.** The team objects embedded in
   * fixtures, standings and scorer rows are the same shape minus the coach and
   * the squad, so `clubFromTeam` reads it where it exists and omits it where it
   * does not, rather than there being two mappers.
   */
  coach?: RawCoach | null;
}

/**
 * One official on a match object.
 *
 * `type` is the provider's role vocabulary. Its documented breadth is wider
 * than what the free tier sends: across BSA, PL and CL — 356 entries over 949
 * fixtures — **every single one is `REFEREE`**, and no assistant, fourth
 * official or VAR appears anywhere. `refereeRoleLabel` therefore maps that one
 * value and lets the rest through verbatim, rather than translating a
 * vocabulary nobody has seen.
 */
interface RawReferee {
  id?: number;
  name?: string | null;
  type?: string | null;
  nationality?: string | null;
}

interface RawMatch {
  id?: number;
  utcDate?: string;
  status?: string;
  matchday?: number | null;
  homeTeam?: RawTeam;
  awayTeam?: RawTeam;
  /** v4 reports `fullTime.home` / `fullTime.away` — verified against a live
   *  payload. Note `0` is a real score; only `null` means unplayed. */
  score?: { fullTime?: { home?: number | null; away?: number | null } };
  /** Empty for 223 of the season's 380 fixtures, finished ones included. */
  referees?: RawReferee[];
  /** When upstream last touched this record. Present on every fixture in a
   *  live payload, and the only field that can order two disagreeing copies
   *  of one — see `mergeByFreshness`. */
  lastUpdated?: string;
}

interface RawTableEntry {
  position?: number;
  team?: RawTeam;
  playedGames?: number;
  won?: number;
  draw?: number;
  lost?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifference?: number;
  points?: number;
}

interface RawStanding {
  type?: string;
  table?: RawTableEntry[];
}

export interface StandingsResponse {
  standings?: RawStanding[];
}

export interface MatchesResponse {
  matches?: RawMatch[];
}

interface RawScorer {
  player?: { id?: number; name?: string };
  team?: RawTeam;
  goals?: number | null;
  assists?: number | null;
  penalties?: number | null;
  playedMatches?: number | null;
}

export interface ScorersResponse {
  scorers?: RawScorer[];
}

/**
 * A squad member as the competition's team list reports one.
 *
 * Note what is **absent**: `shirtNumber` is not in this payload for any player
 * in the division, and neither is `currentTeam` — the club is the team the
 * entry is nested under. The person endpoint carries both, which is what the
 * player card fills in when one is opened.
 */
interface RawSquadMember {
  id?: number;
  name?: string;
  position?: string | null;
  nationality?: string | null;
  dateOfBirth?: string | null;
}

interface RawTeamWithSquad extends RawTeam {
  squad?: RawSquadMember[];
}

export interface TeamsResponse {
  teams?: RawTeamWithSquad[];
}

/**
 * football-data's status vocabulary is wider than the app's. TIMED (kickoff
 * time confirmed) and SCHEDULED (date only) are the same thing to a reader, and
 * PAUSED is half-time — still a live match. EXTRA_TIME and PENALTY_SHOOTOUT are
 * live too: a match being decided is a match being played.
 *
 * **Every status the v4 lookup table documents is mapped** — eleven, read off
 * `docs.football-data.org/general/v4/lookup_tables.html` on 2026-09-11 — and
 * `tests/football-data-core.test.ts` pins that list. The two extra-time statuses
 * were missing for as long as this adapter has existed, and nothing noticed
 * because a league never produces them; a cup would, the day one is read.
 * `LIVE` is not in that table (it is a query filter) and stays mapped regardless.
 */
const STATUS_MAP: Record<string, MatchStatus> = {
  SCHEDULED: "SCHEDULED",
  TIMED: "SCHEDULED",
  LIVE: "LIVE",
  IN_PLAY: "LIVE",
  PAUSED: "LIVE",
  EXTRA_TIME: "LIVE",
  PENALTY_SHOOTOUT: "LIVE",
  FINISHED: "FINISHED",
  AWARDED: "FINISHED",
  POSTPONED: "POSTPONED",
  SUSPENDED: "POSTPONED",
  CANCELLED: "CANCELLED",
};

/** Whether football-data's status is one this adapter maps, rather than one it falls back on. */
export const isKnownStatus = (raw: string | undefined): boolean =>
  raw !== undefined && Object.hasOwn(STATUS_MAP, raw);

/**
 * The app's status for football-data's, degrading an unknown one to SCHEDULED.
 *
 * **SCHEDULED rather than dropping the fixture, and that direction was chosen
 * for its cost.** A dropped fixture is a hole in every list it belonged to — the
 * round, the club's season, the stadium — with nothing to say why. Filed as
 * SCHEDULED it still renders where it belongs, and the worst reading is "A
 * realizar" beside a match that has moved on, which a reader can see is stale.
 *
 * **The fallback is not harmless for a match in progress, which is why the
 * documented vocabulary is mapped in full rather than left to it.**
 * `withPlayedStatus` repairs a SCHEDULED record carrying a score for a kickoff
 * already past into FINISHED, so an unmapped status on a match being played,
 * partial score and all, would be counted as a result by the offline table.
 *
 * `Object.hasOwn`, not a bare index: `STATUS_MAP["constructor"]` is `Object`'s
 * constructor, truthy, and was returned as the status.
 */
export const mapStatus = (raw: string | undefined): MatchStatus =>
  isKnownStatus(raw) ? STATUS_MAP[raw as string] : "SCHEDULED";

/**
 * Upstream `shortName` is sometimes not what a Brazilian reader calls the club
 * ("Mineiro" for Atlético-MG). Display-only corrections keyed by the stable
 * upstream id. Applied here rather than in the seed generator so the live and
 * fallback paths show the same names.
 */
export const DISPLAY_NAME_OVERRIDES: Record<number, string> = {
  1766: "Atlético-MG", // upstream: "Mineiro"
  1768: "Athletico-PR", // upstream: "Paranaense"
};

/**
 * The head coach's name, from whichever field upstream filled in.
 *
 * Prefers the whole name and falls back to joining the split fields, which is
 * what makes a coach with `name: null` and a populated `firstName` render
 * rather than disappear. Returns undefined for a club upstream lists no coach
 * for — an absence the page shows by saying nothing, never by printing a dash.
 */
export const coachName = (raw: RawCoach | null | undefined): string | undefined => {
  const whole = raw?.name?.trim();
  if (whole) return whole;

  const parts = [raw?.firstName, raw?.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return parts.length ? parts.join(" ") : undefined;
};

/**
 * Identity comes from the upstream numeric id, never from `tla`. The
 * abbreviation is not unique — Corinthians and Coritiba both report "COR" —
 * so keying on it silently merges two clubs' rows. `tla` is carried along for
 * display only. Falls back to the abbreviation only when there is no id.
 */
export const clubFromTeam = (team: RawTeam | undefined): Club | null => {
  if (!team || !team.name) return null;

  const tla = team.tla?.trim() || undefined;
  const code = isFiniteNumber(team.id) ? String(team.id) : tla;
  if (!code) return null;

  const shortName =
    (isFiniteNumber(team.id) ? DISPLAY_NAME_OVERRIDES[team.id] : undefined) ??
    team.shortName?.trim() ??
    team.name;

  const slug = slugify(shortName) || undefined;
  const crest = team.crest?.trim() || undefined;
  const coach = coachName(team.coach);

  // Conditional so an absent crest means the key is missing, not present-and-
  // undefined — otherwise `"crest" in club` lies. The coach follows the same
  // rule, and is absent from every payload but the teams list.
  return {
    code,
    name: team.name,
    shortName,
    tla,
    slug,
    ...(crest ? { crest } : {}),
    ...(coach ? { coach } : {}),
  };
};

/**
 * A fixture missing an id, a kickoff, or either club is dropped rather than
 * rendered half-built — one bad row upstream should not break the round.
 */
/**
 * The officials of a match, keeping the provider's role vocabulary intact.
 *
 * An entry with no name is dropped rather than rendered as an anonymous role —
 * a page reading "Árbitro" with nothing beside it is worse than one that says
 * nothing. The role, in contrast, may be missing and the entry still stands: a
 * named official is the fact worth having, and `refereeRoleLabel` has a heading
 * for the roleless case.
 */
export const mapReferees = (raw: RawReferee[] | undefined): Referee[] =>
  (raw ?? [])
    .map((entry) => ({ name: entry.name?.trim() ?? "", role: entry.type?.trim() ?? "" }))
    .filter((entry) => entry.name !== "");

export const mapMatch = (raw: RawMatch): Match | null => {
  const home = clubFromTeam(raw.homeTeam);
  const away = clubFromTeam(raw.awayTeam);
  if (!isFiniteNumber(raw.id) || !raw.utcDate || !home || !away) return null;

  const fullTime = raw.score?.fullTime;
  const referees = mapReferees(raw.referees);

  return {
    id: String(raw.id),
    round: isFiniteNumber(raw.matchday) ? raw.matchday : 0,
    kickoff: raw.utcDate,
    status: mapStatus(raw.status),
    homeCode: home.code,
    awayCode: away.code,
    homeGoals: isFiniteNumber(fullTime?.home) ? fullTime.home : null,
    awayGoals: isFiniteNumber(fullTime?.away) ? fullTime.away : null,
    // Conditional for the reason `crest` is, one mapper up: upstream reports an
    // empty array for most fixtures, and a present-but-empty key would make
    // `"referees" in match` lie about what the provider actually said.
    ...(referees.length ? { referees } : {}),
    // Same rule, and load-bearing here rather than merely tidy: an absent stamp
    // has to stay absent so `mergeByFreshness` can tell "upstream claimed
    // nothing" from "upstream claimed the epoch".
    ...(typeof raw.lastUpdated === "string" && raw.lastUpdated
      ? { lastUpdated: raw.lastUpdated }
      : {}),
  };
};

export const mapMatches = (payload: MatchesResponse): Match[] =>
  (payload.matches ?? []).map(mapMatch).filter((match): match is Match => match !== null);

/**
 * The fixture list, refusing a response that carries none.
 *
 * A 2xx with no fixtures is a failed response, not a season without any, and
 * treating it as data costs everything at once: `mergeByFreshness` lets the
 * incoming list decide which fixtures exist, so an empty one wipes the held
 * memory; `rememberMatches` persists the wipe, which switches the regression
 * guard off for the next fill as well; and the empty payload is cached as
 * live. Measured on production 2026-09-11 around 00:12Z — one TTL of
 * `/api/matches` and `/api/clubs` serving zero under `source: "football-data"`,
 * with upstream answering 380 moments later.
 *
 * Throwing sends the fill down the ordinary failure path: the breaker counts
 * it, the reader gets the fallback envelope, and the memory is untouched. A
 * body with no `matches` key and one whose every record fails `mapMatch` are
 * refused alike, because neither can be told apart from an outage — which is
 * also why a season genuinely listing none reads as `fallback` rather than as
 * an empty season.
 *
 * It refuses NOTHING short of empty. A truncated list still drops the fixtures
 * it omits; no threshold for "too short" has been measured, and a guessed one
 * would refuse real answers.
 */
export const requireFixtures = (payload: MatchesResponse): Match[] => {
  const matches = mapMatches(payload);
  if (matches.length === 0) {
    throw new Error("football-data respondeu sem nenhuma partida");
  }
  return matches;
};

/** Every distinct club appearing in a fixture list, so the UI can resolve names
 *  from the payload instead of depending on the local seed. */
export const clubsFromMatches = (payload: MatchesResponse): Club[] => {
  const byCode = new Map<string, Club>();

  for (const raw of payload.matches ?? []) {
    for (const club of [clubFromTeam(raw.homeTeam), clubFromTeam(raw.awayTeam)]) {
      if (club && !byCode.has(club.code)) byCode.set(club.code, club);
    }
  }

  return [...byCode.values()].sort((a, b) => a.shortName.localeCompare(b.shortName, "pt-BR"));
};

const tableEntryToRow = (entry: RawTableEntry, index: number): StandingsRow | null => {
  const club = clubFromTeam(entry.team);
  if (!club) return null;

  const goalsFor = isFiniteNumber(entry.goalsFor) ? entry.goalsFor : 0;
  const goalsAgainst = isFiniteNumber(entry.goalsAgainst) ? entry.goalsAgainst : 0;

  return {
    // Trust the upstream position when present — it already encodes the
    // tie-breakers the provider applied, including ones this app can't compute.
    position: isFiniteNumber(entry.position) ? entry.position : index + 1,
    club,
    played: isFiniteNumber(entry.playedGames) ? entry.playedGames : 0,
    wins: isFiniteNumber(entry.won) ? entry.won : 0,
    draws: isFiniteNumber(entry.draw) ? entry.draw : 0,
    losses: isFiniteNumber(entry.lost) ? entry.lost : 0,
    goalsFor,
    goalsAgainst,
    goalDifference: isFiniteNumber(entry.goalDifference)
      ? entry.goalDifference
      : goalsFor - goalsAgainst,
    points: isFiniteNumber(entry.points) ? entry.points : 0,
  };
};

/**
 * Read the overall table. football-data returns TOTAL/HOME/AWAY splits in one
 * response; only TOTAL is the championship table, and **nothing else stands in
 * for it**.
 *
 * It used to fall back to the first group when none was typed TOTAL. That is a
 * plausible lie in exactly the shape this page can least afford: a HOME split is
 * twenty well-formed rows in position order, so it would have been served as the
 * Classificação under `source: "football-data"`, and `requireStandings` would
 * have passed it for having rows. The fallback served no real payload — measured
 * 2026-09-11, `/v4/competitions/BSA/standings` answered one group,
 * `REGULAR_SEASON`/`TOTAL`, 20 rows — so all it ever did was answer a change of
 * shape by trusting whichever group came first. With no TOTAL group this returns
 * `[]`, `requireStandings` refuses it, and the reader gets the table computed
 * from the seed, labelled fallback.
 */
export const mapStandings = (payload: StandingsResponse): StandingsRow[] => {
  const groups = payload.standings ?? [];
  const total = groups.find((group) => group.type === "TOTAL");

  return (total?.table ?? [])
    .map(tableEntryToRow)
    .filter((row): row is StandingsRow => row !== null)
    .sort((a, b) => a.position - b.position);
};

/**
 * The overall table, refusing a response that carries no rows.
 *
 * `requireFixtures`' rule, one payload over. A 2xx whose table is empty is a
 * failed response and not a championship without clubs — `computeStandings`
 * itself emits a zeroed row for every club rather than a blank table — and
 * cached as live it would put a Classificação with no rows in front of every
 * reader for a TTL, labelled "football-data". Throwing sends the fill down
 * `loadCached`'s failure path: the breaker counts it and the reader gets the
 * table computed from the seed, labelled fallback.
 *
 * It was NOT observed. Through the 2026-09-11 incident that emptied the
 * fixture list, standings kept all twenty rows. It is here because the failure
 * it names costs a blank table, and costs less than the fixtures case did:
 * standings carry no held memory, so an empty table would last one TTL rather
 * than switch a guard off. It refuses only empty, for `requireFixtures`'
 * reason — no threshold for "too short" has been measured.
 *
 * `mapStandings` still returns `[]` for an empty payload, and for one with no
 * TOTAL group, because that is a faithful reading of it; the refusal is the
 * fill's judgement. And the
 * artilharia gets no twin: before anybody has scored, an empty scorers list is
 * a real answer.
 */
export const requireStandings = (payload: StandingsResponse): StandingsRow[] => {
  const rows = mapStandings(payload);
  if (rows.length === 0) {
    throw new Error("football-data respondeu sem nenhuma linha na classificação");
  }
  return rows;
};

/**
 * Build the top-scorer table. Upstream returns the list already ordered by
 * goals, so rank comes from position in the response rather than being
 * recomputed — the provider knows how it breaks ties.
 *
 * A nullable count stays null rather than collapsing to 0: "no penalties
 * reported" and "scored no penalties" are different claims, and only one of
 * them is supported by the data.
 */
export const mapScorers = (payload: ScorersResponse): Scorer[] => {
  const rows: Scorer[] = [];

  for (const raw of payload.scorers ?? []) {
    const club = clubFromTeam(raw.team);
    const name = raw.player?.name?.trim();
    // A scorer with no name or no goal count is not a row worth rendering.
    if (!club || !name || !isFiniteNumber(raw.goals)) continue;

    rows.push({
      position: rows.length + 1,
      playerId: isFiniteNumber(raw.player?.id) ? String(raw.player.id) : name,
      playerName: name,
      club,
      goals: raw.goals,
      assists: isFiniteNumber(raw.assists) ? raw.assists : null,
      penalties: isFiniteNumber(raw.penalties) ? raw.penalties : null,
      playedMatches: isFiniteNumber(raw.playedMatches) ? raw.playedMatches : null,
    });
  }

  return rows;
};

/**
 * Build every club's elenco from the competition's team list.
 *
 * A club with an **empty or absent** squad still yields a `Squad`, deliberately:
 * it is in the championship whether or not upstream has filled its roster in,
 * and dropping it would hide the club rather than the gap. A member missing an
 * id or a name is dropped, on the same reasoning as a nameless scorer — there
 * is nothing to render and nothing to look up.
 *
 * Order is upstream's here and normalised by `sortSquads`; this stays a mapper.
 */
export const mapSquads = (payload: TeamsResponse): Squad[] => {
  const squads: Squad[] = [];

  for (const team of payload.teams ?? []) {
    const club = clubFromTeam(team);
    if (!club) continue;

    const players: Player[] = [];
    for (const raw of team.squad ?? []) {
      const name = raw.name?.trim();
      if (!isFiniteNumber(raw.id) || !name) continue;

      players.push({
        id: String(raw.id),
        name,
        ...(raw.position?.trim() ? { position: raw.position.trim() } : {}),
        ...(raw.nationality?.trim() ? { nationality: raw.nationality.trim() } : {}),
        ...(raw.dateOfBirth?.trim() ? { dateOfBirth: raw.dateOfBirth.trim() } : {}),
        // No `club` here, deliberately: it is the team this squad already hangs
        // off, and repeating it on all 948 entries would triple the payload to
        // restate what the enclosing `Squad` says. The page attaches it when it
        // opens a card.
      });
    }

    squads.push({ club, players });
  }

  return squads;
};

interface RawPerson {
  id?: number;
  name?: string;
  position?: string | null;
  nationality?: string | null;
  dateOfBirth?: string | null;
  shirtNumber?: number | null;
  currentTeam?: RawTeam;
}

export type PersonResponse = RawPerson;

/**
 * Map the person endpoint onto `Player`. Everything past id and name is
 * optional upstream — `position` is null for most scorers, `shirtNumber` for
 * most squad members — so absent fields are simply omitted rather than filled
 * with placeholders the card would have to detect again.
 */
export const mapPerson = (raw: PersonResponse): Player | null => {
  const name = raw.name?.trim();
  if (!isFiniteNumber(raw.id) || !name) return null;

  const club = clubFromTeam(raw.currentTeam) ?? undefined;

  return {
    id: String(raw.id),
    name,
    ...(isFiniteNumber(raw.shirtNumber) ? { shirtNumber: raw.shirtNumber } : {}),
    ...(raw.position?.trim() ? { position: raw.position.trim() } : {}),
    ...(raw.nationality?.trim() ? { nationality: raw.nationality.trim() } : {}),
    ...(raw.dateOfBirth?.trim() ? { dateOfBirth: raw.dateOfBirth.trim() } : {}),
    ...(club ? { club } : {}),
  };
};
