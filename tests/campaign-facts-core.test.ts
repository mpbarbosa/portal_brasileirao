import assert from "node:assert/strict";
import { test } from "node:test";

import { campaignFacts } from "@/campaign-facts-core";
import type { Club, ClubRankHistory, StandingsRow } from "@/src/types";

const club = (code: string, shortName: string): Club =>
  ({ code, name: shortName, shortName, tla: code.slice(0, 3) }) as Club;

/** A campanha from a list of positions, one per round starting at round 1. */
const campaign = (code: string, name: string, positions: number[]): ClubRankHistory => ({
  clubCode: code,
  shortName: name,
  entries: positions.map((position, i) => ({
    round: i + 1,
    position,
    points: 0,
    played: i + 1,
  })),
});

const row = (code: string, name: string, draws: number, played = 10): StandingsRow =>
  ({
    position: 1,
    club: club(code, name),
    played,
    wins: 0,
    draws,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  }) as StandingsRow;

const find = (facts: ReturnType<typeof campaignFacts>, id: string) =>
  facts.find((f) => f.id === id);

test("a tie names every club that holds the record", () => {
  // Two clubs fall exactly five places. Naming one of them is the failure this
  // module exists for — it is what four hand-written superlatives got wrong.
  const facts = campaignFacts([
    campaign("A", "Alfa", [1, 2, 3, 4, 5, 6]),
    campaign("B", "Beta", [3, 4, 5, 6, 7, 8]),
    campaign("C", "Gama", [10, 10, 10, 10, 10, 10]),
  ]);
  const fall = find(facts, "maior-queda");
  assert.ok(fall);
  assert.equal(fall.value, 5);
  assert.deepEqual(
    fall.clubs.map((c) => c.shortName).sort(),
    ["Alfa", "Beta"],
    "both clubs fell five places and both must be named",
  );
});

test("a tie says how many share it rather than reading as one club's", () => {
  const facts = campaignFacts([
    campaign("A", "Alfa", [1, 6]),
    campaign("B", "Beta", [3, 8]),
  ]);
  assert.equal(find(facts, "maior-queda")?.detail, "2 clubes empatados");
});

test("a record held alone reads as that club's own", () => {
  const facts = campaignFacts([
    campaign("A", "Alfa", [1, 9]),
    campaign("B", "Beta", [3, 4]),
  ]);
  const fall = find(facts, "maior-queda");
  assert.equal(fall?.clubs.length, 1);
  assert.equal(fall?.detail, "do 1º ao 9º");
});

test("the most stable campanha is reported at all", () => {
  // A MINIMUM reported through a maximiser arrives negative, and the guard that
  // drops a zero-valued record then swallowed it in silence: the fact never
  // rendered and nothing anywhere said so. This is that bug's test.
  const facts = campaignFacts([
    campaign("A", "Alfa", [1, 8, 2, 9]),
    campaign("B", "Beta", [5, 6, 5, 6]),
  ]);
  const stable = find(facts, "campanha-mais-estavel");
  assert.ok(stable, "the most stable campanha must be one of the facts");
  assert.equal(stable.value, 1);
  assert.deepEqual(stable.clubs.map((c) => c.shortName), ["Beta"]);
});

test("a club that never moved is a record of zero, not a dropped fact", () => {
  const facts = campaignFacts([
    campaign("A", "Alfa", [4, 4, 4, 4]),
    campaign("B", "Beta", [2, 9, 3]),
  ]);
  const stable = find(facts, "campanha-mais-estavel");
  assert.equal(stable?.value, 0, "zero is the record itself for a minimum");
  assert.deepEqual(stable?.clubs.map((c) => c.shortName), ["Alfa"]);
});

test("nobody having fallen drops the fact rather than printing zero", () => {
  // Every club improves or holds, so "a maior queda foi de 0 posições" is a
  // season nobody has played rather than a curiosity.
  const facts = campaignFacts([
    campaign("A", "Alfa", [5, 4, 3]),
    campaign("B", "Beta", [9, 9, 8]),
  ]);
  assert.equal(find(facts, "maior-queda"), undefined);
  assert.ok(find(facts, "maior-subida"), "the climb is real and stays");
});

test("an extreme in the opening two rounds is marked as alphabetical", () => {
  // Before a club's first match, clubs level on nothing are ordered by NAME —
  // so a 1º from round 1 is alphabet and not football. It is reported rather
  // than hidden, following `rank-candles-core`'s refusal to special-case it.
  const fromRound1 = campaignFacts([
    campaign("A", "Alfa", [1, 5, 9, 12]),
    campaign("B", "Beta", [8, 8, 8, 8]),
  ]);
  assert.equal(find(fromRound1, "maior-queda")?.alphabetical, true);

  const fromLater = campaignFacts([
    campaign("A", "Alfa", [8, 8, 1, 13]),
    campaign("B", "Beta", [5, 5, 5, 5]),
  ]);
  assert.equal(
    find(fromLater, "maior-queda")?.alphabetical,
    false,
    "a peak reached in round 3 was earned on the pitch",
  );
});

test("rounds in front counts closes, and says whether the club still leads", () => {
  const facts = campaignFacts([
    campaign("A", "Alfa", [1, 1, 1, 4]),
    campaign("B", "Beta", [2, 2, 2, 1]),
  ]);
  const front = find(facts, "mais-rodadas-na-ponta");
  assert.equal(front?.value, 3);
  assert.deepEqual(front?.clubs.map((c) => c.shortName), ["Alfa"]);
  assert.equal(front?.detail, "hoje em 4º");
});

test("most draws comes from the table and reports its ties too", () => {
  // This is where the tie that taught the module its rule actually was: two
  // clubs level on ten draws, and the sentence named one of them.
  const facts = campaignFacts(
    [campaign("A", "Alfa", [1, 2])],
    [row("A", "Alfa", 10), row("B", "Beta", 10), row("C", "Gama", 4)],
  );
  const draws = find(facts, "mais-empates");
  assert.equal(draws?.value, 10);
  assert.deepEqual(draws?.clubs.map((c) => c.shortName).sort(), ["Alfa", "Beta"]);
});

test("an empty campanha produces no facts rather than zeros", () => {
  assert.deepEqual(campaignFacts([]), []);
  assert.deepEqual(campaignFacts([{ clubCode: "A", shortName: "Alfa", entries: [] }]), []);
});
