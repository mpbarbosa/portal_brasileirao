/**
 * Pure helpers for a match's goals and who scored them. No I/O
 * (tests/goals-core.test.ts).
 *
 * **Why this module exists at all.** No football-data tier this app can reach
 * carries goal events — verified against a live BSA match *and* a live Premier
 * League one, both free TIER_ONE, both answering 200 with no `goals` key. The
 * events come instead from CBF's own match endpoint,
 * `/api/cbf/jogos/{id_jogo}`, read on a workstation by `scripts/sync-goals.ts`
 * and written into `src/data/goals.ts`. Production never calls CBF, exactly as
 * it never calls it for broadcasts or venues.
 *
 * The judgement lives here rather than in the script so it can be tested
 * without a network, which is the split `commons-core.ts` draws against
 * `scripts/commons-api.ts`.
 */
import type { ClubCode, Goal, GoalKind, Match } from "@/src/types";

/**
 * One row of CBF's `registros` array, which carries **goals and cards in the
 * same list** — `tipo` is what separates them.
 *
 * Every field is optional because this is an undocumented internal endpoint
 * with no schema and no stability guarantee; a payload that drops a field
 * should skip a goal, not throw on a page.
 */
export interface CbfRegistro {
  tipo?: string;
  resultado?: string;
  clube_id?: string;
  atleta_nome?: string;
  atleta_apelido?: string;
  atleta_camisa?: string;
  atleta_id?: string;
  tempo_jogo?: string;
  minutos?: string;
}

/** The `tipo` that marks a goal. Cards arrive as `PENALIDADE` in the same list. */
export const GOAL_TIPO = "GOL";

/**
 * CBF's `resultado` vocabulary for a goal.
 *
 * **Read off CBF's own súmula, not inferred.** Every match report prints the
 * legend at the foot of its Gols table, and it is the whole vocabulary:
 *
 *     NR = Normal | PN = Pênalti | CT = Contra | FT = Falta
 *
 * (`https://conteudo.cbf.com.br/sumulas/2026/14252se.pdf`, Botafogo 0x3
 * Flamengo — a host that answers even while `www` is refusing connections.)
 *
 * `NR` maps to no qualifier: annotating it would put a word beside nearly every
 * scorer to distinguish nothing.
 *
 * **An unrecognised code is an error, not a shrug, and that is the opposite of
 * what `refereeRoleLabel` does one module away.** There, an unmapped role
 * renders verbatim, because the cost of being wrong is an English word on the
 * page. Here the cost is different in kind, and `CT` is the proof rather than
 * the hypothesis: an own goal counts for the club that did *not* score it, so
 * passing an unknown code through as ordinary puts a goal on the wrong side of
 * the scoreboard and looks entirely plausible doing it.
 *
 * That is not a thought experiment. This table shipped holding only `NR` and
 * `PN`, and the first season-wide sync refused **25 matches** — 16 `CT` and 9
 * `FT` — rather than filing them wrong. Had the unknown ones defaulted to
 * ordinary, all 16 own goals would have been credited to the wrong club.
 *
 * **What this mapping does NOT cover, and `goalsReconcile` cannot see.** The
 * check catches an own goal filed under the club that *scored* it, because the
 * sums stop adding up. It is blind to the opposite convention: an own goal
 * filed under the club it **counts for** and marked `NR`. The sums balance
 * perfectly, nothing is refused, and the file records an opposing player as
 * that club's scorer with no `kind` on them — plausible on the page and wrong.
 *
 * Across the played season all **16** `CT` matches reconciled once the flip
 * below was applied, so CBF was consistent everywhere it could be checked. That
 * is evidence of consistency, **not proof that the other convention never
 * occurs**, and the difference matters because nothing in the API could tell
 * you. The one source that could is the **súmula**, whose Gols table prints a
 * `Tipo` and an `Equipe` per goal; the API's `registros` carries the type but
 * not which side it counted for.
 */
const GOAL_KINDS = new Map<string, GoalKind | undefined>([
  /** Normal. */
  ["NR", undefined],
  /** Pênalti. */
  ["PN", "penalty"],
  /** Contra — an own goal. Counts for the OTHER club; see `goalsFromRegistros`. */
  ["CT", "own"],
  /** Falta — scored directly from a free kick. Counts normally. */
  ["FT", "freekick"],
]);

