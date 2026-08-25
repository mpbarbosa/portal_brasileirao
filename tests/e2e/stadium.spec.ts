import { expect, test, type Page } from "@playwright/test";

/**
 * A round whose fixtures carry venues in the frozen snapshot. Venues are
 * curated per match, so a round with none would make every test here vacuous.
 */
const VENUED_ROUND = "24";

/**
 * Reach a stadium page the way a reader does — through a fixture — rather than
 * by typing a slug.
 *
 * Deliberately does **not** name a stadium. `venues.ts` grows on every sync and
 * the snapshot ages, so asserting that the Maracanã in particular is reachable
 * would be asserting how much curated data exists, which has broken CI here
 * before. Any fixture with a venue is enough to exercise the page.
 */
const openStadiumFromMatch = async (page: Page) => {
  await page.goto(`/jogos/${VENUED_ROUND}`);

  const match = page.locator("main ul > li a[href^='/partida/']").first();
  await expect(match).toBeVisible();
  await match.click();
  await expect(page).toHaveURL(/\/partida\/\d+/);

  const venue = page.locator("main a[href^='/estadio/']").first();
  await expect(venue).toBeVisible();
  await venue.click();
  await expect(page).toHaveURL(/\/estadio\/[a-z0-9-]+/);
};

test.describe("the stadium page", () => {
  test("is reached from a match's Estádio line", async ({ page }) => {
    await openStadiumFromMatch(page);

    await expect(page.locator("main h2")).toBeVisible();
    await expect(page.locator("main [data-stadium]")).toHaveCount(1);
  });

  test("the venue line links only the ground, keeping city and state as text", async ({
    page,
  }) => {
    await page.goto(`/jogos/${VENUED_ROUND}`);
    const match = page.locator("main ul > li a[href^='/partida/']").first();
    await expect(match).toBeVisible();
    await match.click();

    // The whole line still reads "stadium · city – UF"; only the first part is
    // a control. Shape, never a specific ground.
    const line = page.locator("dd").filter({ hasText: "·" }).first();
    await expect(line).toContainText(/·/);
    await expect(line).toContainText(/–\s[A-Z]{2}$/);
    await expect(line.locator("a[href^='/estadio/']")).toHaveCount(1);
  });

  test("names the ground, where it is, and the fixtures played there", async ({ page }) => {
    await openStadiumFromMatch(page);

    const heading = page.locator("main h2");
    await expect(heading).not.toBeEmpty();

    // City – UF, directly under the name.
    await expect(page.locator("main header p").first()).toContainText(/–\s[A-Z]{2}$/);

    await expect(
      page.getByRole("heading", { name: "Jogos neste estádio", exact: true }),
    ).toBeVisible();
    await expect(page.locator("main ul > li a[href^='/partida/']").first()).toBeVisible();
  });

  test("lists the home club and links to it", async ({ page }) => {
    await openStadiumFromMatch(page);

    const mandante = page.getByRole("heading", { name: /^Mandantes?$/ });
    await expect(mandante).toBeVisible();

    const club = page.locator("main a[href^='/clube/']").first();
    await expect(club).toBeVisible();
    await club.click();
    await expect(page).toHaveURL(/\/clube\/[a-z0-9-]+/);
  });

  test("a deep link renders the page directly, without a match first", async ({ page }) => {
    // Read a real slug off a page rather than hardcoding one, so this does not
    // depend on which grounds the snapshot happens to carry.
    await openStadiumFromMatch(page);
    const url = page.url();

    await page.goto(url);
    await expect(page.locator("main [data-stadium]")).toHaveCount(1);
    await expect(page.locator("main h2")).not.toBeEmpty();
  });

  test("an unknown stadium says so rather than rendering an empty page", async ({ page }) => {
    await page.goto("/estadio/estadio-que-nao-existe");

    await expect(page.getByText("Estádio não encontrado.")).toBeVisible();
  });

  test("the tab title names the stadium", async ({ page }) => {
    await openStadiumFromMatch(page);

    const name = (await page.locator("main h2").innerText()).trim();
    await expect(page).toHaveTitle(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});

/**
 * The photograph and its credit line.
 *
 * Split into its own block because these tests must **not** assert that a
 * photo exists. `stadiums.ts` is curated, `venues.ts` grows on every sync, and
 * a ground entering the snapshot before anyone has found a freely licensed
 * picture of it is the ordinary case — a test counting curated photos is the
 * mistake `broadcasts.ts` already taught this suite once. So each one finds the
 * figure or skips loudly, and asserts shape where it is there.
 *
 * Nothing here waits on the image's bytes. The file lives on Wikimedia Commons,
 * and CI deliberately has no network dependency on a third party: a red build
 * must mean the code broke, never that somebody else's CDN had a bad minute.
 * What is asserted is the markup this repo controls — the address requested,
 * the alt text, and the attribution.
 */
test.describe("the stadium photograph", () => {
  /** Walk the stadium pages the snapshot offers until one carries a photo. */
  const openStadiumWithPhoto = async (page: Page) => {
    await openStadiumFromMatch(page);

    const figure = page.locator("figure[data-stadium-photo]");
    if ((await figure.count()) === 0) {
      test.skip(true, "no stadium reachable from this round has a curated photo");
    }

    return figure;
  };

  test("shows the ground, described rather than merely named", async ({ page }) => {
    const figure = await openStadiumWithPhoto(page);
    const image = figure.locator("img");

    await expect(image).toHaveAttribute("alt", /\S/);

    // The heading directly above already gives the name, so an alt that only
    // repeats it tells a screen-reader user nothing new.
    const name = (await page.locator("main h2").innerText()).trim();
    expect((await image.getAttribute("alt"))?.trim()).not.toBe(name);
  });

  test("asks Commons for a width rather than hardcoding a CDN path", async ({ page }) => {
    const figure = await openStadiumWithPhoto(page);
    const image = figure.locator("img");

    // Special:FilePath survives a file being renamed; the upload.wikimedia.org
    // address embeds a hash of the filename and does not.
    await expect(image).toHaveAttribute("src", /commons\.wikimedia\.org\/wiki\/Special:FilePath\//);
    await expect(image).toHaveAttribute("src", /[?&]width=\d+/);

    // One srcSet entry per offered width, so a phone is not sent the desktop
    // rendering of an eight-megapixel original.
    const srcset = (await image.getAttribute("srcset")) ?? "";
    expect(srcset.split(",").length).toBeGreaterThan(1);
    expect(srcset).toMatch(/\s\d+w$/);
  });

  test("credits the photographer and names the licence", async ({ page }) => {
    const figure = await openStadiumWithPhoto(page);
    const caption = figure.locator("figcaption");

    await expect(caption).toBeVisible();

    // Both links are the condition of showing the picture at all, not
    // decoration: every licence in use but CC0 requires the credit, and a
    // reader has to be able to reach the licence it is granted under.
    await expect(
      caption.locator("a[href^='https://commons.wikimedia.org/wiki/File:']"),
    ).toHaveCount(1);
    await expect(
      caption.locator("a[href^='https://creativecommons.org/']"),
    ).toHaveCount(1);

    // Copied links drop these, and a missing rel="noopener" looks identical on
    // the page — the same drift ClubLinks exists to prevent.
    for (const link of await caption.locator("a").all()) {
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
    }
  });

  test("reserves the image's box before its bytes arrive", async ({ page }) => {
    const figure = await openStadiumWithPhoto(page);

    // The files run from 4:3 to a panorama, so the box is fixed by CSS rather
    // than by the image. Without this the stat tiles, the mandantes and the
    // whole fixture list below jump on load.
    const ratio = await figure.locator("img").evaluate((node) => {
      const box = node.getBoundingClientRect();
      return box.width / box.height;
    });

    expect(ratio).toBeGreaterThan(1.7);
    expect(ratio).toBeLessThan(1.85);
  });
});
