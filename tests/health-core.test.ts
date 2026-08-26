import assert from "node:assert/strict";
import { test } from "node:test";

import {
  healthStatusLabel,
  isHealthy,
  parseHealth,
  providerLabel,
  shortSha,
  startInstant,
} from "@/health-core";

/** What `/api/health` answers from a production bundle. */
const LIVE_BODY = {
  status: "ok",
  sha: "9f2c1ab3d4e5f60718293a4b5c6d7e8f90a1b2c3",
  builtAt: "2026-08-25T14:32:00.000Z",
  uptime: 18_732.41,
  provider: "football-data",
};

test("a production body parses whole", () => {
  assert.deepEqual(parseHealth(LIVE_BODY), {
    status: "ok",
    sha: "9f2c1ab3d4e5f60718293a4b5c6d7e8f90a1b2c3",
    builtAt: "2026-08-25T14:32:00.000Z",
    uptime: 18_732.41,
    provider: "football-data",
  });
});

test("running from source there is no build time, and that parses too", () => {
  // `tsx` has no bundler to define __BUILD_TIME__, so the server sends null.
  const parsed = parseHealth({ ...LIVE_BODY, sha: "dev", builtAt: null });
  assert.equal(parsed?.sha, "dev");
  assert.equal(parsed?.builtAt, null);
});

test("only the status is required — the rest may simply be absent", () => {
  // A host still serving an older bundle answers the shape that build emitted.
  assert.deepEqual(parseHealth({ status: "ok" }), {
    status: "ok",
    sha: null,
    builtAt: null,
    uptime: null,
    provider: null,
  });
});

test("a body with no status is not an answer", () => {
  assert.equal(parseHealth({ sha: "abc1234", uptime: 12 }), null);
  assert.equal(parseHealth({ status: "" }), null);
  assert.equal(parseHealth({ status: 200 }), null);
});

test("a body that is not an object reads as nothing to show", () => {
  assert.equal(parseHealth(null), null);
  assert.equal(parseHealth(undefined), null);
  assert.equal(parseHealth("ok"), null);
  assert.equal(parseHealth(42), null);
});

test("fields of the wrong type are dropped, not carried through", () => {
  // Rendering `undefined` in the rodapé is the failure this prevents.
  const parsed = parseHealth({
    status: "ok",
    sha: 12345,
    builtAt: { at: "yesterday" },
    uptime: "18732",
    provider: [],
  });

  assert.deepEqual(parsed, {
    status: "ok",
    sha: null,
    builtAt: null,
    uptime: null,
    provider: null,
  });
});

test("a non-finite uptime is not an uptime", () => {
  assert.equal(parseHealth({ status: "ok", uptime: Number.NaN })?.uptime, null);
  assert.equal(parseHealth({ status: "ok", uptime: Number.POSITIVE_INFINITY })?.uptime, null);
  assert.equal(parseHealth({ status: "ok", uptime: 0 })?.uptime, 0);
});

test("a field this build does not know about rides along ignored", () => {
  const parsed = parseHealth({ ...LIVE_BODY, region: "sa-east-1" });
  assert.equal(parsed?.status, "ok");
  assert.equal("region" in (parsed ?? {}), false);
});

test("only ok is healthy", () => {
  assert.equal(isHealthy({ ...LIVE_BODY, status: "ok" }), true);
  assert.equal(isHealthy({ ...LIVE_BODY, status: "degraded" }), false);
});

test("an unrecognised status is shown verbatim rather than guessed at", () => {
  assert.equal(healthStatusLabel("ok"), "no ar");
  assert.equal(healthStatusLabel("degraded"), "degraded");
});

test("the provider is named, never claimed to be live", () => {
  // The health endpoint reports what is *configured*; whether the last upstream
  // request succeeded is the envelope's `source`, and the banner carries that.
  assert.equal(providerLabel("football-data"), "football-data.org");
  assert.equal(providerLabel("seed"), "dados locais");
});

test("an unmapped provider is shown verbatim, and an absent one omitted", () => {
  assert.equal(providerLabel("api-football"), "api-football");
  assert.equal(providerLabel(null), null);
});

test("a sha is shortened to what git log prints", () => {
  assert.equal(shortSha("9f2c1ab3d4e5f60718293a4b5c6d7e8f90a1b2c3"), "9f2c1ab");
  assert.equal(shortSha("9F2C1AB3D4E5F60718293A4B5C6D7E8F90A1B2C3"), "9f2c1ab");
  assert.equal(shortSha("9f2c1ab"), "9f2c1ab");
});

test("anything that is not a sha is passed through whole", () => {
  // The server answers "dev" from source. Truncating by luck rather than by
  // rule is how a branch name would one day render as its first seven letters.
  assert.equal(shortSha("dev"), "dev");
  assert.equal(shortSha("develop"), "develop");
  assert.equal(shortSha("v2.1.0"), "v2.1.0");
  assert.equal(shortSha(null), null);
});

test("a dirty build keeps its suffix", () => {
  // scripts/screenshot.ts refuses a capture whose sha ends in -dirty, so the
  // rodapé must not be the place that quietly hides one.
  assert.equal(shortSha("9f2c1ab3d4e5f6-dirty"), "9f2c1ab3d4e5f6-dirty");
});

test("uptime becomes the instant the process started", () => {
  const readAt = Date.parse("2026-08-26T09:00:00.000Z");
  assert.equal(startInstant(3600, readAt), "2026-08-26T08:00:00.000Z");
});

test("a process that started this instant is still an instant", () => {
  const readAt = Date.parse("2026-08-26T09:00:00.000Z");
  assert.equal(startInstant(0, readAt), "2026-08-26T09:00:00.000Z");
});

test("the answer holds still as the clock moves, which is the point", () => {
  // Rendered as an elapsed label it would differ between two captures of one
  // running process, and the home route is photographed full-page.
  const first = startInstant(3600, Date.parse("2026-08-26T09:00:00.000Z"));
  const later = startInstant(3900, Date.parse("2026-08-26T09:05:00.000Z"));
  assert.equal(first, later);
});

test("no uptime means no line", () => {
  assert.equal(startInstant(null, Date.now()), null);
});

test("a negative uptime is not a start time", () => {
  assert.equal(startInstant(-5, Date.parse("2026-08-26T09:00:00.000Z")), null);
});
