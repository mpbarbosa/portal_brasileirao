/**
 * Pure helpers for a single match page. No I/O (tests/match-core.test.ts).
 */
import { countsTowardStandings } from "@/standings-core";
import { slugify } from "@/club-core";
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
 * Channels whose packages YouTube **refuses to play in an embed**, by slug.
 *
 * This is not a guess about a channel's taste: a rights holder can switch
 * third-party playback off for its uploads, and YouTube then serves the frame
 * *"This video is unavailable"* with a `Watch on YouTube` button — Error 150 /
 * 153, decided when the player asks for the stream rather than when the page
 * loads. So it cannot be read off the API and it cannot be checked by a script:
 * `playableInEmbed` in the watch payload says **true** for a video the embed
 * then refuses, and `oembed` answers 200 for it. Measured 2026-09-07.
 *
 * **Measured in the page, because every cheaper instrument answers wrongly.**
 * An embed opened as a top-level document errors 153 for *everything*,
 * `o-_hD5Q8f4Q` (ge tv, which plays perfectly inside the app) included — a
 * probe with a known-good control that fails it is a probe measuring something
 * else, which is what that control is for. Read inside a real Partida page at
 * `/partida/…`, one channel at a time:
 *
 *     ge tv        o-_hD5Q8f4Q, 0ceAn6TLVtE      plays
 *     UOL Esporte  ryRpY29ySvk                   plays
 *     CazéTV       AgycMjd6b-I, nEknyMrCHuA,     refuses, all three
 *                  lhEf7WoBd3k
 *
 * **The direction this fails in is what makes three samples enough.** Listed
 * wrongly, a channel keeps the link-out this section shipped with and a reader
 * loses nothing; missing from the list, a reader who picks it gets a dead
 * frame. And it costs no coverage at all: of the 238 curated matches, **every
 * one** carries a channel that is not on this list, so no match loses its
 * player. If CazéTV switches embedding on, the repair is deleting a line —
 * there is no gate that will tell you, which is why the samples and the date
 * are written down rather than the conclusion alone.
 */
const EMBED_REFUSED_CHANNELS = new Set(["cazetv"]);

/**
 * Whether this package can be played **inside** the Partida page, as against
 * opened on YouTube.
 *
 * Slugged through `club-core`'s `slugify` rather than lowercased here: it is
 * the one normaliser in this app, it folds the accent in "CazéTV", and a second
 * spelling of that fold is how a list of channel names comes to miss the
 * channel it names — the rule `venue-core.ts` already reuses it under.
 */
export const playsInPage = (video: Highlight): boolean =>
  !EMBED_REFUSED_CHANNELS.has(slugify(video.channel));

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

/**
 * football-data names an official's role in English, in its own SCREAMING_SNAKE
 * vocabulary. Translated here for the reason `positionLabel` and
 * `nationalityLabel` are: the provider's word must not reach the page in an app
 * whose every other word is Portuguese.
 *
 * **One value, and that is measured rather than assumed.** The published
 * vocabulary is wider — assistants and a fourth official are documented — but
 * across BSA, PL and CL every one of the 356 entries on 949 fixtures is
 * `REFEREE`. Listing the others would be a claim this file cannot check, which
 * is the rule `NATIONALITY_LABELS` states at greater length.
 *
 * So an unmapped role renders **verbatim**, exactly as an unmapped position
 * does. It will read as an English token rather than a Portuguese word, which
 * is ugly and is the point: it is a visible prompt to add the row, where a
 * prettified guess would look finished and say something untrue.
 *
 * A named official whose role upstream omits gets the collective noun instead
 * of the specific one — it claims only that they officiated, which is all the
 * payload said.
 */
const REFEREE_ROLE_LABELS: Record<string, string> = {
  REFEREE: "Árbitro",
};

export const refereeRoleLabel = (role: string | undefined): string => {
  const raw = role?.trim();
  if (!raw) return "Arbitragem";
  return REFEREE_ROLE_LABELS[raw] ?? raw;
};
