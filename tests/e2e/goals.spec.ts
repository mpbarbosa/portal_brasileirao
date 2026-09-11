import { expect, test, type Page } from "@/tests/e2e/clock";
import { finishedFixture, readMatches, serveMatches, type MatchesPayload } from "@/tests/e2e/matches-payload";
import { goalsReconcile } from "@/goals-core";
import { GOALS } from "@/src/data/goals";
import { SEED_MATCHES } from "@/src/data/matches";
import type { Goal, Match } from "@/src/types";

/**
 * A finished fixture's curated goals, **only where they add up to its
 * scoreline** — the gate `withGoals` applies before the server serves them, so a
 * fixture that passes here is one the page will render scorers for.
 */
const reconciledGoals = (match: Match): Goal[] | null => {
  const goals = GOALS[match.id];
  if (!goals || match.status !== "FINISHED" || match.homeGoals == null || match.awayGoals == null) {
    return null;
  }
  return goalsReconcile(goals, match.homeCode, match.awayCode, match.homeGoals, match.awayGoals)
    ? goals
    : null;
};

/**
 * The goals most of these specs read, **written here and served on a finished
 * fixture** rather than read off one.
 *
 * They read 554977 — Palmeiras 4x1 Vasco da Gama — chosen because it exercised
 * every branch worth seeing at once: two goals by one scorer, a penalty, and a
 * side that scored exactly once. That made each assertion a claim about one
 * record in `src/data/goals.ts`, which `sync-goals` rewrites, and this file had
 * already broken once on exactly that, when a sync gave its "minuteless"
 * fixture a minute. The branches are the subject, so the list that exercises
 * them is written down, and the fixture carrying it is whichever the payload
 * offers. The names are invented, so nothing here depends on a real squad.
 */
const scorers = (home: string, away: string): Goal[] => [
  { clubCode: home, scorer: "Artilheiro", minute: "12'" },
  { clubCode: home, scorer: "Cobrador", kind: "penalty", minute: "45+2'" },
  { clubCode: away, scorer: "Visitante", minute: "60'" },
  { clubCode: home, scorer: "Artilheiro", minute: "88'" },
];

/**
 * Serve a finished fixture whose goals are `build(home, away)`, with the
 * scoreline made to agree, and open its page. `undefined` removes the goals and
 * keeps the score, which is the "not synced" state.
 *
 * **Produced rather than hunted for.** Walking the season for a match nobody has
 * synced yet, or one without minutes, makes a spec a hostage to how much data
 * exists — which is the rule `CLAUDE.md` states as *never assert how much
 * curated data exists*. Both states are branches of the component, so they are
 * tested by reaching them.
 *
 * Prepared **once** and fulfilled from memory rather than proxied per request:
 * a `route.fetch()` handler flakes under the suite's workers and passes in
 * isolation.
 */
const openWithGoals = async (
  page: Page,
  build: (home: string, away: string) => Goal[] | undefined,
) => {
  const body = await readMatches(page);
  const match = finishedFixture(body);
  const goals = build(match.homeCode, match.awayCode);
  if (goals) {
    match.goals = goals;
    match.homeGoals = goals.filter((goal) => goal.clubCode === match.homeCode).length;
    match.awayGoals = goals.length - match.homeGoals;
  } else {
    delete match.goals;
  }
  await serveMatches(page, body);
  await page.goto(`/partida/${match.id}`);
  return { body, match };
};

/**
 * A fixture one of whose scorers the elencos could place, **read off the payload
 * the server built**. The join is `withGoals`' and happens on the server, so a
 * `playerId` written into a produced payload would test nothing of it — this is
 * the one place a spec here has to find a fixture rather than make one.
 */
const linkedFixture = (body: MatchesPayload) => {
  const match = body.data.matches.find((candidate) =>
    (candidate.goals as Goal[] | undefined)?.some((goal) => goal.playerId),
  );
  if (!match) throw new Error("no fixture in /api/matches has a scorer the elencos could place");
  return match;
};

test("a finished match names who scored", async ({ page }) => {
  await openWithGoals(page, scorers);

  const lines = page.locator("main article [data-goal]");
  await expect(lines.first()).toBeVisible();
  // Home column first, each goal where it was scored, the penalty marked. The
  // minute is asserted by its own specs below, so here it may follow the name
  // or not.
  const withOptionalMinute = (name: string) =>
    new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+(\\+\\d+)?')?$`);
  await expect(lines).toHaveText(
    ["Artilheiro", "Cobrador (pên.)", "Artilheiro", "Visitante"].map(withOptionalMinute),
  );
});

