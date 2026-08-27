/**
 * A token bucket, pure and clock-free, in the style of `cache-core.ts`.
 *
 * Every route in this app before accounts was a cached GET in front of a
 * circuit breaker, so there has never been anything to rate-limit. Sign-in is
 * the first endpoint where being asked repeatedly is itself the attack —
 * session-creation spam and callback flooding on a single small instance.
 *
 * In memory is the right scope: there is one process. It resets on deploy,
 * which is acceptable and is written down here rather than remembered.
 */

export interface Bucket {
  /** Tokens remaining, fractional between refills. */
  tokens: number;
  /** When `tokens` was last computed. */
  updatedAt: number;
}

export interface BucketPolicy {
  /** Bucket size, and therefore the largest burst allowed. */
  capacity: number;
  /** How long a fully drained bucket takes to refill completely. */
  refillMs: number;
}

export const freshBucket = (policy: BucketPolicy, now: number): Bucket => ({
  tokens: policy.capacity,
  updatedAt: now,
});

export interface Decision {
  allowed: boolean;
  bucket: Bucket;
  /** Milliseconds until one token is available. Zero when allowed. */
  retryAfterMs: number;
}

/**
 * Spend one token if there is one.
 *
 * Returns the next bucket rather than mutating, so the caller owns the map and
 * a test can drive a sequence of instants without any shared state.
 */
export const spend = (bucket: Bucket, policy: BucketPolicy, now: number): Decision => {
  const elapsed = Math.max(0, now - bucket.updatedAt);
  const refilled = Math.min(
    policy.capacity,
    bucket.tokens + (elapsed * policy.capacity) / policy.refillMs,
  );

  if (refilled >= 1) {
    return {
      allowed: true,
      bucket: { tokens: refilled - 1, updatedAt: now },
      retryAfterMs: 0,
    };
  }

  const perToken = policy.refillMs / policy.capacity;
  return {
    allowed: false,
    bucket: { tokens: refilled, updatedAt: now },
    retryAfterMs: Math.ceil((1 - refilled) * perToken),
  };
};

/**
 * Drop buckets that have refilled completely.
 *
 * Without this the map is an unbounded record of every address that ever
 * signed in — which is both a leak and, after §5, personal data retained for
 * no stated purpose. A full bucket is indistinguishable from a fresh one, so
 * forgetting it loses nothing.
 */
export const evictFull = (
  buckets: Map<string, Bucket>,
  policy: BucketPolicy,
  now: number,
): void => {
  for (const [key, bucket] of buckets) {
    const elapsed = now - bucket.updatedAt;
    if (bucket.tokens + (elapsed * policy.capacity) / policy.refillMs >= policy.capacity) {
      buckets.delete(key);
    }
  }
};
