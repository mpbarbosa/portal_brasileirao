import { expect, test, type Page } from "@/tests/e2e/clock";

/**
 * The **Seta de mais conteúdo** on the Classificação.
 *
 * Asserted through `data-more-below` rather than through opacity, for the reason
 * `elevation.spec.ts` gives: the arrow fades, and a computed style read right
 * after the state changes samples the transition at t=0.
 *
 * The load-bearing case is the first one. The page is short until
 * `/api/standings` lands, so a hook reading only on mount and on scroll finds
 * nothing below and never corrects itself — the arrow would be missing on every
 * ordinary load while each scroll-driven spec still passed.
 */

const hint = "button[data-more-below]";

const openTable = async (page: Page) => {
  await page.goto("/");
  await expect(page.locator("table tbody tr")).toHaveCount(20);
};

test("appears at the top of the Classificação once the table has landed", async ({ page }) => {
  await openTable(page);
  await expect(page.locator(hint)).toHaveAttribute("data-more-below", "true");
  await expect(page.locator(hint)).toHaveAccessibleName("Ver mais abaixo");
});

test("leaves once the reader scrolls, and returns at the top", async ({ page }) => {
  await openTable(page);
  await expect(page.locator(hint)).toHaveAttribute("data-more-below", "true");

  await page.evaluate(() => window.scrollTo(0, 200));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(page.locator(hint)).toHaveAttribute("data-more-below", "false");

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator(hint)).toHaveAttribute("data-more-below", "true");
});

test("a press moves the page down", async ({ page }) => {
  await openTable(page);
  await expect(page.locator(hint)).toHaveAttribute("data-more-below", "true");

  await page.locator(hint).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(page.locator(hint)).toHaveAttribute("data-more-below", "false");
});

test("a hidden arrow takes no press and no focus", async ({ page }) => {
  await openTable(page);
  await expect(page.locator(hint)).toHaveAttribute("data-more-below", "true");
  const box = (await page.locator(hint).boundingBox())!;

  await page.evaluate(() => window.scrollTo(0, 200));
  await expect(page.locator(hint)).toHaveAttribute("data-more-below", "false");

  // Fixed, so the same viewport point still holds its box. A transparent button
  // still answers `elementFromPoint`; `inert` is what removes it, since an inert
  // node hit-tests as `pointer-events: none`.
  const hit = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest("[data-more-below]") != null,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(hit).toBe(false);
  await expect(page.locator(hint)).toHaveAttribute("inert", "");
});

test("sits clear of the navigation bar on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openTable(page);
  await expect(page.locator(hint)).toHaveAttribute("data-more-below", "true");

  const arrow = (await page.locator(hint).boundingBox())!;
  const bar = (await page.locator("nav.fixed").boundingBox())!;
  expect(arrow.y + arrow.height).toBeLessThan(bar.y);
});

test("stays away when the whole page already fits on the screen", async ({ page }) => {
  // Tall enough to hold the entire Classificação with its sections below, so
  // there is nothing to point at. The height is checked rather than trusted.
  await page.setViewportSize({ width: 1280, height: 6000 });
  await openTable(page);
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight),
  ).toBe(true);
  await expect(page.locator(hint)).toHaveAttribute("data-more-below", "false");
});

test("belongs to the Classificação only", async ({ page }) => {
  await page.goto("/jogos");
  await expect(page.locator("main select").first()).toBeVisible();
  await expect(page.locator(hint)).toHaveCount(0);
});
