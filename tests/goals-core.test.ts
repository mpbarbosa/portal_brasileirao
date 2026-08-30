import assert from "node:assert/strict";
import { test } from "node:test";

import {
  goalKindLabel,
  goalKindOf,
  goalLabel,
  goalsBySide,
  goalsFromRegistros,
  goalsReconcile,
  isKnownGoalResult,
  tidyScorerName,
  withGoals,
} from "@/goals-core";
import type { CbfRegistro, SideMap } from "@/goals-core";
import type { Goal, Match } from "@/src/types";

const SIDES: SideMap = {
  homeCbfId: "20002",
  awayCbfId: "60646",
  homeCode: "1769",
  awayCode: "1780",
};

const registro = (overrides: Partial<CbfRegistro> = {}): CbfRegistro => ({
  tipo: "GOL",
  resultado: "NR",
  clube_id: "20002",
  atleta_nome: "Jose Manuel Alberto Lopez",
  atleta_apelido: "Lopez",
  atleta_camisa: "42",
  ...overrides,
});

const match = (overrides: Partial<Match> = {}): Match => ({
  id: "554977",
  round: 24,
  kickoff: "2026-08-23T19:00:00Z",
  status: "FINISHED",
  homeCode: "1769",
  awayCode: "1780",
  homeGoals: 4,
  awayGoals: 1,
  ...overrides,
});

// ---------------------------------------------------------------------------
// The resultado vocabulary
// ---------------------------------------------------------------------------

test("an ordinary goal is known and carries no qualifier", () => {
  assert.equal(isKnownGoalResult("NR"), true);
  assert.equal(goalKindOf("NR"), undefined);
});

test("a penalty is known and qualified", () => {
  assert.equal(isKnownGoalResult("PN"), true);
  assert.equal(goalKindOf("PN"), "penalty");
});

/**
 * The distinction this whole design rests on. Both an ordinary goal and an
 * unrecognised code produce `undefined` from `goalKindOf`, so anything reading
 * only that function cannot tell them apart — and they need opposite handling,
 * because an unknown code might mean the goal counts for the other club.
 */
test("an unknown resultado is distinguishable from an ordinary goal", () => {
  assert.equal(goalKindOf("CT"), undefined, "the qualifier is unknown either way");
  assert.equal(isKnownGoalResult("CT"), false, "but the code is not one we have seen");
  assert.equal(isKnownGoalResult("NR"), true);
});

test("resultado matching tolerates case and padding", () => {
  assert.equal(goalKindOf(" pn "), "penalty");
  assert.equal(isKnownGoalResult(" nr "), true);
});

test("a missing resultado is not silently an ordinary goal", () => {
  assert.equal(isKnownGoalResult(undefined), false);
  assert.equal(isKnownGoalResult(""), false);
});

// ---------------------------------------------------------------------------
// Scorer names
// ---------------------------------------------------------------------------

test("an all-caps name is folded to title case", () => {
  assert.equal(tidyScorerName("FACUNDO"), "Facundo");
  assert.equal(tidyScorerName("FACUNDO COLIDIO"), "Facundo Colidio");
});

test("a mixed-case name is left exactly as CBF spells it", () => {
  assert.equal(tidyScorerName("Vitor Roque"), "Vitor Roque");
  assert.equal(tidyScorerName("Lopez"), "Lopez");
});

/**
 * The line between fixing casing and guessing at a name. CBF drops accents, and
 * restoring one would be inventing a spelling — the rule `venueFromLocal`
 * follows when it keeps `ARENA MRV` rather than prettifying it.
 */
test("missing accents are left alone rather than restored", () => {
  assert.equal(tidyScorerName("Mauricio"), "Mauricio");
});

test("whitespace is collapsed", () => {
  assert.equal(tidyScorerName("  Vitor   Roque  "), "Vitor Roque");
  assert.equal(tidyScorerName("   "), "");
});

// ---------------------------------------------------------------------------
// Reading a CBF payload
// ---------------------------------------------------------------------------

test("goals are read from registros and attributed to our club codes", () => {
  const goals = goalsFromRegistros(
    [registro(), registro({ clube_id: "60646", atleta_apelido: "FACUNDO", atleta_camisa: "9" })],
    SIDES,
  );

  assert.deepEqual(goals, [
    { clubCode: "1769", scorer: "Lopez" },
    { clubCode: "1780", scorer: "Facundo" },
  ]);
});

test("cards in the same list are not goals", () => {
  const goals = goalsFromRegistros(
    [registro(), registro({ tipo: "PENALIDADE", resultado: "AMARELO" })],
    SIDES,
  );
  assert.equal(goals.length, 1);
});

test("a penalty carries its qualifier", () => {
  const [goal] = goalsFromRegistros([registro({ resultado: "PN" })], SIDES);
  assert.equal(goal.kind, "penalty");
});

