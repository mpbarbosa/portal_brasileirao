import { defineConfig, devices } from "@playwright/test";

/**
 * The port the suite boots its own server on.
 *
 * Overridable because several Claude sessions share this checkout and each takes
 * its own worktree, and two of them cannot run the suite at once on one port:
 * `STRICT_PORT` below is deliberate — a suite that quietly moved to 3101 would
 * be testing a server the config did not describe — so the collision is a hard
 * failure rather than a walk upward like `resolveAppPort` does for `npm run dev`.
 *
 * Default unchanged, so CI needs no environment: it runs alone and has the port
 * to itself. A second worktree runs `E2E_PORT=3101 npm run test:e2e`.
 */
const port = Number(process.env.E2E_PORT ?? 3100);

/**
 * Which server the suite drives.
 *
 * The default, `dev`, boots `server.ts` through tsx with Vite in middleware
 * mode — fast feedback, and what every spec has always run against.
 *
 * `bundle` boots `dist/server.cjs` under `NODE_ENV=production` instead, which
 * is what the host actually runs. That branch of `server.ts` is genuinely
 * different code: it serves `dist/` through `express.static`, reads the shell
 * **once at boot** rather than per request, and has no Vite anywhere. Until
 * this existed the 300-odd specs gating every release never touched it, and
 * `check` only asked the bundle three questions — health, standings, and that
 * the index says "Portal Brasileirão".
 *
 * Only the specs covering a path production has and development does not run
 * in this mode. Re-running the whole suite against the bundle would double the
 * wall clock to re-assert things Vite already proved.
 */
const target = process.env.PLAYWRIGHT_TARGET ?? "dev";
const isBundle = target === "bundle";

export default defineConfig({
  testDir: "./tests/e2e",
  // The crawl surface, the injected metadata and the 404 rules — the three
  // things `registerSpaFallback` and `injectMeta` decide, and the three that
  // reach a reader through a code path only production takes.
  ...(isBundle
    ? { testMatch: ["seo.spec.ts", "page-meta.spec.ts", "routing.spec.ts"] }
    : {}),
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: isBundle ? "node dist/server.cjs" : "npx tsx server.ts",
    url: `http://127.0.0.1:${port}/api/health`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      PORT: String(port),
      STRICT_PORT: "true",
      DISABLE_HMR: "true",
      // Production for the bundle, so `server.ts` takes the express.static /
      // read-the-shell-once branch rather than mounting Vite.
      ...(isBundle ? { NODE_ENV: "production" } : {}),
      // Serve the frozen snapshot, never the live API. Live scores, positions
      // and the current round all change during a match, so asserting against
      // them would make every run a coin flip. The kill switch also keeps the
      // suite from spending the 10 req/min free-tier budget.
      DISABLE_FOOTBALL_DATA: "true",
      // The **second** upstream, off for the same reason and not covered by the
      // flag above. Open-Meteo is free and key-less, so nothing stops a suite
      // reaching it — which is exactly the danger: the sky over the Maracanã
      // changes, so a spec asserting on a temperature or a description would be
      // a coin flip that passes all afternoon and fails at dusk. With this set
      // the endpoint answers `fallback` with null data and the card is absent,
      // which is the production shape whenever the weather is unreachable.
      // A spec that needs the card serves its own payload — see
      // tests/e2e/weather.spec.ts.
      DISABLE_WEATHER: "true",
      // A local identity, so sign-in is exercised without a Google client and
      // without network. `server.ts` refuses to start with this set when
      // NODE_ENV is production, so the suite cannot enable it anywhere real.
      // Emptied rather than omitted in bundle mode, and that is not tidiness:
      // `server.ts` REFUSES TO START with this set when NODE_ENV is production,
      // so a value inherited from the surrounding shell would take the whole
      // suite down with a message about a dev login nobody asked for. The
      // Contas specs are outside `testMatch` there for the same reason.
      ACCOUNTS_DEV_LOGIN: isBundle ? "" : "true",
      // One database per run, thrown away with test-results. Sessions are
      // shared state and the suite is `fullyParallel`, so a file per port is
      // what keeps two worktrees — and two projects — from writing each
      // other's rows. E2E_PORT is already the knob for running alongside
      // another session.
      ACCOUNTS_DB: `./test-results/accounts-${port}.db`,
    },
  },
});
