import assert from "node:assert/strict";
import { test } from "node:test";

import { instagramHandle, instagramPostCode } from "@/club-core";
import { PLAYER_POSTS } from "@/src/data/player-posts";
import { SEED_SQUADS } from "@/src/data/squads";

/**
 * These assert the *data*, not the code — `tests/player-photos.test.ts`'
 * arrangement and for the same reason. The compiler is satisfied by an empty
 * string, and an empty `summary` reads on the page as a press target with
 * nothing written on it, while an empty `account` is a post whose provenance
 * the card cannot state.
 *
 * **There is no `check-player-posts` script and there cannot be one.** Instagram
 * answers the identical JavaScript shell for a real shortcode and an invented
 * one — measured, 620 681 bytes against 620 686, same title — so a checker would
 * confirm nothing while looking exactly like `check-hymns`, which confirms
 * something. `src/data/player-instagram.ts` records the same limit for handles.
 * Every entry is opened in a browser instead; what is left for a gate is the
 * shape, which is what this file holds.
 */

/**
 * `tests/e2e/player-posts.spec.ts` opens one named player to prove the wiring,
 * which is `players.spec.ts`' rule for every curated link on this card. That
 * spec passes vacuously against an empty table — the facade it looks for is
 * simply absent — so this is the assertion that stops emptying the file from
 * quietly disabling it. `coaches.spec.ts` carries the same guard for the same
 * reason.
 */
test("the table is not empty", () => {
  const total = Object.values(PLAYER_POSTS).reduce((sum, posts) => sum + posts.length, 0);
  assert.ok(total > 0, "no posts are recorded, so the end-to-end spec asserts nothing");
});

test("every recorded post carries a code the app can actually draw", () => {
  for (const [id, posts] of Object.entries(PLAYER_POSTS)) {
    for (const post of posts) {
      assert.equal(
        instagramPostCode(post.code),
        post.code,
        `player ${id}: "${post.code}" is not a bare shortcode`,
      );
    }
  }
});

/**
 * The stored value is the code alone, which the assertion above enforces by
 * requiring a round trip: a pasted permalink parses to a *different* string
 * than it started as, so it fails there. That is the check that matters, and it
 * is stated here because the reason is not obvious from the assertion —
 * Instagram's own "copy link" appends `?utm_source=ig_web_copy_link&stkn=…`,
 * and `stkn` identifies whoever copied it. A permalink in this file commits
 * somebody's share token to a public repository.
 */
test("no entry stores a pasted URL rather than a shortcode", () => {
  for (const [id, posts] of Object.entries(PLAYER_POSTS)) {
    for (const post of posts) {
      assert.ok(
        !post.code.includes("/") && !post.code.includes("?"),
        `player ${id}: "${post.code}" looks like a URL, not a shortcode`,
      );
    }
  }
});

test("every recorded post names its account and says what it is", () => {
  for (const [id, posts] of Object.entries(PLAYER_POSTS)) {
    for (const post of posts) {
      assert.ok(post.summary.trim(), `player ${id}: empty summary for ${post.code}`);
      assert.equal(
        instagramHandle(post.account),
        post.account,
        `player ${id}: "${post.account}" is not a bare handle`,
      );
      // The summary describes the post. The code is what it must not be — the
      // failure `PlayerPhoto.alt` records for a file name, one field over.
      assert.notEqual(
        post.summary.trim(),
        post.code,
        `player ${id}: summary is the shortcode`,
      );
    }
  }
});

test("no player lists the same post twice", () => {
  for (const [id, posts] of Object.entries(PLAYER_POSTS)) {
    const codes = posts.map((post) => post.code);
    assert.equal(
      new Set(codes).size,
      codes.length,
      `player ${id}: the same post is recorded more than once`,
    );
  }
});

/**
 * A key that no longer names anybody is a dead entry nothing renders, and it
 * arrives through a **`sync-seed-data` run** rather than through somebody's
 * unrelated commit — which is what keeps this a unit test rather than a monthly
 * workflow, exactly as for `player-overrides.ts`. It fails on the deliberate
 * act that could invalidate it, and at no other time.
 */
test("every keyed player is still in the division", () => {
  const seeded = new Set(SEED_SQUADS.flatMap((squad) => squad.players.map((p) => p.id)));

  for (const id of Object.keys(PLAYER_POSTS)) {
    assert.ok(seeded.has(id), `player ${id} is no longer in squads.ts`);
  }
});
