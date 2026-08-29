/**
 * The **Jogadores** page: every club's elenco, ordered and split into lines.
 * Pure — data in, data out, no I/O and no React (tests/squad-core.test.ts).
 *
 * The provider reports a squad member's position at **two levels of detail in
 * the same list**: mostly a broad line ("Defence", "Midfield"), occasionally a
 * specific role ("Centre-Back", "Left Winger"), and for a handful of players
 * nothing at all. A flat alphabetical list would therefore put a centroavante
 * between two zagueiros for no reason a reader could see, so the page groups by
 * line and `lineOf` is what folds the specific roles back onto the broad one
 * they belong to.
 *
 * It reuses `positionLabel` from `player-core.ts` rather than carrying its own
 * translation table, for the reason `venue-core.ts` reuses `slugify`: a second
 * copy of a lookup is how one page comes to call a player a volante and another
 * a meio-campista.
 */
import { positionLabel } from "@/player-core";
import type { Player, Squad } from "@/src/types";

/**
 * The four lines a squad is read in, plus the bucket for everyone else.
 *
 * `outros` collects two different absences on purpose: a player with no
 * position at all, and one whose position is a value `LINES` does not place.
 * Splitting them would mean two headings that a reader cannot tell apart —
 * both say "the provider did not tell us where this player plays" — and the
 * per-player label below still prints the unmapped value verbatim, so nothing
 * is hidden by pooling them.
 */
export type SquadLine = "goleiros" | "defensores" | "meio-campistas" | "atacantes" | "outros";

/**
 * Which line each upstream position belongs to. Every key football-data has
 * been observed to emit is here; anything else falls to `outros` rather than
 * being guessed at, which is the same rule `positionLabel` follows for wording.
 */
const LINES: Record<string, SquadLine> = {
  Goalkeeper: "goleiros",

  Defence: "defensores",
  "Centre-Back": "defensores",
  "Left-Back": "defensores",
  "Right-Back": "defensores",

  Midfield: "meio-campistas",
  "Defensive Midfield": "meio-campistas",
  "Central Midfield": "meio-campistas",
  "Attacking Midfield": "meio-campistas",

  Offence: "atacantes",
  "Centre-Forward": "atacantes",
  "Left Winger": "atacantes",
  "Right Winger": "atacantes",
};

/**
 * The positions whose translation the section heading already says.
 *
 * A player listed as "Defence" under a **Defensores** heading gains nothing
 * from a "Defesa" caption beneath the name — it is the heading again, once per
 * row, for two thirds of the squad. A specific role does earn its caption,
 * because "Lateral-esquerdo" is something the heading did not say.
 */
const BROAD_POSITIONS = new Set(["Goalkeeper", "Defence", "Midfield", "Offence"]);

export const LINE_LABELS: Record<SquadLine, string> = {
  goleiros: "Goleiros",
  defensores: "Defensores",
  "meio-campistas": "Meio-campistas",
  atacantes: "Atacantes",
  outros: "Outros",
};

/** Reading order, which is the order a squad is always listed in. */
export const LINE_ORDER: SquadLine[] = [
  "goleiros",
  "defensores",
  "meio-campistas",
  "atacantes",
  "outros",
];

export const lineOf = (position: string | undefined): SquadLine => {
  const raw = position?.trim();
  return (raw && LINES[raw]) || "outros";
};

/**
 * The caption shown under a player's name, or null when there is nothing to
 * add. Null for an absent position and for a broad one the heading covers;
 * otherwise the pt-BR label, falling back to the upstream word verbatim.
 */
export const playerPositionLabel = (player: Player): string | null => {
  const raw = player.position?.trim();
  if (!raw || BROAD_POSITIONS.has(raw)) return null;
  return positionLabel(raw);
};

export interface SquadSection {
  line: SquadLine;
  label: string;
  players: Player[];
}

/**
 * Alphabetical, in pt-BR collation so "Ângelo" sorts with the As rather than
 * after Z. Not by shirt number, which the squad listing does not carry: the
 * competition's team payload omits `shirtNumber` for every player in the
 * division, and inventing an order from the array's arrival sequence would be a
 * ranking a reader would try to interpret.
 */
