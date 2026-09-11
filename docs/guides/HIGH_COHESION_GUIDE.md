# High Cohesion Guide

Adapted for Portal Brasileirão from `doc_template_lib/code_quality/HIGH_COHESION_GUIDE.md`.

## Goal

One subject per module, and a name that says which subject. A core module should
be describable in one sentence without "and".

## What it means here

The root `*-core.ts` modules are meant to pass the one-sentence test by
construction, and their own doc comments are written as that sentence:

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

`next-match-core.ts` exports `clubFocus`. `club-core.ts` exports `nextFixture`.
Both answer *which match is next for this club*, and neither may be rewritten in
terms of the other.

`nextFixture` has **no clock**. It counts a postponed fixture and a kickoff that
passed an hour ago as still to come — which is right for a club's season at a
glance and wrong for a line telling a reader when to sit down. `clubFocus` takes
`now`, prefers a match **in progress** over one that is merely sooner, and reuses
`live-core.ts`'s `LATE_GRACE_MS` rather than picking its own window. Each carries
a comment saying why it is not the other.

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
the surprising name is the cost, and each generated file's header says so. For a
while only `escalacoes.ts` did, and `escalacao-core.ts` named a
`scripts/sync-escalacoes.ts` that has never existed — the surprise the name costs
is exactly what a stale pointer makes worse.

**A file may be grouped by the kind of thing it holds rather than by the noun in
its name.** `src/components/SectionIcons.tsx` holds `SunIcon`, `MoonIcon`,
`WeatherIcon`, `LinePlotIcon` and `BarsPlotIcon` beside the section glyphs, none
of which is a section: what they share is being a **standalone icon**, sized by
the control that holds it. The contract every hand-drawn glyph shares — stroke,
cap, join, `aria-hidden` — is `GLYPH_STROKE` in `src/components/glyph.ts`.

This section used to say `SectionIcons` "owns the one `base` attribute bag every
glyph in this app shares". There were three: `base` there, `GLYPH` in
`ClubLinks.tsx` with the same attributes plus an inline size, and a copy typed out
in `StadiumView` under the name `WikipediaGlyph`, drawing a stadium. Each had a
comment explaining that it existed so a glyph could not drift, which is true only
while there is one of it. **A comment claiming to be the only copy is a claim to
grep, not to believe.**

## When something earns its own file

`src/components/ClubLinks.tsx` is the worked example of the second-caller rule.
`WikipediaLink` moved out of `ClubView` the moment the match page became its
**second** caller, and it took its glyph, its label and the subject its
screen-reader suffix names. `ClubView`'s own marks stay local because they still
have one call site each. **That is the rule, not an inconsistency**: extraction
is triggered by a second caller, not by a resemblance.

`src/components/ExternalLink.tsx` is the example of counting the wrong thing. The
part of an outbound anchor that drifts — `target`, `rel` and the "(abre em nova
aba)" suffix — was extracted once per *mark*: `ClubLinks` for two links, three
more small link components in the player card and the rodapé, and raw anchors
everywhere else. Every copy happened to be right, and nothing made the next one
so. The contract had a dozen callers long before it had a home, because each
extraction counted callers of the glyph rather than of the anchor.

**Facades are not callers of that contract**, which is why three anchors still
write `target` by hand: the video cards in `ClubVideos`, the "Também por" row in
`MatchHighlights` and the post cards in `PlayerPosts` play in place on a plain
click, and "abre em nova aba" would be false of them.

The same pass found the rest of this guide's warning signs, and each now has one
home: `StatTile` was exported from one page and imported by another;
`NotFoundScreen` had four copies, one of which had drifted to another spacing and
no `role="status"`; `ClubPageLink` was the in-app club link written out five
times; `CampaignEnds` was two copies computing the closing round two ways;
`count-core.ts` holds the plural and the number-or-dash that were a dozen inline
ternaries and four helpers disagreeing about `undefined`; `narrow-core.ts` holds
the finite-number test three parsers each carried; `kickoffAt` and `round2` stopped
being identical private copies in sibling cores.

## Required rules

1. **A core module states its subject in its first doc comment**, in one sentence.
   If the sentence needs "and", split it. `cache-core.ts` opened with "TTL cache
   and circuit breaker" and was split for it.
2. **Extract at the second call site, not the first.** One caller is a local
   helper; two is a shared contract that can drift. Count callers of the
   *contract*: two different glyphs around the same `target`, `rel` and suffix are
   two callers of one anchor.
3. **When you extract a control, take its whole contract** — not just the markup.
   A copied anchor missing `rel="noopener"` is a real defect that looks identical
   on the page.
4. **`server.ts` composes I/O; nothing beneath it may.** The composition root may
   be long: fetching, caching, HTTP, wiring. It may not hold a *decision* a
   reviewer would want tested — that belongs to the core module that owns the
   subject, and `server.ts` calls it. A core importing another core's judgement is
   not composition: `rank-candles-core.ts` re-running `computeStandings` is reuse,
   which [DRY_GUIDE.md](./DRY_GUIDE.md) demands. What a core may never do is fetch,
   read a clock or orchestrate.
