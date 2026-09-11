/**
 * How a count is written for a reader.
 *
 * Pure, like every other `*-core` module: a number in, pt-BR text out
 * (tests/count-core.test.ts).
 *
 * **One rule, where there were a dozen copies of it.** The singular-or-plural
 * choice was a `n === 1 ? "posição" : "posições"` ternary written out in three
 * core modules and four components, plus two identical `plural` helpers in
 * `live-core.ts` and `PlayersView`; and "a count, or a dash when nothing was
 * reported" was four helpers answering it four ways — one grouped the digits in
 * pt-BR and three did not, one treated `undefined` as absent and one did not.
 * Copies of a rule that small drift in exactly that way: nobody reads a
 * one-liner closely enough to notice it disagrees with its twin.
 *
 * **Zero is a count and takes the plural** — "0 posições", as pt-BR says it —
 * and only `null`/`undefined` is an absence. Nothing here tests truthiness, for
 * the reason `countsTowardStandings` records about a 0-0.
 */

/** A count as digits grouped the pt-BR way, or a dash where none was reported. */
export const countLabel = (value: number | null | undefined): string =>
  value === null || value === undefined ? "—" : value.toLocaleString("pt-BR");

/** A count with its noun: "1 posição", "3 posições", "0 posições". */
export const countPhrase = (value: number, one: string, many: string): string =>
  `${countLabel(value)} ${value === 1 ? one : many}`;
