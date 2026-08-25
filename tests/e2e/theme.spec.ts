import { expect, test, type Page } from "@playwright/test";

const themeAttr = (page: Page) => page.locator("html").getAttribute("data-theme");
const toggle = (page: Page) => page.getByRole("button", { name: /Ativar tema/ });
const canvas = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

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
 * Keyboard focus.
 *
 * Lives here because this file already exercises both palettes, and the ring is
 * drawn in `primary` — a ring that is invisible in one theme is the failure
 * worth catching.
 *
 * Nothing else in the suite would notice if these disappeared: Playwright
 * clicks, it does not tab, so every other spec passes on an app with no focus
 * styles at all. That was the app's actual state until M2.
 */
test.describe("Foco do teclado", () => {
  for (const theme of ["dark", "light"] as const) {
    test(`controls show a visible focus ring in the ${theme} theme`, async ({ page }) => {
      await page.addInitScript(
        ([key, value]) => localStorage.setItem(key as string, value as string),
        ["portal-brasileirao:theme", theme],
      );
      await page.goto("/");
      await expect(toggle(page)).toBeVisible();

      await toggle(page).focus();
      // `transition` covers outline-color, so reading immediately samples the
      // ring mid-fade from currentColor and reports the wrong colour.
      await page.waitForTimeout(400);

      const ring = await toggle(page).evaluate((el) => {
        const s = getComputedStyle(el);
        return { width: s.outlineWidth, style: s.outlineStyle, color: s.outlineColor };
      });
      const primary = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim(),
      );

      expect(ring.style).not.toBe("none");
      expect(parseFloat(ring.width)).toBeGreaterThanOrEqual(2);
      expect(primary).not.toBe("");
      expect(ring.color).not.toBe("rgb(0, 0, 0)");
    });
  }

  test("the current section keeps its ring even though it takes no state layer", async ({
    page,
  }) => {
    // Regression guard: folding the ring into the state layer left this entry —
    // a filled chip that deliberately has no hover veil — on the browser default.
    await page.goto("/");

    // Below `sm` the entries collapse behind a toggle, so the link exists but is
    // not focusable until the panel is open. Both layouts render the same entry.
    const menu = page.getByRole("button", { name: "Abrir menu" });
    if (await menu.isVisible()) await menu.click();

    const current = page
      .getByRole("link", { name: "Classificação" })
      .filter({ visible: true })
      .first();
    await expect(current).toHaveAttribute("aria-current", "page");

    // Reach it by Tab rather than `.focus()`. `:focus-visible` is a heuristic:
    // after a pointer interaction — and opening the menu above is one — Chrome
    // does not treat a programmatic focus as keyboard focus, so the ring would
    // correctly not draw and the test would be measuring the wrong thing.
    let reached = false;
    for (let i = 0; i < 12 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(
        () => document.activeElement?.getAttribute("aria-current") === "page",
      );
    }
    expect(reached, "never tabbed to the current section").toBe(true);
    await page.waitForTimeout(400);

    const ring = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement as Element);
      return { width: s.outlineWidth, style: s.outlineStyle };
    });
    expect(ring.style).not.toBe("none");
    expect(parseFloat(ring.width)).toBeGreaterThanOrEqual(2);
  });
});
