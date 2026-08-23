import { expect, test } from "@playwright/test";

test.describe("Navegação", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("opens on Classificação", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Classificação" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator("table")).toBeVisible();
  });

  test("switching to Rodada replaces the table with fixtures", async ({ page }) => {
    await page.getByRole("button", { name: "Rodada" }).click();

    await expect(page.locator("table")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Rodada" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Round number is deliberately not asserted: it advances with the calendar.
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(/\d+ª rodada/);
  });

  test("switching back to Classificação restores the table", async ({ page }) => {
    await page.getByRole("button", { name: "Rodada" }).click();
    await page.getByRole("button", { name: "Classificação" }).click();

    await expect(page.locator("table tbody tr")).toHaveCount(20);
  });

  test("the round view lists fixtures with a status badge each", async ({ page }) => {
    await page.getByRole("button", { name: "Rodada" }).click();

    const fixtures = page.locator("main ul > li");
    await expect(fixtures.first()).toBeVisible();

    const count = await fixtures.count();
    expect(count).toBeGreaterThan(0);

    for (const fixture of await fixtures.all()) {
      await expect(fixture).toHaveText(
        /(A realizar|Ao vivo|Encerrado|Adiado|Cancelado)/,
      );
    }
  });

  test("a frozen snapshot never shows a match as in progress", async ({ page }) => {
    // The snapshot normalizes in-play matches, so an "Ao vivo" badge here would
    // mean the fallback is claiming something is happening right now.
    //
    // Scoped to the fixture list and exact: a bare getByText("Ao vivo") also
    // matches the banner's "...para dados ao vivo." (substring, case-insensitive).
    await page.getByRole("button", { name: "Rodada" }).click();

    await expect(page.locator("main ul > li").getByText("Ao vivo", { exact: true })).toHaveCount(0);
  });

  test("the page has one h1 naming the app", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Portal Brasileirão");
  });
});

test.describe("Aviso de dados", () => {
  test("banners the frozen-snapshot note when the provider is off", async ({ page }) => {
    await page.goto("/");

    // With DISABLE_FOOTBALL_DATA the app must say so rather than passing the
    // snapshot off as live data.
    await expect(page.getByText(/Dados congelados de \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
  });
});
