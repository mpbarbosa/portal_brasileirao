import assert from "node:assert/strict";
import { test } from "node:test";

import {
  authHeaders,
  clubFromTeam,
  clubsFromMatches,
  mapMatch,
  mapMatches,
  mapStandings,
  mapScorers,
  mapStatus,
  matchesUrl,
  scorersUrl,
  standingsUrl,
} from "@/football-data-core";

test("builds Série A URLs and the token header", () => {
  assert.equal(
    standingsUrl(),
    "https://api.football-data.org/v4/competitions/BSA/standings",
  );
  assert.equal(matchesUrl(), "https://api.football-data.org/v4/competitions/BSA/matches");
  assert.equal(matchesUrl("BSB"), "https://api.football-data.org/v4/competitions/BSB/matches");
  assert.deepEqual(authHeaders("abc123"), { "X-Auth-Token": "abc123" });
});

test("collapses the upstream status vocabulary onto the app's", () => {
  assert.equal(mapStatus("TIMED"), "SCHEDULED");
  assert.equal(mapStatus("SCHEDULED"), "SCHEDULED");
  assert.equal(mapStatus("IN_PLAY"), "LIVE");
  assert.equal(mapStatus("PAUSED"), "LIVE"); // half-time is still live
  assert.equal(mapStatus("FINISHED"), "FINISHED");
  assert.equal(mapStatus("AWARDED"), "FINISHED");
  assert.equal(mapStatus("POSTPONED"), "POSTPONED");
  assert.equal(mapStatus("SUSPENDED"), "POSTPONED");
  assert.equal(mapStatus("CANCELLED"), "CANCELLED");
});

test("an unknown or missing status degrades to SCHEDULED", () => {
  assert.equal(mapStatus("SOMETHING_NEW"), "SCHEDULED");
  assert.equal(mapStatus(undefined), "SCHEDULED");
});

test("identifies a club by upstream id, carrying the abbreviation for display", () => {
  assert.deepEqual(clubFromTeam({ id: 1783, name: "CR Flamengo", shortName: "Flamengo", tla: "FLA" }), {
    code: "1783",
    name: "CR Flamengo",
    shortName: "Flamengo",
    tla: "FLA",
  });
});

test("two clubs sharing an abbreviation stay distinct", () => {
  // Real upstream data: Corinthians and Coritiba both report tla "COR".
  // Keying on the abbreviation would merge them into one standings row.
  const corinthians = clubFromTeam({ id: 1779, name: "SC Corinthians Paulista", tla: "COR" });
  const coritiba = clubFromTeam({ id: 4241, name: "Coritiba FBC", tla: "COR" });

  assert.notEqual(corinthians?.code, coritiba?.code);
  assert.equal(corinthians?.code, "1779");
  assert.equal(coritiba?.code, "4241");
});

test("falls back to the abbreviation when there is no id", () => {
  assert.deepEqual(clubFromTeam({ name: "Clube Sem Id", tla: "XYZ" }), {
    code: "XYZ",
    name: "Clube Sem Id",
    shortName: "Clube Sem Id",
    tla: "XYZ",
  });
});

test("a team with no name at all yields no club", () => {
  assert.equal(clubFromTeam({ id: 5 }), null);
  assert.equal(clubFromTeam(undefined), null);
});

const FIXTURE = {
  id: 400021,
  utcDate: "2026-08-23T19:00:00Z",
  status: "FINISHED",
  matchday: 24,
  homeTeam: { id: 1783, name: "CR Flamengo", shortName: "Flamengo", tla: "FLA" },
  awayTeam: { id: 1776, name: "SE Palmeiras", shortName: "Palmeiras", tla: "PAL" },
  score: { fullTime: { home: 2, away: 1 } },
};

test("maps a fixture onto the app's match shape", () => {
  assert.deepEqual(mapMatch(FIXTURE), {
    id: "400021",
    round: 24,
    kickoff: "2026-08-23T19:00:00Z",
    status: "FINISHED",
    homeCode: "1783",
    awayCode: "1776",
    homeGoals: 2,
    awayGoals: 1,
  });
});

test("an unplayed fixture carries null goals, not zeros", () => {
  const mapped = mapMatch({
    ...FIXTURE,
    status: "TIMED",
    score: { fullTime: { home: null, away: null } },
  });

  assert.equal(mapped?.homeGoals, null);
  assert.equal(mapped?.awayGoals, null);
  assert.equal(mapped?.status, "SCHEDULED");
});

test("a 0-0 draw keeps its zeros rather than reading as unplayed", () => {
  const mapped = mapMatch({ ...FIXTURE, score: { fullTime: { home: 0, away: 0 } } });

  assert.equal(mapped?.homeGoals, 0);
  assert.equal(mapped?.awayGoals, 0);
});

test("drops fixtures missing an id, kickoff, or club", () => {
  assert.equal(mapMatch({ ...FIXTURE, id: undefined }), null);
  assert.equal(mapMatch({ ...FIXTURE, utcDate: undefined }), null);
  assert.equal(mapMatch({ ...FIXTURE, awayTeam: undefined }), null);
});

test("a bad fixture is skipped without losing the good ones", () => {
  const mapped = mapMatches({
    matches: [FIXTURE, { ...FIXTURE, id: undefined }, { ...FIXTURE, id: 400022 }],
  });

  assert.deepEqual(
    mapped.map((match) => match.id),
    ["400021", "400022"],
  );
});

