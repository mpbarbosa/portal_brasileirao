import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SUMULA_TIPO_LEGEND,
  parseSumulaGoals,
  parseSumulaScores,
  sumulaGoalsReconcile,
  sumulaMinuteLabel,
  sumulaMinutes,
  sumulaUrlFrom,
  parseSumulaSubstitutions,
  sumulaSubstitutionLabel,
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

// ---------------------------------------------------------------------------
// Finding the document
// ---------------------------------------------------------------------------

/**
 * A match payload's `documentos`, captured verbatim from `id_jogo` 832123.
 *
 * Note the stem, `142234`, has nothing to do with that id — the resemblance to
 * `num_jogo` is the trap `sumula-core.ts`'s header records. This array is why
 * the address never has to be derived.
 */
const DOCUMENTOS = [
  { url: "https://conteudo.cbf.com.br/sumulas/2026/142234se.pdf", title: "Súmula" },
  { url: "https://conteudo.cbf.com.br/sumulas/2026/142234b.pdf", title: "Boletim Financeiro" },
  { url: "https://conteudo.cbf.com.br/sumulas/2026/142234rdj.pdf", title: "Relatório de Jogo" },
];

test("the súmula is picked out of the three documents", () => {
  assert.equal(sumulaUrlFrom(DOCUMENTOS), "https://conteudo.cbf.com.br/sumulas/2026/142234se.pdf");
});

test("the suffix decides it, not the title", () => {
  // The title is a display string and the one of the three carrying an accent,
  // so it is the field with an obvious way to drift. Rename it and the suffix
  // still finds the document.
  const renamed = DOCUMENTOS.map((documento) =>
    documento.title === "Súmula" ? { ...documento, title: "Sumula da Partida" } : documento,
  );
  assert.equal(sumulaUrlFrom(renamed), "https://conteudo.cbf.com.br/sumulas/2026/142234se.pdf");
});

test("the title still answers when the suffix convention does not hold", () => {
  // The suffix is a convention observed on a sample, not a guarantee. Asking
  // the sturdier key first costs nothing and leaves the weaker one as a second
  // chance rather than as the only one.
  assert.equal(
    sumulaUrlFrom([{ url: "https://conteudo.cbf.com.br/sumulas/2026/142234.pdf", title: "Súmula" }]),
    "https://conteudo.cbf.com.br/sumulas/2026/142234.pdf",
  );
});

test("the boletim is never mistaken for the súmula", () => {
  // `…b.pdf` and `…rdj.pdf` share the stem, so a looser match on the stem alone
  // would take whichever came first in the array.
  const withoutSumula = DOCUMENTOS.filter((documento) => !documento.url.endsWith("se.pdf"));
  assert.equal(sumulaUrlFrom(withoutSumula), null);
});

test("a match with no documents yields null rather than a derived address", () => {
  // CBF publishes súmulas after the fact, so a fixture played an hour ago
  // legitimately has none. Absent, not an error — the caller records the match
  // without a minute rather than refusing it.
  assert.equal(sumulaUrlFrom([]), null);
  assert.equal(sumulaUrlFrom(undefined), null);
});

test("an entry with no url is skipped rather than returned empty", () => {
  assert.equal(sumulaUrlFrom([{ title: "Súmula" }, ...DOCUMENTOS]), "https://conteudo.cbf.com.br/sumulas/2026/142234se.pdf");
});

// ---------------------------------------------------------------------------
// Joining the súmula to the match API
// ---------------------------------------------------------------------------

test("three goals in the API get the súmula's three minutes, in order", () => {
  const goals = parseSumulaGoals(CAPTURED);
  const scores = parseSumulaScores(CRONOLOGIA);
  assert.deepEqual(sumulaMinutes(3, goals, scores), ["12'", "45+1'", "48'"]);
});

test("a disagreement about how many goals there were attaches nothing", () => {
  // The API says four, the súmula lists three. Something is wrong about which
  // match one of them is describing, and the index join would then put the
  // 48th minute on somebody else's goal — right-looking and wrong.
  const goals = parseSumulaGoals(CAPTURED);
  assert.equal(sumulaMinutes(4, goals, parseSumulaScores(CRONOLOGIA)), null);
});

