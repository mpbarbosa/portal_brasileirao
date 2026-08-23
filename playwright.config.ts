import { defineConfig, devices } from "@playwright/test";

const port = 3100;

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
    },
  },
});
