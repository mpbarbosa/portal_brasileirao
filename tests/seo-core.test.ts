import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canonicalPath,
  canonicalUrl,
  pageStatus,
  resolveOrigin,
  robotsTxt,
  sitemapEntries,
  sitemapXml,
  subjectResolved,
} from "@/seo-core";
import type { Club, Match } from "@/src/types";

const club = (code: string, shortName: string, slug?: string): Club => ({
  code,
  name: `${shortName} FC`,
  shortName,
  ...(slug ? { slug } : {}),
});

const CLUBS = [club("1783", "Flamengo", "flamengo"), club("1770", "Botafogo", "botafogo")];

const match = (id: string, round: number, status: Match["status"] = "SCHEDULED"): Match => ({
  id,
  round,
  kickoff: "2026-04-12T21:00:00Z",
  status,
  homeCode: "1783",
  awayCode: "1770",
  homeGoals: null,
  awayGoals: null,
});

const MATCHES = [match("554970", 1, "FINISHED"), match("554971", 2)];
const CONTEXT = { clubs: CLUBS, matches: MATCHES };

test("APP_URL wins over the request, and loses its trailing slash", () => {
  const origin = resolveOrigin("https://brasileirao.example/", {
    protocol: "http",
    host: "attacker.test",
  });

  assert.equal(origin, "https://brasileirao.example");
});

test("the request is the fallback when APP_URL is unset", () => {
  assert.equal(
    resolveOrigin(undefined, { protocol: "https", host: "brasileirao.example" }),
    "https://brasileirao.example",
  );
  assert.equal(
    resolveOrigin("  ", { protocol: "http", host: "localhost:3000" }),
    "http://localhost:3000",
  );
});

test("a Host header that is not a hostname yields no origin at all", () => {
  // The value lands in `<link rel="canonical">`, so an unvalidated header lets
  // a third party claim ownership of this site's content.
  for (const host of [
    "evil.test/path",
    "evil.test?x=1",
    "user@evil.test",
    "//evil.test",
    "",
    "-bad.test",
  ]) {
    assert.equal(resolveOrigin(undefined, { protocol: "https", host }), "", host);
  }
});

test("an unrecognised protocol degrades to http rather than being echoed", () => {
  assert.equal(
    resolveOrigin(undefined, { protocol: "javascript", host: "site.test" }),
    "http://site.test",
  );
});

test("a club published by code canonicalises to its slug", () => {
  assert.equal(canonicalPath({ section: "clube", key: "1783" }, CONTEXT), "/clube/flamengo");
  assert.equal(canonicalPath({ section: "clube", key: "flamengo" }, CONTEXT), "/clube/flamengo");
});

test("a club that resolves to nothing keeps its key rather than inventing one", () => {
  assert.equal(canonicalPath({ section: "clube", key: "nao-existe" }, CONTEXT), "/clube/nao-existe");
});

test("the table canonicalises to the root, not to /classificacao", () => {
  assert.equal(canonicalPath({ section: "classificacao" }), "/");
  assert.equal(
    canonicalUrl("https://site.test", { section: "classificacao" }),
    "https://site.test/",
  );
});

test("no origin means no canonical URL, rather than a relative one", () => {
  assert.equal(canonicalUrl("", { section: "ao-vivo" }), null);
});

test("the real sections are found", () => {
  for (const path of ["/", "/classificacao", "/ao-vivo", "/jogos", "/artilharia"]) {
    assert.deepEqual(pageStatus(path, CONTEXT), { status: 200, index: true, reason: "ok" }, path);
  }
});

test("an invented path is a 404, not a second copy of the home page", () => {
  const status = pageStatus("/qualquer-coisa", CONTEXT);

  assert.equal(status.status, 404);
  assert.equal(status.index, false);
  assert.equal(status.reason, "unknown-section");
});

test("a third segment is not a deeper page", () => {
  assert.equal(pageStatus("/jogos/24/qualquer", CONTEXT).status, 404);
});

test("a malformed percent escape is a 404, never an exception", () => {
  for (const path of ["/clube/%", "/clube/%E0%A4%A", "/jogos/%zz"]) {
    assert.deepEqual(
      pageStatus(path, CONTEXT),
      { status: 404, index: false, reason: "malformed-path" },
      path,
    );
  }
});

