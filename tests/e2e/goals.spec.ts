import { expect, test, type Page } from "@/tests/e2e/fixtures";

/**
 * Seed fixture 554977 — Palmeiras 4x1 Vasco da Gama, rodada 24 — is the match
 * these specs read, and its entry is CBF's real payload run through
 * `goalsFromRegistros`. It was once the *only* match `src/data/goals.ts`
 * carried; the file now holds 184, so nothing here may assume it is alone.
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

/**
 * Strip the minutes from the payload, so the "synced before the súmula
 * existed" state is what renders.
 *
 * Produced rather than hunted for, for the reason `withoutGoals` above gives
 * and this spec originally ignored: it pinned 554977 as the match with no
 * minutes, on a comment reading "554977 predates the join". A later
 * `sync-goals` run gave it minutes and the assertion died — 7 of the 184
 * matches now carry one. Which fixtures happen to lack a minute is exactly
 * the "how much curated data exists" the header refuses to depend on, and
 * every future sync moves it.
 */
const withoutMinutes = async (page: Page) => {
  const response = await page.request.get("/api/matches");
  const body = await response.json();
  body.data.matches = body.data.matches.map((match: Record<string, unknown>) => ({
    ...match,
    goals: Array.isArray(match.goals)
      ? match.goals.map(({ minute: _dropped, ...goal }: Record<string, unknown>) => goal)
      : match.goals,
  }));
  await page.route("**/api/matches*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }),
  );
};

test("a finished match names who scored", async ({ page }) => {
  await page.goto(`/partida/${MATCH}`);

  const scorers = page.locator("main article [data-goal]");
  await expect(scorers.first()).toBeVisible();
  // The minute is optional on purpose: it arrives per match when its súmula is
  // parsed, so pinning its presence either way makes this a test of how much
  // has been synced rather than of who scored.
  const withOptionalMinute = (name: string) =>
    new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+(\\+\\d+)?')?$`);
  await expect(scorers).toHaveText(
    ["Lopez", "Vitor Roque (pên.)", "Mauricio", "Lopez", "Facundo"].map(withOptionalMinute),
  );
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
  // What must hold is that the ordinary goal is *unmarked* — not that its line
  // is the bare name, which stopped being true when its minute was synced.
  await expect(scorers.filter({ hasText: "Mauricio" })).not.toContainText("pên.");
  await expect(scorers.filter({ hasText: "Mauricio" })).toContainText("Mauricio");
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

/**
 * Seed fixture 554805 — Atlético-MG 2x0 Vitória, rodada 7 — whose second goal
 * is an own goal by Camutanga, a *Vitória* player.
 *
 * **This does NOT test the own-goal flip, and the first draft of this comment
 * said it did.** `src/data/goals.ts` is a static file written by the sync, so
 * the flip has already been applied to every entry in it; deleting the flip
 * from `goalsFromRegistros` cannot change a single rendered pixel. That was
 * confirmed rather than reasoned about — removing it leaves all 14 specs in
 * this file green, while three in `tests/goals-core.test.ts` go red. The flip
 * is unit-tested, and this is the one place that can say so.
 *
 * What this *does* test is worth having on its own: that the **committed data**
 * is internally coherent where it is hardest to be — each side's scorers add up
 * to that side's half of a scoreline that includes a goal credited across the
 * middle — and that the qualifier reaches the page, so a reader is never told
 * an opponent scored for us without being told how.
 */
const OWN_GOAL_MATCH = "554805";

test("an own goal is marked and counts for the other club", async ({ page }) => {
  await page.goto(`/partida/${OWN_GOAL_MATCH}`);
  await expect(page.locator("main article [data-goal]").first()).toBeVisible();

  const score = await page.locator("main article p.tabular-nums").innerText();
  const [home, away] = score.split("×").map((part) => Number(part.trim()));

  // The data invariant, read off the page rather than hard-coded.
  await expect(page.locator("[data-goals='home'] [data-goal]")).toHaveCount(home);
  await expect(page.locator("[data-goals='away'] [data-goal]")).toHaveCount(away);

  // And it is labelled, so a reader is not told an opponent scored for us.
  await expect(page.locator("main article [data-goal]").filter({ hasText: "contra" })).toHaveCount(1);
});

/**
 * A fixture that carries scorers while our own record says it has not been
 * played must render no scorers at all.
 *
 * Not a hypothetical: `src/data/goals.ts` is synced against the live provider
 * while `src/data/matches.ts` is a frozen snapshot, so a match played after the
 * snapshot was taken sits in exactly this state until the seed is regenerated —
 * two of round 25's did on the day this landed. The page would otherwise draw a
 * list of scorers underneath an empty "×".
 *
 * The state is **produced** rather than hunted for, so regenerating the seed
 * cannot quietly delete this test's subject.
 */
test("a fixture with goals but no score renders no scorers", async ({ page }) => {
  const response = await page.request.get("/api/matches");
  const body = await response.json();

  const scheduled = body.data.matches.find(
    (match: Record<string, unknown>) => match.homeGoals === null && match.awayGoals === null,
  );
  expect(scheduled, "the snapshot should contain an unplayed fixture").toBeTruthy();

  scheduled.goals = [
    { clubCode: scheduled.homeCode, scorer: "Fulano" },
    { clubCode: scheduled.awayCode, scorer: "Sicrano", kind: "own" },
  ];
  await page.route("**/api/matches*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }),
  );

  await page.goto(`/partida/${scheduled.id}`);
  await expect(page.locator("main article")).toBeVisible();
  await expect(page.locator("main article [data-goal]")).toHaveCount(0);
  await expect(page.getByText("Fulano")).toHaveCount(0);
});

/**
 * The minute, on a match that has one.
 *
 * **A different fixture on purpose.** 554977's minutes are not in the snapshot:
 * the súmula join was wired after that entry was written, so it carries scorers
 * and no clock. 554790 — Botafogo 0x3 Flamengo, rodada 6 — was re-synced with
 * the join in place, and its three minutes were read off CBF's own PDF by hand
 * before the parser ever ran: 12', 45+1', 48'.
 *
 * Asserted as *shape* rather than as those three values, because the snapshot
 * ages and a re-sync can legitimately move which fixtures carry minutes. What
 * must hold is that a minute renders beside a scorer, and that stoppage time
 * survives as `45+1` rather than being flattened to a bare number.
 */
test("a goal that has a minute prints it beside the scorer", async ({ page }) => {
  await page.goto("/partida/554790");
  const scorers = page.locator("main article [data-goal]");
  await expect(scorers.first()).toBeVisible();

  const lines = await scorers.allInnerTexts();
  expect(lines.length).toBeGreaterThan(0);
  // Every line names a scorer and then a minute.
  for (const line of lines) expect(line).toMatch(/\S+.*\d+(\+\d+)?'/);
  // And stoppage time keeps its form rather than being rounded into the 45th.
  expect(lines.join(" ")).toMatch(/\d+\+\d+'/);
});

test("a goal with no minute prints no placeholder", async ({ page }) => {
  // Absent is absent: no dash, no empty parentheses, no "—". The minuteless
  // state is produced rather than found, so this cannot rot the next time a
  // súmula is parsed.
  await withoutMinutes(page);
  await page.goto(`/partida/${MATCH}`);
  const scorers = page.locator("main article [data-goal]");
  await expect(scorers.first()).toBeVisible();

  for (const line of await scorers.allInnerTexts()) {
    expect(line).not.toMatch(/[—–-]\s*$/);
    expect(line).not.toMatch(/'/);
  }
});