test("an empty or missing matches array yields an empty list", () => {
  assert.deepEqual(mapMatches({}), []);
  assert.deepEqual(mapMatches({ matches: [] }), []);
});

test("collects each club once from a fixture list, ordered by name", () => {
  const clubs = clubsFromMatches({ matches: [FIXTURE, { ...FIXTURE, id: 400022 }] });

  assert.deepEqual(
    clubs.map((club) => club.tla),
    ["FLA", "PAL"],
  );
});

const STANDINGS = {
  standings: [
    {
      type: "TOTAL",
      table: [
        {
          position: 1,
          team: { id: 1783, name: "CR Flamengo", shortName: "Flamengo", tla: "FLA" },
          playedGames: 24,
          won: 15,
          draw: 5,
          lost: 4,
          goalsFor: 42,
          goalsAgainst: 20,
          goalDifference: 22,
          points: 50,
        },
      ],
    },
    { type: "HOME", table: [{ position: 1, team: { name: "Outro", tla: "OUT" } }] },
  ],
};

test("reads the TOTAL table, not the home/away splits", () => {
  const rows = mapStandings(STANDINGS);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].club.tla, "FLA");
  assert.equal(rows[0].points, 50);
  assert.equal(rows[0].played, 24);
  assert.equal(rows[0].goalDifference, 22);
});

test("falls back to the first group when nothing is labelled TOTAL", () => {
  const rows = mapStandings({ standings: [{ type: "HOME", table: STANDINGS.standings[0].table }] });

  assert.equal(rows[0]?.club.tla, "FLA");
});

test("derives goal difference when the upstream omits it", () => {
  const rows = mapStandings({
    standings: [
      {
        type: "TOTAL",
        table: [{ position: 1, team: { name: "X", tla: "XXX" }, goalsFor: 10, goalsAgainst: 4 }],
      },
    ],
  });

  assert.equal(rows[0].goalDifference, 6);
});

test("an empty standings payload yields an empty table", () => {
  assert.deepEqual(mapStandings({}), []);
  assert.deepEqual(mapStandings({ standings: [] }), []);
});

test("maps the explicit LIVE status", () => {
  assert.equal(mapStatus("LIVE"), "LIVE");
});

test("applies the display-name override so live and fallback agree", () => {
  // Upstream calls these "Mineiro" and "Paranaense", which is not what a
  // Brazilian reader calls them.
  assert.equal(clubFromTeam({ id: 1766, name: "CA Mineiro", shortName: "Mineiro" })?.shortName, "Atlético-MG");
  assert.equal(
    clubFromTeam({ id: 1768, name: "CA Paranaense", shortName: "Paranaense" })?.shortName,
    "Athletico-PR",
  );
});

test("a club with no override keeps its upstream short name", () => {
  assert.equal(clubFromTeam({ id: 1783, name: "CR Flamengo", shortName: "Flamengo" })?.shortName, "Flamengo");
});

const SCORERS = {
  scorers: [
    {
      player: { id: 7811, name: "Pedro" },
      team: { id: 1783, name: "CR Flamengo", shortName: "Flamengo", tla: "FLA" },
      goals: 15,
      assists: 5,
      penalties: 3,
      playedMatches: 22,
    },
    {
      player: { id: 9001, name: "Kevin Viveros" },
      team: { id: 1768, name: "CA Paranaense", shortName: "Paranaense", tla: "CAP" },
      goals: 14,
      assists: null,
      penalties: null,
      playedMatches: 21,
    },
  ],
};

test("builds the scorers URL with an explicit limit", () => {
  assert.equal(
    scorersUrl(),
    "https://api.football-data.org/v4/competitions/BSA/scorers?limit=20",
  );
  assert.equal(
    scorersUrl("BSA", 5),
    "https://api.football-data.org/v4/competitions/BSA/scorers?limit=5",
  );
});

test("ranks scorers by their upstream order", () => {
  const rows = mapScorers(SCORERS);

  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => [row.position, row.playerName, row.goals]),
    [
      [1, "Pedro", 15],
      [2, "Kevin Viveros", 14],
    ],
  );
});

test("a missing assist or penalty count stays null, never zero", () => {
  // "no penalties reported" and "scored no penalties" are different claims.
  const [, viveros] = mapScorers(SCORERS);

  assert.equal(viveros.assists, null);
  assert.equal(viveros.penalties, null);
});

test("a reported zero is preserved as zero", () => {
  const [row] = mapScorers({
    scorers: [{ ...SCORERS.scorers[0], assists: 0, penalties: 0 }],
  });

  assert.equal(row.assists, 0);
  assert.equal(row.penalties, 0);
});

test("scorers carry the corrected club display name", () => {
  const [, viveros] = mapScorers(SCORERS);

  assert.equal(viveros.club.shortName, "Athletico-PR");
});

test("drops entries with no name, no club, or no goal count", () => {
  const rows = mapScorers({
    scorers: [
      { ...SCORERS.scorers[0], player: { id: 1, name: "  " } },
      { ...SCORERS.scorers[0], team: undefined },
      { ...SCORERS.scorers[0], goals: null },
      SCORERS.scorers[1],
    ],
  });

  assert.deepEqual(rows.map((row) => row.playerName), ["Kevin Viveros"]);
  // Rank is dense: dropping rows must not leave a gap at the top.
  assert.equal(rows[0].position, 1);
});

test("an empty scorers payload yields an empty table", () => {
  assert.deepEqual(mapScorers({}), []);
  assert.deepEqual(mapScorers({ scorers: [] }), []);
});
