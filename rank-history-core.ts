/**
 * Where every club sat in the classificação after each round — the season-long
 * campaign behind a single table row. Pure: clubs and matches in, history out
 * (tests/rank-history-core.test.ts).
 */
import { countsTowardStandings, computeStandings } from "@/standings-core";
import type { Club, ClubRankHistory, Match, RankAtRound } from "@/src/types";

/**
 * The last round that produced a result. Rounds beyond it have nothing to say —
 * a club's position "after round 30" when round 30 has not been played is not a
 * zero, it is an absence, so the history simply stops here.
 */
export const lastRoundWithResult = (matches: Match[]): number | null => {
  const played = matches.filter(countsTowardStandings).map((match) => match.round);
  return played.length ? Math.max(...played) : null;
};

/**
 * Rebuild the table after each round and read off every club's position.
 *
 * Deliberately re-runs `computeStandings` per round rather than carrying an
 * incremental tally: the tie-breakers (points, wins, goal difference, goals
 * scored, then name) are what decide a position, and duplicating that ordering
 * here is how the history would come to disagree with the table it describes.
 * Thirty-eight rounds of a twenty-club division is a few thousand operations —
 * the cost is not worth a second implementation of the CBF rules.
 *
 * A round is included as soon as it has produced any result, so a round still
 * being played shows the standings as they are — matching what the reader sees
 * in the Classificação mid-round. A club whose fixture was postponed carries
 * fewer `played` than its rivals at that round, which is also what the real
 * table shows.
 *
 * Every club gets an entry for every round, including clubs that have not yet
 * played: an empty round is twenty zeroed rows, not a gap.
 */
export const computeRankHistory = (clubs: Club[], matches: Match[]): ClubRankHistory[] => {
  const lastRound = lastRoundWithResult(matches);
  const entries = new Map<string, RankAtRound[]>(clubs.map((club) => [club.code, []]));

  for (let round = 1; lastRound !== null && round <= lastRound; round += 1) {
    const table = computeStandings(
      clubs,
      matches.filter((match) => match.round <= round),
    );

    for (const row of table) {
      entries.get(row.club.code)?.push({
        round,
        position: row.position,
        points: row.points,
        played: row.played,
      });
    }
  }

  return clubs.map((club) => ({
    clubCode: club.code,
    shortName: club.shortName,
    entries: entries.get(club.code) ?? [],
  }));
};

/**
 * The club's position after a given round, or null when the round is outside
 * the recorded history — a caller asking about round 38 in August gets an
 * absence rather than the last known position, which would read as a result.
 */
export const positionAfterRound = (
  history: ClubRankHistory,
  round: number,
): number | null => history.entries.find((entry) => entry.round === round)?.position ?? null;
