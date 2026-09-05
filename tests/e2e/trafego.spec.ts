import { expect, test, type Page } from "@/tests/e2e/fixtures";
import type { TrafficDashboard, TrafficSnapshot } from "@/src/types";

/**
 * The Tráfego page's geo sections, which are the only part of it that can be
 * absent while everything around it is full.
 *
 * **A dev checkout has no snapshots at all** — `$DEPLOY_DIR/traffic-reports/`
 * is written on the host by `12_traffic_report.sh`, and nothing commits one —
 * so the page these specs need cannot be reached by navigating to it. The
 * payload is therefore prepared here and fulfilled from memory, which is also
 * the only way to hold the two geo states side by side: a host either has a
 * GeoLite2 database or it does not, and no fixture directory gives you both.
 *
 * Fulfilled from memory rather than proxied with `route.fetch()`, for the
 * reason `goals.spec.ts` records: the proxying form flakes under the suite's
 * workers and passes in isolation.
 */

const BASE: TrafficSnapshot = {
  file: "summary-20260905-180759.txt",
  generated: "2026-09-05T18:07:59+00:00",
  logLines: 1200,
  requests: 1200,
  uniqueIps: 48,
  dateRange: "01/Sep/2026:00:02:08  ->  05/Sep/2026:23:55:48",
  geoSource: null,
  geoAttribution: null,
  topPaths: [{ label: "/", count: 187 }],
  statusCodes: [{ label: "200", count: 1200 }],
  referrers: [{ label: "https://brasileirao.mpbarbosa.com/", count: 411 }],
  countriesByVisitor: [],
  countriesByVolume: [],
  citiesByVisitor: [],
  citiesByVolume: [],
  byHour: { "00": 46, "01": 58 },
  byDay: [{ label: "01/Sep/2026", count: 254 }],
  uniqueIpsByDay: [{ label: "01/Sep/2026", count: 48 }],
  bots: 0,
  monitorHits: 180,
};

/** A host carrying a GeoLite2 **City** database: countries *and* cities. */
const WITH_GEO: TrafficSnapshot = {
  ...BASE,
  geoSource: "/var/lib/GeoIP/dbip-city-lite.mmdb",
  geoAttribution: "IP Geolocation by DB-IP (https://db-ip.com), CC BY 4.0",
  countriesByVisitor: [
    { label: "Brazil", count: 40 },
    { label: "United States", count: 5 },
  ],
  countriesByVolume: [
    { label: "Brazil", count: 988 },
    { label: "United States", count: 134 },
  ],
  citiesByVisitor: [{ label: "Curitiba, Brazil", count: 15 }],
  citiesByVolume: [{ label: "Curitiba, Brazil", count: 389 }],
};

/**
 * Two snapshots, because one is a degenerate timeline: the rate is the
 * difference between consecutive readings, so a single point draws neither
 * line and the panels above the geo block render their own empty states.
 * Typed as `TrafficDashboard` rather than assembled loosely — a timeline point
 * missing `t` yields `NaN` coordinates and a React console error, which is
 * what the first draft of this fixture did.
 */
const dashboard = (latest: TrafficSnapshot): TrafficDashboard => {
  const t = Date.parse(latest.generated);
  const countries = Object.fromEntries(latest.countriesByVolume.map((r) => [r.label, r.count]));
  return {
    snapshotCount: 2,
    windowRatePerMin: 20,
    timeline: [
      {
        t: t - 3_600_000,
        requests: 600,
        uniqueIps: 30,
        ratePerMin: null,
        readRatePerMin: null,
        countries: {},
      },
      {
        t,
        requests: latest.requests ?? 0,
        uniqueIps: latest.uniqueIps ?? 0,
        ratePerMin: 10,
        // Deliberately below the total: the gap between the two lines is the
        // monitoring, and equal values would draw one line over the other and
        // pass every assertion about "two paths exist".
        readRatePerMin: 7,
        countries,
      },
    ],
    latest,
  };
};

const serve = async (
  page: Page,
  latest: TrafficSnapshot,
  /** Mutate the built payload before it is served — for the timeline states no
   *  snapshot shape can express on its own. */
  amend: (data: TrafficDashboard) => TrafficDashboard = (data) => data,
) => {
  const body = JSON.stringify({
    source: "local",
    note: "Um instantâneo do log de acesso da produção.",
    updatedAt: latest.generated,
    data: amend(dashboard(latest)),
  });
  await page.route("**/api/traffic-dashboard*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body }),
  );
};

/**
 * The bug this exists for: without a GeoLite2 database the two country panels
 * rendered anyway, each reading "Sem dados." — reporting an absence of
 * *visitors* where the truth is an absence of a *lookup table*. Production ran
 * that way from the day the timer was installed, with the rodapé beneath the
 * cards saying "não há seções de país nem de cidade" while both were on screen.
 *
 * Asserted as **absent panels** rather than as an absent string, because
 * "Sem dados." is the shared empty state of every panel on the page: an
 * assertion that no such text exists anywhere would go red the first time some
 * unrelated section had no rows, and one that counts them would pass against a
 * single card carrying it.
 */
