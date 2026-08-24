/**
 * Pure broadcast attachment. No I/O — the curated map goes in, matches carrying
 * their channels come out (tests/broadcast-core.test.ts).
 */
import type { Match } from "@/src/types";

/**
 * Channels for one match, or null when none are recorded.
 *
 * Null and empty are the same answer to a reader — "we don't know where this is
 * shown" — so an empty array collapses to null rather than rendering an empty
 * broadcast line.
 */
export const channelsFor = (
  broadcasts: Record<string, string[]>,
  matchId: string,
): string[] | null => {
  const channels = broadcasts[matchId];
  return channels && channels.length > 0 ? channels : null;
};

/**
 * Attach channels to the matches that have them, leaving the rest untouched.
 *
 * The curated map is allowed to name a match that is not in the list — a stale
 * entry from a rescheduled fixture, say — and that is simply ignored rather
 * than treated as an error, so one bad row cannot blank the whole round.
 */
export const withBroadcasters = (
  matches: Match[],
  broadcasts: Record<string, string[]>,
): Match[] =>
  matches.map((match) => {
    const channels = channelsFor(broadcasts, match.id);
    return channels ? { ...match, broadcasters: channels } : match;
  });

/**
 * Split a channel string as CBF prints it. The page mixes separators within a
 * single table — `ESPN / Disney+` alongside `Premiere, Sportv` — so both are
 * handled, and blanks are dropped.
 *
 * Exists for transcription: paste a cell, get the array to store.
 */
export const parseChannels = (raw: string): string[] =>
  raw
    .split(/[,/]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
