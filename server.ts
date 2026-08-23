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
  STANDINGS_CACHE_TTL_MS,
  TtlCache,
} from "@/cache-core";
import {
  authHeaders,
  clubsFromMatches,
  mapMatches,
  mapStandings,
  matchesUrl,
  standingsUrl,
  type MatchesResponse,
  type StandingsResponse,
} from "@/football-data-core";
import { compareForFeed, currentRound, matchesForRound, roundsOf } from "@/matches-core";
import { computeStandings } from "@/standings-core";
import { CLUBS } from "@/src/data/clubs";
import { SEED_MATCHES, SNAPSHOT_DATE } from "@/src/data/matches";
import type { ApiEnvelope, Club, Match, StandingsRow } from "@/src/types";

const DEFAULT_PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";
const STRICT_PORT = process.env.STRICT_PORT === "true";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

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
  matches: [...SEED_MATCHES].sort(compareForFeed),
  clubs: CLUBS,
});

const loadStandings = (): Promise<ApiEnvelope<StandingsRow[]>> =>
  loadCached<StandingsRow[]>(
    "standings",
    STANDINGS_CACHE_TTL_MS,
    async () => mapStandings(await fetchFromProvider<StandingsResponse>(standingsUrl())),
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
      matches: [...matches].sort(compareForFeed),
      clubs: clubsFromMatches(raw),
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

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    version: process.env.npm_package_version ?? "0.1.0",
    uptime: process.uptime(),
    provider: providerEnabled() ? "football-data" : "seed",
  });
});

app.get("/api/clubs", async (_req, res) => {
  const matches = await loadMatches();
  res.json(envelope(matches.data.clubs, matches.source, Date.parse(matches.updatedAt)));
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
    app.get("*", (_req, res) => {
      res.set("Content-Type", "text/html; charset=utf-8");
      res.send(indexHtml);
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === "true" ? false : { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(port, HOST, () => {
    if (port !== DEFAULT_PORT) {
      console.warn(`Port ${DEFAULT_PORT} was busy, using ${port} instead.`);
    }
    console.log(
      `Portal Brasileirão running on port ${port} ` +
        `(fonte: ${providerEnabled() ? "football-data.org" : "dados de demonstração"})`,
    );
  });
}

void startServer();
