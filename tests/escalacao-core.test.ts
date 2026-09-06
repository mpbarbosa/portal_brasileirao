import assert from "node:assert/strict";
import { test } from "node:test";

import {
  type CbfAtleta,
  attachSubstitutions,
  STARTERS_PER_SIDE,
  bySection,
  lineupFor,
  lineupsFromAtletas,
  lineupsReconcile,
  startedFor,
  subShirtLabels,
  tidyLineupName,
  withLineups,
} from "@/escalacao-core";
import type { SideMap } from "@/goals-core";
import type { SumulaSubstitution } from "@/sumula-core";
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

/**
 * `shirtBase` exists because the default fixture gives **both** sides the same
 * numbers, and a symmetric fixture cannot exercise a join that resolves a side
 * *by* its numbers — the first version of the corporate-name test below asked
 * the shirts to disambiguate two identical sheets and failed for that reason
 * rather than for the reason it names. Pass a base to make the sides distinct.
 */
const side = (id: string, shirtBase = 0) => ({
  id,
  atletas: [
    ...Array.from({ length: STARTERS_PER_SIDE }, (_, i) =>
      atleta(String(shirtBase + i + 1), `Titular${i + 1}`, { goleiro: i === 0 ? "true" : "false" }),
    ),
    ...Array.from({ length: 5 }, (_, i) =>
      atleta(String(shirtBase + 20 + i), `Reserva${i + 1}`, { reserva: "true" }),
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


// ---------------------------------------------------------------------------
// Substitutions — two sources joined on the shirt number
// ---------------------------------------------------------------------------

const TEAMS = [
  { code: "PAL" as const, cbfName: "Palmeiras" },
  { code: "VAS" as const, cbfName: "Vasco da Gama Saf" },
];

const sub = (over: Partial<SumulaSubstitution> = {}): SumulaSubstitution => ({
  period: "2T",
  minute: 25,
  team: "Palmeiras/SP",
  onShirt: "20",
  offShirt: "1",
  ...over,
});

test("a substitution resolves both shirts against that side's own sheet", () => {
  const lineups = lineupsFromAtletas(side("1"), side("2"), SIDES);
  const attached = attachSubstitutions(lineups, [sub()], TEAMS, { PAL: 1, VAS: 0 });
  assert.ok(attached);
  const pal = attached.find((l) => l.clubCode === "PAL");
  // The shirts ride along: they are the join, and `subShirtLabels` needs them
  // to tell two players of one name apart on the page.
  assert.deepEqual(pal?.subs, [
    { on: "Reserva1", off: "Titular1", onShirt: "20", offShirt: "1", minute: "70'" },
  ]);
  // The other side made none, so it carries no key rather than an empty list.
  assert.equal(attached.find((l) => l.clubCode === "VAS")?.subs, undefined);
});

test("the súmula's Equipe carries a UF the match API does not", () => {
  const lineups = lineupsFromAtletas(side("1"), side("2"), SIDES);
  // `Vasco da Gama Saf/RJ` against the API's `Vasco da Gama Saf`.
  const attached = attachSubstitutions(
    lineups,
    [sub({ team: "Vasco da Gama Saf/RJ" })],
    TEAMS,
    { PAL: 0, VAS: 1 },
  );
  assert.equal(attached?.find((l) => l.clubCode === "VAS")?.subs?.length, 1);
});

test("anything that cannot be placed refuses the WHOLE fixture, not the row", () => {
  const lineups = lineupsFromAtletas(side("1"), side("2"), SIDES);
  const expected = { PAL: 2, VAS: 0 };

  // A shirt nobody on that sheet wears. Dropping just this row would read as a
  // complete record of a match where the change never happened.
  assert.equal(
    attachSubstitutions(lineups, [sub(), sub({ onShirt: "99" })], TEAMS, expected),
    null,
  );

  // A team string matching neither side.
  assert.equal(
    attachSubstitutions(lineups, [sub({ team: "Botafogo/RJ" })], TEAMS, { PAL: 0, VAS: 0 }),
    null,
  );
});

test("both sources must agree on HOW MANY before either is believed", () => {
  const lineups = lineupsFromAtletas(side("1"), side("2"), SIDES);
  // The súmula lists one; the match API counted two. One of them is wrong and
  // this cannot tell which, so it refuses rather than picking.
  assert.equal(attachSubstitutions(lineups, [sub()], TEAMS, { PAL: 2, VAS: 0 }), null);
  // And the reverse: the API counted none.
  assert.equal(attachSubstitutions(lineups, [sub()], TEAMS, { PAL: 0, VAS: 0 }), null);
});


test("a corporate suffix the match API does not print still resolves, by the name", () => {
  // Real strings, from CBF for Atlético-MG x Palmeiras on 2026-01-28: the
  // súmula writes the corporate name and the match API the popular one. This
  // cost 8 matches and 16 sides of the season backfill — the parse was perfect
  // and the join was not, and because this function is all-or-nothing it took
  // the Palmeiras side down with it.
  //
  // Note which branch answers now. This used to reach the shirt fallback, and
  // with the name compared on its punctuation-stripped prefix it resolves one
  // step earlier — the shirts would still answer, so the widening only ever
  // moves the resolution forward. The test below is the one that keeps the
  // fallback itself covered.
  const lineups = lineupsFromAtletas(side("1"), side("2", 50), SIDES);
  const attached = attachSubstitutions(
    lineups,
    [sub({ team: "Atlético Mineiro Saf/MG", onShirt: "20", offShirt: "1" })],
    [
      { code: "PAL" as const, cbfName: "Atlético Mineiro" },
      { code: "VAS" as const, cbfName: "Palmeiras" },
    ],
    { PAL: 1, VAS: 0 },
  );
  assert.ok(attached, "the name resolves once the suffix is set aside");
  assert.equal(attached.find((l) => l.clubCode === "PAL")?.subs?.length, 1);
});

test("two spellings of one abbreviation are one club", () => {
  // 554753, Cruzeiro x Coritiba on 2026-02-05, and the pair that made the season
  // refuse it: the súmula writes `Coritiba S.a.f./PR` where the match API says
  // `Coritiba SAF`. Three spellings of `SAF` across two endpoints of one
  // provider, and the difference here is two full stops.
  //
  // The fixture is SYMMETRIC on purpose — both sides wear the same numbers, so
  // the shirt fallback cannot answer and the name is the only thing that can.
  // That is 554753's real shape: 8 of its 10 rows were unambiguous on shirts and
  // 2 were not, which is all it takes when the rule is all-or-nothing.
  const lineups = lineupsFromAtletas(side("1"), side("2"), SIDES);
  const attached = attachSubstitutions(
    lineups,
    [sub({ team: "Coritiba S.a.f./PR", onShirt: "20", offShirt: "1" })],
    [
      { code: "PAL" as const, cbfName: "Cruzeiro" },
      { code: "VAS" as const, cbfName: "Coritiba SAF" },
    ],
    { PAL: 0, VAS: 1 },
  );
  assert.ok(attached, "S.a.f. and SAF are the same three letters");
  assert.equal(attached.find((l) => l.clubCode === "VAS")?.subs?.length, 1);
});

test("a name that resolves neither way still falls through to the shirts", () => {
  // The fallback has to stay reachable, or widening the name quietly strands it.
  // Nothing here shares a prefix with either club, and the sides wear distinct
  // numbers, so only the structure can place the row.
  const lineups = lineupsFromAtletas(side("1"), side("2", 50), SIDES);
  const attached = attachSubstitutions(
    lineups,
    [sub({ team: "Grêmio Foot-Ball Porto Alegrense/RS", onShirt: "70", offShirt: "51" })],
    TEAMS,
    { PAL: 0, VAS: 1 },
  );
  assert.ok(attached, "the shirts name the side the string does not");
  assert.equal(attached.find((l) => l.clubCode === "VAS")?.subs?.length, 1);
});

test("a prefix that fits BOTH sides is not a resolution", () => {
  // The widening must not become the guess the exact match never was. With one
  // club's name a prefix of the other's, the súmula string genuinely does not
  // say which side changed — and these two sheets wear the same numbers, so the
  // structure cannot break the tie either. Picking the first match would be a
  // coin flip recorded as a fact.
  const lineups = lineupsFromAtletas(side("1"), side("2"), SIDES);
  assert.equal(
    attachSubstitutions(
      lineups,
      [sub({ team: "Atlético Mineiro Saf/MG", onShirt: "20", offShirt: "1" })],
      [
        { code: "PAL" as const, cbfName: "Atlético" },
        { code: "VAS" as const, cbfName: "Atlético Mineiro" },
      ],
      { PAL: 1, VAS: 0 },
    ),
    null,
  );
});

test("shirts shared by both sides are ambiguous, so the fixture still refuses", () => {
  // The fallback must not become a guess. Both fixtures here wear 20 and 1, and
  // the team string matches neither, so nothing can say which side changed.
  const lineups = lineupsFromAtletas(side("1"), side("2"), SIDES);
  assert.equal(
    attachSubstitutions(
      lineups,
      [sub({ team: "Clube Que Não Existe/XX", onShirt: "20", offShirt: "1" })],
      TEAMS,
      { PAL: 1, VAS: 0 },
    ),
    null,
  );
});


// ---------------------------------------------------------------------------
// subShirtLabels — the number appears only where the name stops identifying
// ---------------------------------------------------------------------------

/** A sheet with two Gilbertos, exactly as Athletico-PR's r19/554928 is. */
const namesakes = (subs: Lineup["subs"]): Lineup => ({
  clubCode: "PAL",
  players: [
    { name: "Gilberto", shirt: "12", starter: true },
    { name: "Titular", shirt: "5", starter: true },
    { name: "Gilberto", shirt: "2" },
    { name: "Reserva", shirt: "23" },
  ],
  subs,
});

test("no number is printed where every name on the sheet identifies somebody", () => {
  const lineup: Lineup = {
    clubCode: "PAL",
    players: [
      { name: "Titular", shirt: "5", starter: true },
      { name: "Reserva", shirt: "23" },
    ],
    subs: [{ on: "Reserva", off: "Titular", minute: "70'" }],
  };
  // 2317 of the season's 2328 rows are this case, and a number on each would
  // cost the minute column its room for `Intervalo` to say nothing.
  assert.deepEqual(subShirtLabels(lineup), [{ on: null, off: null }]);
});

test("two namesakes swapping resolve to their two shirts rather than to one name twice", () => {
  // The row this exists for: the page printed `Gilberto por Gilberto`, which
  // reads as a bug where the truth — 12 off, 2 on — does not.
  const labels = subShirtLabels(namesakes([{ on: "Gilberto", off: "Gilberto", minute: "82'" }]));
  assert.deepEqual(labels, [{ on: "2", off: "12" }]);
});

test("only the shared name takes a number, not the whole row", () => {
  const labels = subShirtLabels(namesakes([{ on: "Gilberto", off: "Titular", minute: "60'" }]));
  assert.deepEqual(labels, [{ on: "2", off: null }]);
});

test("two namesakes both on the bench are left unnumbered rather than guessed at", () => {
  // Mirassol's r19/554927 and r20/554939, the two rows the narrowing cannot
  // answer. No law of the game separates them, and a specific wrong number is
  // worse than a missing one — this must stay `null` rather than pick the first.
  const lineup: Lineup = {
    clubCode: "PAL",
    players: [
      { name: "Titular", shirt: "5", starter: true },
      { name: "Carlos Eduardo", shirt: "90" },
      { name: "Carlos Eduardo", shirt: "96" },
    ],
    subs: [{ on: "Carlos Eduardo", off: "Titular", minute: "71'" }],
  };
  assert.deepEqual(subShirtLabels(lineup), [{ on: null, off: null }]);
});

test("a stored shirt answers the case the narrowing cannot", () => {
  // Which is the whole reason `attachSubstitutions` carries it: after a resync
  // these rows stop depending on what the sheet can be made to admit.
  const lineup: Lineup = {
    clubCode: "PAL",
    players: [
      { name: "Titular", shirt: "5", starter: true },
      { name: "Carlos Eduardo", shirt: "90" },
      { name: "Carlos Eduardo", shirt: "96" },
    ],
    subs: [
      { on: "Carlos Eduardo", off: "Titular", onShirt: "96", offShirt: "5", minute: "71'" },
    ],
  };
  assert.deepEqual(subShirtLabels(lineup), [{ on: "96", off: null }]);
});

test("a substitute substituted again is resolved, because this tracks the pitch and not `starter`", () => {
  // The asymmetry `sideForRow` records: `off` is a starter only for a side's
  // FIRST change. Testing `starter` here would leave the second row unnumbered.
  const labels = subShirtLabels(
    namesakes([
      { on: "Gilberto", off: "Titular", minute: "40'" },
      { on: "Reserva", off: "Gilberto", minute: "80'" },
    ]),
  );
  // The 12 is still on the pitch at 80', so `off` is ambiguous between 12 and
  // the 2 that came on at 40' — and both really are playing, so neither the
  // law nor this function can separate them.
  assert.deepEqual(labels[0], { on: "2", off: null });
  // A rule written as `!p.starter` would answer "12" here, confidently and
  // without grounds, which is what makes this the case that pins the pitch.
  assert.deepEqual(labels[1], { on: null, off: null });
});

test("a lineup with no substitutions yields no labels rather than throwing", () => {
  assert.deepEqual(subShirtLabels(namesakes(undefined)), []);
});
