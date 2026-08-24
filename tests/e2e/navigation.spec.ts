import { expect, test, type Page } from "@playwright/test";

/** Tailwind's `sm` breakpoint — below it the nav collapses behind a toggle. */
const SM_BREAKPOINT = 640;

const isCollapsed = (page: Page) => (page.viewportSize()?.width ?? 0) < SM_BREAKPOINT;

const menuToggle = (page: Page) => page.getByRole("button", { name: /menu/i });

/**
 * Reach a section at any viewport. The mobile panel repeats each label with its
 * description, so the accessible name starts with — rather than equals — the
 * label.
 */
const goToSection = async (page: Page, label: string) => {
  if (isCollapsed(page)) {
    await menuToggle(page).click();
  }
  await page.getByRole("button", { name: new RegExp(`^${label}`) }).click();
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
    if (isCollapsed(page)) await menuToggle(page).click();
    await expect(
      page.getByRole("button", { name: /^Classificação/ }),
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

test.describe("Menu de seções", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("the toggle appears only below the sm breakpoint", async ({ page }) => {
    if (isCollapsed(page)) {
      await expect(menuToggle(page)).toBeVisible();
    } else {
      // On a wide viewport the sections are inline; a toggle would be noise.
      await expect(menuToggle(page)).toBeHidden();
      await expect(page.getByRole("button", { name: /^Classificação/ })).toBeVisible();
    }
  });

  test("the toggle reports and flips its expanded state", async ({ page }) => {
    test.skip(!isCollapsed(page), "no toggle at this width");

    const toggle = menuToggle(page);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("the panel it controls actually exists", async ({ page }) => {
    test.skip(!isCollapsed(page), "no toggle at this width");

    const controls = await menuToggle(page).getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    await expect(page.locator(`#${controls}`)).toHaveCount(1);
  });

  test("choosing a section closes the menu", async ({ page }) => {
    test.skip(!isCollapsed(page), "no toggle at this width");

    await menuToggle(page).click();
    await page.getByRole("button", { name: /^Jogos/ }).click();

    await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(/\d+ª rodada/);
  });

  test("Escape closes the menu and restores focus to the toggle", async ({ page }) => {
    test.skip(!isCollapsed(page), "no toggle at this width");

    const toggle = menuToggle(page);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");

    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    // Focus must come back, or it is stranded on a now-hidden element.
    await expect(toggle).toBeFocused();
  });

  test("clicking outside closes the menu", async ({ page }) => {
    test.skip(!isCollapsed(page), "no toggle at this width");

    await menuToggle(page).click();
    await page.locator("main").click({ position: { x: 5, y: 5 } });

    await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "false");
  });

  test("every section in the nav model is reachable", async ({ page }) => {
    for (const label of ["Classificação", "Jogos", "Artilharia"]) {
      await goToSection(page, label);
      if (isCollapsed(page)) await menuToggle(page).click();
      await expect(
        page.getByRole("button", { name: new RegExp(`^${label}`) }),
      ).toHaveAttribute("aria-current", "page");
      if (isCollapsed(page)) await page.keyboard.press("Escape");
    }
  });
});
