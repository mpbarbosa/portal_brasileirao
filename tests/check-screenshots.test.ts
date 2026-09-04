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

    for (const sub of ["src/components", "src/data", "docs/screenshots", "scripts"]) {
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
    this.write("src/data/venues.ts", "venues\n");
    this.write("rank-candles-core.ts", "candles\n");
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

  /**
   * A commit to docs/screenshots.
   *
   * `depicts` is what scripts/screenshot.ts records in CAPTURED: the commit it
   * was actually served, which is HEAD at capture time and so always behind the
   * commit that stores the images. Left out, this models a capture from before
   * CAPTURED existed, or one committed by hand — the fallback path.
   */
  shoot(message = "Refresh the screenshots", depicts?: string): string {
    this.write("docs/screenshots/classificacao-light.png", `png ${this.git("rev-parse", "HEAD")}\n`);
    if (depicts !== undefined) {
      this.write(
        "docs/screenshots/CAPTURED",
        `# Which commit these screenshots depict.\ncommit ${depicts}\n`,
      );
    }
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

test("a curated data change is an appearance change", () => {
  // `src/data` joined the watched paths because the four before it could not see
  // the case that motivated them. Curated data is *merged into what production
  // serves* — broadcaster marks onto four captured pages, a stadium's name and
  // photograph onto the estádio page — so an edit there moves a captured pixel
  // with nothing on `src/components`, `src/index.css`, `src/App.tsx` or
  // `index.html` having changed.
  withSandbox((repo) => {
    repo.shoot();
    repo.write("src/data/broadcasts.ts", "export const BROADCASTS = { \"1\": [\"ge\"] };\n");
    repo.commit("Sync the broadcast channels");

    assert.equal(repo.run().ok, false);
  });
});

/**
 * **A root-level `*-core.ts` can move a captured pixel, and for a long time the
 * gate could not see one.** `rank-candles-core.ts` holds the geometry that
 * places every candle rect on the Painel — `tickHeight`, the band arithmetic,
 * the zone guides — and `RankCandles.tsx` only renders what it returns. So #351
 * changed the opening stub from 1.90px to 3.56px, genuinely moving pixels
 * inside `painel-palmeiras-{light,dark}`, while "README screenshots are
 * current" passed green on its own pull request.
 *
 * It is the `src/data` lesson one directory up: the watched list described
 * where *markup* lives, and the thing that decides the drawing lives somewhere
 * else.
 *
 * **This covers that one module and not the twenty-five the UI imports** —
 * `club-core`, `standings-core`, `live-core` and the rest are all still
 * outside, and each of them can move a rendered pixel too. Read the count off
 * the imports rather than this comment; widening further is a decision about
 * how much noise the gate should make, not an oversight to tidy up.
 */
test("a root-level core module that draws is an appearance change", () => {
  withSandbox((repo) => {
    repo.shoot();
    repo.write("rank-candles-core.ts", "candles\nconst tickHeight = 4;\n");
    repo.commit("Make the vela's opening stub heavier");

    assert.equal(repo.run().ok, false);
  });
});

test("a seed sync is listed too, and the trailer is what clears it", () => {
  // This test used to assert the opposite — that `src/data` was not watched at
  // all — and the reasoning it encoded is still true for *this* file: captures
  // are taken from production, which serves live provider data, so the seed
  // snapshot cannot move one however far it drifts. What changed is that the
  // list cannot separate `matches.ts` from `broadcasts.ts`, and the direction to
  // fail in was the one that reports too much rather than the one that reports
  // nothing.
  //
  // So the cost is real and is paid here rather than discovered: a
  // `sync-seed-data` run now owes a trailer. That is the mechanism working — a
  // claim a person writes and the run prints — not a workaround for it.
  withSandbox((repo) => {
    repo.shoot();
    repo.write("src/data/matches.ts", "export const SEED_MATCHES = [];\n");
    repo.commit("Sync the seed fixtures");
    assert.equal(repo.run().ok, false);

    repo.write("src/data/clubs.ts", "export const CLUBS = [];\n");
    repo.commit(
      "Sync the seed clubs\n\n" +
        "Screenshots-unaffected: the seed snapshot is the offline fallback and\n" +
        "  every capture is taken from production, which serves live provider\n" +
        "  data, so no rendered pixel can come from this file.",
    );

    const { out } = repo.run();
    assert.match(out, /Declared not to move a pixel/);
    assert.match(out, /no rendered pixel can come from this file/);
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
    assert.match(out, /introduced nothing of its own/);
    assert.match(out, /Merge pull request #39 from docs-only/);
  });
});

test("a trailer survives the merge commit that lands it", () => {
  // THE DEFECT THIS SUITE DID NOT HAVE A CASE FOR, and it sat one test below
  // the catch-up merge for months. `git log -- <paths>` lists the merge that
  // lands a pull request as well as the commit inside it, and a merge made from
  // the GitHub button carries a message with nowhere to put a trailer. So the
  // gate credited the claim, printed its reason, and reported the identical edit
  // as unaccounted under the merge sha. #205, #202 and #217 all hit it, which
  // made a trailer defer a re-shoot rather than remove one.
  //
  // MAIN HAS TO MOVE ON AN APPEARANCE PATH WHILE THE BRANCH IS OUT. Without
  // that the merge is TREESAME to its topic parent on these paths and git's own
  // history simplification never lists it, so there is nothing for the gate to
  // get wrong — the first fixture written for this passed against the unfixed
  // script. That is the same trap the catch-up case below records about forking
  // before the merge, one topology further on: a fixture simpler than this
  // repository can be too simple to contain the bug.
  withSandbox((repo) => {
    const base = repo.git("rev-parse", "HEAD");
    repo.shoot("Refresh the screenshots", base);

    repo.git("checkout", "-q", "-b", "topic");
    repo.touch("src/components/Table.tsx");
    repo.commit("Move a constant\n\nScreenshots-unaffected: a constant moved module; no pixel can move.");

    repo.git("checkout", "-q", "main");
    // A sibling change on main, on a different file so the merge does not
    // conflict — this is what makes the merge differ from *both* parents.
    repo.touch("src/index.css");
    repo.commit("Somebody else's rule\n\nScreenshots-unaffected: never in effect during a paint.");
    repo.git("merge", "-q", "--no-ff", "topic", "-m", "Merge pull request #217 from topic");

    const { ok, out } = repo.run();

    assert.equal(ok, true);
    assert.doesNotMatch(out, /appearance changed since/);
    // Named on the green run, like the catch-up merge, rather than vanishing.
    assert.match(out, /introduced nothing of its own/);
    assert.match(out, /Merge pull request #217 from topic/);
  });
});

test("an untrailered change is still refused when a merge lands it", () => {
  // The other side of the case above: skipping the merge must not skip the debt
  // inside it. The topic commit is enumerated in its own right and answers for
  // itself, so the verdict is unchanged and it is the commit that gets named —
  // not the merge, which a reader cannot act on.
  withSandbox((repo) => {
    const base = repo.git("rev-parse", "HEAD");
    repo.shoot("Refresh the screenshots", base);

    repo.git("checkout", "-q", "-b", "topic");
    repo.touch("src/components/Table.tsx");
    repo.commit("Restyle the table");

    repo.git("checkout", "-q", "main");
    repo.touch("src/index.css");
    repo.commit("Somebody else's rule\n\nScreenshots-unaffected: never in effect during a paint.");
    repo.git("merge", "-q", "--no-ff", "topic", "-m", "Merge pull request #218 from topic");

    const { ok, out } = repo.run();

    assert.equal(ok, false);
    assert.match(out, /Restyle the table/);
  });
});

test("an evil merge is still refused — its resolution is in neither parent", () => {
  // Why the fix is a combined-diff test and not `--no-merges`, which is simpler
  // and would pass every case above while blinding the gate here.
  //
  // A conflict resolved by hand into an appearance path produces a result that
  // exists in neither parent, so no other commit can answer for it and the merge
  // itself has to. `git show --cc` prints exactly that and nothing else, which
  // is what makes it the right question to ask of a merge.
  withSandbox((repo) => {
    const base = repo.git("rev-parse", "HEAD");
    repo.shoot("Refresh the screenshots", base);

    repo.git("checkout", "-q", "-b", "left");
    repo.write("src/components/Table.tsx", "left\n");
    repo.commit("Left edit\n\nScreenshots-unaffected: declared, but see the merge.");

    repo.git("checkout", "-q", "main");
    repo.write("src/components/Table.tsx", "right\n");
    repo.commit("Right edit\n\nScreenshots-unaffected: declared, but see the merge.");

    try {
      repo.git("merge", "--no-ff", "left", "-m", "Merge branch left");
    } catch {
      // Expected: the point of the case is that this conflicts.
    }
    // Resolved to a third value, present on neither side.
    repo.write("src/components/Table.tsx", "resolved by hand\n");
    repo.git("add", "src/components/Table.tsx");
    repo.git("commit", "-q", "--no-edit");

    const { ok, out } = repo.run();

    assert.equal(ok, false);
    assert.match(out, /Merge branch left/);
  });
});

test("the anchor is what the images depict, not when they were committed", () => {
  // The case the CAPTURED anchor exists for, and the only one where the two
  // answers differ. A capture is taken at A; before it is committed, main moves
  // under it and brings an appearance change in. The image commit's *tree* now
  // contains that change and the photographs do not, so anchoring on "the last
  // commit touching docs/screenshots" compares HEAD against a tree the pictures
  // never depicted and calls it current.
  withSandbox((repo) => {
    const photographed = repo.git("rev-parse", "HEAD");

    repo.git("checkout", "-q", "-b", "restyle", photographed);
    repo.touch("src/index.css");
    repo.commit("Restyle the table");
    repo.git("checkout", "-q", "main");
    repo.git("merge", "-q", "--no-ff", "restyle", "-m", "Merge the restyle");

    // Committed now, but shot before the restyle landed.
    repo.shoot("Refresh the screenshots", photographed);

    const { ok, out } = repo.run();

    assert.equal(ok, false);
    assert.match(out, /Restyle the table/);
  });
});

test("with no CAPTURED it falls back to the commit that stored the images", () => {
  withSandbox((repo) => {
    repo.shoot();
    repo.touch("src/index.css");
    repo.commit("Restyle the table");

    const { ok, out } = repo.run();

    assert.equal(ok, false);
    assert.match(out, /last screenshot refresh/);
    assert.match(out, /Restyle the table/);
  });
});

test("a CAPTURED pointing off the image commit's line is not used", () => {
  // The normal flow cannot produce this: screenshot.ts writes the sha it was
  // served, and the commit storing the images is built on top of it. A note
  // naming a commit that is not an ancestor of the image commit has been
  // hand-edited or rebased out from under, and says nothing about these
  // pictures — so the weaker anchor is used and the run says which it used.
  //
  // This is accuracy against a mistake, not tamper-resistance. Editing CAPTURED
  // is a commit to docs/screenshots, which moves the fallback anchor too; see
  // the note in the script. The assertion here is on which anchor was chosen.
  withSandbox((repo) => {
    const base = repo.git("rev-parse", "HEAD");
    repo.git("checkout", "-q", "-b", "elsewhere", base);
    repo.touch("src/index.css");
    const stray = repo.commit("A change on a branch that was never merged");

    repo.git("checkout", "-q", "main");
    repo.shoot("Refresh the screenshots", stray);
    repo.touch("src/components/Table.tsx");
    repo.commit("Widen the position column");

    const { ok, out } = repo.run();

    assert.equal(ok, false);
    assert.match(out, /last screenshot refresh/);
    assert.doesNotMatch(out, /the images depict/);
  });
});

test("a CAPTURED naming a commit this repository does not have falls back quietly", () => {
  // The verdict comes from the ancestor test either way — an unknown commit is
  // an ancestor of nothing. The existence check is here for the output: without
  // it `git merge-base --is-ancestor` writes "fatal: Not a valid commit name"
  // to stderr on every run, which reads as the check having broken rather than
  // as it having handled an unreadable note and moved on.
  withSandbox((repo) => {
    repo.shoot("Refresh the screenshots", "0".repeat(40));
    repo.touch("src/index.css");
    repo.commit("Restyle the table");

    const { ok, out } = repo.run();

    assert.equal(ok, false);
    assert.match(out, /last screenshot refresh/);
    assert.doesNotMatch(out, /fatal:/);
  });
});

test("an unchanged appearance is still current when CAPTURED is present", () => {
  withSandbox((repo) => {
    repo.touch("src/index.css");
    const photographed = repo.commit("Restyle the table");
    repo.shoot("Refresh the screenshots", photographed);

    const { ok, out } = repo.run();

    assert.equal(ok, true);
    assert.match(out, /the images depict/);
  });
});
