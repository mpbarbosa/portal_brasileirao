/**
 * The **súmula**: CBF's own match report, and the only source that says *when*
 * a goal was scored.
 *
 * This module is pure — text in, rows out — like every other `*-core.ts`. The
 * fetching half is a script's problem.
 *
 * **Why a second CBF source at all, when `goals-core.ts` already reads their
 * match endpoint.** That endpoint carries no usable clock: `tempo_jogo` is
 * `"2"` on every goal in a payload whose cards carry `"TN1"`/`"TN2"`, and
 * `minutos` is `mm:ss` with no half attached. So a goal at 45:00 and a goal at
 * 90:00 are indistinguishable there, and printing one as "45'" is
 * `live-core.ts`'s "73'" failure on a bigger surface — a precise-looking number
 * the data does not support. The súmula prints a **1T/2T** column beside the
 * time, which is exactly the missing half.
 *
 * **And it is on a different host, which is the operational half of why this
 * exists.** `conteudo.cbf.com.br` answered throughout the socket-level ban that
 * `www.cbf.com.br` and `cms.cbf.com.br` were serving `000` under on
 * 2026-08-30. Different edge. Before concluding CBF is unreachable, try the
 * other hostnames.
 *
 * **The súmula's id is NOT the match id, and the resemblance is a trap.** For
 * `id_jogo` 832123 the document is `sumulas/2026/142234se.pdf`; the two are
 * unrelated as keys. What 142234 *does* end in is `234`, that match's
 * `num_jogo` — and the other súmula read here, `14252`, belongs to a match whose
 * `num_jogo` is 52. That reads like `142` + `num_jogo` and it must not be built
 * on: two samples are not a rule, `num_jogo` is not zero-padded so the
 * concatenation is ambiguous the moment it collides, and the match payload hands
 * over the answer anyway — **take the URL from `jogo.documentos`**, where it
 * arrives complete and titled "Súmula" beside "Boletim Financeiro" and
 * "Relatório de Jogo". Derive nothing.
 *
 * The input is what `pdftotext -layout` writes, not the PDF. Keeping the parse
 * pure means the layout rules below are unit-testable against a captured
 * document with no network and no binary in the loop — the same split
 * `commons-core.ts` draws against `scripts/commons-api.ts`.
 */

/**
 * The period a row belongs to, in CBF's own vocabulary.
 *
 * `INT` is the interval, and it is **not** dead vocabulary to prune: cards and
 * substitutions really are filed under it, with a `Tempo` of `-`. A goal cannot
 * be, but the parser meets those rows in the neighbouring tables and a type
 * that cannot spell them is a type that throws away the document.
 */
export type SumulaPeriod = "1T" | "2T" | "INT";

/** How long each half runs before stoppage, in CBF's reckoning. */
const HALF_MINUTES = 45;

export interface SumulaGoal {
  period: "1T" | "2T";
  /**
   * The minute **within the half**, as CBF prints it: `12` for `12:00`.
   * Absent where the row is in stoppage time — see `added`.
   */
  minute?: number;
  /** Minutes into stoppage time, where the row reads `+8` or `+8:00`. */
  added?: number;
  /** CBF's `Tipo`, verbatim: `NR`, `PN`, `CT` or `FT`. */
  tipo: string;
  /** The shirt number, as printed. */
  shirt?: string;
  scorer: string;
  /** The `Equipe` column, verbatim — `Flamengo/RJ`. */
  team: string;
}

/**
 * The legend CBF prints at the foot of its own Gols table.
 *
 * Recorded here as **documentation of the source**, not as a lookup: what a
 * code means for this app's data model is `goals-core.ts`'s business, and two
 * tables claiming to map the same vocabulary is how they come to disagree. It
 * is here because the next reader's first question is "where did NR/PN/CT/FT
 * come from", and the answer is that CBF prints it, in the document, in words.
 */
export const SUMULA_TIPO_LEGEND = "NR = Normal | PN = Pênalti | CT = Contra | FT = Falta";