test("a detail section with nothing named is a 404", () => {
  assert.equal(pageStatus("/clube", CONTEXT).reason, "unnamed-detail");
  assert.equal(pageStatus("/partida", CONTEXT).reason, "unnamed-detail");
});

test("a club and a match that exist are found, by slug or by code", () => {
  assert.equal(pageStatus("/clube/flamengo", CONTEXT).status, 200);
  assert.equal(pageStatus("/clube/1783", CONTEXT).status, 200);
  assert.equal(pageStatus("/partida/554970", CONTEXT).status, 200);
});

test("a club and a match that do not exist are 404", () => {
  assert.equal(pageStatus("/clube/nao-existe", CONTEXT).reason, "unknown-club");
  assert.equal(pageStatus("/partida/999999", CONTEXT).reason, "unknown-match");
});

test("a round outside the season is a 404, a real one is not", () => {
  assert.equal(pageStatus("/jogos/2", CONTEXT).status, 200);
  assert.equal(pageStatus("/jogos/99", CONTEXT).reason, "unknown-round");
  assert.equal(pageStatus("/jogos/abc", CONTEXT).reason, "unknown-round");
  assert.equal(pageStatus("/jogos/0", CONTEXT).reason, "unknown-round");
});

test("an outage does not 404 the catalogue", () => {
  // Absent data is not proof of absence. If a provider failure turned every
  // club and fixture page into a 404, a crawler would drop the whole site over
  // an incident lasting minutes.
  assert.equal(pageStatus("/clube/nao-existe", {}).status, 200);
  assert.equal(pageStatus("/partida/999999", {}).status, 200);
  assert.equal(pageStatus("/jogos/99", {}).status, 200);
});

test("robots allows the site, disallows the API and names the sitemap", () => {
  const txt = robotsTxt("https://site.test");

  assert.match(txt, /^User-agent: \*$/m);
  assert.match(txt, /^Allow: \/$/m);
  assert.match(txt, /^Disallow: \/api\/auth\/$/m);
  assert.match(txt, /^Disallow: \/api\/account$/m);

  // The regression this guards: a blanket `Disallow: /api/` does not keep JSON
  // out of the index, it stops a client-rendered page rendering at all. It put
  // every fixture page on "Erro soft 404" in Search Console's live test.
  assert.ok(!/^Disallow: \/api\/$/m.test(txt), "the content API must stay crawlable");
  for (const endpoint of [
    "/api/matches",
    "/api/standings",
    "/api/clubs",
    "/api/scorers",
    "/api/squads",
    "/api/coaches",
    "/api/players",
  ]) {
    assert.ok(!txt.includes(`Disallow: ${endpoint}`), `${endpoint} must stay crawlable`);
  }
  assert.match(txt, /^Sitemap: https:\/\/site\.test\/sitemap\.xml$/m);
});

