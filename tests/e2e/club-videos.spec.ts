import { expect, test } from "@/tests/e2e/clock";

import { CLUB_VIDEOS } from "@/src/data/club-videos";

/**
 * The **Vídeos do clube** rail, on the club page **and on the Painel**.
 *
 * One component, two call sites — so the second describe below is deliberately
 * not a copy of the first. What is worth asserting twice is only what could
 * differ between the two pages: that the rail is there at all, that it is
 * absent for a club with no entry, and **where in the page it lands**. The
 * anchor's target, its accessible name and its thumbnail are properties of the
 * component and are asserted once, above.
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

    // **`maxresdefault`, which is the one the rail asks for first** — 1280×720
    // and native 16:9, where the `hqdefault` beneath it is 480×360 with the
    // picture letterboxed. The card is capped at 416 CSS px, so this is about
    // the reader's device pixels rather than the layout: a 3× phone is asking
    // for nearly 1000 of them behind a card the fallback has 480 for.
    await expect(thumb).toHaveAttribute(
      "src",
      `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
    );
    // Below the fold on a club page, and `load` waits for eager images — the
    // failure mode the crest CDN produced across seven spec files.
    await expect(thumb).toHaveAttribute("loading", "lazy");
    // The link's text already names the video; an alt would read it twice.
    await expect(thumb).toHaveAttribute("alt", "");
  });

  test("a video with no HD thumbnail falls back rather than drawing a hole", async ({ page }) => {
    // **This is the branch the suite's own stub hides.** `OFFLINE_HOSTS` in
    // `tests/e2e/fixtures.ts` fulfils every `img.youtube.com` request with a
    // 200 pixel, so `maxresdefault` never fails and the fallback never runs —
    // the shape `CLAUDE.md` records for the `page.route` stub that passed
    // against the bug it named. The 404 has to be routed deliberately, exactly
    // as `crest-fallback.spec.ts` drives a 503 to reach the monogram.
    //
    // Registered after the fixture's route and therefore winning: Playwright
    // matches handlers in reverse order of registration.
    await page.route(/maxresdefault\.jpg/, (route) => route.fulfill({ status: 404 }));

    await page.goto("/clube/palmeiras");

    const thumb = page.locator("[data-club-video] img").first();
    const id = CLUB_VIDEOS[PALMEIRAS][0].id;

    // Not merely "some src": the fallback has to be *this video's* other size.
    // A swap that lost the id would render a different video's picture under
    // this one's title, which is the failure that looks like data rather than
    // like a broken image.
    await expect(thumb).toHaveAttribute(
      "src",
      `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    );
    // And the card is still a card — the frame keeps its box, so the fallback
    // is a different picture rather than a collapsed row.
    const box = await thumb.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(50);
  });

  test("the card fills the column on a phone and is capped on a desktop", async ({ page }) => {
    // **The cap is the half that is a decision.** Uncapped, the card is the
    // full 736px content column, the thumbnail is 414px tall, and the card
    // grows by about 320px — enough to push a section out of the Painel's
    // 1080px screenshot crop. At 26rem it grows by about 135 and the page is
    // the same page.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/clube/palmeiras");

    const card = page.locator("[data-club-video]").first();
    await expect(card).toBeVisible();

    const wide = await card.boundingBox();
    expect(wide).not.toBeNull();
    // 26rem at the default root size. Asserted as a ceiling rather than an
    // equality, since what matters is that the column's surplus does not reach
    // the card — the rule `CAMPAIGN_COLUMN` states one table over.
    expect(wide!.width).toBeLessThanOrEqual(416 + 1);
    // And it is not the 176 it was: a cap that happened to bind at the old
    // width would pass the line above and change nothing.
    expect(wide!.width).toBeGreaterThan(300);

    // On a phone the cap never binds and the card is the column. Measured
    // against the rail's own content box rather than the viewport, because the
    // `ul` carries `-mx-1 px-1` and a viewport comparison would be asserting
    // that arithmetic rather than the width.
    await page.setViewportSize({ width: 360, height: 800 });
    const narrow = await card.boundingBox();
    const railWidth = await page
      .getByRole("list", { name: /Vídeos sobre/ })
      .evaluate((el) => el.clientWidth - parseFloat(getComputedStyle(el).paddingLeft) * 2);
    expect(narrow).not.toBeNull();
    expect(Math.abs(narrow!.width - railWidth)).toBeLessThanOrEqual(1);
  });

  test("the play badge keeps its share of the card as the card grows", async ({ page }) => {
    // **This is the failure that already happened once, written down as a
    // gate.** The card went from 176px to 416 and the badge stayed at 36 — it
    // filled a fifth of the old card and a twelfth of the new one, and nothing
    // anywhere went red, because a mark's size is not something a stylesheet
    // can be wrong about. The badge is the whole affordance here: it is what
    // says "video" without a word of copy, so a card that outgrows it is a card
    // that has quietly stopped saying so.
    //
    // A **proportion** rather than a pixel count, because it is the ratio that
    // rotted and the pixel count that was innocent. Asserted at the widest the
    // card is ever drawn, which is where the ratio is smallest.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/clube/palmeiras");

    const card = page.locator("[data-club-video]").first();
    await expect(card).toBeVisible();
    // The disc, not the frame or the veil: it is the innermost span, and the
    // one carrying the brand colour.
    const badge = page.locator("[data-club-video] span span span").first();

    const cardBox = await card.boundingBox();
    const badgeBox = await badge.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(badgeBox).not.toBeNull();

    // 11.5% today. The floor is what a later widening has to clear, and it is
    // set below the current value rather than at it so that a few pixels of
    // layout drift is not a failure — what this refuses is a card that grows
    // while the badge stands still.
    const share = badgeBox!.width / cardBox!.width;
    expect(share).toBeGreaterThan(0.1);
    // Square, and actually drawn. A disc collapsed to nothing would satisfy a
    // ratio test against a card that had collapsed with it.
    expect(badgeBox!.width).toBeGreaterThanOrEqual(40);
    expect(Math.abs(badgeBox!.width - badgeBox!.height)).toBeLessThanOrEqual(1);
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

/**
 * The same rail on the **Painel do clube**, which is the page the velas videos
 * are actually about.
 */
