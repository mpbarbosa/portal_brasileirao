/**
 * capa-core.ts
 * ------------
 * What the two capa scripts share: reading a scene's own palette, and driving
 * the headless Chromium that draws the images.
 *
 * Extracted when `thumbnail-pontos.ts` became the second caller — the rule
 * `scripts/commons-api.ts` already records, and for the same reason. The
 * palette reader is the half that matters: a second copy is how a capa comes
 * to advertise the video in a colour the video does not use, silently, because
 * a hex that is merely *stale* still renders.
 *
 * **What is deliberately NOT here is the drawing.** The two capas are two
 * layouts — a pairing with one `×` against a whole division's fan — and folding
 * them into one parameterised renderer would be a design pretending to be a
 * loop. `thumbnail.ts`' own comment already refuses a third club for that
 * reason.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

/** A path to print. `path.relative` escapes the repo as `../../..`, which is unreadable
 *  in an error message — a payload named through an env var may sit anywhere. */
export const shown = (root: string, target: string) => {
  const relative = path.relative(root, target);
  return relative.startsWith("..") ? target : relative;
};

export const fail = (message: string): never => {
  console.error(`Error: ${message}`);
  process.exit(1);
};

/**
 * Read named colour constants out of a Manim scene.
 *
 * Only the names the caller draws with, so a constant the capa does not use may
 * be renamed freely; one it does use fails loudly rather than drawing in black.
 */
export const readInk = <K extends string>(
  root: string,
  scenePath: string,
  names: readonly K[],
): Record<K, string> => {
  const source = readFileSync(scenePath, "utf8");
  const ink = {} as Record<K, string>;
  for (const name of names) {
    const found = source.match(new RegExp(`^${name}\\s*=\\s*"(#[0-9A-Fa-f]{6})"`, "m"));
    if (!found) fail(`${name} is not defined in ${shown(root, scenePath)}`);
    ink[name] = found![1];
  }
  return ink;
};

/** The scene's `CLUB_COLOURS`, keyed by the provider's numeric code. */
export const readClubColours = (root: string, scenePath: string): Map<string, string> => {
  const source = readFileSync(scenePath, "utf8");
  const block = source.match(/CLUB_COLOURS\s*=\s*\{([\s\S]*?)\}/);
  if (!block) fail(`no CLUB_COLOURS map in ${shown(root, scenePath)}`);
  const byCode = new Map<string, string>();
  for (const [, code, colour] of block![1].matchAll(/"(\d+)":\s*"(#[0-9A-Fa-f]{6})"/g)) {
    byCode.set(code, colour);
  }
  return byCode;
};

/**
 * Every colour inside one named constant, as a list.
 *
 * A list and a lone string are both accepted because the two scenes genuinely
 * differ: `campanhas.py` cycles four fallbacks by payload index, `pontos.py`
 * maps all twenty clubs and keeps one. Cycling a one-element list is exactly
 * what that scalar means, so the caller's rule stays one rule.
 */
export const readColours = (root: string, scenePath: string, name: string): string[] => {
  const source = readFileSync(scenePath, "utf8");
  const found = source.match(new RegExp(`^${name}\\s*=\\s*(\\[[\\s\\S]*?\\]|"#[0-9A-Fa-f]{6}")`, "m"));
  if (!found) fail(`no ${name} in ${shown(root, scenePath)}`);
  const colours = [...found![1].matchAll(/"(#[0-9A-Fa-f]{6})"/g)].map(([, colour]) => colour);
  if (colours.length === 0) fail(`${name} in ${shown(root, scenePath)} names no colour`);
  return colours;
};

/**
 * `check` runs against the rendered page before it is written, and returns a
 * message to refuse on. It exists because a capa's failures are geometric —
 * two boxes overlapping, a headline running under a chart — and those are
 * invisible to `tsc`, to the type of the payload and to anybody who does not
 * open the file. A check that can refuse is worth more than a comment asking
 * somebody to look.
 */
export type Variant = {
  name: string;
  file: string;
  html: string;
  check?: (tab: Page) => Promise<string | null>;
};

/**
 * Draw each variant and write it.
 *
 * The same headless Chromium `scripts/screenshot.ts` uses, so this adds no
 * dependency — and unlike the render itself it needs **no Manim**, which is the
 * whole reason the capas can live in the repository's own toolchain where the
 * scenes cannot.
 */
export const capture = async (
  variants: Variant[],
  options: { root: string; outDir: string; width: number; height: number; note: string },
): Promise<void> => {
  const browser = await chromium.launch();
  try {
    const tab = await browser.newPage({
      viewport: { width: options.width, height: options.height },
      deviceScaleFactor: 1,
    });
    for (const variant of variants) {
      await tab.setContent(variant.html, { waitUntil: "load" });
      // Inter is a system font here rather than a webfont, but the wait is what
      // stops a capture landing while the fallback face is still measured.
      await tab.evaluate(() => document.fonts.ready);
      if (variant.check) {
        const complaint = await variant.check(tab);
        if (complaint) fail(`${variant.name}: ${complaint}`);
      }
      const out = path.join(options.outDir, variant.file);
      await tab.screenshot({ path: out });
      console.log(`${path.relative(options.root, out)}  (${variant.name}, ${options.note})`);
    }
  } finally {
    await browser.close();
  }
};
