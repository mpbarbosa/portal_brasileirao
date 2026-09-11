# Mobile-First Guide

Adapted for Portal Brasileirão from `doc_template_lib/domain_specific/MOBILE_FIRST_GUIDE.md`.

## What was cut

The source guide's CSS recipes — breakpoint scales, grid patterns, form layouts,
`srcset` — are not reproduced. Tailwind v4 supplies the mechanism and
[Material Design 3](../md3-completion-plan.md) supplies the vocabulary. What is
kept is the part a design system cannot decide for you: **which constraints on
this app's screens were measured, and what they cost when they were not.**

Tailwind's `sm:` and `lg:` are `min-width` by construction, so progressive
enhancement is enforced by the tool. **The base is the phone.** No `max-*:`
variant appears anywhere under `src/`; keep it that way.

## The rule the tooling cannot check

**MD3's navigation bar carries three to five destinations. This app has five.
The bar is full.**

A sixth section wants MD3's navigation *drawer*, not a sixth entry. At the sixth
nothing fails, no build breaks and no test goes red — which is why this is a real
limit rather than a style note.

**The fifth entry was not free, and what it cost was measured rather than
eyeballed.** A nav item's minimum width is its 64 dp MD3 indicator plus whatever
padding it carries; at `px-2` that is 80 dp, and five of those is 400 dp on a
375 dp screen. The fifth label was clipped at the screen edge **with no
horizontal scroll to reveal it** — invisible on a desktop, and invisible to every
test in the suite until `tests/e2e/players.spec.ts` began measuring each item's
box against the bar's at 320, 360 and 375 dp.

The padding gave way, because MD3 does not specify it while it does specify the
indicator. Below 360 dp even that is not enough — five indicators at 64 dp is
320 dp exactly, leaving nothing for "Classificação", whose label alone measures
79 dp — so the indicator is 56 dp at the base and 64 dp from `min-[360px]:`
(the indicator span in `src/components/NavBar.tsx`). That breakpoint is this
app's precedent for **degrading only where the spec cannot be satisfied at
all**, and two later fixes below reuse it.

## Touch targets: the target and the box are two decisions

`TOUCH_TARGET` in `src/components/interaction.ts` is MD3's 48 dp target on a
**pseudo-element**. `BOX` in `src/components/Button.tsx` is what you see. Measured at 375 dp
before the rule existed: the stepper was 34×32, its picker 32×61, the theme
toggle 38×39, the back link 20 tall.

**Conflating them shipped a bug.** M9 put the floor on the *box* as `min-h-12`,
and **a `min-height` beats a `height` whatever the class order** — so it silently
overrode the `h-10` that had just been used to level the top app bar's trailing
group. Production ran a 48×48 toggle beside a 40×97 account control: two changes
each right on their own, 8 dp apart.

**A drawn target overhangs its box, and can steal a neighbour's clicks while
every per-control assertion passes.** Check the gap between two controls against
the sum of their overhangs, and press on it.
`tests/e2e/touch-targets.spec.ts` asserts the container, the target, and — the
only one a stylesheet cannot fake — **a press 4 px outside the box that still
reaches the control**.

**An `overflow-hidden` ancestor clips the target, and only the press can see
it.** An overflow clip applies to hit testing as well as to paint, so a
`::before` hanging outside its box inside a clipping container reports 48 dp in
`getComputedStyle` and is as small as the box to a thumb. The Completa / Casa /
Fora segmented button above the Classificação had exactly that container — the
group clipped its segments to the pill shape — and measured 85×32, 57×32 and
53×32 at every phone width with no target at all. The clip also cut the 2 px
offset `FOCUS_RING`. The segments now carry `TOUCH_TARGET`, the end caps moved
onto the end segments, and `touch-targets.spec.ts` presses 4 px below one.
Moving the caps is not pixel-free: a fill painted against its own radius
antialiases a one-device-pixel edge differently from one cut by a clip, up to
18% at the captures' scale factors, so the Classificação captures owed a
re-shoot for a change no reader can see.

**The floor deliberately does not reach inline links**, and that is the part to
understand before "fixing" it. Twenty club names at 16 px in the Classificação,
ten fixture links at 24 px on Jogos, roughly 950 player-name buttons on
Jogadores and the club page's row of external links are links *inside content*,
not targets beside it. Raising them means re-laying-out those pages, and a spec
asserting "every anchor is 48 dp" would fail on all of them until somebody
deleted the spec. `tests/e2e/tabs-and-targets.spec.ts` therefore **names the set
it measures** rather than inferring it.

