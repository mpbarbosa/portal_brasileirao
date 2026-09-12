# Unit Test Guide

Adapted for Portal Brasileirão from `doc_template_lib/code_quality/UNIT_TEST_GUIDE.md`.

## Goal

Verify one behaviour with literal inputs, no server and no network. This is the
suite that runs in a second and gates every commit.

## What a unit test is here

`node:test` and `node:assert/strict`, run through `tsx`. **There is no test
framework** — no Jest, no Vitest, no `describe`, no `expect`, no mocking library.
A test file opens:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
```

The unit is almost always a function exported from a root `*-core.ts` module, and
it is testable with literal arguments because those modules perform no I/O and
take `now` as a parameter — see
[REFERENTIAL_TRANSPARENCY.md](./REFERENTIAL_TRANSPARENCY.md).

```sh
npm run test:unit                                    # the whole suite
node --import tsx --test tests/standings-core.test.ts # one file
node --import tsx --test --test-name-pattern "tie-breakers" tests/standings-core.test.ts
npm run lint                                          # tsc --noEmit — the only lint gate
```

## The trap that costs a new test its existence

**`test:unit` lists its test files explicitly.** A new `tests/*.test.ts` does
**not** run until it is added to that script in `package.json`. Nothing reports
this: the file exists, it passes when run by hand, and it is simply never
executed by anything.

Check it rather than remembering it. **Do not trust a count written here** —
this line read *62 files, 62 listed* while there were 79 of each, and a number
in prose has no gate on it. Run the command; a clean `diff` is the whole answer:

```sh
diff <(git ls-files 'tests/*.test.ts' | sed 's|tests/||' | LC_ALL=C sort) \
     <(node -e 'process.stdout.write(require("./package.json").scripts["test:unit"].split(/\s+/).filter(w=>w.endsWith(".test.ts")).map(w=>w.replace("tests/","")).join("\n")+"\n")' | LC_ALL=C sort)
```

`LC_ALL=C` on **both** sides is what makes the two orderings comparable. Read it
as a pairing rather than as a flag: the command as written pipes each side through
the shell's own `sort` and calls `Array.prototype.sort` nowhere, so dropping the
flag from both sides changes nothing — measured, no difference reported. It earns
its place the moment one side sorts somewhere else, which is how this check is
usually re-written.

The disagreement is real and this guide named the wrong pair for it. C, en_US.UTF-8
and `Array.prototype.sort` **all** put `match-core.test.ts` before
`matches-core.test.ts`; what they split on is `match-state-store.test.ts`, which
en_US files *after* `matches-core.test.ts` (its collation ignores the hyphen) while
C and JS — both code-unit order — file it *before*. So C and `Array.prototype.sort`
agree with each other and en_US is the outlier, which is the opposite of what the
sentence this replaces claimed.

## Confirm the test red before believing it

This is the practice that distinguishes this suite, and it is not optional
rigour — it has caught tests that could not fail:

- **`tests/scouts-core.test.ts`** checked that four quadrant names were distinct
  using a `Set`. When `corners` became `{ term, gloss }` objects, **a `Set` of
  four objects has four members whatever they contain** — so the distinctness
  case would have passed against anything. It now checks the two halves
  separately.
- **`tests/e2e/escalacoes.spec.ts`** carried a case whose own title claimed each
  side *"names a goalkeeper"*. It passed because the single fixture it opened
  happened to be flagged correctly; four sides of the season are not.
- **`tests/youtube-upload-core.test.ts`** had six mutations confirmed red, and
  **two of them passed** against the first version of its tests. Two fixtures
  exist specifically to fix that.
- **`tests/check-screenshots.test.ts`**'s first merge fixture merged a branch
  into a `main` that had not moved. The merge is then TREESAME to its parent, git
  never lists it, and there was nothing for the gate to get wrong. **A fixture
  simpler than this repository can be too simple to contain the bug.**

So: break the code on purpose, watch the named test go red, then fix it. Record
what you mutated **in the test file**, which is where the next reader is standing.
13 of the 79 files do; recount rather than citing that, for the reason the file
count above gives:

```sh
git grep -lEi 'mutation|mutated|confirmed red' -- 'tests/*.test.ts' | wc -l
```

The gap is not evenly spread, and one instance is worth naming because this guide
is half of it: the blind spot in the permutation property below is written down
*here* and in `CLAUDE.md`, and **not** in `tests/rank-history-core.test.ts`.

**And know which of your tests can go red, and when.** When `retractsResult`
landed, only two of its eight cases failed with the rule switched off; the other
six exist to fail if the rule is ever made *broader*, and they pass with it off
by construction. That is a legitimate design and it is worth writing down, or the
next reader mistakes six passing tests for six units of coverage.

## Fixtures must be able to contain the bug

`tests/escalacao-core.test.ts` builds its fixtures with **string** booleans —
`reserva: "false"` — because CBF sends strings and real booleans would make every
test pass against the bug the module exists to prevent.

The general rule: a fixture built from what the code *expects* tests nothing. Build
it from what the source actually sends, traps included.

## Never assert how much curated data exists

This broke CI **twice**:

- A test counted the fixtures carrying broadcast data. `sync-broadcasts` runs
  weekly and the count moved.
- `tests/e2e/goals.spec.ts` pinned fixture `554977` as "the match with no
  minute", on a comment reading *"554977 predates the join"*. A later
  `sync-goals` gave it one.

Assert the **shape** of a rendered line, or **produce the state with a prepared
payload**. That spec now constructs the condition rather than hunting the season
for a fixture in it — `openWithGoals` serves a payload whose goals have had their
minute dropped, so the minuteless state exists because the test made it.
(There is no `withoutGoals`; this guide named one for months.)

**It is a gate now, not only a habit.** `tests/e2e-fixture.test.ts` refuses a spec
that opens a fixture by a literal id, so *which record happens to hold a value* is
checked by a test rather than caught in review.

## Tests that are gates over files rather than over functions

A substantial share of this suite asserts facts about the repository, because no
compiler can:

| Test | What it refuses |
| --- | --- |
| `tests/node-version.test.ts` | The five Node declarations disagreeing |
| `tests/appearance-paths.test.ts` | A root core module `src/` imports being unwatched — and the list keeping dead entries |
| `tests/design-tokens-core.test.ts` | A palette shade, Tailwind radius, bare type step, `tracking-*`, `duration-*`, hand-written `hover:`, or bare `shadow-*` under `src/` |
| `tests/core-purity.test.ts` | Any root `*-core.ts` reaching I/O, the clock, the environment or entropy — the premise this whole suite rests on |
| `tests/e2e-fixture.test.ts` | A spec importing `test` from `@playwright/test`, skipping itself, opening a fixture by a **literal id**, or not installing its own clock |
| `tests/player-photos.test.ts` | A photograph with an empty credit — the compiler accepts `""`, the page shows a missing attribution |
| `tests/youtube-upload-core.test.ts` | A real `docs/medias/**/*-youtube.md` exceeding YouTube's limits |
| `tests/button-classes.test.ts`, `tests/scatter-corner.test.ts` | A class string no browser spec can reach |

`tests/design-tokens-core.test.ts` is a **grep**, deliberately: this repo has no
ESLint by choice, and acquiring one to police seven string patterns costs a
dependency, a config and a plugin API. Two details there are load-bearing —
comments are stripped before the rules run (half the value of those files is
prose naming the utility it replaced), and the stripper is hand-written because
`https://` is not a comment and mistaking it for one blanks the rest of a real
line, which is a false **negative**.

