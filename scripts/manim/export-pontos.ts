/**
 * Exports what one Manim scene needs: every club's points after each rodada.
 *
 * The sibling `export-campanhas.ts` exports two clubs' *positions*; this one
 * exports all twenty clubs' *points*. They are two readings of one campanha and
 * neither recomputes a standing — `rank-history.ts` already carries both figures
 * per round, written by `sync-rank-history` out of the seed fixtures.
 *
 *   npx tsx scripts/manim/export-pontos.ts > scripts/manim/pontos.json
 *
 * No I/O beyond reading the frozen seed and writing one JSON file, the same
 * split every `*-core.ts` module draws.
 */
import { RANK_HISTORY } from "@/src/data/rank-history";
import { SNAPSHOT_DATE } from "@/src/data/matches";
import { CLUBS_BY_CODE } from "@/src/data/clubs";

const clubs = RANK_HISTORY.map((history) => {
  const club = CLUBS_BY_CODE.get(history.clubCode);
  if (!club) throw new Error(`no club for ${history.clubCode}`);

  return {
    code: history.clubCode,
    // shortName, never `tla`: Corinthians and Coritiba both report "COR", so a
    // drawing keyed on the abbreviation labels two lines the same.
    name: history.shortName,
    rounds: history.entries.map((entry) => ({
      round: entry.round,
      points: entry.points,
      position: entry.position,
      played: entry.played,
    })),
  };
});

if (clubs.length === 0) throw new Error("rank history is empty");

// Every club must reach the same last round, or a line stops short of the frame
// and reads as a club that dropped out of the division rather than as a gap in
// the data. `sync-rank-history` already validates this; asserting it here is
// what keeps the drawing from having to decide what to do about it.
const lastRounds = new Set(clubs.map((club) => club.rounds[club.rounds.length - 1]?.round));
if (lastRounds.size !== 1) {
  throw new Error(`clubs end on different rounds: ${[...lastRounds].join(", ")}`);
}

process.stdout.write(
  JSON.stringify({ snapshot: SNAPSHOT_DATE, clubs }, null, 2) + "\n",
);
