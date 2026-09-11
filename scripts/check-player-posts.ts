/**
 * check-player-posts.ts
 * ---------------------
 * Verify every curated Instagram post in src/data/player-posts.ts still exists
 * and is still published by the account recorded beside it.
 *
 * ## Why this one needs a browser, when no other checker here does
 *
 * `check-hymns` asks YouTube's oEmbed endpoint and `check-player-wikipedia`
 * asks the MediaWiki API: both answer a *script* honestly. Instagram does not.
 * Measured for `player-posts.ts` and re-measured here: `curl` of a real
 * shortcode's embed and of an invented one come back **620 681 and 620 686
 * bytes**, same `<title>Instagram</title>`, same everything — the login shell,
 * for both. An HTTP checker would report "200 OK" for a post that does not
 * exist, which is worse than no checker at all.
 *
 * The `/embed/captioned/` page renders its content **client-side**, so a real
 * engine sees the account, the verified badge, the follower count and the whole
 * caption. That is the entire reason this drives Chromium — the same
 * `@playwright/test` `chromium` that `scripts/screenshot.ts` already uses, so
 * no dependency is added.
 *
 * ## What it checks, and the one failure it exists for
 *
 *   1. the stored value is a bare shortcode — `instagramPostCode` round-trips it;
 *   2. **the post still exists** — Instagram answers "The link to this photo or
 *      video may be broken, or the post may have been removed." for a deleted
 *      one, and nothing else in this repository can see that;
 *   3. the **publisher** is the account recorded — the first line of the
 *      embed's header;
 *   4. that account is **verified**, which is the bar `player-posts.ts` states.
 *
 * The second is the one worth having. A deleted post renders as an empty white
 * frame inside the player card: the facade still reads correctly, the link
 * still looks right, and only somebody who presses it finds out. It is not
 * hypothetical — `DbPDTdToXCN` came out of a search with a plausible title and
 * was already gone, which is recorded in `player-posts.ts` as the case that
 * justifies this file.
 *
 * ## Two things it deliberately does NOT check
 *
 * **The date.** `player-posts.ts` requires a current-season post, and that rule
 * is a *curation* rule rather than a rot rule — a post does not become old and
 * wrong, it was old when it was written down. Checking it would also cost a
 * second navigation per entry, because the embed does not carry a date and only
 * the canonical `/p/<code>/` page does.
 *
 * **That the player is still in the division.** `tests/player-posts.test.ts`
 * already refuses an id that has left `squads.ts`, with no network and on every
 * commit. A second copy of that rule here would be one to keep in step.
 *
 * ## No deploy half, unlike check-hymns
 *
 * `check-hymns` takes an app URL and compares what a deployment serves. There
 * is nothing to compare against here: `player-posts.ts` is **bundled into the
 * client**, not served by any API, so the only way to ask a deployment would be
 * to grep a minified bundle — and that is a measurement trap this repository
 * has already paid for once, since `grep -c` counts *lines* and a minified
 * bundle has about eight, so everything present reports 1 and so does a
 * known-negative.
 *
 * Talks to Instagram only, so it costs nothing from the football-data budget.
 * **No build runs it**, for the reason `.github/workflows/curated-data.yml`
 * states at length: a link that rots on somebody else's server is not a reason
 * for a red build on a commit that did not touch it. That workflow runs it
 * monthly and reports into an issue.
 *
 * Usage:
 *   npx tsx scripts/check-player-posts.ts
 *
 * Exit codes:
 *   0  every post resolves and is published by the account recorded.
 *   1  at least one does not — the line says which and why.
 */
import { chromium, type Browser, type Page } from "@playwright/test";

import { instagramPostCode, instagramPostEmbedUrl } from "@/instagram-core";
import { PLAYER_POSTS } from "@/src/data/player-posts";
import { SEED_SQUADS } from "@/src/data/squads";
import type { PlayerPost } from "@/src/types";

/** Instagram's own words for a post that is gone. Matched loosely because the
 *  sentence is theirs to reword and the two halves are independent. */
const GONE = /may be broken|may have been removed|não está disponível|isn't available/i;

/**
 * The locale this reads Instagram in, pinned rather than inherited.
 *
 * **This is the bug this file was born with.** The first run reported *all
 * three* entries as carrying no verified badge, which is a false negative — the
 * direction a gate must never fail in. Instagram serves the badge in the
 * browser's negotiated language, headless Chromium negotiates the machine's,
 * and this workstation is pt-BR: the page said **"Verificado"**, "Comentar",
 * "Compartilhar". The English word was never going to be there.
 *
 * That is `rehearse-sync-schedule.sh`'s failure exactly — hermetic throughout,
 * and still answering differently on a workstation and on a CI runner, because
 * it read its environment instead of constructing one. So the context names its
 * own locale and the run is the same everywhere.
 */
const LOCALE = "en-US";

/**
 * The badge, in the two spellings actually observed.
 *
 * A backstop rather than the mechanism: `LOCALE` above is what makes this
 * deterministic. It is kept because the cost of the two being out of step is a
 * **false** FAIL on a good entry, and somebody acting on that deletes a post
 * that was fine — where the cost of the backstop is nothing at all.
 */
const VERIFIED = /^(verified|verificad[oa])$/i;

/** Likewise: "followers" under the pinned locale, "seguidores" without it. Only
 *  printed, never asserted on, so a miss costs a column and not a verdict. */
const FOLLOWERS = /(followers|seguidores)$/i;

