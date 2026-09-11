/**
 * Reading a field out of a payload this app did not write, as a number or not at all.
 *
 * Pure (tests/narrow-core.test.ts). `health-core.ts`, `weather-core.ts` and
 * `football-data-core.ts` each carried their own copy of this test — two as a
 * narrowing function and one as a type guard — for three parsers that narrow
 * field by field because the payload in front of them may be from another
 * build, another vendor or another decade of an API.
 *
 * **Zero is a real number and `NaN` is not**, which is the whole of the rule:
 * a truthiness test drops a 0 °C reading, a calm wind and a process up for
 * zero seconds, and `typeof` alone admits `NaN` and `Infinity`, which a
 * payload's JSON cannot even carry and a hand-built fixture easily can.
 */

/** Whether a value is a number a reader could be shown. */
export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** The value if it is such a number, else null. */
export const finiteNumber = (value: unknown): number | null =>
  isFiniteNumber(value) ? value : null;
