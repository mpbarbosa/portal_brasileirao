import assert from "node:assert/strict";
import { test } from "node:test";

import {
  fillStep,
  LIVE_MATCHES_CACHE_TTL_MS,
  MATCHES_CACHE_TTL_MS,
  matchesCacheTtl,
  TtlCache,
  type CacheEntry,
} from "@/cache-core";
import type { Match } from "@/src/types";

const match = (id: string, status: Match["status"]): Match => ({
  id,
  round: 1,
  kickoff: "2026-04-12T21:00:00Z",
  status,
  homeCode: "1783",
  awayCode: "1770",
  homeGoals: null,
  awayGoals: null,
});

const ENTRY: CacheEntry<string> = { value: "stored", storedAt: 10_000, expiresAt: 70_000 };

/** A lookup that records whether it was asked. */
const probe = <T>(answer: T) => {
  const calls = { count: 0 };
  return { calls, ask: () => ((calls.count += 1), answer) };
};

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

test("a fixture list takes the short TTL only while a match is live", () => {
  assert.equal(matchesCacheTtl([match("a", "SCHEDULED"), match("b", "LIVE")]), LIVE_MATCHES_CACHE_TTL_MS);
  assert.equal(matchesCacheTtl([match("a", "SCHEDULED"), match("b", "FINISHED")]), MATCHES_CACHE_TTL_MS);
  assert.equal(matchesCacheTtl([]), MATCHES_CACHE_TTL_MS);
});

test("a switched-off upstream is answered locally, without consulting the cache or the breaker", () => {
  const read = probe<CacheEntry<string> | null>(ENTRY);
  const breaker = probe(false);

  assert.deepEqual(fillStep({ enabled: false, read: read.ask, breakerOpen: breaker.ask }), { kind: "local" });
  assert.equal(read.calls.count, 0);
  assert.equal(breaker.calls.count, 0);
});

test("a warm entry is served even while the breaker is open, which is not asked", () => {
  const breaker = probe(true);

  assert.deepEqual(
    fillStep({ enabled: true, read: () => ENTRY, breakerOpen: breaker.ask }),
    { kind: "cached", entry: ENTRY },
  );
  assert.equal(breaker.calls.count, 0);
});

test("a cold cache behind an open breaker is answered locally", () => {
  assert.deepEqual(fillStep({ enabled: true, read: () => null, breakerOpen: () => true }), { kind: "local" });
});

test("a cold cache behind a closed breaker asks upstream", () => {
  assert.deepEqual(fillStep({ enabled: true, read: () => null, breakerOpen: () => false }), { kind: "fetch" });
});

test("the order holds against a real cache: an expired entry is a miss, not a hit", () => {
  const cache = new TtlCache();
  cache.write("k", "stale", 1000, 10_000);

  const step = (now: number) =>
    fillStep<string>({ enabled: true, read: () => cache.read<string>("k", now), breakerOpen: () => false });

  assert.equal(step(10_500).kind, "cached");
  assert.equal(step(11_000).kind, "fetch");
});
