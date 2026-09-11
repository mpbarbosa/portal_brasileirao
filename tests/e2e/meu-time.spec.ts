import { E2E_NOW, expect, test, type Page } from "@/tests/e2e/clock";
import { readMatches, serveMatches, upcomingFixture } from "@/tests/e2e/matches-payload";

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

/**
 * Open a club page directly; the URL takes a slug or a code.
 *
 * Waits for the follow control rather than for the heading. The heading renders
 * from the same data, so it looks equivalent — but it is not what these tests
 * need, and under seven parallel workers hitting one dev server the default
 * timeout was occasionally reached before the club resolved. Waiting for the
 * thing each test is about to click is both the stronger precondition and the
 * one that cannot pass while the page is still deciding which club this is.
 */
const openClub = async (page: Page, key = "palmeiras") => {
  await page.goto(`/clube/${key}`);
  await expect(followControl(page)).toBeVisible();
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

/**
 * **Próximo jogo do meu time** — the alert half of the strip.
 *
 * The fixture these tests follow is **produced** in `/api/matches` rather than
 * found there. The suite boots against the frozen snapshot, which ages: a spec
 * naming Palmeiras' next opponent passes today and fails the week the seed is
 * regenerated, and one reading the snapshot's soonest unplayed fixture has
 * nothing to read once the last round is played. This file did the second and
 * skipped when the answer was none — which is how two specs across two projects
 * went quiet for four hours on 2026-08-30 while the suite said `690 passed`.
 * `upcomingFixture` dates one a minute after `E2E_NOW`, so there is always
 * exactly one to follow.
 */
const fixtureLine = (page: Page) => page.locator("[data-proximo-jogo]");

/**
 * Serve a payload with a fixture about to kick off, follow its home side, and
 * return what the strip should then name.
 */
const followUpcoming = async (page: Page) => {
  const body = await readMatches(page);
  const target = upcomingFixture(body);
  const name = (code: string) =>
    body.data.clubs.find((club) => club.code === code)?.shortName ?? code;

  await serveMatches(page, body);
  await openClub(page, target.homeCode);
  await followControl(page).click();
  await expect(followControl(page)).toHaveAttribute("data-follow", "following");

  return {
    id: target.id as string,
    homeName: name(target.homeCode),
    awayName: name(target.awayCode),
  };
};

test.describe("Próximo jogo do meu time", () => {
  test("the followed club's next match is named above the table", async ({ page }) => {
    const next = await followUpcoming(page);

    await page.goto("/");
    await expect(strip(page)).toBeVisible();

    const line = fixtureLine(page);
    await expect(line).toBeVisible();
    await expect(line).toHaveAttribute("data-proximo-jogo", next.id);
    await expect(line).toContainText("Próximo jogo");
    await expect(line).toContainText(next.homeName);
    await expect(line).toContainText(next.awayName);
    // Shape, not value: the wording is `countdownLabel`'s and the number moves.
    await expect(line).toContainText(/Começa em|Deve começar|Horário a definir/);
  });

  test("the fixture line opens the match page", async ({ page }) => {
    const next = await followUpcoming(page);
    await page.goto("/");

    await fixtureLine(page).getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`/partida/${next.id}$`));
    await expect(page.locator("main article")).toBeVisible();
  });

  test("a reader who follows nobody is told nothing about any fixture", async ({ page }) => {
    // The guest invariant again, at the one place a next-match alert is most
    // tempting to show to everybody.
    await page.goto("/");
    await expect(page.locator("table")).toBeVisible();
    await expect(fixtureLine(page)).toHaveCount(0);
  });

  test("a club that is playing right now says so instead of counting down", async ({ page }) => {
    /**
     * The one branch the snapshot cannot reach.
     *
     * `src/data/matches.ts` holds FINISHED, SCHEDULED and POSTPONED fixtures and
     * never a LIVE one, and the suite boots with `DISABLE_FOOTBALL_DATA=true`,
     * so nothing else in this file exercises the *playing* state. The payload is
     * rewritten rather than mocked wholesale — the real response, with one
     * fixture flipped — so everything the page derives from it stays coherent.
     *
     * Note this is a stub of a *rendering* input, not of request accounting:
     * `src/useAccount.ts` records where a `page.route` stub cannot settle a
     * question, and that is a different failure to this one.
     */
    const body = await readMatches(page);
    const target = upcomingFixture(body);
    target.status = "LIVE";
    target.homeGoals = 2;
    target.awayGoals = 1;
    // Kicked off half an hour ago, so the record is coherent as well as live.
    target.kickoff = new Date(E2E_NOW.getTime() - 30 * 60_000).toISOString();
    const live = { id: target.id as string, homeCode: target.homeCode as string };

    // Prepared once and served from memory: `serveMatches` records why a
    // handler proxying each request is not an option under the suite's workers.
    await serveMatches(page, body);

    await openClub(page, live.homeCode);
    await followControl(page).click();
    await page.goto("/");

    const line = fixtureLine(page);
    await expect(line).toBeVisible();
    await expect(line).toHaveAttribute("data-proximo-jogo", live.id);
    await expect(line).toContainText("Bola rolando");
    await expect(line).toContainText("2 × 1");
    // A match under way is never counted down to.
    await expect(line).not.toContainText("Começa em");
    // And it is always the loud form of the strip.
    await expect(line).toHaveAttribute("data-imminent", "yes");
  });

  test("a club the payload does not name keeps the strip and drops the fixture", async ({ page }) => {
    // `followState` answers `unresolved`, so there is no club to look fixtures
    // up by. The preference must survive and the app must not invent a match.
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.setItem("portal-brasileirao:preferences", JSON.stringify({ club: "999999" })),
    );
    await page.reload();

    await expect(page.getByText("A sua escolha continua guardada.")).toBeVisible();
    await expect(fixtureLine(page)).toHaveCount(0);
  });
});
