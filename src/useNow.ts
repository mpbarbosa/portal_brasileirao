import { useEffect, useState } from "react";

/**
 * A wall clock that re-renders its caller on a tick.
 *
 * Only the **Ao vivo** page needs one: every other view is a snapshot of data
 * that arrived once, while a contagem regressiva is wrong the moment it stops
 * moving.
 *
 * Two details that are easy to get wrong:
 *
 * - The timer is torn down while the tab is hidden and the clock is re-read on
 *   the way back. A background tab is throttled to roughly one tick a minute
 *   anyway, so leaving it running buys nothing and returning to a countdown
 *   that is minutes stale is exactly the failure this hook exists to avoid.
 * - The state is the instant, not a counter, so a caller that formats from it
 *   cannot drift away from the real time however long the page stays open.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };

    const start = () => {
      stop();
      setNow(Date.now());
      timer = setInterval(() => setNow(Date.now()), intervalMs);
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);

  return now;
}
