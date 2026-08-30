import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ZONES,
  compareRows,
  computeStandings,
  countsTowardStandings,
  pointsPercentage,
  pointsPercentageLabel,
  zoneAt,
} from "@/standings-core";
import type { Club, Match, StandingsRow } from "@/src/types";

const club = (code: string, shortName = code): Club => ({
  code,
  name: `${shortName} FC`,
  shortName,
  state: "SP",
});

const CLUBS = [club("AAA"), club("BBB"), club("CCC")];

const match = (overrides: Partial<Match> & Pick<Match, "homeCode" | "awayCode">): Match => ({
  id: `${overrides.homeCode}-${overrides.awayCode}`,
  round: 1,
  kickoff: "2026-04-11T19:00:00Z",
  status: "FINISHED",
  homeGoals: 0,
  awayGoals: 0,
  ...overrides,
});

test("counts only finished matches carrying both scores", () => {
  assert.equal(countsTowardStandings(match({ homeCode: "AAA", awayCode: "BBB" })), true);
  assert.equal(
    countsTowardStandings(match({ homeCode: "AAA", awayCode: "BBB", status: "SCHEDULED" })),
    false,
  );
  assert.equal(
    countsTowardStandings(
      match({ homeCode: "AAA", awayCode: "BBB", status: "LIVE", homeGoals: 1, awayGoals: 0 }),
    ),
    false,
  );
  assert.equal(
    countsTowardStandings(match({ homeCode: "AAA", awayCode: "BBB", homeGoals: null })),
    false,
  );
});

test("awards three points for a win and one for a draw", () => {
  const table = computeStandings(CLUBS, [
    match({ homeCode: "AAA", awayCode: "BBB", homeGoals: 2, awayGoals: 0 }),
    match({ homeCode: "BBB", awayCode: "CCC", homeGoals: 1, awayGoals: 1 }),
  ]);

  const byCode = new Map(table.map((row) => [row.club.code, row]));
  assert.equal(byCode.get("AAA")?.points, 3);
  assert.equal(byCode.get("BBB")?.points, 1);
  assert.equal(byCode.get("CCC")?.points, 1);
  assert.equal(byCode.get("BBB")?.played, 2);
  assert.equal(byCode.get("AAA")?.goalDifference, 2);
  assert.equal(byCode.get("BBB")?.goalDifference, -2);
});

test("includes clubs with no finished match as zeroed rows", () => {
  const table = computeStandings(CLUBS, []);

  assert.equal(table.length, 3);
  assert.ok(table.every((row) => row.played === 0 && row.points === 0));
  assert.deepEqual(
    table.map((row) => row.position),
    [1, 2, 3],
  );
});

test("ignores fixtures referencing an unknown club", () => {
  const table = computeStandings(CLUBS, [
    match({ homeCode: "AAA", awayCode: "ZZZ", homeGoals: 5, awayGoals: 0 }),
  ]);

  assert.ok(table.every((row) => row.played === 0));
});

test("breaks ties by wins, then goal difference, then goals scored", () => {
  const row = (overrides: Partial<StandingsRow>): StandingsRow => ({
    position: 0,
    club: club("XXX"),
    played: 3,
    wins: 1,
    draws: 0,
    losses: 2,
    goalsFor: 1,
    goalsAgainst: 1,
    goalDifference: 0,
    points: 3,
    ...overrides,
  });

  // Same points, more wins wins.
  assert.ok(compareRows(row({ wins: 2 }), row({ wins: 1 })) < 0);
  // Same points and wins, better goal difference wins.
  assert.ok(compareRows(row({ goalDifference: 4 }), row({ goalDifference: 1 })) < 0);
  // Same points, wins and difference, more goals scored wins.
  assert.ok(compareRows(row({ goalsFor: 9 }), row({ goalsFor: 2 })) < 0);
});

test("orders fully-level clubs by name so the table is deterministic", () => {
  const table = computeStandings([club("ZZZ", "Zebra"), club("AAA", "Abelha")], []);

  assert.deepEqual(
    table.map((row) => row.club.shortName),
    ["Abelha", "Zebra"],
  );
});

