import { expect, test, type Page } from "@playwright/test";

/**
 * MD3's 48dp touch target, which is **not** the control's visible box.
 *
 * The distinction stopped being pedantry on production. M9 put the floor on the
 * box — `min-h-12` in `controlClasses` — and because a `min-height` beats a
 * `height` whatever the class order, it silently overrode the `h-10` that had
 * just levelled the top app bar's trailing group. Measured at `844cb15`: the
 * theme toggle 48x48 beside a 40x97 account control. Two changes each correct
 * on their own, and an 8px wobble between them.
 *
 * The target lives on a pseudo-element now, so a size can pick a smaller
 * *visible* control without giving up the target. `bar` is MD3's 40dp
 * top-app-bar control; everything else keeps the 48dp box, because nothing
 * argued for a smaller body control and a stepper at 34x32 was too small to hit.
 *
 * **The last spec here clicks outside the visible box**, which is the only one
 * of these that proves anything a stylesheet could not have lied about: a
 * computed `::before` size says the rule applied, not that a thumb landing there
 * reaches the control.
 */

const boxes = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    const before = getComputedStyle(el, "::before");
    return {
      box: { h: Math.round(r.height), w: Math.round(r.width) },
      target: { h: parseFloat(before.height), w: parseFloat(before.width) },
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    };
  });

const TOGGLE = "header button[aria-label^='Ativar tema']";
const ACCOUNT = "header [data-account]";

test.describe("Alvos de toque na barra", () => {
  test("the trailing group is level, and every target clears 48dp", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.locator(ACCOUNT).waitFor();

    const toggle = await boxes(page, TOGGLE);
    const account = await boxes(page, ACCOUNT);

    // Level: the whole point. A difference here is the wobble coming back.
    expect(toggle.box.h, "the toggle and the account control must be one height")
      .toBe(account.box.h);
    // MD3's top-app-bar container.
    expect(toggle.box.h).toBe(40);
    // …and MD3's target, on both.
    for (const [name, m] of [["toggle", toggle], ["account", account]] as const) {
      expect(m.target.h, `${name} target height`).toBeGreaterThanOrEqual(48);
      expect(m.target.w, `${name} target width`).toBeGreaterThanOrEqual(48);
    }
  });

  test("a body control keeps the 48dp box it was given", async ({ page }) => {
    // The bar's 40dp container is a decision about the bar. Nothing argued for
    // shrinking the round stepper back to the 34x32 it was before M9.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/jogos");
    await page.locator("main select").waitFor();

    for (const selector of ['[aria-label="Rodada anterior"]', "main select"]) {
      const m = await boxes(page, selector);
      expect(m.box.h, `${selector} is ${m.box.h}px tall`).toBeGreaterThanOrEqual(48);
    }
  });

  test("a press 4px above the toggle still reaches it", async ({ page }) => {
    // The proof that the pseudo-element is a target and not a decoration.
    // Generated content participates in hit testing and its events target the
    // element that owns it — asserted here by pressing where the *box* is not.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.locator(TOGGLE).waitFor();

    const before = await page.getAttribute("html", "data-theme");
    const { rect } = await boxes(page, TOGGLE);

    // 4px above the top edge: inside the 48dp target, outside the 40dp box.
    await page.mouse.click(rect.x + rect.w / 2, rect.y - 4);

    await expect
      .poll(() => page.getAttribute("html", "data-theme"), {
        message: "clicking inside the target but outside the box did not toggle the theme",
      })
      .not.toBe(before);
  });
});
