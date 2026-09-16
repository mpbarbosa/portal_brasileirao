import assert from "node:assert/strict";
import { test } from "node:test";

import { postsFor } from "@/club-core";
import { instagramHandle, instagramPostCode } from "@/instagram-core";
import { CLUBS } from "@/src/data/clubs";
import { CLUB_INSTAGRAM } from "@/src/data/club-instagram";
import { CLUB_POSTS } from "@/src/data/club-posts";

/**
 * These assert the *data*, not the code — `tests/player-posts.test.ts`'
 * arrangement, at the club-keyed twin of that file, and for the same reason:
 * the compiler is satisfied by an empty string, and an empty `summary` reads on
 * the page as a press target with nothing written on it.
 *
 * **What is deliberately NOT duplicated from that file is its reasoning**, only
 * its assertions. `src/data/club-posts.ts` states the rules and points at
 * `player-posts.ts` for the argument behind them; restating it in three places
 * is how three copies come to disagree.
 *
 * **One rule here has no counterpart there**, and it is the reason this file is
 * worth more than a copy: a club's publicação must come from that club's own
 * account, which `club-instagram.ts` already records, so the bar is a
 * comparison between two committed files. `player-posts.ts` cannot do that —
 * its accounts are legitimately the club's *or* the player's — so the
 * equivalent check there is `check-player-posts` asking Instagram for a badge,
 * once a month. Here it runs on every commit with no network at all.
 */

/**
 * `tests/e2e/club-posts.spec.ts` opens one named club to prove the wiring. That
 * spec passes vacuously against an empty table — the facade it looks for is
 * simply absent — so this is the assertion that stops emptying the file from
 * quietly disabling it. `player-posts.test.ts` and `coaches.spec.ts` carry the
 * same guard for the same reason.
 */
test("the table is not empty", () => {
  const total = Object.values(CLUB_POSTS).reduce((sum, posts) => sum + posts.length, 0);
  assert.ok(total > 0, "no posts are recorded, so the end-to-end spec asserts nothing");
});

test("every recorded post carries a code the app can actually draw", () => {
  for (const [code, posts] of Object.entries(CLUB_POSTS)) {
    for (const post of posts) {
      assert.equal(
        instagramPostCode(post.code),
        post.code,
        `club ${code}: "${post.code}" is not a bare shortcode`,
      );
    }
  }
});

/**
 * The round trip above is what enforces this, since a pasted permalink parses
 * to a different string than it started as. It is stated separately because the
 * reason is not visible in that assertion: Instagram's own "copy link" appends
 * `?utm_source=ig_web_copy_link&stkn=…`, and `stkn` identifies **whoever copied
 * the link**. A permalink in this file commits somebody's share token to a
 * public repository.
 */
test("no entry stores a pasted URL rather than a shortcode", () => {
  for (const [code, posts] of Object.entries(CLUB_POSTS)) {
    for (const post of posts) {
      assert.ok(
        !post.code.includes("/") && !post.code.includes("?"),
        `club ${code}: "${post.code}" looks like a URL, not a shortcode`,
      );
    }
  }
});

test("every recorded post names its account and says what it is", () => {
  for (const [code, posts] of Object.entries(CLUB_POSTS)) {
    for (const post of posts) {
      assert.ok(post.summary.trim(), `club ${code}: empty summary for ${post.code}`);
      assert.equal(
        instagramHandle(post.account),
        post.account,
        `club ${code}: "${post.account}" is not a bare handle`,
      );
      // The summary describes the post. The code is what it must not be.
      assert.notEqual(
        post.summary.trim(),
        post.code,
        `club ${code}: summary is the shortcode`,
      );
    }
  }
});

/**
 * **The rule this file exists for.** A Publicação do clube is the club's own,
 * so the publisher must be the handle `club-instagram.ts` records for that same
 * code — not merely a verified account, and not the club's own account under
 * some other spelling.
 *
 * It is a comparison rather than a judgement, which is what makes it cheap
 * enough to run on every commit. It also catches the failure a badge check
 * never could: an entry filed under the **wrong club**, whose post is perfectly
 * real and perfectly verified and simply belongs to somebody else. That is the
 * `tla` collision's shape — Corinthians and Coritiba both report `COR` — met at
 * a curated file rather than at a standings row.
 *
 * Compared case-insensitively, because a handle is: `instagram.com/FLAMENGO`
 * and `instagram.com/Flamengo` are one account, measured on X's host and true
 * of Meta's. Refusing an entry for its casing would be a false FAIL on a good
 * post, which is the direction a gate must never fail in.
 */
