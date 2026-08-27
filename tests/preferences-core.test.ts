import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clubArticle,
  followLabel,
  followState,
  isFollowing,
  NO_PREFERENCES,
  parsePreferences,
  serialisePreferences,
  toggleFollow,
} from "@/preferences-core";
import { CLUBS } from "@/src/data/clubs";
import type { Club } from "@/src/types";

const palmeiras: Club = { code: "1769", name: "SE Palmeiras", shortName: "Palmeiras" };
const flamengo: Club = { code: "1783", name: "CR Flamengo", shortName: "Flamengo" };
const DIVISION = [palmeiras, flamengo];

test("a stored club round-trips", () => {
  const stored = serialisePreferences({ club: "1769" });
  assert.deepEqual(parsePreferences(stored), { club: "1769" });
});

test("following nobody round-trips as following nobody", () => {
  assert.deepEqual(parsePreferences(serialisePreferences(NO_PREFERENCES)), NO_PREFERENCES);
});

test("junk in storage reads as no preference, not a crash", () => {
  // Storage is shared with anything else on the origin, and holds whatever the
  // last build to run here wrote.
  assert.deepEqual(parsePreferences("not json at all"), NO_PREFERENCES);
  assert.deepEqual(parsePreferences("[]"), NO_PREFERENCES);
  assert.deepEqual(parsePreferences("null"), NO_PREFERENCES);
  assert.deepEqual(parsePreferences('"1769"'), NO_PREFERENCES);
  assert.deepEqual(parsePreferences('{"club":42}'), NO_PREFERENCES);
  assert.deepEqual(parsePreferences('{"club":""}'), NO_PREFERENCES);
  assert.deepEqual(parsePreferences('{"tema":"escuro"}'), NO_PREFERENCES);
  assert.deepEqual(parsePreferences(""), NO_PREFERENCES);
  assert.deepEqual(parsePreferences(null), NO_PREFERENCES);
  assert.deepEqual(parsePreferences(undefined), NO_PREFERENCES);
});

test("an unknown club code survives parsing", () => {
  // The parser has no club list and must not acquire one: whether the code
  // names a real club is `followState`'s question, and the answer is never
  // "delete it".
  assert.deepEqual(parsePreferences('{"club":"nao-existe"}'), { club: "nao-existe" });
});

test("following nobody is a state of its own", () => {
  assert.deepEqual(followState(NO_PREFERENCES, DIVISION), { kind: "none" });
});

test("a followed club resolves against the division", () => {
  assert.deepEqual(followState({ club: "1769" }, DIVISION), {
    kind: "following",
    club: palmeiras,
  });
});

test("a club that does not resolve is unresolved, never cleared", () => {
  // The rule from docs/accounts.md §3.15, and from seo-core one table over:
  // absent data is not proof of absence. Each of these is a state the app can
  // be in for minutes at a time, and none of them may rewrite the preference.
  const preferences = { club: "1769" };

  // The club list has not arrived yet.
  assert.deepEqual(followState(preferences, undefined), { kind: "unresolved", code: "1769" });
  // It arrived empty, which is what a provider outage looks like.
  assert.deepEqual(followState(preferences, []), { kind: "unresolved", code: "1769" });
  // It arrived, and genuinely does not name the club.
  assert.deepEqual(followState(preferences, [flamengo]), { kind: "unresolved", code: "1769" });

  // In every case the stored value is untouched.
  assert.deepEqual(preferences, { club: "1769" });
});

test("following is decided by code, not by name or abbreviation", () => {
  assert.equal(isFollowing({ club: "1769" }, "1769"), true);
  assert.equal(isFollowing({ club: "1769" }, "1783"), false);
  assert.equal(isFollowing(NO_PREFERENCES, "1769"), false);
});

test("toggling follows, then unfollows, and never mutates", () => {
  const none = NO_PREFERENCES;
  const following = toggleFollow(none, "1769");
  assert.deepEqual(following, { club: "1769" });
  assert.deepEqual(none, { club: null });

  assert.deepEqual(toggleFollow(following, "1769"), { club: null });
});

test("following a second club replaces the first", () => {
  // Meu time is one club. Choosing another is a change of allegiance, not a
  // list — which is why the shape is a single code rather than a set.
  assert.deepEqual(toggleFollow({ club: "1769" }, "1783"), { club: "1783" });
});

test("the label says which club, and which direction", () => {
  assert.equal(followLabel(palmeiras, false), "Seguir o Palmeiras");
  assert.equal(followLabel(palmeiras, true), "Deixar de seguir o Palmeiras");
});

test("a club Brazilians call 'a' gets the right article", () => {
  // Chapecoense is in the division, so "Seguir o Chapecoense" is a defect a
  // reader meets rather than one a linguist imagines.
  const chape: Club = { code: "1772", name: "Chapecoense AF", shortName: "Chapecoense" };
  assert.equal(followLabel(chape, false), "Seguir a Chapecoense");
  assert.equal(followLabel(chape, true), "Deixar de seguir a Chapecoense");
});

test("every club in the snapshot gets an article, and only the right ones get 'a'", () => {
  // The check that would have caught this when it was written: read the twenty
  // names rather than assert something about them. Feminine is the exception,
  // so the assertion is that the exceptions are exactly who they should be.
  const feminine = CLUBS.filter((club) => clubArticle(club) === "a").map((c) => c.shortName);
  assert.deepEqual(feminine, ["Chapecoense"]);
  assert.equal(CLUBS.length, 20);
});

test("the article survives accents and spacing, because slugify normalises both", () => {
  const ferroviaria: Club = { code: "x", name: "AF Ferroviária", shortName: "Ferroviária" };
  const ponte: Club = { code: "y", name: "AA Ponte Preta", shortName: "Ponte Preta" };
  assert.equal(clubArticle(ferroviaria), "a");
  assert.equal(clubArticle(ponte), "a");
});
