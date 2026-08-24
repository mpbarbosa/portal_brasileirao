/**
 * Pure helpers for a single match page. No I/O (tests/match-core.test.ts).
 */
import { countsTowardStandings } from "@/standings-core";
import type { Club, Match } from "@/src/types";

export const findMatch = (matches: Match[], id: string): Match | null =>
  matches.find((match) => match.id === id) ?? null;

/** Both clubs of a match, resolved from whatever club list is at hand. */
export const clubsOf = (
  match: Match,
  clubs: Club[],
): { home: Club | null; away: Club | null } => {
  const byCode = new Map(clubs.map((club) => [club.code, club]));
  return { home: byCode.get(match.homeCode) ?? null, away: byCode.get(match.awayCode) ?? null };
};

/**
 * Whether a curated link is safe to render.
 *
 * HTTPS and YouTube only. The file is hand-maintained, so this is not defending
 * against an attacker so much as against a typo or a paste of the wrong thing —
 * a bad entry degrades to the search rather than rendering a broken or
 * unexpected destination.
 */
export const isGoalsVideoUrl = (value: string | undefined): boolean => {
  if (!value) return false;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  return (
    host === "youtu.be" ||
    host === "youtube.com" ||
    host === "www.youtube.com" ||
    host === "m.youtube.com"
  );
};

/** The curated link for a match, or null when there is none worth trusting. */
export const goalsVideoUrl = (match: Match): string | null =>
  isGoalsVideoUrl(match.goalsVideoUrl) ? match.goalsVideoUrl! : null;

/** Attach curated goal links to the matches that have one. */
export const withGoalVideos = (
  matches: Match[],
  videos: Record<string, string>,
): Match[] =>
  matches.map((match) => {
    const url = videos[match.id];
    return isGoalsVideoUrl(url) ? { ...match, goalsVideoUrl: url } : match;
  });

/**
 * A YouTube **search** URL for a finished match's goals.
 *
 * Deliberately a search, not a video: no provider we use exposes highlight
 * links, and guessing a video id would sooner or later point at the wrong match
 * — or at someone's reupload. A search always resolves to something relevant
 * and is honest about being a starting point. A curated exact link, when one
 * exists, should win over this.
 */
export const goalsSearchUrl = (home: string, away: string): string => {
  const query = `${home} x ${away} gols Brasileirão`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
};

/**
 * Whether a goals link is worth offering. Only for matches that finished with a
 * score — there are no highlights of a fixture that has not kicked off, and a
 * live match's goals are not yet a package.
 */
export const hasGoalsToShow = (match: Match): boolean =>
  countsTowardStandings(match) && (match.homeGoals ?? 0) + (match.awayGoals ?? 0) > 0;

/** `Nilton Santos · Rio de Janeiro – RJ`, or null when the venue is unknown. */
export const venueLabel = (match: Match): string | null => {
  const venue = match.venue;
  if (!venue) return null;
  return `${venue.stadium} · ${venue.city} – ${venue.state}`;
};
