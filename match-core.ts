/**
 * Pure helpers for a single match page. No I/O (tests/match-core.test.ts).
 */
import { countsTowardStandings } from "@/standings-core";
import type { Club, Highlight, Match } from "@/src/types";

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
export const isHighlightUrl = (value: string | undefined): boolean => {
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

/**
 * The curated highlights for a match, dropping any entry whose URL does not
 * survive validation — a typo in one line should not take the others with it.
 */
export const highlights = (match: Match): Highlight[] =>
  (match.highlights ?? []).filter((video) => isHighlightUrl(video.url));

/** Attach curated highlights to the matches that have any. */
export const withHighlights = (
  matches: Match[],
  videos: Record<string, Highlight[]>,
): Match[] =>
  matches.map((match) => {
    const valid = (videos[match.id] ?? []).filter((video) => isHighlightUrl(video.url));
    return valid.length > 0 ? { ...match, highlights: valid } : match;
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
export const highlightsSearchUrl = (home: string, away: string): string => {
  // "melhores momentos", not "gols": the same query has to serve a 0-0.
  const query = `${home} x ${away} melhores momentos Brasileirão`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
};

/**
 * Whether highlights are worth offering. Any match that has finished with a
 * score qualifies, **including a goalless one**: a 0-0 still has chances and
 * saves, and broadcasters publish a package for it either way. Gating on goals
 * would silently hide the section from 14 of the season's 234 finished matches.
 *
 * Still excluded: a fixture that has not kicked off, and a live match, whose
 * highlights are not yet a package.
 */
export const hasHighlights = (match: Match): boolean => countsTowardStandings(match);

/** `Nilton Santos · Rio de Janeiro – RJ`, or null when the venue is unknown. */
export const venueLabel = (match: Match): string | null => {
  const venue = match.venue;
  if (!venue) return null;
  return `${venue.stadium} · ${venue.city} – ${venue.state}`;
};
