import { expect, test, type Page } from "@/tests/e2e/clock";

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

  test("it names itself in the outline, once, and outside main", async ({ page }) => {
    await page.goto("/");

    // The heading is the rodapé's entry in the document outline: a screen
    // reader lands on "Rodapé" rather than on an unnamed run of facts. It is
    // level 2 because the footer is a sibling of `main` under the page's h1,
    // not a section of it.
    const heading = footer(page).getByRole("heading", { level: 2, name: "Rodapé" });
    await expect(heading).toHaveCount(1);

    // …and it must stay out of `main`, because that scope is what lets every
    // other spec name the page's own heading without matching this one too.
    await expect(page.getByRole("main").getByRole("heading", { name: "Rodapé" })).toHaveCount(0);
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

    // A regex, not the bare string: `getByRole` matches the *accessible* name,
    // and every outbound anchor here carries a screen-reader "(abre em nova
    // aba)". An exact match would assert the notice away.
    const source = item(page, "fonte").getByRole("link", { name: /football-data\.org/ });
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

  test("the rodapé carries the author's other sites, and says where they go", async ({ page }) => {
    await page.goto("/");

    // Both print their bare domain, deliberately: the shared `mpbarbosa.com`
    // stem is what says these are one author's two addresses. A friendlier
    // name on one of them hides that, which is the whole point of the band.
    //
    // **Every locator here is anchored with `^`, and it has to be.** Since
    // both labels became domains, one is a *substring* of the other —
    // `/mpbarbosa\.com/` matches the copa2026 link too, so an unanchored
    // locator is either a strict-mode violation or, worse, silently the wrong
    // element. The accessible name starts with the visible label, so `^`
    // separates them. Do not relax these to bare substrings.
    const personal = footer(page).getByRole("link", { name: /^mpbarbosa\.com/ });
    await expect(personal).toHaveAttribute("href", "https://www.mpbarbosa.com");

    const sibling = footer(page).getByRole("link", { name: /^copa2026\.mpbarbosa\.com/ });
    await expect(sibling).toHaveAttribute("href", "https://copa2026.mpbarbosa.com");

    for (const link of [personal, sibling]) {
      await expect(link).toBeVisible();
      // The three parts that drift when an anchor is copied — see OutboundLink.
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
      // A bare domain is a bare word to a screen reader; the suffix is what
      // says where it goes and that it leaves the page.
      await expect(link).toHaveAccessibleName(/abre em nova aba/);
    }
  });

  test("they are outbound links, not a second set of destinations", async ({ page }) => {
    await page.goto("/");

    // The rodapé is explicitly not where navigation goes, and the bar is full
    // at five — see the bound in CLAUDE.md. Nothing here is a landmark.
    await expect(footer(page).locator("nav")).toHaveCount(0);

    // A list, so a screen reader says how many there are before the first.
    const items = footer(page).locator("ul > li");
    await expect(items).toHaveCount(2);
  });

  test("each author link meets the 48dp touch target", async ({ page }) => {
    await page.goto("/");

    // These are standalone controls on their own line, which is the same
    // distinction that keeps the floor off the twenty club names in the
    // Classificação. The floor is on the box, so neither overhangs into the
    // other — measure the gap as well as the heights.
    const boxes = [];
    for (const name of [/^mpbarbosa\.com/, /^copa2026\.mpbarbosa\.com/]) {
      const box = await footer(page).getByRole("link", { name }).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(48);
      boxes.push(box!);
    }

    const [first, second] = boxes;
    expect(second.x).toBeGreaterThanOrEqual(first.x + first.width);
  });
});
