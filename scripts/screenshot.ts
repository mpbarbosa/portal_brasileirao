/**
 * screenshot.ts
 * -------------
 * Capture the README screenshots.
 *
 * Points at the live site by default, so the images show real standings rather
 * than a frozen snapshot, and needs no local server. Pass a URL to shoot a dev
 * server instead.
 *
 * Usage:
 *   npx tsx scripts/screenshot.ts
 *   npx tsx scripts/screenshot.ts http://localhost:3000
 *   npx tsx scripts/screenshot.ts http://localhost:3000 dark
 *
 * The theme is set through localStorage before the page loads, using the same
 * key the app reads, so the inline no-flash script picks it up on first paint —
 * clicking the toggle after load would capture a repaint.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

import { THEME_STORAGE_KEY, type Theme } from "@/theme-core";

const SITE = "https://brasileirao.mpbarbosa.com";
const OUT_DIR = path.join(process.cwd(), "docs/screenshots");

const url = process.argv[2] ?? SITE;
const theme = (process.argv[3] ?? "light") as Theme;

if (theme !== "light" && theme !== "dark") {
  console.error(`Error: theme must be "light" or "dark", got "${theme}"`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  // The layout is capped at max-w-3xl, so a very wide shot is mostly empty
  // background. This is wide enough to show the full table without padding it
  // out with dead space.
  viewport: { width: 960, height: 900 },
  // 2x would make a full-page shot of a 20-row table needlessly heavy for a
  // README; 1.5 still looks sharp on a high-density display.
  deviceScaleFactor: 1.5,
  locale: "pt-BR",
  timezoneId: "America/Sao_Paulo",
});

await context.addInitScript(
  ([key, value]) => window.localStorage.setItem(key, value),
  [THEME_STORAGE_KEY, theme],
);

const page = await context.newPage();
console.log(`==> ${url} (${theme})`);
await page.goto(url, { waitUntil: "networkidle" });

// Wait for real content, not an empty shell.
await page.locator("table tbody tr").first().waitFor({ timeout: 30_000 });
await page.locator("table tbody tr").nth(19).waitFor({ timeout: 30_000 });
// Crests load lazily; give the visible ones a moment so the shot is not full of
// gaps where the badges should be.
await page.waitForTimeout(1200);

const applied = await page.evaluate(() => document.documentElement.dataset.theme);
if (applied !== theme) {
  console.error(`Error: page rendered as "${applied}", expected "${theme}"`);
  await browser.close();
  process.exit(1);
}

const file = path.join(OUT_DIR, `classificacao-${theme}.png`);
// Full page: a crop would cut the table mid-way and hide the relegation zone,
// which is half of what the coloured rails are there to show.
await page.screenshot({ path: file, fullPage: true });
await browser.close();

console.log(`Wrote ${path.relative(process.cwd(), file)}`);
