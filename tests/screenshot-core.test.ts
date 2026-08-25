import assert from "node:assert/strict";
import test from "node:test";

import { behindMainUnknown, captureRefusals, type CaptureFacts } from "@/screenshot-core";

/** A capture that should be committed: current build, real data, nothing behind. */
const good = (over: Partial<CaptureFacts> = {}): CaptureFacts => ({
  servedSha: "e4c5fb9",
  provider: "football-data",
  known: true,
  changedVsHead: [],
  behindMain: [],
  ...over,
});

test("a current capture with real data is committable", () => {
  assert.deepEqual(captureRefusals(good()), []);
});

test("a dirty build is refused, and named as the cause", () => {
  const [reason, ...rest] = captureRefusals(good({ servedSha: "e4c5fb9-dirty" }));

  assert.match(reason, /dirty tree/);
  // Only one complaint: a dirty sha cannot also be diffed, and saying so twice
  // would send the reader after a second problem that is the same problem.
  assert.deepEqual(rest, []);
});

test("a sha this repository does not have is refused rather than diffed", () => {
  const reasons = captureRefusals(good({ servedSha: "deadbee", known: false }));

  assert.equal(reasons.length, 1);
  assert.match(reasons[0], /not a commit in this repository/);
});

test("a build whose appearance differs from HEAD is refused, listing the files", () => {
  const reasons = captureRefusals(
    good({ changedVsHead: ["src/components/MatchPage.tsx", "src/index.css"] }),
  );

  assert.equal(reasons.length, 1);
  assert.match(reasons[0], /differs from HEAD/);
  assert.match(reasons[0], /MatchPage\.tsx/);
  assert.match(reasons[0], /index\.css/);
});

test("seed data is refused even when the build is current", () => {
  const reasons = captureRefusals(good({ provider: "placeholder" }));

  assert.equal(reasons.length, 1);
  assert.match(reasons[0], /not "football-data"/);
  assert.match(reasons[0], /\.env/);
});

/**
 * The case the guard was missing, in the shape it actually happened.
 *
 * A capture at `ea27bee` matched its own HEAD exactly — the build and the tree
 * were the same commit — while `origin/main` had already moved to `18c3b0e`,
 * which carried a change to `MatchPage`. The old guard admitted it and CI then
 * failed the capture PR on its own images.
 */
test("a tree behind origin/main is refused even though it matches its own HEAD", () => {
  const reasons = captureRefusals(
    good({
      servedSha: "ea27bee",
      changedVsHead: [],
      behindMain: [
        "src/components/ClubLinks.tsx",
        "src/components/ClubView.tsx",
        "src/components/MatchPage.tsx",
      ],
    }),
  );

  assert.equal(reasons.length, 1);
  assert.match(reasons[0], /origin\/main has appearance changes/);
  assert.match(reasons[0], /MatchPage\.tsx/);
  // The remedy differs from the HEAD mismatch's: merge, not rebuild.
  assert.match(reasons[0], /merge origin\/main/);
});

test("being behind origin/main is reported separately from differing from HEAD", () => {
  const reasons = captureRefusals(
    good({
      changedVsHead: ["src/index.css"],
      behindMain: ["src/components/MatchPage.tsx"],
    }),
  );

  // Two distinct problems with two distinct fixes; fixing one and being told
  // about the other on the next run is how a capture takes three attempts.
  assert.equal(reasons.length, 2);
  assert.match(reasons[0], /differs from HEAD/);
  assert.match(reasons[1], /origin\/main has appearance changes/);
});

test("every failing test is reported at once, not just the first", () => {
  const reasons = captureRefusals(
    good({ changedVsHead: ["src/index.css"], provider: "fallback" }),
  );

  assert.equal(reasons.length, 2);
  assert.match(reasons[1], /not "football-data"/);
});

test("an unknown origin/main does not refuse the capture", () => {
  // Offline is not evidence of staleness. Refusing here would make the tool
  // unusable without a network for a risk that is unmeasured, not known.
  assert.deepEqual(captureRefusals(good({ behindMain: null })), []);
});

test("a skipped origin/main comparison is visible to the caller", () => {
  assert.equal(behindMainUnknown(good({ behindMain: null })), true);
  assert.equal(behindMainUnknown(good({ behindMain: [] })), false);
  assert.equal(behindMainUnknown(good({ behindMain: ["src/index.css"] })), false);
});
