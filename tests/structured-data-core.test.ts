import assert from "node:assert/strict";
import { test } from "node:test";

import { COMPETITION, jsonLdScript, structuredData, teamNode } from "@/structured-data-core";
import type { Club, Match } from "@/src/types";

const ORIGIN = "https://site.test";

const FLAMENGO: Club = {
  code: "1783",
  name: "Clube de Regatas do Flamengo",
  shortName: "Flamengo",
  tla: "FLA",
  slug: "flamengo",
  crest: "https://crests.football-data.org/1783.png",
  website: "https://www.flamengo.com.br/",
  instagram: "flamengo",
  wikipedia: "Clube de Regatas do Flamengo",
};

const BOTAFOGO: Club = {
  code: "1770",
  name: "Botafogo FR",
  shortName: "Botafogo",
  slug: "botafogo",
};

const CLUBS = [FLAMENGO, BOTAFOGO];

const MATCH: Match = {
  id: "554970",
  round: 24,
  kickoff: "2026-08-24T23:00:00Z",
  status: "SCHEDULED",
  homeCode: "1783",
  awayCode: "1770",
  homeGoals: null,
  awayGoals: null,
  venue: { stadium: "Maracanã", city: "Rio de Janeiro", state: "RJ" },
};

const CONTEXT = { clubs: CLUBS, matches: [MATCH] };

const ofType = (blocks: ReturnType<typeof structuredData>, type: string) =>
  blocks.find((block) => block["@type"] === type);

test("the table describes the site itself", () => {
  const website = ofType(structuredData({ section: "classificacao" }, {}, ORIGIN), "WebSite");

  assert.equal(website?.name, "Portal Brasileirão");
  assert.equal(website?.url, `${ORIGIN}/`);
  assert.equal(website?.inLanguage, "pt-BR");
  assert.equal(website?.["@context"], "https://schema.org");
});

test("a club is a SportsTeam, addressed by its slug", () => {
  const team = ofType(structuredData({ section: "clube", key: "1783" }, CONTEXT, ORIGIN), "SportsTeam");

  assert.equal(team?.name, "Clube de Regatas do Flamengo");
  assert.equal(team?.alternateName, "Flamengo");
  // Reached by code, described at the canonical address.
  assert.equal(team?.url, `${ORIGIN}/clube/flamengo`);
  assert.equal(team?.logo, "https://crests.football-data.org/1783.png");
  assert.deepEqual(team?.memberOf, { "@type": "SportsOrganization", name: COMPETITION });
});

test("the addresses that identify the club are linked as sameAs", () => {
  // Own addresses first, then the third-party reference. The Wikipedia article
  // is schema.org's own example of the property, and the one a parser is most
  // likely to already hold a node for.
  const team = teamNode(FLAMENGO, ORIGIN, false);

  assert.deepEqual(team.sameAs, [
    "https://www.flamengo.com.br/",
    "https://www.instagram.com/flamengo/",
    "https://pt.wikipedia.org/wiki/Clube_de_Regatas_do_Flamengo",
  ]);
});

test("the hymn is not a sameAs, however it looks in the header", () => {
  // It sits beside the other three links on the club page, which is exactly why
  // this is worth pinning: a recording about the club is not an address that
  // identifies it, and asserting otherwise claims the club *is* the video.
  const team = teamNode({ ...FLAMENGO, hymn: "gESWI9ZlXzo" }, ORIGIN, false);

  assert.equal((team.sameAs as string[]).some((entry) => entry.includes("youtube")), false);
});

test("fields the club does not have are omitted, never emitted empty", () => {
  // A parser reads null and "" as assertions, not as absences.
  const team = teamNode(BOTAFOGO, ORIGIN, false);

  assert.ok(!("logo" in team));
  assert.ok(!("sameAs" in team));
  assert.equal(team.name, "Botafogo FR");
});

test("a match is a SportsEvent with a kickoff, a venue and both clubs", () => {
  const event = ofType(
    structuredData({ section: "partida", id: "554970" }, CONTEXT, ORIGIN),
    "SportsEvent",
  );

  assert.equal(event?.name, "Flamengo x Botafogo");
  assert.equal(event?.startDate, "2026-08-24T23:00:00Z");
  assert.equal(event?.url, `${ORIGIN}/partida/554970`);
  assert.equal(event?.eventAttendanceMode, "https://schema.org/OfflineEventAttendanceMode");
  assert.deepEqual(event?.location, {
    "@type": "Place",
    name: "Maracanã",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Rio de Janeiro",
      addressRegion: "RJ",
      addressCountry: "BR",
    },
  });
  assert.equal((event?.homeTeam as Record<string, unknown>).name, "Clube de Regatas do Flamengo");
  assert.equal((event?.awayTeam as Record<string, unknown>).name, "Botafogo FR");
});

