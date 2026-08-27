/**
 * Pure SEO surface: what a crawler is told this site contains. No I/O, no DOM
 * (tests/seo-core.test.ts).
 *
 * Three concerns live here because they are one concern seen from three sides:
 * the canonical address of a route, whether that address is worth indexing at
 * all, and the robots/sitemap documents that point at the ones that are.
 *
 * The app answers *something* for every path — a stale link lands on the table
 * rather than an error, which is right for a reader. For a crawler it is wrong:
 * `/qualquer-coisa` served a 200 copy of the home page is a duplicate, and
 * there are infinitely many of them. `pageStatus` is where those two audiences
 * part company: the body stays friendly, the status code and the robots meta
 * tell the truth.
 */
import { clubKey, findClub } from "@/club-core";
import { findMatch } from "@/match-core";
import { findStadium } from "@/venue-core";
import { roundsOf } from "@/matches-core";
import type { MetaContext } from "@/page-meta-core";
import { formatRoute, type Route } from "@/route-core";
import type { Match, Stadium } from "@/src/types";

/** Sections that name a real page. Anything else is a 404, not a redirect to
 *  the table — see the module note. */
const SECTIONS = new Set([
  "classificacao",
  "ao-vivo",
  "jogos",
  "artilharia",
  "jogadores",
  "clube",
  "partida",
  "estadio",
  "conta",
  "entrar",
]);

/**
 * A hostname taken from a request header, and nothing else.
 *
 * `Host` and `X-Forwarded-Host` are attacker-controlled, and this value ends up
 * inside `<link rel="canonical">` — the one tag whose whole job is to tell a
 * search engine which origin owns this content. An unvalidated header there
 * lets a third party point our canonical at their domain. Letters, digits,
 * dots, hyphens and an optional port; no scheme, no path, no credentials.
 */
const HOST_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i;

/**
 * The absolute origin this app is reachable at, with no trailing slash.
 *
 * `APP_URL` wins whenever it is set: it is the deployed truth, and it survives
 * a request arriving with whatever `Host` a scanner felt like sending. The
 * request is the fallback, so a fresh clone with no `.env` still emits working
 * canonicals and a working sitemap instead of silently omitting both.
 *
 * Returns `""` when neither yields a usable origin. Callers treat that as
 * "emit no absolute URL" rather than inventing one.
 */
export const resolveOrigin = (
  appUrl: string | undefined,
  request: { protocol?: string; host?: string } = {},
): string => {
  const configured = (appUrl ?? "").trim().replace(/\/+$/, "");
  if (configured) return configured;

  const host = (request.host ?? "").trim();
  if (!HOST_PATTERN.test(host)) return "";

  const protocol = (request.protocol ?? "").trim().toLowerCase();
  return `${protocol === "https" ? "https" : "http"}://${host}`;
};

/**
 * The route rewritten to the form its canonical URL should take.
 *
 * Only clubs move: `/clube/1783` was published before slugs existed and still
 * resolves, so it must keep working — but it is the same page as
 * `/clube/flamengo`, and exactly one of the two should be the indexed one.
 * A key that resolves to nothing is left alone; `pageStatus` gives it a 404.
 */
export const canonicalRoute = (route: Route, context: MetaContext = {}): Route => {
  if (route.section !== "clube") return route;

  const club = findClub(context.clubs ?? [], route.key);
  return club ? { section: "clube", key: clubKey(club) } : route;
};

/** The canonical path for a route: `formatRoute`, after slug resolution. */
export const canonicalPath = (route: Route, context: MetaContext = {}): string =>
  formatRoute(canonicalRoute(route, context));

/** The canonical URL, or null when no origin is known. */
export const canonicalUrl = (
  origin: string,
  route: Route,
  context: MetaContext = {},
): string | null => (origin ? `${origin}${canonicalPath(route, context)}` : null);

/**
 * Whether the data a path's verdict depends on has actually arrived.
 *
 * Deliberately *not* the same question as `pageStatus`, which answers 200 for
 * an unresolved subject on purpose. This one asks "do I know enough to name
 * this page's canonical address and judge whether it exists" — and on the
 * client, before the fetch lands, the answer is no. That matters because the
 * server already answered both questions with data in hand: a client that
 * rewrites the canonical on first render replaces `/clube/athletico-pr` with
 * `/clube/1768`, and strips a `noindex` off a page that really is missing.
 * Where this returns false, the server's tags are the better ones and stand.
 */
