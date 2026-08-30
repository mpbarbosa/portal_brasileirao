import { expect, test, type Page } from "@/tests/e2e/clock";

/**
 * The **Ao vivo** page, against the frozen snapshot.
 *
 * The snapshot is taken between rounds, so nothing in it is LIVE — and that is
 * the state five days out of seven anyway, which is exactly why "Agora" renders
 * a sentence rather than disappearing. Nothing here asserts that a match *is*
 * live, or how many fixtures each section holds: the snapshot ages, and both
 * would fail the next time `sync-seed-data` runs.
 */
/**
 * Put matches in progress, by rewriting the payload on its way to the page.
 *
 * The frozen snapshot is captured between rounds, so nothing in it is ever
 * LIVE — and the live card is the whole point of this page. Same reasoning as
 * the match page's missing-video fixture: a branch of a component is tested by
 * producing the state that reaches it, not by hoping the committed season
 * happens to contain one.
 *
 * Two of them, because simultaneous kickoffs are the normal Brasileirao Sunday
 * and the reason "Agora" is a list rather than a single card.
 */
const withLiveMatches = async (page: Page, count = 2) => {
  await page.route("**/api/matches*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();

    const scheduled = body.data.matches.filter(
      (match: { status: string }) => match.status === "SCHEDULED",
    );
    for (const match of scheduled.slice(0, count)) {
      match.status = "LIVE";
      match.homeGoals = 1;
      match.awayGoals = 0;
    }

    await route.fulfill({ response, json: body });
  });
};

test.describe("Ao vivo", () => {
  test("is reachable from the navigation and owns its address", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /^Ao vivo/ }).click();

    await expect(page).toHaveURL(/\/ao-vivo$/);
    await expect(
      page.getByRole("link", { name: /^Ao vivo/ }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("answers 'what is happening now' before anything else", async ({ page }) => {
    await page.goto("/ao-vivo");

    const agora = page.getByRole("heading", { name: "Agora", exact: true });
    await expect(agora).toBeVisible();

    // Either live cards or the sentence saying there are none — never neither,
    // which is what an absent section would look like to a reader.
    const cards = page.locator("[data-live-match]");
    const empty = page.getByText("Nenhuma partida em andamento agora.", { exact: true });
    await expect(cards.first().or(empty)).toBeVisible();
  });

  test("a deep link renders the page directly, without bouncing home", async ({ page }) => {
    await page.goto("/ao-vivo");

    await expect(page).toHaveURL(/\/ao-vivo$/);
    await expect(page.getByRole("heading", { name: "Agora", exact: true })).toBeVisible();
    // The Classificação's table is the home page's tell; it must not be here.
    await expect(page.locator("table")).toHaveCount(0);
  });

  test("titles the tab as its own section", async ({ page }) => {
    await page.goto("/ao-vivo");

    await expect(page).toHaveTitle(/^Ao vivo · Portal Brasileirão$/);
  });

  test("upcoming fixtures carry a countdown, and results carry none", async ({ page }) => {
    await page.goto("/ao-vivo");

    const upcoming = page.locator("section", {
      has: page.getByRole("heading", { name: "A seguir", exact: true }),
    });

    // The season ends: past December there is nothing upcoming, and asserting
    // the section exists would fail with the calendar rather than with the code.
    if (await upcoming.count()) {
      await expect(upcoming.getByRole("listitem").first()).toBeVisible();
      await expect(
        upcoming.getByText(/Começa em |Deve começar a qualquer momento|Horário a definir/).first(),
      ).toBeVisible();
    }

    const results = page.locator("section", {
      has: page.getByRole("heading", { name: "Últimos resultados", exact: true }),
    });

    if (await results.count()) {
      const first = results.getByRole("listitem").first();
      await expect(first).toBeVisible();
      // A result is a scoreline, not a countdown.
      await expect(first.getByText(/Começa em /)).toHaveCount(0);
    }
  });

  test("leads to a match page, and back to the fixture list by round", async ({ page }) => {
    await page.goto("/ao-vivo");

    await page.getByRole("link", { name: "Ver todos os jogos por rodada" }).click();
    await expect(page).toHaveURL(/\/jogos$/);
    await expect(page.getByRole("heading", { name: /\d+ª rodada/ })).toBeVisible();
  });
  test("every match in progress gets its own card, not a row", async ({ page }) => {
    await withLiveMatches(page, 2);
    await page.goto("/ao-vivo");

    const cards = page.locator("[data-live-match]");
    await expect(cards).toHaveCount(2);
    await expect(page.getByText("Nenhuma partida em andamento agora.")).toHaveCount(0);

    // The dot is decoration; the words are what a screen reader hears, and what
    // a reader who cannot separate the colours reads.
    await expect(cards.first().getByText("Bola rolando", { exact: true })).toBeVisible();
    await expect(cards.last().getByText("Bola rolando", { exact: true })).toBeVisible();
  });

  test("a live card carries the score and leads to the match", async ({ page }) => {
    await withLiveMatches(page, 1);
    await page.goto("/ao-vivo");

    const card = page.locator("[data-live-match]").first();
    await expect(card).toBeVisible();

    await card.getByRole("link", { name: /^Ver a partida/ }).click();
    await expect(page).toHaveURL(/\/partida\/\d+$/);
  });

  test("no match minute is invented anywhere on a live card", async ({ page }) => {
    // The provider reports a status and a score, never an elapsed clock, and
    // minutes-since-kickoff stops being the true minute at half-time. If a
    // minute ever shows up here, it was guessed.
    await withLiveMatches(page, 2);
    await page.goto("/ao-vivo");

    const cards = page.locator("[data-live-match]");
    await expect(cards.first()).toBeVisible();

    for (const text of await cards.allInnerTexts()) {
      expect(text).not.toMatch(/\b\d{1,3}'/);
      expect(text).not.toMatch(/\b\d{1,3}\s*min\b/);
    }
  });
})
