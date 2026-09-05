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
  geoSource: "/var/lib/GeoIP/GeoLite2-City.mmdb",
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
      { t: t - 3_600_000, requests: 600, uniqueIps: 30, ratePerMin: null, countries: {} },
      { t, requests: latest.requests ?? 0, uniqueIps: latest.uniqueIps ?? 0, ratePerMin: 10, countries },
    ],
    latest,
  };
};

const serve = async (page: Page, latest: TrafficSnapshot) => {
  const body = JSON.stringify({
    source: "local",
    note: "Um instantâneo do log de acesso da produção.",
    updatedAt: latest.generated,
    data: dashboard(latest),
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
test("without a GeoLite2 database the page carries no country or city panels", async ({
  page,
}) => {
  await serve(page, BASE);
  await page.goto("/trafego");

  await expect(page.getByRole("heading", { name: "Páginas mais pedidas" })).toBeVisible();

  await expect(page.getByRole("heading", { name: /^Países por/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /^Cidades por/ })).toHaveCount(0);

  await expect(page.getByText(/Sem base GeoLite2 no servidor/)).toBeVisible();
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
