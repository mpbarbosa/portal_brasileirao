import { expect, test, type Page } from "@/tests/e2e/fixtures";

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

    // Excluding the candles and the scatter, which are the other two
    // `role="img"` drawings on this page. The first two draw the same season,
    // so an unscoped lookup resolved to both; the Perfil's scatter made it
    // three, and this line is why adding a drawing to the Painel goes red here
    // rather than quietly widening what "the sparkline" means.
    const sparkline = page.locator(
      "main svg[role='img']:not([data-candles]):not([data-scatter-svg])",
    );

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
    //
    // Excluding the scatter as well as the candles. It went red here the moment
    // the scatter's x axis moved into the drawing's own grid column — its two
    // end labels are a `p` following an `svg[role='img']` too — which is the
    // narrowing the sibling spec above already does and the reason both drawings
    // carry a `data-` name.
    const ends = page.locator(
      "main svg[role='img']:not([data-candles]):not([data-scatter-svg]) ~ p span",
    );

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
      .locator("main svg[role='img']:not([data-candles]):not([data-scatter-svg]) ~ p span")
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
    // The campanha's own figure, not the Perfil's scatter — this page carries
    // two, and a bare `main figure` is a strict-mode violation rather than a
    // wrong answer, which is the good kind of breakage.
    const panel = (await page.locator("main figure:not([data-scatter])").boundingBox())!;

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
    const figure = page.locator("main figure[data-candles-figure]");
    await expect(figure.getByText("1º", { exact: true })).toBeVisible();
    await expect(figure.getByText("20º", { exact: true })).toBeVisible();
    await expect(figure.getByText("1ª rodada", { exact: true })).toBeVisible();

    // The key is **outside** the figure and stated once for the section, which
    // is where it moved when the comparação made a second drawing possible —
    // inside the caption it would sit between the two charts it describes.
    // Every colour in the drawing is still named in it.
    const key = page.locator("main [data-candles-key]");
    await expect(key).toHaveCount(1);
    for (const word of ["Vitória", "Empate", "Derrota", "Sem jogo"]) {
      await expect(key.getByText(word, { exact: true })).toBeVisible();
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

  test("the perfil reads six rates, each with its place in the division", async ({ page }) => {
    await openPanel(page);

    const perfil = page.locator("main [data-profile]");
    await expect(perfil).toBeVisible();
    await expect(perfil.locator("[data-profile-row]")).toHaveCount(6);

    // Every row carries a figure *and* a rank: the figure alone says nothing —
    // 13 desarmes a game is either the most or the least in the league, and
    // only the rank can tell a reader which.
    for (const row of await perfil.locator("[data-profile-row]").all()) {
      await expect(row).toHaveText(/\d+º de 20/);
    }
  });

  test("the perfil says how old it is rather than implying it is live", async ({ page }) => {
    await openPanel(page);

    // The source is a weekly snapshot, so the caption names the rodada it runs
    // through — the `StadiumWeather` rule. And it credits caRtola, whose data
    // this is.
    const caption = page.locator("main [data-profile] p").last();
    await expect(caption).toHaveText(/\d+ª rodada/);
    await expect(caption.getByRole("link", { name: "caRtola" })).toHaveAttribute(
      "href",
      /github\.com\/henriquepgomide\/caRtola/,
    );
  });

  test("each marker is centred on its value, not hung off it", async ({ page }) => {
    await openPanel(page);

    const tracks = await page.locator("main [data-profile-track]").all();
    expect(tracks.length).toBe(6);

    for (const track of tracks) {
      const box = await track.boundingBox();
      const marker = track.locator("[data-profile-marker]");
      const markerBox = await marker.boundingBox();
      // The fraction the component positioned it at, read back off the element
      // rather than recomputed here — recomputing it would be a second copy of
      // `markerFraction` and could agree with itself while both were wrong.
      const left = await marker.evaluate((node) => (node as HTMLElement).style.left);
      expect(box).not.toBeNull();
      expect(markerBox).not.toBeNull();
      if (!box || !markerBox) continue;

      const fraction = Number.parseFloat(left) / 100;
      expect(Number.isFinite(fraction)).toBe(true);

      // Centred, which is the whole of what keeps a club at the top of the
      // division from drawing half a dot past the end of its own track. An
      // assertion that the marker merely stays *inside* the track cannot see
      // this: it passes for every club that is not at an extreme, which on any
      // given day is eighteen of the twenty — so it would pass against the bug
      // it names, which is worse than not testing it.
      const centre = markerBox.x + markerBox.width / 2;
      expect(Math.abs(centre - (box.x + fraction * box.width))).toBeLessThanOrEqual(1.5);
    }
  });

  test("the scatter plots the whole division, with this club filled in", async ({ page }) => {
    await openPanel(page);

    const scatter = page.locator('main figure[data-scatter-pair="ataque-defesa"]');
    await expect(scatter).toBeVisible();
    // Scoped to the drawing, not to the figure: the caption beneath carries a
    // swatch of this club's own mark — a real `circle`, and the point of it is
    // that it is the same mark — so a figure-wide count reads 21 and a spec
    // written against the figure would have to be loosened every time the key
    // gains a swatch.
    // `circle[data-scatter-point]` — the marks that stand for clubs, not every
    // `circle` element. The subject now carries a ring as well as a dot, and a
    // count of elements would have to be loosened by one every time the drawing
    // gains a decoration, which is the brittleness that already moved this
    // lookup once.
    await expect(
      scatter.locator("svg[data-scatter-svg] circle[data-scatter-point]"),
    ).toHaveCount(20);
    // Exactly one, which is what the drawing is for: placing *this* club among
    // the rest rather than being a table of twenty.
    await expect(scatter.locator("[data-scatter-point='subject']")).toHaveCount(1);
  });

  test("every dot says which club it is, since none is labelled on the page", async ({
    page,
  }) => {
    const name = await openPanel(page);

    // No `<text>` inside the SVG — a drawing that scales scales its type — so
    // the `<title>` is the only thing a pointer or a screen reader has.
    // `allTextContents`, not `allInnerTexts`: an SVG `<title>` is not rendered
    // text, so `innerText` is undefined for every one of them — and
    // `toMatch(undefined)` throws rather than failing an assertion, which reads
    // as a broken spec instead of a missing title.
    const titles = await page
      .locator('main figure[data-scatter-pair="ataque-defesa"] svg[data-scatter-svg] circle title')
      .allTextContents();
    expect(titles.length).toBe(20);
    for (const title of titles) {
      expect(title).toMatch(/^.+ — [\d,]+ finalizações por jogo e [\d,]+ defesas do goleiro por jogo$/);
    }
    expect(new Set(titles).size).toBe(20);

    // And at least one is a name this test knows independently — read off the
    // page heading rather than out of the same resolver. Distinctness alone
    // proves nothing here: twenty club *codes* are twenty different strings and
    // match the shape above, so a resolver that had stopped resolving would
    // pass every assertion up to this line.
    expect(titles.some((title) => title.startsWith(`${name} — `))).toBe(true);
  });

  test("both pairings render, share an x axis and differ on y", async ({ page }) => {
    await openPanel(page);

    // The page carries two scatters on purpose. The failure this refuses is the
    // one a shared component invites: a dropped `pair` prop rendering the same
    // drawing twice, which looks deliberate and is a duplicate.
    await expect(page.locator("main figure[data-scatter]")).toHaveCount(2);

    const jogo = page.locator('main figure[data-scatter-pair="ataque-defesa"]');
    const volume = page.locator('main figure[data-scatter-pair="volume-conversao"]');
    await expect(jogo).toBeVisible();
    await expect(volume).toBeVisible();

    // Each drawing names itself. Before this the topmost line was the y axis,
    // so a reader had to infer the pairing from its two ends — and the two
    // stacked figures share an x axis, which makes the title the only thing
    // telling them apart at a glance.
    await expect(jogo.getByRole("heading", { name: "Ataque × defesa" })).toBeVisible();
    await expect(volume.getByRole("heading", { name: "Volume × conversão" })).toBeVisible();

    // Same x, different y — read off the rendered captions rather than the
    // props, so a component that ignored its `pair` fails here.
    await expect(jogo).toContainText("Defesas do goleiro por jogo");
    await expect(volume).toContainText("Conversão");
    await expect(volume).not.toContainText("Defesas do goleiro");
    for (const figure of [jogo, volume]) {
      await expect(figure).toContainText("mais finalizações");
    }

    // A percentage axis must never be captioned "por jogo" — the bug reads as a
    // typo and is a claim about what the figure counts.
    const caption = (await volume.locator("figcaption").innerText()).toLowerCase();
    expect(caption).toMatch(/\d+% de conversão/);
    expect(caption).not.toMatch(/% de conversão por jogo/);
  });

  test("the drawing tints the club's own quadrant and names it there", async ({
    page,
  }) => {
    await openPanel(page);

    for (const pair of ["ataque-defesa", "volume-conversao"]) {
      const figure = page.locator(`main figure[data-scatter-pair="${pair}"]`);
      const tint = figure.locator("svg[data-scatter-svg] [data-scatter-quadrant]");
      await expect(tint).toHaveCount(1);

      // **The invariant: the tint, the words and the dot are one reading.**
      // `subjectQuadrant` exists so the component cannot compare the medians a
      // second time to place the tint — and this is what would catch it if it
      // did. A drawing that shades one corner while the caption names another
      // is wrong in a way that looks deliberate, and it would differ only for a
      // club sitting near a median, so no fixture-picked club would show it.
      const box = (await tint.boundingBox())!;
      const dot = (await figure.locator("[data-scatter-point='subject']").boundingBox())!;
      const dotCentre = { x: dot.x + dot.width / 2, y: dot.y + dot.height / 2 };
      expect(dotCentre.x).toBeGreaterThanOrEqual(box.x - 1);
      expect(dotCentre.x).toBeLessThanOrEqual(box.x + box.width + 1);
      expect(dotCentre.y).toBeGreaterThanOrEqual(box.y - 1);
      expect(dotCentre.y).toBeLessThanOrEqual(box.y + box.height + 1);

      // The corner is named on the drawing, and it is the same string the
      // caption sets in the page's own ink. Not two spellings of one phrase:
      // both come from `subjectQuadrant`.
      const term = (await figure.locator("[data-scatter-corner]").innerText()).trim();
      expect(term.length).toBeGreaterThan(0);
      await expect(figure.locator("figcaption")).toContainText(term);

      // Inside the box it labels, so it reads as that region's name rather than
      // as a stray caption.
      const label = (await figure.locator("[data-scatter-corner]").boundingBox())!;
      const svg = (await figure.locator("svg[data-scatter-svg]").boundingBox())!;
      expect(label.x).toBeGreaterThanOrEqual(svg.x - 1);
      expect(label.x + label.width).toBeLessThanOrEqual(svg.x + svg.width + 1);

      // And clear of the y axis's own words, which sit in the gutter at the
      // box's top and bottom edges. A left-hand label on their baseline reads
      // as one phrase — "mais jogo recuado" — which is the x axis's old run-on
      // one axis over, and it shipped in the pass before this one.
      for (const end of await figure.locator("[data-scatter-axis-end]").all()) {
        const word = (await end.boundingBox())!;
        const rowsOverlap =
          label.y < word.y + word.height - 1 && word.y < label.y + label.height - 1;
        const colsOverlap =
          label.x < word.x + word.width + 8 && word.x < label.x + label.width + 8;
        expect(rowsOverlap && colsOverlap).toBe(false);
      }
    }
  });

  test("the subject's dot carries a ring, and the ring is not a club", async ({
    page,
  }) => {
    await openPanel(page);

    const figure = page.locator('main figure[data-scatter-pair="ataque-defesa"]');
    // One ring, and it is not counted among the twenty marks — the count spec
    // above selects `circle[data-scatter-point]` for exactly this reason.
    await expect(figure.locator("[data-scatter-ring]")).toHaveCount(1);
    await expect(
      figure.locator("svg[data-scatter-svg] circle[data-scatter-point]"),
    ).toHaveCount(20);

    // Concentric with the dot it marks, or it reads as a twenty-first club.
    const ring = (await figure.locator("[data-scatter-ring]").boundingBox())!;
    const dot = (await figure.locator("[data-scatter-point='subject']").boundingBox())!;
    expect(Math.abs(ring.x + ring.width / 2 - (dot.x + dot.width / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(ring.y + ring.height / 2 - (dot.y + dot.height / 2))).toBeLessThanOrEqual(1);
    expect(ring.width).toBeGreaterThan(dot.width);
  });

  test("no dot is drawn outside the box it is plotted in", async ({ page }) => {
    await openPanel(page);

    // The domain is padded precisely so the division's highest and lowest clubs
    // are not centred on the frame with half their mark outside it. Unlike the
    // strip's marker, this one *can* be checked by containment — the assertion
    // runs over all twenty dots, so it reaches the extremes whichever club's
    // panel is open, which is the trap the marker spec fell into.
    const svg = page.locator(
      'main figure[data-scatter-pair="ataque-defesa"] svg[data-scatter-svg]',
    );
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    for (const dot of await svg.locator("circle").all()) {
      const mark = await dot.boundingBox();
      expect(mark).not.toBeNull();
      if (!mark) continue;
      expect(mark.x).toBeGreaterThanOrEqual(box.x - 0.5);
      expect(mark.y).toBeGreaterThanOrEqual(box.y - 0.5);
      expect(mark.x + mark.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
      expect(mark.y + mark.height).toBeLessThanOrEqual(box.y + box.height + 0.5);
    }
  });

  test("the scatter names the club's own reading, since the drawing carries no text", async ({
    page,
  }) => {
    const name = await openPanel(page);
    const caption = page.locator('main figure[data-scatter-pair="ataque-defesa"] figcaption');

    await expect(caption).toContainText(name);
    // "defesas do goleiro", not "defesas": the caption is derived from the axis
    // label now rather than written by hand, so it says the same words as the
    // label printed directly above the drawing. The two used to differ.
    await expect(caption).toHaveText(/finalizações por jogo.*defesas do goleiro por jogo/);
    // Descriptive, never a verdict: two rates cannot support one.
    await expect(caption).toHaveText(/jogo (aberto|controlado|recuado|fechado)/);
  });

  test("the subject club leaves a rastro that ends on its own dot", async ({ page }) => {
    await openPanel(page);

    for (const pair of ["ataque-defesa", "volume-conversao"]) {
      const svg = page.locator(`main figure[data-scatter-pair="${pair}"] svg[data-scatter-svg]`);
      const segments = svg.locator("[data-scatter-trail]");

      // One fewer segment than there are rodadas drawn, and never more than the
      // window allows. Not an exact count: the seed advances, and a spec that
      // pins how much curated data exists is the failure this repository has
      // broken CI on twice.
      const drawn = await segments.count();
      expect(drawn).toBeGreaterThan(0);
      expect(drawn).toBeLessThan(8);

      await expect(svg.locator("[data-scatter-trail-start]")).toHaveCount(1);

      // **The frozen frame, measured in the browser.** `scatterTrail` places the
      // rastro with the scatter's own axes, so its last segment must land on the
      // subject's dot to the pixel. If this drifts, something has given the
      // rastro a domain of its own — which would make every earlier point a
      // claim about a frame nobody can see.
      const last = segments.last();
      const dot = svg.locator("[data-scatter-point='subject']");
      expect(await last.getAttribute("x2")).toBe(await dot.getAttribute("cx"));
      expect(await last.getAttribute("y2")).toBe(await dot.getAttribute("cy"));

      // The oldest segment is the faintest. A two-point rastro is one segment
      // with no ramp to sit on, and the obvious `Math.max(1, …)` guard paints it
      // at the *oldest* opacity — the faintest thing on the drawing.
      const first = Number(await segments.first().getAttribute("stroke-opacity"));
      const newest = Number(await last.getAttribute("stroke-opacity"));
      expect(newest).toBeGreaterThan(first);
    }
  });

  test("the rastro stays inside the drawing", async ({ page }) => {
    await openPanel(page);

    // The clamp's whole purpose, asserted where it fails visibly: 12% of rastro
    // points sit at a domain edge, and unclamped they paint outside the box —
    // `RankCandles`' painting-past-the-card failure one figure over.
    const svg = page.locator('main figure[data-scatter-pair="ataque-defesa"] svg[data-scatter-svg]');
    const box = (await svg.boundingBox())!;

    for (const mark of await svg.locator("[data-scatter-trail]").all()) {
      const seg = (await mark.boundingBox())!;
      expect(seg.x).toBeGreaterThanOrEqual(box.x - 2);
      expect(seg.y).toBeGreaterThanOrEqual(box.y - 2);
      expect(seg.x + seg.width).toBeLessThanOrEqual(box.x + box.width + 2);
      expect(seg.y + seg.height).toBeLessThanOrEqual(box.y + box.height + 2);
    }
  });

  test("the key says what the rastro is not", async ({ page }) => {
    await openPanel(page);
    const key = page.locator("main [data-scatter-key]");

    await expect(key).toContainText("rastro");
    // Both caveats, in the one place that is true of both drawings. Without the
    // second, a rastro crossing a mediana reads as a club that changed corner
    // that week.
    await expect(key).toContainText(/média acumulada/);
    await expect(key).toContainText(/divisão hoje/);
  });

  test("its metadata names the club, and is injected server-side", async ({ page }) => {
    const name = await openPanel(page);
    const path = new URL(page.url()).pathname;

    // Read from the served HTML rather than from the rendered document: a link
    // preview never runs JavaScript, so the server half is the one that has to
    // be right.
    const html = await (await page.request.get(path)).text();

    // **Assert that the TITLE ELEMENT names the club**, not that the document
    // begins with the club's first letter. The line here was
    // `` `<title>${name} — Painel do`.slice(0, 8) ``, which is `<title>` plus one
    // character — and it passed for eighteen months because the table's leader
    // was **P**almeiras and the title reads "**P**ainel do …". Rodada 26 put
    // Flamengo top and the coincidence ended. A spec that can only fail when a
    // club whose name starts with a different letter reaches first place is not
    // testing the thing it is named for.
    expect(html).toMatch(new RegExp(`<title>[^<]*\\b${name}\\b[^<]*</title>`));
    expect(html).toMatch(new RegExp(`Painel do ${name}`));
    expect(html).toMatch(/rel="canonical" href="[^"]*\/painel\//);
    // Three deep: the painel hangs off the club's page, not off the table.
    expect(html).toMatch(/"position":3/);
  });

  /**
   * The **comparação**: the same velas read against a second club.
   *
   * What makes this a comparison rather than two charts is that both drawings
   * take the *division's* domains — twenty positions and the season's last
   * round — so they are the same box at the same scale and a reader can drop a
   * vertical line through both. These specs measure exactly that, because it
   * is the property a later "simplification" would take away without anything
   * else going red: two charts of two clubs each scaled to its own campanha
   * look entirely reasonable and are not comparable.
   */
  test.describe("comparação com outro clube", () => {
    /** Pick the first club offered, and read back the name it names. */
    const compareWithFirst = async (page: Page) => {
      const select = page.locator("#comparar-clube");
      const option = select.locator("option").nth(1);
      const name = (await option.innerText()).trim();
      await select.selectOption(await option.getAttribute("value") ?? "");
      return name;
    };

    test("the painel draws one club until a second is asked for", async ({ page }) => {
      await openPanel(page);

      // The resting state is one drawing, which is what every other spec on
      // this page assumes — and the reason the comparison is opt-in.
      await expect(page.locator("main svg[data-candles]")).toHaveCount(1);
      await expect(page.locator("#comparar-clube")).toHaveValue("");
    });

    test("choosing a club draws its velas beneath, and names both", async ({ page }) => {
      const subject = await openPanel(page);
      const other = await compareWithFirst(page);

      const charts = page.locator("main svg[data-candles]");
      await expect(charts).toHaveCount(2);

      // Named only once there are two: on its own the drawing is what the page
      // heading has just said, and a third statement of the club is noise.
      await expect(page.locator(`main svg[data-candles-club="${subject}"]`)).toHaveCount(1);
      await expect(page.locator(`main svg[data-candles-club="${other}"]`)).toHaveCount(1);
      // The subject stays first — the page is its painel, and the comparison
      // is what it is being read against.
      expect(await charts.first().getAttribute("data-candles-club")).toBe(subject);
    });

    test("both drawings share one frame, which is what makes them comparable", async ({ page }) => {
      await openPanel(page);
      await compareWithFirst(page);

      const charts = page.locator("main svg[data-candles]");
      const first = (await charts.nth(0).boundingBox())!;
      const second = (await charts.nth(1).boundingBox())!;

      // Same width and same left edge, so a rodada sits at the same x in both.
      // Without this a reader comparing round 12 is comparing two different
      // places on the page.
      expect(Math.abs(first.x - second.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(first.width - second.width)).toBeLessThanOrEqual(1);
      // Same height, because the y axis is the whole division in both — a
      // per-club y domain is the failure this asserts against, and it would
      // leave a leader's chart and a struggler's looking equally busy.
      expect(Math.abs(first.height - second.height)).toBeLessThanOrEqual(1);

      // And the same axis, stated in text: both drawings run 1º to the size of
      // the division. Counting rather than reading one — the labels belong to
      // the figures, so two figures owe two pairs.
      const figures = page.locator("main figure[data-candles-figure]");
      await expect(figures).toHaveCount(2);
      for (const nth of [0, 1]) {
        const figure = figures.nth(nth);
        await expect(figure.getByText("1º", { exact: true })).toBeVisible();
        await expect(figure.getByText("20º", { exact: true })).toBeVisible();
      }
    });

    test("both drawings span the same rounds", async ({ page }) => {
      await openPanel(page);
      await compareWithFirst(page);

      // A club with a game in hand must not be drawn on a shorter axis than the
      // one beside it: the x domain is the *season's* last round, not either
      // club's own.
      //
      // **Read off the axis label, not off `data-candles`.** That attribute
      // counts the marks drawn, and `candleShapes` maps the candles it is
      // given — so it reports the same number whatever domain the drawing was
      // handed, and a spec comparing the two counts passes against exactly the
      // bug it is written for. Confirmed by mutation: giving the second chart
      // its own `lastRound` left a count assertion green and this one red.
      const ends = await page
        .locator("main figure[data-candles-figure] p span:nth-child(2)")
        .allInnerTexts();

      expect(ends).toHaveLength(2);
      expect(ends[0]).toMatch(/^\d{1,2}ª rodada$/);
      expect(ends[0]).toBe(ends[1]);
    });

    test("the key is stated once for the section, not under each drawing", async ({ page }) => {
      await openPanel(page);
      await compareWithFirst(page);

      // Two drawings, one vocabulary. Said twice it would sit *between* the
      // charts it explains and leave a reader checking whether the two
      // statements agree — which is why it left the figure's own caption.
      await expect(page.locator("main [data-candles-key]")).toHaveCount(1);
      await expect(page.locator("main [data-candles-key]")).toContainText("Sem jogo");
    });

    test("a painel never offers to compare a club with itself", async ({ page }) => {
      const subject = await openPanel(page);

      const names = await page
        .locator("#comparar-clube option")
        .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() ?? ""));

      // Nineteen clubs and the resting option, and the subject in none of them.
      expect(names).not.toContain(subject);
      expect(names[0]).toBe("Nenhum");
      expect(names.length).toBeGreaterThan(2);
    });

    /**
     * **What this asserts is that the choice is not PERSISTED, and it does not
     * reach the reset in `ClubDashboard`.** Both are worth being exact about.
     *
     * The reset — clearing `compareCode` when the subject changes — is
     * unreachable from a browser today: every route out of this page changes
     * `route.section`, so `App` swaps the component and a fresh painel gets
     * fresh state whatever the reset does. Deleting it would leave this spec
     * green. It stays because the moment anything links one painel to another
     * the component stops unmounting, and the first thing a reader would see
     * is a club drawn against itself.
     *
     * What *would* fail here is the design this rejected — putting the choice
     * in `localStorage` beside the plot kind, which would have every painel
     * opening with a second club already drawn.
     */
    test("a second painel opens with no comparison of its own", async ({ page }) => {
      await openPanel(page);
      await compareWithFirst(page);
      await expect(page.locator("main svg[data-candles]")).toHaveCount(2);

      // Second row rather than the first: a different club from the one this
      // started on, which is the whole point.
      await page.goto("/");
      await expect(page.locator("table tbody tr")).toHaveCount(20);
      const cell = page.locator("table tbody tr").nth(1).locator("td:nth-child(2) a");
      const name = (await cell.innerText()).trim();
      await cell.click();
      await page.locator("main a[data-panel-link]").click();
      await expect(pageHeading(page)).toHaveText(`Painel do ${name}`);

      await expect(page.locator("main svg[data-candles]")).toHaveCount(1);
      await expect(page.locator("#comparar-clube")).toHaveValue("");
    });

    test("going back to Nenhum leaves the painel as it was", async ({ page }) => {
      await openPanel(page);
      await compareWithFirst(page);
      await expect(page.locator("main svg[data-candles]")).toHaveCount(2);

      await page.locator("#comparar-clube").selectOption("");
      await expect(page.locator("main svg[data-candles]")).toHaveCount(1);
      // Unnamed again, since the page heading is once more the only thing that
      // needs to say whose season this is.
      await expect(page.locator('main svg[data-candles-club=""]')).toHaveCount(1);
    });
  });
});
