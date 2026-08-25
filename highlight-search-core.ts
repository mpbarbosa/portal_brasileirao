/**
 * highlight-search-core.ts
 * ------------------------
 * Deciding whether a YouTube result really is *this* fixture's highlights.
 *
 * Pure, like every other `*-core` module: candidates in, verdicts out, no
 * network. `scripts/find-highlights.ts` does the fetching and hands the payload
 * here, which is what lets the traps below be unit-tested against captured
 * titles instead of whatever YouTube happens to return today.
 *
 * The problem this exists to solve: searching "Internacional x Atlético-MG
 * melhores momentos" returns, from the *same* channel, a 2025 video of the same
 * clubs with the same 0-0 score in the same home-away order. Nothing in the
 * title's shape separates them. Publishing a wrong link is worse than
 * publishing none — the page already degrades to an honest search — so a
 * candidate has to earn acceptance rather than merely fail to look wrong.
 */
import type { Match } from "@/src/types";

export interface KnownChannel {
  /** YouTube's channel id, which is what identity means here. */
  id: string;
  /** The label the reader sees, spelled the way the channel spells itself. */
  label: string;
}

/**
 * The channels we link to, **in preference order**.
 *
 * Identity is the id, never the name: reupload channels style themselves after
 * the broadcaster they are copying, and a copy can vanish or be pulled.
 *
 * Order is meaning, not decoration — it is the order the links appear in on the
 * page, so the first entry is the one most readers will click. A match keeps a
 * link from every channel that covered it, because packages differ in length
 * and one may be gone when another is not; ranking decides who leads, not who
 * is allowed in.
 */
export const KNOWN_CHANNELS: KnownChannel[] = [
  { id: "UCgCKagVhzGnZcuP9bSMgMCg", label: "ge tv" },
  { id: "UCZiYbVptd3PVPf4f6eR6UaQ", label: "CazéTV" },
  { id: "UC3KHYFWeB0WimMBfm3NEahQ", label: "UOL Esporte" },
];

export const channelFor = (id: string): KnownChannel | null =>
  KNOWN_CHANNELS.find((channel) => channel.id === id) ?? null;

/** Unknown labels sort last rather than throwing, so adding a channel to the
 *  data file is the only step needed to rank it. */
const rankOf = (label: string): number => {
  const rank = KNOWN_CHANNELS.findIndex((channel) => channel.label === label);
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
};

/**
 * Broadcaster spellings that differ from our `shortName`, keyed by club code.
 *
 * Deliberately full names, never bare prefixes: "ATLETICO" alone would also
 * match Atlético-GO, and anything matching on the first four letters merges
 * Corinthians with Coritiba — the same collision that makes `tla` unusable as
 * club identity elsewhere in this repo.
 */
export const CLUB_ALIASES: Record<string, string[]> = {
  "1766": ["ATLETICOMINEIRO", "ATLETICOMG", "GALO"],
  "1768": ["ATHLETICOPARANAENSE", "ATHLETICOPR", "FURACAO"],
  "4286": ["REDBULLBRAGANTINO", "RBBRAGANTINO"],
  "4287": ["REMO"],
  "1780": ["VASCO"],
  "1767": ["GREMIO"],
  "6684": ["INTER", "INTERNACIONAL"],
  "1776": ["SAOPAULO"],
};

/**
 * Competitions that are not the Brasileirão. A cup tie between the same two
 * clubs can fall days from the league fixture, close enough that upload date
 * alone would not separate them.
 *
 * Several of these names are also *club* names — Atlético **Mineiro**,
 * Corinthians **Paulista** — so they are only ever looked for in what remains
 * after the clubs have been removed. Checking the raw title rejects every
 * Atlético-MG match as a Campeonato Mineiro tie.
 */
const OTHER_COMPETITIONS = [
  "COPADOBRASIL",
  "LIBERTADORES",
  "SULAMERICANA",
  "RECOPA",
  "MUNDIAL",
  "SUPERCOPA",
  "PAULISTA",
  "CARIOCA",
  "MINEIRO",
  "GAUCHO",
  "NORDESTE",
  "AMISTOSO",
];

