import { BROADCASTS } from "@/src/data/broadcasts";
import { SEED_MATCHES } from "@/src/data/matches";
import { expect, test, type Page } from "@/tests/e2e/clock";

/**
 * These assert the *shape* of the broadcast line, not how many fixtures happen
 * to be curated: `src/data/broadcasts.ts` grows every time the sync script runs,
 * so any test counting curated fixtures would break on the next sync.
 *
 * **The rounds are derived, not named, and that is the second half of the same
 * rule.** They used to be literals — round 25 curated, round 1 "in the past and
 * never curated" — and the sync that swept the settled season curated round 1
 * along with everything else, so `an uncurated round shows no broadcast lines`
 * failed on data rather than on behaviour. Committed is not the same as stable:
 * the file is committed *and* regenerated. Naming a round is the same mistake as
 * counting fixtures, one level up, so the round is now read from the same data
 * the server will answer with.
 *
 * The suite boots with `DISABLE_FOOTBALL_DATA=true`, so `/api/matches` is
 * exactly `SEED_MATCHES` with `BROADCASTS` attached — these imports are the server's
 * own inputs, not a second guess at them.
 */
const curatedPerRound = new Map<number, { total: number; curated: number }>();
for (const match of SEED_MATCHES) {
  const row = curatedPerRound.get(match.round) ?? { total: 0, curated: 0 };
  row.total += 1;
  if (BROADCASTS[match.id]?.length) row.curated += 1;
  curatedPerRound.set(match.round, row);
}
const rounds = [...curatedPerRound.entries()].sort(([a], [b]) => a - b);

const fullyCurated = rounds.find(([, r]) => r.curated === r.total && r.total > 0);
const fullyUncurated = rounds.find(([, r]) => r.curated === 0 && r.total > 0);

// Loud rather than skipped. A season with no uncurated round left is a real
// state — CBF publishes two to three weeks out, so it arrives at season end —
// and the answer then is a prepared payload, as `meu-time.spec.ts` uses for the
// LIVE branch the snapshot cannot reach. It is not a reason to quietly drop the
// assertion, which is what a `test.skip` here would do.
if (!fullyCurated || !fullyUncurated) {
  throw new Error(
    "broadcasts.spec.ts needs one fully curated round and one with no curated " +
      "fixture at all, and src/data/broadcasts.ts no longer offers both " +
      `(curated: ${fullyCurated?.[0] ?? "none"}, uncurated: ${fullyUncurated?.[0] ?? "none"}). ` +
      "Serve a prepared /api/matches payload for the missing side.",
  );
}

const CURATED_ROUND = String(fullyCurated[0]);
const UNCURATED_ROUND = String(fullyUncurated[0]);

const goToRound = async (page: Page, round: string) => {
  await page.goto(`/jogos/${round}`);
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText(`${round}ª rodada`);
  await expect(page.locator("main ul > li").first()).toBeVisible();
};

