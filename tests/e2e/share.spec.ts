import { expect, test, type Page } from "@/tests/e2e/clock";

/**
 * **Compartilhar**, in the top app bar.
 *
 * Headless Chromium has neither a platform share sheet nor, by default, a
 * clipboard the page may write to, so the button would render nowhere and every
 * case below would pass against its absence. Each case therefore **installs**
 * the API it is about before the page loads, and records what the page asked of
 * it. That is a stub standing in for the browser's own UI, which a test cannot
 * reach, and not for anything this app computes: the branch taken and the
 * payload handed over are the app's.
 */

const SHARE = "header [data-share]";
const FEEDBACK = "[data-share-feedback]";

type Recorded = { shared: unknown[]; copied: string[] };

const install = (page: Page, api: { share?: "ok" | "abort"; clipboard?: boolean }) =>
  page.addInitScript((api) => {
    const w = window as unknown as { __recorded: Recorded };
    w.__recorded = { shared: [], copied: [] };
    const nav = navigator as unknown as Record<string, unknown>;
    // Delete first, so a browser that does have one cannot answer for the stub.
    Object.defineProperty(Navigator.prototype, "share", { value: undefined, configurable: true });
    Object.defineProperty(Navigator.prototype, "canShare", { value: undefined, configurable: true });
    if (api.share) {
      Object.defineProperty(nav, "share", {
        configurable: true,
        value: async (data: unknown) => {
          w.__recorded.shared.push(data);
          if (api.share === "abort") throw new DOMException("closed", "AbortError");
        },
      });
    }
    Object.defineProperty(nav, "clipboard", {
      configurable: true,
      value: api.clipboard
        ? { writeText: async (text: string) => void w.__recorded.copied.push(text) }
        : {},
    });
  }, api);

const recorded = (page: Page) =>
  page.evaluate(() => (window as unknown as { __recorded: Recorded }).__recorded);

test.describe("Compartilhar", () => {
  test("hands the page's own address and title to the platform sheet", async ({ page }) => {
    await install(page, { share: "ok", clipboard: true });
    await page.goto("/clube/palmeiras");
    await expect(page).toHaveTitle(/Palmeiras/);

    const button = page.locator(SHARE);
    await expect(button).toHaveAccessibleName("Compartilhar esta página");
    await button.click();

    await expect.poll(async () => (await recorded(page)).shared.length).toBe(1);
    const { shared, copied } = await recorded(page);
    const data = shared[0] as { title: string; url: string };
    expect(new URL(data.url).pathname).toBe("/clube/palmeiras");
    expect(data.title).toBe(await page.title());
    expect(copied, "the clipboard must not be written when the sheet opened").toEqual([]);
    // The sheet was the feedback; a snackbar after it would repeat it.
    await expect(page.locator(FEEDBACK)).toHaveText("");
  });

  test("closing the sheet is not reported as a failure", async ({ page }) => {
    await install(page, { share: "abort", clipboard: true });
    await page.goto("/");
    await page.locator(SHARE).click();

    await expect.poll(async () => (await recorded(page)).shared.length).toBe(1);
    await expect(page.locator(FEEDBACK)).toHaveText("");
  });

  test("copies the link and says so where there is no sheet", async ({ page }) => {
    await install(page, { clipboard: true });
    await page.goto("/jogos");
    await page.locator(SHARE).click();

    await expect(page.locator(FEEDBACK)).toHaveText("Link copiado");
    const { copied } = await recorded(page);
    expect(copied).toHaveLength(1);
    expect(new URL(copied[0]).pathname).toBe("/jogos");
  });

  test("renders nothing where the page can neither share nor copy", async ({ page }) => {
    await install(page, {});
    await page.goto("/");
    await expect(page.locator("header button[aria-label^='Ativar tema']")).toBeVisible();
    await expect(page.locator(SHARE)).toHaveCount(0);
  });

  test("hides below 360dp, where the app's name would be cut", async ({ page }) => {
    await install(page, { clipboard: true });
    for (const [width, shown] of [
      [320, false],
      [359, false],
      [360, true],
      [1280, true],
    ] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      const button = page.locator(SHARE);
      if (shown) await expect(button, `at ${width}px`).toBeVisible();
      else await expect(button, `at ${width}px`).toBeHidden();
    }
  });

  test("the snackbar sits on the screen, not inside the header", async ({ page }) => {
    // The header's `backdrop-filter` makes it the containing block for `fixed`
    // descendants, so a snackbar rendered in place is pinned to the header's
    // bottom edge — the reason it is portalled. Asserted by position.
    await install(page, { clipboard: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.locator(SHARE).click();

    const snackbar = page.locator(`${FEEDBACK} span`);
    await expect(snackbar).toHaveText("Link copiado");
    const box = await snackbar.boundingBox();
    const header = await page.locator("header").boundingBox();
    expect(box!.y, "the snackbar should be near the bottom of the screen").toBeGreaterThan(812 / 2);
    expect(box!.y).toBeGreaterThan(header!.y + header!.height);
  });
});