/** Long enough for the client-side render on a slow runner, short enough that a
 *  hung navigation does not stall a monthly job for an hour. */
const TIMEOUT_MS = 30_000;

/** Instagram throttles a burst, and this is a host that owes us nothing —
 *  `check-hymns`' rule, and `sync-goals` paid for the sharper version of it
 *  against CBF, which throttles at the socket with no 429 at all. */
const PACE_MS = 1_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const playerNames = new Map(
  SEED_SQUADS.flatMap((squad) => squad.players.map((player) => [player.id, player.name])),
);

interface Row {
  id: string;
  who: string;
  post: PlayerPost;
  publisher: string;
  followers: string;
  problems: string[];
}

/**
 * The rendered embed, as lines of text.
 *
 * `domcontentloaded` and then a wait on the *content*, rather than `networkidle`:
 * the embed keeps connections open and an idle wait is what turns a checker into
 * a timeout. The predicate accepts the removal message too, so a deleted post is
 * read quickly instead of waiting out the full timeout to say nothing.
 */
const readEmbed = async (page: Page, url: string): Promise<string[]> => {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
  await page.waitForFunction(
    () => {
      const text = document.body?.innerText ?? "";
      return (
        /may be broken|may have been removed|não está disponível|isn't available/i.test(text) ||
        text.split("\n").length >= 4
      );
    },
    undefined,
    { timeout: TIMEOUT_MS },
  );

  const text = await page.evaluate(() => document.body.innerText);
  return text.split("\n").map((line) => line.trim()).filter(Boolean);
};

/**
 * Check one entry.
 *
 * **The publisher is the FIRST line, and a collaboration is why that is not
 * obvious.** A single-author header reads `["corinthians", "Verified", …]`, but
 * the seed entry is a collab and reads
 * `["athleticoparanaense", "and", "kevinviveros9", "932K followers", …]` — so
 * the badge moves from line 1 to line 6, and any fixed index for it breaks on
 * exactly that entry. The first line is the account that published either way,
 * which is what `PlayerPost.account` means.
 */
const check = async (page: Page, id: string, post: PlayerPost): Promise<Row> => {
  const who = playerNames.get(id) ?? "(not in squads.ts)";
  const problems: string[] = [];
  let publisher = "";
  let followers = "";

  if (instagramPostCode(post.code) !== post.code) {
    problems.push(`"${post.code}" is not a bare shortcode`);
    return { id, who, post, publisher, followers, problems };
  }

  const url = instagramPostEmbedUrl(post.code);
  if (!url) {
    problems.push(`no embed address for "${post.code}"`);
    return { id, who, post, publisher, followers, problems };
  }

  try {
    const lines = await readEmbed(page, url);

    if (lines.some((line) => GONE.test(line))) {
      problems.push("the post is gone — Instagram says it was removed or the link is broken");
      return { id, who, post, publisher, followers, problems };
    }

    publisher = lines[0] ?? "";
    followers = lines.find((line) => FOLLOWERS.test(line)) ?? "";

    if (publisher !== post.account) {
      problems.push(`published by "${publisher || "(nothing read)"}", not "${post.account}"`);
    }
    // The bar `player-posts.ts` states: the club's own account or the player's
    // own, and verified. An account that loses its badge is a real change of
    // what the entry rests on, so it is a failure rather than a note.
    if (!lines.slice(0, 10).some((line) => VERIFIED.test(line))) {
      problems.push(`"${publisher}" shows no verified badge`);
    }
  } catch (error) {
    problems.push((error as Error).message);
  }

  return { id, who, post, publisher, followers, problems };
};

let browser: Browser | undefined;
const rows: Row[] = [];

try {
  browser = await chromium.launch();
  const context = await browser.newContext({
    locale: LOCALE,
    extraHTTPHeaders: { "Accept-Language": `${LOCALE},en;q=0.9` },
  });
  const page = await context.newPage();

  // Sequential and paced, like `check-hymns`. One page reused rather than one
  // per entry: a context per post buys nothing and costs a browser start each.
  const entries = Object.entries(PLAYER_POSTS).flatMap(([id, posts]) =>
    posts.map((post) => [id, post] as const),
  );

  for (const [index, [id, post]] of entries.entries()) {
    if (index > 0) await sleep(PACE_MS);
    rows.push(await check(page, id, post));
  }
} catch (error) {
  // A browser that will not start is an environment problem, not rotted data,
  // and saying so is the difference between somebody installing Chromium and
  // somebody deleting a good entry.
  console.error(`Error: could not drive a browser — ${(error as Error).message}`);
  console.error("This checker needs Chromium: npx playwright install chromium");
  process.exit(1);
} finally {
  await browser?.close();
}

for (const row of rows) {
  const mark = row.problems.length ? "FAIL" : "ok  ";
  const meta = row.publisher ? `@${row.publisher}${row.followers ? ` · ${row.followers}` : ""}` : "";
  console.log(`${mark} ${row.who.padEnd(22)} ${row.post.code.padEnd(13)} ${meta}`);
  for (const problem of row.problems) console.log(`       -> ${problem}`);
}

const failed = rows.filter((row) => row.problems.length);
console.log(`\n${rows.length - failed.length}/${rows.length} posts verified`);

if (failed.length) {
  // The same closing note `check-hymns` carries, and it means the same thing: a
  // publisher match is evidence that the entry still points where it did, not
  // that the post is still worth showing on this player's card.
  console.log("Open the ones above before editing: this narrows what you read, it does not replace it.");
  process.exit(1);
}
