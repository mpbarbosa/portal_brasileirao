import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { stripComments } from "@/design-tokens-core";

/**
 * `expect.poll` may wait for a value to **arrive or change**, never assert that
 * one never arrives.
 *
 * Polling returns the moment its matcher is satisfied, so a poll whose matcher
 * is already satisfied by *nothing having happened yet* returns on the **first**
 * read. It therefore asserts *"I read before anything arrived"*, which is a fact
 * about how busy the machine is rather than about the app: it cannot fail when
 * the write it is racing is slow, and cannot pass when the write is fast.
 *
 * `contas-preferencias.spec.ts` ended a test with `expect.poll(…).toBeNull()`
 * and it was green in CI, red in a full local run, and green in isolation on
 * both, from the day it was written until it was found — the worst available
 * signal, because a full local `test:e2e` stops being usable as a pre-merge
 * check while the failure is nobody's fault. Measured with a probe: the first
 * read answered `null`, and the write it was racing landed 94 ms later.
 *
 * To assert that nothing arrives, **remove the writer instead of out-running
 * it** — that test now asks from a `browser.newContext()` holding no device
 * copy to seed the account from, where `null` is a settled end state — then
 * reads once and asserts no write was issued.
 *
 * A grep rather than a lint rule, for the reason `e2e-fixture.test.ts` and
 * `design-tokens-core.test.ts` both give: this repo has no ESLint by choice.
 * `stripComments` is imported rather than rewritten so a spec may go on
 * *describing* this trap in prose — the comment in `contas-preferencias.spec.ts`
 * quotes the offending line verbatim, and a grep of the raw text flags its own
 * documentation, which is how a gate comes to be switched off.
 */
const E2E = path.join(import.meta.dirname, "e2e");

/**
 * Matchers an unstarted read already satisfies.
 *
 * **Not every `.not`**, and that carve-out is the one to understand before
 * broadening this. `.not` inverts, so it moves a matcher *out* of this set as
 * often as into it: `.not.toBeNull()` waits for a value to appear and is sound,
 * and `.not.toBe(before)` — `touch-targets.spec.ts` waiting for the theme
 * attribute to flip — is the wait-for-change idiom, which cannot be satisfied
 * by the initial state by construction. A blanket `.not` rule was written
 * first and flagged exactly that spec. The case below holds this open.
 */
const ABSENCE = [
  /^toBeNull\b/,
  /^toBeUndefined\b/,
  /^toBeFalsy\b/,
  /^toBeNaN\b/,
  /^not\s*\.\s*toBeTruthy\b/,
  /^not\s*\.\s*toBeDefined\b/,
  /^toHaveLength\s*\(\s*0\s*\)/,
  /^toEqual\s*\(\s*\[\s*\]\s*\)/,
];

/**
 * What each `expect.poll(...)` in `source` is settled by.
 *
 * Walks the balanced parentheses of the poll's own argument rather than
 * regexing to the next `)`, because that argument is a callback which routinely
 * contains parentheses of its own — `() => me(page).then(…)` is the shape in the
 * file this was written for — and an options object may follow it.
 */
export const pollMatchers = (source: string): string[] => {
  const found: string[] = [];

  for (const match of stripComments(source).matchAll(/expect\s*\.\s*poll\s*(?=\()/g)) {
    let i = source.indexOf("(", match.index);
    if (i === -1) continue;

    let depth = 0;
    for (; i < source.length; i += 1) {
      if (source[i] === "(") depth += 1;
      else if (source[i] === ")") {
        depth -= 1;
        if (depth === 0) {
          found.push(source.slice(i + 1, i + 80).replace(/^[\s.]+/, ""));
          break;
        }
      }
    }
  }
  return found;
};

const offendersIn = (source: string): string[] =>
  pollMatchers(source).filter((matcher) => ABSENCE.some((rule) => rule.test(matcher)));

test("no end-to-end spec polls for an absence", () => {
  const offenders: string[] = [];

  for (const name of readdirSync(E2E)) {
    if (!name.endsWith(".spec.ts")) continue;
    for (const matcher of offendersIn(readFileSync(path.join(E2E, name), "utf8"))) {
      offenders.push(`${name}: expect.poll(…).${matcher.slice(0, 40)}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "these polls are satisfied by their first read, so they assert that the test won a " +
      `race rather than anything about the app: ${offenders.join("; ")}. Remove the ` +
      "writer and read once, rather than polling for nothing to arrive.",
  );
});

test("the rule catches the shape it was written for, and leaves waiting alone", () => {
  // Confirmed by mutation rather than assumed: the first of these is the line
  // this gate was extracted from, verbatim.
  assert.equal(
    offendersIn("await expect.poll(() => me(page).then((it) => it?.p.club ?? null)).toBeNull();")
      .length,
    1,
  );

  // And the three sound idioms, which a broader rule would refuse. The last is
  // `touch-targets.spec.ts`: `.not` reverses, so it moves a matcher out of the
  // set as often as into it, and a blanket `.not` rule flagged that spec.
  for (const sound of [
    "await expect.poll(() => me(page).then((it) => it?.p.club)).toBeTruthy();",
    "await expect.poll(() => asked.length).toBeGreaterThan(0);",
    'await expect.poll(() => page.getAttribute("html", "data-theme")).not.toBe(before);',
  ]) {
    assert.deepEqual(offendersIn(sound), [], sound);
  }
});
