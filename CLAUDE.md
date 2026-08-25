# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Portal Brasileirão" — a companion app for the Campeonato Brasileiro Série A: standings and
round-by-round match detail. React 19 + Vite + TypeScript + Tailwind v4, served by an
Express backend that also runs Vite in dev. Deploy target is AWS.

Modeled on the sibling repo `../agora_na_copa_2026` (a World Cup 2026 companion built the
same way). When a structural question isn't answered here, that repo is the reference
implementation — read it rather than inventing a new pattern.

## Commands

- `npm run dev` — start `server.ts` via `tsx`; it runs Vite in middleware mode, so this is
  the single command for full-stack dev (port 3000, walking to the next free port if busy).
- `npm run build` — build the frontend with Vite, then bundle `server.ts` into
  `dist/server.cjs` with esbuild (`--packages=external`).
- `npm start` — run the production build (`NODE_ENV=production node dist/server.cjs`).
- `npm run lint` — `tsc --noEmit` over the whole project. There is no ESLint; this is the
  lint gate.
- `npm run test:unit` — Node's built-in test runner over the core-module tests.
- `npm run test:e2e` — Playwright, booting its own server on port 3100.
- One test file: `node --import tsx --test tests/standings-core.test.ts`
- One test by name: `node --import tsx --test --test-name-pattern "tie-breakers" tests/standings-core.test.ts`

`npm run test:unit` lists its test files explicitly, mirroring the sibling repo. A new
`tests/*.test.ts` file does **not** run until it is added to that script.

## Architecture

### Single-process server

`server.ts` is one Express server that owns the API routes, mounts Vite as middleware in
development, and serves `dist/` statically in production with an SPA catch-all. Dev and
prod run the same process — there is no separate frontend server to start. `resolveAppPort`
probes ports and walks upward from `PORT` so a stale dev server doesn't block a restart;
`STRICT_PORT=true` makes it fail instead, which is what CI wants.

### Pure `*-core.ts` modules

Calculation and integration logic lives in root-level `*-core.ts` modules that perform **no
I/O** — data in, data out. `server.ts` does any fetching and passes payloads in. Each core
module is imported by both `server.ts` and its own `tests/<name>-core.test.ts`, which is
what makes the logic testable without mocking HTTP.

- `standings-core.ts` — builds the table from a club list and a match list. `computeStandings`
  counts only `FINISHED` matches carrying both scores (a `LIVE` partial score must not move
  the table), emits a zeroed row for every club so an empty round renders 20 rows rather
  than a blank table, and drops fixtures naming an unknown club instead of throwing.
  `compareRows` implements the CBF tie-break order — points, wins, goal difference, goals
  scored — then falls back to club name for determinism. The regulation continues past that
  point (head-to-head, cards, draw) but needs data the app doesn't carry yet.
- `matches-core.ts` — round filtering and feed ordering. `compareForFeed` puts LIVE first,
  then SCHEDULED, then FINISHED. `currentRound` is the earliest round holding an unfinished
  match, else the last round.

- `rank-history-core.ts` — every club's position after each round (the **campanha**),
  plus the sparkline geometry that draws it in the Classificação. The **client** computes
  this from the `/api/matches` payload it already holds — the whole season ships in one
  response, so a second endpoint would buy nothing. Note the sparkline is therefore
  derived from the fixture list while the row's position comes from `/api/standings`: with
  a live provider the two legitimately differ by a place mid-round, for the IN_PLAY reason
  documented above. The mark is a trajectory, not a restatement of the position column.
  Both sparkline axes are shared across every row, because a per-row scale would make a
  club oscillating 1st–3rd look like one climbing from 20th.
  `computeRankHistory` re-runs `computeStandings` once per round rather than keeping an
  incremental tally: the CBF tie-breakers are what decide a position, and a second
  implementation of them is how a history comes to disagree with the table it describes.
  38 rounds × 20 clubs is a few thousand operations. It stops at the last round with a
  result — "no position yet" is an absence, not a zero.

Extract to a core module before logic in `server.ts` grows a branch worth testing.

### Data provider

