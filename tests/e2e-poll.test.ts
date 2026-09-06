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
/**
 * **What this gate does NOT catch, stated so nobody reads green as proof.**
 *
 * The matchers below are literal, so a poll that reaches null through an
 * *expression* is invisible to it. `contas-preferencias.spec.ts`'s `choose`
 * helper is exactly that shape —
 * `.toBe(landing === "classificacao" ? null : landing)` — and it polls for null
 * on one of its call sites. It happens to be sound there (the preceding
 * `choose(page, "jogos")` leaves the value non-null, deliberately sequenced),
 * but soundness is not why it passes: it passes because no rule here can see a
 * conditional.
 *
 * That bound is real and is not a reason to widen the matcher list into
 * expression-matching, which would flag every `.toBe(x)` in the suite. What
 * separates a sound poll from a race is the value's state when polling begins,
 * and no static rule can read that — which is why the carve-out below asks the
 * spec to *declare* it rather than trying to infer it.
 *
 * The honest claim for this file is therefore narrow: it refuses the literal
 * shape that shipped the bug, and forces a declared precondition wherever it
 * fires. A runtime helper — one that asserts the polled value does not already
 * satisfy the matcher before it starts — would catch every form, and would need
 * a rule like this one to make anybody use it.
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
interface Poll {
  /** The polled callback's own source, whitespace-collapsed, as the join key. */
  read: string;
  matcher: string;
}

const collapse = (source: string): string => source.replace(/\s+/g, " ").trim();

export const polls = (source: string): Poll[] => {
  const found: Poll[] = [];

  for (const match of stripComments(source).matchAll(/expect\s*\.\s*poll\s*(?=\()/g)) {
    const open = source.indexOf("(", match.index);
    if (open === -1) continue;

    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "(") depth += 1;
      else if (source[i] === ")") {
        depth -= 1;
        if (depth === 0) {
          found.push({
            read: collapse(source.slice(open + 1, i)),
            matcher: source.slice(i + 1, i + 80).replace(/^[\s.]+/, ""),
          });
          break;
        }
      }
    }
  }
  return found;
};

export const pollMatchers = (source: string): string[] => polls(source).map((p) => p.matcher);

const isAbsence = (matcher: string): boolean => ABSENCE.some((rule) => rule.test(matcher));

/**
 * **A poll for a REMOVAL is sound, and this is what tells one from a race.**
 *
 * The rule above is that an absence poll returns on its first read, so it
 * asserts the test out-ran a writer. That is true only where the value might
 * never have been there. Polling for a value the test has already *proved
 * present* cannot be satisfied by nothing having happened yet — the first read
 * answers the old value, and the poll genuinely waits for the removal. It is
 * the wait-for-change idiom `.not.toBe(before)` already occupies, one matcher
 * over.
 *
 * A grep cannot know a value was present, so this does not guess: it requires
 * the spec to have **asserted** it, earlier in the file, by polling the *same
 * read* for presence. That is deliberately a structural precondition rather
 * than an exemption list naming call sites — `CLAUDE.md` records that an
 * exemption list is how a gate comes to be switched off, and a list cannot
 * tell whether the thing it excuses is still sound. This can: delete the
 * presence assertion and the absence poll below it goes red again.
 */
const offendersIn = (source: string): string[] => {
  const all = polls(source);
  return all
    .filter((poll, i) => {
      if (!isAbsence(poll.matcher)) return false;
      const proved = all
        .slice(0, i)
        .some((earlier) => earlier.read === poll.read && !isAbsence(earlier.matcher));
      return !proved;
    })
    .map((poll) => poll.matcher);
};

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

test("the conditional form is a KNOWN blind spot, pinned so it cannot surprise", () => {
  // Not an aspiration — an assertion about today's behaviour, so that anybody
  // widening the matcher list sees this go red and reads the note above rather
  // than discovering the bound by shipping a false negative.
  assert.deepEqual(
    offendersIn('await expect.poll(() => me(page)).toBe(x === "c" ? null : x);'),
    [],
    "a poll reaching null through an expression is invisible here, by design",
  );
});

test("a removal is allowed only where the same read was proved present first", () => {
  const read = "() => page.evaluate(() => localStorage.getItem(KEY))";

  // Alone, it is the race the gate exists for.
  assert.equal(offendersIn(`await expect.poll(${read}).toBeNull();`).length, 1);

  // Preceded by a presence assertion of the SAME read, it is a removal.
  assert.deepEqual(
    offendersIn(
      `await expect.poll(${read}).not.toBeNull();\n` + `await expect.poll(${read}).toBeNull();`,
    ),
    [],
  );

  // A presence assertion of a DIFFERENT read excuses nothing — otherwise any
  // spec that happens to wait for something earlier would licence every
  // absence poll below it, which is the exemption list in another costume.
  assert.equal(
    offendersIn(
      "await expect.poll(() => me(page).then((it) => it?.p.club)).not.toBeNull();\n" +
        `await expect.poll(${read}).toBeNull();`,
    ).length,
    1,
  );

  // Order matters: proving presence *after* the fact proves nothing.
  assert.equal(
    offendersIn(
      `await expect.poll(${read}).toBeNull();\n` + `await expect.poll(${read}).not.toBeNull();`,
    ).length,
    1,
  );
});
