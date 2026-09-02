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
 */
export function valueLabel(row: ProfileRow): string {
  if (row.unit === "porcento") {
    return `${row.value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
  }
  return row.value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
