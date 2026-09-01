/**
 * The brand mark is drawn in four places and only two of them can import a
 * constant. This is what holds the other two to it.
 *
 * `src/components/BrandMark.tsx` and `scripts/generate-og-image.ts` both take
 * the geometry from `brand-core.ts`, so the compiler already keeps those two
 * honest. `public/logo.svg` and `public/favicon.svg` are files a browser
 * fetches by URL — they cannot import anything, and nothing in the build reads
 * them, so a path edited in one place and not the other type-checks, builds,
 * passes every end-to-end spec and ships a tab icon subtly different from the
 * header. That is the failure this file exists for, and it is invisible for
 * exactly as long as nobody puts the two side by side.
 *
 * It asserts the *data* rather than the code, like `tests/player-photos.test.ts`:
 * the thing that can be wrong is a string inside an asset, and no type reaches
 * it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  BRAND_MARK_PATH,
  BRAND_MARK_VIEWBOX,
  BRAND_MARK_VIEWBOX_TIGHT,
} from "@/brand-core";

const read = (file: string): string =>
  readFileSync(path.join(process.cwd(), "public", file), "utf8");

const attr = (svg: string, name: string): string | undefined =>
  svg.match(new RegExp(`${name}="([^"]*)"`))?.[1];

for (const file of ["logo.svg", "favicon.svg"]) {
  test(`${file} draws the same path as brand-core`, () => {
    assert.equal(attr(read(file), "d"), BRAND_MARK_PATH);
  });

  test(`${file} sets fill-rule="evenodd"`, () => {
    // Without it the three bars fill solid under the default `nonzero` rule
    // and the mark renders as a plain arch — a silent, total loss of the
    // thing the mark is *of*, with the file still valid SVG.
    assert.equal(attr(read(file), "fill-rule"), "evenodd");
  });
}

test("logo.svg uses the padded grid and favicon.svg the tight crop", () => {
  // Not interchangeable: the favicon is read at 16px, where the grid's 3px of
  // transparent margin is a fifth of the slot. Swapping them is the one way
  // these two files are allowed to differ, so it is asserted rather than left
  // to whoever edits them next.
  assert.equal(attr(read("logo.svg"), "viewBox"), BRAND_MARK_VIEWBOX);
  assert.equal(attr(read("favicon.svg"), "viewBox"), BRAND_MARK_VIEWBOX_TIGHT);
});

test("both files carry a licence-free, theme-aware fill rather than one colour", () => {
  // A file loaded as an image inherits no `currentColor`, so each carries its
  // own palette. If a `prefers-color-scheme` block is ever dropped, the mark
  // becomes invisible in one of the two themes — on a tab strip, silently.
  for (const file of ["logo.svg", "favicon.svg"]) {
    const svg = read(file);
    assert.match(svg, /@media \(prefers-color-scheme: dark\)/, `${file} has no dark block`);
  }
});
