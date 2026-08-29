import assert from "node:assert/strict";
import { test } from "node:test";

import { LATE_GRACE_MS } from "@/live-core";
import { playsIn } from "@/club-core";
import { clubFocus, isHome, isImminent, opponentOf } from "@/next-match-core";
import type { Match } from "@/src/types";

const NOW = Date.parse("2026-08-25T20:00:00Z");
const at = (offsetMs: number): string => new Date(NOW + offsetMs).toISOString();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const MINE = "1783";
const THEM = "1769";

const match = (overrides: Partial<Match> & Pick<Match, "id">): Match => ({
  round: 1,
  kickoff: at(HOUR),
  status: "SCHEDULED",
  homeCode: MINE,
  awayCode: THEM,
  homeGoals: null,
  awayGoals: null,
  ...overrides,
});

const focusId = (focus: ReturnType<typeof clubFocus>): string | null =>
  focus.kind === "none" ? null : focus.match.id;

test("picks the club's soonest scheduled fixture", () => {
  const focus = clubFocus(
    [
      match({ id: "later", kickoff: at(3 * DAY) }),
      match({ id: "sooner", kickoff: at(2 * HOUR) }),
      match({ id: "elsewhere", homeCode: "0001", awayCode: "0002", kickoff: at(MINUTE) }),
    ],
    MINE,
    NOW,
  );

  assert.equal(focus.kind, "next");
  assert.equal(focusId(focus), "sooner");
});

test("a match in progress wins over one that is merely sooner", () => {
  // The ordering rule that is not "earliest kickoff": upstream can still be
  // calling a later fixture SCHEDULED while this club is already on the pitch.
  const focus = clubFocus(
    [
      match({ id: "kicking-off", kickoff: at(MINUTE) }),
      match({ id: "underway", status: "LIVE", kickoff: at(-40 * MINUTE), homeGoals: 1, awayGoals: 0 }),
    ],
    MINE,
    NOW,
  );

  assert.equal(focus.kind, "playing");
  assert.equal(focusId(focus), "underway");
});

test("an away fixture counts as the club's own", () => {
  const focus = clubFocus(
    [match({ id: "away", homeCode: THEM, awayCode: MINE })],
    MINE,
    NOW,
  );

  assert.equal(focusId(focus), "away");
  assert.equal(isHome(focus.kind === "none" ? match({ id: "x" }) : focus.match, MINE), false);
});

test("a fixture whose kickoff has passed keeps its place for the grace window", () => {
  // Same window as the Ao vivo board's "A seguir", and reused rather than
  // re-picked: two answers to "when does a fixture stop being next" is how the
  // home page comes to name a match the board has already dropped.
  const late = match({ id: "late", kickoff: at(-LATE_GRACE_MS + MINUTE) });
  assert.equal(focusId(clubFocus([late], MINE, NOW)), "late");

  const stale = match({ id: "stale", kickoff: at(-LATE_GRACE_MS - MINUTE) });
  assert.equal(clubFocus([stale], MINE, NOW).kind, "none");
});

test("a fixture with no usable kickoff is still the next one", () => {
  const focus = clubFocus([match({ id: "tbd", kickoff: "a definir" })], MINE, NOW);

  assert.equal(focus.kind, "next");
  assert.equal(focusId(focus), "tbd");
});

test("a dated fixture is preferred to one with no usable kickoff", () => {
  const focus = clubFocus(
    [match({ id: "tbd", kickoff: "" }), match({ id: "dated", kickoff: at(5 * DAY) })],
    MINE,
    NOW,
  );

  assert.equal(focusId(focus), "dated");
});

test("postponed and cancelled fixtures are never offered as the next one", () => {
  const focus = clubFocus(
    [
      match({ id: "off", status: "POSTPONED", kickoff: at(HOUR) }),
      match({ id: "dead", status: "CANCELLED", kickoff: at(2 * HOUR) }),
    ],
    MINE,
    NOW,
  );

  assert.equal(focus.kind, "none");
});

test("a finished season leaves nothing to point at", () => {
  const focus = clubFocus(
    [match({ id: "done", status: "FINISHED", kickoff: at(-DAY), homeGoals: 2, awayGoals: 1 })],
    MINE,
    NOW,
  );

  assert.equal(focus.kind, "none");
});

test("no club followed, no payload, and an unknown club all answer none", () => {
  const fixtures = [match({ id: "any" })];

  assert.equal(clubFocus(fixtures, null, NOW).kind, "none");
  assert.equal(clubFocus(fixtures, undefined, NOW).kind, "none");
  assert.equal(clubFocus([], MINE, NOW).kind, "none");
  assert.equal(clubFocus(fixtures, "999999", NOW).kind, "none");
});

test("opponentOf and isHome read the fixture from the club's side", () => {
  const home = match({ id: "h" });
  const away = match({ id: "a", homeCode: THEM, awayCode: MINE });

  // `playsIn` is club-core's, reused rather than restated here.
  assert.equal(playsIn(home, MINE), true);
  assert.equal(playsIn(home, "0001"), false);
  assert.equal(opponentOf(home, MINE), THEM);
  assert.equal(opponentOf(away, MINE), THEM);
  assert.equal(isHome(home, MINE), true);
  assert.equal(isHome(away, MINE), false);
});

test("imminence is a day, a live match, and never a fixture with no time", () => {
  const soon = clubFocus([match({ id: "soon", kickoff: at(6 * HOUR) })], MINE, NOW);
  assert.equal(isImminent(soon, NOW), true);

  const edge = clubFocus([match({ id: "edge", kickoff: at(DAY) })], MINE, NOW);
  assert.equal(isImminent(edge, NOW), true);

  const far = clubFocus([match({ id: "far", kickoff: at(DAY + MINUTE) })], MINE, NOW);
  assert.equal(isImminent(far, NOW), false);

  const live = clubFocus([match({ id: "live", status: "LIVE" })], MINE, NOW);
  assert.equal(isImminent(live, NOW), true);

  const tbd = clubFocus([match({ id: "tbd", kickoff: "" })], MINE, NOW);
  assert.equal(isImminent(tbd, NOW), false);

  assert.equal(isImminent({ kind: "none" }, NOW), false);
});
