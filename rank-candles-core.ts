/**
 * The **Painel do clube**: one club's season drawn as candles, one per rodada.
 *
 * A candle answers a question the campanha line cannot. The line joins the
 * positions a club held at the end of each round, so a round is a single point
 * and everything that happened inside it is invisible — a club that sat 4th on
 * Saturday night and finished the round 9th because three rivals played on
 * Sunday draws the same segment as one that walked calmly from 5th to 9th.
 * The candle keeps both facts apart: the **body** runs from where the round
 * opened to where it closed, and the **pavio** spans every position the club
 * held at any point while the round was being played.
 *
 * Pure, like every other `*-core` module: clubs and matches in, candles out
 * (tests/rank-candles-core.test.ts). It reads the clock from the fixtures'
 * kickoffs and never from `Date.now()`.
 *
 * **Nothing here re-implements a ranking rule.** The position, the points and
 * the per-match result each come from the module that owns them —
 * `computeStandings` for the table, `resultFor` for a club's own result — for
 * the reason `computeRankHistory` re-runs the table rather than carrying an
 * incremental tally: a second implementation of the CBF tie-breakers is how a
 * drawing comes to disagree with the table it describes.
 */
import { playsIn, resultFor } from "@/club-core";
import { lastRoundWithResult } from "@/rank-history-core";
import { computeStandings, countsTowardStandings, ZONE_DEPTH } from "@/standings-core";
import type {
  Club,
  ClubCandles,
  ClubCode,
  FormResult,
  Match,
  RoundCandle,
} from "@/src/types";

/** One club's position, points and games played at a single instant. */
interface Standing {
  position: number;
  points: number;
  played: number;
}

const snapshot = (clubs: Club[], matches: Match[]): Map<ClubCode, Standing> =>
  new Map(
    computeStandings(clubs, matches).map((row) => [
      row.club.code,
      { position: row.position, points: row.points, played: row.played },
    ]),
  );

/**
 * The instants a round's table moved at: the distinct kickoffs of its finished
 * matches, in order.
 *
 * Distinct rather than one per match, because a Brazilian round puts several
 * fixtures on the same clock — four matches at 16:00 on a Saturday resolve
 * together, and treating them as four steps would invent three intermediate
 * tables that nobody ever saw.
 */
const kickoffInstants = (matches: Match[]): string[] =>
  [...new Set(matches.map((match) => match.kickoff))].sort();

/**
 * Every club's candles, oldest round first.
 *
 * The whole division in one pass, mirroring `computeRankHistory`, because the
 * expensive half is global: a club's position at an instant depends on what
 * every other club had done by then, so computing one club's candles costs the
 * same as computing all twenty.
 *
 * **What is counted at each step is the round's own state, never the wall
 * clock**, and that distinction is load-bearing. A partial table inside round
 * *r* counts *everything from rounds before r* plus *the matches of round r
 * that have kicked off by this instant*. Filtering on kickoff alone would let a
 * postponed round-3 fixture played in June drop out of the table at the start
 * of round 20 — the club would appear to fall several places and climb back, a
 * swing that never happened, because `open` (the previous round's close) counts
 * that fixture and a wall-clock filter would not. With the round convention the
 * last partial of a round is exactly its close, by construction.
 *
 * Cost is `computeStandings` once per distinct kickoff instant rather than once
 * per round. Measured on a season played to the last round — 192 distinct
 * kickoffs across 380 fixtures — that is 41ms cold and about 13ms warm, against
 * 2.8ms for `computeRankHistory` over the 24-round seed. Ten times the campanha
 * and still one `useMemo`, which is the trade `computeRankHistory` already made
 * when it chose to re-run the table rather than carry a tally.
 */
