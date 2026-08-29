import { expect, test, type Page } from "@playwright/test";

/**
 * The two halves of M9: the desktop navigation drawn as MD3 tabs, and MD3's
 * 48dp touch-target floor on the controls this app owns.
 *
 * **What counts as a control here is a decision, not an omission.** MD3's 48dp
 * minimum is for touch targets — buttons, pickers, destinations. It is not for
 * an inline link inside running copy or a table cell, and this app is full of
 * those: twenty club names at 16px in the Classificação, ten fixture links at
 * 24px on Jogos, and roughly 950 player-name buttons at 24px on Jogadores. A
 * spec asserting "every anchor is 48dp" would fail on all of them and the
 * honest fix would be to delete the spec. So the set is named rather than
 * inferred, and what is *not* in it is written down in `docs/md3-completion-plan.md`
 * under M9 rather than left to look like an oversight.
 *
 * The account control is absent for a different reason: PR #173 is rewriting
 * it, and it measured 36x44. Its floor is that PR's to apply.
 */

const CONTROLS: { page: string; label: string; selector: string }[] = [
  { page: "/jogos", label: "round stepper (previous)", selector: '[aria-label="Rodada anterior"]' },
  { page: "/jogos", label: "round stepper (next)", selector: '[aria-label="Próxima rodada"]' },
  { page: "/jogos", label: "round picker", selector: "select" },
  { page: "/partida/554951", label: "back link", selector: "main button:has-text('Voltar')" },
];

const boxOf = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { h: Math.round(r.height), w: Math.round(r.width) };
  });

test.describe("Alvos de toque", () => {
  for (const { page: path, label, selector } of CONTROLS) {
    test(`${label} clears MD3's 48dp floor`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path);
      await page.locator("main").waitFor();

      const box = await boxOf(page, selector);
      expect(box.h, `${label} is ${box.h}px tall`).toBeGreaterThanOrEqual(48);
      expect(box.w, `${label} is ${box.w}px wide`).toBeGreaterThanOrEqual(48);
    });
  }

  // The theme toggle moved to `touch-targets.spec.ts`. It asserted a 48dp
  // **box**, which was the model M9 shipped and the wrong one: a top-app-bar
  // control is a 40dp container with a 48dp target, and putting the floor on the
  // box overrode the `h-10` that levelled the trailing group. That file asserts
  // the container, the target and — the only one a stylesheet cannot fake — a
  // press outside the box that still reaches the control.

  test("every bottom navigation destination clears it", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const heights = await page
      .locator("nav.fixed a")
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));

    expect(heights.length, "the bottom bar should hold five destinations").toBe(5);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(48);
  });
});

test.describe("Abas do topo", () => {
  const tabs = (page: Page) => page.locator('header nav[aria-label="Seções"] a');

  test("the current destination is primary over an indicator, not a filled chip", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/jogos");

    const current = tabs(page).and(page.locator("[aria-current='page']"));
    await expect(current).toHaveCount(1);

    const style = await current.evaluate((el) => {
      const own = getComputedStyle(el);
      const indicator = getComputedStyle(el, "::after");
      return {
        colour: own.color,
        background: own.backgroundColor,
        indicatorHeight: indicator.height,
        indicatorColour: indicator.backgroundColor,
      };
    });
    const primary = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim(),
    );

    // The label takes `primary`; the chip's fill is gone. Comparing against the
    // token rather than a literal keeps this honest across both themes and any
    // future retoning — the same discipline `theme.spec.ts` uses.
    expect(style.colour).toBe(await hexToRgb(page, primary));
    expect(style.background, "a tab has no container fill").toMatch(/rgba?\(0, 0, 0, 0\)|transparent/);

    // MD3's indicator is 3dp.
    expect(style.indicatorHeight).toBe("3px");
    expect(style.indicatorColour).toBe(await hexToRgb(page, primary));
  });

  test("the other destinations carry no indicator", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/jogos");

    const others = tabs(page).and(page.locator(":not([aria-current='page'])"));
    const heights = await others.evaluateAll((els) =>
      els.map((el) => getComputedStyle(el, "::after").height),
    );
    expect(heights.length).toBe(4);
    for (const h of heights) expect(h).not.toBe("3px");
  });

  test("no destination wraps, at any width the bar is shown", async ({ page }) => {
    // The header has been tight since the fifth section landed, and the trailing
    // group grew by 9px when the toggle took the 48dp floor — which was enough
    // to break "Ao vivo" onto two lines at 1280 before `whitespace-nowrap`.
    // A wrapped label is also an indicator no longer sitting under one line.
    for (const width of [640, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/jogos");
      await page.locator("main").waitFor();

      // **Measure the label's own line boxes, not the tab's height.** The tab
      // carries `min-h-12`, so a label that wraps onto two lines still reports
      // 48px — two lines of `body-medium` is 40px and fits inside the floor.
      // The height assertion was written first, and removing `whitespace-nowrap`
      // left it green: a test that passes against the bug it names. A text
      // node's client rects are one per line box, which cannot be fooled that
      // way.
      const lines = await tabs(page).evaluateAll((els) =>
        els.map((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return { label: el.textContent?.trim() ?? "", lines: range.getClientRects().length };
        }),
      );
      expect(lines.length, `five destinations at ${width}`).toBe(5);
      for (const { label, lines: n } of lines) {
        expect(n, `"${label}" wraps onto ${n} lines at ${width}`).toBe(1);
      }

      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflows, `the page scrolls sideways at ${width}`).toBe(false);
    }
  });
});

/** `#rrggbb` as the `rgb(r, g, b)` a computed style reports. */
const hexToRgb = async (page: Page, hex: string) =>
  page.evaluate((h) => {
    const n = parseInt(h.slice(1), 16);
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
  }, hex);
