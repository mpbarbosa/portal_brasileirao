import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { stripComments } from "@/design-tokens-core";

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

const specs = (): string[] => readdirSync(E2E).filter((name) => name.endsWith(".spec.ts"));

/** Whether `source` binds `test` (not merely a type) from `specifier`. */
export const importsTest = (source: string, specifier: string): boolean => {
  const quoted = specifier.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  for (const match of source.matchAll(new RegExp(`^import\\s*\\{([^}]*)\\}\\s*from\\s*"${quoted}";`, "gm"))) {
    const names = (match[1] ?? "").split(",").map((entry) => entry.trim());
    if (names.some((entry) => entry === "test" || entry.startsWith("test as"))) return true;
  }
  return false;
};

test("no end-to-end spec imports `test` from @playwright/test", () => {
  const offenders = specs().filter((name) =>
    importsTest(readFileSync(path.join(E2E, name), "utf8"), "@playwright/test"),
  );

  assert.deepEqual(
    offenders,
    [],
    `these specs bypass the suite's fixtures and will reach the crest CDN: ${offenders.join(", ")}. ` +
      `Import from "@/tests/e2e/clock", which builds on "@/tests/e2e/fixtures".`,
  );
});

test("the fixtures module is the only place that may import it", () => {
  // Named so the exception is deliberate rather than an oversight the grep
  // above happens not to cover.
  const source = readFileSync(path.join(E2E, "fixtures.ts"), "utf8");
  assert.match(source, /from "@playwright\/test"/);
});

/**
 * Whether a spec skips the frozen clock without bringing one of its own.
 *
 * `clock.ts` builds on `fixtures.ts`, so taking `test` from either gets the
 * network stubs — but only `clock.ts` fixes the page's clock at the snapshot's
 * date. A spec importing from `fixtures.ts` therefore runs at *today* against
 * data from another day, which is the drift `clock.ts` exists to close, and
 * nothing said so: `goals`, `painel` and `trafego` were in that state with no
 * reason written anywhere.
 *
 * The one sound case is a spec that installs a clock itself —
 * `partida-refetch.spec.ts`, which has to move time past a poll. So the rule is
 * structural rather than a list of names, for `e2e-poll.test.ts`' reason: a list
 * cannot tell whether what it excuses is still sound, and this can. Comments
 * are stripped first, so a spec that only *mentions* `page.clock.install(` in
 * prose does not qualify.
 */
export const skipsFrozenClock = (source: string): boolean =>
  importsTest(source, "@/tests/e2e/fixtures") &&
  !/\bclock\s*\.\s*install\s*\(/.test(stripComments(source));

test("a spec that takes `test` from the fixtures module installs its own clock", () => {
  const offenders = specs().filter((name) =>
    skipsFrozenClock(readFileSync(path.join(E2E, name), "utf8")),
  );

  assert.deepEqual(
    offenders,
    [],
    `these specs take \`test\` from "@/tests/e2e/fixtures" and never install a clock, so they run ` +
      `at the wall clock against a frozen snapshot: ${offenders.join(", ")}. Import from "@/tests/e2e/clock".`,
  );
});

test("the clock rule fires on the shape it names, and not on its exception", () => {
  // Pinned so a regex that stops matching cannot turn the rule above into one
  // that passes against anything.
  const fromFixtures = 'import { expect, test, type Page } from "@/tests/e2e/fixtures";\n';
  assert.equal(skipsFrozenClock(`${fromFixtures}test("x", async () => {});`), true);
  assert.equal(
    skipsFrozenClock(`${fromFixtures}// page.clock.install() is mentioned, not called\ntest("x", async () => {});`),
    true,
  );
  assert.equal(
    skipsFrozenClock(`${fromFixtures}test("x", async ({ page }) => { await page.clock.install({ time: 0 }); });`),
    false,
  );
  assert.equal(
    skipsFrozenClock('import { expect, test } from "@/tests/e2e/clock";\ntest("x", async () => {});'),
    false,
  );
  // A type-only import carries no fixture, so it is not the shape either.
  assert.equal(skipsFrozenClock('import { type Page } from "@/tests/e2e/fixtures";\n'), false);
});