/** The `computeStandings` rule: an unknown club is dropped, never guessed at. */
test("a goal naming neither club of the fixture is dropped", () => {
  assert.deepEqual(goalsFromRegistros([registro({ clube_id: "99999" })], SIDES), []);
});

test("a goal with no scorer named is dropped rather than rendered blank", () => {
  assert.deepEqual(
    goalsFromRegistros([registro({ atleta_apelido: "", atleta_nome: "" })], SIDES),
    [],
  );
});

test("the full name stands in when CBF reports no apelido", () => {
  const [goal] = goalsFromRegistros([registro({ atleta_apelido: "" })], SIDES);
  assert.equal(goal.scorer, "Jose Manuel Alberto Lopez");
});

/**
 * The shirt number CBF reports is deliberately not carried onto `Goal` — see
 * `goalsFromRegistros`. Asserted so that adding it back is a decision somebody
 * makes on purpose rather than a field that quietly reappears.
 */
test("the shirt number is not carried onto a goal", () => {
  const [goal] = goalsFromRegistros([registro({ atleta_camisa: "42" })], SIDES);
  assert.deepEqual(Object.keys(goal).sort(), ["clubCode", "scorer"]);
});

test("CBF's listed order is preserved", () => {
  const goals = goalsFromRegistros(
    [
      registro({ atleta_apelido: "Primeiro" }),
      registro({ atleta_apelido: "Segundo" }),
      registro({ atleta_apelido: "Terceiro" }),
    ],
    SIDES,
  );
  assert.deepEqual(goals.map((g) => g.scorer), ["Primeiro", "Segundo", "Terceiro"]);
});

// ---------------------------------------------------------------------------
// The invariant the sync refuses to write without
// ---------------------------------------------------------------------------

test("a goal list agreeing with its scoreline reconciles", () => {
  const goals: Goal[] = [
    { clubCode: "1769", scorer: "A" },
    { clubCode: "1769", scorer: "B" },
    { clubCode: "1780", scorer: "C" },
  ];
  assert.equal(goalsReconcile(goals, "1769", "1780", 2, 1), true);
});

/**
 * The own-goal trap stated as a test. If CBF filed a goal under the club that
 * *scored* it rather than the club it counts for, the sides stop adding up —
 * which is exactly the signal `sync-goals.ts` refuses to write through.
 */
test("a goal on the wrong side fails to reconcile", () => {
  const goals: Goal[] = [
    { clubCode: "1769", scorer: "A" },
    { clubCode: "1769", scorer: "B" },
    { clubCode: "1769", scorer: "C" },
  ];
  assert.equal(goalsReconcile(goals, "1769", "1780", 2, 1), false);
});

test("a short goal list fails to reconcile", () => {
  assert.equal(goalsReconcile([{ clubCode: "1769", scorer: "A" }], "1769", "1780", 2, 1), false);
});

test("a goalless match reconciles with an empty list", () => {
  assert.equal(goalsReconcile([], "1769", "1780", 0, 0), true);
});

// ---------------------------------------------------------------------------
// Merging and presentation
// ---------------------------------------------------------------------------

test("withGoals attaches only where there are goals", () => {
  const [attached, untouched] = withGoals(
    [match(), match({ id: "554979", homeGoals: 0, awayGoals: 0 })],
    { "554977": [{ clubCode: "1769", scorer: "Lopez" }] },
  );

  assert.equal(attached.goals?.length, 1);
  assert.equal(untouched.goals, undefined);
});

test("withGoals leaves an empty list off rather than attaching one", () => {
  const [only] = withGoals([match()], { "554977": [] });
  assert.equal(only.goals, undefined);
});

test("goalsBySide splits by club and keeps an empty side", () => {
  const sides = goalsBySide(
    match({
      goals: [
        { clubCode: "1769", scorer: "Lopez" },
        { clubCode: "1769", scorer: "Mauricio" },
      ],
    }),
  );

  assert.equal(sides.home.length, 2);
  assert.deepEqual(sides.away, []);
});

test("goalsBySide on a match with no goals gives two empty sides", () => {
  assert.deepEqual(goalsBySide(match()), { home: [], away: [] });
});

test("an ordinary goal gets no qualifier printed", () => {
  assert.equal(goalKindLabel(undefined), null);
  assert.equal(goalLabel({ clubCode: "1769", scorer: "Lopez" }), "Lopez");
});

test("a penalty and an own goal read in pt-BR", () => {
  assert.equal(goalKindLabel("penalty"), "pên.");
  assert.equal(goalKindLabel("own"), "contra");
  assert.equal(
    goalLabel({ clubCode: "1769", scorer: "Vitor Roque", kind: "penalty" }),
    "Vitor Roque (pên.)",
  );
});

// ---------------------------------------------------------------------------
// A captured payload
// ---------------------------------------------------------------------------