## Prefer a property to a list of cases

`tests/rank-history-core.test.ts` asserts something the per-club cases cannot
see: **every place climbed is a place another club fell**, because a round's
positions are a permutation.

Note the bound, which was found by mutation: flipping the direction comparison
swaps which total is which and **leaves them equal**, so the property does not
catch it. A property is a strong test and not a complete one.

## Real subjects, sandboxed

Where the unit is a script rather than a function,
`tests/check-screenshots.test.ts` builds **real git histories in temporary
directories and runs the real script** through a `Sandbox` class. That is still a
unit test by the definition that matters here: hermetic, deterministic, no
network, and fast.

The shell equivalents live in `scripts/rehearse-*.sh` and run in CI's `check`
job. They are outside `test:unit` because they are bash.

## Never pipe a test run through `head` or `tail`

Two things fail together. A **pipeline's exit status is the last command's**, so
`npx playwright test | tail` exits 0 however many specs failed — and the failure
list prints *before* the `N passed` summary, so the last four lines of a failing
run look exactly like a passing one. Measured: two runs read through `| tail -4`,
`758 passed` both times, and a red `main` skipped every deploy for twenty minutes.

Write the run to a file and grep for `failed`, or use `--reporter=line`. Either
way check the exit status of **the test command itself**.

## Required rules

1. **Add the new file to `test:unit`** in the same commit.
2. **Confirm the test red by mutation** before believing it; say in the file what
   you mutated.
3. **Build fixtures from what the source sends**, including its traps.
4. **Never assert a count of curated data**, or that a specific record holds a
   specific value. Prepare the state instead.
5. **Name the scenario and the outcome**, and make sure the name is true of the
   fixture the test actually opens.
6. **Test the error path.** Every refusal a module makes deserves a case.
7. **Assert `null` explicitly** where `0` is a legal value.
8. **Do not pipe the run.**

## Current reality

