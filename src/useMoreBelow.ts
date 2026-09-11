import { useEffect, useState } from "react";

/**
 * Less than this much page left below the fold is not "more to see": it is the
 * last of the bottom padding and the rodapé's own margin.
 */
const MIN_REMAINING_PX = 48;

/**
 * Whether a reader at the top of the page has more of it below the fold — the
 * condition for the **Seta de mais conteúdo**.
 *
 * Two halves, and both are needed. **At the top**, because the arrow is a
 * notice, and a reader who has scrolled has already found out; it is the same
 * first-pixel test `useScrolled` uses for the top app bar, so the bar rising and
 * the arrow leaving are one moment rather than two. **Something below**, because
 * on a screen tall enough to hold the whole page the arrow would point at
 * nothing.
 *
 * The second half is why this listens to more than `scroll`. The page is short
 * until `/api/standings` lands, so a reading taken on mount finds nothing below
 * and no scroll event follows to correct it — the arrow would never appear on
 * exactly the load it exists for. A `ResizeObserver` on the body sees the rows
 * arrive; `resize` covers a rotated phone.
 *
 * `passive` for `useScrolled`'s reason: the handler never calls
 * `preventDefault`, and a blocking scroll listener costs the gesture a phone
 * reader makes most.
 */
export function useMoreBelow(): boolean {
  const [moreBelow, setMoreBelow] = useState(false);

  useEffect(() => {
    const read = () => {
      const remaining =
        document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      // `<= 0` rather than `=== 0`: iOS rubber-banding reports a negative offset
      // at the top, and that is still the top.
      setMoreBelow(window.scrollY <= 0 && remaining > MIN_REMAINING_PX);
    };

    read();
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    const observer = new ResizeObserver(read);
    observer.observe(document.body);

    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      observer.disconnect();
    };
  }, []);

  return moreBelow;
}
