/**
 * **Curiosidades da campanha** — the superlatives the Classificação contains and
 * never states: who fell furthest, who climbed furthest, who moved least, and
 * who spent most rounds in front.
 *
 * Pure like every other `*-core` module — a campanha and a table in, facts out
 * (`tests/campaign-facts-core.test.ts`). Every figure is a reduction over data
 * the client already holds, so the panel costs no request, which is the
 * argument `league-stats-core.ts` already makes for the panel beside it.
 *
 * **A tie names every club, and that is the whole reason this module exists
 * rather than a few lines in a component.** These four facts were first written
 * by hand for a video's copy, and four of them were wrong — "a maior amplitude
 * da divisão" for a club that was fourth, "menos derrotas da Série A" for the
 * runner-up, "a faixa mais estreita" for the second narrowest, and "o maior
 * número de empates" for one of two clubs level on it. Every one of those reads
 * as a fact and is a guess, and the last is the shape that matters here: a
 * superlative that silently picks one of a tie is wrong in a way nobody
 * reviewing the sentence can see. `clubs` is therefore a list, always, and the
 * component renders every name in it.
 *
 * **A tie is broken by nothing, deliberately.** Sorting by name or by position
 * to get a single winner would make the panel state a fact the data does not
 * support — and it would do it invisibly, which is exactly the failure above.
 *
 * **Rounds 1 and 2 are not special-cased, and the caveat travels with the
 * fact.** Before a club's first match the clubs level on nothing are ordered by
 * NAME, so a position from there is alphabet rather than football —
 * `rank-candles-core.ts` records the same thing about round 1's pavio and
 * refuses to hide it, because "the table really did show them there". This
 * follows that precedent: the extreme is reported as it happened, and where it
 * falls in those two rounds the fact carries `alphabetical`, which the panel
 * prints. Nothing is dropped and nothing is passed off as more than it is.
 */
import type { ClubRankHistory, StandingsRow } from "@/src/types";

/** The rounds whose ordering is alphabetical for clubs level on nothing. */
const ALPHABETICAL_ROUNDS = 2;

export interface FactClub {
  clubCode: string;
  shortName: string;
}

export interface CampaignFact {
  /** A stable handle for the specs, so they need not regex rendered prose —
   *  `LeagueStats`' `data-figure` rule, one panel over. */
  id: string;
  label: string;
  /** Every club that holds the record. More than one is a tie, and a tie is
   *  shown rather than broken. */
  clubs: FactClub[];
  /** The record itself, as a number: positions, or rounds. */
  value: number;
  unit: string;
  /** What the number is made of — "do 2º ao 20º". */
  detail: string;
  /** True where the extreme sits in the alphabetically-ordered opening rounds,
   *  so the panel can say so instead of implying it was earned on the pitch. */
  alphabetical: boolean;
}

interface Campaign {
  club: FactClub;
  positions: { round: number; position: number }[];
  best: number;
  worst: number;
  bestRound: number;
  worstRound: number;
  final: number;
  roundsInFront: number;
}

const read = (history: ClubRankHistory[]): Campaign[] =>
  history
    .filter((h) => h.entries.length > 0)
    .map((h) => {
      const positions = h.entries.map((e) => ({ round: e.round, position: e.position }));
      const best = positions.reduce((a, b) => (b.position < a.position ? b : a));
      const worst = positions.reduce((a, b) => (b.position > a.position ? b : a));
      return {
        club: { clubCode: h.clubCode, shortName: h.shortName },
        positions,
        best: best.position,
        worst: worst.position,
        bestRound: best.round,
        worstRound: worst.round,
        final: positions[positions.length - 1].position,
        roundsInFront: positions.filter((p) => p.position === 1).length,
      };
    });

/**
 * The clubs holding the maximum of `score`, and the value they hold.
 *
 * Returns **every** club at the maximum. A caller wanting one would have to
 * choose, and choosing is what this module refuses to do silently.
 */