- **Every test file is listed**, and the suite is green — 1410 tests, 0 failures,
  3.3 s (measured 2026-09-12 at `5eb3597` — it is not *one* second). About half
  of that is `tests/check-screenshots.test.ts` alone, 1.6 s run on its own,
  because it builds real git histories; the rest of the files are ~0.13 s each,
  which is mostly `tsx` starting up.
  Run the `diff` above for the count rather than reading one here.
- **57 root core modules, and 56 have a same-named test file.** The exception is
  `brand-core.ts`, tested by `tests/brand-mark.test.ts` — so the convention is the
  filename, not the coverage.
- **47 of the 57 core modules are at 100% line coverage**, measured rather than
  estimated (see below). The thinnest is `structured-data-core.ts` — 95.00 lines,
  **73.85 branch** — then `page-meta-core.ts` 95.88 and `highlight-search-core.ts`
  97.30/81.58. The largest module is `scouts-core.ts` (852 lines), then
  `club-core.ts` (711) and `season-sim-core.ts` (686).
- **This bullet has now been wrong twice, both times from a proxy.** It first named
  `season-sim-core.ts` and `club-core.ts` as the two largest and the thin ones;
  the correction then ranked thinness by **test lines over source lines** and named
  `youtube-core.ts`, `cartola-csv-core.ts` and `md3-color-core.ts`. A real coverage
  run puts those three at **100.00, 100.00 and 99.08** — among the best covered in
  the repository. A file-length ratio measures how much was typed, not what was
  reached; do not rank coverage with it, and do not trust the ranking above without
  re-running the command.
- **There is no coverage *gate*** — no `c8`, no threshold, no report in CI, and
  coverage is argued case by case in review. But it is **one flag away**, which the
  paragraph this replaces did not say, and is worth running before claiming a module
  is thin:

  ```sh
  node -e 'const s=require("./package.json").scripts["test:unit"];console.log(s.replace("--test","--test --experimental-test-coverage"))' | sh
  ```

  Read the percentages and **not** the uncovered-line list: under `tsx` the line
  numbers come back offset, so a line it names may be running perfectly. And read
  even a 100% as what it is — `teamNode` in `structured-data-core.ts` was called by
  five tests with only its `sameAs` asserted, so changing `sport` to a nonsense
  string left the file green. **Execution is not assertion, and coverage cannot
  tell the two apart.** Mutation can; that is what §Confirm the test red is for.
- **There is no mocking library and no need for one**, because the units take
  their inputs as arguments. Where a double is needed it is a literal object or a
  small function.
- **`npm run lint` is `tsc --noEmit` and nothing else.** A type says nothing about
  a value that arrived over the wire — see
  [DEFENSIVE_CODING_GUIDE.md](./DEFENSIVE_CODING_GUIDE.md).

## Review heuristics

**Registration test.** Is the new file in `test:unit`?

**Mutation test.** Break the line the test names. Does it go red?

**Vacuity test.** Could this assertion pass against *anything*? A `Set` of
objects, a `toBeTruthy`, an `expect.poll` for an absence.

**Fixture test.** Does the fixture reproduce the source's actual shape, or an
idealised one?

**Drift test.** Will this still pass after the next `sync-*` run?

**Title test.** Is the test's name true of the fixture it opens, or only of the
one case that happens to be flagged correctly?

## Positive signals

- The test constructs its inputs literally and asserts a value.
- The file records which mutations were confirmed red.
- A prepared payload produces the condition rather than a search for a record in it.
- A property assertion sits beside the per-case ones, with its blind spot named.

## Warning signs

- A new `tests/*.test.ts` absent from `test:unit`.
- An assertion on how many curated records exist, or on which one holds a value.
- A `Set` of objects used for a distinctness check.
- A fixture using real booleans where the provider sends strings.
- A test nobody has watched fail.
- A test run read through `head` or `tail`.

## Related guides

- [REFERENTIAL_TRANSPARENCY.md](./REFERENTIAL_TRANSPARENCY.md) — why these units need no setup.
- [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md) — the other suite, and what it cannot see.
- [DEFENSIVE_CODING_GUIDE.md](./DEFENSIVE_CODING_GUIDE.md) — every refusal deserves a case.
- [CLEAN_ARCHITECTURE_GUIDE.md](./CLEAN_ARCHITECTURE_GUIDE.md) — the split that makes this suite possible.

## Checklist

- [ ] The file is listed in `test:unit`.
- [ ] The test was confirmed red by mutation, and the mutation is recorded.
- [ ] The fixture reproduces the source's real shape.
- [ ] No assertion depends on how much curated data exists.
- [ ] Error paths and refusals are covered, not only the happy path.
- [ ] `null` and `0` are distinguished.
- [ ] The test's title is true of the fixture it opens.
