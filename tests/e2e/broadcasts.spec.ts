import { expect, test, type Page } from "@/tests/e2e/clock";

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
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText(`${round}ª rodada`);
  await expect(page.locator("main ul > li").first()).toBeVisible();
};

test.describe("Onde assistir", () => {
  test("a curated round shows channels", async ({ page }) => {
    await goToRound(page, CURATED_ROUND);

    const labelled = await page.getByText("Onde assistir:").count();
    expect(labelled).toBeGreaterThan(0);
  });

  test("every broadcast line is announced", async ({ page }) => {
    await goToRound(page, CURATED_ROUND);

    // The marks are pictures; the visually hidden label is what says what they
    // are. One label per line that carries marks.
    const lines = page.locator("main ul > li").filter({ has: page.locator("[data-mark]") });
    const labels = page.getByText("Onde assistir:");

    expect(await lines.count()).toBeGreaterThan(0);
    expect(await labels.count()).toBe(await lines.count());
  });

  test("no broadcast line is empty", async ({ page }) => {
    await goToRound(page, CURATED_ROUND);

    const lines = await page.locator("main ul > li").filter({ has: page.locator("[data-mark]") }).all();
    for (const line of lines) {
      // Every mark names its broadcaster, whether it is a logo or a wordmark.
      const names = await line.locator("[data-mark]").evaluateAll((all) =>
        all.map((m) => m.getAttribute("data-mark") ?? ""),
      );
      expect(names.length).toBeGreaterThan(0);
      expect(names.every((n) => n.trim().length > 0)).toBe(true);
    }
  });

  test("several channels render as several marks", async ({ page }) => {
    await goToRound(page, CURATED_ROUND);

    const lines = await page.locator("main ul > li").filter({ has: page.locator("[data-mark]") }).all();
    const counts = await Promise.all(lines.map((l) => l.locator("[data-mark]").count()));

    // Each is its own mark rather than one run of text, so a fixture on two
    // channels shows two.
    expect(counts.some((n) => n > 1)).toBe(true);
  });

  test("an uncurated round shows no broadcast lines at all", async ({ page }) => {
    // Absent means unknown, and an empty line would be worse than none.
    await goToRound(page, UNCURATED_ROUND);

    await expect(page.getByText("Onde assistir:")).toHaveCount(0);
    await expect(page.locator("[data-mark]")).toHaveCount(0);
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

  test("every mark actually renders", async ({ page }) => {
    await page.goto("/partida/554972");

    const mark = page.locator("dd img[alt='Premiere']");
    // Served from our own origin. Hotlinking Commons passed a src assertion
    // while showing empty plates in production, because Commons answers a
    // browser's third or fourth request with 429 — so assert the pixels, not
    // the attribute.
    await expect(mark).toHaveAttribute("src", "/marks/premiere.png");
    // These are lazy, so bring them into view before asking whether they
    // painted — otherwise this passes or fails on viewport height.
    await mark.scrollIntoViewIfNeeded();
    await expect(mark).toBeVisible();

    const loaded = await page.locator("dd img").evaluateAll((all) =>
      all.map((i) => ({ alt: i.getAttribute("alt"), ok: (i as HTMLImageElement).naturalWidth > 0 })),
    );
    expect(loaded.length).toBeGreaterThan(0);
    expect(loaded.filter((m) => !m.ok)).toEqual([]);
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
