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

test("a fixture emits exactly one Event, because an incomplete one is rejected", () => {
  // The node dropped here was `{"@type": "SportsEvent", name: COMPETITION}` as
  // `superEvent`. Google validates a nested Event *as an Event*, so a name on
  // its own reported two critical errors — no `startDate`, no `location` —
  // against a fixture item that was itself valid, on all 380 fixture pages.
  // Nothing is compiler-enforced here, so this test is the decision.
  const blocks = structuredData({ section: "partida", id: "554970" }, CONTEXT, ORIGIN);
  const events = blocks.filter((block) => String(block["@type"]).endsWith("Event"));

  assert.equal(events.length, 1);
  assert.ok(!("superEvent" in events[0]));
  // …and the one that remains carries every field Google requires of an Event.
  for (const field of ["name", "startDate", "location"]) assert.ok(field in events[0]);
  assert.ok("address" in (events[0].location as Record<string, unknown>));
});

test("the competition survives the drop, on the entities that are members of it", () => {
  // Dropping `superEvent` must not lose the league. It is stated by both
  // clubs — which really are members — rather than by the event.
  const event = ofType(
    structuredData({ section: "partida", id: "554970" }, CONTEXT, ORIGIN),
    "SportsEvent",
  ) as { homeTeam: { memberOf: unknown }; awayTeam: { memberOf: unknown } };

  const competition = { "@type": "SportsOrganization", name: COMPETITION };
  assert.deepEqual(event.homeTeam.memberOf, competition);
  assert.deepEqual(event.awayTeam.memberOf, competition);
});

test("the organizer is an Organization, never an Event", () => {
  // The whole point of preferring it to a completed `superEvent`: it answers a
  // recommended field without adding a second item that requires a startDate
  // and a location to be valid.
  const event = ofType(
    structuredData({ section: "partida", id: "554970" }, CONTEXT, ORIGIN),
    "SportsEvent",
  ) as { organizer: Record<string, unknown> };

  assert.equal(event.organizer["@type"], "SportsOrganization");
  assert.equal(event.organizer.name, "Confederação Brasileira de Futebol");
  assert.ok(!String(event.organizer["@type"]).endsWith("Event"));
});

test("the event's image is the one the page already chose, and is omitted when absent", () => {
  const withImage = ofType(
    structuredData(
      { section: "partida", id: "554970" },
      CONTEXT,
      ORIGIN,
      "uma descrição",
      `${ORIGIN}/og-default.png`,
    ),
    "SportsEvent",
  );
  assert.equal(withImage?.image, `${ORIGIN}/og-default.png`);

  // Passed in rather than rebuilt, so a caller that has no image asserts none.
  const without = ofType(
    structuredData({ section: "partida", id: "554970" }, CONTEXT, ORIGIN),
    "SportsEvent",
  );
  assert.ok(!("image" in (without ?? {})));
});

test("endDate, offers and performer stay absent, and each is a decision", () => {
  // Recommended by Google and deliberately not emitted: no source reports a
  // final whistle and stoppage time is unbounded; this app sells nothing and
  // holds no ticket address; and the performers are the two clubs, which
  // homeTeam and awayTeam already name. If a source for one of these ever
  // arrives, delete its line here — do not guess a value to quiet a warning.
  const event = ofType(
    structuredData({ section: "partida", id: "554970" }, CONTEXT, ORIGIN),
    "SportsEvent",
  ) as Record<string, unknown>;

  assert.ok(!("endDate" in event));
  assert.ok(!("offers" in event));
  assert.ok(!("performer" in event));
});

test("/trafego's breadcrumb stops at the site root", () => {
  // The case exists because the compiler requires it — `trailFor` returns a
  // value, so a missing case makes the switch non-exhaustive, which is what
  // makes this the one file of the four that cannot be forgotten. Its content
  // is beside the point: no crawler may index the page, so the trail describes
  // nothing to anybody. What is asserted is that it is well-formed rather than
  // that anyone reads it.
  const crumbs = ofType(structuredData({ section: "trafego" }, {}, ORIGIN), "BreadcrumbList");
  const trail = crumbs?.itemListElement as Array<Record<string, unknown>>;

  assert.deepEqual(
    trail.map((step) => step.name),
    ["Classificação", "Tráfego"],
  );
});
