import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clubProfile,
  finishes,
  markerFraction,
  medianFraction,
  rankLabel,
  valueLabel,
} from "@/scouts-core";
import { CLUB_SCOUTS } from "@/src/data/club-scouts";
import { CLUBS } from "@/src/data/clubs";
import type { ClubScouts } from "@/src/types";

const scouts = (clubCode: string, over: Partial<ClubScouts> = {}): ClubScouts => ({
  clubCode,
  matches: 10,
  goals: 10,
  shotsSaved: 20,
  shotsOff: 60,
  shotsWoodwork: 10,
  tackles: 100,
  foulsCommitted: 100,
  yellowCards: 20,
  redCards: 0,
  saves: 30,
  ...over,
});

test("a goal is a finalização, so conversão cannot exceed 100%", () => {
  // The trap this guards: the source stops counting a shot once it is a goal,
  // so a total of the three shot columns alone omits every goal — and a club
  // that scored more than it missed would convert above 100%.
  const entry = scouts("AAA", { goals: 8, shotsSaved: 1, shotsOff: 1, shotsWoodwork: 0 });
  assert.equal(finishes(entry), 10);

  const [, conversion] = clubProfile([entry], "AAA");
  assert.equal(conversion?.id, "conversion");
  assert.equal(conversion?.value, 80);
});

test("rates divide by the counters' own matches, never by a live played count", () => {
  const [finalizacoes] = clubProfile([scouts("AAA", { matches: 20 })], "AAA");
  // 100 finalizações over 20 matches, not over whatever the table says today.
  assert.equal(finalizacoes?.value, 5);
});

test("a club with no matches counted has no perfil at all", () => {
  assert.deepEqual(clubProfile([scouts("AAA", { matches: 0 })], "AAA"), []);
});

test("a club absent from the division has no perfil", () => {
  assert.deepEqual(clubProfile([scouts("AAA")], "ZZZ"), []);
});

test("a club that has taken no shot has no conversão, and keeps every other row", () => {
  // 0/0 is an absence rather than 0%, which would rank a club that has not shot
  // below one that has shot and missed.
  const entry = scouts("AAA", { goals: 0, shotsSaved: 0, shotsOff: 0, shotsWoodwork: 0 });
  const rows = clubProfile([entry], "AAA");
  assert.equal(rows.some((row) => row.id === "conversion"), false);
  assert.equal(rows.some((row) => row.id === "tackles"), true);
});

test("rank counts clubs strictly above, so a tie shares a place", () => {
  const division = [
    scouts("AAA", { tackles: 300 }),
    scouts("BBB", { tackles: 200 }),
    scouts("CCC", { tackles: 200 }),
    scouts("DDD", { tackles: 100 }),
  ];
  const rankOf = (code: string) =>
    clubProfile(division, code).find((row) => row.id === "tackles")?.rank;

  assert.equal(rankOf("AAA"), 1);
  assert.equal(rankOf("BBB"), 2);
  assert.equal(rankOf("CCC"), 2);
  // The place after a two-way tie is 4th, the way a league table reads one.
  assert.equal(rankOf("DDD"), 4);
});

test("a club yet to play is left out of the ranking rather than sorted last", () => {
  const division = [scouts("AAA"), scouts("BBB"), scouts("ZZZ", { matches: 0 })];
  const row = clubProfile(division, "AAA").find((entry) => entry.id === "tackles");
  assert.equal(row?.of, 2);
});

test("the marker runs from the division's floor to its ceiling, not from zero", () => {
  // The measured reason: from zero these values crowd the top of the track and
  // twenty clubs look alike. A marker is a position, so it owes no zero.
  const division = [
    scouts("AAA", { tackles: 100 }),
    scouts("BBB", { tackles: 150 }),
    scouts("CCC", { tackles: 200 }),
  ];
  const at = (code: string) =>
    markerFraction(clubProfile(division, code).find((row) => row.id === "tackles")!);

  assert.equal(at("AAA"), 0);
  assert.equal(at("BBB"), 0.5);
  assert.equal(at("CCC"), 1);
});

