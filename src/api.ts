import { parseHealth } from "@/health-core";
import type {
  ApiEnvelope,
  Club,
  ClubCode,
  Health,
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

/** A reading of `/api/health`, and when it was taken. */
export interface HealthReading {
  /** `null` when the endpoint answered something this build cannot read. */
  health: Health | null;
  /**
   * The instant the body arrived. Carried alongside because `uptime` is
   * relative to it and to nothing else — the rodapé turns the two into the
   * instant the process started, and reading the clock again later would walk
   * that answer forward instead of holding it still.
   */
  readAt: number;
}

/**
 * The process answering, for the **Rodapé**.
 *
 * The one fetch here that does not go through `getJson`: `/api/health` is not
 * an `ApiEnvelope` (see `Health`), and it is read through `parseHealth` rather
 * than cast, because a host serving an older bundle answers the shape that
 * build emitted. A 503 and an unreadable body are the same fact to a footer, so
 * both land as `health: null` rather than as two cases the caller must join
 * back together.
 */
export const fetchHealth = async (): Promise<HealthReading> => {
  const response = await fetch("/api/health");
  const readAt = Date.now();
  if (!response.ok) return { health: null, readAt };

  return { health: parseHealth(await response.json()), readAt };
};
