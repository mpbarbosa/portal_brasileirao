import { expect, test, type Page } from "@playwright/test";

/**
 * Rounds are chosen for what they contain, and are stable because the data is
 * committed: 24 has finished matches with goals, 25 is entirely still to come.
 */
const PLAYED_ROUND = "24";
const UPCOMING_ROUND = "25";

/**
 * Open a finished fixture with the curated links stripped from the payload, so
 * the search fallback is what renders.
 *
 * This used to walk the round hunting for a fixture nobody had curated yet,
 * which made the tests a hostage to how much data existed: curate every match
 * in the round and the walk finds nothing and throws. The fallback is a branch
 * of the component, so it is tested by producing the state that reaches it
 * rather than by hoping the season still contains one.
 */
const openMatchWithoutVideo = async (page: Page) => {
  await page.route("**/api/matches*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.matches = body.data.matches.map(
      ({ highlights: _dropped, ...match }: Record<string, unknown>) => match,
    );
    await route.fulfill({ response, json: body });
  });

  await page.goto(`/jogos/${PLAYED_ROUND}`);
  const link = page.locator("main ul > li a[href^='/partida/']").first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/partida\/\d+/);
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

  test("the match page draws both clubs' campanhas", async ({ page }) => {
    await openFirstMatch(page, PLAYED_ROUND);

    const sparklines = page.locator("main section svg[role='img']");

    await expect(sparklines).toHaveCount(2);
    await expect(sparklines.first()).toHaveAttribute("aria-label", /^Campanha: /);
    await expect(sparklines.last()).toHaveAttribute("aria-label", /^Campanha: /);
  });

  test("both campanhas are drawn on one scale", async ({ page }) => {
    // The whole reason they are stacked rather than overlaid: rounds line up
    // vertically, so "who was above whom in round 12" is read by looking
    // straight down. That only holds if both boxes are the same width and the
    // same domain — two clubs scaled to their own ranges would be a lie told
    // convincingly.
    await openFirstMatch(page, PLAYED_ROUND);

    const boxes = await page.locator("main section svg[role='img']").evaluateAll((nodes) =>
      nodes.map((node) => ({
        width: Math.round(node.getBoundingClientRect().width),
        viewBox: node.getAttribute("viewBox"),
        lastX: (node.querySelector("polyline")?.getAttribute("points") ?? "")
          .trim()
          .split(" ")
          .pop()
          ?.split(",")[0],
      })),
    );

    expect(boxes).toHaveLength(2);
    expect(boxes[0].width).toBe(boxes[1].width);
    expect(boxes[0].viewBox).toBe(boxes[1].viewBox);
    // Same last round in the snapshot, so the lines must end at the same x.
    expect(boxes[0].lastX).toBe(boxes[1].lastX);
  });

  test("the campanha names the club each line belongs to", async ({ page }) => {
    // Two monochrome lines in one card: without a name against each, the only
    // thing distinguishing them is their order, which is not a channel.
    await openFirstMatch(page, PLAYED_ROUND);

    const names = page.locator("main section svg[role='img']").locator("xpath=../p[1]");

    await expect(names).toHaveCount(2);
    for (const name of await names.all()) {
      expect((await name.innerText()).trim().length).toBeGreaterThan(0);
    }
  });

  test("the page shows the round and the status", async ({ page }) => {
    await openFirstMatch(page, UPCOMING_ROUND);

    // Scoped to the scoreboard card. The campanha section also names rounds
    // ("17º · 1ª rodada"), so an unscoped match now finds several.
    const card = page.locator("main article");
    await expect(card.getByText(/\d+ª rodada/)).toBeVisible();
    await expect(
      card.getByText(/(A realizar|Ao vivo|Encerrado|Adiado|Cancelado)/),
    ).toBeVisible();
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

  test("an upcoming match offers no highlights", async ({ page }) => {
    // It has not been played.
    await openFirstMatch(page, UPCOMING_ROUND);

    await expect(page.getByRole("link", { name: /Procurar melhores momentos/ })).toHaveCount(0);
  });

  test("a finished match offers highlights", async ({ page }) => {
    await openMatchWithoutVideo(page);

    const goals = page.getByRole("link", { name: /Procurar melhores momentos/ });
    await expect(goals).toBeVisible();
    await expect(goals).toHaveAttribute("href", /youtube\.com\/results\?search_query=/);
  });

  test("the highlights link opens safely in a new tab", async ({ page }) => {
    await openMatchWithoutVideo(page);

    const goals = page.getByRole("link", { name: /Procurar melhores momentos/ });
    await expect(goals).toHaveAttribute("target", "_blank");
    // Without noopener the opened page can reach back into this one.
    await expect(goals).toHaveAttribute("rel", /noopener/);
  });

  test("the search fallback is honest about being a search", async ({ page }) => {
    await openMatchWithoutVideo(page);

    await expect(page.getByText(/não é um vídeo oficial/)).toBeVisible();
  });

  test("a finished match shows its score", async ({ page }) => {
    await openFirstMatch(page, PLAYED_ROUND);

    await expect(page.locator("main > article").getByText(/\d+\s*×\s*\d+/)).toBeVisible();
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

  test("a page still loading says so, rather than claiming not found", async ({ page }) => {
    // Hold the fixtures open. Until they land, an unknown id and an id whose
    // payload has not arrived are the same empty list, and the page used to
    // answer "não encontrada" for both — telling the reader something untrue
    // about a match that exists.
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/matches*", async (route) => {
      await held;
      await route.continue();
    });

    await page.goto("/partida/554975", { waitUntil: "commit" });
    await expect(page.getByText("Carregando página…")).toBeVisible();
    await expect(page.getByText("Partida não encontrada.")).toHaveCount(0);

    release();
    // And once it arrives, the real page replaces it.
    await expect(page.getByRole("heading", { name: "Melhores momentos" })).toBeVisible();
  });

  test("the page is reachable directly and survives a reload", async ({ page }) => {
    await openFirstMatch(page, PLAYED_ROUND);
    const url = page.url();

    await page.reload();

    await expect(page).toHaveURL(url);
    await expect(page.getByText("Data e hora")).toBeVisible();
  });

  test("a goalless match still offers highlights", async ({ page }) => {
    // Internacional 0 x 0 Atlético-MG. A 0-0 has chances and saves, and gating
    // on goals hid the section from 14 of the season's finished matches.
    await page.goto("/partida/554976");

    await expect(page.locator("main > article").getByText(/0\s*×\s*0/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Melhores momentos" })).toBeVisible();
    // Either a curated link or the search — asserting which would make this a
    // test of whether someone has curated this fixture yet.
    await expect(page.locator("section a[href*='youtube.com']").first()).toBeVisible();
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

    await expect(page.getByRole("link", { name: /Procurar melhores momentos/ })).toHaveCount(0);
    await expect(page.getByText(/não é um vídeo oficial/)).toHaveCount(0);
  });
});
