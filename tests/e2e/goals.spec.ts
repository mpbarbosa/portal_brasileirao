import { expect, test, type Page } from "@playwright/test";

/**
 * Seed fixture 554977 — Palmeiras 4x1 Vasco da Gama, rodada 24 — is the one
 * match `src/data/goals.ts` carries, and its entry is CBF's real payload run
 * through `goalsFromRegistros`.
 *
 * Chosen because it exercises every branch worth seeing at once: two goals by
 * one scorer, a penalty, and a side that scored exactly once.
 */
const MATCH = "554977";

/**
 * Strip the goals from the payload, so the "not synced" state is what renders.
 *
 * Produced rather than hunted for. Walking the season looking for a match
 * nobody has synced yet would make this a hostage to how much data exists —
 * sync the whole season and the walk finds nothing and throws, which is the
 * rule `CLAUDE.md` states as *never assert how much curated data exists*. The
 * empty state is a branch of the component, so it is tested by reaching it.
 *
 * The payload is prepared **once** and fulfilled from memory rather than
 * proxied per request: a `route.fetch()` handler flakes under the suite's
 * workers and passes in isolation.
 */
const withoutGoals = async (page: Page) => {
  const response = await page.request.get("/api/matches");
  const body = await response.json();
  body.data.matches = body.data.matches.map(
    ({ goals: _dropped, ...match }: Record<string, unknown>) => match,
  );
  await page.route("**/api/matches*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }),
  );
};

test("a finished match names who scored", async ({ page }) => {
  await page.goto(`/partida/${MATCH}`);

  const scorers = page.locator("main article [data-goal]");
  await expect(scorers.first()).toBeVisible();
  await expect(scorers).toHaveText([
    "Lopez",
    "Vitor Roque (pên.)",
    "Mauricio",
    "Lopez",
    "Facundo",
  ]);
});

/**
 * The invariant that matters, and the one a wrong own-goal attribution would
 * break: each side's list of scorers has to be as long as that side's half of
 * the scoreline. Read off the page rather than hard-coded, so this keeps
 * meaning something as the data file grows.
 */
test("each side's scorers add up to its half of the score", async ({ page }) => {
  await page.goto(`/partida/${MATCH}`);
  await expect(page.locator("main article [data-goal]").first()).toBeVisible();

  const score = await page.locator("main article p.tabular-nums").innerText();
  const [home, away] = score.split("×").map((part) => Number(part.trim()));

  await expect(page.locator("[data-goals='home'] [data-goal]")).toHaveCount(home);
  await expect(page.locator("[data-goals='away'] [data-goal]")).toHaveCount(away);
});

test("a penalty is marked and an ordinary goal is not", async ({ page }) => {
  await page.goto(`/partida/${MATCH}`);

  const scorers = page.locator("main article [data-goal]");
  await expect(scorers.filter({ hasText: "pên." })).toHaveCount(1);
  await expect(scorers.filter({ hasText: "Mauricio" })).toHaveText("Mauricio");
});

/**
 * A list of bare surnames read aloud says nothing about who scored them, and
 * the crest above is not in the accessibility tree as text.
 */
test("each column names its club for a screen reader", async ({ page }) => {
  await page.goto(`/partida/${MATCH}`);
  await expect(page.locator("main article [data-goal]").first()).toBeVisible();

  await expect(page.locator("[data-goals='home'] .sr-only")).toHaveText("Gols do Palmeiras");
  await expect(page.locator("[data-goals='away'] .sr-only")).toHaveText("Gols do Vasco da Gama");
});

test("a match with no synced goals renders no scorer block at all", async ({ page }) => {
  await withoutGoals(page);
  await page.goto(`/partida/${MATCH}`);

  // The scoreline still renders — absent goals must not read as a missing match.
  await expect(page.locator("main article p.tabular-nums")).toBeVisible();
  await expect(page.locator("main article [data-goal]")).toHaveCount(0);
  await expect(page.locator("[data-goals='home']")).toHaveCount(0);
});
