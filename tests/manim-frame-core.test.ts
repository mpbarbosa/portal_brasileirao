import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

/**
 * The vertical frame block, written by hand in every Manim scene that has one,
 * asserted here to be the same four numbers everywhere.
 *
 * `velas.py` (#428) works out what 1080x1350 and 1080x1920 have to be: manim
 * 0.21.0 does **not** derive `frame_width` from the pixel ratio, so asking for
 * `-r 1080,1350` alone leaves the frame at 14.22 x 8.0 and the scene paints
 * outside the border with no error at all. Both values are therefore written
 * out, and they are chosen to hold **135 px per unit** — the density of the
 * 16:9 frame (1920/14.222 = 1080/8) — so a `label(..., 16, ...)` renders the
 * same pixel height in every cut and the vertical crop reflows two columns
 * into one rather than shrinking any type.
 *
 * `barras.py` (#444) reused that switch by writing a **second copy** of the
 * four numbers. Measured when this file was written: the two copies are
 * identical and both give 135 px/unit in both cuts. So there is no defect
 * here — there is a measured constant written twice with nothing comparing
 * the copies, which is the shape `CLAUDE.md` catalogues as *a claim that
 * produces no work while it holds, so nothing distinguishes "still true" from
 * "quietly false"*. This file is the command that would fail.
 *
 * **Not extracted into a shared module, deliberately.** Four numbers do not
 * pay for a fourth file under `scripts/manim/`, and each scene naming its own
 * switch (`VELAS_ASPECT`, `BARRAS_ASPECT`) is right — they are separate
 * scenes and a reader renders one at a time. What was missing was never the
 * abstraction; it was a gate. This is `tests/node-version.test.ts`' answer to
 * the five Node declarations, one directory over.
 *
 * **Scenes are DISCOVERED, never listed.** A hard-coded pair would leave the
 * third scene to arrive unwatched in exactly the way `barras.py` did, which is
 * the mechanism this file exists to close rather than the instance —
 * `tests/appearance-paths.test.ts`' rule. The vacuity guard below is the other
 * half: if the parse ever stops matching, "they all agree" passes over an
 * empty set, and a green test that cannot see its subject is worse than none.
 */

const SCENES = new URL("../scripts/manim/", import.meta.url);

/** What a scene declares inside its `if VERTICAL:` block, in scene units and px. */
type FrameBlock = {
  pixelWidth: number;
  /** [4:5, 9:16] — the file writes them as one conditional expression. */
  pixelHeight: [number, number];
  frameWidth: number;
  frameHeight: [number, number];
};

/**
 * Read the four assignments out of a scene.
 *
 * Deliberately a text scrape rather than anything cleverer: these are Python
 * files that no TypeScript tool can import, and running manim to ask it would
 * make a unit test depend on a virtualenv that CI does not have. The shapes
 * matched are exactly the ones both scenes write today, and a scene that
 * writes them some other way reports as *unparsed* rather than as agreeing —
 * see the vacuity guard.
 */
const readFrameBlock = (source: string): FrameBlock | null => {
  const one = (name: string) =>
    source.match(new RegExp(`config\\.${name}\\s*=\\s*([0-9.]+)\\s*$`, "m"))?.[1];
  // `config.pixel_height = 1920 if REELS else 1350` — reels first, feed second.
  const pair = (name: string) =>
    source.match(
      new RegExp(`config\\.${name}\\s*=\\s*([0-9.]+)\\s+if\\s+REELS\\s+else\\s+([0-9.]+)`),
    );

  const pixelWidth = one("pixel_width");
  const frameWidth = one("frame_width");
  const pixelHeight = pair("pixel_height");
  const frameHeight = pair("frame_height");
  if (!pixelWidth || !frameWidth || !pixelHeight || !frameHeight) return null;

  return {
    pixelWidth: Number(pixelWidth),
    frameWidth: Number(frameWidth),
    // Ordered [4:5, 9:16] to match how a reader thinks about them, which is the
    // reverse of how the file writes them.
    pixelHeight: [Number(pixelHeight[2]), Number(pixelHeight[1])],
    frameHeight: [Number(frameHeight[2]), Number(frameHeight[1])],
  };
};

const scenes = readdirSync(SCENES)
  .filter((name) => name.endsWith(".py"))
  .map((name) => ({
    name,
    block: readFrameBlock(readFileSync(path.join(SCENES.pathname, name), "utf8")),
  }));

const withFrame = scenes.filter((s) => s.block !== null) as {
  name: string;
  block: FrameBlock;
}[];

test("more than one scene declares a vertical frame, so the comparison is not vacuous", () => {
  // Without this, a parse that silently stops matching turns every assertion
  // below into a loop over nothing. The count is a floor rather than an
  // expected value: a third scene taking the switch must not redden this.
  assert.ok(
    withFrame.length >= 2,
    `expected at least two Manim scenes with a vertical frame block, found ` +
      `${withFrame.length} of ${scenes.length} .py files ` +
      `(${withFrame.map((s) => s.name).join(", ") || "none"}). ` +
      `If a scene changed how it writes those four assignments, teach ` +
      `readFrameBlock the new shape — do not delete this test.`,
  );
});

test("every scene's vertical frame block holds the same four numbers", () => {
  const [first, ...rest] = withFrame;
  for (const other of rest) {
    assert.deepEqual(
      other.block,
      first.block,
      `${other.name} and ${first.name} disagree about the vertical frame. ` +
        `These are hand-written copies of one measured constant, so one of ` +
        `them has moved: make them agree rather than relaxing this test.`,
    );
  }
});

test("every vertical cut renders at 135 px per scene unit, on both axes", () => {
  // The whole point of writing frame_width/frame_height by hand. If this drifts
  // the crop silently starts shrinking type instead of reflowing the layout,
  // and nothing about the rendered mp4 looks wrong until somebody reads it on
  // a phone.
  const DENSITY = 135;
  for (const { name, block } of withFrame) {
    assert.equal(
      block.pixelWidth / block.frameWidth,
      DENSITY,
      `${name}: horizontal density is ${block.pixelWidth / block.frameWidth}, not ${DENSITY}`,
    );
    for (const [i, cut] of (["4:5", "9:16"] as const).entries()) {
      const density = block.pixelHeight[i] / block.frameHeight[i];
      assert.ok(
        Math.abs(density - DENSITY) < 0.001,
        `${name} at ${cut}: vertical density is ${density}, not ${DENSITY}`,
      );
    }
  }
});

test("every scene with a frame block guards its aspect vocabulary", () => {
  // A scene that reads an env var and falls through to 16:9 on a typo spends
  // the whole render before anybody finds out — `goals-core.ts`' closed
  // vocabulary, applied to a switch rather than to a scoreline.
  for (const { name } of withFrame) {
    const source = readFileSync(path.join(SCENES.pathname, name), "utf8");
    assert.match(
      source,
      /raise SystemExit\(/,
      `${name} declares a vertical frame but never refuses an unknown aspect. ` +
        `A mistyped value must abort rather than quietly render 16:9.`,
    );
  }
});
