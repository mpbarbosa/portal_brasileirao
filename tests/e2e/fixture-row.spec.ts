import { expect, test, type Page } from "@/tests/e2e/clock";
import { readMatches, serveMatches } from "@/tests/e2e/matches-payload";

/**
 * The fixture row's width, which #310 bought and nothing defended.
 *
 * `MatchList` draws every fixture row in the app — Jogos, Ao vivo's **A
 * seguir** and **Últimos resultados**, the club page and the estádio page. #310
 * gave each side a crest, and the crests alone were a regression on a phone:
 * `StatusChip` is `shrink-0`, so beside the fixture line it takes about 72px of
 * a 343px row and the club names are what give way. Measured at 375dp, **12 of
 * 24** names went into an ellipsis, against 2 of 24 before the marks. The row
 * therefore stacks below `sm` and returns the whole width to the names.
 *
 * **That measurement shipped with no assertion behind it**, which is the gap
 * this file closes. It is the third time in this repo a layout has been correct
 * and undefended: `navigation.spec.ts` asserted the wordmark was *visible*
 * while it rendered 27dp wide, and the brand-mark spec passed while the
 * subtitle overflowed its box by 3.6px. Both were fixed by measuring
 * `scrollWidth` against `clientWidth` — "visible" and "not truncated" are
 * different claims, and only the second one is what a reader gets.
 *
 * **Jogos rather than Ao vivo, though Ao vivo is where the crests were asked
 * for.** The row is the shared component and Jogos always renders a round of
 * them, where Ao vivo's two sections are conditional on the calendar —
 * `live.spec.ts` guards both with `if (await …count())` for that reason, and a
 * spec that quietly measures nothing in December is worse than no spec.
 */

/** Every fixture row on the page. */
const rows = (page: Page) => page.locator("main ul > li").filter({ has: page.locator("a[href^='/partida/']") });

/** The line naming both clubs and the scoreline — the element `FIXTURE_ROW` sits on. */
const fixtureLine = (page: Page) => rows(page).locator("a[href^='/partida/']");

/**
 * The status chip.
 *
 * Addressed by its own vocabulary rather than by a class: `StatusChip` owns the
 * whole label set, and selecting on `rounded-x-small` would make this spec fail
 * on a shape-scale change that moves no pixel a reader cares about.
 */
const chip = (page: Page) =>
  rows(page).getByText(/^(Encerrado|A realizar|Ao vivo|Adiado|Cancelado)$/);

const openRounds = async (page: Page) => {
  await page.goto("/jogos");
  await expect(rows(page).first()).toBeVisible();
};

/**
 * Serve the round with every club given a long name.
 *
 * **The assertion below is about the row's LAYOUT and was resting on the
 * season's DATA.** It measures how much room the fixture line could have had,
 * and the line is content-sized — so it only reaches the cap when the names are
 * long enough to need it. Round 26 opens with *Bragantino × Bahia*, which is
 * not, and the spec went red on `main` at 191.125 against a 237.078 threshold
 * with nothing about the layout having changed. It blocked every deploy, since
 * `deploy` is `needs: [check, e2e]`.
 *
 * Which fixture is first is exactly the "how much curated data exists" this
 * suite refuses to depend on elsewhere — `openMatchWithoutVideo` in
 * `match-page.spec.ts` says it plainly: tested by **producing the state that
 * reaches it** rather than by hoping the season still contains one. The season
 * rolls forward every week and will supply a short pairing again.
 *
 * Every club rather than the first fixture's two, so the helper does not have
 * to know which fixture the feed puts first — that ordering is
 * `compareForFeed`'s business and not this spec's.
 *
 * Prepared once and fulfilled from memory, never `route.fetch()` per request:
 * `meu-time.spec.ts` records a proxying handler coming back as something other
 * than the envelope under the suite's workers, green in isolation.
 */
const withLongNames = async (page: Page) => {
  const body = await readMatches(page);
  body.data.clubs = body.data.clubs.map((club) => ({
    ...club,
    shortName: `Associação Atlética ${club.tla}`,
  }));
  await serveMatches(page, body);
};