`football-data-core.ts` adapts football-data.org v4. Série A is competition `BSA`
(TIER_ONE, i.e. free); Série B is TIER_THREE and Série C/D are TIER_FOUR with data frozen
at 2020, so **only Série A is reachable on a free token** — a request for other divisions
means changing provider, not just the competition code.

Auth is `X-Auth-Token` (a bare token, not a bearer scheme), read from `FOOTBALL_DATA_TOKEN`.
Unset is a supported state: the app serves seed fixtures so a fresh clone runs without a
signup. `DISABLE_FOOTBALL_DATA=true` is the incident kill switch.

Mapping notes, all covered by tests:
- Upstream status vocabulary is wider than the app's — `TIMED`→SCHEDULED, `PAUSED`→LIVE
  (half-time is still live), `SUSPENDED`→POSTPONED, `AWARDED`→FINISHED. Unknown statuses
  degrade to SCHEDULED rather than dropping the fixture.
- Scores are read from `fullTime.home`/`away` **and** the legacy `homeTeam`/`awayTeam`
  spelling, because the published docs disagree with the v4 payload and guessing wrong
  silently blanks every scoreline. Note `0` is a real score — only `null` means unplayed.
- Club codes prefer the upstream `tla` (FLA, PAL, …), which lines up with the local seed
  codes, falling back to a synthetic `FD-<id>`.
- Standings read the `TOTAL` group only, never the HOME/AWAY splits.

**Known difference, deliberate:** football-data counts `IN_PLAY` matches in its standings
table — a club leading 1-0 at half-time is already credited 3 points. `computeStandings`
excludes them (`countsTowardStandings` requires FINISHED), because a league table should
move on the final whistle. So while matches are in progress, the live table (upstream) and
the fallback table (computed) legitimately differ. Verified against a live payload: the
entire delta was exactly the three in-play matches. Do not "fix" this by counting live
matches.

### Caching and failure handling

`cache-core.ts` holds a TTL cache and a circuit breaker. Both take `now` as a parameter
instead of reading the clock, so expiry and recovery are tested without sleeping.

The free tier allows **10 requests/minute** — caching is what makes it viable in
production, not a nicety. Standings cache 60s, fixtures 60s, dropping to 15s while any
match is LIVE, capping the app at roughly 5 upstream calls/minute at any traffic level.
The breaker opens after 3 consecutive failures for 60s, so a downed upstream gets one
probe a minute rather than one per request.

### API envelope

Every data endpoint returns `ApiEnvelope<T>`: `source`, a human-readable pt-BR `note`, and
`updatedAt` alongside `data`. `source` distinguishes `football-data` (live) from
`placeholder` (no token configured) and `fallback` (configured but failing) — the last two
look identical to a reader but only `fallback` is worth alerting on. The UI banners the
note for anything that isn't live. New endpoints keep this shape and degrade to local data
rather than returning a 500.

Current routes: `/api/health`, `/api/clubs`, `/api/standings`, `/api/scorers`,
`/api/players/:id` (numeric id, else 400 — enrichment only, answers `null` offline),
`/api/matches` (optional `?round=` — a non-integer or `< 1` is a 400).

Adding a section is: a `NAV_ITEMS` entry in `src/navigation.ts`, a `Route` variant plus
parse/format cases in `route-core.ts`, a case in `App`'s view switch, and — if it needs new
data — a pure mapper in `football-data-core.ts`, a seed snapshot in
`scripts/sync-seed-data.ts`, and a cached route in `server.ts`. `NavBar` never changes.

The `NAV_ITEMS` entry carries its own `Icon`, which is *why* `NavBar` never changes — an
icon looked up by id inside `NavBar` would break that promise the first time anyone added
a section.

**The promise is bounded, and the bound is not enforced by anything.** Material Design 3's
navigation bar carries **three to five** destinations, and there are three. Two more fit.
At the sixth the bar is off-spec — crowded rather than broken, so no build fails, no test
goes red, and nobody notices. A sixth section wants MD3's navigation *drawer*, not a sixth
entry here. Read that as a real limit rather than a style note: it is the one constraint in
this file that the tooling cannot check for you.

