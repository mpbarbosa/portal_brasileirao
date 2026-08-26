import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, appendFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

/**
 * `scripts/check-screenshots.sh` decides whether the README's images still
 * depict the app. Shellcheck is the only other thing that reads it, and
 * shellcheck cannot tell a correct verdict from a wrong one.
 *
 * This matters more than the usual "a script should have a test", because both
 * of this gate's failure modes are silent in the direction that removes it. It
 * is advisory in CI — nothing is blocked by red — so a rule that starts passing
 * everything looks exactly like a repository whose screenshots are current, and
 * the check it replaces went permanently red for a correct change, which trains
 * people to stop reading it. Neither shows up as a broken build.
 *
 * So these build real git histories in a temp directory and run the real
 * script. There is no seam to mock: the whole thing is a set of questions put
 * to git, and a fake git would be the part under test.
 */

const REPO = path.resolve(import.meta.dirname, "..");
const SCRIPT = "scripts/check-screenshots.sh";

/** One throwaway repository, with a helper per thing a commit can be. */
class Sandbox {
  readonly dir: string;

  constructor() {
    this.dir = mkdtempSync(path.join(tmpdir(), "shots-gate-"));

    this.git("init", "-q", "-b", "main");
    this.git("config", "user.email", "test@example.invalid");
    this.git("config", "user.name", "Test");

    for (const sub of ["src/components", "docs/screenshots", "scripts"]) {
      mkdirSync(path.join(this.dir, sub), { recursive: true });
    }
    for (const file of [SCRIPT, "scripts/appearance-paths.txt"]) {
      copyFileSync(path.join(REPO, file), path.join(this.dir, file));
    }

    // One file per appearance path, so any of them can be moved independently.
    this.write("src/index.css", "css\n");
    this.write("src/App.tsx", "app\n");
    this.write("index.html", "html\n");
    this.write("src/components/Table.tsx", "table\n");
    this.commit("Seed the tree");
  }

  git(...args: string[]): string {
    return execFileSync("git", args, { cwd: this.dir, encoding: "utf8" }).trim();
  }

  write(file: string, body: string): void {
    const target = path.join(this.dir, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, body);
  }

  /** Move an appearance path without caring what the change is. */
  touch(file: string): void {
    appendFileSync(path.join(this.dir, file), "more\n");
  }

  commit(message: string): string {
    this.git("add", "-A");
    this.git("commit", "-q", "-m", message);
    return this.git("rev-parse", "HEAD");
  }

  /** A commit to docs/screenshots — what the gate measures staleness against. */
  shoot(message = "Refresh the screenshots"): string {
    this.write("docs/screenshots/classificacao-light.png", `png ${this.git("rev-parse", "HEAD")}\n`);
    return this.commit(message);
  }

  run(): { ok: boolean; out: string } {
    try {
      return { ok: true, out: execFileSync(`./${SCRIPT}`, { cwd: this.dir, encoding: "utf8" }) };
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string };
      return { ok: false, out: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
    }
  }

  dispose(): void {
    rmSync(this.dir, { recursive: true, force: true });
  }
}

const withSandbox = (body: (repo: Sandbox) => void): void => {
  const repo = new Sandbox();
  try {
    body(repo);
  } finally {
    repo.dispose();
  }
};

test("screenshots taken after the last appearance change are current", () => {
  withSandbox((repo) => {
    repo.touch("src/index.css");
    repo.commit("Restyle the table");
    repo.shoot();

    const { ok, out } = repo.run();

    assert.equal(ok, true);
    assert.match(out, /Screenshots are current/);
  });
});

test("an appearance change after the last capture is reported, and named", () => {
  withSandbox((repo) => {
    repo.shoot();
    repo.touch("src/components/Table.tsx");
    repo.commit("Widen the position column");

    const { ok, out } = repo.run();

    assert.equal(ok, false);
    assert.match(out, /Widen the position column/);
  });
});

test("data changes are not appearance changes", () => {
  withSandbox((repo) => {
    repo.shoot();
    repo.write("src/data/matches.ts", "export const MATCHES = [];\n");
    repo.commit("Sync the seed fixtures");

    assert.equal(repo.run().ok, true);
  });
});

test("an appearance change that is undone again leaves the images depicting HEAD", () => {
  // The ancestry test this replaced said no: the newest commit touching an
  // appearance path is the revert, which is not an ancestor of the capture. But
  // the sources the images were shot against are the ones HEAD ships, which is
  // the question that was being approximated. Nothing can be refreshed to clear
  // an ancestry verdict here, because there is nothing left to photograph.
  withSandbox((repo) => {
    repo.shoot();
    repo.touch("src/index.css");
    const tried = repo.commit("Try a different green");
    repo.git("revert", "--no-edit", tried);

    const { ok, out } = repo.run();

    assert.equal(ok, true);
    assert.match(out, /the appearance has not changed since/);
  });
});

