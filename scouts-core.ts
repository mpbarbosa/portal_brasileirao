import type { ClubCode, ClubScouts } from "@/src/types";

/**
 * scouts-core — the **perfil do clube**: what kind of side this is, from the
 * per-action counters in `src/data/club-scouts.ts`.
 *
 * It exists because the campanha answers *where* a club is and nothing in this
 * app answers *how it plays*. A side 20th in finalizações and 4th in conversão
 * is a whole identity in two rows, and neither the table nor the velas can say
 * it.
 *
 * Pure, like every `*-core` module here: counters in, rows out. It reads no
 * clock, because unlike `liveBoard` and `clubFocus` nothing here is a claim
 * about now — the counters carry the round they were measured through.
 *
 * **It computes rates and never restates a result.** Gols, gols sofridos and
 * pontos have authoritative answers in `/api/standings` and `src/data/goals.ts`,
 * and the scout copy of each is measurably worse (the sync script records by how
 * much). `goals` is carried here only as the numerator of the conversion rate,
 * which is a fact about *shooting* rather than a scoreline.
 */

/** The metrics the perfil is made of, in the order the strip renders them. */
export type ScoutMetricId =
  | "finishes"
  | "conversion"
  | "tackles"
  | "fouls"
  | "cards"
  | "saves";

export interface ProfileRow {
  id: ScoutMetricId;
  /** pt-BR, and the whole of what says which way the figure runs. */
  label: string;
  value: number;
  /** How the value is written: a rate per match, or a percentage. */
  unit: "por-jogo" | "porcento";
  /** 1 is the division's highest value. Ties share a rank, so 1, 2, 2, 4. */
  rank: number;
  /** How many clubs were ranked — the `de 20` half of `3º de 20`. */
  of: number;
  /** The division's lowest value for this metric — the track's left end. */
  min: number;
  /** The division's highest — the track's right end. */
  max: number;
  /** The division's middle, drawn as a reference tick on the track. */
  median: number;
}

/**
 * Every finalização, which is four counters rather than three.
 *
 * A goal is the fourth outcome of a shot, not a separate event — the source
 * files it under `G` and stops counting it as a shot — so a total that omits it
 * understates exactly the clubs that score, and makes conversão exceed 100% for
 * a good enough side.
 */
export function finishes(scouts: ClubScouts): number {
  return scouts.goals + scouts.shotsSaved + scouts.shotsOff + scouts.shotsWoodwork;
}

/**
 * One club's raw value for one metric, or null where it cannot be computed.
 *
 * Null is an **absence** and is dropped from the strip rather than drawn as a
 * zero — the rule `computeRankHistory` follows for a round with no result. A
 * club with no matches counted has no rate, and that is not the same fact as a
 * club that fouls nobody.
 */
function rawValue(scouts: ClubScouts, id: ScoutMetricId): number | null {
  if (scouts.matches <= 0) return null;
  const per = (total: number) => total / scouts.matches;

  switch (id) {
    case "finishes":
      return per(finishes(scouts));
    case "conversion": {
      const shots = finishes(scouts);
      // Not `shots || null`: a club really can have taken no shot at all early
      // in a season, and 0/0 is an absence rather than 0%.
      return shots > 0 ? (100 * scouts.goals) / shots : null;
    }
    case "tackles":
      return per(scouts.tackles);
    case "fouls":
      return per(scouts.foulsCommitted);
    case "cards":
      return per(scouts.yellowCards + scouts.redCards);
    case "saves":
      return per(scouts.saves);
  }
}

const METRICS: { id: ScoutMetricId; label: string; unit: ProfileRow["unit"] }[] = [
  { id: "finishes", label: "Finalizações", unit: "por-jogo" },
  { id: "conversion", label: "Conversão", unit: "porcento" },
  { id: "tackles", label: "Desarmes", unit: "por-jogo" },
  { id: "fouls", label: "Faltas cometidas", unit: "por-jogo" },
  { id: "cards", label: "Cartões", unit: "por-jogo" },
  { id: "saves", label: "Defesas do goleiro", unit: "por-jogo" },
];

/**
 * The perfil of one club, read against the division it plays in.
 *
 * The whole division is required rather than optional: a rate on its own says
 * nothing — 13 desarmes a game is either the most or the least in the league
 * and the number cannot tell you which. That is the same argument
 * `computeRankCandles` makes for computing twenty clubs to draw one.
 *
 * Returns an empty list where this club has no counters, so the caller omits
 * the section rather than rendering six dashes.
 */
