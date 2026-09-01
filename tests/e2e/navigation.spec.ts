import { expect, test, type Page } from "@/tests/e2e/clock";

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

/**
 * Sign in as a named person — the widest the trailing group ever gets, and the
 * state the brand's width has to survive. A copy of `contas.spec.ts`'s helper
 * rather than an import: the two specs are about different things, and this one
 * needs only that the row is full.
 */
const devLogin = async (page: Page, name: string) => {
  const response = await page.request.post("/api/auth/dev-login", {
    data: { subject: `sub-${name}`, name },
  });
  expect(response.ok()).toBeTruthy();
};

test.describe("Navegação", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows the brand at every width, whole and never cut", async ({ page }) => {
    // **The old form of this spec passed while the brand read "P…".**
    //
    // It asserted the wordmark was *visible*, and a `truncate`d element is
    // visible — a one-character element is visible. Signed in, the header's
    // brand block measured 27px against 128px of name at 640, and 115px at
    // 1280; the subtitle was cut at every width the inline tabs were shown.
    // Nothing in the suite could see it, because "visible" is the one property
    // an ellipsis does not take away.
    //
    // So the assertion is `scrollWidth === clientWidth` on the wordmark itself,
    // at the widths the header changes shape across, and in the state that made
    // it worst — signed in, where the trailing group is at its widest.
    await devLogin(page, "Marcelo");

    for (const width of [320, 375, 639, 640, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");

      const mark = page.getByText("Portal Brasileirão", { exact: true });
      await expect(mark).toBeVisible();
      const fit = await mark.evaluate((el) => ({
        shown: el.clientWidth,
        full: el.scrollWidth,
      }));
      expect(fit.full, `the wordmark should measure something at ${width}px`).toBeGreaterThan(0);
      expect(fit.shown, `the wordmark is cut at ${width}px`).toBeGreaterThanOrEqual(fit.full);
    }

    // The subtitle is a phone-only line: below `sm` this row holds nothing but
    // the brand and two 40dp controls, and above it the tab row underneath says
    // what the app is for. The full name survives in the `h1` asserted below.
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    await expect(
      page.getByText("Campeonato Brasileiro Série A", { exact: true }).first(),
    ).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(
      page.getByText("Campeonato Brasileiro Série A", { exact: true }).first(),
    ).toBeHidden();
  });

  test("the brand's phone subtitle is not overrun by the mark beside it", async ({
    page,
  }) => {
    // **This is the sibling of the spec above, and it is here because that one
    // passed against the defect.** It asserts the subtitle is *visible*, which
    // is the property its own comment records an ellipsis does not remove —
    // and an element that overflows its box is visible too, painting over
    // whatever is to its right.
    //
    // Introducing the brand mark made that concrete. Placed beside the
    // two-line block, the mark adds its width to the block's *widest* line,
    // which below `sm` is this subtitle at 174px and not the 128px title. At
    // 375dp signed out the block gets 202px, so the subtitle overflowed its
    // box by 3.6px and painted under the Entrar pill. The whole suite — 802
    // specs — was green over it.
    //
    // The mark therefore sits beside the title line, where 24 + 8 + 128 is
    // still inside the 174 the subtitle already claims. Both readings are
    // asserted, because they fail independently: `scrollWidth` catches the
    // text outgrowing its own box, and the gap to the next control catches a
    // block that fits but has been pushed into its neighbour.
    for (const signedIn of [false, true]) {
      if (signedIn) await devLogin(page, "Marcelo");
      await page.setViewportSize({ width: 375, height: 800 });
      await page.goto("/");

      const state = signedIn ? "signed in" : "signed out";
      const subtitle = page
        .getByText("Campeonato Brasileiro Série A", { exact: true })
        .first();
      await expect(subtitle).toBeVisible();

      const fit = await subtitle.evaluate((el) => {
        const next = el.closest("[data-brand]")?.nextElementSibling;
        return {
          shown: el.clientWidth,
          full: el.scrollWidth,
          right: el.getBoundingClientRect().right,
          nextLeft: next ? next.getBoundingClientRect().left : Infinity,
        };
      });

      expect(fit.full, `the subtitle should measure something ${state}`).toBeGreaterThan(0);
      expect(
        fit.shown,
        `the subtitle overflows its own box ${state} at 375px`,
      ).toBeGreaterThanOrEqual(fit.full);
      expect(
        fit.right,
        `the subtitle runs into the trailing controls ${state} at 375px`,
      ).toBeLessThanOrEqual(fit.nextLeft);
    }
  });

  test("the wordmark is the way home", async ({ page }) => {
    // The one control every site puts in this corner, and this app had two
    // `<p>` elements there — so a reader on a club page had to find
    // "Classificação" among the destinations to get back.
    await page.goto("/clube/palmeiras");
    await expect(page.locator("[data-brand]")).toHaveAttribute("href", "/");

    await page.locator("[data-brand]").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("table tbody tr")).toHaveCount(20);
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
    await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText(/\d+ª rodada/);
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
    for (const label of ["Classificação", "Ao vivo", "Jogos", "Artilharia"]) {
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
    for (const label of ["Classificação", "Ao vivo", "Jogos", "Artilharia"]) {
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
