import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeRankHistory,
  describeCampaign,
  lastRecordedRound,
  lastRoundWithResult,
  positionAfterRound,
  sparklinePoints,
  sparklinePolyline,
} from "@/rank-history-core";
import { computeStandings } from "@/standings-core";
import type { Club, Match } from "@/src/types";

const club = (code: string, shortName = code): Club => ({
  code,
  name: `${shortName} FC`,
  shortName,
  state: "SP",
});

const CLUBS = [club("AAA"), club("BBB"), club("CCC"), club("DDD")];

const match = (
  overrides: Partial<Match> & Pick<Match, "homeCode" | "awayCode" | "round">,
): Match => ({
  id: `r${overrides.round}-${overrides.homeCode}-${overrides.awayCode}`,
  kickoff: "2026-04-11T19:00:00Z",
  status: "FINISHED",
  homeGoals: 0,
  awayGoals: 0,
  ...overrides,
});

/** AAA wins both rounds; BBB wins round 1 then loses; CCC/DDD trail. */
const SEASON: Match[] = [
  match({ round: 1, homeCode: "AAA", awayCode: "CCC", homeGoals: 1, awayGoals: 0 }),
  match({ round: 1, homeCode: "BBB", awayCode: "DDD", homeGoals: 3, awayGoals: 0 }),
  match({ round: 2, homeCode: "AAA", awayCode: "BBB", homeGoals: 2, awayGoals: 0 }),
  match({ round: 2, homeCode: "CCC", awayCode: "DDD", homeGoals: 1, awayGoals: 0 }),
];

const historyFor = (code: string, matches = SEASON) => {
  const found = computeRankHistory(CLUBS, matches).find((entry) => entry.clubCode === code);
  assert.ok(found, `no history for ${code}`);
  return found;
};

test("reports the last round that produced a result", () => {
  assert.equal(lastRoundWithResult(SEASON), 2);
  assert.equal(lastRoundWithResult([]), null);
  assert.equal(
    lastRoundWithResult([
      match({ round: 7, homeCode: "AAA", awayCode: "BBB", status: "SCHEDULED", homeGoals: null, awayGoals: null }),
    ]),
    null,
  );
});

test("records a position for every club at every played round", () => {
  const history = computeRankHistory(CLUBS, SEASON);

  assert.equal(history.length, CLUBS.length);
  for (const club of history) {
    assert.deepEqual(
      club.entries.map((entry) => entry.round),
      [1, 2],
    );
  }
});

test("tracks a club rising and another falling across rounds", () => {
  // Round 1: BBB leads on goal difference (+3), AAA second (+1).
  // Round 2: AAA beats BBB, so AAA leads on points and BBB drops.
  assert.deepEqual(
    historyFor("BBB").entries.map((entry) => entry.position),
    [1, 2],
  );
  assert.deepEqual(
    historyFor("AAA").entries.map((entry) => entry.position),
    [2, 1],
  );
  assert.deepEqual(
    historyFor("AAA").entries.map((entry) => entry.points),
    [3, 6],
  );
});

test("stops at the last played round rather than padding the season", () => {
  const withFuture = [
    ...SEASON,
    match({ round: 3, homeCode: "AAA", awayCode: "DDD", status: "SCHEDULED", homeGoals: null, awayGoals: null }),
  ];

  assert.deepEqual(
    historyFor("AAA", withFuture).entries.map((entry) => entry.round),
    [1, 2],
  );
});

test("a club whose fixture was postponed carries fewer played than its rivals", () => {
  const postponed = [
    SEASON[0],
    match({ round: 1, homeCode: "BBB", awayCode: "DDD", status: "POSTPONED", homeGoals: null, awayGoals: null }),
  ];

  assert.equal(historyFor("AAA", postponed).entries[0].played, 1);
  assert.equal(historyFor("BBB", postponed).entries[0].played, 0);
});

test("includes clubs with no result yet, ranked below those with points", () => {
  const openingRound = [SEASON[0]];
  const history = computeRankHistory(CLUBS, openingRound);

  assert.equal(history.length, CLUBS.length);
  assert.equal(historyFor("AAA", openingRound).entries[0].position, 1);
  assert.equal(historyFor("BBB", openingRound).entries[0].points, 0);
  assert.equal(historyFor("BBB", openingRound).entries[0].played, 0);
});

test("returns an empty campaign when nothing has been played", () => {
  const history = computeRankHistory(CLUBS, []);

  assert.equal(history.length, CLUBS.length);
  for (const club of history) assert.deepEqual(club.entries, []);
});

