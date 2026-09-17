import { expect, test, type Page } from "@/tests/e2e/clock";
import type { ProjectionPayload } from "@/projection-core";

/**
 * **Projeção** beneath the Classificação.
 *
 * Shape and agreement, never values: the suite runs the frozen snapshot, and a
 * sync-seed-data moves every percentage. What must hold whatever the data is
 * that the page shows exactly the clubs the payload says are worth naming, in
 * the payload's order of likelihood, and that it degrades to nothing rather
 * than to an error banner.
 */

const readProjection = (page: Page): Promise<ProjectionPayload> =>
  page.evaluate(async () => (await (await fetch("/api/projection")).json()).data);

const percent = (label: string): number => {
  const trimmed = label.trim();
  if (trimmed === ">99%") return 99.5;
  if (trimmed === "<1%") return 0.4;
  return Number(trimmed.replace("%", ""));
};

test.describe("Projeção", () => {
  test("the payload is a distribution, and the same one twice", async ({ page }) => {
    await page.goto("/");
    const first = await readProjection(page);
    const second = await readProjection(page);

    expect(second).toEqual(first);
    expect(first.remaining).toBeGreaterThan(0);
    expect(first.played).toBeGreaterThan(0);

    const sum = (field: "title" | "g4" | "z4") => first.clubs.reduce((total, club) => total + club[field], 0);
    expect(sum("title")).toBeCloseTo(1, 6);
    expect(sum("g4")).toBeCloseTo(4, 6);
    expect(sum("z4")).toBeCloseTo(4, 6);
  });

  test("each board names the clubs the payload does, most likely first", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("[data-projection]");
    await expect(section).toBeVisible();
    await expect(section.locator("[data-projection-caption]")).toContainText("Simulado");

    const payload = await readProjection(page);

    for (const field of ["title", "g4", "z4"] as const) {
      const expected = payload.clubs.filter((club) => club[field] >= 0.005).length;
      const items = section.locator(`[data-board="${field}"] li`);
      await expect(items).toHaveCount(expected);

      const values = (await items.locator("span.ml-auto").allInnerTexts()).map(percent);
      for (const label of await items.locator("span.ml-auto").allInnerTexts()) {
        expect(label.trim()).toMatch(/^(>99%|100%|\d{1,2}%)$/);
      }
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
      }
    }
  });

  test("a failed projection leaves the table and raises no banner", async ({ page }) => {
    await page.route("**/api/projection", (route) => route.fulfill({ status: 503, body: "" }));
    await page.goto("/");

    await expect(page.locator("table tbody tr").first()).toBeVisible();
    await expect(page.locator("[data-league-stats]")).toBeVisible();
    await expect(page.locator("[data-projection]")).toHaveCount(0);
    await expect(page.getByText("respondeu 503")).toHaveCount(0);
  });
});
