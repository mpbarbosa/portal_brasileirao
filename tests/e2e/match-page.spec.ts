import { expect, test, type Page } from "@playwright/test";

/**
 * Rounds are chosen for what they contain, and are stable because the data is
 * committed: 24 has finished matches with goals, 25 is entirely still to come.
 */
const PLAYED_ROUND = "24";
const UPCOMING_ROUND = "25";

const openFirstMatch = async (page: Page, round: string) => {
  await page.goto(`/jogos/${round}`);
  const first = page.locator("main ul > li a").first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/\/partida\/\d+/);
};

test.describe("Página da partida", () => {
  test("a fixture in the round list links to its own page", async ({ page }) => {
    await page.goto(`/jogos/${UPCOMING_ROUND}`);

    const link = page.locator("main ul > li a").first();
    await expect(link).toHaveAttribute("href", /^\/partida\/\d+$/);
  });

  test("the page shows the round and the status", async ({ page }) => {
    await openFirstMatch(page, UPCOMING_ROUND);

    await expect(page.getByText(/\d+ª rodada/)).toBeVisible();
    await expect(page.getByText(/(A realizar|Ao vivo|Encerrado|Adiado|Cancelado)/)).toBeVisible();
  });

  test("an upcoming match shows kickoff, stadium and where to watch", async ({ page }) => {
    await openFirstMatch(page, UPCOMING_ROUND);

    await expect(page.getByText("Data e hora")).toBeVisible();
    await expect(page.getByText("Estádio")).toBeVisible();
    await expect(page.getByText("Onde assistir")).toBeVisible();
  });

  test("the venue reads as stadium, city and state", async ({ page }) => {
    await openFirstMatch(page, UPCOMING_ROUND);

    const venue = page.locator("dd").filter({ hasText: "·" }).first();
    await expect(venue).toContainText(/·/);
    await expect(venue).toContainText(/–\s[A-Z]{2}$/);
  });

  test("an upcoming match offers no goals link", async ({ page }) => {
    // Nothing has been scored yet.
    await openFirstMatch(page, UPCOMING_ROUND);

    await expect(page.getByRole("link", { name: /Procurar os gols/ })).toHaveCount(0);
  });

  test("a finished match offers a goals link", async ({ page }) => {
    await openFirstMatch(page, PLAYED_ROUND);

    const goals = page.getByRole("link", { name: /Procurar os gols/ });
    await expect(goals).toBeVisible();
    await expect(goals).toHaveAttribute("href", /youtube\.com\/results\?search_query=/);
  });

  test("the goals link opens safely in a new tab", async ({ page }) => {
    await openFirstMatch(page, PLAYED_ROUND);

    const goals = page.getByRole("link", { name: /Procurar os gols/ });
    await expect(goals).toHaveAttribute("target", "_blank");
    // Without noopener the opened page can reach back into this one.
    await expect(goals).toHaveAttribute("rel", /noopener/);
  });

  test("the goals link is honest about being a search", async ({ page }) => {
    await openFirstMatch(page, PLAYED_ROUND);

    await expect(page.getByText(/não é um vídeo oficial/)).toBeVisible();
  });

  test("a finished match shows its score", async ({ page }) => {
    await openFirstMatch(page, PLAYED_ROUND);

    await expect(page.locator("article").getByText(/\d+\s*×\s*\d+/)).toBeVisible();
  });

  test("each club on the scoreboard links to its page", async ({ page }) => {
    await openFirstMatch(page, UPCOMING_ROUND);

    const clubLinks = page.locator("article a[href^='/clube/']");
    await expect(clubLinks).toHaveCount(2);

    await clubLinks.first().click();
    await expect(page).toHaveURL(/\/clube\/.+/);
  });

  test("an unknown match id says so rather than erroring", async ({ page }) => {
    await page.goto("/partida/000000");

    await expect(page.getByText("Partida não encontrada.")).toBeVisible();
  });

  test("the page is reachable directly and survives a reload", async ({ page }) => {
    await openFirstMatch(page, PLAYED_ROUND);
    const url = page.url();

    await page.reload();

    await expect(page).toHaveURL(url);
    await expect(page.getByText("Data e hora")).toBeVisible();
  });

  test("back returns to the fixtures", async ({ page }) => {
    await openFirstMatch(page, PLAYED_ROUND);
    await page.getByRole("button", { name: "← Voltar" }).click();

    await expect(page.getByRole("combobox", { name: "Rodada" })).toBeVisible();
  });
});
