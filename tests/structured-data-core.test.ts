import assert from "node:assert/strict";
import { test } from "node:test";

import {
  COMPETITION,
  jsonLdScript,
  stadiumNode,
  structuredData,
  teamNode,
} from "@/structured-data-core";
import type { Club, Match, Stadium } from "@/src/types";

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

/**
 * The rest of the node, which nothing asserted.
 *
 * `teamNode` was called five times in this file and every assertion read
 * `sameAs`, so `name`, `alternateName`, `url`, `logo`, `sport` and `memberOf`
 * were emitted onto 20 club pages with no case over any of them — confirmed by
 * mutation: changing `sport` to a nonsense string left this whole file green.
 * Execution is not assertion, and a coverage run cannot tell the two apart.
 */
test("a club node says what it is, where it lives and what it belongs to", () => {
  const team = teamNode(FLAMENGO, ORIGIN, false);

  assert.equal(team["@type"], "SportsTeam");
  assert.equal(team["@context"], "https://schema.org", "un-nested, it carries its own context");
  assert.equal(team.name, "Clube de Regatas do Flamengo");
  assert.equal(team.alternateName, "Flamengo");
  assert.equal(team.url, `${ORIGIN}/clube/flamengo`);
  assert.equal(team.logo, "https://crests.football-data.org/1783.png");
  assert.equal(team.sport, "Futebol");
  assert.equal((team.memberOf as { name?: string }).name, COMPETITION);
});

test("nested in a fixture, the club node drops its own @context", () => {
  // Two @context keys in one graph is the failure this argument exists for:
  // the fixture node already carries it, and a nested copy is not wrong so much
  // as redundant in a way parsers report.
  const nested = teamNode(FLAMENGO, ORIGIN);
  assert.ok(!("@context" in nested));
  assert.equal(nested["@type"], "SportsTeam");
});

