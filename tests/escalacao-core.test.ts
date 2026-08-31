import assert from "node:assert/strict";
import { test } from "node:test";

import {
  type CbfAtleta,
  STARTERS_PER_SIDE,
  bySection,
  lineupFor,
  lineupsFromAtletas,
  lineupsReconcile,
  startedFor,
  tidyLineupName,
  withLineups,
} from "@/escalacao-core";
import type { SideMap } from "@/goals-core";
import type { Lineup, Match } from "@/src/types";

const SIDES: SideMap = {
  homeCbfId: "1",
  awayCbfId: "2",
  homeCode: "PAL",
  awayCode: "VAS",
};

/**
 * Shaped exactly as CBF sends it — string booleans and a shirt number welded to
 * the front of the name. Writing the fixture with real booleans is what would
 * make every test here pass against the bug the module exists to survive.
 */
const atleta = (
  shirt: string,
  name: string,
  opts: { reserva?: string; goleiro?: string } = {},
): CbfAtleta => ({
  id: `id-${shirt}`,
  numero_camisa: shirt,
  reserva: opts.reserva ?? "false",
  goleiro: opts.goleiro ?? "false",
  entrou_jogando: opts.reserva === "true" ? "false" : "true",
  nome: `${shirt.padStart(2, "0")} - ${name} da Silva`,
  apelido: `${shirt.padStart(2, "0")} - ${name}`,
} as CbfAtleta);

const side = (id: string) => ({
  id,
  atletas: [
    ...Array.from({ length: STARTERS_PER_SIDE }, (_, i) =>
      atleta(String(i + 1), `Titular${i + 1}`, { goleiro: i === 0 ? "true" : "false" }),
    ),
    ...Array.from({ length: 5 }, (_, i) =>
      atleta(String(20 + i), `Reserva${i + 1}`, { reserva: "true" }),
    ),
  ],
});

test("reserva is a STRING, so a truthiness check reports nobody as a starter", () => {
  // The bug this module was written around: `if (a.reserva)` is true for every
  // player, because "false" is a non-empty string. Asserted directly so the
  // trap is named by a test rather than only by a comment.
  const bench = atleta("20", "Reserva", { reserva: "true" });
  const starter = atleta("1", "Titular");
  assert.equal(Boolean(starter.reserva), true, "the raw value is truthy for a STARTER");
  assert.equal(startedFor(starter), true);
  assert.equal(startedFor(bench), false);
});

test("the shirt number is stripped from the name and kept as its own field", () => {
  assert.equal(tidyLineupName("01 - Carlos"), "Carlos");
  assert.equal(tidyLineupName("9 - Vitor Roque"), "Vitor Roque");
  // CBF shouts sometimes; the same fold `tidyScorerName` applies to a scorer.
  assert.equal(tidyLineupName("09 - FACUNDO"), "Facundo");
  // A name that merely begins with a digit and no dash is left alone rather
  // than guessed at.
  assert.equal(tidyLineupName("7Even"), "7Even");
});

test("both sides map onto our club codes, with eleven starters each", () => {
  const lineups = lineupsFromAtletas(side("1"), side("2"), SIDES);
  assert.equal(lineups.length, 2);
  assert.deepEqual(
    lineups.map((l) => l.clubCode),
    ["PAL", "VAS"],
  );
  for (const lineup of lineups) {
    assert.equal(lineup.players.filter((p) => p.starter).length, STARTERS_PER_SIDE);
    assert.equal(lineup.players.filter((p) => p.keeper).length, 1);
    assert.ok(lineup.players.every((p) => !p.name.includes(" - ")));
  }
});

test("a side whose CBF id is not this fixture's is dropped, not guessed at", () => {
  const lineups = lineupsFromAtletas(side("999"), side("2"), SIDES);
  assert.deepEqual(
    lineups.map((l) => l.clubCode),
    ["VAS"],
  );
});

test("lineupsReconcile refuses what the string-boolean bug produces", () => {
  const good = lineupsFromAtletas(side("1"), side("2"), SIDES);
  assert.equal(lineupsReconcile(good), true);

  // Everyone a reserve — exactly the shape of the bug, and it must not pass.
  const allBench: Lineup[] = good.map((l) => ({
    ...l,
    players: l.players.map(({ starter: _starter, ...rest }) => rest),
  }));
  assert.equal(lineupsReconcile(allBench), false);

  // Ten starters is a sheet still being published, not a lineup.
  const short: Lineup[] = good.map((l) => ({
    ...l,
    players: l.players.filter((p, i) => !(p.starter && i === 0)),
  }));
  assert.equal(lineupsReconcile(short), false);

  // One side only.
  assert.equal(lineupsReconcile([good[0]]), false);

  // A blank shirt means CBF has not finished the team sheet.
  const noShirt: Lineup[] = good.map((l) => ({
    ...l,
    players: l.players.map((p, i) => (i === 0 ? { ...p, shirt: "" } : p)),
  }));
  assert.equal(lineupsReconcile(noShirt), false);
});

test("withLineups attaches only where there is something to attach", () => {
  const matches = [{ id: "a" }, { id: "b" }] as Match[];
  const lineups = lineupsFromAtletas(side("1"), side("2"), SIDES);
  const merged = withLineups(matches, { a: lineups });
  assert.equal(merged[0].lineups?.length, 2);
  assert.equal(merged[1].lineups, undefined);
  assert.equal(lineupFor(merged[0], "PAL")?.players.length, 16);
  assert.equal(lineupFor(merged[1], "PAL"), null);
});

test("bySection sorts by shirt as a number, not as text", () => {
  const lineup: Lineup = {
    clubCode: "PAL",
    players: [
      { name: "Dez", shirt: "10", starter: true },
      { name: "Nove", shirt: "9", starter: true },
      { name: "Um", shirt: "1", starter: true, keeper: true },
      { name: "Banco", shirt: "23" },
    ],
  };
  const { starters, bench } = bySection(lineup);
  // A lexical sort puts "10" before "9" and looks like a bug on every lineup.
  assert.deepEqual(
    starters.map((p) => p.shirt),
    ["1", "9", "10"],
  );
  assert.deepEqual(
    bench.map((p) => p.shirt),
    ["23"],
  );
});
