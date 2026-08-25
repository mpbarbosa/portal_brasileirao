import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { readFileSync } from "node:fs";
import path from "node:path";

import "dotenv/config";
import express from "express";

import {
  CircuitBreaker,
  LIVE_MATCHES_CACHE_TTL_MS,
  MATCHES_CACHE_TTL_MS,
  PLAYER_CACHE_TTL_MS,
  SCORERS_CACHE_TTL_MS,
  SQUADS_CACHE_TTL_MS,
  STANDINGS_CACHE_TTL_MS,
  TtlCache,
} from "@/cache-core";
import {
  authHeaders,
  clubsFromMatches,
  mapMatches,
  mapPerson,
  mapScorers,
  mapSquads,
  mapStandings,
  matchesUrl,
  personUrl,
  scorersUrl,
  standingsUrl,
  teamsUrl,
  type MatchesResponse,
  type PersonResponse,
  type ScorersResponse,
  type StandingsResponse,
  type TeamsResponse,
} from "@/football-data-core";
import { withBroadcasters, withVenues } from "@/broadcast-core";
import { withHighlights } from "@/match-core";
import { withClubDetails, withHymns, withInstagram, withWikipedia } from "@/club-core";
import { compareForFeed, currentRound, matchesForRound, roundsOf } from "@/matches-core";
import { injectMeta, pageMeta, type MetaContext } from "@/page-meta-core";
import { parseRoute, type Route } from "@/route-core";
import { buildStadiums } from "@/venue-core";
import { STADIUMS } from "@/src/data/stadiums";
import {
  canonicalUrl,
  pageStatus,
  resolveOrigin,
  robotsTxt,
  sitemapEntries,
  sitemapXml,
} from "@/seo-core";
import { jsonLdScript, structuredData } from "@/structured-data-core";
import { sortSquads } from "@/squad-core";
import { computeStandings } from "@/standings-core";
import { CLUBS as SEED_CLUBS } from "@/src/data/clubs";
import { CLUB_HYMNS } from "@/src/data/club-hymns";
import { CLUB_INSTAGRAM } from "@/src/data/club-instagram";
import { CLUB_WIKIPEDIA } from "@/src/data/club-wikipedia";
import { BROADCASTS } from "@/src/data/broadcasts";
import { HIGHLIGHTS } from "@/src/data/highlights";
import { VENUES } from "@/src/data/venues";
import { SEED_MATCHES, SNAPSHOT_DATE } from "@/src/data/matches";
import { SEED_SCORERS } from "@/src/data/scorers";
import { SEED_SQUADS } from "@/src/data/squads";
import type {
  ApiEnvelope,
  Club,
  Match,
  Player,
  Scorer,
  Squad,
  Stadium,
  StandingsRow,
} from "@/src/types";

/**
 * Injected by scripts/build.sh at bundle time. Running from source (tsx in
 * development) there is no bundler to define them, hence the guarded reads
 * below rather than a bare reference that would throw.
 */
declare const __BUILD_SHA__: string;
declare const __BUILD_TIME__: string;

const BUILD_SHA = typeof __BUILD_SHA__ === "string" ? __BUILD_SHA__ : "dev";
const BUILD_TIME = typeof __BUILD_TIME__ === "string" ? __BUILD_TIME__ : null;

const DEFAULT_PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";
const STRICT_PORT = process.env.STRICT_PORT === "true";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
/**
 * Believe `X-Forwarded-Proto` / `X-Forwarded-Host` when a reverse proxy
 * terminates TLS in front of us. Off unless asked, because those headers are
 * attacker-controlled on a directly-exposed port and they feed the canonical
 * tag. They only matter at all when `APP_URL` is unset — which it is not on
 * any deployed host — so the safe default costs nothing.
 */
const TRUST_PROXY = process.env.TRUST_PROXY === "true";

/** Free-tier token from football-data.org. Unset is a supported state: the app
 *  runs on seed fixtures so a fresh clone works with no signup. */
const FOOTBALL_DATA_TOKEN = (process.env.FOOTBALL_DATA_TOKEN ?? "").trim();
/** Kill switch: force the fallback path without removing the token. */
const PROVIDER_DISABLED = process.env.DISABLE_FOOTBALL_DATA === "true";
const FETCH_TIMEOUT_MS = Number(process.env.FOOTBALL_DATA_TIMEOUT_MS ?? 6000);

const providerEnabled = (): boolean => Boolean(FOOTBALL_DATA_TOKEN) && !PROVIDER_DISABLED;