test("every post is published by the club's own recorded account", () => {
  for (const [code, posts] of Object.entries(CLUB_POSTS)) {
    const official = CLUB_INSTAGRAM[code];
    assert.ok(
      official,
      `club ${code} has posts but no handle in club-instagram.ts, so nothing can vouch for them`,
    );

    for (const post of posts) {
      assert.equal(
        post.account.toLowerCase(),
        official.toLowerCase(),
        `club ${code}: "${post.code}" is published by @${post.account}, ` +
          `but the club's own account is @${official}`,
      );
    }
  }
});

test("no club lists the same post twice", () => {
  for (const [code, posts] of Object.entries(CLUB_POSTS)) {
    const codes = posts.map((post) => post.code);
    assert.equal(
      new Set(codes).size,
      codes.length,
      `club ${code}: the same post is recorded more than once`,
    );
  }
});

/**
 * A key that names no club is a dead entry nothing renders, and it arrives
 * through a **`sync-seed-data` run** rather than through somebody's unrelated
 * commit — the arrangement `player-posts.test.ts` keeps for players who leave
 * the division. It fails on the deliberate act that could invalidate it, and at
 * no other time.
 */
test("every keyed club is still in the division", () => {
  const seeded = new Set(CLUBS.map((club) => club.code));

  for (const code of Object.keys(CLUB_POSTS)) {
    assert.ok(seeded.has(code), `club ${code} is no longer in clubs.ts`);
  }
});

/**
 * The selector's own contract, asserted against the real table rather than a
 * fixture: what `ClubView` renders is `postsFor`'s output, so a club with
 * entries must get them and a club with none must get an empty list — which is
 * what makes the section absent rather than an empty heading.
 *
 * The dropping of an unparseable code needs a fixture, because no committed
 * entry carries one, and it sits directly below — beside the selector it is
 * about, which is where `tests/club-videos.test.ts` keeps `videosFor`'s.
 */
test("postsFor returns a club's own entries, and nothing for a club with none", () => {
  for (const [code, posts] of Object.entries(CLUB_POSTS)) {
    assert.deepEqual(postsFor(CLUB_POSTS, code), posts, `club ${code}`);
  }

  const uncurated = CLUBS.find((club) => !CLUB_POSTS[club.code]);
  assert.ok(uncurated, "every club is curated, so the empty case is untested");
  assert.deepEqual(postsFor(CLUB_POSTS, uncurated.code), []);
});

test("postsFor drops an entry whose code will not parse, and keeps the rest", () => {
  const posts = postsFor(
    {
      "1769": [
        { code: "DdRg1_tTnJs", account: "palmeiras", summary: "boa" },
        // `/reels/` and `/tv/` are the two Instagram link shapes
        // `instagramPostCode` refuses outright — the first answered only the
        // login wall opened logged out, and nothing here has seen the `/p/`
        // embed serve the second. One bad line must not take the other with
        // it, which is `videosFor`'s rule at a second curated file.
        { code: "https://www.instagram.com/reels/DdRg1_tTnJs/", account: "palmeiras", summary: "má" },
      ],
    },
    "1769",
  );

  assert.deepEqual(posts.map((post) => post.summary), ["boa"]);
});

/**
 * **A pasted permalink is NOT what this filter drops**, which is the
 * distinction `tests/club-videos.test.ts` had to write down for `videosFor` and
 * which holds here for the same reason: `instagramPostCode` parses a `/p/` or
 * `/reel/` link happily, so a curator who pasted one gets a working section.
 * The filter is about what would *render broken*; the file's shortcode-only
 * rule is a claim about the **file** and is enforced above, where `code` must
 * equal its own parse.
 *
 * That rule is the one carrying the share token, so it matters that the two are
 * separate: a permalink must be refused by the data test even though the page
 * could draw it.
 */
test("postsFor keeps an entry whose code was pasted as a link", () => {
  const posts = postsFor(
    {
      "1769": [
        {
          code: "https://www.instagram.com/reel/DdRg1_tTnJs/?utm_source=ig_web_copy_link&stkn=x",
          account: "palmeiras",
          summary: "colada",
        },
      ],
    },
    "1769",
  );

  assert.deepEqual(posts.map((post) => post.summary), ["colada"]);
});
