import { expect, test, type Page } from "@playwright/test";

/**
 * These cover the *client* half: the browser tab following navigation. The
 * server injects the same values into the HTML it serves, which matters for
 * link previews and is covered by unit tests on `injectMeta` — the e2e suite
 * runs against the dev server, where Vite serves the shell untouched.
 */
const SM_BREAKPOINT = 640;
const isCollapsed = (page: Page) => (page.viewportSize()?.width ?? 0) < SM_BREAKPOINT;

const openMenuIfNeeded = async (page: Page) => {
  if (isCollapsed(page)) await page.getByRole("button", { name: /menu/i }).click();
};

const description = (page: Page) =>
  page.locator('meta[name="description"]').getAttribute("content");

test.describe("Título da página", () => {
  test("the table carries the site's own title", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("Portal Brasileirão — Campeonato Brasileiro Série A");
  });

  test("each section retitles the tab", async ({ page }) => {
    await page.goto("/");

    await openMenuIfNeeded(page);
    await page.getByRole("link", { name: /^Artilharia/ }).click();
    await expect(page).toHaveTitle("Artilharia · Portal Brasileirão");

    await openMenuIfNeeded(page);
    await page.getByRole("link", { name: /^Jogos/ }).click();
    await expect(page).toHaveTitle("Jogos · Portal Brasileirão");
  });

  test("a chosen round appears in the title", async ({ page }) => {
    await page.goto("/jogos");
    await page.getByRole("combobox", { name: "Rodada" }).selectOption("7");

    await expect(page).toHaveTitle("7ª rodada · Portal Brasileirão");
  });

  test("a deep-linked round is titled on arrival", async ({ page }) => {
    await page.goto("/jogos/12");

    await expect(page).toHaveTitle("12ª rodada · Portal Brasileirão");
  });

  test("a club page is titled by the club once its data arrives", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("table tbody tr")).toHaveCount(20);

    const row = page.locator("table tbody tr").first();
    const name = (await row.locator("td:nth-child(2) a").innerText()).trim();
    await row.locator("td:nth-child(2) a").click();

    await expect(page).toHaveTitle(`${name} · Portal Brasileirão`);
  });

  test("a match page names both clubs", async ({ page }) => {
    await page.goto("/jogos/24");
    await page.locator("main ul > li a").first().click();

    await expect(page).toHaveTitle(/ x .+ · Portal Brasileirão$/);
  });

  test("the description changes with the section", async ({ page }) => {
    await page.goto("/");
    const home = await description(page);

    await openMenuIfNeeded(page);
    await page.getByRole("link", { name: /^Artilharia/ }).click();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /goleadores/,
    );

    expect(await description(page)).not.toBe(home);
  });

  test("there is never more than one description tag", async ({ page }) => {
    await page.goto("/");
    await openMenuIfNeeded(page);
    await page.getByRole("link", { name: /^Artilharia/ }).click();
    await openMenuIfNeeded(page);
    await page.getByRole("link", { name: /^Jogos/ }).click();

    await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  });

  test("going back restores the previous title", async ({ page }) => {
    await page.goto("/");
    await openMenuIfNeeded(page);
    await page.getByRole("link", { name: /^Artilharia/ }).click();
    await expect(page).toHaveTitle("Artilharia · Portal Brasileirão");

    await page.goBack();

    await expect(page).toHaveTitle("Portal Brasileirão — Campeonato Brasileiro Série A");
  });

  test("an unknown route falls back to the site title", async ({ page }) => {
    await page.goto("/rota-que-nao-existe");

    await expect(page).toHaveTitle("Portal Brasileirão — Campeonato Brasileiro Série A");
  });
});
