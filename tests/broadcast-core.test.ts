import assert from "node:assert/strict";
import { test } from "node:test";

import { channelsFor, parseChannels, withBroadcasters } from "@/broadcast-core";
import type { Match } from "@/src/types";

const match = (id: string): Match => ({
  id,
  round: 24,
  kickoff: "2026-08-24T23:00:00Z",
  status: "SCHEDULED",
  homeCode: "1770",
  awayCode: "1768",
  homeGoals: null,
  awayGoals: null,
});

test("channels are returned for a match that has them", () => {
  assert.deepEqual(channelsFor({ "554970": ["Premiere", "SporTV"] }, "554970"), [
    "Premiere",
    "SporTV",
  ]);
});

test("a match with no entry has no channels", () => {
  assert.equal(channelsFor({}, "554970"), null);
});

test("an empty list reads the same as no entry", () => {
  // Both mean "we do not know where this is shown".
  assert.equal(channelsFor({ "554970": [] }, "554970"), null);
});

test("matches with channels carry them; others are untouched", () => {
  const [withChannels, without] = withBroadcasters(
    [match("554970"), match("999999")],
    { "554970": ["Premiere", "SporTV"] },
  );

  assert.deepEqual(withChannels.broadcasters, ["Premiere", "SporTV"]);
  assert.equal("broadcasters" in without, false);
});

test("a curated entry for an unknown match is ignored, not an error", () => {
  // A rescheduled fixture can leave a stale id behind.
  const result = withBroadcasters([match("554970")], {
    "554970": ["Premiere"],
    "000000": ["Canal Fantasma"],
  });

  assert.equal(result.length, 1);
  assert.deepEqual(result[0].broadcasters, ["Premiere"]);
});

test("attaching channels does not mutate the input", () => {
  const original = match("554970");
  withBroadcasters([original], { "554970": ["Premiere"] });

  assert.equal("broadcasters" in original, false);
});

test("channel strings split on the separators CBF actually uses", () => {
  // Both appear in a single day's table.
  assert.deepEqual(parseChannels("ESPN / Disney+"), ["ESPN", "Disney+"]);
  assert.deepEqual(parseChannels("Premiere, Sportv"), ["Premiere", "Sportv"]);
  assert.deepEqual(parseChannels("CBF TV, TV Brasil"), ["CBF TV", "TV Brasil"]);
});

test("a single channel needs no splitting", () => {
  assert.deepEqual(parseChannels("Premiere"), ["Premiere"]);
});

test("blank fragments are dropped", () => {
  assert.deepEqual(parseChannels("Premiere,, / SporTV "), ["Premiere", "SporTV"]);
  assert.deepEqual(parseChannels("   "), []);
  assert.deepEqual(parseChannels(""), []);
});
