/**
 * Pure page metadata: a route plus whatever data is loaded, in — title,
 * description and preview image out. No DOM, no I/O (tests/page-meta-core.test.ts).
 *
 * Used twice, deliberately: the client sets `document.title` from it on every
 * navigation, and the server injects the same values into the HTML it serves.
 * A link preview never runs JavaScript, so without the server half a shared
 * `/clube/flamengo` would unfurl as the generic site name.
 */
import { findClub } from "@/club-core";
import { findMatch } from "@/match-core";
import type { Route } from "@/route-core";
import { capacityLabel, findStadium, stadiumLocation } from "@/venue-core";
import type { Club, Match, StandingsRow, Stadium } from "@/src/types";

export const SITE_NAME = "Portal Brasileirão";
export const SITE_DESCRIPTION =
  "Classificação, jogos, artilharia e onde assistir o Campeonato Brasileiro Série A.";

/** The card image drawn by `scripts/generate-og-image.ts`, served from `public/`. */
export const OG_IMAGE_PATH = "/og-default.png";
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export interface PreviewImage {
  /** Absolute. A scraper fetches this from its own host, so a root-relative
   *  path resolves against the wrong origin or not at all. */
  url: string;
  /**
   * Which Twitter card the image suits. `wide` is the 1200x630 card; `square`
   * is a club crest, which inside a wide card is a logo adrift in whitespace.
   */
  shape: "wide" | "square";
  /** Only when known. The provider's crests arrive at unspecified sizes, and
   *  guessing would tell a scraper to lay out a box the image does not fill. */
  width?: number;
  height?: number;
  alt: string;
}

export interface PageMeta {
  title: string;
  description: string;
  image?: PreviewImage;
}

/** Whatever the caller happens to have loaded. Every field is optional: the
 *  metadata degrades to something sensible rather than waiting for data. */
export interface MetaContext {
  clubs?: Club[];
  matches?: Match[];
  standings?: StandingsRow[];
  /** Derived by the caller, never fetched — a stadium is not an entity in any
   *  payload. Absent means the stadium page falls back to generic wording. */
  stadiums?: Stadium[];
}

const suffix = (headline: string): string => `${headline} · ${SITE_NAME}`;

/**
 * The site's own card.
 *
 * Omitted rather than emitted relative when no origin is known, on the same
 * reasoning as the canonical tag and the sitemap: a URL a scraper cannot fetch
 * is worse than no tag, because it renders as a broken preview instead of a
 * plain one.
 */
const siteImage = (origin: string): PreviewImage | undefined =>
  origin
    ? {
        url: `${origin}${OG_IMAGE_PATH}`,
        shape: "wide",
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: `${SITE_NAME} — Campeonato Brasileiro Série A`,
      }
    : undefined;

/** A club's crest, which is genuinely what its page is about. */
const crestImage = (club: Club): PreviewImage | undefined =>
  club.crest
    ? { url: club.crest, shape: "square", alt: `Escudo do ${club.shortName}` }
    : undefined;

const clubDescription = (club: Club, standings: StandingsRow[] | undefined): string => {
  const row = standings?.find((entry) => entry.club.code === club.code);
  if (!row) return `Jogos, elenco e artilheiros do ${club.shortName} no Brasileirão Série A.`;

  return (
    `${club.shortName}: ${row.position}º lugar com ${row.points} ` +
    `${row.points === 1 ? "ponto" : "pontos"} em ${row.played} ` +
    `${row.played === 1 ? "jogo" : "jogos"} no Brasileirão Série A.`
  );
};

const matchDescription = (match: Match, home: string, away: string): string => {
  const parts: string[] = [`${home} x ${away}`, `${match.round}ª rodada do Brasileirão Série A`];

  if (match.venue) parts.push(`${match.venue.stadium}, ${match.venue.city}`);
  if (match.broadcasters?.length) parts.push(`Onde assistir: ${match.broadcasters.join(", ")}`);

  return `${parts.join(". ")}.`;
};

/**
 * A stadium in one sentence: where it is, who plays there, how big it is.
 *
 * Each clause is dropped when its data is absent rather than rendered empty,
 * because everything past the location is hand-curated and most of it is
 * missing for a ground nobody has filled in yet.
 */
const stadiumDescription = (stadium: Stadium): string => {
  const parts: string[] = [`${stadium.name}, em ${stadiumLocation(stadium)}`];

  if (stadium.homeClubs.length) {
    const names = stadium.homeClubs.map((club) => club.shortName).join(" e ");
    parts.push(`Casa do ${names}`);
  }

  const capacity = capacityLabel(stadium);
  if (capacity) parts.push(`Capacidade de ${capacity} lugares`);

  parts.push("Jogos do Brasileirão Série A neste estádio");

  return `${parts.join(". ")}.`;
};

/**
 * Metadata for a route.
 *
 * Names are resolved from `context` when it holds them and fall back to the
 * section's generic wording otherwise — a page whose data has not arrived still
 * gets a truthful title rather than a blank or a placeholder like "undefined".
 */
