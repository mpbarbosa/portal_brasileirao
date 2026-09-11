import assert from "node:assert/strict";
import { test } from "node:test";

import { TtlCache } from "@/cache-core";

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
