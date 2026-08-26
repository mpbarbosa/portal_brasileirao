import { expect, test, type Page } from "@playwright/test";

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

    await page.getByRole("link", { name: /^Artilharia/ }).click();

    await expect(page.locator("table thead th").nth(1)).toHaveText(/jogador/i);
  });

  test("no nav entry points at the club section", async ({ page }) => {
    // It is a drill-down: without a selected club it would render nothing.
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
    // The match involves the club we came from. `main > article` is the
    // scoreboard; that it resolves to exactly one element is enforced by
    // "the scoreboard is the only article on the page" in match-page.spec.ts.
    await expect(page.locator("main > article")).toContainText(name);
  });

  /* Selected by destination rather than position: the header now holds four
     external links, and picking one by index is what broke these specs when a
     name first became a control. The site link is the one defined by exclusion,
     so every link added beside it has to be excluded here too — the hymn was
     the first, and it matched as the site until it was. */
  const siteLink = (page: Page) =>
    page.locator(
      "main header a[target='_blank']:not([href*='instagram.com']):not([href*='youtube.com']):not([href*='wikipedia.org'])",
    );
  const instagramLink = (page: Page) => page.locator("main header a[href*='instagram.com']");
  const hymnLink = (page: Page) => page.locator("main header a[href*='youtube.com']");
  const wikipediaLink = (page: Page) => page.locator("main header a[href*='wikipedia.org']");

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

  test("the club page links to its hymn", async ({ page }) => {
    await openClubAt(page, 1);

    const hymn = hymnLink(page);
    await expect(hymn).toBeVisible();
    // A bare watch address: the id alone is stored, so no `list=RD…` playlist
    // or `start_radio` rides along to open the mix instead of the hymn.
    await expect(hymn).toHaveAttribute("href", /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/);
    await expect(hymn).toHaveAttribute("target", "_blank");
    await expect(hymn).toHaveAttribute("rel", /noopener/);
  });

  test("the hymn link reads as its name, not its address", async ({ page }) => {
    await openClubAt(page, 1);

    // Unlike the site and the handle, a video id names nothing a reader knows.
    // The trailing screen-reader text is deliberate, so match the start.
    const text = (await hymnLink(page).innerText()).trim();
    expect(text).toMatch(/^Hino do clube/);
    expect(text).not.toContain("youtube.com");
  });

  test("the club page links to its Wikipedia article", async ({ page }) => {
    await openClubAt(page, 1);

    const wikipedia = wikipediaLink(page);
    await expect(wikipedia).toBeVisible();
    // The Portuguese edition, and a bare article address: the title alone is
    // stored, so no `?action=edit` or `#seção` rides along from a copied link.
    await expect(wikipedia).toHaveAttribute("href", /^https:\/\/pt\.wikipedia\.org\/wiki\/[^?#]+$/);
    await expect(wikipedia).toHaveAttribute("target", "_blank");
    await expect(wikipedia).toHaveAttribute("rel", /noopener/);
  });

  test("the article link reads as its name, not its address", async ({ page }) => {
    await openClubAt(page, 1);

    // Like the hymn: the club's full legal name is not what a reader scanning
    // a row of links is looking for. The trailing screen-reader text is
    // deliberate, so match the start.
    const text = (await wikipediaLink(page).innerText()).trim();
    expect(text).toMatch(/^Wikipédia/);
    expect(text).not.toContain("wikipedia.org");
  });

  test("the club page names the club's head coach", async ({ page }) => {
    // Stubbed rather than read off the snapshot, deliberately. The coach comes
    // from the teams endpoint, this suite runs with the provider disabled, and
    // `clubs.ts` carries one only once someone has re-run sync-seed-data with a
    // token — so asserting against the seed would test the fixture's age. What
    // is under test is that the map reaches the page and is printed.
    const clubs = await (await page.request.get("/api/clubs")).json();
    const palmeiras = clubs.data.find((club: { slug?: string }) => club.slug === "palmeiras");

    await page.route("**/api/coaches", (route) =>
      route.fulfill({
        json: {
          source: "football-data",
          note: "Dados do football-data.org (Campeonato Brasileiro Série A).",
          updatedAt: new Date().toISOString(),
          data: { [palmeiras.code]: "Abel Ferreira" },
        },
      }),
    );

    await page.goto("/clube/palmeiras");

    // Scoped to the header: the name belongs beside the club's, not among the
    // tallies. The label and the name are two elements, hence a text match on
    // the block rather than on either of them.
    await expect(page.locator("main header")).toContainText("Técnico: Abel Ferreira");
  });

  test("the coaches are not fetched until a club page is opened", async ({ page }) => {
    // One page in eight shows a coach, so the map is not in the opening
    // Promise.all — the same call the elencos get, and just as invisible from
    // the rendered page. Only the request log shows it.
    const asked: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/coaches")) asked.push(request.url());
    });

    await page.goto("/");
    await expect(page.locator("table tbody tr")).toHaveCount(20);
    expect(asked).toHaveLength(0);

    await openClubAt(page, 1);
    await expect.poll(() => asked.length).toBeGreaterThan(0);
  });

  test("every club carries all four links", async ({ page }) => {
    // A missing handle renders as no link at all rather than a broken one, so
    // this would pass silently if the merge stopped working — hence checking
    // that the club actually named in the URL is the one that has it.
    await page.goto("/clube/palmeiras");

    await expect(instagramLink(page)).toHaveAttribute(
      "href",
      "https://www.instagram.com/palmeiras/",
    );
    await expect(siteLink(page)).toHaveAttribute("href", "https://www.palmeiras.com.br/");
    await expect(hymnLink(page)).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=DiKvx0gRfaQ",
    );
    await expect(wikipediaLink(page)).toHaveAttribute(
      "href",
      "https://pt.wikipedia.org/wiki/Sociedade_Esportiva_Palmeiras",
    );
  });
});
