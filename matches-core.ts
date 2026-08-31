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
 * The memory is persisted by `match-state-store.ts`, so it survives a restart.
 * What it does not survive is the case below: a regression upstream stamps
 * *newer* than the record it destroys.
 */

/**
 * Whether `incoming` withdraws a result `kept` already carried, in the one way
 * that cannot be an honest correction.
 *
 * **This exists because the stamp comparison above was defeated in production.**
 * The regression `mergeByFreshness` was built against replayed an *older*
 * generation, so `lastUpdated` caught it. Upstream has since produced the
 * opposite shape — measured 2026-08-31T12:53:50Z, one token, straight from
 * `/v4/competitions/BSA/matches?matchday=25`:
 *
 *     554982  FINISHED  3-2   lastUpdated 2026-08-31T08:25:09Z
 *     554985  TIMED     null  lastUpdated 2026-08-31T08:25:09Z
 *     554986  TIMED     null  lastUpdated 2026-08-31T08:25:09Z
 *
 * One generation, one stamp, the result lost on two of the six records it
 * touched. Against `554986`'s good copy — `FINISHED 1-1`, stamped
 * `2026-08-30T23:37:19Z` — the broken record is nine hours **newer**, so the
 * guard working exactly as designed prefers it. Freshness is not correctness,
 * and persistence does not help: it stores the loser.
 *
 * The test is coherence, not a status ranking — which is the objection the
 * comparison above rejects, and it still stands. A record saying **a match is
 * scheduled to be played at a time that has already passed, and has no score**
 * contradicts itself, whatever it is stamped. Every genuine correction states
 * itself some other way and still wins:
 *
 * - **POSTPONED and CANCELLED** are how a played result is honestly voided,
 *   and neither is SCHEDULED. This is the case the first bullet in CLAUDE.md's
 *   `The provider regresses individual records` warns would be pinned for ever
 *   by a status ordering; it is not pinned by this.
 * - **A corrected score** arrives with goals on it, so nothing is withdrawn.
 * - **A genuine re-schedule** carries the new kickoff, which is in the future.
 *
 * A kickoff that will not parse is treated as *not* past, so upstream wins —
 * the same direction `kickoffValue` sorts it, and the conservative one for a
 * rule whose whole job is to overrule the provider.
 */
const retractsResult = (kept: Match, incoming: Match, now: number): boolean => {
  if (kept.homeGoals === null || kept.awayGoals === null) return false;
  if (incoming.homeGoals !== null || incoming.awayGoals !== null) return false;
  if (incoming.status !== "SCHEDULED") return false;

  const at = Date.parse(incoming.kickoff);
  return !Number.isNaN(at) && at < now;
};

export const mergeByFreshness = (
  previous: Match[],
  incoming: Match[],
  now: number,
): Match[] => {
  if (previous.length === 0) return incoming;

  const held = new Map(previous.map((match) => [match.id, match]));

  return incoming.map((match) => {
    const kept = held.get(match.id);
    if (!kept) return match;

    // The provider's own claim first: where it is coherent, it decides.
    if (stampOf(kept) > stampOf(match)) return kept;

    return retractsResult(kept, match, now) ? kept : match;
  });
};

/**
 * How far ahead of kickoff a fixture becomes worth asking about again.
 *
 * A day, matching `isImminent`'s lead in `next-match-core.ts`, so the two agree
 * about when a fixture starts mattering rather than drifting apart — the same
 * reason that module reuses `LATE_GRACE_MS` instead of picking its own window.
 */
const AWAIT_LEAD_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a fixture still has something to tell us, and so whether a page
 * showing it should keep asking.
 *
 * The Partida page was a snapshot of whatever arrived when the app loaded, so a
 * reader watching a match finish never saw it finish. Polling *every* match page
 * would spend requests on fixtures decided months ago, so this is the gate.
 *
 * Each branch, because none of them is arbitrary:
 *
 * - **Concluded is settled.** FINISHED and CANCELLED are the two states nothing
 *   further arrives for — `isConcluded`'s existing distinction, which
 *   deliberately excludes POSTPONED because a postponed fixture is still coming
 *   and will acquire a new kickoff worth learning about.
 * - **A kickoff already past keeps its page asking, with no late bound.** This
 *   is the state the whole thing exists for: a fixture upstream has finished but
 *   is still reporting as SCHEDULED looks exactly like this, and on 2026-08-31
 *   that lasted about five hours — so a bound of `LATE_GRACE_MS` (three) would
 *   have stopped asking an hour before the answer arrived. An abandoned fixture
 *   polling on an open tab costs nothing beyond the server's own cache, which is
 *   what actually rations the upstream request.
 * - **An unreadable kickoff keeps asking**, because "we cannot tell" is a reason
 *   to look again rather than a reason to stop.
 *
 * Takes `now` as a parameter like everything else in this file.
 */
export const isAwaitingResult = (match: Match, now: number): boolean => {
  if (isConcluded(match)) return false;
  if (match.status === "LIVE") return true;

  const at = Date.parse(match.kickoff);
  return Number.isNaN(at) || at <= now + AWAIT_LEAD_MS;
};
