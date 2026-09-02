import { expect, test, type Page } from "@/tests/e2e/clock";

/**
 * What a reader sees when a crest does not load.
 *
 * **Nothing tested this before.** The monogram fallback shipped in `9133753`
 * without a spec, because the state it draws is unreachable from the suite: the
 * frozen snapshot gives every club a crest, so the branch never runs. That is
 * the same shape as `goals.spec.ts`'s empty state, and it takes the same
 * answer — **produce the state with a prepared payload rather than hunting the
 * season for a club in it.** A walk looking for a crestless club is a hostage
 * to what the provider happens to serve, which is the rule `CLAUDE.md` states
 * as *never assert how much curated data exists*.
 *
 * The payload is prepared **once per test and fulfilled from memory**, never
 * proxied per request: a `route.fetch()` handler flakes under the suite's
 * workers and passes in isolation.
 */

/**
 * Every endpoint that carries a club, and there are three.
 *
 * Enumerated rather than inferred, and the enumeration is the fiddly part: the
 * classificação builds its rows from `/api/standings`, the club page reads both
 * that and `/api/clubs`, and the match page takes the clubs shipped alongside
 * the fixtures in `/api/matches`. Stubbing only the obvious two left the
 * standings serving real crests and this file half green, which is how the
 * third was found.
 */
const CLUB_ROUTES = ["/api/clubs", "/api/matches", "/api/standings"];

/**
 * Serve every club with its crest removed, and optionally with the fields the
 * monogram is built from removed too.
 *
 * It **walks the whole payload** rather than reaching into each one's shape.
 * The three differ — a bare array, `data.clubs` beside the fixtures, a club
 * nested on every standings row — and a helper that knows all three is a
 * helper that breaks the next time one of them gains a field. A club is
 * recognised by carrying both `code` and `shortName`, which no other object in
 * these payloads does.
 *
 * `stripIdentity` reaches the case the mark exists for: `crestMonogram` returns
 * `""` for a club with neither a `tla` nor a usable short name, and the
 * monogram branch then renders *nothing at all*. On the match page that is a
 * 56px hole beside the scoreline.
 */
const withoutCrests = async (page: Page, { stripIdentity = false, goLive = false } = {}) => {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (value === null || typeof value !== "object") return value;

    const entry = value as Record<string, unknown>;
    const isClub = typeof entry.code === "string" && typeof entry.shortName === "string";
    const mapped = Object.fromEntries(Object.entries(entry).map(([k, v]) => [k, walk(v)]));

    if (!isClub) return mapped;
    const { crest: _dropped, ...rest } = mapped;
    return stripIdentity ? { ...rest, tla: "", shortName: "" } : rest;
  };

  for (const path of CLUB_ROUTES) {
    const body = walk(await (await page.request.get(path)).json());

    // The Ao vivo live card is the one crest slot the snapshot cannot reach:
    // `src/data/matches.ts` holds no LIVE fixture and the suite boots with
    // `DISABLE_FOOTBALL_DATA=true`. One SCHEDULED fixture is flipped in the
    // payload already being prepared, which is `meu-time.spec.ts`'s answer —
    // the real response with one record changed, so everything the page derives
    // from it stays coherent.
    if (goLive && path === "/api/matches") {
      const matches = (body as unknown as { data: { matches: { status: string }[] } }).data.matches;
      const target = matches.find((m) => m.status === "SCHEDULED");
      if (target) Object.assign(target, { status: "LIVE", homeGoals: 1, awayGoals: 0 });
    }

    await page.route(`**${path}*`, (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }),
    );
  }
};

test("the club page holds a missing crest with the mark", async ({ page }) => {
  await withoutCrests(page);
  await page.goto("/clube/palmeiras");

  const held = page.locator('main [data-crest-fallback="mark"]');
  await expect(held).toHaveCount(1);
  // The box is the crest's, so nothing around it moves when the CDN fails.
  expect(await held.evaluate((el) => el.getBoundingClientRect().width)).toBeCloseTo(44, 0);
  // No image is drawn, so the browser cannot paint its missing-image glyph.
  await expect(page.locator("main img[src*='crests.football-data.org']")).toHaveCount(0);
});