export const subjectResolved = (route: Route, context: MetaContext = {}): boolean => {
  switch (route.section) {
    case "clube":
      return Boolean(findClub(context.clubs ?? [], route.key));
    case "partida":
      return Boolean(findMatch(context.matches ?? [], route.id));
    case "estadio":
      return Boolean(findStadium(context.stadiums ?? [], route.key));
    case "jogos":
      // A round is judged against the season's round list, so it needs one.
      return route.round === null || (context.matches?.length ?? 0) > 0;
    default:
      return true;
  }
};

export type StatusReason =
  | "ok"
  | "malformed-path"
  | "unknown-section"
  | "unnamed-detail"
  | "unknown-round"
  | "unknown-club"
  | "unknown-match"
  | "unknown-stadium"
  /** A real page, served with a 200, that must never be indexed. */
  | "private";

export interface PageStatus {
  status: 200 | 404;
  /** Whether the page may be offered to the index. */
  index: boolean;
  /** Which rule decided, so a test names the rule rather than the number. */
  reason: StatusReason;
}

const FOUND: PageStatus = { status: 200, index: true, reason: "ok" };

/**
 * A page that exists and must not be indexed.
 *
 * The type has always permitted this — `status` and `index` are independent —
 * and no constructor produced it, because until accounts every page this app
 * served was the same for everybody. `/conta` is not: what it says depends on
 * who is asking, which is the definition of something a crawler must not
 * cache, index, or offer as a search result to a different person.
 */
const PRIVATE: PageStatus = { status: 200, index: false, reason: "private" };
const missing = (reason: StatusReason): PageStatus => ({ status: 404, index: false, reason });

/** `decodeURIComponent` throws on a malformed escape like `%E0%A4%A`, and a
 *  crawler will find one. Null means "not a path we can read" — a 404, never an
 *  exception escaping into the request handler. */
const decodeSegments = (pathname: string): string[] | null => {
  try {
    return pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return null;
  }
};

const ROUND_PATTERN = /^[1-9]\d*$/;

/**
 * Whether a path names a page, and whether that page should be indexed.
 *
 * `context` is what the caller happens to have loaded, and an **absent** list
 * is not an empty one. A club is only declared missing when the club list
 * actually arrived — otherwise a provider outage would turn all 380 match
 * pages into 404s at exactly the moment the site is already degraded, and a
 * crawler would drop them from the index over an incident that lasted minutes.
 * Absence of proof is a 200 here, deliberately.
 */
export const pageStatus = (pathname: string, context: MetaContext = {}): PageStatus => {
  const segments = decodeSegments(pathname);
  if (segments === null) return missing("malformed-path");

  const [first, second, ...rest] = segments;

  // Nothing addresses a third segment: `/jogos/24/qualquer` is not a deeper
  // page, it is a made-up one.
  if (rest.length > 0) return missing("unknown-section");
  if (first === undefined) return FOUND;
  if (!SECTIONS.has(first)) return missing("unknown-section");

  switch (first) {
    case "jogos": {
      if (second === undefined) return FOUND;
      if (!ROUND_PATTERN.test(second)) return missing("unknown-round");

      const rounds = context.matches ? roundsOf(context.matches) : [];
      if (rounds.length > 0 && !rounds.includes(Number(second))) {
        return missing("unknown-round");
      }
      return FOUND;
    }

    case "clube": {
      if (second === undefined) return missing("unnamed-detail");
      if (context.clubs?.length && !findClub(context.clubs, second)) {
        return missing("unknown-club");
      }
      return FOUND;
    }

    case "partida": {
      if (second === undefined) return missing("unnamed-detail");
      if (context.matches?.length && !findMatch(context.matches, second)) {
        return missing("unknown-match");
      }
      return FOUND;
    }

    case "estadio": {
      if (second === undefined) return missing("unnamed-detail");
      // Same rule as the others: an absent list is not an empty one, so a
      // stadium is only declared missing once the roster actually arrived.
      if (context.stadiums?.length && !findStadium(context.stadiums, second)) {
        return missing("unknown-stadium");
      }
      return FOUND;
    }

    case "conta":
    case "entrar":
      // Explicit rather than left to the `default` below, which would answer
      // FOUND — a 200 offering a per-requester page to the index. That is the
      // silent half of the four-file change `CLAUDE.md` warns about: nothing
      // fails, no test goes red, and the page is simply crawlable.
      return second === undefined ? PRIVATE : missing("unknown-section");

    default:
      // A section that takes no argument does not acquire one.
      return second === undefined ? FOUND : missing("unknown-section");
  }
};

