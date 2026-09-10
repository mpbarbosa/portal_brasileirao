import { expect, test } from "@/tests/e2e/clock";

import { CLUB_VIDEOS } from "@/src/data/club-videos";

/**
 * The **Vídeos do clube** section, on the club page **and on the Painel**.
 *
 * One component, two call sites — so the second describe below is deliberately
 * not a copy of the first. What is worth asserting twice is only what could
 * differ between the two pages: that the section is there at all, that it is
 * absent for a club with no entry, and **where in the page it lands**. The
 * frame's address, the caption and the picker are properties of the component
 * and are asserted once, above.
 *
 * **Three hooks, and each names one thing** — `data-club-video-frame` the
 * player, `data-club-video-out` the caption's way to YouTube,
 * `data-club-video` a picker card. They were one attribute while the section
 * was a rail of link-outs, and splitting them is `data-scatter-svg`'s
 * precedent: a single selector would now resolve to the caption's link, which
 * comes first in the DOM, and every assertion written about a *card* would
 * quietly be about a line of text instead.
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

/**
 * Serve `src/data/club-videos.ts` as an EMPTY map, so a club page renders what a
 * club with no entry looks like.
 *
 * **Every club in the division now has an entry, so that state can no longer be
 * found — it has to be prepared.** The two "no heading" specs below reached it
 * through Vasco for as long as Vasco had no video; the 2026-09-10 upload gave it
 * one and left no club without. `CLAUDE.md`'s rule for exactly this is to
 * produce the state with a prepared payload rather than hunt the data for a
 * record in it, and `meu-time.spec.ts` does it for a LIVE fixture the snapshot
 * never holds. The difference is only the layer: that one prepares an `/api`
 * envelope, and this file is a committed module the client imports, so the
 * request intercepted is the module's own.
 *
 * **It works because this spec runs against Vite in middleware mode**, which
 * serves each `src/` file as its own ES module over HTTP. The bundle target
 * would inline it, and it runs only `seo`, `page-meta` and `routing`.
 *
 * Prepared once and fulfilled from memory, never `route.fetch()` per request —
 * the proxying form is the one `CLAUDE.md` records flaking under seven workers.
 * The count it returns is the known-negative: a pattern that silently matched
 * nothing would otherwise leave the real module loading.
 */
const withNoCuratedVideos = async (page: import("@playwright/test").Page) => {
  let served = 0;
  await page.route("**/src/data/club-videos.ts*", (route) => {
    served += 1;
    return route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: "export const CLUB_VIDEOS = {};\n",
    });
  });
  return () => served;
};

