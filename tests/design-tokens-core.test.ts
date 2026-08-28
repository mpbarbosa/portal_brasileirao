import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { DEFINITION_SITES, RULES, rulesFor, scan, stripComments } from "@/design-tokens-core";

const fire = (source: string): string[] => scan(source).map((f) => f.rule);

// ------------------------------------------------------------ the scanner

test("a palette shade is caught on any colour property", () => {
  assert.deepEqual(fire('<p className="text-slate-400" />'), ["palette-shade"]);
  assert.deepEqual(fire('<p className="bg-emerald-500" />'), ["palette-shade"]);
  assert.deepEqual(fire('<p className="decoration-rose-300" />'), ["palette-shade"]);
});

test("the app's own tokens are not palette shades", () => {
  assert.deepEqual(fire('<p className="text-ink-muted bg-surface-container-low" />'), []);
  assert.deepEqual(fire('<p className="text-positive-ink border-line-strong" />'), []);
});

test("Tailwind's radii are caught and MD3's are not", () => {
  assert.deepEqual(fire('"rounded-lg"'), ["tailwind-radius"]);
  assert.deepEqual(fire('"rounded"'), ["tailwind-radius"]);
  assert.deepEqual(fire('"sm:rounded-2xl"'), ["tailwind-radius"]);
  assert.deepEqual(fire('"rounded-small rounded-x-large rounded-full"'), []);
});

test("bare type steps are caught and the MD3 scale is not", () => {
  assert.deepEqual(fire('"text-sm"'), ["bare-type-step"]);
  assert.deepEqual(fire('"md:text-2xl"'), ["bare-type-step"]);
  assert.deepEqual(fire('"text-body-small text-display-large"'), []);
});

test("text-sm is not found inside text-small", () => {
  // The rule is a substring away from a false positive, and the MD3 scale is
  // full of names that begin with a step's letters.
  assert.deepEqual(fire('"text-smallcaps"'), []);
});

test("letter spacing is caught, because the type step already carries it", () => {
  assert.deepEqual(fire('"tracking-tight"'), ["tracking-utility"]);
});

test("a motion utility is caught even though it compiles to nothing", () => {
  // The reason this rule exists: there is no `--duration-*` utility namespace in
  // Tailwind v4, so this class is silently inert rather than wrong.
  assert.deepEqual(fire('"transition duration-short-4"'), ["motion-utility"]);
  assert.deepEqual(fire('"ease-emphasized-decelerate"'), ["motion-utility"]);
  assert.deepEqual(fire('"transition"'), []);
});

test("Tailwind's shadows are caught and the elevation scale is not", () => {
  assert.deepEqual(fire('"shadow-xl"'), ["tailwind-shadow"]);
  assert.deepEqual(fire('"shadow"'), ["tailwind-shadow"]);
  assert.deepEqual(fire('"shadow-inner"'), ["tailwind-shadow"]);
  assert.deepEqual(fire('"shadow-level-0 shadow-level-3 shadow-level-5"'), []);
});

test("a hand-written state colour is caught", () => {
  assert.deepEqual(fire('"hover:bg-surface-container"'), ["hand-written-state"]);
  assert.deepEqual(fire('"focus-visible:outline-primary"'), ["hand-written-state"]);
});

test("one line violating two rules reports both", () => {
  assert.deepEqual(fire('"rounded-lg text-sm"'), ["tailwind-radius", "bare-type-step"]);
});

test("a finding names the line it is on", () => {
  const [finding] = scan('const a = 1;\nconst b = "text-sm";\n');
  assert.equal(finding.line, 2);
  assert.equal(finding.rule, "bare-type-step");
});

// ------------------------------------------------------- comment stripping

test("prose that quotes a forbidden utility is not a violation", () => {
  // Half the value of these files is comments explaining what a rule forbids.
  // `Button.tsx` quotes the very utility M2 replaced. A gate that flagged its
  // own documentation would be switched off within a week.
  assert.deepEqual(fire("// Before M2 this was a bare `hover:bg-raised`.\n"), []);
  assert.deepEqual(fire("/* rounded-lg is 8px in Tailwind. */\n"), []);
  assert.deepEqual(fire("{/* the old text-sm heading */}\n"), []);
});

test("a comment does not shift the line numbers beneath it", () => {
  const [finding] = scan("/* one\n   two */\nconst a = \"text-sm\";\n");
  assert.equal(finding.line, 3);
});

test("a URL inside a string does not start a comment", () => {
  // The failure this guards against is a false *negative*: treating `//` in
  // `https://` as a comment blanks the rest of a real line, and the rule then
  // reports nothing at all.
  assert.deepEqual(fire('const u = "https://example.com"; const c = "text-sm";'), [
    "bare-type-step",
  ]);
});

test("an escaped quote does not end the string", () => {
  assert.deepEqual(fire('const s = "a \\" b"; // text-sm\n'), []);
});

test("stripComments leaves code untouched", () => {
  assert.equal(stripComments('const a = "x";'), 'const a = "x";');
});

// -------------------------------------------------------------- the sweep

const REPO_ROOT = new URL("../", import.meta.url).pathname;
const SOURCE_ROOT = join(REPO_ROOT, "src");

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

test("no component reaches past the design system", () => {
  const violations = sourceFiles(SOURCE_ROOT).flatMap((path) => {
    const relative = path.slice(REPO_ROOT.length);
    return scan(readFileSync(path, "utf8"), rulesFor(relative)).map(
      (f) => `${relative}:${f.line}  [${f.rule}] ${f.text}\n      ${f.guidance}`,
    );
  });

  assert.deepEqual(violations, [], `\n${violations.join("\n")}\n`);
});

test("the sweep actually reads files", () => {
  // A gate that silently walks an empty tree reports a clean codebase. This is
  // the same failure as a probe that reverts its own subject: green, and
  // meaningless. Assert the sweep has a corpus before believing its verdict.
  assert.ok(sourceFiles(SOURCE_ROOT).length > 20);
});

test("the state-layer rule does not apply to the module that defines it", () => {
  // A scope, not an exemption: interaction.ts is where a hover colour is
  // *supposed* to be written, so it cannot break the rule any more than
  // index.css can break the rule against raw colours.
  const source = '"hover:bg-on-surface/8"';
  assert.deepEqual(scan(source).map((f) => f.rule), ["hand-written-state"]);
  assert.deepEqual(scan(source, rulesFor("src/components/interaction.ts")), []);
});

test("every definition site names a file that exists", () => {
  // The list is short and load-bearing; a stale path silently re-enables a rule
  // on a file that legitimately breaks it, or keeps it disabled on one that has
  // been deleted.
  for (const [id, path] of Object.entries(DEFINITION_SITES)) {
    assert.ok(RULES.some((r) => r.id === id), `${id} is not a rule`);
    readFileSync(join(REPO_ROOT, path), "utf8");
  }
});

test("every rule has a distinct id and guidance", () => {
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length);
  for (const rule of RULES) assert.ok(rule.guidance.length > 0, rule.id);
});