/** ISO snapshot date as dd/mm/aaaa, for pt-BR copy. */
const snapshotLabel = SNAPSHOT_DATE.split("-").reverse().join("/");

const NOTE_LIVE = "Dados do football-data.org (Campeonato Brasileiro Série A).";
const NOTE_PLACEHOLDER =
  `Dados congelados de ${snapshotLabel} — defina FOOTBALL_DATA_TOKEN para dados ao vivo.`;
const NOTE_FALLBACK =
  `Dados congelados de ${snapshotLabel} — a fonte ao vivo está indisponível no momento.`;

const cache = new TtlCache();
const breaker = new CircuitBreaker();

/** The committed club list, plus the handles, hymns and articles no provider
 *  supplies. Enriching once here means every payload built from CLUBS carries
 *  them. */
const CLUBS = withWikipedia(
  withHymns(withInstagram(SEED_CLUBS, CLUB_INSTAGRAM), CLUB_HYMNS),
  CLUB_WIKIPEDIA,
);

const app = express();

const envelope = <T>(
  data: T,
  source: ApiEnvelope<T>["source"],
  updatedAt: number,
): ApiEnvelope<T> => ({
  source,
  note:
    source === "football-data"
      ? NOTE_LIVE
      : source === "placeholder"
        ? NOTE_PLACEHOLDER
        : NOTE_FALLBACK,
  updatedAt: new Date(updatedAt).toISOString(),
  data,
});

/** Seed fixtures, labelled by *why* they are being served: never configured
 *  (`placeholder`) versus configured but currently failing (`fallback`). */
const seedEnvelope = <T>(data: T, now: number): ApiEnvelope<T> =>
  envelope(data, providerEnabled() ? "fallback" : "placeholder", now);

