import type { Match } from "@/src/types";

/**
 * The kickoff as a reader sees it — in **their** zone rather than the payload's UTC, because a
 * clock time is only useful in the one the reader is standing in.
 *
 * Two forms rather than a `long` flag, which is `serialisePreferences`' rule: a boolean at a call
 * site is easy to pass wrong and impossible to see. The short form is a fixture row; the long one
 * is the Partida page's own line.
 *
 * **It is here because it was written three times.** `MatchList`, `MeuTime` and `MatchPage` each
 * carried a copy, the first two byte-identical, and the rule below adds a branch to all three —
 * which is how a fixture comes to print an invented hour on one page and the truth on another.
 * `StatusChip`'s reason, one field over.
 *
 * **And it is here rather than in `matches-core.ts`, where the judgement it reads lives.**
 * `player-core.ts` writes its twelve month names out by hand instead of asking `Intl`, and says
 * why: the answer is whatever ICU the host was built against, a moving target across Node
 * releases which on a trimmed container image may be `en` with no error at all. A core module
 * carries unit tests, so a pinned "ter., 28/07" would fail on a machine the code is correct on —
 * and `countdownLabel` builds its strings by hand for that reason. Components already depend on
 * ICU and are not unit-tested against it, so the dependency stays exactly where it was; only the
 * triplication goes.
 *
 * `kickoffDateOnly` is what drops the hour; `withKickoffPrecision` is where the round rule behind
 * it is argued. An unparseable kickoff keeps the wording the three copies already used.
 *
 * **A dated fixture is read in UTC, and getting that wrong replaces a fake hour with a wrong
 * day.** Where the provider states a time, `00:00Z` is an instant and the reader's zone is the
 * right frame for it. Where it states none, the value is a **calendar date** wearing an instant's
 * clothes — and Brasília is three hours behind, so rendering round 33's `2026-10-24T00:00:00Z`
 * locally prints *sex., 23/10*. Dropping the hour exists to stop printing what upstream never
 * said; shifting the date back to do it would be the same fault wearing the fix's name.
 */
const label = (match: Match, date: Intl.DateTimeFormatOptions): string => {
  const parsed = new Date(match.kickoff);
  if (Number.isNaN(parsed.getTime())) return "Horário a definir";

  return parsed.toLocaleString(
    "pt-BR",
    match.kickoffDateOnly ? { ...date, timeZone: "UTC" } : { ...date, hour: "2-digit", minute: "2-digit" },
  );
};

/** A fixture row: "ter., 28/07, 21:00", or "sáb., 24/10" where the round states no time. */
export const kickoffLabel = (match: Match): string =>
  label(match, { weekday: "short", day: "2-digit", month: "2-digit" });

/** The Partida page's line: "terça-feira, 28 de julho de 2026 às 21:00". */
export const kickoffLabelLong = (match: Match): string =>
  label(match, { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
