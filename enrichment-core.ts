/**
 * A lookup that decorates something the page already shows — the player card's
 * shirt number and birth date — kept apart from the breaker and the budget the
 * championship's own data depends on.
 *
 * **It exists because `/api/players/:id` shared that breaker, and the id comes
 * from a URL anybody can type.** football-data answers an id nobody issued with
 * a 404 — measured 2026-09-11, `/v4/persons/99999999` answered
 * `{"message":"The resource you are looking for does not exist.","error":404}` —
 * and `loadCached` counted every non-2xx as the provider failing. Three such
 * requests opened the one breaker in `server.ts`, and for the next 60 seconds
 * standings, fixtures, scorers and squads each served `fallback` as soon as their
 * cache expired, to every reader, renewable at will.
 *
 * Three decisions, each closing part of that:
 *
 * - **"No such person" is an answer, not an outage.** `isAbsent` recognises it,
 *   and it is cached for the full TTL like any other answer, so asking again
 *   costs nothing.
 * - **The loader has its own breaker, and sees the shared one only as a
 *   predicate.** It can learn that upstream is down and hold off; it has no way
 *   to report a failure there, because it is never handed a `CircuitBreaker` to
 *   report to. A type holds that arrangement rather than a comment asking for it.
 * - **It spends from a budget of its own** (`ENRICHMENT_BUDGET`). A 404 still
 *   costs one of the provider's ten requests a minute, so without a cap a stream
 *   of fresh ids would spend the minute the table and the fixtures need, and they
 *   would fail on 429s instead of on an open breaker — the same outage by another
 *   road.
 *
 * Anything short of an answer — over budget, breaker open, upstream down or
 * failing — is `unavailable` and is never cached: the card renders from what the
 * page already knew, which is what it does offline.
 *
 * Takes `now` as a parameter like `cache-core.ts` and performs no I/O of its own;
 * the request is a function the caller passes in.
 */
import { CircuitBreaker, TtlCache } from "@/cache-core";
import { freshBucket, spend, type Bucket, type BucketPolicy } from "@/rate-limit-core";

/**
 * Two lookups a minute, refilled evenly, with a burst of two.
 *
 * Sized from the free tier rather than from how many cards a reader opens. The
 * data routes' caches allow about 5.2 requests a minute while a match is live —
 * fixtures every 15s, standings every 60s, scorers every 5 minutes, squads every
 * 6 hours — and a token bucket's worst minute is its capacity plus one minute's
 * refill: 4 here, so 9.2 of the 10. `tests/enrichment-core.test.ts` computes that
 * sum from the TTL constants and fails past 10, so shortening a TTL elsewhere
 * reddens this instead of quietly spending the table's budget.
 *
 * The cost is a reader opening a third new card inside a minute and getting it
 * without the shirt number. Reopening a card is free for an hour.
 */
export const ENRICHMENT_BUDGET: BucketPolicy = { capacity: 2, refillMs: 60_000 };

export type EnrichmentAnswer<T> =
  /** The provider answered — `null` included, which is "no such person". */
  | { kind: "answered"; value: T | null; storedAt: number }
  /** Nobody was asked, or the asking failed. Never cached. */
  | { kind: "unavailable" };

export interface EnrichmentLoaderOptions {
  ttlMs: number;
  budget: BucketPolicy;
  /** Whether the provider is already known to be down: the shared breaker, read and never written. */
  upstreamDown: (now: number) => boolean;
  /** Whether a thrown request was the provider answering that the thing does not exist. */
  isAbsent: (cause: unknown) => boolean;
  /** Told about a real failure, for logging. */
  onFailure?: (key: string, cause: unknown) => void;
}

export interface EnrichmentLoader<T> {
  load(
    key: string,
    fetchValue: () => Promise<T | null>,
    now: number,
  ): Promise<EnrichmentAnswer<T>>;
}

export const createEnrichmentLoader = <T>(
  options: EnrichmentLoaderOptions,
): EnrichmentLoader<T> => {
  const cache = new TtlCache();
  const breaker = new CircuitBreaker();
  let bucket: Bucket | null = null;

  return {
    async load(key, fetchValue, now) {
      const hit = cache.read<T | null>(key, now);
      if (hit) return { kind: "answered", value: hit.value, storedAt: hit.storedAt };

      // Before the budget, so a lookup that was never going to be made does not
      // spend a token on the way to not making it.
      if (options.upstreamDown(now) || breaker.isOpen(now)) return { kind: "unavailable" };

      const decision = spend(bucket ?? freshBucket(options.budget, now), options.budget, now);
      bucket = decision.bucket;
      if (!decision.allowed) return { kind: "unavailable" };

      let value: T | null;
      try {
        value = await fetchValue();
      } catch (cause) {
        if (!options.isAbsent(cause)) {
          breaker.recordFailure(now);
          options.onFailure?.(key, cause);
          return { kind: "unavailable" };
        }
        value = null;
      }

      breaker.recordSuccess();
      const entry = cache.write<T | null>(key, value, options.ttlMs, now);
      return { kind: "answered", value: entry.value, storedAt: entry.storedAt };
    },
  };
};
