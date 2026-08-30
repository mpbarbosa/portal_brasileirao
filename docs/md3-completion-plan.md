# Completing the Material Design 3 implementation

`docs/roadmap.md` runs the migration from M0 to M5 and closes with **"What is
left: nothing in this migration."** That sentence is true about the migration it
describes and false about the standard. M0–M5 adopted MD3's colour system, shape
scale, type scale, state layers and motion; they did not finish the vocabulary
they introduced, they named a subsystem they did not build, and they left every
one of their conventions enforced by reading.

This plan is what is between here and a defensible claim that the app *is* MD3.
It continues the roadmap's numbering — M6 through M9 — because these are the same
migration and should be read against the same exit-criteria discipline. It does
**not** re-open M0–M5; where a phase decided something, the decision stands and is
cited rather than re-argued.

## What "complete" can mean, and what it cannot

There is no MD3 conformance test and no certificate, so "complete" has to be a
sentence somebody can check rather than a badge. Three honest meanings:

1. **Every subsystem the app renders is expressed in MD3's own vocabulary.**
2. **No call site bypasses that vocabulary** — a component cannot reach past the
   tokens to a raw value, and nothing silently permits it.
3. **Every deviation is deliberate and written down**, with the reason, so the
   next reader can tell a decision from an oversight.

M0–M5 delivered (1) for colour, shape, type, motion and state, and most of (3).
What is left is nearly all (2), the leftovers of (1), and one subsystem — elevation
— that M2 has in its own title and shipped only half of.

**Aiming at "MD3 as our own tokens" remains the decision, not "MD3 as a
dependency."** M0 chose A over B: no `@material/web`, no MUI, no Roboto, the
generator runs on a workstation and commits hexes. Every phase below is inside
that choice. If a phase here can only be satisfied by adding a runtime
dependency, the answer is to record the deviation under (3), not to reverse M0.

## What in this document is measured, and what is not

Every count below was taken from the working tree at `4a01114` on 2026-08-27 with
`grep` over `src/`, and the duplicate-token table by parsing the emitted CSS. The
**touch-target arithmetic in M9 is arithmetic, not a measurement** — it is derived
from the utility classes, and the first step of that phase is to measure it in a
browser, because the last two width failures in this app were both invisible to
everything except a real measurement at a real viewport.

## Where it stands

**The generated block emits 33 MD3 roles. The components barely use them.**

| what components say | sites | what MD3 calls it | sites |
| --- | --- | --- | --- |
| `ink` | 11 | `on-surface` | 3 |
| `ink-soft` | 11 | `on-surface-variant` | 0 |
| `ink-inverted` | 1 | `inverse-on-surface` | 0 |
| `line` | 18 | `outline-variant` | 0 |
| `line-strong` | 2 | `outline` | 0 |
| `positive-ink` | 3 | `primary` | 6 |
| `negative-ink` | 5 | `error` | 0 |

**186 call sites speak the alias vocabulary.** Seven of those aliases are not
merely similar to an MD3 role — they are **byte-identical to one in both
themes**, which is to say the palette carries each of those seven colours twice
under two names, and the name a component happens to use is a matter of when the
line was written. `error` is emitted, contrast-gated and rendered **nowhere**;
the app's error colour reaches the page as `negative-ink`.

**Five aliases correspond to no MD3 role at all** — `ink-muted` (77),
`ink-faint` (33), `ink-ghost` (5), and the `positive`/`negative`/`warning` fill
tones with their `-ink` pairs. That is not a defect to be renamed away: MD3's
colour system gives a surface exactly two inks, and a standings table needs five.
These are a deliberate extension and the plan below names them as one.

**What is already clean, and worth stating so nobody re-audits it:** zero raw
palette utilities (`slate-*`, `emerald-*`, …), zero raw Tailwind radii, zero raw
type steps, zero `tracking-*` utilities. The scales M2 and M3 introduced are
being used, everywhere, without exception. The one raw utility left in the whole
of `src/` is a **`shadow-xl` on the player dialog**, and it is a symptom of M7
rather than a slip.