/**
 * `robots.txt`.
 *
 * The API is disallowed because it is not content — a JSON envelope in an index
 * is noise, and crawling it spends the 10 req/min upstream budget on a robot.
 * The `Sitemap:` line is omitted rather than emitted relative when no origin is
 * known: the directive is defined as an absolute URL, and a relative one is
 * simply ignored, which looks like a working line that does nothing.
 */
export const robotsTxt = (origin: string): string => {
  const lines = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    // Per-requester pages. `noindex` on the page itself is the binding
    // instruction; this saves a crawler the fetch, and saves us serving a
    // personal page to one.
    "Disallow: /conta",
    "Disallow: /entrar",
    "",
  ];
  if (origin) lines.push(`Sitemap: ${origin}/sitemap.xml`, "");
  return lines.join("\n");
};

export type ChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly";

export interface SitemapEntry {
  /** Root-relative; `sitemapXml` makes it absolute. */
  path: string;
  /** W3C date (`aaaa-mm-dd`), or a full ISO instant. */
  lastmod?: string;
  changefreq?: ChangeFreq;
  priority?: number;
}

const isoDate = (value: string): string => value.slice(0, 10);

/**
 * Every address worth crawling, built from the payload the API already serves.
 *
 * This is the whole point of the sitemap here rather than a nicety: the round
 * picker is a `<select>`, not a set of links, so rounds other than the current
 * one — and therefore nearly every fixture page — have no inbound link
 * anywhere on the site. Without this file they are unreachable by crawl.
 *
 * A finished match takes its kickoff as `lastmod`, because that is the moment
 * the page stopped changing; everything else takes the payload's `updatedAt`.
 * Claiming today's date for a fixture played in April trains a crawler to stop
 * believing the field.
 *
 * ~440 URLs at full season, against a 50,000 limit — no sitemap index needed.
 */
export const sitemapEntries = (context: {
  clubs?: MetaContext["clubs"];
  matches?: Match[];
  stadiums?: Stadium[];
  updatedAt?: string;
}): SitemapEntry[] => {
  const updatedAt = context.updatedAt ? isoDate(context.updatedAt) : undefined;

  const entries: SitemapEntry[] = [
    { path: "/", lastmod: updatedAt, changefreq: "daily", priority: 1 },
    { path: "/ao-vivo", lastmod: updatedAt, changefreq: "hourly", priority: 0.9 },
    { path: "/jogos", lastmod: updatedAt, changefreq: "daily", priority: 0.8 },
    { path: "/artilharia", lastmod: updatedAt, changefreq: "daily", priority: 0.7 },
    // Weekly, not daily: an elenco moves in a transfer window, and telling a
    // crawler otherwise is the same lie as a fixture claiming today's lastmod.
    { path: "/jogadores", lastmod: updatedAt, changefreq: "weekly", priority: 0.7 },
  ];

  for (const round of roundsOf(context.matches ?? [])) {
    entries.push({
      path: `/jogos/${round}`,
      lastmod: updatedAt,
      changefreq: "weekly",
      priority: 0.5,
    });
  }

  for (const club of context.clubs ?? []) {
    entries.push({
      path: `/clube/${clubKey(club)}`,
      lastmod: updatedAt,
      changefreq: "weekly",
      priority: 0.6,
    });
  }

  // Below the clubs: a ground changes less often than anything else on the
  // site, and its page is largely a view onto fixtures listed elsewhere.
  for (const stadium of context.stadiums ?? []) {
    entries.push({
      path: `/estadio/${stadium.slug}`,
      lastmod: updatedAt,
      changefreq: "monthly",
      priority: 0.4,
    });
  }

  for (const match of context.matches ?? []) {
    const finished = match.status === "FINISHED";
    entries.push({
      path: `/partida/${match.id}`,
      lastmod: finished ? isoDate(match.kickoff) : updatedAt,
      changefreq: finished ? "monthly" : "daily",
      priority: 0.5,
    });
  }

  return entries;
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** Render entries as `urlset` XML. Returns an empty sitemap rather than
 *  throwing when the origin is unknown — a valid document saying nothing beats
 *  a 500, and the same reasoning applies as for the `Sitemap:` directive. */
export const sitemapXml = (origin: string, entries: SitemapEntry[]): string => {
  const urls = origin
    ? entries.map((entry) => {
        const parts = [`    <loc>${escapeXml(`${origin}${entry.path}`)}</loc>`];
        if (entry.lastmod) parts.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
        if (entry.changefreq) parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
        if (entry.priority !== undefined) {
          parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
        }
        return `  <url>\n${parts.join("\n")}\n  </url>`;
      })
    : [];

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    "",
  ].join("\n");
};
