/**
 * The attributes every hand-drawn 24px glyph in this app shares.
 *
 * One bag where there were three: `SectionIcons.tsx` kept `base`, `ClubLinks.tsx`
 * kept `GLYPH` with the same attributes plus an inline size, and `StadiumView`
 * typed them out again by hand. Each copy's comment said it existed so that a
 * glyph defined beside its call site could not drift — which only holds while
 * there is one of it. Stroke weight, cap and join are decided here and nowhere
 * else.
 *
 * Monochrome outlines in `currentColor`, so a mark re-themes, and warms on hover
 * with the text beside it, needing nothing of its own in either theme.
 * `aria-hidden` because the text beside a mark already names the thing, and an
 * announced icon would say it twice.
 */
export const GLYPH_STROKE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

/**
 * A glyph set inline with text: one em square on the text's baseline.
 *
 * `inline-block` is load-bearing rather than incidental: text-decoration is not
 * drawn through an atomic inline box, so a link's underline stops at its icon
 * instead of running under it. A caller drawing the mark as a standalone icon
 * passes its own `className` after the spread.
 */
export const GLYPH = {
  ...GLYPH_STROKE,
  className: "mr-1 inline-block h-[1em] w-[1em] align-[-0.125em]",
};
