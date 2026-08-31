/**
 * The only file that knows where the freshest-record memory is kept.
 *
 * The judgement lives in `mergeByFreshness` (`matches-core.ts`), which is pure;
 * this file decides only where the bytes go — the same split `account-core.ts`
 * and `account-store.ts` draw, and for the same reason.
 *
 * **Why any of this exists.** #281 stops football-data's regressed records
 * reaching a reader by keeping, per fixture, whichever copy upstream stamps
 * newer. That memory was process-local, so a deploy wiped it — and measured on
 * 2026-08-31, the tick after a restart served two finished matches as unplayed
 * and every tick for the next fifteen minutes did the same, because upstream
 * sat on its stale generation throughout. Five deploys landed in thirty-five
 * minutes that night. "It self-heals on the next good fill" is true and was not
 * enough.
 *
 * **A stale file here is harmless, which is worth knowing before anyone adds an
 * expiry to it.** A stored record can only ever *win* a comparison by carrying a
 * newer stamp than what upstream has just served, so an old file can prevent a
 * regression and cannot cause one. A file from a previous season names fixtures
 * the current payload does not carry, and `mergeByFreshness` drops those on its
 * own — incoming decides which fixtures exist.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Match } from "@/src/types";

/**
 * Narrow enough that a record loaded from disk cannot reach the wire malformed.
 *
 * Anything read here can win a comparison and be served, so this checks the
 * fields a `Match` must carry rather than only the two the merge reads. A
 * record missing `lastUpdated` is *valid* and simply inert — it loses every
 * comparison, which is the same contract an unstamped record from upstream has.
 */
const isMatch = (value: unknown): value is Match => {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.round === "number" &&
    typeof m.kickoff === "string" &&
    typeof m.status === "string" &&
    typeof m.homeCode === "string" &&
    typeof m.awayCode === "string" &&
    (m.homeGoals === null || typeof m.homeGoals === "number") &&
    (m.awayGoals === null || typeof m.awayGoals === "number") &&
    (m.lastUpdated === undefined || typeof m.lastUpdated === "string")
  );
};

/**
 * What the last process knew, or an empty list.
 *
 * **Every failure is an empty list, never a throw**, and that is the whole
 * contract: this runs at boot, and a file that is missing, unreadable, truncated
 * by a crash mid-write, or written by some future shape must leave the server
 * starting normally with the memory it had before this feature existed. The same
 * class of trap as `node:sqlite`'s lazy load — a site that is down because a
 * cache warmed badly is far worse than one serving a stale scoreline for a
 * minute.
 *
 * One bad record does not discard the file: the valid ones are kept, because a
 * partially readable memory is strictly better than none.
 */
export const readMatchState = (file: string): Match[] => {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMatch);
  } catch {
    return [];
  }
};

/**
 * Replace the file atomically.
 *
 * Written to a sibling and renamed, because `rename` within one directory is
 * atomic while `writeFileSync` is not: a process killed mid-write — which is
 * exactly what a deploy does — would otherwise leave truncated JSON, and the
 * next boot would read nothing at the moment it most needs to read something.
 *
 * SQLite's directory lesson applies here too: the parent is created, because
 * the default lives under `data/` and a fresh clone has no such directory.
 *
 * Throws on failure rather than swallowing, so the caller decides — this must
 * never take a request down, and only the caller knows that.
 */
export const writeMatchState = (file: string, json: string): void => {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, json, "utf8");
  renameSync(temporary, file);
};
