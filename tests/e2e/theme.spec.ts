import { expect, test, type Page } from "@playwright/test";

const themeAttr = (page: Page) => page.locator("html").getAttribute("data-theme");
const toggle = (page: Page) => page.getByRole("button", { name: /Ativar tema/ });
const canvas = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);


/**
 * Whether a focused element draws something a keyboard user can see.
 *
 * Deliberately agnostic about how: the browser's own ring is `outline-style:
 * auto`, Tailwind's `ring-*` is a box-shadow, and MD3 may use either. Asserting
 * a particular utility would pin the test to today's implementation and tell us
 * nothing about whether a ring is actually drawn.
 */
/**
 * The colour a token resolves to *right now*, read through a freshly mounted
 * probe rather than written down as a hex.
 *
 * Every value in the palette is emitted by `sync-md3-tokens` from a seed, so a
 * literal here would go stale the next time the seed moves and fail on a commit
 * that never touched theming. The probe is new, and a transition needs a
 * previous value to interpolate from, so it reports where the token lands
 * rather than a frame of somebody else's fade.
 */
const tokenColour = (page: Page, token: string) =>
  page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, token);

const focusIndicator = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      focusVisible: node.matches(":focus-visible"),
      outline: style.outlineStyle !== "none" && style.outlineWidth !== "0px",
      ring: style.boxShadow !== "none" && style.boxShadow !== "",
    };
  });

test.describe("Tema", () => {
  test("a theme is applied before anything renders", async ({ page }) => {
    await page.goto("/");

    // The inline script stamps this; without it the page would flash.
    expect(["light", "dark"]).toContain(await themeAttr(page));
  });

  test("the toggle flips the theme", async ({ page }) => {
    await page.goto("/");
    const before = await themeAttr(page);

    await toggle(page).click();

    expect(await themeAttr(page)).not.toBe(before);
  });

  test("the palette actually changes, not just the attribute", async ({ page }) => {
    await page.goto("/");
    const before = await canvas(page);

    await toggle(page).click();

    expect(await canvas(page)).not.toBe(before);
  });

  test("the choice survives a reload", async ({ page }) => {
    await page.goto("/");
    await toggle(page).click();
    const chosen = await themeAttr(page);

    await page.reload();

    expect(await themeAttr(page)).toBe(chosen);
  });

  test("the toggle says what it will do, not what is active", async ({ page }) => {
    await page.goto("/");

    const theme = await themeAttr(page);
    const expected = theme === "light" ? "Ativar tema escuro" : "Ativar tema claro";
    await expect(toggle(page)).toHaveAttribute("aria-label", expected);

    await toggle(page).click();
    const flipped = theme === "light" ? "Ativar tema claro" : "Ativar tema escuro";
    await expect(toggle(page)).toHaveAttribute("aria-label", flipped);
  });

  test("text stays legible in the light theme", async ({ page }) => {
    await page.goto("/");
    if ((await themeAttr(page)) !== "light") await toggle(page).click();
    await expect(page.locator("table tbody tr")).toHaveCount(20);

    // Body text must not be near-white on a near-white page.
    const { bg, fg } = await page.evaluate(() => {
      const style = getComputedStyle(document.body);
      return { bg: style.backgroundColor, fg: style.color };
    });
    expect(bg).not.toBe(fg);

    const luminance = (rgb: string) => {
      const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    // Light page, dark ink: a wide gap either way, but specifically inverted.
    expect(luminance(bg)).toBeGreaterThan(luminance(fg) + 100);
  });

  /**
   * **This spec cannot fail on the engine CI runs, and that is worth knowing
   * before trusting it.** The bug it was written for — an element with a
   * `transition` keeping its old computed colour after the palette swaps —
   * reproduces on Chrome 148 and does **not** reproduce on the Chromium 151
   * that `@playwright/test` bundles. Checked against the unfixed code by real
   * mouse click, scripted click and keyboard: green all three ways, while the
   * same page in Chrome 148 was visibly wrong.
   *
   * It is kept rather than deleted: the assertion is the right one, it costs
   * nothing, and it will start earning its place the day CI's browser regresses
   * or someone reintroduces a colour transition the swap cannot clear. But it
   * is not what protects `applyTheme` in src/useTheme.ts — nothing here is, and
   * the fix shipped without a failing test on purpose rather than with a test
   * that passes for reasons unrelated to the defect.
   */
  test("the toggle itself lands on the new theme's ink", async ({ page }) => {
    // The toggle is the one control guaranteed to have been interacted with at
    // the moment the palette swaps, so if anything were to keep the old theme's
    // colour it would always be this one — on a light page it would render as a
    // very faint glyph. Nothing above re-reads the clicked control after the
    // flip, which is the gap this closes.
    //
    // Two things make an unguarded read of this lie, and a report of a stale
    // toggle turned out to be both of them at once. `STATE_LAYER` carries a
    // bare `transition`, whose property list includes `color`, so an immediate
    // read samples the fade rather than where it settles — hence the poll. And
    // a transition does not run at all on an unrendered element, so the desktop
    // nav links, which are `display: none` below `sm`, re-resolve *instantly*
    // and make a mid-fade toggle look uniquely broken beside them. Comparing
    // against the token rather than against a neighbouring element is what
    // keeps this spec honest at both widths.
    await page.goto("/");

    for (const theme of ["dark", "light"]) {
      if ((await themeAttr(page)) === theme) await toggle(page).click();
      const before = await toggle(page).evaluate((node) => getComputedStyle(node).color);

      await toggle(page).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

      // Custom properties are not in any transition's property list, so this
      // reads the newly active palette immediately.
      const expected = await tokenColour(page, "--color-ink-soft");
      expect(expected, "the two themes must not share this token").not.toBe(before);

      await expect
        .poll(() => toggle(page).evaluate((node) => getComputedStyle(node).color), {
          message: `the toggle kept the old theme's colour after switching to ${theme}`,
        })
        .toBe(expected);
    }
  });

  test("a keyboard-focused control is visibly focused, in both themes", async ({ page }) => {
    // Lives here because it is a theming concern as much as an accessibility
    // one: a ring the same colour as the surface behind it is no ring at all,
    // and the two themes have different surfaces.
    await page.goto("/");
    await expect(page.locator("table tbody tr")).toHaveCount(20);

    for (const theme of ["light", "dark"]) {
      if ((await themeAttr(page)) !== theme) await toggle(page).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

      // Tab rather than .focus(): :focus-visible is what decides whether the
      // browser draws a ring, and it is what tells a keyboard user apart from
      // someone who just clicked.
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => document.activeElement?.tagName ?? "BODY");
      expect(focused).not.toBe("BODY");

      const state = await page.evaluate(() => {
        const node = document.activeElement as HTMLElement;
        const style = getComputedStyle(node);
        return {
          focusVisible: node.matches(":focus-visible"),
          outline: style.outlineStyle !== "none" && style.outlineWidth !== "0px",
          ring: style.boxShadow !== "none" && style.boxShadow !== "",
        };
      });

      expect(state.focusVisible).toBe(true);
      // Either mechanism is fine; having neither is not.
      expect(state.outline || state.ring).toBe(true);
    }
  });

  test("no control removes its focus ring without replacing it", async ({ page }) => {
    // The regression this guards is specific: `outline-none` added for looks,
    // with nothing put back. It reads as a tidier control and silently makes
    // the app unnavigable by keyboard — which no other spec would catch,
    // because Playwright clicks rather than tabs.
    await page.goto("/");
    await expect(page.locator("table tbody tr")).toHaveCount(20);

    // `:visible` matters: NavBar renders the sections twice, inline for desktop
    // and inside a collapsed panel for narrow screens, so the plain selector
    // picks a link inside a `display: none` container on mobile. A hidden
    // element having no ring is correct, and asserting otherwise tests the
    // viewport rather than the styling.
    const checked: string[] = [];
    for (const selector of ["header button:visible", "header a:visible", "main table tbody a:visible"]) {
      if ((await page.locator(selector).count()) === 0) continue;

      await page.locator(selector).first().focus();
      const state = await focusIndicator(page, selector);
      expect(state.outline || state.ring, `${selector} has no focus indicator`).toBe(true);
      checked.push(selector);
    }

    // Without this the test passes by checking nothing the day a selector stops
    // matching — the failure mode that makes a green suite worse than none.
    expect(checked.length).toBeGreaterThan(0);
  });

  test("the light theme is declared to the browser", async ({ page }) => {
    await page.goto("/");
    if ((await themeAttr(page)) !== "light") await toggle(page).click();

    // color-scheme drives form controls and scrollbars, not just our own CSS.
    const scheme = await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    );
    expect(scheme).toBe("light");
  });

  test("switching theme does not disturb the page you are on", async ({ page }) => {
    await page.goto("/artilharia");
    await toggle(page).click();

    await expect(page).toHaveURL(/\/artilharia$/);
    await expect(page.locator("table thead th").nth(1)).toHaveText(/jogador/i);
  });
});