### Page metadata

`page-meta-core.ts` maps a route plus loaded data to a title, description and preview
image. It is used **twice on purpose**: `usePageMeta` sets `document.title` on the client,
and the production SPA handler injects the same values into the HTML it serves.

Both halves are needed. The client half updates the browser tab; **link previews never run
JavaScript**, so without the server half every shared URL unfurls as the generic site
name. `injectMeta` replaces the existing title and description rather than appending, so
the document never carries two, and escapes every value it writes.

The server only loads data for routes that name something (`clube`, `partida`), and takes
it from the same cached payload the API serves — no extra upstream request. If that load
fails the page still renders with generic metadata: metadata is a nicety, never a reason to
fail a page.

Canonical and `og:url` come from **`APP_URL`** in the host's `.env`. If that is stale,
every canonical points at the wrong origin.

### Routing

The URL is the source of truth for the visible section; `App` holds no section state.
`route-core.ts` is pure parse/format with no History API and no React, so every path shape
is unit-tested without a browser. `src/useRoute.ts` binds it to `pushState`/`popstate`.

Nav entries and club names are real `<a href>` elements, so middle-click and "open in new
tab" behave. Their click handlers bail out on modified clicks rather than swallowing them.

**Deep links depend on the server's SPA catch-all.** `/clube/1783` is not a file, so
`express.static` misses and the `app.get("*")` handler serves `index.html`. That handler
must stay registered *after* the API routes, or `/api/*` would be swallowed by it. Verified
in both dev (Vite middleware, `appType: "spa"`) and the production bundle.

Unrecognised paths and nonsense rounds resolve to something useful rather than 404 — a
stale link should still land somewhere.

Club URLs use a **slug** (`/clube/flamengo`), derived from the short name by `slugify` in
`club-core.ts`. The route carries a `key`, not a code, because the segment may be either:
`findClub` resolves a slug first and then a raw code, so `/clube/1783` — published before
slugs existed — still works. The seed generator rejects duplicate slugs the same way it
rejects duplicate codes and names; `atletico-mg` and `athletico-pr` differ by one letter
and both are real clubs.

### Data

`src/data/broadcasts.ts` holds "onde assistir" channels. Regenerate with
`npm run sync-broadcasts [from] [to]`, which reads CBF's API **on a workstation** and
merges into the file — production never calls CBF. Hand-editing stays supported.
It holds "onde assistir" channels keyed by our match id, because no provider we use
carries broadcast data. `src/data/venues.ts` is generated by the same script and holds
stadium/city/state, because football-data has **no venue field at any tier** either. `docs/data-sources.md` records what every candidate source
actually provides, including CBF's undocumented broadcast API and why it is not a
request-time dependency.

`src/data/highlights.ts` holds "melhores momentos" links, hand-maintained but
fillable with `npx tsx scripts/find-highlights.ts --round <n> --write`. The
judgement of whether a video really is a given fixture lives in
`highlight-search-core.ts`, because a search returns the same clubs, score and
channel from previous seasons — proximity of the upload to kickoff is what
separates them, and a candidate whose exact date has not been read is held
rather than accepted. See `.claude/skills/find-highlights/SKILL.md`.

`src/data/rank-history.ts` is generated by `npm run sync-rank-history`, which fetches
nothing — it derives the campanha from the seed fixtures already on disk. It is therefore
only as current as `matches.ts`, so **regenerate it after every `sync-seed-data`** or the
two files describe different seasons. The generator validates its own output: every club
must have an entry for every round, and each round's positions must be a permutation of
1..N, because a duplicated or missing position is invisible once it is drawn as a line.

`src/data/clubs.ts` and `src/data/matches.ts` are **generated files** — a frozen snapshot of
the real division and season, serving as the offline fallback. Regenerate with:

```sh
npx tsx scripts/sync-seed-data.ts   # costs 2 calls against the 10/min budget
```

Do not hand-edit them; hand-maintenance is what let the original list drift to the wrong
division. The generator validates its own output: it rejects duplicate club codes, rejects
duplicate display names, and rejects a duplicate display name, which is what an override keyed to the
wrong club id produces.