**Nothing enforces any of the above.** `npm run lint` is `tsc --noEmit`; there is
no ESLint by choice; `npm run test:tokens` checks that the generated block has not
drifted from its generator and re-runs the contrast gate, and nothing else. Every
convention in `CLAUDE.md`'s **Key conventions** — no palette shades, no Tailwind
radii, no bare type steps, no hand-written hover colours — is enforced by a person
noticing. They have held so far, which is a fact about the reviewers and not about
the repository.

## M6 — Retire the alias vocabulary — **done, the roles half**

**Two names for one colour is the state M2 explicitly deferred**, at 57 `ink`
call sites and "a separate pass rather than a rider on this one". It is 186 now.
The cost of leaving it is not aesthetic: a reader of a component cannot tell
whether `text-ink-muted` is an MD3 role, a legacy name that will be renamed, or an
extension that will not — and the three have different rules about who may change
them.

The end state is **not** that every alias becomes a role. It is two vocabularies
with a visible boundary:

- **Seven aliases become their roles**, because they already are them:
  `ink`→`on-surface`, `ink-soft`→`on-surface-variant`,
  `ink-inverted`→`inverse-on-surface`, `line`→`outline-variant`,
  `line-strong`→`outline`, `positive-ink`→`primary`, `negative-ink`→`error`.
  51 call sites, and every one produces an identical hex in both themes.
- **The rest become a named extension**, spelled so that it cannot be mistaken for
  a role — the working proposal is an `extra-` prefix (`extra-ink-muted`,
  `extra-positive`) with a comment block in the generator saying, in one sentence,
  that MD3 gives a surface two inks and this app needs five. 135 call sites,
  renamed for legibility rather than for correctness. **This half is optional and
  should be decided before the phase starts, not during it** — it is the larger
  half by call sites and the smaller half by value.

**The trap, and it is the reason this phase is riskier than it looks.** A rename
driven by hex equality is wrong. `ink-faint` and `outline` are the *same value in
the dark theme* and different in light — the light theme's faint tone was pulled
from tone 50 to 45 because 50 measured 3.86:1 against `surface-container` and
failed AA. Fold them together on the strength of the dark palette and the light
theme silently loses that correction. Drive the rename from
`legacyTokens` in `scripts/generate-md3-tokens.ts`, where the mapping is written
down, and never from the emitted CSS.

**The second trap is that nothing goes red if this is done wrong.** A colour
rename that lands on the wrong token produces a page that renders, passes `tsc`,
passes every unit test and passes the whole e2e suite — the suite asserts
behaviour and text, not colour. The gates that can see it are the contrast gate
(only if a pairing changes) and the screenshot check (only for the eighteen
committed captures, four of which now differ on every refresh — two because the
rodapé prints the running sha, two because Ao vivo prints a countdown). Plan for a **visual diff of both themes across the five
sections before and after**, taken locally, as part of the phase rather than after
it.

**Exit criteria.** No `ink*`/`line*` utility remains in `src/`; the seven aliases
are deleted from `legacyTokens`; `npm run test:tokens` passes with the pairing
labels renamed; a before/after capture in both themes shows no pixel change
outside the rodapé's version band.

**Done — the seven role renames, and the optional half deliberately not taken.**

**51 call sites**, exactly as forecast. The `extra-` prefix for the remaining 135
was **declined**: it is the larger half by churn and the smaller by value, and
renaming `ink-muted` to `extra-ink-muted` buys legibility that a gate can buy
outright. So instead the *invariant* became enforceable — `assertNoRoleDuplicates`
in the generator refuses to emit a palette where an extension shares a value with
a role, in **both** themes, and `npm run test:tokens` already runs in CI. Made to
fail on purpose: re-adding `line-strong` exits **1** and names it.

`legacyTokens` is now `extensionTokens`, which is what it holds. They are not
legacy — nothing is waiting to rename them, and MD3 has no role for any of them.