test("the painel holds a missing crest the same way the club page does", async ({
  page,
}) => {
  // The club page is the only link to this one, and both draw the same 44px
  // club header — so holding a missing crest two different ways one click apart
  // reads as a bug. #305 shipped with them disagreeing, deliberately and
  // briefly; this is the case that stops it happening again.
  await withoutCrests(page);
  await page.goto("/painel/palmeiras");

  const held = page.locator('main [data-crest-fallback="mark"]');
  await expect(held).toHaveCount(1);
  expect(await held.evaluate((el) => el.getBoundingClientRect().width)).toBeCloseTo(44, 0);
  await expect(page.locator('main [data-crest-fallback="monogram"]')).toHaveCount(0);
});

test("the match page holds both missing crests with the mark", async ({ page }) => {
  await withoutCrests(page);
  await page.goto("/partida/554977");

  const held = page.locator('main article [data-crest-fallback="mark"]');
  await expect(held).toHaveCount(2);
  expect(await held.first().evaluate((el) => el.getBoundingClientRect().width)).toBeCloseTo(56, 0);
});

test("the mark draws where the monogram would have nothing to draw", async ({ page }) => {
  // The case the mark is actually for. With no `tla` and no short name there is
  // no letter to stand in, and the monogram branch renders nothing — a hole at
  // 56px. Confirmed by pointing this at `fallback="monogram"`: count 0.
  await withoutCrests(page, { stripIdentity: true });
  await page.goto("/partida/554977");

  await expect(page.locator('main article [data-crest-fallback="mark"]')).toHaveCount(2);
});

test("Ao vivo: the 40px live card takes the mark, the 20px rows keep letters", async ({
  page,
}) => {
  // Both halves on one page, which is the whole of the scoping decision. The
  // live card is 40px and can hold a picture; the *A seguir* and *Últimos
  // resultados* rows below go through `FixtureSides` at 20px, which is
  // classificação size. Asserting only the first would let someone put the mark
  // on `FixtureSides` too — and that would carry it onto Jogos, the club page
  // and the estádio page, none of which was asked for.
  await withoutCrests(page, { goLive: true });
  await page.goto("/ao-vivo");

  const live = page.locator('main [data-live-match] [data-crest-fallback="mark"]');
  await expect(live.first()).toBeVisible();
  expect(await live.first().evaluate((el) => el.getBoundingClientRect().width)).toBeCloseTo(
    40,
    0,
  );

  // The rows below hold their slots with letters, and no mark reaches them.
  await expect(page.locator('main [data-crest-fallback="monogram"]').first()).toBeVisible();
});

test("the classificação keeps its letters — the mark is not legible at 18px", async ({ page }) => {
  // This is the assertion that stops the prop being "simplified" into a global
  // default. The arch and its three bars were checked at 16px while the mark
  // was being designed and they are mush there, where three letters still read.
  // Twenty of them at once is also what a CDN outage actually looks like.
  await withoutCrests(page);
  await page.goto("/");

  const rows = page.locator("table tbody tr");
  await expect(rows.first()).toBeVisible();
  await expect(page.locator('table [data-crest-fallback="monogram"]').first()).toBeVisible();
  await expect(page.locator('table [data-crest-fallback="mark"]')).toHaveCount(0);
});

test("the held slot is decorative, like the crest it replaces", async ({ page }) => {
  // The club's name sits beside it either way, so announcing the mark would
  // make a screen reader say the club twice — the rule the crest already follows.
  await withoutCrests(page);
  await page.goto("/clube/palmeiras");

  const held = page.locator('main [data-crest-fallback="mark"]');
  await expect(held).toHaveAttribute("aria-hidden", "true");
  await expect(held.locator("svg")).toHaveAttribute("aria-hidden", "true");
});