**Club identity is the upstream numeric id, never `tla`.** The abbreviation is not unique:
Corinthians and Coritiba both report `tla: "COR"`, so keying on it merges two clubs into
one standings row. `tla` rides along on `Club` for display only. `/api/matches` ships the
clubs it saw alongside the fixtures so the UI resolves names from the payload.

`src/types.ts` is the single source of truth for shared shapes. Extend it before adding
fields to data files or components.

## Working alongside other sessions

Several Claude sessions share this checkout. Each takes its own **git worktree**
and branch under `.claude/worktrees/`, so their edits cannot collide:

```sh
git worktree add .claude/worktrees/<name> -b worktree-<name>
cp .env .claude/worktrees/<name>/.env   # gitignored, so it does not come along
cd .claude/worktrees/<name> && npm ci   # each worktree needs its own node_modules
```

`git worktree list` shows who is where. The directory is gitignored, because a
worktree is a whole second checkout and one `git add -A` would otherwise commit
another session's entire tree into this one.

Rules that follow from sharing a repository:

- **Commit explicit paths, never `git add -A`.** Another session's uncommitted
  work is almost certainly in the tree, and sweeping it into your commit is the
  easy mistake. Check `git status` before every commit and recognise what is
  not yours.
- **Never `git stash` in the shared checkout.** It stashes everyone's
  uncommitted work, not just yours.
- **`npm run dev` in several worktrees at once is fine** — `resolveAppPort`
  walks upward from `PORT`, so the second one takes 3001 rather than failing.
- The root checkout is for integration. Do the work in a worktree.

## Key conventions

- **Colours are semantic tokens, never palette shades.** `src/index.css` defines the
  full set under `@theme` — the `surface`/`surface-container-*` ladder,
  `line`/`line-strong`, `ink` through `ink-ghost`, and `positive`/`negative`/`warning`
  each with a lighter `-ink` for text. Components say `text-ink-muted`, not
  `text-slate-400`. A raw `slate-*`, `emerald-*`, `rose-*` or `amber-*` utility in a
  component is a regression: before tokens there were 32 distinct colour utilities and
  five shades of grey text.
  The surface ladder took its MD3 role names in M2: the page is **`surface`** (it was
  `canvas`), a card is **`surface-container-low`** (it was `surface`, which is the trap
  — MD3 means the page by that word), and `raised`/`raised-strong` became
  `surface-container`/`surface-container-high`. The `ink` and `line` names are still
  aliases onto `on-surface` and `outline-variant`; renaming those is a separate pass and
  nothing to do with elevation.
- **The token *values* are generated, not chosen.** Since the Material Design 3
  migration (`docs/roadmap.md`, phase M1) everything between the `MD3-TOKENS`
  markers in `src/index.css` comes from `npm run sync-md3-tokens`. Do not hand-edit
  inside those markers — `npm run test:tokens` fails if the file has drifted from
  the generator, and it also re-runs the contrast gate. Each value is a *tone* from
  a tonal palette seeded by `#10b981`, so contrast is a property of the tone pair
  rather than something checked afterwards. The MD3 role names (`primary`,
  `on-surface`, `outline`, the `surface-container` ladder) are emitted alongside the
  names above, which are aliases onto them until M2 renames the call sites. One trap:
  MD3 spells the page `surface`, but here that is still `canvas` and `surface` means
  a card. `scripts/md3-color-core.ts` implements HCT so no runtime dependency is added.
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
  `canvas`, `surface` **and** `raised` in both themes and refuses to emit a palette that
  falls below AA. Worst text pairing is 4.59 across 70 pairings; `ink-ghost`, used only
  for underline decoration and the large score separator, clears the 3:1 non-text floor.
  Checking all three backgrounds rather than `canvas` alone is what caught light's
  `ink-faint` on `bg-raised` at about 4.35. That pairing is **latent, not shipped** — every
  `bg-raised` call site today pairs with `ink-soft` or `ink-muted`, and `ink-faint` only
  appears inside filled surfaces. Which is the point: it is a trap that springs the first
  time someone puts faint text on a badge, a hover state or a dialog, and nothing would
  have flagged it. Enforcing the floor beats recording a number that was true when written.
  `scrim` is deliberately dark in both themes: a near-white veil over a light page does not
  read as "the content behind is inactive". `plate` is its mirror — light in both themes,
  because the broadcaster marks it backs are dark artwork on a transparent ground and
  disappear against a dark page.
