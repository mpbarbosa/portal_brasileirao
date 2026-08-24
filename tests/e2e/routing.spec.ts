import { expect, test, type Page } from "@playwright/test";

const SM_BREAKPOINT = 640;
const isCollapsed = (page: Page) => (page.viewportSize()?.width ?? 0) < SM_BREAKPOINT;

const openMenuIfNeeded = async (page: Page) => {
  if (isCollapsed(page)) await page.getByRole("button", { name: /menu/i }).click();
};

test.describe("Rotas", () => {
  test("each section has its own address", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);

    await openMenuIfNeeded(page);
    await page.getByRole("link", { name: /^Jogos/ }).click();
    await expect(page).toHaveURL(/\/jogos$/);

    await openMenuIfNeeded(page);
    await page.getByRole("link", { name: /^Artilharia/ }).click();
    await expect(page).toHaveURL(/\/artilharia$/);
  });

  test("a deep link opens its section directly", async ({ page }) => {
    await page.goto("/artilharia");

    await expect(page.locator("table thead th").nth(1)).toHaveText(/jogador/i);

    // The nav marks the section as current — but below the breakpoint the
    // entries live behind the toggle, so open it before looking.
    await openMenuIfNeeded(page);
    await expect(page.getByRole("link", { name: /^Artilharia/ }).first()).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("a round has a shareable address", async ({ page }) => {
    await page.goto("/jogos/7");

    await expect(page.getByRole("heading", { level: 2 })).toHaveText("7ª rodada");
    await expect(page.getByRole("combobox", { name: "Rodada" })).toHaveValue("7");
  });

  test("a club has a shareable address", async ({ page }) => {
    await page.goto("/");
    const row = page.locator("table tbody tr").first();
    const name = (await row.locator("td:nth-child(2) a").innerText()).trim();
    const href = await row.locator("td:nth-child(2) a").getAttribute("href");

    await page.goto(href!);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(name);
  });

  test("back returns to the previous section", async ({ page }) => {
    await page.goto("/");
    await openMenuIfNeeded(page);
    await page.getByRole("link", { name: /^Artilharia/ }).click();
    await expect(page).toHaveURL(/\/artilharia$/);

    await page.goBack();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("table tbody tr")).toHaveCount(20);
  });

  test("forward returns to where back came from", async ({ page }) => {
    await page.goto("/");
    await openMenuIfNeeded(page);
    await page.getByRole("link", { name: /^Artilharia/ }).click();
    await page.goBack();
    await page.goForward();

    await expect(page).toHaveURL(/\/artilharia$/);
  });

  test("back reaches the round that was being viewed", async ({ page }) => {
    await page.goto("/jogos");
    await page.getByRole("combobox", { name: "Rodada" }).selectOption("5");
    await expect(page).toHaveURL(/\/jogos\/5$/);

    await openMenuIfNeeded(page);
    await page.getByRole("link", { name: /^Classificação/ }).click();
    await page.goBack();

    await expect(page).toHaveURL(/\/jogos\/5$/);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("5ª rodada");
  });

  test("back from a club page returns to the table", async ({ page }) => {
    await page.goto("/");
    await page.locator("table tbody tr").first().locator("td:nth-child(2) a").click();
    await expect(page).toHaveURL(/\/clube\/.+/);

    await page.goBack();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("table tbody tr")).toHaveCount(20);
  });

  test("an unknown path falls back to the table instead of erroring", async ({ page }) => {
    const response = await page.goto("/rota-que-nao-existe");

    expect(response?.status()).toBe(200);
    await expect(page.locator("table tbody tr")).toHaveCount(20);
  });

  test("a nonsense round still shows fixtures", async ({ page }) => {
    await page.goto("/jogos/abc");

    await expect(page.getByRole("heading", { level: 2 })).toHaveText(/\d+ª rodada/);
  });

  test("repeating the current section does not stack history entries", async ({ page }) => {
    await page.goto("/");
    await openMenuIfNeeded(page);
    await page.getByRole("link", { name: /^Artilharia/ }).click();
    await openMenuIfNeeded(page);
    await page.getByRole("link", { name: /^Artilharia/ }).click();

    // One Back must leave Artilharia, not merely undo a duplicate entry.
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });
});