export function clubProfile(division: ClubScouts[], clubCode: ClubCode): ProfileRow[] {
  const mine = division.find((entry) => entry.clubCode === clubCode);
  if (!mine) return [];

  const rows: ProfileRow[] = [];

  for (const metric of METRICS) {
    const value = rawValue(mine, metric.id);
    if (value === null) continue;

    // Every club that has a value for this metric, so a club yet to play is
    // absent from the ranking rather than sorted to the bottom of it.
    const values = division
      .map((entry) => rawValue(entry, metric.id))
      .filter((entry): entry is number => entry !== null);

    // Competition ranking: how many clubs are strictly above, plus one. Ties
    // therefore share a place — two clubs level on faltas are both 5º, and the
    // next is 7º, which is how a league table reads a tie.
    const rank = values.filter((other) => other > value).length + 1;

    const sorted = [...values].sort((a, b) => a - b);

    rows.push({
      id: metric.id,
      label: metric.label,
      unit: metric.unit,
      value,
      rank,
      of: values.length,
      min: sorted[0] ?? value,
      max: sorted[sorted.length - 1] ?? value,
      median: median(sorted),
    });
  }

  return rows;
}

/** The middle of an already-sorted list; the mean of the two middles if even. */
function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const half = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[half] ?? 0;
  return ((sorted[half - 1] ?? 0) + (sorted[half] ?? 0)) / 2;
}

/**
 * Where along the division's own range this value sits, 0 at the lowest club
 * and 1 at the highest.
 *
 * **A marker on a range, and deliberately not a bar from zero** — the two are
 * different marks and only one of them works here. A bar's meaning is its
 * *length*, so it needs a zero, which is the rule `sparklineBars` states and
 * the reason last place there draws a sliver rather than nothing. Measured
 * against these metrics, that rule produces a strip nobody can read: from zero,
 * the twenty clubs' conversão bars occupy **65% to 100%** of the track and the
 * whole division looks alike. The information is in the spread, and the spread
 * is the part a zero-based bar throws away.
 *
 * A marker's meaning is its *position*, so it owes no zero — and 20th sits at
 * the left end of the track rather than at nothing, which is the failure the
 * zero rule exists to prevent, reached by the other road.
 *
 * The track's ends are the division's own floor and ceiling, so they move as
 * the season does. That is the point: the question is not *how many desarmes*
 * but *many compared with whom*, and the only honest answer is the twenty clubs
 * actually playing.
 */
export function markerFraction(row: ProfileRow): number {
  const span = row.max - row.min;
  // Every club level on a metric: there is no position to report, so the marker
  // sits in the middle rather than at an end, which would claim a leader.
  if (span <= 0) return 0.5;
  return Math.min(1, Math.max(0, (row.value - row.min) / span));
}

/** Where the division's median sits on the same track. */
export function medianFraction(row: ProfileRow): number {
  const span = row.max - row.min;
  if (span <= 0) return 0.5;
  return Math.min(1, Math.max(0, (row.median - row.min) / span));
}

/**
 * `3º de 20`. Written here rather than in the component because the strip is
 * not the only place a rank will be read, and two spellings of an ordinal is
 * how the Painel and a future card come to disagree about a tie.
 */
export function rankLabel(row: ProfileRow): string {
  return `${row.rank}º de ${row.of}`;
}

/**
 * The value as the reader sees it: one decimal for a rate, none for a
 * percentage.
 *
 * pt-BR decimal comma, via `toLocaleString` rather than a hand-rolled replace —
 * the app already renders numbers this way and a second convention here would
 * show `11.7` beside `11,7` on the same page.
 *
 * It takes the two fields it reads rather than a whole `ProfileRow`, so the
 * scatter — which has a value and a unit and no rank — can write its figures
 * through this and not through a second copy of the same three lines.
 */
