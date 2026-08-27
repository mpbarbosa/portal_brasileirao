# Roadmap

Where Portal Brasileirão is, what is next, and the phased plan for adopting
Material Design 3 — which is now **complete and deployed**. Written 2026-08-25;
the migration ran the same day.

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
- **Shape** — 14 pure `*-core.ts` modules (no I/O, unit-tested), 15 components,
  one Express process serving the API and the SPA.
- **Tests** — 256 unit, 316 end-to-end across desktop and mobile, all against a
  frozen snapshot so a red build always means the code broke.
- **Design** — Tailwind v4 with **Material Design 3** throughout: 47 colour
  tokens generated from one seed, a shape scale, a type scale, state layers and
  motion, in two themes. Contrast is **enforced rather than recorded** —
  `npm run test:tokens` runs in CI and refuses a palette whose text pairings
  fall below AA. Worst text pairing 4.59 across 70 pairings. Primitives:
  `Surface`, `Button`, `StatusChip`, and the interaction constants.

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

Left over from **Árbitro** (item 1 below), which surfaced more about the
provider than it needed to build:

- **Refresh the README screenshots once PR #104 deploys.** `MatchPage` gained a
  row, which is an appearance path, so the capture job is red by design — no
  `Screenshots-unaffected:` trailer applies, because the change genuinely
  reaches a paint. The catch is that the row renders **only against live data**,
  so a local capture cannot show it either: the sequence is merge, deploy, then
  capture from the live site.
- **Watch whether upstream backfills the officials for rounds 16–24.** BSA names
  a referee on 157 of 380 fixtures — rounds 1–15 complete, 16 onward mostly not
  — so the row is absent from roughly 60% of match pages today. It fills in
  **retroactively**, since finished matches gain one, so this may resolve
  itself and nothing in the app needs changing if it does. Worth knowing before
  someone reads a missing row as a bug and goes looking for one.
- **Do not translate a role the payload has not sent, and do not prettify one it
  has.** `refereeRoleLabel` maps `REFEREE` alone, because that is every one of
  the 356 entries across BSA, PL and CL. If the tier ever widens, an assistant
  reaches the page as `ASSISTANT_REFEREE_N1` — ugly on purpose, and the visible
  prompt to add the row rather than a rendering defect to patch over.
- **The officials' `nationality` is deliberately dropped, and the reason is a
  live example rather than a principle.** It reads `Brazil` for 156 of the 157
  entries, and the one exception is an **upstream error**: a French official
  recorded against Coritiba × Chapecoense in round 22. So the field offers one
  word repeated on every page, plus one that is wrong.

## From the Brasileirão Pro import

`brasileirao-pro.zip` — an AI Studio prototype of a Série A analytics dashboard —
was read for ideas on 2026-08-27. Its design spec is imported verbatim at
[`brasileirao-pro-design.md`](brasileirao-pro-design.md) and the full judgement,
including six rejections and the reason for each, is
[`brasileirao-pro-proposal.md`](brasileirao-pro-proposal.md). **Read the proposal
before starting any of these** — every item below carries a trap that is stated
there and not repeated here.

Nothing in this list needs a new upstream request. One item surfaces a field the
provider already sends; the rest are derivations or rules.

**Now — no decision to make.** Six of these are one attribute, one element or a
paragraph of prose.

1. ~~**Árbitro on the match page.**~~ **Shipped.** `refereeRoleLabel` translates
   at the edge and the row is absent when upstream names nobody, which is 223 of
   the 380 fixtures — finished ones included, so the field fills in
   retroactively rather than at kickoff. Two things the payload settled that the
   proposal could only guess at: **every** one of the 356 entries across BSA, PL
   and CL is `REFEREE`, so the wider vocabulary it predicted is not reachable on
   this tier and only that one value is translated; and the field is
   **live-only**, since the seed snapshot carries no officials and the e2e suite
   boots frozen. Green e2e is therefore not evidence that it renders —
   `tests/football-data-core.test.ts` covers the mapper against a captured
   payload, per the rule in `CLAUDE.md`.
2. **Aproveitamento (%).** `pontos / (jogos × 3)`. The metric a Brazilian reader
   quotes by default, and the one that survives a postponed fixture honestly.
   Needs a `CONTEXT.md` entry in the same commit.
