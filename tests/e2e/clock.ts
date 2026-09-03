import { SNAPSHOT_DATE } from "@/src/data/matches";
import { test as offline } from "@/tests/e2e/fixtures";

/**
 * The instant every end-to-end test runs at.
 *
 * **Derived from `SNAPSHOT_DATE`, never written down.** The suite runs against
 * the frozen snapshot, and that snapshot describes one moment: fixtures before
 * it are FINISHED, fixtures after it are SCHEDULED. Running the browser at
 * *today* asks the app to reason about a world its data does not describe, and
 * the gap widens by a day every day. Tying the clock to the data means a
 * `sync-seed-data` run moves both together and nobody has to remember to.
 *
 * Midday rather than midnight, so a test that adds or subtracts a few hours
 * stays on the same calendar day in both `America/Sao_Paulo` (the context's
 * timezone) and UTC.
 */
export const E2E_NOW = new Date(`${SNAPSHOT_DATE}T12:00:00.000Z`);

/**
 * Freeze the page's clock, for the whole suite.
 *
 * **`setFixedTime`, never `install`.** The full fake replaces the timer queue
 * as well, so `setTimeout` stops firing until a test ticks it by hand — which
 * would hang `useNow`, every CSS transition this suite asserts on in
 * `motion.spec.ts`, and `waitUntil: "networkidle"`. `setFixedTime` changes only
 * what `Date.now()` and `new Date()` answer, which is the whole of what the app
 * reads the clock for: `currentRound`, `liveBoard`, `countdownLabel` and
 * `clubFocus` all take `now` as a parameter, per the core-module rule.
 *
 * It is a **fixture rather than a `beforeEach` per file** so a spec written
 * tomorrow gets it without anybody remembering. That costs one import line in
 * every spec file — `@/tests/e2e/clock` instead of `@playwright/test` — which
 * is the price of not having the next date-dependent spec quietly stop running.
 *
 * The failure this closes was live and had started four hours before it was
 * found: `meu-time.spec.ts` skips when the snapshot's soonest unplayed fixture
 * is in the past, and that fixture (2026-08-29T21:30Z) had just slipped behind
 * a real clock reading 2026-08-30T01:27Z. Two specs across two projects went
 * quiet, the suite still said `690 passed`, and the only trace was a `4 skipped`
 * line nobody reads.
 */
export const test = offline.extend({
  page: async ({ page }, use) => {
    // Before any navigation: an init script installed after `goto` reaches the
    // next document, not the one under test.
    await page.clock.setFixedTime(E2E_NOW);
    await use(page);
  },
});

/** Re-exported from the base fixture, so no spec has a reason to reach for
 *  `@playwright/test` directly — see `tests/e2e-fixture.test.ts`. */
export { expect, type Page, type Locator } from "@/tests/e2e/fixtures";
