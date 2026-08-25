import assert from "node:assert/strict";
import { test } from "node:test";

import { countdownLabel, hasLiveMatch, liveBoard, LATE_GRACE_MS } from "@/live-core";
import type { Match } from "@/src/types";

const NOW = Date.parse("2026-08-25T20:00:00Z");
const at = (offsetMs: number): string => new Date(NOW + offsetMs).toISOString();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const match = (overrides: Partial<Match> & Pick<Match, "id">): Match => ({
  round: 1,
  kickoff: at(HOUR),
  status: "SCHEDULED",
  homeCode: "AAA",
  awayCode: "BBB",
  homeGoals: null,
  awayGoals: null,
  ...overrides,
});

test("splits the season into agora, a seguir and últimos resultados", () => {
  const board = liveBoard(
    [
      match({ id: "live", status: "LIVE", homeGoals: 1, awayGoals: 0 }),
      match({ id: "next", kickoff: at(2 * HOUR) }),
      match({ id: "soon", kickoff: at(30 * MINUTE) }),
      match({ id: "done", status: "FINISHED", kickoff: at(-DAY), homeGoals: 2, awayGoals: 1 }),
    ],
    NOW,
  );

  assert.deepEqual(board.live.map((entry) => entry.id), ["live"]);
  assert.deepEqual(board.upcoming.map((entry) => entry.id), ["soon", "next"]);
  assert.deepEqual(board.recent.map((entry) => entry.id), ["done"]);
});

test("results are newest first, so the last round read is the one just played", () => {
  const board = liveBoard(
    [
      match({ id: "older", status: "FINISHED", kickoff: at(-3 * DAY), homeGoals: 0, awayGoals: 0 }),
      match({ id: "newer", status: "FINISHED", kickoff: at(-HOUR), homeGoals: 1, awayGoals: 1 }),
    ],
    NOW,
  );

  assert.deepEqual(board.recent.map((entry) => entry.id), ["newer", "older"]);
});

test("a FINISHED match without a score is not a result", () => {
  // The same rule the table uses: a status without both scores is a data hole,
  // and rendering it as a result would show "×" where a scoreline belongs.
  const board = liveBoard(
    [match({ id: "scoreless", status: "FINISHED", kickoff: at(-HOUR) })],
    NOW,
  );

  assert.deepEqual(board.recent, []);
});

test("a fixture whose kickoff has just passed keeps its place under a seguir", () => {
  // Upstream is polled, not pushed: a match can sit on SCHEDULED for a while
  // after the whistle, and dropping it would hide it during exactly the window
  // this page exists for.
  const board = liveBoard(
    [match({ id: "late", kickoff: at(-(LATE_GRACE_MS - MINUTE)) })],
    NOW,
  );

  assert.deepEqual(board.upcoming.map((entry) => entry.id), ["late"]);
});

test("a fixture long past its kickoff and still SCHEDULED is stale, not late", () => {
  const board = liveBoard(
    [match({ id: "stale", kickoff: at(-(LATE_GRACE_MS + MINUTE)) })],
    NOW,
  );

  assert.deepEqual(board.upcoming, []);
});

test("postponed fixtures are not upcoming — their kickoff means nothing", () => {
  const board = liveBoard([match({ id: "adiado", status: "POSTPONED" })], NOW);

  assert.deepEqual(board.upcoming, []);
  assert.deepEqual(board.live, []);
  assert.deepEqual(board.recent, []);
});

test("a fixture with no usable kickoff is still coming, and sorts last", () => {
  const board = liveBoard(
    [match({ id: "tbd", kickoff: "a definir" }), match({ id: "known", kickoff: at(DAY) })],
    NOW,
  );

  assert.deepEqual(board.upcoming.map((entry) => entry.id), ["known", "tbd"]);
});

test("each section is capped so the page does not become the fixture list", () => {
  const many = Array.from({ length: 12 }, (_, index) =>
    match({ id: `next-${index}`, kickoff: at((index + 1) * HOUR) }),
  );

  const board = liveBoard(many, NOW, { upcoming: 3 });

  assert.deepEqual(
    board.upcoming.map((entry) => entry.id),
    ["next-0", "next-1", "next-2"],
  );
});

test("an empty season yields three empty sections rather than throwing", () => {
  assert.deepEqual(liveBoard([], NOW), { live: [], upcoming: [], recent: [] });
});

test("hasLiveMatch reports whether anything is being played", () => {
  assert.equal(hasLiveMatch([match({ id: "a" })]), false);
  assert.equal(hasLiveMatch([match({ id: "a" }), match({ id: "b", status: "LIVE" })]), true);
});

test("the countdown reads in minutes, then hours, then days", () => {
  assert.equal(countdownLabel(at(45 * MINUTE), NOW), "Começa em 45 minutos");
  assert.equal(countdownLabel(at(MINUTE), NOW), "Começa em 1 minuto");
  assert.equal(countdownLabel(at(90 * MINUTE), NOW), "Começa em 1h30");
  assert.equal(countdownLabel(at(2 * HOUR), NOW), "Começa em 2 horas");
  assert.equal(countdownLabel(at(3 * DAY), NOW), "Começa em 3 dias");
  assert.equal(countdownLabel(at(DAY), NOW), "Começa em 1 dia");
});

test("the countdown stops at zero rather than going negative", () => {
  // We cannot tell "late" from "underway but not yet reported", so the phrase
  // says the only thing that is certainly true.
  assert.equal(countdownLabel(at(0), NOW), "Deve começar a qualquer momento");
  assert.equal(countdownLabel(at(-HOUR), NOW), "Deve começar a qualquer momento");
});

test("an unparseable kickoff has no countdown", () => {
  assert.equal(countdownLabel("a definir", NOW), "Horário a definir");
});
