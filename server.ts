import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { readFileSync } from "node:fs";
import path from "node:path";

import "dotenv/config";
import express from "express";

import { currentRound, compareForFeed, matchesForRound, roundsOf } from "@/matches-core";
import { computeStandings } from "@/standings-core";
import { CLUBS } from "@/src/data/clubs";
import { SEED_MATCHES } from "@/src/data/matches";
import type { ApiEnvelope } from "@/src/types";

const DEFAULT_PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";
const STRICT_PORT = process.env.STRICT_PORT === "true";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const PLACEHOLDER_NOTE =
  "Dados de demonstração — nenhuma fonte oficial conectada ainda.";

const app = express();

/**
 * Wrap a payload in the envelope every data endpoint returns. While the seed
 * fixtures are the only source, everything reports `source: "placeholder"`, so
 * the UI can label it rather than passing demo numbers off as live ones.
 */
const placeholder = <T>(data: T): ApiEnvelope<T> => ({
  source: "placeholder",
  note: PLACEHOLDER_NOTE,
  updatedAt: new Date().toISOString(),
  data,
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    version: process.env.npm_package_version ?? "0.1.0",
    uptime: process.uptime(),
  });
});

app.get("/api/clubs", (_req, res) => {
  res.json(placeholder(CLUBS));
});

app.get("/api/standings", (_req, res) => {
  res.json(placeholder(computeStandings(CLUBS, SEED_MATCHES)));
});

app.get("/api/matches", (req, res) => {
  const requested = req.query.round;

  if (requested === undefined) {
    res.json(
      placeholder({
        rounds: roundsOf(SEED_MATCHES),
        currentRound: currentRound(SEED_MATCHES),
        matches: [...SEED_MATCHES].sort(compareForFeed),
      }),
    );
    return;
  }

  const round = Number(requested);
  if (!Number.isInteger(round) || round < 1) {
    res.status(400).json({ error: "O parâmetro 'round' deve ser um inteiro positivo." });
    return;
  }

  res.json(
    placeholder({
      rounds: roundsOf(SEED_MATCHES),
      currentRound: round,
      matches: matchesForRound(SEED_MATCHES, round),
    }),
  );
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
    console.log(`Portal Brasileirão running on port ${port}`);
  });
}

void startServer();
