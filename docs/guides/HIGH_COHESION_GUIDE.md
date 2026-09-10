# High Cohesion Guide

Adapted for Portal Brasileirão from `doc_template_lib/code_quality/HIGH_COHESION_GUIDE.md`.

## Goal

One subject per module, and a name that says which subject. A core module should
be describable in one sentence without "and".

## What it means here

The root `*-core.ts` modules already pass the one-sentence test by construction,
and their own doc comments are written as that sentence:

| Module | Its one sentence |
| --- | --- |
| `standings-core.ts` | Builds the table from a club list and a match list. |
| `live-core.ts` | The **Ao vivo** board: what is being played, what is next, what just finished. |
| `rank-candles-core.ts` | The **Painel do clube**: the campanha read as a candle per rodada. |
| `venue-core.ts` | The **Página do estádio**: fixtures grouped into grounds. |
| `events-core.ts` | The **Acontecimentos**: what happened off the pitch, dated. |
| `version-core.ts` | Whether the bundle a reader is running is still the one this host serves. |

When a new rule does not fit any of those sentences, it wants a new file, not a
new export on the nearest one.

## The case where "these look the same, merge them" is wrong

This is the rule most likely to be applied backwards here, so it comes first.

`next-match-core.ts` exports `clubFocus` (line 94). `club-core.ts` exports
`nextFixture` (line 271). Both answer *which match is next for this club*, and
neither may be rewritten in terms of the other.

`nextFixture` has **no clock**. It counts a postponed fixture and a kickoff that
passed an hour ago as still to come — which is right for a club's season at a
glance and wrong for a line telling a reader when to sit down. `clubFocus` takes
`now`, prefers a match **in progress** over one that is merely sooner, and reuses
`live-core.ts`'s `LATE_GRACE_MS` rather than picking its own window.

Two functions with the same shape and different questions are **cohesive**. The
duplication that matters is two implementations of *one* question — see
[DRY_GUIDE.md](./DRY_GUIDE.md), which is the other half of this pair and points
the opposite way.

## Two more places the naive reading is wrong

**A file may be named for one of its two outputs.** `scripts/sync-goals.ts`
writes `src/data/goals.ts` **and** `src/data/escalacoes.ts` from one run. That is
not a cohesion failure to fix by splitting: CBF throttles at the socket with no
429, so a second script walking the same listing and re-fetching every match is
the difference between a sync and a ban. Halving the traffic is the requirement;
the surprising name is the cost, and it is stated in both files rather than
renamed.

**A file may be grouped by contract rather than by category.**
`src/components/SectionIcons.tsx` holds `SunIcon`, `MoonIcon`, `WeatherIcon`,
`LinePlotIcon` and `BarsPlotIcon` alongside the five section glyphs, none of
which is a section. They live there because that file owns the one `base`
attribute bag every glyph in this app shares, and a glyph defined beside its call
site drifts from it. The cohesive thing is the shared contract, not the noun in
the filename.

## When something earns its own file

`src/components/ClubLinks.tsx` is the worked example. `WikipediaLink` moved out of `ClubView`
the moment the match page became its **second** caller, and it took the whole
anchor with it — glyph, label, `target`, `rel` and the screen-reader suffix —
because those last three are what drift when a link is copied. `GLYPH`
(`src/components/ClubLinks.tsx:30`) is the shared attribute bag.

The other marks stay local to `src/components/ClubView.tsx` because they still have one call
site each. **That is the rule, not an inconsistency**: extraction is triggered by
a second caller, not by a resemblance.

## Required rules

1. **A core module states its subject in its first doc comment**, in one sentence.
   If the sentence needs "and", split it.
2. **Extract at the second call site, not the first.** One caller is a local
   helper; two is a shared contract that can drift.
3. **When you extract a control, take its whole contract** — not just the markup.
   A copied anchor missing `rel="noopener"` is a real defect that looks identical
   on the page.
4. **`server.ts` may compose; nothing beneath it may.** The composition root is
   allowed to be long. A reusable module is not allowed to be several things.
5. **Do not create a `utils.ts`.** There is none in this repository, and the two
   files that could have become one — `src/components/interaction.ts` and
   `src/components/kickoff.ts` — are named for what they hold.

## Current reality

- **`club-core.ts` is the file to watch.** 1 053 lines and 48 exports: slug
  resolution, `playsIn`, `clubMatches`, `nextFixture`, `resultFor`,
  `withClubDetails`, `withCoachOverrides`, and the URL builders for hymn,
  Discord, Reddit and Wikipedia. Its one sentence would need several "and"s. It
  has not been split, and the argument against splitting is real — every part of
  it is keyed by club, and the URL builders are one-liners over curated files.
  Read it as a known concentration rather than as a pattern to copy.
- **`scouts-core.ts` (805) and `season-sim-core.ts` (686)** are next largest and
  are each genuinely one subject.
- **Nothing enforces this.** `tests/design-tokens-core.test.ts` greps for banned
  utilities; there is no equivalent gate for module size or export count, and
  there probably should not be — a line count cannot tell a concentration from a
  subject that is simply large.

## Review heuristics

**One-sentence test.** Write the doc comment first. If it needs "and", you have
two files.

**Second-caller test.** Is this the second place this markup, constant or rule
appears? Then it moves, whole.

**Question test.** Before merging two similar functions, ask what question each
answers. `clubFocus` and `nextFixture` are the standing proof that the same shape
can be two questions.

**Name test.** Could a reader predict the file's contents from its name? A `-core`
suffix promises purity; a `-store` suffix promises the opposite.

## Positive signals

- A new curated data file arrives with a builder in the core module named for its
  subject, not appended to `club-core.ts` by reflex.
- A component's helpers all serve that component's one area.
- A test file's cases cluster around one behaviour.
- Two similar-looking functions carry comments saying why they are not one.

## Warning signs

- A core module whose doc comment lists what it does.
- An export added to the largest nearby file because it was nearest.
- A mark or control copied to a second call site instead of moved.
- A `helpers.ts`, `utils.ts` or `manager.ts` appearing anywhere.
- A rule inline in a `server.ts` handler that a reviewer would want tested.

## Related guides

- [DRY_GUIDE.md](./DRY_GUIDE.md) — the opposite pressure, and where the two meet.
- [CLEAN_ARCHITECTURE_GUIDE.md](./CLEAN_ARCHITECTURE_GUIDE.md) — which layer a new file belongs to.
- [NAMING_GUIDE.md](./NAMING_GUIDE.md) — why the name is half the boundary.
- [REACT_GUIDE.md](./REACT_GUIDE.md) — cohesion applied to components.

## Checklist

- [ ] The module's subject fits one sentence with no "and".
- [ ] Extraction was triggered by a second caller.
- [ ] An extracted control took its whole contract, not only its markup.
- [ ] No new generic container file.
- [ ] Two similar functions that stayed separate say why, in a comment.
