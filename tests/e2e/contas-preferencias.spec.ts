import { expect, test, type Page } from "@/tests/e2e/clock";

/**
 * Phase 2 of `docs/accounts.md`: **Meu time** stops being device-local once a
 * reader signs in, and the privacy notice that describes what that stores.
 *
 * The rule under test is `planSync`, and the two cases worth asserting in a
 * browser are the ones where a person could lose something: a choice made just
 * before signing in, and a choice made on another aparelho.
 */

const strip = (page: Page) => page.locator("[data-meu-time]");
const followControl = (page: Page) => page.locator("[data-follow]");

/**
 * Sign in as somebody nobody else in this run is.
 *
 * The subject carries the **project name**, because `desktop` and `mobile` run
 * fully parallel against one server and therefore one database: a fixed subject
 * is the same account row in both, and the two then overwrite each other's
 * club. `docs/accounts.md` §3.11 says to give each spec its own identity; it is
 * the *project* half of that which is easy to miss, because each spec already
 * looked unique.
 *
 * This failed exactly the way a shared-state bug does — green per project,
 * red on the full run, and stable in both.
 */
const devLogin = (page: Page, subject: string) =>
  page.request.post("/api/auth/dev-login", {
    data: { subject: `${subject}-${test.info().project.name}`, name: "Ana" },
  });

/**
 * Read and write account state **through the browser**, never through
 * `page.request`.
 *
 * `page.request` is a Node-side fetch with no notion of a potentially
 * trustworthy origin, so it will not send a `Secure` `__Host-` cookie over
 * `http://127.0.0.1` — every signed-in call through it answers 401 while the
 * browser beside it is perfectly signed in. It is still fine for *establishing*
 * a session, because the `Set-Cookie` it receives lands in the context's jar
 * and the browser is the one that later sends it.
 *
 * This cost an hour: a spec asserting "the account wins over a stale device
 * copy" failed because its own `PUT` had silently 401'd, so there was no
 * account copy to win.
 */
const me = (page: Page) =>
  page.evaluate(async () => {
    const response = await fetch("/api/account/me", { credentials: "same-origin" });
    return (await response.json()) as {
      preferences: { club: string | null; landing: string | null };
    } | null;
  });

const putPreferences = (page: Page, club: string | null) =>
  page.evaluate(async (value) => {
    await fetch("/api/account/preferences", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ club: value }),
    });
  }, club);

