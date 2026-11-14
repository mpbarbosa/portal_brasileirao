import { expect, test, type Page } from "@/tests/e2e/clock";
import { SEED_MATCHES } from "@/src/data/matches";

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
 * under M9 rather than left to look like an oversight — the club page's row of
 * external links included, which is 20px tall in a wrapping row where a 48dp
 * target would overhang the line above and below.
 *
 * The account control is absent for a different reason: PR #173 is rewriting
 * it, and it measured 36x44. Its floor is that PR's to apply.
 */

/**
 * Any fixture's page carries the back link, so the one measured is the seed's
 * first rather than a named id — it was 554951, which the capture set happens
 * to photograph.
 */
const ANY_FIXTURE = SEED_MATCHES[0];
if (!ANY_FIXTURE) throw new Error("the seed holds no fixture");

const CONTROLS: { page: string; label: string; selector: string }[] = [
  { page: "/jogos", label: "round stepper (previous)", selector: '[aria-label="Rodada anterior"]' },
  { page: "/jogos", label: "round stepper (next)", selector: '[aria-label="Próxima rodada"]' },
  { page: "/jogos", label: "round picker", selector: "select" },
  { page: `/partida/${ANY_FIXTURE.id}`, label: "back link", selector: "main button:has-text('Voltar')" },
];

/**
 * Measure a control, and refuse to measure a detached node.
 *
 * **The cause, and it is a test defect rather than a product one.** This spec
 * failed in CI on 2026-11-14 (run 43622584813, both the attempt and its retry)
 * with `back link is 0px tall`. `/partida/:id` opens on `NotFoundScreen` while
 * `loading`, which renders *the same* `← Voltar` button, and `main
 * button:has-text('Voltar')` matches it as readily as `MatchPage`'s. A locator
 * resolves to a handle and the `evaluate` runs a round-trip later; if React
 * swaps the node in between, the handle stays valid but points at nothing in the
 * document, and `getBoundingClientRect()` on a detached node answers **all
 * zeros**. A zero then reads exactly like a control that lost its 48dp floor,
 * which is the one thing this spec exists to report.
 *
 * **Measured, holding one handle across the loading→match swap** (PR #714, whose
 * finding and fix this carries): `{h: 48, connected: true}` before, `{h: 0,
 * connected: false}` after, and a node re-queried at that same instant `{h: 48,
 * connected: true}`. The back link is never short; it was never attached.
 *
 * **A correction, recorded because the wrong version shipped in PR #713 and the
 * next session would have read it as settled.** That commit's comment said this
 * node-swap reading had been "probed and disproved", on the grounds that a
 * locator re-resolves on every call. The re-resolution is real and the
 * refutation was not: the probe behind it waited two seconds and *then*
 * measured, so it re-queried after the swap had already happened and never
 * exercised the window between resolve and evaluate, which is the only window
 * where the staleness lives. #714 measured that window directly. A probe that
 * cannot observe the mechanism it is aimed at proves nothing about it.
 *
 * **There is deliberately no `toBeVisible()` gate, and that one is still a
 * finding.** It was the first attempt at a fix; a mutation — `height: 0
 * !important` on the control — showed it fails *first*, with Playwright's
 * generic "element is not visible", pre-empting the diagnostic below. Playwright
 * counts a zero-height box as not visible, so the gate and the diagnostic cannot
 * both fire, and the diagnostic is worth more.
 */
const boxOf = async (page: Page, selector: string) => {
  const box = await page
    .locator(selector)
    .first()
    .evaluate((el) => {
      // Refusing beats reporting: a detached node's rect is all zeros, and a
      // zero is indistinguishable from the real defect this spec watches for.
      if (!el.isConnected) throw new Error("the element detached while being measured");
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        h: Math.round(r.height),
        w: Math.round(r.width),
        display: cs.display,
        minHeight: cs.minHeight,
        html: el.outerHTML.slice(0, 120),
      };
    });

  // A zero box on an *attached* element is a different failure, and one nobody
  // has seen yet: `min-h-12` cannot resolve to 0 once the element has layout.
  // If it ever happens, say so with the evidence — the `min-height` beside the
  // `min-h-12` in the class list names an unapplied stylesheet on sight.
  if (box.h === 0 || box.w === 0) {
    throw new Error(
      `measured a ${box.w}x${box.h} box for ${selector}: display=${box.display} ` +
        `min-height=${box.minHeight} — ${box.html}`,
    );
  }

  return box;
};

test.describe("Alvos de toque", () => {
  for (const { page: path, label, selector } of CONTROLS) {
    test(`${label} clears MD3's 48dp floor`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path);
      await page.locator("main").waitFor();

      // Retried, not slept on: `toPass` re-resolves the locator each attempt, so a
      // node that detached mid-measurement is re-queried instead of being reported
      // as 0px. A control that genuinely sits below the floor never reaches 48 and
      // still fails — the retry changes how long the red takes, not whether it comes.
      await expect(async () => {
        const box = await boxOf(page, selector);
        expect(box.h, `${label} is ${box.h}px tall`).toBeGreaterThanOrEqual(48);
        expect(box.w, `${label} is ${box.w}px wide`).toBeGreaterThanOrEqual(48);
      }).toPass({ timeout: 5_000 });
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

  test("the current destination is boxed, not merely coloured", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/jogos");

    const current = tabs(page).and(page.locator("[aria-current='page']"));
    await expect(current).toHaveCount(1);

    const style = await current.evaluate((el) => {
      const own = getComputedStyle(el);
      return { colour: own.color, background: own.backgroundColor, borderColour: own.borderColor };
    });
    const [onSurface, surface, outline] = await Promise.all(
      ["--color-on-surface", "--color-surface", "--color-outline"].map((name) =>
        page.evaluate(
          (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
          name,
        ),
      ),
    );

    // The underline indicator gave way to a bordered box: the active tab
    // takes `on-surface` ink over a `surface` fill with an `outline` border —
    // comparing against the tokens rather than literals keeps this honest
    // across both themes, the same discipline `theme.spec.ts` uses.
    expect(style.colour).toBe(await hexToRgb(page, onSurface));
    expect(style.background).toBe(await hexToRgb(page, surface));
    expect(style.borderColour).toBe(await hexToRgb(page, outline));
  });

  test("the other destinations carry no box", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/jogos");

    const others = tabs(page).and(page.locator(":not([aria-current='page'])"));
    const borders = await others.evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).borderColor),
    );
    expect(borders.length).toBe(4);
    for (const b of borders) expect(b).toMatch(/rgba?\(0, 0, 0, 0\)|transparent/);
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
