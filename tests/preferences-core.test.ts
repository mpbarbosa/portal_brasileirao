import assert from "node:assert/strict";
import { test } from "node:test";

import {
  followLabel,
  followState,
  forgetAccountPreferences,
  hasPreferences,
  landingRoute,
  LANDING_OPTIONS,
  planSync,
  isFollowing,
  NO_PREFERENCES,
  parsePreferences,
  serialiseDevicePreferences,
  serialisePreferences,
  setLanding,
  toggleFollow,
  type LandingId,
  type Preferences,
} from "@/preferences-core";
import type { Club } from "@/src/types";

const palmeiras: Club = { code: "1769", name: "SE Palmeiras", shortName: "Palmeiras" };
const flamengo: Club = { code: "1783", name: "CR Flamengo", shortName: "Flamengo" };
const DIVISION = [palmeiras, flamengo];

/**
 * Both keys, always. Spelling them out at every call site is how one of them
 * quietly stops being asserted — these are tests about a *set* of preferences,
 * and the second key exists precisely because the set can grow.
 */
const prefs = (club: string | null, landing: LandingId | null = null): Preferences => ({
  club,
  landing,
});

test("a stored club round-trips", () => {
  const stored = serialisePreferences(prefs("1769"));
  assert.deepEqual(parsePreferences(stored), prefs("1769"));
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
  assert.deepEqual(parsePreferences('{"club":"nao-existe"}'), prefs("nao-existe"));
});

test("following nobody is a state of its own", () => {
  assert.deepEqual(followState(NO_PREFERENCES, DIVISION), { kind: "none" });
});

test("a followed club resolves against the division", () => {
  assert.deepEqual(followState(prefs("1769"), DIVISION), {
    kind: "following",
    club: palmeiras,
  });
});

test("a club that does not resolve is unresolved, never cleared", () => {
  // The rule from docs/accounts.md §3.15, and from seo-core one table over:
  // absent data is not proof of absence. Each of these is a state the app can
  // be in for minutes at a time, and none of them may rewrite the preference.
  const preferences = prefs("1769");

  // The club list has not arrived yet.
  assert.deepEqual(followState(preferences, undefined), { kind: "unresolved", code: "1769" });
  // It arrived empty, which is what a provider outage looks like.
  assert.deepEqual(followState(preferences, []), { kind: "unresolved", code: "1769" });
  // It arrived, and genuinely does not name the club.
  assert.deepEqual(followState(preferences, [flamengo]), { kind: "unresolved", code: "1769" });

  // In every case the stored value is untouched.
  assert.deepEqual(preferences, prefs("1769"));
});

test("following is decided by code, not by name or abbreviation", () => {
  assert.equal(isFollowing(prefs("1769"), "1769"), true);
  assert.equal(isFollowing(prefs("1769"), "1783"), false);
  assert.equal(isFollowing(NO_PREFERENCES, "1769"), false);
});

test("toggling follows, then unfollows, and never mutates", () => {
  const none = NO_PREFERENCES;
  const following = toggleFollow(none, "1769");
  assert.deepEqual(following, prefs("1769"));
  assert.deepEqual(none, prefs(null));

  assert.deepEqual(toggleFollow(following, "1769"), prefs(null));
});