export const comparePlayers = (a: Player, b: Player): number =>
  a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id);

/**
 * Split one squad into its lines, in reading order. A line nobody plays in is
 * dropped rather than rendered empty — a club with no listed goalkeeper should
 * show four sections, not four sections and a hole.
 */
export const squadSections = (players: Player[]): SquadSection[] => {
  const byLine = new Map<SquadLine, Player[]>();

  for (const player of players) {
    const line = lineOf(player.position);
    const bucket = byLine.get(line);
    if (bucket) bucket.push(player);
    else byLine.set(line, [player]);
  }

  return LINE_ORDER.filter((line) => byLine.has(line)).map((line) => ({
    line,
    label: LINE_LABELS[line],
    players: [...(byLine.get(line) ?? [])].sort(comparePlayers),
  }));
};

/**
 * Every squad, clubs in alphabetical order and players sorted within each.
 *
 * The provider returns clubs in its own order, which is neither the table's nor
 * the alphabet's and changes between calls; a list of twenty clubs that
 * reshuffles on refresh is unusable as an index.
 */
export const sortSquads = (squads: Squad[]): Squad[] =>
  [...squads]
    .map((squad) => ({ ...squad, players: [...squad.players].sort(comparePlayers) }))
    .sort((a, b) => a.club.shortName.localeCompare(b.club.shortName, "pt-BR"));

/** Total players across every squad, for the page's summary line. */
export const totalPlayers = (squads: Squad[]): number =>
  squads.reduce((sum, squad) => sum + squad.players.length, 0);

/**
 * A name folded for searching: accents removed, case dropped, punctuation
 * removed, whitespace collapsed.
 *
 * **Not `slugify`, and that is a decision rather than an oversight.** The
 * obvious reuse is the normaliser `venue-core.ts` shares with `club-core.ts` —
 * one normaliser is exactly how two spellings of a thing stay agreed. But
 * `slugify` replaces punctuation with a **hyphen**, which is right for an
 * address and wrong for a substring search: the division carries
 * **`Ariel Sant'Anna`**, and a reader who types `santanna` gets `santanna`
 * against `ariel-sant-anna`, which does not contain it. Measured across all 948
 * listed names, punctuation appears in exactly one of them, so this is a rule
 * written for a single real case rather than a hypothetical.
 *
 * **Punctuation is dropped rather than turned into a space**, which is the same
 * choice one step finer. Dropping catches `sant`, `anna`, `santanna` and
 * `sant'anna`; spacing catches `sant anna` instead of `santanna`. Both were run
 * against the real name — dropping wins four queries to three, and the query it
 * loses is one a reader types only by inserting a space they never saw.
 *
 * **Spaces survive, so a match cannot straddle two words.** Removing them as
 * well would make `Carlos Antonio` answer to `osan`, which is a match a reader
 * cannot account for.
 *
 * Accent folding also absorbs an upstream defect for free: the seed carries
 * **`Joāo Paulo`** with a macron where the name has a tilde, and both fold to
 * `joao`, so the row is reachable by the spelling a reader would actually type.
 */
export const foldForSearch = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Squads holding only the players whose name matches `query`, dropping clubs
 * left with nobody.
 *
 * A blank query returns the input **unchanged and by identity**, so the
 * unfiltered page renders exactly the array it was given rather than a copy —
 * the filter costs nothing when nobody is using it, which is almost always.
 *
 * Clubs with no match are dropped rather than rendered empty. Twenty club rows
 * announcing "0 jogadores" is a page that looks broken; a caller that wants to
 * say "nothing found" can see an empty array and say it once.
 */
export const filterSquads = (squads: Squad[], query: string): Squad[] => {
  const needle = foldForSearch(query);
  if (!needle) return squads;

  return squads
    .map((squad) => ({
      ...squad,
      players: squad.players.filter((player) => foldForSearch(player.name).includes(needle)),
    }))
    .filter((squad) => squad.players.length > 0);
};