export const pageMeta = (
  route: Route,
  context: MetaContext = {},
  origin = "",
): PageMeta => {
  const site = siteImage(origin);

  switch (route.section) {
    case "classificacao":
      return {
        title: `${SITE_NAME} — Campeonato Brasileiro Série A`,
        description: SITE_DESCRIPTION,
        image: site,
      };

    case "ao-vivo":
      return {
        title: suffix("Ao vivo"),
        description:
          "Jogos em andamento do Campeonato Brasileiro Série A, com placar, " +
          "próximos jogos e onde assistir.",
        image: site,
      };

    case "jogos":
      return route.round === null
        ? {
            title: suffix("Jogos"),
            description: "Partidas de cada rodada do Campeonato Brasileiro Série A.",
            image: site,
          }
        : {
            title: suffix(`${route.round}ª rodada`),
            description: `Jogos da ${route.round}ª rodada do Campeonato Brasileiro Série A.`,
            image: site,
          };

    case "artilharia":
      return {
        title: suffix("Artilharia"),
        description: "Os maiores goleadores do Campeonato Brasileiro Série A.",
        image: site,
      };

    case "clube": {
      const club = findClub(context.clubs ?? [], route.key);
      if (!club) {
        return {
          title: suffix("Clube"),
          description: SITE_DESCRIPTION,
          image: site,
        };
      }

      return {
        title: suffix(club.shortName),
        description: clubDescription(club, context.standings),
        image: crestImage(club) ?? site,
      };
    }

    case "estadio": {
      const stadium = findStadium(context.stadiums ?? [], route.key);
      if (!stadium) {
        return { title: suffix("Estádio"), description: SITE_DESCRIPTION };
      }

      return {
        title: suffix(stadium.name),
        description: stadiumDescription(stadium),
      };
    }

    case "partida": {
      const match = findMatch(context.matches ?? [], route.id);
      if (!match) {
        return { title: suffix("Partida"), description: SITE_DESCRIPTION, image: site };
      }

      const byCode = new Map((context.clubs ?? []).map((club) => [club.code, club]));
      const home = byCode.get(match.homeCode)?.shortName ?? match.homeCode;
      const away = byCode.get(match.awayCode)?.shortName ?? match.awayCode;

      const score =
        match.homeGoals !== null && match.awayGoals !== null
          ? ` ${match.homeGoals} x ${match.awayGoals} `
          : " x ";

      return {
        title: suffix(`${home}${score}${away}`.replace(/\s+/g, " ").trim()),
        description: matchDescription(match, home, away),
        // The site's card, not the home club's crest. A fixture is two clubs,
        // and illustrating it with one of them asserts the page is about that
        // one — which is also how the away side's supporters read it.
        image: site,
      };
    }
  }
};

/**
 * The card type follows the image's shape, which is exactly what the two values
 * mean. This used to be inverted: `summary` whenever an image existed, and
 * `summary_large_image` when none did — declaring the wide layout precisely
 * when there was nothing to fill it, and cramping the one case that had art.
 */
const twitterCard = (image: PreviewImage | undefined): string =>
  image?.shape === "wide" ? "summary_large_image" : "summary";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Everything the shell needs beyond the title and description. */
export interface InjectOptions {
  canonicalUrl?: string;
  /**
   * Keep this page out of the index. Set for the paths that answer with a
   * friendly body but a 404 status — a made-up club, a round that was never
   * played. The status alone is enough for a crawler that reads it; the tag
   * covers the ones that render first and ask later.
   */
  noindex?: boolean;
  /**
   * Pre-rendered `<script type="application/ld+json">` markup.
   *
   * Passed in as a string rather than built here, because building it needs
   * `structured-data-core`, which needs this module's `SITE_NAME` — importing
   * it back would close a cycle. The caller already holds both.
   */
  jsonLd?: string;
}

/**
 * Rewrite a document's metadata.
 *
 * Replaces the existing `<title>` and description rather than appending, so the
 * document never carries two of either, and injects Open Graph, Twitter,
 * canonical, robots and JSON-LD tags before `</head>`. Returns the HTML
 * unchanged if there is no head to inject into — a malformed shell should still
 * be served, not blanked.
 */
export const injectMeta = (
  html: string,
  meta: PageMeta,
  options: InjectOptions = {},
): string => {
  const { canonicalUrl, noindex, jsonLd } = options;
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);

  let result = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[\s\S]*?"\s*\/?>/i,
      `<meta name="description" content="${description}" />`,
    );

  const image = meta.image;

  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    image ? `<meta property="og:image" content="${escapeHtml(image.url)}" />` : "",
    // Dimensions let a scraper reserve the right box before it has fetched the
    // file, so the preview does not reflow. Emitted only when actually known.
    image?.width ? `<meta property="og:image:width" content="${image.width}" />` : "",
    image?.height ? `<meta property="og:image:height" content="${image.height}" />` : "",
    image ? `<meta property="og:image:alt" content="${escapeHtml(image.alt)}" />` : "",
    canonicalUrl ? `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />` : "",
    canonicalUrl ? `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />` : "",
    `<meta name="twitter:card" content="${twitterCard(image)}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    image ? `<meta name="twitter:image" content="${escapeHtml(image.url)}" />` : "",
    image ? `<meta name="twitter:image:alt" content="${escapeHtml(image.alt)}" />` : "",
    // `noindex` without `nofollow`: the page is not worth an index entry, but
    // its links still lead to pages that are, and a stale link is the common
    // way a crawler reaches this branch at all.
    noindex ? `<meta name="robots" content="noindex, follow" />` : "",
    jsonLd ?? "",
  ]
    .filter(Boolean)
    .join("\n    ");

  if (!/<\/head>/i.test(result)) return result;

  result = result.replace(/<\/head>/i, `    ${tags}\n  </head>`);
  return result;
};
