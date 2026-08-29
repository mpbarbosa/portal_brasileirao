import { expect, test, type Page } from "@playwright/test";

/**
 * The suite runs against the frozen snapshot (DISABLE_FOOTBALL_DATA=true), so
 * these assertions hold on any machine at any time. Nothing here may depend on
 * live scores or league positions.
 */
test.describe("Classificação", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for the table to finish populating before any test reads it.
    // allInnerTexts()/all() query immediately and do NOT auto-wait, unlike
    // expect(locator) — without this they sample a half-rendered table.
    await expect(page.locator("table tbody tr")).toHaveCount(20);
  });

  test("renders the full 20-club table", async ({ page }) => {
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(20);
  });

  test("numbers positions 1 through 20 in order", async ({ page }) => {
    const positions = await page.locator("table tbody tr td:first-child").allInnerTexts();

    expect(positions.map((value) => value.trim())).toEqual(
      Array.from({ length: 20 }, (_, index) => String(index + 1)),
    );
  });

  test("shows the Série A column headers", async ({ page }) => {
    const headers = await page.locator("table thead th").allInnerTexts();

    expect(headers.map((header) => header.trim())).toEqual([
      "#", "CLUBE", "P", "CAMPANHA", "J", "V", "E", "D", "SG", "%",
    ]);
  });

  test("lists Corinthians and Coritiba as separate clubs", async ({ page }) => {
    // Regression: both report tla "COR" upstream. Keying club identity on the
    // abbreviation merged them into a single row.
    // Second element child of the club cell: the first is the crest wrapper,
    // which always renders even when a club has no crest, so the name is always
    // at position 2. The name itself is a link when the drill-down is enabled
    // and a span when it is not.
    const names = page.locator("table tbody tr td:nth-child(2) > :nth-child(2)");

    await expect(names.filter({ hasText: /^Corinthians$/ })).toHaveCount(1);
    await expect(names.filter({ hasText: /^Coritiba$/ })).toHaveCount(1);
  });

  test("uses the corrected club display names, not the upstream ones", async ({ page }) => {
    // Second element child of the club cell: the first is the crest wrapper,
    // which always renders even when a club has no crest, so the name is always
    // at position 2. The name itself is a link when the drill-down is enabled
    // and a span when it is not.
    const names = page.locator("table tbody tr td:nth-child(2) > :nth-child(2)");

    await expect(names.filter({ hasText: /^Atlético-MG$/ })).toHaveCount(1);
    await expect(names.filter({ hasText: /^Athletico-PR$/ })).toHaveCount(1);
    // The upstream shortNames these replace.
    await expect(names.filter({ hasText: /^Mineiro$/ })).toHaveCount(0);
    await expect(names.filter({ hasText: /^Paranaense$/ })).toHaveCount(0);
  });

  test("points are consistent with wins and draws for every club", async ({ page }) => {
    const rows = await page.locator("table tbody tr").all();

    for (const row of rows) {
      const cells = await row.locator("td").allInnerTexts();
      // 0 #, 1 Clube, 2 P, 3 Campanha, 4 J, 5 V, 6 E, 7 D, 8 SG, 9 %.
      const [, , points, , , wins, draws] = cells.map((cell) => cell.trim());

      expect(Number(points)).toBe(Number(wins) * 3 + Number(draws));
    }
  });

  test("goal difference is signed", async ({ page }) => {
    // Addressed by index rather than :last-child — aproveitamento sits after
    // SG, and :last-child would sample a percentage and match nothing.
    const values = await page.locator("table tbody tr td:nth-child(9)").allInnerTexts();

    for (const value of values) {
      expect(value.trim()).toMatch(/^[+-]?\d+$/);
    }
  });

  test("aproveitamento is the points taken as a whole percentage", async ({ page }) => {
    const rows = await page.locator("table tbody tr").all();

    expect(rows.length).toBe(20);
    for (const row of rows) {
      const cells = await row.locator("td").allInnerTexts();
      const [, , points, , played, , , , , share] = cells.map((cell) => cell.trim());

      // Derived rather than asserted against a value: the snapshot ages, so
      // the only stable claim is that the column agrees with the two numbers
      // beside it. Zero played would read as an em dash, and the frozen season
      // has none — which the played assertion is here to notice.
      expect(Number(played)).toBeGreaterThan(0);
      expect(share).toBe(`${Math.round((Number(points) * 100) / (Number(played) * 3))}%`);
    }
  });

  test("every club row draws its campanha", async ({ page }) => {
    // Addressed by index, not :last-child — the campanha column sits between P
    // and J, and :last-child would sample the goal-difference number.
    const sparklines = page.locator("table tbody tr td:nth-child(4) svg");

    await expect(sparklines).toHaveCount(20);
  });

  test("the campanha is stated in words as well as drawn", async ({ page }) => {
    // The drawing is unreadable to a screen reader and may not render at all
    // under forced colours, so the same fact has to exist as text.
    const first = page.locator("table tbody tr td:nth-child(4) svg").first();

    // Never assert a position or a round number: the snapshot ages and the
    // table reorders. The shape of the sentence is what is being fixed here.
    await expect(first).toHaveAttribute(
      "aria-label",
      /^Campanha: \d+º na \d+ª rodada, \d+º na \d+ª rodada/,
    );
  });

  test("first place is drawn above last place", async ({ page }) => {
    // The y axis is inverted, and getting that backwards is invisible unless
    // something checks it: a climbing line has to mean a climbing club.
    const yOfLastPoint = async (nth: number) => {
      const points = await page
        .locator("table tbody tr")
        .nth(nth)
        .locator("td:nth-child(4) svg polyline")
        .getAttribute("points");
      const pairs = (points ?? "").trim().split(" ");
      return Number(pairs[pairs.length - 1].split(",")[1]);
    };

    expect(await yOfLastPoint(0)).toBeLessThan(await yOfLastPoint(19));
  });

  test("each club row shows a crest", async ({ page }) => {
    const crests = page.locator("table tbody tr td:nth-child(2) img");

    await expect(crests).toHaveCount(20);
    await expect(crests.first()).toHaveAttribute("src", /crests\.football-data\.org\/\d+\.png/);
  });

  test("crests are decorative, not announced twice", async ({ page }) => {
    // The club name sits beside every crest, so describing the image would make
    // a screen reader say the club twice.
    for (const crest of await page.locator("table tbody tr td:nth-child(2) img").all()) {
      await expect(crest).toHaveAttribute("alt", "");
      await expect(crest).toHaveAttribute("aria-hidden", "true");
    }
  });

  test("crests load lazily so twenty rows do not block paint", async ({ page }) => {
    await expect(page.locator("table tbody tr td:nth-child(2) img").first()).toHaveAttribute(
      "loading",
      "lazy",
    );
  });

  test("no crest request carries a Referer to the provider's CDN", async ({ page }) => {
    // Crests are the one asset class this app still hotlinks — the stadium and
    // player photographs are vendored to our own origin precisely so a reader's
    // browsing does not reach a third party. Without this, every row tells the
    // CDN which page of this site is being read, twenty times per render.
    //
    // The attribute is asserted *and* the header is read off the wire: a policy
    // the browser does not honour would leave the attribute looking right.
    const referers: (string | undefined)[] = [];
    page.on("request", (request) => {
      if (/crests\.football-data\.org/.test(request.url())) {
        referers.push(request.headers()["referer"]);
      }
    });

    await page.reload();
    await expect(page.locator("table tbody tr td:nth-child(2) img")).toHaveCount(20);
    await expect(page.locator("table tbody tr td:nth-child(2) img").first()).toHaveAttribute(
      "referrerpolicy",
      "no-referrer",
    );

    expect(referers.length).toBeGreaterThan(0);
    expect(referers.filter(Boolean)).toEqual([]);
  });

  test("a CDN that stops answering leaves letters, not twenty broken images", async ({ page }) => {
    // `route.abort` is a faithful stub *here*, which is not true of every use of
    // `page.route` in this suite — see the note in CLAUDE.md about a stub that
    // could not reproduce an incomplete-request-accounting bug. The mechanism
    // under test is the image element's own `error` event, and it fires
    // identically for an aborted request, a 404 and a 503. The 503 shape is the
    // realistic one, so it is the one driven below.
    await page.route(/crests\.football-data\.org/, (route) =>
      route.fulfill({ status: 503, body: "" }),
    );
    await page.reload();

    const cells = page.locator("table tbody tr td:nth-child(2)");
    await expect(cells).toHaveCount(20);
    // Every crest is replaced, not merely the first: the failure this covers is
    // a CDN outage, which takes all twenty at once.
    await expect(page.locator("table tbody tr td:nth-child(2) img")).toHaveCount(0);

    const marks = cells.locator("span[aria-hidden='true']").filter({ hasText: /^[A-Z]{1,3}$/ });
    await expect(marks).toHaveCount(20);
    await expect(marks.first()).toHaveText(/^[A-Z]{1,3}$/);

    // It occupies the crest's box rather than collapsing the row — the reason
    // the fallback exists at all is that the slot should not look broken.
    const box = await marks.first().boundingBox();
    expect(box?.width).toBeCloseTo(18, 0);
    expect(box?.height).toBeCloseTo(18, 0);
  });

  /**
   * Scroll the table container fully right and report how far it moved.
   * The container is the table's parent — `Surface` supplies the
   * `overflow-x-auto` box the sticky columns are pinned against.
   */
  const scrollTableRight = (page: Page) =>
    page.locator("table").evaluate((table) => {
      const container = table.parentElement as HTMLElement;
      container.scrollLeft = container.scrollWidth;
      return container.scrollLeft;
    });

  /** Narrow enough that the table must scroll. On a desktop viewport it fits
   *  the container outright, sticky positioning never engages, and an
   *  assertion about frozen columns would pass without testing anything. */
  const NARROW = { width: 380, height: 800 };

  test("the club column stays put while the numbers scroll", async ({ page }) => {
    await page.setViewportSize(NARROW);

    const cells = page.locator("table tbody tr").first().locator("td");
    const leftOf = async (nth: number) => (await cells.nth(nth).boundingBox())!.x;

    const clubBefore = await leftOf(1);
    const pointsBefore = await leftOf(2);

    expect(await scrollTableRight(page)).toBeGreaterThan(0);

    // Clube held its ground; the first number column slid away beneath it.
    expect(await leftOf(1)).toBeCloseTo(clubBefore, 0);
    expect(await leftOf(2)).toBeLessThan(pointsBefore);
  });

  test("the frozen columns stay flush against each other", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await scrollTableRight(page);

    // Once pinned, Clube sits at a hard-coded offset that has to equal the
    // width of the position column. Change one without the other and the two
    // overlap or leave a gap — unscrolled they look fine either way, because
    // ordinary table layout puts them adjacent regardless.
    const cells = page.locator("table tbody tr").first().locator("td");
    const position = (await cells.nth(0).boundingBox())!;
    const club = (await cells.nth(1).boundingBox())!;

    expect(club.x).toBeCloseTo(position.x + position.width, 0);
  });

  test("the zone rail scrolls with the club, not away from it", async ({ page }) => {
    // The G4/Z4 rail rides on the position cell rather than the row: a row
    // scrolls, so a rail drawn on it would vanish under the frozen columns.
    await page.setViewportSize(NARROW);
    await scrollTableRight(page);

    const first = page.locator("table tbody tr").first().locator("td").first();

    await expect(first).toHaveCSS("border-left-width", "2px");
    // Still inside the visible box rather than scrolled off to its left.
    const container = (await page.locator("table").locator("..").boundingBox())!;
    const rail = (await first.boundingBox())!;
    expect(rail.x).toBeGreaterThanOrEqual(container.x - 1);
  });

  test("the frozen columns leave the numbers most of a narrow screen", async ({ page }) => {
    // Clube is frozen, so its width is taken off the viewport permanently
    // rather than scrolling away — which makes it the one column that must
    // never absorb the table's `min-w` surplus. Auto layout hands surplus to
    // the widest column, and that was this one: 219px against 137px of content
    // at 360dp, leaving 59px of a 326px container for all seven data columns.
    //
    // Proportional rather than a pixel count, because the club names, the
    // crest and the font all legitimately move this number around. The
    // regression it catches is not subtle: it halves this ratio.
    await page.setViewportSize(NARROW);

    const geometry = await page.locator("table").evaluate((table) => {
      const container = table.parentElement as HTMLElement;
      const headers = [...table.querySelectorAll("thead th")];
      const frozen = headers
        .slice(0, 2)
        .reduce((total, th) => total + th.getBoundingClientRect().width, 0);
      return { frozen, available: container.clientWidth };
    });

    expect(geometry.frozen / geometry.available).toBeLessThan(0.7);
  });

  test("no club name wraps to a second line", async ({ page }) => {
    // The guard above pushes the Clube column down onto its own minimum, and a
    // table column's minimum is the widest *unbreakable* run — so without
    // `whitespace-nowrap` the browser satisfies it by breaking "Vasco da Gama"
    // and dropping the state onto a second line, taking 12 of 20 rows from
    // 37px to 57px. That reads as a *narrower* column to anything measuring
    // width alone, which is exactly how it survived being measured here once
    // already. Height is what tells the truth, so height is what is asserted.
    await page.setViewportSize(NARROW);

    const heights = await page
      .locator("table tbody tr td:nth-child(2)")
      .evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().height));

    expect(heights).toHaveLength(20);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
  });

  test("the campanha column is no wider than the mark it holds", async ({ page }) => {
    // The other half of the surplus story above. Pinning Clube to its content
    // width moves the table's surplus to the next widest column, which is this
    // one — and unlike a tally, nothing inside it grows to fill the space, so
    // the sparkline stayed 72px and the blank opened up to its right: 164px of
    // column around a 72px mark at 1280px, read as a hole between Campanha and
    // J rather than as spacing.
    //
    // Measured as the gap to the next column rather than as a column width,
    // because that is the thing a reader sees. Only the cell's own padding
    // belongs there; the regression put seven times that in.
    await page.setViewportSize({ width: 1280, height: 800 });

    const row = page.locator("table tbody tr").first();
    const mark = (await row.locator("svg").first().boundingBox())!;
    const played = (await row.locator("td").nth(4).boundingBox())!;

    expect(played.x - (mark.x + mark.width)).toBeLessThan(32);
  });

  const zoneKey = (page: Page) =>
    page.getByRole("list", { name: /legenda das zonas/i });

  test("the zone rail has a key naming both zones", async ({ page }) => {
    // The rail existed for months with nothing on the page saying what either
    // colour meant; the only explanation was a comment in the source.
    const key = zoneKey(page);

    await expect(key.getByRole("listitem")).toHaveCount(2);
    await expect(key).toContainText("G4");
    await expect(key).toContainText("Libertadores");
    await expect(key).toContainText("Z4");
    await expect(key).toContainText("Rebaixamento");
  });

  test("the key says which positions each zone covers, not just its colour", async ({ page }) => {
    // The rail is a border colour and nothing else, so hue is its only
    // channel — worthless to a red/green-colourblind reader and in any
    // grayscale capture. Naming the positions puts the same fact on the
    // position column, which every reader has. Asserted on text alone, since
    // that is precisely the half that survives without colour.
    const items = await zoneKey(page).getByRole("listitem").allInnerTexts();

    expect(items).toHaveLength(2);
    expect(items.find((item) => item.includes("G4"))).toMatch(/primeiras/i);
    expect(items.find((item) => item.includes("Z4"))).toMatch(/últimas/i);

    // Counted in from the ends rather than written as ordinals: Z4 is derived
    // from the row count, so a hard-coded "17º ao 20º" would go quietly wrong
    // if the division ever changed size. See CONTEXT.md, G4 / Z4.
    expect(items.join(" ")).not.toMatch(/\d+\s*º/);
  });

  test("the key does not scroll away with the table", async ({ page }) => {
    // The table sits in a horizontally scrolling Surface. A key placed inside
    // it slides off to the left on exactly the narrow screen where a reader
    // needs it — and looks perfect on a desktop, where the table never
    // scrolls at all.
    await page.setViewportSize(NARROW);

    const key = zoneKey(page);
    const before = (await key.boundingBox())!;

    expect(await scrollTableRight(page)).toBeGreaterThan(0);

    const after = (await key.boundingBox())!;
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.x).toBeGreaterThanOrEqual(0);
    expect(after.x + after.width).toBeLessThanOrEqual(NARROW.width + 1);
  });
});
