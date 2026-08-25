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
 *   npx tsx scripts/screenshot.ts                                   # classificação, light
 *   npx tsx scripts/screenshot.ts http://localhost:3000 dark
 *   npx tsx scripts/screenshot.ts https://brasileirao.mpbarbosa.com/clube/palmeiras
 *
 * The output name comes from the path, so `/clube/palmeiras` writes
 * `clube-palmeiras-light.png` and `/` writes `classificacao-light.png`.
 *
 * The theme is set through localStorage before the page loads, using the same
 * key the app reads, so the inline no-flash script picks it up on first paint —
 * clicking the toggle after load would capture a repaint. A screenshot showing
 * that flash would be documenting a bug the app does not have.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

import { THEME_STORAGE_KEY, type Theme } from "@/theme-core";

const SITE = "https://brasileirao.mpbarbosa.com";
const OUT_DIR = path.join(process.cwd(), "docs/screenshots");
/** Captures of anything that is not the live site. Gitignored. */
const LOCAL_DIR = path.join(OUT_DIR, "local");

const url = process.argv[2] ?? SITE;
const theme = (process.argv[3] ?? "light") as Theme;

if (theme !== "light" && theme !== "dark") {
  console.error(`Error: theme must be "light" or "dark", got "${theme}"`);
  process.exit(1);
}

let route: string;
try {
  route = new URL(url).pathname;
} catch {
  console.error(`Error: not a URL — "${url}"`);
  process.exit(1);
}

/**
 * A shot of a dev server never overwrites a committed one.
 *
 * The filename comes from the route, so running this against localhost writes
 * exactly the path a README image already occupies — silently replacing a
 * picture of production with one of whatever is checked out. That is not
 * hypothetical: another session checking the match page against its own build
 * overwrote a committed shot, deleted it as a stray, and only noticed because
 * `git status` said `D` rather than nothing.
 *
 * So only the live site writes to docs/screenshots. Everything else lands in
 * docs/screenshots/local, which is ignored — which also makes a before/after
 * comparison natural, since the committed shot and the local one sit side by
 * side under different roots.
 */
const isLive = url.startsWith(SITE);
const outDir = isLive ? OUT_DIR : LOCAL_DIR;

/** `/` is the classificação; anything else names itself after its path. */
const slug =
  route === "/" ? "classificacao" : route.replace(/^\/|\/$/g, "").replace(/\//g, "-");

/**
 * A whole-page shot suits the table, whose point is that it has twenty rows and
 * coloured rails at both ends. The club page runs to every fixture of the
 * season, so a full-page capture would be mostly a list.
 */
const fullPage = route === "/";

/** Roughly how tall a cropped shot may be, before it is trimmed to a boundary. */
const MAX_HEIGHT = 1040;

mkdirSync(outDir, { recursive: true });

/**
 * Wait for the page to be worth photographing.
 *
 * The generic half matters more than the per-route half: a shot taken while the
 * page still reads "Carregando página…" is a picture of the loading state, and
 * one taken before the crests decode is full of gaps where the badges belong.
 * Both look like a broken app rather than a slow screenshot.
 */
const settle = async (page: Page) => {
  await page
    .getByText("Carregando página…")
    .waitFor({ state: "detached", timeout: 30_000 })
    .catch(() => {
      /* Fast loads never render it at all. */
    });

  if (route === "/") {
    await page.locator("table tbody tr").nth(19).waitFor({ timeout: 30_000 });
  } else if (route.startsWith("/clube/")) {
    // The campanha sparkline is the last thing the club page computes.
    await page.locator("main svg polyline").first().waitFor({ timeout: 30_000 });
  } else if (route.startsWith("/jogos")) {
    // The round picker renders before the fixtures do, so waiting on it alone
    // would photograph an empty round.
    await page.locator("main ul > li").first().waitFor({ timeout: 30_000 });
  }

  // Every image actually decoded, rather than a fixed wait and a hope. Crests
  // and broadcaster marks are lazy, so this is the difference between a shot
  // with badges and a shot with holes.
  await page.waitForFunction(
    () => [...document.images].every((img) => img.complete && img.naturalWidth > 0),
    undefined,
    { timeout: 30_000 },
  );
};

const browser = await chromium.launch();
const context = await browser.newContext({
  // The layout is capped at max-w-3xl, so a very wide shot is mostly empty
  // background. This is wide enough to show the full table without padding it
  // out with dead space.
  viewport: { width: 960, height: fullPage ? 900 : 1040 },
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
console.log(`==> ${url} (${theme})${isLive ? "" : " — local build, writing to docs/screenshots/local"}`);
await page.goto(url, { waitUntil: "networkidle" });

await settle(page);

const applied = await page.evaluate(() => document.documentElement.dataset.theme);
if (applied !== theme) {
  console.error(`Error: page rendered as "${applied}", expected "${theme}"`);
  await browser.close();
  process.exit(1);
}

/**
 * Where to cut a cropped shot.
 *
 * Not a fixed height: content moves, and a screenshot that slices a card in
 * half reads as a broken layout rather than a crop. This takes the bottom edge
 * of the last thing that fits — sections, and list items within them, so a long
 * fixture list can end after a whole card rather than before the whole list.
 */
const cropHeight = async (): Promise<number> =>
  page.evaluate((max) => {
    const main = document.querySelector("main");
    if (!main) return max;

    // An open dialog lives in the browser's top layer, outside `main` and
    // outside normal flow, so a crop derived only from `main` cannot see it —
    // it cuts above the overlay and omits the one thing worth photographing.
    // Measured on the player card: dialog bottom 640px, crop 109px.
    const dialogs = [...document.querySelectorAll("dialog[open]")];
    const candidates = [...main.children, ...main.querySelectorAll("li"), ...dialogs];
    const edges = candidates.map((el) => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top + window.scrollY, bottom: rect.bottom + window.scrollY };
    });

    let cut = 0;
    for (const { bottom } of edges) if (bottom <= max && bottom > cut) cut = bottom;
    if (cut === 0) return max;

    // Breathing room below the last element, but never so much that it reaches
    // the next one — a 2px strip of the following card reads as a broken layout
    // just as much as half of it does.
    let nextTop = Infinity;
    for (const { top } of edges) if (top >= cut && top < nextTop) nextTop = top;
    const pad = Math.min(24, Math.max(0, nextTop - cut - 2));

    return Math.round(cut + pad);
  }, MAX_HEIGHT);

const file = path.join(outDir, `${slug}-${theme}.png`);
if (fullPage) {
  await page.screenshot({ path: file, fullPage: true });
} else {
  const height = await cropHeight();
  await page.screenshot({
    path: file,
    fullPage: true,
    clip: { x: 0, y: 0, width: 960, height },
  });
}
await browser.close();

console.log(`Wrote ${path.relative(process.cwd(), file)}`);
