# Convenções do código

*Quando ler:* Leia ao escrever código novo em `src/` ou `tests/`, antes de escolher um padrão.

Extraído do `CLAUDE.md`, que ficou um índice. Esta é a fonte canônica do assunto.

---

## Key conventions

**Six of these are now enforced rather than reviewed.**
`tests/design-tokens-core.test.ts` sweeps every `.ts`/`.tsx` under `src/` and
fails on a palette shade, a Tailwind radius, a bare type step, a `tracking-*`, a
`duration-*`/`ease-*` utility or a hand-written `hover:`/`focus:` colour. It is a
grep rather than ESLint on purpose — this repo has no ESLint by choice, and
acquiring one to police six string patterns costs a dependency, a config and a
plugin API against a rule set that fits on one screen.

Two things about it are load-bearing. **Comments are stripped before the rules
run**, because half the value of these files is prose that *names* the utility it
replaced — `Button.tsx` quotes `hover:bg-raised` — and a gate that flags its own
documentation gets switched off. The stripper is hand-written rather than a
regex, because `https://` is not a comment and mistaking it for one blanks the
rest of a real line, which is a false *negative*: the direction a gate must never
fail in. And **`interaction.ts` is a definition site, not an exemption** —
`DEFINITION_SITES` records the one module where a state colour may be written,
the way `index.css` is where a raw colour may be written. Nothing may be added
there for a file that merely has a violation in it.

`shadow-*` became the seventh rule in M7, in the same commit as the elevation
tokens that make it satisfiable — a rule arrives with the vocabulary it
enforces rather than early and carved-out.

- **Colours are semantic tokens, never palette shades.** `src/index.css` defines the
  full set under `@theme`: MD3's roles, and beside them a short list of
  **extensions** — `ink-muted`, `ink-faint`, `ink-ghost` and
  `positive`/`negative`/`warning` with their `-ink` pairs. A raw `slate-*`,
  `emerald-*`, `rose-*` or `amber-*` utility in a component is a regression, and the
  gate above catches it: before tokens there were 32 distinct colour utilities and
  five shades of grey text.
  **There are two vocabularies and the boundary is exact.** A role is MD3's and is
  spelled MD3's way; an extension exists only where MD3 has no role — a surface gets
  two inks and a standings table needs five, and MD3's colour system carries `error`
  and nothing else of the kind. **No extension may duplicate a role**, and the
  generator refuses to emit a palette where one does. That is not a style rule: until
  M6 the palette carried seven colours twice under two names, `error` was emitted,
  contrast-gated and rendered *nowhere* while the app's error colour reached the page
  as `negative-ink`, and which name a component used was a matter of when the line was
  written.
  The renames landed in two passes. M2 took the surface ladder: the page is
  **`surface`** (it was `canvas`), a card is **`surface-container-low`** (it was
  `surface`, which is the trap — MD3 means the page by that word), and
  `raised`/`raised-strong` became `surface-container`/`surface-container-high`. M6 took
  the other seven across 51 call sites — `ink`→`on-surface`,
  `ink-soft`→`on-surface-variant`, `ink-inverted`→`inverse-on-surface`,
  `line`→`outline-variant`, `line-strong`→`outline`, `positive-ink`→`primary`,
  `negative-ink`→`error`.
  **The trap in that pass, if you ever do another: hex equality in one theme is not
  identity.** `ink-faint` and `outline` are the same value on dark and different on
  light, because the light theme's faint tone was pulled from 50 to 45 to clear AA
  against `surface-container`. Merging them on the strength of the dark palette takes
  that correction with them, silently. The gate therefore requires a match in **both**
  themes before it calls something a duplicate, and a rename is driven from
  `extensionTokens` in the generator rather than from the emitted CSS.
- **The token *values* are generated, not chosen.** Since the Material Design 3
  migration (`docs/roadmap.md`, phase M1) everything between the `MD3-TOKENS`
  markers in `src/index.css` comes from `npm run sync-md3-tokens`. Do not hand-edit
  inside those markers — `npm run test:tokens` fails if the file has drifted from
  the generator, and it also re-runs the contrast gate. Each value is a *tone* from
  a tonal palette seeded by `#10b981`, so contrast is a property of the tone pair
  rather than something checked afterwards. The MD3 role names (`primary`,
  `on-surface`, `outline`, the `surface-container` ladder) are what components spell
  as of M6; the extensions beside them are the short list above.
  `npm run test:tokens` runs **two** gates — contrast, and the duplicate-role check
  M6 added — so a re-introduced alias fails CI rather than review.
  `scripts/md3-color-core.ts` implements HCT so no runtime dependency is added.
