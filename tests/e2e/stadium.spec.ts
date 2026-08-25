import { expect, test, type Page } from "@playwright/test";

/**
 * A round whose fixtures carry venues in the frozen snapshot. Venues are
 * curated per match, so a round with none would make every test here vacuous.
 */
const VENUED_ROUND = "24";

/**
 * Reach a stadium page the way a reader does — through a fixture — rather than
 * by typing a slug.
 *
 * Deliberately does **not** name a stadium. `venues.ts` grows on every sync and
 * the snapshot ages, so asserting that the Maracanã in particular is reachable
 * would be asserting how much curated data exists, which has broken CI here
 * before. Any fixture with a venue is enough to exercise the page.
 */
const openStadiumFromMatch = async (page: Page) => {
  await page.goto(`/jogos/${VENUED_ROUND}`);

  const match = page.locator("main ul > li a[href^='/partida/']").first();
  await expect(match).toBeVisible();
  await match.click();
  await expect(page).toHaveURL(/\/partida\/\d+/);

  const venue = page.locator("main a[href^='/estadio/']").first();
  await expect(venue).toBeVisible();
  await venue.click();
  await expect(page).toHaveURL(/\/estadio\/[a-z0-9-]+/);
};

test.describe("the stadium page", () => {
  test("is reached from a match's Estádio line", async ({ page }) => {
    await openStadiumFromMatch(page);

    await expect(page.locator("main h2")).toBeVisible();
    await expect(page.locator("main [data-stadium]")).toHaveCount(1);
  });

  test("the venue line links only the ground, keeping city and state as text", async ({
    page,
  }) => {
    await page.goto(`/jogos/${VENUED_ROUND}`);
    const match = page.locator("main ul > li a[href^='/partida/']").first();
    await expect(match).toBeVisible();
    await match.click();

    // The whole line still reads "stadium · city – UF"; only the first part is
    // a control. Shape, never a specific ground.
    const line = page.locator("dd").filter({ hasText: "·" }).first();
    await expect(line).toContainText(/·/);
    await expect(line).toContainText(/–\s[A-Z]{2}$/);
    await expect(line.locator("a[href^='/estadio/']")).toHaveCount(1);
  });

  test("names the ground, where it is, and the fixtures played there", async ({ page }) => {
    await openStadiumFromMatch(page);

    const heading = page.locator("main h2");
    await expect(heading).not.toBeEmpty();

    // City – UF, directly under the name.
    await expect(page.locator("main header p").first()).toContainText(/–\s[A-Z]{2}$/);

    await expect(
      page.getByRole("heading", { name: "Jogos neste estádio", exact: true }),
    ).toBeVisible();
    await expect(page.locator("main ul > li a[href^='/partida/']").first()).toBeVisible();
  });

  test("lists the home club and links to it", async ({ page }) => {
    await openStadiumFromMatch(page);

    const mandante = page.getByRole("heading", { name: /^Mandantes?$/ });
    await expect(mandante).toBeVisible();

    const club = page.locator("main a[href^='/clube/']").first();
    await expect(club).toBeVisible();
    await club.click();
    await expect(page).toHaveURL(/\/clube\/[a-z0-9-]+/);
  });

  test("a deep link renders the page directly, without a match first", async ({ page }) => {
    // Read a real slug off a page rather than hardcoding one, so this does not
    // depend on which grounds the snapshot happens to carry.
    await openStadiumFromMatch(page);
    const url = page.url();

    await page.goto(url);
    await expect(page.locator("main [data-stadium]")).toHaveCount(1);
    await expect(page.locator("main h2")).not.toBeEmpty();
  });

  test("an unknown stadium says so rather than rendering an empty page", async ({ page }) => {
    await page.goto("/estadio/estadio-que-nao-existe");

    await expect(page.getByText("Estádio não encontrado.")).toBeVisible();
  });

  test("the tab title names the stadium", async ({ page }) => {
    await openStadiumFromMatch(page);

    const name = (await page.locator("main h2").innerText()).trim();
    await expect(page).toHaveTitle(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});
