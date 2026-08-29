import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CAMPAIGN_PLOT_STORAGE_KEY,
  otherPlotKind,
  parsePlotKind,
  plotKindToggleLabel,
} from "@/campaign-plot-core";

test("an absent or unreadable choice falls back to the line", () => {
  // Unlike the theme there is no system setting to defer to, so anything that
  // is not an explicit "bars" means the mark the column has always drawn.
  assert.equal(parsePlotKind(null), "line");
  assert.equal(parsePlotKind(undefined), "line");
  assert.equal(parsePlotKind(""), "line");
  assert.equal(parsePlotKind("{}"), "line");
  assert.equal(parsePlotKind("Bars"), "line");
});

test("a stored choice is honoured", () => {
  assert.equal(parsePlotKind("bars"), "bars");
  assert.equal(parsePlotKind("line"), "line");
});

test("the toggle names the mark it switches to, not the one on screen", () => {
  // The page already shows which mark is drawn; a one-button toggle has to say
  // what pressing it gets you. Same contract as `themeToggleLabel`.
  assert.match(plotKindToggleLabel("line"), /barras/i);
  assert.match(plotKindToggleLabel("bars"), /linha/i);
});

test("flipping twice returns the reader to where they started", () => {
  assert.equal(otherPlotKind("line"), "bars");
  assert.equal(otherPlotKind(otherPlotKind("line")), "line");
});

test("the storage key is namespaced to this app", () => {
  // It shares `localStorage` with every other site on the origin, and with the
  // theme key beside it.
  assert.match(CAMPAIGN_PLOT_STORAGE_KEY, /^portal-brasileirao:/);
  assert.notEqual(CAMPAIGN_PLOT_STORAGE_KEY, "portal-brasileirao:theme");
});