export function valueLabel(row: Pick<ProfileRow, "unit" | "value">): string {
  if (row.unit === "porcento") {
    return `${row.value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
  }
  return row.value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * One axis's value in words — "10,4 finalizações por jogo", "18% de conversão".
 *
 * **The unit decides the sentence, not just the number.** "por jogo" is true of
 * every rate and false of a percentage, and the component used to append it
 * unconditionally because both of its axes were rates. A caption reading "18%
 * de conversão por jogo" is wrong in a way that reads as a typo and is actually
 * a claim about what the figure counts.
 */
export function axisPhrase(axis: ScatterAxis, value: number): string {
  const { figure, noun } = axisFigure(axis, value);
  return `${figure} ${noun}`;
}

/**
 * The same reading with the number kept apart from the words around it, so a
 * caption can set a figure at one weight and its unit at another.
 *
 * **`axisPhrase` composes from this and not the other way round.** The caption
 * needs the two halves separately, and recovering them by splitting the
 * finished sentence on its first space is how "3,1 defesas do goleiro por jogo"
 * comes to render `3,1 defesas` as the figure. One function decides how a
 * reading is worded, so what a caption prints and what a `<title>` states
 * cannot drift.
 *
 * `noun` carries the unit's own preposition — "de conversão" against
 * "finalizações por jogo" — for `axisPhrase`'s reason: the unit decides the
 * sentence, not just the number.
 */
export function axisFigure(
  axis: ScatterAxis,
  value: number,
): { figure: string; noun: string } {
  const figure = valueLabel({ unit: axis.unit, value });
  const noun = axis.label.toLowerCase();
  return { figure, noun: axis.unit === "porcento" ? `de ${noun}` : `${noun} por jogo` };
}

/** The axis itself in words, for the label printed beside the drawing. */
export function axisCaption(axis: ScatterAxis): string {
  return axis.unit === "porcento" ? axis.label : `${axis.label} por jogo`;
}

/* --------------------------------------------------- ataque × defesa ------ */

/**
 * The scatter beneath the strip: twenty clubs on two axes at once.
 *
 * It exists because the strip reports six rates **one at a time**, and the fact
 * worth seeing is a *pair*. A club shooting often and defending a busy goal is
 * playing an open game; one shooting as often with an idle keeper is
 * controlling matches. Those two sit in the same place on every row of the
 * strip and in opposite corners here.
 *
 * **Finalizações against defesas do goleiro**, which is one attacking rate and
 * one defensive one measured on the same denominator. Note what the y axis
 * actually counts, because the label says it and this comment must not claim
 * more: a *save*, not a shot faced. A leaky defence in front of a beaten
 * goalkeeper reads lower than the pressure on it really was. It is a proxy and
 * the honest way to ship a proxy is to label it as what it counts — the rule
 * `providerLabel` follows in naming what is configured rather than what is
 * working.
 */
export interface ScatterAxis {
  id: ScoutMetricId;
  label: string;
  /** How the value is written, so a caption cannot print `18` for 18%. */
  unit: ProfileRow["unit"];
  /** The domain's ends, already padded — not the division's raw floor. */
  min: number;
  max: number;
  /** The division's median, and where it falls in the padded domain. */
  median: number;
  medianAt: number;
}

export interface ScatterPoint {
  clubCode: ClubCode;
  x: number;
  y: number;
  /** Position in the padded domain, 0 at `min` and 1 at `max`. */
  atX: number;
  atY: number;
  /** The club whose Painel this is. Exactly one point carries it. */
  subject: boolean;
}

export interface ProfileScatter {
  pair: ScatterPairId;
  /** The pairing's name, ready to render. */
  title: string;
  x: ScatterAxis;
  y: ScatterAxis;
  points: ScatterPoint[];
}

/**
 * Six per cent of the span at each end.
 *
 * **A padded domain, not the raw one.** Unpadded, the division's highest and
 * lowest clubs land exactly on the frame, so half of each of those marks is
 * drawn outside the box — the failure `RankCandles` records for a drawing that
 * paints past the card it sits in, one mark down. It also leaves a reader
 * unable to tell "at the edge of the division" from "clipped".
 */
const PAD = 0.06;

function axis(
  division: ClubScouts[],
  id: ScoutMetricId,
  label: string,
): ScatterAxis | null {
  const values = division
    .map((entry) => rawValue(entry, id))
    .filter((value): value is number => value !== null);
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const low = sorted[0] ?? 0;
  const high = sorted[sorted.length - 1] ?? 0;
  // A division level on this metric has no span to pad, so give it one rather
  // than dividing by zero — every club then sits mid-axis, claiming no leader,
  // which is `markerFraction`'s answer to the same state.
  const pad = high > low ? PAD * (high - low) : 1;

  const min = low - pad;
  const max = high + pad;
  const middle = median(sorted);

  const unit = METRICS.find((metric) => metric.id === id)?.unit ?? "por-jogo";

  return {
    id,
    label,
    unit,
    min,
    max,
    median: middle,
    medianAt: (middle - min) / (max - min),
  };
}

/**
 * Every club placed on the two axes, or null where the drawing would say
 * nothing.
 *
 * Null rather than an empty figure below **three** clubs: a scatter is a
 * statement about a *distribution*, and two dots and a median line is a chart
 * shaped like an argument nobody can make. The section omits it and keeps the
 * strip, the same way a club with no counters gets no Perfil at all.
 */
/**
 * A pairing the Painel draws, and the words its four corners need.
 *
 * **The corner phrases travel with the pair rather than living in
 * `quadrantLabel`.** Two pairings share one drawing and share nothing else:
 * "jogo aberto" is meaningless on an axis of conversão, and a switch inside the
 * label function is how the second pairing comes to describe the first one's
 * corners. Adding a third pairing is then an entry here and no edit anywhere.
 *
 * Every phrase stays **descriptive rather than appraising**, which is the rule
 * `CONTEXT.md` states for the first pairing and which bites harder on this one:
 * conversão sounds like a virtue, so "melhor ataque" is one word away and is a
 * verdict two rates cannot support.
 */
/**
 * A corner in two pieces: what it is called, and what it means on these axes.
 *
 * **Two fields rather than one sentence**, because the page gives them
 * different weight — the term is the reading a scanning eye should land on and
 * the gloss is the sentence that explains it. Stored apart rather than split at
 * the call site: a component recovering them from `"jogo aberto: finaliza
 * muito"` by cutting at the colon is one editorial comma away from printing
 * half a phrase as a heading.
 *
 * Both stay **descriptive rather than appraising**, which is `ScatterPair`'s
 * rule for the whole set and bites hardest on the term, since a two-word name
 * set in the page's own ink is exactly where a verdict would look at home.
 */
export interface QuadrantPhrase {
  /** The corner's name — "jogo aberto". Lowercase: it is read mid-sentence too. */
  term: string;
  /** What it means here — "finaliza muito e o goleiro trabalha muito". */
  gloss: string;
}

/**
 * A corner as the drawing needs it: where it is, and what it is called.
 *
 * `aboveX`/`aboveY` are the club's side of each median — which is what places
 * the tint and the label — and the phrase is what the words say. They travel
 * together because they are one reading of one club, and splitting them across
 * two functions is what would let the picture and the prose disagree.
 */
export interface Quadrant {
  aboveX: boolean;
  aboveY: boolean;
  phrase: QuadrantPhrase;
}

export interface ScatterPair {
  id: ScatterPairId;
  x: ScoutMetricId;
  y: ScoutMetricId;
  /**
   * What the drawing is called — `CONTEXT.md`'s own name for the pairing.
   *
   * **It belongs here rather than at the call site** for the reason the corner
   * phrases do: two pairings share one component, and a title passed in as a
   * prop is a second place a pairing gets named, free to drift from the
   * glossary. The two names existed in `CONTEXT.md` before the page rendered
   * either of them.
   */
  title: string;
  xLabel: string;
  yLabel: string;
  /** Named for the axes a club is above the median on, never for a rank. */
  corners: {
    both: QuadrantPhrase;
    xOnly: QuadrantPhrase;
    yOnly: QuadrantPhrase;
    neither: QuadrantPhrase;
  };
}

export type ScatterPairId = "ataque-defesa" | "volume-conversao";

export const SCATTER_PAIRS: Record<ScatterPairId, ScatterPair> = {
  "ataque-defesa": {
    id: "ataque-defesa",
    title: "Ataque × defesa",
    x: "finishes",
    y: "saves",
    xLabel: "Finalizações",
    yLabel: "Defesas do goleiro",
    corners: {
      both: { term: "jogo aberto", gloss: "finaliza muito e o goleiro trabalha muito" },
      xOnly: {
        term: "jogo controlado",
        gloss: "finaliza muito e o goleiro trabalha pouco",
      },
      yOnly: { term: "jogo recuado", gloss: "finaliza pouco e o goleiro trabalha muito" },
      neither: {
        term: "jogo fechado",
        gloss: "finaliza pouco e o goleiro trabalha pouco",
      },
    },
  },
  "volume-conversao": {
    id: "volume-conversao",
    title: "Volume × conversão",
    x: "finishes",
    y: "conversion",
    xLabel: "Finalizações",
    yLabel: "Conversão",
    corners: {
      both: {
        term: "volume e aproveitamento",
        gloss: "finaliza muito e converte muito",
      },
      xOnly: {
        term: "volume sem aproveitamento",
        gloss: "finaliza muito e converte pouco",
      },
      yOnly: {
        term: "aproveitamento sem volume",
        gloss: "finaliza pouco e converte muito",
      },
      neither: {
        term: "nem volume nem aproveitamento",
        gloss: "finaliza pouco e converte pouco",
      },
    },
  },
};

export function profileScatter(
  division: ClubScouts[],
  clubCode: ClubCode,
  pair: ScatterPair = SCATTER_PAIRS["ataque-defesa"],
): ProfileScatter | null {
  const x = axis(division, pair.x, pair.xLabel);
  const y = axis(division, pair.y, pair.yLabel);
  if (!x || !y) return null;

  const points: ScatterPoint[] = [];
  for (const entry of division) {
    const valueX = rawValue(entry, pair.x);
    const valueY = rawValue(entry, pair.y);
    // Both or neither: a club plotted at a real x and an invented y is worse
    // than a club left off, because nothing on the drawing says which half was
    // measured.
    //
    // **Unreachable today, and kept anyway.** Both axes are per-match rates, so
    // both are null exactly when `matches` is 0 — there is no state where one
    // is missing and the other is not, and no test can construct one. That
    // stops being true the moment an axis is `conversion`, which is absent for
    // a club that has taken no shot at all. `tests/scouts-core.test.ts` says so
    // at the case that looks like it covers this and does not.
    if (valueX === null || valueY === null) continue;

    points.push({
      clubCode: entry.clubCode,
      x: valueX,
      y: valueY,
      atX: (valueX - x.min) / (x.max - x.min),
      atY: (valueY - y.min) / (y.max - y.min),
      subject: entry.clubCode === clubCode,
    });
  }

  if (points.length < 3) return null;
  if (!points.some((point) => point.subject)) return null;

  return { pair: pair.id, title: pair.title, x, y, points };
}

/**
 * Which corner a club sits in, in words.
 *
 * The drawing carries no `<text>` — a figure that scales to its container
 * scales its type with it, which is `RankCandles`' rule — so the quadrant has
 * to be said in HTML beside it, and this is the one place it is spelled. Four
 * phrases, from the two medians, and deliberately **descriptive rather than
 * appraising**: "jogo aberto" is a fact about how a match goes, where
 * "melhor ataque" would be a verdict the two numbers do not support.
 */
export function quadrantLabel(scatter: ProfileScatter): string {
  const phrase = quadrantParts(scatter);
  return phrase ? `${phrase.term}: ${phrase.gloss}` : "";
}

/**
 * The same corner as its two pieces, for the caption that renders them at
 * different weights.
 *
 * **This is where the corner is chosen and `quadrantLabel` composes from it**,
 * rather than both comparing the medians themselves. Two copies of that
 * comparison is how the sentence a screen reader hears comes to name a
 * different corner than the one printed beside the drawing — and the two would
 * disagree only for a club sitting exactly on a median, which is the case
 * nobody looks at.
 */
export function quadrantParts(scatter: ProfileScatter): QuadrantPhrase | null {
  return subjectQuadrant(scatter)?.phrase ?? null;
}

/**
 * Which corner the club is in — as a **place** as well as a phrase.
 *
 * The drawing now says the corner rather than only the caption: the subject's
 * quadrant is tinted and its name printed over it. Both need to know which half
 * of each axis the club sits in, and **the component must not work that out for
 * itself**. Two comparisons of the same medians is how a drawing comes to tint
 * one corner and name another — a disagreement that appears only for a club
 * sitting exactly on a median, which is precisely the case nobody looks at and
 * no test would be written for.
 *
 * So this is the single place the medians are read, `quadrantParts` and
 * `quadrantLabel` compose from it, and the tint, the label and the sentence a
 * screen reader hears are all the same decision.
 */
export function subjectQuadrant(scatter: ProfileScatter): Quadrant | null {
  const point = scatter.points.find((entry) => entry.subject);
  if (!point) return null;

  const { corners } = SCATTER_PAIRS[scatter.pair];
  const aboveX = point.x >= scatter.x.median;
  const aboveY = point.y >= scatter.y.median;

  const phrase =
    aboveX && aboveY
      ? corners.both
      : aboveX
        ? corners.xOnly
        : aboveY
          ? corners.yOnly
          : corners.neither;

  return { aboveX, aboveY, phrase };
}
