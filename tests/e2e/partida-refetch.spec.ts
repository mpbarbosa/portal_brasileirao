import { test, expect, type Page } from "@playwright/test";

import { SEED_MATCHES, SNAPSHOT_DATE } from "@/src/data/matches";
import type { Match } from "@/src/types";

/**
 * The **Partida** page keeps asking while its fixture is unsettled.
 *
 * Written after an incident where upstream reported a finished match as
 * SCHEDULED for about five hours: a reader who landed on the page during that
 * window stayed on the wrong answer until they reloaded by hand, because every
 * view but **Ao vivo** was a snapshot of whatever arrived when the app loaded.
 *
 * **This file installs its own clock instead of using `@/tests/e2e/clock`, and
 * that is the deviation to understand before copying it.** The shared fixture
 * uses `setFixedTime` deliberately — the full fake replaces the timer queue, so
 * `setTimeout` stops firing until a test ticks it, which would hang `useNow`,
 * the transitions `motion.spec.ts` asserts on, and `networkidle`. But a poll on
 * a 60s interval cannot be observed without moving time, and waiting a real
 * minute per assertion is not a suite. So this one route takes the full fake and
 * pays the price knowingly: nothing on the Partida route calls `useNow`,
 * `networkidle` is never awaited here, and the clock stays inside this file.
 */
const E2E_NOW = new Date(`${SNAPSHOT_DATE}T12:00:00.000Z`);

/**
 * Both fixtures are **derived from the committed data, not written down** —
 * `clock.ts`'s rule for `E2E_NOW`, and for the same reason.
 *
 * They were the literals `554970` and `554981`, the second described as "round
 * 25, days out". True when written; the first `sync-seed-data` after round 25
 * was played turned it into a FINISHED fixture, so `a fixture days away is not
 * polled` opened a page whose chip reads *Encerrado* and failed on the
 * assertion before the one it exists for. Its sibling survived only because its
 * own state is imposed by the prepared payload rather than read from the seed —
 * so one of the two literals was already load-bearing and the other was not,
 * and nothing said which.
 */
const settled = (match: Match) => match.status === "FINISHED" && match.homeGoals !== null;

/**
 * Kickoff already past at `E2E_NOW`, which is the regression's shape. Its
 * status is overridden by `serve`, so all this has to be is a fixture the clock
 * has gone past — the most recent one there is.
 */
const STUCK = [...SEED_MATCHES]
  .filter((match) => Date.parse(match.kickoff) < E2E_NOW.getTime())
  .sort((a, b) => Date.parse(b.kickoff) - Date.parse(a.kickoff))[0]!.id;

/**
 * The half that stops every match page polling for ever, so this one must be
 * genuinely far off: the **latest kickoff in the season that has not been
 * played**, which is as far from `isAwaitingResult`'s one-day window as the
 * fixture list goes.
 */
const DISTANT = [...SEED_MATCHES]
  .filter((match) => !settled(match))
  .sort((a, b) => Date.parse(b.kickoff) - Date.parse(a.kickoff))[0]!.id;

interface Payload {
  rounds: number[];
  currentRound: number | null;
  matches: Match[];
  clubs: unknown[];
}

/**
 * Serve one prepared payload per call, from memory.
 *
 * **Never `route.fetch()` per request**, which is what `meu-time.spec.ts`
 * records: a proxying handler came back as something other than the envelope
 * under the suite's seven workers, and passed in isolation. The real payload is
 * read exactly once, here, before any interception is installed.
 */
const serve = async (page: Page, id: string, after: Partial<Match>) => {
  const base = await (await page.request.get("/api/matches")).json();
  const shape = (over: Partial<Match>): string =>
    JSON.stringify({
      ...base,
      data: {
        ...base.data,
        matches: (base.data as Payload).matches.map((m) =>
          m.id === id ? { ...m, ...over } : m,
        ),
      },
    });

  const before = shape({ status: "SCHEDULED", homeGoals: null, awayGoals: null });
  const settled = shape(after);

  let calls = 0;
  let flipped = false;
  await page.route("**/api/matches*", async (route) => {
    calls += 1;
    await route.fulfill({
      contentType: "application/json",
      body: flipped ? settled : before,
    });
  });

  // A flag rather than a call count: React mounts effects twice under
  // StrictMode, so "the second request" is not a thing a test can name. This
  // also makes the assertion stronger — only a request issued *after* the flip
  // can see the settled payload, so the page updating is proof it asked again.
  return { calls: () => calls, flip: () => { flipped = true; } };
};

const chip = (page: Page) => page.locator("main [data-status]").first();

test.describe("A Partida se atualiza sozinha", () => {
  test("a fixture that finishes while the page is open stops saying 'A realizar'", async ({
    page,
  }) => {
    await page.clock.install({ time: E2E_NOW });
    const api = await serve(page, STUCK, {
      status: "FINISHED",
      homeGoals: 2,
      awayGoals: 1,
    });

    await page.goto(`/partida/${STUCK}`);
    await expect(chip(page)).toHaveText("A realizar");

    // The match ends while the reader is sitting on the page.
    api.flip();
    const before = api.calls();

    // Past the 60s cadence the app uses when nothing is LIVE.
    await page.clock.runFor(65_000);

    // No reload anywhere in this test: the page asked again on its own.
    await expect(chip(page)).toHaveText("Encerrado");
    await expect(page.locator("main")).toContainText("2");
    expect(api.calls()).toBeGreaterThan(before);
  });

  /**
   * The other half, and the one that protects the request budget: without it
   * every match page ever opened would poll for ever, including fixtures
   * decided months ago.
   */
  test("a fixture days away is not polled", async ({ page }) => {
    await page.clock.install({ time: E2E_NOW });
    const api = await serve(page, DISTANT, { status: "FINISHED" });

    await page.goto(`/partida/${DISTANT}`);
    await expect(chip(page)).toHaveText("A realizar");
    const before = api.calls();

    api.flip();
    await page.clock.runFor(180_000);

    // Three minutes of clock, three cadences' worth, and it never asked — so
    // the flipped payload is still unseen and the chip has not moved.
    expect(api.calls()).toBe(before);
    await expect(chip(page)).toHaveText("A realizar");
  });
});
