import assert from "node:assert/strict";
import { test } from "node:test";

import { deedFor, redistributable } from "@/commons-core";
import { PLAYER_PHOTOS } from "@/src/data/player-photos";

/**
 * These assert the *data*, not the code, which is unusual here and deliberate.
 * A photograph served without its credit is a licence breach rather than a
 * rendering bug, and the compiler only checks that the fields exist — an empty
 * string satisfies `credit: string` and reads as a missing attribution on the
 * page. `check-player-photos` catches this too, but it needs a network and
 * nobody runs it on a commit that only touched the data file.
 */
test("every recorded photograph is one the app may republish", () => {
  for (const [id, photo] of Object.entries(PLAYER_PHOTOS)) {
    assert.ok(
      redistributable(photo.license),
      `player ${id}: "${photo.license}" is not a licence this app may republish`,
    );
    assert.equal(
      photo.licenseUrl,
      deedFor(photo.license),
      `player ${id}: licenseUrl does not match the deed for ${photo.license}`,
    );
  }
});

test("every recorded photograph names its photographer and says what it shows", () => {
  for (const [id, photo] of Object.entries(PLAYER_PHOTOS)) {
    assert.ok(photo.credit.trim(), `player ${id}: empty credit`);
    assert.ok(photo.file.trim(), `player ${id}: empty Commons file title`);
    assert.ok(photo.alt.trim(), `player ${id}: empty alt text`);
    // The alt describes the picture. A file name is what it must not be — that
    // is the failure the stadium photographs hit, and it reads as plausible.
    assert.notEqual(photo.alt.trim(), photo.file.trim(), `player ${id}: alt is the file name`);
  }
});
