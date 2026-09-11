# DRY Guide

Adapted for Portal Brasileirão from `doc_template_lib/code_quality/DRY_GUIDE.md`.

## Goal

Each fact has one authoritative home. This repository states the rule as a
prediction rather than a principle, and the sentence recurs across a dozen files:
**the second copy is where drift starts.**

## Three shapes of answer

Not every duplication can be extracted. Here it is closed one of three ways, and
picking the wrong one is the usual mistake.

### 1. Extract — where one module can own the fact

- **`src/components/StatusChip.tsx`** is the canonical case. The fixture list and the match page
  each carried their own copy of the label map *and* the colour map — identical,
  four values apiece, in two files. Two copies of a lookup table is how a new
  status renders in one place and blank in the other.
- **`slugify`** lives in `club-core.ts` and `venue-core.ts` imports it rather
  than writing a second normaliser, which is what makes `ARENA MRV` and
  `Arena MRV` one stadium rather than two.
- **`countdownLabel`** lives in `live-core.ts` and `next-match-core.ts`
  deliberately does not reimplement it, so the **Meu time** strip and the
  **Ao vivo** board say the same words about the same fixture. The sibling repo
  this was modelled on ships two functions named `formatCountdown` in two
  modules — the drift `StatusChip` exists to prevent, already realised.
- **`commons-core.ts`** holds the licence judgement and is shared by the sync
  scripts and the checkers, because a second copy of that judgement is how a
  checker comes to pass a file the sync refuses.
- **`PHOTO_WIDTHS`** lives in `venue-core.ts` rather than beside the `<img>`,
  because `sync-stadium-photos` writes exactly those files and two copies of the
  list is how the page comes to request a size nobody vendored — failing as a
  missing image rather than as a build error.

**The drift is not hypothetical.** `scripts/commons-api.ts` was extracted when a
fourth Commons script would have made a fourth copy of the HTTP half — and the
two stadium copies that already existed **had diverged**: one asked Commons for
`ImageDescription` and the other did not.

**And it kept happening after that extraction.** An audit of this guide against
the code on 2026-09-11 found three more copies that had already drifted: the
broadcaster marks' sync still carrying its own Commons client — its own user
agent, fetch and HTML stripper — beside the shared one; the plain-click guard
written out at every in-app link, with the button check missing from some
copies; and the CBF listing walk copied between two syncs that no longer paced
alike. Each now has one home: `scripts/commons-api.ts` (with the marks' licence
rule as `publicDomain` in `commons-core.ts`), `isPlainClick` in
`src/components/plainClick.ts`, and `cbfFixtureListing` in `scripts/cbf-api.ts`.

### 2. Generate — where the fact is derived

- `src/index.css`'s palette is emitted by `npm run sync-md3-tokens`. Do not
  hand-edit between the `MD3-TOKENS` markers; `npm run test:tokens` fails if the
  file has drifted from the generator.
- `src/data/clubs.ts`, `src/data/matches.ts`, `src/data/squads.ts` and `src/data/rank-history.ts` are
  generated. A hand-edit is overwritten by the next sync **without a word**,
  which is the entire reason `src/data/player-overrides.ts` and
  `src/data/coach-overrides.ts` exist: a correction that must survive
  regeneration lives beside the generated file, never inside it.
- `scripts/sync-goals-files.ts` renders both of its run's data files rather than
  each sync carrying a heredoc. That is what stopped the writer enumerating
  fields by hand — adding `Substitution.onShirt` to the type once left the sync
  emitting the three fields it already knew, so a resync produced a file
  identical to the one it replaced and the new field looked broken rather than
  unwritten.

### 3. Gate — where the copies genuinely cannot import from each other

Sometimes a fact must appear in several files that no module graph connects. Then
the answer is a test that fails when they disagree.

- **The Node major is named in several places** — `.nvmrc`, `package.json`'s
  `engines`, the `@types/node` devDependency, `REQUIRED_NODE_MAJOR` in
  `shell_scripts/01_setup_app_directory.sh`, and the `node-version-file` of every
  workflow that sets up Node. `tests/node-version.test.ts` reads `.nvmrc` as the
  authority and compares the rest to it, and it **finds** the workflows by
  `actions/setup-node` rather than naming them. It used to name them, and that
  list had fallen behind the workflows it was meant to cover — a hand-kept list
  inside the gate that exists to replace hand-keeping. Moving Node is a
  deliberate commit starting at `.nvmrc`; before the gate, each of the others
  could move alone.
- **The appearance-path list** is computed rather than hand-kept:
  `tests/appearance-paths.test.ts` asserts the property — *every root core module
  `src/` imports is a watched path* — and runs the other way too, so the list
  cannot accumulate entries for modules nothing imports any more. The one-file
  fix that preceded it closed one instance and left the mechanism intact.
- **`STICKY_CLUB`'s `left-*` must equal `STICKY_POSITION`'s `w-*`.** Two Tailwind
  class strings that cannot reference each other. Three specs in
  `tests/e2e/standings.spec.ts` scroll a 380 px viewport and check the pairing,
  because ordinary table layout puts the two columns adjacent either way and only
  a scrolled screen reveals the gap.

