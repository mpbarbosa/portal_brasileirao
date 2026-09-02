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
 *   npx tsx scripts/screenshot.ts https://brasileirao.mpbarbosa.com/ dark mobile
 *
 * The output name comes from the path, so `/clube/palmeiras` writes
 * `clube-palmeiras-light.png` and `/` writes `classificacao-light.png`.
 *
 * The theme is set through localStorage before the page loads, using the same
 * key the app reads, so the inline no-flash script picks it up on first paint —
 * clicking the toggle after load would capture a repaint. A screenshot showing
 * that flash would be documenting a bug the app does not have.
 *
 * **Retaking an image means re-reading its alt text in README.md.** The alt
 * describes what the picture shows — a round number, a points total, a
 * countdown — so a fresh capture can leave the description behind on a page
 * that no longer exists. Nothing verifies the two against each other, and
 * nothing can: the one reader alt text is written for is the one who cannot
 * see that it has drifted. It has already happened once, to the Ao vivo
 * countdown: it passed review and a merge, because a binary diff shows that
 * a PNG changed and never what it now says.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

import { captureRefusals, behindMainUnknown, type CaptureFacts } from "@/screenshot-core";
import { THEME_STORAGE_KEY, type Theme } from "@/theme-core";

const SITE = "https://brasileirao.mpbarbosa.com";
const OUT_DIR = path.join(process.cwd(), "docs/screenshots");
/** Captures that failed the identity check below. Gitignored, so a rejected
 *  shot is still there to look at without being committable. */
const LOCAL_DIR = path.join(OUT_DIR, "local");

const url = process.argv[2] ?? SITE;
const theme = (process.argv[3] ?? "light") as Theme;
const device = process.argv[4] ?? "desktop";

if (device !== "desktop" && device !== "mobile") {
  console.error(`Error: device must be "desktop" or "mobile", got "${device}"`);
  process.exit(1);
}

/**
 * A phone, rather than a narrow desktop window.
 *
 * `isMobile` and `hasTouch` matter: the layout below `sm` is not merely the
 * desktop one squeezed, and hover states do not exist on touch. 375x812 is the
 * viewport the navigation bar was measured against.
 */
const mobile = device === "mobile";

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
 * Whether this capture may be committed as documentation.
 *
 * "Shoot production" used to be the rule, and it was always a proxy for the
 * real requirement: *the image must depict this commit, with real data*. The
 * proxy failed in both directions. It let three stale captures through today,
 * because production can be behind the commit being documented and the rule
 * could not tell. And it forbade the one honest way out of the deadlock the
 * staleness check created, where the only reachable build of the current commit
 * is a local one.
 *
 * So ask the build directly. `/api/health` already reports both facts —
 * build.sh injects the commit, and `source` distinguishes live data from the
 * frozen seed — so this reads what is there rather than inferring:
 *
 * - **the captured build must have HEAD's appearance.** Not the same commit:
 *   the same *appearance*. Requiring equal shas is stricter than the property
 *   it protects and refuses correct captures — a commit that touches only
 *   CLAUDE.md and playwright.config.ts cannot move a pixel, yet it would put
 *   production one commit behind HEAD and block a capture that depicts the app
 *   exactly. So this asks whether any appearance path differs between the
 *   captured build and HEAD, and reads its list from the same file.
 *
 *   `check-screenshots.sh` asks a related question and now honours a
 *   `Screenshots-unaffected:` trailer for an edit that provably cannot reach a
 *   paint. This does not, deliberately: there the trailer resolves a deadlock —
 *   a re-shoot yields byte-identical PNGs, so no commit is possible and the gate
 *   is red forever — while a refusal here is a nuisance that writes to
 *   docs/screenshots/local and clears itself on the next deploy. The shared file
 *   is the path list, not the judgement.
 * - **the tree must not be behind `origin/main` on appearance.** Matching HEAD
 *   is not sufficient, because HEAD can itself be behind: a capture taken while
 *   `origin/main` carries an appearance commit this tree has not merged depicts
 *   the branch faithfully and depicts what it will be committed alongside
 *   incorrectly. It is stale on arrival. This fired in the wild — a capture at
 *   `ea27bee` matched its own HEAD exactly while `origin/main` held a change to
 *   `MatchPage`, was admitted, and CI then failed the capture PR on its own
 *   images. The check was a discipline before it was a guard, which is another
 *   way of saying it was not enforced.
 * - **provider must be football-data.** A worktree without `.env` boots on the
 *   seed snapshot and renders a frozen table that looks entirely plausible.
 *   `git worktree add` never brings `.env` — it is gitignored — so building a
 *   fresh tree for a clean capture is precisely the move that loses it. Worse,
 *   the resulting images differ from production in a way that reads as ordinary
 *   data drift, which is the one difference this project has taught itself to
 *   expect.
 *
 * A capture that fails any of these still gets written, to docs/screenshots/local,
 * so it can be looked at. It just cannot be committed. The verdict itself lives
 * in `screenshot-core.ts`, which is pure and tested; this file measures.
 */
