# Roadmap

Where Portal Brasileirão is, what is next, and a phased plan for adopting
Material Design 3. Written 2026-08-25.

This is a planning document, not a specification. Anything here that contradicts
`CLAUDE.md` or `CONTEXT.md` is wrong — those describe what the code actually
does, and they win.

## Where the project is

Live at <https://brasileirao.mpbarbosa.com>, deployed from `main` by GitHub
Actions through OIDC → S3 → SSM, with no long-lived credentials and no SSH.
Every running instance reports the commit it was built from at `/api/health`,
and the deploy asserts that the live commit is the one it just built.

- **Data** — football-data.org free tier (`BSA`, 10 requests/minute), cached
  60s/15s with a circuit breaker. Everything the provider does not carry is
  curated on a workstation and committed: broadcasts, venues, highlights, club
  Instagram handles, broadcaster marks.
- **Shape** — 12 pure `*-core.ts` modules (no I/O, unit-tested), 12 components,
  one Express process serving the API and the SPA.
- **Tests** — 224 unit, 283 end-to-end across desktop and mobile, all against a
  frozen snapshot so a red build always means the code broke.
- **Design** — Tailwind v4 with 64 semantic colour tokens, two themes, measured
  contrast (worst text token 4.55 against AA's 4.5), and two primitives:
  `Surface` and `Button`.

## In progress

**Highlights backfill.** 235 finished matches, of which a handful are curated.
`scripts/find-highlights.ts` finds each fixture's "melhores momentos" on ge tv,
CazéTV and UOL Esporte and verifies it against kickoff. Running by round in
phases, newest first, one commit per phase.

Two things learned while starting it, both now fixed: a single failed fetch used
to abort a whole run, and the end-to-end specs depended on some fixture in round
24 *not* being curated, so a successful backfill would have broken CI.

## Near term

- Finish the backfill (rounds 22–24, then 16–21, 9–15, 1–8).
- Re-run `sync-broadcasts` weekly as the season advances; the cron already does.
- Watch for broadcasters CBF names that we render as wordmarks — ESPN/Disney+,
  Band, SportyNet — and add marks where a public-domain one exists.

## Constraints that must survive any redesign

Recorded here because they are easy to undo by accident:

1. **Contrast is measured, not eyeballed.** Every text token clears AA. A
   redesign that ships a token without checking it is a regression even if it
   looks fine on the designer's monitor.
2. **The theme is chosen before first paint** by an inline script in
   `index.html`. Any theming change must keep that, or the page flashes.
3. **Copy is Brazilian Portuguese** in the football-broadcast voice, and
   `CONTEXT.md` is the glossary. New concepts get an entry in the same commit.
4. **No runtime dependency on a third party for assets.** Crests come from the
   provider; broadcaster marks are served from our own origin precisely because
   hotlinking Commons earns a 429.
5. **CI needs no secrets.** Do not add a provider token to test "the live path".

---

# Migrating to Material Design 3

## The decision that comes first

"Adopting MD3" can mean two quite different things, and they have very different
costs here:

**A. MD3 as a design system.** Adopt its colour roles, tonal palettes, shape
scale, elevation model, state layers and type scale — expressed as our own
tokens, still rendered by Tailwind. No new runtime dependency.

**B. MD3 as a component library.** Add `@material/web` (Google's own web
components) or MUI, and rebuild the UI on their components.

**Recommendation: A, with B considered only for the player dialog.**

The reasoning is specific to this project rather than a general preference:

- The hard part of MD3 is its colour system, and this app already has the shape
  of one — 64 semantic tokens, no raw palette shades in components, two themes
  driven by the same names. Mapping those to MD3 roles is a rename plus a
  palette regeneration, not a rewrite.
- The component surface is 12 components, several of which (`StandingsTable`,
  `MatchList`) are domain-specific and have no MD3 counterpart. A library buys
  little and costs a lot.
- The current client bundle is ~231 kB. `@material/web` plus its Sass output
  would be a large fraction of that again, for components we would use once.
- The accessibility work — measured contrast, `role="status"` on the loading
  line, accessible names that do not depend on an image loading — is ours and
  is easy to lose in a port.

Option B is worth revisiting for `PlayerOverlayCard`, where MD3's dialog gets
focus trapping, scrim behaviour and motion right and ours is hand-rolled.

## Phases

Each phase is one pull request, keeps all tests green, and re-measures contrast
before merge. Screenshots in both themes go in the PR so the visual delta is
reviewable rather than described.

### M0 — Decide and pin down (no code)

- Confirm A vs B above.
- Choose the **seed colour**. MD3 generates tonal palettes from one seed; the
  natural candidates are the Brasileirão green, a neutral, or the current
  accent. This is a brand decision, not a technical one, and it determines every
  colour in the app.
- Decide the **typeface question**: MD3 assumes Roboto/Roboto Flex. Self-hosting
  a variable font costs ~100 kB and a render-blocking decision; the system stack
  costs nothing and is what ships today. These are separable — the type *scale*
  can be adopted without the typeface.
- Write down what "done" means: contrast at least as good as today, no bundle
  regression beyond an agreed budget, all 283 end-to-end tests green.

**Exit criteria:** the seed colour and typeface decision are recorded in
`CONTEXT.md`.

**Decided, 2026-08-25:**

- **A, not B.** MD3 as a design system in our own tokens. No new runtime
  dependency; the generator runs on a workstation and commits hexes. Confirmed
  by the measured result — the client bundle is unchanged at 231.35 kB.
- **Seed: `#10b981`**, the emerald the app already used as its accent. Recorded
  in `CONTEXT.md` under **Semente**.
- **Bundle budget:** no JS increase at all. CSS may grow by the size of the role
  vocabulary; M1 spent 1.83 kB raw / 0.41 kB gzipped, part of which returns in
  M2 when the legacy aliases are deleted.
- **Typeface: the system stack.** Decided 2026-08-25, at the start of M3. No
  webfont is shipped; the app keeps Tailwind's default `--font-sans` and each
  platform renders in its own UI face.

  The reasoning is specific to this app rather than a general preference.
  A subsetted Roboto Flex is roughly 40–100 kB, which would be the single
  largest asset on a page whose whole value is glancing at a score, often on
  mobile data mid-match. **Roboto is already fourth in the default stack**, so
  Android — the dominant platform for a Brazilian football app — renders in
  MD3's own typeface at zero cost. And pt-BR strings run long: "Melhores
  momentos" and "Onde assistir" already sit close to their containers on
  mobile, so a swap that changes metrics risks reflowing exactly the strings
  with least room.

  What is given up: MD3's letter-spacing values are tuned for Roboto and are
  marginally off on SF Pro and Segoe UI, and line lengths vary a little by
  platform. Revisit only if the app gains a brand identity that needs a
  specific face — this is a brand decision, not a technical one, and the type
  *scale* below is unaffected either way.

### M1 — Colour roles and tonal palettes — **done**

The largest phase, and the one that carries the most value.

Implemented by `scripts/md3-color-core.ts` (HCT: the CAM16 transform and the
gamut solver) and `scripts/generate-md3-tokens.ts` (palettes, role mapping,
contrast gate). Regenerate with `npm run sync-md3-tokens`; verify with
`npm run test:tokens`, which fails if `src/index.css` has drifted from the
generator or if any pairing falls below its floor.

Two departures from a naive reading of the spec, both deliberate:

- **The neutral palettes do not follow the seed.** MD3 derives neutrals from the
  seed hue, which here would tint every surface green — a *larger* change than
  the migration was asked to make, since the app's surfaces are slate and the
  seed is 90 degrees away. The neutral hue is pinned to the existing slate;
  Material's own `DynamicScheme` accepts explicit neutral palettes, so this is a
  supported configuration rather than a departure from the system.
- **`surface` is not emitted under its MD3 name.** MD3 spells the page
  `surface`; this codebase spells the page `canvas` and a *card* `surface`.
  Emitting both would declare `--color-surface` twice and leave the winner to
  source order. `canvas` carries the role until M2 renames the call sites, which
  keeps M1's promise that no component changes in the phase that changes colour.

- Generate tonal palettes (0–100) from the seed.
- Introduce MD3 role tokens: `primary`/`on-primary`/`primary-container`,
  `surface` and the `surface-container` ladder, `outline`/`outline-variant`,
  `error`, and their `on-` pairs.
- Map today's tokens onto them rather than replacing them at every call site:
  `canvas` → `surface`, `raised` → `surface-container`, `ink` → `on-surface`,
  `line` → `outline-variant`, `negative` → `error`. Keeping the aliases for one
  phase means components do not change in the same PR that colours do, so a
  visual regression has one obvious cause.
- Re-measure every text pairing. MD3's roles are designed to hit contrast by
  construction, so this should improve on today's worst case of 4.55 — but
  "should" is not "did".

**Risk:** MD3's light and dark schemes are generated, not hand-tuned. The
current light theme was deliberately *not* the dark one inverted — status
colours were darkened to stay readable on a light page. Check that generated
palettes preserve that, and override where they do not.

**How that risk landed.** It was real, and the generated tones did not preserve
it on their own. Light's faint tones had to be pulled darker than the mirrored
dark tones would suggest, because the two themes' backgrounds are not mirror
images: `raised` sits at tone 94 on light but tone 12 on dark, so light has far
less room beneath it before AA fails. Tone 50 measured 3.86:1 against `raised`
and now sits at 45.

The gate also caught a pre-existing hazard rather than one the migration
introduced. The 4.55 worst case recorded above was measured against `canvas`
only, and stated as though it covered everything; light's `ink-faint` on
`bg-raised` sat at about 4.35 and had never been checked.

Be precise about the severity, because it is easy to overstate: that pairing is
**latent, not shipped**. Every `bg-raised` call site pairs with `ink-soft` or
`ink-muted`, and `ink-faint` appears only inside filled surfaces, where
`bg-surface/50` over `canvas` resolves to about 4.64. Nothing renders the
failing combination today.

That makes it worth fixing rather than less so. A latent pairing below AA is a
trap that springs the first time someone puts faint text on a badge, a hover
state or a dialog — and it would ship silently, because a contrast figure
recorded in a comment ages the moment anyone adds a background token. The
generator now tests every text token against all three backgrounds on every
run. **Worst text pairing is 4.59:1 across 70 pairings, both themes.**

The theme-invariant tokens survived: `scrim` is MD3's own neutral tone 0, and
the `plate` trio is excluded from the tonal system by name, so the broadcaster
marks still sit on a light backing in both themes.

### M2 — Shape, elevation and state layers — **done**

**Read the gate's margin report before retoning anything.** MD3 expresses
elevation as tonal surface tint, so this phase moves the very surface tones the
text tokens are measured against. `npm run test:tokens` prints the tightest
pairings with their headroom, split into what components actually render and
what is merely latent.

Headroom is the number to read, not the ratio: a text pairing and a graphic
pairing at the same ratio are not equally safe, because their floors differ
(4.5 against 3:1). At the end of M1 the tightest *rendered* pairing is
`light: ink-faint on surface` at **+0.33**; the tightest overall is
`light: ink-faint on raised` at +0.09, but nothing paints it — every
`bg-raised` call site pairs with `ink-soft` or `ink-muted`. Spend the scarce
headroom on the first, not the second.

**Backgrounds are not the same thing as background tokens.** A filled `Surface`
is `bg-surface/50`, so the colour behind a card's text is a composite of
`surface` over `canvas`, and measuring against the solid token measures a colour
the app never paints. The gate composites it (`blend` in `md3-color-core.ts`).
Note the direction of that correction flipped with the migration: the old
palette's `canvas` was lighter than its `surface`, so compositing cost contrast;
under MD3 the page is tone 98 and the card tone 96, so it gains a little. Do not
carry the old intuition forward — `surface/50 over canvas` currently measures
+0.46, safer than the solid token, and that relationship is a property of the
tone ordering rather than a fact about alpha.

- **Shape scale.** Replace the three ad-hoc radii (`rounded-lg`, `rounded-xl`,
  `rounded`) with MD3's extra-small through extra-large tokens. Small surface
  area — about a dozen usages.
- **Elevation.** MD3 expresses elevation as *tonal* surface tint, not shadow.
  This suits the app, which already distinguishes `surface`/`raised` by colour
  rather than shadow, and it is what makes MD3 dark themes legible.

  **Open question: should `Surface`'s filled variant stop being `bg-surface/50`?**
  MD3 encodes elevation in the token, so applying 50% alpha to it halves the
  system's own signal. Worth deciding deliberately rather than inheriting.

  Measure before deciding, because the intuitive argument overstates it. The
  alpha halves the separation in *every* palette — that is what 50% does — so
  this is not something the migration introduced. Tone separation between page
  and card, solid then composited:

  | | solid | after `/50` |
  |---|---|---|
  | MD3 light | −2.06 | −1.01 |
  | pre-migration light | +1.82 | +1.09 |
  | MD3 dark | +4.24 | +2.22 |
  | pre-migration dark | +6.11 | +2.75 |

  Light is essentially unchanged (1.01 against 1.09). The sign flips — MD3's
  card is *darker* than its page, so the composite moves it lighter, toward the
  page — but the magnitude does not. Dark is where MD3 differs: its ladder is
  deliberately tighter, compensated by having more rungs.

  Both palettes landing within a hundredth of one tone unit is the useful part:
  "is one tone unit of separation enough?" was never an MD3 question. The
  migration inherited it, unchanged, from what shipped before. So M2 decides
  this on the merits — there is no previous behaviour worth preserving, and no
  regression to weigh against the elevation model.

  And tone is not the only cue. A filled `Surface` is `rounded-lg border
  border-line` before it is a fill, and MD3 strengthens that border
  considerably — `line` against `canvas` goes from 1.18:1 to **1.62:1** in
  light and 1.38:1 to **1.99:1** in dark. The card reads as a card mostly
  through its outline, which the migration improved by about 40%. So this is a
  design call about honouring the elevation model, not a legibility defect.
  `MatchPage`'s article uses the same 50% fill and should be decided with it.
- **State layers.** The seven hand-written `hover:` utilities become a
  consistent overlay at MD3's prescribed opacities for hover, focus and pressed.
  This fixes a known inconsistency — a stepper with a `transition` its neighbour
  lacks — rather than merely restyling it.

**Exit criteria:** no raw radius or hover colour in any component. **Met** — a
strict grep for Tailwind's own radius names and for `hover:` colours across
`src/**/*.tsx` returns nothing but prose in comments.

**What was decided, and what it cost.**

- **The shape scale was adopted at today's values, not MD3's per-component
  assignments.** Tailwind's `rounded`/`rounded-lg`/`rounded-xl` are 4/8/12px and
  land exactly on MD3's extra-small/small/medium, so all 15 call sites moved with
  no visual change at all. MD3's *assignments* — pill buttons, a 28dp dialog,
  12dp cards — are a separate, visible restyle and remain unadopted. That is a
  deliberate split: the scale is infrastructure, the assignments are design.
- **`Surface`'s filled variant went solid.** `bg-surface/50` was diluting the
  elevation MD3 encodes in the token; the page-to-card separation roughly
  doubles, from about one tone unit to two. The composite disappears from the
  contrast gate with it, though `blend` stays in `md3-color-core.ts` for the
  next translucent fill.
- **The surface ladder took its MD3 names**; `ink` and `line` did not. Renaming
  `ink` alone is 57 call sites and has nothing to do with elevation, so it is a
  separate pass rather than a rider on this one.

**Two things found while doing it, neither of which was on the list.**

The app had **no focus styles at all** — no `focus:`, no `focus-visible:`, no
ring anywhere. Keyboard users got whatever the browser drew. MD3's state layer
model covers focus, so `FOCUS_RING` closes it.

`MatchPage` had **two** panels wearing `Surface`'s chrome by hand, and the
difference between them is the better argument for the exit criterion.

The scoreboard was `rounded-xl` where every `Surface` is `rounded-lg` — visibly
a step off, and the kind of thing review eventually catches. The campanha panel
below it was `rounded-lg`: pixel-identical to the component it duplicated, and
therefore invisible. That is the dangerous one. Copied chrome looks correct on
the day it lands and only separates when the shared component moves — and this
phase is exactly that event. Moving `Surface` onto the shape tokens would have
left the copy behind at the old radius while every real `Surface` advanced.

Both are `<Surface>` now. The `as` matters on the scoreboard: an end-to-end spec
selects `main article`, and a bare div would have matched nothing.

**A verification trap worth recording, because it cost two wrong readings.**
Tailwind's `transition` covers `background-color` *and* `outline-color`. Reading
a computed style immediately after `hover()` or `Tab` samples the animation at
t=0 and reports the *rest* value — which looked exactly like "the state layer
does not work", then like "the focus ring is the wrong colour". Both were the
measurement. Wait out the transition before reading, or the DOM will lie to you
in a way that looks like a CSS bug.

### M3 — Typography — **done**

- Adopt the MD3 type scale (display / headline / title / body / label, each in
  large / medium / small) as tokens.
- Apply per component, checking pt-BR strings specifically: Portuguese runs
  longer than English, and "Onde assistir" and "Melhores momentos" already sit
  close to their containers on mobile.
- Typeface per the M0 decision.

**Exit criteria:** no bare Tailwind text size and no `tracking-*` utility in any
component. **Met** — a strict grep returns nothing.

**Each step carries size, line height and letter spacing together**, so a
component names one thing rather than pairing a size with a leading and hoping
the next component pairs them the same way. That is most of the value: the app
previously wrote `text-sm` and its leading independently at 28 call sites.

**Weight is deliberately not in the scale.** MD3 prescribes 500 for title and
label steps, but this app's headings are bold by choice and flattening them is a
restyle rather than a scale adoption. Components keep their explicit `font-*` —
weight is separable from the scale exactly as the typeface is.

**Four of the seven sizes already matched.** 12, 14, 16 and 24px are MD3's
body-small, body-medium, title-medium and headline-small precisely, the same
coincidence the shape scale had. Three did not exist in MD3 and moved:

| was | now | change |
|---|---|---|
| `text-lg` 18px — player name | `title-large` 22px | +4px |
| `text-xl` 20px — club name | `title-large` 22px | +2px |
| `text-3xl` 30px — the score | `headline-medium` 28px | −2px |

The first two are the point rather than a side effect: the player name and the
club name are the same kind of heading — the entity a detail view is about — and
they were two different sizes. The scale makes them one.

`display-*` and `headline-large` are defined nowhere, following the rule
`Button`'s size list already sets: steps that nothing uses are not written down.

**The pt-BR risk did not materialise.** Measured rather than eyeballed: five
routes in both themes at 375px, checking page scroll width and every element's
own overflow, ignoring `sr-only` (clipped to 1px by design) and `overflow-x`
containers (meant to scroll). Zero page overflow, zero clipped visible text.
Worth keeping the method — the first run reported 40-odd "overflows" that were
entirely screen-reader text and scrollable tables.

### M4 — Components

In ascending order of risk:

1. **Chips** — broadcaster marks and status badges become MD3 assist chips. The
   plate already behaves like one.
2. **`Button`** — map to MD3's filled / tonal / outlined / text variants. Today
   there is one variant; the round stepper and the highlights links would
   naturally differ.
3. **`Surface`** — becomes an MD3 card, with the elevation from M2.
4. **`NavBar`** — MD3 navigation bar on mobile, navigation rail or tabs on
   desktop. This is the one component whose *structure* changes, and
   `CLAUDE.md` currently promises "NavBar never changes" when a section is
   added — that promise must survive.
5. **`PlayerOverlayCard`** — the candidate for a real MD3 dialog implementation.

### M5 — Motion

- MD3 easing and duration tokens for the theme toggle, dialog and round changes.
- Honour `prefers-reduced-motion`, which the app does not currently check.

## What this does not change

Data, routing, caching, the provider integration, the deploy pipeline, and every
`*-core.ts` module. The migration is confined to `src/index.css` and
`src/components/`, which is the strongest argument that it is safe to attempt
incrementally — and the reason each phase can ship on its own.

## Open questions

- Does the seed colour come from the competition, the app's own identity, or
  stay neutral so 20 club colours do not clash with it?
- Is a bundle increase acceptable at all, given the app currently ships no UI
  dependency?
- Should MD3 dynamic colour (palette derived from the club being viewed) be
  explored, or is a stable palette better for a scoreboard people scan quickly?
