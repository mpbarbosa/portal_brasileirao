/**
 * Exports the data one Manim scene needs: two clubs' campanhas, round by round.
 *
 * No I/O beyond reading the frozen seed and writing one JSON file — the same
 * split every `*-core.ts` module draws, so the animation is drawn from data the
 * app itself serves rather than from figures typed into a Python script.
 *
 *   npx tsx scripts/manim/export-campanhas.ts [homeCodeA] [codeB] > campanhas.json
 *
 * Defaults to Palmeiras (1769) and Flamengo (1783).
 */
import { RANK_HISTORY } from "@/src/data/rank-history";
import { SEED_MATCHES, SNAPSHOT_DATE } from "@/src/data/matches";
import { CLUBS } from "@/src/data/clubs";
import { resultFor, playsIn } from "@/club-core";

const [codeA = "1769", codeB = "1783"] = process.argv.slice(2);

function clubOf(code: string) {
  const club = CLUBS.find((c) => c.code === code);
  if (!club) throw new Error(`unknown club code ${code}`);
  return club;
}

function campaignOf(code: string) {
  const club = clubOf(code);
  const history = RANK_HISTORY.find((h) => h.clubCode === code);
  if (!history) throw new Error(`no rank history for ${club.shortName}`);

  const rounds = history.entries.map((entry) => {
    // The club plays at most one fixture per round; a postponed one leaves none,
    // which is why `match` is nullable rather than assumed.
    const match =
      SEED_MATCHES.find(
        (m) => m.round === entry.round && playsIn(m, code) && m.homeGoals !== null && m.awayGoals !== null,
      ) ?? null;

    const opponentCode = match ? (match.homeCode === code ? match.awayCode : match.homeCode) : null;
    const home = match ? match.homeCode === code : null;
    const goalsFor = match ? (home ? match.homeGoals : match.awayGoals) : null;
    const goalsAgainst = match ? (home ? match.awayGoals : match.homeGoals) : null;

    return {
      round: entry.round,
      position: entry.position,
      points: entry.points,
      played: entry.played,
      match: match
        ? {
            opponent: clubOf(opponentCode as string).shortName,
            opponentTla: clubOf(opponentCode as string).tla,
            home,
            goalsFor,
            goalsAgainst,
            // V / E / D from the club's own point of view.
            result: resultFor(match, code),
          }
        : null,
    };
  });

  return { code, name: club.shortName, tla: club.tla, rounds };
}

const payload = {
  snapshot: SNAPSHOT_DATE,
  clubs: [campaignOf(codeA), campaignOf(codeB)],
};

process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
