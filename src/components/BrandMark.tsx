/**
 * The Portal Brasileirão mark.
 *
 * An arch — the portal — standing on the ground, with a rising campanha read
 * out of it. Deliberately **not** a crest: the Classificação already paints
 * twenty real club crests, and a site badge among them reads as a twenty-first
 * club rather than as the page it is on. The arch is the app's own name, and
 * the bars are the thing every screen here is ultimately about.
 *
 * It lives in its own file rather than in `SectionIcons.tsx`, which is where
 * `SunIcon` and `MoonIcon` went despite not being sections. That file exists to
 * hold one `base` attribute bag — `fill: none`, `stroke: currentColor`, stroke
 * width 2 — so a glyph defined beside its call site cannot drift from it. This
 * mark shares none of that contract: it is filled, it has no stroke, and it is
 * the brand rather than a glyph in a row of glyphs. Adding it there would mean
 * a second attribute bag in the file whose whole point is that there is one.
 *
 * **Filled rather than stroked, and that is what makes it a logo instead of a
 * seventh nav icon.** Measured against a stroked version of the same geometry
 * at 16, 24 and 28px in both themes: the stroked arch is legible at 24 and mush
 * at 16, which is the size a favicon is actually read at. The solid form holds
 * all three, and standing apart from the stroke set is right for the one mark
 * on the bar that is not a destination.
 *
 * One path with `fill-rule="evenodd"`, so the bars are **holes** rather than
 * painted shapes. A painted bar needs the colour of whatever is behind it, and
 * this sits on `surface` in the header, on `primary` in a tile and on a
 * browser's own tab strip — three answers to keep in step, against none.
 *
 * `currentColor`, so the theme costs nothing: the header gives it
 * `text-primary` and both palettes follow. `public/logo.svg` carries the same
 * geometry with explicit fills and a `prefers-color-scheme` block, because a
 * file loaded as an image inherits no colour from anything.
 */

interface BrandMarkProps {
  /** Tailwind classes for size and colour; the path inherits `currentColor`. */
  className?: string;
}

/**
 * `aria-hidden`, always. Every call site puts this beside the words "Portal
 * Brasileirão", so a label here would have a screen reader say the name twice —
 * the rule `SectionIcons` follows for the same reason.
 */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
      focusable={false}
    >
      <path
        fillRule="evenodd"
        d="M3 11A9 9 0 0 1 21 11V19.5A2.5 2.5 0 0 1 18.5 22H5.5A2.5 2.5 0 0 1 3 19.5ZM6.4 19.4V16.8H8.8V19.4ZM10.8 19.4V14.4H13.2V19.4ZM15.2 19.4V11.4H17.6V19.4Z"
      />
    </svg>
  );
}
