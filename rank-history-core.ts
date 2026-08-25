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

/**
 * Geometry for a campanha sparkline. Both domains are supplied by the caller
 * rather than read off the club's own entries, and that is the whole point: a
 * row-per-club table is a set of small multiples, so every sparkline must share
 * one scale. Auto-fitting each club to its own range would draw a side rattling
 * between 1st and 3rd with the same amplitude as one climbing from 20th to 5th.
 */
export interface SparklineBox {
  width: number;
  height: number;
  /** Inset on all sides, so the stroke and the end dot are not clipped. */
  padding: number;
  /** Size of the division: the y domain is 1..clubCount, **1 at the top**. */
  clubCount: number;
  /** The x domain is rounds 1..lastRound, shared by every club. */
  lastRound: number;
}

export interface SparklinePoint {
  x: number;
  y: number;
  round: number;
  position: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Project a campanha onto the box. The y axis is **inverted** — position 1 sits
 * at the top, because a line that climbs must mean a club that climbed.
 *
 * The denominators are floored at 1 for the degenerate domains (a single round
 * played, a one-club division), which would otherwise divide by zero and put
 * every point at NaN — an invisible failure, since an SVG with a malformed
 * `points` attribute simply draws nothing.
 */
export const sparklinePoints = (
  entries: RankAtRound[],
  box: SparklineBox,
): SparklinePoint[] => {
  const innerWidth = box.width - box.padding * 2;
  const innerHeight = box.height - box.padding * 2;
  const roundSpan = Math.max(1, box.lastRound - 1);
  const positionSpan = Math.max(1, box.clubCount - 1);

  return entries.map((entry) => ({
    x: round2(box.padding + ((entry.round - 1) / roundSpan) * innerWidth),
    y: round2(box.padding + ((entry.position - 1) / positionSpan) * innerHeight),
    round: entry.round,
    position: entry.position,
  }));
};

/** The `points` attribute of an SVG `<polyline>`. */
export const sparklinePolyline = (points: SparklinePoint[]): string =>
  points.map((point) => `${point.x},${point.y}`).join(" ");

/**
 * pt-BR summary of a campanha, for the sparkline's accessible name and its
 * hover title. A drawing of a trajectory is not readable by a screen reader and
 * not readable at all in forced-colours mode, so the same fact is stated in
 * words: where the club started, the best it reached, and where it is now.
 */
export const describeCampaign = (entries: RankAtRound[]): string => {
  if (entries.length === 0) return "Campanha ainda não disponível";

  const first = entries[0];
  const last = entries[entries.length - 1];
  const best = entries.reduce((a, b) => (b.position < a.position ? b : a));

  const at = (entry: RankAtRound) => `${entry.position}º na ${entry.round}ª rodada`;
  const summary = `Campanha: ${at(first)}, ${at(last)}`;

  // Only worth saying when the peak is not already one of the two endpoints —
  // otherwise it repeats what was just read out.
  return best.position < Math.min(first.position, last.position)
    ? `${summary}. Melhor: ${at(best)}`
    : summary;
};
