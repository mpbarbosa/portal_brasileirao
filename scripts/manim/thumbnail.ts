/**
 * thumbnail.ts
 * ------------
 * Draw the YouTube capas for the campanhas render, at 1280x720.
 *
 *   npx tsx scripts/manim/thumbnail.ts
 *   npx tsx scripts/manim/thumbnail.ts --variant fixture   # just one of them
 *
 * Two images, from one payload:
 *
 *   docs/videos/campanhas-palmeiras-flamengo-miniatura.png          the fixture
 *   docs/videos/campanhas-palmeiras-flamengo-miniatura-11-ao-1.png  the story
 *
 * **Everything on them is derived, nothing is typed in.** The lines, the
 * headline's two positions, the rodada count and the chips all come out of
 * `campanhas.json` — the same file the scene consumes — so a re-export moves
 * the capa and the video together. The second variant's own name is built from
 * the numbers it prints, which is why it cannot end up called `11-ao-1` while
 * saying something else.
 *
 * **The palette is read out of `campanhas.py`, not restated here**, exactly as
 * `generate-og-image.ts` reads its tokens out of `src/index.css`. A second
 * hand-kept copy of a colour is how the capa comes to be a shade off the video
 * it advertises; a constant renamed away fails this run rather than drawing in
 * black.
 *
 * Drawn with the headless Chromium `screenshot.ts` already uses, so this adds
 * no dependency — and unlike the render itself it needs **no Manim**, which is
 * the whole reason it can live in the repository's own toolchain where the
 * scene cannot.
 *
 * There is no `--check` mode, for `generate-og-image.ts`'s reason: the bytes
 * vary with the Chromium build and the host's fonts, so a byte comparison would
 * go red on an unrelated browser bump. Regenerating is a deliberate commit.
 *
 * Exit codes:
 *   0  the capas were written.
 *   1  the payload or the palette could not be read, or the capture failed.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");

const DATA_PATH = process.env.CAMPANHAS_JSON ?? path.join(HERE, "campanhas.json");
const SCENE_PATH = path.join(HERE, "campanhas.py");

/** The video these advertise. The capas are named after it, so `ls` files them together. */
const VIDEO_BASENAME = "campanhas-palmeiras-flamengo";
const OUT_DIR = path.join(ROOT, "docs/videos");

const WIDTH = 1280;
const HEIGHT = 720;

/** The whole division, always — `rank-candles-core.ts`'s rule, and the scene's. */
const CLUBS_IN_DIVISION = 20;

/** A path to print. `path.relative` escapes the repo as `../../..`, which is unreadable
 *  in an error message — a payload named through `CAMPANHAS_JSON` may sit anywhere. */
const shown = (target: string) => {
  const relative = path.relative(ROOT, target);
  return relative.startsWith("..") ? target : relative;
};

const fail = (message: string): never => {
  console.error(`Error: ${message}`);
  process.exit(1);
};

type Club = {
  name: string;
  code: string;
  rounds: { round: number; position: number; points: number }[];
};

/**
 * Read the scene's own colours.
 *
 * Only the names this file draws with, so a constant the capa does not use may
 * be renamed freely; one it does use fails loudly.
 */
const INK_NAMES = ["INK", "INK_SOFT", "INK_FAINT", "SURFACE", "CARD", "POSITIVE", "NEGATIVE"] as const;
type InkName = (typeof INK_NAMES)[number];

const readPalette = (): { ink: Record<InkName, string>; clubColour: (code: string, index: number) => string } => {
  const source = readFileSync(SCENE_PATH, "utf8");

  const ink = {} as Record<InkName, string>;
  for (const name of INK_NAMES) {
    const found = source.match(new RegExp(`^${name}\\s*=\\s*"(#[0-9A-Fa-f]{6})"`, "m"));
    if (!found) fail(`${name} is not defined in ${shown(SCENE_PATH)}`);
    ink[name] = found![1];
  }

  const block = source.match(/CLUB_COLOURS\s*=\s*\{([\s\S]*?)\}/);
  if (!block) fail(`no CLUB_COLOURS map in ${shown(SCENE_PATH)}`);
  const byCode = new Map<string, string>();
  for (const [, code, colour] of block![1].matchAll(/"(\d+)":\s*"(#[0-9A-Fa-f]{6})"/g)) {
    byCode.set(code, colour);
  }

  const fallbacks = [...source.matchAll(/FALLBACK_COLOURS\s*=\s*\[([\s\S]*?)\]/g)]
    .flatMap(([, list]) => [...list.matchAll(/"(#[0-9A-Fa-f]{6})"/g)].map(([, c]) => c));
  if (fallbacks.length === 0) fail(`no FALLBACK_COLOURS in ${shown(SCENE_PATH)}`);

  // The scene's own rule: a club with no colour of its own takes one by its
  // position in the payload. Restating it differently here is how a capa comes
  // to draw a third club in a colour the video does not use.
  return { ink, clubColour: (code, index) => byCode.get(code) ?? fallbacks[index % fallbacks.length] };
};

