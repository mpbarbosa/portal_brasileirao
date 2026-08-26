import type {
  ApiEnvelope,
  Club,
  ClubCode,
  Match,
  Scorer,
  Squad,
  StandingsRow,
} from "@/src/types";

export interface MatchesPayload {
  rounds: number[];
  currentRound: number | null;
  matches: Match[];
  /** Clubs appearing in `matches`, so names resolve from the payload rather
   *  than the local seed — codes differ once a provider is connected. */
  clubs: Club[];
}

const getJson = async <T>(url: string): Promise<ApiEnvelope<T>> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} respondeu ${response.status}`);
  }
  return (await response.json()) as ApiEnvelope<T>;
};

export const fetchStandings = () => getJson<StandingsRow[]>("/api/standings");
export const fetchMatches = () => getJson<MatchesPayload>("/api/matches");
export const fetchScorers = () => getJson<Scorer[]>("/api/scorers");
/** Every club's elenco. One request upstream serves all twenty. */
export const fetchSquads = () => getJson<Squad[]>("/api/squads");
/**
 * Every club's head coach, keyed by club code.
 *
 * Separate from the payloads the club page is otherwise built from, because no
 * fixture and no standings row carries a coach — and separate from the elenco,
 * though the two come off the same upstream team list, because twenty names is
 * a fraction of the ~110 KB the elencos weigh. A club upstream lists no coach
 * for is simply absent from the map.
 */
export const fetchCoaches = () => getJson<Record<ClubCode, string>>("/api/coaches");