test.describe("Vídeos do clube", () => {
  test("a club with curated videos shows the rail", async ({ page }) => {
    await page.goto("/clube/palmeiras");

    await expect(
      page.getByRole("main").getByRole("heading", { name: "Vídeos do clube" }),
    ).toBeVisible();

    const cards = page.locator("[data-club-video]");
    await expect(cards).toHaveCount(CLUB_VIDEOS[PALMEIRAS].length);
  });

  test("no player is mounted until a card is pressed", async ({ page }) => {
    await page.goto("/clube/palmeiras");
    await expect(page.locator("[data-club-video]").first()).toBeVisible();

    // **The whole of what makes this a facade**, and the reason the club page
    // may carry a player at all where `CONTEXT.md` refused one for years: a
    // reader who came for the campanha asks YouTube for nothing. Asserted as
    // *no frame anywhere on the page*, not merely none in this section — the
    // cost being avoided is a third-party frame, wherever it is mounted.
    await expect(page.locator("main iframe")).toHaveCount(0);
    await expect(page.locator("[data-club-video-frame]")).toHaveCount(0);
  });

  test("pressing a card plays it in the page, in the box it was in", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/clube/palmeiras");

    const id = CLUB_VIDEOS[PALMEIRAS][0].id;
    const card = page.locator(`[data-club-video="${id}"]`);
    await expect(card).toBeVisible();
    await expect(card).toHaveAccessibleName(/tocar aqui na página/);

    // The card's thumbnail box, before — the player has to land in exactly it.
    const before = await card.locator("span").first().boundingBox();
    expect(before).not.toBeNull();

    await card.click();

    const frame = page.locator(`[data-club-video-frame="${id}"]`);
    await expect(frame).toBeVisible();
    // It did not navigate: this is the whole claim of "plays in the page".
    await expect(page).toHaveURL(/\/clube\/palmeiras$/);

    const after = await frame.boundingBox();
    expect(after).not.toBeNull();
    // **The same box, which is what costs the section no height** — and the
    // reason this shape was chosen over a frame above the rail. An
    // always-mounted 736px frame put the section's bottom at 1619px against
    // `screenshot.ts`' MAX_HEIGHT of 1170, which would have dropped the whole
    // section out of `clube-palmeiras-{light,dark}`.
    expect(Math.abs(after!.width - before!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(1);
  });

  test("the section is the same height before and after a press", async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 1170 });
    await page.goto("/clube/palmeiras");
    await expect(page.locator("[data-club-video]").first()).toBeVisible();

    // Measured on the section rather than on the card, because what the
    // screenshot crop walks is the section's own bottom — and because a player
    // that matched the thumbnail's box while adding a caption line beneath it
    // would pass the previous spec and still evict the section from the frame.
    const section = page.locator("section", {
      has: page.getByRole("heading", { name: "Vídeos do clube" }),
    });
    const before = await section.boundingBox();

    await page.locator("[data-club-video]").first().click();
    await expect(page.locator("[data-club-video-frame]")).toBeVisible();

    const after = await section.boundingBox();
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(1);
  });

  test("the frame is the nocookie host, and autoplay is the reader's own press", async ({
    page,
  }) => {
    await page.goto("/clube/palmeiras");

    const id = CLUB_VIDEOS[PALMEIRAS][0].id;
    await page.locator(`[data-club-video="${id}"]`).click();

    const src = await page.locator("[data-club-video-frame] iframe").getAttribute("src");

    // `youtube-nocookie.com` is YouTube's privacy-enhanced host. `www.youtube.com`
    // looks identical on the page and writes cookies on load.
    expect(src).toContain("https://www.youtube-nocookie.com/embed/");
    expect(src).toContain(id);
    // **`autoplay` belongs here and nowhere else.** The frame was mounted by
    // the reader's press, so without it their press would put a second play
    // button under the cursor — `videoPressedEmbedUrl`'s whole reason. What the
    // objection was ever about is a video starting on a page *load*, which the
    // spec above proves cannot happen here.
    expect(src).toContain("autoplay=1");
    expect(src).toContain("playsinline=1");
    await expect(page.locator("[data-club-video-frame] iframe")).toHaveAttribute(
      "referrerpolicy",
      "strict-origin-when-cross-origin",
    );
  });

  test("only one video plays at a time", async ({ page }) => {
    await page.goto("/clube/palmeiras");

    const first = CLUB_VIDEOS[PALMEIRAS][0].id;
    const second = CLUB_VIDEOS[PALMEIRAS][1].id;

    await page.locator(`[data-club-video="${first}"]`).click();
    await expect(page.locator(`[data-club-video-frame="${first}"]`)).toBeVisible();

    await page.locator(`[data-club-video="${second}"]`).click();

    // **Two things able to play at once is the refusal `MatchHighlights` states
    // and this inherits**, and it is why the state is one id rather than a flag
    // per card — a flag per card is a way for two to be true.
    await expect(page.locator(`[data-club-video-frame="${second}"]`)).toBeVisible();
    await expect(page.locator(`[data-club-video-frame="${first}"]`)).toHaveCount(0);
    await expect(page.locator("main iframe")).toHaveCount(1);
    // And the one that stopped is a card again, so nothing is stranded.
    await expect(page.locator(`[data-club-video="${first}"]`)).toBeVisible();
  });

  test("a playing card keeps its title, and it is the way out to YouTube", async ({ page }) => {
    await page.goto("/clube/palmeiras");

    const video = CLUB_VIDEOS[PALMEIRAS][0];
    await page.locator(`[data-club-video="${video.id}"]`).click();

    // **The way out, and it is not a courtesy.** A frame can fail for reasons
    // no list anticipates — a video pulled since it was curated, an embed the
    // uploader later disallowed — and what YouTube draws then is its own error
    // card, with no way forward inside it.
    const out = page.locator(`[data-club-video-out="${video.id}"]`);
    await expect(out).toBeVisible();
    await expect(out).toHaveAttribute("href", `https://www.youtube.com/watch?v=${video.id}`);
    await expect(out).toHaveAttribute("target", "_blank");
    // `noopener` is the one that is a real defect and looks identical on the
    // page — the reason `ClubLinks` owns whole anchors rather than marks.
    await expect(out).toHaveAttribute("rel", /noopener/);
    await expect(out).toContainText(video.title);
    await expect(out).toHaveAccessibleName(/abre em nova aba/);
  });

  test("each card is still a link, so a modified click does not play", async ({ page }) => {
    await page.goto("/clube/palmeiras");

    const id = CLUB_VIDEOS[PALMEIRAS][0].id;
    const card = page.locator(`[data-club-video="${id}"]`);

    // **This is a link first**, exactly as in `MatchList`, `ClubView` and
    // `MatchHighlights`: "open in new tab" has to keep working, so the href is
    // real and the handler bails out on a modified click rather than
    // swallowing it.
    await expect(card).toHaveAttribute("href", `https://www.youtube.com/watch?v=${id}`);
    await expect(card).toHaveAttribute("target", "_blank");
    await expect(card).toHaveAttribute("rel", /noopener/);

    // **The behavioural half, and it deliberately never opens the tab.**
    // Letting `click({ modifiers })` through would send a real browser to
    // `youtube.com`, which is a host this suite must not reach — the property
    // `fixtures.ts` exists to defend, and one no assertion is worth spending.
    // So the click is synthesised and its default suppressed: React's handler
    // still runs, sees `ctrlKey`, and returns before mounting anything.
    const synthClick = (ctrlKey: boolean) =>
      page.locator(`[data-club-video="${id}"]`).evaluate((el, ctrl) => {
        const stop = (event: Event) => event.preventDefault();
        document.addEventListener("click", stop, true);
        el.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: ctrl }),
        );
        document.removeEventListener("click", stop, true);
      }, ctrlKey);

    await synthClick(true);
    // No player, which is what a href assertion cannot see.
    await expect(page.locator("main iframe")).toHaveCount(0);

    // **The known-negative, and without it the assertion above is vacuous.** A
    // synthetic click that reached nothing at all would leave the page equally
    // frameless. The same dispatch without the modifier has to mount one.
    await synthClick(false);
    await expect(page.locator(`[data-club-video-frame="${id}"]`)).toBeVisible();
  });

  test("the card names the video and whose it is", async ({ page }) => {
    await page.goto("/clube/palmeiras");

    const video = CLUB_VIDEOS[PALMEIRAS][0];
    const card = page.locator(`[data-club-video="${video.id}"]`);

    await expect(card).toContainText(video.title);
    // Provenance. The seed entries are this app's own render, and a reader is
    // owed that before they take one for a broadcaster's package.
    await expect(card).toContainText(video.channel);
  });

  test("the rail names the group, and each card names its own action", async ({ page }) => {
    await page.goto("/clube/palmeiras");

    // On the anchor, not on the `ul`. A list label is announced on entering the
    // list, so a reader arriving at the third card by Tab would never hear it —
    // which is what the first draft did.
    const card = page.locator("[data-club-video]").first();
    await expect(card).toHaveAccessibleName(/tocar aqui na página/);

    // The list still names the group, and does not repeat the action.
    const rail = page.getByRole("list", { name: /Vídeos sobre/ });
    await expect(rail).toHaveAttribute("aria-label", /Palmeiras/);
  });

  test("the thumbnail is YouTube's own, lazily loaded and decorative", async ({ page }) => {
    await page.goto("/clube/palmeiras");

    const id = CLUB_VIDEOS[PALMEIRAS][0].id;
    const thumb = page.locator(`[data-club-video="${id}"] img`);

    // **`maxresdefault`, which is the one the rail asks for first** — 1280×720
    // and native 16:9, where the `hqdefault` beneath it is 480×360 with the
    // picture letterboxed. The card is capped at 416 CSS px, so this is about
    // the reader's device pixels rather than the layout: a 3× phone is asking
    // for nearly 1000 of them behind a card the fallback has 480 for.
    await expect(thumb).toHaveAttribute("src", `https://img.youtube.com/vi/${id}/maxresdefault.jpg`);
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

    const id = CLUB_VIDEOS[PALMEIRAS][0].id;
    const thumb = page.locator(`[data-club-video="${id}"] img`);

    // Not merely "some src": the fallback has to be *this video's* other size.
    // A swap that lost the id would render a different video's picture under
    // this one's title, which is the failure that looks like data rather than
    // like a broken image.
    await expect(thumb).toHaveAttribute("src", `https://img.youtube.com/vi/${id}/hqdefault.jpg`);
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
    // screenshot crop. At 26rem it grows by about 135 and the page is the same
    // page.
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
    //
    // Vasco DOES have a video in the real file, and that is asserted rather than
    // assumed: it is what makes an empty rail here a consequence of the prepared
    // module, and not of a club that happens to have none. This line used to
    // assert the opposite, and flipped the day the last two clubs were uploaded.
    expect(Object.keys(CLUB_VIDEOS)).toContain("1780");
    const served = await withNoCuratedVideos(page);

    await page.goto("/clube/vasco-da-gama");
    await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toBeVisible();

    await expect(
      page.getByRole("main").getByRole("heading", { name: "Vídeos do clube" }),
    ).toHaveCount(0);
    await expect(page.locator("[data-club-video]")).toHaveCount(0);
    await expect(page.locator("main iframe")).toHaveCount(0);
    expect(served()).toBeGreaterThan(0);
  });

  test("the rail scrolls inside itself and never widens the page", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/clube/palmeiras");
    await expect(page.locator("[data-club-video]").first()).toBeVisible();

    // The whole reason the rail is its own scroll container. A page body that
    // scrolls sideways on a phone is the failure the Classificação's frozen
    // columns exist to prevent, one section down.
    const overflows = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
    expect(await overflows()).toBe(false);

    // And again with a player mounted, since the frame is a second thing able
    // to set a width — the failure the candles' `grow min-w-0` records.
    await page.locator("[data-club-video]").first().click();
    await expect(page.locator("[data-club-video-frame]")).toBeVisible();
    expect(await overflows()).toBe(false);
  });
});

