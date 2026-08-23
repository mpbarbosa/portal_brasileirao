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
- `npm run test:unit` — Node's built-in test runner over the core-module tests (44 tests).
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

Current routes: `/api/health`, `/api/clubs`, `/api/standings`, `/api/matches` (optional
`?round=` — a non-integer or `< 1` is a 400).

### Data

`src/data/clubs.ts` holds the 20 Série A clubs; the `code` field (e.g. `"FLA"`) is the
stable key used by fixtures, `CLUBS_BY_CODE`, and the UI. `src/data/matches.ts` is
**placeholder fixtures with invented scorelines**, now used only as the offline fallback.
`/api/matches` ships the clubs it saw alongside the fixtures so the UI resolves names from
the payload rather than the seed — provider codes need not match the local ones.

`src/types.ts` is the single source of truth for shared shapes. Extend it before adding
fields to data files or components.

## Key conventions

- **Brazilian Portuguese copy** — all user-facing text and error messages are pt-BR in the
  football-broadcast voice. Define domain terms in `CONTEXT.md` before introducing a new
  label, so one concept doesn't acquire two names.
- **Path alias `@/*` maps to the repo root**, declared in both `tsconfig.json` and
  `vite.config.ts`. Imports read `@/standings-core`, `@/src/types`.
- **Server dependencies go in `dependencies`, not `devDependencies`** — the build bundles
  the server with `--packages=external` and the production host installs `npm ci --omit=dev`,
  so anything needed at runtime must survive that. Commit the updated `package-lock.json`.
- **New env vars must work when unset** — the production `.env` is not updated
  automatically on deploy, so every new variable needs a safe in-code default.

## Not built yet

No Playwright/e2e suite, no deploy scripts, and no `CONTEXT.md`. Port the deploy scripts
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