test("a division level on a metric puts every marker mid-track, claiming no leader", () => {
  const division = [scouts("AAA"), scouts("BBB")];
  const row = clubProfile(division, "AAA").find((entry) => entry.id === "tackles")!;
  assert.equal(markerFraction(row), 0.5);
  assert.equal(medianFraction(row), 0.5);
});

test("the median is the middle of an even division, not one of its halves", () => {
  const division = [
    scouts("AAA", { tackles: 100 }),
    scouts("BBB", { tackles: 200 }),
    scouts("CCC", { tackles: 300 }),
    scouts("DDD", { tackles: 400 }),
  ];
  const row = clubProfile(division, "AAA").find((entry) => entry.id === "tackles")!;
  // 10, 20, 30 and 40 per match, so the median is 25 rather than either middle
  // club's own 20 or 30 — and 25 is halfway from 10 to 40.
  assert.equal(row.median, 25);
  assert.equal(medianFraction(row), 0.5);
});

test("labels are pt-BR: a decimal comma for a rate, no decimal for a percentage", () => {
  const division = [scouts("AAA", { matches: 3, tackles: 40 })];
  const rows = clubProfile(division, "AAA");
  assert.equal(valueLabel(rows.find((row) => row.id === "tackles")!), "13,3");
  assert.equal(valueLabel(rows.find((row) => row.id === "conversion")!), "10%");
});

test("rankLabel names the division it ranked within", () => {
  const division = [scouts("AAA"), scouts("BBB"), scouts("CCC")];
  const row = clubProfile(division, "AAA").find((entry) => entry.id === "tackles")!;
  assert.equal(rankLabel(row), `${row.rank}º de 3`);
});

/* ------------------------------------------------------- the committed data */

test("every club in the division has counters, and they name real clubs", () => {
  // Asserting the *data*, the way `player-photos.test.ts` does: the compiler is
  // satisfied by an empty list, which renders as a Painel with no Perfil.
  assert.equal(CLUB_SCOUTS.length, CLUBS.length);

  const codes = new Set(CLUBS.map((club) => club.code));
  for (const entry of CLUB_SCOUTS) {
    assert.ok(codes.has(entry.clubCode), `${entry.clubCode} is not a club in this division`);
    assert.ok(entry.matches > 0, `${entry.clubCode} covers no match`);
  }
  assert.equal(new Set(CLUB_SCOUTS.map((entry) => entry.clubCode)).size, CLUBS.length);
});

test("every club's perfil renders six rows within footballing bounds", () => {
  // A band rather than a value, so this cannot go red on a routine sync: it
  // catches a column that has moved, which is the failure that writes numbers
  // instead of throwing.
  for (const club of CLUBS) {
    const rows = clubProfile(CLUB_SCOUTS, club.code);
    assert.equal(rows.length, 6, `${club.shortName} has ${rows.length} rows`);

    const value = (id: string) => rows.find((row) => row.id === id)?.value ?? NaN;
    assert.ok(value("finishes") > 3 && value("finishes") < 30, club.shortName);
    assert.ok(value("conversion") > 2 && value("conversion") < 40, club.shortName);
    assert.ok(value("tackles") > 3 && value("tackles") < 40, club.shortName);
    assert.ok(value("cards") > 0 && value("cards") < 10, club.shortName);
  }
});

test("each metric ranks all twenty clubs, and somebody is first", () => {
  for (const id of ["finishes", "conversion", "tackles", "fouls", "cards", "saves"]) {
    const ranks = CLUBS.map(
      (club) => clubProfile(CLUB_SCOUTS, club.code).find((row) => row.id === id)?.rank,
    );
    assert.equal(ranks.filter((rank) => rank === 1).length >= 1, true, `${id} has no leader`);
    for (const rank of ranks) {
      assert.ok(rank && rank >= 1 && rank <= CLUBS.length, `${id} rank ${rank} is out of range`);
    }
  }
});
