/**
 * TTL cache and circuit breaker. Both take the current time as a parameter
 * rather than reading the clock, so expiry and recovery windows are testable
 * without sleeping (tests/cache-core.test.ts).
 *
 * Sizing note: the football-data free tier allows 10 calls/minute. With a
 * 60s standings TTL and a 60s (15s while live) matches TTL, the app makes at
 * most ~5 upstream calls/minute regardless of how much traffic it serves —
 * caching is what makes the free tier viable in production, not just in dev.
 */

/** Table only moves on a final whistle, so a minute of staleness is invisible. */
export const STANDINGS_CACHE_TTL_MS = 60 * 1000;
/** Fixture lists are near-static between rounds. */
export const MATCHES_CACHE_TTL_MS = 60 * 1000;
/** A live scoreline is the one thing a reader notices going stale. */
export const LIVE_MATCHES_CACHE_TTL_MS = 15 * 1000;

/** The scoring table only moves when a goal is confirmed — minutes of staleness
 *  are invisible, and it is the least time-critical view in the app. */
export const SCORERS_CACHE_TTL_MS = 5 * 60 * 1000;

/** A name, birth date and shirt number change at most once a season, and each
 *  lookup costs a request against a 10/minute budget. */
export const PLAYER_CACHE_TTL_MS = 60 * 60 * 1000;

export const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;
export const CIRCUIT_BREAKER_OPEN_MS = 60 * 1000;

export interface CacheEntry<T> {
  value: T;
  storedAt: number;
  expiresAt: number;
}

export class TtlCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();

  read<T>(key: string, now: number): CacheEntry<T> | null {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return null;
    }

    return entry;
  }

  write<T>(key: string, value: T, ttlMs: number, now: number): CacheEntry<T> {
    const entry: CacheEntry<T> = { value, storedAt: now, expiresAt: now + ttlMs };
    this.entries.set(key, entry);
    return entry;
  }

  clear(): void {
    this.entries.clear();
  }
}

/**
 * Opens after `threshold` consecutive failures and stays open for `openMs`, so
 * an upstream that is down gets one probe a minute instead of one per request.
 * A single success closes it.
 */
export class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;

  constructor(
    private readonly threshold: number = CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    private readonly openMs: number = CIRCUIT_BREAKER_OPEN_MS,
  ) {}

  isOpen(now: number): boolean {
    return now < this.openUntil;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openUntil = 0;
  }

  recordFailure(now: number): void {
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.openUntil = now + this.openMs;
      this.failures = 0;
    }
  }
}
