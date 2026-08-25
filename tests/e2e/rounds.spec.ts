import { expect, test, type Page } from "@playwright/test";

const goToJogos = async (page: Page) => {
  await page.getByRole("link", { name: /^Jogos/ }).click();
  await expect(page.getByRole("combobox", { name: "Rodada" })).toBeVisible();
};

const currentRound = async (page: Page) =>
  Number(await page.getByRole("combobox", { name: "Rodada" }).inputValue());

test.describe("Jogos", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await goToJogos(page);
  });

  test("opens on a round that has fixtures", async ({ page }) => {
    const round = await currentRound(page);

    expect(round).toBeGreaterThan(0);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(`${round}ª rodada`);
    expect(await page.locator("main ul > li").count()).toBeGreaterThan(0);
  });

  test("offers every round of the season", async ({ page }) => {
    const options = await page.getByRole("combobox", { name: "Rodada" }).locator("option").count();

    // A 20-club round robin is 38 rounds.
    expect(options).toBe(38);
  });

  test("the next control advances one round", async ({ page }) => {
    const before = await currentRound(page);
    await page.getByRole("button", { name: "Próxima rodada" }).click();

    expect(await currentRound(page)).toBe(before + 1);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(`${before + 1}ª rodada`);
  });

  test("the previous control goes back one round", async ({ page }) => {
    const before = await currentRound(page);
    await page.getByRole("button", { name: "Rodada anterior" }).click();

    expect(await currentRound(page)).toBe(before - 1);
  });

  test("selecting a round from the list jumps to it", async ({ page }) => {
    await page.getByRole("combobox", { name: "Rodada" }).selectOption("1");

    await expect(page.getByRole("heading", { level: 2 })).toHaveText("1ª rodada");
    expect(await page.locator("main ul > li").count()).toBeGreaterThan(0);
  });

  test("the previous control is disabled on the first round", async ({ page }) => {
    await page.getByRole("combobox", { name: "Rodada" }).selectOption("1");

    await expect(page.getByRole("button", { name: "Rodada anterior" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Próxima rodada" })).toBeEnabled();
  });

  test("the next control is disabled on the last round", async ({ page }) => {
    await page.getByRole("combobox", { name: "Rodada" }).selectOption("38");

    await expect(page.getByRole("button", { name: "Próxima rodada" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Rodada anterior" })).toBeEnabled();
  });

  test("an early round shows finished matches with scores", async ({ page }) => {
    await page.getByRole("combobox", { name: "Rodada" }).selectOption("1");

    const fixtures = page.locator("main ul > li");
    await expect(fixtures.first()).toContainText("Encerrado");
    // A finished fixture renders "home N × N away", not a bare "×".
    await expect(fixtures.first()).toContainText(/\d+\s*×\s*\d+/);
  });

  test("a late round shows unplayed fixtures without scores", async ({ page }) => {
    await page.getByRole("combobox", { name: "Rodada" }).selectOption("38");

    await expect(page.locator("main ul > li").first()).toContainText("A realizar");
  });

  test("the nav entry always lands on the current round", async ({ page }) => {
    // /jogos means "whatever is current", so the menu is a fixed destination
    // rather than a way back to the round you were last looking at. That is
    // what Back is for — see the routing spec.
    const current = await currentRound(page);
    await page.getByRole("combobox", { name: "Rodada" }).selectOption("3");
    await expect(page).toHaveURL(/\/jogos\/3$/);

    await page.getByRole("link", { name: /^Classificação/ }).click();
    await goToJogos(page);

    await expect(page).toHaveURL(/\/jogos$/);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(`${current}ª rodada`);
  });
});