test("without a geolocation database the page carries no country or city panels", async ({
  page,
}) => {
  await serve(page, BASE);
  await page.goto("/trafego");

  await expect(page.getByRole("heading", { name: "Páginas mais pedidas" })).toBeVisible();

  await expect(page.getByRole("heading", { name: /^Países por/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /^Cidades por/ })).toHaveCount(0);

  // Matched on the stable half of the sentence rather than on all of it: the
  // wording names the script an operator runs, and pinning that would make a
  // renamed script a red spec about copy.
  await expect(page.getByText(/Sem base de geolocalização no servidor/)).toBeVisible();
});

test("with a City database both the country and the city panels render their rows", async ({
  page,
}) => {
  await serve(page, WITH_GEO);
  await page.goto("/trafego");

  await expect(page.getByRole("heading", { name: "Países por endereço" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Países por volume" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cidades por endereço" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cidades por volume" })).toBeVisible();

  // Scoped to the panel's own list, not to the page: the "Ritmo de requisições"
  // filter is a <select> whose options carry every country name, so a bare
  // getByText("Brazil") resolves to a hidden <option> first and reports the
  // rows as invisible while they are on screen.
  const porEndereco = page.locator("li", { hasText: "Brazil" });
  await expect(porEndereco.first()).toBeVisible();
  await expect(page.getByText(/Geolocalização por base local/)).toBeVisible();
});

/**
 * The credit is what the licence charges for the data, so it is asserted like
 * the stadium photographs' is: present whenever the rows it belongs to are.
 * A page that dropped it while still drawing the countries would be using
 * DB-IP's database outside the terms it is offered under.
 */
test("the geo credit renders beside the sections it pays for", async ({ page }) => {
  await serve(page, WITH_GEO);
  await page.goto("/trafego");

  await expect(page.getByRole("heading", { name: "Países por endereço" })).toBeVisible();
  await expect(page.getByText(/IP Geolocation by DB-IP/)).toBeVisible();
});

/**
 * A database whose terms the report does not recognise gets no credit line, and
 * that is not the same as "no credit is owed" — it is the report declining to
 * state terms it does not know. The sections still draw; nothing is invented.
 */
test("an unrecognised database draws its rows and invents no credit", async ({ page }) => {
  await serve(page, { ...WITH_GEO, geoAttribution: null });
  await page.goto("/trafego");

  await expect(page.getByRole("heading", { name: "Países por endereço" })).toBeVisible();
  await expect(page.getByText(/IP Geolocation by DB-IP/)).toHaveCount(0);
  await expect(page.getByText(/Geolocalização por base local/)).toBeVisible();
});

/**
 * A country-level database is the middle case, and it is the one a rule reading
 * "draw the geo block when `geoSource` is set" would get wrong: countries
 * resolve, cities do not, and the two panels are gated independently for that
 * reason.
 */
test("a country-level database draws the countries and still omits the cities", async ({
  page,
}) => {
  await serve(page, {
    ...WITH_GEO,
    geoSource: "/var/lib/GeoIP/GeoLite2-Country.mmdb",
    citiesByVisitor: [],
    citiesByVolume: [],
  });
  await page.goto("/trafego");

  await expect(page.getByRole("heading", { name: "Países por endereço" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Cidades por/ })).toHaveCount(0);
});


/**
 * The rate chart's two series.
 *
 * **The bug: the headline line counted `/api/health`.** Measured on production
 * 2026-09-05, monitoring was `26899` of `48513` requests — 55% — so "Ritmo de
 * requisições" was majority machine, while "Páginas mais pedidas" directly
 * beneath it had already filtered exactly that traffic out of its ranking. One
 * page answering *how much of this was people* two ways.
 *
 * Asserted through the **key**, not by counting `<path>` elements. The svg
 * gains decorations — it already carries the end-of-series circle — and a
 * count is the assertion that has to be loosened every time one arrives, which
 * is the lesson `data-scatter-point` records on the Painel. The key is what a
 * reader actually uses to tell the two strokes apart, so it is the thing worth
 * pinning.
 */
test("unfiltered, the rate chart names both the read series and the total", async ({ page }) => {
  await serve(page, BASE);
  await page.goto("/trafego");

  const panel = page.locator("section").filter({ hasText: "Ritmo de requisições" }).last();
  await expect(panel.getByText("Leitura, sem /api/health")).toBeVisible();
  await expect(panel.getByText("Total", { exact: true })).toBeVisible();

  // The caption has to say what the gap between the strokes means, or a dashed
  // line is a second stroke with no stated meaning.
  await expect(panel.getByText(/distância entre as duas linhas é o monitoramento/)).toBeVisible();
});

/**
 * A country gets **one** line, and the key says it includes monitoring.
 *
 * Not an omission: the report's geo sections tally every line by address, so
 * there is no per-country monitor figure to subtract. Subtracting the global
 * one would attribute every poll to whichever country happened to be selected
 * — a wrong number that looks exactly like a right one, which is why the page
 * states the quantity rather than quietly drawing a second line.
 */
test("a country draws one line and says it still counts monitoring", async ({ page }) => {
  const countries = { Brazil: 400, "United States": 60 };
  await serve(page, WITH_GEO, (data) => ({
    ...data,
    // Both endpoints must name the country or there is no pair to difference —
    // which is the *other* case, asserted below.
    timeline: data.timeline.map((point, i) => ({
      ...point,
      countries: i === 0 ? countries : { Brazil: 988, "United States": 134 },
    })),
  }));
  await page.goto("/trafego");

  const panel = page.locator("section").filter({ hasText: "Ritmo de requisições" }).last();
  await panel.getByLabel("País").selectOption("Brazil");

  await expect(panel.getByText("Total — Brazil, monitoramento incluído")).toBeVisible();
  await expect(panel.getByText("Leitura, sem /api/health")).toHaveCount(0);
  await expect(panel.getByText(/não separa \/api\/health/)).toBeVisible();
});

/**
 * The empty state has to give the **reason**, and this is the state production
 * was in the day the geolocation database landed: 41 of 42 summaries predated
 * it, so every country selection drew an empty box under the default caption
 * "Ainda não há instantâneos suficientes para desenhar uma linha" — blaming the
 * timer for a filter's own consequence, on a page whose other panels were full.
 *
 * It self-clears as snapshots accrue, which is exactly why it needed writing
 * down rather than waiting out: the wrong sentence is only on screen while
 * nobody is looking for it.
 */
test("a country no pair of snapshots names explains itself, and does not blame the timer", async ({
  page,
}) => {
  // `dashboard()` gives the first point `countries: {}` — a snapshot from
  // before the geo database, which is the shape that produced this.
  await serve(page, WITH_GEO);
  await page.goto("/trafego");

  const panel = page.locator("section").filter({ hasText: "Ritmo de requisições" }).last();
  await panel.getByLabel("País").selectOption("Brazil");

  await expect(panel.getByText(/Nenhum par de instantâneos consecutivos nomeia Brazil/)).toBeVisible();
  await expect(panel.getByText(/instantâneos suficientes para desenhar uma linha/)).toHaveCount(0);
});


/**
 * **The two series need not cover the same snapshots, and the x domain has to
 * be the union of both.**
 *
 * `readRatePerMin` is null wherever a summary carries no monitor figure and
 * `ratePerMin` is not, so the read line can begin *later* than the total. A
 * domain taken from the primary alone then maps the total's earlier points to
 * a large negative x.
 *
 * **The symptom is not the one to reach for, which is why the first version of
 * this spec passed against the bug.** `RankCandles`' failure was painting
 * outside the card, so the obvious assertion is a bounding box against the
 * panel — and it is vacuous here: a root `<svg>` in HTML gets
 * `overflow: hidden` by default, this one does not opt out of it, and the
 * layout box of the element is decided by CSS whatever the path coordinates
 * are. Confirmed by mutation: with the domain reverted to the primary alone,
 * all 18 specs passed.
 *
 * So it is measured where it happens — `getBBox()` on each path, in the
 * drawing's own user units, against the viewBox. Measured against the mutation
 * rather than predicted: with the primary-only domain the context path's box
 * starts at **x = -2548800000**, in a viewBox 720 wide.
 */
test("with the two series over different spans, both stay inside the viewBox", async ({
  page,
}) => {
  const t = Date.parse(BASE.generated);
  await serve(page, BASE, (data) => ({
    ...data,
    timeline: [
      // Two early points the total covers and the read series cannot.
      { t: t - 7_200_000, requests: 300, uniqueIps: 20, ratePerMin: null, readRatePerMin: null, countries: {} },
      { t: t - 3_600_000, requests: 900, uniqueIps: 30, ratePerMin: 10, readRatePerMin: null, countries: {} },
      { t, requests: 1200, uniqueIps: 48, ratePerMin: 5, readRatePerMin: 4, countries: {} },
    ],
  }));
  await page.goto("/trafego");

  const panel = page
    .getByRole("heading", { name: "Ritmo de requisições" })
    .locator('xpath=ancestor::div[contains(@class,"px-4")][1]');
  const svg = panel.locator("svg[role='img']");
  await expect(svg).toBeVisible();

  // Both strokes are present, or the geometry below is about one line and
  // passes for the wrong reason.
  await expect(svg.locator("path")).toHaveCount(2);

  const boxes = await svg.evaluate((node) =>
    Array.from(node.querySelectorAll("path")).map((path) => {
      const b = (path as SVGGraphicsElement).getBBox();
      return { x: b.x, right: b.x + b.width };
    }),
  );
  for (const b of boxes) {
    expect(b.x).toBeGreaterThanOrEqual(-1);
    expect(b.right).toBeLessThanOrEqual(721);
  }
});
