import assert from "node:assert/strict";
import test from "node:test";

import { finiteNumber, isFiniteNumber } from "@/narrow-core";

test("zero and negatives are numbers a reader could be shown", () => {
  assert.equal(finiteNumber(0), 0);
  assert.equal(finiteNumber(-3.5), -3.5);
  assert.equal(isFiniteNumber(0), true);
});

test("NaN and the infinities are not", () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(finiteNumber(value), null);
    assert.equal(isFiniteNumber(value), false);
  }
});

test("a numeric string is not a number — the payload said a string", () => {
  assert.equal(finiteNumber("12"), null);
  assert.equal(finiteNumber(null), null);
  assert.equal(finiteNumber(undefined), null);
  assert.equal(finiteNumber({}), null);
});
