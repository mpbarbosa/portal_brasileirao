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

/**
 * Whether a match carries a scoreline: both goal counts reported.
 *
 * Tested against `null` and never for truthiness, because `0` is a score — a
 * 0-0 is exactly the match a truthiness check drops. It says nothing about the
 * status: a LIVE match carries a partial score, and a SCHEDULED record carries
 * one when upstream regresses its status, which is what `withPlayedStatus`
 * repairs. `countsTowardStandings` is this plus FINISHED.
 *
 * One predicate because it was written out eight times, three of them in
 * components, and a copy that tests one side only is how a page comes to print
 * `2 × null`.
 */
export const hasScore = (
  match: Match,
): match is Match & { homeGoals: number; awayGoals: number } =>
  match.homeGoals !== null && match.awayGoals !== null;

/**
 * Kickoff as an instant, or null when the string is not a date we can use.
 *
 * Exported because `live-core.ts` and `next-match-core.ts` each carried an
 * identical private copy of it.
 */
export const kickoffAt = (match: Match): number | null => {
  const parsed = Date.parse(match.kickoff);
  return Number.isNaN(parsed) ? null : parsed;
};

/** Chronological within a round; invalid kickoff strings sort last. */
const kickoffValue = (match: Match): number => kickoffAt(match) ?? Number.POSITIVE_INFINITY;

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

/**
 * The `?round=` of `/api/matches`: a positive integer, or null for anything
 * else. The caller decides what an absent parameter means; this only judges one
 * that was sent.
 *
 * Read through `Number`, as the route always has, so `"3"` is round 3 while
 * `""`, `"0"`, `"-1"`, `"2.5"` and `"abc"` are refused — and so is a repeated
 * parameter, which Express hands over as an array.
 */
export const parseRoundParam = (raw: unknown): number | null => {
  const round = Number(raw);
  return Number.isInteger(round) && round >= 1 ? round : null;
};

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

/** Exactly midnight UTC — the instant a date with no time parses to. */
const atMidnightUtc = (kickoff: string): boolean => {
  const at = new Date(kickoff);
  if (Number.isNaN(at.getTime())) return false;
  return (
    at.getUTCHours() === 0 &&
    at.getUTCMinutes() === 0 &&
    at.getUTCSeconds() === 0 &&
    at.getUTCMilliseconds() === 0
  );
};

/**
 * Mark the fixtures whose round the provider has dated but not timed, so the page can print the
 * day without inventing an hour.
 *
 * football-data serves a round it holds no times for as every fixture at exactly `00:00Z`. Read
 * in Brasília that is **21:00 the previous day** — a precise, plausible, entirely fictional
 * kickoff, which is `live-core.ts`'s refusal to print a match minute met on a larger surface: 80
 * fixtures of the 2026 season, the whole of rounds 31 to 38.
 *
 * **The test is the round's and not the fixture's, and that is the whole decision.** 21:00 BRT is
 * one of the commonest kickoff times in Brazil, so `00:00Z` alone is more often a real fixture
 * than a placeholder. Measured rather than assumed: 18 fixtures outside rounds 31-38 sit at
 * `00:00Z`, ten of them already played, and each is the only such fixture in a round carrying
 * five to seven distinct hours. Suppressing per fixture would delete those ten kickoffs — São
 * Paulo x Palmeiras of round 8 among them — to repair a round nobody has scheduled yet.
 *
 * So a round qualifies only when **every** one of its fixtures sits on that midnight, which no
 * scheduled round in the season does at any hour.
 *
 * **A round of one is never marked**, because a single fixture is no evidence either way and the
 * honest answer to "cannot tell" is to print what upstream said. Not hypothetical tidiness:
 * `/api/matches?round=` and every client-side filter hand this a subset.
 *
 * Reads no clock, unlike its neighbours here — what the provider stated does not change with the
 * hour.
 */
export const withKickoffPrecision = (matches: Match[]): Match[] => {
  const dateOnly = new Map<number, boolean>();
  const counted = new Map<number, number>();
  for (const match of matches) {
    const held = dateOnly.get(match.round);
    dateOnly.set(match.round, held !== false && atMidnightUtc(match.kickoff));
    counted.set(match.round, (counted.get(match.round) ?? 0) + 1);
  }

  return matches.map((match) =>
    dateOnly.get(match.round) && (counted.get(match.round) ?? 0) > 1
      ? { ...match, kickoffDateOnly: true }
      : match,
  );
};

