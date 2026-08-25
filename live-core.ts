/**
 * The **Ao vivo** board: what is happening right now, grouped.
 *
 * Pure — no network, and no clock. `now` arrives as a parameter exactly as it
 * does in `currentRound`, so every boundary (a kickoff a minute away, a fixture
 * whose start time has just passed, a season with nothing left) is tested
 * without freezing time (tests/live-core.test.ts).
 *
 * What this deliberately does **not** compute is a match minute. The provider
 * reports a status and a score, never an elapsed clock, and elapsed-since-
 * kickoff is only the real minute until half-time — after that it overstates by
 * fifteen minutes and keeps drifting. A page that says "73'" when the truth is
 * "somewhere in the second half" is worse than one that says "bola rolando".
 */
import { compareByKickoff } from "@/matches-core";
import { countsTowardStandings } from "@/standings-core";
import type { Match } from "@/src/types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long a fixture keeps its place under "A seguir" after its kickoff
 * instant has passed without the provider flipping it to LIVE.
 *
 * Upstream is polled, not pushed, and a fixture can sit on TIMED for a while
 * after the whistle. Dropping it the second the clock passes would hide a match
 * during exactly the window this page exists for. It still wears its own
 * "A realizar" chip and its real kickoff time, so nothing is claimed that the
 * data does not say — it simply stays visible. Three hours is a match plus
 * margin; past that the fixture is stale rather than late.
 */
export const LATE_GRACE_MS = 3 * HOUR;

export interface LiveBoard {
  /** In progress right now. Empty most of the week, which is the normal case. */
  live: Match[];
  /** The next fixtures still to come, soonest first. */
  upcoming: Match[];
  /** The most recently played results, newest first. */
  recent: Match[];
}

export interface BoardLimits {
  upcoming?: number;
  recent?: number;
}

/**
 * Enough to cover a full round's worth of simultaneous kickoffs without turning
 * the page into the fixture list, which is what `/jogos` already is.
 */
export const DEFAULT_BOARD_LIMITS: Required<BoardLimits> = { upcoming: 6, recent: 6 };

/** Kickoff as an instant, or null when the string is not a date we can use. */
const kickoffAt = (match: Match): number | null => {
  const parsed = Date.parse(match.kickoff);
  return Number.isNaN(parsed) ? null : parsed;
};

/** Whether anything is being played. Drives how often the page refetches. */
export const hasLiveMatch = (matches: Match[]): boolean =>
  matches.some((match) => match.status === "LIVE");

/**
 * Split the season into "agora", "a seguir" and "últimos resultados".
 *
 * `recent` is capped by count rather than by a time window on purpose: against
 * the frozen snapshot a window would leave the section empty for months at a
 * time, and "the last six results" is true whenever it is rendered. Each row
 * carries its own date, so an old one reads as old.
 */
export const liveBoard = (
  matches: Match[],
  now: number,
  limits: BoardLimits = {},
): LiveBoard => {
  const { upcoming: upcomingLimit, recent: recentLimit } = { ...DEFAULT_BOARD_LIMITS, ...limits };

  const live = matches
    .filter((match) => match.status === "LIVE")
    .sort(compareByKickoff);

  const upcoming = matches
    .filter((match) => {
      if (match.status !== "SCHEDULED") return false;
      const at = kickoffAt(match);
      // A fixture with no usable kickoff is still coming; it sorts last and
      // renders as "Horário a definir" rather than disappearing.
      return at === null || at >= now - LATE_GRACE_MS;
    })
    .sort(compareByKickoff)
    .slice(0, upcomingLimit);

  const recent = matches
    .filter((match) => countsTowardStandings(match) && kickoffAt(match) !== null)
    .sort((a, b) => compareByKickoff(b, a))
    .slice(0, recentLimit);

  return { live, upcoming, recent };
};

const plural = (value: number, one: string, many: string): string =>
  `${value} ${value === 1 ? one : many}`;

/**
 * The **contagem regressiva** to a kickoff, in words.
 *
 * Minute granularity, because that is the resolution the page ticks at — a
 * seconds display would need a one-second timer for a number nobody reads that
 * closely. Once the instant has passed the phrase stops counting rather than
 * going negative: the fixture is late, and we cannot tell late from
 * already-underway-but-not-yet-reported.
 */
export const countdownLabel = (kickoff: string, now: number): string => {
  const at = Date.parse(kickoff);
  if (Number.isNaN(at)) return "Horário a definir";

  const remaining = at - now;
  if (remaining <= 0) return "Deve começar a qualquer momento";

  if (remaining >= DAY) {
    return `Começa em ${plural(Math.floor(remaining / DAY), "dia", "dias")}`;
  }

  const minutes = Math.ceil(remaining / MINUTE);
  if (minutes < 60) return `Começa em ${plural(minutes, "minuto", "minutos")}`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? `Começa em ${plural(hours, "hora", "horas")}`
    : `Começa em ${hours}h${String(rest).padStart(2, "0")}`;
};
