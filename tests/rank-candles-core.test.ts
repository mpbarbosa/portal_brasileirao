import assert from "node:assert/strict";
import { test } from "node:test";

import {
  candleShapes,
  candlesFor,
  computeRankCandles,
  describeCandle,
  describeCandles,
  placesMoved,
  summariseCandles,
  zoneGuides,
  type CandleBox,
} from "@/rank-candles-core";
import { computeRankHistory } from "@/rank-history-core";
import type { Club, Match, RoundCandle } from "@/src/types";

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

/**
 * Two rounds, and — the part that matters here — **two kickoff slots per
 * round**, so a round has an inside for the pavio to describe.
 */
const SEASON: Match[] = [
  match({ round: 1, homeCode: "AAA", awayCode: "CCC", homeGoals: 1, awayGoals: 0, kickoff: "2026-04-11T19:00:00Z" }),
  match({ round: 1, homeCode: "BBB", awayCode: "DDD", homeGoals: 3, awayGoals: 0, kickoff: "2026-04-12T19:00:00Z" }),
  match({ round: 2, homeCode: "AAA", awayCode: "BBB", homeGoals: 2, awayGoals: 0, kickoff: "2026-04-18T19:00:00Z" }),
  match({ round: 2, homeCode: "CCC", awayCode: "DDD", homeGoals: 1, awayGoals: 0, kickoff: "2026-04-19T19:00:00Z" }),
];

const candlesOf = (code: string, matches = SEASON, clubs = CLUBS): RoundCandle[] =>
  candlesFor(computeRankCandles(clubs, matches), code);

const at = (code: string, round: number, matches = SEASON): RoundCandle => {
  const found = candlesOf(code, matches).find((candle) => candle.round === round);
  assert.ok(found, `no candle for ${code} at round ${round}`);
  return found;
};

test("every club gets a candle for every round that produced a result", () => {
  const all = computeRankCandles(CLUBS, SEASON);

  assert.equal(all.length, CLUBS.length);
  for (const entry of all) {
    assert.deepEqual(
      entry.candles.map((candle) => candle.round),
      [1, 2],
      `${entry.clubCode} is missing a round`,
    );
  }
  assert.equal(all[0].shortName, "AAA");
});

test("nothing played is no candles at all — an absence, not a row of zeroes", () => {
  const scheduled = SEASON.map((fixture) => ({
    ...fixture,
    status: "SCHEDULED" as const,
    homeGoals: null,
    awayGoals: null,
  }));

  for (const entry of computeRankCandles(CLUBS, scheduled)) {
    assert.deepEqual(entry.candles, []);
  }
});

test("round 1 opens where it closes: there is no table before a ball is kicked", () => {
  for (const code of ["AAA", "BBB", "CCC", "DDD"]) {
    const first = at(code, 1);
    assert.equal(first.open, first.close, `${code} drew a body in round 1`);
  }
});

test("a round opens exactly where the previous one closed", () => {
  for (const code of ["AAA", "BBB", "CCC", "DDD"]) {
    const candles = candlesOf(code);
    for (let index = 1; index < candles.length; index += 1) {
      assert.equal(candles[index].open, candles[index - 1].close);
    }
  }
});

/**
 * The property that keeps the painel and the classificação from disagreeing:
 * the close is the campanha's own position, not a second computation of it.
 */
test("every close is the position the campanha records for that round", () => {
  const history = computeRankHistory(CLUBS, SEASON);

  for (const entry of history) {
    const candles = candlesOf(entry.clubCode);
    assert.equal(candles.length, entry.entries.length);

    for (const point of entry.entries) {
      const candle = candles.find((item) => item.round === point.round);
      assert.ok(candle);
      assert.equal(candle.close, point.position, `${entry.clubCode} round ${point.round}`);
      assert.equal(candle.totalPoints, point.points);
      assert.equal(candle.played, point.played);
    }
  }
});

/**
 * The whole reason this module exists. DDD is beaten in round 1's late slot,
 * but before that match kicked off it sat above the two clubs that had already
 * lost — a position no end-of-round reading can show.
 */
test("the pavio reaches a position held only inside the round", () => {
  const ddd = at("DDD", 1);

  assert.equal(ddd.close, 4, "DDD finishes round 1 last");
  assert.ok(ddd.best < ddd.close, "DDD stood higher before its own match");
  assert.ok(ddd.best <= Math.min(ddd.open, ddd.close));
  assert.ok(ddd.worst >= Math.max(ddd.open, ddd.close));
});

test("the pavio always contains the body", () => {
  for (const code of ["AAA", "BBB", "CCC", "DDD"]) {
    for (const candle of candlesOf(code)) {
      assert.ok(candle.best <= Math.min(candle.open, candle.close));
      assert.ok(candle.worst >= Math.max(candle.open, candle.close));
    }
  }
});

