import assert from "node:assert/strict";
import test from "node:test";

import { quadrantRect, trailSegmentAge, type ProfileScatter } from "@/scouts-core";

/**
 * The two pieces of the Perfil scatter's drawing arithmetic that lived inside
 * `ProfileScatter` while its own comment said it had none. Medians on exact
 * binary fractions, so the regions compare with `deepEqual` rather than with a
 * tolerance.
 */
const scatter = (medianX: number, medianY: number) =>
  ({ x: { medianAt: medianX }, y: { medianAt: medianY } }) as ProfileScatter;

test("above both medians is the top-right region, since SVG's y runs down", () => {
  assert.deepEqual(quadrantRect(scatter(0.25, 0.75), { aboveX: true, aboveY: true }), {
    x: 0.25,
    y: 0,
    width: 0.75,
    height: 0.25,
  });
});

test("below both medians is the bottom-left region", () => {
  assert.deepEqual(quadrantRect(scatter(0.25, 0.75), { aboveX: false, aboveY: false }), {
    x: 0,
    y: 0.25,
    width: 0.25,
    height: 0.75,
  });
});

test("the four corners tile the whole box with no overlap", () => {
  const s = scatter(0.375, 0.625);
  const corners = [true, false].flatMap((aboveX) =>
    [true, false].map((aboveY) => quadrantRect(s, { aboveX, aboveY })),
  );
  const area = corners.reduce((sum, r) => sum + r.width * r.height, 0);
  assert.equal(area, 1);
  for (const r of corners) {
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= 1 && r.y + r.height <= 1);
  }
});

test("a rastro's segments run from 0 at the oldest to 1 at the newest", () => {
  assert.equal(trailSegmentAge(0, 5), 0);
  assert.equal(trailSegmentAge(3, 5), 1);
  assert.equal(trailSegmentAge(1, 3), 1);
});

test("a two-point rastro's lone segment is the newest, not the faintest", () => {
  assert.equal(trailSegmentAge(0, 2), 1);
});
