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

  test("the club page draws the club's campanha", async ({ page }) => {
    await openClubAt(page, 1);

    const sparkline = page.locator("main section svg[role='img']");

    await expect(sparkline).toHaveCount(1);
    await expect(sparkline).toHaveAttribute("aria-label", /^Campanha: /);
  });

  test("the campanha names both ends, since the drawing carries no axis", async ({ page }) => {
    await openClubAt(page, 1);

    // Shape, never a value: the snapshot ages and the table reorders.
    const ends = page.locator("main section svg[role='img'] ~ p span");

    await expect(ends).toHaveCount(2);
    await expect(ends.first()).toHaveText(/^\d+º · 1ª rodada$/);
    await expect(ends.last()).toHaveText(/^\d+º · \d+ª rodada$/);
  });

  test("the campanha ends where the standings summary says the club is", async ({ page }) => {
    // The two are computed from different payloads — the sparkline from the
    // fixture list, the tile from /api/standings — so with a live provider they
    // can differ mid-round. Against the frozen snapshot nothing is in play, so
    // they must agree, and disagreement here means a real bug.
    await openClubAt(page, 1);

    const position = (await page.locator("main p", { hasText: /^\d+º$/ }).first().innerText()).trim();
    const endLabel = await page.locator("main section svg[role='img'] ~ p span").last().innerText();

    expect(endLabel.startsWith(position)).toBe(true);
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
    await expect(page.locator("main > article")).toContainText(name);
  });

  /* Selected by destination rather than position: the header now holds two
     external links, and picking one by index is what broke these specs when a
     name first became a control. */
  const siteLink = (page: Page) =>
    page.locator("main header a[target='_blank']:not([href*='instagram'])");
  const instagramLink = (page: Page) => page.locator("main header a[href*='instagram.com']");

  test("the club page links to its official site", async ({ page }) => {
    await openClubAt(page, 1);

    const site = siteLink(page);
    await expect(site).toBeVisible();
    // Always HTTPS: the provider lists most clubs as http.
    await expect(site).toHaveAttribute("href", /^https:\/\/[^/]+\/$/);
    await expect(site).toHaveAttribute("rel", /noopener/);
  });

  test("the official site link shows the host, not the whole URL", async ({ page }) => {
    await openClubAt(page, 1);

    const text = (await siteLink(page).innerText()).trim();
    expect(text).not.toContain("https://");
    expect(text).toMatch(/\.[a-z]{2,}/);
  });

  test("the club page links to its Instagram profile", async ({ page }) => {
    await openClubAt(page, 1);

    const instagram = instagramLink(page);
    await expect(instagram).toBeVisible();
    // Canonical profile address — no locale hint or other query riding along.
    await expect(instagram).toHaveAttribute("href", /^https:\/\/www\.instagram\.com\/[A-Za-z0-9._]+\/$/);
    await expect(instagram).toHaveAttribute("target", "_blank");
    await expect(instagram).toHaveAttribute("rel", /noopener/);
  });

  test("the Instagram link reads as the handle", async ({ page }) => {
    await openClubAt(page, 1);

    // "@palmeiras" is what a reader recognises; the full URL is noise. The
    // trailing screen-reader text is deliberate, so match the start rather than
    // the whole string.
    const text = (await instagramLink(page).innerText()).trim();
    expect(text).toMatch(/^@[A-Za-z0-9._]+/);
    expect(text).not.toContain("instagram.com");
  });

  test("every club carries both links", async ({ page }) => {
    // A missing handle renders as no link at all rather than a broken one, so
    // this would pass silently if the merge stopped working — hence checking
    // that the club actually named in the URL is the one that has it.
    await page.goto("/clube/palmeiras");

    await expect(instagramLink(page)).toHaveAttribute(
      "href",
      "https://www.instagram.com/palmeiras/",
    );
    await expect(siteLink(page)).toHaveAttribute("href", "https://www.palmeiras.com.br/");
  });
});
