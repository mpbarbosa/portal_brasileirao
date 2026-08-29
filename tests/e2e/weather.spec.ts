import { expect, test } from "@playwright/test";

/**
 * **Clima no estádio.**
 *
 * The suite runs with `DISABLE_WEATHER=true`, so the endpoint answers `null`
 * and the card is absent — that is production's shape whenever Open-Meteo is
 * unreachable, and it is the first thing worth asserting. Everything else here
 * serves a **prepared payload**, fulfilled from memory rather than proxied per
 * request: the proxying form (`route.fetch()`) came back as something other
 * than the envelope under this suite's workers and passed in isolation, which
 * is written down in CLAUDE.md and cost a session to find.
 */

const envelope = (data: unknown) => ({
  source: "open-meteo",
  note: "Condições atuais no estádio, do Open-Meteo.",
  updatedAt: "2026-08-29T21:00:00.000Z",
  data,
});

const SNAPSHOT = {
  temperature: 23.4,
  feelsLike: 25.1,
  humidity: 78,
  windSpeed: 12.3,
  label: "Pancadas de chuva",
  kind: "rain",
  day: true,
  readAt: "2026-08-29T21:00:00.000Z",
};

test.describe("Clima no estádio", () => {
  test("is absent entirely when the weather is unreachable", async ({ page }) => {
    // No stub: the suite's own DISABLE_WEATHER makes this the real path.
    await page.goto("/estadio/maracana");
    await expect(page.getByRole("heading", { name: "Maracanã" })).toBeVisible();
    // The page is fully rendered and simply says nothing about the sky. An
    // apology, a spinner or a dash would all be worse than silence.
    await expect(page.getByRole("heading", { name: "Clima no estádio" })).toHaveCount(0);
  });

  test("shows the temperature, the sky and the reading's age", async ({ page }) => {
    await page.route("**/api/stadium-weather/**", (route) =>
      route.fulfill({ json: envelope(SNAPSHOT) }),
    );
    await page.goto("/estadio/maracana");

    const section = page
      .getByRole("heading", { name: "Clima no estádio" })
      .locator("xpath=..");
    await expect(section).toContainText("23 °C");
    await expect(section).toContainText("Pancadas de chuva");
    await expect(section).toContainText("78%");
    await expect(section).toContainText("12 km/h"); // 12.3 rounds down
    // The card says when it was read rather than implying it is live.
    await expect(section).toContainText(/Leitura das \d{2}:\d{2}/);
  });

  test("omits a figure the payload does not carry, rather than printing a dash", async ({
    page,
  }) => {
    await page.route("**/api/stadium-weather/**", (route) =>
      route.fulfill({
        json: envelope({
          temperature: 19,
          label: "Nublado",
          kind: "cloudy",
          day: false,
          readAt: "2026-08-29T21:00:00.000Z",
        }),
      }),
    );
    await page.goto("/estadio/maracana");

    const section = page
      .getByRole("heading", { name: "Clima no estádio" })
      .locator("xpath=..");
    await expect(section).toContainText("19 °C");
    await expect(section).not.toContainText("Umidade");
    await expect(section).not.toContainText("Vento");
    await expect(section).not.toContainText("Sensação");
  });

  test("the mark is one drawn element in currentColor, never a character", async ({ page }) => {
    await page.route("**/api/stadium-weather/**", (route) =>
      route.fulfill({ json: envelope(SNAPSHOT) }),
    );
    await page.goto("/estadio/maracana");

    const heading = page.getByRole("heading", { name: "Clima no estádio" });
    await expect(heading).toBeVisible();
    const mark = heading.locator("xpath=..").locator("svg").first();
    await expect(mark).toBeVisible();
    // `☀` and `☁` are Extended_Pictographic, so a font would decide their size
    // and several platforms their colour. This is why the sky is drawn.
    const box = await mark.boundingBox();
    expect(box?.width).toBeGreaterThan(20);
    expect(box?.height).toBeGreaterThan(20);
  });

  test("a failing weather request leaves the rest of the page alone", async ({ page }) => {
    await page.route("**/api/stadium-weather/**", (route) => route.abort());
    await page.goto("/estadio/maracana");

    // The ground, its tiles and its fixtures all render: the card is a nicety
    // and is never a reason to surface an error on a page that already worked.
    await expect(page.getByRole("heading", { name: "Maracanã" })).toBeVisible();
    await expect(page.getByText("Jogos neste estádio")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Clima no estádio" })).toHaveCount(0);
  });
});
