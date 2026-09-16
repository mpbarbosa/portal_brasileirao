import { expect, test, type Page } from "@/tests/e2e/clock";

import { CLUB_POSTS } from "@/src/data/club-posts";

/**
 * **Publicações do clube** on the club page.
 *
 * **Deliberately not a copy of `player-posts.spec.ts`.** One component draws
 * both sections, so the frame's address, the `referrerpolicy`, the modified
 * click and the way out beneath are properties of `InstagramPosts` and are
 * asserted once, there. What is worth asserting here is only what could differ
 * between the two call sites: that the section exists on this page at all, that
 * it is absent for a club with none, **where in the page it lands**, and that
 * the club page still asks Meta for nothing until a reader presses.
 *
 * **It navigates to a slug rather than clicking through the table** —
 * `club-videos.spec.ts`' rule, and for its reason: coverage is curated and
 * partial, so which *position* a club with a post sits at moves every week, and
 * `club.spec.ts`' `openClubAt(1)` would be asserting against whoever leads the
 * division that day. The seed is read from `CLUB_POSTS` rather than written
 * down twice, so an entry re-summarised in the file cannot leave this spec
 * asserting the old string; what is pinned is the **club**, because the section
 * only exists for one that has an entry, and `tests/club-posts.test.ts` asserts
 * the table is not empty so this cannot pass vacuously.
 */
const FLAMENGO = "1783";

/**
 * Serve `src/data/club-posts.ts` as an EMPTY map, so a club page renders what a
 * club with no entry looks like.
 *
 * **Palmeiras has no post today and that is not good enough**, which is
 * `CLAUDE.md`'s rule about never pinning a spec to which record happens to hold
 * a value — met from its negative side. Curated coverage grows by hand, so the
 * first club post added for Palmeiras would turn this assertion red on a commit
 * that broke nothing. Producing the state is what `club-videos.spec.ts` had to
 * fall back to once every club had a video, and starting there costs nothing.
 *
 * It works because this spec runs against Vite in middleware mode, which serves
 * each `src/` file as its own ES module over HTTP; the bundle target would
 * inline it, and it runs only `seo`, `page-meta` and `routing`.
 *
 * Prepared once and fulfilled from memory, never `route.fetch()` per request —
 * the proxying form is the one `CLAUDE.md` records flaking under seven workers.
 * The count it returns is the known-negative: a pattern that silently matched
 * nothing would otherwise leave the real module loading, and the "no section"
 * assertion below would pass for the wrong reason.
 */
const withNoCuratedPosts = async (page: Page) => {
  let served = 0;
  await page.route("**/src/data/club-posts.ts*", (route) => {
    served += 1;
    return route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: "export const CLUB_POSTS = {};\n",
    });
  });
  return () => served;
};

const heading = (page: Page) =>
  page.getByRole("main").getByRole("heading", { name: "Publicações do clube" });

