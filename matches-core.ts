/**
 * Pure match-list helpers. No network, no I/O (tests/matches-core.test.ts).
 */
import type { Match, MatchStatus } from "@/src/types";

const STATUS_ORDER: Record<MatchStatus, number> = {
  LIVE: 0,
  SCHEDULED: 1,
  POSTPONED: 2,
  FINISHED: 3,
  CANCELLED: 4,
};

/**
 * A match that will never be played again. Distinct from "not finished":
 * a postponed match is still coming, a cancelled one is not — so only
 * CANCELLED joins FINISHED here, otherwise a cancelled fixture would pin
 * `currentRound` to its round forever.
 */
export const isConcluded = (match: Match): boolean =>
  match.status === "FINISHED" || match.status === "CANCELLED";

/** Chronological within a round; invalid kickoff strings sort last. */
const kickoffValue = (match: Match): number => {
  const parsed = Date.parse(match.kickoff);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
};

export const compareByKickoff = (a: Match, b: Match): number =>
  kickoffValue(a) - kickoffValue(b) || a.id.localeCompare(b.id);

/**
 * Order for the match list: live matches first, then upcoming, then finished —
 * what a reader opening the app mid-round wants at the top.
 */
export const compareForFeed = (a: Match, b: Match): number =>
  STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || compareByKickoff(a, b);

export const matchesForRound = (matches: Match[], round: number): Match[] =>
  matches.filter((match) => match.round === round).sort(compareByKickoff);

export const roundsOf = (matches: Match[]): number[] =>
  [...new Set(matches.map((match) => match.round))].sort((a, b) => a - b);

/**
 * The round to show by default, given the current time.
 *
 * Takes `now` rather than reading the clock so it stays pure and testable.
 *
 * Deliberately NOT "the earliest round with an unfinished match": a postponed
 * fixture can sit unplayed for months, which pinned the default view to round 4
 * in August against real data. Precedence:
 *   1. a round with a match in progress — that is the round being played;
 *   2. the round of the next fixture still to come;
 *   3. the last round that produced a result (season over, or every remaining
 *      fixture is a stale postponement).
 */
export const currentRound = (matches: Match[], now: number): number | null => {
  const rounds = roundsOf(matches);
  if (rounds.length === 0) return null;

  const live = matches.find((match) => match.status === "LIVE");
  if (live) return live.round;

  const upcoming = matches
    .filter((match) => !isConcluded(match) && kickoffValue(match) >= now)
    .sort(compareByKickoff)[0];
  if (upcoming) return upcoming.round;

  const played = matches
    .filter((match) => match.status === "FINISHED")
    .map((match) => match.round);

  return played.length ? Math.max(...played) : rounds[rounds.length - 1];
};

/**
 * The provider's own claim about when a record was last touched, as a number.
 *
 * Absent or unparseable reads as *no claim at all* rather than as zero, so it
 * loses every comparison — including against another record with no claim,
 * where `-Infinity > -Infinity` is false and the incoming copy therefore wins.
 * That is deliberate: with nothing to compare, the behaviour has to collapse
 * back to "the newest response wins", which is what this app did before the
 * merge existed.
 */
const stampOf = (match: Match): number => {
  const parsed = match.lastUpdated ? Date.parse(match.lastUpdated) : Number.NaN;
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
};

/**
 * Keep the freshest copy the provider has given of each fixture.
 *
 * football-data regresses **individual records**, which is the whole reason
 * this exists and the reason the obvious cheaper fixes do not work. Measured on
 * 2026-08-31, one URL, one token, four minutes apart:
 *
 *     554986  00:38 -> FINISHED 1-1  lastUpdated 2026-08-30T23:37:19Z
 *     554986  00:42 -> TIMED   null  lastUpdated 2026-08-30T10:20:34Z
 *     554982  00:38 -> FINISHED 3-2  lastUpdated 2026-08-31T00:32:15Z
 *     554982  00:42 -> FINISHED 3-2  lastUpdated 2026-08-31T00:40:35Z
 *
 * The last row is the finding: in the response that regressed one fixture by
 * thirteen hours, a second fixture moved *forward*. So the responses are not
 * two whole snapshots alternating, and "prefer the newer response" would still
 * have shown a finished match as `A realizar`. The comparison has to be per
 * fixture, and against the provider's own stamp rather than against a status
 * ordering of our own invention — `lastUpdated` is what upstream **said**,
 * where "FINISHED outranks SCHEDULED" is a guess about what it meant, and one
 * that would pin a genuine correction (a result voided to POSTPONED) forever.
 *
 * `incoming` decides which fixtures exist. A record held only in `previous` is
 * never resurrected: a fixture upstream has genuinely dropped must be able to
 * disappear, and this function's job is to choose between two copies of one
 * record, not to defend the shape of the list.
 *
 * It holds only for the life of the process, which is the honest bound — a
 * restart starts from whatever the first fill returns, so a deploy landing
 * mid-round can still serve one stale record until upstream next reports it.
 */
export const mergeByFreshness = (previous: Match[], incoming: Match[]): Match[] => {
  if (previous.length === 0) return incoming;

  const held = new Map(previous.map((match) => [match.id, match]));

  return incoming.map((match) => {
    const kept = held.get(match.id);
    return kept && stampOf(kept) > stampOf(match) ? kept : match;
  });
};