test.describe("Onde assistir", () => {
  test("a curated round shows channels", async ({ page }) => {
    await goToRound(page, CURATED_ROUND);

    const labelled = await page.getByText("Onde assistir:").count();
    expect(labelled).toBeGreaterThan(0);
  });

  test("every broadcast line is announced", async ({ page }) => {
    await goToRound(page, CURATED_ROUND);

    // The marks are pictures; the visually hidden label is what says what they
    // are. One label per line that carries marks.
    const lines = page.locator("main ul > li").filter({ has: page.locator("[data-mark]") });
    const labels = page.getByText("Onde assistir:");

    expect(await lines.count()).toBeGreaterThan(0);
    expect(await labels.count()).toBe(await lines.count());
  });

  test("no broadcast line is empty", async ({ page }) => {
    await goToRound(page, CURATED_ROUND);

    const lines = await page.locator("main ul > li").filter({ has: page.locator("[data-mark]") }).all();
    for (const line of lines) {
      // Every mark names its broadcaster, whether it is a logo or a wordmark.
      const names = await line.locator("[data-mark]").evaluateAll((all) =>
        all.map((m) => m.getAttribute("data-mark") ?? ""),
      );
      expect(names.length).toBeGreaterThan(0);
      expect(names.every((n) => n.trim().length > 0)).toBe(true);
    }
  });

  test("several channels render as several marks", async ({ page }) => {
    await goToRound(page, CURATED_ROUND);

    const lines = await page.locator("main ul > li").filter({ has: page.locator("[data-mark]") }).all();
    const counts = await Promise.all(lines.map((l) => l.locator("[data-mark]").count()));

    // Each is its own mark rather than one run of text, so a fixture on two
    // channels shows two.
    expect(counts.some((n) => n > 1)).toBe(true);
  });

  test("an uncurated round shows no broadcast lines at all", async ({ page }) => {
    // Absent means unknown, and an empty line would be worse than none.
    await goToRound(page, UNCURATED_ROUND);

    await expect(page.getByText("Onde assistir:")).toHaveCount(0);
    await expect(page.locator("[data-mark]")).toHaveCount(0);
  });

  test("a broadcaster is shown as its own mark", async ({ page }) => {
    await page.goto("/partida/554972");

    // Premiere, YouTube and Cazé TV all have one; the image carries the
    // broadcaster name so the marks read exactly as the text they replaced.
    const marks = page.locator("dd img[alt]");
    await expect(marks.first()).toBeVisible();

    const alts = await marks.evaluateAll((all) => all.map((i) => i.getAttribute("alt")));
    expect(alts).toContain("Premiere");
    expect(alts.every((a) => (a ?? "").length > 0)).toBe(true);
  });

  test("every mark actually renders", async ({ page }) => {
    await page.goto("/partida/554972");

    const mark = page.locator("dd img[alt='Premiere']");
    // Served from our own origin. Hotlinking Commons passed a src assertion
    // while showing empty plates in production, because Commons answers a
    // browser's third or fourth request with 429 — so assert the pixels, not
    // the attribute.
    await expect(mark).toHaveAttribute("src", "/marks/premiere.png");
    // These are lazy, so bring them into view before asking whether they
    // painted — otherwise this passes or fails on viewport height.
    await mark.scrollIntoViewIfNeeded();
    await expect(mark).toBeVisible();

    // The SPA catch-all answers 200 with the HTML shell for a path that is not
    // a file, so a mark named in the data but never vendored into
    // `public/marks/` would still render an <img> and still "load" as far as
    // the DOM is concerned. Only the decoded size tells the two apart.
    //
    // So this must be a poll rather than a single read. `toBeVisible()` above
    // resolves as soon as an element has a box and says nothing about whether
    // the bytes have decoded, and only the one mark above was ever waited on
    // while this reads every `dd img` on the page — including lazy ones. Read
    // once and `naturalWidth` is 0 for a mark being served perfectly: the same
    // defect fixed in `players.spec.ts`, which failed on the full local suite
    // at 7 workers while passing in isolation and in the slower CI.
    const marks = page.locator("dd img");

    // Name the marks that exist, once. `toBeVisible()` above has already put at
    // least the Premiere one in the DOM, so this cannot be empty.
    const named = await marks.evaluateAll((all) => all.map((i) => i.getAttribute("alt")));
    expect(named.length).toBeGreaterThan(0);

    // Then wait for every one of them to have painted. Written as the set that
    // HAS decoded reaching the set that exists, rather than as "nothing is
    // undecoded": a poll for an absence returns on its first read, so
    // `.toEqual([])` here would be satisfied by the marks not having rendered
    // yet and would assert only that this test out-ran the browser.
    // `tests/e2e-poll.test.ts` refuses that shape, and refused this one.
    await expect
      .poll(() =>
        marks.evaluateAll((all) =>
          all
            .filter((i) => (i as HTMLImageElement).naturalWidth > 0)
            .map((i) => i.getAttribute("alt")),
        ),
      )
      .toEqual(named);
  });

  test("a broadcaster with no mark still reads as its name", async ({ page }) => {
    await page.goto("/partida/554972");

    // Record's only Commons logo is CC BY-SA, so it renders as a wordmark
    // rather than an image — and must still be legible, not missing.
    await expect(page.getByText("Record", { exact: true })).toBeVisible();
  });

  test("the highlights link keeps its name when the label becomes a mark", async ({ page }) => {
    await page.goto("/partida/554975");

    // The accessible name must not rest on an image's alt: these are lazy and
    // cross-origin, so the text carries it and the mark is decorative.
    await expect(page.getByRole("link", { name: /^ge tv —/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^CazéTV —/ })).toBeVisible();
  });
});