- **Two themes, one set of tokens.** `src/index.css` defines the palette under
  `@theme` (dark, the fallback) and again under `:root[data-theme="dark"]` and
  `:root[data-theme="light"]`. Components never change: only the values do. An inline
  script in `index.html` stamps `data-theme` **before first paint** — without it the page
  renders dark then repaints light, a flash no CSS ordering can fix because the choice
  lives in `localStorage`. `useTheme` seeds its state from that attribute rather than
  recomputing, for the same reason.
  The light palette is not the dark one inverted: status colours go *darker* to stay
  readable on a light page, and the faint inks go darker still. This is not symmetry for
  its own sake — `raised` sits at tone 94 on light but tone 12 on dark, so light has far
  less room beneath it before AA fails. Contrast was measured, not eyeballed, and is now
  enforced rather than recorded: `npm run test:tokens` checks every text token against
  each background this app actually paints text on — `surface` (the page),
  `surface-container-low` (a card), `surface-container-lowest` (the scoreline tray) and
  `surface-container` — in both themes, and refuses to emit a palette that falls below
  AA. The count of backgrounds and of pairings is `backgroundsFor` in the generator and
  the command's own output; neither is written here, because the version of this sentence
  that named three backgrounds and 70 pairings went stale twice without anything noticing.
  `ink-ghost`, used only for underline decoration and the large score separator, clears
  the 3:1 non-text floor.
  Checking every background rather than the page alone is what caught light's `ink-faint`
  on what M2 renamed `surface-container`, then about 4.35. That pairing is **latent, not shipped** — every
  `bg-raised` call site today pairs with `ink-soft` or `ink-muted`, and `ink-faint` only
  appears inside filled surfaces. Which is the point: it is a trap that springs the first
  time someone puts faint text on a badge, a hover state or a dialog, and nothing would
  have flagged it. Enforcing the floor beats recording a number that was true when written.
  **A surface dimmer than `surface-container` is not available, and the gate is
  why.** MD3's `surface-dim` was emitted at its own tones for the match page's
  scoreline tray and the palette became unemittable: on light, `ink-faint`
  measured 3.83:1 against a 4.5 floor and `ink-ghost` 2.69:1 against 3. Tried
  tone by tone to 93, the faintest ink still reached only 4.49 while the tray
  faded to 1.08 against the card — **no tone this palette can carry also reads
  as a tray**. `ink-faint` on `surface-container` clears by 0.09, so there is no
  headroom beneath it. Use **elevation** instead: `surface-container-lowest` is
  *lower* than a card, which means darker on dark and brighter on light, and
  every ink is better on it than on the card in both themes.
  `scrim` is deliberately dark in both themes: a near-white veil over a light page does not
  read as "the content behind is inactive". `plate` is its mirror — light in both themes,
  because the broadcaster marks it backs are dark artwork on a transparent ground and
  disappear against a dark page.
- **Type comes from the MD3 type scale.** `text-body-small` through
  `text-display-large`, defined in `src/index.css`. The scale is hand-written and
  sits *outside* the `MD3-TOKENS` markers, so adding a step is an ordinary edit —
  and steps are added only when something renders them, which is how
  `display-large` arrived for the player card's shirt-number watermark. A bare `text-sm`, `text-xs`
  or `text-2xl` in a component is a regression, and so is a `tracking-*` utility:
  each step carries size, line height **and** letter spacing together, so naming
  one thing is the point.
  **Weight is not part of the scale.** MD3 prescribes 500 for its title and label
  steps; this app's headings are bold by choice, so components keep their explicit
  `font-*`. Weight is separable from the scale the same way the typeface is.
  **The typeface is the system stack** — no webfont ships. Roboto is already fourth
  in Tailwind's default `--font-sans`, so Android renders in MD3's own face for
  nothing. See `docs/roadmap.md` M0 for what that trades away.