/**
 * One row of the Gols table.
 *
 * `Tempo` is either `mm:ss` or a stoppage marker, and **CBF spells the stoppage
 * marker two ways in one document**: the Gols table printed `+1` where the
 * Cartões table printed `+8:00` and `+03:00`. Both are minutes; only the
 * formatting differs, so both are accepted rather than one being called
 * malformed.
 *
 * The name and the club are separated by a run of spaces rather than by any
 * delimiter, which is what `-layout` gives and why this is a column parse. A
 * single space cannot end the name — "Samuel Dias Lino" has two of them.
 */
const GOAL_ROW =
  /^\s*(?:(\d{1,3}):(\d{2})|\+\s*(\d{1,3})(?::\d{2})?)\s+(1T|2T)\s+(\S+)\s+(NR|PN|CT|FT)\s+(\S.*?)\s{2,}(\S.*?)\s*$/;

/**
 * Read the Gols table out of a `pdftotext -layout` súmula.
 *
 * Bounded at both ends rather than read to the end of the document: it starts
 * at the header row — the one line carrying both `Tempo` and `Tipo` — and stops
 * at the legend, which CBF prints immediately beneath the last goal. Without
 * the stop the Cartões Amarelos table below would be read as goals, and its
 * rows are close enough in shape to parse: same `Tempo`, same `1T/2T`, same
 * `Nº`, same name and club. The `Tipo` column is the only thing that separates
 * them, which is why it is required rather than optional.
 */
export const parseSumulaGoals = (text: string): SumulaGoal[] => {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.includes("Tempo") && line.includes("Tipo"));
  if (start === -1) return [];

  const goals: SumulaGoal[] = [];

  for (const line of lines.slice(start + 1)) {
    if (line.includes("NR = Normal")) break;

    const match = GOAL_ROW.exec(line);
    if (!match) continue;

    const [, mm, , added, period, shirt, tipo, scorer, team] = match;
    goals.push({
      period: period as "1T" | "2T",
      ...(added === undefined ? { minute: Number(mm) } : { added: Number(added) }),
      tipo,
      ...(shirt ? { shirt } : {}),
      scorer: scorer.trim(),
      team: team.trim(),
    });
  }

  return goals;
};

/**
 * The minute a reader recognises: `12'`, `48'`, `45+8'`, `90+3'`.
 *
 * **The reckoning is CBF's own and was read off the document rather than
 * assumed**, which matters because elapsed-within-the-half and
 * minutes-remaining produce equally plausible numbers from the same column. The
 * súmula for Botafogo 0x3 Flamengo (rodada 6) files a red card at `+8:00` in
 * the 1T, and the referee's own prose in the same document says he sent the
 * player off *"aos 53 minutos no primeiro tempo"*. 45 + 8 = 53. So the printed
 * value is the minute itself, counted from the start of the half, and a `+N`
 * row is N minutes past the 45.
 *
 * That one line also rules out the off-by-one that would otherwise be a coin
 * flip: were `+8:00` read as "eight minutes elapsed *into* the 46th", the
 * referee would have written 54.
 */
export const sumulaMinuteLabel = (goal: SumulaGoal): string => {
  const base = goal.period === "1T" ? 0 : HALF_MINUTES;

  if (goal.added !== undefined) return `${base + HALF_MINUTES}+${goal.added}'`;
  return `${base + (goal.minute ?? 0)}'`;
};

/** The two scorelines the Cronologia block states, home first. */
export interface SumulaScores {
  halfTime: [number, number];
  final: [number, number];
}

const SCORE = (label: string) =>
  new RegExp(`${label}\\s*:?\\s*(\\d+)\\s*[Xx]\\s*(\\d+)`);

/**
 * The two scorelines CBF states in prose, in its own Cronologia block.
 *
 * These are what make this document **self-checking**, which is the whole
 * reason to read them: the Gols table and these two lines are written by the
 * same referee about the same match, so a parse that drops a row or swallows a
 * card disagrees with them immediately. Without it, a silently short goal list
 * is indistinguishable from a low-scoring game.
 *
 * Both are needed rather than just the final score, and the half-time one is
 * the more valuable: it is the only thing in the document that can check the
 * **1T/2T column itself**. A parser that read every period as `2T` would still
 * total correctly against the final score and be wrong about every minute.
 */
