import assert from "node:assert/strict";
import { test } from "node:test";

import { controlClasses } from "@/src/components/Button";
import { STATE_LAYER } from "@/src/components/interaction";

test("every control shares the same chrome", () => {
  const classes = controlClasses();

  assert.match(classes, /rounded-small/);
  assert.match(classes, /border-outline/);
  assert.match(classes, /text-on-surface-variant/);
});

test("controls take the shared state layer rather than their own hover", () => {
  // The point of M2's state layer: one definition, so a control cannot hover to
  // a slightly different grey than the one beside it. Asserting containment
  // rather than the literal classes means this test does not need editing every
  // time MD3's opacities are revisited — only if a control stops sharing them.
  assert.ok(controlClasses().includes(STATE_LAYER));
});

test("controls are focusable visibly, not just hoverable", () => {
  // Before M2 there was no focus style anywhere in the app; a keyboard user got
  // whatever the browser drew. A hover-only control is unusable without a mouse.
  assert.match(controlClasses(), /focus-visible:/);
});

test("disabled styling is always present, so callers cannot forget it", () => {
  // Harmless on elements that cannot be disabled.
  assert.match(controlClasses("xs"), /disabled:opacity-40/);
  assert.match(controlClasses("md"), /disabled:opacity-40/);
});

test("each size maps to its own padding", () => {
  const sizes = ["xs", "sm", "md"] as const;
  const paddings = sizes.map((size) => controlClasses(size).match(/px-[\d.]+ py-[\d.]+/)?.[0]);

  assert.equal(new Set(paddings).size, sizes.length, "sizes must not collide");
  assert.match(controlClasses("md"), /px-3 py-2/);
});

test("md is the default size", () => {
  assert.equal(controlClasses(), controlClasses("md"));
});

test("extra classes are appended, not replacing the base", () => {
  const classes = controlClasses("sm", "shrink-0");

  assert.match(classes, /shrink-0/);
  assert.match(classes, /rounded-small/);
});

test("no double spaces when no extras are passed", () => {
  assert.ok(!controlClasses().includes("  "));
  assert.ok(!controlClasses("md", "").endsWith(" "));
});
