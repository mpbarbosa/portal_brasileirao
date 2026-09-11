import assert from "node:assert/strict";
import { test } from "node:test";

import {
  slugify,
} from "@/slug-core";

test("slugify makes a name URL-safe and readable", () => {
  assert.equal(slugify("Flamengo"), "flamengo");
  assert.equal(slugify("São Paulo"), "sao-paulo");
  assert.equal(slugify("Grêmio"), "gremio");
  assert.equal(slugify("Vitória"), "vitoria");
  assert.equal(slugify("Clube do Remo"), "clube-do-remo");
});

test("slugify keeps Atlético-MG and Athletico-PR apart", () => {
  // The H is the only thing distinguishing two real Série A clubs.
  assert.equal(slugify("Atlético-MG"), "atletico-mg");
  assert.equal(slugify("Athletico-PR"), "athletico-pr");
  assert.notEqual(slugify("Atlético-MG"), slugify("Athletico-PR"));
});

test("slugify collapses punctuation without leaving stray hyphens", () => {
  assert.equal(slugify("  A. B./C  "), "a-b-c");
  assert.equal(slugify("--Santos--"), "santos");
});

test("a name with nothing alphanumeric yields no slug", () => {
  assert.equal(slugify("!!!"), "");
  assert.equal(slugify(""), "");
});
