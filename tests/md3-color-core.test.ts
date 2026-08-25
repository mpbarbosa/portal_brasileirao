import assert from "node:assert/strict";
import { test } from "node:test";

import {
  contrastRatio,
  hctFromHex,
  hexFromHct,
  tonalPalette,
  toneFromY,
  yFromTone,
} from "@/md3-color-core";

/**
 * The palette every colour in the app is derived from, so an error here is not
 * a wrong shade — it is every wrong shade, in both themes, silently.
 *
 * The load-bearing fixture is Material's own published baseline. Seed #6750A4
 * generates a palette Google documents tone by tone, so it is a set of numbers
 * we did not choose and cannot accidentally fit to. Everything else in this
 * file checks a property; this checks the implementation against the spec.
 */

const channels = (hex: string): number[] =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Largest per-channel difference, so "off by rounding" reads differently to "wrong". */
const maxChannelDelta = (a: string, b: string): number =>
  Math.max(...channels(a).map((c, i) => Math.abs(c - channels(b)[i])));

test("reproduces Material's published baseline palette", () => {
  // Material 3 baseline primary palette, from the seed #6750A4.
  const published: Record<number, string> = {
    0: "#000000",
    10: "#21005d",
    20: "#381e72",
    30: "#4f378b",
    40: "#6750a4",
    50: "#7f67be",
    60: "#9a82db",
    70: "#b69df8",
    80: "#d0bcff",
    90: "#eaddff",
    95: "#f6edff",
    100: "#ffffff",
  };

  const seed = hctFromHex("#6750a4");
  const primary = tonalPalette(seed.hue, 48);

  for (const [tone, expected] of Object.entries(published)) {
    const actual = primary(Number(tone));
    const delta = maxChannelDelta(expected, actual);
    // 8-bit rounding and the gamut solver's tolerance both land inside 3/255.
    assert.ok(
      delta <= 3,
      `tone ${tone}: expected ${expected}, got ${actual} (off by ${delta})`,
    );
  }
});

test("the seed's own tone and chroma survive the round trip", () => {
  const seed = hctFromHex("#6750a4");
  // Material documents this seed as chroma 48.6, tone 40.0. The hue is a CAM16
  // angle rather than an HSL one, so it is near 299 and not the 258 a colour
  // picker reports — the palette test above is what pins the hue.
  assert.ok(Math.abs(seed.tone - 40) < 0.5, `tone ${seed.tone}`);
  assert.ok(Math.abs(seed.chroma - 48.6) < 1.5, `chroma ${seed.chroma}`);
});

test("tone is preserved exactly, because contrast depends on it", () => {
  for (const [hue, chroma, tone] of [
    [164.8, 48, 40],
    [164.8, 48, 80],
    [25, 84, 40],
    [258, 6, 6],
    [258, 8, 94],
  ] as const) {
    const back = hctFromHex(hexFromHct(hue, chroma, tone));
    assert.ok(
      Math.abs(back.tone - tone) < 0.5,
      `(${hue}, ${chroma}, ${tone}) came back at tone ${back.tone}`,
    );
  }
});

test("hue is preserved when the colour is inside the gamut", () => {
  for (const [hue, chroma, tone] of [
    [164.8, 40, 50],
    [25, 60, 50],
    [299, 40, 50],
  ] as const) {
    const back = hctFromHex(hexFromHct(hue, chroma, tone));
    const drift = Math.min(
      Math.abs(back.hue - hue),
      360 - Math.abs(back.hue - hue),
    );
    assert.ok(drift < 2, `hue ${hue} drifted to ${back.hue}`);
  }
});

test("chroma is capped by the gamut rather than clipped per channel", () => {
  // sRGB cannot show a vivid green at tone 95. The solver must reduce chroma and
  // keep the tone, because clipping a channel would move the tone instead — and
  // the tone is what the contrast guarantee rests on.
  const hex = hexFromHct(164.8, 100, 95);
  const back = hctFromHex(hex);
  assert.ok(back.chroma < 100, `expected chroma to be capped, got ${back.chroma}`);
  assert.ok(Math.abs(back.tone - 95) < 0.5, `tone drifted to ${back.tone}`);
});

test("the extremes are exactly black and white", () => {
  assert.equal(hexFromHct(164.8, 48, 0), "#000000");
  assert.equal(hexFromHct(164.8, 48, 100), "#ffffff");
});

test("MD3's tone-pair promise holds: 40 on 90 and 80 on 20 clear AA", () => {
  // This is the whole reason for adopting the system rather than picking hexes:
  // a fixed tone distance carries a known contrast ratio.
  for (const hue of [164.8, 25, 258, 70]) {
    const palette = tonalPalette(hue, 40);
    assert.ok(
      contrastRatio(palette(40), palette(90)) >= 4.5,
      `hue ${hue}: tone 40 on tone 90 fell below AA`,
    );
    assert.ok(
      contrastRatio(palette(80), palette(20)) >= 4.5,
      `hue ${hue}: tone 80 on tone 20 fell below AA`,
    );
  }
});

test("tone is CIE L*, not an arbitrary index", () => {
  // Tone 50 is mid-*lightness*, which is about 18% luminance — not 50%. Getting
  // this wrong would make every contrast figure in the app optimistic.
  assert.ok(Math.abs(yFromTone(50) - 18.42) < 0.05, `${yFromTone(50)}`);
  assert.ok(Math.abs(toneFromY(yFromTone(75)) - 75) < 1e-6);
});

test("contrastRatio matches the WCAG definition at its bounds", () => {
  assert.ok(Math.abs(contrastRatio("#000000", "#ffffff") - 21) < 0.01);
  assert.equal(contrastRatio("#123456", "#123456"), 1);
  // Symmetric: order of arguments must not change the ratio.
  assert.equal(
    contrastRatio("#10b981", "#111318"),
    contrastRatio("#111318", "#10b981"),
  );
});
