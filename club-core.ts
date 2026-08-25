/**
 * Pure per-club derivations. No I/O — the club view composes data the client
 * already holds (standings, fixtures, scorers), so this module exists to keep
 * the slicing rules testable rather than buried in a component.
 */
import { compareByKickoff, isConcluded } from "@/matches-core";
import { countsTowardStandings } from "@/standings-core";
import type { Club, ClubCode, Match, Scorer, StandingsRow } from "@/src/types";

/**
 * URL-safe form of a club name: "Atlético-MG" becomes "atletico-mg".
 *
 * Accents are stripped rather than percent-encoded so the address stays
 * readable and typeable. Returns "" when a name has nothing alphanumeric in it,
 * which the caller must treat as "no slug" — never as a valid empty path
 * segment.
 */
export const slugify = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** What a club's URL should say. Falls back to the code when it has no slug. */
export const clubKey = (club: Club): string => club.slug || club.code;

/**
 * Resolve a club from a URL segment, accepting either a slug or a raw code.
 * Codes are still honoured because links to `/clube/1783` were published before
 * slugs existed, and a shared link should not rot.
 */
export const findClub = (clubs: Club[], key: string): Club | null => {
  const needle = key.toLowerCase();
  return (
    clubs.find((club) => club.slug === needle) ??
    clubs.find((club) => club.code === key) ??
    null
  );
};

export type FormResult = "V" | "E" | "D";

export const playsIn = (match: Match, code: ClubCode): boolean =>
  match.homeCode === code || match.awayCode === code;

export const clubMatches = (matches: Match[], code: ClubCode): Match[] =>
  matches.filter((match) => playsIn(match, code)).sort(compareByKickoff);

/**
 * Result of a finished match from one club's point of view. Returns null when
 * the match cannot be scored yet — a live or unplayed fixture has no result,
 * and neither does one the club is not in.
 */
export const resultFor = (match: Match, code: ClubCode): FormResult | null => {
  if (!countsTowardStandings(match) || !playsIn(match, code)) return null;

  const scored = match.homeCode === code ? match.homeGoals : match.awayGoals;
  const conceded = match.homeCode === code ? match.awayGoals : match.homeGoals;

  if (scored > conceded) return "V";
  if (scored === conceded) return "E";
  return "D";
};

/**
 * The club's last `size` results, oldest first — the reading order of a form
 * guide. Only finished matches count, so a postponed fixture in the middle of
 * the run does not punch a hole in it.
 */
export const recentForm = (matches: Match[], code: ClubCode, size = 5): FormResult[] =>
  clubMatches(matches, code)
    .map((match) => resultFor(match, code))
    .filter((result): result is FormResult => result !== null)
    .slice(-size);

/** The next fixture still to be played, or null once the season is over. */
export const nextFixture = (matches: Match[], code: ClubCode): Match | null =>
  clubMatches(matches, code).find((match) => !isConcluded(match)) ?? null;

/** The most recently finished match, or null before the club has played. */
export const lastFixture = (matches: Match[], code: ClubCode): Match | null => {
  const played = clubMatches(matches, code).filter(countsTowardStandings);
  return played.length ? played[played.length - 1] : null;
};

export const standingFor = (rows: StandingsRow[], code: ClubCode): StandingsRow | null =>
  rows.find((row) => row.club.code === code) ?? null;

/** The club's entries in the top-scorer table, best first. */
export const scorersFor = (scorers: Scorer[], code: ClubCode): Scorer[] =>
  scorers.filter((scorer) => scorer.club.code === code);


/**
 * Normalise a club's official site to an HTTPS origin.
 *
 * Two corrections, both from real provider data:
 *
 * - **Scheme.** Most clubs are listed as `http://`. Every one of the twenty
 *   terminates TLS — checked by hand, including the ones whose bot protection
 *   answers a script with 403 — so upgrading is safe and linking a reader to
 *   plaintext is not.
 * - **Path.** Flamengo is listed as `/pagina-inicial-basquete`, the basketball
 *   landing page. This link means "the club's official site", so only the origin
 *   is kept. No club here lives at a path, and dropping one is a smaller error
 *   than sending football readers to a basketball page.
 *
 * Returns null for anything unparseable, which the UI renders as no link at all.
 */
export const officialSiteUrl = (raw: string | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;

  return `https://${url.hostname}/`;
};

/**
 * The canonical profile address for a handle.
 *
 * Accepts what a person is likely to paste — a bare handle, an `@handle`, or a
 * full URL carrying Instagram's `?hl=pt-br` locale hint — because the handle
 * list is hand-maintained and being strict about the input format buys nothing.
 * Only the handle is kept, so the stored data does not accumulate query strings
 * that mean nothing to another reader.
 *
 * Returns null for anything that is not a plausible handle, which the UI
 * renders as no link rather than a broken one.
 */
export const instagramUrl = (raw: string | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  // Take the first path segment of a URL, or the value itself.
  const handle = (value.includes("instagram.com/")
    ? (value.split("instagram.com/")[1] ?? "")
    : value
  )
    .split(/[/?#]/)[0]
    .replace(/^@/, "");

  // Instagram's own rule: letters, digits, dots and underscores, up to 30.
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;

  return `https://www.instagram.com/${handle}/`;
};

/** Attach curated handles to a club list, keyed by code. */
export const withInstagram = (clubs: Club[], handles: Record<string, string>): Club[] =>
  clubs.map((club) => {
    const handle = handles[club.code];
    return handle && !club.instagram ? { ...club, instagram: handle } : club;
  });

/**
 * Fill in details the live payloads omit.
 *
 * Club objects embedded in standings and fixtures carry only id, name, crest
 * and abbreviation — the website comes from the teams endpoint, which only the
 * seed generator calls, and the Instagram handle from no endpoint at all. So
 * the committed club list supplies both at request time.
 */
export const withClubDetails = (clubs: Club[], known: Club[]): Club[] => {
  const byCode = new Map(known.map((club) => [club.code, club]));

  return clubs.map((club) => {
    const source = byCode.get(club.code);
    const website = club.website ?? source?.website;
    const instagram = club.instagram ?? source?.instagram;

    return {
      ...club,
      ...(website ? { website } : {}),
      ...(instagram ? { instagram } : {}),
    };
  });
};
