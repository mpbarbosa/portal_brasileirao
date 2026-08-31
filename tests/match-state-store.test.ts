import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { readMatchState, writeMatchState } from "@/match-state-store";
import { mergeByFreshness } from "@/matches-core";
import type { Match } from "@/src/types";

/**
 * Real files, because the module under test is the one whose whole job is I/O —
 * the same reason `account-store.test.ts` uses a real database. The *rule* this
 * memory feeds is tested without any of this, in `matches-core.test.ts`.
 */
const roots: string[] = [];
const scratch = (): string => {
  const dir = mkdtempSync(path.join(tmpdir(), "match-state-"));
  roots.push(dir);
  return dir;
};
after(() => roots.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const match = (overrides: Partial<Match> & Pick<Match, "id">): Match => ({
  round: 25,
  kickoff: "2026-08-30T21:30:00Z",
  status: "FINISHED",
  homeCode: "MIR",
  awayCode: "PAL",
  homeGoals: 1,
  awayGoals: 1,
  ...overrides,
});

const save = (file: string, matches: Match[]) => writeMatchState(file, JSON.stringify(matches));

test("what one process knew, the next one reads back", () => {
  const file = path.join(scratch(), "match-state.json");
  const held = [match({ id: "554986", lastUpdated: "2026-08-30T23:37:19Z" })];

  save(file, held);

  assert.deepEqual(readMatchState(file), held);
});

/** The point of the whole file: a restart must not re-open the window that
 *  served two finished matches as unplayed for fifteen minutes. */
test("the reloaded memory still rejects a regressed record", () => {
  const file = path.join(scratch(), "match-state.json");
  save(file, [match({ id: "554986", lastUpdated: "2026-08-30T23:37:19Z" })]);

  // …the process restarts here, and upstream answers with its stale copy.
  const merged = mergeByFreshness(readMatchState(file), [
    match({ id: "554986", status: "SCHEDULED", homeGoals: null, awayGoals: null,
            lastUpdated: "2026-08-30T10:20:34Z" }),
  ], Date.parse("2026-08-31T00:42:00Z"));

  assert.equal(merged[0].status, "FINISHED");
  assert.equal(merged[0].homeGoals, 1);
});

test("a missing file is an empty memory, not a throw", () => {
  assert.deepEqual(readMatchState(path.join(scratch(), "nothing-here.json")), []);
});

/** A deploy kills the process; `writeFileSync` is not atomic. This is the shape
 *  the file is left in when that happens mid-write, and booting must survive it. */
test("a truncated file is an empty memory, not a throw", () => {
  const file = path.join(scratch(), "match-state.json");
  writeFileSync(file, '[{"id":"554986","round":25,"kick');

  assert.deepEqual(readMatchState(file), []);
});

test("a file of the wrong shape is an empty memory", () => {
  const file = path.join(scratch(), "match-state.json");
  writeFileSync(file, '{"matches":[]}');

  assert.deepEqual(readMatchState(file), []);
});

/** A partially readable memory beats none: the good records still defend their
 *  fixtures. */
test("one unreadable record does not discard the rest of the file", () => {
  const file = path.join(scratch(), "match-state.json");
  writeFileSync(
    file,
    JSON.stringify([match({ id: "554986" }), { id: "554985", round: "twenty-five" }, null]),
  );

  const loaded = readMatchState(file);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, "554986");
});

/** Valid, and inert — it loses every comparison, exactly as an unstamped
 *  record from upstream does. */
test("a record with no stamp survives the round trip", () => {
  const file = path.join(scratch(), "match-state.json");
  save(file, [match({ id: "554986" })]);

  assert.equal(readMatchState(file).length, 1);
  assert.equal("lastUpdated" in readMatchState(file)[0], false);
});

test("the parent directory is created — a fresh clone has no data/", () => {
  const file = path.join(scratch(), "data", "nested", "match-state.json");

  save(file, [match({ id: "554986" })]);

  assert.equal(readMatchState(file).length, 1);
});

test("the write is atomic and leaves no temporary behind", () => {
  const file = path.join(scratch(), "match-state.json");

  save(file, [match({ id: "554986", lastUpdated: "2026-08-30T23:37:19Z" })]);
  save(file, [match({ id: "554986", lastUpdated: "2026-08-31T00:00:00Z" })]);

  assert.equal(existsSync(`${file}.tmp`), false);
  assert.equal(readMatchState(file)[0].lastUpdated, "2026-08-31T00:00:00Z");
  assert.equal(JSON.parse(readFileSync(file, "utf8")).length, 1);
});
