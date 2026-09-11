import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { stripComments } from "@/design-tokens-core";

/**
 * **A `*-core.ts` module performs no I/O and reads no clock, environment or
 * entropy** — rules 1 and 2 of `docs/guides/CLEAN_ARCHITECTURE_GUIDE.md`, held
 * by a test rather than by a grep somebody remembers to run.
 *
 * The guide shipped with a grep, and the grep was green over two violations it
 * could not see. `oauth-core.ts` and `session-core.ts` imported `randomBytes`
 * from `node:crypto`, so `newVerifier()` and `mintToken()` returned a different
 * value on every call — the grep asked only about `express`, `node:fs`,
 * `node:sqlite` and `fetch(`. And `scripts/manim/capa-core.ts` read files and
 * drove Chromium under a name that promises neither, outside the root-only glob
 * the grep ran over. A rule written as a list of four things it forbids passes
 * the fifth.
 *
 * So this is an **allowlist**, the other way round: a core module may import
 * `src/types`, other root core modules, and `node:crypto`'s two deterministic
 * functions. Anything else is named as a violation, including a module nobody
 * thought to forbid.
 *
 * `node:crypto` is admitted narrowly and by name. `createHash` and
 * `timingSafeEqual` are functions of their input — a hash is as pure as a sum —
 * while `randomBytes` is the one thing in that module a unit test cannot pin.
 * The entropy arrives as a parameter instead, which is `newAccountId`'s shape in
 * `account-core.ts`. A namespace import is refused outright, because it cannot
 * be read for which functions it reaches.
 *
 * Every `*-core.ts` in the repository is checked, not only the root ones: the
 * suffix is the promise, and a module under `scripts/` making it is making the
 * same one.
 *
 * Comments are stripped first, with the stripper the token gate already uses:
 * these modules explain themselves by naming what they avoid — `rank-candles-core`
 * says its kickoffs are "never from `Date.now()`" — and a gate that flags its
 * own documentation gets switched off.
 */

const REPO = path.resolve(import.meta.dirname, "..");

/** Root-level core modules, by import name — what `@/<name>` may resolve to. */
const rootCoreNames = (): Set<string> =>
  new Set(
    readdirSync(REPO)
      .filter((file) => file.endsWith("-core.ts"))
      .map((file) => file.replace(/\.ts$/, "")),
  );

/** Every `*-core.ts` anywhere, tracked or merely not ignored, so a module not
 *  yet added to the index is checked on the run that would have missed it. */
const coreModules = (): string[] =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "*-core.ts"],
    { cwd: REPO, encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean)
    .filter((file) => existsSync(path.join(REPO, file)));

const DETERMINISTIC_CRYPTO = new Set(["createHash", "timingSafeEqual"]);

