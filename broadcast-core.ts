/**
 * Pure broadcast attachment. No I/O — the curated map goes in, matches carrying
 * their channels come out (tests/broadcast-core.test.ts).
 */
import { findClub } from "@/club-core";
import { slugify } from "@/slug-core";
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
 * CBF's `24/08/2026` as an ISO calendar day, `2026-08-24`, or null.
 *
 * **This is deliberately not `kickoffToIso` followed by a slice, and not
 * `brasiliaDay` either — a calendar day here never becomes an instant at all.**
 * CBF states the local day; reading it back out of a UTC instant is a round trip
 * whose only possible outcome is the day it started from or a bug, and it was
 * the bug: `joinMatch` sliced the instant, so every kickoff from 21:00 BRT
 * onward answered the day after the one CBF printed. `events-core.ts`'s rule,
 * reached from the side where no bridge is owed.
 */
const cbfDay = (data: string): string | null => {
  const date = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data.trim());
  return date ? `${date[3]}-${date[2]}-${date[1]}` : null;
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

  // The two sides carry a calendar day in two different frames, and the
  // asymmetry is the whole of this join. CBF's is local, and is read straight
  // off `fixture.data` rather than out of the instant built from it. Ours is a
  // date-only fixture, which `withKickoffPrecision` defines as UTC midnight and
  // `kickoffLabel` renders with an explicit `timeZone: "UTC"` — so slicing is
  // right on this side and `brasiliaDay` would be wrong, shifting it a day back.
  const day = cbfDay(fixture.data);
  if (day === null) return null;

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
 * `slug` is what the app serves; `fifa` or `commons` records where the artwork
 * came from. They are downloaded once by `scripts/sync-broadcaster-marks.ts`
 * and served from our own origin, **not** hotlinked.
 *
 * **Two sources, and the channel decides which.** Where FIFA's broadcast guide
 * names a channel, the mark is the logo FIFA serves for it — the same picture
 * copa2026.mpbarbosa.com shows under "Onde ver o jogo", so a reader of both apps
 * sees one Globo rather than two. That covers Globo, Globoplay, SporTV, ge tv,
 * CazéTV and SBT, and it is why SBT has a mark at all. The ids were read out of
 * `../agora_na_copa_2026/src/matches.json`, which stores FIFA's own `Logo` field,
 * rather than guessed at. Premiere, Prime Video and YouTube did not carry the
 * Copa, so FIFA has no logo for them and they keep their Commons marks.
 *
 * **The FIFA files come with no licence, and that is the trade this makes.**
 * The Commons marks are public domain; these are the broadcasters' own current
 * logos, shown only to identify who is showing a match, with the trademarks
 * remaining their owners'. It was chosen to match the Copa app, not because the
 * files turned out to be free — so do not cite this map as evidence that a
 * broadcaster's artwork may be copied elsewhere in the app.
 *
 * Hotlinking was the first attempt and it fails in production: Commons answers
 * a browser's third or fourth request with 429, so a reader sees some marks and
 * empty plates where the rest should be. Commons is an archive, not a CDN, and
 * throttling is the correct behaviour on their side. FIFA's extranet is no more
 * a CDN than Commons is, so its files are vendored the same way.
 *
 * A name with no entry here is not a gap to apologise for — `BroadcasterMark`
 * renders it as its own wordmark instead. That path is load-bearing, and today
 * exactly one curated channel takes it: **Record**, which neither FIFA's guide
 * nor Commons can supply.
 *
 * **Record has no free mark, and this is the record of looking rather than a
 * guess** — the search is tedious enough to be worth not repeating. Commons has
 * no national Record logo under any licence we can serve: `Category:Record (TV)`
 * holds 73 files whose only logos are `Record 4K` and `Record tv minas`, both
 * CC BY-SA and neither the network; Wikidata's `Q1458581` carries **no `P154`
 * logo image at all**, which is what a brand with no free logo looks like; and
 * the current mark exists on pt.wikipedia as a non-free upload (`Conteúdo
 * restrito`), which is fair use there and not redistributable here.
 *
 * The one CC0 file, `Logotipo da Rede Record 1981.svg`, is a **trap and not a
 * fallback.** Preferring an older public-domain version of a mark — which is
 * what SporTV and Globo carried before FIFA's logos replaced them — does not
 * reach it: that logo is rainbow arcs over a blocky wordmark, against the
 * silver sphere Record uses now, and its own uploader describes it as the mark
 * "since 1982". Shipping it would not be a dated logo, it would be a different
 * one. Leave Record as a wordmark.
 *
 * The same reasoning covers any channel CBF may add — ESPN/Disney+, Band and
 * SportyNet are the usual candidates, though none has yet appeared in
 * `broadcasts.ts`. A wordmark is the correct answer, not a placeholder.
 */