test("a club curated down to nothing asserts no crest and no addresses", () => {
  // Botafogo here carries no website, instagram, wikipedia or crest — the
  // ordinary state of a club nobody has curated. `compact` has to leave those
  // keys out rather than emit empty ones.
  const team = teamNode(BOTAFOGO, ORIGIN, false);
  assert.ok(!("logo" in team), "no crest is not an empty crest");
  assert.ok(!("sameAs" in team), "no addresses is not an empty list");
  assert.equal(team.name, "Botafogo FR");
  assert.equal(team.url, `${ORIGIN}/clube/botafogo`);
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

test("a match with no known venue emits no Event, rather than one Google rejects", () => {
  // `location` is required of an Event. Omitting it was the first answer here,
  // "rather than inventing one", and it traded an invented venue for an invalid
  // item: Search Console's live test on /partida/555110 (2026-09-11) reported
  // Eventos "1 item inválido", critical `O campo "location" não foi encontrado`,
  // on a round-38 fixture the provider has not placed yet. 120 of the 380
  // fixtures had no venue that day, three finished ones among them. The page
  // keeps its breadcrumbs and stops asserting an Event it cannot complete: the
  // rule that dropped `superEvent`, applied to the fixture itself.
  const { venue: _venue, ...noVenue } = MATCH;
  for (const status of ["SCHEDULED", "POSTPONED", "FINISHED"] as const) {
    const blocks = structuredData(
      { section: "partida", id: "554970" },
      { clubs: CLUBS, matches: [{ ...noVenue, status }] },
      ORIGIN,
    );

    assert.equal(ofType(blocks, "SportsEvent"), undefined, status);
    assert.ok(ofType(blocks, "BreadcrumbList"), status);
  }
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

/**
 * `stadiumNode` — the ground as a thing in its own right, on the 24 estádio
 * pages.
 *
 * It had **no case at all** until this block: `structuredData` reaches it only
 * on the estádio route, and every assertion here went through a fixture route
 * instead, so the whole function and its three absence branches were uncovered.
 * Found by running `node --test --experimental-test-coverage` over `test:unit`,
 * where this module was the thinnest in the repository at 70% branch.
 *
 * The optional fields are the point. `capacity` and `opened` are absent for
 * real grounds — two of the nineteen state no year of inauguration — and an
 * emitted `maximumAttendeeCapacity` of nothing is not a blank, it is a claim
 * that the ground seats nobody. Mutations confirmed red, each on its own:
 * dropping `compact` from the node, emitting `foundingDate` unconditionally,
 * and letting `sameAs` through as `[undefined]`.
 */
const MARACANA: Stadium = {
  slug: "maracana",
  name: "Maracanã",
  officialName: "Estádio Jornalista Mário Filho",
  city: "Rio de Janeiro",
  state: "RJ",
  capacity: 78838,
  opened: 1950,
  wikipedia: "Estádio do Maracanã",
  homeClubs: [FLAMENGO, BOTAFOGO],
  matchCount: 12,
};

/** A ground curated down to what `venue-core` can always derive: the slug, the
 *  name and where it is. Everything else is an absence, which is the state the
 *  real file carries for the grounds nobody has read an article for. */
const BARE: Stadium = {
  slug: "arena-teste",
  name: "Arena Teste",
  city: "Curitiba",
  state: "PR",
  homeClubs: [BOTAFOGO],
  matchCount: 1,
};

test("a fully curated ground asserts every fact it was given", () => {
  const node = stadiumNode(MARACANA, ORIGIN);
  assert.equal(node["@type"], "StadiumOrArena");
  assert.equal(node["@context"], "https://schema.org");
  assert.equal(node.name, "Maracanã");
  assert.equal(node.alternateName, "Estádio Jornalista Mário Filho");
  assert.equal(node.url, `${ORIGIN}/estadio/maracana`);
  assert.equal(node.maximumAttendeeCapacity, 78838);
  assert.deepEqual(node.address, {
    "@type": "PostalAddress",
    addressLocality: "Rio de Janeiro",
    addressRegion: "RJ",
    addressCountry: "BR",
  });
});

test("the year of inauguration is a string, because schema wants a date", () => {
  // The number is what was verified, so the year is all that is asserted — but
  // schema.org reads `foundingDate` as a date, and a bare 1950 is not one.
  const node = stadiumNode(MARACANA, ORIGIN);
  assert.equal(node.foundingDate, "1950");
  assert.equal(typeof node.foundingDate, "string");
});

test("an uncurated fact is omitted, never emitted empty", () => {
  // The whole reason this node runs through `compact`. A capacity of nothing
  // asserts a ground that seats nobody, and `foundingDate: undefined` survives
  // `JSON.stringify` as a missing key only by luck of the serialiser — the
  // absence has to be real in the object a caller inspects.
  const node = stadiumNode(BARE, ORIGIN);
  assert.ok(!("maximumAttendeeCapacity" in node), "capacity is not asserted");
  assert.ok(!("foundingDate" in node), "no year is asserted");
  assert.ok(!("alternateName" in node), "no official name is asserted");
  assert.ok(!("sameAs" in node), "an empty sameAs is not an assertion of none");
  // What it does still say is everything `venue-core` can always derive.
  assert.equal(node.name, "Arena Teste");
  assert.equal(node.url, `${ORIGIN}/estadio/arena-teste`);
});

test("zero is a capacity and is not an absence", () => {
  // `compact` drops "", null and undefined. It must not drop 0, which is the
  // 0-0 trap this repository keeps meeting: a falsy value that is a real
  // reading. No ground reports it, so only a fixture can reach the branch.
  const node = stadiumNode({ ...MARACANA, capacity: 0 }, ORIGIN);
  assert.equal(node.maximumAttendeeCapacity, 0);
  assert.ok("maximumAttendeeCapacity" in node);
});

test("with no origin the ground still has a name but claims no address", () => {
  // `url` answers undefined on an empty origin rather than emitting a
  // root-relative path, for the reason the canonical tag does: a consumer
  // resolves it against its own host and lands somewhere else entirely.
  const node = stadiumNode(MARACANA, "");
  assert.ok(!("url" in node), "no url is better than one rooted at the reader");
  assert.equal(node.name, "Maracanã");
});

test("the Wikipédia article is carried as an address, not as a title", () => {
  // `wikipedia` stores the title alone; the node has to publish something a
  // crawler can follow, and through the one shared `wikipediaUrl`.
  const sameAs = stadiumNode(MARACANA, ORIGIN).sameAs as string[];
  assert.equal(sameAs.length, 1);
  assert.match(sameAs[0], /^https:\/\/pt\.wikipedia\.org\/wiki\//);
  assert.ok(!sameAs[0].endsWith("/"), "the title survives into the address");
});
