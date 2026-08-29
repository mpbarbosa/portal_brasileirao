/**
 * Pure standings computation. No network, no I/O — matches in, table out — so
 * the ranking rules can be unit-tested directly (tests/standings-core.test.ts).
 */
import type { Club, ClubCode, Match, StandingsRow } from "@/src/types";

const POINTS_FOR_WIN = 3;
const POINTS_FOR_DRAW = 1;

interface Tally {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

const emptyTally = (): Tally => ({
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
});

/**
 * A match counts toward the table only when it is FINISHED and carries both
 * scores. A LIVE match with a partial score does not — the CBF table moves only
 * on the final whistle, and counting live scores would make positions flicker.
 */
export const countsTowardStandings = (
  match: Match,
): match is Match & { homeGoals: number; awayGoals: number } =>
  match.status === "FINISHED" && match.homeGoals !== null && match.awayGoals !== null;

const applyResult = (tally: Tally, scored: number, conceded: number): void => {
  tally.played += 1;
  tally.goalsFor += scored;
  tally.goalsAgainst += conceded;

  if (scored > conceded) {
    tally.wins += 1;
  } else if (scored === conceded) {
    tally.draws += 1;
  } else {
    tally.losses += 1;
  }
};

const pointsOf = (tally: Tally): number =>
  tally.wins * POINTS_FOR_WIN + tally.draws * POINTS_FOR_DRAW;

/**
 * Série A tie-breakers, in the order the CBF regulation applies them: points,
 * then wins, then goal difference, then goals scored.
 *
 * The regulation continues past this point (head-to-head, fewest red cards,
 * fewest yellows, then a draw), but those need data this app does not carry
 * yet. Clubs still level after goals scored are ordered by name so the table is
 * at least deterministic rather than dependent on input order.
 */
export const compareRows = (a: StandingsRow, b: StandingsRow): number =>
  b.points - a.points ||
  b.wins - a.wins ||
  b.goalDifference - a.goalDifference ||
  b.goalsFor - a.goalsFor ||
  a.club.shortName.localeCompare(b.club.shortName, "pt-BR");

/**
 * Build the full table. Every club appears, including those with no finished
 * match yet — an empty round should render 20 zeroed rows, not an empty table.
 */
export const computeStandings = (clubs: Club[], matches: Match[]): StandingsRow[] => {
  const tallies = new Map<ClubCode, Tally>(clubs.map((club) => [club.code, emptyTally()]));

  for (const match of matches) {
    if (!countsTowardStandings(match)) continue;

    const home = tallies.get(match.homeCode);
    const away = tallies.get(match.awayCode);
    // A fixture referencing a club outside `clubs` is dropped rather than
    // throwing: one bad row upstream should not blank the whole table.
    if (!home || !away) continue;

    applyResult(home, match.homeGoals, match.awayGoals);
    applyResult(away, match.awayGoals, match.homeGoals);
  }

  return clubs
    .map((club) => {
      const tally = tallies.get(club.code) ?? emptyTally();
      return {
        position: 0,
        club,
        ...tally,
        goalDifference: tally.goalsFor - tally.goalsAgainst,
        points: pointsOf(tally),
      };
    })
    .sort(compareRows)
    .map((row, index) => ({ ...row, position: index + 1 }));
};

/**
 * **Aproveitamento** — the share of the points a club could have taken that it
 * actually took, `pontos / (jogos × 3)`, as a percentage.
 *
 * The metric a Brazilian reader quotes by default: ge and CBF both print it,
 * and "70% de aproveitamento" is an ordinary sentence about a club. It is also
 * the one column that survives a **postponed fixture** honestly — a club a game
 * short reads as worse than it is in P and correctly here, which is the same
 * argument `RankAtRound` already makes by carrying `played`.
 *
 * It is derived rather than stored on `StandingsRow` on purpose: `/api/standings`
 * serves upstream's own table when the provider is reachable and the computed
 * one otherwise, and a derived value cannot disagree with the two numbers it is
 * read from whichever of those arrived.
 *
 * **A club with no game played has no aproveitamento, and that is an absence
 * rather than a zero** — 0% is what a club that has played and taken nothing
 * reads as, and the two are different claims. Null, for the reason the
 * artilharia renders an unreported tally as an em dash and `computeRankHistory`
 * stops at the last round with a result.
 */
export const pointsPercentage = (row: Pick<StandingsRow, "points" | "played">): number | null =>
  row.played === 0 ? null : (row.points * 100) / (row.played * POINTS_FOR_WIN);

/**
 * The aproveitamento as it reaches the page: a whole number and a `%`, or null
 * where there is nothing to report.
 *
 * Whole rather than one decimal because that is how ge prints it in a table,
 * and because the figure is a summary — a tenth of a percentage point is
 * precision the reader does not act on, in a column that costs table width to
 * widen. The rounding cannot manufacture a 100%: 38 rounds put the closest
 * non-perfect campaign at 98.2%.
 */
export const pointsPercentageLabel = (
  row: Pick<StandingsRow, "points" | "played">,
): string | null => {
  const share = pointsPercentage(row);
  return share === null ? null : `${Math.round(share)}%`;
};
