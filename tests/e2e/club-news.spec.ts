import { expect, test, type Page } from "@/tests/e2e/clock";

import { newsFor } from "@/club-core";
import { CLUB_NEWS } from "@/src/data/club-news";

/**
 * **Notícias do clube** on the club page — `club-posts.spec.ts`' arrangement:
 * navigate by slug rather than by table position, read the expected entries
 * out of the data file rather than writing them down twice, and produce the
 * empty state with a prepared module rather than hunting for a club that has
 * none. `tests/club-news.test.ts` asserts the table is not empty, so the
 * populated cases cannot pass vacuously.
 */
const BOTAFOGO = "1770";

const withNoCuratedNews = async (page: Page) => {
  let served = 0;
  await page.route("**/src/data/club-news.ts*", (route) => {
    served += 1;
    return route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: "export const CLUB_NEWS = {};\n",
    });
  });
  return () => served;
};

const heading = (page: Page) =>
  page.getByRole("main").getByRole("heading", { name: "Notícias do clube" });

test.describe("Notícias do clube", () => {
  test("each recorded report is a headline linking out to the publisher", async ({ page }) => {
    const expected = newsFor(CLUB_NEWS, BOTAFOGO);
    await page.goto("/clube/botafogo");
    await expect(heading(page)).toBeVisible();

    const links = page.locator("[data-club-news] [data-news-link]");
    await expect(links).toHaveCount(expected.length);

    const first = links.first();
    await expect(first).toContainText(expected[0].title);
    await expect(first).toHaveAttribute("href", expected[0].url);
    await expect(first).toHaveAttribute("target", "_blank");
    await expect(first).toHaveAttribute("rel", /noopener/);
    // The stored address is linked as it stands — no tracker survives to the page.
    expect(await first.getAttribute("href")).not.toContain("?");
  });

  test("the date is the Brazil-local day, written in words", async ({ page }) => {
    await page.goto("/clube/botafogo");
    const row = page.locator("[data-news-item]").first();
    // Asserted as shape rather than as the day, so a newer entry does not
    // redden this; `dayLabel`'s own tests hold the conversion.
    await expect(row).toContainText(/\d{1,2} de [a-zç]+ de \d{4} · [a-z.]+/);
  });

  test("it sits below Acontecimentos and above Jogos disputados", async ({ page }) => {
    await page.goto("/clube/botafogo");
    await expect(heading(page)).toBeVisible();

    const order = await page.getByRole("main").getByRole("heading", { level: 3 }).allInnerTexts();
    const at = (name: string) => {
      const index = order.indexOf(name);
      expect(index, `"${name}" is not among ${JSON.stringify(order)}`).toBeGreaterThan(-1);
      return index;
    };
    expect(at("Notícias do clube")).toBeGreaterThan(at("Acontecimentos"));
    expect(at("Notícias do clube")).toBeLessThan(at("Jogos disputados"));
  });

  test("a club with no recorded report gets no heading at all", async ({ page }) => {
    const served = await withNoCuratedNews(page);
    await page.goto("/clube/botafogo");
    await expect(page.getByRole("heading", { level: 3, name: "Jogos disputados" })).toBeVisible();
    await expect(heading(page)).toHaveCount(0);
    expect(served(), "the prepared module was never served").toBeGreaterThan(0);
  });
});