test.describe("Meu time com conta", () => {
  test("a club chosen just before signing in is not discarded", async ({ page }) => {
    // The case docs/accounts.md names explicitly. A reader picks a club as a
    // guest, then signs in; the account has none, so the device seeds it.
    await page.goto("/clube/palmeiras");
    await followControl(page).click();
    await expect(followControl(page)).toHaveAttribute("data-follow", "following");

    await devLogin(page, "sub-seed");
    await page.goto("/");
    await expect(strip(page)).toContainText("Palmeiras");

    // And the account really holds it now, not just this browser. Polled
    // rather than read once: the upload is fire-and-forget by design, so the
    // page is usable before it lands.
    await expect.poll(() => me(page).then((it) => it?.preferences.club)).toBeTruthy();
  });

  test("a club held by the account reaches a second aparelho", async ({ browser }) => {
    // Two contexts are two devices. The whole reason accounts exist per §1.
    const phone = await browser.newContext();
    const laptop = await browser.newContext();

    const subject = `sub-two-${test.info().project.name}`;
    const phonePage = await phone.newPage();
    await phonePage.goto("/");
    await phone.request.post("/api/auth/dev-login", { data: { subject, name: "Ana" } });
    await phonePage.goto("/clube/flamengo");
    await followControl(phonePage).click();
    await expect(followControl(phonePage)).toHaveAttribute("data-follow", "following");

    // Wait for the upload to actually land before the other device looks.
    // It is fire-and-forget by design — the page is usable before the request
    // finishes — so reading the account too early sees an empty one, and the
    // laptop then seeds it from its own empty device and the strip never
    // appears. The control turning "following" says the *device* stored it, not
    // the account.
    await expect.poll(() => me(phonePage).then((it) => it?.preferences.club)).toBeTruthy();

    // The laptop has never chosen anything and shares only the account.
    const laptopPage = await laptop.newPage();
    await laptop.request.post("/api/auth/dev-login", { data: { subject, name: "Ana" } });
    await laptopPage.goto("/");
    await expect(strip(laptopPage)).toContainText("Flamengo");

    await phone.close();
    await laptop.close();
  });

  test("the account wins over a stale device copy", async ({ page }) => {
    // Signed out, this browser holds one club. The account holds another. The
    // account is the source of truth — the documented departure from
    // last-write-wins, and the case a reader is most likely to notice.
    // Order matters here, and getting it wrong is its own lesson: setting the
    // device copy *before* signing in makes the first load seed the empty
    // account from it, and that fire-and-forget upload then races the PUT
    // below — landing after it and putting the old club back. So sign in with
    // an empty device first, give the account its club, and only then plant the
    // stale copy.
    await devLogin(page, "sub-stale");
    await page.goto("/");
    await putPreferences(page, "1783");

    await page.evaluate(() =>
      localStorage.setItem("portal-brasileirao:preferences", JSON.stringify({ club: "1769" })),
    );

    await page.goto("/");
    await expect(strip(page)).toContainText("Flamengo");
    await expect(strip(page)).not.toContainText("Palmeiras");
  });

  test("signing out leaves the club on the device, not the account", async ({ page }) => {
    await devLogin(page, "sub-out");
    await page.goto("/clube/palmeiras");
    await followControl(page).click();

    await page.goto("/conta");
    await page.locator("[data-sign-out='this']").click();

    // Still there — this is the same device, and a device remembering a choice
    // is Phase 0 behaviour that signing out must not undo.
    await page.goto("/");
    await expect(strip(page)).toContainText("Palmeiras");
  });

  test("a guest never asks the account endpoint for anything", async ({ page }) => {
    // The guest invariant, at the network layer: choosing a club signed out
    // must not produce a request that would answer 401.
    const calls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/account/preferences")) calls.push(request.method());
    });

    await page.goto("/clube/palmeiras");
    await followControl(page).click();
    await expect(followControl(page)).toHaveAttribute("data-follow", "following");
    await page.waitForTimeout(300);

    expect(calls).toEqual([]);
  });

  test("deleting the account takes the stored club with it", async ({ page, browser }) => {
    await devLogin(page, "sub-delete");
    await page.goto("/clube/palmeiras");
    await followControl(page).click();

    // The account really holds it, so that deleting it is deleting something.
    // Without this the assertion at the foot of the test could pass over an
    // account that was empty all along.
    await expect.poll(() => me(page).then((it) => it?.preferences.club)).toBeTruthy();

    await page.goto("/conta");
    await page.locator("[data-delete-account]").click();
    await page.locator("[data-confirm-delete]").click();
    await expect(page.locator("[data-account]")).toHaveAttribute("data-account", "signed-out");

    // The device keeps its own club, which is `docs/accounts.md` §3.15 — a club
    // id is cleared only when the reader clears it, and that applies to the
    // `localStorage` copy identically. Deleting an account is not that. Stated
    // here rather than left implicit because it is the fact the rest of this
    // test is arranged around.
    await page.goto("/");
    await expect(strip(page)).toContainText("Palmeiras");

    // So: signing in again as the same person is a new account with nothing in
    // it — and the question has to be asked from a device that has never
    // chosen a club. **Never from `page`.** This browser still holds Palmeiras,
    // so `planSync` seeds the fresh account from it within a few hundred
    // milliseconds of the next load, and a read taken there measures whether it
    // beat that upload rather than what the account contains. That is what this
    // test used to do: `expect.poll(…).toBeNull()` returns on its first read,
    // so it passed by reading early and failed whenever the machine was busy
    // enough for the seed to land first — green on CI, red in a full local run,
    // and green in isolation on both. Polling is the right idiom for waiting
    // for a value to *appear*, as the three above do, and cannot assert that
    // one never does.
    const clean = await browser.newContext();
    const cleanPage = await clean.newPage();

    const uploads: string[] = [];
    cleanPage.on("request", (request) => {
      if (request.url().includes("/api/account/preferences") && request.method() === "PUT") {
        uploads.push(request.method());
      }
    });

    await clean.request.post("/api/auth/dev-login", {
      data: { subject: `sub-delete-${test.info().project.name}`, name: "Ana" },
    });
    await cleanPage.goto("/");
    // Read only once the client has the account, so this is the settled answer
    // and not one taken before `usePreferences` had anything to reconcile.
    await expect(cleanPage.locator("[data-account]")).toHaveAttribute(
      "data-account",
      "signed-in",
    );

    expect((await me(cleanPage))?.preferences.club ?? null).toBeNull();
    // And nothing was uploaded, so that null is where this stops rather than a
    // moment before a write — the difference the previous shape of this test
    // could not see.
    expect(uploads).toEqual([]);

    await clean.close();
  });
});