/** Accents, case and punctuation all vary between channels; none of it carries
 *  meaning here. */
export const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

export interface Candidate {
  videoId: string;
  title: string;
  channelId: string;
  /** Exact instant from the watch page. Absent until confirmed — a candidate
   *  without one is never accepted, only shortlisted. */
  uploadedAt?: string;
}

export interface ParsedTitle {
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  round: number | null;
  year: number | null;
}

/**
 * Read the fixture out of a title.
 *
 * Both channels lead with the scoreline, differing only in what precedes it:
 *   ge tv    "INTERNACIONAL 0 X 0 ATLÉTICO-MG | MELHORES MOMENTOS | 24ª RODADA…"
 *   CazéTV   "MELHORES MOMENTOS: INTERNACIONAL 0 X 0 ATLÉTICO MINEIRO | BRASILEIRÃO…"
 *
 * Parsing beats substring-searching for the club names because it pins the
 * home-away *order* for free, and the reverse fixture is the single most common
 * near-miss in these results.
 */
export const parseTitle = (title: string): ParsedTitle | null => {
  const head = (title.split("|")[0] ?? "").replace(/^[^:]*MOMENTOS\s*:/i, "");

  const score = head.match(/^(.*?)(\d{1,2})\s*[xX×]\s*(\d{1,2})(.*)$/);
  if (!score) return null;

  const [, home, homeGoals, awayGoals, away] = score;
  if (!normalize(home) || !normalize(away)) return null;

  const round = title.match(/(\d{1,2})\s*ª?\s*RODADA/i);
  const year = title.match(/\b(20\d{2})\b/);

  return {
    home,
    away,
    homeGoals: Number(homeGoals),
    awayGoals: Number(awayGoals),
    round: round ? Number(round[1]) : null,
    year: year ? Number(year[1]) : null,
  };
};

/** Whether a title's club text names the club we mean. */
export const namesClub = (text: string, code: string, shortName: string): boolean => {
  const found = normalize(text);
  if (!found) return false;

  const wanted = [normalize(shortName), ...(CLUB_ALIASES[code] ?? [])];
  return wanted.some((name) => found.includes(name) || name.includes(found));
};

export const namesOtherCompetition = (title: string, parsed?: ParsedTitle | null): string | null => {
  let rest = normalize(title);
  for (const club of [parsed?.home, parsed?.away]) {
    const name = club ? normalize(club) : "";
    if (name) rest = rest.replace(name, " ");
  }

  return OTHER_COMPETITIONS.find((name) => rest.includes(name)) ?? null;
};

export interface Fixture {
  match: Match;
  homeCodeName: string;
  awayCodeName: string;
}

export type Status = "accepted" | "rejected" | "unconfirmed";

export interface Verdict {
  candidate: Candidate;
  channel: string | null;
  status: Status;
  reason: string;
  /** Signed hours between kickoff and upload. Negative means the video predates
   *  the match, which no genuine highlights package can. */
  hoursAfterKickoff: number | null;
}

/**
 * How long after kickoff a highlights package may appear.
 *
 * Both channels publish within hours of the final whistle — the calibration
 * fixture was up 2.3h after kickoff. Three days is loose enough for a late
 * upload and still far short of the next meeting between the same clubs.
 */
export const DEFAULT_WINDOW_HOURS = 72;

const hoursBetween = (fromIso: string, toIso: string): number | null => {
  // Compare instants, not strings: upload dates carry a local offset
  // ("…T16:45:31-07:00") while kickoffs are UTC, so the text of two identical
  // moments differs.
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;

  return (to - from) / 3_600_000;
};

/**
 * Judge one candidate against the fixture.
 *
 * Ordered cheapest-first, and every rejection carries its reason so a run that
 * finds nothing explains itself rather than shrugging. `unconfirmed` is the
 * important middle state: everything checkable from the search page passed, but
 * the exact upload date has not been read yet, and date is what actually
 * decides this. Treating unconfirmed as accepted is exactly the mistake that
 * publishes last season's video.
 */