export type MarkSource =
  | {
      /** Served as `/marks/<slug>.png`. */
      slug: string;
      /** FIFA's TV-station id, read only by the sync script — see `fifaStationLogoUrl`. */
      fifa: number;
    }
  | {
      /** Served as `/marks/<slug>.png`. */
      slug: string;
      /** Wikimedia Commons file title, read only by the sync script. */
      commons: string;
    };

/** Where FIFA's broadcast guide serves a station's logo. Read by the sync, never by the page. */
export const fifaStationLogoUrl = (id: number): string =>
  `https://extranets.fifa.com/TvStationPhotos/${id}.png`;

/*
 * A note on choosing files, because search results are not evidence. Commons
 * offers a purple "GE TV" and a yellow "Logo GE TV" — both are a different
 * channel — and its "SBT logo.png" is a Ukrainian localisation union; FIFA's
 * guide also lists stations nobody here carries (NSPORTS is 892). Every entry
 * below was opened and looked at before it was trusted.
 *
 * Where a Commons mark's current version is only available under CC BY-SA, the
 * older public-domain version is used instead. A slightly dated logo is a
 * smaller cost than an attribution obligation the page does not discharge.
 */
export const MARKS: Record<string, MarkSource> = {
  GLOBO: { slug: "globo", fifa: 25 },
  GLOBOPLAY: { slug: "globoplay", fifa: 30 },
  SPORTV: { slug: "sportv", fifa: 26 },
  CAZETV: { slug: "caze-tv", fifa: 451 },
  GETV: { slug: "ge", fifa: 914 },
  GE: { slug: "ge", fifa: 914 },
  SBT: { slug: "sbt", fifa: 901 },
  PREMIERE: { slug: "premiere", commons: "Premiere FC logo.png" },
  AMAZONPRIME: { slug: "prime-video", commons: "Prime Video logo (2024).svg" },
  PRIMEVIDEO: { slug: "prime-video", commons: "Prime Video logo (2024).svg" },
  YOUTUBE: { slug: "youtube", commons: "YouTube Logo 2017.svg" },
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

/**
 * Where each broadcaster lives, keyed by `markKey` output like `MARKS`.
 *
 * **Separate from `MARKS` because the two answer different questions**: Record
 * has an address and no mark, and a link must not wait on a logo existing.
 * Each address was opened on 2026-09-15 and answered 200; where it redirected,
 * the address written here is where it landed (`sportv.globo.com` now lives at
 * `ge.globo.com/sportv/`, `recordtv.r7.com` at `record.r7.com`), so a reader is
 * not sent through a hop the broadcaster may drop.
 *
 * `YOUTUBE` is YouTube itself, deliberately: CBF names the platform, not the
 * channel carrying the match, and guessing a channel would send a reader to
 * the wrong one on the days it is not that one. GE TV, which *is* a channel,
 * gets its own (`@getv`, whose page titles itself "ge tv").
 */
export const BROADCASTER_URLS: Record<string, string> = {
  GLOBO: "https://redeglobo.globo.com/",
  GLOBOPLAY: "https://globoplay.globo.com/",
  SPORTV: "https://ge.globo.com/sportv/",
  CAZETV: "https://www.youtube.com/@CazeTV",
  GETV: "https://www.youtube.com/@getv",
  GE: "https://www.youtube.com/@getv",
  SBT: "https://www.sbt.com.br/",
  PREMIERE: "https://premiere.globo.com/",
  AMAZONPRIME: "https://www.primevideo.com/",
  PRIMEVIDEO: "https://www.primevideo.com/",
  YOUTUBE: "https://www.youtube.com/",
  RECORD: "https://record.r7.com/",
};

/** The broadcaster's own address, or null when none is recorded. */
export const broadcasterUrl = (name: string): string | null =>
  BROADCASTER_URLS[markKey(name)] ?? null;

/**
 * Channels that are deliberately shown as their own wordmark, and why.
 *
 * The set of channels is **data** — `sync-broadcasts` merges whatever CBF names
 * as the season advances — so "watch for broadcasters we render as wordmarks"
 * was a standing instruction that nothing could carry out: a new channel simply
 * appears on the page as text, which is also what a correct wordmark looks like.
 * The two are indistinguishable by eye, and that is the whole problem.
 *
 * Recording the judgement here makes the difference visible. A channel in this
 * map has been looked at and answered; one in neither map has not, and
 * `tests/broadcast-core.test.ts` fails until somebody decides which it is. The
 * fix is one line either way — a `MARKS` entry, or an entry here with the
 * reason — and that is deliberate: the point is to force the *decision*, not to
 * make adding a mark the only way to go green.
 *
 * Keys are `markKey` output, not the spelling CBF uses; a raw name here would
 * silently never match, which a test also covers.
 */
export const WORDMARK_ONLY: Record<string, string> = {
  RECORD:
    "no free national logo exists on Commons — see the note on MARKS above for " +
    "where that was searched, and why the CC0 1982 logo is not a fallback",
};