The club page's row is the case most likely to be "fixed" by mistake, so its
arithmetic is recorded: six links 20 px tall in a wrapping row with a 2 px line
gap, where a 48 dp target overhangs 14 px into the line above and below. That is
a re-layout, not a class. A **picker** is never content: the `/trafego` country
`<select>` was 133×26 with hand-written chrome and takes `controlClasses` now,
like the round picker.

## A wide table on a narrow screen

The Classificação is the hardest layout here, and three things had to move
together — each invisible until somebody scrolls.

- **`border-separate border-spacing-0`.** In the collapsed model a cell's borders
  belong to the table and slide out from under a sticky cell. Which means the row
  separator lives on every cell (`ROW_LINE`), not on the `<tr>` — the separated
  model does not paint row borders at all.
- **The G4/Z4 rail rides on the first cell, not the row**, because a row scrolls
  and would carry its rail away.
- **`STICKY_CLUB`'s `left-*` must equal `STICKY_POSITION`'s `w-*`** — read the
  two constants in `src/components/StandingsTable.tsx`, which are `w-14` and
  `left-14` today. Widen the position column alone and the two frozen columns
  overlap or gap — and only while scrolled, because ordinary table layout puts
  them adjacent either way.

**The pairing is broken far more easily by the CELL than by either constant.** A
specified width is a *request*: the column clamps up to its own content minimum.
When the variação triangle landed, a two-digit position plus a 4 px gap plus an
8 px glyph made a 32 px minimum against `w-14` at `px-3` leaving 30 — so the
column rendered **58 px against a `left-14` of 56**, and the padding gave way.

**A frozen column must never absorb the table's surplus.** Auto layout hands
surplus to the widest column, which is Clube — so it rendered 219 px around
137 px of content at 360 dp, and because that column is frozen the 82 px of empty
space was subtracted from the viewport *permanently* instead of scrolling away,
leaving 59 px of a 326 px container for all seven data columns. Hence `w-0`,
which does not mean zero: a specified width below a column's minimum is clamped
up to it, so the column takes its content and the surplus goes to the columns
that scroll.

**The obvious measurement cannot see that failure.** A column's minimum is its
widest *unbreakable* run, so without `whitespace-nowrap` the clamp lands lower
and the browser pays for it by wrapping the state onto a second line — 12 of 20
rows going 37 px to 57 px. Width alone reports that as a success, and it passes a
`scrollWidth > clientWidth` clip check too, because **a wrapped cell is not a
clipped one.** Assert **row height**, and assert the frozen pair stays under 70%
of the container.

**That 70% held at 380 and failed at 320, and the spec measured only 380.** Once
`w-0` pins the pair to its content, the content is a fixed ~223 px however
narrow the screen, so its share only *rises* as the viewport falls: 0.646 at
380 dp, 0.655 at 375, 0.685 at 360 and **0.781 at 320** (production,
2026-09-11). The width a spec skips is the one that breaks. Below 360 the state
(UF) is hidden and the crest gives up 4 px of margin — `STATE_LABEL` and
`CREST_GAP` — which brings 320 to 0.687 and changes nothing from 360 up. Hiding
the state alone reached only 0.701, which is why the margin had to go too. The
spec now measures 320, 360, 375 and 380.

## Arithmetic, not taste: the app bar's second row

Sharing one row with the brand and the trailing controls was **over-subscribed**,
not merely tight. Signed in at 640 dp that row had to hold 345 dp of tab labels,
a 128 dp wordmark, a 108 dp account control and a 40 dp toggle inside 608 dp of
content. The brand was the only elastic member, so it absorbed the whole
shortfall and rendered **27 dp wide** — the app's own name reading "P…".

**Every spec was green throughout**, because `tests/e2e/navigation.spec.ts` asserted the
wordmark was *visible*, and a truncated element is visible. That spec now
measures `scrollWidth` against `clientWidth` at seven widths in the signed-in
state, and was confirmed red against the old markup before being believed.

**No padding, breakpoint or type step fixes a row whose contents do not fit.**
The tabs moved to a row of their own — which is also what MD3 prescribes, since
tabs are a component placed *beneath* a top app bar. The cost is 32 dp of sticky
chrome above `sm` (73 → 105, measured on production at both sides of 640);
below `sm` the bottom navigation bar is unchanged and the header stays 73.

The same failure recurred one element down: the brand mark sits beside the
**title line**, not beside the two-line block, because below `sm` the widest line
is the *subtitle* at 174 px against 128 px of title. Beside the block it
overflowed by 3.6 px and painted under the Entrar pill — 802 specs green, and the
spec directly above the new one asserted the subtitle was *visible*.