test("points and result report the round, not the season", () => {
  const bbb1 = at("BBB", 1);
  assert.equal(bbb1.result, "V");
  assert.equal(bbb1.points, 3);
  assert.equal(bbb1.totalPoints, 3);

  const bbb2 = at("BBB", 2);
  assert.equal(bbb2.result, "D");
  assert.equal(bbb2.points, 0);
  assert.equal(bbb2.totalPoints, 3, "the total carries, the round's points do not");
});

test("a draw is a point, and reads as one", () => {
  const drawn = [
    match({ round: 1, homeCode: "AAA", awayCode: "BBB", homeGoals: 1, awayGoals: 1 }),
    match({ round: 1, homeCode: "CCC", awayCode: "DDD", homeGoals: 2, awayGoals: 0 }),
  ];

  const aaa = at("AAA", 1, drawn);
  assert.equal(aaa.result, "E");
  assert.equal(aaa.points, 1);
});

/**
 * A club whose fixture was postponed has **no** points for that round rather
 * than zero — the distinction `pointsPercentage` already makes for a club with
 * no games, and the one that keeps a red candle from being drawn for a match
 * nobody played.
 */
test("a round the club did not play has no points and no result", () => {
  const postponed: Match[] = [
    match({ round: 1, homeCode: "AAA", awayCode: "CCC", homeGoals: 1, awayGoals: 0 }),
    match({
      round: 1,
      homeCode: "BBB",
      awayCode: "DDD",
      status: "POSTPONED",
      homeGoals: null,
      awayGoals: null,
    }),
  ];

  const bbb = at("BBB", 1, postponed);
  assert.equal(bbb.points, null);
  assert.equal(bbb.result, null);
  assert.equal(bbb.open, bbb.close, "a club that did not play did not move on its own account");
});

/**
 * A round whose fixtures were all postponed still gets a candle, flat: the
 * round happened, the club simply did not play in it. A gap in the row would
 * read as a rendering fault.
 */
test("a round with no result at all is flat rather than missing", () => {
  const withGap: Match[] = [
    match({ round: 1, homeCode: "AAA", awayCode: "BBB", homeGoals: 1, awayGoals: 0 }),
    match({ round: 1, homeCode: "CCC", awayCode: "DDD", homeGoals: 1, awayGoals: 0 }),
    match({
      round: 2,
      homeCode: "AAA",
      awayCode: "CCC",
      status: "POSTPONED",
      homeGoals: null,
      awayGoals: null,
    }),
    match({
      round: 2,
      homeCode: "BBB",
      awayCode: "DDD",
      status: "POSTPONED",
      homeGoals: null,
      awayGoals: null,
    }),
    match({ round: 3, homeCode: "AAA", awayCode: "DDD", homeGoals: 1, awayGoals: 0 }),
    match({ round: 3, homeCode: "BBB", awayCode: "CCC", homeGoals: 1, awayGoals: 0 }),
  ];

  const empty = at("AAA", 2, withGap);
  assert.equal(empty.open, empty.close);
  assert.equal(empty.best, empty.close);
  assert.equal(empty.worst, empty.close);
  assert.equal(empty.points, null);
  assert.equal(empty.result, null);
  assert.equal(at("AAA", 3, withGap).open, empty.close, "round 3 still opens where 2 closed");
});

/**
 * The trap the round convention exists to close, and the one a kickoff-only
 * filter fails: a round-1 fixture played *after* round 2 must not drop out of
 * round 2's partial tables. It is already counted in round 2's open, so
 * removing it would draw a swing that never happened.
 */
test("a fixture played out of order draws no phantom swing", () => {
  const outOfOrder: Match[] = [
    match({ round: 1, homeCode: "AAA", awayCode: "BBB", homeGoals: 3, awayGoals: 0, kickoff: "2026-04-11T19:00:00Z" }),
    // Round 1, played a month late — after every round-2 fixture.
    match({ round: 1, homeCode: "CCC", awayCode: "DDD", homeGoals: 5, awayGoals: 0, kickoff: "2026-05-20T19:00:00Z" }),
    match({ round: 2, homeCode: "AAA", awayCode: "CCC", homeGoals: 1, awayGoals: 0, kickoff: "2026-04-18T19:00:00Z" }),
    match({ round: 2, homeCode: "BBB", awayCode: "DDD", homeGoals: 1, awayGoals: 0, kickoff: "2026-04-19T19:00:00Z" }),
  ];

  // Asserted as **absolute positions**, not against this candle's own open and
  // close. Written the relative way — `best === Math.min(open, close)` — the
  // test passes against the very bug it names: a wall-clock filter moves the
  // close too, so the phantom stays inside a window that moved with it.
  // Confirmed by mutating the filter and watching this go red.
  const ccc = at("CCC", 2, outOfOrder);
  assert.equal(ccc.open, 1, "CCC opens round 2 carrying its late round-1 win");
  assert.equal(ccc.close, 2);
  assert.equal(ccc.best, 1);
  assert.equal(ccc.worst, 2, "3rd is the phantom a wall-clock filter invents");

  // And the closes still are the campanha's own positions on this fixture,
  // which is the property the round convention exists to preserve.
  const campaign = computeRankHistory(CLUBS, outOfOrder).find((e) => e.clubCode === "CCC");
  assert.deepEqual(
    candlesOf("CCC", outOfOrder).map((candle) => candle.close),
    campaign?.entries.map((entry) => entry.position),
  );
});

