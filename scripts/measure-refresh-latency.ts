/**
 * measure-refresh-latency.ts
 * --------------------------
 * How long does README screenshot debt actually stand?
 *
 * `docs/cicd-plan.md` publishes a floor for this — median hours to refresh, p90,
 * max — and offers it as the bar any replacement for the advisory red signal has
 * to clear. A published number needs a way to recompute it, and the first two
 * attempts were both hand-rolled pairings that got it wrong in the same
 * direction: pair each appearance commit with the next commit touching
 * `docs/screenshots`, and you credit a refresh that was shot *before* the change
 * and merely committed after it. One real 2.99h episode scored as 0.03h.
 *
 * The fix is not a better pairing rule. It is to stop having one.
 * `scripts/check-screenshots.sh` already decides whether the images are current,
 * and it is the only thing whose answer matters — it is what goes red. So this
 * replays that script across history and measures the runs of red, rather than
 * forming a second opinion about when debt begins and ends. Four things the
 * hand-rolled versions each got wrong come free as a result: the gate compares
 * appearance sources by **content** rather than asking which commits touched a
 * path, it walks every commit rather than the first-parent line, it honours
 * `Screenshots-unaffected:` trailers, and it validates the `CAPTURED` anchor
 * before trusting it.
 *
 * The replay checks out each commit in a throwaway worktree, so **the script
 * that runs is the one that existed at that commit** — the verdict the gate
 * actually gave, not today's rules applied to old history. Commits predating the
 * script are reported as unmeasurable rather than assumed green.
 *
 *     npx tsx scripts/measure-refresh-latency.ts
 *     npx tsx scripts/measure-refresh-latency.ts --split 339a037
 *
 * `--split` partitions the episodes at a commit — written for the open question
 * in the plan, whether debt is still cleared as fast now that a red gate no
 * longer reddens the run. It costs nothing upstream: git only, no network.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { episodesFrom, since, summarise, type Sample } from "@/refresh-latency-core";

const CHECK = "scripts/check-screenshots.sh";

const git = (args: string[], cwd?: string): string =>
  execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};

const ref = arg("--ref") ?? "origin/main";
const split = arg("--split");

/**
 * Oldest-first, so `episodesFrom` reads them in the direction time runs. Only
 * the first-parent line: a commit on a side branch was never what `main` served,
 * so the gate's verdict there is not a state anyone was in.
 */
const commits = git(["log", "--first-parent", "--format=%H %ct", ref])
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [sha, ts] = line.split(" ");
    return { sha, ts: Number(ts) };
  })
  .reverse();

if (commits.length === 0) {
  console.error(`No commits found for ${ref}.`);
  process.exit(1);
}

const scratch = mkdtempSync(path.join(tmpdir(), "refresh-latency-"));
const replay = path.join(scratch, "wt");
const samples: Sample[] = [];
let unmeasurable = 0;

try {
  git(["worktree", "add", "--detach", "--quiet", replay, commits[0].sha]);

  for (const [i, commit] of commits.entries()) {
    git(["checkout", "--detach", "--quiet", commit.sha], replay);

    // Before the gate existed there is no verdict to record. Calling that green
    // would manufacture the very thing being measured: long quiet stretches.
    if (!existsSync(path.join(replay, CHECK))) {
      unmeasurable += 1;
      continue;
    }

    let red = false;
    try {
      execFileSync(`./${CHECK}`, { cwd: replay, stdio: "ignore" });
    } catch {
      red = true;
    }
    samples.push({ sha: commit.sha, ts: commit.ts, red });

    if ((i + 1) % 25 === 0) process.stderr.write(`  …${i + 1}/${commits.length}\n`);
  }
} finally {
  try {
    git(["worktree", "remove", "--force", replay]);
  } catch {
    /* the scratch directory goes below regardless */
  }
  rmSync(scratch, { recursive: true, force: true });
}

const now = commits[commits.length - 1].ts;
const episodes = episodesFrom(samples, now);

const report = (label: string, list: typeof episodes): void => {
  const s = summarise(list);
  const open = list.filter((e) => e.open).length;
  if (s.count === 0) {
    console.log(`  ${label}: no closed episodes${open ? ` (${open} still open)` : ""}`);
    return;
  }
  console.log(
    `  ${label}\n` +
      `    episodes ${String(s.count).padStart(3)} | ` +
      `median ${s.medianHours.toFixed(2).padStart(6)}h | ` +
      `p90 ${s.p90Hours.toFixed(2).padStart(6)}h | ` +
      `max ${s.maxHours.toFixed(2).padStart(6)}h | ` +
      `over 24h ${s.overOneDay}` +
      (open ? `\n    plus ${open} still open at ${ref} — a lower bound, excluded above` : ""),
  );
};

console.log(`\nReplayed ${CHECK} over ${samples.length} commits on ${ref}.`);
if (unmeasurable > 0) {
  console.log(`${unmeasurable} commit(s) predate the script and carry no verdict.`);
}
console.log();
report("all measurable history", episodes);

if (split) {
  const at = Number(git(["log", "-1", "--format=%ct", split]));
  const label = git(["log", "-1", "--format=%h %s", split]).slice(0, 60);
  console.log(`\nsplit at ${label}`);
  const before = episodes.filter((e) => e.fromTs < at);
  report("before", before);
  report("after ", since(episodes, at));
}

const open = episodes.filter((e) => e.open);
for (const e of open) {
  console.log(`\n  OPEN since ${git(["log", "-1", "--format=%h %s", e.fromSha]).slice(0, 60)}`);
  console.log(`    ${e.hours.toFixed(2)}h and counting`);
}
console.log();
