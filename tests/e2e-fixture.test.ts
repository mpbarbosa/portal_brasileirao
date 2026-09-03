import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

/**
 * Every end-to-end spec must take its `test` from the suite's own fixtures.
 *
 * **The fixture is where the suite is made hermetic**, and a spec that imports
 * `test` from `@playwright/test` silently opts out of that — its pages go to
 * `crests.football-data.org` for twenty images and it fails as
 * `net::ERR_ABORTED` on a navigation, which reads as a broken app rather than
 * as a missing import. Three specs were in exactly that state before this
 * landed, each for its own good reason and none of them wrong at the time,
 * because there was nothing in the fixture to miss.
 *
 * A grep rather than a lint rule, for the reason `design-tokens-core.test.ts`
 * gives about the six utility patterns it polices: this repo has no ESLint by
 * choice, and acquiring one to enforce a single import path costs a dependency,
 * a config and a plugin API against a rule that fits on one line.
 */
const E2E = path.join(import.meta.dirname, "e2e");

test("no end-to-end spec imports `test` from @playwright/test", () => {
  const offenders: string[] = [];

  for (const name of readdirSync(E2E)) {
    if (!name.endsWith(".spec.ts")) continue;
    const source = readFileSync(path.join(E2E, name), "utf8");
    // Only the `test` binding matters. A spec may legitimately want a *type*
    // from the package, and types carry no fixture.
    for (const match of source.matchAll(/^import\s*\{([^}]*)\}\s*from\s*"@playwright\/test";/gm)) {
      const names = (match[1] ?? "").split(",").map((entry) => entry.trim());
      if (names.some((entry) => entry === "test" || entry.startsWith("test as"))) {
        offenders.push(name);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `these specs bypass the suite's fixtures and will reach the crest CDN: ${offenders.join(", ")}. ` +
      `Import from "@/tests/e2e/fixtures" (or "@/tests/e2e/clock" if you also need the frozen clock).`,
  );
});

test("the fixtures module is the only place that may import it", () => {
  // Named so the exception is deliberate rather than an oversight the grep
  // above happens not to cover.
  const source = readFileSync(path.join(E2E, "fixtures.ts"), "utf8");
  assert.match(source, /from "@playwright\/test"/);
});
