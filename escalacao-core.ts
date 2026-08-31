/**
 * escalacao-core.ts
 * -----------------
 * The **escalação**: who each club put on the pitch, and who sat on the bench.
 *
 * Pure, like every other `*-core.ts` — CBF's arrays in, our rows out. The
 * fetching is `scripts/sync-escalacoes.ts`'s problem, and production never calls
 * CBF; the rule `goals-core.ts` states applies here unchanged.
 *
 * **Why this exists at all, when the app already has a squad per club.**
 * `squads.ts` is an *elenco* — everyone under contract. An escalação is a claim
 * about **one match**: these eleven started it. The two answer different
 * questions and only the second belongs on a Partida page.
 *
 * **Where the data comes from, and why that was not obvious.**
 * `docs/roadmap.md` listed escalações under *Explicitly not doing* on the
 * grounds that no reachable tier carried them — true of football-data, and
 * wrongly generalised to every source. CBF's `/api/cbf/jogos/{id_jogo}` carries
 * `mandante.atletas` and `visitante.atletas`, 23 a side, on the same request
 * `sync-goals.ts` already makes.
 *
 * ## Three traps in that payload, each measured rather than assumed
 *
 * **1. The booleans are strings.** `reserva` is `"false"`, not `false`, so
 * `if (a.reserva)` is true for all 46 players and a naive filter reports
 * *nobody* started. That is exactly what a first pass here did: 0 titulares, 23
 * reservas, on both sides, with no error anywhere. `startedFor` compares against
 * the string, and `tests/escalacao-core.test.ts` fixes that by feeding it the
 * literal shape CBF sends.
 *
 * **2. The name carries the shirt number, in a different format from the shirt
 * number.** `apelido` is `"01 - Carlos"` while `numero_camisa` beside it is
 * `"1"`. Rendering both prints the number twice, zero-padded once and not the
 * other. `tidyLineupName` strips the prefix; the number is carried as its own
 * field because that is what a lineup is read by.
 *
 * **3. `entrou_jogando` does not mean "came on".** It is `"true"` for exactly
 * the players whose `reserva` is `"false"` — i.e. it means *started*, the same
 * fact under a name that reads as its opposite. Nothing here uses it, and this
 * paragraph is why: the field is a trap for the next person, not a spare signal.
 *
 * ## What is deliberately absent
 *
 * **No substitutions, and no minutes.** CBF's `alteracoes` array resolves
 * cleanly — 10 of 10 ids matched their own side's roster on the fixture this was
 * built against, with a starter going off and a reserve coming on every time —
 * so this is a scope decision rather than a data gap. What it lacks is a usable
 * clock: `tempo_jogo` is `"25:00"` with `tempo_subs` `"TN2"`, the same split
 * vocabulary that made goals ship without a minute until `sumula-core.ts`
 * arrived. A substitution list is mostly *when*, so shipping one without the
 * minute would be worse than not shipping it. The súmula prints a Substituições
 * table beside the Gols table that module already parses, which is where that
 * work starts.
 */
import type { ClubCode, Lineup, LineupPlayer, Match, Substitution } from "@/src/types";
import { type SideMap, tidyScorerName } from "@/goals-core";
import { type SumulaSubstitution, sumulaSubstitutionLabel } from "@/sumula-core";

/** One entry of CBF's `mandante.atletas` / `visitante.atletas`. */
export interface CbfAtleta {
  id?: string;
  numero_camisa?: string;
  /** `"true"` / `"false"` — a string, see trap 1 above. */
  reserva?: string;
  goleiro?: string;
  nome?: string;
  apelido?: string;
}

/** How many a club may field. Not a style constant: `lineupsReconcile` uses it. */
export const STARTERS_PER_SIDE = 11;

const isTrue = (value: string | undefined): boolean => value === "true";

/** Whether this entry started the match. See trap 1: the value is a string. */
export const startedFor = (atleta: CbfAtleta): boolean => atleta.reserva === "false";

/**
 * `"01 - Carlos"` -> `"Carlos"`, and CBF's shouting folded the way
 * `tidyScorerName` folds a scorer's — one normaliser for one provider's casing,
 * rather than a second copy that drifts from it.
 *
 * The prefix is stripped only where it is genuinely a leading number and a dash.
 * A player whose name begins with a digit for any other reason keeps it, which
 * costs nothing and refuses to guess.
 */
export const tidyLineupName = (name: string): string =>
  tidyScorerName(String(name ?? "").replace(/^\s*\d+\s*-\s*/, ""));

/**
 * The two lineups in a CBF match payload, mapped onto our club codes.
 *
 * A side whose CBF id is not one of this fixture's two is dropped rather than
 * guessed at — `goalsFromRegistros` and `computeStandings` both refuse an
 * unknown club the same way.
 */
export const lineupsFromAtletas = (
  home: { id?: string; atletas?: CbfAtleta[] } | undefined,
  away: { id?: string; atletas?: CbfAtleta[] } | undefined,
  sides: SideMap,
): Lineup[] => {
  const build = (
    side: { id?: string; atletas?: CbfAtleta[] } | undefined,
    expectedId: string,
    code: ClubCode,
  ): Lineup | null => {
    if (!side || String(side.id ?? "") !== expectedId) return null;
    const players: LineupPlayer[] = (side.atletas ?? []).map((atleta) => ({
      name: tidyLineupName(atleta.apelido ?? atleta.nome ?? ""),
      shirt: String(atleta.numero_camisa ?? "").trim(),
      ...(isTrue(atleta.goleiro) ? { keeper: true as const } : {}),
      ...(startedFor(atleta) ? { starter: true as const } : {}),
    }));
    return { clubCode: code, players };
  };

  return [
    build(home, sides.homeCbfId, sides.homeCode),
    build(away, sides.awayCbfId, sides.awayCode),
  ].filter((lineup): lineup is Lineup => lineup !== null);
};

