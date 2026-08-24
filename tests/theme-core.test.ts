import assert from "node:assert/strict";
import { test } from "node:test";

import {
  oppositeTheme,
  parsePreference,
  resolveTheme,
  themeToggleLabel,
} from "@/theme-core";

test("only the two themes are valid stored preferences", () => {
  assert.equal(parsePreference("light"), "light");
  assert.equal(parsePreference("dark"), "dark");
});

test("junk in storage reads as no preference, not a crash", () => {
  // Storage is shared with anything else on the origin.
  assert.equal(parsePreference("LIGHT"), null);
  assert.equal(parsePreference("sepia"), null);
  assert.equal(parsePreference(""), null);
  assert.equal(parsePreference(null), null);
  assert.equal(parsePreference(undefined), null);
});

test("an explicit choice wins over the system", () => {
  assert.equal(resolveTheme("dark", true), "dark");
  assert.equal(resolveTheme("light", false), "light");
});

test("without a choice, the system decides", () => {
  assert.equal(resolveTheme(null, true), "light");
  assert.equal(resolveTheme(null, false), "dark");
});

test("dark is the fallback when the system says nothing", () => {
  // Matches how the app looked before it had a light theme.
  assert.equal(resolveTheme(null, false), "dark");
});

test("toggling returns the other theme", () => {
  assert.equal(oppositeTheme("light"), "dark");
  assert.equal(oppositeTheme("dark"), "light");
});

test("the toggle is labelled with what it will do, not what is active", () => {
  // A control labelled "tema claro" while light is active reads as a state.
  assert.equal(themeToggleLabel("light"), "Ativar tema escuro");
  assert.equal(themeToggleLabel("dark"), "Ativar tema claro");
});