/**
 * A record that carries a scoreline for a kickoff already past is **not
 * scheduled**, whatever the provider says — so this repairs the status rather
 * than the score.
 *
 * **It exists because `retractsResult` cannot reach the shape production
 * actually served.** That rule refuses an incoming record with *no* score; on
 * 2026-09-07 upstream served the opposite — nine of round 26's ten fixtures as
 * `SCHEDULED` **with both goals present**, kickoffs two days past, `source:
 * football-data`, read off the live API. Every page then read it back: Jogos
 * badged nine played matches *A realizar*, Ao vivo dropped the round out of
 * Últimos resultados entirely and fell back to fixtures a fortnight old, and
 * the club page offered a match from 30/08 as *Próximo jogo* — while the
 * Classificação, which is upstream's own table, went on counting them as
 * played. The two halves of one provider disagreed and the app rendered both.
 *
 * **Widening `retractsResult` instead was the obvious fix and is the wrong
 * one, for two independent reasons.**
 *
 * It would not have repaired what was live. `mergeByFreshness`' output is what
 * `rememberMatches` persists, so the first fill that accepted the incoherent
 * record **overwrote the held FINISHED copy** — the "it stores the loser"
 * failure `CLAUDE.md` already records for the stamp comparison. A rule that
 * only ever prefers a *held* record has nothing left to prefer, and a cold
 * start has nothing at all.
 *
 * And it would pin a genuine correction. A corrected scoreline is exactly how
 * an honest amendment states itself — 2-3 becoming 2-4 — so refusing every
 * scored record that arrives under a SCHEDULED status would hold the stale
 * score for ever. Repairing keeps the provider's freshest *claim* and fixes
 * only the field that contradicts it.
 *
 * **It is coherence and not a status ranking**, which is the objection
 * `mergeByFreshness` documents and does not work around: nothing here compares
 * two records or decides that FINISHED outranks SCHEDULED. It reads one record
 * and observes that a scoreline is upstream's own assertion that the match was
 * played, which a kickoff in the future could not be — so the clock is what
 * makes this safe, and it arrives as a parameter like everywhere else.
 *
 * **It repairs the merge's OUTPUT, and applying it to the incoming records
 * instead is the mistake this shipped with.** `mergeByFreshness` returns a
 * strictly-newer *held* copy unmodified, so a record decided on stamp never
 * passes through a repair placed upstream of it — and the host's held state
 * had already stored the incoherent records before the fix arrived, which is
 * exactly the "it stores the loser" failure one function down. Production
 * therefore went on serving ten SCHEDULED records with the fix live and
 * `/api/health` reporting the right commit. Reproduced from one held record
 * and one incoming record: repaired before the merge that fixture stays
 * SCHEDULED, repaired after it reads FINISHED.
 *
 * Deliberately narrow. A LIVE record keeps its status, because a match being
 * played has a score and is not finished; POSTPONED and CANCELLED are how a
 * result is genuinely voided and are untouched; a score against a kickoff still
 * in the future is left alone, since nothing here knows it was played; and an
 * unparseable kickoff counts as *not* past, the direction `retractsResult`
 * already fails in.
 */
export const withPlayedStatus = (matches: Match[], now: number): Match[] =>
  matches.map((match) => {
    if (match.status !== "SCHEDULED") return match;
    if (!hasScore(match)) return match;

    const at = Date.parse(match.kickoff);
    if (Number.isNaN(at) || at >= now) return match;

    return { ...match, status: "FINISHED" };
  });

/**
 * Whether `incoming` withdraws a result `kept` already carried, in the one way
 * that cannot be an honest correction.
 *
 * **This exists because the stamp comparison in `mergeByFreshness` was defeated
 * in production.**
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
 * comparison in `mergeByFreshness` rejects, and it still stands. A record saying **a match is
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
  if (!hasScore(kept)) return false;
  if (incoming.homeGoals !== null || incoming.awayGoals !== null) return false;
  if (incoming.status !== "SCHEDULED") return false;

  const at = Date.parse(incoming.kickoff);
  return !Number.isNaN(at) && at < now;
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
 * What it does not survive is the case `retractsResult` exists for: a
 * regression upstream stamps *newer* than the record it destroys.
 */
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
