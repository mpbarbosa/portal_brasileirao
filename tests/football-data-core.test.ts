import assert from "node:assert/strict";
import { test } from "node:test";

import {
  authHeaders,
  clubFromTeam,
  coachName,
  clubsFromMatches,
  mapMatch,
  mapMatches,
  mapReferees,
  mapStandings,
  mapPerson,
  mapScorers,
  mapSquads,
  mapStatus,
  matchesUrl,
  personUrl,
  scorersUrl,
  standingsUrl,
  teamsUrl,
} from "@/football-data-core";

test("builds Série A URLs and the token header", () => {
  assert.equal(
    standingsUrl(),
    "https://api.football-data.org/v4/competitions/BSA/standings",
  );
  assert.equal(matchesUrl(), "https://api.football-data.org/v4/competitions/BSA/matches");
  assert.equal(teamsUrl(), "https://api.football-data.org/v4/competitions/BSA/teams");
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
    slug: "flamengo",
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
    slug: "clube-sem-id",
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

/*
 * The officials are a **live-only** field: `src/data/matches.ts` carries none,
 * and the end-to-end suite boots with `DISABLE_FOOTBALL_DATA=true`, so no
 * browser test can ever see one render. These cover the mapping against a
 * payload captured from `/v4/competitions/BSA/matches` on 2026-08-27 instead —
 * which is what CLAUDE.md prescribes when a live path needs coverage.
 *
 * Measured in that capture, and the reason each assertion below exists: 157 of
 * 380 fixtures name an official, every one of them a single entry, and every
 * `type` is `REFEREE`. Rounds 1–15 are complete and 16–24 mostly are not,
 * including finished matches — so the field fills in retroactively rather than
 * at kickoff, and an empty array is the ordinary state of a played fixture.
 */
const CAPTURED_REFEREE = { id: 206800, name: "Bruno de Araújo", type: "REFEREE", nationality: "Brazil" };

test("carries the officials a captured payload reports", () => {
  const mapped = mapMatch({ ...FIXTURE, referees: [CAPTURED_REFEREE] });

  assert.deepEqual(mapped?.referees, [{ name: "Bruno de Araújo", role: "REFEREE" }]);
});

test("a fixture upstream names nobody for has no referees key at all", () => {
  // Present-and-empty would make `"referees" in match` lie about what upstream
  // said, and 223 of the season's 380 fixtures are in exactly this state.
  assert.equal("referees" in (mapMatch({ ...FIXTURE, referees: [] }) ?? {}), false);
  assert.equal("referees" in (mapMatch(FIXTURE) ?? {}), false);
});

test("keeps the provider's role vocabulary rather than translating in the mapper", () => {
  // Translation belongs at the edge, in `refereeRoleLabel`, exactly as
  // `Player.position` carries the English word for `positionLabel` to read.
  assert.deepEqual(mapReferees([CAPTURED_REFEREE])[0]?.role, "REFEREE");
});

test("drops an official with no name but keeps one with no role", () => {
  // A row reading "Árbitro" with nothing beside it is worse than no row; a
  // named official whose role upstream omitted is still a fact worth having.
  assert.deepEqual(
    mapReferees([
      { id: 1, type: "REFEREE" },
      { id: 2, name: "   ", type: "REFEREE" },
      { id: 3, name: "Sem Função" },
    ]),
    [{ name: "Sem Função", role: "" }],
  );
});

test("an absent referees array maps to an empty list", () => {
  assert.deepEqual(mapReferees(undefined), []);
  assert.deepEqual(mapReferees([]), []);
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

test("builds the person URL", () => {
  assert.equal(personUrl("1077"), "https://api.football-data.org/v4/persons/1077");
});

test("maps a person, keeping only the fields that are present", () => {
  assert.deepEqual(
    mapPerson({
      id: 1077,
      name: "Pedro",
      position: "Offence",
      nationality: "Brazil",
      dateOfBirth: "1997-06-20",
      shirtNumber: 9,
    }),
    {
      id: "1077",
      name: "Pedro",
      shirtNumber: 9,
      position: "Offence",
      nationality: "Brazil",
      dateOfBirth: "1997-06-20",
    },
  );
});

test("absent person fields are omitted, not filled with placeholders", () => {
  const player = mapPerson({
    id: 1077,
    name: "Pedro",
    position: null,
    nationality: null,
    dateOfBirth: null,
    shirtNumber: null,
  });

  assert.deepEqual(player, { id: "1077", name: "Pedro" });
  assert.equal("shirtNumber" in player!, false);
  assert.equal("position" in player!, false);
});

test("a person carries their current club when the upstream names one", () => {
  const player = mapPerson({
    id: 1077,
    name: "Pedro",
    currentTeam: { id: 1783, name: "CR Flamengo", shortName: "Flamengo", tla: "FLA" },
  });

  assert.equal(player?.club?.code, "1783");
  assert.equal(player?.club?.slug, "flamengo");
});

test("a person with no id or no name is not a player", () => {
  assert.equal(mapPerson({ name: "Sem Id" }), null);
  assert.equal(mapPerson({ id: 1 }), null);
  assert.equal(mapPerson({ id: 1, name: "   " }), null);
});

test("a club carries its crest when the upstream supplies one", () => {
  const club = clubFromTeam({
    id: 1783,
    name: "CR Flamengo",
    shortName: "Flamengo",
    crest: "https://crests.football-data.org/1783.png",
  });

  assert.equal(club?.crest, "https://crests.football-data.org/1783.png");
});

test("a club with no crest simply has none", () => {
  const club = clubFromTeam({ id: 1783, name: "CR Flamengo", crest: null });

  assert.equal(club?.crest, undefined);
  assert.equal("crest" in club!, false);
});

test("squads are built from the team list, one request for the whole division", () => {
  const squads = mapSquads({
    teams: [
      {
        id: 1783,
        name: "CR Flamengo",
        shortName: "Flamengo",
        tla: "FLA",
        crest: "https://crests.football-data.org/1783.png",
        squad: [
          { id: 1077, name: "Pedro", position: "Offence", nationality: "Brazil", dateOfBirth: "1997-06-20" },
          { id: 1078, name: "Rossi", position: "Goalkeeper" },
        ],
      },
    ],
  });

  assert.equal(squads.length, 1);
  assert.equal(squads[0].club.shortName, "Flamengo");
  assert.equal(squads[0].club.crest, "https://crests.football-data.org/1783.png");
  assert.deepEqual(
    squads[0].players.map((player) => player.name),
    ["Pedro", "Rossi"],
  );
  assert.equal(squads[0].players[0].position, "Offence");
  assert.equal(squads[0].players[0].dateOfBirth, "1997-06-20");
});

test("a squad member does not restate the club it is nested under", () => {
  // 948 copies of a club object, to say what the enclosing Squad already says,
  // is most of the payload. The page attaches the club when it opens a card.
  const squads = mapSquads({
    teams: [{ id: 1783, name: "CR Flamengo", squad: [{ id: 1077, name: "Pedro" }] }],
  });

  assert.equal(squads[0].club.code, "1783");
  assert.ok(!("club" in squads[0].players[0]));
});

test("fields the provider omits are absent, not blanked", () => {
  const squads = mapSquads({
    teams: [{ id: 1783, name: "CR Flamengo", squad: [{ id: 1077, name: "Pedro", position: null }] }],
  });

  const player = squads[0].players[0];
  assert.ok(!("position" in player));
  assert.ok(!("nationality" in player));
  assert.ok(!("dateOfBirth" in player));
  // Nothing in the division reports one here — the person endpoint does.
  assert.ok(!("shirtNumber" in player));
});

test("a club with no squad is still a club, with an empty one", () => {
  // Dropping it would hide the club rather than the gap.
  const squads = mapSquads({
    teams: [
      { id: 1783, name: "CR Flamengo" },
      { id: 1776, name: "SE Palmeiras", squad: [] },
    ],
  });

  assert.equal(squads.length, 2);
  assert.deepEqual(squads[0].players, []);
  assert.deepEqual(squads[1].players, []);
});

test("a member with no id or no name is dropped, the rest of the squad is not", () => {
  const squads = mapSquads({
    teams: [
      {
        id: 1783,
        name: "CR Flamengo",
        squad: [{ name: "Sem id" }, { id: 9, name: "   " }, { id: 1077, name: "Pedro" }],
      },
    ],
  });

  assert.deepEqual(
    squads[0].players.map((player) => player.name),
    ["Pedro"],
  );
});

test("a team with no name yields nothing rather than a squad with no owner", () => {
  assert.deepEqual(mapSquads({ teams: [{ id: 1783, squad: [{ id: 1, name: "X" }] }] }), []);
  assert.deepEqual(mapSquads({}), []);
});

test("the head coach comes off the team list, whichever field upstream filled in", () => {
  // `name` is what the payload normally carries; the split form is the fallback
  // that keeps a coach on the page rather than dropping one over a null.
  assert.equal(coachName({ name: "Filipe Luís" }), "Filipe Luís");
  assert.equal(coachName({ name: null, firstName: "Abel", lastName: "Ferreira" }), "Abel Ferreira");
  assert.equal(coachName({ firstName: "Dorival", lastName: null }), "Dorival");
  assert.equal(coachName({ name: "  Tite  " }), "Tite");
});

test("a club between coaches has none, rather than an empty name", () => {
  // The page prints nothing where there is nothing; it never renders a dash.
  assert.equal(coachName(undefined), undefined);
  assert.equal(coachName(null), undefined);
  assert.equal(coachName({}), undefined);
  assert.equal(coachName({ name: "   ", firstName: null, lastName: null }), undefined);
});

test("a club carries the coach the teams endpoint names", () => {
  const club = clubFromTeam({
    id: 1783,
    name: "CR Flamengo",
    shortName: "Flamengo",
    tla: "FLA",
    coach: { name: "Filipe Luís" },
  });

  assert.equal(club?.coach, "Filipe Luís");
});

test("a club from a fixture has no coach key at all", () => {
  // Only the teams endpoint reports one. Absent means the key is missing, not
  // present-and-undefined — the same rule the crest follows.
  const club = clubFromTeam({ id: 1783, name: "CR Flamengo", shortName: "Flamengo" });

  assert.equal(club?.coach, undefined);
  assert.equal("coach" in club!, false);
});

test("every elenco carries its club's coach, from the one request", () => {
  // The coach and the squad ride on the same team object, which is why
  // /api/coaches is a projection of this payload rather than a second fetch.
  const squads = mapSquads({
    teams: [
      {
        id: 1783,
        name: "CR Flamengo",
        shortName: "Flamengo",
        coach: { name: "Filipe Luís" },
        squad: [{ id: 1077, name: "Pedro" }],
      },
    ],
  });

  assert.equal(squads[0].club.coach, "Filipe Luís");
});
