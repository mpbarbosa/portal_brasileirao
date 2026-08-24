import { expect, test, type Page } from "@playwright/test";

const SM_BREAKPOINT = 640;
const isCollapsed = (page: Page) => (page.viewportSize()?.width ?? 0) < SM_BREAKPOINT;

/** The one curated fixture: Botafogo x Athletico-PR, round 24. */
const CURATED_ROUND = "24";

const goToRound = async (page: Page, round: string) => {
  await page.goto("/jogos");
  if (isCollapsed(page)) {
    // The nav is already where we want to be; nothing to open.
  }
  await page.getByRole("combobox", { name: "Rodada" }).selectOption(round);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(`${round}ª rodada`);
};

test.describe("Onde assistir", () => {
  test("a curated fixture shows its channels", async ({ page }) => {
    await goToRound(page, CURATED_ROUND);

    const withChannels = page.locator("main ul > li").filter({ hasText: "Premiere" });
    await expect(withChannels).toHaveCount(1);
    await expect(withChannels).toContainText("SporTV");
  });

  test("channels are announced, not left as a bare emoji", async ({ page }) => {
    await goToRound(page, CURATED_ROUND);

    // The emoji is decorative; assistive tech needs the label.
    await expect(page.getByText("Onde assistir:")).toHaveCount(1);
  });

  test("fixtures without curated channels show no broadcast line", async ({ page }) => {
    await goToRound(page, CURATED_ROUND);

    const fixtures = page.locator("main ul > li");
    const total = await fixtures.count();
    const labelled = await page.getByText("Onde assistir:").count();

    // Most of a round is uncurated — an empty line would be worse than none.
    expect(total).toBeGreaterThan(labelled);
  });

  test("an uncurated round shows no broadcast lines at all", async ({ page }) => {
    await goToRound(page, "1");

    await expect(page.getByText("Onde assistir:")).toHaveCount(0);
  });
});
