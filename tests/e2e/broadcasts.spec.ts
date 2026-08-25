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

  test("a broadcaster is shown as its own mark", async ({ page }) => {
    await page.goto("/partida/554972");

    // Premiere, YouTube and Cazé TV all have one; the image carries the
    // broadcaster name so the marks read exactly as the text they replaced.
    const marks = page.locator("dd img[alt]");
    await expect(marks.first()).toBeVisible();

    const alts = await marks.evaluateAll((all) => all.map((i) => i.getAttribute("alt")));
    expect(alts).toContain("Premiere");
    expect(alts.every((a) => (a ?? "").length > 0)).toBe(true);
  });

  test("the marks load from Commons", async ({ page }) => {
    await page.goto("/partida/554972");

    const mark = page.locator("dd img[alt='Premiere']");
    await expect(mark).toHaveAttribute("src", /commons\.wikimedia\.org.*Special:FilePath/);
    // A thumbnail, not the full asset.
    await expect(mark).toHaveAttribute("src", /width=\d+/);
  });

  test("a broadcaster with no mark still reads as its name", async ({ page }) => {
    await page.goto("/partida/554972");

    // Record's only Commons logo is CC BY-SA, so it renders as a wordmark
    // rather than an image — and must still be legible, not missing.
    await expect(page.getByText("Record", { exact: true })).toBeVisible();
  });

  test("the highlights link keeps its name when the label becomes a mark", async ({ page }) => {
    await page.goto("/partida/554975");

    // The accessible name must not rest on an image's alt: these are lazy and
    // cross-origin, so the text carries it and the mark is decorative.
    await expect(page.getByRole("link", { name: /^ge tv —/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^CazéTV —/ })).toBeVisible();
  });
});
