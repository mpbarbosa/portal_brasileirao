import { expect, test } from "@/tests/e2e/clock";

import { CLUB_WEBSITE_OVERRIDES } from "@/src/data/club-website-overrides";

/**
 * The official-site corrections, checked on every route that can carry one.
 *
 * **`tests/e2e/coaches.spec.ts`' twin, and it exists for that file's reason:**
 * a correction applied at five places, none of which a compiler can see is
 * missing. `withClubCorrections` runs once over the frozen list — covering
 * `/api/clubs`, every seed branch and the `known` fallback `withClubDetails`
 * reads — and again at each of that function's three call sites, plus the
 * squads seed branch, which builds its clubs from `SEED_SQUADS`' own frozen
 * objects and never passes through `CLUBS` at all. Miss one and exactly one
 * route serves the stale address, which reads as a data problem rather than as
 * a missing line.
 *
 * **It asserts more than the coach spec does, because a website has a second
 * consumer.** `structured-data-core.ts` puts `club.website` into the club's
 * JSON-LD `sameAs`, so a wrong value is not merely a link a reader can see is
 * broken — it is this site telling a crawler that the club and that domain are
 * the same entity. The anchor and the `sameAs` are asserted separately: they
 * are built from one field by two code paths, and only one of them runs the
 * value through `officialSiteUrl`.
 *
 * The suite runs the seed branch (`DISABLE_FOOTBALL_DATA=true`), so these
 * assert the offline path — the half a fresh clone and an outage both get. The
 * live half is `withWebsiteOverrides`' own unit tests plus the wrapping at each
 * site, the split `CLAUDE.md` records for `withClubDetails`.
 */
const corrections = Object.entries(CLUB_WEBSITE_OVERRIDES);

test.describe("Sites oficiais", () => {
  test("there is at least one correction to check", () => {
    // Without this the whole file passes vacuously the day somebody empties the
    // overrides — green, and asserting nothing.
    expect(corrections.length).toBeGreaterThan(0);
  });

  test("/api/clubs serves the corrected address", async ({ page }) => {
    const body = await (await page.request.get("/api/clubs")).json();
    for (const [code, website] of corrections) {
      const club = body.data.find((entry: { code: string }) => entry.code === code);
      expect(club?.website, `club ${code}`).toBe(website);
    }
  });

  test("/api/squads carries it on the club it hangs the elenco off", async ({ page }) => {
    // The site the coach correction shipped without: this branch reads
    // `SEED_SQUADS`, whose club objects come straight from `clubs.ts`.
    const body = await (await page.request.get("/api/squads")).json();
    for (const [code, website] of corrections) {
      const squad = body.data.find((entry: { club: { code: string } }) => entry.club.code === code);
      expect(squad?.club?.website, `club ${code}`).toBe(website);
    }
  });

  test("/api/matches carries it on the clubs it ships beside the fixtures", async ({ page }) => {
    const body = await (await page.request.get("/api/matches")).json();
    for (const [code, website] of corrections) {
      const club = body.data.clubs.find((entry: { code: string }) => entry.code === code);
      expect(club?.website, `club ${code}`).toBe(website);
    }
  });

  test("/api/standings carries it on the club in the row", async ({ page }) => {
    const body = await (await page.request.get("/api/standings")).json();
    for (const [code, website] of corrections) {
      const row = body.data.find((entry: { club: { code: string } }) => entry.club.code === code);
      expect(row?.club?.website, `club ${code}`).toBe(website);
    }
  });

  test("the club page links it, which is the only place a reader meets it", async ({ page }) => {
    const [code, website] = corrections[0]!;
    const clubs = await (await page.request.get("/api/clubs")).json();
    const slug = clubs.data.find((entry: { code: string }) => entry.code === code)?.slug;
    expect(slug, `club ${code} has no slug`).toBeTruthy();

    await page.goto(`/clube/${slug}`);
    const link = page.getByRole("link", { name: /site oficial/i });
    await expect(link).toHaveAttribute("href", website);
  });

  test("the club page's JSON-LD names it too, which is what a crawler reads", async ({ page }) => {
    const [code, website] = corrections[0]!;
    const clubs = await (await page.request.get("/api/clubs")).json();
    const slug = clubs.data.find((entry: { code: string }) => entry.code === code)?.slug;

    await page.goto(`/clube/${slug}`);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const sameAs = blocks.flatMap((block) => {
      const parsed = JSON.parse(block);
      return (Array.isArray(parsed) ? parsed : [parsed]).flatMap(
        (node: { sameAs?: string[] }) => node.sameAs ?? [],
      );
    });

    expect(sameAs, "the corrected site is in sameAs").toContain(website);
  });
});
