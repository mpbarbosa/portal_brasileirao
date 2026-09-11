import assert from "node:assert/strict";
import test from "node:test";

import { countLabel, countNoun, countPhrase } from "@/count-core";

test("the noun alone follows the same rule, for a component that renders the number itself", () => {
  assert.equal(countNoun(1, "gol", "gols"), "gol");
  assert.equal(countNoun(0, "gol", "gols"), "gols");
  assert.equal(countNoun(8, "gol", "gols"), "gols");
});

test("a count is its digits, grouped the pt-BR way", () => {
  assert.equal(countLabel(7), "7");
  assert.equal(countLabel(948), "948");
  assert.equal(countLabel(12_345), "12.345");
});

test("zero is a count and not an absence", () => {
  assert.equal(countLabel(0), "0");
  assert.equal(countPhrase(0, "posição", "posições"), "0 posições");
});

test("an unreported count is a dash, whether null or undefined", () => {
  assert.equal(countLabel(null), "—");
  assert.equal(countLabel(undefined), "—");
});

test("exactly one takes the singular and everything else the plural", () => {
  assert.equal(countPhrase(1, "gol", "gols"), "1 gol");
  assert.equal(countPhrase(2, "gol", "gols"), "2 gols");
  assert.equal(countPhrase(1_000, "jogador", "jogadores"), "1.000 jogadores");
});
