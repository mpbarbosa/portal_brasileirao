import { expect, test, type Page } from "@playwright/test";

const SM_BREAKPOINT = 640;
const isCollapsed = (page: Page) => (page.viewportSize()?.width ?? 0) < SM_BREAKPOINT;

/** Open the club sitting at a given standings position. */
const openClubAt = async (page: Page, position: number) => {
  const row = page.locator("table tbody tr").nth(position - 1);
  const name = (await row.locator("td:nth-child(2) a").innerText()).trim();
  await row.locator("td:nth-child(2) a").click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(name);
  return name;
};

test.describe("Clube", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("table tbody tr")).toHaveCount(20);
  });

  test("club names are real links, not click handlers", async ({ page }) => {
    const links = page.locator("table tbody tr td:nth-child(2) a");

    await expect(links).toHaveCount(20);
    // A real href is what makes middle-click and "open in new tab" work.
    await expect(links.first()).toHaveAttribute("href", /^\/clube\/.+/);
  });

  test("choosing a club opens its page", async ({ page }) => {
    const name = await openClubAt(page, 1);

    await expect(page.getByRole("heading", { level: 2 })).toHaveText(name);
    await expect(page.locator("table")).toHaveCount(0);
  });

  test("the club page shows its standings summary", async ({ page }) => {
    await openClubAt(page, 1);

    // Scoped to main: "Jogos" is also a nav entry, so an unscoped lookup
    // matches the menu as well as the stat tile.
    const main = page.locator("main");
    for (const label of ["Posição", "Pontos", "Jogos", "Saldo"]) {
      await expect(main.getByText(label, { exact: true })).toBeVisible();
    }
    // Leader of the table.
    await expect(main.getByText("1º", { exact: true })).toBeVisible();
  });

  test("the form guide uses at most five results", async ({ page }) => {
    await openClubAt(page, 1);

    const chips = page.locator("main ul li").filter({ hasText: /^[VED]$/ });
    const count = await chips.count();

    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(5);
    for (const chip of await chips.all()) {
      await expect(chip).toHaveText(/^[VED]$/);
    }
  });

  test("the club page lists matches it actually played", async ({ page }) => {
    const name = await openClubAt(page, 1);

    const played = page.getByRole("heading", { name: "Jogos disputados" });
    await expect(played).toBeVisible();

    // Every listed fixture must involve this club.
    const fixtures = page.locator("main ul > li").filter({ hasText: "×" });
    expect(await fixtures.count()).toBeGreaterThan(0);
    for (const fixture of (await fixtures.all()).slice(0, 6)) {
      await expect(fixture).toContainText(name);
    }
  });

  test("going back returns to the table", async ({ page }) => {
    await openClubAt(page, 3);
    await page.getByRole("button", { name: "← Voltar" }).click();

    await expect(page.locator("table tbody tr")).toHaveCount(20);
  });

  test("a different club shows different data", async ({ page }) => {
    const first = await openClubAt(page, 1);
    await page.getByRole("button", { name: "← Voltar" }).click();
    const second = await openClubAt(page, 20);

    expect(second).not.toBe(first);
    await expect(page.locator("main").getByText("20º", { exact: true })).toBeVisible();
  });

  test("the nav still works from a club page", async ({ page }) => {
    await openClubAt(page, 5);

    if (isCollapsed(page)) await page.getByRole("button", { name: /menu/i }).click();
    await page.getByRole("link", { name: /^Artilharia/ }).click();

    await expect(page.locator("table thead th").nth(1)).toHaveText(/jogador/i);
  });

  test("no nav entry points at the club section", async ({ page }) => {
    // It is a drill-down: without a selected club it would render nothing.
    if (isCollapsed(page)) await page.getByRole("button", { name: /menu/i }).click();
    await expect(page.getByRole("link", { name: /^Clube$/ })).toHaveCount(0);
  });

  test("the next fixture links to its match page", async ({ page }) => {
    await openClubAt(page, 1);

    const next = page.locator("main ul > li a").first();
    await expect(next).toHaveAttribute("href", /^\/partida\/\d+$/);
  });

  test("a played fixture links to its match page", async ({ page }) => {
    await openClubAt(page, 1);

    const played = page.getByRole("heading", { name: "Jogos disputados" });
    await expect(played).toBeVisible();

    // Every fixture on the page is reachable, not only the upcoming one.
    const links = page.locator("main ul > li a[href^='/partida/']");
    expect(await links.count()).toBeGreaterThan(1);
  });

  test("choosing a fixture opens the match page", async ({ page }) => {
    const name = await openClubAt(page, 1);
    await page.locator("main ul > li a[href^='/partida/']").first().click();

    await expect(page).toHaveURL(/\/partida\/\d+$/);
    // The match involves the club we came from.
    await expect(page.locator("article")).toContainText(name);
  });
});
