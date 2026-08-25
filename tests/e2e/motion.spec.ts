import { expect, test, type Page } from "@playwright/test";

/**
 * Motion, and the readers who have asked for less of it.
 *
 * Nothing else in the suite would notice if either half broke. Playwright does
 * not watch things move, so a transition that silently stops applying looks
 * exactly like one that works — which is what happened during M5 itself:
 * `duration-short-4` compiles to nothing in Tailwind v4, because there is no
 * `--duration-*` utility namespace, and the app kept the framework default while
 * the class sat in the source looking correct.
 *
 * So both directions are asserted. That motion exists at MD3's values, and that
 * `prefers-reduced-motion: reduce` removes it. A test for only the second would
 * pass on an app with no motion at all.
 */

const control = (page: Page) => page.getByRole("button", { name: /Ativar tema/ }).first();

const openCard = async (page: Page) => {
  await page.goto("/artilharia");
  await expect(page.locator("table tbody tr")).not.toHaveCount(0);
  await page.locator("table tbody tr td:nth-child(2) button").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
};

/** Seconds, from whatever unit the computed style reports. */
const seconds = (value: string) => Number.parseFloat(value);

test.describe("Movimento", () => {
  test("controls transition at the standard duration and curve", async ({ page }) => {
    await page.goto("/");
    await expect(control(page)).toBeVisible();

    const style = await control(page).evaluate((el) => {
      const s = getComputedStyle(el);
      return { duration: s.transitionDuration, easing: s.transitionTimingFunction };
    });

    // Not the framework default of 150ms, and not an instant change.
    expect(seconds(style.duration)).toBeGreaterThan(0.1);
    // MD3's standard easing, rather than a browser default like `ease`.
    expect(style.easing).toContain("cubic-bezier");
  });

  test("the player card animates in", async ({ page }) => {
    await openCard(page);

    const style = await page.evaluate(`(() => {
      const s = getComputedStyle(document.querySelector("dialog"));
      return { name: s.animationName, duration: s.animationDuration };
    })()`);

    expect((style as { name: string }).name).not.toBe("none");
    expect(seconds((style as { duration: string }).duration)).toBeGreaterThan(0.1);
  });

  test.describe("com prefers-reduced-motion", () => {
    /**
     * `page.emulateMedia` rather than `test.use({ reducedMotion })`.
     *
     * The fixture form silently did not apply inside this nested describe — the
     * page kept reporting `no-preference` and the tests failed against a normal
     * build, which reads as "reduced motion is broken" rather than "the test
     * never enabled it". Hence the assertion below: an emulation that quietly
     * does nothing is worse than one that errors.
     */
    test("movement is removed from controls and the card alike", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");

      const applied = await page.evaluate(
        `matchMedia("(prefers-reduced-motion: reduce)").matches`,
      );
      expect(applied, "reduced-motion emulation did not apply").toBe(true);

      const controlDuration = await control(page).evaluate(
        (el) => getComputedStyle(el).transitionDuration,
      );

      await openCard(page);
      const dialogDuration = await page.evaluate(
        `getComputedStyle(document.querySelector("dialog")).animationDuration`,
      );

      // Near-zero rather than zero on purpose: a 0.01ms duration still fires
      // `transitionend`, so anything waiting on that event keeps working.
      expect(seconds(controlDuration)).toBeLessThan(0.01);
      expect(seconds(dialogDuration as string)).toBeLessThan(0.01);
    });

    test("colour feedback survives — only the movement goes", async ({ page }) => {
      // Removing the affordance along with the motion would be a worse outcome
      // than leaving the motion in: a control that does not react to hover or
      // focus is harder to use, not calmer.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await control(page).focus();

      const ring = await control(page).evaluate((el) => {
        const s = getComputedStyle(el);
        return { width: s.outlineWidth, style: s.outlineStyle };
      });

      expect(ring.style).not.toBe("none");
      expect(Number.parseFloat(ring.width)).toBeGreaterThanOrEqual(2);
    });
  });
});
