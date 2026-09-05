import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { SNAPSHOT_DATE } from "@/src/data/matches";

/**
 * The manim artefacts in `docs/videos/` are STALE BY CONSTRUCTION and nothing
 * else here can see it.
 *
 * Two videos and four capas are drawn from the seed and committed, the way
 * `og-default.png` is, so that somebody cloning the repository has them without
 * installing Manim. They describe one snapshot of one season for ever after —
 * and a `sync-seed-data` moves the season underneath them with every gate in
 * this repository staying green. The `docs/screenshots` guard does not look at
 * this directory; CI never opens an mp4; the bytes are compared by nothing.
 *
 * **So this reddens deliberately, and only on a sync.** `SNAPSHOT_DATE` moves
 * on a `sync-seed-data` run and on nothing else, which is exactly the property
 * `tests/player-core.test.ts` has and is praised for in `CLAUDE.md`: it cannot
 * go red on somebody's unrelated commit, and the person it interrupts is the
 * one person able to act on it.
 *
 * **What it checks is a person's CLAIM, not the bytes**, which is the same bound
 * `docs/screenshots/CAPTURED` carries and is worth knowing before trusting a
 * green run here: nothing stops somebody writing a new date over artefacts they
 * never redrew. It catches forgetting, which is the failure that actually
 * happens; it cannot catch lying, and no check on this side of the render can.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const VIDEOS = path.resolve(HERE, "../docs/videos");
const SCENES = path.resolve(HERE, "../scripts/manim");
const RENDERED = path.join(VIDEOS, "RENDERED");

/** `# comments` and blank lines out, `<file>  <date>` in. */
const readRendered = (): Map<string, string> => {
  const rows = new Map<string, string>();
  for (const raw of readFileSync(RENDERED, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [file, ...rest] = line.split(/\s+/);
    rows.set(file, rest.join(" "));
  }
  return rows;
};

/** Everything in the directory except the record itself. */
const artefacts = () => readdirSync(VIDEOS).filter((name) => name !== "RENDERED").sort();

test("every committed render was drawn from the season the seed now describes", () => {
  for (const [file, snapshot] of readRendered()) {
    assert.equal(
      snapshot,
      SNAPSHOT_DATE,
      `docs/videos/${file} was drawn from ${snapshot} and the seed is now ${SNAPSHOT_DATE}.\n` +
        `    Re-export, re-render and re-draw the capas — scripts/manim/README.md has the four\n` +
        `    commands — then write the new date into docs/videos/RENDERED in the same commit.`,
    );
  }
});

test("the record and the directory name the same artefacts", () => {
  const rows = readRendered();
  const files = artefacts();

  // Both directions, because they fail differently and only one of them is
  // loud. A listed file that is gone breaks a command somebody runs; an
  // artefact that is PRESENT and unlisted is the quiet one — it is simply
  // exempt from the staleness check above, for ever, and nothing says so.
  for (const file of rows.keys()) {
    assert.ok(files.includes(file), `docs/videos/RENDERED names ${file}, which is not there`);
  }
  for (const file of files) {
    assert.ok(rows.has(file), `docs/videos/${file} is not in RENDERED, so nothing checks whether it is stale`);
  }
});

test("the exported payloads the scenes read were taken from the same seed", () => {
  // The renders are drawn from these, so a fresh JSON under a stale video is
  // the halfway state a person lands in mid-regeneration. Checking it here
  // rather than only in RENDERED means the message names the step that is
  // missing rather than the whole chain.
  //
  // Read the DIRECTORY, not a list written here — the same move the artefact
  // check above makes, for the same reason: a payload that is present and
  // unlisted is exempt from this check for ever and nothing says so. That is
  // not hypothetical for this scene, because `velas.py` draws one club per
  // run, so a second club is a second payload beside the first.
  for (const name of readdirSync(SCENES).filter((file) => file.endsWith(".json"))) {
    const payload = JSON.parse(
      readFileSync(path.join(SCENES, name), "utf8"),
    ) as { snapshot: string };
    assert.equal(
      payload.snapshot,
      SNAPSHOT_DATE,
      `scripts/manim/${name} was exported from ${payload.snapshot} and the seed is now ${SNAPSHOT_DATE}`,
    );
  }
});
