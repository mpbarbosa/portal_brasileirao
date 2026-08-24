/**
 * Pure per-club derivations. No I/O — the club view composes data the client
 * already holds (standings, fixtures, scorers), so this module exists to keep
 * the slicing rules testable rather than buried in a component.
 */
import { compareByKickoff, isConcluded } from "@/matches-core";
import { countsTowardStandings } from "@/standings-core";
import type { ClubCode, Match, Scorer, StandingsRow } from "@/src/types";

export type FormResult = "V" | "E" | "D";

export const playsIn = (match: Match, code: ClubCode): boolean =>
  match.homeCode === code || match.awayCode === code;

export const clubMatches = (matches: Match[], code: ClubCode): Match[] =>
  matches.filter((match) => playsIn(match, code)).sort(compareByKickoff);

/**
 * Result of a finished match from one club's point of view. Returns null when
 * the match cannot be scored yet — a live or unplayed fixture has no result,
 * and neither does one the club is not in.
 */
export const resultFor = (match: Match, code: ClubCode): FormResult | null => {
  if (!countsTowardStandings(match) || !playsIn(match, code)) return null;

  const scored = match.homeCode === code ? match.homeGoals : match.awayGoals;
  const conceded = match.homeCode === code ? match.awayGoals : match.homeGoals;

  if (scored > conceded) return "V";
  if (scored === conceded) return "E";
  return "D";
};

/**
 * The club's last `size` results, oldest first — the reading order of a form
 * guide. Only finished matches count, so a postponed fixture in the middle of
 * the run does not punch a hole in it.
 */
export const recentForm = (matches: Match[], code: ClubCode, size = 5): FormResult[] =>
  clubMatches(matches, code)
    .map((match) => resultFor(match, code))
    .filter((result): result is FormResult => result !== null)
    .slice(-size);

/** The next fixture still to be played, or null once the season is over. */
export const nextFixture = (matches: Match[], code: ClubCode): Match | null =>
  clubMatches(matches, code).find((match) => !isConcluded(match)) ?? null;

/** The most recently finished match, or null before the club has played. */
export const lastFixture = (matches: Match[], code: ClubCode): Match | null => {
  const played = clubMatches(matches, code).filter(countsTowardStandings);
  return played.length ? played[played.length - 1] : null;
};

export const standingFor = (rows: StandingsRow[], code: ClubCode): StandingsRow | null =>
  rows.find((row) => row.club.code === code) ?? null;

/** The club's entries in the top-scorer table, best first. */
export const scorersFor = (scorers: Scorer[], code: ClubCode): Scorer[] =>
  scorers.filter((scorer) => scorer.club.code === code);