test.describe("Privacidade", () => {
  test("is public, indexable, and reachable by a crawler", async ({ page }) => {
    const response = await page.goto("/privacidade");
    expect(response?.status()).toBe(200);

    // Unlike /conta and /entrar: a notice only a signed-in reader can find is
    // not a notice, and Google's consent screen links to it from outside.
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

    const sitemap = await (await page.request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/privacidade");

    const robots = await (await page.request.get("/robots.txt")).text();
    expect(robots).not.toContain("Disallow: /privacidade");
  });

  test("says what it stores, and that guests store nothing", async ({ page }) => {
    await page.goto("/privacidade");
    const main = page.locator("main");

    await expect(main).toContainText("Sem conta, nada é guardado");
    await expect(main).toContainText("O que guardamos com conta");
    // The transfer abroad is the claim §5 requires and the one most likely to
    // be quietly dropped in an edit.
    await expect(main).toContainText("fora do Brasil");
    await expect(main).toContainText("Apagar");
  });

  test("nothing under it becomes an indexable duplicate", async ({ page }) => {
    const response = await page.goto("/privacidade/qualquer-coisa");
    expect(response?.status()).toBe(404);
  });

  test("the account pages link to it", async ({ page }) => {
    await page.goto("/entrar");
    await expect(page.locator('a[href="/privacidade"]')).toBeVisible();
  });
});

/**
 * **Página inicial** — the second preference key, and the first that exists
 * only in an account.
 *
 * What is worth driving a browser for here is not the mapping, which
 * `preferences-core.test.ts` covers exhaustively without one. It is the two
 * things only a real page can show: that the redirect actually happens on a
 * fresh document load, and that it stays out of the way of everything else a
 * reader might have asked for.
 */
test.describe("Página inicial", () => {
  const picker = (page: Page) => page.locator("#seletor-pagina-inicial");

  /** Choose, and wait for the fire-and-forget upload to land. The control
   *  changing says the *page* holds it, not the account — the same distinction
   *  that cost an hour in the Meu time specs above. */
  const choose = async (page: Page, landing: string) => {
    await page.goto("/conta");
    await picker(page).selectOption(landing);
    await expect
      .poll(() => me(page).then((it) => it?.preferences.landing ?? null))
      .toBe(landing === "classificacao" ? null : landing);
  };

  test("the Portal opens where the reader asked it to", async ({ page }) => {
    await devLogin(page, "sub-landing");
    await choose(page, "ao-vivo");

    // A fresh document load of the home address, which is the only moment this
    // is allowed to fire.
    await page.goto("/");
    await expect(page).toHaveURL(/\/ao-vivo$/);
  });

  test("it replaces the entry rather than stacking one, so Back is not a trap", async ({
    page,
  }) => {
    // With a pushed entry, Back would return to "/" and be redirected forward
    // again — a button that visibly does nothing.
    await devLogin(page, "sub-landing-back");
    await choose(page, "artilharia");

    await page.goto("/jogadores");
    await page.goto("/");
    await expect(page).toHaveURL(/\/artilharia$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/jogadores$/);
  });

  test("a deep link wins over the preference", async ({ page }) => {
    // Someone who followed a link asked for that page. A landing choice is not
    // a licence to overrule them.
    await devLogin(page, "sub-landing-deep");
    await choose(page, "ao-vivo");

    await page.goto("/artilharia");
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/artilharia$/);
  });

  test("the Classificação tab still reaches the Classificação", async ({ page }) => {
    // The failure this rules out is total: a redirect that fired on every visit
    // to "/" would make the home tab unreachable for exactly the readers who
    // set the preference.
    await devLogin(page, "sub-landing-tab");
    await choose(page, "jogadores");

    await page.goto("/");
    await expect(page).toHaveURL(/\/jogadores$/);

    // `:visible` because both navigation bars carry the same label and the same
    // links — the tab row above `sm`, the bottom bar below it — and only one of
    // them is on screen in either project.
    await page.locator('nav[aria-label="Seções"] a[href="/"]:visible').first().click();
    await expect(page).toHaveURL(/\/$/);
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/$/);
  });

  test("Meu time lands on the followed club's page", async ({ page }) => {
    await devLogin(page, "sub-landing-club");
    await page.goto("/clube/palmeiras");
    await followControl(page).click();
    await expect.poll(() => me(page).then((it) => it?.preferences.club)).toBeTruthy();

    await choose(page, "meu-time");
    await page.goto("/");
    await expect(page).toHaveURL(/\/clube\/palmeiras$/);
  });

  test("choosing the Classificação stores nothing at all", async ({ page }) => {
    // "Chose the default" and "has never chosen" are one state, exactly as
    // "follows nobody" and "never picked a club" are one state a key over.
    await devLogin(page, "sub-landing-default");
    await choose(page, "jogos");
    await choose(page, "classificacao");

    await page.goto("/");
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/$/);
  });

  test("a guest is not offered a setting they could not keep", async ({ page }) => {
    // The control lives in the account and nowhere else, so a signed-out reader
    // must not meet a switch that would forget itself on the next load.
    await page.goto("/conta");
    await expect(page.locator("[data-landing-card]")).toHaveCount(0);
  });

  test("signing out gives the home address back", async ({ page }) => {
    await devLogin(page, "sub-landing-out");
    await choose(page, "ao-vivo");

    await page.goto("/conta");
    await page.locator("[data-sign-out='this']").click();

    await page.goto("/");
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/$/);
  });
});