/**
 * Serve a season in which every fixture is the division's two widest names,
 * played, so the row renders the widest line it is ever asked to.
 *
 * **Widest by rendered pixels, measured in the page**, by cloning the font off
 * a name the row has already drawn — the row's own type step, weight and
 * letter spacing, whatever they become. Sorting the strings by `length` picks
 * the wrong pair: three club names are thirteen characters and they differ by
 * 18px.
 *
 * **It renames nothing** — it points the fixtures at the clubs that already
 * hold those names, so the crest, the code and the `tla` stay each other's.
 *
 * **Played and 0-0, because an unplayed row is 26px narrower**: `fixtureScore`
 * renders a bare `×` until there is a score, and the scoreline is `shrink-0`,
 * so the fixture that truncates is a finished one. Every digit is the same
 * width under `tabular-nums`, so any single-digit score measures the same; a
 * two-digit one would be wider and is not a thing this league produces, which
 * is the line between producing a real state and inventing one.
 *
 * Every fixture rather than the first, so the helper does not have to know
 * which round `currentRound` lands on or which fixture `compareForFeed` puts
 * at the top — the same reason `withLongNames` renames every club.
 */
const widestPairing = async (page: Page) => {
  const body = await readMatches(page);
  const widest = await fixtureLine(page)
    .first()
    .locator("span.truncate")
    .first()
    .evaluate(
      (drawn, names) => {
        const probe = document.createElement("span");
        const style = getComputedStyle(drawn as HTMLElement);
        probe.style.font = style.font;
        probe.style.letterSpacing = style.letterSpacing;
        probe.style.position = "absolute";
        probe.style.visibility = "hidden";
        probe.style.whiteSpace = "nowrap";
        document.body.append(probe);
        const measured = (names as string[]).map((name) => {
          probe.textContent = name;
          return [name, probe.getBoundingClientRect().width] as [string, number];
        });
        probe.remove();
        return measured.sort((a, b) => b[1] - a[1]).map(([name]) => name);
      },
      body.data.clubs.map((club) => club.shortName),
    );

  const codeOf = new Map(body.data.clubs.map((club) => [club.shortName, club.code]));
  const [home, away] = [codeOf.get(widest[0]), codeOf.get(widest[1])];
  for (const match of body.data.matches) {
    match.homeCode = home;
    match.awayCode = away;
    match.homeGoals = 0;
    match.awayGoals = 0;
    match.status = "FINISHED";
  }
  await serveMatches(page, body);
};

