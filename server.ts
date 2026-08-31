import { randomUUID } from "node:crypto";
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
import { withGoals } from "@/goals-core";
import { withLineups } from "@/escalacao-core";
import { withHighlights } from "@/match-core";
import { coachesOf, slugify, withClubDetails, withHymns, withInstagram, withWikipedia } from "@/club-core";
import { compareForFeed, currentRound, matchesForRound, roundsOf } from "@/matches-core";
import { injectMeta, pageMeta, type MetaContext } from "@/page-meta-core";
import { parseRoute, type Route } from "@/route-core";
import { buildStadiums } from "@/venue-core";
import { buildWeatherUrl, parseWeather } from "@/weather-core";
import { STADIUMS } from "@/src/data/stadiums";
import {
  canonicalUrl,
  pageStatus,
  resolveOrigin,
  robotsTxt,
  sitemapEntries,
  sitemapXml,
} from "@/seo-core";
import {
  newAccountId,
  normaliseDisplayName,
  publicAccount,
  type Account,
} from "@/account-core";
import {
  hasPreferences,
  NO_PREFERENCES,
  parsePreferences,
  serialisePreferences,
} from "@/preferences-core";
import { openStore } from "@/account-store";
import {
  authorizeUrl,
  challengeFor,
  decodeIdTokenClaims,
  GOOGLE_TOKEN_URL,
  newVerifier,
  verifyClaims,
} from "@/oauth-core";
import {
  evictFull,
  freshBucket,
  spend,
  type Bucket,
  type BucketPolicy,
} from "@/rate-limit-core";
import {
  clearCookie,
  digestsMatch,
  hashToken,
  mintToken,
  readCookie,
  serialiseCookie,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  sessionState,
  shouldRenew,
} from "@/session-core";
import { jsonLdScript, structuredData } from "@/structured-data-core";
import { withPlayerOverrides, withScorerNames, withSquadOverrides } from "@/player-core";
import { sortSquads } from "@/squad-core";
import { computeStandings } from "@/standings-core";
import { CLUBS as SEED_CLUBS } from "@/src/data/clubs";
import { CLUB_HYMNS } from "@/src/data/club-hymns";
import { CLUB_INSTAGRAM } from "@/src/data/club-instagram";
import { CLUB_WIKIPEDIA } from "@/src/data/club-wikipedia";
import { BROADCASTS } from "@/src/data/broadcasts";
import { GOALS } from "@/src/data/goals";
import { ESCALACOES } from "@/src/data/escalacoes";
import { HIGHLIGHTS } from "@/src/data/highlights";
import { VENUES } from "@/src/data/venues";
import { SEED_MATCHES, SNAPSHOT_DATE } from "@/src/data/matches";
import { PLAYER_OVERRIDES } from "@/src/data/player-overrides";
import { SEED_SCORERS } from "@/src/data/scorers";
import { SEED_SQUADS } from "@/src/data/squads";
import type {
  ApiEnvelope,
  Club,
  ClubCode,
  Match,
  Player,
  Scorer,
  Squad,
  Stadium,
  StandingsRow,
  WeatherSnapshot,
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
/**
 * The **clima**'s own kill switch, separate from the provider's on purpose. The
 * two upstreams fail independently — Open-Meteo having a bad afternoon says
 * nothing about the scores — so one flag covering both would take the table off
 * the page to silence a weather card. It is also what the end-to-end suite sets,
 * for the reason it sets `DISABLE_FOOTBALL_DATA`: a spec that reached a live
 * forecast would assert against a sky that changes.
 */
const WEATHER_DISABLED = process.env.DISABLE_WEATHER === "true";
const FETCH_TIMEOUT_MS = Number(process.env.FOOTBALL_DATA_TIMEOUT_MS ?? 6000);
/** Conditions do not move faster than this, and a match page is read by many
 *  people at once — so twenty readers cost one upstream request. */
const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000;
/** Shorter than the provider's: the weather is a nicety on a page that has
 *  already rendered, and a slow third party must not hold a request open. */
const WEATHER_TIMEOUT_MS = Number(process.env.WEATHER_TIMEOUT_MS ?? 4000);

const providerEnabled = (): boolean => Boolean(FOOTBALL_DATA_TOKEN) && !PROVIDER_DISABLED;

/** ISO snapshot date as dd/mm/aaaa, for pt-BR copy. */
const snapshotLabel = SNAPSHOT_DATE.split("-").reverse().join("/");

const NOTE_LIVE = "Dados do football-data.org (Campeonato Brasileiro Série A).";
const NOTE_WEATHER = "Condições atuais no estádio, do Open-Meteo.";
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

// The content API must be crawlable — this app renders on the client, so
// `Disallow: /api/` left Googlebot with an empty shell and a soft 404 on every
// page. `robotsTxt` in `seo-core.ts` carries the measurement. Keeping the JSON
// out of the *index* is the separate job, and this header is what does it: a
// crawler can only obey `noindex` on a resource it was allowed to fetch, which
// is exactly why the disallow could not do this job.
//
// A subresource's header does not propagate to the document that loaded it, so
// this does not noindex the pages rendered from these payloads.
//
// Mounted immediately after the app exists so it covers every /api route
// whatever order they are registered in: `app.use` applies only to what
// follows it, and /api/auth and /api/account are registered well above the
// content routes.
app.use("/api", (_req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex");
  next();
});

const envelope = <T>(
  data: T,
  source: ApiEnvelope<T>["source"],
  updatedAt: number,
): ApiEnvelope<T> => ({
  source,
  note:
    source === "football-data"
      ? NOTE_LIVE
      : source === "open-meteo"
        ? NOTE_WEATHER
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
  matches: withLineups(
    withGoals(
      withHighlights(
        withVenues(withBroadcasters([...SEED_MATCHES].sort(compareForFeed), BROADCASTS), VENUES),
        HIGHLIGHTS,
      ),
      GOALS,
    ),
    ESCALACOES,
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
      // Curated channels, venues, highlights and goals ride along with live
      // fixtures too — the provider supplies none of them. Applied in **both**
      // branches on purpose: the suite exercises the seed one and production
      // the other, which is exactly the split that would hide a difference.
      matches: withLineups(
        withGoals(
          withHighlights(
            withVenues(withBroadcasters([...matches].sort(compareForFeed), BROADCASTS), VENUES),
            HIGHLIGHTS,
          ),
          GOALS,
        ),
        ESCALACOES,
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
 * `app.get("/{*splat}")` matches through a wildcard **parameter**, and Express
 * percent-decodes parameters while matching — so `/clube/%` throws `URIError`
 * inside the router and Express answers its own 400 error page before any
 * handler runs. Express 5 did not change that: `decodeParam` in
 * path-to-regexp v8 still throws, verified by removing this guard and watching
 * `/clube/%` answer 400 from Express rather than 404 from the app. A crawler will send one of those eventually. The guard decodes
 * first and, when it cannot, hands the request to the same renderer as any
 * other address that names nothing: the app, and a 404.
 */
/* ------------------------------------------------------------------ *
 * Contas
 *
 * Phase 1 of `docs/accounts.md`. Everything below is inert unless the host
 * is configured for it — see `accountsEnabled`.
 * ------------------------------------------------------------------ */

/**
 * There is deliberately **no `SESSION_SECRET`**, and the plan's §3.9 expected
 * one.
 *
 * That section spends its length on the fact that a session secret has no safe
 * default: random-per-boot signs everybody out on every restart, and a
 * committed constant is a forged-session vulnerability in a public repo. Both
 * are true of a *signed* cookie. This does not have one. A session is 256 bits
 * of randomness stored as a SHA-256 digest in a table, so there is nothing to
 * sign, nothing to rotate, and no secret whose absence has to be handled.
 *
 * The same reasoning covers the sign-in transaction below: `state`, `nonce` and
 * the PKCE verifier only have to survive from our own response to our own next
 * request, and the `__Host-` prefix is what a browser enforces to keep any
 * other origin — including a sibling subdomain — from writing that cookie.
 */
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();

/**
 * Where the database lives.
 *
 * Default is under the app directory rather than `/var/lib`, and that is a
 * property of the host rather than a preference: the systemd unit sets
 * `ProtectSystem=strict` with `ReadWritePaths=${DEPLOY_DIR}`, so anywhere else
 * is read-only to the process until `03_install_systemd_service.sh` is edited.
 * It is outside `dist/`, which both rsyncs delete and `express.static` serves.
 */
const ACCOUNTS_DB = process.env.ACCOUNTS_DB ?? path.join(process.cwd(), "data", "accounts.db");

/**
 * A local identity, for tests only.
 *
 * An OAuth round trip in the end-to-end suite would need a Google client and
 * network access, which would break the rule that a red build always means the
 * code broke. This is the `DISABLE_FOOTBALL_DATA` shape applied to sign-in.
 *
 * **It refuses to exist in production, and the check is at boot rather than per
 * request** — a misconfigured host dies loudly on start instead of serving an
 * open door that looks exactly like a working site.
 */
const ACCOUNTS_DEV_LOGIN = process.env.ACCOUNTS_DEV_LOGIN === "true";
if (ACCOUNTS_DEV_LOGIN && IS_PRODUCTION) {
  console.error(
    "[accounts] ACCOUNTS_DEV_LOGIN is set in production. That endpoint mints a session " +
      "for anybody who asks. Refusing to start.",
  );
  process.exit(1);
}

const GOOGLE_CONFIGURED = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

/**
 * Opened once, at boot, and `null` when it cannot be.
 *
 * Null is a supported state: a fresh clone with an empty `.env` gets the app it
 * has always had, minus a feature it never mentions. Nothing here half-renders
 * — the control does not appear, and the routes 404.
 */
const accountStore =
  GOOGLE_CONFIGURED || ACCOUNTS_DEV_LOGIN ? openStore(ACCOUNTS_DB) : null;

const accountsEnabled = (): boolean => accountStore !== null;

/**
 * `Secure`, always — never from the request, and not from configuration either.
 *
 * Two separate reasons, and the second one is the one that bites.
 *
 * Behind nginx `req.protocol` is `"http"`, because Express's `trust proxy` is
 * off here on purpose (`TRUST_PROXY` is this app's own flag and feeds only the
 * canonical origin). A cookie that believed the request would ship without
 * `Secure` in production, which is a session that leaks over any plaintext hop.
 *
 * And a **`__Host-` cookie without `Secure` is refused by the browser
 * outright** — the prefix is a rule the browser enforces, not a naming
 * convention. Deriving this from `APP_URL` therefore made sign-in *silently do
 * nothing* on a fresh clone with no `.env`: the server set the cookie, the
 * browser dropped it, `/api/account/me` answered null, and nothing anywhere
 * reported an error. Found by trying it.
 *
 * Unconditional is safe for local development because `localhost` and
 * `127.0.0.1` are secure contexts, so a `Secure` cookie is accepted there over
 * plain http. (`curl` declines to *send* one over http, which is a property of
 * curl rather than of the browser — verify this path with Playwright.)
 */
const cookieOptions = { secure: true };

/** Every account response is personal. There is an nginx in front of this app,
 *  and that file is rewritten by certbot and by `04_setup_nginx.sh`, so "there
 *  is no shared cache in front" is a fact about a file nobody owns. */
const noStore = (res: express.Response): void => {
  res.set("Cache-Control", "private, no-store");
  res.set("Vary", "Cookie");
};

/**
 * Reject a state-changing request that did not come from our own pages.
 *
 * `SameSite=Lax` already blocks a cross-site POST, so this is the second lock:
 * it fails closed, needs no token plumbed through the client, and costs one
 * header comparison. A token scheme is only worth it if this app ever needs
 * `SameSite=None`.
 */
const sameOrigin = (req: express.Request): boolean => {
  const origin = req.get("origin");
  if (!origin) return true; // Not sent on same-origin form posts by every browser.
  return origin === originFor(req);
};

const SIGN_IN_POLICY: BucketPolicy = { capacity: 10, refillMs: 60_000 };
const signInBuckets = new Map<string, Bucket>();

/** Keyed on the client-most forwarded address, the same rule `firstHeaderValue`
 *  already implements for the canonical origin. In memory because there is one
 *  process; it resets on deploy, which is acceptable and is written down here
 *  rather than remembered. */
const rateLimited = (req: express.Request, now: number): boolean => {
  const key = firstHeaderValue(req.get("x-forwarded-for")) ?? req.ip ?? "unknown";
  const decision = spend(signInBuckets.get(key) ?? freshBucket(SIGN_IN_POLICY, now), SIGN_IN_POLICY, now);
  signInBuckets.set(key, decision.bucket);
  if (signInBuckets.size > 1000) evictFull(signInBuckets, SIGN_IN_POLICY, now);
  return !decision.allowed;
};

const TRANSACTION_COOKIE = "__Host-pb_auth";
const TRANSACTION_TTL_MS = 10 * 60 * 1000;

interface SignInTransaction {
  state: string;
  nonce: string;
  verifier: string;
}

/**
 * The session behind a request, or null.
 *
 * Renews on the way past when the session is more than halfway through its
 * life, which mints a **new** token rather than extending the old one: a
 * renewed session should not keep a value that has been in flight for a month.
 */
const currentAccount = (req: express.Request, res: express.Response): Account | null => {
  if (!accountStore) return null;

  const token = readCookie(req.get("cookie"), SESSION_COOKIE);
  if (!token) return null;

  const session = accountStore.findSession(hashToken(token));
  if (!session) return null;

  const now = Date.now();
  if (sessionState(session, now) === "expired") {
    accountStore.endSession(session.tokenHash);
    res.append("Set-Cookie", clearCookie(SESSION_COOKIE, cookieOptions));
    return null;
  }

  if (shouldRenew(session, now)) {
    const next = mintToken();
    accountStore.replaceSession(session.tokenHash, {
      tokenHash: hashToken(next),
      accountId: session.accountId,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });
    res.append(
      "Set-Cookie",
      serialiseCookie(SESSION_COOKIE, next, { ...cookieOptions, maxAgeMs: SESSION_TTL_MS }),
    );
  }

  return accountStore.findAccount(session.accountId);
};

/** Start a session for an account, rotating any token the request arrived with.
 *  Never adopt a session identifier from outside. */
const beginSession = (res: express.Response, accountId: string, now: number): void => {
  if (!accountStore) return;
  const token = mintToken();
  accountStore.startSession({
    tokenHash: hashToken(token),
    accountId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  res.append(
    "Set-Cookie",
    serialiseCookie(SESSION_COOKIE, token, { ...cookieOptions, maxAgeMs: SESSION_TTL_MS }),
  );
};

/**
 * The reader's preferences, narrowed the way the client narrows them.
 *
 * The stored value goes through `parsePreferences`, the same function that
 * tolerates junk in `localStorage`, so a row written by a build that knew a key
 * this one does not is dropped rather than served. Storing the whole object
 * under one key keeps the two sides speaking the same shape.
 */
const preferencesOf = (accountId: string) => {
  if (!accountStore) return NO_PREFERENCES;
  return parsePreferences(accountStore.readPreferences(accountId).preferences);
};

/** Absent feature, not broken feature. */
const requireAccounts = (res: express.Response): boolean => {
  if (accountsEnabled()) return true;
  noStore(res);
  res.status(404).json({ error: "Contas não estão disponíveis nesta instalação." });
  return false;
};

/**
 * Sweep expired sessions hourly, and once at boot.
 *
 * `pruneSessions` existed through Phase 1 with nothing calling it. An expired
 * row authenticates nobody, so this is not a security fix — it is §5: a row
 * saying when a person was last here, kept for no stated purpose, is personal
 * data retained without a reason. `unref` so the timer never holds the process
 * open, which is what would make a container refuse to stop.
 */
if (accountStore) {
  const sweep = () => {
    const removed = accountStore.pruneSessions(Date.now());
    if (removed > 0) console.log(`[accounts] pruned ${removed} expired session(s)`);
  };
  sweep();
  setInterval(sweep, 60 * 60 * 1000).unref();
}

app.get("/api/auth/google", (req, res) => {
  if (!requireAccounts(res)) return;
  noStore(res);

  if (!GOOGLE_CONFIGURED) {
    res.status(404).json({ error: "Entrar com o Google não está disponível." });
    return;
  }
  if (rateLimited(req, Date.now())) {
    res.status(429).json({ error: "Muitas tentativas. Tente de novo em instantes." });
    return;
  }

  const transaction: SignInTransaction = {
    state: mintToken(),
    nonce: mintToken(),
    verifier: newVerifier(),
  };

  res.append(
    "Set-Cookie",
    serialiseCookie(
      TRANSACTION_COOKIE,
      Buffer.from(JSON.stringify(transaction)).toString("base64url"),
      { ...cookieOptions, maxAgeMs: TRANSACTION_TTL_MS },
    ),
  );

  res.redirect(
    authorizeUrl({
      clientId: GOOGLE_CLIENT_ID,
      redirectUri: `${originFor(req)}/api/auth/callback`,
      state: transaction.state,
      nonce: transaction.nonce,
      codeChallenge: challengeFor(transaction.verifier),
    }),
  );
});

/**
 * Where Google sends the reader back.
 *
 * Every exit from here is a **redirect**, never a JSON body: this is a
 * top-level navigation in a browser, and the reader must end up on a page. The
 * failure exits carry a short reason in the query, which `SignInView` turns
 * into one pt-BR sentence — deliberately vaguer than the reason logged here,
 * because "audience mismatch" tells a reader nothing and an attacker probing
 * the callback a great deal.
 */
app.get("/api/auth/callback", async (req, res) => {
  if (!requireAccounts(res)) return;
  noStore(res);

  const fail = (reason: string, detail?: string) => {
    console.warn(`[accounts] sign-in refused: ${detail ?? reason}`);
    res.redirect(`/entrar?erro=${encodeURIComponent(reason)}`);
  };

  if (typeof req.query.error === "string") return fail("denied", `provider: ${req.query.error}`);

  const raw = readCookie(req.get("cookie"), TRANSACTION_COOKIE);
  // The transaction cookie is cleared on every exit, success or not: a state
  // that has been presented once must never be presentable again.
  res.append("Set-Cookie", clearCookie(TRANSACTION_COOKIE, cookieOptions));

  if (!raw) return fail("state", "no transaction cookie");

  let transaction: SignInTransaction;
  try {
    transaction = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as SignInTransaction;
  } catch {
    return fail("state", "unreadable transaction cookie");
  }

  const code = req.query.code;
  const state = req.query.state;
  if (typeof code !== "string" || typeof state !== "string") return fail("state", "missing code");
  if (!digestsMatch(state, transaction.state)) return fail("state", "state mismatch");

  let idToken: string;
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${originFor(req)}/api/auth/callback`,
        grant_type: "authorization_code",
        code_verifier: transaction.verifier,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) return fail("provider", `token endpoint ${response.status}`);
    const payload = (await response.json()) as { id_token?: unknown };
    if (typeof payload.id_token !== "string") return fail("provider", "no id_token");
    idToken = payload.id_token;
  } catch (error) {
    return fail("provider", `token exchange failed: ${(error as Error).message}`);
  }

  const now = Date.now();
  const verdict = verifyClaims(decodeIdTokenClaims(idToken), {
    clientId: GOOGLE_CLIENT_ID,
    nonce: transaction.nonce,
    now,
  });
  if (!verdict.ok) return fail("provider", `claims: ${verdict.reason}`);

  const account = accountStore!.upsertAccount({
    id: newAccountId(() => randomUUID().replace(/-/g, "")),
    provider: "google",
    subject: verdict.subject,
    displayName: normaliseDisplayName(verdict.name),
    now,
  });

  beginSession(res, account.id, now);
  // Log the account id, which is opaque by construction, and never the
  // subject, the name, or anything that identifies a person.
  console.log(`[accounts] signed in ${account.id}`);
  res.redirect("/conta");
});

/**
 * A session with no third party, for tests.
 *
 * Registered only when `ACCOUNTS_DEV_LOGIN` is set, which cannot happen in
 * production — the process refuses to start above. Registering it conditionally
 * rather than guarding inside the handler means that in production the route
 * does not exist at all, which is a stronger statement than a route that exists
 * and declines.
 */
if (ACCOUNTS_DEV_LOGIN) {
  app.post("/api/auth/dev-login", express.json(), (req, res) => {
    if (!requireAccounts(res)) return;
    noStore(res);
    if (!sameOrigin(req)) {
      res.status(403).json({ error: "Origem inválida." });
      return;
    }

    const body = (req.body ?? {}) as { subject?: unknown; name?: unknown };
    const subject = typeof body.subject === "string" && body.subject ? body.subject : "dev";
    const now = Date.now();

    const account = accountStore!.upsertAccount({
      id: newAccountId(() => randomUUID().replace(/-/g, "")),
      provider: "dev",
      subject,
      displayName: normaliseDisplayName(typeof body.name === "string" ? body.name : "Torcedor"),
      now,
    });

    beginSession(res, account.id, now);
    res.json(publicAccount(account, preferencesOf(account.id)));
  });
}

/**
 * Who is asking, or `null`.
 *
 * **Null rather than 401**, and that is not laziness: this is called on every
 * page load by a client that mostly has no session, and a 401 would put a red
 * line in the console of a perfectly healthy page for every signed-out reader —
 * which is most of them, permanently, by design.
 */
app.get("/api/account/me", (req, res) => {
  if (!requireAccounts(res)) return;
  noStore(res);
  const account = currentAccount(req, res);
  res.json(account ? publicAccount(account, preferencesOf(account.id)) : null);
});

app.post("/api/auth/logout", (req, res) => {
  if (!requireAccounts(res)) return;
  noStore(res);
  if (!sameOrigin(req)) {
    res.status(403).json({ error: "Origem inválida." });
    return;
  }

  const token = readCookie(req.get("cookie"), SESSION_COOKIE);
  const all = req.query.todos === "true";

  if (token && accountStore) {
    const session = accountStore.findSession(hashToken(token));
    if (session) {
      if (all) accountStore.endAllSessions(session.accountId);
      else accountStore.endSession(session.tokenHash);
    }
  }

  res.append("Set-Cookie", clearCookie(SESSION_COOKIE, cookieOptions));
  res.status(204).end();
});

/**
 * Replace the reader's preference set.
 *
 * A whole-object PUT rather than a patch per key. That was cheap to say while
 * there was one key and is the load-bearing choice now that there are two: the
 * client always holds the complete set, so a patch would be a merge rule living
 * here that has to agree with `planSync` living there — a second place for the
 * two to disagree, over a body that saves a dozen bytes.
 *
 * What it costs is that a client sending a *partial* body silently clears
 * whatever it left out. That is the rule, not a bug — replace means replace —
 * and it is why `usePreferences` uploads `preferences` rather than the key it
 * just changed.
 */
app.put("/api/account/preferences", express.json({ limit: "4kb" }), (req, res) => {
  if (!requireAccounts(res)) return;
  noStore(res);
  if (!sameOrigin(req)) {
    res.status(403).json({ error: "Origem inválida." });
    return;
  }

  const account = currentAccount(req, res);
  if (!account) {
    res.status(401).json({ error: "Você não está conectado." });
    return;
  }

  // Narrowed through the same parser the client uses, so a body this build does
  // not understand becomes "follows nobody" rather than a stored surprise.
  const preferences = parsePreferences(JSON.stringify(req.body ?? {}));
  accountStore!.writePreference(
    account.id,
    "preferences",
    // `hasPreferences` rather than a check on one field: the row is deleted
    // only when there is nothing left to remember, so clearing a club does not
    // take a landing choice with it.
    hasPreferences(preferences) ? serialisePreferences(preferences) : null,
    Date.now(),
  );

  res.json(publicAccount(account, preferences));
});

/** The LGPD erasure right: a delete, in one transaction, cascading to every
 *  session. Not a flag, and not a support ticket. */
app.delete("/api/account", (req, res) => {
  if (!requireAccounts(res)) return;
  noStore(res);
  if (!sameOrigin(req)) {
    res.status(403).json({ error: "Origem inválida." });
    return;
  }

  const account = currentAccount(req, res);
  if (!account) {
    res.status(401).json({ error: "Você não está conectado." });
    return;
  }

  accountStore!.deleteAccount(account.id);
  res.append("Set-Cookie", clearCookie(SESSION_COOKIE, cookieOptions));
  console.log(`[accounts] deleted ${account.id}`);
  res.status(204).end();
});

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

  // Express 5 (path-to-regexp v8) rejects a bare `"*"` at REGISTRATION time —
  // `Missing parameter name at index 1` — so the server would not boot at all.
  // `/{*splat}` is the same catch-all: verified against express 5.2.1 to match
  // `/`, any depth of deep link, and HEAD, while still 404-ing a POST and
  // leaving the `/api/*` routes registered above it untouched.
  app.get("/{*splat}", serve);
};

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    // What is actually running. `version` stayed at 0.1.0 for every deploy ever
    // made and answered nothing; the commit does.
    sha: BUILD_SHA,
    builtAt: BUILD_TIME,
    uptime: process.uptime(),
    // The Node the host is ACTUALLY running, which nothing else could answer.
    // `tsc --noEmit` is the only lint gate and it checks against @types/node,
    // so the host's major is what decides whether the gate checked the code
    // that shipped — and until this line, no file in the repo pinned it and no
    // endpoint reported it. The .nvmrc/engines/@types/node trio says what it
    // is SUPPOSED to be; this says what it is.
    node: process.versions.node,
    provider: providerEnabled() ? "football-data" : "seed",
  });
});

app.get("/api/clubs", async (_req, res) => {
  const matches = await loadMatches();
  res.json(envelope(matches.data.clubs, matches.source, Date.parse(matches.updatedAt)));
});

/**
 * The artilharia.
 *
 * `withScorerNames` is applied inside **both** branches rather than once around
 * the pair, so the corrected name is what the cache holds and the live and
 * offline answers cannot come to differ: the suite runs the seed branch and
 * production runs the other, which is exactly the split that hides a bug here.
 */
const loadScorers = (): Promise<ApiEnvelope<Scorer[]>> =>
  loadCached<Scorer[]>(
    "scorers",
    SCORERS_CACHE_TTL_MS,
    async () =>
      withScorerNames(
        mapScorers(await fetchFromProvider<ScorersResponse>(scorersUrl())),
        PLAYER_OVERRIDES,
      ),
    () => withScorerNames(SEED_SCORERS, PLAYER_OVERRIDES),
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
      return withSquadOverrides(
        sortSquads(squads.map((squad, index) => ({ ...squad, club: enriched[index] }))),
        PLAYER_OVERRIDES,
      );
    },
    () => withSquadOverrides(sortSquads(SEED_SQUADS), PLAYER_OVERRIDES),
  );

app.get("/api/squads", async (_req, res) => {
  const payload = await loadSquads();
  // An elenco is the most static thing the app serves; see SQUADS_CACHE_TTL_MS.
  res.set("Cache-Control", "public, max-age=3600");
  res.json(payload);
});

/**
 * Every club's head coach, keyed by club code.
 *
 * **A projection of the squads payload, not a second fetch.** The coach and the
 * elenco arrive on the same team objects, so this reads `loadSquads()` and
 * therefore shares its cache entry in both directions: opening a club page
 * warms the Jogadores page and vice versa, and the endpoint costs **nothing**
 * beyond the one team-list request the app already makes.
 *
 * It exists at all because the club page is not built from that payload. A
 * fixture names two clubs and no coach, and neither does a standings row, so
 * without this route the club page could only show whatever coach the last
 * `sync-seed-data` froze into `clubs.ts` — which for a Série A club is a claim
 * that expires quickly. Twenty names is a payload small enough that fetching it
 * separately is cheaper than putting the elenco behind the club page.
 *
 * A club upstream lists no coach for is **absent from the map** rather than
 * present with an empty name; see `coachesOf`.
 */
const loadCoaches = async (): Promise<ApiEnvelope<Record<ClubCode, string>>> => {
  const squads = await loadSquads();
  return { ...squads, data: coachesOf(squads.data.map((squad) => squad.club)) };
};

app.get("/api/coaches", async (_req, res) => {
  const payload = await loadCoaches();
  // Same cache as the elenco it is projected from, for the same reason: a coach
  // changes between matches at worst, never between requests.
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
    async () => {
      const person = mapPerson(await fetchFromProvider<PersonResponse>(personUrl(id)));
      // The name here renders nowhere — `mergePlayer` deliberately keeps the
      // card's existing one, so that correction already arrived with the squad
      // row or the scorer. The **nationality** does render, though: `mergePlayer`
      // takes `extra.nationality` in preference, so without this the card would
      // undo a correction the elenco had already applied, a second after opening.
      return person && withPlayerOverrides(person, PLAYER_OVERRIDES);
    },
    () => null,
  );

  res.set("Cache-Control", "public, max-age=3600");
  res.json(payload);
});

/**
 * **Clima no estádio.**
 *
 * Keyed by stadium **slug**, and the coordinate is resolved here from
 * `STADIUMS` rather than accepted from the caller. The sibling app this was
 * modelled on takes `?lat&lng`, which is simpler and turns the deploy into an
 * open weather proxy for any point on earth — a cost somebody else pays, on our
 * bandwidth. A slug can only ever name one of nineteen grounds.
 *
 * The **envelope is the app's**, but the cache is not `loadCached`: that one is
 * wired to football-data's breaker and its `source`, and reusing it would put a
 * weather timeout on the provider's failure count. Fifteen minutes because
 * conditions do not move faster than that and a match page is read by many
 * people at once — twenty readers cost one upstream request.
 *
 * A ground with no coordinate, or a payload that will not parse, answers `null`
 * data rather than an error: the page then omits the card, which is what an
 * absent stadium fact already does for `opened`.
 */
app.get("/api/stadium-weather/:slug", async (req, res) => {
  const slug = slugify(req.params.slug);
  const facts = STADIUMS[slug];
  if (!facts) {
    res.status(404).json({ error: "Estádio não encontrado." });
    return;
  }

  const now = Date.now();
  const point = facts.coordinates;
  if (!point || WEATHER_DISABLED) {
    res.json(envelope<WeatherSnapshot | null>(null, "fallback", now));
    return;
  }

  const key = `weather:${slug}`;
  const hit = cache.read<WeatherSnapshot | null>(key, now);
  if (hit) {
    res.set("Cache-Control", "public, max-age=300");
    res.json(envelope(hit.value, "open-meteo", hit.storedAt));
    return;
  }

  try {
    const response = await fetch(buildWeatherUrl(point), {
      signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Open-Meteo respondeu ${response.status}`);
    const snapshot = parseWeather(await response.json(), new Date(now).toISOString());
    // (key, value, ttlMs, now) — not (…, now, ttlMs). Swapping the last two
    // still expires the entry at the right instant, because `expiresAt` is
    // their sum, so the only symptom is `storedAt` and it read
    // `1970-01-01T00:15:00Z` in `updatedAt` on every cache hit.
    cache.write(key, snapshot, WEATHER_CACHE_TTL_MS, now);
    res.set("Cache-Control", "public, max-age=300");
    res.json(envelope(snapshot, "open-meteo", now));
  } catch {
    // No breaker: one upstream's outage must not open the other's, and a
    // fifteen-minute cache already caps what a hard-down Open-Meteo costs.
    res.json(envelope<WeatherSnapshot | null>(null, "fallback", now));
  }
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
