import assert from "node:assert/strict";
import { test } from "node:test";

import { clientKey, evictFull, freshBucket, spend, type Bucket, type BucketPolicy } from "@/rate-limit-core";

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

// 203.0.113.7 plays the reader's real address throughout: what nginx saw and
// appended. Everything before it in a header is what the client chose to send.
const REAL = "203.0.113.7";

test("the bucket key is the address our proxy appended, not one the client wrote", () => {
  // No header from the client: nginx forwards just the address it saw.
  assert.equal(clientKey(REAL, "127.0.0.1"), REAL);
  // The bypass shape: a client-written entry first, nginx's own entry last.
  assert.equal(clientKey(`1.2.3.4, ${REAL}`, "127.0.0.1"), REAL);
  assert.equal(clientKey(`9.9.9.9, 8.8.8.8,${REAL}`, "127.0.0.1"), REAL);
});

test("rotating a forged X-Forwarded-For does not rotate the bucket", () => {
  let bucket: Bucket | undefined;
  const buckets = new Map<string, Bucket>();
  for (let index = 0; index <= POLICY.capacity; index += 1) {
    const key = clientKey(`10.0.0.${index}, ${REAL}`, "127.0.0.1");
    const decision = spend(buckets.get(key) ?? freshBucket(POLICY, 0), POLICY, 0);
    buckets.set(key, decision.bucket);
    bucket = decision.bucket;
    if (index === POLICY.capacity) assert.equal(decision.allowed, false, "a new forged address bought a new bucket");
  }
  assert.equal(buckets.size, 1);
  assert.ok(bucket);
});

test("without a forwarded address the socket decides", () => {
  assert.equal(clientKey(undefined, "198.51.100.2"), "198.51.100.2");
  assert.equal(clientKey("", "198.51.100.2"), "198.51.100.2");
  assert.equal(clientKey(" , ", "198.51.100.2"), "198.51.100.2");
  assert.equal(clientKey(undefined, undefined), "unknown");
});
