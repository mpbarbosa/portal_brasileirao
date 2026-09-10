import { expect, test } from "@/tests/e2e/clock";

/**
 * The client notices a new build and loads it.
 *
 * **Nothing else in the suite can see this feature**, and that is the reason
 * the spec exists rather than a preference for coverage. `tests/version-core.test.ts`
 * proves the judgement and cannot reach the wiring — the Vite `define`, the
 * `typeof __BUILD_SHA__` fallback, the hook being called at all — and the suite
 * boots a server whose sha *agrees* with the client's by construction (both are
 * `dev` under `tsx`, and both the stamped commit under `PLAYWRIGHT_TARGET=bundle`).
 * So the passing state is indistinguishable from the feature being deleted, in
 * every other spec, on both targets. Only a prepared payload can produce a
 * disagreement.
 *
 * The payload is fulfilled from memory rather than proxied per request, which
 * is `tests/e2e/meu-time.spec.ts`'s rule: a handler calling `route.fetch()` came
 * back as something other than the envelope under the suite's workers, and
 * passed in isolation.
 */

/** A health body of the shape `parseHealth` narrows, with a sha nobody built. */
const health = (sha: string | null) =>
  JSON.stringify({
    status: "ok",
    sha,
    builtAt: "2026-01-01T00:00:00Z",
    uptime: 12,
    node: "22.23.2",
    provider: "seed",
  });

/**
 * Count document loads across reloads.
 *
 * An init script runs again on every navigation the page makes, including one
 * the page makes to itself, so the counter is the only thing here that survives
 * what it is measuring. `sessionStorage` because the reload clears `window`.
 */
const countLoads = async (page: import("@/tests/e2e/clock").Page) => {
  await page.addInitScript(() => {
    const key = "spec:loads";
    const seen = Number(window.sessionStorage.getItem(key) ?? "0") + 1;
    window.sessionStorage.setItem(key, String(seen));
  });
};

/**
 * The count, read through a context the page may be about to throw away.
 *
 * **The reload this spec provokes can land in the middle of the read**, and
 * that was the flake — every red run of this file failed here, with
 * `page.evaluate: Execution context was destroyed`, never on an assertion. The
 * hook reloads the moment the stubbed health reading settles, which is a few
 * milliseconds after `goto` resolves at `commit`, so whether the first poll's
 * `evaluate` finishes before the old document goes is a race the test does not
 * control. Measured on unmodified `main` at 12 repeats a test: **3 of 96 runs**,
 * all in the `mobile` project, which loses the race more often.
 *
 * A destroyed context is therefore "not settled yet" and reads as 0, so the
 * poll asks again against the new document. **Only that error is absorbed** —
 * anything else still throws — and it cannot hide the regression the guard test
 * exists for: an endless reload leaves the final `toBe(2)` reading 0 or more
 * than 2, and fails either way.
 */
const loads = async (page: import("@/tests/e2e/clock").Page): Promise<number> => {
  try {
    return await page.evaluate(() => Number(window.sessionStorage.getItem("spec:loads") ?? "0"));
  } catch (error) {
    if (/Execution context was destroyed/.test(String(error))) return 0;
    throw error;
  }
};

test("a build the client is not running is loaded", async ({ page }) => {
  await countLoads(page);
  await page.route("**/api/health", (route) =>
    route.fulfill({ contentType: "application/json", body: health("f00dfeed") }),
  );

  // `commit` rather than the default: the reload can land while the first
  // navigation is still settling, and waiting for `load` would then fail as an
  // interrupted navigation — the feature working, reported as a broken page.
  await page.goto("/", { waitUntil: "commit" });

  await expect.poll(() => loads(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
});

test("the reload is spent once, even though the mismatch survives it", async ({ page }) => {
  await countLoads(page);
  await page.route("**/api/health", (route) =>
    route.fulfill({ contentType: "application/json", body: health("f00dfeed") }),
  );

  await page.goto("/", { waitUntil: "commit" });
  await expect.poll(() => loads(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);

  // The stub keeps answering the same foreign sha, so the second page is as
  // stale as the first was: the ONLY thing standing between it and an endless
  // reload is the marker. Without the guard this climbs without bound.
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("table")).toBeVisible();
  expect(await loads(page)).toBe(2);
});

test("a matching sha reloads nothing", async ({ page }) => {
  await countLoads(page);

  // What the suite's own server actually answers — the case every other spec in
  // the suite runs, asserted here so that "no reload" is a measured outcome
  // rather than the absence of one.
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("table")).toBeVisible();

  expect(await loads(page)).toBe(1);
});

test("a payload with no sha is not a difference", async ({ page }) => {
  await countLoads(page);
  await page.route("**/api/health", (route) =>
    route.fulfill({ contentType: "application/json", body: health(null) }),
  );

  // The shape a host serving a build older than this feature answers. Reading
  // absence as a difference would reload every reader of that deploy for ever.
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("table")).toBeVisible();

  expect(await loads(page)).toBe(1);
});
