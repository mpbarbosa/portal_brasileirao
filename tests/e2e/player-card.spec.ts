import { expect, test, type Page } from "@playwright/test";

const card = (page: Page) => page.getByRole("dialog");

/**
 * One labelled figure inside the card, by the exact text of its `dt`.
 *
 * Anchored rather than `filter({ hasText })`, which is case-insensitive
 * substring matching — "Nacionalidade" contains "idade", so the loose form
 * selects two blocks and fails as a strict-mode violation rather than as a
 * wrong value.
 */
const figure = (page: Page, label: string) =>
  card(page)
    .locator("dl div")
    .filter({ has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }) });

const openFirstPlayer = async (page: Page) => {
  await page.goto("/artilharia");
  await expect(page.locator("table tbody tr")).not.toHaveCount(0);

  const first = page.locator("table tbody tr td:nth-child(2) button").first();
  const name = (await first.innerText()).trim();
  await first.click();
  await expect(card(page)).toBeVisible();
  return name;
};

test.describe("Cartão do jogador", () => {
  test("player names in the scorers table open a card", async ({ page }) => {
    const name = await openFirstPlayer(page);

    await expect(card(page).getByRole("heading", { level: 2 })).toContainText(name);
  });

  test("the card is a modal dialog with an accessible name", async ({ page }) => {
    await openFirstPlayer(page);

    const labelledBy = await card(page).getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    await expect(page.locator(`#${labelledBy}`)).not.toBeEmpty();
  });

  test("the card is genuinely modal, not merely labelled as one", async ({ page }) => {
    // This used to assert `aria-modal="true"`, which the card carried while not
    // actually being modal — Tab walked straight out into the page behind it.
    // M4 opens a native dialog with showModal(), where modality is real and the
    // attribute is redundant, so the assertion moved from the label to the
    // behaviour it was standing in for.
    await openFirstPlayer(page);

    const state = await page.evaluate(`(() => {
      const dialog = document.querySelector("dialog");
      if (!dialog) return { error: "no dialog element" };
      const behind = document.querySelector("main table tbody button");
      // Anything outside a modal dialog is inert: focusing it does nothing.
      behind?.focus();
      return {
        open: dialog.open,
        modal: dialog.matches(":modal"),
        focusEscaped: behind ? document.activeElement === behind : null,
        focusIsInside: dialog.contains(document.activeElement),
      };
    })()`);

    expect(state).toMatchObject({ open: true, modal: true, focusEscaped: false });
    expect((state as { focusIsInside: boolean }).focusIsInside).toBe(true);
  });

  test("the card is centred rather than hard against an edge", async ({ page }) => {
    // A native dialog is centred by the user agent's `dialog { margin: auto }`,
    // which Tailwind's preflight resets to `margin: 0` on every element. Relying
    // on the UA rule put the card against the left edge on desktop while
    // vertical centring still worked, because only the vertical margins were
    // set explicitly — so it looked deliberate rather than broken, and no other
    // spec in the suite has an opinion about where a dialog sits.
    await openFirstPlayer(page);

    const box = await card(page).boundingBox();
    const width = page.viewportSize()?.width ?? 0;
    expect(box).not.toBeNull();

    const left = box!.x;
    const right = width - (box!.x + box!.width);
    // Within a pixel of symmetrical; the exact gap depends on the viewport.
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  test("focus lands inside the card on open", async ({ page }) => {
    await openFirstPlayer(page);

    // Otherwise the keyboard is left behind the overlay.
    await expect(page.getByRole("button", { name: "Fechar" })).toBeFocused();
  });

  test("season figures come from the row it was opened from", async ({ page }) => {
    await page.goto("/artilharia");
    await expect(page.locator("table tbody tr")).not.toHaveCount(0);

    const row = page.locator("table tbody tr").first();
    const goals = (await row.locator("td:nth-child(3)").innerText()).trim();
    await row.locator("td:nth-child(2) button").click();

    await expect(card(page).getByText("No campeonato")).toBeVisible();
    await expect(card(page).getByText("Gols", { exact: true })).toBeVisible();
    // Scoped to the figure labelled `Gols`, not to the card's first `dd`. That
    // is what this meant all along; it passed as `.first()` only because the
    // suite runs offline, where the artilharia knows nothing else about a
    // player and so nothing else renders above the tally. The first shirt
    // number to arrive ahead of it would have broken a test that has nothing
    // to do with shirt numbers.
    await expect(figure(page, "Gols").locator("dd")).toHaveText(goals);
  });

  test("an unreported figure stays a dash inside the card", async ({ page }) => {
    await openFirstPlayer(page);

    const stats = await card(page).locator("dd").allInnerTexts();
    for (const value of stats) {
      // A figure, an em dash for one the provider did not report, a date, or a
      // word — never an empty cell, a `0` standing in for silence, or the
      // string "undefined".
      expect(value.trim()).toMatch(
        /^(\d+|—|\d{1,2} [a-z]{3}\. \d{4}|[A-Za-zÀ-ÿ\-\s]+)$/,
      );
    }
  });

  test("the club the page knows outranks the one the enrichment reports", async ({ page }) => {
    // `currentTeam` is football-data's answer, and for an international it is
    // frequently the national team — opened from the Corinthians elenco,
    // Memphis Depay's card read "Netherlands" under his name and "Netherlands"
    // again as his nationality. Verified against a live payload before this was
    // written; stubbed here so the suite stays offline.
    await page.route("**/api/players/*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          source: "football-data",
          note: "stub",
          updatedAt: new Date().toISOString(),
          data: {
            id: "1077",
            name: "Pedro",
            nationality: "Netherlands",
            club: {
              code: "8601",
              name: "Netherlands",
              shortName: "Netherlands",
              tla: "NED",
              slug: "netherlands",
            },
          },
        }),
      }),
    );

    await page.goto("/artilharia");
    await expect(page.locator("table tbody tr")).not.toHaveCount(0);

    const row = page.locator("table tbody tr").first();
    // Whatever club the artilharia says the player scored for is the one the
    // card has to keep. Read from the table rather than named, because the
    // snapshot's top scorer changes with every sync.
    const club = (await row.locator("td:nth-child(2) span").innerText()).trim();
    await row.locator("td:nth-child(2) button").click();

    await expect(card(page)).toBeVisible();
    await expect(card(page).getByText(club, { exact: true })).toBeVisible();
    // The nationality still comes from the enrichment — only the club is
    // overruled, and only because the page already knew a better answer.
    // Translated, like the position beside it — the stub sends the provider's
    // English and the card is a pt-BR surface.
    await expect(figure(page, "Nacionalidade").locator("dd")).toHaveText("Países Baixos");
  });

  test("enrichment fills in details the table did not have", async ({ page }) => {
    // The suite runs with the provider disabled, so /api/players/:id honestly
    // answers null. Stub it to exercise the client-side merge deterministically,
    // without depending on a live upstream.
    await page.route("**/api/players/*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          source: "football-data",
          note: "stub",
          updatedAt: new Date().toISOString(),
          data: {
            id: "1077",
            name: "Pedro",
            shirtNumber: 9,
            position: "Centre-Forward",
            nationality: "Brazil",
            dateOfBirth: "1997-06-20",
          },
        }),
      }),
    );

    await openFirstPlayer(page);

    // Position is translated, not shown in the upstream's English.
    await expect(card(page).getByText("Centroavante")).toBeVisible();
    // The country is translated too, not just the position: the card said
    // "Nacionalidade: Brazil" in an app whose every other word is Portuguese.
    await expect(card(page).getByText("Brasil", { exact: true })).toBeVisible();
    await expect(card(page).getByText("Brazil")).toHaveCount(0);
    // The age is a figure with its unit in the label, like every other tile —
    // the card used to print "32 anos" as the value, which at the headline step
    // is half a phone's width for one word the label already implies.
    await expect(figure(page, "Idade").locator("dd")).toHaveText(/^\d+$/);
    // The shirt number is a figure of its own rather than a prefix on the name.
    // It used to ride in the heading, which is why this assertion moved: a
    // number set in the same line as the name reads as part of it, and the
    // heading is the card's accessible name, so a screen reader announced the
    // dialog as "9 Pedro". It is now a `Camisa` tile — and, at a size that
    // cannot be read as a value, the header watermark.
    await expect(figure(page, "Camisa").locator("dd")).toHaveText("9");
    await expect(card(page).getByRole("heading", { level: 2 })).not.toContainText("9");
  });

  test("without enrichment the card omits unknown details rather than showing blanks", async ({
    page,
  }) => {
    // Offline is the suite's default: the card must degrade, not render empty
    // labels or the string "undefined".
    await openFirstPlayer(page);

    await expect(card(page).getByText("Posição")).toHaveCount(0);
    await expect(card(page).getByText("undefined")).toHaveCount(0);
    // What the table knew is still there.
    await expect(card(page).getByText("No campeonato")).toBeVisible();
  });

  test("the close control dismisses it", async ({ page }) => {
    await openFirstPlayer(page);
    await page.getByRole("button", { name: "Fechar" }).click();

    await expect(card(page)).toHaveCount(0);
  });

  test("Escape dismisses it", async ({ page }) => {
    await openFirstPlayer(page);
    await page.keyboard.press("Escape");

    await expect(card(page)).toHaveCount(0);
  });

  test("clicking the backdrop dismisses it", async ({ page }) => {
    await openFirstPlayer(page);
    // Top-left corner is backdrop at every viewport.
    await page.mouse.click(5, 5);

    await expect(card(page)).toHaveCount(0);
  });

  test("a click inside the card does not dismiss it", async ({ page }) => {
    await openFirstPlayer(page);
    await card(page).getByRole("heading", { level: 2 }).click();

    await expect(card(page)).toBeVisible();
  });

  test("opening a second player replaces the first", async ({ page }) => {
    const first = await openFirstPlayer(page);
    await page.keyboard.press("Escape");

    const second = page.locator("table tbody tr td:nth-child(2) button").nth(1);
    const secondName = (await second.innerText()).trim();
    await second.click();

    await expect(card(page).getByRole("heading", { level: 2 })).toContainText(secondName);
    expect(secondName).not.toBe(first);
  });

  test("the card does not survive a reload", async ({ page }) => {
    await openFirstPlayer(page);
    await page.reload();

    // It is an overlay, not a route — a reload should land on the section.
    await expect(card(page)).toHaveCount(0);
    await expect(page.locator("table tbody tr")).not.toHaveCount(0);
  });

  test("the section behind it still works after closing", async ({ page }) => {
    await openFirstPlayer(page);
    await page.keyboard.press("Escape");

    await page.getByRole("link", { name: /^Classificação/ }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(20);
  });
});