/**
 * The one control the specs above cannot reach.
 *
 * They tab to the *first* focusable thing and sweep `:visible` selectors, which
 * covers every control that shares the state layer. The current section entry
 * does not share it: it is a filled chip, so it deliberately takes no hover
 * veil. That exclusion is exactly how it lost its focus ring — the ring lived
 * inside the state layer, and skipping one took the other with it.
 *
 * Kept separate rather than folded above because it guards a specific past
 * mistake rather than the general rule, and the two fail for different reasons.
 */
test.describe("Foco do teclado", () => {
  test("the current section keeps its ring even though it takes no state layer", async ({
    page,
  }) => {
    await page.goto("/");

    // No menu to open any more: the destinations are visible at every width,
    // in the header above `sm` and in the navigation bar below it.
    const current = page
      .getByRole("link", { name: "Classificação" })
      .filter({ visible: true })
      .first();
    await expect(current).toHaveAttribute("aria-current", "page");

    // Reach it by Tab rather than `.focus()`. `:focus-visible` is a heuristic:
    // after a pointer interaction — and opening the menu above is one — Chrome
    // does not treat a programmatic focus as keyboard focus, so the ring would
    // correctly not draw and this would be measuring the wrong thing.
    let reached = false;
    for (let i = 0; i < 12 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(
        () => document.activeElement?.getAttribute("aria-current") === "page",
      );
    }
    expect(reached, "never tabbed to the current section").toBe(true);

    // `transition` covers outline-color, so an immediate read samples the ring
    // mid-fade from currentColor rather than the colour it settles on.
    await page.waitForTimeout(400);

    const state = await page.evaluate(() => {
      const node = document.activeElement as HTMLElement;
      const style = getComputedStyle(node);
      return {
        focusVisible: node.matches(":focus-visible"),
        outline: style.outlineStyle !== "none" && style.outlineWidth !== "0px",
        ring: style.boxShadow !== "none" && style.boxShadow !== "",
      };
    });

    expect(state.focusVisible).toBe(true);
    // Agnostic about the mechanism, matching the specs above: an outline and a
    // box-shadow ring are both fine, having neither is not.
    expect(state.outline || state.ring).toBe(true);
  });
});
