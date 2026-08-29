import assert from "node:assert/strict";
import test from "node:test";

import { episodesFrom, since, summarise, type Sample } from "@/refresh-latency-core";

const HOUR = 3600;
const T0 = 1_787_700_000;

/** Samples an hour apart, red where the pattern says so. */
const run = (pattern: string): Sample[] =>
  [...pattern].map((c, i) => ({ sha: `c${i}`, ts: T0 + i * HOUR, red: c === "R" }));

test("a history with no red has no episodes", () => {
  assert.deepEqual(episodesFrom(run("GGGG"), T0), []);
});

test("an episode runs from the first red commit to the commit that clears it", () => {
  const [episode, ...rest] = episodesFrom(run("GRRG"), T0);
  assert.equal(rest.length, 0);
  assert.equal(episode.fromSha, "c1");
  assert.equal(episode.toSha, "c3");
  assert.equal(episode.hours, 2);
  assert.equal(episode.open, false);
});

test("separate red runs are separate episodes", () => {
  const episodes = episodesFrom(run("RGRRG"), T0);
  assert.equal(episodes.length, 2);
  assert.deepEqual(
    episodes.map((e) => e.hours),
    [1, 2],
  );
});

test("a run still red at the end is open, and measured against now", () => {
  const [episode] = episodesFrom(run("GRR"), T0 + 10 * HOUR);
  assert.equal(episode.open, true);
  assert.equal(episode.toSha, undefined);
  // from c1 at T0+1h to now at T0+10h.
  assert.equal(episode.hours, 9);
});

test("samples must be oldest-first, rather than silently running backwards", () => {
  const backwards = run("RG").reverse();
  assert.throws(() => episodesFrom(backwards, T0), /oldest-first/);
});

/**
 * The bug this whole module exists because of was a measurement reporting the
 * distribution as tighter than it is. An open episode is a lower bound, so
 * averaging it in would do exactly that again — hence it is counted, not mixed.
 */
test("summarise excludes open episodes rather than counting a lower bound", () => {
  const episodes = episodesFrom(run("RGRR"), T0 + 100 * HOUR);
  assert.equal(episodes.length, 2);
  assert.equal(episodes[1].open, true);
  const summary = summarise(episodes);
  assert.equal(summary.count, 1);
  assert.equal(summary.maxHours, 1);
});

test("summarise reports zeroes rather than NaN when nothing has closed", () => {
  assert.deepEqual(summarise(episodesFrom(run("RR"), T0 + HOUR)), {
    count: 0,
    medianHours: 0,
    p90Hours: 0,
    maxHours: 0,
    overOneDay: 0,
  });
});

test("median averages the middle pair on an even count", () => {
  // Closed runs of 1h, 2h, 3h and 4h.
  const episodes = episodesFrom(run("RGRRGRRRGRRRRG"), T0);
  assert.deepEqual(
    episodes.map((e) => e.hours),
    [1, 2, 3, 4],
  );
  assert.equal(summarise(episodes).medianHours, 2.5);
  assert.equal(summarise(episodes).maxHours, 4);
});

test("an episode longer than a day is counted as one", () => {
  const samples: Sample[] = [
    { sha: "a", ts: T0, red: true },
    { sha: "b", ts: T0 + 30 * HOUR, red: false },
  ];
  const summary = summarise(episodesFrom(samples, T0));
  assert.equal(summary.overOneDay, 1);
  assert.equal(summary.maxHours, 30);
});

test("since keeps episodes starting at or after the split", () => {
  const episodes = episodesFrom(run("RGRRG"), T0);
  assert.equal(since(episodes, T0).length, 2);
  assert.equal(since(episodes, T0 + 2 * HOUR).length, 1);
  assert.equal(since(episodes, T0 + 10 * HOUR).length, 0);
});