test("a commit may declare that its appearance edit moves no pixel", () => {
  withSandbox((repo) => {
    repo.shoot();
    repo.touch("src/index.css");
    repo.commit(
      "Suppress transitions for one frame\n\n" +
        "Screenshots-unaffected: the class is added and removed inside one\n" +
        "  synchronous block, so no capturable paint sees it.",
    );

    const { ok, out } = repo.run();

    assert.equal(ok, true);
    // The reason is printed on a green run, or it is a claim nobody reviews.
    assert.match(out, /Declared not to move a pixel/);
    assert.match(out, /synchronous block, so no capturable paint sees it/);
    // Unfolded onto one line rather than reproduced with its wrapping.
    assert.doesNotMatch(out, /one\n {2}synchronous/);
  });
});

test("a later commit may declare it for an earlier one, by sha", () => {
  // The retroactive form is not a convenience. The case this exists for is only
  // visible after the commit is on main and can no longer be amended: a capture
  // was attempted, the tool accepted it, and the bytes came out identical.
  withSandbox((repo) => {
    repo.shoot();
    repo.touch("src/index.css");
    const swap = repo.git("rev-parse", "--short", repo.commit("Suppress transitions for one frame"));

    repo.write("NOTES.md", "note\n");
    repo.commit(`Explain the suppression\n\nScreenshots-unaffected: ${swap}: never in effect during a paint.`);

    const { ok, out } = repo.run();

    assert.equal(ok, true);
    assert.match(out, /Suppress transitions for one frame/);
    assert.match(out, /claimed by \w+ Explain the suppression/);
  });
});

test("a declared commit does not excuse an undeclared one beside it", () => {
  withSandbox((repo) => {
    repo.shoot();
    repo.touch("src/index.css");
    repo.commit("Suppress transitions\n\nScreenshots-unaffected: never in effect during a paint.");
    repo.touch("src/components/Table.tsx");
    repo.commit("Widen the position column");

    const { ok, out } = repo.run();

    assert.equal(ok, false);
    assert.match(out, /Widen the position column/);
    // Still printed, so the reader can see which half of the range was claimed.
    assert.match(out, /Declared not to move a pixel/);
  });
});

test("a trailer with no reason is refused, and says so", () => {
  // git reports a bare `Screenshots-unaffected:` and a commit carrying no
  // trailer at all as the same empty value. Reading only the values made the
  // rubber stamp indistinguishable from silence — and silently ineffective,
  // which is the worst of both: it does not work and it does not say why.
  withSandbox((repo) => {
    repo.shoot();
    repo.touch("src/index.css");
    repo.commit("Restyle the table\n\nScreenshots-unaffected:");

    const { ok, out } = repo.run();

    assert.equal(ok, false);
    assert.match(out, /with no reason/);
  });
});

test("a merge that only catches a branch up is not an appearance change", () => {
  // `git log -- <paths>` lists a merge that differs from *a* parent, so a branch
  // merged while behind is reported as changing the appearance although it
  // changes nothing on the first-parent line.
  //
  // This is the shape of c38e722, which the ancestry test named as a
  // stale-making commit whose appearance tree is byte-identical to the
  // capture's. Reproducing it needs the capture to sit on its own branch that
  // forked *before* that merge — which is the ordinary state of this repository,
  // where several sessions ship in parallel — because that is what puts a
  // sibling merge inside `last_shot..HEAD` at all. A capture committed straight
  // onto main never sees it, which is why the first attempt at this test passed
  // with the rule deleted.
  withSandbox((repo) => {
    const base = repo.git("rev-parse", "HEAD");
    repo.touch("src/components/Table.tsx");
    const styled = repo.commit("Change the table");

    repo.git("checkout", "-q", "-b", "docs-only", base);
    repo.write("CONTEXT.md", "glossary\n");
    repo.commit("Document a term");

    repo.git("checkout", "-q", "main");
    repo.git("merge", "-q", "--no-ff", "docs-only", "-m", "Merge pull request #39 from docs-only");

    repo.git("checkout", "-q", "-b", "shots", styled);
    repo.shoot();
    repo.git("checkout", "-q", "main");
    repo.git("merge", "-q", "--no-ff", "shots", "-m", "Merge pull request #41 from shots");

    // A real, declared change so the run has to get past the content check and
    // walk the commit list, which is where the merge would be listed.
    repo.touch("src/index.css");
    repo.commit("Suppress transitions\n\nScreenshots-unaffected: never in effect during a paint.");

    const { ok, out } = repo.run();

    assert.equal(ok, true);
    assert.doesNotMatch(out, /appearance changed since/);
    // Named on the green run rather than silently dropped: a reader comparing
    // this against `git log` should not have to wonder where it went.
    assert.match(out, /changing nothing on main/);
    assert.match(out, /Merge pull request #39 from docs-only/);
  });
});
