/**
 * sync-seed-data.ts
 * -----------------
 * Regenerate src/data/clubs.ts and src/data/matches.ts from the live
 * football-data.org API.
 *
 * These two files are the offline fallback: what the app serves when no token
 * is configured or the upstream is down. Hand-maintaining them guarantees
 * drift — the original hand-written list had the wrong division and the wrong
 * code for São Paulo. Regenerate at the start of a season, or whenever the
 * fallback looks stale.
 *
 * It reuses the same `clubFromTeam` / `mapMatch` the server uses at runtime, so
 * the snapshot cannot disagree with live data about identity or naming.
 *
 * Usage:  npx tsx scripts/sync-seed-data.ts
 *         (reads FOOTBALL_DATA_TOKEN from the environment, else from .env)
 *
 * Costs 2 requests against the 10/minute free-tier budget.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  clubFromTeam,
  mapMatch,
  matchesUrl,
  type MatchesResponse,
} from "@/football-data-core";
import type { Club, Match } from "@/src/types";

const ROOT = process.cwd();
const COMPETITION = "BSA";

const readToken = (): string => {
  if (process.env.FOOTBALL_DATA_TOKEN) return process.env.FOOTBALL_DATA_TOKEN;
  try {
    const env = readFileSync(path.join(ROOT, ".env"), "utf8");
    const match = env.match(/^FOOTBALL_DATA_TOKEN\s*=\s*"?([^"\n]*)"?/m);
    if (match?.[1]) return match[1];
  } catch {
    /* no .env — fall through */
  }
  console.error("Error: FOOTBALL_DATA_TOKEN is not set (environment or .env).");
  process.exit(1);
};

const TOKEN = readToken();

const get = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, { headers: { "X-Auth-Token": TOKEN } });
  if (!response.ok) {
    console.error(`Error: ${url} responded ${response.status}`);
    process.exit(1);
  }
  return (await response.json()) as T;
};

interface TeamsResponse {
  season?: { startDate?: string; endDate?: string };
  teams?: { id: number; address?: string | null }[];
}

/** Brazilian state from the postal address, e.g. "… Rio de Janeiro, RJ 22231-220". */
const stateFrom = (address: string | null | undefined): string | null =>
  address?.match(/,\s*([A-Z]{2})\b/)?.[1] ?? null;

const ts = (value: string) => JSON.stringify(value);

const teamsUrl = `https://api.football-data.org/v4/competitions/${COMPETITION}/teams`;
const teamsPayload = await get<TeamsResponse>(teamsUrl);
const matchesPayload = await get<MatchesResponse>(matchesUrl(COMPETITION));

/** Club plus the state parsed from the address, which the API has no field for. */
interface SeedClub extends Omit<Club, "state"> {
  state: string | null;
}

const rawTeams = teamsPayload.teams ?? [];
const clubs: SeedClub[] = rawTeams
  .map((team) => {
    const club = clubFromTeam(team);
    if (!club) {
      console.error(`Error: could not map team id ${team.id}`);
      process.exit(1);
    }
    return { ...club, state: stateFrom(team.address) };
  })
  .sort((a, b) => a.shortName.localeCompare(b.shortName, "pt-BR"));

// Validate the output rather than trusting it. A display-name override keyed to
// the wrong id renames the wrong club, which reads as perfectly plausible data.
const duplicatesOf = (key: "code" | "shortName") =>
  clubs.map((club) => club[key]).filter((value, i, all) => value && all.indexOf(value) !== i);

for (const key of ["code", "shortName"] as const) {
  const dupes = duplicatesOf(key);
  if (dupes.length) {
    console.error(`Error: duplicate club ${key}:`, dupes);
    process.exit(1);
  }
}

if (clubs.length === 0) {
  console.error("Error: upstream returned no teams.");
  process.exit(1);
}

const generatedOn = new Date().toISOString().slice(0, 10);
const season = teamsPayload.season ?? {};

writeFileSync(
  path.join(ROOT, "src/data/clubs.ts"),
  `import type { Club } from "@/src/types";

/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: npx tsx scripts/sync-seed-data.ts
 *
 * Source: football-data.org competition ${COMPETITION}, season
 * ${season.startDate ?? "?"} to ${season.endDate ?? "?"}. Snapshot taken ${generatedOn}.
 *
 * \`code\` is the upstream numeric id, not \`tla\`: the abbreviation is not unique
 * (Corinthians and Coritiba both report "COR").
 */
export const CLUBS: Club[] = [
${clubs
  .map(
    (club) =>
      `  { code: ${ts(club.code)}, name: ${ts(club.name)}, shortName: ${ts(club.shortName)}` +
      (club.tla ? `, tla: ${ts(club.tla)}` : "") +
      (club.state ? `, state: ${ts(club.state)}` : "") +
      ` },`,
  )
  .join("\n")}
];

export const CLUBS_BY_CODE = new Map(CLUBS.map((club) => [club.code, club]));
`,
);

/**
 * Snapshot the whole season, not a couple of rounds. The fallback table is
 * computed from these fixtures by standings-core, so a partial snapshot renders
 * a table where every club has played once.
 */
const seedMatches: Match[] = (matchesPayload.matches ?? [])
  .map(mapMatch)
  .filter((match): match is Match => match !== null)
  .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

const playedRounds = seedMatches
  .filter((match) => match.status === "FINISHED")
  .map((match) => match.round);
const lastPlayed = playedRounds.length ? Math.max(...playedRounds) : 0;

writeFileSync(
  path.join(ROOT, "src/data/matches.ts"),
  `import type { Match } from "@/src/types";

/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: npx tsx scripts/sync-seed-data.ts
 *
 * A frozen snapshot of the ${season.startDate?.slice(0, 4) ?? ""} season
 * (${seedMatches.length} fixtures, played through round ${lastPlayed}), taken
 * ${generatedOn} from football-data.org. This is the offline fallback the app
 * serves when no token is configured or the upstream is unreachable — real
 * historical data rather than invented scorelines, but **frozen**: it does not
 * reflect anything that happened after the snapshot date.
 */
export const SNAPSHOT_DATE = ${ts(generatedOn)};

export const SEED_MATCHES: Match[] = [
${seedMatches
  .map(
    (match) =>
      `  { id: ${ts(match.id)}, round: ${match.round}, kickoff: ${ts(match.kickoff)}, ` +
      `status: ${ts(match.status)}, homeCode: ${ts(match.homeCode)}, awayCode: ${ts(match.awayCode)}, ` +
      `homeGoals: ${match.homeGoals}, awayGoals: ${match.awayGoals} },`,
  )
  .join("\n")}
];
`,
);

console.log(`Wrote src/data/clubs.ts    — ${clubs.length} clubs`);
console.log(`Wrote src/data/matches.ts  — ${seedMatches.length} fixtures (through round ${lastPlayed})`);
console.log(`Snapshot date: ${generatedOn}`);