export const assess = (
  candidate: Candidate,
  fixture: Fixture,
  windowHours = DEFAULT_WINDOW_HOURS,
): Verdict => {
  const { match } = fixture;
  const channel = channelFor(candidate.channelId)?.label ?? null;
  const verdict = (status: Status, reason: string, hours: number | null = null): Verdict => ({
    candidate,
    channel,
    status,
    reason,
    hoursAfterKickoff: hours,
  });

  if (!channel) return verdict("rejected", "not a rights-holder channel");

  const parsed = parseTitle(candidate.title);
  if (!parsed) return verdict("rejected", "title does not read as HOME n x n AWAY");

  const other = namesOtherCompetition(candidate.title, parsed);
  if (other) return verdict("rejected", `names another competition (${other})`);

  const homeOk = namesClub(parsed.home, match.homeCode, fixture.homeCodeName);
  const awayOk = namesClub(parsed.away, match.awayCode, fixture.awayCodeName);
  if (!homeOk || !awayOk) {
    const reversed =
      namesClub(parsed.home, match.awayCode, fixture.awayCodeName) &&
      namesClub(parsed.away, match.homeCode, fixture.homeCodeName);
    return verdict("rejected", reversed ? "reverse fixture (away side at home)" : "different clubs");
  }

  if (parsed.homeGoals !== match.homeGoals || parsed.awayGoals !== match.awayGoals) {
    return verdict(
      "rejected",
      `score ${parsed.homeGoals}-${parsed.awayGoals}, fixture was ${match.homeGoals}-${match.awayGoals}`,
    );
  }

  // Round and year are stated in most titles and cost nothing to check. They
  // catch the previous-season repeat before spending a request on its page.
  if (parsed.round !== null && parsed.round !== match.round) {
    return verdict("rejected", `round ${parsed.round}, fixture is round ${match.round}`);
  }

  const season = new Date(match.kickoff).getUTCFullYear();
  if (parsed.year !== null && parsed.year !== season) {
    return verdict("rejected", `season ${parsed.year}, fixture is ${season}`);
  }

  if (!candidate.uploadedAt) {
    return verdict("unconfirmed", "upload date not read yet");
  }

  const hours = hoursBetween(match.kickoff, candidate.uploadedAt);
  if (hours === null) return verdict("rejected", "unreadable upload date");

  if (hours < 0) {
    return verdict("rejected", `uploaded ${Math.abs(hours).toFixed(0)}h before kickoff`, hours);
  }
  if (hours > windowHours) {
    return verdict(
      "rejected",
      `uploaded ${(hours / 24).toFixed(0)} days after kickoff, window is ${windowHours / 24}`,
      hours,
    );
  }

  return verdict("accepted", `uploaded ${hours.toFixed(1)}h after kickoff`, hours);
};

/**
 * One pick per channel — the upload closest to kickoff — ordered by preference.
 *
 * A channel occasionally has both a short package and a longer one for the same
 * match, and the reader is served by one link per channel rather than two
 * labelled identically.
 */
export const bestPerChannel = (verdicts: Verdict[]): Verdict[] => {
  const best = new Map<string, Verdict>();

  for (const verdict of verdicts) {
    if (verdict.status !== "accepted" || !verdict.channel) continue;

    const current = best.get(verdict.channel);
    if (!current || (verdict.hoursAfterKickoff ?? Infinity) < (current.hoursAfterKickoff ?? Infinity)) {
      best.set(verdict.channel, verdict);
    }
  }

  // Preference order, which is also stable, so a rerun produces the same file.
  return [...best.values()].sort((a, b) => rankOf(a.channel ?? "") - rankOf(b.channel ?? ""));
};

export const watchUrl = (videoId: string): string => `https://www.youtube.com/watch?v=${videoId}`;
