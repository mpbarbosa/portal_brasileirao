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

/**
 * The address a sign-in bucket is keyed on: the entry our own proxy appended to
 * `X-Forwarded-For`, else the socket's.
 *
 * **The last entry, never the first.** nginx's `$proxy_add_x_forwarded_for`
 * appends the address it saw to whatever `X-Forwarded-For` the client sent, so
 * the header reaches this process as `<anything the client wrote>, <the real
 * address>`. Keying on the first entry — which is what shipped, following
 * `docs/accounts.md` §3.13 — let a client send a different header on every
 * request and never meet its own bucket. The last entry is the one hop this
 * deployment writes.
 *
 * That holds for exactly one proxy in front of the process, which is what
 * `04_setup_nginx.sh` configures. A second hop in front of nginx — a CDN — would
 * make the last entry the CDN's address and put every reader in one bucket: it
 * fails closed rather than open, and it is the moment to revisit this. A request
 * reaching the port directly, bypassing nginx, controls the whole header; that
 * is a property of exposing the port, not of this function.
 *
 * Behind nginx the socket is `127.0.0.1`, so the fallback only ever decides for
 * a request that did not come through the proxy.
 */
export const clientKey = (
  forwardedFor: string | undefined,
  socketAddress: string | undefined,
): string => {
  const entries = (forwardedFor ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries[entries.length - 1] ?? socketAddress ?? "unknown";
};
