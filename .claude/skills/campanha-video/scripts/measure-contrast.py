#!/usr/bin/env python3
"""Measure the contrast a rendered frame actually DELIVERS, in the encoded pixels.

    measure-contrast.py FRAME.png --at "tique de pontos:-6.6,-2.35" --at "crédito:4.5,-3.24"
    measure-contrast.py FRAME.png --px "chave do card:1700,500,1870,530"

Why this exists rather than reading the palette: the scenes in `scripts/manim/`
carry a hand-written palette that `npm run test:tokens` never sees, and h.264
takes a further bite out of thin glyphs — a narrow `0` measured **2.96** where
`50 pts` in the same colour measured 3.36. Both numbers come from the file a
viewer downloads, which is the only place the question can be settled.

`--at` takes MANIM SCENE coordinates (origin at the centre, 14.222 x 8 by
default), because that is what the scene source is written in: a label placed at
`[4.52, -3.24, 0]` is sampled by passing those two numbers, with no arithmetic
in between to get wrong. `--px` takes pixel bounds for anything else.

**A sample that lands on empty background reports NO INK rather than a ratio.**
That failure is otherwise silent and reads as a catastrophic result: the first
run of this measurement by hand returned `1.00` four times, which looks like
invisible text and was really a box aimed a few units off. The floor defaults to
4.5, this project's floor for text; pass `--floor 3` for a graphical mark.
"""

from __future__ import annotations

import argparse
import sys

import numpy as np
from PIL import Image


def luminance(rgb) -> float:
    c = np.asarray(rgb, dtype=float) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return float(0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2])


def ratio(fg, bg) -> float:
    a, b = luminance(fg), luminance(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def saturation(rgb) -> float:
    """HSV saturation, used only to notice that a sample caught a coloured mark."""
    c = np.asarray(rgb, dtype=float)
    hi = float(c.max())
    return 0.0 if hi == 0 else (hi - float(c.min())) / hi


def sample(image: np.ndarray, box: tuple[int, int, int, int]):
    """The glyph colour, the ground it sits on, and how much ink was found.

    Percentiles rather than min/max: antialiasing puts a spread of partial
    coverage between the two, and the extremes of that spread are single pixels
    that describe neither the type nor the background.
    """
    x0, y0, x1, y1 = box
    h, w, _ = image.shape
    x0, x1 = max(0, min(x0, x1)), min(w, max(x0, x1))
    y0, y1 = max(0, min(y0, y1)), min(h, max(y0, y1))
    if x1 <= x0 or y1 <= y0:
        return None, None, 0
    patch = image[y0:y1, x0:x1].reshape(-1, 3)
    lums = np.array([luminance(p) for p in patch])
    glyph = patch[lums >= np.percentile(lums, 97)].mean(axis=0)
    ground = patch[lums <= np.percentile(lums, 40)].mean(axis=0)
    # Ink is what stands clear of the ground. A box holding only background has
    # a spread of a couple of encoder LSBs and must not report a ratio.
    ink = int(np.count_nonzero(lums > (lums.min() + lums.max()) / 2))
    return glyph, ground, ink if (lums.max() - lums.min()) > 0.01 else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("frame", help="a PNG or JPEG frame, e.g. from `ffmpeg -ss N -i video.mp4 -frames:v 1`")
    parser.add_argument("--at", action="append", default=[], metavar="LABEL:X,Y",
                        help="a manim scene coordinate to sample around")
    parser.add_argument("--px", action="append", default=[], metavar="LABEL:X0,Y0,X1,Y1",
                        help="a pixel box to sample")
    parser.add_argument("--half", type=int, default=13, help="half-height in px of an --at box (default 13)")
    parser.add_argument("--width", type=int, default=90, help="width in px of an --at box (default 90)")
    parser.add_argument("--frame-units", default="14.222,8", metavar="W,H",
                        help="manim frame size in scene units (default 14.222,8)")
    parser.add_argument("--floor", type=float, default=4.5, help="contrast floor to judge against (default 4.5)")
    args = parser.parse_args()

    image = np.asarray(Image.open(args.frame).convert("RGB")).astype(float)
    height, width, _ = image.shape
    fw, fh = (float(v) for v in args.frame_units.split(","))

    def scene_to_px(x: float, y: float) -> tuple[int, int]:
        return int((x + fw / 2) / fw * width), int((fh / 2 - y) / fh * height)

    targets: list[tuple[str, tuple[int, int, int, int]]] = []
    for spec in args.at:
        label, _, coords = spec.rpartition(":")
        x, y = (float(v) for v in coords.split(","))
        cx, cy = scene_to_px(x, y)
        targets.append((label or coords, (cx - args.width // 2, cy - args.half, cx + args.width // 2, cy + args.half)))
    for spec in args.px:
        label, _, coords = spec.rpartition(":")
        x0, y0, x1, y1 = (int(v) for v in coords.split(","))
        targets.append((label or coords, (x0, y0, x1, y1)))

    if not targets:
        parser.error("nothing to sample: pass at least one --at or --px")

    print(f"{args.frame}  {width}x{height}  floor {args.floor}\n")
    worst = None
    for label, box in targets:
        glyph, ground, ink = sample(image, box)
        if not ink:
            print(f"  {label:38s} NO INK — the box holds only background; re-aim it")
            continue
        r = ratio(glyph, ground)
        verdict = "ok" if r >= args.floor else "BELOW FLOOR"
        worst = r if worst is None else min(worst, r)
        print(f"  {label:38s} {r:5.2f}  {verdict:11s} glyph #{''.join(f'{int(v):02x}' for v in glyph)}"
              f" on #{''.join(f'{int(v):02x}' for v in ground)}  {ink} px of ink")
        # The type in these scenes is near-neutral by construction, so a
        # saturated glyph is a candle, a bar or a swatch that the box reached
        # past the label to find — and it reports a FLATTERING number, which is
        # the direction a measurement must never fail in quietly.
        if saturation(glyph) > 0.25:
            print(f"  {'':38s}       ^ that glyph is coloured, so the box probably caught a MARK"
                  f" rather than type. Narrow it with --width.")

    if worst is not None and worst < args.floor:
        print(f"\nworst {worst:.2f} is below {args.floor} — see scripts/manim/README.md, 'INK_FAINT é RÉGUA e nunca TEXTO'")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
