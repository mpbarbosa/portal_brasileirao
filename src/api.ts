import type { ApiEnvelope, Club, Match, StandingsRow } from "@/src/types";

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
