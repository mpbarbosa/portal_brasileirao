import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MIN_TRAIL_MATCHES,
  profileScatter,
  scatterTrail,
  SCATTER_PAIRS,
  TRAIL_ROUNDS,
} from "@/scouts-core";
import { CLUB_SCOUTS, CLUB_SCOUTS_THROUGH_ROUND } from "@/src/data/club-scouts";
import {
  CLUB_SCOUTS_HISTORY,
  CLUB_SCOUTS_HISTORY_THROUGH_ROUND,
} from "@/src/data/club-scouts-history";
import { CLUBS } from "@/src/data/clubs";
import type { ClubScouts, ScoutHistoryEntry } from "@/src/types";

/*
 * The rastro, in two halves: whether the committed history describes this
 * season, and whether `scatterTrail` places it on the drawing it was given.
 *
 * The first half is a check on **data**, like `tests/player-core.test.ts`'s
 * override cases, and it goes red on a `sync-cartola-scouts` run rather than on
 * somebody's unrelated commit — which is what keeps it a unit test instead of a
 * monthly workflow.
 */

const PAIRS = [SCATTER_PAIRS["ataque-defesa"], SCATTER_PAIRS["volume-conversao"]];

/* ------------------------------------------------------------------- data -- */

test("the history covers every club for every rodada the aggregate claims", () => {
  assert.equal(CLUB_SCOUTS_HISTORY_THROUGH_ROUND, CLUB_SCOUTS_THROUGH_ROUND);

  for (const club of CLUBS) {
    const rows = CLUB_SCOUTS_HISTORY[club.code];
    assert.ok(rows, `${club.shortName} has no history at all`);
    assert.equal(
      rows.length,
      CLUB_SCOUTS_HISTORY_THROUGH_ROUND,
      `${club.shortName} has ${rows.length} rows for ${CLUB_SCOUTS_HISTORY_THROUGH_ROUND} rodadas`,
    );
    for (const row of rows) {
      assert.equal(row.length, 6, `${club.shortName} has a row of ${row.length} fields`);
      for (const value of row) {
        assert.ok(
          Number.isInteger(value) && value >= 0,
          `${club.shortName} carries ${value}, which is not a count`,
        );
      }
    }
  }
});

test("the counters are cumulative — never falling, and not frozen", () => {
  for (const club of CLUBS) {
    const rows = CLUB_SCOUTS_HISTORY[club.code] ?? [];
    let moved = false;

    for (let round = 1; round < rows.length; round += 1) {
      const row = rows[round] as ScoutHistoryEntry;
      const before = rows[round - 1] as ScoutHistoryEntry;
      for (let field = 0; field < row.length; field += 1) {
        assert.ok(
          (row[field] ?? 0) >= (before[field] ?? 0),
          `${club.shortName} field ${field} falls at rodada ${round + 1}`,
        );
        // Field 0 is `matches`, which the generator recomputes per rodada and
        // which therefore advances even when the counters were pushed by
        // reference. Only a counter moving is evidence anything was copied.
        if (field > 0 && (row[field] ?? 0) > (before[field] ?? 0)) moved = true;
      }
    }

    assert.ok(
      moved,
      `${club.shortName}'s counters never change — that is what pushing the ` +
        `running total by reference produces in \`accumulate\``,
    );
  }
});

test("the last rodada of the history reproduces the season aggregate", () => {
  for (const entry of CLUB_SCOUTS) {
    const rows = CLUB_SCOUTS_HISTORY[entry.clubCode] ?? [];
    const last = rows[rows.length - 1];
    assert.ok(last, `${entry.clubCode} has no last row`);
    assert.deepEqual(
      [...last],
      [
        entry.matches,
        entry.goals,
        entry.shotsSaved,
        entry.shotsOff,
        entry.shotsWoodwork,
        entry.saves,
      ],
      `${entry.clubCode}'s last history row and its aggregate describe different seasons`,
    );
  }
});

/* ------------------------------------------------------------ scatterTrail -- */

test("the rastro ends exactly on the club's own dot", () => {
  // The whole of Decision 2, as an assertion: `scatterTrail` takes the built
  // scatter, so its last point is placed by the same axes as the subject's dot.
  // If this ever fails, something has given the rastro a domain of its own.
  for (const pair of PAIRS) {
    for (const club of CLUBS) {
      const scatter = profileScatter(CLUB_SCOUTS, club.code, pair);
      assert.ok(scatter);
      const trail = scatterTrail(CLUB_SCOUTS_HISTORY, club.code, scatter);
      const subject = scatter.points.find((point) => point.subject);
      assert.ok(subject);
      const last = trail[trail.length - 1];
      assert.ok(last, `${club.shortName} has no rastro on ${pair.id}`);
      assert.equal(last.atX, subject.atX, `${club.shortName} x on ${pair.id}`);
      assert.equal(last.atY, subject.atY, `${club.shortName} y on ${pair.id}`);
    }
  }
});

