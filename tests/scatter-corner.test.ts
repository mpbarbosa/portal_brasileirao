import assert from "node:assert/strict";
import { test } from "node:test";

import { cornerPlacement } from "@/src/components/ProfileScatter";

/*
 * The four corners a quadrant label can sit in.
 *
 * These live in a unit test rather than in `painel.spec.ts` because the browser
 * suite cannot reach three of them: `openPanel` opens the table's leader, which
 * is above the median on finalizações, so every rendered assertion about this
 * label is about a right-hand one. The rule that had the bug is the left-hand
 * one. Same shape as the Perfil marker's spec, which passed for eighteen of
 * twenty clubs — and `tests/button-classes.test.ts` is the precedent for
 * asserting the class string itself.
 */

const CORNERS = [
  { aboveX: true, aboveY: true },
  { aboveX: true, aboveY: false },
  { aboveX: false, aboveY: true },
  { aboveX: false, aboveY: false },
] as const;

test("a label is placed in the corner it names, and in no other", () => {
  for (const corner of CORNERS) {
    const placed = cornerPlacement(corner);
    assert.match(placed, corner.aboveX ? /\bright-0\b/ : /\bleft-0\b/);
    assert.doesNotMatch(placed, corner.aboveX ? /\bleft-0\b/ : /\bright-0\b/);
    assert.match(placed, corner.aboveY ? /\btop-/ : /\bbottom-/);
    assert.doesNotMatch(placed, corner.aboveY ? /\bbottom-/ : /\btop-/);
  }
});

test("a LEFT-hand label drops a line clear of the y axis's own words", () => {
  // The defect this refuses shipped in the pass before this one, on the x axis:
  // two labels on one baseline read as one phrase. Here it would be
  // "mais jogo recuado" — the gutter's "mais"/"menos" sit at the box's top and
  // bottom edges, 8px to the left of the frame, so only a LEFT-hand label can
  // land beside them.
  assert.match(cornerPlacement({ aboveX: false, aboveY: true }), /\btop-4\b/);
  assert.match(cornerPlacement({ aboveX: false, aboveY: false }), /\bbottom-4\b/);

  // And the right-hand pair deliberately does NOT drop: there is nothing beside
  // them, and an offset would leave the label floating inside its own quadrant
  // rather than naming its corner. Asserting this is what stops the fix being
  // "generalised" to all four.
  assert.match(cornerPlacement({ aboveX: true, aboveY: true }), /\btop-0\b/);
  assert.match(cornerPlacement({ aboveX: true, aboveY: false }), /\bbottom-0\b/);
});

test("no two corners are placed alike", () => {
  // Four distinct positions, or two quadrants' labels land in one place and the
  // drawing names a corner that is not the club's.
  const placed = CORNERS.map(cornerPlacement);
  assert.equal(new Set(placed).size, 4);
});

test("the label never carries its own colour or type step", () => {
  // The token gate sweeps `src/`, not this string's assembly, so the one thing
  // it cannot see is a placement helper quietly growing a palette utility.
  for (const corner of CORNERS) {
    assert.doesNotMatch(cornerPlacement(corner), /text-(xs|sm|slate|emerald|rose|amber)/);
  }
});
