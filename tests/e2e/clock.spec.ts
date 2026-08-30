import { E2E_NOW, expect, test } from "@/tests/e2e/clock";

import { SNAPSHOT_DATE } from "@/src/data/matches";

/**
 * The clock fixture, tested — because nothing else would notice if it stopped
 * working.
 *
 * Everything else in this suite passes whether or not the page's clock is
 * frozen: `meu-time.spec.ts` is guarded in Node, and the rest assert shape
 * rather than dates. So a `setFixedTime` that silently did nothing would leave
 * the suite entirely green while the immunity it was added for was gone. That
 * is the same green-means-nothing shape as the `page.route` stub that passed
 * against the bug it named, and it is why these three exist.
 */
test.describe("Relógio da suíte", () => {
  test("the page's clock is the snapshot's, not the wall clock", async ({ page }) => {
    await page.goto("/");

    const inPage = await page.evaluate(() => Date.now());

    expect(inPage).toBe(E2E_NOW.getTime());
    // And it really is frozen away from now — a fixture anchored to `new Date()`
    // would satisfy the line above and nothing else.
    expect(Math.abs(Date.now() - inPage)).toBeGreaterThan(60_000);
  });

  test("the instant is derived from the seed, so a re-sync moves both", async () => {
    // Hard-coding an instant here is the thing this is built to avoid: the
    // snapshot is regenerated, and a date written down separately goes stale
    // exactly the way the four skipped specs did.
    expect(E2E_NOW.toISOString().slice(0, 10)).toBe(SNAPSHOT_DATE);
  });

  test("timers still run, so transitions and polling are unaffected", async ({ page }) => {
    await page.goto("/");

    // `setFixedTime` freezes what the clock *reads*; `install` would freeze the
    // timer queue as well and hang `useNow`, every CSS transition
    // `motion.spec.ts` asserts on, and `waitUntil: "networkidle"`.
    const fired = await page.evaluate(
      () => new Promise((resolve) => setTimeout(() => resolve(true), 50)),
    );

    expect(fired).toBe(true);
  });
});
