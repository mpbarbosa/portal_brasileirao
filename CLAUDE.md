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

## Key conventions

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
