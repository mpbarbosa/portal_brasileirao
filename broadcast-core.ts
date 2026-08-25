/**
 * Pure broadcast attachment. No I/O — the curated map goes in, matches carrying
 * their channels come out (tests/broadcast-core.test.ts).
 */
import { findClub, slugify } from "@/club-core";
import type { Club, Match, Venue } from "@/src/types";

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


// ---------------------------------------------------------------------------
// Joining CBF's "Onde assistir" fixtures to ours
//
// Pure, so the join rules are testable without touching the network. The script
// that calls CBF lives in scripts/sync-broadcasts.ts.
// ---------------------------------------------------------------------------

/** The fields of a CBF fixture this join needs. */
export interface CbfFixture {
  data?: string;
  hora?: string;
  local?: string;
  mandante?: { nome?: string };
  transmissoes?: { nome?: string }[];
  competicao?: { categoria_id?: string };
}

export const SERIE_A_CATEGORIA_ID = "1";

/** Brazil abolished DST in 2019, so BRT is UTC-3 all year. */
const BRT_OFFSET_HOURS = 3;

/** `24/08/2026` + `20:00` (BRT) -> `2026-08-24T23:00:00.000Z`. */
export const kickoffToIso = (data: string, hora: string): string | null => {
  const date = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data.trim());
  const time = /^(\d{1,2}):(\d{2})$/.exec(hora.trim());
  if (!date || !time) return null;

  const [, dd, mm, yyyy] = date;
  const [, hh, min] = time;
  const utc = Date.UTC(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh) + BRT_OFFSET_HOURS,
    Number(min),
  );

  return Number.isNaN(utc) ? null : new Date(utc).toISOString();
};

/**
 * CBF spells some clubs structurally differently from our provider — a regional
 * suffix versus the full state name, or a sponsor prefix — so no amount of
 * prefix matching connects them. These are stated outright.
 *
 * Keyed by the slug of CBF's name, valued by ours. Add an entry when the sync
 * script reports an unjoinable fixture; never widen the fuzzy matching instead,
 * since a wrong join silently attaches the wrong channels to a match.
 */
export const CBF_CLUB_ALIASES: Record<string, string> = {
  "atletico-mineiro": "atletico-mg",
  "athletico-paranaense": "athletico-pr",
  remo: "clube-do-remo",
  "red-bull-bragantino": "bragantino",
};

/**
 * Resolve a CBF club name to one of ours: alias first, then an exact slug, then
 * a prefix match in either direction ("Santos FC" -> "santos", "Coritiba SAF"
 * -> "coritiba"). Ambiguity resolves to null — a coin toss would mislabel a
 * match.
 */
export const matchClub = (clubs: Club[], cbfName: string): Club | null => {
  const slug = slugify(cbfName);
  if (!slug) return null;

  const needle = CBF_CLUB_ALIASES[slug] ?? slug;

  const exact = findClub(clubs, needle);
  if (exact) return exact;

  const candidates = clubs.filter((club) => {
    const clubSlug = club.slug ?? slugify(club.shortName);
    return clubSlug.startsWith(needle) || needle.startsWith(clubSlug);
  });

  return candidates.length === 1 ? candidates[0] : null;
};

/** Channel names for a CBF fixture, split, normalised and de-duplicated. */
export const channelsOf = (fixture: CbfFixture): string[] =>
  (fixture.transmissoes ?? [])
    .flatMap((entry) => parseChannels(entry.nome ?? ""))
    // CBF's own casing drifts from the broadcasters' branding.
    .map((name) => (name.toLowerCase() === "sportv" ? "SporTV" : name))
    .filter((name, index, all) => all.indexOf(name) === index);

/**
 * football-data marks "date known, kickoff time not yet confirmed" by setting
 * the time to midnight UTC. Whole future rounds look like this — every fixture
 * of rounds 27-38 currently sits at T00:00:00Z.
 */
export const hasProvisionalKickoff = (match: Match): boolean =>
  match.kickoff.slice(11, 19) === "00:00:00";

/**
 * Our match id for a CBF fixture, or null when it cannot be identified.
 *
 * Normally the join is the kickoff instant plus the home club. When our fixture
 * still carries a provisional time, the instant cannot match anything, so the
 * join falls back to the calendar date plus the home club — enough to identify
 * a fixture, since a club plays at most once a day. Ambiguity still yields null.
 */