test.describe("Publicações do clube", () => {
  test("a club with a recorded post shows the section, and no frame until it is pressed", async ({
    page,
  }) => {
    await page.goto("/clube/flamengo");

    await expect(heading(page)).toBeVisible();

    const facades = page.locator("[data-post-facade]");
    await expect(facades).toHaveCount(CLUB_POSTS[FLAMENGO].length);

    // **The whole argument for the facade**, asserted rather than described: a
    // reader who opened a club page for its campanha has asked Meta for
    // nothing. As on the Vídeos section, this is *no frame anywhere on the
    // page* rather than none in this section — the cost being avoided is a
    // third-party frame, wherever it is mounted.
    await expect(page.locator("main iframe")).toHaveCount(0);
  });

  test("the section names the club's own account", async ({ page }) => {
    await page.goto("/clube/flamengo");

    // The rule `src/data/club-posts.ts` states and `tests/club-posts.test.ts`
    // enforces against `club-instagram.ts`, read here off the words the page
    // actually prints — the account the reader is shown, not the field.
    const facade = page.locator("[data-post-facade]").first();
    await expect(facade).toContainText(`@${CLUB_POSTS[FLAMENGO][0].account}`);
  });

  /**
   * **The viewport is set, and it is standing on a pre-existing bug rather than
   * on a preference.** `club-videos.spec.ts` sets one before its own click test
   * on this page and does not say why; this is why.
   *
   * A club page whose **Vídeos do clube** rail holds three or more cards
   * expands the mobile layout viewport to **801px inside a 412px screen** —
   * measured by serving the same club the same page with only the count
   * varying: 1 card 412, 2 cards 412, 3 cards 801, and Palmeiras at 1 and 2
   * clean, so it is the rail's card count and not the club. Playwright then
   * computes the element's position in an 801px page and clicks in a 412px
   * device space, so a target far down the page is missed by roughly its own
   * offset — which surfaces as *"<h3>Acontecimentos</h3> … intercepts pointer
   * events"*, naming a different element on each retry and reading like a
   * flake.
   *
   * Flamengo is the club with three videos and the club with a post, which is
   * why this section's spec is the first to meet it. **It is not this
   * section's bug**: emptying `CLUB_POSTS` leaves the same 801, byte for byte,
   * so the page is like this on `origin/main` and on the live site. Setting a
   * viewport here buys a spec that tests the facade rather than the rail's
   * layout; the bug itself is filed separately, and when it is fixed this call
   * can go.
   */
  test("pressing the facade mounts the captioned embed", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/clube/flamengo");
    await page.locator("[data-post-facade]").first().click();

    const frame = page.locator("[data-post-frame]").first();
    await expect(frame).toBeVisible();
    // `/p/<code>/` answers `X-Frame-Options: DENY` and cannot be framed at all,
    // and the uncaptioned `/embed/` misreports its own height badly enough to
    // clip the picture. A frame pointed at either renders as an empty white
    // box, which is what this names.
    await expect(frame).toHaveAttribute(
      "src",
      /^https:\/\/www\.instagram\.com\/p\/[\w-]+\/embed\/captioned\/$/,
    );
  });

  /**
   * **The placement, which is the one thing about this section that no unit
   * test can hold.** `scripts/screenshot.ts` crops a capture at the last
   * section fitting in 1080 CSS px, so a section inserted above another can
   * evict it from the committed frame — the failure that cost `partida-554977`
   * its campanha and 581px. The club page's answer is that each new extra goes
   * at the **foot** of the run, where the worst it can do is fall outside the
   * crop itself.
   *
   * Asserted as document order rather than as pixels: the rule is about which
   * section comes last, and a y-coordinate would additionally depend on every
   * section's height and on the viewport, which is a spec that goes red for
   * reasons it is not about.
   */
  test("it sits below Acontecimentos and above Jogos disputados", async ({ page }) => {
    await page.goto("/clube/flamengo");
    await expect(heading(page)).toBeVisible();

    const order = await page
      .getByRole("main")
      .getByRole("heading", { level: 3 })
      .allInnerTexts();

    const at = (name: string) => {
      const index = order.indexOf(name);
      expect(index, `"${name}" is not among ${JSON.stringify(order)}`).toBeGreaterThan(-1);
      return index;
    };

    expect(at("Publicações do clube")).toBeGreaterThan(at("Acontecimentos"));
    expect(at("Publicações do clube")).toBeLessThan(at("Jogos disputados"));
  });

  test("a club with no recorded post gets no heading at all", async ({ page }) => {
    const served = await withNoCuratedPosts(page);
    await page.goto("/clube/flamengo");

    // The page rendered, so the assertion below is about an absent section
    // rather than about an absent page.
    await expect(page.getByRole("heading", { level: 3, name: "Jogos disputados" })).toBeVisible();
    await expect(heading(page)).toHaveCount(0);

    // An empty heading over nothing is the failure; so is a stub that matched
    // no request and left the real module loading, which this rules out.
    expect(served(), "the prepared module was never served").toBeGreaterThan(0);
  });
});