/**
 * The same section on the **Painel do clube**, which is the page the velas
 * videos are actually about.
 */
test.describe("Vídeos do clube no Painel", () => {
  test("the painel of a club with curated videos shows the rail, and no player yet", async ({
    page,
  }) => {
    await page.goto("/painel/palmeiras");

    await expect(
      page.getByRole("main").getByRole("heading", { name: "Vídeos do clube" }),
    ).toBeVisible();
    await expect(page.locator("[data-club-video]")).toHaveCount(CLUB_VIDEOS[PALMEIRAS].length);
    // The facade holds on this page too — asserted rather than inherited,
    // because the two call sites pass the same props and could still diverge
    // in what the page around them mounts.
    await expect(page.locator("main iframe")).toHaveCount(0);

    // The picker names the club whose painel this is, not the one the reader
    // came from — the label is built from `club.shortName` at each call site.
    await expect(page.getByRole("list", { name: /Vídeos sobre/ })).toHaveAttribute(
      "aria-label",
      /Palmeiras/,
    );
  });

  test("the section sits below the Perfil and above the club-page link", async ({ page }) => {
    await page.goto("/painel/palmeiras");
    await expect(page.locator("[data-club-video]").first()).toBeVisible();

    // **This is the decision, and it is the only thing here a stylesheet cannot
    // hold.** The section renders from a committed file while everything above
    // it comes from `/api/matches`, so higher up it would sit complete while
    // the page's own subject was still loading — the argument `ClubProfile`
    // already makes one line above it.
    //
    // Measured as geometry rather than as DOM order: the sections are siblings,
    // so `compareDocumentPosition` would pass on a flex `order` that moved the
    // section up the page visually.
    const box = async (locator: import("@playwright/test").Locator) => {
      const rect = await locator.boundingBox();
      if (!rect) throw new Error("element has no box");
      return rect;
    };

    const perfil = await box(page.getByRole("heading", { name: "Perfil" }));
    const videos = await box(page.getByRole("heading", { name: "Vídeos do clube" }));
    const link = await box(page.getByRole("link", { name: /Página do/ }));

    expect(videos.y).toBeGreaterThan(perfil.y);
    expect(link.y).toBeGreaterThan(videos.y);
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
    const videos = await page.getByRole("heading", { name: "Vídeos do clube" }).boundingBox();
    expect(drawing).not.toBeNull();
    expect(videos).not.toBeNull();
    expect(videos!.y).toBeGreaterThan(drawing!.y + drawing!.height);
  });

  test("a painel whose club has no curated video shows no heading at all", async ({ page }) => {
    // **This is the one spec in this describe that passes with the section
    // removed, and it is here to fail if the rule is ever made broader** — a
    // component that rendered an empty heading for a club with no entry. Read
    // it as a bound, never as coverage of the feature: the others were
    // confirmed red against the painel without the section, and this one was
    // green in the same run, by construction.
    //
    // Vasco again, through the same prepared empty module as the club-page spec
    // above, and for its reason: every club now has an entry, so the state has
    // to be produced rather than found.
    expect(Object.keys(CLUB_VIDEOS)).toContain("1780");
    const served = await withNoCuratedVideos(page);

    await page.goto("/painel/vasco-da-gama");
    await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toBeVisible();

    await expect(
      page.getByRole("main").getByRole("heading", { name: "Vídeos do clube" }),
    ).toHaveCount(0);
    await expect(page.locator("[data-club-video]")).toHaveCount(0);
    await expect(page.locator("main iframe")).toHaveCount(0);
    expect(served()).toBeGreaterThan(0);
  });

  test("the section never widens the painel", async ({ page }) => {
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
