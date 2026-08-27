import { expect, test, type Page } from "@playwright/test";

/**
 * Contas — Phase 1 of `docs/accounts.md`.
 *
 * The suite runs with `ACCOUNTS_DEV_LOGIN=true` and a per-run database, so
 * sign-in is exercised end to end with no Google client and no network. The
 * Google round trip itself is deliberately **not** tested here: it needs a
 * secret and a network, and CI has neither by design. It is verified by hand
 * against the deployed host.
 *
 * Every spec gives itself its own identity, because sessions are shared state
 * and this suite is `fullyParallel`.
 */

const accountControl = (page: Page) => page.locator("[data-account]");

/** Sign in as a named person, the way a test may and a reader may not. */
const devLogin = async (page: Page, name: string) => {
  const response = await page.request.post("/api/auth/dev-login", {
    data: { subject: `sub-${name}`, name },
  });
  expect(response.ok()).toBeTruthy();
};

test.describe("Contas", () => {
  test("a reader who never signs in reaches everything, and is never stopped", async ({ page }) => {
    // The guest invariant from the top of docs/accounts.md, asserted with
    // accounts **enabled** — which is not the same spec as "with accounts
    // disabled nothing changed". This is the one that catches a gate, and a
    // gate is the likelier failure.
    for (const path of ["/", "/ao-vivo", "/jogos", "/artilharia", "/jogadores", "/clube/palmeiras"]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      // Nothing anywhere demands a sign-in before showing the page.
      await expect(page.getByText("Entre para continuar")).toHaveCount(0);
    }

    await page.goto("/");
    await expect(page.locator("table")).toBeVisible();
    await expect(accountControl(page)).toHaveAttribute("data-account", "signed-out");
  });

  test("signing in, then out, leaves the app exactly as it was", async ({ page }) => {
    await page.goto("/");
    await expect(accountControl(page)).toHaveAttribute("data-account", "signed-out");

    await devLogin(page, "Ana Torcedora");
    await page.reload();
    await expect(accountControl(page)).toHaveAttribute("data-account", "signed-in");

    await page.goto("/conta");
    await expect(page.getByRole("heading", { name: /Olá, Ana/ })).toBeVisible();

    await page.locator("[data-sign-out='this']").click();
    await expect(accountControl(page)).toHaveAttribute("data-account", "signed-out");
  });

  test("the session cookie carries every attribute that makes it a session cookie", async ({
    page,
  }) => {
    await devLogin(page, "Bruno");

    const cookies = await page.context().cookies();
    const session = cookies.find((cookie) => cookie.name === "__Host-pb_sess");

    expect(session, "the browser must have accepted the cookie").toBeTruthy();
    // A __Host- cookie without Secure is refused by the browser outright, and
    // the failure is silent: sign-in appears to work and nothing is stored.
    expect(session?.secure).toBe(true);
    expect(session?.httpOnly).toBe(true);
    expect(session?.path).toBe("/");
    // Lax, not Strict: the real flow returns via a top-level navigation from
    // Google, and Strict withholds the cookie on exactly that request.
    expect(session?.sameSite).toBe("Lax");
  });

  test("the account pages are served, and told not to be indexed", async ({ page }) => {
    for (const path of ["/conta", "/entrar"]) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should be a real page`).toBe(200);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/,
        // A page whose content differs per requester must never be cached or
        // indexed — status and robots part company here, as pageStatus intends.
      );
    }
  });

  test("nothing under an account page becomes an indexable duplicate", async ({ page }) => {
    // The silent half of the four-file route change: pageStatus's default
    // answers 200 with a copy of the shell for any unrecognised argument, which
    // is an unbounded set of duplicates. /estadio/qualquer-coisa did this.
    const response = await page.goto("/conta/qualquer-coisa");
    expect(response?.status()).toBe(404);
  });

  test("robots.txt disallows the account pages and the sitemap omits them", async ({ page }) => {
    const robots = await (await page.request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /conta");
    expect(robots).toContain("Disallow: /entrar");

    const sitemap = await (await page.request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("/conta");
    expect(sitemap).not.toContain("/entrar");
  });

  test("no account response may be cached by anything in front of us", async ({ page }) => {
    // There is an nginx in front of this app, and that file is rewritten by
    // certbot and by 04_setup_nginx.sh — "there is no shared cache in front" is
    // a fact about a file nobody owns.
    const response = await page.request.get("/api/account/me");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["cache-control"]).toContain("private");
    expect(response.headers()["vary"]).toContain("Cookie");
  });

  test("me answers null rather than 401 for a signed-out reader", async ({ page }) => {
    // Called on every page load by a client that mostly has no session. A 401
    // would put a red line in the console of a healthy page for most readers,
    // permanently, by design.
    const response = await page.request.get("/api/account/me");
    expect(response.status()).toBe(200);
    expect(await response.json()).toBeNull();
  });

  test("signing out everywhere ends the other sessions too", async ({ browser }) => {
    // Two contexts are two browsers: the same account, two devices.
    const phone = await browser.newContext();
    const laptop = await browser.newContext();

    const shared = { subject: "sub-two-devices", name: "Carla" };
    expect((await phone.request.post("/api/auth/dev-login", { data: shared })).ok()).toBeTruthy();
    expect((await laptop.request.post("/api/auth/dev-login", { data: shared })).ok()).toBeTruthy();

    const laptopPage = await laptop.newPage();
    await laptopPage.goto("/conta");
    await expect(laptopPage.locator("[data-account-card]")).toBeVisible();

    const phonePage = await phone.newPage();
    await phonePage.goto("/conta");
    await phonePage.locator("[data-sign-out='all']").click();
    await expect(phonePage.locator("[data-account]")).toHaveAttribute("data-account", "signed-out");

    // This is the operation a JWT cannot really perform, and the reason
    // sessions are rows rather than signed claims.
    await laptopPage.reload();
    await expect(laptopPage.locator("[data-account]")).toHaveAttribute(
      "data-account",
      "signed-out",
    );

    await phone.close();
    await laptop.close();
  });

  test("deleting an account really deletes it", async ({ page }) => {
    await devLogin(page, "Diego");
    await page.goto("/conta");

    await page.locator("[data-delete-account]").click();
    await page.locator("[data-confirm-delete]").click();

    await expect(page.locator("[data-account]")).toHaveAttribute("data-account", "signed-out");

    // The session went with it, so the same cookie cannot resurrect anything.
    const me = await page.request.get("/api/account/me");
    expect(await me.json()).toBeNull();
  });

  test("a sign-in error is reported in pt-BR and says nothing useful to a prober", async ({
    page,
  }) => {
    await page.goto("/entrar?erro=state");
    const message = page.locator("[data-sign-in-error]");
    await expect(message).toBeVisible();
    await expect(message).toContainText("expirou");
    // The specific check that failed goes to the server log, never the page.
    await expect(message).not.toContainText("audience");
    await expect(message).not.toContainText("nonce");
  });

  test("the header fits its own box at every width the tabs share it with", async ({ page }) => {
    // The bottom bar's fifth entry was clipped at the screen edge with no
    // horizontal scroll to reveal it, invisible to every test until one
    // measured boxes. Adding a second trailing control is that same failure one
    // breakpoint up, so it is measured rather than eyeballed.
    await devLogin(page, "Elisa");

    for (const width of [640, 768, 1024]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");

      const header = page.locator("header").first();
      const box = await header.boundingBox();
      expect(box).toBeTruthy();

      const control = accountControl(page);
      const controlBox = await control.boundingBox();
      expect(controlBox, `account control should be laid out at ${width}px`).toBeTruthy();

      expect(
        controlBox!.x + controlBox!.width,
        `the account control overflows the header at ${width}px`,
      ).toBeLessThanOrEqual(box!.x + box!.width + 1);

      // And the document itself must not scroll sideways to accommodate it.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `page overflows horizontally at ${width}px`).toBeLessThanOrEqual(0);
    }
  });
});