test.describe("Vídeos do clube no Painel", () => {
  test("the painel of a club with curated videos shows the rail", async ({ page }) => {
    await page.goto("/painel/palmeiras");

    const section = page.getByRole("main").getByRole("heading", { name: "Vídeos do clube" });
    await expect(section).toBeVisible();

    const cards = page.locator("[data-club-video]");
    await expect(cards).toHaveCount(CLUB_VIDEOS[PALMEIRAS].length);
    // The rail names the club whose painel this is, not the one the reader came
    // from — the label is built from `club.shortName` at each call site.
    await expect(page.getByRole("list", { name: /Vídeos sobre/ })).toHaveAttribute(
      "aria-label",
      /Palmeiras/,
    );
  });

  test("the rail sits below the Perfil and above the club-page link", async ({ page }) => {
    await page.goto("/painel/palmeiras");
    await expect(page.locator("[data-club-video]").first()).toBeVisible();

    // **This is the decision, and it is the only thing here a stylesheet cannot
    // hold.** The rail renders from a committed file while everything above it
    // comes from `/api/matches`, so higher up it would sit complete while the
    // page's own subject was still loading — the argument `ClubProfile` already
    // makes one line above it. And every card leaves for YouTube, so it belongs
    // beside the other exit rather than between the drawing and the numbers
    // that describe it.
    //
    // Measured as geometry rather than as DOM order: the sections are siblings,
    // so `compareDocumentPosition` would pass on a flex `order` that moved the
    // rail up the page visually.
    const box = async (locator: import("@playwright/test").Locator) => {
      const rect = await locator.boundingBox();
      if (!rect) throw new Error("element has no box");
      return rect;
    };

    const perfil = await box(page.getByRole("heading", { name: "Perfil" }));
    const rail = await box(page.getByRole("heading", { name: "Vídeos do clube" }));
    const link = await box(page.getByRole("link", { name: /Página do/ }));

    expect(rail.y).toBeGreaterThan(perfil.y);
    expect(link.y).toBeGreaterThan(rail.y);
  });

  test("the candles are still the page's subject, and keep their place", async ({ page }) => {
    await page.goto("/painel/palmeiras");
    await expect(page.locator("[data-club-video]").first()).toBeVisible();

    // Adding a section to a page is how a drawing gets pushed out of the frame
    // — the failure `CLAUDE.md` records for the Partida and estádio captures,
    // where content added *above* a section evicted it silently. Nothing here
    // may come between the two campanha sections and the drawing they hold.
    const candles = page.locator("main svg[data-candles]").first();
    await expect(candles).toBeVisible();

    const drawing = await candles.boundingBox();
    const rail = await page.getByRole("heading", { name: "Vídeos do clube" }).boundingBox();
    expect(drawing).not.toBeNull();
    expect(rail).not.toBeNull();
    expect(rail!.y).toBeGreaterThan(drawing!.y + drawing!.height);
  });

  test("a painel whose club has no curated video shows no heading at all", async ({ page }) => {
    // **This is the one spec in this describe that passes with the rail
    // removed, and it is here to fail if the rule is ever made broader** — a
    // component that rendered an empty heading for a club with no entry. Read
    // it as a bound, never as coverage of the feature: the other four were
    // confirmed red against the painel without the rail, and this one was
    // green in the same run, by construction.
    //
    // Vasco again, and read from the file rather than written down: the point
    // is that this club has no entry, not that it is this club.
    expect(Object.keys(CLUB_VIDEOS)).not.toContain("1780");

    await page.goto("/painel/vasco-da-gama");
    await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toBeVisible();

    await expect(
      page.getByRole("main").getByRole("heading", { name: "Vídeos do clube" }),
    ).toHaveCount(0);
    await expect(page.locator("[data-club-video]")).toHaveCount(0);
  });

  test("the rail scrolls inside itself and never widens the painel", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/painel/palmeiras");
    await expect(page.locator("[data-club-video]").first()).toBeVisible();

    // Asserted on this page as well as on the club page, because the Painel
    // carries drawings that set their own widths — the candles' svg is
    // `grow min-w-0` precisely because `w-full` painted outside its card here.
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
  });
});
