/**
 * sync-rank-history.ts
 * --------------------
 * Regenerate src/data/rank-history.ts — every club's position in the
 * classificação after every round played.
 *
 * Costs nothing against the 10/minute budget: this is derived entirely from the
 * frozen seed in src/data/matches.ts, not fetched. That also means it is only
 * as current as the seed — run `npx tsx scripts/sync-seed-data.ts` first if you
 * want the history to include rounds played since the last snapshot.
 *
 * Usage:  npx tsx scripts/sync-rank-history.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

import { computeRankHistory, lastRoundWithResult } from "@/rank-history-core";
import { CLUBS } from "@/src/data/clubs";
import { SEED_MATCHES, SNAPSHOT_DATE } from "@/src/data/matches";

const ROOT = process.cwd();
const ts = (value: string) => JSON.stringify(value);

const lastRound = lastRoundWithResult(SEED_MATCHES);
if (lastRound === null) {
  console.error("Error: the seed holds no finished match — nothing to rank.");
  process.exit(1);
}

const history = computeRankHistory(CLUBS, SEED_MATCHES).sort((a, b) =>
  a.shortName.localeCompare(b.shortName, "pt-BR"),
);

// Validate rather than trust: every club must have an entry for every round,
// and each round must be a permutation of 1..N. A missing or repeated position
// means the table and the history disagree, which is invisible in a chart.
for (const club of history) {
  if (club.entries.length !== lastRound) {
    console.error(`Error: ${club.shortName} has ${club.entries.length} of ${lastRound} rounds.`);
    process.exit(1);
  }
}

for (let round = 1; round <= lastRound; round += 1) {
  const positions = history
    .map((club) => club.entries[round - 1]?.position)
    .sort((a, b) => (a ?? 0) - (b ?? 0));
  const expected = history.map((_, index) => index + 1);

  if (positions.join(",") !== expected.join(",")) {
    console.error(`Error: round ${round} positions are not 1..${history.length}:`, positions);
    process.exit(1);
  }
}

const generatedOn = new Date().toISOString().slice(0, 10);

writeFileSync(
  path.join(ROOT, "src/data/rank-history.ts"),
  `import type { ClubRankHistory } from "@/src/types";

/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: npx tsx scripts/sync-rank-history.ts
 *
 * Every club's position in the classificação after each of rounds 1–${lastRound},
 * derived from the seed fixtures in src/data/matches.ts (snapshot ${SNAPSHOT_DATE}).
 * Written ${generatedOn}.
 *
 * Positions come from \`computeStandings\` applied round by round, so they honour
 * the same CBF tie-breakers as the live table and count only FINISHED matches.
 * \`played\` is carried per round because a postponed fixture leaves a club a game
 * short of its rivals.
 *
 * Derived, therefore stale by construction: it does not know about any round
 * played after the seed snapshot. Regenerate after every \`sync-seed-data\`.
 */
export const RANK_HISTORY: ClubRankHistory[] = [
${history
  .map(
    (club) =>
      `  {\n` +
      `    clubCode: ${ts(club.clubCode)},\n` +
      `    shortName: ${ts(club.shortName)},\n` +
      `    entries: [\n` +
      club.entries
        .map(
          (entry) =>
            `      { round: ${entry.round}, position: ${entry.position}, ` +
            `points: ${entry.points}, played: ${entry.played} },`,
        )
        .join("\n") +
      `\n    ],\n` +
      `  },`,
  )
  .join("\n")}
];

export const RANK_HISTORY_BY_CODE = new Map(
  RANK_HISTORY.map((club) => [club.clubCode, club]),
);

/** The last round the history covers. */
export const RANK_HISTORY_LAST_ROUND = ${lastRound};
`,
);

console.log(
  `Wrote src/data/rank-history.ts — ${history.length} clubs across ${lastRound} rounds ` +
    `(seed snapshot ${SNAPSHOT_DATE})`,
);
