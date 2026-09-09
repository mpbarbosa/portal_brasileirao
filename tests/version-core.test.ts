import assert from "node:assert/strict";
import test from "node:test";

import { shouldReload, versionVerdict, type VersionReading } from "@/version-core";

/** A reading where everything is fine, for cases to spoil one field at a time. */
const reading = (over: Partial<VersionReading> = {}): VersionReading => ({
  client: "abc1234",
  server: "abc1234",
  reloadedFor: null,
  canInterrupt: true,
  ...over,
});

test("the bundle running is the one served", () => {
  assert.equal(versionVerdict(reading()), "current");
});

test("a newer build on the host is taken", () => {
  assert.equal(versionVerdict(reading({ server: "def5678" })), "stale");
  assert.equal(shouldReload("stale"), true);
});

test("a rollback is a difference like any other, and is taken too", () => {
  // The host going BACKWARDS is a deliberate act (rollback.yml), and a reader
  // left on the withdrawn build is exactly who the rollback was for. Nothing
  // here compares which sha is newer — it cannot, and must not try.
  assert.equal(versionVerdict(reading({ client: "def5678", server: "abc1234" })), "stale");
});

test("case and surrounding space are not a difference", () => {
  assert.equal(versionVerdict(reading({ server: "ABC1234" })), "current");
  assert.equal(versionVerdict(reading({ server: " abc1234 " })), "current");
});

/**
 * The branch that keeps a host serving an older build from reloading everybody
 * for ever. An absent sha is the shape a deploy predating this feature answers.
 */
test("a missing sha is never a difference", () => {
  assert.equal(versionVerdict(reading({ server: null })), "unknown");
  assert.equal(versionVerdict(reading({ client: null })), "unknown");
  assert.equal(versionVerdict(reading({ server: "" })), "unknown");
  assert.equal(versionVerdict(reading({ server: "   " })), "unknown");
});

test("an unknown verdict does not reload even against a different client", () => {
  assert.equal(versionVerdict({ ...reading({ client: "def5678" }), server: null }), "unknown");
});

test("running from source, both sides say dev and agree", () => {
  assert.equal(versionVerdict(reading({ client: "dev", server: "dev" })), "current");
});

test("a dirty local build agrees with the server built from the same tree", () => {
  const dirty = "abc1234-dirty";
  assert.equal(versionVerdict(reading({ client: dirty, server: dirty })), "current");
});

/** The loop guard. One reload per sha; a second would repeat for ever. */
test("a reload already spent on this sha is not spent again", () => {
  assert.equal(
    versionVerdict(reading({ server: "def5678", reloadedFor: "def5678" })),
    "stuck",
  );
  assert.equal(shouldReload("stuck"), false);
});

test("a marker for some other sha does not block a fresh attempt", () => {
  assert.equal(
    versionVerdict(reading({ server: "def5678", reloadedFor: "0000000" })),
    "stale",
  );
});

test("the marker is compared with the same folding as the shas", () => {
  // Written by one build and read back against another's spelling; a marker
  // that only matched exactly would let the loop through on a case change.
  assert.equal(
    versionVerdict(reading({ server: "DEF5678", reloadedFor: "def5678" })),
    "stuck",
  );
});

test("a reader mid-gesture is deferred rather than interrupted", () => {
  assert.equal(
    versionVerdict(reading({ server: "def5678", canInterrupt: false })),
    "deferred",
  );
  assert.equal(shouldReload("deferred"), false);
});

/**
 * Order matters between these two: a reload that has already failed for this
 * sha is not worth waiting for a quiet moment to repeat.
 */
test("stuck beats deferred", () => {
  assert.equal(
    versionVerdict(
      reading({ server: "def5678", reloadedFor: "def5678", canInterrupt: false }),
    ),
    "stuck",
  );
});

test("being busy never turns a matching pair into a reload", () => {
  assert.equal(versionVerdict(reading({ canInterrupt: false })), "current");
});

test("shouldReload acts on exactly one verdict", () => {
  const verdicts = ["current", "unknown", "stale", "deferred", "stuck"] as const;
  assert.deepEqual(verdicts.filter(shouldReload), ["stale"]);
});
