import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * One Node major, named in five places, asserted here to be the same number.
 *
 * This asserts *configuration* rather than code, for the reason
 * `tests/player-photos.test.ts` asserts data: nothing else can catch it. Four
 * of the five files below are read by a different tool — npm, `actions/setup-node`,
 * `tsc`, a provisioning script on a host — so no compiler sees more than one of
 * them, and a disagreement is not a broken build. It is a **quieter** gate.
 *
 * `tsconfig.json` sets `types: ["node"]`, which makes `@types/node` the entire
 * ambient type surface, and `tsc --noEmit` is this repo's only lint gate. So the
 * typings decide what the gate certifies and the runtime decides what actually
 * runs, and when those two are different majors the gate certifies code the host
 * cannot execute. #91 bumped the typings 22 -> 26 and went green; afterwards
 * `import { connect } from "node:quic"` type-checked clean while
 * `node -e "require('node:quic')"` threw ERR_UNKNOWN_BUILTIN_MODULE.
 *
 * The fix for that incident was to change the numbers. The fix for the *class*
 * is this file: changing one of them now goes red until all five move together.
 */

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

/** The major in `.nvmrc`, which every other number here is compared against. */
const EXPECTED = Number(read(".nvmrc").trim());

test(".nvmrc names a plausible Node major", () => {
  assert.ok(
    Number.isInteger(EXPECTED) && EXPECTED >= 20,
    `.nvmrc should hold a Node major such as "22", found ${JSON.stringify(read(".nvmrc"))}`,
  );
});

test("package.json's engines names the .nvmrc major", () => {
  const pkg = JSON.parse(read("package.json"));
  const engines = pkg.engines?.node;
  assert.ok(engines, "package.json has no engines.node; the host installs with `npm ci --omit=dev` and should be told");

  const major = Number(/^(\d+)/.exec(engines)?.[1]);
  assert.equal(
    major,
    EXPECTED,
    `engines.node is "${engines}" but .nvmrc says ${EXPECTED}`,
  );
});

test("@types/node is pinned to the major the runtime actually is", () => {
  const pkg = JSON.parse(read("package.json"));
  const range = pkg.devDependencies?.["@types/node"];
  assert.ok(range, "@types/node is missing; tsconfig's types: [\"node\"] makes it the whole ambient surface");

  const major = Number(/(\d+)/.exec(range)?.[1]);
  assert.equal(
    major,
    EXPECTED,
    `@types/node is "${range}" but the runtime is Node ${EXPECTED}. ` +
      "Typings ahead of the runtime make `tsc --noEmit` certify APIs the host does not have. " +
      "If the runtime is genuinely moving, move .nvmrc first.",
  );
});

test("the host floor is the .nvmrc major, exactly", () => {
  const script = read("shell_scripts/01_setup_app_directory.sh");
  const declared = /^REQUIRED_NODE_MAJOR=(\d+)$/m.exec(script)?.[1];
  assert.ok(declared, "shell_scripts/01_setup_app_directory.sh no longer declares REQUIRED_NODE_MAJOR");
  assert.equal(
    Number(declared),
    EXPECTED,
    `the host provisioning script requires Node ${declared} but .nvmrc says ${EXPECTED}`,
  );
});

/**
 * The workflows are checked for the *absence* of a literal rather than for a
 * value. `node-version: "22"` and `.nvmrc` agreeing today is not the property
 * worth having — the property is that there is only one number to change, which
 * is what `node-version-file` buys. A literal reintroduced here would pass any
 * equality check on the day it was written and drift on some later one.
 */
for (const workflow of [".github/workflows/ci.yml", ".github/workflows/sync-broadcasts.yml"]) {
  test(`${workflow} takes its Node version from .nvmrc, not a literal`, () => {
    const yaml = read(workflow);

    assert.ok(
      yaml.includes("node-version-file: .nvmrc"),
      `${workflow} does not set node-version-file: .nvmrc`,
    );
    assert.equal(
      /^\s*node-version:/m.test(yaml),
      false,
      `${workflow} still pins node-version inline; .nvmrc is the one place that names the major`,
    );
    assert.equal(
      /NODE_VERSION/.test(yaml),
      false,
      `${workflow} still carries a NODE_VERSION literal`,
    );
  });
}