const health = async (): Promise<{ sha: string; provider: string }> => {
  const response = await fetch(new URL("/api/health", url), {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${response.status} from /api/health`);

  return response.json() as Promise<{ sha: string; provider: string }>;
};

const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

/** Paths whose contents decide how a page looks. Read from disk, the same way
 *  check-screenshots.sh reads it, so the two cannot disagree — including when
 *  someone is in the middle of editing the list. */
const APPEARANCE = readFileSync(path.join(process.cwd(), "scripts/appearance-paths.txt"), "utf8")
  .split("\n")
  .filter(Boolean);

const lines = (out: string): string[] => out.split("\n").filter(Boolean);

/**
 * Appearance paths `origin/main` has that HEAD does not, or null if that cannot
 * be established.
 *
 * Fetches first, best-effort. The comparison is only worth as much as the
 * freshness of `origin/main`, and a remote-tracking ref left over from this
 * morning would answer "clean" with exactly the confidence of a real check —
 * which is the failure mode this whole guard exists to remove. A fetch is not a
 * new category of side effect here: the script already talks to the network to
 * read `/api/health` and to load the page it photographs.
 *
 * Offline degrades to null rather than to an error. A capture with no network
 * is still a legitimate capture; the caller says the check was skipped instead
 * of pretending it passed.
 */
const behindMain = (): string[] | null => {
  try {
    git("fetch", "--quiet", "origin", "main");
  } catch {
    // Offline, or no such remote. Fall through to whatever ref is on disk.
  }

  try {
    git("rev-parse", "--verify", "--quiet", "origin/main");
  } catch {
    return null;
  }

  // Three dots, and the distinction is the whole check. `git diff A..B` is
  // symmetric — it reports every path where the two endpoints differ, in either
  // direction — so the two-dot form flagged a tree that was *ahead* of
  // `origin/main` exactly as loudly as one that was behind, and refused the one
  // capture path this file documents as normal: a local build of a branch whose
  // whole purpose is to change how a page looks. `A...B` diffs from the merge
  // base to B, which is the question actually being asked: what does
  // `origin/main` carry that this tree has not merged.
  return lines(git("diff", "--name-only", "HEAD...origin/main", "--", ...APPEARANCE));
};

/** Everything the verdict depends on, measured rather than inferred. */
const gather = (sha: string, provider: string): CaptureFacts => {
  let known = false;
  try {
    git("cat-file", "-e", `${sha}^{commit}`);
    known = true;
  } catch {
    // Left false; `captureRefusals` turns that into the right message.
  }

  return {
    servedSha: sha,
    provider,
    known,
    // A sha we do not have cannot be diffed against, and asking would throw.
    changedVsHead:
      known && !sha.endsWith("-dirty")
        ? lines(git("diff", "--name-only", `${sha}..HEAD`, "--", ...APPEARANCE))
        : [],
    behindMain: behindMain(),
  };
};

let served: { sha: string; provider: string };
try {
  served = await health();
} catch (error) {
  console.error(`Error: could not read ${url}/api/health — ${(error as Error).message}`);
  process.exit(1);
}

const facts = gather(served.sha, served.provider);
const refusals = captureRefusals(facts);
const committable = refusals.length === 0;
const outDir = committable ? OUT_DIR : LOCAL_DIR;

if (!committable) {
  console.error("This capture cannot be committed:");
  for (const reason of refusals) console.error(`  ${reason}`);
  console.error("  writing to docs/screenshots/local instead");
} else if (behindMainUnknown(facts)) {
  // Not a refusal — see `behindMainUnknown`. But a verdict that skipped a check
  // should say so, or it reads as stronger than it is.
  console.warn("Note: could not compare against origin/main — this capture may already be stale.");
}

/** `/` is the classificação; anything else names itself after its path. */
const slug =
  (route === "/" ? "classificacao" : route.replace(/^\/|\/$/g, "").replace(/\//g, "-")) +
  (mobile ? "-mobile" : "");

/**
 * A whole-page shot suits the table, whose point is that it has twenty rows and
 * coloured rails at both ends. The club page runs to every fixture of the
 * season, so a full-page capture would be mostly a list.
 */
/**
 * A phone shot is exactly one screen.
 *
 * The boundary-aware crop below exists so a capture taller than a viewport does
 * not slice a card in half. On a phone there is nothing to decide: the image is
 * the screen, and it ends where the screen ends. It also settles the question
 * the fixed navigation bar raises — the bar sits *over* the last stretch of
 * content rather than ending it, so treating it as a crop boundary would cut at
 * whatever it happens to cover. Capturing the viewport puts it exactly where a
 * reader sees it.
 */
const fullPage = !mobile && route === "/";

/**
 * Roughly how tall a cropped shot may be, before it is trimmed to a boundary.
 *
 * **1080 rather than 1040, and the 40px is one page's missing section.** #199
 * added 32dp of sticky header to every route, which pushed `partida-554951`'s
 * **Melhores momentos** past the old line: the crop fell back to the previous
 * boundary, that image shrank 141px while every other cropped capture grew by
 * exactly 48, and the committed set stopped illustrating that feature anywhere.
 * A capture that gets *shorter* is content leaving the frame, and nothing checks
 * for it — the gate compares appearance sources and never what a picture shows.
 *
 * **And a capture that gets *longer* is content arriving, which owes the alt
 * text the same re-read.** That half is here because raising this number is what
 * proved it: #204 had removed the melhores-momentos clause from both 554951
 * captions when the section left the frame, so restoring the section made those
 * captions wrong in the other direction. Only one direction had been written
 * down, and it was the one that had not bitten anybody. A height that moves at
 * all — either way — is a caption to open the picture and re-read.
 *
 * **The value is measured, not rounded up to something comfortable.** That
 * section runs 965..1065 at this viewport, so anything below 1065 does not fix
 * it; and raising it too far silently pulls *other* pages past their next
 * boundary, which is a change to what the README documents rather than a
 * restoration. Crop heights per route at candidate values:
 *
 *                1040  1080  1090  1105
 *     ao-vivo     970   970   970  1108
 *     jogadores  1036  1036  1084  1084
 *     554951      963  1089  1089  1089
 *     554977     1023  1023  1023  1125
 *
 * The safe band is [1065, 1089] — at 1090 Jogadores joins, at 1105 two more.
 * 1080 sits inside it with room either way and moves exactly one pair.
 *
 * Keep this equal to the cropped viewport height below. They are separate
 * concerns — one bounds the crop, the other decides what is rendered — but a
 * crop taller than the viewport clips content that was never scrolled into
 * view, and the crests and broadcaster marks are lazy.
 */
const MAX_HEIGHT = 1080;

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
    // The played-fixture list, which is the last thing on this page to depend
    // on a payload: it needs `/api/matches` in full, where the tiles above it
    // need only the standings row.
    //
    // It waited on `main svg polyline` — the campanha sparkline — until the
    // mark moved to the **Painel**. That is worth recording rather than just
    // fixing: the wait was still *correct* as a readiness signal right up to
    // the commit that removed the element, and then it did not degrade, it
    // timed out at 30s and refused both club captures. A per-route wait
    // encodes a claim about what a page contains, so it goes stale exactly
    // like the alt text this file warns about two paragraphs up — and unlike
    // the alt text, it fails loudly, which is the good direction.
    // Filtered on the "×" a scoreline carries, because a bare `main ul > li`
    // resolves to the forma pills above it — five letters that render from the
    // same payload but say nothing about whether the fixtures below arrived.
    await page
      .locator("main ul > li")
      .filter({ hasText: "×" })
      .first()
      .waitFor({ timeout: 30_000 });
  } else if (route.startsWith("/jogos")) {
    // The round picker renders before the fixtures do, so waiting on it alone
    // would photograph an empty round.
    await page.locator("main ul > li").first().waitFor({ timeout: 30_000 });
  } else if (route === "/jogadores") {
    // The panels are closed on arrival, which is right for a reader and wrong
    // for a photograph: twenty collapsed rows document the index and say
    // nothing about what the page is for. Opening the first one puts a real
    // elenco in the frame, and the crop below lands on a player row inside it.
    //
    // `click`, not `open = true`: the disclosure is the browser's, and driving
    // it through the property would capture a state no reader can reach by the
    // route the page actually offers.
    const first = page.locator("[data-squad] summary").first();
    await first.waitFor({ timeout: 30_000 });
    await first.click();
    await page.locator("[data-squad] section h4").first().waitFor({ timeout: 30_000 });
  } else if (route.startsWith("/painel/")) {
    // A candle, not the card around it. `RankCandles` renders its `<figure>`
    // and its key from props, so the panel is on the page before the drawing
    // is — and `computeRankCandles` runs on the main thread over the whole
    // division's fixtures, which is the gap this closes. `data-round` is what
    // the end-to-end spec selects, so the two agree on what "drawn" means.
    //
    // Written as a per-route case knowing what that costs: #308's club capture
    // timed out for thirty seconds twice because its wait named an element a
    // commit had moved away. If the candles ever leave this page, this line is
    // the one that fails, and it fails loudly.
    await page.locator("main svg[data-candles] g[data-round]").first().waitFor({ timeout: 30_000 });
  } else if (route === "/ao-vivo") {
    // "Agora" renders before any data arrives — it has to, since "nothing is
    // being played" is an answer rather than an empty state. So the heading is
    // no evidence the page is ready, and waiting on it would photograph a page
    // with three headings and nothing under them.
    //
    // Tolerating absence rather than failing: with the season over and nothing
    // live, upcoming or recently played, every section is legitimately empty
    // and there is no row to wait for. That state is worth capturing too.
    await page
      .locator("main ul > li")
      .first()
      .waitFor({ timeout: 30_000 })
      .catch(() => {
        /* Nothing to show — see above. */
      });
  }

  // Every image actually decoded, rather than a fixed wait and a hope. Crests
  // and broadcaster marks are lazy, so this is the difference between a shot
  // with badges and a shot with holes.
  await page.waitForFunction(
    () => [...document.images].every((img) => img.complete && img.naturalWidth > 0),
    undefined,
    { timeout: 30_000 },
  );

  /**
   * Put the pointer down and let every transition finish.
   *
   * Two separate defects, one cause. Playwright's `click` moves the mouse to
   * the element and **leaves it there**, so the Jogadores summary stayed
   * `:hover` — and `STATE_LAYER` fades an 8% veil in over 200ms. Nothing here
   * waited for that, so the shot landed at an arbitrary point in the fade:
   * measured at alpha **0.008** on one run against a settled 0.08, with a
   * `CSSTransition` still listed as running.
   *
   *   1. **It was not reproducible.** Three captures of one build against one
   *      payload differed from each other across the whole summary row. Every
   *      re-shoot committed that band as noise, and a gate with one permanently
   *      restless image is a gate people stop reading.
   *   2. **It was the wrong picture.** Even settled, it documents the page as
   *      it looks with a cursor resting on the first club. A reader opening the
   *      README is not hovering anything.
   *
   * `(0, 0)` is the parking spot because it lands on the bare sticky header,
   * which carries no state layer of its own — verified rather than assumed.
   *
   * **Only transitions are awaited, never animations.** `animate-pulse` on the
   * Ao vivo live indicator is a `CSSAnimation` with infinite iterations, so its
   * `finished` promise never resolves; awaiting everything `getAnimations()`
   * returns would hang this for the full timeout on exactly the page where a
   * match being live is the thing worth photographing.
   */
  await page.mouse.move(0, 0);
  await page.evaluate(async () => {
    // Two frames, so the pointer leaving is recalculated into a transition
    // before we ask what is running. Asking immediately can find nothing and
    // return before the fade-out has even started.
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation instanceof CSSTransition)
        // A cancelled transition rejects; that is settled enough for a
        // photograph, and an unhandled rejection here would fail the capture.
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
};

const browser = await chromium.launch();
const context = await browser.newContext({
  // The layout is capped at max-w-3xl, so a very wide shot is mostly empty
  // background. This is wide enough to show the full table without padding it
  // out with dead space.
  viewport: mobile ? { width: 375, height: 812 } : { width: 960, height: fullPage ? 900 : MAX_HEIGHT },
  ...(mobile ? { isMobile: true, hasTouch: true } : {}),
  // 2x would make a full-page shot of a 20-row table needlessly heavy for a
  // README; 1.5 still looks sharp on a high-density display. A phone shot is a
  // third of the width, so it can afford 2.
  deviceScaleFactor: mobile ? 2 : 1.5,
  locale: "pt-BR",
  timezoneId: "America/Sao_Paulo",
});

await context.addInitScript(
  ([key, value]) => window.localStorage.setItem(key, value),
  [THEME_STORAGE_KEY, theme],
);

const page = await context.newPage();
console.log(`==> ${url} (${theme}, ${device}) — ${served.sha}, ${served.provider}`);
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
if (mobile) {
  await page.screenshot({ path: file });
} else if (fullPage) {
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

/**
 * Record which commit these images depict.
 *
 * Two jobs, and the second is the one that made it necessary.
 *
 * It documents provenance, which nothing did before: the directory held
 * sixteen PNGs and no statement of what they were pictures *of*.
 *
 * And it lets `check-screenshots.sh` be satisfiable. That gate compares the
 * newest commit touching an appearance path against the newest touching
 * `docs/screenshots`, which assumes a change to the app always yields new bytes
 * to commit. **An appearance change that moves no pixel breaks that
 * assumption** — a transition suppressed for one frame, and then the revert of
 * it, both reddened the gate while every one of the sixteen captures came back
 * byte-identical, leaving nothing to commit and no way to clear it. This file
 * changes whenever the captured commit does, so a refresh is always something
 * the gate can see.
 *
 * Deliberately only written for a **committable** capture. Claiming provenance
 * for images that went to `local/` would assert exactly the thing the guard
 * above just refused. And deliberately no timestamp: the sha is the substance,
 * and a clock would make every re-shoot a diff whether or not anything changed.
 */
if (committable) {
  writeFileSync(
    path.join(OUT_DIR, "CAPTURED"),
    `# Which commit these screenshots depict.\n` +
      `# Written by scripts/screenshot.ts; read by a human, not by the build.\n` +
      `commit ${served.sha}\n`,
  );
}
