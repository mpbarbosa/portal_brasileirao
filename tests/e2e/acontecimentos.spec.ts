import { expect, test } from "@/tests/e2e/clock";

/**
 * The **Acontecimentos** section on a club page: this club's own off-pitch
 * events merged with every general one, newest first.
 *
 * **Nothing here asserts how many entries exist**, which is the rule
 * `CLAUDE.md` states for every curated file: `src/data/events.ts` grows by
 * hand, so a count is a test that fails the next time somebody adds a row.
 * What is asserted is the *shape* of a rendered row and the two rules the
 * section exists to keep — a general acontecimento reaches every club, and one
 * club's does not reach another's.
 *
 * The two clubs named below are chosen for a property of the data rather than
 * for their place in the table: Cruzeiro holds a club acontecimento and
 * Palmeiras holds none, so between them they cover both branches. Should
 * either stop being true the specs fail loudly rather than passing vacuously —
 * `hasOwn` on a rendered row is what says so.
 */
test.describe("Acontecimentos", () => {
  test("every club gets the general acontecimentos, whether or not it has its own", async ({
    page,
  }) => {
    // Palmeiras has no club acontecimento in the curated file, so anything in
    // its section can only have arrived by being general. That is the whole of
    // what `geral` means, asserted on the club least likely to hide it.
    await page.goto("/clube/palmeiras");

    const section = page.locator("[data-events]");
    await expect(section).toBeVisible();
    await expect(section.getByRole("heading", { level: 3 })).toHaveText("Acontecimentos");

    const general = section.locator("[data-event-scope='geral']");
    await expect(general.first()).toBeVisible();
    await expect(section.locator("[data-event-scope='clube']")).toHaveCount(0);

    // A general row says so in words. The caption is the only thing telling a
    // reader this row is not about the club whose page they opened.
    await expect(general.first().locator("[data-event-general]")).toHaveText(
      "Todo o Brasileirão",
    );
  });

  test("a club's own acontecimento renders on its page, with a date and a source", async ({
    page,
  }) => {
    await page.goto("/clube/cruzeiro");

    const row = page.locator("[data-event='cruzeiro-tite']");
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute("data-event-scope", "clube");
    await expect(row).toContainText("Cruzeiro demite Tite");

    // The day is written out in pt-BR and is the BRAZIL-local one. The fixture
    // it followed kicked off 2026-03-15T23:30Z — 20:30 in Belo Horizonte — and
    // finished after midnight UTC, so a date built through `new Date()` would
    // print the 14th or the 16th depending on where it ran.
    await expect(row).toContainText("15 de março de 2026");

    // Provenance: named by its bare host, opening away from the app.
    const source = row.locator("[data-event-source]");
    await expect(source).toHaveText(/ge\.globo\.com/);
    await expect(source).toHaveAttribute("target", "_blank");
    await expect(source).toHaveAttribute("rel", /noopener/);
  });

  test("one club's acontecimento does not reach another club's page", async ({ page }) => {
    await page.goto("/clube/palmeiras");
    await expect(page.locator("[data-event='cruzeiro-tite']")).toHaveCount(0);

    await page.goto("/clube/cruzeiro");
    await expect(page.locator("[data-event='cruzeiro-tite']")).toHaveCount(1);
    await expect(page.locator("[data-event='corinthians-dorival']")).toHaveCount(0);
  });

  test("the list runs newest first", async ({ page }) => {
    await page.goto("/clube/cruzeiro");
    // `evaluateAll` queries immediately and does NOT auto-wait, unlike
    // `expect(locator)` — so without this it samples an empty list on a page
    // React has not rendered yet, and both lookups come back -1. That is the
    // documented flake, met head-on: the first version of this spec read
    // `-1 < -1` and failed in both projects.
    await expect(page.locator("[data-event='cruzeiro-tite']")).toBeVisible();

    const ids = await page.locator("[data-event]").evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-event")),
    );
    // Tite (15 March) is a club row; the paralisação starts 1 June. Newest
    // first therefore puts the paralisação above it — which also pins that a
    // range sorts by where it STARTS rather than by where it ends.
    expect(ids.indexOf("paralisacao-copa-2026")).toBeLessThan(ids.indexOf("cruzeiro-tite"));
    expect(ids.indexOf("cruzeiro-tite")).toBeGreaterThan(-1);
  });

  test("a closed span reads as a period and counts its days", async ({ page }) => {
    await page.goto("/clube/palmeiras");

    const halt = page.locator("[data-event='paralisacao-copa-2026']");
    await expect(halt).toContainText("de 1 de junho a 15 de julho de 2026");
    await expect(halt).toContainText("45 dias");
    // It must never claim to end at the moment the page is read.
    await expect(halt).not.toContainText("hoje");
  });

  test("the section sits below the vídeos and above Jogos disputados", async ({ page }) => {
    // Order is load-bearing rather than cosmetic: `screenshot.ts` crops a
    // capture at the last section fitting in 1080 CSS px, so a section
    // inserted above **Vídeos do clube** could evict it from the committed
    // frame. Placed here the worst case is that this section falls outside
    // the crop itself.
    await page.goto("/clube/palmeiras");

    const events = await page.locator("[data-events]").boundingBox();
    const videos = await page.locator("section", { hasText: "Vídeos do clube" }).first()
      .boundingBox();
    const played = await page
      .getByRole("heading", { level: 3, name: "Jogos disputados" })
      .boundingBox();

    expect(events).not.toBeNull();
    expect(played).not.toBeNull();
    if (videos) expect(events!.y).toBeGreaterThan(videos.y);
    expect(events!.y).toBeLessThan(played!.y);
  });
});