test("placesMoved is positive for a climb, whichever way the numbers run", () => {
  assert.equal(placesMoved({ open: 9, close: 4 } as RoundCandle), 5);
  assert.equal(placesMoved({ open: 4, close: 9 } as RoundCandle), -5);
  assert.equal(placesMoved({ open: 4, close: 4 } as RoundCandle), 0);
});

test("candlesFor answers an empty series for a club it does not hold", () => {
  assert.deepEqual(candlesFor(computeRankCandles(CLUBS, SEASON), "ZZZ"), []);
});

// --- geometry -------------------------------------------------------------

const BOX: CandleBox = { width: 720, height: 300, padding: 6, clubCount: 20, lastRound: 38 };

const candle = (overrides: Partial<RoundCandle>): RoundCandle => ({
  round: 1,
  open: 5,
  close: 5,
  best: 5,
  worst: 5,
  points: 3,
  totalPoints: 3,
  played: 1,
  result: "V",
  ...overrides,
});

test("a round where nothing moved is still one band tall, never zero", () => {
  const [shape] = candleShapes([candle({})], BOX);

  assert.equal(shape.body.height, 300 / 20);
  assert.ok(shape.body.height > 0, "a zero-height body reads as missing data");
});

test("the body spans whole bands, from the better position to the worse", () => {
  const [shape] = candleShapes([candle({ open: 4, close: 6, best: 4, worst: 6 })], BOX);
  const row = 300 / 20;

  assert.equal(shape.body.y, 3 * row, "the top edge of 4th");
  assert.equal(shape.body.y + shape.body.height, 6 * row, "the bottom edge of 6th");
});

test("the body is drawn the same whichever way the round ran", () => {
  const [up] = candleShapes([candle({ open: 8, close: 3, best: 3, worst: 8 })], BOX);
  const [down] = candleShapes([candle({ open: 3, close: 8, best: 3, worst: 8 })], BOX);

  assert.deepEqual(up.body, down.body, "direction is the stub's job, not the body's");
  assert.notEqual(up.openTick.y, down.openTick.y, "…and the stub does say which is which");
});

test("the pavio covers the body and is narrower than it", () => {
  const [shape] = candleShapes([candle({ open: 5, close: 6, best: 2, worst: 9 })], BOX);
  const row = 300 / 20;

  assert.equal(shape.wick.y, 1 * row, "the top edge of 2nd");
  assert.equal(shape.wick.y + shape.wick.height, 9 * row, "the bottom edge of 9th");
  assert.ok(shape.wick.y <= shape.body.y);
  assert.ok(shape.wick.y + shape.wick.height >= shape.body.y + shape.body.height);
  assert.ok(shape.wick.width < shape.body.width);
  assert.ok(
    shape.wick.x > shape.body.x && shape.wick.x + shape.wick.width < shape.body.x + shape.body.width,
    "the pavio is centred inside the body",
  );
});

test("the stub sits inside the band the round opened in, and to the left of the body", () => {
  const [shape] = candleShapes([candle({ open: 12, close: 3, best: 3, worst: 12 })], BOX);
  const row = 300 / 20;
  const centre = shape.openTick.y + shape.openTick.height / 2;

  assert.ok(centre > 11 * row && centre < 12 * row, "12th place's own band");
  assert.equal(shape.openTick.x + shape.openTick.width, shape.body.x);
});

test("rounds are laid out left to right, one band each", () => {
  const shapes = candleShapes(
    [candle({ round: 1 }), candle({ round: 2 }), candle({ round: 38 })],
    BOX,
  );

  assert.ok(shapes[0].body.x < shapes[1].body.x);
  assert.ok(shapes[1].body.x < shapes[2].body.x);
  assert.ok(shapes[0].body.x >= BOX.padding, "the first candle clears the inset");
  assert.ok(
    shapes[2].body.x + shapes[2].body.width <= BOX.width - BOX.padding,
    "the last candle clears the other one",
  );
});

