import { test as base } from "@playwright/test";

/**
 * The base fixture every end-to-end spec builds on, and the one place the suite
 * is made **hermetic**.
 *
 * `CLAUDE.md` says a red build "always means the code broke — never that the
 * upstream had a bad minute". That was true of the *API*, which the harness
 * disables with `DISABLE_FOOTBALL_DATA`, and false of the **crest CDN** — the
 * same third party, hotlinked by all twenty clubs in `clubs.ts` and stubbed
 * nowhere. Measured on 2026-09-03: `crests.football-data.org` answering a single
 * image in 1.4–2.9s against a 0.5s control, while `page.goto` waits for `load`
 * and `load` waits for images. Twenty of them against a browser's ~6 connections
 * per host exceeds the 30s test timeout, and it surfaces as `net::ERR_ABORTED`
 * on the navigation rather than as a failed assertion — 85 failures across
 * seven spec files on an unmodified `main`, while CI stayed green.
 *
 * **It fulfils rather than aborts, and three existing assertions are why.**
 * `standings.spec.ts` reads the crest `referrerpolicy` off the DOM and the
 * `Referer` header off the wire, so the request must still be *made* and the
 * `src` must still be the real external URL — which is why this intercepts the
 * response and rewrites no markup. Another case there drives a **503** to prove
 * the letter fallback appears; aborting globally would raise that fallback on
 * every page and break every spec expecting an image. And the images must load
 * fast, which a local byte string does and a network does not.
 *
 * A spec that wants the CDN to fail still says so: Playwright matches routes in
 * reverse registration order, so a `page.route` installed inside a test wins
 * over this one installed by the fixture.
 */

/**
 * A 1×1 transparent PNG.
 *
 * The smallest thing that decodes, because nothing asserts a crest's intrinsic
 * size — `ClubCrest` sets its own box — and the point is only that the `load`
 * event fires without leaving the machine.
 */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * Every host this suite must not reach.
 *
 * The comment here used to say "one entry today; a list because the next
 * vendored-or-not decision should be a line here rather than a rewrite". That
 * decision has arrived and it was a line: **Vídeos do clube** hotlinks
 * YouTube's own thumbnail for each curated video, for the reasons
 * `videoThumbnailUrl` gives, so the club page now reaches a second image host.
 *
 * Note the two are *not* equally dangerous today and the list does not care.
 * Twenty crests block `load` on every page carrying the table; a rail's
 * thumbnails are `loading="lazy"` and sit below the fold on two club pages. But
 * "how bad would it be" is a property of this week's layout, and hermeticity is
 * the property being defended — the crest host was not dangerous either, until
 * the day it answered in 2.9s and took 85 specs down on an unmodified `main`.
 */
const OFFLINE_HOSTS = [/crests\.football-data\.org/, /img\.youtube\.com/];

/**
 * Every host this suite must not reach that is **not** an image.
 *
 * One entry: YouTube's player, which **Melhores momentos** mounts once a
 * reader picks a broadcaster. It is a second list rather than a third regex in
 * the one above because what separates them is the *stub*, not the rule — a
 * document served as `image/png` renders as an image document inside the
 * frame, so a spec asserting on the player's own box would be measuring a
 * picture of nothing. This fulfils an empty HTML document instead.
 *
 * Note it is only ever requested after a click, so most of the suite never
 * touches it. That is exactly the argument the crest CDN's own comment refuses
 * to accept as a reason not to stub: "how bad would it be" is a property of
 * this week's markup, and hermeticity is the property being defended.
 */
const OFFLINE_FRAME_HOSTS = [/www\.youtube-nocookie\.com/];

export const test = base.extend({
  page: async ({ page }, use) => {
    for (const host of OFFLINE_HOSTS) {
      await page.route(host, (route) =>
        route.fulfill({ status: 200, contentType: "image/png", body: PIXEL }),
      );
    }
    for (const host of OFFLINE_FRAME_HOSTS) {
      await page.route(host, (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: "<!doctype html><title>player</title>",
        }),
      );
    }
    await use(page);
  },
});

export { expect, type Page, type Locator } from "@playwright/test";