const normaliseResult = (resultado: string | undefined): string =>
  (resultado ?? "").trim().toUpperCase();

/**
 * Whether a `resultado` is one this module has actually seen and understands.
 *
 * A `Map` rather than an object literal precisely so this question is
 * answerable: "an ordinary goal" is a key present with no qualifier, and both
 * an object lookup and an optional-chained read collapse it with "a code we
 * have never seen". Those two need opposite handling.
 */
export const isKnownGoalResult = (resultado: string | undefined): boolean =>
  GOAL_KINDS.has(normaliseResult(resultado));

/**
 * The qualifier for a goal's `resultado`, or `undefined` for an ordinary one.
 *
 * Callers must check `isKnownGoalResult` first — see above for why this cannot
 * answer that question itself.
 */
export const goalKindOf = (resultado: string | undefined): GoalKind | undefined =>
  GOAL_KINDS.get(normaliseResult(resultado));

/**
 * CBF's casing drifts within a single payload — one match listed `Lopez`,
 * `Vitor Roque`, `Mauricio` and `FACUNDO` side by side. A name that is entirely
 * uppercase is folded to title case; anything else is left exactly as it
 * arrived.
 *
 * This is a **casing** fix, not a spelling one, and the line matters. CBF also
 * drops accents (`Mauricio` for Maurício), and those are left alone: restoring
 * one means guessing at a person's name, which is the rule `venueFromLocal`
 * follows when it keeps `ARENA MRV` verbatim rather than inventing a prettier
 * form.
 */