const fetchFromProvider = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    headers: authHeaders(FOOTBALL_DATA_TOKEN),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${url} respondeu ${response.status}`);
  }

  return (await response.json()) as T;
};

/**
 * Cache-then-network with a breaker in front: a warm entry short-circuits, an
 * open breaker skips the call entirely, and any failure degrades to the seed
 * rather than surfacing a 500.
 */
const loadCached = async <T>(
  key: string,
  ttlMs: number,
  fetchValue: () => Promise<T>,
  seed: () => T,
): Promise<ApiEnvelope<T>> => {
  const now = Date.now();

  if (!providerEnabled()) {
    return seedEnvelope(seed(), now);
  }

  const hit = cache.read<T>(key, now);
  if (hit) {
    return envelope(hit.value, "football-data", hit.storedAt);
  }

  if (breaker.isOpen(now)) {
    return seedEnvelope(seed(), now);
  }

  try {
    const value = await fetchValue();
    breaker.recordSuccess();
    const entry = cache.write(key, value, ttlMs, Date.now());
    return envelope(entry.value, "football-data", entry.storedAt);
  } catch (cause) {
    breaker.recordFailure(Date.now());
    console.error(`football-data (${key}) falhou:`, cause);
    return seedEnvelope(seed(), Date.now());
  }
};

interface MatchesPayload {
  rounds: number[];
  currentRound: number | null;
  matches: Match[];
  clubs: Club[];
}

const seedMatchesPayload = (): MatchesPayload => ({
  rounds: roundsOf(SEED_MATCHES),
  currentRound: currentRound(SEED_MATCHES, Date.now()),
  matches: withHighlights(
    withVenues(withBroadcasters([...SEED_MATCHES].sort(compareForFeed), BROADCASTS), VENUES),
    HIGHLIGHTS,
  ),
  clubs: CLUBS,
});

const loadStandings = (): Promise<ApiEnvelope<StandingsRow[]>> =>
  loadCached<StandingsRow[]>(
    "standings",
    STANDINGS_CACHE_TTL_MS,
    async () => {
      const rows = mapStandings(await fetchFromProvider<StandingsResponse>(standingsUrl()));
      // Same gap as fixtures: the standings payload has no website either.
      const enriched = withClubDetails(
        rows.map((row) => row.club),
        CLUBS,
      );
      return rows.map((row, index) => ({ ...row, club: enriched[index] }));
    },
    () => computeStandings(CLUBS, SEED_MATCHES),
  );

/** Fixture lists get the short TTL only while something is actually live. */
const matchesTtl = (matches: Match[]): number =>
  matches.some((match) => match.status === "LIVE")
    ? LIVE_MATCHES_CACHE_TTL_MS
    : MATCHES_CACHE_TTL_MS;

const loadMatches = async (): Promise<ApiEnvelope<MatchesPayload>> => {
  const now = Date.now();

  if (!providerEnabled()) {
    return seedEnvelope(seedMatchesPayload(), now);
  }

  const hit = cache.read<MatchesPayload>("matches", now);
  if (hit) {
    return envelope(hit.value, "football-data", hit.storedAt);
  }

  if (breaker.isOpen(now)) {
    return seedEnvelope(seedMatchesPayload(), now);
  }

  try {
    const raw = await fetchFromProvider<MatchesResponse>(matchesUrl());
    const matches = mapMatches(raw);
    const payload: MatchesPayload = {
      rounds: roundsOf(matches),
      currentRound: currentRound(matches, Date.now()),
      // Curated channels and venues ride along with live fixtures too — the
      // provider supplies neither.
      matches: withHighlights(
        withVenues(withBroadcasters([...matches].sort(compareForFeed), BROADCASTS), VENUES),
        HIGHLIGHTS,
      ),
      // Fixtures carry no website or handle; the committed club list does.
      clubs: withClubDetails(clubsFromMatches(raw), CLUBS),
    };

    breaker.recordSuccess();
    const entry = cache.write("matches", payload, matchesTtl(matches), Date.now());
    return envelope(entry.value, "football-data", entry.storedAt);
  } catch (cause) {
    breaker.recordFailure(Date.now());
    console.error("football-data (matches) falhou:", cause);
    return seedEnvelope(seedMatchesPayload(), Date.now());
  }
};

/** A forwarded header may carry a chain — `client, proxy1` — and only the
 *  client-most value describes the origin the reader typed. */
const firstHeaderValue = (raw: string | undefined): string | undefined =>
  raw?.split(",")[0]?.trim() || undefined;

/** The absolute origin to build canonical and sitemap URLs from. */
const originFor = (req: express.Request): string =>
  resolveOrigin(process.env.APP_URL, {
    protocol: (TRUST_PROXY ? firstHeaderValue(req.get("x-forwarded-proto")) : undefined)
      ?? req.protocol,
    host: (TRUST_PROXY ? firstHeaderValue(req.get("x-forwarded-host")) : undefined)
      ?? req.get("host"),
  });

/**
 * Crawl directives. Registered here, with the API routes, so they are matched
 * before the SPA fallback — served from the fallback they would be HTML.
 */
app.get("/robots.txt", (req, res) => {
  res.type("text/plain; charset=utf-8");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(robotsTxt(originFor(req)));
});

/**
 * Every crawlable address, built from the payload the API already holds.
 *
 * This file is load-bearing rather than a nicety: the round picker is a
 * `<select>`, not a set of links, so every round but the current one — and with
 * it nearly every fixture page — has no inbound link anywhere on the site.
 *
 * Failure degrades to the four section URLs rather than a 500, on the same
 * reasoning as the API envelope.
 */
app.get("/sitemap.xml", async (req, res) => {
  let context: {
    clubs?: Club[];
    matches?: Match[];
    stadiums?: Stadium[];
    updatedAt?: string;
  } = {};

  try {
    const payload = await loadMatches();
    context = {
      clubs: payload.data.clubs,
      matches: payload.data.matches,
      stadiums: buildStadiums(payload.data.matches, payload.data.clubs, STADIUMS),
      updatedAt: payload.updatedAt,
    };
  } catch (cause) {
    console.error("sitemap: dados indisponíveis:", cause);
  }

  res.type("application/xml; charset=utf-8");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(sitemapXml(originFor(req), sitemapEntries(context)));
});

/** Which routes name something that has to be looked up before the page can be
 *  titled, canonicalised or judged to exist. The rest need no data at all. */
const needsData = (route: Route): boolean =>
  route.section === "clube" ||
  route.section === "partida" ||
  route.section === "estadio" ||
  (route.section === "jogos" && route.round !== null);

/**
 * Render the SPA shell for one request: per-route metadata, structured data and
 * an honest status code.
 *
 * Shared by both halves of the fallback — the production static server and the
 * Vite dev middleware — rather than living only in the production branch. The
 * 404 rules and the JSON-LD are the parts most worth testing, and a dev server
 * that answered a cheerful 200 with a bare shell would put both beyond the
 * reach of the e2e suite.
 */
const renderShell = async (
  req: express.Request,
  res: express.Response,
  shell: string,
): Promise<void> => {
  const route = parseRoute(req.path);

  // Both come from the same cached payload the API serves — no extra upstream
  // request, and no call at all for the sections that name nothing.
  let context: MetaContext = {};
  if (needsData(route)) {
    try {
      const [matchesEnvelope, standingsEnvelope] = await Promise.all([
        loadMatches(),
        loadStandings(),
      ]);
      context = {
        clubs: matchesEnvelope.data.clubs,
        matches: matchesEnvelope.data.matches,
        standings: standingsEnvelope.data,
        // Derived from the same payload rather than fetched: no provider has a
        // stadium entity, so grouping the fixtures is what makes one.
        stadiums: buildStadiums(
          matchesEnvelope.data.matches,
          matchesEnvelope.data.clubs,
          STADIUMS,
        ),
      };
    } catch (cause) {
      // Metadata is a nicety; never fail the page over it. `pageStatus` reads
      // an absent list as "cannot prove this is missing" and answers 200, so a
      // provider outage degrades the metadata without 404-ing the catalogue.
      console.error("metadados: dados indisponíveis:", cause);
    }
  }

  const status = pageStatus(req.path, context);
  const origin = originFor(req);
  const meta = pageMeta(route, context, origin);

  res.status(status.status);
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(
    injectMeta(shell, meta, {
      canonicalUrl: canonicalUrl(origin, route, context) ?? undefined,
      noindex: !status.index,
      // A page that does not exist gets no structured data: describing a
      // SportsEvent on a 404 asserts the fixture is real.
      jsonLd: status.index
        ? jsonLdScript(structuredData(route, context, origin, meta.description))
        : undefined,
    }),
  );
};

/** Whether a URL survives percent-decoding. Both the router and Vite decode
 *  what they are handed, and neither is prepared for a malformed escape. */
const decodable = (value: string): boolean => {
  try {
    decodeURIComponent(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * Register the SPA fallback, and the guard that has to come before it.
 *
 * `app.get("*")` matches through a wildcard **parameter**, and Express
 * percent-decodes parameters while matching — so `/clube/%` throws `URIError`
 * inside the router and Express answers its own 400 error page before any
 * handler runs. A crawler will send one of those eventually. The guard decodes
 * first and, when it cannot, hands the request to the same renderer as any
 * other address that names nothing: the app, and a 404.
 */
const registerSpaFallback = (shellFor: (req: express.Request) => Promise<string>): void => {
  const serve: express.RequestHandler = async (req, res, next) => {
    try {
      await renderShell(req, res, await shellFor(req));
    } catch (cause) {
      next(cause);
    }
  };

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();

    return decodable(req.path) ? next() : serve(req, res, next);
  });

  app.get("*", serve);
};

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    // What is actually running. `version` stayed at 0.1.0 for every deploy ever
    // made and answered nothing; the commit does.
    sha: BUILD_SHA,
    builtAt: BUILD_TIME,
    uptime: process.uptime(),
    provider: providerEnabled() ? "football-data" : "seed",
  });
});

app.get("/api/clubs", async (_req, res) => {
  const matches = await loadMatches();
  res.json(envelope(matches.data.clubs, matches.source, Date.parse(matches.updatedAt)));
});

const loadScorers = (): Promise<ApiEnvelope<Scorer[]>> =>
  loadCached<Scorer[]>(
    "scorers",
    SCORERS_CACHE_TTL_MS,
    async () => mapScorers(await fetchFromProvider<ScorersResponse>(scorersUrl())),
    () => SEED_SCORERS,
  );

app.get("/api/scorers", async (_req, res) => {
  const payload = await loadScorers();
  res.set("Cache-Control", "public, max-age=300");
  res.json(payload);
});

/**
 * Every club's elenco, from the one team-list request that carries all twenty.
 *
 * The clubs arriving on each squad are enriched the same way standings rows
 * are, and for the same reason: the team payload has no website, handle, hymn
 * or article, and the committed list does.
 */
const loadSquads = (): Promise<ApiEnvelope<Squad[]>> =>
  loadCached<Squad[]>(
    "squads",
    SQUADS_CACHE_TTL_MS,
    async () => {
      const squads = mapSquads(await fetchFromProvider<TeamsResponse>(teamsUrl()));
      const enriched = withClubDetails(
        squads.map((squad) => squad.club),
        CLUBS,
      );
      return sortSquads(squads.map((squad, index) => ({ ...squad, club: enriched[index] })));
    },
    () => sortSquads(SEED_SQUADS),
  );

app.get("/api/squads", async (_req, res) => {
  const payload = await loadSquads();
  // An elenco is the most static thing the app serves; see SQUADS_CACHE_TTL_MS.
  res.set("Cache-Control", "public, max-age=3600");
  res.json(payload);
});

/**
 * Enrichment for the player card: shirt number, position, nationality, birth
 * date. There is no seed for this — the card is built from data already on the
 * page and this only fills gaps — so the offline answer is an honest null
 * rather than invented detail.
 */
app.get("/api/players/:id", async (req, res) => {
  const id = req.params.id;
  if (!/^\d+$/.test(id)) {
    res.status(400).json({ error: "O identificador do jogador deve ser numérico." });
    return;
  }

  const payload = await loadCached<Player | null>(
    `player:${id}`,
    PLAYER_CACHE_TTL_MS,
    async () => mapPerson(await fetchFromProvider<PersonResponse>(personUrl(id))),
    () => null,
  );

  res.set("Cache-Control", "public, max-age=3600");
  res.json(payload);
});

app.get("/api/standings", async (_req, res) => {
  const payload = await loadStandings();
  res.set("Cache-Control", "public, max-age=60");
  res.json(payload);
});

app.get("/api/matches", async (req, res) => {
  const requested = req.query.round;
  const payload = await loadMatches();

  if (requested === undefined) {
    res.set("Cache-Control", "public, max-age=30");
    res.json(payload);
    return;
  }

  const round = Number(requested);
  if (!Number.isInteger(round) || round < 1) {
    res.status(400).json({ error: "O parâmetro 'round' deve ser um inteiro positivo." });
    return;
  }

  res.set("Cache-Control", "public, max-age=30");
  res.json({
    ...payload,
    data: {
      ...payload.data,
      currentRound: round,
      matches: matchesForRound(payload.data.matches, round),
    },
  });
});

const isPortAvailable = (port: number, host: string) =>
  new Promise<boolean>((resolve, reject) => {
    const probe = createNetServer();

    probe.once("error", (error: NodeJS.ErrnoException) => {
      probe.close();
      if (error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }
      reject(error);
    });

    probe.once("listening", () => {
      probe.close((closeError) => (closeError ? reject(closeError) : resolve(true)));
    });

    probe.listen(port, host);
  });

/** Walk to the next free port so a stale dev server doesn't block a restart. */
const resolveAppPort = async () => {
  let candidate = DEFAULT_PORT;

  while (!(await isPortAvailable(candidate, HOST))) {
    if (STRICT_PORT) {
      throw new Error(`Port ${candidate} is already in use.`);
    }
    candidate += 1;
  }

  return candidate;
};

/**
 * One process serves both halves: Vite runs as middleware in development, and
 * the built bundle is served statically in production.
 */
async function startServer() {
  const port = await resolveAppPort();
  const httpServer = createHttpServer(app);

  if (IS_PRODUCTION) {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));

    const indexHtml = readFileSync(path.join(distPath, "index.html"), "utf8");

    // Per-route metadata, injected server-side. A link preview never runs
    // JavaScript, so the client-side title alone would leave every shared URL
    // unfurling as the generic site name.
    registerSpaFallback(async () => indexHtml);
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === "true" ? false : { server: httpServer },
      },
      // "custom", not "spa": Vite's SPA fallback would serve index.html itself
      // for every unmatched path, with a 200 and an untouched head — taking the
      // handler below out of the loop and hiding the metadata, the JSON-LD and
      // the 404 rules from the whole e2e suite. Assets still resolve, because
      // `vite.middlewares` runs first and only unmatched paths fall through.
      appType: "custom",
    });
    app.use(vite.middlewares);

    const shellPath = path.join(process.cwd(), "index.html");

    registerSpaFallback(async (req) => {
      try {
        // Read per request rather than once: the shell is an editable source
        // file in development, and HMR does not reach a string captured at boot.
        // Vite percent-decodes this URL to resolve which HTML file is being
        // asked for, so a path that could not be decoded in the first place has
        // to arrive as the shell's own address. It is the same document either
        // way — only the lookup differs — and without this the guard above
        // turns a 400 from the router into a 500 from here.
        const url = decodable(req.originalUrl) ? req.originalUrl : "/";
        return await vite.transformIndexHtml(url, readFileSync(shellPath, "utf8"));
      } catch (cause) {
        vite.ssrFixStacktrace(cause as Error);
        throw cause;
      }
    });
  }

  httpServer.listen(port, HOST, () => {
    if (port !== DEFAULT_PORT) {
      console.warn(`Port ${DEFAULT_PORT} was busy, using ${port} instead.`);
    }
    console.log(
      `Portal Brasileirão running on port ${port} ` +
        `(fonte: ${providerEnabled() ? "football-data.org" : "dados congelados"})`,
    );
  });
}

void startServer();
