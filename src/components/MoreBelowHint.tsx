import { ArrowDownIcon } from "@/src/components/SectionIcons";
import { STATE_LAYER_ON_PRIMARY_CONTAINER, TOUCH_TARGET } from "@/src/components/interaction";
import { useMoreBelow } from "@/src/useMoreBelow";

/**
 * The **Seta de mais conteúdo**: a floating arrow at the foot of the
 * Classificação saying the page goes on below the table.
 *
 * It exists because on a phone twenty rows fill the screen edge to edge and end
 * exactly where the fold does, so the Números da temporada and the Curiosidades
 * da campanha beneath them read as absent rather than as further down. It leaves at the first
 * scrolled pixel (see `useMoreBelow`) — a notice, not a control that follows
 * the reader down the table covering rows.
 *
 * **Centred, deliberately not at MD3's FAB corner.** A FAB is an action; this
 * says *continue*, and the right edge of this table is where the horizontal
 * scroll cue for its hidden columns lives, so a second mark there would read as
 * one control.
 *
 * **Hidden is `inert`, not unmounted**, so it can fade rather than blink.
 * `inert` is the whole of it: it takes the button out of the tab order and the
 * accessibility tree, *and* hit-tests it as `pointer-events: none`, so a press
 * on the row beneath cannot land on a button that is only transparent. A
 * `pointer-events-none` beside it was written first and measured redundant —
 * deleting it left `more-below.spec.ts` green, where deleting `inert` does not.
 *
 * `bottom-24` below `sm` clears the navigation bar fixed to that edge, which is
 * 73px tall; above `sm` the bar does not render.
 *
 * The scroll is a jump under `prefers-reduced-motion`. The stylesheet's
 * `scroll-behavior: auto !important` does not reach it: an explicit
 * `behavior: "smooth"` passed to `scrollBy` is the script's choice, not CSS's.
 */
export function MoreBelowHint() {
  const visible = useMoreBelow();

  const scrollOn = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollBy({
      // Most of a screen, not all of it: the last rows stay in view above the
      // sticky header, so the reader keeps their place.
      top: Math.round(window.innerHeight * 0.8),
      behavior: reduce ? "auto" : "smooth",
    });
  };

  return (
    <button
      type="button"
      data-more-below={visible ? "true" : "false"}
      aria-label="Ver mais abaixo"
      title="Ver mais abaixo"
      inert={!visible}
      onClick={scrollOn}
      className={`fixed bottom-24 left-1/2 z-20 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-primary-container text-on-primary-container shadow-level-3 sm:bottom-6 ${TOUCH_TARGET} ${STATE_LAYER_ON_PRIMARY_CONTAINER} ${
        visible ? "opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <ArrowDownIcon className="h-6 w-6" />
    </button>
  );
}
