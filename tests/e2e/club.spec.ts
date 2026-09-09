import { expect, test, type Page } from "@/tests/e2e/clock";

/**
 * The heading naming what this page is about.
 *
 * Scoped to `main` because the rodapé carries an `sr-only` level-2 heading of
 * its own on every page, and the player card another — an unscoped
 * `getByRole("heading", { level: 2 })` resolves to two elements and fails
 * strict mode. These specs were unambiguous only until the page grew a second
 * top-level section, which is the accident the scope removes.
 */
const pageHeading = (page: Page) => page.getByRole("main").getByRole("heading", { level: 2 });

/** Open the club sitting at a given standings position. */
const openClubAt = async (page: Page, position: number) => {
  const row = page.locator("table tbody tr").nth(position - 1);
  const name = (await row.locator("td:nth-child(2) a").innerText()).trim();
  await row.locator("td:nth-child(2) a").click();
  await expect(pageHeading(page)).toHaveText(name);
  return name;
};

test.describe("Clube", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("table tbody tr")).toHaveCount(20);
  });

  test("club names are real links, not click handlers", async ({ page }) => {
    const links = page.locator("table tbody tr td:nth-child(2) a");

    await expect(links).toHaveCount(20);
    // A real href is what makes middle-click and "open in new tab" work.
    await expect(links.first()).toHaveAttribute("href", /^\/clube\/.+/);
  });

  test("choosing a club opens its page", async ({ page }) => {
    const name = await openClubAt(page, 1);

    await expect(pageHeading(page)).toHaveText(name);
    await expect(page.locator("table")).toHaveCount(0);
  });

  test("the club page shows its standings summary", async ({ page }) => {
    await openClubAt(page, 1);

    // Scoped to main: "Jogos" is also a nav entry, so an unscoped lookup
    // matches the menu as well as the stat tile.
    const main = page.locator("main");
    for (const label of ["Posição", "Pontos", "Jogos", "Saldo", "Aproveitamento"]) {
      await expect(main.getByText(label, { exact: true })).toBeVisible();
    }
    // Leader of the table.
    await expect(main.getByText("1º", { exact: true })).toBeVisible();
    // Shape, not value: the snapshot ages and the leader's aproveitamento with
    // it. An em dash here would mean a club with no game played, which the
    // frozen season does not contain.
    await expect(main.getByText(/^\d{1,3}%$/)).toBeVisible();
  });

  test("each forma pill is named in words, not left as a letter", async ({ page }) => {
    await openClubAt(page, 1);

    // A pill carries a colour and a single letter, and a screen reader gets
    // neither. `title` was the whole of its naming and is not reliably
    // announced, so the list read as "V", "E", "D" — a spelling test rather
    // than a form guide.
    // `[data-form-guide]` for the reason given at line 106 below. This one
    // passed the day the club page grew a second labelled list, and only
    // because `hasText` happened to exclude the new items — a filter written
    // about the pills' *content* was doing the work of identifying the list.
    const pills = page.locator("main ul[data-form-guide] > li").filter({ hasText: /^[VED]/ });

    await expect(pills).toHaveCount(5);
    for (const pill of await pills.all()) {
      // The word is the accessible name; the letter is hidden from it, so
      // nothing announces "V Vitória" on every pill.
      await expect(pill).toHaveAccessibleName(/^(Vitória|Empate|Derrota)$/);
      await expect(pill).toHaveAttribute("title", /^(Vitória|Empate|Derrota)$/);
      await expect(pill.locator("span[aria-hidden='true']")).toHaveText(/^[VED]$/);
    }
  });

  test("the forma list says which end is the most recent", async ({ page }) => {
    await openClubAt(page, 1);

    // The heading says which matches these are, never which end is now — and
    // which end is now is the whole of what a form guide is read for. A
    // sighted reader infers it from the fixture list below; nothing carried
    // it in text.
    // Likewise — and this one was the luckiest of the three: `.first()` in DOM
    // order happens to be the form guide only because **Vídeos do clube**
    // renders below it. Move either section and this silently measures the
    // wrong list, then fails on an aria-label that was never its own.
    const list = page.locator("main ul[data-form-guide]");

    await expect(list).toHaveAttribute("aria-label", /do mais antigo para o mais recente/);
  });

  test("the pill's hidden word takes no space and does not overflow it", async ({ page }) => {
    await openClubAt(page, 1);

    // The word is a flex child of a 28px pill, so text that is not taken out
    // of flow spills out of it visibly while the accessible name stays
    // perfectly correct.
    //
    // **Measure the word's own box and the pill's overflow, never the pill's
    // width.** `h-7 w-7` fixes the pill at 28px whatever it contains, so an
    // assertion on `getBoundingClientRect().width` is satisfied by the bug —
    // written that way first, run against a deliberately un-hidden word, and
    // it passed. Under that mutation the pill still measured 28x28 while
    // `scrollWidth` was 40 and the word's own box 43x16.
    const geometry = await page
      // **`[data-form-guide]`, not `ul[aria-label]`.** This read the latter
      // until the club page grew a second labelled list — the **Vídeos do
      // clube** rail — and then resolved six elements and asserted five. The
      // pills are what this measures, so it names them; a spec that identifies
      // its subject by a property every sibling could also have is one that
      // goes red on an unrelated section. Same correction `standings.spec.ts`
      // made when the Painel gained a second `role="img"` drawing.
      .locator("main ul[data-form-guide] > li")
      .evaluateAll((els) =>
        els.map((el) => {
          const word = el.querySelector("span.sr-only");
          const box = word?.getBoundingClientRect();
          return {
            overflow: el.scrollWidth - el.clientWidth,
            word: box ? Math.max(box.width, box.height) : null,
          };
        }),
      );

    expect(geometry).toHaveLength(5);
    for (const { overflow, word } of geometry) {
      expect(overflow).toBe(0);
      expect(word).not.toBeNull();
      expect(word!).toBeLessThanOrEqual(2);
    }
  });

  test("the club page draws no campanha mark — it offers the painel instead", async ({
    page,
  }) => {
    await openClubAt(page, 1);

    // The whole campanha moved to the Painel, where the line sits above the
    // candles that read the same rounds one grain finer. Splitting the two
    // halves of one answer across two pages is what this asserts is over, and
    // it is the only assertion that can see the section come back: every other
    // spec here would pass with it reinstated.
    await expect(page.locator("main svg[role='img']")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /ver a campanha em/i }),
    ).toHaveCount(0);
    await expect(page.locator("main a[data-panel-link]")).toBeVisible();
  });

  test("the form guide uses at most five results", async ({ page }) => {
    await openClubAt(page, 1);

    // Addressed at the letter's own element, not at the pill's text. The pill
    // now also holds an `sr-only` word, so its text content is "VVitória" and
    // an anchored `^[VED]$` against the whole pill matches nothing — the same
    // shape as the spec that broke when a club name became a link. Hidden text
    // is still text.
    const chips = page.locator("main ul li > span[aria-hidden='true']").filter({ hasText: /^[VED]$/ });
    const count = await chips.count();

    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(5);
    for (const chip of await chips.all()) {
      await expect(chip).toHaveText(/^[VED]$/);
    }
  });

  test("the club page lists matches it actually played", async ({ page }) => {
    const name = await openClubAt(page, 1);

    const played = page.getByRole("heading", { name: "Jogos disputados" });
    await expect(played).toBeVisible();

    // Every listed fixture must involve this club.
    const fixtures = page.locator("main ul > li").filter({ hasText: "×" });
    expect(await fixtures.count()).toBeGreaterThan(0);
    for (const fixture of (await fixtures.all()).slice(0, 6)) {
      await expect(fixture).toContainText(name);
    }
  });

  test("going back returns to the table", async ({ page }) => {
    await openClubAt(page, 3);
    await page.getByRole("button", { name: "← Voltar" }).click();

    await expect(page.locator("table tbody tr")).toHaveCount(20);
  });

  test("a different club shows different data", async ({ page }) => {
    const first = await openClubAt(page, 1);
    await page.getByRole("button", { name: "← Voltar" }).click();
    const second = await openClubAt(page, 20);

    expect(second).not.toBe(first);
    await expect(page.locator("main").getByText("20º", { exact: true })).toBeVisible();
  });

  test("the nav still works from a club page", async ({ page }) => {
    await openClubAt(page, 5);

    await page.getByRole("link", { name: /^Artilharia/ }).click();

    await expect(page.locator("table thead th").nth(1)).toHaveText(/jogador/i);
  });

  test("no nav entry points at the club section", async ({ page }) => {
    // It is a drill-down: without a selected club it would render nothing.
    await expect(page.getByRole("link", { name: /^Clube$/ })).toHaveCount(0);
  });

  test("the next fixture links to its match page", async ({ page }) => {
    await openClubAt(page, 1);

    const next = page.locator("main ul > li a").first();
    await expect(next).toHaveAttribute("href", /^\/partida\/\d+$/);
  });

  test("a played fixture links to its match page", async ({ page }) => {
    await openClubAt(page, 1);

    const played = page.getByRole("heading", { name: "Jogos disputados" });
    await expect(played).toBeVisible();

    // Every fixture on the page is reachable, not only the upcoming one.
    const links = page.locator("main ul > li a[href^='/partida/']");
    expect(await links.count()).toBeGreaterThan(1);
  });

  test("choosing a fixture opens the match page", async ({ page }) => {
    const name = await openClubAt(page, 1);
    await page.locator("main ul > li a[href^='/partida/']").first().click();

    await expect(page).toHaveURL(/\/partida\/\d+$/);
    // The match involves the club we came from. `main > article` is the
    // scoreboard; that it resolves to exactly one element is enforced by
    // "the scoreboard is the only article on the page" in match-page.spec.ts.
    await expect(page.locator("main > article")).toContainText(name);
  });

  /* Selected by destination rather than position: the header holds seven
     external links on Flamengo's page (counted, 2026-09-09), and picking one by
     index is what broke these specs when a name first became a control. The
     site link is the one defined by exclusion, so every link added beside it
     has to be excluded here too — the hymn was the first, and it matched as the
     site until it was; the sede's map link was the second, and it did exactly
     the same thing the day the pin stopped being inert; the subreddit was the
     third; the supporters' **Discord** is the fourth. Note the count above is
     not what caught any of them: the failure is a locator resolving to two
     elements, not a number written in a comment.

     The subreddit and the Discord are the exclusions here that are NOT on every
     club page, coverage being curated and partial — and they bite TODAY only
     because Flamengo happens to lead the frozen seed AND to be the one club
     with a Discord entry, so `openClubAt(page, 1)` opens it. Measured rather
     than reasoned: deleting either line fails both site-link specs with a
     locator resolving to two elements. Read that as the "which record happens
     to hold a value" trap `goals.spec.ts` records, not as coverage — the next
     `sync-seed-data` that moves Flamengo off the top makes both exclusions
     silently unexercised while leaving them correct. The specs below therefore
     navigate by SLUG rather than by position. */
  const siteLink = (page: Page) =>
    page.locator(
      [
        "main header a[target='_blank']",
        ":not([href*='instagram.com'])",
        ":not([href*='youtube.com'])",
        ":not([href*='wikipedia.org'])",
        ":not([href*='google.com/maps'])",
        ":not([href*='reddit.com'])",
        ":not([href*='discord.gg'])",
      ].join(""),
    );
  const instagramLink = (page: Page) => page.locator("main header a[href*='instagram.com']");
  const hymnLink = (page: Page) => page.locator("main header a[href*='youtube.com']");
  const wikipediaLink = (page: Page) => page.locator("main header a[href*='wikipedia.org']");
  const redditLink = (page: Page) => page.locator("main header a[href*='reddit.com']");

  test("the club page links to its official site", async ({ page }) => {
    await openClubAt(page, 1);

    const site = siteLink(page);
    await expect(site).toBeVisible();
    // Always HTTPS: the provider lists most clubs as http.
    await expect(site).toHaveAttribute("href", /^https:\/\/[^/]+\/$/);
    await expect(site).toHaveAttribute("rel", /noopener/);
  });

  test("the official site link shows the host, not the whole URL", async ({ page }) => {
    await openClubAt(page, 1);

    const text = (await siteLink(page).innerText()).trim();
    expect(text).not.toContain("https://");
    expect(text).toMatch(/\.[a-z]{2,}/);
  });

  test("the club page links to its Instagram profile", async ({ page }) => {
    await openClubAt(page, 1);

    const instagram = instagramLink(page);
    await expect(instagram).toBeVisible();
    // Canonical profile address — no locale hint or other query riding along.
    await expect(instagram).toHaveAttribute("href", /^https:\/\/www\.instagram\.com\/[A-Za-z0-9._]+\/$/);
    await expect(instagram).toHaveAttribute("target", "_blank");
    await expect(instagram).toHaveAttribute("rel", /noopener/);
  });

  test("the Instagram link reads as the handle", async ({ page }) => {
    await openClubAt(page, 1);

    // "@palmeiras" is what a reader recognises; the full URL is noise. The
    // trailing screen-reader text is deliberate, so match the start rather than
    // the whole string.
    const text = (await instagramLink(page).innerText()).trim();
    expect(text).toMatch(/^@[A-Za-z0-9._]+/);
    expect(text).not.toContain("instagram.com");
  });

  /* The subreddit is curated for a handful of clubs rather than all twenty, so
     these navigate to Flamengo by address instead of opening whatever sits at a
     standings position — `openClubAt(page, 1)` names a different club whenever
     the table moves, and a spec that passes only while one club happens to lead
     is the trap this file's neighbours already record. The slug is stable
     where the position is not. */
  test("a club with a curated subreddit links to it", async ({ page }) => {
    await page.goto("/clube/flamengo");
    await expect(pageHeading(page)).toContainText("Flamengo");

    const sub = redditLink(page);
    await expect(sub).toBeVisible();
    await expect(sub).toHaveAttribute("href", /^https:\/\/www\.reddit\.com\/r\/[A-Za-z0-9_]{3,21}\/$/);
    await expect(sub).toHaveAttribute("target", "_blank");
    // A missing `rel` is a real defect that looks identical on the page.
    await expect(sub).toHaveAttribute("rel", /noopener/);
  });

  test("the subreddit link reads as the name, in the sub's own casing", async ({ page }) => {
    await page.goto("/clube/flamengo");
    await expect(pageHeading(page)).toContainText("Flamengo");

    // "r/CRFla" is what a reader recognises, and the casing is the community's
    // own — Reddit resolves case-insensitively, so a folded name reaches the
    // same page under a spelling nobody uses. The trailing screen-reader text
    // is deliberate, so match the start rather than the whole string.
    const text = (await redditLink(page).innerText()).trim();
    expect(text).toMatch(/^r\/CRFla/);
    expect(text).not.toContain("reddit.com");
  });

  test("a club with no curated subreddit renders no link rather than a broken one", async ({
    page,
  }) => {
    // The absence is the point: `r/<club name>` is exactly the address somebody
    // would be tempted to derive, and the survey in `club-reddit.ts` found four
    // such addresses naming a different subject entirely — a Mexican club, the
    // Civil Air Patrol, a state and a city. Without this, emptying the curated
    // file would leave every assertion above passing on whichever club still
    // had an entry.
    //
    // **This named PALMEIRAS until Palmeiras acquired one**, which is the cost
    // of picking the subject of a negative assertion out of a curated file that
    // grows: it went red on the commit that widened coverage — correctly, and
    // confirmed by running it — and no club here is guaranteed to stay absent
    // for ever. Fluminense is the safest available: its `r/FluminenseFC` has
    // ONE member, so it is absent by the bar rather than by nobody looking.
    await page.goto("/clube/fluminense");
    await expect(pageHeading(page)).toContainText("Fluminense");
    await expect(redditLink(page)).toHaveCount(0);
  });

  test("the club page links to its hymn", async ({ page }) => {
    await openClubAt(page, 1);

    const hymn = hymnLink(page);
    await expect(hymn).toBeVisible();
    // A bare watch address: the id alone is stored, so no `list=RD…` playlist
    // or `start_radio` rides along to open the mix instead of the hymn.
    await expect(hymn).toHaveAttribute("href", /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/);
    await expect(hymn).toHaveAttribute("target", "_blank");
    await expect(hymn).toHaveAttribute("rel", /noopener/);
  });

  test("the hymn link reads as its name, not its address", async ({ page }) => {
    await openClubAt(page, 1);

    // Unlike the site and the handle, a video id names nothing a reader knows.
    // The trailing screen-reader text is deliberate, so match the start.
    const text = (await hymnLink(page).innerText()).trim();
    expect(text).toMatch(/^Hino do clube/);
    expect(text).not.toContain("youtube.com");
  });

  test("the club page links to its Wikipedia article", async ({ page }) => {
    await openClubAt(page, 1);

    const wikipedia = wikipediaLink(page);
    await expect(wikipedia).toBeVisible();
    // The Portuguese edition, and a bare article address: the title alone is
    // stored, so no `?action=edit` or `#seção` rides along from a copied link.
    await expect(wikipedia).toHaveAttribute("href", /^https:\/\/pt\.wikipedia\.org\/wiki\/[^?#]+$/);
    await expect(wikipedia).toHaveAttribute("target", "_blank");
    await expect(wikipedia).toHaveAttribute("rel", /noopener/);
  });

  test("the article link reads as its name, not its address", async ({ page }) => {
    await openClubAt(page, 1);

    // Like the hymn: the club's full legal name is not what a reader scanning
    // a row of links is looking for. The trailing screen-reader text is
    // deliberate, so match the start.
    const text = (await wikipediaLink(page).innerText()).trim();
    expect(text).toMatch(/^Wikipédia/);
    expect(text).not.toContain("wikipedia.org");
  });

  test("the club page names the club's head coach", async ({ page }) => {
    // Stubbed rather than read off the snapshot, deliberately. The coach comes
    // from the teams endpoint, this suite runs with the provider disabled, and
    // `clubs.ts` carries one only once someone has re-run sync-seed-data with a
    // token — so asserting against the seed would test the fixture's age. What
    // is under test is that the map reaches the page and is printed.
    const clubs = await (await page.request.get("/api/clubs")).json();
    const palmeiras = clubs.data.find((club: { slug?: string }) => club.slug === "palmeiras");

    await page.route("**/api/coaches", (route) =>
      route.fulfill({
        json: {
          source: "football-data",
          note: "Dados do football-data.org (Campeonato Brasileiro Série A).",
          updatedAt: new Date().toISOString(),
          data: { [palmeiras.code]: "Abel Ferreira" },
        },
      }),
    );

    await page.goto("/clube/palmeiras");

    // Scoped to the header: the name belongs beside the club's, not among the
    // tallies. The label and the name are two elements, hence a text match on
    // the block rather than on either of them.
    await expect(page.locator("main header")).toContainText("Técnico: Abel Ferreira");
  });

  test("the coaches are not fetched until a club page is opened", async ({ page }) => {
    // One page in eight shows a coach, so the map is not in the opening
    // Promise.all — the same call the elencos get, and just as invisible from
    // the rendered page. Only the request log shows it.
    const asked: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/coaches")) asked.push(request.url());
    });

    await page.goto("/");
    await expect(page.locator("table tbody tr")).toHaveCount(20);
    expect(asked).toHaveLength(0);

    await openClubAt(page, 1);
    await expect.poll(() => asked.length).toBeGreaterThan(0);
  });

  test("the club page names the club's sede", async ({ page }) => {
    await page.goto("/clube/palmeiras");

    // One line, verbatim from the provider: there is no separator between the
    // neighbourhood and the city, so it is not split into fields.
    //
    // Unanchored at the end, deliberately: the line carries a screen-reader
    // suffix saying where it leads, and `toHaveText` reads text content rather
    // than what is painted, so a `$` here would be asserting the absence of
    // that suffix while appearing to assert the address.
    await expect(page.locator("main [data-sede]")).toHaveText(
      /Rua Palestra Italia .*Perdizes São Paulo, SP 05005-030/,
    );
  });

  test("the sede points at the address on Google Maps", async ({ page }) => {
    await page.goto("/clube/palmeiras");

    const sede = page.locator("main [data-sede-map]");
    await expect(sede).toBeVisible();

    // Google's documented Maps URLs form, carrying the club's own address as
    // the search term — the club page has no coordinate to point at, which is
    // the one thing that differs from the estádio pin on the match page.
    const href = await sede.getAttribute("href");
    expect(href).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    expect(href).toContain(encodeURIComponent("Perdizes São Paulo, SP 05005-030"));

    // The whole line is the target, mark and address together — not the mark
    // alone, which is what the match page does and for a reason that does not
    // apply here.
    await expect(sede).toContainText("Rua Palestra Italia");
    await expect(sede).toHaveAccessibleName(/^Sede: Rua Palestra Italia .*Google Maps/);
  });

  test("the sede opens safely in a new tab", async ({ page }) => {
    await page.goto("/clube/palmeiras");

    const sede = page.locator("main [data-sede-map]");
    await expect(sede).toHaveAttribute("target", "_blank");
    await expect(sede).toHaveAttribute("rel", /noopener/);
  });

  test("a half-empty address shows the city, never upstream's word null", async ({ page }) => {
    // football-data interpolates this field without checking its own columns,
    // so Flamengo, Mirassol and São Paulo arrive as "null <city>, <UF> null".
    // Rendered raw that is what the most-visited club page in the app says.
    for (const slug of ["flamengo", "mirassol", "sao-paulo"]) {
      await page.goto(`/clube/${slug}`);

      const sede = page.locator("main [data-sede]");
      // The label and the destination suffix are screen-reader text, so they
      // are named here rather than anchored around: what is being asserted is
      // that the city and the UF are the whole of the *visible* line.
      await expect(sede).toHaveText(
        /^Sede: [A-ZÁ-Ú][^,]+, [A-Z]{2} — no Google Maps \(abre em nova aba\)$/,
      );
      expect(await page.locator("main").innerText()).not.toMatch(/\bnull\b/i);
      // And that the half-empty address is searched as the part that is real,
      // never with upstream's interpolated word in the query.
      expect(await sede.locator("a").getAttribute("href")).not.toMatch(/null/i);
    }
  });

  test("the sede is announced as one, since its mark is aria-hidden", async ({ page }) => {
    await page.goto("/clube/palmeiras");

    // Without the screen-reader label the address reads out as a bare string
    // with nothing saying what it is.
    await expect(page.locator("main [data-sede] .sr-only").first()).toHaveText("Sede:");
  });

  test("every club carries all five links", async ({ page }) => {
    // A missing handle renders as no link at all rather than a broken one, so
    // this would pass silently if the merge stopped working — hence checking
    // that the club actually named in the URL is the one that has it.
    await page.goto("/clube/palmeiras");

    await expect(instagramLink(page)).toHaveAttribute(
      "href",
      "https://www.instagram.com/palmeiras/",
    );
    await expect(siteLink(page)).toHaveAttribute("href", "https://www.palmeiras.com.br/");
    await expect(hymnLink(page)).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=DiKvx0gRfaQ",
    );
    await expect(wikipediaLink(page)).toHaveAttribute(
      "href",
      "https://pt.wikipedia.org/wiki/Sociedade_Esportiva_Palmeiras",
    );
    // The fifth is the sede, which is the only one of them built from a field
    // rather than looked up: the address itself is the query.
    await expect(page.locator("main [data-sede-map]")).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("Rua Palestra Italia nº 214, Perdizes São Paulo, SP 05005-030"),
    );
  });
});