export const computeRankCandles = (clubs: Club[], matches: Match[]): ClubCandles[] => {
  const lastRound = lastRoundWithResult(matches);
  const finished = matches.filter(countsTowardStandings);
  const series = new Map<ClubCode, RoundCandle[]>(clubs.map((club) => [club.code, []]));

  /** The previous round's close — this round's open. Null before round 1. */
  let previous: Map<ClubCode, Standing> | null = null;

  for (let round = 1; lastRound !== null && round <= lastRound; round += 1) {
    const before = finished.filter((match) => match.round < round);
    const during = finished.filter((match) => match.round === round);

    const partials = kickoffInstants(during).map((instant) =>
      snapshot(clubs, [...before, ...during.filter((match) => match.kickoff <= instant)]),
    );
    // The last partial already is the close; a round whose fixtures were all
    // postponed has no partial at all, and its close is simply the table as the
    // round began — flat, which is what a round nobody played looks like.
    const close = partials[partials.length - 1] ?? snapshot(clubs, before);

    for (const club of clubs) {
      const end = close.get(club.code);
      if (!end) continue;

      const start = previous?.get(club.code);
      // Round 1 has no previous close, and the table before a ball is kicked is
      // twenty clubs level on nothing — an alphabetical list, not a ranking. So
      // the first round opens where it closes and draws no body.
      const open = start?.position ?? end.position;
      const seen = [open, end.position, ...partials.map((table) => table.get(club.code)!.position)];
      const playedThisRound = end.played - (start?.played ?? 0);
      const ownMatches = during.filter((match) => playsIn(match, club.code));

      series.get(club.code)?.push({
        round,
        open,
        close: end.position,
        // Named for the reader's axis, not for a trader's: 1º is the top of the
        // chart, so `best` is the numerically smallest position and it is drawn
        // above `worst`. Calling them high and low would put the "high" at the
        // bottom of the drawing for anyone reading the numbers.
        best: Math.min(...seen),
        worst: Math.max(...seen),
        // A round the club did not play has no points — an absence, not a zero,
        // the same distinction `pointsPercentage` and `computeRankHistory` make.
        points: playedThisRound === 0 ? null : end.points - (start?.points ?? 0),
        totalPoints: end.points,
        played: end.played,
        // Null for a round the club did not play, and also for the anomaly of
        // two counted fixtures in one round: a single V/E/D cannot describe two
        // results, and the colour it drives would be a guess. `points` still
        // reports the whole of what was taken.
        result: ownMatches.length === 1 ? resultFor(ownMatches[0], club.code) : null,
      });
    }

    previous = close;
  }

  return clubs.map((club) => ({
    clubCode: club.code,
    shortName: club.shortName,
    candles: series.get(club.code) ?? [],
  }));
};

/** One club's candles out of the division's, or an empty series. */
export const candlesFor = (all: ClubCandles[], code: ClubCode): RoundCandle[] =>
  all.find((entry) => entry.clubCode === code)?.candles ?? [];

/**
 * How many places the club moved in the round: positive climbed, negative fell.
 *
 * Written as open minus close because the axis is inverted — going from 9th to
 * 4th is a rise of five, and the arithmetic that says so is the subtraction
 * that looks backwards.
 */
export const placesMoved = (candle: RoundCandle): number => candle.open - candle.close;