3. **A legend for the G4/Z4 rail.** — **done.** `zoneClass` painted the rail and
   nothing on the page said what the colours meant. It was also hue-only, where
   the same data on the club page carries a letter *and* a colour. The key sits
   outside the table's scroll container and names *which positions* each zone
   covers, which is what puts the fact on a channel other than hue — the rail now
   confirms the key rather than being the only place the zones are stated. A
   **row** still announces no zone of its own to a screen reader; the rail is a
   CSS border. That is a separate, larger change (`sr-only` text in twenty
   position cells) and is not done.
4. **`referrerPolicy="no-referrer"` on crests.** They are the one asset class still
   hotlinked (principle 4 below), so every row tells the provider's CDN which page
   the reader is on.
5. **A crest fallback.** `ClubCrest` has no error path; twenty broken images is the
   current failure mode. Note `tla` is optional and `code` may be `FD-<id>`.
6. **`sr-only` names on the existing form pills.** `ClubView` names them with
   `title` alone. `RankSparkline` is the pattern that gets this right.
7. **Write down the radius step-down rule.** The shape scale exists; the rule for
   which step at which nesting depth does not, which is what let the scoreboard's
   radius drift until M2 caught it. Documentation only — it is already true.
8. **A name filter on Jogadores.** Twenty clubs do not need one; 948 players behind
   twenty `<details>` do.

**Next — one decision each, stated in the proposal.**

9. **Distinguish the leader.** Position 1 currently reads as identical to 2nd–4th.
   Do **not** also tier 5–6 or 7–12: those boundaries move with the cup winners,
   and a hard-coded `position <= 6` becomes false in a season nobody re-reads.
10. **Forma in the classificação.** `recentForm` and the pills already exist — this
    is only the column, and the column is a **table-width** problem. It is a
    fixed-width mark, so it needs `w-0` for the reason `CAMPAIGN_COLUMN` does.
11. **Casa / Fora split.** Compute all three views locally. Taking the splits from
    upstream's HOME/AWAY groups reintroduces the IN_PLAY difference and puts a
    contradiction on one screen.
12. **Derived league statistics.** Melhores ataques, melhores defesas, total and
    average goals. Under the Classificação — **not** a sixth `NAV_ITEMS` entry; the
    bar is full and nothing in the tooling will tell you so.
13. **Inset the scoreline.** Needs `surface-dim` emitted from `sync-md3-tokens` and
    a contrast-gate pairing, so it is a generator change rather than a class swap.

**Alongside**: `--color-tertiary` and `--color-tertiary-container` are emitted into
all three theme blocks and referenced by **zero** components. The accent is already
generated, toned and contrast-checked; it has simply never been spent. Pick it up
with item 9 rather than giving it an item of its own.

**Explicitly not doing**, each with the reason in the proposal: lance a lance,
escalações and match statistics (no reachable tier carries them); título/Z4
probabilities as the prototype presents them; the localStorage image-URL manager
(the inverse of the vendoring-with-attribution rule); the webfont pair; the
hand-picked hexes; club-brand colours; the desktop sidebar.

## Contas — what Phase 1 leaves outstanding

Phase 1 ships sign-in with Google, sessions in SQLite, `/entrar`, `/conta`, and
the rule that the whole feature is absent unless the host is configured for it.
What follows is everything flagged while building it and not done, recorded here
rather than left in a pull-request thread.