test("aproveitamento is the share of points taken of those available", () => {
  // Nine of a possible nine.
  assert.equal(pointsPercentage({ points: 9, played: 3 }), 100);
  // Three wins and three draws out of six: 12 of 18.
  assert.equal(Math.round(pointsPercentage({ points: 12, played: 6 })!), 67);
  assert.equal(pointsPercentage({ points: 0, played: 5 }), 0);
});

test("a club that has played nothing has no aproveitamento, not zero", () => {
  assert.equal(pointsPercentage({ points: 0, played: 0 }), null);
  assert.equal(pointsPercentageLabel({ points: 0, played: 0 }), null);
  // The distinction the null exists for: taken nothing from five is 0%.
  assert.equal(pointsPercentageLabel({ points: 0, played: 5 }), "0%");
});

test("aproveitamento reads a club with a game in hand honestly", () => {
  // Same three wins, one club a postponed fixture short. The points column
  // calls them equal; this one does not.
  const played = { points: 9, played: 4 };
  const short = { points: 9, played: 3 };
  assert.equal(played.points, short.points);
  assert.ok(pointsPercentage(short)! > pointsPercentage(played)!);
});

test("the aproveitamento label is a whole percentage", () => {
  assert.equal(pointsPercentageLabel({ points: 12, played: 6 }), "67%");
  assert.equal(pointsPercentageLabel({ points: 9, played: 3 }), "100%");
  // The tightest non-perfect campaign a 38-round season allows still rounds
  // short of 100, so the rounding cannot claim a club dropped nothing.
  assert.equal(pointsPercentageLabel({ points: 112, played: 38 }), "98%");
});

// ---------------------------------------------------------------- as zonas

const SERIE_A = 20;
const bandOf = (position: number) => zoneAt(position, SERIE_A)?.id;

test("the bands cover the 2026 allocation and nothing else", () => {
  // Eleven continental places, not twelve: one Libertadores berth is held by a
  // cup champion outside the zone, so the pré-Libertadores band is a single
  // position and Sul-Americana stops at 11th. Every boundary asserted from
  // both sides, because an off-by-one at either end is a whole club.
  assert.deepEqual([1, 2, 3, 4].map(bandOf), ["g4", "g4", "g4", "g4"]);
  assert.equal(bandOf(5), "g5");
  assert.deepEqual([6, 11].map(bandOf), ["g11", "g11"]);
  assert.deepEqual([17, 18, 19, 20].map(bandOf), ["z4", "z4", "z4", "z4"]);
});

test("the middle of the table is in no band", () => {
  // 12th to 16th qualify for nothing and go down from nothing. An unpainted
  // row is the honest answer, and `zoneClass` draws it as transparent so the
  // position cells still line up.
  for (const position of [12, 13, 14, 15, 16]) {
    assert.equal(bandOf(position), undefined, `${position}º should be unpainted`);
  }
});

test("relegation is counted in from the end, so a smaller division still works", () => {
  // Z4 is a depth rather than 17-20. In a division of 18 the last four are
  // 15th to 18th, and 17th is not automatically down.
  assert.equal(zoneAt(15, 18)?.id, "z4");
  assert.equal(zoneAt(14, 18)?.id, undefined);
  // And where the two ends overlap, going down wins — the only reason the
  // lookup asks the bottom band first.
  assert.equal(zoneAt(7, 10)?.id, "z4");
});

test("every band the table can paint has a line in the legenda", () => {
  // The rail carries hue and a border style; the prose is the whole of what a
  // grayscale capture or a colourblind reader gets. A band with no entry is a
  // mark on the page nothing explains.
  const painted = new Set(
    Array.from({ length: SERIE_A }, (_, index) => bandOf(index + 1)).filter(Boolean),
  );
  assert.equal(painted.size, ZONES.length);
  for (const zone of ZONES) {
    assert.ok(painted.has(zone.id), `${zone.term} is declared but never painted`);
    assert.ok(zone.where.length > 0, `${zone.term} has no positions in prose`);
    // Words, never ordinals: Z4 is derived from the row count, so "17º ao 20º"
    // would go quietly wrong if the division changed size.
    assert.doesNotMatch(zone.where, /\d/, `${zone.term} spells a position as a digit`);
  }
});

