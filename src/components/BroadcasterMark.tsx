import { broadcasterMarkUrl } from "@/broadcast-core";

interface BroadcasterMarkProps {
  name: string;
  /** `sm` for the fixture list, where the line is already dense. */
  size?: "sm" | "md";
  /**
   * Set when the surrounding control already says the name in text. The mark
   * then carries an empty `alt`, so a screen reader hears the name once rather
   * than twice — and, more importantly, hears it at all: an accessible name
   * that rests on an image's `alt` is a name that depends on the image having
   * loaded, and these are lazy and come from another origin.
   */
  decorative?: boolean;
}

/**
 * A broadcaster shown as its own mark.
 *
 * Every mark sits on a light plate, in both themes. Without it the dark
 * artwork — Globo's circle, the YouTube wordmark, CazéTV — disappears against
 * a dark page; with it, a row of marks also reads as one kind of thing rather
 * than a jumble of floating shapes.
 *
 * When there is no mark the name is rendered in the same plate, so an
 * unfamiliar broadcaster lines up with the rest instead of looking broken.
 * That is the common case for anything outside the handful we curate.
 *
 * The image carries the name as its `alt`, so the marks read aloud exactly as
 * the text they replaced.
 */
export function BroadcasterMark({ name, size = "md", decorative = false }: BroadcasterMarkProps) {
  const src = broadcasterMarkUrl(name, size === "sm" ? 96 : 120);
  const plate =
    "inline-flex items-center rounded bg-plate ring-1 ring-plate-line align-middle";

  if (!src) {
    // The wordmark is real text, so it needs no alt and hiding it would drop
    // the name entirely when the caller is not supplying one.
    return (
      <span
        aria-hidden={decorative || undefined}
        className={`${plate} px-1.5 ${size === "sm" ? "py-px text-[10px]" : "py-0.5 text-xs"} font-semibold text-plate-ink`}
      >
        {name}
      </span>
    );
  }

  return (
    <span className={`${plate} ${size === "sm" ? "px-1 py-0.5" : "px-1.5 py-1"}`}>
      <img
        src={src}
        alt={decorative ? "" : name}
        loading="lazy"
        // Contained rather than stretched: these marks differ wildly in aspect
        // ratio, from Globo's circle to the prime video wordmark.
        className={`w-auto object-contain ${size === "sm" ? "h-3 max-w-14" : "h-4 max-w-20"}`}
      />
    </span>
  );
}
