/**
 * brand-core.ts
 * -------------
 * The one copy of the brand mark's geometry.
 *
 * The mark — an arch, the portal, with a rising campanha knocked out of it —
 * is drawn in four places that cannot import each other's markup:
 * `src/components/BrandMark.tsx` for the header, `public/logo.svg` and
 * `public/favicon.svg` as static files a browser loads directly, and the
 * link-preview card that `scripts/generate-og-image.ts` renders. Four literal
 * copies of one path is exactly the drift `StatusChip` and `GLYPH` exist to
 * stop, one asset type further out.
 *
 * The two TypeScript call sites import from here, so they cannot disagree.
 * **The two `.svg` files still hold their own copy and always will** — a file
 * a browser fetches by URL cannot import a module — so
 * `tests/brand-mark.test.ts` reads them off disk and asserts they match this
 * constant. That is the same shape as `tests/player-photos.test.ts` asserting
 * the *data* rather than the code: the compiler cannot reach a string inside
 * an SVG file, and a mark that is a shade different in the tab from the one in
 * the header is the kind of thing nobody notices for months.
 *
 * Pure, no I/O, root-level `*-core.ts` like every other module of that name —
 * though it holds a constant rather than a calculation, which is why there is
 * nothing here to unit-test beyond the agreement above.
 */

/**
 * The mark as a single `d`, with **`fill-rule="evenodd"`** — that attribute is
 * not optional decoration. The three bars are subpaths *inside* the arch, and
 * under the default `nonzero` rule they would fill solid and the mark would be
 * a plain arch. Every call site must set it.
 *
 * Drawn on a 24x24 grid, matching `SectionIcons.tsx`, so the mark and the nav
 * glyphs take the same `size-*` utilities and land on the same optical size.
 */
export const BRAND_MARK_PATH =
  "M3 11A9 9 0 0 1 21 11V19.5A2.5 2.5 0 0 1 18.5 22H5.5A2.5 2.5 0 0 1 3 19.5ZM6.4 19.4V16.8H8.8V19.4ZM10.8 19.4V14.4H13.2V19.4ZM15.2 19.4V11.4H17.6V19.4Z";

/** The drawing grid, shared with the icon set. */
export const BRAND_MARK_VIEWBOX = "0 0 24 24";

/**
 * The mark's own bounding box, for a slot where it must fill the frame rather
 * than sit inside the grid's margin — a 16px favicon, or a tile. Cropping by
 * viewBox rather than by a second path keeps one geometry.
 */
export const BRAND_MARK_VIEWBOX_TIGHT = "3 2 18 20";