/**
 * The invariant that matters, and the one a wrong own-goal attribution would
 * break: each side's list of scorers has to be as long as that side's half of
 * the scoreline. Read off the page rather than hard-coded, so this keeps
 * meaning something as the data file grows.
 */
test("each side's scorers add up to its half of the score", async ({ page }) => {
  await openWithGoals(page, scorers);
  await expect(page.locator("main article [data-goal]").first()).toBeVisible();

  const score = await page.locator("main article p.tabular-nums").innerText();
  const [home, away] = score.split("×").map((part) => Number(part.trim()));

  await expect(page.locator("[data-goals='home'] [data-goal]")).toHaveCount(home);
  await expect(page.locator("[data-goals='away'] [data-goal]")).toHaveCount(away);
});

test("a penalty is marked and an ordinary goal is not", async ({ page }) => {
  await openWithGoals(page, scorers);

  const lines = page.locator("main article [data-goal]");
  await expect(lines.filter({ hasText: "pên." })).toHaveCount(1);
  // What must hold is that the ordinary goal is *unmarked* — not that its line
  // is the bare name, which stops being true the moment it carries a minute.
  await expect(lines.filter({ hasText: "Visitante" })).not.toContainText("pên.");
  await expect(lines.filter({ hasText: "Visitante" })).toContainText("Visitante");
});

/**
 * A list of bare surnames read aloud says nothing about who scored them, and
 * the crest above is not in the accessibility tree as text. The names expected
 * are the clubs the payload itself ships, so this reads which clubs the fixture
 * is between rather than naming them.
 */
test("each column names its club for a screen reader", async ({ page }) => {
  const { body, match } = await openWithGoals(page, scorers);
  await expect(page.locator("main article [data-goal]").first()).toBeVisible();

  const shortName = (code: string) =>
    body.data.clubs.find((club) => club.code === code)?.shortName;
  const home = shortName(match.homeCode);
  const away = shortName(match.awayCode);
  expect(home && away, "the payload should name both clubs of the fixture").toBeTruthy();

  await expect(page.locator("[data-goals='home'] .sr-only")).toHaveText(`Gols do ${home}`);
  await expect(page.locator("[data-goals='away'] .sr-only")).toHaveText(`Gols do ${away}`);
});

test("a match with no synced goals renders no scorer block at all", async ({ page }) => {
  await openWithGoals(page, () => undefined);

  // The scoreline still renders — absent goals must not read as a missing match.
  await expect(page.locator("main article p.tabular-nums")).toBeVisible();
  await expect(page.locator("main article [data-goal]")).toHaveCount(0);
  await expect(page.locator("[data-goals='home']")).toHaveCount(0);
});

/**
 * A finished fixture with an own goal, **derived from the committed data**.
 *
 * It was 554805 — Atlético-MG 2x0 Vitória, whose second goal is an own goal by
 * Camutanga, a *Vitória* player — named by hand. `src/data/goals.ts` is
 * regenerated by `sync-goals`, which is free to rewrite any entry, so the
 * literal was a claim about which record holds an own goal: the "which record
 * happens to hold a value" trap `CLAUDE.md` names. The data can answer that
 * itself, and the assertion counts this fixture's own goals rather than assuming
 * there is exactly one.
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
const OWN_GOAL_MATCH = SEED_MATCHES.find((match) =>
  reconciledGoals(match)?.some((goal) => goal.kind === "own"),
);

test("an own goal is marked and counts for the other club", async ({ page }) => {
  expect(OWN_GOAL_MATCH, "no finished fixture in the seed carries a reconciled own goal").toBeTruthy();
  const ownGoals = GOALS[OWN_GOAL_MATCH!.id].filter((goal) => goal.kind === "own").length;

  await page.goto(`/partida/${OWN_GOAL_MATCH!.id}`);
  await expect(page.locator("main article [data-goal]").first()).toBeVisible();

  const score = await page.locator("main article p.tabular-nums").innerText();
  const [home, away] = score.split("×").map((part) => Number(part.trim()));

  // The data invariant, read off the page rather than hard-coded.
  await expect(page.locator("[data-goals='home'] [data-goal]")).toHaveCount(home);
  await expect(page.locator("[data-goals='away'] [data-goal]")).toHaveCount(away);

  // And it is labelled, so a reader is not told an opponent scored for us.
  await expect(page.locator("main article [data-goal]").filter({ hasText: "contra" })).toHaveCount(ownGoals);
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
 * **Derived, and on purpose not the produced list above.** It was 554790 —
 * Botafogo 0x3 Flamengo, whose three minutes were read off CBF's own PDF by hand
 * before the parser ever ran: 12', 45+1', 48'. Pinned, this was a test of that
 * one record staying as it was, and a re-sync can legitimately move which
 * fixtures carry minutes. What it needs is any finished fixture whose every goal
 * carries a minute, one of them in stoppage time — and the committed data can
 * say which, which also keeps one spec here reading minutes the sync wrote.
 *
 * Asserted as *shape* for the same reason. What must hold is that a minute
 * renders beside a scorer, and that stoppage time survives as `45+1` rather
 * than being flattened to a bare number.
 */
