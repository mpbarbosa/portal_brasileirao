/**
 * **Próximo jogo do meu time** — which fixture to put in front of a reader who
 * follows a club, and nothing else.
 *
 * Pure, like every other `*-core.ts`: matches in, a verdict out, and `now`
 * arrives as a parameter exactly as it does in `liveBoard` and `currentRound`.
 * Every boundary — a kickoff a minute away, a club playing right now, a season
 * with nothing left for this club — is tested without freezing time.
 *
 * Modelled on `findTeamFocus` in the sibling repo's `src/utils/teamCountdown.ts`,
 * which answers the same question for a World Cup seleção. Three things are
 * deliberately different here, and each is this repo's convention winning over
 * a straight port:
 *
 * - **The countdown is not reimplemented.** `countdownLabel` in `live-core.ts`
 *   already writes the contagem regressiva, in the words the Ao vivo page uses.
 *   The sibling ships two functions called `formatCountdown` in two modules,
 *   which is exactly the drift `StatusChip` exists to prevent.
 * - **A late fixture is still the next one.** `LATE_GRACE_MS` is reused rather
 *   than re-picked, so the strip and the Ao vivo board agree about when a
 *   fixture stops being "a seguir". Two answers to that question is how the
 *   home page comes to say a match is next while the board has dropped it.
 * - **This module decides nothing about being shown.** Whether the reader
 *   follows anybody at all is `followState`'s answer, and it stays there.
 *
 * **Not a duplicate of `nextFixture` in `club-core.ts`**, which the club page
 * uses and which answers a different question: it has no clock, so it counts a
 * POSTPONED fixture and a kickoff that passed an hour ago as still to come.
 * That is right for a club's season at a glance and wrong for a line that tells
 * a reader when to sit down. Neither should be rewritten in terms of the other
 * — the club page would gain a clock it does not want.
 */
import { clubMatches } from "@/club-core";
import { LATE_GRACE_MS } from "@/live-core";
import type { ClubCode, Match } from "@/src/types";

/**
 * What to say about a followed club's fixtures.
 *
 * `playing` is a state of its own rather than a flag on `next`, because the two
 * render differently and read differently: one is a contagem regressiva to
 * something that has not happened, the other is a score that is still moving.
 * Collapsing them into one shape with an optional score is how a live match
 * comes to be announced as starting in zero minutes.
 *
 * `none` covers a club with nothing left this season, a club whose remaining
 * fixtures are all postponed, and a payload that has not landed. The strip
 * renders the club and no fixture line in every one of them — it must not claim
 * the season is over on the strength of an empty array.
 */
export type ClubFocus =
  | { kind: "none" }
  | { kind: "playing"; match: Match }
  | { kind: "next"; match: Match };

/** The other side, from the point of view of the followed club. */
export const opponentOf = (match: Match, code: ClubCode): ClubCode =>
  match.homeCode === code ? match.awayCode : match.homeCode;

/** Whether the followed club is at home — the difference between × and a trip. */
export const isHome = (match: Match, code: ClubCode): boolean => match.homeCode === code;

/** Kickoff as an instant, or null when the string is not a date we can use. */
const kickoffAt = (match: Match): number | null => {
  const parsed = Date.parse(match.kickoff);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * The one fixture worth putting in front of somebody who follows this club.
 *
 * **A match in progress wins over one that is merely sooner**, which is not the
 * same rule as "earliest kickoff": a club can have a LIVE fixture whose kickoff
 * instant is later than a SCHEDULED one still sitting on the board because
 * upstream has not flipped it. The sibling's `findTeamFocus` orders it the same
 * way, and for the same reason — what is happening beats what is about to.
 *
 * A fixture with an unusable kickoff is still coming and still eligible; it
 * sorts last and its line reads "Horário a definir" rather than vanishing,
 * which is `liveBoard`'s rule and this repo's answer to a missing value
 * everywhere else.
 *
 * POSTPONED and CANCELLED are not fixtures a reader can plan around, so they
 * are not offered as the next one. They are not *hidden* either — they keep
 * their place in the round and on the Ao vivo board; this function simply does
 * not point at them.
 */
export const clubFocus = (
  matches: Match[],
  code: ClubCode | null | undefined,
  now: number,
): ClubFocus => {
  if (!code) return { kind: "none" };

  // `clubMatches` filters and sorts by kickoff in one place, which is where the
  // rule that an unusable kickoff sorts last already lives.
  const mine = clubMatches(matches, code);

  const playing = mine.find((match) => match.status === "LIVE");
  if (playing) return { kind: "playing", match: playing };

  const next = mine.find((match) => {
    if (match.status !== "SCHEDULED") return false;
    const at = kickoffAt(match);
    return at === null || at >= now - LATE_GRACE_MS;
  });

  return next ? { kind: "next", match: next } : { kind: "none" };
};

/** A day, for the imminence test below. */
const DAY = 24 * 60 * 60 * 1000;

/**
 * Whether the fixture is close enough that a reader would want to be told now.
 *
 * This is the whole of what makes the strip an *alert* rather than a line of
 * data, so it is one predicate in one place rather than a comparison written
 * into the component. A day is the threshold because that is the span over
 * which somebody makes a plan around a match — anything further out is a fact
 * about the calendar, and anything within it is tonight or tomorrow.
 *
 * A live match is imminent by definition; a fixture with no usable kickoff
 * never is, because the app cannot say when it starts and must not imply that
 * it is soon.
 */
export const isImminent = (focus: ClubFocus, now: number): boolean => {
  if (focus.kind === "playing") return true;
  if (focus.kind === "none") return false;

  const at = kickoffAt(focus.match);
  if (at === null) return false;
  return at - now <= DAY;
};