test("the final round agrees with the table computed directly", () => {
  const table = computeStandings(CLUBS, SEASON);
  const history = computeRankHistory(CLUBS, SEASON);

  for (const row of table) {
    const last = history.find((entry) => entry.clubCode === row.club.code)?.entries.at(-1);
    assert.equal(last?.position, row.position, `${row.club.shortName} position`);
    assert.equal(last?.points, row.points, `${row.club.shortName} points`);
  }
});

test("a round outside the history has no position rather than the nearest one", () => {
  const history = historyFor("AAA");

  assert.equal(positionAfterRound(history, 2), 1);
  assert.equal(positionAfterRound(history, 38), null);
  assert.equal(positionAfterRound(history, 0), null);
});

const BOX = { width: 72, height: 20, padding: 2, clubCount: 20, lastRound: 24 };

const entry = (round: number, position: number) => ({ round, position, points: 0, played: round });

test("position 1 is drawn at the top and last place at the bottom", () => {
  // The inversion is the whole correctness of the mark: a line that climbs has
  // to mean a club that climbed.
  const [top, bottom] = sparklinePoints([entry(1, 1), entry(24, 20)], BOX);

  assert.equal(top.y, BOX.padding);
  assert.equal(bottom.y, BOX.height - BOX.padding);
  assert.ok(top.y < bottom.y, "1st must sit above 20th");
});

test("the round axis spans the full box, first round to last", () => {
  const [first, last] = sparklinePoints([entry(1, 10), entry(24, 10)], BOX);

  assert.equal(first.x, BOX.padding);
  assert.equal(last.x, BOX.width - BOX.padding);
  assert.equal(first.y, last.y, "an unchanged position must draw flat");
});

test("every club shares one scale, so amplitudes compare across rows", () => {
  // A club oscillating 1st-3rd must not be drawn as dramatically as one
  // climbing 20th to 5th — that is the small-multiples trap.
  const steady = sparklinePoints([entry(1, 1), entry(24, 3)], BOX);
  const climber = sparklinePoints([entry(1, 20), entry(24, 5)], BOX);

  const span = (points: ReturnType<typeof sparklinePoints>) =>
    Math.abs(points[0].y - points[1].y);

  assert.ok(span(climber) > span(steady) * 5, "shared scale flattens the steady club");
});

test("a half-played season stops mid-box rather than stretching to fill it", () => {
  const points = sparklinePoints([entry(1, 4), entry(12, 4)], { ...BOX, lastRound: 24 });

  assert.equal(points[1].x, 34.52); // 2 + (11/23) × 68
  assert.ok(points[1].x < BOX.width - BOX.padding);
});

test("degenerate domains produce a point, not NaN", () => {
  // An SVG with a malformed points attribute draws nothing at all, so this
  // fails silently in the browser.
  const single = sparklinePoints([entry(1, 1)], { ...BOX, lastRound: 1 });
  const oneClub = sparklinePoints([entry(1, 1)], { ...BOX, clubCount: 1 });

  for (const point of [...single, ...oneClub]) {
    assert.ok(Number.isFinite(point.x), `x is ${point.x}`);
    assert.ok(Number.isFinite(point.y), `y is ${point.y}`);
  }
});

test("an empty campaign draws no polyline at all", () => {
  assert.deepEqual(sparklinePoints([], BOX), []);
  assert.equal(sparklinePolyline([]), "");
});

test("the polyline reads as SVG point pairs", () => {
  assert.equal(sparklinePolyline(sparklinePoints([entry(1, 1), entry(24, 20)], BOX)), "2,2 70,18");
});

test("the campaign is stated in words, not only drawn", () => {
  assert.equal(
    describeCampaign([entry(1, 20), entry(24, 5)]),
    "Campanha: 20º na 1ª rodada, 5º na 24ª rodada",
  );
  assert.equal(
    describeCampaign([entry(1, 8), entry(12, 2), entry(24, 6)]),
    "Campanha: 8º na 1ª rodada, 6º na 24ª rodada. Melhor: 2º na 12ª rodada",
  );
  assert.equal(describeCampaign([]), "Campanha ainda não disponível");
});

test("the shared x domain is the furthest round anyone has reached", () => {
  // A club with a game in hand has a shorter campanha. Scaling it to its own
  // last round would draw it on a different axis from every other club.
  const history = [
    { clubCode: "AAA", shortName: "AAA", entries: [entry(1, 1), entry(2, 1)] },
    { clubCode: "BBB", shortName: "BBB", entries: [entry(1, 2), entry(2, 2), entry(3, 2)] },
  ];

  assert.equal(lastRecordedRound(history), 3);
});

test("nothing played yet gives a zero domain rather than a negative one", () => {
  assert.equal(lastRecordedRound([]), 0);
  assert.equal(lastRecordedRound([{ clubCode: "AAA", shortName: "AAA", entries: [] }]), 0);
});
