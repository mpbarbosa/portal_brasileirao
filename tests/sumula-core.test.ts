import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SUMULA_TIPO_LEGEND,
  parseSumulaGoals,
  parseSumulaScores,
  sumulaGoalsReconcile,
  sumulaMinuteLabel,
} from "@/sumula-core";

/**
 * A real súmula, as `pdftotext -layout` renders it.
 *
 * `conteudo.cbf.com.br/sumulas/2026/14252se.pdf` — Botafogo 0x3 Flamengo,
 * rodada 6, 14/03/2026. Trimmed to the Gols table plus enough of the Cartões
 * Amarelos table beneath it to prove the parse stops where it should, and
 * otherwise verbatim: the ragged column alignment below is CBF's, not a
 * transcription artefact.
 *
 * Captured rather than invented, for the reason `goals-core.ts`'s fixture is:
 * this is a live path no end-to-end run can exercise, since the app never talks
 * to CBF at any time by design.
 */
const CAPTURED = [
  "                                                                                                       Gols",
  "                 Tempo               1T/2T     Nº       Tipo   Nome do Jogador                                                                                      Equipe",
  "",
  "                 12:00                1T       16       NR     Samuel Dias Lino                                                                                     Flamengo/RJ",
  "                     +1               1T        4        FT    Leonardo Pereira                                                                                     Flamengo/RJ",
  "                 03:00                2T        9       NR     Pedro Guilherme Abreu dos Santos                                                                     Flamengo/RJ",
  "           NR = Normal | PN = Pênalti | CT = Contra | FT = Falta",
  "",
  "",
  "                                                                                             Cartões Amarelos",
  "             Tempo         1T/2T       Nº    Nome do Jogador                                                                                               Equipe",
  "",
  "              44:00          1T        20    Alexander Nahuel Barboza Ullua                                                                                Botafogo/RJ",
  "             +03:00          1T        25    Allan Marques Loureiro                                                                                        Botafogo/RJ",
].join("\n");

test("the captured súmula yields the three goals it reports", () => {
  const goals = parseSumulaGoals(CAPTURED);

  assert.deepEqual(goals, [
    { period: "1T", minute: 12, tipo: "NR", shirt: "16", scorer: "Samuel Dias Lino", team: "Flamengo/RJ" },
    { period: "1T", added: 1, tipo: "FT", shirt: "4", scorer: "Leonardo Pereira", team: "Flamengo/RJ" },
    {
      period: "2T",
      minute: 3,
      tipo: "NR",
      shirt: "9",
      scorer: "Pedro Guilherme Abreu dos Santos",
      team: "Flamengo/RJ",
    },
  ]);
});

/**
 * The stop condition, which is the whole reason the legend line is load-bearing
 * rather than decoration.
 *
 * A Cartões Amarelos row has the same `Tempo`, the same `1T/2T`, the same `Nº`,
 * the same name and the same club as a goal — it differs only in having no
 * `Tipo`. Read past the legend and the three goals above become five "goals",
 * with two of them yellow cards, and the scoreline stops adding up in a way
 * that would be blamed on the API rather than on this parser.
 */
test("the cards table beneath is not read as goals", () => {
  const goals = parseSumulaGoals(CAPTURED);
  assert.equal(goals.length, 3);
  assert.ok(!goals.some((goal) => goal.scorer.includes("Barboza")));
});

/**
 * The reckoning, and the evidence for it.
 *
 * Elapsed-within-the-half and minutes-remaining are equally plausible readings
 * of the same column, and a wrong one is invisible — every value stays in
 * range. The document settles it against itself: a red card at `+8:00` in the
 * 1T, and the referee's prose in the same súmula reading "aos 53 minutos no
 * primeiro tempo". 45 + 8 = 53.
 */
test("a minute reads the way CBF's own referee wrote it", () => {
  assert.equal(sumulaMinuteLabel({ period: "1T", added: 8, tipo: "NR", scorer: "x", team: "y" }), "45+8'");
});