const leaders = <T>(
  items: T[],
  score: (item: T) => number,
  direction: "max" | "min" = "max",
): { winners: T[]; value: number } | null => {
  if (items.length === 0) return null;
  const scores = items.map(score);
  const value = direction === "max" ? Math.max(...scores) : Math.min(...scores);
  return { winners: items.filter((item) => score(item) === value), value };
};

const ordinal = (position: number) => `${position}º`;

/**
 * The facts, in the order the panel prints them.
 *
 * A fact whose record is zero is **dropped rather than rendered**: "a maior
 * queda foi de 0 posições" is not a curiosity, it is a season nobody has played
 * yet — the absence rule `computeRankHistory` follows for a round with no
 * result.
 */
export const campaignFacts = (
  history: ClubRankHistory[],
  rows: StandingsRow[] = [],
): CampaignFact[] => {
  const campaigns = read(history);
  const facts: CampaignFact[] = [];

  const push = (
    id: string,
    label: string,
    unit: string,
    found: { winners: Campaign[]; value: number } | null,
    detail: (c: Campaign) => string,
    extremeRound: (c: Campaign) => number,
    /** A record of zero is dropped for a maximum — "a maior queda foi de 0
     *  posições" is a season nobody has played rather than a curiosity. For a
     *  MINIMUM zero is the record itself: a club that never moved. */
    keepZero = false,
  ) => {
    if (!found) return;
    if (found.value < 0 || (found.value === 0 && !keepZero)) return;
    facts.push({
      id,
      label,
      clubs: found.winners.map((c) => c.club),
      value: found.value,
      unit,
      // One club's detail where the record is held alone; a tie has no single
      // reading, so it says how many share it rather than picking one.
      detail:
        found.winners.length === 1
          ? detail(found.winners[0])
          : `${found.winners.length} clubes empatados`,
      alphabetical: found.winners.some((c) => extremeRound(c) <= ALPHABETICAL_ROUNDS),
    });
  };

  push(
    "maior-queda",
    "Maior queda",
    "posições",
    leaders(campaigns, (c) => c.final - c.best),
    (c) => `do ${ordinal(c.best)} ao ${ordinal(c.final)}`,
    (c) => c.bestRound,
  );
  push(
    "maior-subida",
    "Maior subida",
    "posições",
    leaders(campaigns, (c) => c.worst - c.final),
    (c) => `do ${ordinal(c.worst)} ao ${ordinal(c.final)}`,
    (c) => c.worstRound,
  );
  push(
    "campanha-mais-estavel",
    "Campanha mais estável",
    "posições",
    // A MINIMUM, and the only one here. It went in first as a negated maximum,
    // which the `value <= 0` guard above then dropped in silence — the fact
    // never rendered and nothing said so. `leaders` takes a direction instead.
    leaders(campaigns, (c) => c.worst - c.best, "min"),
    (c) => `entre o ${ordinal(c.best)} e o ${ordinal(c.worst)}`,
    (c) => c.bestRound,
    true,
  );
  push(
    "mais-rodadas-na-ponta",
    "Mais rodadas na ponta",
    "rodadas",
    leaders(campaigns, (c) => c.roundsInFront),
    (c) => (c.final === 1 ? "e ainda lidera" : `hoje em ${ordinal(c.final)}`),
    () => Number.POSITIVE_INFINITY,
  );

  // The one fact that comes from the table rather than the campanha. It is here
  // because it belongs to the same panel, and because it is where the tie that
  // taught this module its rule actually was.
  const draws = leaders(rows, (r) => r.draws);
  if (draws && draws.value > 0) {
    facts.push({
      id: "mais-empates",
      label: "Mais empates",
      clubs: draws.winners.map((r) => ({ clubCode: r.club.code, shortName: r.club.shortName })),
      value: draws.value,
      unit: "empates",
      detail:
        draws.winners.length === 1
          ? `em ${draws.winners[0].played} jogos`
          : `${draws.winners.length} clubes empatados`,
      alphabetical: false,
    });
  }

  return facts;
};
