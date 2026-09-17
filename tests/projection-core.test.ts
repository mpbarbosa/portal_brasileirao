import assert from "node:assert/strict";
import { test } from "node:test";

import {
  hasProjection,
  oddsLabel,
  projectionBoard,
  projectionKey,
  toProjectionPayload,
  type ProjectedClub,
} from "@/projection-core";
import { projectSeason } from "@/season-sim-core";
import { countsTowardStandings } from "@/standings-core";
import type { Club, Match } from "@/src/types";

const club = (code: string): Club => ({ code, name: `${code} FC`, shortName: code });

test("a probability never rounds into a certainty it does not have", () => {
  assert.equal(oddsLabel(0), "0%");
  assert.equal(oddsLabel(1), "100%");
  assert.equal(oddsLabel(0.004), "<1%");
  assert.equal(oddsLabel(0.9996), ">99%");
  assert.equal(oddsLabel(0.005), "1%");
  assert.equal(oddsLabel(0.994), "99%");
  assert.equal(oddsLabel(0.3476), "35%");
});

test("a board drops clubs below the floor and keeps table order on ties", () => {
  const clubs: ProjectedClub[] = [
    { code: "A", title: 0.6, g4: 1, z4: 0 },
    { code: "B", title: 0.4, g4: 1, z4: 0 },
    { code: "C", title: 0.004, g4: 0.7, z4: 0.2 },
    { code: "D", title: 0, g4: 0.3, z4: 0.9 },
  ];
  assert.deepEqual(projectionBoard(clubs, "title").map((c) => c.code), ["A", "B"]);
  assert.deepEqual(projectionBoard(clubs, "g4").map((c) => c.code), ["A", "B", "C", "D"]);
  // C sits above D in the table and below it on this board, so an unsorted
  // filter would pass everything above this line.
  assert.deepEqual(projectionBoard(clubs, "z4").map((c) => c.code), ["D", "C"]);
  // The input is not reordered in place.
  assert.deepEqual(clubs.map((c) => c.code), ["A", "B", "C", "D"]);
});

test("the key moves with a result and with a fixture that is merely re-scheduled", () => {
  const base: Match[] = [
    { id: "1", round: 1, kickoff: "2026-04-11T19:00:00Z", status: "FINISHED", homeCode: "A", awayCode: "B", homeGoals: 1, awayGoals: 0 },
    { id: "2", round: 2, kickoff: "2026-04-18T19:00:00Z", status: "SCHEDULED", homeCode: "B", awayCode: "A", homeGoals: null, awayGoals: null },
  ];
  const key = projectionKey(["A", "B"], base);
  assert.equal(projectionKey(["A", "B"], base.map((m) => ({ ...m }))), key);
  assert.notEqual(projectionKey(["A", "B"], [{ ...base[0], awayGoals: 1 }, base[1]]), key);
  assert.notEqual(projectionKey(["A", "B"], [base[0], { ...base[1], status: "POSTPONED" }]), key);
  assert.notEqual(projectionKey(["A", "B", "C"], base), key);
});

test("the payload keeps the table's order and the three odds, and says when there is nothing to show", () => {
  const clubs = ["A", "B", "C", "D"].map(club);
  const pairs = clubs.flatMap((h) => clubs.filter((a) => a !== h).map((a) => [h.code, a.code] as const));
  const matches: Match[] = pairs.map(([homeCode, awayCode], i) => {
    const played = i < 6;
    return {
      id: String(i),
      round: i + 1,
      kickoff: "2026-04-11T19:00:00Z",
      status: played ? "FINISHED" : "SCHEDULED",
      homeCode,
      awayCode,
      homeGoals: played ? (homeCode === "A" ? 3 : 1) : null,
      awayGoals: played ? 0 : null,
    };
  });
  const played = matches.filter(countsTowardStandings).length;
  const payload = toProjectionPayload(projectSeason(clubs, matches, { iterations: 500 }), played);

  assert.equal(payload.played, 6);
  assert.equal(payload.remaining, 6);
  assert.equal(payload.clubs.length, 4);
  const titleSum = payload.clubs.reduce((sum, c) => sum + c.title, 0);
  assert.ok(Math.abs(titleSum - 1) < 1e-9, `title odds sum to ${titleSum}`);
  assert.ok(hasProjection(payload));
  assert.equal(hasProjection({ ...payload, remaining: 0 }), false);
  assert.equal(hasProjection({ ...payload, played: 0 }), false);
});