const FORBIDDEN: { pattern: RegExp; what: string }[] = [
  { pattern: /\bfetch\s*\(/, what: "fetch() — a network call" },
  { pattern: /\bDate\.now\s*\(/, what: "Date.now() — the clock; take `now` as a parameter" },
  { pattern: /\bnew\s+Date\s*\(\s*\)/, what: "new Date() — the clock; take `now` as a parameter" },
  { pattern: /\bperformance\.now\s*\(/, what: "performance.now() — the clock" },
  { pattern: /\bMath\.random\s*\(/, what: "Math.random() — entropy; take a generator as a parameter" },
  { pattern: /\bcrypto\.(getRandomValues|randomUUID)\b/, what: "crypto entropy; take a generator as a parameter" },
  { pattern: /\bprocess\.[A-Za-z]/, what: "process — the environment" },
  { pattern: /\brequire\s*\(/, what: "require() — a load the import block does not show" },
  { pattern: /\bimport\s*\(/, what: "import() — a load the import block does not show" },
];

/** `import … from "x"`, `export … from "x"`, and a bare `import "x"`. */
const IMPORT = /\b(?:import|export)\s+([^"';]*?)\s*from\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']/g;

const importedNames = (clause: string): string[] | null => {
  const braces = clause.replace(/^type\s+/, "").match(/^\{([^}]*)\}$/);
  if (!braces) return null;
  return braces[1]
    .split(",")
    .map((part) => part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0])
    .filter(Boolean);
};

const importViolation = (clause: string, spec: string, cores: Set<string>): string | null => {
  const bare = spec.replace(/\.ts$/, "");
  if (bare === "@/src/types") return null;
  if (bare.startsWith("@/") && cores.has(bare.slice(2))) return null;

  if (spec === "node:crypto") {
    const names = importedNames(clause);
    if (!names) return `imports node:crypto without naming what it uses (${clause || "side effect"})`;
    const entropy = names.filter((name) => !DETERMINISTIC_CRYPTO.has(name));
    return entropy.length === 0
      ? null
      : `imports ${entropy.join(", ")} from node:crypto — entropy; take a generator as a parameter`;
  }

  return `imports "${spec}"`;
};

/** Every rule `source` breaks, with the line each was found on. */
const violations = (source: string, cores: Set<string>): string[] => {
  const code = stripComments(source);
  const lineOf = (index: number) => code.slice(0, index).split("\n").length;
  const found: string[] = [];

  for (const match of code.matchAll(IMPORT)) {
    const clause = (match[1] ?? "").trim();
    const spec = match[2] ?? match[3];
    const problem = importViolation(clause, spec, cores);
    if (problem) found.push(`${lineOf(match.index)}: ${problem}`);
  }

  code.split("\n").forEach((line, index) => {
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(line)) found.push(`${index + 1}: ${rule.what}`);
    }
  });

  return found;
};

const CORES = new Set(["club-core", "live-core"]);

test("types, other core modules and deterministic crypto are allowed", () => {
  const source = [
    'import type { Match } from "@/src/types";',
    'import { slugify } from "@/club-core";',
    'export { LATE_GRACE_MS } from "@/live-core";',
    'import { createHash, timingSafeEqual as same } from "node:crypto";',
    "export const at = (kickoff: string) => new Date(kickoff);",
  ].join("\n");

  assert.deepEqual(violations(source, CORES), []);
});

test("an import outside the allowlist is named, whatever it is", () => {
  const source = [
    'import { readFileSync } from "node:fs";',
    'import express from "express";',
    'import { CLUBS } from "@/src/data/clubs";',
    'import { nothing } from "@/no-such-core";',
    'import "./side-effect";',
  ].join("\n");

  assert.deepEqual(violations(source, CORES), [
    '1: imports "node:fs"',
    '2: imports "express"',
    '3: imports "@/src/data/clubs"',
    '4: imports "@/no-such-core"',
    '5: imports "./side-effect"',
  ]);
});

test("entropy from node:crypto is refused, and so is a namespace import", () => {
  assert.deepEqual(violations('import { createHash, randomBytes } from "node:crypto";', CORES), [
    "1: imports randomBytes from node:crypto — entropy; take a generator as a parameter",
  ]);
  assert.equal(violations('import * as crypto from "node:crypto";', CORES).length, 1);
});

test("the clock, the environment and the network are refused in code", () => {
  const source = [
    "const a = Date.now();",
    "const b = new Date();",
    "const c = process.env.TOKEN;",
    "const d = Math.random();",
    "const e = await fetch(url);",
    "const f = await import(name);",
  ].join("\n");

  assert.deepEqual(
    violations(source, CORES).map((finding) => finding.split(":")[0]),
    ["1", "2", "3", "4", "5", "6"],
  );
});

test("a comment naming a forbidden call is prose, not a violation", () => {
  const source = [
    "/** Kickoffs, never `Date.now()`, and no `fetch(` either. */",
    '// import { readFileSync } from "node:fs";',
    "export const x = 1;",
  ].join("\n");

  assert.deepEqual(violations(source, CORES), []);
});

// The false negative a regex comment stripper produces: `//` inside a URL taken
// for a comment blanks the rest of the line, hiding the call after it.
test("a URL in a string does not hide a call later on the same line", () => {
  assert.equal(violations('const u = "https://x"; const t = Date.now();', CORES).length, 1);
});

test("every *-core.ts in the repository performs no I/O and reads no clock, environment or entropy", () => {
  const modules = coreModules();
  // A sweep over nothing is green. `git ls-files` failing quietly, or a pattern
  // that stopped matching, must not read as a clean repository.
  assert.ok(modules.includes("standings-core.ts"), `the sweep did not see standings-core.ts: ${modules}`);
  assert.ok(modules.includes("session-core.ts"), `the sweep did not see session-core.ts: ${modules}`);

  const cores = rootCoreNames();
  const found = modules.flatMap((file) =>
    violations(readFileSync(path.join(REPO, file), "utf8"), cores).map((v) => `${file}:${v}`),
  );

  assert.deepEqual(found, [], `core modules breaking the inner-layer rules:\n${found.join("\n")}`);
});
