import { expect, test, type Page } from "@/tests/e2e/clock";
import { finishedFixture, readMatches, serveMatches } from "@/tests/e2e/matches-payload";

/**
 * MD3's 48dp touch target, which is **not** the control's visible box.
 *
 * The distinction stopped being pedantry on production. M9 put the floor on the
 * box — `min-h-12` in `controlClasses` — and because a `min-height` beats a
 * `height` whatever the class order, it silently overrode the `h-10` that had
 * just levelled the top app bar's trailing group. Measured at `844cb15`: the
 * theme toggle 48x48 beside a 40x97 account control. Two changes each correct
 * on their own, and an 8px wobble between them.
 *
 * The target lives on a pseudo-element now, so a size can pick a smaller
 * *visible* control without giving up the target. `bar` is MD3's 40dp
 * top-app-bar control; everything else keeps the 48dp box, because nothing
 * argued for a smaller body control and a stepper at 34x32 was too small to hit.
 *
 * **The last two specs here click outside the visible box**, which is the only
 * thing that proves anything a stylesheet could not have lied about: a computed
 * `::before` size says the rule applied, not that a thumb landing there reaches
 * the control.
 *
 * And a target that grows past its box can grow into its *neighbour*, which is
 * the failure this technique has and the one a per-control assertion cannot
 * see. Both controls in the trailing group take a 48dp target from a 40dp box,
 * so each overhangs 4px — and they sat in a `gap-1`, 4px apart, which is 4px of
 * space for 8px of overhang. Measured on `37bb199`: the two targets overlapped
 * **exactly 4px**, the toggle won every pixel of it, and a press on the
 * avatar's right edge changed the theme instead of opening the account. Two
 * 48dp targets need 8px between two 40dp boxes; the gap is `gap-2` now.
 */

const boxes = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    const before = getComputedStyle(el, "::before");
    return {
      box: { h: Math.round(r.height), w: Math.round(r.width) },
      target: { h: parseFloat(before.height), w: parseFloat(before.width) },
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    };
  });

const TOGGLE = "header button[aria-label^='Ativar tema']";
const ACCOUNT = "header [data-account]";