**And it recurred again at 320, because "the widest state" flips at `sm`.** Signed
in is the widest trailing group from `sm` up, where the account control carries a
name. Below `sm` it is a 40 dp avatar, and signed out is the 97 dp Entrar pill —
so the brand gets `width − 189` signed out: 186 px at 375, 171 at 360 and 131 at
320, against a 174 px subtitle and a 160 px title line. Production painted both
lines 30 px under the pill at 320 and the subtitle 3 px past its box at 360,
while the subtitle spec measured 375 only and found 0 px of slack there.

The pill now gives way where the arithmetic forces it, on the nav indicator's
breakpoint: from 360 to 374 it drops its glyph (71 dp, 23 px of slack at 360),
and below 360 it is a 40 dp disc whose word survives only as the accessible
name. From 375 up nothing changed — the control is byte-identical to production
in both themes at the committed captures' own settings, 960 dp at scale 1.5 and
375 dp at scale 2, so no capture moved. `navigation.spec.ts` measures both brand lines at 320, 360
and 375 in both states, and `contas.spec.ts` asserts the three shapes and the
name.

## Drawings on a phone

- **Axes are HTML around the SVG, never `<text>` inside it.** A drawing that
  scales to its container scales its type with it, so a label sized for a desktop
  is six pixels tall on a phone.
- **`RankCandles` takes a fixed height and `preserveAspectRatio="none"` below
  `sm`**, because at 2.4:1 a 343 dp phone gets 143 px for twenty position bands
  and a season reads as a strip of dashes. That is safe only because its marks
  are **filled rects**: a non-uniform scale changes their proportions and nothing
  else. Its guide lines are `<line>`s, and they carry
  `vectorEffect="non-scaling-stroke"`, which is what stops their weight
  stretching with the y axis.
- **`TrafficView`'s rate chart stretches too**, a stroked path under
  `preserveAspectRatio="none"` kept even by `non-scaling-stroke`. Its end-point
  circle becomes an ellipse at most widths; that is a mark rather than a
  measurement, and the exception is recorded at the call site rather than being
  a precedent.
- **`ProfileScatter` therefore scales uniformly and is capped in width.** A
  circle under `preserveAspectRatio="none"` becomes an ellipse whose eccentricity
  is a property of the reader's screen. Uniform scaling makes the width cap
  necessary rather than decorative: uncapped, the figure renders as tall as the
  card is wide.
- **`w-full` on an SVG in a flex row is 100% of the container, not of what the
  gutter leaves.** With `overflow-visible` the last candles painted outside the
  card while every assertion about them passed. Put the drawing in a grid track,
  or use `grow min-w-0`.
- **Colour cannot separate two neutrals on a small mark.** An unplayed round is
  drawn **hollow** rather than in a grey fill, because it sat next to an empate
  in `ink-muted` and neither the marks nor the two key swatches could be told
  apart at 343 dp.

## Themes and contrast

Two themes, one set of tokens. An inline script in `index.html` stamps
`data-theme` **before first paint** — without it the page renders dark then
repaints light, a flash no CSS ordering can fix because the choice lives in
`localStorage`.

**The light palette is not the dark one inverted.** `surface-container` sits at
tone 94 on light and tone 12 on dark, so light has far less room beneath it
before AA fails.

**Contrast is enforced rather than recorded.** `npm run test:tokens` checks every
text token against each background this app actually paints text on, in both
themes, and refuses to emit a palette that falls below AA. That is what caught a
pairing that is **latent rather than shipped** — light's `ink-faint` on
`surface-container` — which would spring the first time somebody put faint text
on a badge.

## Performance is a decision, not a budget

- **No webfont ships.** The typeface is the system stack; Roboto is already
  fourth in Tailwind's default `--font-sans`, so Android renders in MD3's own
  face for nothing.
- **No UI dependency ships.** Icons are hand-drawn in `src/components/SectionIcons.tsx` in
  `currentColor`; Material Symbols would arrive with several hundred glyphs to
  serve the handful drawn there.
- **Photographs are vendored and served in two widths** from our own origin
  (`PHOTO_WIDTHS` in `venue-core.ts`), not hotlinked.
- **Two image classes are hotlinked on purpose, and they are the only two.** Club
  crests come from `crests.football-data.org` (`ClubCrest`, lazy, with
  `referrerPolicy="no-referrer"` and a letter fallback when the host fails), and
  the Melhores momentos thumbnails from `img.youtube.com`, behind a facade that
  loads no player until a press. Both are the provider's own asset for the thing
  the page names; vendoring either is a sync and a licence question rather than
  a performance fix.
- **`prefers-reduced-motion` is honoured**, and sets near-zero rather than
  `none` so `transitionend` still fires. It stops movement only — colour feedback
  survives, because a control that stops reacting is harder to use rather than
  calmer.

