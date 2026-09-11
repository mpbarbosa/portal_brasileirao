import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

/**
 * Two lists written into workflows, asserted here to agree with the scripts
 * they run.
 *
 * A workflow cannot import a directory listing or `package.json`, so each list
 * is a second copy of a fact that lives somewhere else — and CLAUDE.md's answer
 * until now was "count the `run:` lines rather than this sentence", which is a
 * reviewer's job with nothing to make a reviewer do it. The DRY guide's rule is
 * that a fact repeated across files that cannot import each other owes a test,
 * and these are those tests.
 *
 * Both compare sets in **both directions**: a script nothing runs is the drift
 * that matters, and a workflow naming a script that no longer exists is the one
 * that fails loudly anyway but reads as somebody else's broken build.
 */

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

test("ci.yml runs every rehearsal script, and names none that does not exist", () => {
  const scripts = readdirSync(new URL("scripts/", root))
    .filter((name) => /^rehearse-[\w-]+\.sh$/.test(name))
    .sort();
  // A listing that finds nothing would make the comparison vacuous.
  assert.ok(scripts.length > 0, "no scripts/rehearse-*.sh found; the search is broken, not the list");

  const run = [
    ...new Set(
      [...read(".github/workflows/ci.yml").matchAll(/\.\/scripts\/(rehearse-[\w-]+\.sh)/g)].map((m) => m[1]),
    ),
  ].sort();

  assert.deepEqual(
    run,
    scripts,
    `ci.yml runs ${JSON.stringify(run)} but scripts/ holds ${JSON.stringify(scripts)}. ` +
      "A rehearsal is coverage only while CI runs it.",
  );
});

test("the monthly curated-data run covers exactly the check-* scripts package.json defines", () => {
  const defined = Object.keys(JSON.parse(read("package.json")).scripts ?? {})
    .filter((name) => name.startsWith("check-"))
    .sort();
  assert.ok(defined.length > 0, "package.json defines no check-* script; the search is broken, not the list");

  const loop = /for c in ([^;\n]+);/.exec(read(".github/workflows/curated-data.yml"))?.[1];
  assert.ok(loop, "curated-data.yml no longer carries a `for c in …;` loop for this test to read");

  const run = loop.trim().split(/\s+/).sort();
  assert.deepEqual(
    run,
    defined,
    `curated-data.yml runs ${JSON.stringify(run)} but package.json defines ${JSON.stringify(defined)}. ` +
      "A checker nobody schedules is a checker that rots with the data it checks.",
  );
});
