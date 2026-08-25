/**
 * generate-og-image.ts
 * --------------------
 * Draw the link-preview card, `public/og-default.png`, at 1200x630.
 *
 * Usage:
 *   npx tsx scripts/generate-og-image.ts
 *   npm run sync-og-image
 *
 * Why a generated PNG and not an SVG: no social platform that matters renders
 * SVG for `og:image` — Facebook, X, LinkedIn and WhatsApp all reject or blank
 * it — so the card has to be raster. It is drawn with the same headless
 * Chromium `scripts/screenshot.ts` already uses rather than by adding an image
 * library, and committed, because a link preview must resolve on a host that
 * only ever runs `npm ci --omit=dev`.
 *
 * The colours are read out of `src/index.css` at generation time instead of
 * being written down here. Every token value in that file is emitted by
 * `npm run sync-md3-tokens` from a tonal palette; a second hand-kept copy in
 * this script is exactly how the card ends up a shade off the site it
 * advertises. A token that has been renamed away fails the run rather than
 * silently drawing in black.
 *
 * There is no `--check` mode, deliberately: the bytes vary with the Chromium
 * build and the host's fonts, so a byte-comparison gate would go red on an
 * unrelated browser bump. Regenerate by hand when the palette or the wording
 * changes.
 *
 * Exit codes:
 *   0  public/og-default.png written.
 *   1  a token was missing, or the capture failed.
 */
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

// The size and the output path come from the module that advertises them in
// `og:image:width`/`height`. A second copy here is how the tags come to promise
// a box the file does not fill.
import { OG_IMAGE_HEIGHT, OG_IMAGE_PATH, OG_IMAGE_WIDTH } from "@/page-meta-core";

const OUT_PATH = path.join(process.cwd(), "public", OG_IMAGE_PATH.replace(/^\//, ""));
const CSS_PATH = path.join(process.cwd(), "src/index.css");

/** The tokens the card draws with, by their MD3 role names. */
const TOKENS = [
  "color-surface",
  "color-surface-container",
  "color-on-surface",
  "color-on-surface-variant",
  "color-primary",
  "color-outline-variant",
] as const;

type TokenName = (typeof TOKENS)[number];

/**
 * Read the dark palette out of `src/index.css`.
 *
 * Dark rather than light because the card is one fixed image: a link preview
 * cannot respond to the reader's theme, and the app is dark-first.
 */
const readTokens = (): Record<TokenName, string> => {
  const css = readFileSync(CSS_PATH, "utf8");
  const block = css.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\}/);

  if (!block) {
    console.error(`Error: no :root[data-theme="dark"] block in ${CSS_PATH}`);
    process.exit(1);
  }

  const values = {} as Record<TokenName, string>;

  for (const token of TOKENS) {
    const found = block[1].match(new RegExp(`--${token}:\\s*([^;]+);`));
    if (!found) {
      console.error(`Error: --${token} is not defined in the dark palette.`);
      process.exit(1);
    }
    values[token] = found[1].trim();
  }

  return values;
};

const card = (t: Record<TokenName, string>): string => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" /><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${OG_IMAGE_WIDTH}px; height: ${OG_IMAGE_HEIGHT}px;
    background: ${t["color-surface"]};
    /* The system stack, as everywhere else — this app ships no webfont. */
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    display: flex; flex-direction: column; justify-content: center;
    padding: 0 88px; position: relative; overflow: hidden;
  }
  /* Off-canvas disc: a hint of a ball without depending on an emoji font
     being installed on whichever machine runs this. */
  .disc {
    position: absolute; right: -180px; top: -180px;
    width: 620px; height: 620px; border-radius: 50%;
    background: ${t["color-surface-container"]};
    border: 2px solid ${t["color-outline-variant"]};
  }
  .rule { width: 132px; height: 10px; border-radius: 5px;
          background: ${t["color-primary"]}; margin-bottom: 40px; }
  h1 { font-size: 92px; line-height: 1.04; font-weight: 800; letter-spacing: -0.02em;
       color: ${t["color-on-surface"]}; position: relative; }
  h2 { font-size: 42px; line-height: 1.25; font-weight: 600; margin-top: 22px;
       color: ${t["color-primary"]}; position: relative; }
  .sections { margin-top: 52px; font-size: 30px; font-weight: 500;
              color: ${t["color-on-surface-variant"]}; position: relative; }
</style></head><body>
  <div class="disc"></div>
  <div class="rule"></div>
  <h1>Portal Brasileirão</h1>
  <h2>Campeonato Brasileiro Série A</h2>
  <p class="sections">Classificação &middot; Ao vivo &middot; Jogos &middot; Artilharia</p>
</body></html>`;

const main = async (): Promise<void> => {
  const tokens = readTokens();

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT },
      deviceScaleFactor: 1,
    });

    await page.setContent(card(tokens), { waitUntil: "load" });

    mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    await page.screenshot({ path: OUT_PATH });
  } finally {
    await browser.close();
  }

  console.log(`Wrote ${path.relative(process.cwd(), OUT_PATH)} (${OG_IMAGE_WIDTH}x${OG_IMAGE_HEIGHT})`);
};

main().catch((cause) => {
  console.error("Falha ao gerar a imagem de pré-visualização:", cause);
  process.exit(1);
});
