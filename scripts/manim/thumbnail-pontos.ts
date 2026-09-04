/**
 * thumbnail-pontos.ts
 * -------------------
 * Draw the YouTube capas for the `pontos` render, at 1280x720.
 *
 *   npx tsx scripts/manim/thumbnail-pontos.ts
 *   npx tsx scripts/manim/thumbnail-pontos.ts --variant divisao
 *
 * Two images, from one payload:
 *
 *   docs/videos/pontos-20-clubes-miniatura.png              the division
 *   docs/videos/pontos-20-clubes-miniatura-38-pontos.png    the story
 *
 * The sibling `thumbnail.ts` advertises the two-club campanha; this advertises
 * the whole division's points. They share the palette reader and the capture in
 * `capa-core.ts` and **not** the layout, which is the same line `thumbnail.ts`
 * draws when it refuses a third club: one `×` between two names and a fan of
 * twenty are two designs, not one loop with a parameter.
 *
 * **Everything is derived, nothing is typed in.** The lines, the headline's
 * figures, the rodada count and the chips all come out of `pontos.json` — the
 * same file the scene consumes — so a re-export moves the capa and the video
 * together. The story variant's own file name is built from the number it
 * prints, so it cannot end up called `38-pontos` while saying something else.
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

import { capture, fail, readClubColours, readColours, readInk, shown as shownIn } from "./capa-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");

const DATA_PATH = process.env.PONTOS_JSON ?? path.join(HERE, "pontos.json");
const SCENE_PATH = path.join(HERE, "pontos.py");

/** The video these advertise. The capas are named after it, so `ls` files them together. */
const VIDEO_BASENAME = "pontos-20-clubes";
const OUT_DIR = path.join(ROOT, "docs/videos");

const WIDTH = 1280;
const HEIGHT = 720;

/** Points-axis guides. The scene steps by 10; a capa read at thumbnail size
 *  cannot carry six labels, so it steps by 20 and keeps the same domain. */
const POINTS_STEP = 20;

/** The chart's left edge. Shared with the chip guard, which is the whole reason
 *  it is a constant rather than a number inside `plot`. */
const PLOT_LEFT = 690;

const shown = (target: string) => shownIn(ROOT, target);

/** The scene's own ink. Only the names this file draws with, so a constant the
 *  capa does not use may be renamed freely. */
const INK_NAMES = ["INK", "INK_SOFT", "INK_FAINT", "SURFACE", "CARD"] as const;
type InkName = (typeof INK_NAMES)[number];

type Club = {
  name: string;
  code: string;
  rounds: { round: number; points: number; position: number; played: number }[];
};
type Drawn = Club & { colour: string };

const readPalette = (): {
  ink: Record<InkName, string>;
  clubColour: (code: string, index: number) => string;
} => {
  const ink = readInk(ROOT, SCENE_PATH, INK_NAMES);
  const byCode = readClubColours(ROOT, SCENE_PATH);
  // The scene keeps one fallback where `campanhas.py` cycles four; `readColours`
  // returns both as a list, so the rule here is the scene's own rule either way.
  const fallbacks = readColours(ROOT, SCENE_PATH, "FALLBACK_COLOUR");

  return { ink, clubColour: (code, index) => byCode.get(code) ?? fallbacks[index % fallbacks.length] };
};

const ordinal = (position: number) => `${position}º`;
const last = (club: Club) => club.rounds[club.rounds.length - 1];

const page = (body: string, ink: Record<InkName, string>) => `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${WIDTH}px;height:${HEIGHT}px;background:${ink.SURFACE};overflow:hidden}
  body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{position:relative;width:${WIDTH}px;height:${HEIGHT}px}
  .left{position:absolute;left:66px;top:104px;width:568px}
  .eyebrow{font-size:25px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${ink.INK_FAINT}}
  /* nowrap on every headline: a line that wraps runs into the plot's axis
     labels, and nothing about the page reports it. */
  .head{font-size:78px;font-weight:800;letter-spacing:-.04em;line-height:1.03;color:${ink.INK};white-space:nowrap}
  .head-soft{font-size:52px;font-weight:800;letter-spacing:-.03em;line-height:1.06;color:${ink.INK_SOFT};white-space:nowrap}
  .kicker{margin-top:24px;font-size:29px;font-weight:600;color:${ink.INK_SOFT};letter-spacing:-.01em}
  /* A COLUMN, not a row, and the guard below is what settled that. Three chips
     side by side reached 788px against a chart starting at 690 — legible, and
     sitting on the fan. Stacked they are the same leaderboard the video keeps
     beside its own chart, and a promoted club with a longer name lengthens one
     chip instead of pushing the last one under the drawing. */
  .chips{position:absolute;left:66px;display:flex;flex-direction:column;align-items:flex-start;gap:10px}
  .chip{display:flex;align-items:center;gap:9px;padding:11px 15px;border-radius:14px;
        background:${ink.CARD};border:1px solid #232F2A}
  .swatch{width:13px;height:13px;border-radius:4px;flex:none}
  .rank{font-size:21px;font-weight:800;white-space:nowrap}
  .club{font-size:21px;font-weight:700;color:${ink.INK};white-space:nowrap}
  .pts{font-size:21px;font-weight:800;color:${ink.INK_SOFT};white-space:nowrap}
</style><div class="wrap">${body}</div>`;