test("the home table counts only matches a club hosted", () => {
  const matches = [
    match({ homeCode: "AAA", awayCode: "BBB", homeGoals: 3, awayGoals: 0 }),
    match({ homeCode: "BBB", awayCode: "AAA", homeGoals: 2, awayGoals: 1 }),
  ];

  const home = computeStandings(CLUBS, matches, "home");
  const aaa = home.find((row) => row.club.code === "AAA")!;
  const bbb = home.find((row) => row.club.code === "BBB")!;

  // AAA hosted once and won it; its away defeat is not in this table at all.
  assert.deepEqual(
    [aaa.played, aaa.wins, aaa.losses, aaa.points, aaa.goalsFor, aaa.goalsAgainst],
    [1, 1, 0, 3, 3, 0],
  );
  assert.deepEqual([bbb.played, bbb.wins, bbb.points], [1, 1, 3]);
});

test("the away table counts only matches a club visited", () => {
  const matches = [
    match({ homeCode: "AAA", awayCode: "BBB", homeGoals: 3, awayGoals: 0 }),
    match({ homeCode: "BBB", awayCode: "AAA", homeGoals: 2, awayGoals: 1 }),
  ];

  const away = computeStandings(CLUBS, matches, "away");
  const aaa = away.find((row) => row.club.code === "AAA")!;

  assert.deepEqual(
    [aaa.played, aaa.wins, aaa.losses, aaa.points, aaa.goalsFor, aaa.goalsAgainst],
    [1, 0, 1, 0, 1, 2],
  );
});

test("the two splits add up to the full table, club by club", () => {
  // The property that makes the three views one answer rather than three: every
  // fixture credits exactly one side in each split, so home + away = all.
  const matches = [
    match({ homeCode: "AAA", awayCode: "BBB", homeGoals: 3, awayGoals: 0 }),
    match({ homeCode: "BBB", awayCode: "AAA", homeGoals: 2, awayGoals: 1 }),
    match({ homeCode: "CCC", awayCode: "AAA", homeGoals: 1, awayGoals: 1 }),
    match({ homeCode: "BBB", awayCode: "CCC", homeGoals: 0, awayGoals: 0 }),
  ];

  const by = (rows: StandingsRow[], code: string) => rows.find((r) => r.club.code === code)!;
  const all = computeStandings(CLUBS, matches);
  const home = computeStandings(CLUBS, matches, "home");
  const away = computeStandings(CLUBS, matches, "away");

  for (const code of ["AAA", "BBB", "CCC"]) {
    for (const key of ["played", "wins", "draws", "losses", "goalsFor", "goalsAgainst", "points"] as const) {
      assert.equal(
        by(home, code)[key] + by(away, code)[key],
        by(all, code)[key],
        `${code}.${key}`,
      );
    }
  }
});

test("a split still refuses a live match, and every club still appears", () => {
  // The split changes which fixtures count, never what counts as played.
  const matches = [
    match({ homeCode: "AAA", awayCode: "BBB", status: "LIVE", homeGoals: 1, awayGoals: 0 }),
  ];

  for (const side of ["all", "home", "away"] as const) {
    const rows = computeStandings(CLUBS, matches, side);
    assert.equal(rows.length, CLUBS.length, side);
    assert.equal(rows.every((row) => row.played === 0), true, side);
  }
});

test("a split is still ordered by the CBF tie-breakers", () => {
  const matches = [
    match({ homeCode: "AAA", awayCode: "BBB", homeGoals: 1, awayGoals: 0 }),
    match({ homeCode: "CCC", awayCode: "AAA", homeGoals: 5, awayGoals: 0 }),
  ];

  const home = computeStandings(CLUBS, matches, "home");

  // CCC and AAA both won at home; CCC's goal difference is larger.
  assert.deepEqual(home.map((row) => row.club.code).slice(0, 2), ["CCC", "AAA"]);
  assert.deepEqual(home.map((row) => row.position), [1, 2, 3]);
});
