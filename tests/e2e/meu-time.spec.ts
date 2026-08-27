import { expect, test, type Page } from "@playwright/test";

/**
 * **Meu time** — the device-local preference, Phase 0 of `docs/accounts.md`.
 *
 * Every assertion here is about a browser that has no account, because there
 * are none: this is the whole feature for now, and it is deliberately reachable
 * by anybody. The specs that matter most are the two negative ones — a reader
 * who has chosen nobody is shown nothing, and a preference is never silently
 * dropped.
 */

const followControl = (page: Page) => page.locator("[data-follow]");
const strip = (page: Page) => page.locator("[data-meu-time]");

/** Open a club page directly; the URL takes a slug or a code. */
const openClub = async (page: Page, key = "palmeiras") => {
  await page.goto(`/clube/${key}`);
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
};

test.describe("Meu time", () => {
  test("a reader who follows nobody is shown nothing about it", async ({ page }) => {
    // The guest invariant, in its softest and most easily lost form: no strip,
    // no prompt, no nag. Somebody who never chooses a club must not be able to
    // tell that the feature exists from the home page.
    await page.goto("/");
    await expect(page.locator("table")).toBeVisible();
    await expect(strip(page)).toHaveCount(0);
  });

  test("following a club marks it on the table and names it above", async ({ page }) => {
    await openClub(page);
    await expect(followControl(page)).toHaveAttribute("data-follow", "not-following");

    await followControl(page).click();
    await expect(followControl(page)).toHaveAttribute("data-follow", "following");

    await page.goto("/");
    await expect(strip(page)).toBeVisible();
    await expect(strip(page)).toContainText("Meu time");
    await expect(strip(page)).toContainText("Palmeiras");

    // Exactly one row carries the marker — the club's own.
    const marked = page.locator("tbody tr", { hasText: "Meu time:" });
    await expect(marked).toHaveCount(1);
    await expect(marked).toContainText("Palmeiras");
  });

  test("the choice survives a reload", async ({ page }) => {
    await openClub(page);
    await followControl(page).click();
    await expect(followControl(page)).toHaveAttribute("data-follow", "following");

    await page.reload();
    await expect(followControl(page)).toHaveAttribute("data-follow", "following");
  });

  test("following a second club replaces the first", async ({ page }) => {
    await openClub(page, "palmeiras");
    await followControl(page).click();

    await openClub(page, "flamengo");
    await expect(followControl(page)).toHaveAttribute("data-follow", "not-following");
    await followControl(page).click();

    await page.goto("/");
    await expect(strip(page)).toContainText("Flamengo");
    await expect(strip(page)).not.toContainText("Palmeiras");
    await expect(page.locator("tbody tr", { hasText: "Meu time:" })).toHaveCount(1);
  });

  test("unfollowing puts the page back exactly as it was", async ({ page }) => {
    await openClub(page);
    await followControl(page).click();
    await followControl(page).click();
    await expect(followControl(page)).toHaveAttribute("data-follow", "not-following");

    await page.goto("/");
    await expect(strip(page)).toHaveCount(0);
    await expect(page.locator("tbody tr", { hasText: "Meu time:" })).toHaveCount(0);
  });

  test("a club the payload does not name is kept, not cleared", async ({ page }) => {
    // The rule from docs/accounts.md §3.15. Simulated by storing a code no club
    // has, which is what a reader's real preference looks like during a
    // provider outage — and the failure this guards against is the app quietly
    // rewriting it to null, which no amount of staring at a working page shows.
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.setItem("portal-brasileirao:preferences", JSON.stringify({ club: "999999" })),
    );
    await page.reload();

    await expect(page.getByText("A sua escolha continua guardada.")).toBeVisible();

    const stored = await page.evaluate(() =>
      localStorage.getItem("portal-brasileirao:preferences"),
    );
    expect(stored).toBe(JSON.stringify({ club: "999999" }));
  });

  test("junk in storage does not break the page", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.setItem("portal-brasileirao:preferences", "{ not json"),
    );
    await page.reload();

    await expect(page.locator("table")).toBeVisible();
    await expect(strip(page)).toHaveCount(0);
  });
});
