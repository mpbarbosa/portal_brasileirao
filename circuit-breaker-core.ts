/**
 * A circuit breaker that stops asking an upstream which keeps failing.
 *
 * It takes the current time as a parameter rather than reading the clock, so
 * the open window and the recovery are testable without sleeping
 * (tests/circuit-breaker-core.test.ts).
 *
 * It lived in `cache-core.ts` until that module's first sentence had to name
 * two subjects. The two are used together — a fill reads the cache, then asks
 * whether the breaker is open — but they answer different questions and change
 * for different reasons: a TTL moves with the free tier's budget, the breaker's
 * threshold with how an outage looks.
 */

export const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;
export const CIRCUIT_BREAKER_OPEN_MS = 60 * 1000;

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