**On the host, before accounts do anything.** Nothing in the code waits on any of
these — it deploys and behaves exactly as it did before.

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` into the host's `.env`. Note
  `02_create_env.sh` rewrites the **whole** file after a confirm, so the same run
  must re-enter `FOOTBALL_DATA_TOKEN` or the site drops to seed data.
- Google Auth Platform → **Público-alvo**: add a test user, or publish. While the
  client is in *Testing* with no test users, every sign-in returns "acesso
  bloqueado" — which looks exactly like a bug in the code, and is the most
  likely first hour lost.
- **Confirm the host's exact Node.** `01_setup_app_directory.sh` now pins major
  **22**, which is enough — but `node:sqlite` arrived in **22.5**, so a host
  sitting on 22.0–22.4 satisfies the pin and still has no store. The code
  degrades rather than crashing (`openStore` loads it through `createRequire`
  precisely so such a host boots with accounts simply absent), so this is a
  check for the day accounts are switched on, never a deploy blocker.
- **One manual pass of the Google round trip.** CI cannot cover it: it needs a
  secret and a network, and CI has neither by design. Verify once against the
  deployed host and record it in the runbook, the way the live provider path was.

**Phase 2, in the order `docs/accounts.md` sets.**

- **`/privacidade`.** A real route, so a four-file change, and it blocks twice
  over: §5 says the notice blocks launch, and Google's Branding tab wants the URL
  before the consent screen can be published.
- **The preferences table, and the merge that gives it a caller.** *Meu time*
  stops being device-local and becomes the first thing an account syncs. Deferred
  from Phase 1 deliberately — shipping the schema alone would be a table nobody
  reads, which is the same smell as a component variant with no call site.
- **Backups.** The accounts database is the first state in this app that nothing
  can regenerate: lose the volume and the readers are gone. Nightly `VACUUM INTO`
  to S3, on a prefix separate from the deploy bucket, and a restore **rehearsed
  on a scratch instance** rather than documented.
- **Session pruning on a schedule.** `pruneSessions` exists and nothing calls it.
  Expired rows are harmless to authentication and are still a record of when a
  person was last here, kept for no stated purpose.
- **The retention promise, or its removal from the notice.** An unenforced
  retention promise is worse than no promise.

**Screenshots.** The top app bar gained a control, so the advisory job is red and
should be. But that control is invisible until a host is configured, so a refresh
today photographs no change at all — take it after the credentials are live, not
after the merge.

**One rule to follow rather than an item to do.** Every string that puts a
preposition in front of a club name goes through `club-core.ts`, whose article
table is **exhaustive over `src/data/clubs.ts`** — a club with no entry fails the
build until somebody writes its article down, the way `NATIONALITY_LABELS` works
over `squads.ts`. That landed after this section was first drafted, and it is
worth knowing before writing any Phase 2 copy: `/privacidade` and the account
pages will want "a sua conta", not a club name, but the moment anything says
"do <clube>" it belongs in that helper and not in a template literal.


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
   hotlinking Commons earns a 429. Stadium photographs briefly shipped hotlinked
   and were vendored into `public/stadiums/` by `npm run sync-stadium-photos`;
   the principle has no exceptions again.
5. **CI needs no secrets.** Do not add a provider token to test "the live path".

---

# Migrating to Material Design 3

**Complete, and deployed.** All six phases shipped between M0 and NavBar; the
plan below is kept as written, with each phase carrying a note on what it
actually did and what it cost. Where a phase departed from this plan — and
several did — the departure and its reason sit under that phase rather than
being edited out, because the reasoning is the part worth keeping.

**Three things it did that were not on the plan**, each an accessibility gap
that no test in the suite would have failed on:

1. The app had **no focus styles at all** — no `focus:`, no `focus-visible:`, no
   ring anywhere. Found in M2.
2. The player card was **modal in name only**: it carried `aria-modal="true"`
   while Tab walked straight out of it. Fixed in M4.
3. **`prefers-reduced-motion` was honoured nowhere.** That gap *grew* during the
   migration rather than shrinking — M2 added state layers and M4 added a
   dialog, both motion, while nothing checked the preference. Closed in M5.

**One documentation gap it exposed and did not close.** Every image in the
README is a 960px capture, which is above the `sm` breakpoint — so the
migration's single most visible change, a navigation bar replacing a hamburger
below that width, appears in none of them. Whether the README documents one
viewport or two is a product question, not a bug.

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

**It was not needed.** M4 rebuilt that card on the browser's own `<dialog>` with
`showModal()`, which supplies the focus trap, `inert` behind, the top layer and
focus restoration — everything the library would have been imported for, at no
bundle cost. So option B was never adopted anywhere, and the app still ships no
UI dependency.

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

### M4 — Components — **done**

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

**Shapes were adopted only where a component was rebuilt.** The dialog takes
MD3's extra-large corner because it *is* rebuilt; the outlined controls and
`Surface` keep the shape scale they already had. That split is not a
half-measure: a pill sitting against a right-aligned `tabular-nums` column reads
as floating, because the eye takes the pill's widest point as its edge while the
number's edge is the glyph box — and the round stepper and the goals link both
sit against tables. The tonal links sit in open prose, where nothing misaligns.

**1. Chips — done, and it removed a real duplication.** `MatchList` and
`MatchPage` each carried their own copy of the label map *and* the colour map,
identical, five values apiece. `StatusChip` owns both now. Two copies of a lookup
table is how a new status renders in one place and blank in the other.

**Broadcaster marks were deliberately *not* converted.** The roadmap assumed
"the plate already behaves like a chip". It behaves like one superficially and
differs where it matters, and the difference is fatal: a chip takes its container
colour from the tonal system, and `--color-plate` is `#ffffff` in *every* theme
because Globo's circle, the YouTube wordmark and CazéTV are dark artwork on
transparent grounds. On a dark container they do not look worse — they disappear,
silently, with the `img` present and the accessible name correct. The plate is a
background for foreign artwork; a chip is a container for our own content. Kept
as a plate, and verified in a browser in both themes rather than assumed.