const ordinal = (position: number) => `${position}º`;

const page = (body: string, ink: Record<InkName, string>) => `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${WIDTH}px;height:${HEIGHT}px;background:${ink.SURFACE};overflow:hidden}
  body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{position:relative;width:${WIDTH}px;height:${HEIGHT}px}
  .left{position:absolute;left:66px;top:112px;width:580px}
  .eyebrow{font-size:25px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${ink.INK_FAINT}}
  /* nowrap on every headline: a club name that wraps runs into the plot's axis
     labels, and nothing about the page reports it. */
  .club{font-size:82px;font-weight:800;letter-spacing:-.035em;line-height:1.02;white-space:nowrap}
  .head{font-size:96px;font-weight:800;letter-spacing:-.04em;line-height:1;color:${ink.INK};white-space:nowrap}
  .clubs{margin-top:24px;font-size:46px;font-weight:800;letter-spacing:-.025em;white-space:nowrap}
  .vs-inline{display:inline-block;font-size:50px;font-weight:600;color:${ink.INK_FAINT};vertical-align:10px;margin-right:12px}
  .vs{font-size:34px;font-weight:600;color:${ink.INK_FAINT};margin:0 10px;vertical-align:5px}
  .kicker{margin-top:26px;font-size:30px;font-weight:600;color:${ink.INK_SOFT};letter-spacing:-.01em}
  .chips{position:absolute;left:66px;display:flex;gap:16px}
  .chip{display:flex;align-items:baseline;gap:10px;padding:12px 20px;border-radius:14px;
        background:${ink.CARD};border:1px solid #232F2A}
  .rank{font-size:38px;font-weight:800;letter-spacing:-.02em}
  .pts{font-size:26px;font-weight:600;color:${ink.INK_SOFT}}
</style><div class="wrap">${body}</div>`;

/**
 * The plot, drawn as SVG.
 *
 * The y domain is the whole division with 1st at the top — the scene's
 * convention and `rank-candles-core.ts`'s, so a leader's capa leaves its lower
 * two thirds empty and the G4 band means something. A per-pair scale would make
 * two clubs trading 1st and 2nd look like a race up the table.
 */
