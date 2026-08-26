import { expect, test, type Page } from "@playwright/test";

/**
 * The rodapé, and the **Saúde do serviço** it carries.
 *
 * The suite runs against the frozen snapshot with the kill switch on, so the
 * provider is always `seed` and the sha is always `dev` — see the rules in
 * CLAUDE.md. What varies with the deploy (a real commit, a build time, a live
 * provider) is exercised by intercepting `/api/health` rather than by asserting
 * against whatever the server happens to be, which is the same reason nothing
 * here asserts a round number or a scoreline.
 */

const footer = (page: Page) => page.locator("footer");
const item = (page: Page, id: string) => footer(page).locator(`[data-health-item="${id}"]`);

/** Answer `/api/health` with a body of our choosing, before the app asks. */
const serveHealth = (page: Page, body: unknown, status = 200) =>
  page.route("**/api/health", (route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }),
  );

test.describe("Rodapé", () => {
  test("the footer says what the site is", async ({ page }) => {
    await page.goto("/");

    await expect(footer(page)).toContainText(/Projeto independente/);
    await expect(footer(page)).toContainText(/CBF/);
  });

  test("it sits outside main, so it is not part of the page's content", async ({ page }) => {
    await page.goto("/");

    // A drill-down replaces what is inside `main`; the rodapé must survive it.
    await expect(page.locator("main footer")).toHaveCount(0);
    await expect(footer(page)).toBeVisible();
  });

  test("the health readout names the state, the source and the version", async ({ page }) => {
    await page.goto("/");
    await expect(footer(page).locator('[data-health="ok"]')).toBeVisible();

    await expect(item(page, "estado")).toContainText("no ar");
    // The kill switch is on for this suite, so the seed is what is configured.
    await expect(item(page, "fonte")).toContainText("dados locais");
    await expect(item(page, "versao")).toContainText("dev");
  });

  test("uptime is rendered as the instant the process started, not as elapsed time", async ({
    page,
  }) => {
    await page.goto("/");

    const since = item(page, "no-ar-desde");
    await expect(since).toBeVisible();

    // A machine-readable instant, and a label that does not move while the page
    // is open — an elapsed label would differ between two captures of one
    // running process, and the home route is photographed full-page.
    const time = since.locator("time");
    const instant = await time.getAttribute("datetime");
    expect(Number.isNaN(Date.parse(String(instant)))).toBe(false);

    const before = await time.innerText();
    await page.waitForTimeout(1200);
    expect(await time.innerText()).toBe(before);
  });

  test("running from source there is no build time, and no line for one", async ({ page }) => {
    await page.goto("/");

    // `tsx` has no bundler to stamp __BUILD_TIME__. Nothing renders a dash
    // standing in for a value that was never reported.
    await expect(item(page, "compilado")).toHaveCount(0);
  });

  test("a deployed build shows its commit, its build time and a link to the provider", async ({
    page,
  }) => {
    await serveHealth(page, {
      status: "ok",
      sha: "9f2c1ab3d4e5f60718293a4b5c6d7e8f90a1b2c3",
      builtAt: "2026-08-25T14:32:00.000Z",
      uptime: 18_732,
      provider: "football-data",
    });
    await page.goto("/");

    await expect(item(page, "versao")).toContainText("9f2c1ab");
    await expect(item(page, "compilado").locator("time")).toHaveAttribute(
      "datetime",
      "2026-08-25T14:32:00.000Z",
    );

    const source = item(page, "fonte").getByRole("link", { name: "football-data.org" });
    await expect(source).toHaveAttribute("href", "https://www.football-data.org/");
    // A copied link that loses `rel="noopener"` is a real defect that looks
    // identical on the page — see ClubLinks.
    await expect(source).toHaveAttribute("rel", /noopener/);
  });

  test("an unrecognised status is shown rather than swallowed", async ({ page }) => {
    await serveHealth(page, { status: "degraded", sha: "dev", uptime: 12 });
    await page.goto("/");

    await expect(item(page, "estado")).toContainText("degraded");
  });

  test("a body this build cannot read says so instead of rendering undefined", async ({ page }) => {
    await serveHealth(page, { uptime: 12 });
    await page.goto("/");

    await expect(footer(page).locator('[data-health="unavailable"]')).toBeVisible();
    await expect(footer(page)).not.toContainText("undefined");
    // The rest of the page is untouched: a footer is never a reason to fail one.
    await expect(page.locator("main table tbody tr")).toHaveCount(20);
  });

  test("a failing health endpoint does not fail the page", async ({ page }) => {
    await serveHealth(page, { error: "nope" }, 503);
    await page.goto("/");

    await expect(footer(page).locator('[data-health="unavailable"]')).toBeVisible();
    await expect(page.locator("main table tbody tr")).toHaveCount(20);
  });
});
