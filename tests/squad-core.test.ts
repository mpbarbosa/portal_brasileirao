import assert from "node:assert/strict";
import { test } from "node:test";

import {
  LINE_ORDER,
  comparePlayers,
  lineOf,
  playerPositionLabel,
  sortSquads,
  squadSections,
  totalPlayers,
} from "@/squad-core";
import type { Club, Player, Squad } from "@/src/types";

const club = (code: string, shortName: string): Club => ({
  code,
  name: `${shortName} FC`,
  shortName,
  slug: shortName.toLowerCase(),
});

const player = (id: string, name: string, position?: string): Player => ({
  id,
  name,
  ...(position ? { position } : {}),
});

test("broad positions land on their own line", () => {
  assert.equal(lineOf("Goalkeeper"), "goleiros");
  assert.equal(lineOf("Defence"), "defensores");
  assert.equal(lineOf("Midfield"), "meio-campistas");
  assert.equal(lineOf("Offence"), "atacantes");
});

test("specific roles fold onto the broad line they belong to", () => {
  // The provider mixes both levels of detail in one squad, which is the whole
  // reason this map exists — a lateral must not become its own section.
  assert.equal(lineOf("Left-Back"), "defensores");
  assert.equal(lineOf("Centre-Back"), "defensores");
  assert.equal(lineOf("Defensive Midfield"), "meio-campistas");
  assert.equal(lineOf("Attacking Midfield"), "meio-campistas");
  assert.equal(lineOf("Right Winger"), "atacantes");
  assert.equal(lineOf("Centre-Forward"), "atacantes");
});

test("an absent or unrecognised position falls to outros rather than being guessed", () => {
  assert.equal(lineOf(undefined), "outros");
  assert.equal(lineOf("   "), "outros");
  assert.equal(lineOf("Sweeper"), "outros");
});

test("the caption repeats nothing the section heading already said", () => {
  // A "Defesa" line under every name in the Defensores section is the heading
  // again, once per row, for two thirds of the squad.
  assert.equal(playerPositionLabel(player("1", "Zagueiro", "Defence")), null);
  assert.equal(playerPositionLabel(player("2", "Sem posição")), null);
});

test("a specific role earns its caption, translated", () => {
  assert.equal(playerPositionLabel(player("3", "Lateral", "Left-Back")), "Lateral-esquerdo");
  assert.equal(playerPositionLabel(player("4", "Volante", "Defensive Midfield")), "Volante");
});

test("an unmapped specific position is captioned verbatim, never dropped", () => {
  // Same rule positionLabel follows: the English word beats nothing at all.
  assert.equal(playerPositionLabel(player("5", "Líbero", "Sweeper")), "Sweeper");
});

test("sections come back in reading order, and empty lines are dropped", () => {
  const sections = squadSections([
    player("1", "Atacante", "Offence"),
    player("2", "Goleiro", "Goalkeeper"),
    player("3", "Zagueiro", "Centre-Back"),
  ]);

  assert.deepEqual(
    sections.map((section) => section.line),
    ["goleiros", "defensores", "atacantes"],
  );
  // No meio-campistas in this squad, so no empty heading for it.
  assert.equal(sections.length, 3);
});

test("every line has a label, and the order is the one a squad is read in", () => {
  assert.deepEqual(LINE_ORDER, [
    "goleiros",
    "defensores",
    "meio-campistas",
    "atacantes",
    "outros",
  ]);

  const sections = squadSections(LINE_ORDER.map((line, i) => player(String(i), line)));
  assert.equal(sections.length, 1, "none of those position strings is a real position");
  assert.equal(sections[0].label, "Outros");
});

test("players sort alphabetically in pt-BR collation", () => {
  const sections = squadSections([
    player("1", "Zé Vitor", "Midfield"),
    player("2", "Ângelo", "Midfield"),
    player("3", "Bruno", "Midfield"),
  ]);

  assert.deepEqual(
    sections[0].players.map((entry) => entry.name),
    ["Ângelo", "Bruno", "Zé Vitor"],
  );
});

test("two players with the same name keep a stable order", () => {
  // Athletico-PR really does list two Dudus. Without the id tie-break their
  // order depends on the sort's stability, which is not a guarantee worth
  // relying on for a list that is diffed between syncs.
  const dudu = player("211606", "Dudu", "Midfield");
  const other = player("1584", "Dudu", "Defence");

  assert.ok(comparePlayers(other, dudu) < 0);
  assert.ok(comparePlayers(dudu, other) > 0);
  assert.equal(comparePlayers(dudu, dudu), 0);
});

const SQUADS: Squad[] = [
  { club: club("2", "Vasco"), players: [player("1", "Bruno", "Midfield")] },
  {
    club: club("1", "Athletico-PR"),
    players: [player("3", "Zé", "Offence"), player("2", "Ana", "Goalkeeper")],
  },
  { club: club("3", "Ceará"), players: [] },
];

test("squads come back alphabetical by club, players sorted within", () => {
  const sorted = sortSquads(SQUADS);

  assert.deepEqual(
    sorted.map((squad) => squad.club.shortName),
    ["Athletico-PR", "Ceará", "Vasco"],
  );
  assert.deepEqual(
    sorted[0].players.map((entry) => entry.name),
    ["Ana", "Zé"],
  );
});

test("sorting does not mutate what it was given", () => {
  const input: Squad[] = [
    { club: club("2", "Vasco"), players: [player("2", "Zé"), player("1", "Ana")] },
  ];
  sortSquads(input);

  assert.deepEqual(
    input[0].players.map((entry) => entry.id),
    ["2", "1"],
  );
});

test("a club with no listed squad survives sorting rather than being dropped", () => {
  // It is in the championship whether or not upstream filled its roster in.
  const sorted = sortSquads(SQUADS);
  assert.equal(sorted.length, 3);
  assert.deepEqual(sorted[1].players, []);
});

test("the total counts players, not clubs", () => {
  assert.equal(totalPlayers(SQUADS), 3);
  assert.equal(totalPlayers([]), 0);
});
