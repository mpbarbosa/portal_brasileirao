import assert from "node:assert/strict";
import { test } from "node:test";

import {
  authHeaders,
  clubFromTeam,
  clubsFromMatches,
  mapMatch,
  mapMatches,
  mapStandings,
  mapStatus,
  matchesUrl,
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

test("prefers the upstream abbreviation as the club code", () => {
  assert.deepEqual(clubFromTeam({ id: 1783, name: "CR Flamengo", shortName: "Flamengo", tla: "FLA" }), {
    code: "FLA",
    name: "CR Flamengo",
    shortName: "Flamengo",
  });
});

test("falls back to a synthetic code when the abbreviation is missing", () => {
  assert.deepEqual(clubFromTeam({ id: 999, name: "Clube Sem Sigla", tla: null }), {
    code: "FD-999",
    name: "Clube Sem Sigla",
    shortName: "Clube Sem Sigla",
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
    homeCode: "FLA",
    awayCode: "PAL",
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
    clubs.map((club) => club.code),
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
  assert.equal(rows[0].club.code, "FLA");
  assert.equal(rows[0].points, 50);
  assert.equal(rows[0].played, 24);
  assert.equal(rows[0].goalDifference, 22);
});

test("falls back to the first group when nothing is labelled TOTAL", () => {
  const rows = mapStandings({ standings: [{ type: "HOME", table: STANDINGS.standings[0].table }] });

  assert.equal(rows[0]?.club.code, "FLA");
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

test("accepts the legacy homeTeam/awayTeam score keys", () => {
  const mapped = mapMatch({
    ...FIXTURE,
    score: { fullTime: { homeTeam: 3, awayTeam: 1 } },
  });

  assert.equal(mapped?.homeGoals, 3);
  assert.equal(mapped?.awayGoals, 1);
});

test("prefers the v4 home/away keys when both spellings are present", () => {
  const mapped = mapMatch({
    ...FIXTURE,
    score: { fullTime: { home: 2, away: 0, homeTeam: 9, awayTeam: 9 } },
  });

  assert.equal(mapped?.homeGoals, 2);
  assert.equal(mapped?.awayGoals, 0);
});