**The phase's own risk was answered with evidence rather than with care.** A
colour rename that lands on the wrong token renders, type-checks and passes every
test, so:

- **Token-level identity.** Every one of the seven carries a byte-identical value
  under its new name in both themes, the seven old names are gone, and no other
  token moved. Checked by parsing the emitted CSS before and after, which is the
  proof; the captures below are the corroboration.
- **Nine of ten captures byte-identical** across five sections in both themes.
  The tenth, `ao-vivo-light`, differs in **12 pixels of 1,024,000 at a maximum
  channel delta of 2** — subpixel antialiasing between two Vite instances, not a
  colour. Two captures of the same build were byte-identical, so the page is not
  merely noisy.

Three tests named a token rather than a behaviour and were updated with it:
`button-classes` twice, and `theme.spec.ts`'s toggle spec, which reads
`--color-on-surface-variant` where it read `--color-ink-soft`.

## M7 — Elevation — **done**

M2 is titled **"Shape, elevation and state layers"** and shipped two of the
three. What it adopted is MD3's *tonal* elevation — a higher surface is a lighter
tone — and that was the right half to take first, because it is what makes a dark
theme legible where a drop shadow is invisible. But MD3 specifies elevation as
**six levels, each carrying a tonal value and a shadow**, and this app has no
shadow vocabulary at all: no `--elevation-*` token, one `shadow-xl` on the
player dialog, and a sticky header that separates from the page by a border and
a backdrop blur.

The work:

- **Emit `--elevation-0` … `--elevation-5`** as box-shadow values, in
  `src/index.css` beside the shape and motion scales rather than inside the
  generated block — like those, they are fixed constants of the system, not
  values derived from the seed.
- **Assign them where the app already has a raised thing**: the player and
  account dialogs are MD3 level 3, the sticky top app bar is level 2 *when
  scrolled* and level 0 at rest, the navigation bar is level 2. Nothing else in
  this app is elevated, and nothing should be given a level to demonstrate that
  the scale exists.
- **Delete `shadow-xl`**, which is a Tailwind default at a size MD3 does not
  define, sitting on the one component the migration rebuilt from scratch.

**The decision this phase has to make explicitly, because M2 half-made it:**
whether shadows apply in the dark theme. MD3's own guidance is that they are
present but nearly invisible there, which is precisely why tonal elevation
exists. The cheap answer — shadows in light, tone alone in dark — is a *third*
elevation model, one nobody else implements, and it means a component's elevation
is not a property of the component. Recommendation: **emit the shadows in both
themes and let them be faint in dark**, which is what the spec says and what
costs nothing to maintain.

**Exit criteria.** No raw `shadow-*` utility in `src/`; every elevated surface
names a level; the scrolled/at-rest app bar distinction is asserted in an e2e
spec, since it is the one piece of this phase with a behaviour rather than only
an appearance.

**Done, and four things came out differently than written.**

- **The tokens are `--shadow-level-0…5`, not `--elevation-0…5`.** A Tailwind v4
  utility exists only where a theme namespace says it does, so the name this
  section proposed would have been a real custom property that no class could
  ever reach — the `--duration-short-4` trap, one scale over. The namespace
  picks the name.
- **The values were transcribed, not recalled.** MD3 computes each level's key
  and ambient shadow from the level number in
  `material-web/elevation/internal/_elevation.scss`; those are the numbers in
  `src/index.css`. A plausible shadow is indistinguishable from a correct one to
  anyone reading the page, which is the `stadiums.ts` argument applied to a
  number nobody would ever catch.
- **The shadows-in-dark recommendation was taken and then checked by looking.**
  On dark they are all but invisible and the tonal ladder plus the borders carry
  the separation; on light the scrolled app bar reads clearly. That is what the
  spec predicts, and it is why tonal elevation exists.