test("a súmula that does not reconcile with itself attaches nothing", () => {
  // A parse that swallowed a card has the right shape and the wrong contents.
  // The count check alone would pass it, because the API count is whatever the
  // API says — only the document's own scorelines can catch this.
  const withCard = [
    ...parseSumulaGoals(CAPTURED),
    { period: "1T" as const, minute: 44, tipo: "NR", scorer: "Barboza", team: "Botafogo/RJ" },
  ];
  assert.equal(sumulaMinutes(4, withCard, parseSumulaScores(CRONOLOGIA)), null);
});

test("no súmula at all attaches nothing rather than throwing", () => {
  // CBF publishes súmulas after the fact, so this is the ordinary state for a
  // match played an hour ago — not an error.
  assert.equal(sumulaMinutes(3, [], null), null);
});


// ---------------------------------------------------------------------------
// Substituições
// ---------------------------------------------------------------------------

/**
 * Transcribed from `pdftotext -layout` on 2026's rodada 24 súmula
 * (Palmeiras 4x1 Vasco, `142234se.pdf`) rather than composed, because the whole
 * parse is a column layout and a hand-made fixture would agree with whatever
 * the regex happened to be. Note the truncated names: that is CBF's own
 * output, and it is why the shirt is the join and the name is dropped.
 */
const SUBS_TABLE = [
  "                                                     Substituições",
  "        Tempo          1T/2T                  Equipe                         Entrou                                   Saiu",
  "",
  "            -           INT    Palmeiras/SP                  26 - Murilo Cerqueira Paim               2 - Alexander Nahuel Barboza Ullua",
  "        12:00            2T    Vasco da Gama Saf/RJ          82 - Riquelme Avellar da Silva Fo...     66 - Luis Eduardo Soares da Silva",
  "        25:00            2T    Palmeiras/SP                  32 - Emiliano Martinez Toranza           17 - Marlon Rodrigues Freitas",
  "        +2:00            2T    Palmeiras/SP                  12 - Khellven Douglas Silva Olive...     4 - Agustin Giay",
  "",
  "",
  "                                                     Cartões Amarelos",
  "        30:00            1T    Palmeiras/SP                  5 - Somebody Else",
].join("\n");

test("the Substituições table parses, including the interval row", () => {
  const subs = parseSumulaSubstitutions(SUBS_TABLE);
  assert.equal(subs.length, 4);

  // `Tempo` is a literal `-` at the interval, and there is no minute to record.
  assert.equal(subs[0].period, "INT");
  assert.equal(subs[0].minute, undefined);
  assert.equal(subs[0].onShirt, "26");
  assert.equal(subs[0].offShirt, "2");
  assert.equal(subs[0].team, "Palmeiras/SP");

  // A truncated name must not break the row — the shirt in front of it is whole.
  assert.equal(subs[1].onShirt, "82");
  assert.equal(subs[1].offShirt, "66");

  assert.equal(subs[3].added, 2);
});

test("the parse stops before the Cartões table below it", () => {
  // Those rows carry the same Tempo, the same 1T/2T and the same Equipe; only
  // the absent Entrou/Saiu pair separates them, which is why the header search
  // keys on `Entrou` rather than on `Tempo`.
  const subs = parseSumulaSubstitutions(SUBS_TABLE);
  assert.ok(subs.every((s) => s.onShirt !== "5"));
});

test("an interval substitution is a word, never a minute", () => {
  // Sharing `sumulaMinuteLabel` would have rendered this as 45', because its
  // reckoning reads anything that is not 1T as the second half.
  assert.equal(sumulaSubstitutionLabel({ period: "INT", team: "x", onShirt: "1", offShirt: "2" }), "Intervalo");
  assert.equal(
    sumulaSubstitutionLabel({ period: "1T", minute: 30, team: "x", onShirt: "1", offShirt: "2" }),
    "30'",
  );
  assert.equal(
    sumulaSubstitutionLabel({ period: "2T", minute: 25, team: "x", onShirt: "1", offShirt: "2" }),
    "70'",
  );
  assert.equal(
    sumulaSubstitutionLabel({ period: "2T", added: 3, team: "x", onShirt: "1", offShirt: "2" }),
    "90+3'",
  );
});