test("following a second club replaces the first", () => {
  // Meu time is one club. Choosing another is a change of allegiance, not a
  // list — which is why the shape is a single code rather than a set.
  assert.deepEqual(toggleFollow(prefs("1769"), "1783"), prefs("1783"));
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


test("an account that names a club wins, and nothing is uploaded", () => {
  // The account is the source of truth: this is the case that makes the same
  // club appear on a second aparelho.
  const plan = planSync(prefs("1783"), prefs("1769"));
  assert.deepEqual(plan.device, prefs("1769"));
  assert.equal(plan.upload, null);
});

test("a device seeds an account that has no club yet", () => {
  // The case docs/accounts.md actually cared about: signing in must never
  // silently discard the choice the reader just made.
  const plan = planSync(prefs("1769"), NO_PREFERENCES);
  assert.deepEqual(plan.device, prefs("1769"));
  assert.deepEqual(plan.upload, prefs("1769"));
});

test("two empties stay empty, and cost no request", () => {
  const plan = planSync(NO_PREFERENCES, NO_PREFERENCES);
  assert.deepEqual(plan.device, NO_PREFERENCES);
  assert.equal(plan.upload, null);
});

test("the plan is idempotent — running it twice changes nothing", () => {
  // The hook re-runs this whenever the account id changes, and a rule that
  // drifted on a second pass would move somebody's club on a reload.
  const first = planSync(prefs("1783"), prefs("1769"));
  const second = planSync(first.device, prefs("1769"));
  assert.deepEqual(second.device, first.device);
  assert.equal(second.upload, null);
});

test("planSync mutates neither side", () => {
  const device = prefs("1769");
  const account = prefs(null);
  planSync(device, account);
  assert.deepEqual(device, prefs("1769"));
  assert.deepEqual(account, prefs(null));
});


// --- Página inicial ---------------------------------------------------------
//
// The second preference key, and the first that a device may not hold. Most of
// what is asserted below is that separation, because it is invisible from the
// shape: `Preferences` carries both keys and only two functions treat them
// differently.

test("a landing choice round-trips through the wire form", () => {
  const stored = serialisePreferences(prefs("1769", "ao-vivo"));
  assert.deepEqual(parsePreferences(stored), prefs("1769", "ao-vivo"));
});

test("the device form carries the club and refuses the landing", () => {
  // The whole account-only rule, in one assertion. A device that wrote this key
  // would go on honouring it after the reader changed it on another aparelho —
  // and would be the only device that disagreed, which is the failure the
  // setting exists to prevent.
  const written = serialiseDevicePreferences(prefs("1769", "jogadores"));
  assert.deepEqual(JSON.parse(written), { club: "1769" });
  assert.deepEqual(parsePreferences(written), prefs("1769"));
});

test("an unrecognised landing id is dropped, not stored", () => {
  // The same parser narrows `PUT /api/account/preferences`, so this is what
  // stops a value no build can map to a route reaching the database and sending
  // somebody nowhere. Note the club beside it survives: one bad key is not a
  // reason to discard the set.
  assert.deepEqual(parsePreferences('{"club":"1769","landing":"estadio"}'), prefs("1769"));
  assert.deepEqual(parsePreferences('{"landing":"classificação"}'), NO_PREFERENCES);
  assert.deepEqual(parsePreferences('{"landing":42}'), NO_PREFERENCES);
  assert.deepEqual(parsePreferences('{"landing":null}'), NO_PREFERENCES);
});

test("every option in the menu is a landing the parser accepts", () => {
  // The list the control renders and the set the parser admits are the same
  // set. They are built from one array precisely so they cannot drift, and this
  // is the assertion that says so — an option nobody can store would look
  // perfectly normal in the menu and silently do nothing.
  for (const option of LANDING_OPTIONS) {
    assert.deepEqual(
      parsePreferences(JSON.stringify({ landing: option.id })),
      prefs(null, option.id),
      option.id,
    );
  }
});

test("choosing where to land does not disturb the club", () => {
  assert.deepEqual(setLanding(prefs("1769"), "jogos"), prefs("1769", "jogos"));
  assert.deepEqual(setLanding(prefs("1769", "jogos"), null), prefs("1769"));

  const before = prefs("1769");
  setLanding(before, "jogos");
  assert.deepEqual(before, prefs("1769"), "setLanding must not mutate");
});

test("a set is worth storing when either key says something", () => {
  // The store deletes the row rather than writing an empty set, so this decides
  // whether clearing one key throws the other away.
  assert.equal(hasPreferences(NO_PREFERENCES), false);
  assert.equal(hasPreferences(prefs("1769")), true);
  assert.equal(hasPreferences(prefs(null, "ao-vivo")), true);
  assert.equal(hasPreferences(prefs("1769", "ao-vivo")), true);
});

test("the account's landing is adopted whichever way the club resolves", () => {
  // Three branches through planSync, one answer for this key: the account owns
  // it, so there is nothing to merge and no case where the device's copy — of
  // which there is none — could win.
  assert.equal(planSync(prefs("1783"), prefs("1769", "jogos")).device.landing, "jogos");
  assert.equal(planSync(prefs("1769"), prefs(null, "jogos")).device.landing, "jogos");
  assert.equal(planSync(prefs(null), prefs(null, "jogos")).device.landing, "jogos");
});

test("seeding an empty account carries the landing back with the club", () => {
  // The trap the whole-object PUT sets. Uploading `{ club }` alone would clear
  // the reader's landing choice the first time they followed a club — on the
  // server, silently, in the request that was supposed to be about the club.
  const plan = planSync(prefs("1769"), prefs(null, "artilharia"));
  assert.deepEqual(plan.upload, prefs("1769", "artilharia"));
  assert.deepEqual(plan.device, prefs("1769", "artilharia"));
});

test("a device cannot smuggle a landing into an account", () => {
  // Nothing writes this key to a device, but storage holds whatever was last
  // put there — including by a build that is no longer this one. The account's
  // value wins even when the account has none.
  const plan = planSync(prefs("1769", "jogadores"), NO_PREFERENCES);
  assert.equal(plan.device.landing, null);
  assert.deepEqual(plan.upload, prefs("1769"));
});

test("signing out forgets where to land and remembers the club", () => {
  // Two keys, two lifetimes: the club is this device's and predates every
  // account here, while the landing choice has nowhere to live without one.
  assert.deepEqual(forgetAccountPreferences(prefs("1769", "jogos")), prefs("1769"));
  assert.deepEqual(forgetAccountPreferences(prefs(null, "jogos")), NO_PREFERENCES);
});

test("each landing maps to the route it names", () => {
  const none = { kind: "none" } as const;
  assert.equal(landingRoute(null, none), null);
  assert.equal(landingRoute("classificacao", none), null);
  assert.deepEqual(landingRoute("ao-vivo", none), { section: "ao-vivo" });
  assert.deepEqual(landingRoute("artilharia", none), { section: "artilharia" });
  assert.deepEqual(landingRoute("jogadores", none), { section: "jogadores" });
});

test("landing on the fixtures opens the current round, not a frozen one", () => {
  // `round: null` is "whatever is current". A landing page pinned to round 24
  // is a bug that takes a season to notice.
  assert.deepEqual(landingRoute("jogos", { kind: "none" }), { section: "jogos", round: null });
});

test("Meu time lands on the club's own page", () => {
  // Through `clubKey`, which is the slug where there is one — never a second
  // spelling of the same rule. `App` hands the resolved club straight to
  // `navigate`, so a key this function invented would be a 404 nobody could
  // trace back to a preference.
  assert.deepEqual(
    landingRoute("meu-time", { kind: "following", club: { ...palmeiras, slug: "palmeiras" } }),
    { section: "clube", key: "palmeiras" },
  );

  // No slug — the shape a club has before `sync-seed-data` gives it one — falls
  // back to the code, which `findClub` still resolves. That is `clubKey`'s own
  // fallback rather than anything decided here.
  assert.deepEqual(landingRoute("meu-time", { kind: "following", club: palmeiras }), {
    section: "clube",
    key: "1769",
  });
});

test("Meu time falls back to the table rather than guessing an address", () => {
  // `unresolved` is "the club list has not arrived", not "no such club" —
  // followState's rule, one layer out. Guessing a URL from a bare code would
  // land a reader on a 404 generated by their own preference, at the moment the
  // provider is already struggling.
  assert.equal(landingRoute("meu-time", { kind: "unresolved", code: "1769" }), null);
  // And a reader who chose this and then stopped following anybody sees the
  // table, which is where they would have been anyway.
  assert.equal(landingRoute("meu-time", { kind: "none" }), null);
});