- **The mount read in `useScrolled` cannot be tested here, and the spec says so
  rather than covering it.** The obvious test — scroll, reload, assert the bar
  comes back raised — cannot work: Chromium restores a scroll position only
  while the document is tall enough to hold it, and this app's content arrives
  from `/api/standings` after load. Measured: scrolled to 365, reloaded,
  `window.scrollY` was **0**. Such a test would assert the at-rest state and
  pass, saying nothing at all.

Both bars keep their border in every state. MD3 drops the top app bar's divider
at rest; doing that is a visible restyle of every page rather than an elevation,
so it was left for whoever takes that decision deliberately.

## M8 — Make the conventions enforceable — **done**

This is the phase that turns the whole migration from a state into a property.
Everything M2, M3 and M4 established is currently guarded by review, and the
guard has held — but "no raw palette shade has appeared in fourteen phases" is a
statement about the people, and the next fresh session is told the rule in
`CLAUDE.md` and given no way to fail it.

**A grep-based unit test, not ESLint.** The repo has no ESLint by deliberate
choice and adding one to police five string patterns would be a large dependency
for a small rule, plus a config nobody in this repo has ever maintained. A
`tests/design-tokens.test.ts` reading the files in `src/` and asserting the
absence of a small pattern set costs nothing, runs in the existing `test:unit`
list, is hermetic, and fails on the commit that introduces the violation rather
than on the review that misses it.

What it forbids, each already written as a rule in `CLAUDE.md`:

