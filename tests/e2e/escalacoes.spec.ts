import { expect, test } from "@/tests/e2e/clock";

/**
 * The **escalações** on a Partida page.
 *
 * Fixture 554977 — Palmeiras 4x1 Vasco, rodada 24 — is the one the capture set
 * already opens and the one `goals.spec.ts` uses, so it is the fixture most
 * likely to keep working: the same sync run that gave it scorers gave it team
 * sheets, and the two cannot come apart because one script writes both files.
 *
 * The suite boots with `DISABLE_FOOTBALL_DATA=true`, so everything here reads
 * the frozen snapshot merged with `src/data/escalacoes.ts`.
 */
const MATCH = "554977";

test.describe("Escalações", () => {
  test("the section is closed on arrival and opens to two team sheets", async ({ page }) => {
    await page.goto(`/partida/${MATCH}`);

    const section = page.locator("details", { has: page.getByRole("heading", { name: "Escalações" }) });
    await expect(section).toBeVisible();

    // Closed by default: 46 names open would push the campanhas off the page,
    // which is the whole reason this is a `<details>`.
    await expect(section).not.toHaveAttribute("open", /.*/);

    // **Visibility, not existence.** A closed `<details>` keeps its children in
    // the DOM — it hides them — so `toHaveCount(0)` fails against a perfectly
    // correct page, which is how this assertion was first written and what the
    // first run of this spec caught.
    const sheets = page.locator("[data-lineup]");
    await expect(sheets).toHaveCount(2);
    await expect(sheets.first()).not.toBeVisible();

    await section.getByRole("heading", { name: "Escalações" }).click();
    await expect(section).toHaveAttribute("open", /.*/);
    await expect(sheets.first()).toBeVisible();
    await expect(sheets.nth(1)).toBeVisible();
  });

  test("each side lists exactly eleven starters, and names a goalkeeper", async ({ page }) => {
    await page.goto(`/partida/${MATCH}`);
    await page.getByRole("heading", { name: "Escalações" }).click();

    const sheets = page.locator("[data-lineup]");
    await expect(sheets).toHaveCount(2);

    for (const sheet of await sheets.all()) {
      // The first list is the eleven; the bench is its own list below it. The
      // count is the assertion that would catch the string-boolean bug end to
      // end — that failure yields zero starters and 23 reserves, and looks like
      // perfectly ordinary data all the way to the page.
      const starters = sheet.locator("ul").first().locator("li");
      await expect(starters).toHaveCount(11);
      await expect(sheet.getByText("(GOL)").first()).toBeVisible();
      await expect(sheet.locator("[data-bench] li").first()).toBeVisible();
    }
  });

  test("substitutions print a minute, a name and who they replaced", async ({ page }) => {
    await page.goto(`/partida/${MATCH}`);
    await page.getByRole("heading", { name: "Escalações" }).click();

    const subs = page.locator("[data-subs] li");
    // Both sides made changes in this fixture; the count comes from CBF's own
    // `alteracoes`, which the sync refuses to write unless the súmula agrees.
    await expect(subs.first()).toBeVisible();

    // A minute, or the word for the one moment that has none. Asserted as a
    // pattern rather than a value: the label is CBF's reckoning and the fixture
    // is real data, so pinning "70'" would break on a re-sync of another match.
    await expect(subs.first()).toHaveText(/^(\d{1,3}(\+\d{1,2})?'|Intervalo)/);
    // "X por Y" — no arrow glyph, and the direction is in the words.
    await expect(subs.first()).toContainText(" por ");
  });

  test("a fixture with no synced sheet renders no section at all", async ({ page }) => {
    // Round 1 is in the snapshot and was not part of the sync window, so it
    // carries no escalação. Nothing renders — no heading, no empty panel, and
    // no dash standing in for a value nobody has.
    await page.goto("/jogos?rodada=1");
    const first = page.locator("main a[href^='/partida/']").first();
    await first.click();
    await expect(page.locator("main article")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Escalações" })).toHaveCount(0);
  });
});