test("a whole season of candles still draws marks wide enough to see", () => {
  const season = Array.from({ length: 38 }, (_, index) => candle({ round: index + 1 }));

  for (const shape of candleShapes(season, BOX)) {
    assert.ok(shape.body.width >= 1);
    assert.ok(shape.wick.width >= 0.75);
    assert.ok(shape.openTick.height >= 0.75);
  }
});

test("degenerate domains do not divide by zero", () => {
  const [shape] = candleShapes(
    [candle({})],
    { ...BOX, clubCount: 0, lastRound: 0 },
  );

  for (const value of [shape.body.x, shape.body.y, shape.body.width, shape.body.height]) {
    assert.ok(Number.isFinite(value), "an NaN here draws nothing and reports nothing");
  }
});

test("the zone lines come from the competition's own depth", () => {
  const guides = zoneGuides(BOX);
  const row = 300 / 20;

  assert.equal(guides.g4, 4 * row, "under 4th");
  assert.equal(guides.z4, 16 * row, "over 17th");
});

test("a division too small for two zones draws only the one", () => {
  assert.equal(zoneGuides({ ...BOX, clubCount: 6 }).z4, null);
});

// --- summary and words ----------------------------------------------------

test("the summary scans the pavios, not the closes", () => {
  const summary = summariseCandles([
    candle({ round: 1, open: 5, close: 5, best: 5, worst: 5 }),
    candle({ round: 2, open: 5, close: 6, best: 2, worst: 9 }),
  ]);

  assert.ok(summary);
  assert.deepEqual(summary.best, { position: 2, round: 2 });
  assert.deepEqual(summary.worst, { position: 9, round: 2 });
});

test("a repeated best resolves to the round it was first reached", () => {
  const summary = summariseCandles([
    candle({ round: 1, open: 3, close: 3, best: 3, worst: 3 }),
    candle({ round: 2, open: 3, close: 3, best: 3, worst: 3 }),
  ]);

  assert.equal(summary?.best.round, 1);
});

test("the sharpest climb and fall are reported with their rounds", () => {
  const summary = summariseCandles([
    candle({ round: 1, open: 10, close: 10, best: 10, worst: 10 }),
    candle({ round: 2, open: 10, close: 4, best: 4, worst: 10 }),
    candle({ round: 3, open: 4, close: 7, best: 4, worst: 7 }),
    candle({ round: 4, open: 7, close: 6, best: 6, worst: 7, totalPoints: 9 }),
  ]);

  assert.deepEqual(summary?.rise, { places: 6, round: 2 });
  assert.deepEqual(summary?.fall, { places: 3, round: 3 });
  assert.equal(summary?.points, 9, "points are read off the last round");
  assert.equal(summary?.rounds, 4);
});

test("a club that never fell reports no fall rather than a zero", () => {
  const summary = summariseCandles([
    candle({ round: 1, open: 4, close: 4, best: 4, worst: 4 }),
    candle({ round: 2, open: 4, close: 2, best: 2, worst: 4 }),
  ]);

  assert.equal(summary?.fall, null);
  assert.deepEqual(summary?.rise, { places: 2, round: 2 });
});

test("an empty season has no summary", () => {
  assert.equal(summariseCandles([]), null);
});

test("a candle says where it went, and only mentions the pavio when it adds something", () => {
  const plain = describeCandle(candle({ round: 7, open: 5, close: 3, best: 3, worst: 5 }));
  assert.match(plain, /7ª rodada: 5º → 3º, subiu 2 posições/);
  assert.match(plain, /vitória \(3 pontos\)/);
  assert.doesNotMatch(plain, /chegou a/, "the ends already say it");

  const swung = describeCandle(
    candle({ round: 8, open: 5, close: 5, best: 2, worst: 9, result: "E", points: 1 }),
  );
  assert.match(swung, /manteve a posição/);
  assert.match(swung, /chegou a 2º/);
  assert.match(swung, /caiu até 9º/);
  assert.match(swung, /empate \(1 ponto\)/);
});

test("a round the club did not play says so", () => {
  const idle = describeCandle(candle({ round: 9, points: null, result: null }));
  assert.match(idle, /sem jogo na rodada/);
});

test("one position is singular", () => {
  assert.match(describeCandle(candle({ open: 5, close: 4, best: 4, worst: 5 })), /subiu 1 posição/);
  assert.match(describeCandle(candle({ open: 4, close: 5, best: 4, worst: 5 })), /caiu 1 posição/);
});

test("the whole painel is summarised in words for a reader who cannot see it", () => {
  const label = describeCandles(candlesOf("AAA"));

  assert.match(label, /2 rodadas/);
  assert.match(label, /6 pontos/);
  assert.match(label, /Melhor:/);
  assert.match(label, /Pior:/);
});

test("a season with nothing in it says so rather than drawing a blank", () => {
  assert.equal(describeCandles([]), "Campanha ainda não disponível");
});
