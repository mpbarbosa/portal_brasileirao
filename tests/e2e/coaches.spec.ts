import { expect, test } from "@/tests/e2e/clock";

import { COACH_OVERRIDES } from "@/src/data/coach-overrides";

/**
 * The técnico corrections, checked on every route that can carry one.
 *
 * **This file exists because the correction has four application sites and no
 * compiler can see that it needs all four.** `withCoachOverrides` runs once over
 * the frozen list — covering `/api/clubs`, every seed branch and the `known`
 * fallback — and again at each of `withClubDetails`' three call sites, because
 * that function prefers whatever the live payload carries. Miss one and exactly
 * one route serves the wrong person, which reads as a data problem rather than
 * as a missing line.
 *
 * The suite runs the seed branch (`DISABLE_FOOTBALL_DATA=true`), so these assert
 * the offline path. That is the half a fresh clone and an outage both get, and
 * the live half is `withCoachOverrides`' own unit tests plus the wrapping at
 * each site — the split `CLAUDE.md` records for `withClubDetails`, where "works
 * in CI" and "works in production" genuinely differ.
 */
const corrections = Object.entries(COACH_OVERRIDES);

test.describe("Técnicos", () => {
  test("there is at least one correction to check", () => {
    // Without this the whole file passes vacuously the day somebody empties the
    // overrides — green, and asserting nothing.
    expect(corrections.length).toBeGreaterThan(0);
  });

  test("/api/coaches serves the corrected name", async ({ page }) => {
    const body = await (await page.request.get("/api/coaches")).json();
    for (const [code, coach] of corrections) {
      expect(body.data[code], `club ${code}`).toBe(coach);
    }
  });

  test("/api/clubs serves the corrected name", async ({ page }) => {
    const body = await (await page.request.get("/api/clubs")).json();
    for (const [code, coach] of corrections) {
      const club = body.data.find((entry: { code: string }) => entry.code === code);
      expect(club?.coach, `club ${code}`).toBe(coach);
    }
  });

  test("/api/squads carries it on the club it hangs the elenco off", async ({ page }) => {
    const body = await (await page.request.get("/api/squads")).json();
    for (const [code, coach] of corrections) {
      const squad = body.data.find((entry: { club: { code: string } }) => entry.club.code === code);
      expect(squad?.club?.coach, `club ${code}`).toBe(coach);
    }
  });

  test("the club page prints it, which is the only place a reader meets it", async ({ page }) => {
    const [code, coach] = corrections[0]!;
    const clubs = await (await page.request.get("/api/clubs")).json();
    const slug = clubs.data.find((entry: { code: string }) => entry.code === code)?.slug;
    expect(slug, `club ${code} has no slug`).toBeTruthy();

    await page.goto(`/clube/${slug}`);
    await expect(page.getByText("Técnico")).toBeVisible();
    await expect(page.getByText(coach, { exact: true })).toBeVisible();
  });
});