test.describe("Alvos de toque na barra", () => {
  test("the trailing group is level, and every target clears 48dp", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.locator(ACCOUNT).waitFor();

    const toggle = await boxes(page, TOGGLE);
    const account = await boxes(page, ACCOUNT);

    // Level: the whole point. A difference here is the wobble coming back.
    expect(toggle.box.h, "the toggle and the account control must be one height")
      .toBe(account.box.h);
    // MD3's top-app-bar container.
    expect(toggle.box.h).toBe(40);
    // …and MD3's target, on both.
    for (const [name, m] of [["toggle", toggle], ["account", account]] as const) {
      expect(m.target.h, `${name} target height`).toBeGreaterThanOrEqual(48);
      expect(m.target.w, `${name} target width`).toBeGreaterThanOrEqual(48);
    }
  });

  test("a body control keeps the 48dp box it was given", async ({ page }) => {
    // The bar's 40dp container is a decision about the bar. Nothing argued for
    // shrinking the round stepper back to the 34x32 it was before M9.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/jogos");
    await page.locator("main select").waitFor();

    for (const selector of ['[aria-label="Rodada anterior"]', "main select"]) {
      const m = await boxes(page, selector);
      expect(m.box.h, `${selector} is ${m.box.h}px tall`).toBeGreaterThanOrEqual(48);
    }
  });

  test("a press 4px above the toggle still reaches it", async ({ page }) => {
    // The proof that the pseudo-element is a target and not a decoration.
    // Generated content participates in hit testing and its events target the
    // element that owns it — asserted here by pressing where the *box* is not.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.locator(TOGGLE).waitFor();

    const before = await page.getAttribute("html", "data-theme");
    const { rect } = await boxes(page, TOGGLE);

    // 4px above the top edge: inside the 48dp target, outside the 40dp box.
    await page.mouse.click(rect.x + rect.w / 2, rect.y - 4);

    await expect
      .poll(() => page.getAttribute("html", "data-theme"), {
        message: "clicking inside the target but outside the box did not toggle the theme",
      })
      .not.toBe(before);
  });

  test("the two trailing targets do not overlap, and the account keeps its own edge", async ({
    page,
  }) => {
    // Signed in is the case that fails: the account control is a 40px avatar
    // there, so its target overhangs 4px into the same gap the toggle's does.
    // Signed out it is ~97px wide, `w-full` gives it no overhang at all, and
    // the bug is invisible — which is why this signs in.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const login = await page.request.post("/api/auth/dev-login", {
      data: { subject: "sub-overlap", name: "Ana Torcedora" },
    });
    expect(login.ok()).toBeTruthy();
    await page.goto("/");
    await expect(page.locator(ACCOUNT)).toHaveAttribute("data-account", "signed-in");

    const account = await boxes(page, ACCOUNT);
    const toggle = await boxes(page, TOGGLE);

    // Each target is centred on its box, so it overhangs by half the surplus.
    const overhang = (m: typeof account) => (m.target.w - m.rect.w) / 2;
    const accountReach = account.rect.x + account.rect.w + overhang(account);
    const toggleReach = toggle.rect.x - overhang(toggle);

    expect(
      accountReach,
      `the two touch targets overlap by ${(accountReach - toggleReach).toFixed(1)}px`,
    ).toBeLessThanOrEqual(toggleReach + 0.001);

    // The measurement above is geometry; this is the consequence. A press just
    // inside the account control's own target must reach the account, not the
    // control next door — the whole overlap was invisible until something
    // pressed there and the theme changed.
    const before = await page.getAttribute("html", "data-theme");
    await page.mouse.click(accountReach - 1, account.rect.y + account.rect.h / 2);

    await expect(page).toHaveURL(/\/conta$/);
    expect(
      await page.getAttribute("html", "data-theme"),
      "a press on the account control's edge toggled the theme instead",
    ).toBe(before);
  });
});

/**
 * The Completa / Casa / Fora segments above the Classificação.
 *
 * A segmented button is a control by any reading — one choice among three, and
 * it changes the table — and on production at `e4bee8a` its segments measured
 * **85x32, 57x32 and 53x32** at 320, 360 and 375dp with no target at all: the
 * one control on the home page under the floor. `TOUCH_TARGET` gives each 48dp
 * without touching the 32px box, which the first case asserts so a later
 * "fix" cannot buy the target by growing the control.
 *
 * **The group's `overflow-hidden` had to go for that, and it is the trap.** An
 * overflow clip applies to hit testing as well as to paint, so a target hanging
 * off a segment inside a clipping container is 32px tall to a thumb whatever its
 * computed `::before` says. The first case below cannot see that; the press can.
 */