test("a match with no known venue omits the location rather than inventing one", () => {
  const { venue: _venue, ...noVenue } = MATCH;
  const event = ofType(
    structuredData({ section: "partida", id: "554970" }, { clubs: CLUBS, matches: [noVenue] }, ORIGIN),
    "SportsEvent",
  );

  assert.ok(event);
  assert.ok(!("location" in event));
});

test("only the fixtures that did not go ahead get a status of their own", () => {
  // schema.org describes whether an event happened as announced; it has no
  // "in progress" and no "finished", so LIVE and FINISHED are both scheduled.
  const statusOf = (status: Match["status"]) =>
    ofType(
      structuredData(
        { section: "partida", id: "554970" },
        { clubs: CLUBS, matches: [{ ...MATCH, status }] },
        ORIGIN,
      ),
      "SportsEvent",
    )?.eventStatus;

  assert.equal(statusOf("SCHEDULED"), "https://schema.org/EventScheduled");
  assert.equal(statusOf("LIVE"), "https://schema.org/EventScheduled");
  assert.equal(statusOf("FINISHED"), "https://schema.org/EventScheduled");
  assert.equal(statusOf("POSTPONED"), "https://schema.org/EventPostponed");
  assert.equal(statusOf("CANCELLED"), "https://schema.org/EventCancelled");
});

test("a subject that has not loaded gets breadcrumbs and no empty assertion", () => {
  const blocks = structuredData({ section: "partida", id: "554970" }, {}, ORIGIN);

  assert.equal(ofType(blocks, "SportsEvent"), undefined);
  assert.ok(ofType(blocks, "BreadcrumbList"));
});

test("a fixture's breadcrumbs climb through its own round", () => {
  const crumbs = ofType(
    structuredData({ section: "partida", id: "554970" }, CONTEXT, ORIGIN),
    "BreadcrumbList",
  );
  const trail = crumbs?.itemListElement as Array<Record<string, unknown>>;

  assert.deepEqual(
    trail.map((step) => step.name),
    ["Classificação", "Jogos", "24ª rodada", "Flamengo x Botafogo"],
  );
  assert.equal(trail[2].item, `${ORIGIN}/jogos/24`);
  assert.deepEqual(
    trail.map((step) => step.position),
    [1, 2, 3, 4],
  );
});

test("the table gets no breadcrumb trail of one", () => {
  const blocks = structuredData({ section: "classificacao" }, {}, ORIGIN);

  assert.equal(ofType(blocks, "BreadcrumbList"), undefined);
});

test("breadcrumbs are omitted when there is no origin to address them with", () => {
  // A breadcrumb with no URL is a label, not a link.
  assert.equal(ofType(structuredData({ section: "artilharia" }, {}, ""), "BreadcrumbList"), undefined);
});

test("a script tag is emitted per block, typed as ld+json", () => {
  const html = jsonLdScript(structuredData({ section: "partida", id: "554970" }, CONTEXT, ORIGIN));

  assert.equal((html.match(/<script type="application\/ld\+json">/g) ?? []).length, 2);
});

test("markup in a club name cannot close the script tag", () => {
  const hostile: Club = { ...FLAMENGO, name: 'Flamengo</script><img src=x onerror=alert(1)>' };
  const html = jsonLdScript([teamNode(hostile, ORIGIN, false)]);

  assert.ok(!html.includes("</script><img"));
  assert.match(html, /\\u003c\/script\\u003e/);
  // One opening and one closing tag, and the closing one is ours.
  assert.equal((html.match(/<\/script>/g) ?? []).length, 1);
});

test("the escaped payload is still valid JSON", () => {
  const hostile: Club = { ...FLAMENGO, name: "Fla & <b>mengo</b>" };
  const html = jsonLdScript([teamNode(hostile, ORIGIN, false)]);
  const json = html.replace(/^<script type="application\/ld\+json">/, "").replace(/<\/script>$/, "");

  assert.equal((JSON.parse(json) as { name: string }).name, "Fla & <b>mengo</b>");
});

test("jogadores gets its own breadcrumb trail", () => {
  const blocks = structuredData({ section: "jogadores" }, {}, "https://exemplo.test");
  const crumbs = blocks.find((block) => block["@type"] === "BreadcrumbList") as
    | { itemListElement: Array<{ name: string; item: string }> }
    | undefined;

  assert.ok(crumbs);
  assert.deepEqual(
    crumbs.itemListElement.map((entry) => entry.name),
    ["Classificação", "Jogadores"],
  );
  assert.equal(crumbs.itemListElement[1].item, "https://exemplo.test/jogadores");
});
