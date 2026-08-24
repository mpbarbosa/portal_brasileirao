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
import { slugify } from "@/club-core";
import type { Club, Match, MatchStatus, Player, Scorer, StandingsRow } from "@/src/types";

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

/** A single person. One request each, so callers must cache. */
export const personUrl = (id: string): string =>
  `${FOOTBALL_DATA_BASE}/persons/${encodeURIComponent(id)}`;

/** Upstream defaults to 10 scorers; the table shows more than that. */
export const SCORERS_LIMIT = 20;

export const scorersUrl = (
  competition: string = BSA_COMPETITION,
  limit: number = SCORERS_LIMIT,
): string => `${FOOTBALL_DATA_BASE}/competitions/${competition}/scorers?limit=${limit}`;

/** Upstream shapes, narrowed to the fields this app reads. */
interface RawTeam {
  id?: number;
  name?: string;
  shortName?: string;
  tla?: string | null;
  crest?: string | null;
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
 * football-data's status vocabulary is wider than the app's. TIMED (kickoff
 * time confirmed) and SCHEDULED (date only) are the same thing to a reader, and
 * PAUSED is half-time — still a live match.
 */
const STATUS_MAP: Record<string, MatchStatus> = {
  SCHEDULED: "SCHEDULED",
  TIMED: "SCHEDULED",
  LIVE: "LIVE",
  IN_PLAY: "LIVE",
  PAUSED: "LIVE",
  FINISHED: "FINISHED",
  AWARDED: "FINISHED",
  POSTPONED: "POSTPONED",
  SUSPENDED: "POSTPONED",
  CANCELLED: "CANCELLED",
};

/** Unknown statuses degrade to SCHEDULED rather than dropping the fixture. */
export const mapStatus = (raw: string | undefined): MatchStatus =>
  (raw && STATUS_MAP[raw]) || "SCHEDULED";

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

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
 * Identity comes from the upstream numeric id, never from `tla`. The
 * abbreviation is not unique — Corinthians and Coritiba both report "COR" —
 * so keying on it silently merges two clubs' rows. `tla` is carried along for
 * display only. Falls back to the abbreviation only when there is no id.
 */
export const clubFromTeam = (team: RawTeam | undefined): Club | null => {
  if (!team || !team.name) return null;

  const tla = team.tla?.trim() || undefined;
  const code = isNumber(team.id) ? String(team.id) : tla;
  if (!code) return null;

  const shortName =
    (isNumber(team.id) ? DISPLAY_NAME_OVERRIDES[team.id] : undefined) ??
    team.shortName?.trim() ??
    team.name;

  const slug = slugify(shortName) || undefined;
  const crest = team.crest?.trim() || undefined;

  // Conditional so an absent crest means the key is missing, not present-and-
  // undefined — otherwise `"crest" in club` lies.
  return { code, name: team.name, shortName, tla, slug, ...(crest ? { crest } : {}) };
};

/**
 * A fixture missing an id, a kickoff, or either club is dropped rather than
 * rendered half-built — one bad row upstream should not break the round.
 */
export const mapMatch = (raw: RawMatch): Match | null => {
  const home = clubFromTeam(raw.homeTeam);
  const away = clubFromTeam(raw.awayTeam);
  if (!isNumber(raw.id) || !raw.utcDate || !home || !away) return null;

  const fullTime = raw.score?.fullTime;

  return {
    id: String(raw.id),
    round: isNumber(raw.matchday) ? raw.matchday : 0,
    kickoff: raw.utcDate,
    status: mapStatus(raw.status),
    homeCode: home.code,
    awayCode: away.code,
    homeGoals: isNumber(fullTime?.home) ? fullTime.home : null,
    awayGoals: isNumber(fullTime?.away) ? fullTime.away : null,
  };
};

export const mapMatches = (payload: MatchesResponse): Match[] =>
  (payload.matches ?? []).map(mapMatch).filter((match): match is Match => match !== null);

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

  const goalsFor = isNumber(entry.goalsFor) ? entry.goalsFor : 0;
  const goalsAgainst = isNumber(entry.goalsAgainst) ? entry.goalsAgainst : 0;

  return {
    // Trust the upstream position when present — it already encodes the
    // tie-breakers the provider applied, including ones this app can't compute.
    position: isNumber(entry.position) ? entry.position : index + 1,
    club,
    played: isNumber(entry.playedGames) ? entry.playedGames : 0,
    wins: isNumber(entry.won) ? entry.won : 0,
    draws: isNumber(entry.draw) ? entry.draw : 0,
    losses: isNumber(entry.lost) ? entry.lost : 0,
    goalsFor,
    goalsAgainst,
    goalDifference: isNumber(entry.goalDifference)
      ? entry.goalDifference
      : goalsFor - goalsAgainst,
    points: isNumber(entry.points) ? entry.points : 0,
  };
};

/**
 * Read the overall table. football-data returns TOTAL/HOME/AWAY splits in one
 * response; only TOTAL is the championship table. Falls back to the first entry
 * when no type is labelled TOTAL.
 */
export const mapStandings = (payload: StandingsResponse): StandingsRow[] => {
  const groups = payload.standings ?? [];
  const total = groups.find((group) => group.type === "TOTAL") ?? groups[0];

  return (total?.table ?? [])
    .map(tableEntryToRow)
    .filter((row): row is StandingsRow => row !== null)
    .sort((a, b) => a.position - b.position);
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
    if (!club || !name || !isNumber(raw.goals)) continue;

    rows.push({
      position: rows.length + 1,
      playerId: isNumber(raw.player?.id) ? String(raw.player.id) : name,
      playerName: name,
      club,
      goals: raw.goals,
      assists: isNumber(raw.assists) ? raw.assists : null,
      penalties: isNumber(raw.penalties) ? raw.penalties : null,
      playedMatches: isNumber(raw.playedMatches) ? raw.playedMatches : null,
    });
  }

  return rows;
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
  if (!isNumber(raw.id) || !name) return null;

  const club = clubFromTeam(raw.currentTeam) ?? undefined;

  return {
    id: String(raw.id),
    name,
    ...(isNumber(raw.shirtNumber) ? { shirtNumber: raw.shirtNumber } : {}),
    ...(raw.position?.trim() ? { position: raw.position.trim() } : {}),
    ...(raw.nationality?.trim() ? { nationality: raw.nationality.trim() } : {}),
    ...(raw.dateOfBirth?.trim() ? { dateOfBirth: raw.dateOfBirth.trim() } : {}),
    ...(club ? { club } : {}),
  };
};