/**
 * The invariant a synced escalação must satisfy before it is written down.
 *
 * `goalsReconcile` checks goals against the scoreline, which is the strongest
 * check available there. A lineup has no scoreline to agree with, so the check
 * is what the laws of the game already guarantee: **two sides, eleven starters
 * each, and every player identified**. That is enough to catch the failure this
 * module was written around — the string-boolean, which produces zero starters
 * and looks like perfectly good data.
 *
 * A blank shirt is refused too. It is not decoration: the number is how a team
 * sheet is read, and CBF sending an empty one means the payload is not the
 * finished team sheet yet.
 */
export const lineupsReconcile = (lineups: Lineup[]): boolean => {
  if (lineups.length !== 2) return false;
  return lineups.every(
    (lineup) =>
      lineup.players.length > STARTERS_PER_SIDE &&
      lineup.players.filter((player) => player.starter).length === STARTERS_PER_SIDE &&
      lineup.players.every((player) => player.name !== "" && player.shirt !== ""),
  );
};

/** Attach synced lineups to the matches that have any. Mirrors `withGoals`. */
export const withLineups = (
  matches: Match[],
  lineups: Record<string, Lineup[]>,
): Match[] =>
  matches.map((match) =>
    lineups[match.id] ? { ...match, lineups: lineups[match.id] } : match,
  );

/** This club's lineup, or null. The page asks by club, not by position in an array. */
export const lineupFor = (
  match: Pick<Match, "lineups">,
  clubCode: ClubCode | undefined,
): Lineup | null =>
  match.lineups?.find((lineup) => lineup.clubCode === clubCode) ?? null;

/**
 * Starters first, then the bench, each in shirt order.
 *
 * Shirt order rather than CBF's own, because a team sheet is read by number and
 * CBF's array order is neither numeric nor positional. Numbers sort **as
 * numbers** — `"9"` before `"10"` — since a lexical sort puts 10 before 9 and
 * looks like a bug on every single lineup.
 */
export const bySection = (lineup: Lineup): { starters: LineupPlayer[]; bench: LineupPlayer[] } => {
  const byShirt = (a: LineupPlayer, b: LineupPlayer) => {
    const na = Number(a.shirt);
    const nb = Number(b.shirt);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return a.shirt.localeCompare(b.shirt, "pt-BR");
  };
  return {
    starters: lineup.players.filter((p) => p.starter).sort(byShirt),
    bench: lineup.players.filter((p) => !p.starter).sort(byShirt),
  };
};

/**
 * Attach the súmula's substitutions to the lineups they belong to.
 *
 * **Two sources, joined on the shirt number, and neither alone would do.** The
 * match API knows *who* — ids that resolve against the roster — and cannot say
 * *when*: its `tempo_jogo` is `"25:00"` beside a `tempo_subs` of `"TN2"`, the
 * split clock that kept goals minuteless until `sumula-core.ts` arrived. The
 * súmula knows *when* and prints a **truncated** name, so it cannot say who.
 * The shirt number is complete in both.
 *
 * **All or nothing per match.** Any row that cannot be placed — a team string
 * matching neither side, a shirt not on that side's sheet — returns null for
 * the whole fixture rather than a partial list. A substitution list missing one
 * change reads as a complete record of a match where that change never
 * happened, which is a plausible lie of exactly the kind `goalsReconcile`
 * exists to refuse.
 *
 * `expected` is the match API's own count per club. It is passed in rather than
 * derived so the two sources have to agree on *how many* before either is
 * believed — the same shape as `sumulaMinutes` aligning on the goal count.
 */
export const attachSubstitutions = (
  lineups: Lineup[],
  subs: SumulaSubstitution[],
  teams: { code: ClubCode; cbfName: string }[],
  expected: Record<string, number>,
): Lineup[] | null => {
  // The súmula prints `Palmeiras/SP`; the match API says `Palmeiras`. Compare on
  // what precedes the final slash rather than trying to normalise a UF.
  const codeForTeam = (team: string): ClubCode | null => {
    const name = team.replace(/\s*\/\s*[A-Z]{2}\s*$/, "").trim().toLowerCase();
    return teams.find((t) => t.cbfName.trim().toLowerCase() === name)?.code ?? null;
  };

  const placed = new Map<ClubCode, Substitution[]>();

  for (const sub of subs) {
    const code = codeForTeam(sub.team);
    if (!code) return null;
    const lineup = lineups.find((l) => l.clubCode === code);
    if (!lineup) return null;

    const nameFor = (shirt: string) =>
      lineup.players.find((player) => player.shirt === shirt)?.name ?? null;
    const on = nameFor(sub.onShirt);
    const off = nameFor(sub.offShirt);
    if (!on || !off) return null;

    const list = placed.get(code) ?? [];
    list.push({ on, off, minute: sumulaSubstitutionLabel(sub) });
    placed.set(code, list);
  }

  // Both sources must agree on the count, per club, before either is believed.
  for (const lineup of lineups) {
    if ((placed.get(lineup.clubCode) ?? []).length !== (expected[lineup.clubCode] ?? 0)) {
      return null;
    }
  }

  return lineups.map((lineup) => {
    const list = placed.get(lineup.clubCode);
    return list && list.length > 0 ? { ...lineup, subs: list } : lineup;
  });
};