test("a first-half minute is the printed minute", () => {
  assert.equal(sumulaMinuteLabel({ period: "1T", minute: 12, tipo: "NR", scorer: "x", team: "y" }), "12'");
});

test("a second-half minute counts on from 45, never restarting", () => {
  // The trap this exists for: CBF restarts the clock at 00:00 for the 2T, so a
  // goal at `03:00 2T` is the 48th minute and printing "3'" would put a
  // second-half goal in the opening moments of the match.
  assert.equal(sumulaMinuteLabel({ period: "2T", minute: 3, tipo: "NR", scorer: "x", team: "y" }), "48'");
});

test("second-half stoppage counts on from 90", () => {
  assert.equal(sumulaMinuteLabel({ period: "2T", added: 3, tipo: "NR", scorer: "x", team: "y" }), "90+3'");
});

test("both spellings of stoppage time are accepted", () => {
  // CBF printed `+1` in the Gols table and `+03:00` in the Cartões table of the
  // same document. Both are minutes; only the formatting differs.
  const rows = [
    "  Tempo   1T/2T   Nº   Tipo   Nome do Jogador                    Equipe",
    "     +1     1T     4     FT   Um Jogador                         Flamengo/RJ",
    " +03:00     2T     9     NR   Outro Jogador                      Botafogo/RJ",
  ].join("\n");

  assert.deepEqual(
    parseSumulaGoals(rows).map(sumulaMinuteLabel),
    ["45+1'", "90+3'"],
  );
});

test("a document with no Gols table yields nothing rather than throwing", () => {
  assert.deepEqual(parseSumulaGoals("Nada houve de anormal."), []);
});

test("the legend is recorded as CBF prints it", () => {
  // Documentation of the source, not a lookup — `goals-core.ts` owns what a
  // code *means*, and two tables mapping one vocabulary is how they drift.
  assert.match(SUMULA_TIPO_LEGEND, /CT = Contra/);
});

// ---------------------------------------------------------------------------
// The document checking itself
// ---------------------------------------------------------------------------

/** The Cronologia block of the same súmula, verbatim. */
const CRONOLOGIA = [
  "                Término do 1º Tempo: 21:25                           Acréscimo: 10 min",
  "                                      Resultado do 1º Tempo: 0 X 2                                    Resultado Final: 0 X 3",
].join("\n");

test("the scorelines are read out of the Cronologia prose", () => {
  assert.deepEqual(parseSumulaScores(CRONOLOGIA), { halfTime: [0, 2], final: [0, 3] });
});

test("the parsed goals agree with the scorelines the same document states", () => {
  // Two in the first half, three in all — and the parse independently found
  // two 1T rows and three goals. This is the check that makes the source
  // trustworthy rather than merely parseable.
  const goals = parseSumulaGoals(CAPTURED);
  assert.equal(sumulaGoalsReconcile(goals, parseSumulaScores(CRONOLOGIA)!), true);
});

test("a misread period fails against the half-time score alone", () => {
  // The failure the final score cannot see: read every goal as second-half and
  // the total still matches 0 X 3, while every minute printed is wrong. Only
  // the half-time line catches it.
  const allSecondHalf = parseSumulaGoals(CAPTURED).map((goal) => ({ ...goal, period: "2T" as const }));
  assert.equal(sumulaGoalsReconcile(allSecondHalf, parseSumulaScores(CRONOLOGIA)!), false);
});

test("a swallowed card fails the reconcile", () => {
  const withCard = [
    ...parseSumulaGoals(CAPTURED),
    { period: "1T" as const, minute: 44, tipo: "NR", scorer: "Barboza", team: "Botafogo/RJ" },
  ];
  assert.equal(sumulaGoalsReconcile(withCard, parseSumulaScores(CRONOLOGIA)!), false);
});

test("a document with no Cronologia reports null rather than a zero score", () => {
  // Absent is not 0 x 0 — the same rule pointsPercentage follows.
  assert.equal(parseSumulaScores("Nada houve de anormal."), null);
});