const TIMED_MATCH = SEED_MATCHES.find((match) => {
  const goals = reconciledGoals(match);
  return (
    !!goals &&
    goals.length > 0 &&
    goals.every((goal) => goal.minute) &&
    goals.some((goal) => goal.minute?.includes("+"))
  );
});

test("a goal that has a minute prints it beside the scorer", async ({ page }) => {
  expect(
    TIMED_MATCH,
    "no finished fixture in the seed has every goal timed and one in stoppage time",
  ).toBeTruthy();
  await page.goto(`/partida/${TIMED_MATCH!.id}`);
  const lines = page.locator("main article [data-goal]");
  await expect(lines.first()).toBeVisible();

  const texts = await lines.allInnerTexts();
  expect(texts.length).toBeGreaterThan(0);
  // Every line names a scorer and then a minute.
  for (const line of texts) expect(line).toMatch(/\S+.*\d+(\+\d+)?'/);
  // And stoppage time keeps its form rather than being rounded into the 45th.
  expect(texts.join(" ")).toMatch(/\d+\+\d+'/);
});

test("a goal with no minute prints no placeholder", async ({ page }) => {
  // Absent is absent: no dash, no empty parentheses, no "—". This spec once
  // pinned 554977 as the match with no minutes, on a comment reading "554977
  // predates the join"; a later `sync-goals` run gave it minutes and the
  // assertion died. The minuteless state is produced instead.
  await openWithGoals(page, (home, away) =>
    scorers(home, away).map(({ minute: _dropped, ...goal }) => goal),
  );
  const lines = page.locator("main article [data-goal]");
  await expect(lines.first()).toBeVisible();

  for (const line of await lines.allInnerTexts()) {
    expect(line).not.toMatch(/[—–-]\s*$/);
    expect(line).not.toMatch(/'/);
  }
});

/**
 * The scorer opens the player card.
 *
 * **Asserted as "at least one" rather than by name**, and that is the rule
 * every curated table here follows rather than caution: which scorers resolve
 * to a player is a property of `src/data/squads.ts`, which `sync-seed-data`
 * regenerates. A scorer who has left the division does not resolve — Vasco's
 * frozen elenco does not list 554977's Facundo — so pinning a name would tie
 * this spec to a squad list that moves in every transfer window, and pinning
 * every link would fail on the state the page is designed for.
 */
test("a scorer the elencos can place opens the player card", async ({ page }) => {
  const match = linkedFixture(await readMatches(page));
  await page.goto(`/partida/${match.id}`);

  const linked = page.locator("main article [data-goal] [data-scorer]");
  await expect(linked.first()).toBeVisible();

  const name = await linked.first().innerText();
  await linked.first().click();

  const card = page.locator("dialog[open]");
  await expect(card).toBeVisible();
  // The name the reader clicked, not a fuller one the enrichment reports —
  // `mergePlayer` keeps the base name for exactly this.
  await expect(card).toContainText(name);
});

/**
 * A scorer nobody could place stays plain text, and the two live in one column.
 *
 * The important half is the *absence* of a control: an unresolved scorer must
 * not render a dead button, which is the shape a `?? ""` id would produce and
 * which looks identical until it is pressed. The state is produced from a
 * fixture that *did* have a linked scorer, with the ids taken away, so the same
 * goals are seen with and without the door.
 */
test("a scorer the elencos cannot place renders no control", async ({ page }) => {
  const body = await readMatches(page);
  const match = linkedFixture(body);
  match.goals = (match.goals as Goal[]).map(({ playerId: _dropped, ...goal }) => goal);
  await serveMatches(page, body);

  await page.goto(`/partida/${match.id}`);
  const lines = page.locator("main article [data-goal]");
  await expect(lines.first()).toBeVisible();

  // Every name still renders — the goal is attached either way, only the door
  // on it is missing.
  await expect(lines).toHaveCount(match.goals.length);
  await expect(page.locator("main article [data-goal] [data-scorer]")).toHaveCount(0);
  await expect(page.locator("main article [data-goal] button")).toHaveCount(0);
});
