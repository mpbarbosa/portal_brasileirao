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

export default defineConfig({
  testDir: "./tests/e2e",
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
    command: "npx tsx server.ts",
    url: `http://127.0.0.1:${port}/api/health`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      PORT: String(port),
      STRICT_PORT: "true",
      DISABLE_HMR: "true",
      // Serve the frozen snapshot, never the live API. Live scores, positions
      // and the current round all change during a match, so asserting against
      // them would make every run a coin flip. The kill switch also keeps the
      // suite from spending the 10 req/min free-tier budget.
      DISABLE_FOOTBALL_DATA: "true",
      // A local identity, so sign-in is exercised without a Google client and
      // without network. `server.ts` refuses to start with this set when
      // NODE_ENV is production, so the suite cannot enable it anywhere real.
      ACCOUNTS_DEV_LOGIN: "true",
      // One database per run, thrown away with test-results. Sessions are
      // shared state and the suite is `fullyParallel`, so a file per port is
      // what keeps two worktrees — and two projects — from writing each
      // other's rows. E2E_PORT is already the knob for running alongside
      // another session.
      ACCOUNTS_DB: `./test-results/accounts-${port}.db`,
    },
  },
});
