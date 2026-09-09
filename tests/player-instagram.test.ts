import assert from "node:assert/strict";
import { test } from "node:test";

import { PLAYER_INSTAGRAM } from "@/src/data/player-instagram";
import { SEED_SQUADS } from "@/src/data/squads";

/**
 * This asserts the *data*, not the code — `tests/player-posts.test.ts`'
 * arrangement, and this is that file's own "every keyed player is still in the
 * division" case pointed at the older and larger of the two curated player
 * files. `player-posts.ts` has carried the gate since it landed;
 * `player-instagram.ts` is keyed the same way and had none.
 *
 * **It checks the key and not the handle, and the distinction is the whole of
 * what this file may claim.** A key that resolves says the entry names a
 * footballer the app still lists; it says nothing whatever about whether the
 * handle beside it is that footballer's account. That second question cannot
 * be asked from a script at all — Instagram serves the identical JavaScript
 * shell for a real handle and an invented one, which is why there is no
 * `check-player-instagram` alongside `check-hymns` and
 * `check-stadium-photos`. `src/data/player-instagram.ts` records that at
 * length, and the bar it sets — open every candidate in a browser — is
 * untouched by anything here.
 */

/**
 * A key that no longer names anybody is a dead entry nothing renders, and it
 * arrives through a **`sync-seed-data` run** rather than through somebody's
 * unrelated commit — which is what keeps this a unit test rather than a monthly
 * workflow, exactly as for `player-overrides.ts`. It fails on the deliberate
 * act that could invalidate it, and at no other time.
 */
test("every keyed player is still in the division", () => {
  const seeded = new Set(SEED_SQUADS.flatMap((squad) => squad.players.map((p) => p.id)));

  for (const id of Object.keys(PLAYER_INSTAGRAM)) {
    assert.ok(seeded.has(id), `player ${id} is no longer in squads.ts`);
  }
});