test("the rastro is the last TRAIL_ROUNDS rodadas, in order", () => {
  for (const pair of PAIRS) {
    for (const club of CLUBS) {
      const scatter = profileScatter(CLUB_SCOUTS, club.code, pair);
      assert.ok(scatter);
      const trail = scatterTrail(CLUB_SCOUTS_HISTORY, club.code, scatter);

      assert.ok(trail.length <= TRAIL_ROUNDS, `${club.shortName} draws ${trail.length} points`);
      assert.equal(
        trail[trail.length - 1]?.round,
        CLUB_SCOUTS_HISTORY_THROUGH_ROUND,
        `${club.shortName}'s rastro does not reach the last rodada`,
      );
      for (let i = 1; i < trail.length; i += 1) {
        assert.equal(
          trail[i]?.round,
          (trail[i - 1]?.round ?? 0) + 1,
          `${club.shortName}'s rastro skips a rodada`,
        );
      }
    }
  }
});

test("every rastro point is inside the frame", () => {
  // Not a restatement of the clamp: this is the property
  // `tests/e2e/painel.spec.ts` measures in the browser, asserted here where a
  // failure names the club and the rodada rather than a bounding box.
  for (const pair of PAIRS) {
    for (const club of CLUBS) {
      const scatter = profileScatter(CLUB_SCOUTS, club.code, pair);
      assert.ok(scatter);
      for (const point of scatterTrail(CLUB_SCOUTS_HISTORY, club.code, scatter)) {
        assert.ok(
          point.atX >= 0 && point.atX <= 1 && point.atY >= 0 && point.atY <= 1,
          `${club.shortName} rodada ${point.round} paints outside ${pair.id}`,
        );
      }
    }
  }
});

test("a club far outside today's division is clamped, not dropped and not drawn outside", () => {
  const subject = CLUBS[0];
  assert.ok(subject);
  const scatter = profileScatter(CLUB_SCOUTS, subject.code, SCATTER_PAIRS["ataque-defesa"]);
  assert.ok(scatter);

  // 40 finalizações and 20 defesas a game: far beyond any real division, so
  // both axes are past `max` before the clamp.
  const wild: ScoutHistoryEntry[] = [
    [10, 100, 100, 100, 100, 200],
    [11, 110, 110, 110, 110, 220],
  ];
  const trail = scatterTrail({ [subject.code]: wild }, subject.code, scatter);

  assert.equal(trail.length, 2);
  for (const point of trail) {
    assert.equal(point.atX, 1);
    assert.equal(point.atY, 1);
  }
  // The unclamped value is still reported, so a caption could state it.
  assert.ok((trail[0]?.x ?? 0) > scatter.x.max);
});

test("a rastro nobody can read is an empty list, not a short one", () => {
  const subject = CLUBS[0];
  assert.ok(subject);
  const scatter = profileScatter(CLUB_SCOUTS, subject.code, SCATTER_PAIRS["ataque-defesa"]);
  assert.ok(scatter);

  assert.deepEqual(scatterTrail({}, subject.code, scatter), [], "unknown club");

  const below: ScoutHistoryEntry[] = [
    [MIN_TRAIL_MATCHES - 1, 5, 5, 5, 0, 5],
    [MIN_TRAIL_MATCHES - 1, 6, 6, 6, 0, 6],
  ];
  assert.deepEqual(
    scatterTrail({ [subject.code]: below }, subject.code, scatter),
    [],
    "every row below the match floor",
  );

  // One usable point is the club's own dot drawn a second time.
  const single: ScoutHistoryEntry[] = [
    [MIN_TRAIL_MATCHES - 1, 5, 5, 5, 0, 5],
    [MIN_TRAIL_MATCHES, 6, 6, 6, 0, 6],
  ];
  assert.deepEqual(
    scatterTrail({ [subject.code]: single }, subject.code, scatter),
    [],
    "one usable point",
  );
});

test("a rodada with no shot at all has no conversão, so it is not plotted", () => {
  // The state `profileScatter`'s own "unreachable today" comment names: on the
  // volume × conversão pairing a club that has taken no shot has a real x of 0
  // and no y, and half a point is worse than none.
  const subject = CLUBS[0];
  assert.ok(subject);
  const scatter = profileScatter(CLUB_SCOUTS, subject.code, SCATTER_PAIRS["volume-conversao"]);
  assert.ok(scatter);

  const goalless: ScoutHistoryEntry[] = [
    [5, 0, 0, 0, 0, 10],
    [6, 0, 0, 0, 0, 12],
    [7, 1, 5, 9, 0, 14],
    [8, 2, 7, 12, 1, 16],
  ];
  const trail = scatterTrail({ [subject.code]: goalless }, subject.code, scatter);
  assert.deepEqual(
    trail.map((point) => point.round),
    [3, 4],
    "the two shotless rodadas are dropped rather than plotted at 0%",
  );
});

test("the aggregate and the history agree about how many clubs there are", () => {
  const scouted = new Set(CLUB_SCOUTS.map((entry) => entry.clubCode));
  const stored = new Set(Object.keys(CLUB_SCOUTS_HISTORY));
  assert.deepEqual([...stored].sort(), [...scouted].sort());
  assert.equal(stored.size, CLUBS.length);
});

test("no club is a ClubScouts short of the division", () => {
  // Guards the join the two files rest on: a club renamed or re-coded in
  // `clubs.ts` must break loudly here rather than render an empty rastro.
  for (const club of CLUBS) {
    const entry: ClubScouts | undefined = CLUB_SCOUTS.find(
      (candidate) => candidate.clubCode === club.code,
    );
    assert.ok(entry, `${club.shortName} has no scouts`);
    assert.ok(CLUB_SCOUTS_HISTORY[club.code], `${club.shortName} has no history`);
  }
});
