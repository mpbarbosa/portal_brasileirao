import { expect, test, type Page } from "@playwright/test";

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

  test("switching away and back keeps the table", async ({ page }) => {
    await page.getByRole("link", { name: /^Classificação/ }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(20);

    await goToArtilharia(page);
    await expect(page.locator("table thead th").nth(1)).toHaveText(/jogador/i);
  });
});