export const joinMatch = (
  matches: Match[],
  clubs: Club[],
  fixture: CbfFixture,
): string | null => {
  if (!fixture.data || !fixture.hora || !fixture.mandante?.nome) return null;

  const kickoff = kickoffToIso(fixture.data, fixture.hora);
  if (!kickoff) return null;

  const home = matchClub(clubs, fixture.mandante.nome);
  if (!home) return null;

  const atHome = matches.filter((match) => match.homeCode === home.code);

  // Compare instants, not strings: football-data returns "…T23:00:00Z" while
  // toISOString() produces "…T23:00:00.000Z". Same moment, different text.
  const wanted = Date.parse(kickoff);
  const exact = atHome.filter((match) => Date.parse(match.kickoff) === wanted);
  if (exact.length === 1) return exact[0].id;

  const day = kickoff.slice(0, 10);
  const sameDay = atHome.filter(
    (match) => hasProvisionalKickoff(match) && match.kickoff.slice(0, 10) === day,
  );

  return sameDay.length === 1 ? sameDay[0].id : null;
};


/**
 * Parse CBF's venue string, which is consistently three ` - ` separated parts:
 * `Nilton Santos - Rio de Janeiro - RJ`.
 *
 * Values are kept verbatim apart from trimming. CBF's casing and accents drift
 * — `ARENA MRV`, `Sao Paulo` without the tilde — but correcting them would mean
 * guessing at names, and a wrong stadium reads worse than an unstyled one.
 */
export const venueFromLocal = (local: string | undefined): Venue | null => {
  const parts = (local ?? "").split(" - ").map((part) => part.trim());
  if (parts.length !== 3) return null;

  const [stadium, city, state] = parts;
  if (!stadium || !city || !/^[A-Za-z]{2}$/.test(state)) return null;

  return { stadium, city, state: state.toUpperCase() };
};

/** Attach venues to the matches that have one, leaving the rest untouched. */
export const withVenues = (
  matches: Match[],
  venues: Record<string, Venue>,
): Match[] =>
  matches.map((match) => {
    const venue = venues[match.id];
    return venue ? { ...match, venue } : match;
  });

/**
 * Broadcaster marks, keyed by a normalised channel name.
 *
 * `commons` records where the artwork came from; `slug` is what the app serves.
 * They are downloaded once by `scripts/sync-broadcaster-marks.ts` and served
 * from our own origin, **not** hotlinked.
 *
 * Hotlinking was the first attempt and it fails in production: Commons answers
 * a browser's third or fourth request with 429, so a reader sees some marks and
 * empty plates where the rest should be. Commons is an archive, not a CDN, and
 * throttling is the correct behaviour on their side. Redistributing is fine
 * precisely because each of these is public domain — a plain wordmark is not
 * original enough to copyright — which is also why Commons is the source rather
 * than a broadcaster's own site, where no licence comes with the file.
 *
 * A name with no entry here is not a gap to apologise for — `BroadcasterMark`
 * renders it as its own wordmark instead. That path is load-bearing: CBF's feed
 * already names ESPN/Disney+, Band, SportyNet and a dozen others we have no
 * mark for, and Record's only Commons logo is CC BY-SA, whose attribution
 * requirement is not worth taking on for the one fixture it appears in.
 */
export interface MarkSource {
  /** Served as `/marks/<slug>.png`. */
  slug: string;
  /** Wikimedia Commons file title, read only by the sync script. */
  commons: string;
}

export const MARKS: Record<string, MarkSource> = {
  GLOBO: { slug: "globo", commons: "Rede Globo logo.svg" },
  PREMIERE: { slug: "premiere", commons: "Premiere FC logo.png" },
  SPORTV: { slug: "sportv", commons: "SporTV logo 2016.png" },
  AMAZONPRIME: { slug: "prime-video", commons: "Prime Video logo (2024).svg" },
  PRIMEVIDEO: { slug: "prime-video", commons: "Prime Video logo (2024).svg" },
  YOUTUBE: { slug: "youtube", commons: "YouTube Logo 2017.svg" },
  CAZETV: { slug: "caze-tv", commons: "CazéTV wordmark.svg" },
  GETV: { slug: "ge", commons: "Ge.globo logo.svg" },
  GE: { slug: "ge", commons: "Ge.globo logo.svg" },
};

/**
 * Channel names reach us spelled several ways and all of them are correct in
 * context: CBF writes "GE TV" and "Cazé TV", the channels write themselves
 * "ge tv" and "CazéTV". Accents, spaces and case carry no meaning for lookup.
 */
export const markKey = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

/** The mark for a channel, or null when we have none. */
export const broadcasterMarkUrl = (name: string): string | null => {
  const mark = MARKS[markKey(name)];
  return mark ? `/marks/${mark.slug}.png` : null;
};
