import { expect, test, type Page } from "@playwright/test";

/**
 * MD3 elevation, and the one part of it that is a behaviour rather than a look.
 *
 * The dialogs and the navigation bar simply carry a level; nothing can go wrong
 * there that `tests/design-tokens-core.test.ts` does not already catch, since a
 * missing `shadow-level-*` is a missing class and a wrong one is a forbidden
 * Tailwind utility.
 *
 * The **top app bar** is different: it is level 0 at rest and level 2 once
 * content scrolls beneath it, so there is a state, a listener and a way for the
 * two to come apart. `useScrolled` reads on mount as well as on scroll, and a
 * page restored part-way down never fires the event — a bug this file can see
 * and no unit test can.
 *
 * Asserted through `data-scrolled` rather than through the computed
 * `box-shadow`. That is not a shortcut: the header carries a `transition`, and
 * reading a computed style immediately after the state changes samples the
 * animation at t=0 and reports the value it is *leaving* — the reading trap M2
 * recorded twice, once as "the state layer does not work" and once as "the
 * focus ring is the wrong colour". Both were the measurement.
 */

const header = "header[data-scrolled]";

/**
 * Scroll, and prove it moved.
 *
 * The page is short until `/api/standings` lands, so a `scrollTo` issued
 * straight after `goto` silently does nothing and the bar stays at rest — which
 * reads as "the elevation is broken" and is really "there was nothing to
 * scroll". Two of these specs failed that way before the wait was added.
 *
 * The document is only about 1085px against a 720px viewport, so the maximum
 * scroll here is ~365px: ask for more than that and the browser clamps, which
 * is fine as long as nothing asserts the exact offset.
 */
const scrollDown = async (page: Page) => {
  await expect(page.locator("table tbody tr").first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
};

test("the top app bar is at rest when the page is at the top", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(header)).toHaveAttribute("data-scrolled", "false");
});

test("the top app bar rises once content scrolls beneath it", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(header)).toHaveAttribute("data-scrolled", "false");

  await scrollDown(page);
  await expect(page.locator(header)).toHaveAttribute("data-scrolled", "true");

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator(header)).toHaveAttribute("data-scrolled", "false");
});

/**
 * `useScrolled` reads once on mount as well as on scroll, and **this suite
 * cannot reach that read** — which is worth stating rather than covering with a
 * test that passes for the wrong reason.
 *
 * The obvious spec is to scroll, reload, and assert the bar comes back raised.
 * Chromium restores a scroll position only while the document is tall enough to
 * hold it, and this app's content arrives from `/api/standings` *after* load, so
 * restoration finds a short page and gives up. Measured: scrolled to 365,
 * reloaded, `window.scrollY` was **0**. The test would then assert the at-rest
 * state and pass, saying nothing about the mount read at all.
 *
 * The read still earns its line for the case the suite cannot stage: a reader
 * scrolling on a slow phone before hydration finishes fires the scroll event
 * before the listener exists, and without it the bar stays flat until the next
 * gesture.
 */

test("the raised bar actually paints a shadow", async ({ page }) => {
  // The attribute says what the app believes; this says the belief reaches the
  // page. A class that compiles to nothing is the failure M5 met head-on, and
  // from the DOM it looks identical to one that works.
  await page.goto("/");
  await scrollDown(page);
  await expect(page.locator(header)).toHaveAttribute("data-scrolled", "true");

  const shadow = await page
    .locator(header)
    .evaluate((el) => getComputedStyle(el).boxShadow);

  expect(shadow).not.toBe("none");
});

test("the navigation bar carries its level on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const shadow = await page
    .locator("nav.fixed")
    .evaluate((el) => getComputedStyle(el).boxShadow);

  expect(shadow).not.toBe("none");
});