**2. Button — two variants, not four.** `outlined` (everything that was there
before) and `tonal`. MD3's *filled*, *elevated* and *text* are absent for the
same reason `ControlSize` is short: nothing renders them, and a variant with no
call site is a guess about the future that later has to be maintained or deleted.

`tonal` went to the one place the app already drew a distinction in prose but not
in pixels — a *curated* highlights link beside the search fallback. The comment
there has always said one is a real answer and the other is a guess; they
rendered identically until M4.

**3. `Surface` — already an MD3 outlined card.** Border plus surface tone at the
shape scale is exactly that. No restyle was invented to fill the item.

**5. The dialog was modal in name only.** It carried `aria-modal="true"` while
Tab walked straight out of it into the page behind. It is now a native
`<dialog>` opened with `showModal()`, which buys a focus trap, `inert` on
everything behind, the top layer, and focus returned to whatever opened it —
each fiddly to hand-roll and easy to get subtly wrong. Body scroll is locked
separately, because modality does not stop the page scrolling behind.

The spec that asserted `aria-modal="true"` now asserts modality instead:
`dialog.matches(":modal")`, and that focusing a control behind the card fails.
That is the same lesson as the focus rings — the old assertion tested the label,
and the label was true while the behaviour was not.

**A bug worth recording, because the cause is not obvious.** The dialog rendered
hard against the left edge on desktop. A native dialog is centred by the user
agent's `dialog { margin: auto }`, and **Tailwind's preflight resets `margin: 0`
on every element**, so that rule never applied. Vertical centring worked because
`my-auto` was set explicitly, which made it look deliberate rather than broken.
Caught by looking at a screenshot, confirmed by reading computed margins, and now
guarded by a spec — no other test in the suite has an opinion about where a
dialog sits.

**4. `NavBar` — done, in its own phase.** The ceiling was settled first and
accepted: MD3's navigation bar carries **3 to 5 destinations**, `NAV_ITEMS` has
three, two more fit, and a sixth wants MD3's navigation *drawer* rather than a
sixth entry. That bound now sits beside the promise in `CLAUDE.md`, described as
what it is — the one constraint in that file no tooling can check.

The hamburger is gone. Below `sm` the three destinations are a navigation bar
fixed to the bottom edge, each an icon above its label, the current one marked by
a pill behind the *icon* rather than a fill behind the whole item. Above `sm`
nothing changed: the destinations stay inline in the header, which is already
MD3's tab arrangement.

This is the phase's real justification rather than spec compliance. **Three links
behind a hamburger is the arrangement the navigation bar pattern exists to
correct** — they were one tap away instead of zero, in the corner furthest from a
thumb.

**The icons live on the `NAV_ITEMS` entry, not in a lookup inside `NavBar`.**
That is what preserves the promise: a lookup keyed by section id would have meant
`NavBar` needing a change the next time someone added a section, quietly
converting the promise into a lie. Three glyphs are drawn in
`src/components/SectionIcons.tsx` rather than pulled from a set — the app ships no
UI dependency and draws its own sparkline already.

**Seven specs' worth of disclosure behaviour was deleted, not rewritten.** The
old tests asserted `aria-expanded`, that Escape closed the panel and restored
focus, that an outside click dismissed it. None of that behaviour exists now, and
rewriting them to click something else would have kept the letter of a contract
whose subject was gone. What survives is the property that mattered — every
section reachable at every width, and the current one saying so — plus a new
guard that exactly *one* presentation of the destinations is visible at a time,
which protects every `getByRole("link")` in the suite from a strict-mode
violation.

