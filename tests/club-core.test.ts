import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clubMatches,
  lastFixture,
  nextFixture,
  playsIn,
  recentForm,
  resultFor,
  scorersFor,
  standingFor,
} from "@/club-core";
import type { Match, Scorer, StandingsRow } from "@/src/types";

const match = (overrides: Partial<Match> & Pick<Match, "id">): Match => ({
  round: 1,
  kickoff: "2026-04-11T19:00:00Z",
  status: "FINISHED",
  homeCode: "A",
  awayCode: "B",
  homeGoals: 0,
  awayGoals: 0,
  ...overrides,
});

test("a club is in a match whether it plays home or away", () => {
  assert.equal(playsIn(match({ id: "m" }), "A"), true);
  assert.equal(playsIn(match({ id: "m" }), "B"), true);
  assert.equal(playsIn(match({ id: "m" }), "C"), false);
});

test("results are read from the club's point of view", () => {
  const home = match({ id: "m", homeGoals: 2, awayGoals: 1 });

  assert.equal(resultFor(home, "A"), "V");
  assert.equal(resultFor(home, "B"), "D");
  assert.equal(resultFor(match({ id: "d", homeGoals: 1, awayGoals: 1 }), "A"), "E");
});

test("an unfinished match has no result", () => {
  assert.equal(resultFor(match({ id: "s", status: "SCHEDULED", homeGoals: null }), "A"), null);
  assert.equal(
    resultFor(match({ id: "l", status: "LIVE", homeGoals: 3, awayGoals: 0 }), "A"),
    null,
  );
  assert.equal(resultFor(match({ id: "p", status: "POSTPONED" }), "A"), null);
});

test("a club not in the match has no result for it", () => {
  assert.equal(resultFor(match({ id: "m" }), "Z"), null);
});

test("club fixtures are chronological and exclude other clubs", () => {
  const all = [
    match({ id: "late", kickoff: "2026-05-01T19:00:00Z" }),
    match({ id: "other", homeCode: "C", awayCode: "D" }),
    match({ id: "early", kickoff: "2026-04-01T19:00:00Z" }),
  ];

  assert.deepEqual(clubMatches(all, "A").map((m) => m.id), ["early", "late"]);
});

test("form is the last results, oldest first", () => {
  const all = Array.from({ length: 7 }, (_, i) =>
    match({
      id: `m${i}`,
      kickoff: `2026-04-0${i + 1}T19:00:00Z`,
      homeGoals: i,
      awayGoals: 0,
    }),
  );

  // i=0 is a draw (0-0), the rest are wins.
  assert.deepEqual(recentForm(all, "A"), ["V", "V", "V", "V", "V"]);
  assert.deepEqual(recentForm(all, "A", 7), ["E", "V", "V", "V", "V", "V", "V"]);
});

test("a postponed fixture does not punch a hole in the form guide", () => {
  const all = [
    match({ id: "w", kickoff: "2026-04-01T19:00:00Z", homeGoals: 1, awayGoals: 0 }),
    match({ id: "p", kickoff: "2026-04-08T19:00:00Z", status: "POSTPONED", homeGoals: null }),
    match({ id: "l", kickoff: "2026-04-15T19:00:00Z", homeGoals: 0, awayGoals: 2 }),
  ];

  assert.deepEqual(recentForm(all, "A"), ["V", "D"]);
});

test("the next fixture is the earliest one still to be played", () => {
  const all = [
    match({ id: "done", kickoff: "2026-04-01T19:00:00Z" }),
    match({ id: "soon", kickoff: "2026-04-08T19:00:00Z", status: "SCHEDULED", homeGoals: null }),
    match({ id: "later", kickoff: "2026-04-15T19:00:00Z", status: "SCHEDULED", homeGoals: null }),
  ];

  assert.equal(nextFixture(all, "A")?.id, "soon");
});

test("a cancelled fixture is never offered as the next one", () => {
  const all = [
    match({ id: "cancelled", kickoff: "2026-04-08T19:00:00Z", status: "CANCELLED", homeGoals: null }),
    match({ id: "real", kickoff: "2026-04-15T19:00:00Z", status: "SCHEDULED", homeGoals: null }),
  ];

  assert.equal(nextFixture(all, "A")?.id, "real");
});

test("there is no next fixture once everything is played", () => {
  assert.equal(nextFixture([match({ id: "done" })], "A"), null);
});

test("the last fixture is the most recently finished one", () => {
  const all = [
    match({ id: "first", kickoff: "2026-04-01T19:00:00Z" }),
    match({ id: "second", kickoff: "2026-04-08T19:00:00Z" }),
    match({ id: "upcoming", kickoff: "2026-04-15T19:00:00Z", status: "SCHEDULED", homeGoals: null }),
  ];

  assert.equal(lastFixture(all, "A")?.id, "second");
});

test("a club that has not played has no last fixture", () => {
  assert.equal(lastFixture([match({ id: "s", status: "SCHEDULED", homeGoals: null })], "A"), null);
});

test("standing and scorers are looked up by club code", () => {
  const row = { club: { code: "A", name: "A FC", shortName: "A" } } as StandingsRow;
  assert.equal(standingFor([row], "A"), row);
  assert.equal(standingFor([row], "Z"), null);

  const scorer = (code: string, name: string) =>
    ({ club: { code, name: code, shortName: code }, playerName: name }) as Scorer;
  const all = [scorer("A", "Um"), scorer("B", "Dois"), scorer("A", "Três")];

  assert.deepEqual(scorersFor(all, "A").map((s) => s.playerName), ["Um", "Três"]);
  assert.deepEqual(scorersFor(all, "Z"), []);
});
