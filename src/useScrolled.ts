import { useEffect, useState } from "react";

/**
 * Whether the page has moved off the top.
 *
 * MD3's top app bar is **level 0 at rest and level 2 once content scrolls
 * beneath it** — the elevation is what says the bar is in front of something,
 * and at the top of the page there is nothing to be in front of. That is a
 * state, so it needs a listener; there is no CSS selector for "this sticky
 * element is currently stuck" that ships in browsers today.
 *
 * `passive` because the handler never calls `preventDefault`, and a
 * non-passive scroll listener blocks the compositor on exactly the gesture a
 * reader is most likely to make on a phone.
 *
 * The state is a boolean rather than the offset, so React re-renders twice per
 * page — at the first pixel and on the way back to the top — instead of on
 * every frame of a scroll.
 *
 * It reads once on mount as well as on scroll: a deep link that restores a
 * scroll position, or a reload part-way down a fixture list, both arrive
 * already scrolled and never fire the event.
 */
export function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const read = () => setScrolled(window.scrollY > 0);
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, []);

  return scrolled;
}
