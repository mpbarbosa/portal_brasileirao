import assert from "node:assert/strict";
import { test } from "node:test";

import { clubsOf, findMatch, goalsSearchUrl, hasGoalsToShow, venueLabel } from "@/match-core";
import type { Club, Match } from "@/src/types";

const match = (overrides: Partial<Match> = {}): Match => ({
  id: "554970",
  round: 24,
  kickoff: "2026-08-24T23:00:00Z",
  status: "FINISHED",
  homeCode: "1770",
  awayCode: "1768",
  homeGoals: 2,
  awayGoals: 1,
  ...overrides,
});

const club = (code: string, shortName: string): Club => ({
  code,
  name: `${shortName} FC`,
  shortName,
});

const CLUBS = [club("1770", "Botafogo"), club("1768", "Athletico-PR")];

test("a match is found by id", () => {
  assert.equal(findMatch([match()], "554970")?.id, "554970");
  assert.equal(findMatch([match()], "999999"), null);
  assert.equal(findMatch([], "554970"), null);
});

test("both clubs resolve from the club list", () => {
  const { home, away } = clubsOf(match(), CLUBS);

  assert.equal(home?.shortName, "Botafogo");
  assert.equal(away?.shortName, "Athletico-PR");
});

test("an unknown club resolves to null rather than throwing", () => {
  const { home, away } = clubsOf(match({ awayCode: "9999" }), CLUBS);

  assert.equal(home?.shortName, "Botafogo");
  assert.equal(away, null);
});

test("the goals link is a search, and escapes the query", () => {
  const url = goalsSearchUrl("Botafogo", "Athletico-PR");

  assert.ok(url.startsWith("https://www.youtube.com/results?search_query="));
  // Spaces and the accent must survive as escapes, not raw characters.
  assert.ok(!url.includes(" "));
  assert.ok(url.includes("Botafogo"));
  assert.ok(url.includes("gols"));
});

test("goals are offered only for a finished match that had any", () => {
  assert.equal(hasGoalsToShow(match()), true);
  assert.equal(hasGoalsToShow(match({ homeGoals: 0, awayGoals: 0 })), false);
});

test("an unplayed or in-progress match offers no goals link", () => {
  // Nothing to show before kickoff, and a live match's goals are not yet a
  // package.
  assert.equal(
    hasGoalsToShow(match({ status: "SCHEDULED", homeGoals: null, awayGoals: null })),
    false,
  );
  assert.equal(hasGoalsToShow(match({ status: "LIVE", homeGoals: 1, awayGoals: 0 })), false);
  assert.equal(hasGoalsToShow(match({ status: "POSTPONED", homeGoals: null })), false);
});

test("the venue reads as stadium, city and state", () => {
  const withVenue = match({
    venue: { stadium: "Nilton Santos", city: "Rio de Janeiro", state: "RJ" },
  });

  assert.equal(venueLabel(withVenue), "Nilton Santos · Rio de Janeiro – RJ");
});

test("an unknown venue yields null, not a half-built label", () => {
  assert.equal(venueLabel(match()), null);
});
