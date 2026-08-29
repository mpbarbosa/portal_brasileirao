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
 * The account control is absent from `CONTROLS` for a different reason again,
 * and it is covered rather than skipped: it is the one control whose *container*
 * is deliberately smaller than its target. MD3 puts a top-app-bar control at
 * 40dp and every touch target at 48dp, and `min-h-12` can only satisfy both
 * where nothing named a height. So it draws its target with a pseudo-element
 * and the assertions below read that instead of the border box — which
 * `boxOf` cannot do, since `getBoundingClientRect` returns the 40dp box and
 * would report a pass at 40 or a failure at 48 depending only on which one you
 * asked for.
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

  test("the theme toggle clears it too", async ({ page }) => {
    // The one icon-only control in the header, and the one the plan named by
    // arithmetic: `py-2` around a 20px line box plus a 1px outline each side is
    // 38px. Measured at 38x39 before the floor landed.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const box = await boxOf(page, "header button[aria-label^='Ativar tema']");
    expect(box.h).toBeGreaterThanOrEqual(48);
    expect(box.w).toBeGreaterThanOrEqual(48);
  });

  for (const { label, signedIn } of [
    { label: "signed out", signedIn: false },
    { label: "signed in", signedIn: true },
  ]) {
    test(`the account control (${label}) clears the floor without growing its container`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/");
      if (signedIn) {
        const response = await page.request.post("/api/auth/dev-login", {
          data: { subject: "sub-target", name: "Ana Torcedora" },
        });
        expect(response.ok()).toBeTruthy();
        await page.goto("/");
      }
      await page.locator("main").waitFor();

      const control = page.locator("[data-account]");
      await expect(control).toHaveAttribute(
        "data-account",
        signedIn ? "signed-in" : "signed-out",
      );

      // Read both from one measurement, unrounded. `boxOf` rounds, and the
      // control is 96.58px wide against a `w-full` target of the same 96.58 —
      // rounding the one and not the other reported the target as narrower than
      // the control it exactly covers.
      const measured = await control.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const after = getComputedStyle(el, "::after");
        return {
          box: { h: box.height, w: box.width },
          target: { h: parseFloat(after.height), w: parseFloat(after.width) },
        };
      });

      // The container stays at MD3's 40dp for a top-app-bar control...
      expect(measured.box.h, `the container is ${measured.box.h}px tall`).toBe(40);

      // ...while the target it actually offers a thumb clears 48dp both ways.
      const { target } = measured;
      expect(target.h, `the touch target is ${target.h}px tall`).toBeGreaterThanOrEqual(48);
      expect(target.w, `the touch target is ${target.w}px wide`).toBeGreaterThanOrEqual(48);
      // `getComputedStyle` serialises a length to four decimal places, so a
      // `w-full` target reads 96.5781 against a control that measures
      // 96.578125 — a formatting artifact of the two APIs, not a gap a thumb
      // could find. The epsilon is that difference and nothing more.
      expect(
        target.w,
        "the target should cover the whole control, not a stripe down its middle",
      ).toBeGreaterThanOrEqual(measured.box.w - 0.001);
    });
  }

  test("the account control's target does not reach into the theme toggle", async ({ page }) => {
    // The failure this technique has: a target drawn wider than its control
    // grows into whatever sits beside it, and swallows that control's clicks
    // while looking untouched. Here it grows 4dp each side into a `gap-1`.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.locator("main").waitFor();

    const reach = await page.locator("[data-account]").evaluate((el) => {
      const box = el.getBoundingClientRect();
      const after = getComputedStyle(el, "::after");
      const width = parseFloat(after.width);
      // Centred on the control, so it overhangs by half the difference.
      return {
        width,
        left: box.left - (width - box.width) / 2,
        right: box.right + (width - box.width) / 2,
      };
    });

    // Stated as a precondition rather than assumed: with no target drawn,
    // `parseFloat` yields NaN and every comparison below fails as NaN, which
    // reads as an overlap rather than as an absence.
    expect(reach.width, "no touch target is drawn at all").toBeGreaterThanOrEqual(48);
    const toggle = await page
      .locator("header button[aria-label^='Ativar tema']")
      .evaluate((el) => el.getBoundingClientRect().left);

    expect(reach.right, "the account target overlaps the theme toggle").toBeLessThanOrEqual(toggle);

    // And the toggle still answers a click at its own centre.
    const before = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );
    await page.locator("header button[aria-label^='Ativar tema']").click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute("data-theme")))
      .not.toBe(before);
  });

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
