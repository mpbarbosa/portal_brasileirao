import assert from "node:assert/strict";
import { test } from "node:test";

import {
  STANDINGS_MARK_STORAGE_KEY,
  markColumnLabel,
  markToggleLabel,
  otherMarkKind,
  parseMarkKind,
} from "@/standings-mark-core";

test("an absent or unrecognised value means the reader has never chosen", () => {
  // `campanha` rather than null: unlike the theme there is no system setting to
  // defer to, so the fallback is the column the table has always drawn.
  assert.equal(parseMarkKind(null), "campanha");
  assert.equal(parseMarkKind(undefined), "campanha");
  assert.equal(parseMarkKind(""), "campanha");
  assert.equal(parseMarkKind("{}"), "campanha");
  assert.equal(parseMarkKind("FORMA"), "campanha");
});

test("only the exact stored value selects the forma", () => {
  assert.equal(parseMarkKind("forma"), "forma");
  assert.equal(parseMarkKind("campanha"), "campanha");
});

test("the kinds are each other's opposite, and round-trip", () => {
  assert.equal(otherMarkKind("campanha"), "forma");
  assert.equal(otherMarkKind("forma"), "campanha");
  for (const kind of ["campanha", "forma"] as const) {
    assert.equal(otherMarkKind(otherMarkKind(kind)), kind);
  }
});

test("the column heading names what the column is", () => {
  assert.equal(markColumnLabel("campanha"), "Campanha");
  assert.equal(markColumnLabel("forma"), "Forma");
});

test("the toggle names the destination, never the current state", () => {
  // `themeToggleLabel`'s contract, and `plotKindToggleLabel`'s: a one-button
  // toggle reads as "press this to get that", and the heading beside it is what
  // shows where you are. Naming the current state makes the button a label.
  assert.equal(markToggleLabel("campanha"), "Ver a forma");
  assert.equal(markToggleLabel("forma"), "Ver a campanha");
  for (const kind of ["campanha", "forma"] as const) {
    assert.ok(markToggleLabel(kind).includes(markColumnLabel(otherMarkKind(kind)).toLowerCase()));
    assert.ok(!markToggleLabel(kind).includes(markColumnLabel(kind).toLowerCase()));
  }
});

test("the storage key is namespaced and distinct from the plot kind's", () => {
  // Two questions, two keys — a shared one would make choosing the forma also
  // redraw the campanha on the Clube and Partida pages.
  assert.match(STANDINGS_MARK_STORAGE_KEY, /^portal-brasileirao:/);
  assert.notEqual(STANDINGS_MARK_STORAGE_KEY, "portal-brasileirao:campanha-plot");
});
