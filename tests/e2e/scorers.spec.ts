import { expect, test, type Page } from "@/tests/e2e/clock";

const goToArtilharia = async (page: Page) => {
  await page.getByRole("link", { name: /^Artilharia/ }).click();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
};

test.describe("Artilharia", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await goToArtilharia(page);
  });

  test("lists scorers with the expected columns", async ({ page }) => {
    // Rendered text, so the `uppercase` class has already been applied —
    // innerText reflects text-transform, unlike textContent.
    const headers = await page.locator("table thead th").allInnerTexts();

    expect(headers.map((h) => h.trim())).toEqual(["#", "JOGADOR", "G", "A", "P", "J"]);
  });

  test("ranks rows densely from 1", async ({ page }) => {
    const positions = await page.locator("table tbody tr td:first-child").allInnerTexts();

    expect(positions.length).toBeGreaterThan(0);
    expect(positions.map((p) => Number(p.trim()))).toEqual(
      positions.map((_, index) => index + 1),
    );
  });

  test("goals never increase down the table", async ({ page }) => {
    const goals = (await page.locator("table tbody tr td:nth-child(3)").allInnerTexts()).map(
      (value) => Number(value.trim()),
    );

    for (let i = 1; i < goals.length; i++) {
      expect(goals[i]).toBeLessThanOrEqual(goals[i - 1]);
    }
  });

  test("every row names a player and a club", async ({ page }) => {
    for (const row of await page.locator("table tbody tr").all()) {
      // Element children, not spans: the name is a button when the card
      // drill-down is enabled and a span when it is not.
      const parts = row.locator("td:nth-child(2) > *");
      await expect(parts.nth(0)).not.toBeEmpty();
      await expect(parts.nth(1)).not.toBeEmpty();
    }
  });

  test("an unreported figure shows as a dash, never as zero", async ({ page }) => {
    // The upstream omits penalties for most players. Rendering that as 0 would
    // assert something the data does not say.
    const penalties = (
      await page.locator("table tbody tr td:nth-child(5)").allInnerTexts()
    ).map((value) => value.trim());

    expect(penalties.length).toBeGreaterThan(0);
    for (const value of penalties) {
      expect(value).toMatch(/^(\d+|—)$/);
    }
    expect(penalties).toContain("—");
  });

  test("explains its column abbreviations", async ({ page }) => {
    await expect(page.getByText(/G gols · A assistências/)).toBeVisible();
  });

  /**
   * The table fits a phone, and says so if it ever stops fitting.
   *
   * It used to carry `min-w-[32rem]` and scroll on every phone, with G, A, P
   * and J off to the right and nothing on the page saying they existed. These
   * cases hold both halves: the widths a reader actually has show every column
   * with no hint, and a table forced to overflow gets `TableScroller`'s fade
   * and chevron — which is the wiring, produced rather than hunted for, since
   * no real width overflows today.
   */
  const fade = (page: Page) => page.locator("[data-scroll-fade]");
  const more = (page: Page) => page.locator("[data-scroll-more]");
  const scroller = (page: Page) => page.locator("table").locator("..");

  for (const width of [320, 360, 375]) {
    test(`every column fits a ${width}px phone, so there is nothing to hint at`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });

      const geometry = await scroller(page).evaluate((el) => {
        const visibleRight = el.getBoundingClientRect().left + el.clientLeft + el.clientWidth;
        return {
          overflow: el.scrollWidth - el.clientWidth,
          cut: [...el.querySelectorAll("thead th")]
            .filter((th) => th.getBoundingClientRect().right > visibleRight + 1)
            .map((th) => th.textContent?.trim()),
        };
      });

      expect(geometry.cut).toEqual([]);
      expect(geometry.overflow).toBeLessThanOrEqual(0);
      await expect(fade(page)).toHaveCSS("opacity", "0");
      await expect(more(page)).toBeHidden();
    });
  }

  test("a table that does overflow says so, and its key stays put", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.locator("table").evaluate((table) => {
      table.style.minWidth = "40rem";
    });

    await expect(fade(page)).toHaveCSS("opacity", "1");
    await expect(more(page)).toBeVisible();

    // The key lives outside the scroller: scrolling the table must not carry it
    // off to the left.
    const key = page.getByText(/G gols · A assistências/);
    const before = (await key.boundingBox())!;
    await scroller(page).evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });

    await expect(fade(page)).toHaveCSS("opacity", "0");
    await expect(more(page)).toBeHidden();
    expect(Math.abs((await key.boundingBox())!.x - before.x)).toBeLessThan(1);
  });

  test("switching away and back keeps the table", async ({ page }) => {
    await page.getByRole("link", { name: /^Classificação/ }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(20);

    await goToArtilharia(page);
    await expect(page.locator("table thead th").nth(1)).toHaveText(/jogador/i);
  });
});
