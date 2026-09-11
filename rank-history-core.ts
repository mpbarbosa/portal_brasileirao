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
 * Why a computed history cannot be written — an empty list when it can.
 *
 * Two properties, both invisible once the history is drawn as a line: every club
 * has an entry for every round up to `lastRound`, and each round's positions are
 * exactly 1..N — a permutation, so no position is missing or held twice. A
 * repeated position means the table and the history disagree, and a sparkline
 * draws it without complaint.
 *
 * It lived inline in `scripts/sync-rank-history.ts`, which runs when it is
 * imported, so neither refusal was ever tested. Problems are returned rather than
 * thrown so the script keeps its own wording and exit code, and all of them are
 * reported at once.
 */
export const rankHistoryProblems = (history: ClubRankHistory[], lastRound: number): string[] => {
  const problems: string[] = [];

  for (const club of history) {
    if (club.entries.length !== lastRound) {
      problems.push(`${club.shortName} has ${club.entries.length} of ${lastRound} rounds.`);
    }
  }

  const expected = history.map((_, index) => index + 1).join(",");
  for (let round = 1; round <= lastRound; round += 1) {
    const positions = history
      .map((club) => club.entries[round - 1]?.position)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
    if (positions.join(",") !== expected) {
      problems.push(`round ${round} positions are not 1..${history.length}: ${positions.join(",")}`);
    }
  }

  return problems;
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
 * Which way a club moved between two consecutive rounds, and by how much — the
 * **variação** the Classificação prints beside the position.
 *
 * **`direction` and `places` rather than a signed number, because the sign of a
 * position is upside down.** A club going 5º → 3º *climbed*, and its position
 * *fell* by two; every call site that subtracts one position from another is one
 * `-` away from drawing the arrow backwards, and an arrow pointing the wrong way
 * is read rather than checked. `places` is therefore never negative and the
 * direction is a word, so nothing downstream does the arithmetic a second time.
 *
 * **Both ends are read through `positionAfterRound`, and that is the load-bearing
 * half.** The row's own position comes from `/api/standings`, which counts
 * `IN_PLAY` matches where this app does not — so a movement measured as *that*
 * number minus a campanha position would be a real movement plus a disagreement
 * between two sources, and it would appear and vanish as matches kick off. Read
 * off one history, the difference is a movement and nothing else. It is the rule
 * `scatterTrail` follows in taking the built scatter rather than the division.
 *
 * A round with no round before it has no movement, and neither has a club whose
 * history does not reach back that far: **null is an absence, not a zero.**
 * "Nobody had a position before the first round" and "held its place" are
 * different facts, and a caller that renders them alike says the second when it
 * means the first — `positionAfterRound`'s own rule one function up.
 *
 * Note the movement of a club that did not play in `round` is still real: the
 * table moved under it while its rivals played, and that is what the reader is
 * looking at. Nothing here filters on `played`.
 */
export type RankMovementDirection = "up" | "down" | "same";

export interface RankMovement {
  direction: RankMovementDirection;
  /** Places moved, **never negative**. Zero exactly when direction is "same". */
  places: number;
  /** Where the club stood at the end of the previous round. */
  from: number;
  /** Where it stands after `round`. */
  to: number;
}

export const rankMovement = (
  history: ClubRankHistory,
  round: number,
): RankMovement | null => {
  const to = positionAfterRound(history, round);
  const from = positionAfterRound(history, round - 1);
  if (to === null || from === null) return null;

  return {
    direction: from === to ? "same" : from > to ? "up" : "down",
    places: Math.abs(from - to),
    from,
    to,
  };
};

/**
 * The movement in words — the arrow's accessible name.
 *
 * A triangle carries the direction to anyone who can see it and nothing at all
 * to a screen reader, so the same fact is said in text, exactly as the zone rail
 * and the **Meu time** star already do in the two cells beside it.
 *
 * The count is spelled out rather than left to the glyph, because "subiu" and
 * "subiu quatro posições" are different readings and only the second is worth
 * interrupting a row for. Singular and plural genuinely differ in pt-BR and a
 * one-place move is the commonest of all, which is why `tests/` holds a case for
 * it rather than trusting the template.
 */
export const rankMovementLabel = (movement: RankMovement): string => {
  if (movement.direction === "same") return "manteve a posição";

  const verb = movement.direction === "up" ? "subiu" : "caiu";
  const places = movement.places === 1 ? "1 posição" : `${movement.places} posições`;
  return `${verb} ${places}`;
};

/**
 * The last round any club in the history has played — the x domain every
 * sparkline shares.
 *
 * Taken across the whole history rather than from one club's own entries: a
 * club with a game in hand has a shorter campanha, and scaling it to its own
 * last round would draw it on a different axis from the rest. Zero when nothing
 * has been played, which callers read as "nothing to draw yet".
 */
export const lastRecordedRound = (history: ClubRankHistory[]): number =>
  history.reduce(
    (max, club) => Math.max(max, club.entries[club.entries.length - 1]?.round ?? 0),
    0,
  );

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

export interface SparklineBar {
  x: number;
  y: number;
  width: number;
  height: number;
  round: number;
  position: number;
}

/**
 * Project a campanha onto the box as columns rather than as a line.
 *
 * Two things differ from `sparklinePoints`, and both are forced by what a bar
 * is rather than chosen for variety.
 *
 * **The x axis is a band, not a set of points.** A line joins positions taken
 * *at* the end of each round, so round 1 sits on the left edge and the last
 * round on the right; a bar occupies the whole round, so round *r* takes the
 * band `[r-1, r)` of `lastRound` and the final bar's right edge lands on the
 * right edge of the box. The two kinds therefore do not put round 5 at the same
 * x, which is correct: they are answering "where was the club at this instant"
 * and "how did the club stand through this round".
 *
 * **The y axis is a length from a baseline, not a coordinate.** A bar's meaning
 * is its length, so it needs a zero, and the zero here is the bottom of the
 * division — a club is drawn tall when it is high. That is why the denominator
 * is `clubCount` and not `clubCount - 1` as it is for the line: with the line's
 * span the last-placed club maps exactly onto the baseline and draws a bar of
 * height zero, which renders as an empty round and reads as missing data rather
 * than as 20th place. Last place is `1/clubCount` of the height — a sliver, and
 * a sliver is the honest picture of it.
 *
 * `clubCount` is floored at 1 for the same degenerate-domain reason
 * `sparklinePoints` floors its spans.
 */
export const sparklineBars = (
  entries: RankAtRound[],
  box: SparklineBox,
): SparklineBar[] => {
  const innerWidth = box.width - box.padding * 2;
  const innerHeight = box.height - box.padding * 2;
  const rounds = Math.max(1, box.lastRound);
  const clubCount = Math.max(1, box.clubCount);
  const band = innerWidth / rounds;

  // A gap of a fifth of the band, so the columns read as separate marks — but
  // never below a device pixel wide overall: at 72px across a 38-round season a
  // band is 1.8px, and a proportional gap alone would leave a bar too thin to
  // paint. The bar is centred in its band, so the gap is split either side.
  const width = Math.max(0.75, band * 0.8);

  return entries.map((entry) => {
    const value = clubCount + 1 - entry.position;
    const height = round2((value / clubCount) * innerHeight);

    return {
      x: round2(box.padding + (entry.round - 1) * band + (band - width) / 2),
      y: round2(box.padding + innerHeight - height),
      width: round2(width),
      height,
      round: entry.round,
      position: entry.position,
    };
  });
};
