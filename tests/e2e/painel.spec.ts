import { expect, test, type Page } from "@playwright/test";

/**
 * The heading naming what this page is about. Scoped to `main` for
 * `club.spec.ts`'s reason: the rodapé carries an `sr-only` level-2 heading on
 * every page, so an unscoped lookup resolves to two elements.
 */
const pageHeading = (page: Page) => page.getByRole("main").getByRole("heading", { level: 2 });

/** Open the leader's club page, and read back the name it landed on. */
const openLeader = async (page: Page) => {
  await page.goto("/");
  await expect(page.locator("table tbody tr")).toHaveCount(20);

  const cell = page.locator("table tbody tr").first().locator("td:nth-child(2) a");
  const name = (await cell.innerText()).trim();
  await cell.click();
  await expect(pageHeading(page)).toHaveText(name);
  return name;
};

const openPanel = async (page: Page) => {
  const name = await openLeader(page);
  await page.locator("main a[data-panel-link]").click();
  await expect(pageHeading(page)).toHaveText(`Painel do ${name}`);
  return name;
};

test.describe("Painel do clube", () => {
  test("the club page offers the painel as a real link", async ({ page }) => {
    await openLeader(page);

    const link = page.locator("main a[data-panel-link]");
    await expect(link).toBeVisible();
    // A real href is what makes middle-click and "open in new tab" work, and
    // it is the only route a crawler has to this page besides the sitemap.
    await expect(link).toHaveAttribute("href", /^\/painel\/.+/);
  });

  test("the whole row is the target, not the words inside it", async ({ page }) => {
    await openLeader(page);

    const link = page.locator("main a[data-panel-link]");
    const box = (await link.boundingBox())!;
    const container = (await page.locator("main").boundingBox())!;

    // The failure this replaces is a 96px phrase inside a 700px band: most of
    // the largest control on the page inert. Within a few pixels of the
    // content column, and at least the 48dp touch floor tall.
    expect(box.width).toBeGreaterThan(container.width - 8);
    expect(box.height).toBeGreaterThanOrEqual(48);
  });

  test("the painel opens and draws a candle for every round played", async ({ page }) => {
    await openPanel(page);

    const chart = page.locator("main svg[data-candles]");
    await expect(chart).toBeVisible();

    // Shape, not value: the frozen snapshot ages and the round it has reached
    // moves with the calendar. What must hold is that the chart draws exactly
    // as many candles as it says it does, and that a season's worth is a
    // plausible number of rounds rather than one.
    const drawn = await chart.getAttribute("data-candles");
    const rounds = page.locator("main svg[data-candles] g[data-round]");
    await expect(rounds).toHaveCount(Number(drawn));
    expect(Number(drawn)).toBeGreaterThan(1);
    expect(Number(drawn)).toBeLessThanOrEqual(38);
  });

  test("the painel draws the club's campanha above the candles", async ({ page }) => {
    await openPanel(page);

    // Excluding the candles, which are the other `role="img"` on this page:
    // both marks draw the same season and an unscoped lookup resolves to two.
    const sparkline = page.locator("main svg[role='img']:not([data-candles])");

    await expect(sparkline).toHaveCount(1);
    await expect(sparkline).toHaveAttribute("aria-label", /^Campanha: /);

    // Above, not below — the coarse mark is how a reader gets their bearings
    // before reading a round's inside. Order is the whole reason the section
    // was placed where it was rather than appended to the end of the page.
    const line = (await sparkline.boundingBox())!;
    const candles = (await page.locator("main svg[data-candles]").boundingBox())!;
    expect(line.y).toBeLessThan(candles.y);
  });

  test("the campanha names both ends, since the drawing carries no axis", async ({ page }) => {
    await openPanel(page);

    // Shape, never a value: the snapshot ages and the table reorders.
    const ends = page.locator("main svg[role='img']:not([data-candles]) ~ p span");

    await expect(ends).toHaveCount(2);
    await expect(ends.first()).toHaveText(/^\d+º · 1ª rodada$/);
    await expect(ends.last()).toHaveText(/^\d+º · \d+ª rodada$/);
  });

  test("the campanha ends where the painel's summary says the club is", async ({ page }) => {
    // The two are computed from different payloads — the sparkline from the
    // rank history, the tile from /api/standings — so with a live provider they
    // can differ mid-round. Against the frozen snapshot nothing is in play, so
    // they must agree, and disagreement here means a real bug.
    await openPanel(page);

    const position = (
      await page.locator("main p", { hasText: /^\d+º$/ }).first().innerText()
    ).trim();
    const endLabel = await page
      .locator("main svg[role='img']:not([data-candles]) ~ p span")
      .last()
      .innerText();

    expect(endLabel.startsWith(position)).toBe(true);
  });

  test("the painel follows the mark chosen in the Classificação", async ({ page }) => {
    // The point of the whole choice: it is one preference for the app, not one
    // per page. Chosen in the table, then found on a page the reader navigated
    // to without touching a control. The choice is made in the table before
    // the painel is ever opened; it survives `openPanel`'s own reload because
    // it lives in `localStorage`, which is what makes it one preference for
    // the app rather than one per mount.
    await page.goto("/");
    await expect(page.locator("table tbody tr")).toHaveCount(20);
    await page.getByRole("button", { name: /ver a campanha em barras/i }).click();
    await openPanel(page);

    const sparkline = page.locator("main svg[role='img']:not([data-candles])");
    await expect(sparkline.locator("polyline")).toHaveCount(0);
    expect(await sparkline.locator("rect").count()).toBeGreaterThan(0);
  });

  test("the painel carries the control, not only the consequence", async ({ page }) => {
    // A preference the reader can see the effect of but cannot change from here
    // would send them back to the table to undo their own choice.
    await openPanel(page);

    const toggle = page.getByRole("button", { name: /ver a campanha em barras/i });
    await expect(toggle).toBeVisible();

    await toggle.click();
    const sparkline = page.locator("main svg[role='img']:not([data-candles])");
    expect(await sparkline.locator("rect").count()).toBeGreaterThan(0);
    await expect(
      page.getByRole("button", { name: /ver a campanha em linha/i }),
    ).toBeVisible();
  });

  test("a choice made on the painel is what the table then draws", async ({ page }) => {
    // The other direction, which is the one a single shared hook would get
    // wrong: three independent copies of the preference agree only while a
    // route change unmounts two of them. Two hops back rather than one, since
    // the painel's "voltar" means the club page it drilled down from.
    await openPanel(page);
    await page.getByRole("button", { name: /ver a campanha em barras/i }).click();

    await page.getByRole("button", { name: /voltar/i }).first().click();
    await page.getByRole("button", { name: /voltar/i }).first().click();
    await expect(page.locator("table tbody tr")).toHaveCount(20);

    const cell = page.locator("table tbody tr td:nth-child(4)").first();
    await expect(cell.locator("polyline")).toHaveCount(0);
    expect(await cell.locator("rect").count()).toBeGreaterThan(0);
  });

  test("the drawing stays inside the panel it is drawn in", async ({ page }) => {
    await openPanel(page);

    // The chart is `overflow-visible`, so nothing clips it: a box that is wider
    // than its container simply paints over the card's border and off the side
    // of the page. It shipped that way once — `w-full` inside a flex row is
    // 100% of the container rather than of what the gutter leaves — and every
    // other assertion in this file passed throughout, because the candles were
    // all still there and all still correct.
    const chart = (await page.locator("main svg[data-candles]").boundingBox())!;
    const panel = (await page.locator("main figure").boundingBox())!;

    expect(chart.x).toBeGreaterThanOrEqual(panel.x - 1);
    expect(chart.x + chart.width).toBeLessThanOrEqual(panel.x + panel.width + 1);
  });

  test("every candle says in words what it draws", async ({ page }) => {
    await openPanel(page);

    // The drawing is unreadable to a screen reader and in forced-colours mode,
    // so the same fact is stated in text — the rule `RankSparkline` follows.
    const first = page.locator("main svg[data-candles] g[data-round]").first();
    await expect(first.locator("title")).toHaveText(/1ª rodada: \d+º → \d+º/);

    const chart = page.locator("main svg[data-candles]");
    await expect(chart).toHaveAttribute("aria-label", /Campanha rodada a rodada:/);
    await expect(chart).toHaveAttribute("aria-label", /Melhor: \d+º/);
  });

  test("a candle's colour reports the club's result", async ({ page }) => {
    await openPanel(page);

    // Every round the club played carries one of the three results; the fourth
    // value exists for a round it did not play, which the frozen season may or
    // may not contain, so it is allowed rather than required.
    const results = await page
      .locator("main svg[data-candles] g[data-round]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-result")));

    expect(results.length).toBeGreaterThan(1);
    for (const result of results) {
      expect(["V", "E", "D", "none"]).toContain(result);
    }
    // A season of one colour would mean the mapping is not reading the result
    // at all — the failure that looks exactly like a working chart.
    expect(new Set(results).size).toBeGreaterThan(1);
  });

  test("the axes are named in text, since the drawing carries none", async ({ page }) => {
    await openPanel(page);

    // Scoped to the figure: "1º" is also the Posição tile three sections up,
    // which is a different claim about the same club and resolves to two
    // elements under strict mode.
    const figure = page.locator("main figure");
    await expect(figure.getByText("1º", { exact: true })).toBeVisible();
    await expect(figure.getByText("20º", { exact: true })).toBeVisible();
    await expect(figure.getByText("1ª rodada", { exact: true })).toBeVisible();
    const main = figure;
    // Every colour in the drawing is named in the key.
    for (const word of ["Vitória", "Empate", "Derrota", "Sem jogo"]) {
      await expect(main.getByText(word, { exact: true })).toBeVisible();
    }
  });

  test("the destaques are read off the chart, round and all", async ({ page }) => {
    await openPanel(page);

    const main = page.locator("main");
    await expect(main.getByText("Melhor posição", { exact: true })).toBeVisible();
    await expect(main.getByText("Pior posição", { exact: true })).toBeVisible();
    // Shape rather than value, as everywhere else: "3º · 12ª rodada".
    await expect(main.getByText(/^\d{1,2}º · \d{1,2}ª rodada$/).first()).toBeVisible();
  });

  test("a deep link to the painel renders it directly", async ({ page }) => {
    const name = await openPanel(page);
    const url = page.url();

    await page.goto(url);
    await expect(pageHeading(page)).toHaveText(`Painel do ${name}`);
    await expect(page.locator("main svg[data-candles]")).toBeVisible();
  });

  test("the painel leads back to the club page", async ({ page }) => {
    const name = await openPanel(page);

    await page.locator("main a", { hasText: `Página do ${name}` }).click();
    await expect(pageHeading(page)).toHaveText(name);
  });

  test("a painel for a club that does not exist is a 404, not a copy of the table", async ({
    page,
  }) => {
    const response = await page.goto("/painel/nao-existe");

    // The body stays friendly and the status code tells the truth — the split
    // `pageStatus` exists to make. A 200 here is an unbounded set of duplicate
    // pages offered to a crawler.
    expect(response?.status()).toBe(404);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("the painel is in the sitemap, one per club", async ({ page }) => {
    const response = await page.request.get("/sitemap.xml");
    const body = await response.text();

    const panels = body.match(/<loc>[^<]*\/painel\/[^<]+<\/loc>/g) ?? [];
    const clubs = body.match(/<loc>[^<]*\/clube\/[^<]+<\/loc>/g) ?? [];
    // The club page is the only link to it, so without this line a crawler
    // that has not reached the club has no route here at all.
    expect(panels.length).toBe(clubs.length);
    expect(panels.length).toBe(20);
  });

  test("its metadata names the club, and is injected server-side", async ({ page }) => {
    const name = await openPanel(page);
    const path = new URL(page.url()).pathname;

    // Read from the served HTML rather than from the rendered document: a link
    // preview never runs JavaScript, so the server half is the one that has to
    // be right.
    const html = await (await page.request.get(path)).text();

    expect(html).toContain(`<title>${name} — Painel do`.slice(0, 8));
    expect(html).toMatch(new RegExp(`Painel do ${name}`));
    expect(html).toMatch(/rel="canonical" href="[^"]*\/painel\//);
    // Three deep: the painel hangs off the club's page, not off the table.
    expect(html).toMatch(/"position":3/);
  });
});
