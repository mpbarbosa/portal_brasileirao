import { expect, test, type Page } from "@playwright/test";

const card = (page: Page) => page.getByRole("dialog");

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
    await expect(card(page).locator("dd").first()).toHaveText(goals);
  });

  test("an unreported figure stays a dash inside the card", async ({ page }) => {
    await openFirstPlayer(page);

    const stats = await card(page).locator("dd").allInnerTexts();
    for (const value of stats) {
      expect(value.trim()).toMatch(/^(\d+|—|.+ anos|[A-Za-zÀ-ÿ\-\s]+)$/);
    }
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
    await expect(card(page).getByText("Brazil")).toBeVisible();
    await expect(card(page).getByText(/\d+ anos/)).toBeVisible();
    // The shirt number joins the heading.
    await expect(card(page).getByRole("heading", { level: 2 })).toContainText("9");
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
