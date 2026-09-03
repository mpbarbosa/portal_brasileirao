# The Perfil scatters, rodada by rodada — implementation plan

**For whoever picks this up next.** It is a plan, not a record: nothing below has
been built. Written 2026-09-03 against `origin/main` = `27dc7fa` (PR #335 merged).

## Provenance — what here is measured and what is reasoned

Anchored, so the next reader does not have to re-derive it:

- **Bundle deltas were measured**, not estimated: `origin/main` extracted to a
  scratch tree, a synthetic 20×38 history wired into `ClubProfile.tsx` so nothing
  tree-shook it, and the real `npx vite build` run three times. Figures in
  [Decision 4](#decision-4--persistence-a-generated-ts-module-not-a-database).
- **The windowing figures (441 / 19 / 10) are quoted from
  `scripts/sync-cartola-scouts.ts`'s own header**, which states them as measured
  across the 2026 season to round 24. They were not re-measured here.
- **Everything about the drawing is reasoned**, not seen. No trail has been
  rendered yet, so Phase 4's opacity ramp and start-round are proposals with a
  stated fallback, and Phase 4's acceptance criterion is a screenshot a person
  looks at.

## What is being built

The two Perfil scatters on the Painel do clube (`ataque × defesa` and
`volume × conversão`) each place twenty clubs on two rates. Today every club is
one dot and the drawing is a still photograph of rodada 25.

This adds, **for the subject club only**, a line joining where that club sat at
each earlier rodada — its cumulative rate through rounds 5, 6, … N — ending in
the bold dot the page already draws. The reader sees the direction a side has
been moving in, not only where it has arrived.

Nothing else about the two drawings changes.

---

## The constraint that shapes everything: what the source can and cannot say

`caRtola` publishes a **weekly** snapshot of the Cartola FC market, and its
counters are cumulative season totals. A rodada therefore exists only as the
difference between two consecutive snapshots — and a midweek round falls
*between* two of them.

`scripts/sync-cartola-scouts.ts` measured the damage across the 2026 season to
round 24: of **470 club-rounds, 441 windows held exactly one match, 19 held none
and 10 held two.**

**This is why the plan draws a cumulative trail and not a dot per rodada.**

- A **per-rodada** scatter would put a club that actually played at the origin
  nineteen times a season, and double-count another ten. The error is total and
  it looks like data.
- A **cumulative** trail carries at most one match's worth of numerator error at
  any point, and that error **self-corrects at the next snapshot** — the sum is
  the sum either way. Its share of the reading decays as 1/n.

The denominator has no such problem: `playedThrough(clubCode, round)` in the
sync script counts finished matches out of **our own** `SEED_MATCHES`, exactly,
per round. It already takes a round argument and is only ever called with the
last one.

**Say this to the reader, not only in a comment.** See Phase 5.

---

## Decisions already taken

Take these as settled. Each records why, so a later session can overturn one
knowingly rather than by accident.

### Decision 1 — only the subject club trails

The other nineteen stay as today's single grey dots. Twenty trails on a 320×200
box is a ball of wool; and the question the Painel asks is about *this* club.

### Decision 2 — the frame is frozen at the current rodada

`axis()` in `scouts-core.ts` derives `min`/`max`/`median` from the live
division, so recomputing the domain per round would move the frame *and* the dot
together, and no movement on the drawing would mean anything.

**Enforce this structurally, not by convention:** `scatterTrail` takes the
already-built `ProfileScatter` and reuses its `x`/`y` axes. It must not be able
to compute a domain of its own.

The consequence is a claim the caption then owes the reader: the quadrant names
("jogo aberto", "volume e aproveitamento") describe **today's** division, and an
early point sitting in a corner means "where this club would fall on today's
frame", not "the corner it was in then".

### Decision 3 — the rastro covers the last eight rodadas, and every point is clamped

**REVISED DURING IMPLEMENTATION, 2026-09-03, by measurement. The original
decision — start at 5 matches and clamp — is refuted, and the paragraph it
replaced is gone rather than annotated.** It read: *a rate over three matches
swings to the edge; start the trail around round 5 and clamp the rest.*

Measured across both drawings and all twenty clubs, on the generated history:

| rastro | points | outside the frame | worst overshoot |
|---|---|---|---|
| whole season, floor 3 | 920 | 331 (36%) | 1.40 of the box |
| whole season, floor 5 | 836 | 286 (34%) | 1.40 |
| whole season, floor 15 | 436 | 75 (17%) | 0.25 |
| **last 8 rodadas** | **320** | **39 (12%)** | **0.14** |
| last 6 rodadas | 240 | 19 (8%) | 0.14 |

**The floor barely works because the cause is not early-season noise.** The
league mean is flat across the season — 10.0 → 9.7 finalizações a game, 3.0 →
3.0 defesas — while the **spread narrows**, 5.3–16.3 at rodada 3 against
7.9–11.7 at rodada 25. Twenty seasons converging is real football, and a frame
padded 6% around where they ended cannot hold where they began. Raising the
floor from 5 to 15 throws away half the trail to halve the problem.

**Widening the frame to fit the rastro was measured and rejected.** The box grows
×1.26 median but ×2.40 worst, and — the decisive objection — the domain would
then depend on which club's Painel you are on, so two clubs' drawings stop being
comparable. That is precisely the property `RankCandles` uses the whole division
to protect.

So: `TRAIL_ROUNDS = 8`, with `MIN_TRAIL_MATCHES = 5` kept beneath it for the
opening of a season (at rodada 25 it does nothing; at rodada 6 the window reaches
back to rodada 1), and the clamp kept as the third defence — it now nudges rather
than pinning a third of the line to the border.

**The window is also the better editorial claim.** A Painel asks how a club is
playing *now*; eight rodadas is form, where a season-long trail mostly redraws
the fact that early averages are noisy. The caption must therefore say **últimas
oito rodadas**, not "since the fifth match".

### Decision 4 — persistence: a generated TS module, not a database

Settled on measurement. The client bundle, built three times from `origin/main`:

| Client bundle | raw | gzip |
|---|---|---|
| `origin/main` today | 376.6 kB | **115.3 kB** |
| \+ history as numeric tuples | 389.3 kB | **121.0 kB** (+5.7) |
| \+ history in the repo's verbose object style | 439.5 kB | **124.6 kB** (+9.3) |

nginx gzips `application/javascript` (`shell_scripts/04_setup_nginx.sh:55`); no
brotli. **The whole persistence question is worth under 10 kB on the wire, once,
and the spread between the best and worst encoding is 3.6 kB.**

Rejected, with reasons that are about this host and this pipeline:

- **SQLite** (already in the stack via `node:sqlite` in `account-store.ts`) —
  `shell_scripts/07_install_release.sh:103` does `rsync -a --delete` on `dist/`
  only, so the app root survives a deploy. A reference DB in `dist/` needs a new
  build step and a place in the tarball; one in the app root *survives deploys*
  and therefore drifts out of step with the code that reads it, needing an
  out-of-band push and breaking the invariant that the host runs the logic
  matching the release it just received. Putting it in `accounts.db` would mix
  immutable build-time data with mutable user data in the one file that has a
  backup timer: restoring yesterday's accounts would roll back the scouts.
- **A `/api/scout-history` endpoint** — the `/api/squads` pattern, and the only
  real contender. It keeps the payload off the bundle for everyone who never
  opens a Painel, at the cost of a fetch, a loading state and an offline failure
  mode on a section whose current guarantee is that it **cannot fail**. At
  5.7 kB gzip it buys nothing. It becomes correct at roughly 100 kB gzip.
- **Postgres, DuckDB/Parquet** — a daemon, a backup story and a failure mode on
  a `t3.micro` with 1 GiB of burstable RAM, for 3,800 numbers.

**Where the answer flips**, so the threshold is written down rather than
rediscovered (synthetic data at realistic magnitudes, gzip -9):

| Granularity | numbers | raw | gzip |
|---|---|---|---|
| clubs, 1 season, 5 counters | 3,800 | 12 kB | 5 kB |
| clubs, 5 seasons | 19,000 | 62 kB | 24 kB |
| **players**, 1 season, 20 counters | 684,000 | 1.9 MB | 722 kB |
| **players**, 5 seasons | 3.4 M | 9.7 MB | 3.5 MB |

Club-level stays a file at any season count. **Per-player is where SQLite starts
to matter** — and it would be a second, read-only database shipped in the
tarball, never `accounts.db`.

### Decision 5 — a separate data file, and only the counters the scatters draw

`src/data/club-scouts-history.ts`, not an extra export on `club-scouts.ts`. The
season aggregate is read by every Painel; the history is read only by the two
scatters, and splitting them keeps the option of moving *only* the history
behind an endpoint later without touching the section that must not fail.

The tuple carries `[matches, goals, shotsSaved, shotsOff, shotsWoodwork, saves]`
— six numbers, because that is exactly what `SCATTER_PAIRS`' three axes
(`finishes`, `conversion`, `saves`) need. `tackles`, `foulsCommitted`,
`yellowCards` and `redCards` are **left out**: nothing draws them over time, and
adding a pairing on one of them is a generator edit plus a resync, not a
migration.

**`matches` is carried rather than derived**, though `computeRankHistory`
already knows each club's `played` per round on the client. Two reasons: the
section's guarantee is that it reads one committed file and cannot fail, and a
denominator computed in two places is how the generator and the page come to
disagree about what rodada 12 was.

---

## Phase 0 — ground truth before any edit

Nothing here changes a file. It exists because two of the traps below cost real
time when they fire.

1. Cut the worktree **from `origin/main` first**, then start:

   ```
   git fetch origin
   git worktree add .claude/worktrees/scatter-trail -b worktree-scatter-trail origin/main
   ```

2. Record what `origin/main` is, and what `CLUB_SCOUTS_THROUGH_ROUND` says
   today, in the branch's first note. Both move under you.

3. **Know the local e2e hazard before you meet it.**
   `.claude/worktrees/COORDINATION.md` records ~85 e2e specs failing on this
   machine at an *unmodified* `origin/main` — every one a `page.goto` timeout,
   never an assertion. The cause was measured: the club lists hotlink twenty
   crests from `crests.football-data.org`, which was answering in 1.4–2.6 s
   each against a 30 s `load` timeout. **If you see a wall of red locally, cut a
   detached worktree at `origin/main` and compare before spending an hour on
   your own diff.**

4. Decide whether a resync is wanted at all this week. **If it is, land it as its
   own commit** — a reviewer cannot see a component change through 800 lines of
   regenerated numbers.

**Acceptance:** a worktree at `origin/main`, `npm run lint` and
`npm run test:unit` green before anything is touched.

---

## Phase 1 — the generator emits history

**File:** `scripts/sync-cartola-scouts.ts`

`accumulate(snapshots)` already walks the snapshots in order and mutates a
`Map<string, ClubScouts>`. Capture the state after each index.

1. Change `accumulate` to return `{ totals, history }` rather than `totals`.
2. After each `snapshots.forEach` iteration, append a row per club for that
   round.
3. Set each row's `matches` from `playedThrough(code, index + 1)` — the function
   already takes the round and is currently only called with `snapshots.length`.

**The trap that will bite, and it fails silently.** `totals` holds *mutated
objects*: `entry[field] += delta` writes through the same reference every round.
Pushing `entry` into a history array stores an alias, so every round of every
club ends up holding the **final** totals — a perfectly flat trail that looks
like a club with no form. **Copy the counters at capture time.** The Phase 6
"non-decreasing, and strictly increasing somewhere" test exists to catch exactly
this.

Second, smaller: emit a row for **all twenty clubs** at every round, not only
the clubs present in `totals`. In practice every club appears in every market
file from round 1, so this is defensive — but a missing club-round is a hole the
component would have to guess about.

4. Extend `validate()`: the last round of every club's history must equal that
   club's entry in `totals`, field for field. Refuse to write on mismatch, in
   the spirit of the checks already there.
5. Add a `write` for the second file (Phase 2's shape), and extend the closing
   log line to name both files and the rodada.

**Acceptance:** `npx tsx scripts/sync-cartola-scouts.ts` writes both files;
`validate()` refuses a deliberately corrupted history; the script's console
output names both.

**Cost:** ~25–40 lines. Needs network (25–38 requests to
`raw.githubusercontent.com`, already rate-limited by a 120 ms sleep).

---

## Phase 2 — the data file and the type

**Files:** `src/data/club-scouts-history.ts` (generated), `src/types.ts`

Shape:

```ts
/** [matches, goals, shotsSaved, shotsOff, shotsWoodwork, saves] */
export type ScoutHistoryEntry = readonly [number, number, number, number, number, number];

/** Keyed by club code; index 0 is rodada 1. */
export const CLUB_SCOUTS_HISTORY: Record<ClubCode, ScoutHistoryEntry[]>;

export const CLUB_SCOUTS_HISTORY_THROUGH_ROUND: number;
```

Three things about this that are decisions:

- **Tuples, not objects.** 12.6 kB on disk against 76.5 kB, 5.7 vs 9.3 kB
  gzipped. `rank-history.ts`'s pretty one-object-per-round style is right for 25
  rows a person reads and wrong for 760 nobody will. The field order lives in a
  doc comment on the type, and `tsc --noEmit` (the `lint` script) holds the
  arity.
- **The round is the index**, not a field. A `round` that can disagree with its
  own position is a second source of truth for the same fact.
- **`CLUB_SCOUTS_HISTORY_THROUGH_ROUND` is written from the same variable as
  `CLUB_SCOUTS_THROUGH_ROUND`** in the same run. Two files that can claim
  different rodadas is the whole reason they are generated together.

Carry the same header the other generated files carry: GENERATED, the command to
regenerate, the source, the date, and the stale-by-construction note.

**Acceptance:** `npm run lint` passes; the file's last round reproduces
`CLUB_SCOUTS` exactly (asserted in Phase 6, not by eye).

---

## Phase 3 — `scatterTrail` in `scouts-core.ts`

**File:** `scouts-core.ts` (pure, no clock, no I/O — keep it that way)

```ts
export interface TrailPoint {
  round: number;
  x: number;
  y: number;
  /** Position in the scatter's own padded domain, clamped to [0, 1]. */
  atX: number;
  atY: number;
}

export function scatterTrail(
  history: Record<ClubCode, ScoutHistoryEntry[]>,
  clubCode: ClubCode,
  scatter: ProfileScatter,
): TrailPoint[];
```

**Taking the built `ProfileScatter` is Decision 2 made structural** — the
function has no way to compute a domain, so it cannot drift from the drawing it
is placed on.

Work to do inside:

1. **Extract the rate calculation first.** `rawValue(scouts, id)` currently
   embeds two rules that must not exist twice: `finishes` adds **four**
   counters, and conversion at zero shots is an **absence**, not 0%. Refactor to
   a shared `rateFrom(counters, id)` that both `rawValue` and the trail call.
   Doing the trail's arithmetic separately is how the scatter and the trail come
   to disagree about what a conversion is.
2. Drop entries with `matches < MIN_TRAIL_MATCHES` (**5**, a named constant with
   the reason beside it).
3. Drop entries whose rate is `null` for either axis.
4. Map to the domain with the axis's own `(value - min) / (max - min)`, then
   `Math.min(1, Math.max(0, …))`.
5. Return `[]` for an unknown club, an absent history, or **fewer than two**
   usable points — a one-point trail is the current dot drawn twice.

**Acceptance:** unit tests in Phase 6; `scouts-core.ts` still imports nothing
but types.

---

## Phase 4 — the drawing

**File:** `src/components/ProfileScatter.tsx` (`BOX` is 320×200 units,
`DOT.subject` is 6.5)

Draw order — the trail belongs to the subject and must not be occluded, but must
not cover the current mark either:

```
quadrant shading → median lines → other clubs' dots → trail → subject dot
```

**Per-segment polylines, not one line.** A single `<polyline>` cannot fade along
its length without an SVG gradient. Emit one `<line>` (or two-point polyline)
per consecutive pair, with opacity ramping from ~0.15 at the oldest segment to
~0.6 at the newest. That gives the direction of travel without an arrowhead and
without a legend. Stroke is the subject's colour; `strokeWidth` ~1.25 in box
units; `strokeLinecap="round"`.

**No per-round dots**, or the trail beads. One small marker (r ≈ 2) at the
oldest drawn point anchors where the reading starts; the existing bold dot is
the end.

If the ramp reads badly on a real club, the fallback is a single constant-opacity
polyline at ~0.35 — decide that by looking, not by argument.

**Accessibility — two existing constraints to respect:**

- The svg is a single `role="img"` with a generated `aria-label`, and there is a
  test that finds `svg[role='img']` and counts what it sees. **Do not add a
  second labelled svg.** Every trail element is `aria-hidden="true"`, and the
  movement reaches a screen reader through the caption (Phase 5) instead.
- `tests/e2e/painel.spec.ts` measures the drawing's box against the panel's.
  Clamping (Decision 3) is what keeps that true; do not skip it because the
  current data happens to fit.

**No toggle in v1.** The trail is the reading, not an option.

**Acceptance:** screenshots of a Painel in light and dark, at desktop and at the
mobile width, for one club that has moved a lot (Coritiba) and one that has
barely moved. A person looks at them. The drawing stays inside its panel.

---

## Phase 5 — the words

Mechanism goes in code comments and `CLAUDE.md`; vocabulary goes in
`CONTEXT.md`; the caveat goes to the **reader**.

1. **The mark is called `rastro`, and that is settled** — chosen 2026-09-03 over
   `trilha`, which reads as a path someone follows rather than one a club left
   behind. **Add it to `CONTEXT.md` beside the two pairings**
   (`ataque × defesa`, `volume × conversão`) as the first edit of Phase 5, so the
   component, the caption and the tests cannot end up using three words for one
   mark. Identifiers in `scouts-core.ts` stay English (`scatterTrail`,
   `TrailPoint`) like every other `*-core` export; `rastro` is what the **page**
   says.

2. **The caption owes the reader three facts**, and none of them is optional:
   - the trail is **cumulative through each rodada**, not a rodada's own figures;
   - the **frame and the corner names are today's division** (Decision 2);
   - **where it starts** — the fifth match, not the first.

   One sentence in the existing figcaption column, at caption weight. It must
   not restate a figure the drawing already shows.

3. **`CLAUDE.md`** — extend the `scouts-core.ts` section with the trail, the
   frozen-domain rule and the cumulative-not-per-rodada reason. This is where a
   future session looks first.

4. **`docs/perfil-ataque.md` — do NOT append an entry for this branch.** That
   log is for *editorial readings* under Rule 1, and this is mechanism. Two live
   traps if someone appends anyway: `tests/scouts-core.test.ts` asserts the
   `## Rodada N` headings run **strictly downward with no duplicate**, so an
   entry for a rodada already at the top goes red; and the same file refuses a
   decimal, a percentage or a `Nº` rank anywhere below the first heading.

---

## Phase 6 — tests

**Register the new unit test file in `package.json`'s `test:unit` script.** It is
an explicit space-separated file list, not a glob. A file left out of it runs
nowhere and looks green.

`tests/scouts-core.test.ts` (or a new `tests/scout-history.test.ts`):

- **The last round reproduces the aggregate.** For every club, the final history
  entry equals `CLUB_SCOUTS` field for field. This is the strongest check
  available — it catches Phase 1's aliasing bug, a denominator drift, and a
  history file regenerated against a different rodada than the aggregate.
- **Cumulative means non-decreasing.** Every counter is `>=` its predecessor
  along a club's row, and **strictly greater somewhere** — the second half is
  what fails on the aliasing bug, which produces a perfectly flat row that
  passes "non-decreasing".
- **Shape:** every club has an entry for rounds 1..`THROUGH_ROUND`, every tuple
  has six numbers, `CLUB_SCOUTS_HISTORY_THROUGH_ROUND === CLUB_SCOUTS_THROUGH_ROUND`.
- **`scatterTrail` on the frozen domain:** its final point's `atX`/`atY` equal
  the subject's own `ScatterPoint` in the same `ProfileScatter`.
- **Clamping:** a synthetic club with a wild round-6 rate lands at exactly 0 or
  1, never outside.
- **The floor:** a club with four matches yields `[]`; unknown club yields `[]`;
  a club with exactly one usable point yields `[]`.

`tests/e2e/painel.spec.ts`:

- the trail renders on a club with enough matches (query within
  `[data-scatter-svg="ataque-defesa"]`);
- the drawing's bounding box is still inside the panel's — the existing
  assertion, re-run with the trail present.

---

## Phase 7 — ship

1. `npm run lint` (`tsc --noEmit`), `npm run test:unit`, then `npm run test:e2e`
   — remembering Phase 0's crest hazard before blaming the diff.
2. Commits, in this order, so the review is readable:
   - the generator + the generated file (data),
   - `scouts-core.ts` + tests (logic),
   - the component + caption + docs (drawing).
3. PR against `main`. CI must be green on all three checks.
4. After merge, remove the worktree, the local branch **and** the remote ref, and
   verify by listing state rather than by exit code.

---

## Deliberately not in scope

- **Trails for all twenty clubs**, or a hover that shows another club's trail.
- **A per-rodada view** of any kind — the source cannot support it, and this
  plan exists partly to record that.
- **Animation.** A trail that draws itself is a motion decision, and
  `tests/e2e/motion.spec.ts` has opinions about reduced motion that this branch
  should not have to satisfy.
- **Backfilling seasons before 2026.**
- **Deleting `src/data/rank-history.ts`.** Worth noting for whoever wants it:
  that file is 30.7 kB and 647 lines, generated by `npm run sync-rank-history`,
  and `RANK_HISTORY` is imported by **nothing** — the app derives the same thing
  at runtime through `computeRankHistory` from `/api/matches`. It carries a
  "regenerate after every `sync-seed-data`" obligation in `CLAUDE.md` that no
  consumer needs. It is a separate PR and it is cheap.

## Rollback

The drawing is additive: reverting the component commit alone restores today's
scatters with the data file harmlessly present. The data file has no runtime
consumer until Phase 4 lands, so Phases 1–3 can merge on their own if the
drawing needs more work.