export interface CandleBox {
  width: number;
  height: number;
  /**
   * Horizontal inset only, so the first and last candles are not clipped.
   *
   * **There is deliberately no vertical inset.** The y axis is the whole
   * division and its two ends are labelled *outside* the drawing, in HTML
   * beside it — an inset here would leave "1º" pointing at empty space above
   * the first position's band rather than at the band itself.
   */
  padding: number;
  /** Size of the division: the y domain is 1..clubCount, **1 at the top**. */
  clubCount: number;
  /** The x domain, rounds 1..lastRound. */
  lastRound: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CandleShape {
  round: number;
  /** From the better of open and close to the worse of them, band-inclusive. */
  body: Rect;
  /** Every position held during the round. Equal to the body when nothing
   *  happened in between, in which case it is simply invisible behind it. */
  wick: Rect;
  /**
   * The stub that marks which end of the body the round opened at.
   *
   * Without it the body says only "the club was somewhere between 4th and 9th",
   * and a candle's whole point is direction. Colour cannot carry it here
   * because colour carries the **result** — a club can win and still fall a
   * place, which is exactly the sort of round this chart exists to show.
   */
  openTick: Rect;
  candle: RoundCandle;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Project a club's candles onto the box.
 *
 * **A position is a band, never a point**, and both marks use that one
 * convention. The body spans from the top edge of the best of `open`/`close` to
 * the bottom edge of the worst; the pavio spans `best` to `worst` the same way.
 * So every mark reads as *the set of positions the club occupied*, and a round
 * where nothing moved is one band tall rather than nothing at all — the same
 * argument `sparklineBars` makes for its baseline: a zero-height mark reads as
 * missing data, and "held 5th all round" is not missing data.
 *
 * Both domains are the caller's, as they are for the campanha: `clubCount` is
 * the size of the division rather than the number of clubs that happen to have
 * a candle, so the chart does not silently rescale itself when a club has a
 * game in hand.
 */
export const candleShapes = (candles: RoundCandle[], box: CandleBox): CandleShape[] => {
  const innerWidth = box.width - box.padding * 2;
  const rounds = Math.max(1, box.lastRound);
  const clubCount = Math.max(1, box.clubCount);
  const band = innerWidth / rounds;
  const row = box.height / clubCount;

  // A fifth of the band either side, so the candles read as separate marks —
  // and never thinner than a device pixel, which 38 rounds inside a phone-width
  // box would otherwise produce.
  const bodyWidth = Math.max(1, band * 0.62);
  const wickWidth = Math.max(0.75, band * 0.16);
  const tickWidth = Math.max(0.75, band * 0.19);
  const tickHeight = Math.max(0.75, Math.min(2, row * 0.25));

  const top = (position: number): number => round2((position - 1) * row);
  const bottom = (position: number): number => round2(position * row);

  return candles.map((candle) => {
    const bodyX = round2(box.padding + (candle.round - 1) * band + (band - bodyWidth) / 2);
    const bodyTop = top(Math.min(candle.open, candle.close));
    const bodyBottom = bottom(Math.max(candle.open, candle.close));
    const wickTop = top(candle.best);
    const wickBottom = bottom(candle.worst);

    return {
      round: candle.round,
      body: {
        x: bodyX,
        y: bodyTop,
        width: round2(bodyWidth),
        height: round2(bodyBottom - bodyTop),
      },
      wick: {
        x: round2(bodyX + (bodyWidth - wickWidth) / 2),
        y: wickTop,
        width: round2(wickWidth),
        height: round2(wickBottom - wickTop),
      },
      openTick: {
        x: round2(bodyX - tickWidth),
        y: round2((candle.open - 0.5) * row - tickHeight / 2),
        width: round2(tickWidth),
        height: round2(tickHeight),
      },
      candle,
    };
  });
};

/**
 * Where the G4 and Z4 lines fall on the box.
 *
 * `ZONE_DEPTH` comes from `standings-core` rather than from a 4 written here,
 * for the reason it was moved there in the first place: two copies of the
 * number is how a chart comes to draw a G4 the table does not.
 *
 * `z4` is null for a division too small to have two distinct zones — nothing to
 * draw, rather than a line drawn on top of the other one.
 */
export const zoneGuides = (box: CandleBox): { g4: number; z4: number | null } => {
  const clubCount = Math.max(1, box.clubCount);
  const row = box.height / clubCount;

  return {
    g4: round2(Math.min(ZONE_DEPTH, clubCount) * row),
    z4: clubCount > ZONE_DEPTH * 2 ? round2((clubCount - ZONE_DEPTH) * row) : null,
  };
};

export interface CandleSummary {
  /** The highest the club has been, and the first round it was there. */
  best: { position: number; round: number };
  worst: { position: number; round: number };
  /** The sharpest single-round climb and fall, or null where none happened. */
  rise: { places: number; round: number } | null;
  fall: { places: number; round: number } | null;
  /** Points after the last recorded round, and how many rounds that is. */
  points: number;
  rounds: number;
}

/**
 * The figures the painel prints beside the chart.
 *
 * Read off the candles rather than recomputed from the fixtures, so the tiles
 * and the drawing cannot disagree — a page that says "melhor: 3º" above a chart
 * whose pavio never reaches 3rd is worse than a page with no tiles.
 *
 * `best` and `worst` scan the pavios, not the closes: a club that touched 2nd
 * on a Saturday and finished every round 5th or lower really did reach 2nd, and
 * the round column of this table is the whole reason the chart is candles.
 * Ties resolve to the **earliest** round, so the answer does not move as the
 * season repeats a position.
 */
export const summariseCandles = (candles: RoundCandle[]): CandleSummary | null => {
  if (candles.length === 0) return null;

  let best = { position: candles[0].best, round: candles[0].round };
  let worst = { position: candles[0].worst, round: candles[0].round };
  let rise: { places: number; round: number } | null = null;
  let fall: { places: number; round: number } | null = null;

  for (const candle of candles) {
    if (candle.best < best.position) best = { position: candle.best, round: candle.round };
    if (candle.worst > worst.position) worst = { position: candle.worst, round: candle.round };

    const moved = placesMoved(candle);
    if (moved > 0 && moved > (rise?.places ?? 0)) rise = { places: moved, round: candle.round };
    if (moved < 0 && -moved > (fall?.places ?? 0)) fall = { places: -moved, round: candle.round };
  }

  const last = candles[candles.length - 1];
  return { best, worst, rise, fall, points: last.totalPoints, rounds: last.round };
};

const RESULT_WORD: Record<FormResult, string> = {
  V: "vitória",
  E: "empate",
  D: "derrota",
};

/**
 * pt-BR sentence for one candle — the hover title, and the only version of the
 * mark that reaches a screen reader or a forced-colours display.
 *
 * It names the movement in words rather than leaving it to the geometry,
 * because "subiu duas" is the fact and the rectangle is only a picture of it.
 */
export const describeCandle = (candle: RoundCandle): string => {
  const moved = placesMoved(candle);
  const direction =
    moved > 0
      ? `subiu ${moved} ${moved === 1 ? "posição" : "posições"}`
      : moved < 0
        ? `caiu ${-moved} ${-moved === 1 ? "posição" : "posições"}`
        : "manteve a posição";

  const parts = [
    `${candle.round}ª rodada: ${candle.open}º → ${candle.close}º, ${direction}`,
  ];

  // Only worth saying when the round went somewhere the two ends do not
  // already cover — otherwise it repeats the sentence just read out.
  if (candle.best < Math.min(candle.open, candle.close)) {
    parts.push(`chegou a ${candle.best}º`);
  }
  if (candle.worst > Math.max(candle.open, candle.close)) {
    parts.push(`caiu até ${candle.worst}º`);
  }
  if (candle.result) {
    parts.push(`${RESULT_WORD[candle.result]} (${candle.points} ${candle.points === 1 ? "ponto" : "pontos"})`);
  } else if (candle.points === null) {
    parts.push("sem jogo na rodada");
  }

  return `${parts.join(", ")}.`;
};

/**
 * pt-BR summary of a whole painel, for the chart's accessible name.
 *
 * The same duty `describeCampaign` performs for the sparkline: a drawing of a
 * season is not readable by a screen reader and not readable at all where the
 * marks do not render, so the shape of it is stated in words.
 *
 * **`name` is what makes a comparação legible without eyes.** Two velas drawn
 * on one page carry two summaries of the same shape, and unnamed they differ
 * only in their figures — a screen reader hears "Campanha rodada a rodada: 25
 * rodadas, 52 pontos…" twice and has nothing to hang either on. It is optional
 * rather than required because a painel drawing one club has already said
 * whose season it is, in the page heading and in the section's, and repeating
 * it in the chart's own name is the heading a third time.
 */
export const describeCandles = (candles: RoundCandle[], name?: string): string => {
  const summary = summariseCandles(candles);
  // Named even in the absence, for the reason the named branch exists at all:
  // a comparison whose second club has no campanha yet must say *which* club
  // has none, or the sentence describes the page rather than a drawing.
  if (!summary) {
    return name ? `Campanha do ${name} ainda não disponível` : "Campanha ainda não disponível";
  }

  const last = candles[candles.length - 1];
  const subject = name ? `Campanha do ${name} rodada a rodada` : "Campanha rodada a rodada";
  return (
    `${subject}: ${summary.rounds} rodadas, ${summary.points} pontos, ` +
    `${last.close}º na ${last.round}ª rodada. ` +
    `Melhor: ${summary.best.position}º na ${summary.best.round}ª. ` +
    `Pior: ${summary.worst.position}º na ${summary.worst.round}ª.`
  );
};
