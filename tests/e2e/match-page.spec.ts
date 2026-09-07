import { expect, test, type Page } from "@/tests/e2e/clock";
import { SEED_MATCHES } from "@/src/data/matches";
import { VENUES } from "@/src/data/venues";
import { BROADCASTS } from "@/src/data/broadcasts";
import { HIGHLIGHTS } from "@/src/data/highlights";
import { youtubeVideoId } from "@/club-core";
import { playsInPage } from "@/match-core";

/**
 * The two rounds these tests need, **derived from the committed data rather
 * than written down** — `clock.ts`'s rule for `E2E_NOW`, one file over.
 *
 * They were literals, `24` and `25`, under a comment saying they were "stable
 * because the data is committed". That was true when written and false the
 * first time `sync-seed-data` ran: round 25 finished, and `an upcoming match
 * offers no highlights` opened a played fixture and found the search link it
 * asserts is absent. The comment is what stopped anyone asking — a claim that
 * produces no work while it holds.
 *
 * Derived, a seed sync moves both without anybody remembering, which is the
 * whole of what `SNAPSHOT_DATE` buys the clock.
 */
const settled = (match: (typeof SEED_MATCHES)[number]) =>
  match.status === "FINISHED" && match.homeGoals !== null;

const lastPlayed = Math.max(...SEED_MATCHES.filter(settled).map((match) => match.round));

/** A round with finished matches carrying goals. */
const PLAYED_ROUND = String(lastPlayed);
/** The first round with nothing played yet. */
const UPCOMING_ROUND = String(lastPlayed + 1);

/**
 * At the end of a season there is no upcoming round, and the four tests that
 * need one are skipped rather than asserting against an empty page. Not
 * reachable from today's snapshot; here because the alternative is a suite that
 * goes red in November for being correct.
 */
const noUpcomingRound = !SEED_MATCHES.some((match) => match.round === lastPlayed + 1);

/**
 * The upcoming fixture the four venue tests need — **derived, not assumed to be
 * the round's first**.
 *
 * `venues.ts` and `broadcasts.ts` are curated a window at a time by
 * `sync-broadcasts`, so the upcoming round is routinely only part-covered: 7 of
 * 10 for rodada 27, and the three missing are exactly those whose CBF kickoff
 * disagrees with the seed's placeholder `00:00Z`. "The round's first fixture"
 * therefore stopped meaning "a fixture with a stadium" the moment the seed
 * advanced past the broadcast window, and all four went red against a page that
 * was rendering correctly — with no curated venue it omits Estádio and Onde
 * assistir, which is the honest thing to do.
 *
 * The assertions below are unchanged. What is derived is WHICH fixture they are
 * pointed at, so each tests the thing it is named for. Same rule as
 * `UPCOMING_ROUND` above: a literal here is a claim that produces no work while
 * it holds.
 */
const upcomingCurated = SEED_MATCHES.filter(
  (match) =>
    match.round === lastPlayed + 1 && VENUES[match.id] && (BROADCASTS[match.id]?.length ?? 0) > 0,
).sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];

/** No upcoming fixture is curated yet — the window simply has not been synced. */
const noCuratedUpcoming = !upcomingCurated;

/**
 * Open a finished fixture with the curated links stripped from the payload, so
 * the search fallback is what renders.
 *
 * This used to walk the round hunting for a fixture nobody had curated yet,
 * which made the tests a hostage to how much data existed: curate every match
 * in the round and the walk finds nothing and throws. The fallback is a branch
 * of the component, so it is tested by producing the state that reaches it
 * rather than by hoping the season still contains one.
 */
const openMatchWithoutVideo = async (page: Page) => {
  await page.route("**/api/matches*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.matches = body.data.matches.map(
      ({ highlights: _dropped, ...match }: Record<string, unknown>) => match,
    );
    await route.fulfill({ response, json: body });
  });

  await page.goto(`/jogos/${PLAYED_ROUND}`);
  const link = page.locator("main ul > li a[href^='/partida/']").first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/partida\/\d+/);
};

const openFirstMatch = async (page: Page, round: string) => {
  await page.goto(`/jogos/${round}`);
  const first = page.locator("main ul > li a").first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/\/partida\/\d+/);
};