- **Type comes from the MD3 type scale.** `text-body-small` through
  `text-headline-medium`, defined in `src/index.css`. A bare `text-sm`, `text-xs`
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
- **Raised panels use `Surface`.** It owns the rounded-border chrome that was
  hand-repeated in five components. Padding and layout stay with the caller, since those
  genuinely differ. `filled` adds the card background; table containers stay unfilled
  because the table header supplies its own. Buttons and the round selector are *control*
  chrome, a separate pattern, and deliberately not folded in.
  Use `as` when the element matters: `MatchPage`'s scoreboard is `as="article"`, both for
  the document outline and because an end-to-end spec selects `main article`. This is the
  rule that drifted once already — that card was hand-rolled with a *different* radius
  than every other card until M2 folded it back in.
- **The Classificação freezes `#` and Clube.** Both are `sticky`, so the numbers scroll
  out from under the club name on a narrow screen rather than taking the name with them.
  Three things had to move together, and each is invisible until someone scrolls:
  the table is **`border-separate border-spacing-0`**, because in the collapsed model a
  cell's borders belong to the table and slide out from under a sticky cell — which means
  the row separator lives on every cell (`ROW_LINE`) rather than on the `<tr>`, since the
  separated model does not paint row borders at all; and the **G4/Z4 rail rides on the
  first cell, not the row**, because a row scrolls and would carry its rail away.
  The trap: `STICKY_CLUB`'s `left-12` must equal `STICKY_POSITION`'s `w-12`. Widen the
  position column alone and the two frozen columns overlap or gap — and only while
  scrolled, because ordinary table layout puts them adjacent either way. Three specs in
  `tests/e2e/standings.spec.ts` scroll a 380px viewport and check exactly these three
  things; nothing else would catch any of them.
- **Motion is MD3's, and `prefers-reduced-motion` is honoured.** A bare `transition`
  already means MD3 standard easing at 200ms, because `--default-transition-duration`
  and `--default-transition-timing-function` are overridden in `src/index.css` — do not
  add `duration-*`/`ease-*` per call site. **There is no `--duration-*` utility namespace
  in Tailwind v4**: `duration-short-4` compiles to nothing and silently leaves the
  default in place. The tokens are real custom properties, so hand-written CSS can use
  them; only the utility does not exist.
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
- **A match's status is `StatusChip`.** Both the fixture list and the match page used
  to carry their own copy of the label map *and* the colour map. Two copies of a lookup
  table is how a new status renders in one place and blank in the other.
  **Broadcaster marks are a plate, not a chip**, and deliberately so: a chip takes its
  container colour from the tonal system, and `--color-plate` must stay `#ffffff` in both
  themes or the marks that are dark artwork on transparent grounds vanish silently. Keep
  the `data-mark` attribute — nine specs select on it precisely so markup can change.
- **The player card is a native `<dialog>` opened with `showModal()`.** Not an overlay
  div: modality has to be real. It carried `aria-modal="true"` for months while Tab
  walked straight out of it. The browser gives the focus trap, `inert` behind, the top
  layer and focus restoration; body scroll is locked separately, because modality does
  not stop the page scrolling. Two traps if you touch it: Escape arrives as `cancel`,
  not `keydown`; and Tailwind's preflight resets `margin: 0`, which kills the user
  agent's `dialog { margin: auto }`, so horizontal centring must be set explicitly.
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
  football-broadcast voice. `CONTEXT.md` is the domain glossary: read it before naming a new
  concept, and add the term there in the same commit that introduces it. Each entry carries
  an `_Avoid_` line recording names that were considered and rejected, so a rejected name
  does not quietly come back.
- **Path alias `@/*` maps to the repo root**, declared in both `tsconfig.json` and
  `vite.config.ts`. Imports read `@/standings-core`, `@/src/types`.