Eight spec files carried `if (isCollapsed(page)) await menuToggle(page).click()`
before every navigation. All of it went: destinations are visible at every width,
and Playwright's role selectors already exclude the `display: none` copy.

**The fixed bar needs the page to make room for it.** `pb-28 sm:pb-6` on the
layout wrapper — without it the last row of a twenty-club table sits underneath
the bar, invisible until someone scrolls to the very end, which is exactly when
nobody is looking. Verified by measurement: last row bottom 699, bar top 739.

### M5 — Motion — **done**

- MD3 easing and duration tokens for the theme toggle, dialog and round changes.
- Honour `prefers-reduced-motion`, which the app does not currently check.

**Two curves and two durations, not the whole scale.** MD3 defines four
durations in each of four bands and half a dozen easings; the app uses
`standard` for small frequent changes and `emphasized-decelerate` for the dialog
arriving. The rest are omitted for the same reason `ControlSize` is short.

**`transition` was redefined rather than annotated.** Overriding
`--default-transition-duration` and `--default-transition-timing-function` makes
a bare `transition` *mean* MD3 standard, so no call site repeats the pair and
none can drift from the others.

That was not the first attempt, and the first one failed silently. **Tailwind v4
has no `--duration-*` utility namespace**, so `duration-short-4` compiled to
nothing at all: the class sat in three call sites looking correct while every
transition kept the framework's 150ms default. Nothing would have caught it —
the CSS was valid, the build was clean, and no test watches things move. The
tokens are still real custom properties, which is why the hand-written dialog
animation can reference them; only the *utility* does not exist.

**`prefers-reduced-motion` is honoured for the first time.** The gap mattered
more than when the roadmap was written, because M2 and M4 both *added* motion —
state layers and a dialog — so it widened while nothing flagged it.

Near-zero rather than `none`: a 0.01ms duration still fires `transitionend`, so
anything waiting on that event keeps working. Colour feedback deliberately
survives; only movement stops. A control that stops reacting to hover and focus
is harder to use, not calmer, and that is asserted rather than assumed.

**`tests/e2e/motion.spec.ts` asserts both directions**, because a test for only
the reduced case would pass on an app with no motion at all. One trap found
writing it: `test.use({ reducedMotion })` in a *nested* describe silently did not
apply, and the page kept reporting `no-preference` — which reads as "reduced
motion is broken" rather than "the test never enabled it". Uses
`page.emulateMedia` with an assertion that the emulation took effect.

**A miss from M3, found here and fixed.** `BACK_LINK` in `interaction.ts` still
carried `text-sm`. M3's exit-criteria grep was scoped to `*.tsx`, and that file
is `.ts` — so "no bare Tailwind text size in any component" was true of every
component and not of the module three of them share. Same pixel size, missing
tracking, which is why it looked right. **Check `--include='*.ts'` too.**

## What this does not change

Data, routing, caching, the provider integration, the deploy pipeline, and every
`*-core.ts` module. The migration is confined to `src/index.css` and
`src/components/`, which is the strongest argument that it is safe to attempt
incrementally — and the reason each phase can ship on its own.

## Open questions — answered, except one

- ~~Does the seed colour come from the competition, the app's own identity, or
  stay neutral?~~ **The app's own identity.** `#10b981`, the emerald already in
  use, so the migration re-derived the palette the reader knew rather than
  rebranding underneath them. Recorded in M0.
- ~~Is a bundle increase acceptable at all?~~ **None was needed.** JS did not
  grow at any phase. HCT is implemented in-repo, the icons are drawn in-repo, and
  the dialog uses the browser's own `<dialog>` — each a place a dependency would
  normally arrive. CSS is up about 4 kB raw for the token vocabulary.
- **Still open: MD3 dynamic colour** — a palette derived from the club being
  viewed. Not attempted, and the argument against is unchanged: this is a
  scoreboard people scan in seconds, and a palette that shifts per club trades
  recognition for novelty. The machinery would be cheap now that
  `md3-color-core.ts` exists, which is exactly why it deserves a deliberate no
  rather than a drift into yes.

## What is left

Nothing in this migration. The remaining items are the pre-existing ones under
**Near term** above — the highlights backfill and the weekly broadcast sync —
plus the README viewport question noted at the top of this section, which is a
product decision rather than work.
