import { expect, test } from "@/tests/e2e/clock";

/**
 * The crawl surface: the two documents a robot fetches before anything else,
 * the canonical address of each page, and the structured data that lets a
 * fixture page be read as a fixture rather than as prose about one.
 *
 * Nothing here asserts a scoreline, a round number or how many fixtures exist —
 * the suite runs against the frozen snapshot, which ages. Shape, not value.
 * The origin is not asserted either: `APP_URL` is set on a deployed host and
 * unset in CI, where it is derived from the request instead, so these check
 * that a URL is absolute and ends where it should.
 */

const canonical = (page: import("@playwright/test").Page) =>
  page.locator('link[rel="canonical"]').getAttribute("href");

test.describe("robots.txt", () => {
  test("is served as plain text and blocks only the per-session API routes", async ({ request }) => {
    const response = await request.get("/robots.txt");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");

    const body = await response.text();
    expect(body).toMatch(/^User-agent: \*$/m);
    expect(body).toMatch(/^Disallow: \/api\/auth\/$/m);
    expect(body).toMatch(/^Disallow: \/api\/account$/m);

    // A blanket /api/ disallow is what made every client-rendered page a soft
    // 404 to Googlebot: it could not fetch the payloads the page is built from.
    expect(body).not.toMatch(/^Disallow: \/api\/$/m);
  });

  test("the content API is fetchable but carries noindex, and the page it renders does not", async ({
    page,
    request,
  }) => {
    // The two halves of the fix, asserted together because either alone is the
    // bug: crawlable-and-indexable puts JSON in the index, blocked-and-noindex
    // is where this started.
    const payload = await request.get("/api/matches");
    expect(payload.status()).toBe(200);
    expect(payload.headers()["x-robots-tag"]).toContain("noindex");

    // A subresource header must not reach the document that loaded it.
    const rendered = await page.goto("/jogos");
    expect(rendered?.headers()["x-robots-tag"]).toBeUndefined();
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test("points at the sitemap with an absolute URL", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();

    expect(body).toMatch(/^Sitemap: https?:\/\/[^\s]+\/sitemap\.xml$/m);
  });
});

test.describe("sitemap.xml", () => {
  test("is served as XML and lists every section", async ({ request }) => {
    const response = await request.get("/sitemap.xml");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");

    const body = await response.text();
    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    for (const path of ["/", "/ao-vivo", "/jogos", "/artilharia"]) {
      expect(body).toContain(`${path}</loc>`);
    }
  });

  test("reaches the pages nothing links to", async ({ request }) => {
    // The round picker is a <select>, so rounds other than the current one —
    // and with them nearly every fixture page — have no inbound link at all.
    // This file is how a crawler finds them.
    const body = await (await request.get("/sitemap.xml")).text();

    expect((body.match(/<loc>/g) ?? []).length).toBeGreaterThan(100);
    expect(body).toMatch(/<loc>https?:\/\/[^<]+\/clube\/[a-z-]+<\/loc>/);
    expect(body).toMatch(/<loc>https?:\/\/[^<]+\/partida\/\d+<\/loc>/);
    expect(body).toMatch(/<loc>https?:\/\/[^<]+\/jogos\/\d+<\/loc>/);
  });
});

test.describe("Canônico", () => {
  test("the table canonicalises to the root", async ({ page }) => {
    await page.goto("/");

    expect(await canonical(page)).toMatch(/^https?:\/\/[^/]+\/$/);
  });

  test("a club reached by code canonicalises to its slug", async ({ page, request }) => {
    // /clube/1783 was publishable before slugs existed and still resolves; it
    // is the same page as /clube/flamengo and only one should be indexed.
    const body = await (await request.get("/api/clubs")).json();
    const club = body.data.find((entry: { slug?: string }) => entry.slug);

    await page.goto(`/clube/${club.code}`);

    expect(await canonical(page)).toMatch(new RegExp(`^https?://[^/]+/clube/${club.slug}$`));
  });

  test("an in-app navigation moves the canonical with it", async ({ page }) => {
    // The server's tag describes the page the reader arrived on. Left alone it
    // would keep claiming the entry page owns every later one.
    await page.goto("/");
    await page.getByRole("link", { name: /^Artilharia/ }).click();

    await expect(page).toHaveURL(/\/artilharia$/);
    await expect
      .poll(() => canonical(page))
      .toMatch(/^https?:\/\/[^/]+\/artilharia$/);
  });
});

test.describe("Dados estruturados", () => {
  test("a fixture page describes itself as a SportsEvent", async ({ page, request }) => {
    const body = await (await request.get("/api/matches")).json();
    const match = body.data.matches[0];

    await page.goto(`/partida/${match.id}`);

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const parsed = blocks.map((block) => JSON.parse(block));

    const event = parsed.find((block) => block["@type"] === "SportsEvent");
    expect(event).toBeTruthy();
    expect(event.startDate).toBe(match.kickoff);
    expect(event.name).toMatch(/ x /);
    expect(event.url).toMatch(new RegExp(`/partida/${match.id}$`));

    const crumbs = parsed.find((block) => block["@type"] === "BreadcrumbList");
    expect(crumbs.itemListElement.length).toBeGreaterThan(1);
  });

  test("a club page describes itself as a SportsTeam", async ({ page, request }) => {
    const body = await (await request.get("/api/clubs")).json();
    const club = body.data.find((entry: { slug?: string }) => entry.slug);

    await page.goto(`/clube/${club.slug}`);

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const team = blocks.map((block) => JSON.parse(block)).find((b) => b["@type"] === "SportsTeam");

    expect(team.name).toBe(club.name);
    expect(team.memberOf.name).toMatch(/Série A/);
  });

  test("the table describes the site", async ({ page }) => {
    await page.goto("/");

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const site = blocks.map((block) => JSON.parse(block)).find((b) => b["@type"] === "WebSite");

    expect(site.inLanguage).toBe("pt-BR");
  });
});

test.describe("Páginas que não existem", () => {
  test("a club that does not exist is a 404, and says noindex", async ({ page }) => {
    const response = await page.goto("/clube/clube-que-nao-existe");

    expect(response?.status()).toBe(404);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  });

  test("a fixture that does not exist is a 404", async ({ page }) => {
    expect((await page.goto("/partida/000000"))?.status()).toBe(404);
  });

  test("a round outside the season is a 404, a real one is not", async ({ page }) => {
    expect((await page.goto("/jogos/999"))?.status()).toBe(404);
    expect((await page.goto("/jogos/1"))?.status()).toBe(200);
  });

  test("a malformed escape is a 404 rather than a server error", async ({ page }) => {
    // Express decodes the catch-all's wildcard parameter while matching, so a
    // malformed escape throws inside the router and answered its own 400 error
    // page before any handler ran. A crawler will eventually send one.
    const response = await page.goto("/clube/%E0%A4%A");

    expect(response?.status()).toBe(404);
    expect(await response?.text()).toContain("Portal Brasileirão");
  });

  test("a real page carries no robots tag at all", async ({ page }) => {
    await page.goto("/artilharia");

    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test("a 404 page still serves the app, not an error page", async ({ page }) => {
    await page.goto("/rota-que-nao-existe");

    await expect(page.locator("table tbody tr")).toHaveCount(20);
  });
});

test.describe("Prévia de link", () => {
  test("the card the tags point at is actually served", async ({ page, request }) => {
    // The real integration risk: og-default.png lives in public/, which Vite
    // copies to dist/ at build time. A tag naming a 404 is a blank preview.
    await page.goto("/");
    const src = await page.locator('meta[property="og:image"]').getAttribute("content");

    expect(src).toMatch(/^https?:\/\/[^/]+\/og-default\.png$/);

    const image = await request.get(new URL(src!).pathname);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
  });

  test("a section declares the wide card with the dimensions to lay it out", async ({ page }) => {
    await page.goto("/artilharia");

    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "pt_BR");
  });

  test("a club page uses its crest, and the square card that suits it", async ({ page, request }) => {
    const body = await (await request.get("/api/clubs")).json();
    const club = body.data.find((entry: { slug?: string; crest?: string }) => entry.slug && entry.crest);

    await page.goto(`/clube/${club.slug}`);

    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", club.crest);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary");
  });

  test("a fixture is illustrated by the site, not by one of the two clubs", async ({ page, request }) => {
    const body = await (await request.get("/api/matches")).json();
    const match = body.data.matches[0];

    await page.goto(`/partida/${match.id}`);

    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /\/og-default\.png$/,
    );
  });
});

test.describe("Verificação do Search Console", () => {
  /**
   * Google's own instruction is "do not remove the file, even after successful
   * verification" — it re-checks periodically and silently unverifies the
   * property when the file stops answering. Nothing else in the suite would
   * notice a tidy-up of `public/` taking it, and the failure surfaces weeks
   * later as vanished Search Console data rather than as a broken page.
   */
  const VERIFICATION_FILE = "/google33bb6c442ef9ed29.html";

  test("the verification file is still served", async ({ request }) => {
    const response = await request.get(VERIFICATION_FILE);

    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("google-site-verification:");
  });

  test("it is served as a file, not swallowed by the SPA fallback", async ({ request }) => {
    // express.static runs before the catch-all, so a real file in dist/ never
    // reaches `pageStatus` — which would 404 it, since it names no section.
    const body = await (await request.get(VERIFICATION_FILE)).text();

    expect(body).not.toContain("<div id=\"root\">");
  });
});
