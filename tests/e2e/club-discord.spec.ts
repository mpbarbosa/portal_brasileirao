import { expect, test, type Page } from "@/tests/e2e/clock";

/**
 * The supporters' Discord link on a club page.
 *
 * **This spec exists because the frozen snapshot cannot reach the state it
 * tests**, which is `meu-time.spec.ts`' situation and `version-reload.spec.ts`'
 * one: `src/data/club-discord.ts` ships with no entries, so no club carries an
 * invite and the anchor renders nowhere. Without a prepared payload the passing
 * state would be indistinguishable from the feature being deleted — and the
 * feature would ship having never once rendered, which is what a curated file
 * that starts empty invites.
 *
 * The payload is read **once** and fulfilled from memory rather than proxied
 * per request: a `route.fetch()` handler came back as something other than the
 * envelope under this suite's workers, and passed in isolation. The clubs the
 * page resolves come from `/api/matches`, not `/api/clubs` — that is the list
 * that survives a provider outage, which `App` documents at its fetch.
 */
const withDiscordValue = async (page: Page, value: string) => {
  // **Both payloads, and that is the whole difficulty of this fixture.**
  // `ClubView` resolves its club from `/api/standings` FIRST and falls back to
  // `/api/matches` — so a fixture that prepares only the fixtures payload
  // injects into the copy that loses, and the link never renders. Measured: the
  // page received `discord` on the club it was handed and drew nothing, while
  // the subreddit beside it drew fine, because the subreddit was on the
  // standings copy the server had enriched.
  //
  // Preparing both means this spec does not encode which of the two wins, which
  // is a detail of `ClubView` rather than a promise to the reader — and one
  // that would fail as a mysteriously empty locator if it ever changed.
  const [standings, matches] = await Promise.all([
    page.request.get("/api/standings").then((r) => r.json()),
    page.request.get("/api/matches").then((r) => r.json()),
  ]);

  const rows = (standings as { data: { club: { code: string; slug?: string; discord?: string } }[] })
    .data;
  // The clubs sit INSIDE `data` beside the fixtures, not at the envelope's top
  // level — `envelope.clubs` is undefined and reads as "the provider shipped
  // none", which is a premise failure dressed as a payload failure.
  const clubs = (matches as { data: { clubs?: { code: string; slug?: string; discord?: string }[] } })
    .data.clubs;

  if (!rows?.length) throw new Error("/api/standings shipped no rows — the spec's premise is gone");
  if (!clubs?.length) throw new Error("/api/matches shipped no clubs — the spec's premise is gone");

  const code = rows[0].club.code;
  rows[0].club.discord = value;
  for (const club of clubs) if (club.code === code) club.discord = value;

  // Fulfilled from memory rather than proxied per request: a `route.fetch()`
  // handler came back as something other than the envelope under this suite's
  // workers, and passed in isolation.
  await page.route("**/api/standings*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(standings) }),
  );
  await page.route("**/api/matches*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(matches) }),
  );

  return rows[0].club.slug ?? code;
};

const discordLink = (page: Page) => page.locator("[data-discord]");

test.describe("Discord da torcida", () => {
  test("an invite renders a link to discord.gg", async ({ page }) => {
    const key = await withDiscordValue(page, "aBcD1234");
    await page.goto(`/clube/${key}`);

    await expect(discordLink(page)).toHaveCount(1);
    // Built from the parsed code, so the address cannot disagree with the file.
    await expect(discordLink(page)).toHaveAttribute("href", "https://discord.gg/aBcD1234");
    // A new tab, and `noopener` — the pair `ClubLinks` exists to stop drifting.
    await expect(discordLink(page)).toHaveAttribute("target", "_blank");
    await expect(discordLink(page)).toHaveAttribute("rel", /noopener/);
  });

  test("the link says whose it is, and does not claim to be the club's", async ({ page }) => {
    const key = await withDiscordValue(page, "aBcD1234");
    await page.goto(`/clube/${key}`);

    // The one thing a screen reader must not be told is that a supporters'
    // server is the club speaking — `club-reddit.ts`' rule, at a second host.
    await expect(discordLink(page)).toHaveAccessibleName(/comunidade de torcedores no Discord/);
    await expect(discordLink(page)).not.toHaveAccessibleName(/oficial/);
  });

  test("a server address renders NO link, rather than one that goes nowhere", async ({ page }) => {
    // The refusal, proven where it matters rather than only at the parser. A
    // `channels/<guild>` URL is what a person pastes, and it opens nothing for
    // anybody who is not already in the server — so the honest render is an
    // absent link, exactly as for a club with no entry at all.
    const key = await withDiscordValue(page, "https://discord.com/channels/956003357129076746/@home");
    await page.goto(`/clube/${key}`);

    // Waited on rather than asserted immediately: the club page renders before
    // its payload lands, so an empty locator here would pass against a page
    // that had simply not loaded — the trap `allInnerTexts` records one file
    // over. The heading is what says the club resolved.
    await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toBeVisible();
    await expect(discordLink(page)).toHaveCount(0);
  });
});
