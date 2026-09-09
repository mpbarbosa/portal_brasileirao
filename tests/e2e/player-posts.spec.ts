import { expect, test, type Page } from "@/tests/e2e/clock";

/**
 * **Publicações** on the player card: a curated Instagram post, offered as a
 * facade and mounted as a frame only when a reader presses it.
 *
 * **The player is named rather than taken from `.first()`**, which is
 * `players.spec.ts`' own rule for the curated link row directly above this
 * section: coverage is a handful of the division, so the first player of the
 * first club has no post and a spec built on one would assert nothing. The
 * fixture is chosen for being in the table, and `tests/player-posts.test.ts`
 * asserts the table is not empty — so emptying `player-posts.ts` reddens that
 * gate rather than making this file pass vacuously.
 *
 * **Nothing here asserts the summary's words or the account's spelling.** Both
 * are curated and may be rewritten; what is being tested is the wiring — that a
 * facade renders, that pressing it mounts Instagram's *embed* address and not
 * the canonical one, and that the way out is still there afterwards.
 *
 * The frame never leaves the machine: `tests/e2e/fixtures.ts` fulfils
 * `www.instagram.com` with an empty document, so this exercises our markup and
 * not Meta's uptime.
 */
const openViveros = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("link", { name: /^Jogadores/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Jogadores" })).toBeVisible();

  const panel = page.locator('[data-squad="athletico-pr"]');
  await panel.locator("summary").click();
  await panel.getByRole("button", { name: "Kevin Viveros" }).click();

  const card = page.getByRole("dialog");
  await expect(card).toBeVisible();
  return card;
};

test.describe("Publicações do jogador", () => {
  test("a player with a recorded post gets a facade, and no frame until it is pressed", async ({
    page,
  }) => {
    const card = await openViveros(page);

    await expect(card.getByRole("heading", { name: "Publicações" })).toBeVisible();
    const facade = card.locator("[data-post-facade]").first();
    await expect(facade).toBeVisible();

    // The whole argument for the facade, asserted rather than described: a card
    // opened for a position and an age must not have loaded a Meta frame.
    await expect(card.locator("iframe")).toHaveCount(0);

    // It is a link to the post first, so a modified click still leaves.
    await expect(facade).toHaveAttribute("href", /^https:\/\/www\.instagram\.com\/p\/[\w-]+\/$/);
    await expect(facade).toHaveAttribute("rel", /noopener/);
    await expect(facade).toHaveAttribute("target", "_blank");
  });

  test("pressing the facade mounts the captioned embed, not the canonical post", async ({
    page,
  }) => {
    const card = await openViveros(page);
    await card.locator("[data-post-facade]").first().click();

    const frame = card.locator("[data-post-frame]").first();
    await expect(frame).toBeVisible();
    // `/p/<code>/` answers `X-Frame-Options: DENY` and cannot be framed at all,
    // and the uncaptioned `/embed/` misreports its own height badly enough to
    // clip the picture. Both were measured in a browser; a frame pointed at
    // either renders as an empty white box, which is exactly the failure this
    // assertion exists to name.
    await expect(frame).toHaveAttribute(
      "src",
      /^https:\/\/www\.instagram\.com\/p\/[\w-]+\/embed\/captioned\/$/,
    );
    // The whole player-card URL would otherwise reach Meta on every request.
    await expect(frame).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");

    // The way out, which matters precisely when the frame does not render: a
    // blocked third party leaves a reader looking at a white rectangle.
    const out = card.getByRole("link", { name: /Abrir no Instagram/ });
    await expect(out).toHaveAttribute("href", /^https:\/\/www\.instagram\.com\/p\/[\w-]+\/$/);
    await expect(out).toHaveAttribute("rel", /noopener/);
  });

  test("a player with no recorded post gets no section at all", async ({ page }) => {
    // Not a heading over nothing: an absent post is not a missing value, which
    // is the rule the rest of this card already follows for a photograph, a
    // handle and an article.
    await page.goto("/");
    await page.getByRole("link", { name: /^Jogadores/ }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Jogadores" })).toBeVisible();

    const panel = page.locator('[data-squad="corinthians"]');
    await panel.locator("summary").click();
    await panel.getByRole("button", { name: "Memphis Depay" }).click();

    const card = page.getByRole("dialog");
    await expect(card).toBeVisible();
    // Scoped to this fixture rather than claimed of the division: the file is
    // curated and this player may acquire a post, at which point the spec
    // should be pointed at another — the failure a general claim would hide.
    await expect(card.getByRole("heading", { name: "Publicações" })).toHaveCount(0);
  });
});
