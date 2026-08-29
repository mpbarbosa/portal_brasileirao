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
 * **The trailing group reaches the floor the other way, and that is why the
 * assertions below it are about the *target* and not the box.** MD3 gives a
 * top-app-bar control a 40dp container and a 48dp touch target — two different
 * measurements — because a bar 56dp tall cannot hold a 48dp box with any
 * breathing room. Growing the box is the right answer everywhere else in this
 * file and the wrong one here.
 *
 * It is written down because it was got wrong once, in the gap between two
 * merges twenty-five seconds apart. #173 set `h-10` on all three trailing
 * controls to level them at 40dp; #174 put `min-h-12` in `Button`'s base,
 * which silently beat that `h-10` on the one of the three that is a `Button`.
 * The result rendered 48 beside 40 and passed everything — including this
 * file, whose theme-toggle case asserted a box of 48 and so asserted the
 * defect. A box assertion cannot see this. Hit-testing can.
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

  /**
   * Which named points of a 48dp box centred on the control do *not* hit it.
   *
   * `elementFromPoint` resolves a pseudo-element to the element that owns it,
   * so this measures the target a thumb actually lands on rather than the paint
   * — and it catches the neighbour stealing a sliver, which is a failure no
   * measurement of either control alone can see.
   */
  const targetMisses = (page: Page, selector: string) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`no element for ${sel}`);
      const r = el.getBoundingClientRect();
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      // Half a pixel inside the edge, so this asks about the target rather than
      // about the rounding at its boundary.
      const hw = Math.max(r.width, 48) / 2 - 0.5;
      const hh = Math.max(r.height, 48) / 2 - 0.5;
      const points: [string, number, number][] = [
        ["topo", cx, cy - hh],
        ["base", cx, cy + hh],
        ["esquerda", cx - hw, cy],
        ["direita", cx + hw, cy],
        ["topo-esquerda", cx - hw, cy - hh],
        ["base-direita", cx + hw, cy + hh],
      ];
      return points
        .filter(([, x, y]) => {
          const at = document.elementFromPoint(x, y);
          return !(at && (at === el || el.contains(at)));
        })
        .map(([name]) => name);
    }, selector);

  const TOGGLE = "header button[aria-label^='Ativar tema']";
  const ACCOUNT = "[data-account]";

  /** Sign in the way `contas.spec.ts` does — this suite runs with dev login on. */
  const devLogin = async (page: Page, name: string) => {
    const response = await page.request.post("/api/auth/dev-login", {
      data: { subject: `sub-${name}`, name },
    });
    expect(response.ok()).toBeTruthy();
  };

  test("the theme toggle carries a 48dp target on a 40dp box", async ({ page }) => {
    // The one icon-only control in the header, and the one the plan named by
    // arithmetic: `py-2` around a 20px line box plus a 1px outline each side is
    // 38px. Measured at 38x39 before any floor landed, and 39x40 now — the box
    // is MD3's 40dp container and is *supposed* to be under 48.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.locator("main").waitFor();

    const box = await boxOf(page, TOGGLE);
    expect(box.h, `the toggle is ${box.h}px tall, not MD3's 40dp container`).toBe(40);
    expect(await targetMisses(page, TOGGLE)).toEqual([]);
  });

  for (const state of ["signed-out", "signed-in"] as const) {
    test(`the account control carries one too, ${state}`, async ({ page }) => {
      // Signed in below `sm` this collapses to the 32dp disc inside a 40dp box
      // — 40x40, the smallest target in the app, and the one control a
      // signed-in reader taps to reach their own account. It was 36x44 before
      // #173 and 40x40 after, which improved the height and shrank the width;
      // neither ever reached the floor, because the floor was on the box.
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/");
      await page.locator("main").waitFor();

      if (state === "signed-in") {
        await devLogin(page, "Alvo");
        await page.reload();
        await page.locator("main").waitFor();
      }
      await expect(page.locator(ACCOUNT)).toHaveAttribute("data-account", state);

      const box = await boxOf(page, ACCOUNT);
      expect(box.h, `the account control is ${box.h}px tall`).toBe(40);
      expect(await targetMisses(page, ACCOUNT)).toEqual([]);
    });
  }

  test("the trailing group is level, and its two targets do not overlap", async ({ page }) => {
    // The failure this exists for is not either control being wrong on its own
    // — it is one of them being 48 while the other is 40, which is what a base
    // class silently overriding a call site produced. And the gap: both targets
    // overflow towards each other, so `gap-2` left them sharing a third of a
    // pixel and the account control's own right edge hit-tested to the toggle.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.locator("main").waitFor();
    await devLogin(page, "Nivel");
    await page.reload();
    await page.locator("main").waitFor();
    await expect(page.locator(ACCOUNT)).toHaveAttribute("data-account", "signed-in");

    const account = await boxOf(page, ACCOUNT);
    const toggle = await boxOf(page, TOGGLE);
    expect(
      Math.abs(account.h - toggle.h),
      `the group renders ${account.h} beside ${toggle.h}`,
    ).toBeLessThanOrEqual(1);

    // Each still owns its own target with the other one beside it.
    expect(await targetMisses(page, ACCOUNT)).toEqual([]);
    expect(await targetMisses(page, TOGGLE)).toEqual([]);
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
