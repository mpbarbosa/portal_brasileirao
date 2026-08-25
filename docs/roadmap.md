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
- **Typeface: still open**, and deliberately not decided here — it belongs to
  M3, and nothing in M1 depends on it. The type *scale* remains separable from
  the typeface.

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

### M2 — Shape, elevation and state layers

- **Shape scale.** Replace the three ad-hoc radii (`rounded-lg`, `rounded-xl`,
  `rounded`) with MD3's extra-small through extra-large tokens. Small surface
  area — about a dozen usages.
- **Elevation.** MD3 expresses elevation as *tonal* surface tint, not shadow.
  This suits the app, which already distinguishes `surface`/`raised` by colour
  rather than shadow, and it is what makes MD3 dark themes legible.
- **State layers.** The seven hand-written `hover:` utilities become a
  consistent overlay at MD3's prescribed opacities for hover, focus and pressed.
  This fixes a known inconsistency — a stepper with a `transition` its neighbour
  lacks — rather than merely restyling it.

**Exit criteria:** no raw radius or hover colour in any component.

### M3 — Typography

- Adopt the MD3 type scale (display / headline / title / body / label, each in
  large / medium / small) as tokens.
- Apply per component, checking pt-BR strings specifically: Portuguese runs
  longer than English, and "Onde assistir" and "Melhores momentos" already sit
  close to their containers on mobile.
- Typeface per the M0 decision.

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
