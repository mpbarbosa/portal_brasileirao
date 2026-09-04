/**
 * Exports what one Manim scene needs: ONE club's campanha as candles, plus the
 * points it carried into and out of each rodada.
 *
 * The two siblings here export the campanha as a *line* — `export-campanhas.ts`
 * two clubs' positions, `export-pontos.ts` twenty clubs' points. A line joins
 * the position held at the END of each round, so a round is one point and its
 * inside is invisible: a club that sat 4th on Saturday night and finished the
 * round 9th because three rivals played on Sunday draws the same segment as one
 * that walked calmly down. That is the whole reason this third payload exists,
 * and it is `rank-candles-core.ts`'s argument, not a new one.
 *
 *   npx tsx scripts/manim/export-velas.ts [clubCode] > scripts/manim/velas.json
 *
 * Defaults to Fluminense (`1765`) — the provider's numeric code, never the
 * `tla`, because Corinthians and Coritiba both report "COR".
 *
 * **Nothing here computes a candle.** `computeRankCandles` is the one
 * implementation, shared with the Painel the site serves, so a figure wrong in
 * this video is wrong on the site too — which is exactly what a divulgação
 * piece should be. No I/O beyond reading the frozen seed and writing one JSON
 * file, the same split every `*-core.ts` module draws.
 */
import { CLUBS } from "@/src/data/clubs";
import { SEED_MATCHES, SNAPSHOT_DATE } from "@/src/data/matches";
import { playsIn, resultFor } from "@/club-core";
import { candlesFor, computeRankCandles, placesMoved } from "@/rank-candles-core";

const [code = "1765"] = process.argv.slice(2);

const club = CLUBS.find((c) => c.code === code);
if (!club) throw new Error(`unknown club code ${code}`);

const candles = candlesFor(computeRankCandles(CLUBS, SEED_MATCHES), code);
if (candles.length === 0) throw new Error(`no candles for ${club.shortName}`);

const rounds = candles.map((candle) => {
  // The club plays at most one fixture per round; a postponed one leaves none,
  // which is why `match` is nullable rather than assumed — the same shape
  // `export-campanhas.ts` uses, and the reason the card can say "sem jogo".
  const match =
    SEED_MATCHES.find(
      (m) =>
        m.round === candle.round &&
        playsIn(m, code) &&
        m.homeGoals !== null &&
        m.awayGoals !== null,
    ) ?? null;

  const home = match ? match.homeCode === code : null;
  const opponentCode = match ? (home ? match.awayCode : match.homeCode) : null;
  const opponent = opponentCode ? CLUBS.find((c) => c.code === opponentCode) : null;
  if (opponentCode && !opponent) throw new Error(`unknown opponent ${opponentCode}`);

  return {
    round: candle.round,
    // The candle, verbatim from the core module. `best` is the numerically
    // SMALLEST position and is drawn above `worst`, because 1º is the top of
    // the chart — named for the reader's axis rather than for a trader's.
    open: candle.open,
    close: candle.close,
    best: candle.best,
    worst: candle.worst,
    // Points taken in the round, null where the club did not play: an absence,
    // not a zero. `totalPoints` is the tally after it.
    points: candle.points,
    totalPoints: candle.totalPoints,
    played: candle.played,
    result: candle.result,
    // Positive climbed, negative fell. Exported rather than derived in Python
    // so the subtraction that looks backwards is written once, where the test
    // suite can see it.
    moved: placesMoved(candle),
    match: match
      ? {
          opponent: opponent!.shortName,
          home,
          goalsFor: home ? match.homeGoals : match.awayGoals,
          goalsAgainst: home ? match.awayGoals : match.homeGoals,
          result: resultFor(match, code),
        }
      : null,
  };
});

process.stdout.write(
  JSON.stringify(
    {
      snapshot: SNAPSHOT_DATE,
      club: { code, name: club.shortName, tla: club.tla },
      rounds,
    },
    null,
    2,
  ) + "\n",
);