test("robots omits the sitemap line when there is no origin to make it absolute", () => {
  // The directive is defined as an absolute URL; a relative one is ignored,
  // which reads as a working line that does nothing.
  assert.ok(!robotsTxt("").includes("Sitemap:"));
  assert.match(robotsTxt(""), /Disallow: \/api\/auth\//);
});

test("the sitemap carries the sections even with no data loaded", () => {
  const paths = sitemapEntries({}).map((entry) => entry.path);

  assert.deepEqual(paths, [
    "/",
    "/ao-vivo",
    "/jogos",
    "/artilharia",
    "/jogadores",
    // Reachable only from /entrar and /conta, both of which are Disallowed, so
    // without this line a crawler has no route to the privacy notice at all.
    "/privacidade",
  ]);
});

test("every round, club and fixture is listed", () => {
  const paths = sitemapEntries({ ...CONTEXT, updatedAt: "2026-08-25T12:00:00Z" }).map(
    (entry) => entry.path,
  );

  // The round picker is a <select>, so these have no inbound link anywhere.
  assert.ok(paths.includes("/jogos/1"));
  assert.ok(paths.includes("/jogos/2"));
  assert.ok(paths.includes("/clube/flamengo"));
  assert.ok(paths.includes("/partida/554970"));
  assert.ok(paths.includes("/partida/554971"));
});

test("a club with no slug is listed by its code, exactly as the route resolves it", () => {
  const paths = sitemapEntries({ clubs: [club("9001", "Sem Slug")] }).map((entry) => entry.path);

  assert.ok(paths.includes("/clube/9001"));
});

test("a finished match dates itself from its kickoff, not from today", () => {
  const entries = sitemapEntries({ ...CONTEXT, updatedAt: "2026-08-25T12:00:00Z" });
  const finished = entries.find((entry) => entry.path === "/partida/554970");
  const upcoming = entries.find((entry) => entry.path === "/partida/554971");

  // Claiming today's date for a fixture played in April trains a crawler to
  // stop believing the field.
  assert.equal(finished?.lastmod, "2026-04-12");
  assert.equal(finished?.changefreq, "monthly");
  assert.equal(upcoming?.lastmod, "2026-08-25");
  assert.equal(upcoming?.changefreq, "daily");
});

test("the sitemap renders absolute locations", () => {
  const xml = sitemapXml("https://site.test", sitemapEntries(CONTEXT));

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<loc>https:\/\/site\.test\/clube\/flamengo<\/loc>/);
  assert.match(xml, /<priority>1\.0<\/priority>/);
  assert.equal((xml.match(/<loc>/g) ?? []).length, sitemapEntries(CONTEXT).length);
});

test("no origin yields a valid but empty sitemap rather than a broken one", () => {
  const xml = sitemapXml("", sitemapEntries(CONTEXT));

  assert.ok(!xml.includes("<loc>"));
  assert.match(xml, /<\/urlset>/);
});

test("XML metacharacters in a path are escaped, not emitted raw", () => {
  const xml = sitemapXml("https://site.test", [{ path: "/clube/a&b<c>" }]);

  assert.match(xml, /a&amp;b&lt;c&gt;/);
  assert.ok(!xml.includes("<c>"));
});

test("a subject is unresolved until the data that names it arrives", () => {
  // The client renders before its fetch lands. Where this is false the server's
  // tags — written with data in hand — are the better ones and must stand.
  assert.equal(subjectResolved({ section: "clube", key: "flamengo" }, {}), false);
  assert.equal(subjectResolved({ section: "clube", key: "flamengo" }, CONTEXT), true);
  assert.equal(subjectResolved({ section: "partida", id: "554970" }, {}), false);
  assert.equal(subjectResolved({ section: "partida", id: "554970" }, CONTEXT), true);
});

test("a club that will never resolve stays unresolved", () => {
  assert.equal(subjectResolved({ section: "clube", key: "nao-existe" }, CONTEXT), false);
});

test("a round needs the season's fixture list; the sections need nothing", () => {
  assert.equal(subjectResolved({ section: "jogos", round: 2 }, {}), false);
  assert.equal(subjectResolved({ section: "jogos", round: 2 }, CONTEXT), true);
  assert.equal(subjectResolved({ section: "jogos", round: null }, {}), true);
  assert.equal(subjectResolved({ section: "classificacao" }, {}), true);
  assert.equal(subjectResolved({ section: "ao-vivo" }, {}), true);
});

test("jogadores is a real section, and takes no argument", () => {
  assert.equal(pageStatus("/jogadores").status, 200);
  assert.equal(pageStatus("/jogadores").index, true);

  // The trap CLAUDE.md names: without a rule, every made-up argument under a
  // new section answers 200 with a copy of the shell — unboundedly many
  // duplicates offered to a crawler, with nothing going red.
  assert.deepEqual(pageStatus("/jogadores/flamengo"), {
    status: 404,
    index: false,
    reason: "unknown-section",
  });
});

test("the jogadores page is in the sitemap, and does not claim to change daily", () => {
  const entry = sitemapEntries({ updatedAt: "2026-08-25T12:00:00Z" }).find(
    (candidate) => candidate.path === "/jogadores",
  );

  assert.ok(entry);
  assert.equal(entry.changefreq, "weekly");
  assert.equal(entry.lastmod, "2026-08-25");
});