test.describe("Alvos de toque no recorte da classificação", () => {
  const segment = (side: string) => `[data-side-control] [data-side="${side}"]`;

  test("each segment keeps its 32px box and gains the 48dp target", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.locator("[data-side-control]").waitFor();

    for (const side of ["all", "home", "away"]) {
      const m = await boxes(page, segment(side));
      expect(m.box.h, `the ${side} segment changed its visible height`).toBe(32);
      expect(m.target.h, `${side} target height`).toBeGreaterThanOrEqual(48);
      expect(m.target.w, `${side} target width`).toBeGreaterThanOrEqual(48);
    }
  });

  for (const width of [320, 375]) {
    test(`a press 4px below a segment still selects it at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/");
      const home = page.locator(segment("home"));
      await expect(home).toHaveAttribute("aria-checked", "false");

      // 4px below the box: inside the 48dp target, outside the 32px segment and
      // 3px outside the group's own border.
      const { rect } = await boxes(page, segment("home"));
      await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h + 4);

      await expect(home, "a press inside the target but below the box did not select Casa")
        .toHaveAttribute("aria-checked", "true");
    });
  }
});

/**
 * The channel switcher under **Melhores momentos**, which is the one place in
 * this app where a *content* link is also a control.
 *
 * The 48dp floor deliberately does not reach inline links — twenty club names
 * in the Classificação, ten fixture links, ~950 player buttons — and these look
 * like exactly that: words in a caption. They are not. Pressing one swaps the
 * video in the frame above, which is a control's job, and on production they
 * measured **44x14 and 71x14** on a phone where the pills they replaced had
 * been 48dp targets.
 *
 * **The band is the fix and the collision is the risk.** `TOUCH_TARGET` hangs
 * off a pseudo-element, so it overhangs the box without moving anything — and
 * 48dp over a 14px line reaches 17px up into the caption and 17px down into
 * "Data e hora", where a thumb aiming at neither would change the video. The
 * row therefore carries its own 48dp band, and these cases measure the four
 * clearances rather than trusting that.
 */
test.describe("Alvos de toque no seletor de emissora", () => {
  /**
   * Open a finished fixture whose highlights are `channels`, in order, each on
   * its own YouTube video — produced, so the row holds what the test says.
   *
   * These opened 554951 (Botafogo 1 x 1 Fluminense), whose three curated
   * channels made the row two links. `highlights.ts` is curated by hand and by
   * `find-highlights`, so which fixture carries three channels is exactly the
   * curated data a spec must not depend on.
   */
  const openChannels = async (page: Page, channels: string[]) => {
    const body = await readMatches(page);
    const match = finishedFixture(body);
    const videos = ["CT9UKBvQqXM", "4nGUP-nRuvc", "2Nl3Ra6Uu0M"];
    match.highlights = channels.map((channel, index) => ({
      url: `https://www.youtube.com/watch?v=${videos[index]}`,
      channel,
    }));
    await serveMatches(page, body);
    await page.goto(`/partida/${match.id}`);
  };

  /** Three channels, so the row under the frame holds two. */
  const THREE_CHANNELS = ["ge tv", "CazéTV", "UOL Esporte"];

  const row = (page: Page) =>
    page.locator("main section", { hasText: "Melhores momentos" }).locator("p").last();

  test("each channel link carries a 48dp target it did not have", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openChannels(page, THREE_CHANNELS);
    await expect(page.locator("main iframe")).toHaveCount(1);

    const links = row(page).locator("a");
    await expect(links).toHaveCount(2);

    for (const link of await links.all()) {
      const m = await link.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const b = getComputedStyle(el, "::before");
        return {
          box: { w: Math.round(r.width), h: Math.round(r.height) },
          target: { w: parseFloat(b.height), h: parseFloat(b.height) },
          name: el.textContent?.trim().slice(0, 12),
        };
      });
      // The box is untouched — this raises the target, not the type.
      expect(m.box.h, `${m.name} box height`).toBeLessThan(48);
      expect(m.target.h, `${m.name} target height`).toBeGreaterThanOrEqual(48);
    }
  });

  test("the two targets do not overlap, and neither reaches its neighbours", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openChannels(page, THREE_CHANNELS);
    await expect(page.locator("main iframe")).toHaveCount(1);

    const m = await row(page).evaluate((rowEl) => {
      const rect = (el: Element) => el.getBoundingClientRect();
      const targetOf = (el: Element) => {
        const r = rect(el);
        const b = getComputedStyle(el, "::before");
        const w = parseFloat(b.width);
        const h = parseFloat(b.height);
        return { x: r.x + r.width / 2 - w / 2, y: r.y + r.height / 2 - h / 2, w, h };
      };
      const links = [...rowEl.querySelectorAll("a")];
      const section = rowEl.closest("section")!;
      return {
        targets: links.map(targetOf),
        // The label the row opens with, and the caption's own link above it.
        labelRight: rect(rowEl.firstElementChild!).right,
        captionLinkBottom: rect(section.querySelector("p a")!).bottom,
        // The first term of the list below the section.
        nextTermTop: rect(document.querySelector("main dl dt")!).top,
      };
    });

    const [first, second] = m.targets;
    // Horizontal: the failure `interaction.ts` records between the two controls
    // in the top app bar, where 8px of overhang sat in a 4px gap.
    expect(
      first.x + first.w,
      `the two channel targets overlap by ${(first.x + first.w - second.x).toFixed(1)}px`,
    ).toBeLessThanOrEqual(second.x);
    // …and neither eats the words in front of the list.
    expect(first.x, "the first target reaches back over “Também por”").toBeGreaterThanOrEqual(
      m.labelRight,
    );
    // Vertical: the band is what keeps the overhang off the caption above and
    // the kickoff below. Without it a press on either would swap the video.
    for (const t of m.targets) {
      expect(t.y, "a target reaches up into the caption").toBeGreaterThanOrEqual(
        m.captionLinkBottom,
      );
      expect(t.y + t.h, "a target reaches down into “Data e hora”").toBeLessThanOrEqual(
        m.nextTermTop,
      );
    }
  });

  /**
   * The horizontal half, with the names it takes to reach it.
   *
   * **The real channel vocabulary cannot collide, which makes the assertion
   * above vacuous on its own.** `CazéTV` measures 44px and `UOL Esporte` 71, so
   * they overhang 2px and 0 against ~16px of gap — closing `gap-x-3` entirely
   * still leaves them clear, confirmed by mutation. What *can* collide is a
   * short pair, and a name is curator input rather than a constant, so the
   * state is produced here instead of hunted for: `CLAUDE.md`'s rule for
   * `goals.spec.ts`, one section over.
   *
   * Prepared once and fulfilled from memory, never `route.fetch()` per
   * request — a proxying handler came back as something other than the
   * envelope under this suite's workers.
   */
  test("two short channel names still do not collide", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    // Two names short enough to overhang hard, and neither is a channel
    // `playsInPage` refuses, so both keep a target.
    await openChannels(page, ["ge tv", "ge sp", "ge rj"]);
    await expect(page.locator("main iframe")).toHaveCount(1);
    const links = row(page).locator("a");
    await expect(links).toHaveCount(2);

    const targets = await row(page).evaluate((rowEl) =>
      [...rowEl.querySelectorAll("a")].map((el) => {
        const r = el.getBoundingClientRect();
        const b = getComputedStyle(el, "::before");
        const w = parseFloat(b.width);
        return { x: r.x + r.width / 2 - w / 2, w, box: Math.round(r.width) };
      }),
    );

    const [first, second] = targets;
    expect(
      first.x + first.w,
      `two ${first.box}px names overlap by ${(first.x + first.w - second.x).toFixed(1)}px`,
    ).toBeLessThanOrEqual(second.x);
  });

  test("a press 4px above the box still swaps the video", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openChannels(page, THREE_CHANNELS);
    const frame = page.locator("main iframe");
    await expect(frame).toHaveCount(1);
    const before = await frame.getAttribute("src");

    // The only assertion here a stylesheet could not have lied about: the
    // computed `::before` says the rule applied, not that a thumb landing
    // outside the word reaches the link.
    const swap = row(page).locator("a[aria-controls]");
    // **Centred in the viewport first, and `scrollIntoViewIfNeeded` is not
    // enough.** At 375dp this row lands under the **fixed bottom navigation
    // bar**, which really is on top of it: `document.elementFromPoint` at the
    // press coordinate returned `a.flex.flex-col` — a nav destination — and the
    // first two versions of this case pressed the navigation and reported the
    // target as broken. Playwright will not scroll it away either, because it
    // counts an element inside the viewport as visible however much a fixed bar
    // paints over it. Only `block: "center"` moves it clear.
    await swap.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.mouse.move(0, 0);
    const rect = (await swap.boundingBox())!;
    await page.mouse.click(rect.x + rect.width / 2, rect.y - 4);

    await expect(frame).not.toHaveAttribute("src", before ?? "");
    // And still one frame: the press must swap the video, not add a player.
    await expect(frame).toHaveCount(1);
  });
});
