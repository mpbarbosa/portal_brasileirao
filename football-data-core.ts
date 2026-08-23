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
import type { Club, Match, MatchStatus, StandingsRow } from "@/src/types";

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

/** Upstream shapes, narrowed to the fields this app reads. */
interface RawTeam {
  id?: number;
  name?: string;
  shortName?: string;
  tla?: string | null;
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

  return { code, name: team.name, shortName, tla };
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