/**
 * The fan, drawn as SVG.
 *
 * The y domain starts at **zero** and the x domain at rodada 0, so every club
 * leaves one origin and the drawing is a fan opening from a point — the scene's
 * rule, and `sparklineBars`' rule about what a length means. A y axis cropped to
 * where the clubs ended would make the bottom club look like it has nothing.
 *
 * **`marked` is what makes twenty lines readable at thumbnail size.** Every club
 * is drawn, because the division is the subject; the ones the chips name are
 * drawn at full weight with an endpoint dot and the rest recede. That ties the
 * text to the picture — without it a reader has twenty anonymous curves and
 * three numbers with nothing joining them.
 */
const plot = (clubs: Drawn[], ink: Record<InkName, string>, marked: Set<string>) => {
  const L = PLOT_LEFT;
  const R = 1216;
  const T = 104;
  const B = 600;
  const rounds = Math.max(...clubs.map((club) => last(club).round));
  const best = Math.max(...clubs.flatMap((club) => club.rounds.map((entry) => entry.points)));
  const top = (Math.floor(best / POINTS_STEP) + 1) * POINTS_STEP;

  const x = (round: number) => L + (round / rounds) * (R - L);
  const y = (points: number) => B - (points / top) * (B - T);

  const guides = [];
  for (let points = 0; points <= top; points += POINTS_STEP) {
    guides.push(
      `<line x1="${L}" y1="${y(points)}" x2="${R}" y2="${y(points)}" stroke="${ink.INK_FAINT}" stroke-width="1" opacity="${points === 0 ? 0.5 : 0.28}"/>` +
        `<text x="${L - 16}" y="${y(points) + 9}" text-anchor="end" font-family="Inter" font-size="22" font-weight="600" fill="${ink.INK_FAINT}">${points}</text>`,
    );
  }

  // Rodada 0 is real and carries no entry: every club is on nothing before it
  // has played, which is where the fan opens from.
  const line = (club: Drawn) =>
    [`M${x(0).toFixed(1)},${y(0).toFixed(1)}`]
      .concat(club.rounds.map((entry) => `L${x(entry.round).toFixed(1)},${y(entry.points).toFixed(1)}`))
      .join(" ");

  // Drawn back to front, so a marked club's line sits over the field rather
  // than under whichever club happens to come later in the payload.
  const ordered = [...clubs].sort(
    (a, b) => Number(marked.has(a.code)) - Number(marked.has(b.code)),
  );

  return `<svg width="${WIDTH}" height="${HEIGHT}" style="position:absolute;inset:0">
    ${guides.join("")}
    ${ordered
      .map((club) => {
        const on = marked.has(club.code);
        return `<path d="${line(club)}" fill="none" stroke="${club.colour}" stroke-width="${on ? 9 : 4}" stroke-opacity="${on ? 1 : 0.45}" stroke-linejoin="round" stroke-linecap="round"/>`;
      })
      .join("")}
    ${ordered
      .filter((club) => marked.has(club.code))
      .map((club) => {
        const final = last(club);
        return `<circle cx="${x(final.round)}" cy="${y(final.points)}" r="13" fill="${club.colour}" stroke="${ink.SURFACE}" stroke-width="4"/>`;
      })
      .join("")}
  </svg>`;
};

/**
 * The chips: which place, which club, and on how many points.
 *
 * They carry the club's NAME as well as its place, which the campanhas chips do
 * not need — there, two names are already the headline, where twenty lines are
 * drawn here and `1º` alone would not say which club.
 *
 * **The place is what joins a chip to a line, and the swatch only corroborates
 * it.** That ordering was arrived at by looking rather than reasoned: the
 * story capa marks the 1º and the 20º, and this palette draws Palmeiras
 * `#1FBF6B` against Chapecoense `#2FD0A8` — a green and a green-blue, far
 * enough apart in a twenty-row sidebar and not at all apart when they are the
 * only two marks on a picture. On a points chart the ordinal is unambiguous by
 * construction: the 1º *is* the top line and the 20º *is* the bottom one, so a
 * reader needs no colour to place either.
 *
 * Fixing it in the scene's palette instead was the other road, and it is
 * worse: it would move a colour in a video already rendered and committed, to
 * buy a distinction that a fact already in the payload gives for nothing.
 */
const chips = (clubs: Drawn[], top: number) =>
  `<div class="chips" style="top:${top}px">${clubs
    .map((club) => {
      const final = last(club);
      return `<div class="chip"><span class="swatch" style="background:${club.colour}"></span><span class="rank" style="color:${club.colour}">${ordinal(final.position)}</span><span class="club">${club.name}</span><span class="pts">${final.points}</span></div>`;
    })
    .join("")}</div>`;

