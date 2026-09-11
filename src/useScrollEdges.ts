import { useEffect, useRef, useState } from "react";

/** Whether a horizontal scroller holds more content beyond either edge. */
export interface ScrollEdges {
  /** Something has scrolled off to the left — the reader has moved. */
  start: boolean;
  /** Something is still hidden off to the right — there is more to see. */
  end: boolean;
}

/**
 * Which edges of a horizontal scroller have content beyond them.
 *
 * A table that scrolls sideways on a phone gives no sign of it on its own: when
 * the screen edge happens to fall on a column boundary, the visible part reads
 * as the whole table, and the columns past it are simply never found. This is
 * the fact every hint needs — a fade and a chevron while `end`, a shadow on the
 * frozen columns while `start` — so it is read once, here, rather than by each.
 *
 * `useScrolled`'s shape one axis over: `passive`, and booleans rather than the
 * offset, so a component re-renders when an edge is crossed and not on every
 * frame of a swipe. The functional update returns the previous object when
 * nothing flipped, which is what makes that true — a fresh `{}` per event would
 * re-render on every frame all the same.
 *
 * It reads on resize as well as on scroll, and observes the **content** as well
 * as the box: rotating a phone changes the box, but a table growing a column (a
 * mark switched on, rows arriving) changes only what is inside it, and neither
 * fires a scroll event.
 *
 * The 1px tolerance is not tidiness. A scroll offset is fractional on a
 * high-density screen, so a table scrolled all the way along can report itself
 * a fraction of a pixel short of the end, and the hint would never go away.
 */
export function useScrollEdges<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState<ScrollEdges>({ start: false, end: false });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const read = () => {
      const start = element.scrollLeft > 1;
      const end = element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
      setEdges((previous) =>
        previous.start === start && previous.end === end ? previous : { start, end },
      );
    };

    read();
    element.addEventListener("scroll", read, { passive: true });
    const observer = new ResizeObserver(read);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);

    return () => {
      element.removeEventListener("scroll", read);
      observer.disconnect();
    };
  }, []);

  return [ref, edges] as const;
}
