/**
 * JSON-LD for the pages that describe a real-world thing. Pure: a route plus
 * loaded data in, plain objects out (tests/structured-data-core.test.ts).
 *
 * This is the half of SEO that titles and descriptions cannot do. A fixture
 * page is not merely a document about a match — it *is* a `SportsEvent`, with a
 * kickoff instant, a stadium and two clubs, and saying so is what lets a search
 * engine answer "quando joga o Flamengo" with this page rather than a link to
 * it. Every field below already exists on the payload; none of it is new data.
 *
 * Server-injected, like the rest of `page-meta-core`: a rich-result parser is
 * not obliged to run JavaScript, and the ones that do run it late.
 */
import { clubKey, findClub, instagramUrl, officialSiteUrl, wikipediaUrl } from "@/club-core";
import { findMatch } from "@/match-core";
import { findStadium } from "@/venue-core";
import { SITE_DESCRIPTION, SITE_NAME, type MetaContext } from "@/page-meta-core";
import { canonicalPath } from "@/seo-core";
import type { Route } from "@/route-core";
import type { Club, Match, MatchStatus, Stadium } from "@/src/types";

export const COMPETITION = "Campeonato Brasileiro Série A";

/** A JSON-LD node. Deliberately loose — schema.org is an open vocabulary and
 *  typing each shape would be a second, staler copy of it. */
export type JsonLd = Record<string, unknown>;

const url = (origin: string, path: string): string | undefined =>
  origin ? `${origin}${path}` : undefined;

/** Drop keys whose value never arrived, so the emitted node has no `null`s and
 *  no empty strings — a parser reads those as assertions, not as absences. */
const compact = (node: JsonLd): JsonLd =>
  Object.fromEntries(
    Object.entries(node).filter(([, value]) => {
      if (value === undefined || value === null || value === "") return false;
      return !(Array.isArray(value) && value.length === 0);
    }),
  );

/**
 * schema.org's event statuses describe **whether an event happened as
 * announced**, not where it is in its lifecycle: there is no "in progress" and
 * no "finished". So a match being played and a match played last April are both
 * `EventScheduled` — it went ahead as scheduled — and only the two that did not
 * go ahead get their own value. Mapping LIVE or FINISHED to anything else would
 * be asserting the fixture was disrupted.
 */
const EVENT_STATUS: Record<MatchStatus, string> = {
  SCHEDULED: "https://schema.org/EventScheduled",
  LIVE: "https://schema.org/EventScheduled",
  FINISHED: "https://schema.org/EventScheduled",
  POSTPONED: "https://schema.org/EventPostponed",
  CANCELLED: "https://schema.org/EventCancelled",
};

const ORGANIZATION: JsonLd = {
  "@type": "SportsOrganization",
  name: COMPETITION,
};

/**
 * A club as a `SportsTeam`. `nested` omits the context, which belongs only on
 * a document's top-level node.
 *
 * `sameAs` is not "the club's links" — it is the set of addresses that identify
 * *this entity* unambiguously, which is what lets a parser reconcile our node
 * with the one it already holds. schema.org names the Wikipedia article as the
 * example of that, alongside the official site, so it belongs here more
 * squarely than either of the two that were here first. Own addresses lead, the
 * third-party reference follows.
 *
 * The **hino** is deliberately absent, though it sits beside the other three in
 * the club header. A recording of the anthem is a work *about* the club, not an
 * address that identifies it; asserting `sameAs` of a YouTube video claims the
 * club and that video are the same thing.
 */
export const teamNode = (club: Club, origin: string, nested = true): JsonLd =>
  compact({
    ...(nested ? {} : { "@context": "https://schema.org" }),
    "@type": "SportsTeam",
    name: club.name,
    alternateName: club.shortName,
    url: url(origin, `/clube/${clubKey(club)}`),
    logo: club.crest,
    sport: "Futebol",
    memberOf: ORGANIZATION,
    sameAs: [
      officialSiteUrl(club.website),
      instagramUrl(club.instagram),
      wikipediaUrl(club.wikipedia),
    ].filter(Boolean),
  });

const placeNode = (match: Match): JsonLd | undefined =>
  match.venue
    ? {
        "@type": "Place",
        name: match.venue.stadium,
        address: compact({
          "@type": "PostalAddress",
          addressLocality: match.venue.city,
          addressRegion: match.venue.state,
          addressCountry: "BR",
        }),
      }
    : undefined;

/**
 * A ground in its own right, as distinct from the `Place` an event points at.
 *
 * `StadiumOrArena` rather than `Place` because that is what it is, and because
 * the extra facts — capacity, year of inauguration — have no home on a bare
 * `Place`. Each is omitted when uncurated rather than emitted empty: an
 * asserted `maximumAttendeeCapacity` of nothing is a claim, and a wrong one.
 */
export const stadiumNode = (stadium: Stadium, origin: string): JsonLd =>
  compact({
    "@context": "https://schema.org",
    "@type": "StadiumOrArena",
    name: stadium.name,
    alternateName: stadium.officialName,
    url: url(origin, `/estadio/${stadium.slug}`),
    address: compact({
      "@type": "PostalAddress",
      addressLocality: stadium.city,
      addressRegion: stadium.state,
      addressCountry: "BR",
    }),
    maximumAttendeeCapacity: stadium.capacity,
    // Schema wants a date; the year is all that was verified, so the year is
    // all that is asserted.
    foundingDate: stadium.opened === undefined ? undefined : String(stadium.opened),
    sameAs: [wikipediaUrl(stadium.wikipedia)].filter(Boolean),
  });