export const parseSumulaScores = (text: string): SumulaScores | null => {
  const half = SCORE("Resultado do 1º Tempo").exec(text);
  const final = SCORE("Resultado Final").exec(text);
  if (!half || !final) return null;

  return {
    halfTime: [Number(half[1]), Number(half[2])],
    final: [Number(final[1]), Number(final[2])],
  };
};

/**
 * Whether a parsed goal list agrees with the scorelines the same document
 * states — `goalsReconcile`'s discipline applied to this source.
 *
 * Totals rather than per-club, deliberately. The `Equipe` column carries CBF's
 * own club spelling (`Flamengo/RJ`) and mapping that to a club code is a
 * different job with its own failure modes; counting is enough to catch a
 * dropped row, a swallowed card and — via the half-time score — a misread
 * period, which are the three ways this parse can go wrong.
 */
export const sumulaGoalsReconcile = (goals: SumulaGoal[], scores: SumulaScores): boolean => {
  const firstHalf = goals.filter((goal) => goal.period === "1T").length;
  const [homeHalf, awayHalf] = scores.halfTime;
  const [homeFinal, awayFinal] = scores.final;

  return firstHalf === homeHalf + awayHalf && goals.length === homeFinal + awayFinal;
};

/**
 * One entry of a match payload's `documentos` array, as CBF sends it.
 *
 * **Exactly two fields, and neither is a type code** — measured on a captured
 * payload rather than hoped for. The three documents share a stem and differ by
 * suffix: `…se.pdf` (Súmula), `…b.pdf` (Boletim Financeiro), `…rdj.pdf`
 * (Relatório de Jogo).
 */
export interface SumulaDocumento {
  url?: string;
  title?: string;
}

/** What CBF appends to the shared stem for the súmula, before `.pdf`. */
const SUMULA_SUFFIX = "se";

/**
 * Pick the súmula's URL out of a match payload's `documentos`.
 *
 * **The suffix is the key and the title is the fallback, and that is the wrong
 * way round from how it first reads.** A `title` is a display string: it is
 * ASCII-fragile, it is the field somebody renames, and here it is the one of
 * the three carrying an accent — `"Súmula"`. Matching on it means matching on
 * a byte sequence that has an obvious way to drift and no reason not to. The
 * suffix is structural: it is what actually distinguishes the three documents
 * on one stem, it is ASCII, and it cannot gain a diacritic.
 *
 * The title still earns its place as a second pass rather than being dropped,
 * because a suffix is a convention observed on a sample of matches and a run
 * that silently found no súmula would look exactly like a match that has none.
 * Two independent ways to be right beats one, provided the sturdier is asked
 * first.
 *
 * Returns `null` rather than a guess where neither matches. **A missing súmula
 * is an absence, not an error**: CBF publishes them after the fact, so a fixture
 * played an hour ago legitimately has none, and the caller records the match
 * without a minute rather than refusing it — the rule `Club.coach` follows for
 * a club between managers.
 *
 * **And never derive this address.** For `id_jogo` 832123 the súmula is
 * `142234se.pdf`; the ids are unrelated, and the resemblance to `num_jogo` is
 * the trap the module header sets out. `documentos` hands it over complete.
 */
export const sumulaUrlFrom = (documentos: SumulaDocumento[] | undefined): string | null => {
  const entries = (documentos ?? []).filter(
    (documento): documento is SumulaDocumento & { url: string } =>
      typeof documento.url === "string" && documento.url.length > 0,
  );

  const bySuffix = entries.find((documento) =>
    documento.url.toLowerCase().endsWith(`${SUMULA_SUFFIX}.pdf`),
  );
  if (bySuffix) return bySuffix.url;

  const byTitle = entries.find((documento) => (documento.title ?? "").trim().toLowerCase() === "súmula");
  return byTitle ? byTitle.url : null;
};
