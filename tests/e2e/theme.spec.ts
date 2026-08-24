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
