import assert from "node:assert/strict";
import { test } from "node:test";

import { controlClasses } from "@/src/components/Button";

test("every control shares the same chrome", () => {
  const classes = controlClasses();

  assert.match(classes, /rounded-lg/);
  assert.match(classes, /border-line-strong/);
  assert.match(classes, /text-ink-soft/);
  assert.match(classes, /hover:bg-raised/);
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
  assert.match(classes, /rounded-lg/);
});

test("no double spaces when no extras are passed", () => {
  assert.ok(!controlClasses().includes("  "));
  assert.ok(!controlClasses("md", "").endsWith(" "));
});