const eventNode = (
  match: Match,
  clubs: Club[],
  origin: string,
  description: string,
): JsonLd => {
  const byCode = new Map(clubs.map((club) => [club.code, club]));
  const home = byCode.get(match.homeCode);
  const away = byCode.get(match.awayCode);
  const name = `${home?.shortName ?? match.homeCode} x ${away?.shortName ?? match.awayCode}`;

  return compact({
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name,
    description,
    startDate: match.kickoff,
    eventStatus: EVENT_STATUS[match.status],
    // Every fixture is played in a stadium. Saying so explicitly stops a
    // parser defaulting the attendance mode to online.
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    sport: "Futebol",
    url: url(origin, `/partida/${match.id}`),
    location: placeNode(match),
    homeTeam: home ? teamNode(home, origin) : undefined,
    awayTeam: away ? teamNode(away, origin) : undefined,
    superEvent: { ...ORGANIZATION, "@type": "SportsEvent", name: COMPETITION },
  });
};

const websiteNode = (origin: string): JsonLd =>
  compact({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: url(origin, "/"),
    inLanguage: "pt-BR",
  });

/** Breadcrumbs, from the table down to the page. Emitted with absolute item
 *  URLs only, since a breadcrumb without an address is a label, not a link. */
const breadcrumbNode = (
  origin: string,
  trail: Array<{ name: string; path: string }>,
): JsonLd | undefined => {
  if (!origin || trail.length < 2) return undefined;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      item: `${origin}${step.path}`,
    })),
  };
};

const HOME_CRUMB = { name: "Classificação", path: "/" };

const trailFor = (route: Route, context: MetaContext): Array<{ name: string; path: string }> => {
  switch (route.section) {
    case "classificacao":
      return [HOME_CRUMB];
    case "ao-vivo":
      return [HOME_CRUMB, { name: "Ao vivo", path: "/ao-vivo" }];
    case "artilharia":
      return [HOME_CRUMB, { name: "Artilharia", path: "/artilharia" }];
    case "jogadores":
      return [HOME_CRUMB, { name: "Jogadores", path: "/jogadores" }];
    case "jogos": {
      const jogos = { name: "Jogos", path: "/jogos" };
      return route.round === null
        ? [HOME_CRUMB, jogos]
        : [HOME_CRUMB, jogos, { name: `${route.round}ª rodada`, path: `/jogos/${route.round}` }];
    }
    case "clube": {
      const club = findClub(context.clubs ?? [], route.key);
      return [
        HOME_CRUMB,
        { name: club?.shortName ?? "Clube", path: canonicalPath(route, context) },
      ];
    }
    case "estadio": {
      const stadium = findStadium(context.stadiums ?? [], route.key);
      return [
        HOME_CRUMB,
        {
          name: stadium?.name ?? "Estádio",
          path: `/estadio/${stadium?.slug ?? route.key}`,
        },
      ];
    }
    case "partida": {
      const match = findMatch(context.matches ?? [], route.id);
      if (!match) return [HOME_CRUMB, { name: "Partida", path: `/partida/${route.id}` }];

      const byCode = new Map((context.clubs ?? []).map((club) => [club.code, club]));
      const home = byCode.get(match.homeCode)?.shortName ?? match.homeCode;
      const away = byCode.get(match.awayCode)?.shortName ?? match.awayCode;
      return [
        HOME_CRUMB,
        { name: "Jogos", path: "/jogos" },
        { name: `${match.round}ª rodada`, path: `/jogos/${match.round}` },
        { name: `${home} x ${away}`, path: `/partida/${match.id}` },
      ];
    }
  }
};

/**
 * Every JSON-LD block a route should carry.
 *
 * A page whose subject has not loaded gets breadcrumbs and nothing else: an
 * empty `SportsEvent` asserts a match exists with no name and no kickoff, which
 * is worse than staying quiet.
 */
export const structuredData = (
  route: Route,
  context: MetaContext = {},
  origin = "",
  description = SITE_DESCRIPTION,
): JsonLd[] => {
  const blocks: JsonLd[] = [];

  if (route.section === "classificacao") blocks.push(websiteNode(origin));

  if (route.section === "clube") {
    const club = findClub(context.clubs ?? [], route.key);
    if (club) blocks.push(teamNode(club, origin, false));
  }

  if (route.section === "partida") {
    const match = findMatch(context.matches ?? [], route.id);
    if (match) blocks.push(eventNode(match, context.clubs ?? [], origin, description));
  }

  if (route.section === "estadio") {
    const stadium = findStadium(context.stadiums ?? [], route.key);
    if (stadium) blocks.push(stadiumNode(stadium, origin));
  }

  const crumbs = breadcrumbNode(origin, trailFor(route, context));
  if (crumbs) blocks.push(crumbs);

  return blocks;
};

/**
 * Render blocks as `<script type="application/ld+json">` tags.
 *
 * `<` is escaped to `<` rather than to `&lt;`: the contents of a `script`
 * element are not HTML-parsed, so an entity would arrive at the JSON parser
 * literally and break it — while an unescaped `</script>` inside a club name
 * would close the tag and put the rest of the payload into the document. The
 * unicode escape is the one form that is both valid JSON and inert to the HTML
 * tokeniser.
 */
export const jsonLdScript = (blocks: JsonLd[]): string =>
  blocks
    .map((block) => {
      const json = JSON.stringify(block)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
      return `<script type="application/ld+json">${json}</script>`;
    })
    .join("\n    ");
