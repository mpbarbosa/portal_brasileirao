/**
 * Pure match-list helpers. No network, no I/O (tests/matches-core.test.ts).
 */
import type { Match, MatchStatus } from "@/src/types";

const STATUS_ORDER: Record<MatchStatus, number> = {
  LIVE: 0,
  SCHEDULED: 1,
  POSTPONED: 2,
  FINISHED: 3,
  CANCELLED: 4,
};

/**
 * A match that will never be played again. Distinct from "not finished":
 * a postponed match is still coming, a cancelled one is not — so only
 * CANCELLED joins FINISHED here, otherwise a cancelled fixture would pin
 * `currentRound` to its round forever.
 */
export const isConcluded = (match: Match): boolean =>
  match.status === "FINISHED" || match.status === "CANCELLED";

/** Chronological within a round; invalid kickoff strings sort last. */
const kickoffValue = (match: Match): number => {
  const parsed = Date.parse(match.kickoff);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
};

export const compareByKickoff = (a: Match, b: Match): number =>
  kickoffValue(a) - kickoffValue(b) || a.id.localeCompare(b.id);

/**
 * Order for the match list: live matches first, then upcoming, then finished —
 * what a reader opening the app mid-round wants at the top.
 */
export const compareForFeed = (a: Match, b: Match): number =>
  STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || compareByKickoff(a, b);

export const matchesForRound = (matches: Match[], round: number): Match[] =>
  matches.filter((match) => match.round === round).sort(compareByKickoff);

export const roundsOf = (matches: Match[]): number[] =>
  [...new Set(matches.map((match) => match.round))].sort((a, b) => a - b);

/**
 * The round to show by default: the earliest one still holding an unfinished
 * match, else the last round played. Returns null for an empty fixture list.
 */
export const currentRound = (matches: Match[]): number | null => {
  const rounds = roundsOf(matches);
  if (rounds.length === 0) return null;

  const pending = rounds.find((round) =>
    matches.some((match) => match.round === round && !isConcluded(match)),
  );

  return pending ?? rounds[rounds.length - 1];
};