/**
 * CBF's real `registros` for `id_jogo=832123` — Palmeiras 4x1 Vasco da Gama,
 * rodada 24, which is seed fixture 554977. Trimmed to the fields this module
 * reads, and otherwise verbatim, casing and missing accents included.
 *
 * Captured rather than invented, because this is a live path the end-to-end
 * suite cannot exercise: the suite boots with `DISABLE_FOOTBALL_DATA=true` and
 * the app never calls CBF at all, at any time, by design. A unit test over a
 * captured payload is what `CLAUDE.md` prescribes for exactly this shape.
 */
const CAPTURED: CbfRegistro[] = [
  { tipo: "GOL", resultado: "NR", clube_id: "20002", atleta_nome: "Jose Manuel Alberto Lopez", atleta_apelido: "Lopez", atleta_camisa: "42", tempo_jogo: "2", minutos: "01:00" },
  { tipo: "GOL", resultado: "PN", clube_id: "20002", atleta_nome: "Vitor Hugo Roque Ferreira", atleta_apelido: "Vitor Roque", atleta_camisa: "9", tempo_jogo: "2", minutos: "05:00" },
  { tipo: "GOL", resultado: "NR", clube_id: "20002", atleta_nome: "Mauricio Magalhaes Prado", atleta_apelido: "Mauricio", atleta_camisa: "18", tempo_jogo: "2", minutos: "10:00" },
  { tipo: "GOL", resultado: "NR", clube_id: "20002", atleta_nome: "Jose Manuel Alberto Lopez", atleta_apelido: "Lopez", atleta_camisa: "42", tempo_jogo: "2", minutos: "44:00" },
  { tipo: "GOL", resultado: "NR", clube_id: "60646", atleta_nome: "FACUNDO COLIDIO", atleta_apelido: "FACUNDO", atleta_camisa: "9", tempo_jogo: "2", minutos: "45:00" },
  { tipo: "PENALIDADE", resultado: "AMARELO", clube_id: "60646", atleta_nome: "Carlos Andres Gomez Hinestroza", atleta_apelido: "Hinestroza", atleta_camisa: "11", tempo_jogo: "TN1", minutos: "43:00" },
  { tipo: "PENALIDADE", resultado: "AMARELO", clube_id: "20002", atleta_nome: "Marlon Rodrigues Freitas", atleta_apelido: "Marlon Freitas", atleta_camisa: "17", tempo_jogo: "TN1", minutos: "8:00" },
  { tipo: "PENALIDADE", resultado: "AMARELO", clube_id: "60646", atleta_nome: "Robert Renan Alves Barbosa", atleta_apelido: "Robert Renan", atleta_camisa: "30", tempo_jogo: "TN2", minutos: "37:00" },
  { tipo: "PENALIDADE", resultado: "AMARELO", clube_id: "60646", atleta_nome: "Thiago Henrique Santos Mendes", atleta_apelido: "Thiago Mendes", atleta_camisa: "23", tempo_jogo: "TN2", minutos: "5:00" },
];

test("the captured payload yields the four-one it reports", () => {
  const goals = goalsFromRegistros(CAPTURED, SIDES);

  assert.deepEqual(goals, [
    { clubCode: "1769", scorer: "Lopez" },
    { clubCode: "1769", scorer: "Vitor Roque", kind: "penalty" },
    { clubCode: "1769", scorer: "Mauricio" },
    { clubCode: "1769", scorer: "Lopez" },
    { clubCode: "1780", scorer: "Facundo" },
  ]);
});

test("the captured payload reconciles against its scoreline", () => {
  const goals = goalsFromRegistros(CAPTURED, SIDES);
  assert.equal(goalsReconcile(goals, "1769", "1780", 4, 1), true);
});

/** Four cards sit in the same array as the five goals; only the goals come out. */
test("the captured payload's cards are not counted as goals", () => {
  assert.equal(CAPTURED.filter((r) => r.tipo === "PENALIDADE").length, 4);
  assert.equal(goalsFromRegistros(CAPTURED, SIDES).length, 5);
});

/**
 * Everything this module ships knows about CBF's goal vocabulary, asserted so
 * that widening it is deliberate. `own` exists on `GoalKind` and has **no code
 * mapped to it**: no own goal has been observed in a payload yet, so the code
 * CBF files one under is unmeasured — and guessing it is the one mistake that
 * would put a goal on the wrong side of a scoreboard.
 */
test("the measured vocabulary is NR and PN, and nothing else is assumed", () => {
  assert.deepEqual(
    ["NR", "PN"].map(isKnownGoalResult),
    [true, true],
  );
  for (const guess of ["CT", "GC", "CN", "OG", "AUTO"]) {
    assert.equal(isKnownGoalResult(guess), false, `${guess} must not be assumed`);
  }
});
