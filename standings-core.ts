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
/**
 * How deep the two bands counted from the ends of the table run — the count
 * the abbreviations G4 and Z4 carry.
 *
 * It lives here rather than beside the rail that draws it because it is a rule
 * of the competition, like the tie-breakers above, and it now has three
 * readers: `ZONES` below bounds two of its bands with it, `StandingsTable`
 * colours the rail from those bands, and `season-sim-core` counts a simulated
 * finish into a zone with it. Two copies of the number is how a projection
 * comes to report a G4 the table does not draw.
 *
 * `ZONE_DEPTH_WORD` is the same number spelled out, and travels with it for the
 * reason it always did: the legenda states the rule in prose, "as quatro
 * primeiras posições", and nothing can check the word against the digit, so
 * they sit together. Z4 is still counted in from the end of the table rather
 * than fixed at 17-20, so a division that changes size stays correct.
 */
export const ZONE_DEPTH = 4;
export const ZONE_DEPTH_WORD = "quatro";

/** The bands the Classificação paints, top to bottom. */
export type ZoneId = "g4" | "g5" | "g11" | "z4";

/**
 * Where a band sits. `top` counts down from 1st; `bottom` counts in from the
 * last row, so it stays right if the division ever changes size.
 */
export type ZoneBand =
  | { anchor: "top"; from: number; to: number }
  | { anchor: "bottom"; depth: number };

export interface Zone {
  id: ZoneId;
  /** What the legenda leads with — see `ZONES` for what a term names. */
  term: string;
  /** The prize, in the words the pt-BR press uses for it. */
  competition: string;
  /** The band in prose, which is the whole of what a colourblind reader gets. */
  where: string;
  band: ZoneBand;
}

/**
 * The qualification and relegation bands, and the single place their numbers
 * live: the rail, the legenda and every test read this literal.
 *
 * **These boundaries move between seasons, and containing that is the whole
 * reason this is one declaration rather than four conditions.** Brazil's
 * continental places are not a fixed 4/2/6. The Copa do Brasil and Libertadores
 * champions hold berths of their own, so a champion finishing outside the zone
 * slides every boundary below it up by one. What is encoded here is the 2026
 * allocation — four direct Libertadores places, **one** pré-Libertadores and
 * six Sul-Americana, so eleven continental places rather than the twelve a
 * reader may remember. Nothing in this repository can check that against the
 * CBF, and a wrong band is indistinguishable from a right one to anyone reading
 * the page: the same class of error as an invented stadium capacity. Re-reading
 * it each season is a person's job, and this literal is the one place that job
 * has to touch.
 *
 * **A term names the cumulative zone; `where` names the band the rail paints.**
 * That is the Brazilian idiom — G-4, G-6 and G-12 all count from the top — so
 * `G11` says "everything down to 11th qualifies" while its rail covers only 6th
 * to 11th. The `where` clause is what resolves that, which is the second job it
 * already had: the rail is a border colour and a border style, and the style
 * separates one band from one other — so to a red/green-colourblind reader or in
 * a grayscale capture the prose is very nearly all of it.
 *
 * In words rather than ordinals, for the reason `ZONE_DEPTH_WORD` exists and
 * because Z4 counts in from the end, where a hard-coded "17º ao 20º" would go
 * quietly wrong the moment the division changed size.
 */
export const ZONES: readonly Zone[] = [
  {
    id: "g4",
    term: "G4",
    competition: "Libertadores",
    where: `as ${ZONE_DEPTH_WORD} primeiras posições`,
    band: { anchor: "top", from: 1, to: ZONE_DEPTH },
  },
  {
    id: "g5",
    term: "G5",
    competition: "Pré-Libertadores",
    where: "a quinta posição",
    band: { anchor: "top", from: 5, to: 5 },
  },
  {
    id: "g11",
    term: "G11",
    competition: "Sul-Americana",
    where: "da sexta à décima primeira posição",
    band: { anchor: "top", from: 6, to: 11 },
  },
  {
    id: "z4",
    term: "Z4",
    competition: "Rebaixamento",
    where: `as ${ZONE_DEPTH_WORD} últimas posições`,
    band: { anchor: "bottom", depth: ZONE_DEPTH },
  },
];

const covers = (band: ZoneBand, position: number, total: number): boolean =>
  band.anchor === "top"
    ? position >= band.from && position <= band.to
    : position > total - band.depth;

/**
 * The band a position falls in, or `undefined` for the unpainted middle of the
 * table — 12th to 16th in a division of twenty.
 *
 * Relegation is asked first, and only because the answer has to be defined at
 * all: in a division small enough for the bands to overlap — ten clubs would
 * put 7th in both `g11` and `z4` — going down is the more consequential fact,
 * so it wins. At twenty nothing overlaps and the order cannot be observed.
 */
export const zoneAt = (position: number, total: number): Zone | undefined =>
  ZONES.find((zone) => zone.band.anchor === "bottom" && covers(zone.band, position, total)) ??
  ZONES.find((zone) => zone.band.anchor === "top" && covers(zone.band, position, total));

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