## Required rules

1. **Measure at 320, 360 and 375 dp.** Add to the specs that already call
   `setViewportSize` — count them with `git grep -l setViewportSize tests/e2e`
   rather than trusting a number here — instead of reasoning about the
   arithmetic. **Include the narrowest**: a fixed-content element's share only
   grows as the screen shrinks.
2. **"Visible" is not an assertion about fit.** A truncated element is visible
   and an overflowing element is visible. Measure `scrollWidth` against
   `clientWidth`, and the gap to the next control.
3. **A width is a request.** Check what the cell's content minimum does to it.
4. **Never let a frozen or fixed element absorb layout surplus** — `w-0`.
5. **The touch target and the visible box are separate decisions**, and a
   `min-height` beats a `height` whatever the order. **No `overflow-hidden`
   around a drawn target.**
6. **Name the set a target-size spec measures**; do not infer it from a selector.
7. **A non-uniform scale is for filled rects and `non-scaling-stroke` lines.**
   Anything else under `preserveAspectRatio="none"` is an exception recorded
   where it is drawn.
8. **Add a breakpoint when the layout breaks**, not per device — and degrade
   only below the width where the spec cannot be satisfied.

## Current reality

- **The nav bar is at MD3's maximum and has no slack left.** `/trafego`,
  `/conta`, `/entrar` and `/privacidade` are reached without a nav entry, as are
  the addressed sections — `clube`, `painel`, `partida`, `estadio`.
- **`tests/e2e/tabs-and-targets.spec.ts` carries a written exclusion list** for
  the inline links, the club page's link row included, and the reasoning lives
  in `docs/md3-completion-plan.md` under M9 so it reads as a decision rather than
  an oversight.
- **Every spec runs twice, in a `desktop` project and a `mobile` one** — Pixel 7,
  412 dp (`playwright.config.ts`). Only the specs that call `setViewportSize`
  measure anything narrower, so a regression at 320–375 outside them is not
  caught. Until 2026-09-11 the Classificação's frozen-pair spec and the brand
  subtitle spec measured 380 and 375 only, and each hid a live defect at 320.
- **There is no performance budget and no Lighthouse gate.** The performance
  decisions above are architectural (no webfont, no UI dependency, vendored
  assets) rather than measured against a threshold.

## Review heuristics

**Fit test.** Does the widest state of this row fit the narrowest supported
screen? Do the arithmetic in the widest state — signed in from `sm` up, signed
out below it.

**Visible-is-not-fitting test.** Would this assertion pass on a truncated or
overflowing element?

**Surplus test.** Which column or item gets the extra space, and can it use it?

**Overhang test.** Does this control's drawn target reach into its neighbour's —
and is any ancestor clipping it?

**Scale test.** Does this drawing contain anything that is not a filled rect or
a `non-scaling-stroke` line?

**Both-themes test.** Does the change hold on light, where there is less room?

## Positive signals

- A layout change arrives with a measurement at 320/360/375 dp.
- A spec asserts a box against its container, not a boolean.
- A drawing's labels are HTML outside the SVG.
- A new control takes `TOUCH_TARGET` and decides its box separately.

## Warning signs

- A sixth nav destination.
- `toBeVisible()` standing in for a fit assertion.
- A `min-h-*` added next to an existing `h-*`.
- `overflow-hidden` on a group of controls that take `TOUCH_TARGET`.
- A fixed or frozen element with a width that can absorb surplus.
- A fit spec that measures one phone width, or only the roomiest.
- `<text>` inside a scaling SVG, or a circle under `preserveAspectRatio="none"`.
- Two neutral tones distinguishing marks smaller than a few pixels.
- A webfont, an icon package, or a hotlinked image beyond the two recorded above.

## Related guides

- [REACT_GUIDE.md](./REACT_GUIDE.md) — the components and the Tailwind traps.
- [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md) — how these viewports are exercised.
- [NAMING_GUIDE.md](./NAMING_GUIDE.md) — the token vocabulary and what enforces it.
- [HIGH_COHESION_GUIDE.md](./HIGH_COHESION_GUIDE.md) — a control owning its chrome and not its layout.

## Checklist

- [ ] Measured at 320, 360 and 375 dp, in the widest state.
- [ ] Assertions measure boxes, not visibility.
- [ ] No fixed or frozen element absorbs surplus.
- [ ] Touch target and visible box decided separately; no `min-h`/`h` collision; no clipping ancestor.
- [ ] Drawing scales uniformly unless every mark is a filled rect or a `non-scaling-stroke` line.
- [ ] Holds on the light palette.
- [ ] No new webfont, icon package or hotlinked asset.