test.describe("Página da partida", () => {
  test("the scoreline sits in a tray, not on the card's own background", async ({ page }) => {
    await page.goto("/partida/554977");
    const tray = page.locator("[data-placar]");
    await tray.waitFor();

    // "Inset" is a *difference* from the card, not a particular colour — so the
    // two are compared rather than either being pinned. That survives a palette
    // regeneration, which pinning a hex would not.
    const { trayBg, cardBg, radius } = await tray.evaluate((el) => ({
      trayBg: getComputedStyle(el).backgroundColor,
      cardBg: getComputedStyle(el.closest("article")!).backgroundColor,
      radius: getComputedStyle(el).borderRadius,
    }));

    expect(trayBg).not.toBe(cardBg);
    expect(trayBg).not.toBe("rgba(0, 0, 0, 0)");
    // On the shape scale, not a bare Tailwind radius.
    expect(["4px", "8px", "12px", "16px", "28px"]).toContain(radius);
  });

  test("the tray sets the score apart in both themes, in opposite directions", async ({ page }) => {
    // Tonal elevation: a *lower* surface is darker on dark and brighter on
    // light. Asserting the direction is what catches somebody swapping in a
    // token that happens to differ on one theme and match on the other.
    const luminance = async (theme: "light" | "dark") => {
      await page.addInitScript(
        (t) => localStorage.setItem("portal-brasileirao:theme", t as string),
        theme,
      );
      await page.goto("/partida/554977");
      await page.locator("[data-placar]").waitFor();
      return page.locator("[data-placar]").evaluate((el) => {
        const sum = (colour: string) =>
          colour.match(/\d+/g)!.slice(0, 3).reduce((total, part) => total + Number(part), 0);
        return {
          tray: sum(getComputedStyle(el).backgroundColor),
          card: sum(getComputedStyle(el.closest("article")!).backgroundColor),
        };
      });
    };

    const light = await luminance("light");
    expect(light.tray).toBeGreaterThan(light.card);

    const dark = await luminance("dark");
    expect(dark.tray).toBeLessThan(dark.card);
  });

  test("a fixture in the round list links to its own page", async ({ page }) => {
    test.skip(noUpcomingRound, "the season has no round left to play");
    await page.goto(`/jogos/${UPCOMING_ROUND}`);

    const link = page.locator("main ul > li a").first();
    await expect(link).toHaveAttribute("href", /^\/partida\/\d+$/);
  });

  test("the match page draws both clubs' campanhas", async ({ page }) => {
    await openFirstMatch(page, PLAYED_ROUND);

    const sparklines = page.locator("main section svg[role='img']");

    await expect(sparklines).toHaveCount(2);
    await expect(sparklines.first()).toHaveAttribute("aria-label", /^Campanha: /);
    await expect(sparklines.last()).toHaveAttribute("aria-label", /^Campanha: /);
  });

  test("one control switches both campanhas together", async ({ page }) => {
    // One control for the section, not one per club. The two are read against
    // each other, so a page that could draw one as a line and the other as bars
    // would be comparing two pictures rather than two clubs — which is the same
    // reason they share a scale, one test below.
    await openFirstMatch(page, PLAYED_ROUND);

    const toggle = page.getByRole("button", { name: /ver a campanha em barras/i });
    await expect(toggle).toHaveCount(1);
    await toggle.click();

    const sparklines = page.locator("main section svg[role='img']");
    await expect(sparklines).toHaveCount(2);
    await expect(sparklines.locator("polyline")).toHaveCount(0);
    expect(await sparklines.first().locator("rect").count()).toBeGreaterThan(0);
    expect(await sparklines.last().locator("rect").count()).toBeGreaterThan(0);
  });

  test("the match page follows the mark chosen elsewhere", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("table tbody tr")).toHaveCount(20);
    await page.getByRole("button", { name: /ver a campanha em barras/i }).click();

    await openFirstMatch(page, PLAYED_ROUND);

    const sparklines = page.locator("main section svg[role='img']");
    await expect(sparklines.locator("polyline")).toHaveCount(0);
    expect(await sparklines.first().locator("rect").count()).toBeGreaterThan(0);
  });

  test("both campanhas are drawn on one scale", async ({ page }) => {
    // The whole reason they are stacked rather than overlaid: rounds line up
    // vertically, so "who was above whom in round 12" is read by looking
    // straight down. That only holds if both boxes are the same width and the
    // same domain — two clubs scaled to their own ranges would be a lie told
    // convincingly.
    await openFirstMatch(page, PLAYED_ROUND);

    const boxes = await page.locator("main section svg[role='img']").evaluateAll((nodes) =>
      nodes.map((node) => ({
        width: Math.round(node.getBoundingClientRect().width),
        viewBox: node.getAttribute("viewBox"),
        lastX: (node.querySelector("polyline")?.getAttribute("points") ?? "")
          .trim()
          .split(" ")
          .pop()
          ?.split(",")[0],
      })),
    );

    expect(boxes).toHaveLength(2);
    expect(boxes[0].width).toBe(boxes[1].width);
    expect(boxes[0].viewBox).toBe(boxes[1].viewBox);
    // Same last round in the snapshot, so the lines must end at the same x.
    expect(boxes[0].lastX).toBe(boxes[1].lastX);
  });

  test("the campanha names the club each line belongs to", async ({ page }) => {
    // Two monochrome lines in one card: without a name against each, the only
    // thing distinguishing them is their order, which is not a channel.
    await openFirstMatch(page, PLAYED_ROUND);

    const names = page.locator("main section svg[role='img']").locator("xpath=../p[1]");

    await expect(names).toHaveCount(2);
    for (const name of await names.all()) {
      expect((await name.innerText()).trim().length).toBeGreaterThan(0);
    }
  });

  test("the page shows the round and the status", async ({ page }) => {
    test.skip(noUpcomingRound, "the season has no round left to play");
    await openFirstMatch(page, UPCOMING_ROUND);

    // Scoped to the scoreboard card. The campanha section also names rounds
    // ("17º · 1ª rodada"), so an unscoped match now finds several.
    const card = page.locator("main > article");
    await expect(card.getByText(/\d+ª rodada/)).toBeVisible();
    await expect(
      card.getByText(/(A realizar|Ao vivo|Encerrado|Adiado|Cancelado)/),
    ).toBeVisible();
  });

  test("an upcoming match shows kickoff, stadium and where to watch", async ({ page }) => {
    test.skip(noCuratedUpcoming, "no upcoming fixture carries curated venue data yet");
    await page.goto(`/partida/${upcomingCurated.id}`);

    await expect(page.getByText("Data e hora")).toBeVisible();
    await expect(page.getByText("Estádio")).toBeVisible();
    await expect(page.getByText("Onde assistir")).toBeVisible();
  });

  test("the venue reads as stadium, city and state", async ({ page }) => {
    test.skip(noCuratedUpcoming, "no upcoming fixture carries curated venue data yet");
    await page.goto(`/partida/${upcomingCurated.id}`);

    const venue = page.locator("dd").filter({ hasText: "·" }).first();
    await expect(venue).toContainText(/·/);
    await expect(venue).toContainText(/–\s[A-Z]{2}$/);
  });

  test("the venue carries a pin to the ground on Google Maps", async ({ page }) => {
    test.skip(noCuratedUpcoming, "no upcoming fixture carries curated venue data yet");
    await page.goto(`/partida/${upcomingCurated.id}`);

    const pin = page.locator("[data-stadium-map]");
    await expect(pin).toBeVisible();

    // Google's documented Maps URLs form, carrying a real coordinate — a
    // stringified `undefined` or a `0,0` would still be a working link, which
    // is exactly why the assertion is on the number rather than on the host.
    const href = await pin.getAttribute("href");
    expect(href).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&/);
    expect(href).toMatch(/[?&]query=-\d+\.\d+,-\d+\.\d+$/);

    // Icon-only, so the accessible name is the whole of what a screen reader
    // gets. The mark is `aria-hidden`; without the span this announces as its
    // own URL.
    await expect(pin).toHaveAccessibleName(/Google Maps/);

    // A second destination on the same line, not a replacement for the first:
    // the name still opens this app's page for the ground.
    await expect(
      page.locator("dd").filter({ hasText: "·" }).first().getByRole("link"),
    ).toHaveCount(2);
  });

  test("the pin opens safely in a new tab", async ({ page }) => {
    test.skip(noCuratedUpcoming, "no upcoming fixture carries curated venue data yet");
    await page.goto(`/partida/${upcomingCurated.id}`);

    const pin = page.locator("[data-stadium-map]");
    await expect(pin).toHaveAttribute("target", "_blank");
    await expect(pin).toHaveAttribute("rel", /noopener/);
  });

  test("an upcoming match offers no highlights", async ({ page }) => {
    test.skip(noUpcomingRound, "the season has no round left to play");
    // It has not been played.
    await openFirstMatch(page, UPCOMING_ROUND);

    await expect(page.getByRole("link", { name: /Procurar melhores momentos/ })).toHaveCount(0);
  });

  test("a finished match offers highlights", async ({ page }) => {
    await openMatchWithoutVideo(page);

    const goals = page.getByRole("link", { name: /Procurar melhores momentos/ });
    await expect(goals).toBeVisible();
    await expect(goals).toHaveAttribute("href", /youtube\.com\/results\?search_query=/);
  });

  test("the highlights link opens safely in a new tab", async ({ page }) => {
    await openMatchWithoutVideo(page);

    const goals = page.getByRole("link", { name: /Procurar melhores momentos/ });
    await expect(goals).toHaveAttribute("target", "_blank");
    // Without noopener the opened page can reach back into this one.
    await expect(goals).toHaveAttribute("rel", /noopener/);
  });

  test("the search fallback is honest about being a search", async ({ page }) => {
    await openMatchWithoutVideo(page);

    await expect(page.getByText(/não é um vídeo oficial/)).toBeVisible();
  });

  test("the scoreboard is the only article on the page", async ({ page }) => {
    // A canary, not a feature test. Five selectors across this file and
    // club.spec.ts scope to `main > article` and assume it resolves to exactly
    // one element — the scoreboard.
    //
    // That assumption is not self-enforcing, and `main > article` is a weaker
    // guard than it looks: it rules out an article nested inside a section, but
    // a second card taking as="article" as a sibling of the scoreboard still
    // matches. Verified by injecting one — `main > article` went to 2 and every
    // dependent selector broke.
    //
    // So this fails first and by name, instead of five strict-mode violations
    // whose message says nothing about the cause.
    await openFirstMatch(page, PLAYED_ROUND);

    await expect(page.locator("main > article")).toHaveCount(1);
    await expect(page.locator("article")).toHaveCount(1);
  });

  test("a finished match shows its score", async ({ page }) => {
    await openFirstMatch(page, PLAYED_ROUND);

    await expect(page.locator("main > article").getByText(/\d+\s*×\s*\d+/)).toBeVisible();
  });

  test("each club on the scoreboard links to its page", async ({ page }) => {
    await openFirstMatch(page, UPCOMING_ROUND);

    // `main > article`, not a bare `article`: the scoreboard is the only
    // article in the app today, which is what made the unscoped form pass
    // rather than anything about the form being specific.
    const clubLinks = page.locator("main > article a[href^='/clube/']");
    await expect(clubLinks).toHaveCount(2);

    await clubLinks.first().click();
    await expect(page).toHaveURL(/\/clube\/.+/);
  });

  test("each club on the scoreboard links to its Wikipedia article", async ({ page }) => {
    await openFirstMatch(page, UPCOMING_ROUND);

    const articles = page.locator("main > article a[href*='wikipedia.org']");
    await expect(articles).toHaveCount(2);

    // Both sides, both the pt edition, both bare article addresses.
    for (const href of await articles.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("href")),
    )) {
      expect(href).toMatch(/^https:\/\/pt\.wikipedia\.org\/wiki\/[^?#]+$/);
    }

    await expect(articles.first()).toHaveAttribute("target", "_blank");
    await expect(articles.first()).toHaveAttribute("rel", /noopener/);
  });

  test("the article link reads as its name and does not crowd the club link", async ({ page }) => {
    await openFirstMatch(page, UPCOMING_ROUND);

    const text = (await page.locator("main > article a[href*='wikipedia.org']").first().innerText()).trim();
    expect(text).toMatch(/^Wikipédia/);

    // The scoreboard gained an external link per side; the internal ones must
    // still be exactly two. Counting both is what catches a selector that
    // started sweeping up the new link.
    await expect(page.locator("main > article a[href^='/clube/']")).toHaveCount(2);
  });

  test("an unknown match id says so rather than erroring", async ({ page }) => {
    await page.goto("/partida/000000");

    await expect(page.getByText("Partida não encontrada.")).toBeVisible();
  });

  test("a page still loading says so, rather than claiming not found", async ({ page }) => {
    // Hold the fixtures open. Until they land, an unknown id and an id whose
    // payload has not arrived are the same empty list, and the page used to
    // answer "não encontrada" for both — telling the reader something untrue
    // about a match that exists.
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/matches*", async (route) => {
      await held;
      await route.continue();
    });

    await page.goto("/partida/554975", { waitUntil: "commit" });
    await expect(page.getByText("Carregando página…")).toBeVisible();
    await expect(page.getByText("Partida não encontrada.")).toHaveCount(0);

    release();
    // And once it arrives, the real page replaces it.
    await expect(page.getByRole("heading", { name: "Melhores momentos" })).toBeVisible();
  });

  test("the page is reachable directly and survives a reload", async ({ page }) => {
    await openFirstMatch(page, PLAYED_ROUND);
    const url = page.url();

    await page.reload();

    await expect(page).toHaveURL(url);
    await expect(page.getByText("Data e hora")).toBeVisible();
  });

  test("a goalless match still offers highlights", async ({ page }) => {
    // Internacional 0 x 0 Atlético-MG. A 0-0 has chances and saves, and gating
    // on goals hid the section from 14 of the season's finished matches.
    await page.goto("/partida/554976");

    await expect(page.locator("main > article").getByText(/0\s*×\s*0/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Melhores momentos" })).toBeVisible();
    // Either a curated link or the search — asserting which would make this a
    // test of whether someone has curated this fixture yet.
    await expect(page.locator("section a[href*='youtube.com']").first()).toBeVisible();
  });

  test("back returns to the fixtures", async ({ page }) => {
    await openFirstMatch(page, PLAYED_ROUND);
    await page.getByRole("button", { name: "← Voltar" }).click();

    await expect(page.getByRole("combobox", { name: "Rodada" })).toBeVisible();
  });

  test("a curated match links to every channel that covered it", async ({ page }) => {
    // Fluminense 2 x 1 Clube do Remo: ge tv and CazéTV both published one.
    await page.goto("/partida/554975");

    await expect(page.getByRole("heading", { name: "Melhores momentos" })).toBeVisible();

    const links = page.locator("section a[href*='youtube.com/watch']");
    await expect(links).toHaveCount(2);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
    }
  });

  test("each link is labelled by its channel, not a generic verb", async ({ page }) => {
    await page.goto("/partida/554975");

    // Two identical labels would give the reader nothing to choose between.
    await expect(page.getByRole("link", { name: /ge tv/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /CazéTV/ })).toBeVisible();
  });

  test("a curated video suppresses the search fallback", async ({ page }) => {
    await page.goto("/partida/554975");

    await expect(page.getByRole("link", { name: /Procurar melhores momentos/ })).toHaveCount(0);
    await expect(page.getByText(/não é um vídeo oficial/)).toHaveCount(0);
  });

  /**
   * The player, which is the half a browser is needed for: `videoEmbedUrl` is
   * unit-tested and says nothing about *when* a frame exists.
   *
   * The expected addresses are **derived from `highlights.ts`** rather than
   * written down — the file grows on every sync, and an id in a spec is the
   * "which record happens to hold a value" trap `CLAUDE.md` names. The fixture
   * ids stay literals, as their neighbours above do, because what each one is
   * chosen for — two channels that embed, and a channel that does not — is the
   * subject of the assertions.
   */
  test.describe("the player", () => {
    /** Palmeiras 4 x 1 Vasco: ge tv and UOL Esporte, both of which embed. */
    const TWO_EMBEDDABLE = HIGHLIGHTS["554977"] ?? [];
    /** Fluminense 2 x 1 Remo: ge tv, then CazéTV, which YouTube refuses to
     *  play in a frame — see `playsInPage` for what was measured. */
    const WITH_REFUSED = HIGHLIGHTS["554975"] ?? [];

    const embedOf = (video: (typeof TWO_EMBEDDABLE)[number] | undefined) => {
      const id = youtubeVideoId(video?.url);
      // A curated line whose id will not parse keeps a plain link, so these
      // assertions would be about a channel that never had a frame. Failing
      // here says the fixture changed, not that the page is broken.
      if (!id) throw new Error("a fixture these tests pin no longer parses");
      return new RegExp(`youtube-nocookie\\.com/embed/${id}\\b`);
    };

    test("the video is the section, and no channel button is left", async ({ page }) => {
      await page.goto("/partida/554977");
      await expect(page.getByRole("heading", { name: "Melhores momentos" })).toBeVisible();

      const frame = page.locator("main iframe");
      await expect(frame).toHaveCount(1);
      // The preferred package — the file's own order is the rights-holder
      // preference `KNOWN_CHANNELS` states — playing where the reader is.
      await expect(frame).toHaveAttribute("src", embedOf(TWO_EMBEDDABLE[0]));
      await expect(frame).toBeVisible();
    });

    test("nothing plays by itself", async ({ page }) => {
      await page.goto("/partida/554977");

      // A video that started on its own would be the club page's "hino que
      // ninguém pediu", on a page a reader may have opened for the scoreline.
      // The absence is invisible in a screenshot and in every other assertion
      // here, which is why it is pinned at both ends — see the unit test on
      // `videoEmbedUrl` for the other one.
      await expect(page.locator("main iframe")).toHaveAttribute("src", /^((?!autoplay).)*$/);
    });

    test("another channel swaps the video rather than adding a second player", async ({
      page,
    }) => {
      await page.goto("/partida/554977");
      const other = page.getByRole("link", { name: new RegExp(TWO_EMBEDDABLE[1].channel) });
      // Records whether the anchor's default was prevented, read at `document`
      // so it runs after React's own root handler. See below for why the
      // click's own event is what this asks about.
      await page.evaluate(() => {
        (window as unknown as { __prevented?: boolean | null }).__prevented = null;
        document.addEventListener("click", (event) => {
          (window as unknown as { __prevented?: boolean | null }).__prevented =
            event.defaultPrevented;
        });
      });

      await other.click();

      const frame = page.locator("main iframe");
      // Two players is two things able to play at once, which is why the
      // section holds one frame and the other channels are links under it.
      await expect(frame).toHaveCount(1);
      await expect(frame).toHaveAttribute("src", embedOf(TWO_EMBEDDABLE[1]));
      // **And it does not ALSO open the tab.** Dropping `preventDefault` from
      // the handler leaves every check above green — the popup opens, the page
      // keeps running and the frame still swaps — so a reader would get a new
      // tab *and* a swapped player, with nothing here saying so.
      //
      // **Two obvious ways to catch that do not work, and both were run.**
      // `context.pages()` answers 1 at every point in this test even while the
      // popup exists, so it passes against the bug it names. And
      // `waitForEvent("popup", { timeout: 1200 })` catches it in isolation and
      // **missed it in a 5-worker run** — the popup is created later than that
      // under load — so it is a detector that reports green on a good day. It
      // also charges the whole timeout to every passing run, since the correct
      // behaviour is an event that never comes.
      //
      // Asking the click itself is instant and cannot race: the handler either
      // prevented the default or it did not.
      expect(
        await page.evaluate(
          () => (window as unknown as { __prevented?: boolean | null }).__prevented,
        ),
      ).toBe(true);
      // Still a link to the watch page, so a modified click and a
      // JavaScript-less reader both still reach the video.
      await expect(other).toHaveAttribute("href", /youtube\.com\/watch/);
    });

    test("a channel YouTube will not embed stays a link out", async ({ page }) => {
      const refused = WITH_REFUSED.find((video) => !playsInPage(video));
      // Named rather than searched for: if the list of refused channels ever
      // empties, this test has nothing to say and should be deleted with it,
      // not silently pass over an empty season.
      expect(refused, "554975 no longer carries a channel that refuses embedding").toBeTruthy();

      await page.goto("/partida/554975");
      const link = page.getByRole("link", { name: new RegExp(refused!.channel) });

      await expect(link).toHaveAttribute("href", refused!.url);
      // No frame to swap, so nothing claims one — the safe direction, and the
      // one thing that stops the page offering a player that would render
      // "This video is unavailable".
      await expect(link).not.toHaveAttribute("aria-controls", /.*/);
      await expect(link).toHaveAccessibleName(/abre em nova aba/);
      // The frame that IS there is the channel that plays, never the refused
      // one.
      await expect(page.locator("main iframe")).toHaveAttribute(
        "src",
        embedOf(WITH_REFUSED.find((video) => playsInPage(video))),
      );
    });

    test("the search fallback offers no player at all", async ({ page }) => {
      await openMatchWithoutVideo(page);

      await expect(page.getByRole("link", { name: /Procurar melhores momentos/ })).toBeVisible();
      // Embedding the first result of a query is exactly the "presenting the
      // search as an official video" CONTEXT.md forbids.
      await expect(page.locator("main iframe")).toHaveCount(0);
    });
  });
});
