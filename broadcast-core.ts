/**
 * Pure broadcast attachment. No I/O — the curated map goes in, matches carrying
 * their channels come out (tests/broadcast-core.test.ts).
 */
import { findClub, slugify } from "@/club-core";
import type { Club, Match } from "@/src/types";

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

/** Our match id for a CBF fixture, or null when it cannot be identified. */
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

  // Compare instants, not strings: football-data returns "…T23:00:00Z" while
  // toISOString() produces "…T23:00:00.000Z". Same moment, different text.
  const wanted = Date.parse(kickoff);
  const found = matches.filter(
    (match) => Date.parse(match.kickoff) === wanted && match.homeCode === home.code,
  );

  return found.length === 1 ? found[0].id : null;
};
