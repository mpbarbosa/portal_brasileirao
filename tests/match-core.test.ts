import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clubsOf,
  findMatch,
  highlightsSearchUrl,
  highlights,
  hasHighlights,
  isHighlightUrl,
  refereeRoleLabel,
  withHighlights,
} from "@/match-core";
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

test("the fallback is a search, and escapes the query", () => {
  const url = highlightsSearchUrl("Botafogo", "Athletico-PR");

  assert.ok(url.startsWith("https://www.youtube.com/results?search_query="));
  // Spaces and the accent must survive as escapes, not raw characters.
  assert.ok(!url.includes(" "));
  assert.ok(url.includes("Botafogo"));
  // Not "gols": the same query has to serve a goalless match.
  assert.ok(url.includes("momentos"));
  assert.ok(!url.includes("gols"));
});

test("highlights are offered for any finished match, goalless included", () => {
  // A 0-0 still has chances and saves, and broadcasters publish a package for
  // it. 14 of the season's 234 finished matches ended goalless.
  assert.equal(hasHighlights(match()), true);
  assert.equal(hasHighlights(match({ homeGoals: 0, awayGoals: 0 })), true);
});

test("an unplayed or in-progress match offers no highlights", () => {
  // Nothing to show before kickoff, and a live match's goals are not yet a
  // package.
  assert.equal(
    hasHighlights(match({ status: "SCHEDULED", homeGoals: null, awayGoals: null })),
    false,
  );
  assert.equal(hasHighlights(match({ status: "LIVE", homeGoals: 1, awayGoals: 0 })), false);
  assert.equal(hasHighlights(match({ status: "POSTPONED", homeGoals: null })), false);
});


const YT = "https://www.youtube.com/watch?v=o-_hD5Q8f4Q";
const YT2 = "https://www.youtube.com/watch?v=AgycMjd6b-I";

test("a YouTube link over HTTPS is accepted", () => {
  assert.equal(isHighlightUrl(YT), true);
  assert.equal(isHighlightUrl("https://youtu.be/o-_hD5Q8f4Q"), true);
  assert.equal(isHighlightUrl("https://m.youtube.com/watch?v=x"), true);
});

test("anything not YouTube over HTTPS is rejected", () => {
  // A typo or a paste of the wrong thing degrades to the search.
  assert.equal(isHighlightUrl("http://www.youtube.com/watch?v=x"), false);
  assert.equal(isHighlightUrl("https://vimeo.com/123"), false);
  assert.equal(isHighlightUrl("not a url"), false);
  assert.equal(isHighlightUrl(undefined), false);
});

test("a match carries every curated channel", () => {
  const [withVideos] = withHighlights([match()], {
    "554970": [
      { url: YT, channel: "ge tv" },
      { url: YT2, channel: "CazéTV" },
    ],
  });

  assert.deepEqual(
    highlights(withVideos).map((v) => v.channel),
    ["ge tv", "CazéTV"],
  );
});

test("one bad entry does not take the good ones with it", () => {
  const [withVideos] = withHighlights([match()], {
    "554970": [
      { url: "https://vimeo.com/123", channel: "Errado" },
      { url: YT, channel: "ge tv" },
    ],
  });

  assert.deepEqual(
    highlights(withVideos).map((v) => v.channel),
    ["ge tv"],
  );
});

test("a match with only invalid entries carries none", () => {
  const [withVideos] = withHighlights([match()], {
    "554970": [{ url: "http://insecure", channel: "x" }],
  });

  assert.equal("highlights" in withVideos, false);
  assert.deepEqual(highlights(withVideos), []);
});

test("a match with no entry carries none", () => {
  assert.deepEqual(highlights(match()), []);
});

test("translates the one role the provider actually sends", () => {
  assert.equal(refereeRoleLabel("REFEREE"), "Árbitro");
});

test("an unmapped role renders verbatim rather than as a guess", () => {
  // The rule `positionLabel` and `nationalityLabel` establish. The published
  // vocabulary is wider than what the free tier sends — no assistant appears in
  // 356 entries across BSA, PL and CL — so anything else reaches the page as
  // the provider wrote it, which is a visible prompt to add the row.
  assert.equal(refereeRoleLabel("ASSISTANT_REFEREE_N1"), "ASSISTANT_REFEREE_N1");
});

test("a named official with no role gets the collective noun", () => {
  // It claims only that they officiated, which is all the payload said.
  assert.equal(refereeRoleLabel(""), "Arbitragem");
  assert.equal(refereeRoleLabel("  "), "Arbitragem");
  assert.equal(refereeRoleLabel(undefined), "Arbitragem");
});
