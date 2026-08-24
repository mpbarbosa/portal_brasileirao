import { expect, test, type Page } from "@playwright/test";

/**
 * These assert the *shape* of the broadcast line, not how many fixtures happen
 * to be curated: `src/data/broadcasts.ts` grows every time the sync script runs,
 * so any test counting curated fixtures would break on the next sync.
 *
 * Two rounds are relied on, both stable because the data is committed:
 * round 25 is fully curated, round 1 is in the past and never was.
 */
const CURATED_ROUND = "25";
const UNCURATED_ROUND = "1";

const goToRound = async (page: Page, round: string) => {
  await page.goto(`/jogos/${round}`);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(`${round}ª rodada`);
  await expect(page.locator("main ul > li").first()).toBeVisible();
};

test.describe("Onde assistir", () => {
  test("a curated round shows channels", async ({ page }) => {
    await goToRound(page, CURATED_ROUND);

    const labelled = await page.getByText("Onde assistir:").count();
    expect(labelled).toBeGreaterThan(0);
  });

  test("every broadcast line is announced, not left as a bare emoji", async ({ page }) => {
    await goToRound(page, CURATED_ROUND);

    // The 📺 is decorative; each line needs the visually hidden label.
    const lines = page.locator("main ul > li").filter({ hasText: "📺" });
    const labels = page.getByText("Onde assistir:");

    expect(await labels.count()).toBe(await lines.count());
  });

  test("no broadcast line is empty", async ({ page }) => {
    await goToRound(page, CURATED_ROUND);

    for (const line of await page.locator("main ul > li").filter({ hasText: "📺" }).all()) {
      const text = (await line.innerText()).replace(/📺/g, "").trim();
      expect(text.length).toBeGreaterThan(0);
      // A channel name, not a stray separator.
      expect(text).toMatch(/[A-Za-zÀ-ÿ0-9+]/);
    }
  });

  test("channels are separated readably when there are several", async ({ page }) => {
    await goToRound(page, CURATED_ROUND);

    const multi = page.locator("main ul > li").filter({ hasText: " · " });
    if ((await multi.count()) > 0) {
      await expect(multi.first()).toContainText(/\S\s·\s\S/);
    }
  });

  test("an uncurated round shows no broadcast lines at all", async ({ page }) => {
    // Absent means unknown, and an empty line would be worse than none.
    await goToRound(page, UNCURATED_ROUND);

    await expect(page.getByText("Onde assistir:")).toHaveCount(0);
    await expect(page.getByText("📺")).toHaveCount(0);
  });
});
