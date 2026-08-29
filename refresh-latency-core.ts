/**
 * refresh-latency-core.ts
 * -----------------------
 * How long the README screenshots stay stale, measured as the time the
 * advisory gate would have been red.
 *
 * This exists because a number was published without one. `docs/cicd-plan.md`
 * records a floor for how fast screenshot debt gets cleared, offered as the bar
 * any replacement for the red signal has to clear — and it was first measured by
 * pairing each appearance commit with the next commit touching `docs/screenshots`
 * by timestamp. That credits a refresh which was shot *before* the change and
 * merely committed after it, and it scored one real 2.99h episode at 0.03h.
 *
 * The lesson generalises past that bug: **every pairing heuristic is a second
 * opinion about a question the gate already answers.** So this module does not
 * decide when debt begins or ends. `scripts/measure-refresh-latency.ts` replays
 * `scripts/check-screenshots.sh` itself over history and reports a verdict per
 * commit; all that is left here is arithmetic over those verdicts, which is why
 * this half is pure and testable and the other half is not.
 *
 * An episode is therefore a **contiguous run of red commits**, ending at the
 * first green commit after it. Nothing here knows what an appearance path is, a
 * `Screenshots-unaffected:` trailer, or `CAPTURED`.
 */

/** One commit on the first-parent line, with the gate's verdict at that commit. */
export interface Sample {
  sha: string;
  /** Commit timestamp, epoch seconds. */
  ts: number;
  /** True when `check-screenshots.sh` exits non-zero at this commit. */
  red: boolean;
}

/** A stretch during which the gate was red. */
export interface Episode {
  /** The commit that turned the gate red. */
  fromSha: string;
  fromTs: number;
  /**
   * The commit that turned it green again, absent when the run reaches the end
   * of the history — an episode still open is not a short one.
   */
  toSha?: string;
  toTs?: number;
  hours: number;
  /** True when the run never closed, so `hours` is a lower bound. */
  open: boolean;
}

export interface Summary {
  count: number;
  medianHours: number;
  p90Hours: number;
  maxHours: number;
  overOneDay: number;
}

const HOUR = 3600;

/**
 * Split samples into red runs. Samples must be oldest-first; a caller feeding
 * them newest-first would get episodes running backwards in time, so this
 * asserts rather than silently reporting negative durations.
 *
 * `now` closes a still-open run. It is a parameter for the same reason
 * `cache-core.ts` and `live-core.ts` take one: a module that reads the clock
 * cannot be tested without sleeping.
 */
export const episodesFrom = (samples: Sample[], now: number): Episode[] => {
  for (let i = 1; i < samples.length; i += 1) {
    if (samples[i].ts < samples[i - 1].ts) {
      throw new Error("samples must be ordered oldest-first");
    }
  }

  const episodes: Episode[] = [];
  let start: Sample | undefined;

  for (const sample of samples) {
    if (sample.red && !start) {
      start = sample;
      continue;
    }
    if (!sample.red && start) {
      episodes.push({
        fromSha: start.sha,
        fromTs: start.ts,
        toSha: sample.sha,
        toTs: sample.ts,
        hours: (sample.ts - start.ts) / HOUR,
        open: false,
      });
      start = undefined;
    }
  }

  if (start) {
    episodes.push({
      fromSha: start.sha,
      fromTs: start.ts,
      hours: Math.max(0, now - start.ts) / HOUR,
      open: true,
    });
  }

  return episodes;
};

/**
 * Percentile by nearest rank on a sorted ascending list. Deliberately not
 * interpolated: at these counts (tens of episodes) interpolation invents
 * precision the sample size does not carry.
 */
const percentile = (sorted: number[], fraction: number): number =>
  sorted[Math.min(sorted.length - 1, Math.round(fraction * (sorted.length - 1)))];

const median = (sorted: number[]): number => {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

/**
 * Summarise closed episodes. **Open episodes are excluded**, and that is a
 * judgement rather than a convenience: an open run's duration is a lower bound,
 * and averaging a lower bound in with settled values reports the distribution as
 * tighter than it is — which is the direction this measurement has already been
 * wrong in once. Count them separately and say so.
 */
export const summarise = (episodes: Episode[]): Summary => {
  const closed = episodes.filter((e) => !e.open).map((e) => e.hours).sort((a, b) => a - b);
  if (closed.length === 0) {
    return { count: 0, medianHours: 0, p90Hours: 0, maxHours: 0, overOneDay: 0 };
  }
  return {
    count: closed.length,
    medianHours: median(closed),
    p90Hours: percentile(closed, 0.9),
    maxHours: closed[closed.length - 1],
    overOneDay: closed.filter((h) => h > 24).length,
  };
};

/** Episodes beginning at or after `from`, for splitting a history at a change. */
export const since = (episodes: Episode[], from: number): Episode[] =>
  episodes.filter((e) => e.fromTs >= from);
