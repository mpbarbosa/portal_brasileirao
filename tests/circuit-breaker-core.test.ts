import assert from "node:assert/strict";
import { test } from "node:test";

import { CircuitBreaker } from "@/circuit-breaker-core";

test("the breaker stays closed below the failure threshold", () => {
  const breaker = new CircuitBreaker(3, 60_000);

  breaker.recordFailure(1000);
  breaker.recordFailure(1100);

  assert.equal(breaker.isOpen(1200), false);
});

test("the breaker opens on the threshold failure and stays open for the window", () => {
  const breaker = new CircuitBreaker(3, 60_000);

  breaker.recordFailure(1000);
  breaker.recordFailure(1100);
  breaker.recordFailure(1200);

  assert.equal(breaker.isOpen(1200), true);
  assert.equal(breaker.isOpen(61_199), true);
  assert.equal(breaker.isOpen(61_200), false);
});

test("a success closes the breaker and clears the failure count", () => {
  const breaker = new CircuitBreaker(3, 60_000);

  breaker.recordFailure(1000);
  breaker.recordFailure(1100);
  breaker.recordSuccess();
  breaker.recordFailure(1200);

  assert.equal(breaker.isOpen(1300), false);
});
