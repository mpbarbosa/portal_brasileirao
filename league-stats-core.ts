/**
 * The numbers the **Classificação** implies but does not state: how many goals
 * the season has produced, how freely they are coming, how often the host wins,
 * and who has the best attack and the best defence.
 *
 * Pure, like every other `*-core` module — a fixture list and a table in,
 * figures out (tests/league-stats-core.test.ts). Every one of these is a
 * reduction over data the client already holds, so the panel costs no request.
 */
import { countsTowardStandings } from "@/standings-core";
import type { Match, StandingsRow } from "@/src/types";

export interface LeagueSummary {
  /** Matches that have actually produced a result. */
  played: number;
  goals: number;
  /** Goals per match, or null before any match has produced one. */
  goalsPerMatch: number | null;
  homeWins: number;
  /** Share of finished matches the host won, 0–100, or null with none played. */
  homeWinShare: number | null;
}

/**
 * Season totals over the fixtures that count.
 *
 * **Divided by matches *finished*, never by the fixture count.** The prototype
 * this came from prints "em 380 partidas disputadas" and divides by 380 whatever
 * the round, so its average is wrong every week but the last. `played` here is
 * the same predicate the table uses — `countsTowardStandings`, reused rather
 * than restated, so a live match counts toward neither the table nor these.
 *
 * **Nothing played is null, not zero.** A zero average would claim the season
 * is producing no goals where the truth is that it has not started; the same
 * absence-is-not-zero rule `computeRankHistory` follows by stopping at the last
 * round with a result, and `pointsPercentage` by refusing to divide by no games.
 */
export const leagueSummary = (matches: Match[]): LeagueSummary => {
  let played = 0;
  let goals = 0;
  let homeWins = 0;

  for (const match of matches) {
    if (!countsTowardStandings(match)) continue;
    played += 1;
    goals += match.homeGoals + match.awayGoals;
    if (match.homeGoals > match.awayGoals) homeWins += 1;
  }

  return {
    played,
    goals,
    goalsPerMatch: played === 0 ? null : goals / played,
    homeWins,
    homeWinShare: played === 0 ? null : (homeWins * 100) / played,
  };
};

/**
 * The clubs at the head of a goals column, longest-first for an attack and
 * fewest-first for a defence.
 *
 * **A club with no match played is left out rather than ranked at zero.** It
 * would otherwise *lead* the defence table on nothing at all — the strongest
 * form of the absence-is-not-zero trap in this file, because unlike a blank
 * average it looks like a real answer.
 *
 * Ties break on the club's name, in pt-BR collation, for `compareRows`' reason:
 * a leaderboard that reorders between renders is unreadable, and the input
 * order is the provider's rather than anything meaningful.
 */
const byGoals = (
  rows: StandingsRow[],
  pick: (row: StandingsRow) => number,
  direction: 1 | -1,
  size: number,
): StandingsRow[] =>
  rows
    .filter((row) => row.played > 0)
    .slice()
    .sort(
      (a, b) =>
        direction * (pick(b) - pick(a)) ||
        a.club.shortName.localeCompare(b.club.shortName, "pt-BR"),
    )
    .slice(0, size);

export const bestAttacks = (rows: StandingsRow[], size = 3): StandingsRow[] =>
  byGoals(rows, (row) => row.goalsFor, 1, size);

export const bestDefences = (rows: StandingsRow[], size = 3): StandingsRow[] =>
  byGoals(rows, (row) => row.goalsAgainst, -1, size);
