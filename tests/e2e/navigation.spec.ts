import { expect, test, type Page } from "@playwright/test";

/**
 * Reach a section at any viewport.
 *
 * One line now: the destinations are visible at every width, so there is no
 * menu to open first. It stays a helper because the regex is not obvious —
 * the accessible name *starts with* the label rather than equalling it.
 */
const goToSection = async (page: Page, label: string) => {
  await page.getByRole("link", { name: new RegExp(`^${label}`) }).click();
};

test.describe("Navegação", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows the brand at every width", async ({ page }) => {
    await expect(page.getByText("Portal Brasileirão", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Campeonato Brasileiro Série A", { exact: true }).first(),
    ).toBeVisible();
  });

  test("keeps an h1 naming the app for assistive tech", async ({ page }) => {
    // Visually hidden — the brand carries the name on screen — but a page still
    // needs exactly one h1.
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText(/Portal Brasileirão/);
  });

  test("opens on Classificação", async ({ page }) => {
    await expect(page.locator("table")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^Classificação/ }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("switching to Jogos replaces the table with fixtures", async ({ page }) => {
    await goToSection(page, "Jogos");

    await expect(page.locator("table")).toHaveCount(0);
    // Round number is deliberately not asserted: it advances with the calendar.
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(/\d+ª rodada/);
  });

  test("switching back to Classificação restores the table", async ({ page }) => {
    await goToSection(page, "Jogos");
    await goToSection(page, "Classificação");

    await expect(page.locator("table tbody tr")).toHaveCount(20);
  });

  test("the round view lists fixtures with a status badge each", async ({ page }) => {
    await goToSection(page, "Jogos");

    const fixtures = page.locator("main ul > li");
    await expect(fixtures.first()).toBeVisible();
    expect(await fixtures.count()).toBeGreaterThan(0);

    for (const fixture of await fixtures.all()) {
      await expect(fixture).toHaveText(/(A realizar|Ao vivo|Encerrado|Adiado|Cancelado)/);
    }
  });

  test("a frozen snapshot never shows a match as in progress", async ({ page }) => {
    // Scoped to the fixture list and exact: a bare getByText("Ao vivo") also
    // matches the banner's "...para dados ao vivo." (substring, case-insensitive).
    await goToSection(page, "Jogos");

    await expect(
      page.locator("main ul > li").getByText("Ao vivo", { exact: true }),
    ).toHaveCount(0);
  });

  test("the header stays put when the page scrolls", async ({ page }) => {
    await page.mouse.wheel(0, 600);
    await expect(page.getByText("Portal Brasileirão", { exact: true })).toBeInViewport();
  });
});

/**
 * The navigation bar that replaced the collapsed menu.
 *
 * The specs it replaced were about a *disclosure*: that the toggle reported
 * `aria-expanded`, that Escape closed it and restored focus, that a click
 * outside dismissed it. None of that behaviour exists now, and rewriting those
 * specs to click something else would have kept the letter of a contract whose
 * subject had been deleted.
 *
 * What survives is the property that actually mattered — every section reachable
 * at every width, and the current one saying so — asserted against whichever
 * presentation the viewport gets.
 */
test.describe("Barra de navegação", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("every section is reachable and marked, at this width", async ({ page }) => {
    for (const label of ["Classificação", "Jogos", "Artilharia"]) {
      await page.getByRole("link", { name: new RegExp(`^${label}`) }).click();
      await expect(
        page.getByRole("link", { name: new RegExp(`^${label}`) }),
      ).toHaveAttribute("aria-current", "page");
    }
  });

  test("exactly one presentation of the destinations is visible", async ({ page }) => {
    // Both render from NAV_ITEMS and one is always `display: none`. Were both
    // ever visible, every `getByRole("link")` in the suite would hit a strict
    // mode violation — so this guards the whole suite, not only itself.
    for (const label of ["Classificação", "Jogos", "Artilharia"]) {
      await expect(page.getByRole("link", { name: new RegExp(`^${label}`) })).toHaveCount(1);
    }
  });

  test("destinations sit within thumb reach on a phone, inline on a desktop", async ({
    page,
  }) => {
    const viewport = page.viewportSize();
    const box = await page.getByRole("link", { name: /^Jogos/ }).boundingBox();
    expect(box).not.toBeNull();

    if ((viewport?.width ?? 0) < 640) {
      // Pinned to the bottom edge, which is the point of the pattern over a
      // menu in the opposite corner.
      expect(box!.y).toBeGreaterThan((viewport?.height ?? 0) / 2);
    } else {
      expect(box!.y).toBeLessThan((viewport?.height ?? 0) / 2);
    }
  });
});