const plot = (clubs: (Club & { colour: string })[], ink: Record<InkName, string>) => {
  const L = 706;
  const R = 1216;
  const T = 128;
  const B = 616;
  const rounds = Math.max(...clubs.map((c) => c.rounds.length));
  const x = (round: number) => L + ((round - 1) / (rounds - 1)) * (R - L);
  const y = (position: number) => T + ((position - 0.5) / CLUBS_IN_DIVISION) * (B - T);
  const rowHeight = (B - T) / CLUBS_IN_DIVISION;
  const band = (from: number, to: number, colour: string, opacity: number) =>
    `<rect x="${L}" y="${y(from) - rowHeight / 2}" width="${R - L}" height="${(to - from + 1) * rowHeight}" fill="${colour}" opacity="${opacity}"/>`;

  const line = (club: Club & { colour: string }) =>
    club.rounds
      .map((entry, index) => `${index ? "L" : "M"}${x(entry.round).toFixed(1)},${y(entry.position).toFixed(1)}`)
      .join(" ");

  const guides = [1, 4, 10, CLUBS_IN_DIVISION]
    .map(
      (position) =>
        `<line x1="${L}" y1="${y(position)}" x2="${R}" y2="${y(position)}" stroke="${ink.INK_FAINT}" stroke-width="1" opacity=".35"/>` +
        `<text x="${L - 16}" y="${y(position) + 10}" text-anchor="end" font-family="Inter" font-size="22" font-weight="600" fill="${ink.INK_FAINT}">${ordinal(position)}</text>`,
    )
    .join("");

  // Drawn back to front so the first club's line sits on top of the second's
  // where they overlap, matching which club the headline is about.
  const ordered = [...clubs].reverse();

  return `<svg width="${WIDTH}" height="${HEIGHT}" style="position:absolute;inset:0">
    ${band(1, 4, ink.POSITIVE, 0.1)}
    ${band(CLUBS_IN_DIVISION - 3, CLUBS_IN_DIVISION, ink.NEGATIVE, 0.08)}
    ${guides}
    ${ordered.map((club) => `<path d="${line(club)}" fill="none" stroke="${club.colour}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>`).join("")}
    ${ordered
      .map((club) => {
        const last = club.rounds[club.rounds.length - 1];
        return `<circle cx="${x(last.round)}" cy="${y(last.position)}" r="13" fill="${club.colour}" stroke="${ink.SURFACE}" stroke-width="4"/>`;
      })
      .join("")}
  </svg>`;
};

/**
 * The chips: where each club finished, and on how many points.
 *
 * Their vertical position differs per variant because the two headlines are
 * different heights, and a gap of dead space under a short headline reads as a
 * mistake. It is the one measurement here that is by eye rather than derived.
 */
const chips = (clubs: (Club & { colour: string })[], top: number) =>
  `<div class="chips" style="top:${top}px">${clubs
    .map((club) => {
      const last = club.rounds[club.rounds.length - 1];
      return `<div class="chip"><span class="rank" style="color:${club.colour}">${ordinal(last.position)}</span><span class="pts">${last.points} pts</span></div>`;
    })
    .join("")}</div>`;

const eyebrow = (rounds: number) => `<div class="eyebrow">Brasileirão · ${rounds} rodadas</div>`;

const fixtureCapa = (clubs: (Club & { colour: string })[], ink: Record<InkName, string>, rounds: number) =>
  page(
    `<div class="left">
      ${eyebrow(rounds)}
      <div class="club" style="color:${clubs[0].colour};margin-top:14px">${clubs[0].name.toUpperCase()}</div>
      <div class="club" style="color:${clubs[1].colour}"><span class="vs-inline">×</span>${clubs[1].name.toUpperCase()}</div>
      <div class="kicker">a campanha, rodada a rodada</div>
    </div>
    ${chips(clubs, 452)}
    ${plot(clubs, ink)}`,
    ink,
  );

/**
 * The story capa: where the first club started and where it got to.
 *
 * Both numbers are read off that club's own campanha, so this cannot claim a
 * climb the lines do not draw. They are printed in its colour and the rest of
 * the phrase in `INK`, because the second club made its own journey and an
 * undifferentiated headline would attribute the numbers to the pairing.
 */
const storyCapa = (clubs: (Club & { colour: string })[], ink: Record<InkName, string>, rounds: number) => {
  const subject = clubs[0];
  const from = subject.rounds[0].position;
  const to = subject.rounds[subject.rounds.length - 1].position;

  return page(
    `<div class="left">
      ${eyebrow(rounds)}
      <div class="head" style="margin-top:16px">DO <span style="color:${subject.colour}">${ordinal(from)}</span> AO <span style="color:${subject.colour}">${ordinal(to)}</span></div>
      <div class="clubs">${clubs
        .map((club) => `<span style="color:${club.colour}">${club.name.toUpperCase()}</span>`)
        .join('<span class="vs">×</span>')}</div>
    </div>
    ${chips(clubs, 400)}
    ${plot(clubs, ink)}`,
    ink,
  );
};

const main = async () => {
  const wanted = process.argv.includes("--variant")
    ? process.argv[process.argv.indexOf("--variant") + 1]
    : null;

  const payload = JSON.parse(readFileSync(DATA_PATH, "utf8")) as { snapshot: string; clubs: Club[] };

  // Two clubs, because the layout is a pairing: one headline, one `×`, two
  // chips. A third would need a design rather than a loop.
  if (payload.clubs.length !== 2) {
    fail(`the capa layout takes exactly two clubs; ${shown(DATA_PATH)} holds ${payload.clubs.length}`);
  }

  const { ink, clubColour } = readPalette();
  const clubs = payload.clubs.map((club, index) => ({ ...club, colour: clubColour(club.code, index) }));
  const rounds = Math.max(...clubs.map((club) => club.rounds.length));

  const subject = clubs[0];
  const from = subject.rounds[0].position;
  const to = subject.rounds[subject.rounds.length - 1].position;
  if (from === to) {
    console.warn(
      `Warning: ${subject.name} opened and finished ${ordinal(to)}, so the story capa reads "DO ${ordinal(from)} AO ${ordinal(to)}" and says nothing.`,
    );
  }

  const variants = [
    { name: "fixture", file: `${VIDEO_BASENAME}-miniatura.png`, html: fixtureCapa(clubs, ink, rounds) },
    {
      name: "story",
      file: `${VIDEO_BASENAME}-miniatura-${from}-ao-${to}.png`,
      html: storyCapa(clubs, ink, rounds),
    },
  ].filter((variant) => !wanted || variant.name === wanted);

  if (variants.length === 0) fail(`unknown --variant; expected "fixture" or "story"`);

  const browser = await chromium.launch();
  try {
    const tab = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
    for (const variant of variants) {
      await tab.setContent(variant.html, { waitUntil: "load" });
      // Inter is a system font here rather than a webfont, but the wait is what
      // stops a capture landing while the fallback face is still measured.
      await tab.evaluate(() => document.fonts.ready);
      const out = path.join(OUT_DIR, variant.file);
      await tab.screenshot({ path: out });
      console.log(`${path.relative(ROOT, out)}  (${variant.name}, dados até ${payload.snapshot})`);
    }
  } finally {
    await browser.close();
  }
};

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