test.describe("Fixture row", () => {
  test("below sm the chip sits above the fixture line, not beside it", async ({ page }) => {
    // The mechanism, and the whole of what the stacking buys. Stated as a
    // geometric fact rather than as a class name, so it survives the row being
    // rewritten and fails if the row is ever put back on one line: side by
    // side, the two boxes share a horizontal band.
    await page.setViewportSize({ width: 375, height: 800 });
    await openRounds(page);

    const line = (await fixtureLine(page).first().boundingBox())!;
    const status = (await chip(page).first().boundingBox())!;

    expect(status.y + status.height).toBeLessThanOrEqual(line.y + 1);
  });

  for (const width of [320, 375]) {
    test(`the fixture line has the room the chip used to take, at ${width}dp`, async ({ page }) => {
      // **Not "the line fills the row".** It does not, and the first draft of
      // this test asserted that and failed at 375dp with 266.86 against 309.
      // `items-start` is exactly what stops a flex item stretching on the
      // cross axis, so the line is *content*-sized and only reaches the full
      // width when the names need it.
      //
      // What separates the two layouts is therefore how much room the line
      // *could* have had: side by side it is capped at the row's content box
      // less the chip and the gap, and stacked it is not capped by the chip at
      // all. The 26px is the card's own chrome: `px-3` plus the border, both
      // widths here being below `sm`. It read 34 while that padding was
      // `px-4` at every width, and the number is the card's and not this
      // spec's — read it off `MatchList` rather than trusting this line.
      //
      // **The names are supplied rather than borrowed from the season**, which
      // is what `withLongNames` is for and why this stopped being a spec that
      // goes red every time the round rolls onto a short pairing. It still
      // bites: put the row back side by side and the cap returns, whatever the
      // names are.
      await withLongNames(page);
      await page.setViewportSize({ width, height: 800 });
      await openRounds(page);

      const row = (await rows(page).first().boundingBox())!;
      const line = (await fixtureLine(page).first().boundingBox())!;
      const status = (await chip(page).first().boundingBox())!;

      expect(line.width).toBeGreaterThan(row.width - 26 - status.width);
    });
  }

  test("the chip keeps its own width when the row stacks", async ({ page }) => {
    // `items-start`, and it is load-bearing rather than tidy: a flex item's
    // cross size stretches by default, and `inline-flex` does not save it —
    // as a flex item the chip is blockified. Under `align-items: stretch` it
    // measured 309px against 72px, and stopped reading as a chip at all.
    await page.setViewportSize({ width: 375, height: 800 });
    await openRounds(page);

    const row = (await rows(page).first().boundingBox())!;
    const status = (await chip(page).first().boundingBox())!;

    expect(status.width).toBeLessThan(row.width / 2);
  });

  test("no club name is truncated at 375dp", async ({ page }) => {
    // The symptom rather than the mechanism: what a reader actually met was
    // `Botaf… 2 × 3 Athletic…` on the device this board is read on most.
    //
    // **This is the one assertion here that reads the snapshot rather than the
    // layout**, so a `sync-seed-data` bringing in a longer club name could
    // redden it honestly. If that happens, open the board at 375dp before
    // touching this line — a name that no longer fits is the thing this file
    // exists to report, not a threshold to relax. 320dp is deliberately not
    // asserted: four names legitimately clip there, and pinning that count
    // would be asserting how much curated data exists.
    await page.setViewportSize({ width: 375, height: 800 });
    await openRounds(page);

    const overflow = await fixtureLine(page)
      .locator("span.truncate")
      .evaluateAll((els) => els.map((el) => el.scrollWidth - el.clientWidth));

    expect(overflow.length).toBeGreaterThan(0);
    expect(overflow.filter((px) => px > 0)).toEqual([]);
  });

  test("the division's widest pairing is not truncated at 375dp", async ({ page }) => {
    // **The spec above reads the snapshot, and on 2026-10-12 the snapshot was
    // the only thing keeping it green while production was broken.** It opens
    // whatever round the committed fixtures put first, and that was round 21,
    // `São Paulo × Santos` — two short names that fit with room to spare. The
    // live site, reading the provider, was on round 30, which opens
    // `Vasco da Gama 0 × 0 Clube do Remo`: measured against production at
    // `fe95911`, 320px of content in a 309px line, 5px off one name and 6px
    // off the other. The seed catching up is what would finally have reddened
    // it — days after a reader met it, and only until the round rolled on.
    //
    // So this one **produces** the worst case instead of waiting for the
    // season to supply it, which is the rule the rest of this suite already
    // follows and `withLongNames` above already applies to its own assertion.
    // The two are kept apart rather than merged: that one is the honest report
    // that *today's* board fits, and this one is the claim that **no** board
    // can fail, which is the thing a fix can actually be held to.
    //
    // **The pairing is derived, never named.** Hard-coding Vasco and Remo
    // would be a claim about which clubs are in this division — they are
    // promoted and relegated every year, and the seed generator already
    // refuses duplicate display names, so the two widest are always two
    // distinct clubs. The widths come from the browser rather than from
    // character counts: `Vasco da Gama`, `Clube do Remo` and `Internacional`
    // are all thirteen characters and measure 112.25, 108.77 and 93.77.
    await page.setViewportSize({ width: 375, height: 800 });
    await openRounds(page);
    await widestPairing(page);
    await openRounds(page);

    const overflow = await fixtureLine(page)
      .locator("span.truncate")
      .evaluateAll((els) => els.map((el) => el.scrollWidth - el.clientWidth));

    expect(overflow.length).toBeGreaterThan(0);
    expect(overflow.filter((px) => px > 0)).toEqual([]);
  });

  test("both clubs carry a crest, which is the feature itself", async ({ page }) => {
    // Only the crests are `aria-hidden` inside the line — the names and the
    // scoreline are read out — so this counts the marks without depending on
    // whether a club resolved to an image or to its monogram fallback.
    await openRounds(page);

    const marks = fixtureLine(page).first().locator("[aria-hidden='true']");
    await expect(marks).toHaveCount(2);
  });

  test("from sm up the row stays two columns, as it was before the crests", async ({ page }) => {
    // The other half of the breakpoint. #310 changed nothing on a desktop, and
    // a later "just stack it everywhere" would be a silent restyle of four
    // sections — so the side-by-side band is asserted rather than assumed.
    await page.setViewportSize({ width: 900, height: 800 });
    await openRounds(page);

    const line = (await fixtureLine(page).first().boundingBox())!;
    const status = (await chip(page).first().boundingBox())!;

    // They overlap vertically, which is what "beside" means geometrically.
    expect(status.y).toBeLessThan(line.y + line.height);
    expect(line.y).toBeLessThan(status.y + status.height);
  });
});
