/**
 * When a stored answer may be served instead of asking upstream again.
 *
 * Everything here takes the current time as a parameter rather than reading the
 * clock, so expiry is testable without sleeping (tests/cache-core.test.ts). The
 * circuit breaker that sits beside the cache in every fill is
 * `circuit-breaker-core.ts`.
 *
 * Sizing note: the football-data free tier allows 10 calls/minute. With a
 * 60s standings TTL and a 60s (15s while live) matches TTL, the app makes at
 * most ~5 upstream calls/minute regardless of how much traffic it serves —
 * caching is what makes the free tier viable in production, not just in dev.
 */

import { hasLiveMatch } from "@/live-core";
import type { Match } from "@/src/types";

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

/**
 * An elenco changes when a transfer window does, which is a handful of days a
 * year — so the longest TTL in the app, and the one request that serves all
 * twenty clubs is worth holding on to. Restarting the process clears it anyway,
 * which is the only refresh a deploy needs.
 */
export const SQUADS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

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

/** Fixture lists get the short TTL only while something is actually live —
 *  judged by `hasLiveMatch`, the predicate the client's refresh rate reads, so
 *  the server's cache and the page's poll cannot disagree about what live is. */
export const matchesCacheTtl = (matches: Match[]): number =>
  hasLiveMatch(matches) ? LIVE_MATCHES_CACHE_TTL_MS : MATCHES_CACHE_TTL_MS;

/**
 * Which branch a cached fill takes.
 *
 * - `local` — answer from what this process already holds: the seed, or nothing
 *   where there is no seed. Taken when the upstream is switched off, and when
 *   the cache is cold and the breaker is open.
 * - `cached` — serve the stored entry, dated by when it was stored.
 * - `fetch` — ask upstream. What happens then (writing the cache, telling the
 *   breaker) is the caller's, because it is I/O.
 */
export type FillStep<T> =
  | { kind: "local" }
  | { kind: "cached"; entry: CacheEntry<T> }
  | { kind: "fetch" };

export interface FillState<T> {
  /** Whether this upstream may be asked at all — configured and not switched off. */
  enabled: boolean;
  /** The cache read, deferred so a switched-off upstream never consults the cache. */
  read: () => CacheEntry<T> | null;
  /** Whether the breaker in front of this upstream is open, deferred so a warm
   *  entry is served without asking. An upstream with no breaker passes `() => false`. */
  breakerOpen: () => boolean;
}

/**
 * The order every cached fill in `server.ts` takes: switched off, then a warm
 * entry, then an open breaker, then the network.
 *
 * It was written out three times — `loadCached`, `loadMatches` around its merge,
 * and the stadium-weather route — and the order is the rule: a warm entry is
 * served even while the breaker is open, because it answers without asking
 * anybody, and a switched-off upstream is not served its own stale cache.
 *
 * The two lookups arrive as functions so the order holds for them too: nothing
 * is read that the step before it has already made unnecessary.
 */
export const fillStep = <T>({ enabled, read, breakerOpen }: FillState<T>): FillStep<T> => {
  if (!enabled) return { kind: "local" };

  const hit = read();
  if (hit) return { kind: "cached", entry: hit };

  if (breakerOpen()) return { kind: "local" };

  return { kind: "fetch" };
};