export const tidyScorerName = (name: string): string => {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  // Only fold when there is a lowercase letter nowhere to be found: a name that
  // is already mixed case is CBF telling us how it is spelled.
  if (trimmed !== trimmed.toUpperCase()) return trimmed;

  return trimmed
    .split(" ")
    .map((word) =>
      word.length === 0
        ? word
        : word[0].toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(" ");
};

/** How CBF's two club ids map onto our two club codes for one fixture. */
export interface SideMap {
  homeCbfId: string;
  awayCbfId: string;
  homeCode: ClubCode;
  awayCode: ClubCode;
}

/**
 * The goals in a CBF match payload, in the order CBF lists them.
 *
 * Ordering is **not** imposed here. CBF lists goals before cards and the goals
 * themselves in the order they were scored, and `minutos` is deliberately not
 * used to re-sort them — see `sync-goals.ts` for why that field is not safe to
 * read as a match minute.
 *
 * A registro naming a club that is not one of this fixture's two is dropped
 * rather than guessed at, the way `computeStandings` drops a fixture naming an
 * unknown club.
 */
export const goalsFromRegistros = (
  registros: CbfRegistro[],
  sides: SideMap,
): Goal[] => {
  const goals: Goal[] = [];

  for (const registro of registros) {
    if ((registro.tipo ?? "").trim().toUpperCase() !== GOAL_TIPO) continue;

    const scoredBy =
      registro.clube_id === sides.homeCbfId
        ? sides.homeCode
        : registro.clube_id === sides.awayCbfId
          ? sides.awayCode
          : null;
    if (!scoredBy) continue;

    const scorer = tidyScorerName(registro.atleta_apelido || registro.atleta_nome || "");
    if (!scorer) continue;

    const kind = goalKindOf(registro.resultado);

    // **The own-goal flip, and it is measured rather than assumed.** CBF files
    // a `CT` under the club of the player who put it in, so the goal counts for
    // the other side. Confirmed on a real payload: Grêmio 2x0 Vitória is listed
    // as `CT` by Camutanga — a Vitória player — plus one Grêmio goal, which
    // counts 1x1 against a 2x0 until the flip is applied. `goalsReconcile` is
    // what turns that from an assumption into a check, and it refused all 16
    // `CT` matches before this line existed.
    const clubCode =
      kind === "own"
        ? scoredBy === sides.homeCode
          ? sides.awayCode
          : sides.homeCode
        : scoredBy;

    // `atleta_camisa` is deliberately not carried through. It would identify a
    // scorer where two share a short name, but nothing renders it — and a field
    // nothing dereferences is upkeep for no reader's benefit, which is the rule
    // `Club.coach` states for not carrying a coach id.
    goals.push({
      clubCode,
      scorer,
      ...(kind ? { kind } : {}),
    });
  }

  return goals;
};

/**
 * Whether a goal list agrees with the scoreline it belongs to.
 *
 * This is the invariant `sync-goals.ts` refuses to write without, and it is
 * what makes the own-goal question answerable rather than assumed: if CBF filed
 * an own goal under the club that *scored* it instead of the club it counts
 * for, the two sides no longer add up and the match is reported instead of
 * being shipped wrong.
 */
export const goalsReconcile = (
  goals: Goal[],
  homeCode: ClubCode,
  awayCode: ClubCode,
  homeGoals: number,
  awayGoals: number,
): boolean =>
  goals.filter((goal) => goal.clubCode === homeCode).length === homeGoals &&
  goals.filter((goal) => goal.clubCode === awayCode).length === awayGoals &&
  goals.length === homeGoals + awayGoals;

/**
 * Attach synced goals to the matches whose own scoreline still agrees with them.
 *
 * **The reconciliation `sync-goals.ts` performs on the way out is repeated here
 * on the way in**, because the two sides are versioned independently and drift
 * apart between syncs: `goals.ts` is read from CBF on a workstation, while
 * `src/data/matches.ts` is a frozen snapshot regenerated on its own schedule. A
 * fixture played after that snapshot was taken carries scorers while the
 * committed record still calls it SCHEDULED with no score at all. Measured on
 * production 2026-08-30: for as long as the provider was failing and
 * `/api/matches` answered `source: "fallback"`, round 25's Atlético-MG ×
 * Vitória and São Paulo × Bragantino each shipped three scorers under
 * `homeGoals: null`.
 *
 * **Dropping is the honest answer rather than attaching anyway**, and the
 * `goals` field's own contract is what makes it so: absent means "not synced",
 * never "goalless", so an absence is a state every reader already handles,
 * where a list contradicting the score printed beside it is not.
 *
 * It is the **scoreline** that decides and not the status, because that also
 * covers what a status check cannot see — a curated list left behind by a score
 * the provider has since corrected. And it self-clears rather than needing a
 * sync: the moment the two agree again, the goals reappear.
 */
export const withGoals = (
  matches: Match[],
  goals: Record<string, Goal[]>,
): Match[] =>
  matches.map((match) => {
    const scored = goals[match.id];
    if (!scored || scored.length === 0) return match;
    if (match.homeGoals === null || match.awayGoals === null) return match;
    const agrees = goalsReconcile(
      scored,
      match.homeCode,
      match.awayCode,
      match.homeGoals,
      match.awayGoals,
    );
    return agrees ? { ...match, goals: scored } : match;
  });

/**
 * The goals of one match split by side, for a page that draws them in two
 * columns under the scoreline.
 *
 * A club with no goals gets an empty list rather than being omitted, so the two
 * columns stay aligned with the two crests above them.
 */
export const goalsBySide = (
  match: Match,
): { home: Goal[]; away: Goal[] } => {
  const goals = match.goals ?? [];
  return {
    home: goals.filter((goal) => goal.clubCode === match.homeCode),
    away: goals.filter((goal) => goal.clubCode === match.awayCode),
  };
};

/**
 * The pt-BR qualifier printed beside a scorer, or null for an ordinary goal.
 *
 * Abbreviated because it sits inline after a name, several times over in a
 * column narrow enough to hold two of them side by side — the same reason the
 * classificação's columns are `P`, `J`, `V` rather than words.
 */
export const goalKindLabel = (kind: GoalKind | undefined): string | null => {
  switch (kind) {
    case "penalty":
      return "pên.";
    case "own":
      return "contra";
    case "freekick":
      return "falta";
    default:
      return null;
  }
};

/**
 * What a scorer's row reads as, name and qualifier together.
 *
 * One function rather than two spans composed at the call site, because the
 * Partida page and any later caller must not come to disagree about the
 * wording — the drift `StatusChip` exists to prevent.
 */
export const goalLabel = (goal: Goal): string => {
  const qualifier = goalKindLabel(goal.kind);
  return qualifier ? `${goal.scorer} (${qualifier})` : goal.scorer;
};
