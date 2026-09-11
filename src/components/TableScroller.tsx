import type { ReactNode } from "react";

import { GLYPH } from "@/src/components/ClubLinks";
import { Surface } from "@/src/components/Surface";
import { FOCUS_RING, ICON_LINK, TOUCH_TARGET } from "@/src/components/interaction";
import { useScrollEdges } from "@/src/useScrollEdges";

/**
 * How far one press of the chevron moves a table whose leading columns are
 * frozen: far enough that the column cut off at the right edge becomes the
 * first one beside the frozen edge.
 *
 * **Measured in columns, not pixels, because every pixel step skips one.**
 * Sticky cells stay put while the rest slides beneath them, so what a reader
 * can see is the box *minus* the frozen columns — and a step sized to anything
 * else carries some column past the frozen edge without it ever being whole on
 * screen. The first version stepped by "what is visible, less a margin", with a
 * floor of a third of the box; at 380px the floor won and Campanha, the column
 * cut off at the right, ended 65px under Clube — read off the failing spec in
 * `tests/e2e/standings.spec.ts`, which asserts the column lands whole.
 *
 * A column wider than the whole visible strip is already at the frozen edge
 * when it is the one cut off, so aligning it would move nothing; that case
 * moves by the strip instead, which is the only step that neither stalls nor
 * skips.
 *
 * The frozen edge is measured rather than passed in, because it is not a
 * constant: `STICKY_CLUB` is `w-0` and takes the width of the longest club
 * name, which changes with the division.
 */
function nextColumnOffset(scroller: HTMLElement): number {
  const box = scroller.getBoundingClientRect();
  const visibleRight = box.left + scroller.clientLeft + scroller.clientWidth;
  const cells = [...(scroller.querySelector("tr")?.children ?? [])];

  let frozenRight = box.left + scroller.clientLeft;
  const moving: Element[] = [];
  for (const cell of cells) {
    if (getComputedStyle(cell).position === "sticky") {
      frozenRight = Math.max(frozenRight, cell.getBoundingClientRect().right);
    } else {
      moving.push(cell);
    }
  }

  const cutOff = moving.find((cell) => cell.getBoundingClientRect().right > visibleRight + 1);
  const offset = cutOff ? cutOff.getBoundingClientRect().left - frozenRight : 0;
  return offset >= 1 ? offset : visibleRight - frozenRight;
}

/**
 * The horizontal scroll container for a table too wide for a phone, and the
 * signs that it is one.
 *
 * **A table that scrolls sideways does not say so.** The Classificação is 43rem
 * wide and a phone shows about half of it; when the screen edge happens to land
 * on a column boundary — as it did right after Campanha on the phone that
 * reported this — the visible half reads as the whole table, and J, V, E, D, SG
 * and % are simply never found. Whether it lands on a boundary depends on the
 * device width, so no sign here relies on a column showing cut. Three signs, because each one fails somewhere the others do not:
 *
 * - **A fade at the right edge** while there is more to the right. The
 *   convention every scrolling list uses; it goes when the reader reaches the
 *   end, which is what makes it mean something rather than decorate.
 * - **A chevron in the header row** that moves the table on by a page. A fade
 *   suggests; a control can be pressed, and it is where the eye already is — at
 *   the column labels. It sits in the header rather than at the table's
 *   vertical centre because twenty rows put that centre below the fold of a
 *   phone, under the navigation bar.
 * - **A shadow along the frozen columns** once the reader has moved. That one
 *   is drawn by the table, which owns the sticky cells, from `data-scroll-start`
 *   on the Surface — so crossing the edge re-renders this component and not the
 *   twenty rows and twenty sparklines passed in as `children`.
 *
 * **The overlays sit OUTSIDE the Surface**, in a wrapper, because the Surface is
 * the scroll container: anything positioned inside it scrolls away with the
 * content it is meant to sit on top of.
 *
 * **The fade takes no pointer events**, since it lies over the last visible
 * column; a press there has to reach the cell underneath.
 *
 * **The chevron is a pointer affordance and is hidden from assistive technology
 * on purpose.** A screen reader walks the table's cells in order and never
 * needed the scroll; a keyboard reader is served by the Surface itself, which
 * becomes a focusable, labelled region while it overflows — the arrow keys then
 * scroll it both ways, where a chevron only goes one. Offering both as tab stops
 * would put two controls for one movement in the tab order.
 *
 * On a screen wide enough for the whole table none of this exists: no fade, no
 * chevron, no region and no extra tab stop, because nothing is hidden.
 */
export function TableScroller({ label, children }: { label: string; children: ReactNode }) {
  const [ref, edges] = useScrollEdges<HTMLDivElement>();
  const scrollable = edges.start || edges.end;

  const advance = () => {
    const scroller = ref.current;
    if (!scroller) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollBy({ left: nextColumnOffset(scroller), behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="relative">
      <Surface
        ref={ref}
        role={scrollable ? "region" : undefined}
        aria-label={scrollable ? label : undefined}
        tabIndex={scrollable ? 0 : undefined}
        data-scroll-start={edges.start ? "" : undefined}
        className={`group/scroller overflow-x-auto ${FOCUS_RING}`}
      >
        {children}
      </Surface>

      {/* `from-surface`, the page's own colour, because the table is unfilled
          and the page is what shows through it. Inset by a pixel so the
          Surface's border and its rounded corner stay drawn over the fade. */}
      <div
        aria-hidden="true"
        data-scroll-fade=""
        className={`pointer-events-none absolute inset-y-px right-px w-12 rounded-r-small bg-linear-to-l from-surface to-transparent transition-opacity ${
          edges.end ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* `bg-surface-container` and `ink-muted` because that pairing is one the
          contrast gate measures; `surface-container-high` would put a mark on a
          container nothing has checked. It brightens rather than taking a state
          layer: `STATE_LAYER`'s hover background would replace this fill with an
          8% veil, and the column label scrolling beneath would show through. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        data-scroll-more=""
        hidden={!edges.end}
        onClick={advance}
        className={`absolute right-1.5 top-[5px] flex h-6 w-6 items-center justify-center rounded-full border border-outline-variant bg-surface-container ${TOUCH_TARGET} ${ICON_LINK}`}
      >
        <svg {...GLYPH} className="h-4 w-4">
          <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
        </svg>
      </button>
    </div>
  );
}