## The rule that is easy to get backwards

DRY says merge; [HIGH_COHESION_GUIDE.md](./HIGH_COHESION_GUIDE.md) says keep
apart. They meet at one question: **do these two pieces of code answer the same
question, or do they merely have the same shape?**

`clubFocus` (`next-match-core.ts`) and `nextFixture` (`club-core.ts`) have the
same shape and answer different questions — one has a clock, one does not — and
merging them would be wrong. The `StatusChip` label maps had the same shape and
answered the same question, and keeping them apart was wrong.

## A number in prose is a copy with no gate on it

This repository's most reliable source of drift is not code. It is a count
written into documentation that nothing recomputes:

- The sitemap URL count read **442** for months, then 463, then **488**. Each
  repair was correct when written. "A number repaired once is not a number that
  stays repaired."
- The screenshot capture count said sixteen through two increases to twenty.
- The volatile-capture count said eight while the enumeration beneath it named
  ten, and *the total added up*, which is why nobody looked again.

So: **cite the command, not the number.**

```sh
curl -sf "$APP_URL/sitemap.xml" | grep -c '<loc>'
git ls-tree --name-only origin/main docs/screenshots/ | wc -l
```

## Required rules

1. **Extract at the second call site**, and take the whole contract with it — see
   `WikipediaLink` in [HIGH_COHESION_GUIDE.md](./HIGH_COHESION_GUIDE.md).
2. **Never hand-edit a generated file.** If a value must survive regeneration, it
   belongs in an overrides file applied at serve time.
3. **A fact repeated across files that cannot import each other owes a test**, not
   a "keep in sync" comment.
4. **Apply a correction in every branch that can serve it.** `withGoals`,
   `withSquadOverrides` and `withCoachOverrides` run inside *both* cache fills;
   `withCoachOverrides` has **five** application sites and no compiler can see
   that it needs all five — `tests/e2e/coaches.spec.ts` is what makes five a rule.
5. **Do not write a count into prose.** Write the command that produces it.
6. **`src/types.ts` is the single source of truth for shared shapes.** Extend it
   before adding fields to data files or components.

## Current reality

- **The generated-file boundary is convention.** Nothing stops a hand-edit to
  `src/data/squads.ts`; the next sync silently reverts it. The overrides files
  are the designed answer and their doc comments say so.
- **Documentation duplication is the live problem, not code duplication.**
  `CLAUDE.md` is the authority and is very large; this guide set exists partly to
  give principles a home that is citable in review. Where the two disagree,
  `CLAUDE.md` is authoritative and this file should be corrected.
- **Agreement gates exist, and most cross-file facts still have none.** Beside
  the Node gate, `tests/appearance-paths.test.ts`, `tests/e2e-fixture.test.ts`
  and the seed-reach case in `tests/scouts-core.test.ts` each hold a property
  across files that no import connects. Still ungated: the deploy directory
  written into the shell scripts, the AWS identifiers written into the
  workflows, and the rehearsal and curated-data checker lists in the workflows
  against the scripts they run.

## Review heuristics

**Single-source test.** If this fact changes, how many files must change? More
than one means either an extraction or a gate is owed.

**Drift test.** Are the copies still identical? If they have diverged, one is
already wrong and the duplication is a defect rather than a risk.

**Sync-comment test.** Does a comment say "keep in sync with"? Replace it with a
test or an import. The three legitimate survivors here — the sticky columns, the
Node major, the appearance paths — all carry a gate, not a comment.

**Generated-file test.** Is there a `sync-*` script that writes this file? Then
your edit belongs somewhere else.

**Number test.** Does the change add a count to a comment or to Markdown? Replace
it with the command.

## Positive signals

- A new curated file reaches every route through one merge function.
- A checker and the sync it checks import the same judgement module.
- A prose claim about "how many" carries the command that produced it.
- A cross-file constraint has a failing test rather than a comment.

## Warning signs

- A lookup table appearing in two components.
- A second normaliser, formatter or URL builder for a value that already has one.
- A hand-edit inside a generated file.
- "Keep in sync with" anywhere.
- A count in a comment, a README or `CLAUDE.md`.
- A correction applied in one of two cache branches.

## Related guides

- [HIGH_COHESION_GUIDE.md](./HIGH_COHESION_GUIDE.md) — when two similar things must stay apart.
- [CLEAN_ARCHITECTURE_GUIDE.md](./CLEAN_ARCHITECTURE_GUIDE.md) — the judgement/transport split, which is DRY applied to a boundary.
- [NAMING_GUIDE.md](./NAMING_GUIDE.md) — an extracted concept needs a name before it has a home.
- [UNIT_TEST_GUIDE.md](./UNIT_TEST_GUIDE.md) — how to write the gate a cross-file fact owes.

## Checklist

- [ ] The fact has exactly one authoritative home, or a test asserting its copies agree.
- [ ] No hand-edit inside a generated file.
- [ ] No "keep in sync with" comment introduced.
- [ ] A correction is applied in every branch and route that can serve it.
- [ ] No new count written into prose.
- [ ] Two similar functions that stayed separate answer different questions.
