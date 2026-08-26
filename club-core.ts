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
 * The handle alone, from whatever was written down.
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
export const instagramHandle = (raw: string | null | undefined): string | null => {
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
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? handle : null;
};

/**
 * The address for a handle, built from the normalised handle rather than from
 * the raw value — so a link and the `@handle` printed beside it cannot come to
 * disagree about which profile they mean.
 */
export const instagramUrl = (raw: string | null | undefined): string | null => {
  const handle = instagramHandle(raw);
  return handle && `https://www.instagram.com/${handle}/`;
};

/**
 * The canonical watch address for a hymn video.
 *
 * Accepts what a person is likely to paste — a bare id, a `watch?v=` link, a
 * `youtu.be` short link, an `embed/` link — because the hymn list is
 * hand-maintained and being strict about the input format buys nothing. Only
 * the id is kept, so a link copied while the video played inside a mix does not
 * carry `&list=RD…&start_radio=1` into the file and drop every reader into
 * autoplaying radio instead of the hymn.
 *
 * Returns null for anything that is not a plausible video id — YouTube's are
 * exactly 11 characters of the URL-safe alphabet — which the UI renders as no
 * link rather than a broken one.
 */
export const hymnUrl = (raw: string | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  let id = value;
  if (value.includes("/")) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    id =
      url.searchParams.get("v") ??
      // youtu.be/<id>, /embed/<id>, /shorts/<id> — the last path segment.
      (url.pathname.split("/").filter(Boolean).pop() ?? "");
  }

  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;

  return `https://www.youtube.com/watch?v=${id}`;
};

/**
 * The canonical article address for a Wikipedia title.
 *
 * Accepts what a person is likely to paste — a bare title with spaces or with
 * underscores, or a full `pt.wikipedia.org/wiki/…` link — because the list is
 * hand-maintained and being strict about the input format buys nothing. Only
 * the title is kept, so a link copied from the article's edit view or from a
 * section heading does not carry `?action=edit` or `#História` into the file.
 *
 * The edition is fixed to **pt**, and a URL naming another one returns null
 * rather than being rewritten: `Grêmio Foot-Ball Porto Alegrense` is not an
 * article on the English Wikipedia, so rewriting an `en.` link would produce a
 * plausible address that 404s, and the whole app is pt-BR anyway.
 *
 * Underscores are what the address uses and spaces are what the file reads, so
 * the title is stored with spaces and converted here. The rest is
 * percent-encoded rather than transliterated — unlike a club **slug**, where
 * stripping accents keeps the address typeable, `Gremio…` is simply a different
 * article title and would not resolve.
 *
 * Returns null for anything that is not a plausible title — Wikipedia forbids
 * `#<>[]|{}` in one — which the UI renders as no link rather than a broken one.
 */
export const wikipediaUrl = (raw: string | null | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  let title = value;
  if (value.includes("/")) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    if (url.hostname !== "pt.wikipedia.org") return null;
    if (!url.pathname.startsWith("/wiki/")) return null;
    try {
      title = decodeURIComponent(url.pathname.slice("/wiki/".length));
    } catch {
      return null;
    }
  }

  title = title.replace(/_/g, " ").trim();
  if (!title || /[#<>[\]|{}]/.test(title)) return null;

  return `https://pt.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
};

/** Attach curated handles to a club list, keyed by code. */
export const withInstagram = (clubs: Club[], handles: Record<string, string>): Club[] =>
  clubs.map((club) => {
    const handle = handles[club.code];
    return handle && !club.instagram ? { ...club, instagram: handle } : club;
  });

/** Attach curated hymn video ids to a club list, keyed by code. */
export const withHymns = (clubs: Club[], hymns: Record<string, string>): Club[] =>
  clubs.map((club) => {
    const hymn = hymns[club.code];
    return hymn && !club.hymn ? { ...club, hymn } : club;
  });

/** Attach curated Wikipedia article titles to a club list, keyed by code. */
export const withWikipedia = (clubs: Club[], articles: Record<string, string>): Club[] =>
  clubs.map((club) => {
    const wikipedia = articles[club.code];
    return wikipedia && !club.wikipedia ? { ...club, wikipedia } : club;
  });

/**
 * Fill in details the live payloads omit.
 *
 * Club objects embedded in standings and fixtures carry only id, name, crest
 * and abbreviation — the website comes from the teams endpoint, which only the
 * seed generator calls, and the Instagram handle, the hymn and the Wikipedia
 * article from no endpoint at all. So the committed club list supplies all four
 * at request time.
 */
export const withClubDetails = (clubs: Club[], known: Club[]): Club[] => {
  const byCode = new Map(known.map((club) => [club.code, club]));

  return clubs.map((club) => {
    const source = byCode.get(club.code);
    const website = club.website ?? source?.website;
    const instagram = club.instagram ?? source?.instagram;
    const hymn = club.hymn ?? source?.hymn;
    const wikipedia = club.wikipedia ?? source?.wikipedia;

    return {
      ...club,
      ...(website ? { website } : {}),
      ...(instagram ? { instagram } : {}),
      ...(hymn ? { hymn } : {}),
      ...(wikipedia ? { wikipedia } : {}),
    };
  });
};
