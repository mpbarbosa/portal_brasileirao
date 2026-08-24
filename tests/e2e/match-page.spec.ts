import { expect, test, type Page } from "@playwright/test";

/**
 * Rounds are chosen for what they contain, and are stable because the data is
 * committed: 24 has finished matches with goals, 25 is entirely still to come.
 */
const PLAYED_ROUND = "24";
const UPCOMING_ROUND = "25";

/** The one entry in goal-videos.ts, so the fallback tests must avoid it. */
const CURATED_MATCH = "554975";

/**
 * Open a finished fixture that has goals but no curated video, so the search
 * fallback is what renders. Curating another match must not silently turn these
 * into tests of the wrong branch — hence walking rather than hard-coding an id.
 */
const openMatchWithoutVideo = async (page: Page) => {
  await page.goto(`/jogos/${PLAYED_ROUND}`);
  const links = page.locator("main ul > li a[href^='/partida/']");
  // evaluateAll queries immediately — without this it reads an empty list and
  // the loop below concludes, wrongly, that every fixture is curated.
  await expect(links.first()).toBeVisible();

  const hrefs = await links.evaluateAll((all) =>
    all.map((a) => a.getAttribute("href") ?? ""),
  );

  for (const href of hrefs) {
    if (href.endsWith(`/${CURATED_MATCH}`)) continue;
    await page.goto(href);
    if (await page.getByRole("link", { name: /Procurar os gols/ }).count()) return;
  }

  throw new Error("no finished fixture without a curated video was found");
};

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
    await openMatchWithoutVideo(page);

    const goals = page.getByRole("link", { name: /Procurar os gols/ });
    await expect(goals).toBeVisible();
    await expect(goals).toHaveAttribute("href", /youtube\.com\/results\?search_query=/);
  });

  test("the goals link opens safely in a new tab", async ({ page }) => {
    await openMatchWithoutVideo(page);

    const goals = page.getByRole("link", { name: /Procurar os gols/ });
    await expect(goals).toHaveAttribute("target", "_blank");
    // Without noopener the opened page can reach back into this one.
    await expect(goals).toHaveAttribute("rel", /noopener/);
  });

  test("the goals link is honest about being a search", async ({ page }) => {
    await openMatchWithoutVideo(page);

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

  test("a curated match links to every channel that covered it", async ({ page }) => {
    // Fluminense 2 x 1 Clube do Remo: ge tv and CazéTV both published one.
    await page.goto("/partida/554975");

    await expect(page.getByRole("heading", { name: "Melhores momentos" })).toBeVisible();

    const links = page.locator("section a[href*='youtube.com/watch']");
    await expect(links).toHaveCount(2);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
    }
  });

  test("each link is labelled by its channel, not a generic verb", async ({ page }) => {
    await page.goto("/partida/554975");

    // Two identical labels would give the reader nothing to choose between.
    await expect(page.getByRole("link", { name: /ge tv/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /CazéTV/ })).toBeVisible();
  });

  test("a curated video suppresses the search fallback", async ({ page }) => {
    await page.goto("/partida/554975");

    await expect(page.getByRole("link", { name: /Procurar os gols/ })).toHaveCount(0);
    await expect(page.getByText(/não é um vídeo oficial/)).toHaveCount(0);
  });
});
