import assert from "node:assert/strict";
import { test } from "node:test";

import { CircuitBreaker, TtlCache } from "@/cache-core";

test("a cached value is returned until its TTL elapses", () => {
  const cache = new TtlCache();
  cache.write("k", "value", 1000, 10_000);

  assert.equal(cache.read<string>("k", 10_500)?.value, "value");
  assert.equal(cache.read<string>("k", 10_999)?.value, "value");
});

test("a value expires exactly at its TTL boundary", () => {
  const cache = new TtlCache();
  cache.write("k", "value", 1000, 10_000);

  assert.equal(cache.read("k", 11_000), null);
  assert.equal(cache.read("k", 11_001), null);
});

test("the entry reports when it was stored, so responses can date themselves", () => {
  const cache = new TtlCache();
  cache.write("k", "value", 1000, 10_000);

  assert.equal(cache.read("k", 10_500)?.storedAt, 10_000);
});

test("a missing key reads as null", () => {
  assert.equal(new TtlCache().read("nope", 1), null);
});

test("a rewrite replaces the value and restarts the TTL", () => {
  const cache = new TtlCache();
  cache.write("k", "first", 1000, 10_000);
  cache.write("k", "second", 1000, 10_500);

  assert.equal(cache.read<string>("k", 11_200)?.value, "second");
});

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
