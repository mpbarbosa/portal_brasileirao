/**
 * Whether a capture may be committed as documentation. Pure — the git and HTTP
 * calls happen in `scripts/screenshot.ts`, which passes the answers in
 * (tests/screenshot-core.test.ts).
 *
 * Extracted because the guard grew a fourth branch and the fourth one is the
 * only one that had ever fired in production without being noticed. Reasons are
 * returned as a list rather than as a boolean so the caller can print every
 * failure at once: a capture from a token-less tree at a stale commit fails two
 * tests, and fixing one to be told about the other is a slow way to learn that.
 */

/** What `scripts/screenshot.ts` observed. Every field is measured, not inferred. */
export interface CaptureFacts {
  /** The sha the served build reports from `/api/health`. */
  servedSha: string;
  /** The `source` the same endpoint reports. */
  provider: string;
  /** Whether `servedSha` names a commit this repository actually has. */
  known: boolean;
  /** Appearance paths that differ between the served build and HEAD. */
  changedVsHead: string[];
  /**
   * Appearance paths `origin/main` carries that HEAD does not.
   *
   * `null` means the comparison could not be made — no remote, or never
   * fetched. That is reported rather than treated as "clean", because the two
   * are the same shape and only one of them is safe.
   */
  behindMain: string[] | null;
}

const list = (paths: string[]): string => `\n    ${paths.join("\n    ")}`;

/**
 * Every reason this capture cannot be committed. Empty means it can.
 *
 * The order is deliberate: the cheapest and most self-evident failures come
 * first, so a reader fixes the dirty tree before puzzling over the diff it
 * produced.
 */
export const captureRefusals = (facts: CaptureFacts): string[] => {
  const reasons: string[] = [];

  if (facts.servedSha.endsWith("-dirty")) {
    reasons.push(
      `built from a dirty tree (${facts.servedSha}) — commit first, a dirty build is not reproducible`,
    );
  } else if (!facts.known) {
    reasons.push(
      `serves ${facts.servedSha}, which is not a commit in this repository — fetch, or it is not ours`,
    );
  } else if (facts.changedVsHead.length) {
    reasons.push(`appearance differs from HEAD in:${list(facts.changedVsHead)}`);
  }

  /**
   * The check the guard was missing.
   *
   * Matching HEAD is not enough, because HEAD can itself be behind. A capture
   * taken while `origin/main` carries an appearance commit you have not merged
   * is **stale on arrival**: it depicts your branch faithfully and depicts the
   * thing it will be committed alongside incorrectly. This fired in the wild —
   * a capture at `ea27bee` passed against its own HEAD while `origin/main` held
   * a change to `MatchPage`, and CI then failed the capture PR on its own
   * images.
   *
   * Reported separately from `changedVsHead` rather than folded in, because the
   * remedy is different: that one says rebuild, this one says merge.
   */
  if (facts.behindMain?.length) {
    reasons.push(
      `origin/main has appearance changes this tree does not:${list(facts.behindMain)}\n` +
        "    merge origin/main and re-shoot — these images would be stale the moment they land",
    );
  }

  if (facts.provider !== "football-data") {
    reasons.push(
      `provider is "${facts.provider}", not "football-data" — frozen seed data\n` +
        "    a worktree without .env boots on the seed snapshot; copy it in",
    );
  }

  return reasons;
};

/**
 * Whether the `origin/main` comparison was skipped, and so whether the verdict
 * is weaker than it looks. Not a refusal: a capture with no network is still a
 * legitimate capture, and refusing one would make the tool unusable offline for
 * a risk that is merely unmeasured rather than known.
 */
export const behindMainUnknown = (facts: CaptureFacts): boolean =>
  facts.behindMain === null;