5. **Do not create a `utils.ts`.** There is none in this repository, and the files
   that could have become one — `src/components/interaction.ts`,
   `src/components/kickoff.ts`, `src/components/glyph.ts`, `count-core.ts` — are
   named for what they hold.

## Current reality

- **`club-core.ts` holds what is about a club.** It used to hold a block that was
  not: the address grammar of three hosts and a generic normaliser, used by
  players, match highlights, stadiums, squads and scripts as much as by clubs.
  This guide defended that on the grounds that "every part of it is keyed by
  club", which a dozen of its exports were not, and its own positive signal below
  had been broken by four curated features in the week before it was written.
  They moved to `youtube-core.ts`, `instagram-core.ts`, `wikipedia-core.ts` and
  `slug-core.ts`, and it is no longer the largest core module. Measure rather
  than quote a size, which this section once did and was wrong within a day:
  `wc -l *-core.ts | sort -rn | head -5`.
- **`server.ts`'s decisions live in core modules.** The cached-fill order, which
  was written three times, the live TTL, the envelope's note, whether to trust
  `X-Forwarded-*`, the sign-in transaction cookie with the callback's refusal
  order, the session record and the player card's cache headers each moved to the
  module that owns the subject, with tests. `CircuitBreaker` left `cache-core.ts`
  for `circuit-breaker-core.ts`. What remains inline is I/O and wiring.
- **Components do less arithmetic.** The Tráfego chart's series, geometry and
  status totals are `traffic-report-core.ts`'s, and the Perfil scatter's quadrant
  tint and rastro fade are `scouts-core.ts`'s, beside the readings they draw.
- **Nothing enforces cohesion**, beyond the name test: `tests/core-purity.test.ts`
  holds the `-core` suffix to its promise of purity. No gate counts lines, exports
  or copies, and there should not be one — a line count cannot tell a
  concentration from a subject that is large, and every copy above was found by
  reading. Two greps are cheap enough to run in review:

  ```sh
  grep -rn 'target="_blank"' --include='*.tsx' src   # ExternalLink and the facades only
  grep -rhoE '^const [a-zA-Z]+ =' --include='*.ts' --include='*.tsx' src *.ts | sort | uniq -d
  ```

  The second lists names defined privately in more than one file; a name is not a
  duplicate, but a duplicate usually has one.

## Review heuristics

**One-sentence test.** Write the doc comment first. If it needs "and", you have
two files.

**Second-caller test.** Is this the second place this markup, constant or rule
appears? Then it moves, whole.

**Contract test.** When a mark moves, ask what surrounds it at every call site.
The anchor around a glyph is a contract with callers of its own.

**Question test.** Before merging two similar functions, ask what question each
answers. `clubFocus` and `nextFixture` are the standing proof that the same shape
can be two questions.

**Uniqueness test.** A comment saying "the one X" or "the only place Y" is a
claim; grep for a second before repeating it.

**Name test.** Could a reader predict the file's contents from its name? A `-core`
suffix promises purity; a `-store` suffix promises the opposite. A glyph called
`WikipediaGlyph` should draw Wikipédia.

## Positive signals

- A new curated data file arrives with a builder in the module named for its
  subject — `youtube-core.ts` for a YouTube address, `club-core.ts` only for what
  is about a club — not appended to the largest nearby file by reflex.
- A component's helpers all serve that component's one area.
- A test file's cases cluster around one behaviour.
- Two similar-looking functions carry comments saying why they are not one.

## Warning signs

- A core module whose doc comment lists what it does.
- An export added to the largest nearby file because it was nearest.
- A mark, control or contract copied to a second call site instead of moved.
- A component exported from a page and imported by another page.
- A private helper whose body is identical to one in a sibling module.
- A raw `<a target="_blank">` outside `ExternalLink` that is not a facade.
- A `helpers.ts`, `utils.ts` or `manager.ts` appearing anywhere.
- A rule inline in a `server.ts` handler that a reviewer would want tested.

## Related guides

- [DRY_GUIDE.md](./DRY_GUIDE.md) — the opposite pressure, and where the two meet.
- [CLEAN_ARCHITECTURE_GUIDE.md](./CLEAN_ARCHITECTURE_GUIDE.md) — which layer a new file belongs to.
- [NAMING_GUIDE.md](./NAMING_GUIDE.md) — why the name is half the boundary.
- [REACT_GUIDE.md](./REACT_GUIDE.md) — cohesion applied to components.

## Checklist

- [ ] The module's subject fits one sentence with no "and".
- [ ] Extraction was triggered by a second caller — of the contract, not only the mark.
- [ ] An extracted control took its whole contract, not only its markup.
- [ ] A comment claiming to be the only copy was grepped.
- [ ] No new generic container file.
- [ ] Two similar functions that stayed separate say why, in a comment.
