import { expect, test, type Page } from "@playwright/test";

/**
 * The Jogadores page runs against the frozen `src/data/squads.ts`, like every
 * other suite here — so nothing below asserts a squad size, a player's name or
 * a club's total. Those move with every transfer window, and a spec that
 * pins them fails the next time anyone runs `sync-seed-data`.
 */
const goToJogadores = async (page: Page) => {
  await page.getByRole("link", { name: /^Jogadores/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Jogadores" })).toBeVisible();
};

/** The first club panel, whichever club the snapshot happens to sort first. */
const firstPanel = (page: Page) => page.locator("[data-squad]").first();

test.describe("Jogadores", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await goToJogadores(page);
  });

  test("lists one panel per club, each naming a club", async ({ page }) => {
    const panels = page.locator("[data-squad]");

    // Shape, not count: the division's size is data, and a club can leave.
    await expect(panels.first()).toBeVisible();
    expect(await panels.count()).toBeGreaterThan(1);

    for (const panel of await panels.all()) {
      await expect(panel.locator("summary")).not.toBeEmpty();
    }
  });

  test("summarises the whole division above the list", async ({ page }) => {
    await expect(page.getByText(/\d+ jogadores em \d+ clubes/)).toBeVisible();
  });

  test("panels start closed, so the page is an index rather than a wall", async ({ page }) => {
    // A thousand players rendered flat puts the second club twenty screens
    // below the first, which is the structure the page exists to show.
    const players = firstPanel(page).locator("section ul li");
    await expect(players.first()).toBeHidden();
  });

  test("opening a club reveals its squad, grouped by line", async ({ page }) => {
    const panel = firstPanel(page);
    await panel.locator("summary").click();

    const headings = await panel.locator("section h4").allInnerTexts();
    expect(headings.length).toBeGreaterThan(0);
    // Whatever subset a club fields, it comes back in reading order.
    const order = ["GOLEIROS", "DEFENSORES", "MEIO-CAMPISTAS", "ATACANTES", "OUTROS"];
    const seen = headings.map((text) => text.trim());
    expect(seen).toEqual(order.filter((line) => seen.includes(line)));
  });

  test("two clubs can be open at once", async ({ page }) => {
    // The reason this is `<details>` rather than a picker: comparing two
    // squads should not mean losing the first one.
    const panels = page.locator("[data-squad]");
    await panels.nth(0).locator("summary").click();
    await panels.nth(1).locator("summary").click();

    await expect(panels.nth(0).locator("section h4").first()).toBeVisible();
    await expect(panels.nth(1).locator("section h4").first()).toBeVisible();
  });

  test("choosing a player opens the card, with the club already filled in", async ({ page }) => {
    const panel = firstPanel(page);
    const club = (await panel.locator("summary").innerText()).split("\n")[0].trim();
    await panel.locator("summary").click();

    const player = panel.locator("section ul li button").first();
    const name = (await player.innerText()).trim();
    await player.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(name);
    // The listing carries no club per player; the page attaches the squad's.
    await expect(dialog).toContainText(club);
  });

  test("the card opened from an elenco claims no season figures", async ({ page }) => {
    // Those belong to the Artilharia row it was not opened from. Rendering a
    // zero here would assert the player has not scored.
    const panel = firstPanel(page);
    await panel.locator("summary").click();
    await panel.locator("section ul li button").first().click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).not.toContainText(/no campeonato/i);
  });

  test("a player with a recorded account gets a link to it", async ({ page }) => {
    // Named rather than taken from `.first()`, unlike the specs above: the
    // handle table is curated and covers a minority of the division, so the
    // first player of the first club is very likely to have no account. This
    // asserts the wiring, and the fixture is chosen for being in the table.
    const panel = page.locator('[data-squad="corinthians"]');
    await panel.locator("summary").click();
    await panel.getByRole("button", { name: "Memphis Depay" }).click();

    const link = page.getByRole("dialog").getByRole("link", { name: /Instagram/ });
    // The handle itself is not asserted — it is curated data and may be
    // corrected. That it resolves to a profile on Instagram is the contract.
    await expect(link).toHaveAttribute("href", /^https:\/\/www\.instagram\.com\/[\w.]+\/$/);
    // A window.opener handed to a third-party origin is the defect this
    // catches, and it looks identical on the page when it is missing.
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("a player with no recorded account gets no link, not an empty one", async ({ page }) => {
    // Coverage is partial by design, so the absent case is the common one and
    // has to render as nothing rather than as a dash or a dead anchor.
    const panel = page.locator('[data-squad="corinthians"]');
    await panel.locator("summary").click();

    const names = panel.locator("section ul li button");
    for (const player of await names.all()) {
      const name = (await player.innerText()).trim();
      if (name === "Memphis Depay") continue;
      await player.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const links = await dialog.getByRole("link", { name: /Instagram/ }).count();
      if (links === 0) {
        await dialog.getByRole("button", { name: "Fechar" }).click();
        return;
      }
      await dialog.getByRole("button", { name: "Fechar" }).click();
    }
    throw new Error("expected at least one player in the snapshot to have no recorded account");
  });

  test("a club panel links to that club's own page", async ({ page }) => {
    const panel = firstPanel(page);
    const slug = await panel.getAttribute("data-squad");
    await panel.locator("summary").click();
    await panel.getByRole("button", { name: /^Ver a página do/ }).click();

    await expect(page).toHaveURL(new RegExp(`/clube/${slug}$`));
  });

  test("the address is shareable and survives a reload", async ({ page }) => {
    await expect(page).toHaveURL(/\/jogadores$/);

    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: "Jogadores" })).toBeVisible();
    await expect(page.locator("[data-squad]").first()).toBeVisible();
  });

  test("switching away and back keeps the elencos", async ({ page }) => {
    await page.getByRole("link", { name: /^Classificação/ }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(20);

    await goToJogadores(page);
    await expect(page.locator("[data-squad]").first()).toBeVisible();
  });
});

test.describe("Jogadores na barra de navegação", () => {
  /**
   * The fifth destination is the one MD3 allows and no more, so the bar is now
   * at its limit — and the failure mode is silent: the last item is clipped at
   * the screen edge with no horizontal scroll to reveal it. Nothing else in the
   * suite would catch that, because it only happens on a narrow viewport.
   */
  for (const width of [320, 360, 375]) {
    test(`every destination is reachable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 780 });
      await page.goto("/jogadores");

      const bar = page.locator("nav[aria-label='Seções']").last();
      const items = bar.getByRole("link");
      await expect(items).toHaveCount(5);

      const barBox = await bar.boundingBox();
      expect(barBox).not.toBeNull();

      for (const item of await items.all()) {
        const box = await item.boundingBox();
        expect(box).not.toBeNull();
        // Half a pixel of slack for subpixel layout, and no more.
        expect(box!.x + box!.width).toBeLessThanOrEqual(barBox!.x + barBox!.width + 0.5);
        expect(box!.x).toBeGreaterThanOrEqual(barBox!.x - 0.5);
      }

      // And the page itself must not have grown a horizontal scrollbar instead.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