- palette utilities (`slate-*`, `emerald-*`, `rose-*`, `amber-*`, and the rest of
  Tailwind's default scale) on any colour property;
- Tailwind's radii (`rounded`, `rounded-sm|md|lg|xl|2xl|3xl`) — `rounded-full` is
  legitimate and must be allowed;
- bare type steps (`text-xs|sm|base|lg|xl|…`) and any `tracking-*`;
- `shadow-*` outside the elevation tokens M7 introduces;
- `duration-*` and `ease-*` utilities, which is the subtler one: **`duration-short-4`
  compiles to nothing in Tailwind v4** and silently leaves the default in place, so
  this is a rule against a class that *looks* like it works;
- hand-written `hover:`/`focus:` colour utilities outside `interaction.ts`.

**Two traps, both of which this repo has already paid for once.**

**Make the test fail on purpose before believing it.** A probe that reports the
absence of what it was testing as a pass is this codebase's most expensive
recurring mistake — the Playwright stub that passed against the very bug it named,
and the shell guard that reverted its own subject. Add a `slate-500` to a
component, watch it go red, remove it. That step is the deliverable, not a
courtesy.

**A source grep cannot see a class it does not recognise as one.** Class names
assembled at runtime are invisible to it — which is also why they are invisible to
Tailwind's own extractor, so the rule and the framework fail together and in the
same direction. `interaction.ts` already says this in prose; the test makes it
load-bearing.

**Exit criteria.** The test exists, is listed in `test:unit`'s explicit file list
(a new test file does **not** run until it is added there), and has been observed
failing against a deliberate violation of each rule it carries.

## M9 — The components MD3 specifies and this app draws by hand — **done, with one part handed on**

M4 converted the components the app had. This phase is about the places where the
app renders something MD3 has a component for, and does not use it — and, in three
of the five, decides not to. Each of these is a judgement; none is a defect.

**The desktop navigation is not MD3 tabs.** The current section renders as a
filled chip in `bg-ink text-ink-inverted` — an inverse-surface pairing that MD3
does not use for selection anywhere. MD3 primary tabs mark the active
destination with a **label in `primary` over a 3dp indicator**, and the bottom
navigation bar in this same app already uses the correct MD3 idiom
(`secondary-container` pill behind the icon). So the app currently states
"selected" two different ways at two breakpoints. **Recommendation: convert.**
This is the single most visible divergence in the app and the one a designer
would name first.

**Touch targets.** MD3 requires a 48dp minimum for any touch target. By
arithmetic the theme toggle is `py-2` around a 20px line box plus a 1px border
each side — **38px**, ten short — and the same shape applies to the account
control and the round stepper beside it. The bottom navigation items are fine
(72px). **Measure first**, at 320/360/375dp, in the manner
`tests/e2e/players.spec.ts` already measures the nav bar; then fix by minimum
height rather than padding, so a control's box grows without its chrome growing.

**The round picker stays a native `<select>`.** MD3 would have it as a menu.
Native is the right answer and the reason should be recorded rather than left to
be rediscovered: the platform control gets the mobile picker, the keyboard model
and the accessibility tree for free, and a re-implementation buys an
appearance and owes focus management, typeahead and dismissal forever. `Button`'s
`controlClasses` already makes it look like the buttons beside it.

**The icons stay hand-drawn.** Decided in M4's spirit and restated here because
this is the phase where someone would reach for Material Symbols: the app ships no
UI dependency, a set arrives with several hundred glyphs to serve five, and
`SectionIcons.tsx` already draws them in `currentColor` so they re-theme for free.

**`Surface` is a hybrid, and should be named as one.** MD3 has three card
variants — elevated, filled, outlined. `Surface` is outlined chrome that
optionally takes the *filled* variant's container colour, which is a fourth thing.
It works, every card in the app is consistent, and the honest close is a comment
saying which MD3 variants it corresponds to and why it is neither — not a
refactor into three components where the app renders one.

**Exit criteria.** Tabs converted and captured in both themes; every interactive
control measured at 48dp or above, with a spec that measures rather than asserts;
the three "stays as it is" decisions written into `CLAUDE.md`'s **Key
conventions** so the next session does not re-litigate them.

**Done — and the middle criterion turned out to be wrong as written.**

**Tabs.** Converted. The active label is `primary` over a 3dp indicator drawn as
an `after` pseudo-element rather than a border, so it takes MD3's rounded top
edge and sits inset from the tab's own padding. The appearance is MD3's; the
semantics stay navigation, with no `role="tab"` — these change the address, and a
tab role promises a `tabpanel` and arrow-key selection that do not exist.

**"Every interactive control at 48dp" cannot be asserted, and asserting it would
have cost the spec.** Measured at 375dp, the page holds twenty club-name links at
16px, ten fixture links at 24px and — on Jogadores — roughly **950** player-name
buttons at 24px. Those are links *inside* content, not targets beside it; MD3's
floor is for touch targets, and raising them means re-laying-out three pages. A
spec written to the criterion as stated would fail on all of them until somebody
deleted it. So the spec **names** the set it measures, and the exclusions are
recorded here rather than left looking like an oversight.

Raised to 48dp: the round stepper (was 34×32), its picker (32×61), the theme
toggle (38×39), `BACK_LINK` (20 tall), the tonal highlights links (36 and 40),
and the tabs themselves. The floor lives in `controlClasses`, so it arrives at
every control from one place.

**Handed on, then resolved — and the handoff turned out to be the bug.** The
account control measured 36×44, and #173 was rewriting it while this phase ran,
levelling the trailing group at `h-10` — MD3's *visual* container size, which is
not its 48dp *target*. Both merged, and on production at `844cb15` the toggle
measured **48×48 beside a 40×97 account control**: M9's floor sat on the box as
`min-h-12`, and a minimum beats a height whatever the class order, so #173's 40
never applied to the one control that went through `controlClasses`.

The fix is the reconciliation MD3 already specifies rather than either side
winning: `TOUCH_TARGET` puts the 48dp target on a **pseudo-element**, a `bar`
size gives the 40dp container, and the account controls take the same target.
The group is level at 40 with 48dp targets on both, and the body controls keep
the 48dp box M9 gave them. A spec presses 4px above the toggle — outside the box,
inside the target — and asserts the theme still flips, which is the only
assertion here a stylesheet cannot satisfy on its own.

**One thing the mutation testing found, worth more than the fix.** The wrap
guard was first written as "every tab is 48px tall" — and it stayed green with
`whitespace-nowrap` deleted, because the tab's own `min-h-12` holds it at 48 while
a two-line label is only 40. A test that passes against the bug it names. It now
counts the label's client rects, one per line box, which cannot be fooled that
way; and with **both** `inline-flex` and the nowrap removed, "Ao vivo" wraps at
640 and it goes red. Either alone prevents the wrap, so a green run after
deleting one is not evidence it was unnecessary.

**With M9 the four phases are done.** What the standard still asks of this app is
in the section below, which is the same list it always was, and one item that is
new: the account control's touch target, held for #173.

## What stays deliberately unadopted

Restated here so that "complete" is not read as "everything MD3 has":

- **Dynamic colour.** Still no. A palette derived from the club being viewed
  trades recognition for novelty on a scoreboard people scan in seconds, and the
  machinery being cheap now that `md3-color-core.ts` exists is exactly why it
  needs a deliberate no rather than a drift into yes.
- **Roboto.** The system stack ships; the type *scale* was adopted without the
  typeface, and Android renders in MD3's own face for nothing.
- **The full motion token set.** Two easing curves and two durations exist because
  two are rendered. Emitting the other fifteen would be a vocabulary with no
  speakers, and the same rule already governs the type scale, where
  `display-medium`, `display-small` and `headline-large` are absent.
- **`surface-dim`, `surface-bright`, `surface-tint` and the `*-fixed` roles.**
  Same rule. Emit one when something renders it.
- **FAB, snackbar, text fields, switches, sliders, progress indicators,
  tooltips, badges.** The app renders none of them. A component with no call site
  is a guess about the future that later has to be maintained or deleted — M4's
  sentence, and it holds for every one of these.

  **Segmented buttons were on that list and have come off it**, which is the rule
  working rather than an exception to it: #248 needed one for the Casa / Fora
  split, so it was built at the moment something rendered it. It is a
  `radiogroup` rather than a row of `Button`s — the choices are mutually
  exclusive and exactly one is always on, which is a radio's contract and not a
  button's — and it lives in its own component because a segment needs a shared
  outline, collapsed inner borders and end caps that mean nothing individually.
  Nothing here predicted which of the nine would be needed first, and that is the
  argument for the rule: the list is not a plan, it is a record of what has no
  call site **today**.
- **The navigation drawer.** Not unadopted so much as owed: `NAV_ITEMS` is at
  MD3's maximum of five destinations, and a sixth section wants a drawer rather
  than a sixth entry. Nothing fails at the sixth — no build breaks, no test goes
  red — which is why it is written down here as well as in `CLAUDE.md`.

## Order, and why

**M8 before M6.** The enforcement gate is small, self-contained and changes no
pixel; the alias retirement is 186 call sites that no automated gate can check. Put
the gate in first and M6 lands with something watching it — including, if the
`extra-` prefix is adopted, a rule that catches an alias that was missed.

**M7 before M6 as well**, for a smaller reason: M6's rename is the one phase
with no gate of its own, so it should be the last thing to land into a codebase
that is otherwise settled.

**One rule does not ship with M8, and it is not an exception.** M8 comes before
M7, so at the moment the gate lands there is still a `shadow-xl` on the player
dialog and no elevation vocabulary to replace it with. Forbidding `shadow-*` in
M8 would therefore mean shipping the gate with a carve-out for a file a later
phase was going to fix — and a carve-out in a new gate is how the gate comes to
have three. The rule ships in **M7 instead, in the same commit as the tokens
that make it satisfiable**. A rule arrives with the vocabulary it enforces; it
does not arrive early and wait.

That gives **M8 → M7 → M6 → M9**, which is deliberately the reverse of the risk
order and the reverse of the visible-benefit order. M9 is last because it is the
only phase that changes what the app looks like on purpose, and it should land
against a codebase where a colour rename cannot silently accompany it.

## What none of this changes

Data, routing, caching, the provider integration, the deploy pipeline, and every
`*-core.ts` module — the same boundary M0 drew. All four phases are confined to
`src/index.css`, `src/components/`, `scripts/generate-md3-tokens.ts` and one new
test file, which is the strongest argument that they are safe to attempt
incrementally and the reason each can ship on its own.