/**
 * Refuse a capa whose chips have grown into the chart.
 *
 * The chip row is absolutely positioned and unbounded, so it widens with the
 * longest club name in it — and a promoted club with a longer name pushes the
 * last chip under the fan, where it is legible and simply wrong. Nothing in the
 * types or the payload can see that; only the rendered box can.
 */
const chipsClearThePlot = async (tab: import("@playwright/test").Page): Promise<string | null> => {
  const right = await tab.evaluate(() => document.querySelector(".chips")?.getBoundingClientRect().right ?? 0);
  return right > PLOT_LEFT - 8
    ? `the chips reach ${Math.round(right)}px and the chart starts at ${PLOT_LEFT}px`
    : null;
};

const eyebrow = (rounds: number) => `<div class="eyebrow">Brasileirão · ${rounds} rodadas</div>`;

const divisaoCapa = (clubs: Drawn[], ink: Record<InkName, string>, rounds: number) => {
  const podium = clubs.slice(0, 3);
  return page(
    `<div class="left">
      ${eyebrow(rounds)}
      <div class="head" style="margin-top:14px">OS 20 CLUBES</div>
      <div class="head-soft">rodada a rodada</div>
      <div class="kicker">os pontos de cada um, do 1º ao 20º</div>
    </div>
    ${chips(podium, 428)}
    ${plot(clubs, ink, new Set(podium.map((club) => club.code)))}`,
    ink,
  );
};

/**
 * The story capa: how far apart the top and the bottom of the table are.
 *
 * Both figures are read off the two clubs' own campanhas, so this cannot claim
 * a gap the lines do not draw. `×` is deliberately absent between the two
 * names — these clubs are not playing each other, and the mark that means a
 * fixture on the sibling capa would say they are.
 */
const distanciaCapa = (
  clubs: Drawn[],
  ink: Record<InkName, string>,
  rounds: number,
  gap: number,
) => {
  const leader = clubs[0];
  const bottom = clubs[clubs.length - 1];
  return page(
    `<div class="left">
      ${eyebrow(rounds)}
      <div class="head" style="margin-top:14px"><span style="color:${leader.colour}">${gap}</span> PONTOS</div>
      <div class="head-soft">separam o 1º do 20º</div>
      <div class="kicker">a campanha inteira da divisão, rodada a rodada</div>
    </div>
    ${chips([leader, bottom], 470)}
    ${plot(clubs, ink, new Set([leader.code, bottom.code]))}`,
    ink,
  );
};

const main = async () => {
  const wanted = process.argv.includes("--variant")
    ? process.argv[process.argv.indexOf("--variant") + 1]
    : null;

  const payload = JSON.parse(readFileSync(DATA_PATH, "utf8")) as { snapshot: string; clubs: Club[] };

  // Twenty, because the layout is the division: a headline naming that count, a
  // fan, and chips picked off the ends of the table. A payload holding some
  // other number would draw a capa whose own headline contradicts it.
  if (payload.clubs.length !== 20) {
    fail(`the capa layout takes the whole division of 20; ${shown(DATA_PATH)} holds ${payload.clubs.length}`);
  }

  const { ink, clubColour } = readPalette();
  // Ordered by the classificação the payload itself carries, never by points
  // re-sorted here: the CBF tie-breakers are what decide a place, and a second
  // implementation of them is how a capa comes to disagree with its own video.
  const clubs: Drawn[] = payload.clubs
    .map((club, index) => ({ ...club, colour: clubColour(club.code, index) }))
    .sort((a, b) => last(a).position - last(b).position);

  const rounds = Math.max(...clubs.map((club) => last(club).round));
  const gap = last(clubs[0]).points - last(clubs[clubs.length - 1]).points;
  if (gap <= 0) {
    console.warn(
      `Warning: the 1º and the 20º are level on ${last(clubs[0]).points} points, so the story capa reads "${gap} PONTOS" and says nothing.`,
    );
  }

  const variants = [
    {
      name: "divisao",
      file: `${VIDEO_BASENAME}-miniatura.png`,
      html: divisaoCapa(clubs, ink, rounds),
      check: chipsClearThePlot,
    },
    {
      name: "distancia",
      file: `${VIDEO_BASENAME}-miniatura-${gap}-pontos.png`,
      html: distanciaCapa(clubs, ink, rounds, gap),
      check: chipsClearThePlot,
    },
  ].filter((variant) => !wanted || variant.name === wanted);

  if (variants.length === 0) fail(`unknown --variant; expected "divisao" or "distancia"`);

  await capture(variants, {
    root: ROOT,
    outDir: OUT_DIR,
    width: WIDTH,
    height: HEIGHT,
    note: `dados até ${payload.snapshot}`,
  });
};

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
