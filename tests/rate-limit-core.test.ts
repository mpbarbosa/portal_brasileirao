import assert from "node:assert/strict";
import { test } from "node:test";

import { evictFull, freshBucket, spend, type Bucket, type BucketPolicy } from "@/rate-limit-core";

const POLICY: BucketPolicy = { capacity: 5, refillMs: 60_000 };

test("a fresh bucket allows a burst up to its capacity, then refuses", () => {
  let bucket = freshBucket(POLICY, 0);

  for (let index = 0; index < POLICY.capacity; index += 1) {
    const decision = spend(bucket, POLICY, 0);
    assert.equal(decision.allowed, true, `attempt ${index + 1} should be allowed`);
    bucket = decision.bucket;
  }

  const refused = spend(bucket, POLICY, 0);
  assert.equal(refused.allowed, false);
  assert.equal(refused.retryAfterMs, 12_000); // 60s / 5 tokens
});

test("tokens come back over time, without a clock", () => {
  let bucket: Bucket = { tokens: 0, updatedAt: 0 };

  assert.equal(spend(bucket, POLICY, 11_999).allowed, false);

  const decision = spend(bucket, POLICY, 12_000);
  assert.equal(decision.allowed, true);
  bucket = decision.bucket;
  assert.equal(bucket.tokens, 0);
});

test("a bucket never refills past its capacity", () => {
  // A week away must not buy a week's worth of attempts in one burst.
  const bucket: Bucket = { tokens: 0, updatedAt: 0 };
  const decision = spend(bucket, POLICY, 7 * 24 * 60 * 60 * 1000);
  assert.equal(decision.bucket.tokens, POLICY.capacity - 1);
});

test("a clock that goes backwards does not grant tokens", () => {
  const bucket: Bucket = { tokens: 1, updatedAt: 10_000 };
  const decision = spend(bucket, POLICY, 0);
  assert.equal(decision.allowed, true);
  assert.equal(decision.bucket.tokens, 0);
});

test("full buckets are forgotten, so the map is not a log of every visitor", () => {
  const buckets = new Map<string, Bucket>([
    ["full", { tokens: POLICY.capacity, updatedAt: 0 }],
    ["refilled", { tokens: 0, updatedAt: 0 }],
    ["draining", { tokens: 0, updatedAt: 55_000 }],
  ]);

  evictFull(buckets, POLICY, 60_000);

  assert.equal(buckets.has("full"), false);
  assert.equal(buckets.has("refilled"), false);
  assert.equal(buckets.has("draining"), true);
});