- **Radii come from the MD3 shape scale.** `rounded-x-small` / `rounded-small` /
  `rounded-medium` / `rounded-large` / `rounded-x-large`, defined in `src/index.css`.
  A bare `rounded`, `rounded-lg` or `rounded-xl` in a component is a regression —
  Tailwind's scale and MD3's share names but not sizes (`rounded-lg` is 8px in Tailwind,
  MD3's large is 16dp), which is exactly how one panel ends up a step off from the one
  beside it.
  **Which step a thing takes is decided by what it *is*, never by how deeply it is
  nested**, and the assignment list lives beside the scale in `src/index.css` rather
  than here — marks and inline targets x-small, panels and banners small, a modal
  `<dialog>` x-large, an MD3 pill control `full`. `large` is emitted and used
  nowhere, which is a fact rather than a gap to fill. Stating the negative matters:
  "outer panel, nested container one step down" is what a reader assumes when nothing
  is written, and it is not what this app does.
  **This is the one convention on this list that no gate can hold.** The token test
  fails a bare Tailwind radius, so the *vocabulary* is enforced; nothing can know
  which *step* an element should have taken. That is not hypothetical — M4 set the
  dialog step at x-large on 2026-08-25 and the Contas confirmation dialog was written
  two days later at `medium`, a second dialog shape on the same element with the same
  elevation and the same container colour. It shipped green and was found by reading,
  not by a check.
- **Raised panels use `Surface`.** It owns the rounded-border chrome that was
  hand-repeated in five components. Padding and layout stay with the caller, since those
  genuinely differ. `filled` adds the card background; table containers stay unfilled
  because the table header supplies its own. Buttons and the round selector are *control*
  chrome, a separate pattern, and deliberately not folded in.
  Use `as` when the element matters: `MatchPage`'s scoreboard is `as="article"`, both for
  the document outline and because an end-to-end spec selects `main article`. This is the
  rule that drifted once already — that card was hand-rolled with a *different* radius
  than every other card until M2 folded it back in.
  `as="a"` is a real case and the reason `href` is declared on `SurfaceProps`:
  `ComponentPropsWithoutRef<"div">` knows nothing of it, so without that one optional
  string a whole-panel link does not type-check and the next author hand-rolls the chrome
  beside it — which is the drift this component exists to stop. The **Meu time** strip is
  that shape: it offers exactly one thing, the club's page, and it used to say so with an
  underline under a 72px word inside a 736px band, so 545px of the largest element on the
  home page was inert and the crest — the thing a reader reaches for first — was outside
  the target entirely. The whole row is the link now, with a trailing chevron so the empty
  side reads as the rest of it, and `min-h-12` because this is a standalone control on its
  own line rather than a link inside content: the same distinction `BACK_LINK` draws and
  the exclusion `tabs-and-targets.spec.ts` names.
- **The Classificação freezes `#` and Clube.** Both are `sticky`, so the numbers scroll
  out from under the club name on a narrow screen rather than taking the name with them.
  Three things had to move together, and each is invisible until someone scrolls:
  the table is **`border-separate border-spacing-0`**, because in the collapsed model a
  cell's borders belong to the table and slide out from under a sticky cell — which means
  the row separator lives on every cell (`ROW_LINE`) rather than on the `<tr>`, since the
  separated model does not paint row borders at all; and the **G4/Z4 rail rides on the
  first cell, not the row**, because a row scrolls and would carry its rail away.
  The trap: `STICKY_CLUB`'s `left-*` must equal `STICKY_POSITION`'s `w-*` — read the
  two constants rather than a pair of numbers here, which said `left-12`/`w-12` until
  the variação made them 14. Widen the
  position column alone and the two frozen columns overlap or gap — and only while
  scrolled, because ordinary table layout puts them adjacent either way. Three specs in
  `tests/e2e/standings.spec.ts` scroll a 380px viewport and check exactly these three
  things; nothing else would catch any of them.
  **The pairing is broken far more easily by the CELL than by either constant**, and
  that is the half worth knowing before adding a mark to that column. A specified width
  is a request: the column clamps up to its own content minimum, exactly as `w-0` does
  two paragraphs down. So putting something in the cell that does not fit grows the
  column silently, `left-*` stops matching, and nothing looks wrong until a reader
  scrolls. Measured when the **variação** landed: a two-digit position plus a 4px gap
  plus an 8px glyph is a 32px minimum, `w-14` at `px-3` leaves 30, and the column
  rendered **58px against a `left-14` of 56**. The padding gave way rather than the
  width — `px-2`, which is why it now lives on `STICKY_POSITION` itself and not at the
  two call sites, since a header and a body cell disagreeing about it puts the `#` out
  of line with the numbers under it. Buying the same slack with `w-16` costs 8px of
  *frozen* width instead, which is the scarce thing here: the guarded ratio went
  0.619 → 0.646 at 380dp as shipped, against 0.669 the other way.
  **The variação also broke a spec that had nothing to do with it**, which is the
  `data-scatter-svg` lesson one section over arriving in this table:
  `row.locator("svg").first()` was the campanha's sparkline only while the row had one
  drawing, and an 8px triangle in the first cell made that spec measure a gap it was
  not about. It selects through the campanha cell now. Two more went red for the same
  shape — an assertion that the position cell is *only* digits, and one forbidding the
  two words "posições"/"primeiras" as a proxy for the zone rule. Both were claims about
  the zone written as claims about the whole cell, so both were narrowed to the thing
  they meant; the second is now read off `ZONES`, which also closed a hole it had, since
  G5's rule is "a quinta posição" and matched neither word.
  **A frozen column must never be the one that absorbs the table's `min-w` surplus.**
  Auto layout hands surplus to the widest column, which is Clube — so it rendered 219px
  around 137px of content at 360dp, and because that column is frozen the 82px of empty
  space was subtracted from the viewport permanently instead of scrolling away, leaving
  59px of a 326px container for all seven data columns. `STICKY_CLUB` therefore carries
  **`w-0`**, which does not mean zero: a specified width below a column's minimum is
  clamped up to it, so the column takes its content and the surplus goes to the columns
  that scroll. It needs no maintenance as club names change, where a hand-tuned `w-40`
  would clip a promoted club.
  The trap underneath it is that **the obvious measurement cannot see the failure**. A
  table column's minimum is its widest *unbreakable* run, so without `whitespace-nowrap`
  the clamp lands lower and the browser pays for it by wrapping the state onto a second
  line — 12 of 20 rows going 37px to 57px. Width alone reports that as a success, and it
  passed a `scrollWidth > clientWidth` clip check too, because a wrapped cell is not a
  clipped one. Assert **row height**, which is what `no club name wraps to a second line`
  does; the sibling spec asserts the frozen pair stays under 70% of the container.
  **It measured that at 380dp only, and 320 was 0.781.** Once `w-0` pins the pair
  to its content, the content is a fixed ~223px, so its share only rises as the
  screen narrows — the width a fit spec skips is the one that breaks. Below 360 the
  state (UF) is hidden and the crest gives up 4px of margin (`STATE_LABEL`,
  `CREST_GAP`), which brings 320 to 0.687 and changes nothing from 360 up; the spec
  now measures 320, 360, 375 and 380.
  **Pinning Clube does not end the surplus story — it moves it one column right.**
  Auto layout re-runs the same rule on what is left, and the next widest column is
  Campanha, which holds surplus worse than a tally does: the mark is a fixed 72px and
  nothing else in the cell grows, so the space cannot be taken up. At 1280px the column
  rendered 164px around that 72px, and the ~80px of blank between the end of the line and
  J read as a hole in the row rather than as spacing. `CAMPAIGN_COLUMN` therefore carries
  **`w-0`** for exactly the reason `STICKY_CLUB` does, and the surplus lands on the
  tallies, which share it evenly — P through SG went 55px to 70px.
  **Stretching the mark to fill the column is the other way to close that gap, and it is
  the wrong one.** `RankSparkline` keeps one geometry in the table and on the club page so
  a reader recognises the same shape in both, and a width that followed the viewport would
  not. Fix the column, never the mark.
  The two failures are not equally visible, which is the part worth carrying away. The
  frozen-column one starved the data columns on a phone — a functional failure, and a
  proportion of the container catches it. This one costs nothing functionally: the table
  still fits, no cell wraps, nothing is clipped, and **every existing spec passed
  throughout**. It is visible only to someone looking at the row, or to an assertion about
  the **gap to the next column** rather than about any column's width — which is what
  `the campanha column is no wider than the mark it holds` measures, at a desktop width,
  since a narrow screen sits near the table's `min-w` and has little surplus to misplace.
  **The scroll itself was invisible, and `TableScroller` is what says it exists.** On a
  reader's phone (a 720px-wide capture, 2026-09-11) the screen edge fell exactly on
  Campanha's right edge, so the visible half read as the whole table and J, V, E, D, SG
  and % were never found. Where the edge lands depends on the device width — at 360px in
  the suite it cuts Campanha — which is why no hint may rely on a column showing cut. Three signs, each driven by
  `useScrollEdges`: a fade at the right edge and a chevron in the header row while
  there is more to the right, and a shadow along the frozen pair once the reader has
  moved. Four things about it are load-bearing. **The overlays sit outside the Surface**,
  in a wrapper, because the Surface is the scroll container and anything inside it
  scrolls away. **The chevron steps by a column, never by pixels** — it
  aligns the column cut off at the right edge with the frozen edge. The numbers slide
  under Clube, so any pixel step carries some column past that edge without it ever
  being whole on screen; the first version stepped by the visible strip with a floor,
  and at 380px the floor slid Campanha 65px under Clube (measured by the spec's own
  failure, 239.4 against 174.5). It measures the sticky cells
  rather than taking a constant, since `STICKY_CLUB` is `w-0`. **The shadow is a named-group variant
  (`group-data-[scroll-start]/scroller:after:`), not a prop**, so crossing the edge
  re-renders the scroller and not twenty rows of sparklines. And **the chevron is
  `aria-hidden` with `tabIndex={-1}`**: the Surface becomes a focusable, labelled region
  while it overflows, which is the keyboard path and scrolls both ways; on a screen that
  fits there is no region, no tab stop and no hint, and a spec asserts that half too.
  **The Artilharia wraps its table in the same component, and there the measurement
  said the scroll itself was the defect.** It carried `min-w-[32rem]`, so on every
  phone a 512px table sat in a 286–378px box with G, A, P and J off to the right;
  without it the table fits at 320, 360, 375 and 412px, and the cost is wrapping —
  one name at 360 and 375, six at 320, none at 412 (2026-09-11, frozen snapshot).
  So the minimum width went and `TableScroller` stayed as the fallback, drawing
  nothing while the table fits. **Ask whether a table needs to scroll before
  telling the reader that it does**: a hint on a scroll nobody needed is a
  well-made sign pointing at a wall. Its column key moved below and outside the
  scroller, where the Classificação keeps its zone key.
- **Elevation comes from the MD3 level scale.** `shadow-level-0` …
  `shadow-level-5`, defined in `src/index.css`. A bare `shadow`, `shadow-lg` or
  `shadow-xl` is a regression, and the gate above catches it. Each level is
  MD3's two shadows — a key light at 30% and an ambient at 15% — transcribed
  from `material-web/elevation/internal/_elevation.scss` rather than from
  memory, because a plausible shadow is indistinguishable from a correct one to
  anyone reading the page.
  **The name is `--shadow-level-*` and not `--elevation-*`, and the namespace is
  why.** A Tailwind v4 utility exists only where a theme namespace says it does,
  so `--elevation-3` would be a real custom property no `elevation-3` class
  could reach — the same trap `--duration-short-4` records, where the class
  compiles to nothing and silently leaves the default in place.
  **Both themes carry the same shadows and dark simply renders them faintly**,
  which is the spec and the reason tonal elevation exists at all. The cheap
  alternative — shadows on light, tone alone on dark — is a third elevation
  model nobody else implements, and it makes a component's elevation a property
  of the theme rather than of the component. Verified by looking: on dark the
  shadows are all but invisible and the tonal ladder plus the borders carry the
  separation, exactly as predicted.
  Assignments are deliberately few, because nothing should be given a level to
  demonstrate the scale exists: both dialogs are **level 3**, the bottom
  navigation bar is **level 2**, and the sticky top app bar is **level 0 at rest
  and level 2 once content scrolls beneath it**. That last one is the only piece
  of elevation here with a behaviour — `useScrolled` — and it is the reason
  `tests/e2e/elevation.spec.ts` exists.
  Both bars keep their border in every state. MD3 would drop the top app bar's
  divider at rest; doing that is a visible restyle of every page rather than an
  elevation, so it was left alone.
- **Motion is MD3's, and `prefers-reduced-motion` is honoured.** A bare `transition`
  already means MD3 standard easing at 200ms, because `--default-transition-duration`
  and `--default-transition-timing-function` are overridden in `src/index.css` — do not
  add `duration-*`/`ease-*` per call site. **There is no `--duration-*` utility namespace
  in Tailwind v4**: `duration-short-4` compiles to nothing and silently leaves the
  default in place. The tokens are real custom properties, so hand-written CSS can use
  them; only the utility does not exist.
  **A Tailwind class that compiles is not a Tailwind class that applies.** A rotating
  disclosure chevron on the Jogadores page was written twice — `group-open:rotate-90` and
  an arbitrary `[details[open]_&]:rotate-90` — and *both* emitted a rule that the element
  genuinely matched, while `rotate` still computed to `0deg` in the page. The fix was to
  stop hand-drawing the mark and let `<details>` use the browser's own `::marker`, which
  rotates for free and cannot fail to compile. Two things worth keeping from it: the
  summary must **not** be `display: flex` or Chrome drops the marker (which is what pushes
  people toward a hand-drawn chevron in the first place), and a movement you cannot see is
  worth measuring in the page — `getComputedStyle(el).rotate`, not `.transform`, since
  Tailwind's `rotate-*` sets the `rotate` property.
  The reduced-motion block sets near-zero rather than `none`, so `transitionend` still
  fires, and it stops movement only — colour feedback survives, because a control that
  stops reacting is harder to use rather than calmer. `tests/e2e/motion.spec.ts` asserts
  both that motion exists and that the preference removes it.
- **Hover, focus and pressed come from `interaction.ts`.** `STATE_LAYER` is MD3's veil
  (8% hover, 10% focus and pressed, of `on-surface`); `FOCUS_RING` is the keyboard
  indicator; `LINK_UNDERLINE` and `BACK_LINK` cover the two text patterns. A
  hand-written `hover:` colour in a component is a regression.
  `FOCUS_RING` is deliberately **separate** from `STATE_LAYER`: they were one constant
  first, and the current nav entry — a filled chip that takes no veil — silently lost its
  focus ring with it. Anything focusable takes the ring; only things with a container
  take the veil. The general rule is worth more than the incident: hover and focus are
  two different affordances, and coupling them is invisible until exactly one control
  opts out of one of them. A focus ring must not be reachable only through a hover
  effect.
  Note these constants are plain strings, not functions taking a colour. Tailwind
  extracts class names by scanning source text, so `hover:bg-${role}/8` generates no CSS
  at all. Write a second constant rather than making one dynamic.
- **A link that leaves the app is `ExternalLink`**, and a club's links are built
  on it in `ClubLinks` once they have more than one call site. `ExternalLink`
  owns `target`, `rel` and the "(abre em nova aba)" suffix — the parts that
  drift when an anchor is copied: a copy missing `rel="noopener"` is a real
  defect that looks identical on the page, and until it existed those three were
  written by hand in a dozen places. `WikipediaLink` owns the rest of its anchor:
  glyph, label and the subject the suffix names. **The facades are the
  exception**, and deliberately: the video cards in `ClubVideos`, the "Também
  por" row in `MatchHighlights` and the post cards in `InstagramPosts` play in place
  on a plain click, so "abre em nova aba" would be false of them and they write
  their own anchor. `GLYPH` in `src/components/glyph.ts` holds the shared mark
  attributes, so an icon defined in `ClubView` cannot drift from one defined
  anywhere else. `ClubView`'s own marks stay local because they still have one
  call site each; that is the rule, not an inconsistency — the Wikipédia mark
  moved out the moment the match page became its second caller.
- **A match's status is `StatusChip`.** Both the fixture list and the match page used
  to carry their own copy of the label map *and* the colour map. Two copies of a lookup
  table is how a new status renders in one place and blank in the other.
  **Broadcaster marks are a plate, not a chip**, and deliberately so: a chip takes its
  container colour from the tonal system, and `--color-plate` must stay `#ffffff` in both
  themes or the marks that are dark artwork on transparent grounds vanish silently. Keep
  the `data-mark` attribute — `tests/e2e/broadcasts.spec.ts` selects on it precisely so
  markup can change. (This said "nine specs" while one did; count the references.)
- **The player card sets numbers apart from words.** A **Ficha** is a figure —
  `Camisa`, `Idade`, a scorer's four tallies — set at the headline step in
  `text-primary` against a short accent rule, with the unit in its caption rather
  than in the value. A **Linha do cartão** is a word — `Posição`,
  `Nacionalidade`, `Nascimento` — label left, value right, on a hairline. Before
  the split every fact on the card was the same size and the same grey, which is
  a wall of equal-looking values with nothing to look at first.
  Both are built from *lists of what is present* rather than from a fixed grid,
  because almost every field is optional: the competition's team payload carries
  no shirt number for anyone, so `Camisa` and the watermark exist only once
  `/api/players/:id` has answered, and the artilharia knows a name and four
  tallies and nothing else. Nothing renders a dash standing in for a value that
  was never reported.
  The body is spaced with `space-y`, not a `mt-*` per block, for the same reason:
  a margin belonging to a conditional block leaves a gap above whichever one
  happens to be first — the artilharia card opened with exactly that.
  **`text-primary` is text here, which MD3 does not promise.** Its guarantee is
  that `on-primary` is readable on `primary`; primary *as ink on a surface* is a
  pairing nothing had used, so it was added to the contrast gate as a live
  pairing rather than measured once and written down. It clears AA in both
  themes, tightest at 5.49 on light.
- **The provider's English is translated at the edge, never rendered.**
  `positionLabel` and `nationalityLabel` in `player-core.ts` are the two, and
  both follow the same contract: an unmapped value is shown **verbatim** rather
  than guessed at or blanked, because the English word serves a reader better
  than nothing and is a visible prompt to add the row. `NATIONALITY_LABELS` is
  hand-written — `Intl.DisplayNames` speaks ISO region codes while the provider
  sends its own names (`DR Congo`, `Ivory Coast`), and `England` is football
  counting the home nations separately. A unit test asserts every nationality in
  `squads.ts` is mapped, so the table goes red on the next `sync-seed-data`
  rather than silently leaking English after a transfer window.
- **The card's club comes from the page, not from the enrichment.**
  `/api/players/:id` reports football-data's `currentTeam`, which for an
  international is frequently the **national team** — opened from the Corinthians
  elenco, Memphis Depay's card read "Netherlands" under his name and
  "Netherlands" again as his nationality, verified on a live payload. Whoever
  opened the card already knows better: `PlayersView` attaches the club whose
  elenco the player was listed in, and a scorer carries the club they scored for,
  and both are Série A clubs by construction. `mergePlayer` is deliberately left
  alone — it is right for every other field.
- **The player card is a native `<dialog>` opened with `showModal()`.** Not an overlay
  div: modality has to be real. It carried `aria-modal="true"` for months while Tab
  walked straight out of it. The browser gives the focus trap, `inert` behind, the top
  layer and focus restoration; body scroll is locked separately, because modality does
  not stop the page scrolling. Two traps if you touch it: Escape arrives as `cancel`,
  not `keydown`; and Tailwind's preflight resets `margin: 0`, which kills the user
  agent's `dialog { margin: auto }`, so horizontal centring must be set explicitly.
- **A control's touch target is 48dp; its visible box is a separate decision.**
  `TOUCH_TARGET` in `interaction.ts` is MD3's 48dp target on a **pseudo-element**,
  composed by `controlClasses` and by both account controls; `BOX` in `Button.tsx`
  is what you see. Measured at 375dp, because the plan's arithmetic
  under-counted: the stepper was 34×32, its picker 32×61, the toggle 38×39, the
  back link 20 tall.
  **The two rules are not the same rule, and conflating them shipped a bug.** M9
  put the floor on the *box* as `min-h-12`, which made every target 48 and — because
  **a `min-height` beats a `height` whatever the class order** — silently
  overrode the `h-10` that #173 had just used to level the top app bar's trailing
  group. Production at `844cb15` had a 48×48 toggle beside a 40×97 account
  control: two changes each right on their own, 8px apart. The `bar` size is
  MD3's 40dp top-app-bar container; every other size keeps the 48dp box, because
  nothing argued for a smaller body control.
  Note this is *not* the neighbouring "do not pass a utility through `extra` that
  the base already sets" rule, which is about equal specificity resolved by
  stylesheet order. A minimum beats a height regardless of order, so reordering
  classes cannot fix it.
  `tests/e2e/touch-targets.spec.ts` asserts the container, the target, and — the
  only one a stylesheet cannot fake — **a press 4px outside the box that still
  reaches the control**.
  **The floor deliberately does not reach the inline links**, and that is the
  part to understand before "fixing" it. Twenty club names at 16px in the
  Classificação, ten fixture links at 24px on Jogos and roughly 950 player-name
  buttons at 24px on Jogadores are links *inside* content, not targets beside
  it; raising them means re-laying-out three pages, and a spec asserting "every
  anchor is 48dp" would fail on all of them until someone deleted the spec.
  `tests/e2e/tabs-and-targets.spec.ts` therefore names the set it measures
  rather than inferring it, and the exclusions are written down in
  `docs/md3-completion-plan.md` under M9 so they read as a decision.
- **Three MD3 components this app deliberately does not adopt.** Recorded here
  because each is a thing a later session would otherwise "fix":
  - **The round picker stays a native `<select>`**, where MD3 would have a menu.
    The platform control brings the mobile picker, the keyboard model and the
    accessibility tree for nothing; a re-implementation buys an appearance and
    owes focus management, typeahead and dismissal for ever. `controlClasses`
    already makes it look like the buttons beside it.
  - **The icons stay hand-drawn.** Material Symbols arrives with several hundred
    glyphs to serve five, against an app that ships no UI dependency at all, and
    `SectionIcons.tsx` already draws them in `currentColor` so they re-theme for
    free.
  - **`Surface` is a fourth card and stays one** — outlined chrome that
    optionally takes the *filled* variant's container colour. Three components
    where the app renders one shape is a vocabulary with two speakers. The
    reasoning lives in the component.
- **Controls use `Button` or `controlClasses`.** The bordered chrome was hand-written in
  six places, which is how a stepper ends up with a `transition` its neighbour lacks.
  Two variants exist — `outlined` and `tonal` — and MD3's other three are absent because
  nothing renders them. `tonal` also takes MD3's pill where `outlined` keeps the shape
  scale, because a pill beside a right-aligned `tabular-nums` column reads as floating.
  `Button` also defaults `type="button"` — the HTML default is `"submit"`, which silently
  submits any enclosing form. `controlClasses` exists separately because not every control
  is a `<button>`: the goals link is an anchor and the round picker a `<select>`, and both
  should look identical to the buttons beside them.
  **Do not pass a utility through `extra` that the base already sets.** Two utilities of
  equal specificity are resolved by *stylesheet* order, not class order, so an override
  like `text-ink` against the base's `text-ink-soft` is a coin flip. Change the base, or
  live with it.
- **Brazilian Portuguese copy** — all user-facing text and error messages are pt-BR in the
  football-broadcast voice. `CONTEXT.md` is the domain glossary: **consult it before naming
  a new concept, and add the term there in the same commit that introduces it.** Each entry
  carries an `_Avoid_` line recording names that were considered and rejected, so a rejected
  name does not quietly come back.

  **Consult it by term — do not read it whole.** It is 146.701 bytes in one flat
  `## Language` section, 108 entries and no subsections, so there is no "relevant part" to
  open: the unit of lookup is the headword. `cat` costs ~36k tokens that are then re-sent on
  every later tool call of that session; one lookup costs ~0,5k. Measured 2026-11-14:

      grep -n -A6 '^\*\*Campanha\*\*:' CONTEXT.md     # 506 bytes
      cat CONTEXT.md                                   # 146.701 bytes

  Every entry begins at column 1 as `**Term**:`, so anchoring on `^\*\*` is what stops a
  lookup matching the dozens of bold run-ins mid-paragraph. To survey the vocabulary instead
  of one word, `grep -n '^\*\*[^*]*\*\*:' CONTEXT.md` lists all 108 headwords for 2.746
  bytes.

  **The headwords are Portuguese and the definitions are English, and that mismatch has
  already cost a session real time.** PR #461 grepped `fachada` — the word from its own
  commit message — got 0 hits, and read the silence as a bad deploy when it was a bad
  instrument: the term is filed under its Portuguese headword and described in English, so
  `facade` was the hit (`fachada` 0, `facade` 4, re-measured 2026-11-14). **A 0 from this
  file means "wrong word", not "absent".** Confirm with a known-negative — run the same
  search for something you know *is* there, and if that also returns 0 your pattern is
  broken, not the glossary.
- **Path alias `@/*` maps to the repo root**, declared in both `tsconfig.json` and
  `vite.config.ts`. Imports read `@/standings-core`, `@/src/types`.
- **Server dependencies go in `dependencies`, not `devDependencies`** — the build bundles
  the server with `--packages=external` and the production host installs `npm ci --omit=dev`,
  so anything needed at runtime must survive that. Commit the updated `package-lock.json`.
- **New env vars must work when unset** — the production `.env` is not updated
  automatically on deploy, so every new variable needs a safe in-code default.