- **Server dependencies go in `dependencies`, not `devDependencies`** — the build bundles
  the server with `--packages=external` and the production host installs `npm ci --omit=dev`,
  so anything needed at runtime must survive that. Commit the updated `package-lock.json`.
- **New env vars must work when unset** — the production `.env` is not updated
  automatically on deploy, so every new variable needs a safe in-code default.

## End-to-end tests

`tests/e2e/` runs against a server the config boots itself with
`DISABLE_FOOTBALL_DATA=true`, so the suite always sees the **frozen snapshot**.
This is deliberate and load-bearing: live scores, table positions and the current
round all change mid-match, so asserting against live data makes every run a coin
flip. It also keeps the suite from spending the 10 req/min budget.

Rules that follow from that:

- Never assert a specific round number or scoreline — the snapshot ages, and
  `currentRound` advances with the calendar. Assert shape (`/\d+ª rodada/`), not value.
- `allInnerTexts()` and `locator.all()` query immediately and do **not** auto-wait,
  unlike `expect(locator)`. Wait for the table to populate first, or they sample a
  half-rendered DOM — this produced a real flake.
- **Never assert how much curated data exists.** `broadcasts.ts` grows on every sync,
  so a test counting curated fixtures fails the next time the script runs. Assert the
  *shape* of a rendered line instead. This broke CI once already.
- **Turning text into a control changes its element.** Making a club or player name
  clickable turned a `span` into a `button` (later an `<a>`), which silently broke every
  spec selecting `span:first-child`. Select the cell's element children (`td > *`) rather
  than a tag name.
- `getByText("...")` is case-insensitive substring matching by default. A bare
  `getByText("Ao vivo")` also matches the banner's "…para dados ao vivo". Scope the
  locator and pass `exact: true`.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull request,
in two parallel jobs:

- **check** — `tsc --noEmit`, unit tests, build, then boots `dist/server.cjs` and
  smoke-tests it, plus shellcheck over the deploy scripts. The boot step is the
  one that catches a runtime dependency stranded in `devDependencies`.
- **e2e** — Playwright, with the browser cached on the exact `@playwright/test`
  version. A version bump needs a matching browser build, so the cache key must
  include it or the run fails with "Executable doesn't exist".

**CI needs no secrets.** Both jobs run against the frozen snapshot with no token,
so a red build always means the code broke — never that the upstream had a bad
minute or the free-tier budget ran out. Keep it that way: do not add
`FOOTBALL_DATA_TOKEN` as a repository secret to "test the live path". If the live
mapping needs coverage, add a unit test with a captured payload.

## Not built yet

*(Nothing outstanding — deploys are automated; see below.)*

### TLS

Certbot holds the certificate for `brasileirao.mpbarbosa.com` and rewrote the nginx site in
place to add the 443 listener and the HTTP→HTTPS redirect. `certbot.timer` runs twice daily
and `certbot renew --dry-run` passes, so renewal is unattended.

Because certbot owns that file, **re-running `04_setup_nginx.sh` overwrites its edits** and
drops the site back to plain HTTP. That is recoverable — re-run `05_setup_tls.sh` — but the
site serves HTTP in between, so do not run `04` casually on a host that already has TLS. Port the deploy scripts
from the sibling repo when shipping, including its constraint that the production host is
too small to build on (it pulls a prebuilt payload rather than running `npm run build`).

The live provider path is verified: with a real token the app renders the current Série A
table from football-data.org. Verified against a live payload, v4 reports scores as
`fullTime.home`/`away`.

**No deploy has ever run against a real host.** The preflight, every argument-validation
path, and the rsync semantics (including that the remote `.env` survives) are verified
locally, but no EC2 instance has received this payload — the remote half of `deploy.sh` and
all of `shell_scripts/` are unexercised.

One known data mismatch: upstream club codes are not always the local seed codes — São
Paulo is `PAU` upstream, not `SAO`, and the real 2026 division includes clubs absent from
`src/data/clubs.ts`. This is why `/api/matches` ships the clubs it saw; do not reintroduce
a dependency on the seed codes for name resolution.
