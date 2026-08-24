import { expect, test } from "@playwright/test";

/**
 * The suite runs against the frozen snapshot (DISABLE_FOOTBALL_DATA=true), so
 * these assertions hold on any machine at any time. Nothing here may depend on
 * live scores or league positions.
 */
test.describe("Classificação", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for the table to finish populating before any test reads it.
    // allInnerTexts()/all() query immediately and do NOT auto-wait, unlike
    // expect(locator) — without this they sample a half-rendered table.
    await expect(page.locator("table tbody tr")).toHaveCount(20);
  });

  test("renders the full 20-club table", async ({ page }) => {
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(20);
  });

  test("numbers positions 1 through 20 in order", async ({ page }) => {
    const positions = await page.locator("table tbody tr td:first-child").allInnerTexts();

    expect(positions.map((value) => value.trim())).toEqual(
      Array.from({ length: 20 }, (_, index) => String(index + 1)),
    );
  });

  test("shows the Série A column headers", async ({ page }) => {
    const headers = await page.locator("table thead th").allInnerTexts();

    expect(headers.map((header) => header.trim())).toEqual([
      "#", "CLUBE", "P", "J", "V", "E", "D", "SG",
    ]);
  });

  test("lists Corinthians and Coritiba as separate clubs", async ({ page }) => {
    // Regression: both report tla "COR" upstream. Keying club identity on the
    // abbreviation merged them into a single row.
    // First element child of the club cell: a button when the drill-down is
    // enabled, a span when it is not.
    const names = page.locator("table tbody tr td:nth-child(2) > :first-child");

    await expect(names.filter({ hasText: /^Corinthians$/ })).toHaveCount(1);
    await expect(names.filter({ hasText: /^Coritiba$/ })).toHaveCount(1);
  });

  test("uses the corrected club display names, not the upstream ones", async ({ page }) => {
    // First element child of the club cell: a button when the drill-down is
    // enabled, a span when it is not.
    const names = page.locator("table tbody tr td:nth-child(2) > :first-child");

    await expect(names.filter({ hasText: /^Atlético-MG$/ })).toHaveCount(1);
    await expect(names.filter({ hasText: /^Athletico-PR$/ })).toHaveCount(1);
    // The upstream shortNames these replace.
    await expect(names.filter({ hasText: /^Mineiro$/ })).toHaveCount(0);
    await expect(names.filter({ hasText: /^Paranaense$/ })).toHaveCount(0);
  });

  test("points are consistent with wins and draws for every club", async ({ page }) => {
    const rows = await page.locator("table tbody tr").all();

    for (const row of rows) {
      const cells = await row.locator("td").allInnerTexts();
      const [, , points, , wins, draws] = cells.map((cell) => cell.trim());

      expect(Number(points)).toBe(Number(wins) * 3 + Number(draws));
    }
  });

  test("goal difference is signed", async ({ page }) => {
    const values = await page.locator("table tbody tr td:last-child").allInnerTexts();

    for (const value of values) {
      expect(value.trim()).toMatch(/^[+-]?\d+$/);
    }
  });
});
