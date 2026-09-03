import { expect, test } from "@/tests/e2e/clock";

import { CLUB_VIDEOS } from "@/src/data/club-videos";

/**
 * The **Vídeos do clube** rail on the club page.
 *
 * **It navigates to a slug rather than clicking through the table**, and that
 * is not laziness: coverage here is curated and partial, so which *position* a
 * club with videos sits at moves every week — `club.spec.ts`' `openClubAt(1)`
 * would be asserting against whoever leads the division that day. `CLAUDE.md`'s
 * rule is never to assert how much curated data exists or which record holds a
 * value; the corollary is to reach the record by its key.
 *
 * The seed is read from `CLUB_VIDEOS` rather than written down twice, so an
 * entry retitled in the file cannot leave this spec asserting the old string.
 * What is pinned is the *club*, since the section only exists for a club that
 * has one.
 */
const PALMEIRAS = "1769";

test.describe("Vídeos do clube", () => {
  test("a club with curated videos shows the rail", async ({ page }) => {
    await page.goto("/clube/palmeiras");

    const section = page.getByRole("main").getByRole("heading", { name: "Vídeos do clube" });
    await expect(section).toBeVisible();

    const cards = page.locator("[data-club-video]");
    await expect(cards).toHaveCount(CLUB_VIDEOS[PALMEIRAS].length);
  });

  test("each card opens the video on YouTube in a new tab, safely", async ({ page }) => {
    await page.goto("/clube/palmeiras");

    const card = page.locator("[data-club-video]").first();
    await expect(card).toBeVisible();

    const id = CLUB_VIDEOS[PALMEIRAS][0].id;
    // The watch address, built from the id alone — no `&list=`, no `?si=`.
    await expect(card).toHaveAttribute("href", `https://www.youtube.com/watch?v=${id}`);
    await expect(card).toHaveAttribute("target", "_blank");
    // `noopener` is the one that is a real defect and looks identical on the
    // page — the reason `ClubLinks` owns whole anchors rather than marks.
    await expect(card).toHaveAttribute("rel", /noopener/);
  });

  test("each card says where it goes, on the link rather than on the list", async ({ page }) => {
    await page.goto("/clube/palmeiras");

    // On the anchor, not on the `ul`. A list label is announced on entering the
    // list, so a reader arriving at the third card by Tab would never hear it —
    // which is what the first draft did.
    const card = page.locator("[data-club-video]").first();
    await expect(card).toHaveAccessibleName(/no YouTube \(abre em nova aba\)/);

    // The list still names the group, and does not repeat the destination.
    const rail = page.getByRole("list", { name: /Vídeos sobre/ });
    await expect(rail).toHaveAttribute("aria-label", /Palmeiras/);
  });

  test("the card names the video and whose it is", async ({ page }) => {
    await page.goto("/clube/palmeiras");

    const video = CLUB_VIDEOS[PALMEIRAS][0];
    const card = page.locator("[data-club-video]").first();

    await expect(card).toContainText(video.title);
    // Provenance. The seed entries are this app's own render, and a reader is
    // owed that before they take one for a broadcaster's package.
    await expect(card).toContainText(video.channel);
  });

  test("the thumbnail is YouTube's own, lazily loaded and decorative", async ({ page }) => {
    await page.goto("/clube/palmeiras");

    const thumb = page.locator("[data-club-video] img").first();
    const id = CLUB_VIDEOS[PALMEIRAS][0].id;

    await expect(thumb).toHaveAttribute("src", `https://img.youtube.com/vi/${id}/hqdefault.jpg`);
    // Below the fold on a club page, and `load` waits for eager images — the
    // failure mode the crest CDN produced across seven spec files.
    await expect(thumb).toHaveAttribute("loading", "lazy");
    // The link's text already names the video; an alt would read it twice.
    await expect(thumb).toHaveAttribute("alt", "");
  });

  test("a club with no curated video shows no heading at all", async ({ page }) => {
    // Not an empty section: `CONTEXT.md` avoids "a heading over a club with no
    // entries" for this page the way **Onde acompanhar** avoids it on the card.
    const withoutVideos = Object.keys(CLUB_VIDEOS);
    expect(withoutVideos).not.toContain("1780"); // Vasco, the club used below.

    await page.goto("/clube/vasco-da-gama");
    await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toBeVisible();

    await expect(
      page.getByRole("main").getByRole("heading", { name: "Vídeos do clube" }),
    ).toHaveCount(0);
    await expect(page.locator("[data-club-video]")).toHaveCount(0);
  });

  test("the rail scrolls inside itself and never widens the page", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/clube/palmeiras");
    await expect(page.locator("[data-club-video]").first()).toBeVisible();

    // The whole reason the rail is its own scroll container. A page body that
    // scrolls sideways on a phone is the failure the Classificação's frozen
    // columns exist to prevent, one section down.
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
  });
});
