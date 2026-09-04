import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO = path.resolve(import.meta.dirname, "..");
const LIST = "scripts/appearance-paths.txt";

const listed = (): string[] =>
  readFileSync(path.join(REPO, LIST), "utf8").split("\n").filter(Boolean);

/** Root-level `*-core.ts` files, which is where every pure module in this app lives. */
const rootCoreModules = (): string[] =>
  readdirSync(REPO).filter((f) => f.endsWith("-core.ts"));

/**
 * Whether anything under `src/` imports a module — the client bundle's own
 * reach, which is what decides if an edit can move a rendered pixel.
 *
 * `grep -rl` rather than a parse: the alias is spelled exactly one way in this
 * repository (`@/<name>"`), enforced by `tsconfig`'s single `paths` entry, and a
 * parser here would be a second implementation of a question `tsc` already
 * answers for correctness.
 */
const importedBySrc = (module: string): boolean => {
  const name = module.replace(/\.ts$/, "");
  try {
    execFileSync("grep", ["-rlq", `@/${name}"`, "src"], { cwd: REPO });
    return true;
  } catch {
    return false;
  }
};

/**
 * **The list must not be able to go stale silently, because that is the exact
 * failure it was just widened to fix.**
 *
 * `rank-candles-core.ts` holds the geometry that places every candle rect, and
 * it was not watched — so #351 moved pixels inside `painel-palmeiras-{light,dark}`
 * while the screenshot gate passed green on its own pull request. Adding that
 * one file fixed one instance; nothing stopped the next core module arriving
 * unwatched in exactly the same way.
 *
 * So the rule is stated once, as a property: **every root-level `*-core.ts` the
 * client imports is a watched path.** A new module imported by a component
 * fails here on the commit that introduces it, rather than years later when
 * somebody measures a frame by hand.
 *
 * **Deliberately "imported by `src/`" and not "renders something".** Two of the
 * modules this admits — `page-meta-core` and `seo-core`, both reached through
 * `src/usePageMeta.ts` — write the document head and cannot move a captured
 * pixel. Watching them over-reports, which is the direction `src/data` already
 * fails in for the seed snapshot, and it is the price of a rule with no
 * carve-out list. A carve-out is the shape CLAUDE.md warns about: a claim that
 * produces no work while it holds, so nothing distinguishes "still true" from
 * "quietly false".
 */
test("every root core module the client imports is a watched appearance path", () => {
  const watched = new Set(listed());
  const missing = rootCoreModules()
    .filter(importedBySrc)
    .filter((module) => !watched.has(module));

  assert.deepEqual(
    missing,
    [],
    `these are imported under src/ but absent from ${LIST}: ${missing.join(", ")}`,
  );
});

/**
 * And the other direction, so the list cannot accumulate entries for modules
 * nothing imports any more. A dead path costs no correctness — it simply never
 * matches — but it makes the list a worse description of what it claims to
 * describe, and the next reader cannot tell a deliberate entry from a leftover.
 */
test("no watched core module has stopped being imported", () => {
  const stale = listed()
    .filter((entry) => entry.endsWith("-core.ts"))
    .filter((entry) => !importedBySrc(entry));

  assert.deepEqual(stale, [], `watched but no longer imported under src/: ${stale.join(", ")}`);
});
