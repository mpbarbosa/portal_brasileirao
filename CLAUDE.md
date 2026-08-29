# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before anything else: take a worktree

Several Claude sessions share this checkout. **Do your work in a git worktree, never in
the root checkout** — root is for integration.

```sh
git worktree add .claude/worktrees/<name> -b worktree-<name>
cp .env .claude/worktrees/<name>/.env   # gitignored, so it does not come along
cd .claude/worktrees/<name> && npm ci   # each worktree needs its own node_modules
```

This is the one rule here that protects *other people's* work rather than your own, which
is why it is at the top rather than filed under a section you reach after deciding what to
do. A branch switch in the shared root carries whatever is uncommitted across into
whatever gets checked out next. That is how a merged, deployed commit came to look like a
deliberate revert — several sessions spent an hour diagnosing files nobody had edited. The
tree was nine paths dirty at the time and nothing about it looked wrong.

The failure repeats because it resets: a session that has been told this moves out and
works cleanly, and the next one starts in root again. Assume you are the next one.

Full rules — commits, stashes, ports, and why the directory is gitignored — under
**Working alongside other sessions** below.

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
- `npm run sync-og-image` — redraw `public/og-default.png`, the link-preview card.
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
- `live-core.ts` — the **Ao vivo** board: `liveBoard` splits the season into what is being
  played, what is next and what just finished, and `countdownLabel` writes the contagem
  regressiva. Takes `now` as a parameter, like `currentRound`. It computes **no match
  minute**, deliberately: the provider reports a status and a score and never an elapsed
  clock, and minutes-since-kickoff stops being the true minute at half-time — a page
  reading "73'" when the truth is "somewhere in the second half" is worse than one reading
  "bola rolando". A fixture whose kickoff has passed while upstream still calls it
  SCHEDULED keeps its place under "A seguir" for `LATE_GRACE_MS`, because upstream is
  polled rather than pushed and dropping it would hide a match during exactly the window
  the page exists for.

- `next-match-core.ts` — the **Próximo jogo do meu time**: which single fixture to
  put in front of a reader who follows a club. `clubFocus` prefers a match **in
  progress** over one that is merely sooner, because a club can be on the pitch
  while upstream still calls a later fixture SCHEDULED — "earliest kickoff" is
  the wrong rule and reads as right. It takes `now` as a parameter like
  `liveBoard`, reuses that module's `LATE_GRACE_MS` rather than picking its own
  window (two answers to *when does a fixture stop being next* is how the home
  page comes to name a match the Ao vivo board has already dropped), and reuses
  `club-core.ts`'s `playsIn`/`clubMatches` rather than restating them.
  **It is not `nextFixture` in `club-core.ts` and neither should be rewritten in
  terms of the other.** That one has no clock, so it counts a postponed fixture
  and a kickoff that passed an hour ago as still to come — right for a club's
  season at a glance, wrong for a line telling a reader when to sit down.
  The countdown is **not** reimplemented here: `countdownLabel` in `live-core.ts`
  already writes it, so the strip and the board say the same words about the same
  fixture. The sibling repo this was modelled on ships two functions named
  `formatCountdown` in two modules, which is the drift `StatusChip` exists to
  prevent. `isImminent` — a day, or already under way — is the whole of what
  makes the strip an *alert*, and it is one predicate rather than a comparison
  written into the component; it changes the rail's colour and never the wording,
  so there is only one sentence to keep true.
  Rendered by `MeuTimeStrip`, which owns its own `useNow` tick for the reason
  `LiveView` does — a clock in `App` would re-render twenty rows and twenty
  sparklines twice a minute to move four words. There is deliberately **no
  `aria-live`** on the contagem regressiva: a polite region would interrupt a
  screen-reader user every 30 seconds with a number they cannot act on.
  **The LIVE branch is unreachable from the frozen snapshot** — `src/data/matches.ts`
  holds no LIVE fixture and the suite boots with `DISABLE_FOOTBALL_DATA=true` — so
  `tests/e2e/meu-time.spec.ts` serves one prepared payload with a fixture flipped.
  Prepared once and fulfilled from memory, never `route.fetch()` per request: a
  proxying handler came back as something other than the envelope under the
  suite's seven workers, and passed in isolation.

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

- `venue-core.ts` — the **Página do estádio**. `buildStadiums` groups fixtures into
  grounds, because **a stadium is not an entity in any payload**: football-data has no
  venue field at any tier, and CBF reports only a `Stadium - City - UF` string per match.
  Identity is therefore the **slug** of that string, which is what makes `ARENA MRV` and
  `Arena MRV` one stadium rather than two — CBF's casing drifts by design, since
  `venues.ts` stores its values verbatim rather than guessing at proper names. It reuses
  `slugify` from `club-core.ts` deliberately; a second normaliser is how two spellings of
  one ground come to disagree. Home clubs are derived from who hosted there, so the page
  needs no curated club list. A fixture whose venue slugs to nothing is skipped rather
  than bucketed under an empty key, which would collect unrelated grounds into one page.
  `stadiumPhotoUrl` builds the address of a vendored photograph on **our own
  origin**, keyed by stadium slug and width; `stadiumPhotoPage` still builds the
  Commons file-page link the licence requires. `PHOTO_WIDTHS` lives here rather
  than beside the `<img>`, because `sync-stadium-photos` writes exactly those
  files — two copies of that list is how the page comes to request a size nobody
  vendored, which fails as a missing image rather than as a build error.

- `squad-core.ts` — the **Jogadores** page: every club's elenco, grouped into
  the lines a squad is read in. It exists because the provider reports a
  position at **two levels of detail in the same list** — mostly a broad line
  ("Defence", "Midfield"), occasionally a specific role ("Left-Back", "Right
  Winger"), and for a handful of players nothing at all. `lineOf` folds the
  roles onto the line they belong to, so a lateral does not become a section of
  one. An unrecognised position goes to **Outros** rather than being guessed at,
  and keeps its verbatim caption — the same rule `positionLabel` follows, whose
  table this module reuses rather than copying.
  `playerPositionLabel` returns **null** for a broad position, because the
  section heading has already said it; printing "Defesa" under a Defensores
  heading is the heading again, once per row, for two thirds of the squad.
  Sorting is alphabetical in pt-BR collation with the player id as a tie-break —
  **not** by shirt number, which the competition's team payload does not carry
  for anyone in the division. Athletico-PR really does list two Dudus, which is
  what the tie-break is for.

- `health-core.ts` — the **Saúde do serviço** the **Rodapé** carries. It is the
  only core module whose input is *this app's own* API rather than a provider's,
  and it exists for the reason an adapter usually does: `/api/health` is the one
  endpoint that is deliberately **not** an `ApiEnvelope` — it describes the
  process, so it has no `source`, no `note` and nothing to degrade to — which
  also makes it the one payload the client cannot assume it understands, since
  a host still serving last week's bundle answers the shape *that* build
  emitted. `parseHealth` narrows field by field and lets every field but the
  status be absent; the rodapé then omits an item rather than printing
  `undefined`. `providerLabel` names what is **configured** and never claims
  "ao vivo" — whether the last upstream request succeeded is the envelope's
  `source`, which the banner above already carries, and claiming otherwise here
  would contradict a `fallback` banner three lines up. `startInstant` turns the
  reported uptime into the instant the process started, which is not a
  presentation preference: an elapsed label is different every time it renders,
  and the home route is one of the committed **full-page** captures, so that
  band would change between two captures of the same build and be committed as
  noise on every refresh — the failure `settle` was written for. It is read at
  the moment the payload lands rather than per render, because `now` moves and
  `uptime` does not.

- `session-core.ts`, `account-core.ts`, `oauth-core.ts`, `rate-limit-core.ts` — the
  **Conta** subsystem's judgement, all pure and all taking `now` as a parameter like
  `cache-core.ts`. Expiry, rolling renewal, PKCE, the `id_token` claim checks and the
  token bucket are unit-tested without a database, a browser or a Google client.
  `account-store.ts` is the only file that knows SQL, which is the same split
  `commons-core.ts` and `scripts/commons-api.ts` already draw.

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
- A coach is read from `name` first and from `firstName`/`lastName` as a fallback,
  because `lastName` is frequently null for a coach known by one name. A club
  between coaches reports none at all, which is an **absence** — the club page
  leaves the line out rather than printing a dash. `clubFromTeam` therefore omits
  the key entirely, as it already does for a missing crest.
- **Squads and coaches arrive embedded in the competition's team list**, not from
  a per-team endpoint: `/competitions/BSA/teams` carries a `squad` array and a
  `coach` object on each of the twenty clubs, so `mapSquads` builds the whole
  division's elencos from **one** request rather than twenty, and the técnicos
  ride along on the same payload for nothing. That is the only reason the Jogadores page is
  affordable at 10 req/minute. The listing has **no `shirtNumber` and no
  `currentTeam`** for any player — the person endpoint has both, which is what
  the player card fills in when one is opened. `mapSquads` deliberately does not
  copy the club onto each of the ~950 entries: it is what the enclosing `Squad`
  already says, and repeating it more than doubled the payload (255KB → 109KB
  when it was removed). The page attaches it at the moment it opens a card.

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
`/api/squads` (every club's elenco; one upstream request serves all twenty),
`/api/coaches` (every club's técnico, keyed by club code — a **projection of the
squads payload**, so it shares that cache entry and costs nothing upstream; it
exists because the club page is built from fixtures and standings, and neither
carries a coach),
`/api/players/:id` (numeric id, else 400 — enrichment only, answers `null` offline;
note its `currentTeam` is often a national team, which is why the card prefers the
club the page already knew),
`/api/matches` (optional `?round=` — a non-integer or `< 1` is a 400).

### Contas

Phase 1 of `docs/accounts.md`: sign in with Google, `/entrar` and `/conta`, sessions in
SQLite. **Off unless configured**, and that is the whole of its deployment story —
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` unset means the feature is *absent*: no
control renders, `/api/auth/*` and `/api/account/*` answer 404, and the app is exactly
what it was. The same idiom as `FOOTBALL_DATA_TOKEN`, and it is what lets this ship to a
host nobody has configured yet.

**`/api/account/*` and `/api/auth/*` are the documented exception to the `ApiEnvelope`
rule**, and this paragraph is where that exception lives so the rule above stays
believable. `source`, `note` and `updatedAt` answer "how fresh is this third party's data
and how far has it degraded" — an account has no upstream, no staleness and no honest
fallback, and "não foi possível ler a sua conta" must be a real status code rather than a
cheerful envelope containing somebody else's defaults. Plain JSON, real codes, `{ error }`
in pt-BR. `/api/health` was the first exception; these are the second.

**There is no `SESSION_SECRET`, and the plan expected one.** A session is 256 bits of
randomness stored as a SHA-256 digest in a table, so there is nothing to sign, nothing to
rotate, and no secret whose absence needs a safe default. The same reasoning covers the
sign-in transaction: `state`, `nonce` and the PKCE verifier only have to survive from our
own response to our own next request, and the `__Host-` prefix is what stops any other
origin writing that cookie.

Traps, each of which cost something to find:

- **A `__Host-` cookie without `Secure` is refused by the browser**, silently. Deriving
  `Secure` from `APP_URL` made sign-in *appear* to work on a fresh clone: the server set
  the cookie, the browser dropped it, `/api/account/me` answered null, nothing errored.
  It is now unconditional — `localhost` and `127.0.0.1` are secure contexts, so plain http
  development is unaffected. Note `curl` declines to *send* a `Secure` cookie over http,
  which is a property of curl and not of the browser: verify this path with Playwright.
- **`node:sqlite` is loaded with `createRequire` inside `openStore`, never imported at the
  top.** A static import is evaluated at boot, so a runtime without the module throws
  `ERR_UNKNOWN_BUILTIN_MODULE` and the **whole process fails to start** — a site that is
  down, on a release that only added a feature nobody had switched on. The host pins Node
  22, which is not the same as having this: the module arrived in **22.5**, so 22.0–22.4
  satisfies the pin and still lacks it. The pin is not a substitute for the lazy load.
- **SQLite creates the file but not the directory above it**, and fails with a message that
  reads like a permissions problem. `openStore` makes its own directory.
- **`PRAGMA foreign_keys` is OFF by default**, which would make `ON DELETE CASCADE`
  decorative — a deleted account would leave working sessions pointing at a row that is
  gone.
- **`ACCOUNTS_DEV_LOGIN` mints a session for anybody who asks.** It exists so the e2e suite
  can test sign-in without a Google client or a network, keeping CI secret-free. The server
  **refuses to start** with it set when `NODE_ENV=production`, and the route is registered
  conditionally, so in production it does not exist rather than existing and declining.
- `pageStatus` gained **`PRIVATE`** — 200, `index: false` — because `/conta` is a real page
  whose content differs per requester. The type always allowed it; no constructor produced
  it, because until accounts every page this app served was the same for everybody. Both
  sections are `Disallow`ed in `robots.txt` and absent from the sitemap.

Phase 2 adds the **preferences** table and `/privacidade`. Two things about it are
decisions rather than mechanics:

- **`planSync` is not last-write-wins**, which §4 sketched. Timestamps would resolve
  exactly one case — signed out on device A, changed there, then signed in on device B —
  and would cost a stamp beside every value, a storage-shape migration for everyone who
  already has a preference, and a rule nobody can predict from outside because the
  deciding value is invisible. The rule instead is one sentence: **the account is the
  source of truth, and a device seeds an account that has none yet.** That keeps the case
  the plan actually cared about (a sign-in never discards the choice just made) and gives
  up the A-then-B case. This paragraph said "revisit at the second key"; the second key
  has arrived and the answer held, for a reason worth more than either key: **a merge
  rule is owed only where both sides can hold a value.** `landing` is account-only — no
  `localStorage` copy exists, by construction — so there is nothing to reconcile and no
  clock to buy. Ask which side *owns* a key before asking how to reconcile it.
- **The upload is fire-and-forget**, so the page is usable before it lands. That is right
  for a reader and a trap for a test: a spec that follows a club and immediately asks the
  API what the account holds is racing it. Poll, or assert through the browser.

**The second key is `landing` — the Página inicial**, the section a signed-in reader opens
on. Three things about it are decisions rather than mechanics, and the third cost a red
suite to find:

- **It is account-only, and `serialiseDevicePreferences` is the whole of that rule.** The
  device serialiser writes the club and drops the landing; the wire serialiser writes both,
  because `PUT /api/account/preferences` **replaces the whole set** and a partial upload
  would clear a landing choice every time somebody followed a club. Two serialisers rather
  than a boolean argument: a flag at a call site is easy to pass wrong and impossible to
  see.
- **It redirects rather than rendering another section under `/`.** Serving different
  content at one address would leave the canonical tag, the `og:` metadata and the JSON-LD
  describing the Classificação while the reader looks at the artilharia — and those are
  injected server-side, where there is no session to consult. Moving the address keeps all
  three true. Crawlers have no session, so `/` stays the table for them permanently. The
  redirect is `replace`, never push, or Back returns to `/` and is sent forward again.
- **`usePreferences` publishes `syncedAccountId`, and a caller that infers it instead is
  wrong in a way nothing reports.** Effects run in declaration order within one commit, so
  when the account lands, an effect declared *after* `usePreferences` in the same component
  sees `accountState` already saying "signed-in" while `preferences` still holds the
  pre-account values. `App`'s redirect ran exactly once, on that render, found no landing,
  latched its ref and never moved the page — with `tsc`, the unit suite and every existing
  spec green. Only an end-to-end assertion on the URL could see it. Gate on the published
  id, not on `accountState.status`.

And one testing trap that is a property of the cookie rather than of the code: **`page.request` cannot carry a session.** It is a Node-side fetch with no notion of a
potentially trustworthy origin, so it will not send a `Secure` `__Host-` cookie over
`http://127.0.0.1` — every signed-in call through it answers 401 while the browser beside
it is signed in. It is still fine for *establishing* a session, because the `Set-Cookie` it
receives lands in the context's jar and the browser is what later sends it. Read and write
account state with `page.evaluate(fetch)`.

### Backing the accounts database up

`09_backup_accounts.sh` snapshots it to S3 nightly; `10_restore_accounts.sh` puts one
back; `11_install_backup_timer.sh` installs the systemd timer. All three travel inside
the release tarball, like the deploy scripts.

**`VACUUM INTO`, never `cp`.** SQLite in WAL mode keeps recent commits in a sidecar, so
copying `accounts.db` alone captures a database missing its most recent writes — and it
*looks* fine, because the result opens. There is a case in the rehearsal that inserts a
row, leaves the connection open so it never checkpoints, and asserts the row is in the
snapshot.

**Every artefact is opened and read before it is trusted** — on the way out by the backup,
and again on the way in by the restore, *before* anything is stopped or moved. A restore
that takes the site down and then discovers the artefact is unreadable has turned a
recoverable morning into an outage. An unreadable database exits **2** where a failed
upload exits 1: "the upload failed" is a retry and "the database will not open" is an
incident, and a timer reporting both the same way is one nobody reads.

**The displaced database is never deleted** — moved aside with a timestamp and left. And
its `-wal`/`-shm` are removed with it, because those belong to the file they were written
beside; leaving them next to a *different* database is how a restored copy is read with
another database's uncommitted tail.

**`scripts/rehearse-accounts-backup.sh` is the only behavioural coverage these have**, and
it is worth running rather than reading: it caught four real bugs in scripts that had been
read carefully and looked right.

- `JSON.stringify` for the `VACUUM INTO` path emits **double** quotes, which SQLite reads
  as an *identifier* — so the statement failed with "no such column: /var/www/…" and the
  backup had never once worked.
- A single-quoted `node -e '…'` body **cannot contain a single quote**, and SQL string
  literals are single-quoted. The shell silently ended the argument and handed node bare
  words. Both programs are quoted heredocs now, where nothing is special.
- `PRAGMA integrity_check` returns a column named **`integrity_check`**, not `result`.
  Destructuring the wrong name yields `undefined`, which is not `"ok"`, so every artefact
  failed verification and a perfectly good database exited 2.
- **`2>&1` inside a command substitution folds stderr into the value.** That is the trap,
  and it is not about backups: any `X="$(cmd 2>&1)"` inherits it, and an **experimental
  builtin makes it fire on every invocation** rather than only when something goes wrong.
  `node:sqlite` is experimental on the pinned major, so the warning landed *inside* the
  row count, printing the number, the warning and the unit across three lines. The fix is
  `--disable-warning=ExperimentalWarning` at each `node` call; `09` and `10` were the two
  sites that had it, and nothing stops a third being written tomorrow.
  **The blast radius was cosmetic, and saying so matters** — "a backup bug" reads as data
  loss. The backup ran, verified and uploaded correctly; what was mangled was only the
  printed count, which is the one number a person reads to see the artefact is not empty.
  `10`'s copy was merely *lucky*: `read` takes the first line, which is the count only
  because the warning is deferred past it. Ordering is not a guarantee to rest a restore on.
  This is the bug that only appears on the **pinned** major: Node 26 emits no such warning
  at all, so a local green run said nothing about the host — and the host runs **22.23.2**,
  read off `/api/health`, so this was live there rather than latent in CI. Say *silent*
  rather than *stable*: silence is what was measured and all the argument needs, where a
  stability index is a claim nobody here checked. It surfaced the day CI began running the
  rehearsal on `.nvmrc`'s Node.
  **The catch was itself verified, by reverting only the flag** — the same discipline the
  flip-back harness's three deliberate mutations record, which live in `docs/cicd-plan.md`
  and `docs/roadmap.md` rather than in this file. Reverted: 22 ok / 1 not ok on Node 22,
  failing exactly on `did not count rows`; with the fix, 23 / 0. The *unfixed* script is
  23 / 0 on Node 26, which is the leg that proves the harness is reading the runtime rather
  than merely passing. Re-run it the way CI does before trusting a local pass:

  ```sh
  docker run --rm -v "$PWD":/repo:ro -w /repo node:22-bookworm \
    ./scripts/rehearse-accounts-backup.sh
  ```

The database half is **real** in that harness — a real SQLite file through the real schema,
real `VACUUM INTO`, real `integrity_check`, rows counted at both ends. Only `aws`,
`systemctl` and `sudo` are stubbed. So **S3 credentials, the bucket policy, the instance
profile's `s3:PutObject` and the lifecycle rule are unexercised, and the first real upload
is still a first.** Run the service unit by hand once after installing the timer; that is
the only thing that proves the IAM permission exists.

Each case in the harness uses its **own bucket prefix**. They shared one at first and case
8's `latest` resolved to case 3's artefact — restoring four accounts where nine were
expected, with the restore exiting 0 because it did exactly what it was asked. Snapshot
names carry a one-second timestamp and several cases back up inside the same second, so
"newest" was not well defined across them. Same shape as the end-to-end suite sharing one
database across two projects.

The database lives at `ACCOUNTS_DB`, defaulting to `./data/accounts.db`. On the host it
must stay **inside `DEPLOY_DIR`** — the systemd unit sets `ProtectSystem=strict` with
`ReadWritePaths=${DEPLOY_DIR}`, so `/var/lib` is read-only to the process — and **outside
`dist/`**, which both rsyncs delete with `--delete` and `express.static` serves over HTTP.
It is the first state in this app that no script can regenerate, so backups are now an
obligation rather than a nicety; that is Phase 2, and `docs/accounts.md` §3.1 is the plan.

Adding a section is: a `NAV_ITEMS` entry in `src/navigation.ts`, a `Route` variant plus
parse/format cases in `route-core.ts`, a case in `App`'s view switch, and — if it needs new
data — a pure mapper in `football-data-core.ts`, a seed snapshot in
`scripts/sync-seed-data.ts`, and a cached route in `server.ts`. `NavBar` needs no change
*for the entry itself* — that promise held when Jogadores was added — but see the width
arithmetic below: the bar had slack for four items' padding and not for five.

**A new `Route` variant is a four-file change, and only one of the four is enforced.**
Since the crawl surface landed, a variant also needs a case in `page-meta-core.ts`, a
`pageStatus` rule and sitemap entry in `seo-core.ts`, and breadcrumbs in
`structured-data-core.ts`. Only `structured-data-core`'s `trailFor` is caught by the
compiler — its switch returns a value, so a missing case makes it non-exhaustive and
`tsc` fails. The other three fall through to defaults and fail **silently**: the page
gets generic metadata, is absent from the sitemap, and — the one that actually
matters — `pageStatus` answers **200 with a copy of the shell** for every unrecognised
argument under the new section. That is an unbounded set of duplicate pages offered to a
crawler, and nothing goes red. `/estadio/qualquer-coisa` did exactly this until the rule
was added. Adding the variant is the easy half; grep the other three files for a sibling
section (`"partida"` is the closest analogue) and follow it through.

**The desktop destinations are MD3 primary tabs as of M9**, not the filled chip they
were: the active label is `primary` over a 3dp indicator drawn as an `after`
pseudo-element, and the bar now states "selected" the same way at both breakpoints.
`bg-on-surface`/`text-inverse-on-surface` was an inverse-surface pairing MD3 uses for
selection nowhere, so a reader crossing `sm` met two idioms for one idea. The
appearance is MD3's and the semantics stay navigation — no `role="tab"`, because these
change the address and a tab role promises a `tabpanel` and arrow-key selection that do
not exist here.

**They sit on a row of their own beneath the app bar's, and the reason is arithmetic
rather than taste.** Sharing one row with the brand and the trailing controls was
over-subscribed, not merely tight: signed in at 640dp that row had to hold 345dp of tab
labels, a 128dp wordmark, a 108dp account control and a 40dp toggle inside 608dp of
content. The brand was the only elastic member, so it absorbed the whole shortfall and
rendered **27dp wide** — the app's own name reading "P…". At 1280 the same sum left it
115dp against 128dp needed, so `lg:px-3` on five tabs was enough to cut it on a full
desktop too. Both states shipped, and every spec was green throughout, because
`navigation.spec.ts` asserted the wordmark was **visible** and a truncated element is
visible. That spec now measures `scrollWidth` against `clientWidth` at seven widths in
the signed-in state, and it was confirmed red against the old markup before being
believed.

No padding, breakpoint or type step fixes a row whose contents do not fit. MD3 does not
put a five-destination tab row inside a top app bar either — **tabs are a component
placed beneath one** — so the second row is the spec's own arrangement as well as the
one the numbers allow. The cost is **32dp of sticky chrome above `sm`** (73 → 105);
below `sm` the bottom navigation bar is unchanged, the tab row does not render, and the
header stays 73. The tabs are still inside `<header>`, so every spec selecting
`header nav[aria-label="Seções"] a` is untouched — only their line moved.

Two details there are load-bearing and each looks like a tidy-up. The tabs are
**content-sized and left-aligned**, never `flex-1`: the indicator is an `after` inset
from the tab's own padding, so an equal-width tab would draw a 131dp rule under
"Jogos", where MD3's primary-tab indicator hugs its label. And the nav carries
**`-ml-3`** to cancel the first tab's own `px-3`, so the first *label* starts on the
same left edge as the wordmark above it — both are the leading edge of this bar, and 12dp
of disagreement reads as a mistake rather than as spacing.

**The wordmark is a link home.** It was two `<p>` elements, so the one control every
site on the web puts in that corner did nothing here and a reader on a club page had to
find "Classificação" among the destinations to get back. It takes `STATE_LAYER` with
`-mx-2 px-2`, the negative margin buying the veil room to sit in without moving the text
off the content column's left edge.

**The theme toggle draws SVGs, not `☀` and `☽`.** A font decides a character's size and
weight, and those two are decided by different parts of it: measured in the shipped
bundle, the crescent drew about a third the height of the 24px icons beside it, so one
control had two optical sizes depending on which theme was on — in the one row of this
app that had been levelled to the pixel by #173 and M9. `☀` is also emoji-presentation on
several platforms, which would put a colour glyph in a monochrome bar. `SunIcon` and
`MoonIcon` live in `SectionIcons.tsx` despite not being sections, because that file holds
the one `base` attribute bag this app's glyphs share and a glyph defined beside its call
site drifts from it — the same drift `GLYPH` was extracted to stop.

The `NAV_ITEMS` entry carries its own `Icon`, which is *why* `NavBar` never changes — an
icon looked up by id inside `NavBar` would break that promise the first time anyone added
a section.

**The promise is bounded, and the bound is now spent.** Material Design 3's navigation bar
carries **three to five** destinations. Ao vivo made it four; Jogadores took the fifth.
**The bar is full.** A sixth section wants MD3's navigation *drawer*, not a sixth entry
here — and at the sixth nothing fails, no build breaks and no test goes red, which is why
this is a real limit rather than a style note: the tooling cannot check it for you.

**The fifth entry was not free, and what it cost was measured rather than eyeballed.** A
nav item's minimum width is its 64dp MD3 indicator plus whatever padding it carries; at
`px-2` that is 80dp, and five of those is 400dp on a 375dp screen. The fifth label was
clipped at the screen edge with **no horizontal scroll to reveal it** — invisible on a
desktop, and invisible to every test in the suite until `tests/e2e/players.spec.ts` began
measuring each item's box against the bar's at 320, 360 and 375dp. The padding is what gave
way, because MD3 does not specify it while it does specify the indicator. Below 360dp even
that is not enough: five indicators at 64dp is 320dp exactly, leaving nothing for
"Classificação", whose label alone measures 79dp — so the indicator degrades to 56dp under
`min-[360px]:`, and only there, where the spec cannot be satisfied at all. A sixth entry has
no such slack left to find.

### Page metadata

`page-meta-core.ts` maps a route plus loaded data to a title, description and preview
image. It is used **twice on purpose**: `usePageMeta` sets `document.title` on the client,
and the production SPA handler injects the same values into the HTML it serves.

Both halves are needed. The client half updates the browser tab; **link previews never run
JavaScript**, so without the server half every shared URL unfurls as the generic site
name. `injectMeta` replaces the existing title and description rather than appending, so
the document never carries two, and escapes every value it writes.

The server only loads data for routes that name something (`clube`, `partida`,
`estadio`), and takes it from the same cached payload the API serves — no extra upstream
request. The stadium list is *derived* from that payload rather than fetched, for the
reason `venue-core.ts` gives. If that load fails the page still renders with generic
metadata: metadata is a nicety, never a reason to fail a page.

Canonical and `og:url` come from **`APP_URL`** in the host's `.env`. If that is stale,
every canonical points at the wrong origin.

### Crawlers and structured data

`seo-core.ts` and `structured-data-core.ts` are pure, like every other core module, and
cover the three things `page-meta-core.ts` does not: the canonical address of a route,
whether that address is worth indexing, and the JSON-LD that lets a fixture page be read
as a fixture rather than as prose about one.

**The app answers something for every path, and that is right for a reader and wrong for a
crawler.** `parseRoute` sends anything unrecognised to the table, so `/qualquer-coisa`
served a 200 was an indexable duplicate of the home page — and there are infinitely many
of those. `pageStatus` is where the two audiences part company: the body stays friendly,
the status code and `noindex` tell the truth. Unknown sections, a club or fixture that does
not resolve, a round outside the season and an undecodable path are all 404 + noindex with
the classificação still rendered beneath.

**Absent data is not proof of absence.** `pageStatus` only declares a club missing when the
club list actually arrived. Otherwise a provider outage would 404 all 380 fixture pages at
once and a crawler would drop them over an incident lasting minutes.

**The sitemap is load-bearing, not a nicety.** The round picker is a `<select>`, not a set
of links, so every round but the current one — and with it nearly every fixture page — has
no inbound link anywhere on the site. `/sitemap.xml` is the only way a crawler reaches
them. 442 URLs at full season, against a 50,000 limit, so no sitemap index is needed. A
finished match takes its kickoff as `lastmod`, because that is when the page stopped
changing; claiming today's date for a fixture played in April trains a crawler to stop
believing the field.

**The origin comes from `APP_URL` first and the request second.** The request fallback
keeps a fresh clone emitting working canonicals with no `.env`, and `resolveOrigin`
validates the host against a strict pattern before using it — the value lands in
`<link rel="canonical">`, so an unvalidated `Host` header lets a third party claim
ownership of this site's content. `X-Forwarded-*` is consulted only when `TRUST_PROXY=true`.

**The client half must not overwrite the server half before its data lands.** `usePageMeta`
now maintains canonical, `og:url` and robots as well as the title — an in-app navigation
otherwise leaves the canonical claiming the entry page owns every later one. But it renders
before its fetch resolves, and writing then would replace `/clube/athletico-pr` with
`/clube/1768` and strip the `noindex` off a page that really is missing. `subjectResolved`
gates it: where it is false, the server's tags stand.

Two traps, both found by their own tests rather than by reading:

- **The catch-all matches through a wildcard *parameter*, and Express percent-decodes
  parameters while matching.** So `/clube/%` throws `URIError` inside the router and
  Express answers its own 400 error page before any handler runs. The guard registered by
  `registerSpaFallback` decodes first and hands the request to the normal renderer.
  **Express 5 did not change this** — `decodeParam` in path-to-regexp v8 throws the same
  way — so do not read the guard as Express 4 residue and delete it. What *did* change is
  the spelling: a bare `"*"` is rejected at **registration** time by path-to-regexp v8
  (`Missing parameter name at index 1`), which means the server does not boot at all
  rather than misbehaving at request time. It is now `app.get("/{*splat}", serve)`,
  checked against express 5.2.1 to match `/`, any depth of deep link and HEAD, while
  still 404-ing a POST and leaving `/api/*` untouched.
- **`vite.transformIndexHtml` decodes the URL it is given**, to resolve which HTML file is
  being asked for. Passing an undecodable `originalUrl` turns that 400 into a 500 from our
  own handler, which is why the dev branch passes `/` when the request URL will not decode.

**The dev server injects metadata too, and `appType` is `"custom"` for that reason.**
Vite's `"spa"` fallback serves `index.html` itself with a 200 and an untouched head, which
took the handler out of the loop and hid the metadata, the JSON-LD and every 404 rule from
the whole e2e suite. Assets still resolve because `vite.middlewares` runs first.

schema.org's event statuses describe **whether an event happened as announced**, not where
it is in its lifecycle: there is no "in progress" and no "finished". LIVE and FINISHED are
therefore both `EventScheduled`, and only POSTPONED and CANCELLED get a value of their own.

`jsonLdScript` escapes `<` as `\u003c`, not as `&lt;`: a `script` element's contents are
not HTML-parsed, so an entity would reach the JSON parser literally and break it, while an
unescaped `</script>` in a club name would close the tag and spill the payload into the
document.

### Link previews

`public/og-default.png` is the 1200×630 card, drawn by `npm run sync-og-image`
(`scripts/generate-og-image.ts`) and **committed**, because a preview has to resolve on a
host that only ever runs `npm ci --omit=dev`.

**It has to be a raster image.** No platform that matters renders SVG for `og:image` —
Facebook, X, LinkedIn and WhatsApp all reject or blank it — so the card is drawn with the
same headless Chromium `scripts/screenshot.ts` already uses rather than by adding an image
dependency. The colours are read out of `src/index.css` at generation time rather than
written into the script: every value in that file is emitted by `sync-md3-tokens`, and a
second hand-kept copy is how the card ends up a shade off the site it advertises. A token
that has been renamed away fails the run instead of drawing in black.

There is deliberately **no `--check` mode**, unlike `test:tokens`: the bytes vary with the
Chromium build and the host's fonts, so a byte-comparison gate would go red on an unrelated
browser bump. Regenerate by hand when the palette or the wording changes.

**Which image a page gets is a judgement, not a default.** A club page takes its crest,
because that is genuinely what the page is about. Everything else — including a fixture —
takes the site card: a match is *two* clubs, and illustrating it with the home crest asserts
the page is about that one, which is also how the away side's supporters read it.

A **stadium** page still takes the site card, even though it now shows a photograph of
the ground and that photograph would fill a wide card properly. Not an oversight: an
`og:image` is republication on somebody else's surface, where the credit line the
licence requires does not travel with it. Serving the site card is the choice that
does not put an unattributed CC BY-SA photo into every scraper's cache.

**`twitter:card` follows the image's shape**, which is what its two values mean. It used to
be inverted — `summary` whenever an image existed and `summary_large_image` when none did,
declaring the wide layout precisely when there was nothing to fill it. A square crest in a
wide card is a logo adrift in whitespace, so a crest takes `summary` and the site card takes
`summary_large_image`.

`og:image:width`/`height` ride along only for the site card. A crest arrives from the
provider at an unspecified size, and guessing would tell a scraper to reserve a box the
image does not fill. As with the canonical tag and the sitemap, no origin means **no
image tag at all** rather than a root-relative URL — a scraper fetches from its own host, so
`/og-default.png` resolves nowhere and renders as a broken preview rather than a plain one.

### Routing

The URL is the source of truth for the visible section; `App` holds no section state.
`route-core.ts` is pure parse/format with no History API and no React, so every path shape
is unit-tested without a browser. `src/useRoute.ts` binds it to `pushState`/`popstate`.

Nav entries and club names are real `<a href>` elements, so middle-click and "open in new
tab" behave. Their click handlers bail out on modified clicks rather than swallowing them.

**Deep links depend on the server's SPA catch-all.** `/clube/1783` is not a file, so
`express.static` misses and the `app.get("*")` handler serves `index.html`. That handler
must stay registered *after* the API routes, or `/api/*` would be swallowed by it. Verified
in both dev (Vite middleware, `appType: "custom"` — see **Crawlers and structured data**
for why) and the production bundle.

Unrecognised paths and nonsense rounds resolve to something useful rather than 404 — a
stale link should still land somewhere.

Stadium URLs use the same **slug** mechanism (`/estadio/maracana`), derived from CBF's
venue string. `findStadium` re-slugs the segment before comparing, so a hand-typed
`/estadio/Maracanã` lands rather than 404-ing on an accent. There is deliberately **no
`/estadios` index and no nav entry** — see the bound on `NAV_ITEMS` above; a ground is
reached from a fixture, and from nowhere else. The club page carries no link to one:
`ClubView` names no venue at all, and the stadium page's **Mandantes** tiles run the
other way, stadium → club. Three files described that relationship backwards and
promised a door the club page has never had, which is worth knowing before you go
looking for it. So `/sitemap.xml` is the only route a crawler has to the 19 stadium
pages, exactly as it is for the rounds — the same reason, one section further on.

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

`src/data/club-hymns.ts` holds each club's hymn on YouTube, hand-maintained the
same way and for the same reason — no provider carries one. It stores the video
id alone; `hymnUrl` in `club-core.ts` builds the address. Every id was checked
through YouTube's oEmbed endpoint (`/oembed?url=…&format=json`, which reports
title and channel) before being written down, because a search for a club's hymn
returns near-misses that the URL does not distinguish — the hymn of the *city* of
Santos among the club's, for one. That check is now a script:

```sh
npm run check-hymns                                  # every id resolves and names its club
npm run check-hymns https://brasileirao.mpbarbosa.com # …and the deploy serves the same ids
```

It talks to YouTube only, so it costs nothing from the football-data budget, and
it prints the whole table rather than only the failures — a title match narrows
what a human reads, it does not prove the recording is the right one. **No
build runs it**: CI has no network dependency on a third party by design, and a
link that rots on someone else's server is not a reason for a red build on a
commit that did not touch it. A monthly workflow does run it — see the next
paragraph, which is the whole of the difference between *scheduled* and *in
CI*.

**A monthly workflow now runs all four, and it still is not CI.**
`.github/workflows/curated-data.yml` runs `check-hymns`,
`check-stadium-photos`, `check-player-wikipedia` and `check-player-photos` on the
first of the month and reports into an **issue** — opening one, commenting while
the failure persists, and closing it when everything resolves again. The job is
**always green**, which is the whole design: a rotted third-party link is data
for a person, never a red build on somebody's unrelated commit. `workflow_dispatch`
is how to exercise it without waiting for the first.

It creates its own `curated-data` label first, idempotently. That is not
housekeeping: `gh issue create --label` fails on an unknown label, and the label
did not exist when the workflow was written — so without it the job would have
gone red on the first run where a checker genuinely failed, which is precisely
when the always-green promise matters.

**Do not "tidy" its `set -uo pipefail` into `set -euo pipefail`.** Today that
changes nothing — a command in an `if` condition is exempt from `set -e` — but a
bare `npm run check-…` added outside an `if` exits 0 as written and **1** under
`set -euo`, which turns the rule above into a red build. The workflow says so at
the line itself.

`src/data/player-instagram.ts` holds players' own Instagram accounts, keyed by
**player id** and hand-maintained for the same reason `club-instagram.ts` is: no
provider carries a social account at any tier. Coverage is deliberately
**partial** — 38 of ~950 listed players — and grows by hand, like `broadcasts.ts`.

**There is no `check-player-instagram` script, and that is not an oversight.**
Instagram serves the identical JavaScript shell for a real handle and an invented
one — 200, `<title>Instagram</title>`, no Open Graph tags — so the check
`check-hymns` and `check-stadium-photos` perform is simply unavailable here, and
a script that fetched a profile and reported success would confirm nothing while
looking exactly like the ones that confirm something. Candidates came from
Wikidata's `P2003` joined to `squads.ts` on **exact date of birth**, then each was
confirmed against a search result carrying the profile's own title, follower count
and — where visible — a bio naming the club. That pass rejected or corrected
**13 of 70**: six wrong handles (Ramón Sosa's `sosa` is somebody else's account;
Nicolás De La Cruz differs from the recorded handle by one underscore), one
account since **deactivated**, and the rest uncorroborated or split between two
rival profiles. Absent is the honest answer for those. Do not add a handle
without opening it.

`src/data/club-wikipedia.ts` holds each club's article on the **Portuguese**
Wikipedia, hand-maintained for the same reason. It stores the title alone
("Sociedade Esportiva Palmeiras"); `wikipediaUrl` in `club-core.ts` builds the
address. The title is not derivable from data the app holds — `name` is the
provider's abbreviation ("SE Palmeiras"), `shortName` the popular name, and the
article sits at the full legal one, with the club's own spelling ("Foot-Ball",
"Foot Ball", "Athletico"). Every title was checked through the MediaWiki API
(`/w/api.php?action=query&titles=…&redirects=1&prop=extracts&exintro=1`, which
reports existence, redirects and the first sentence) before being written down;
all twenty resolve directly, and each intro names the club.

`src/data/player-wikipedia.ts` holds each player's article on the **Portuguese**
Wikipedia, keyed by player id and storing the **title alone**, exactly as
`club-wikipedia.ts` does. `wikipediaUrl` builds the address. The title is not
derivable from anything the app holds — **79 of the 169 recorded titles differ
from the listed name**, most of them disambiguated ("Dudu (futebolista, 1992)",
"Luiz Gustavo (futebolista, 1987)"), because the popular name is shared.

**This one has a checker, and its Instagram sibling deliberately does not:**

```sh
npm run check-player-wikipedia   # 169 articles, one API call per 20
```

That asymmetry is a property of the two hosts, not of how carefully each file
was built. Wikipedia answers a machine honestly; Instagram serves the same
shell for a real handle and an invented one. Do not read it as an inconsistency
and do not "fix" it by adding a script that fetches a profile and reports 200.

The check is: the article resolves following redirects, its `wikibase_item`
round-trips to the Wikidata id the sitelink came from, it is not a
disambiguation page, and **its own intro states the same birth date as
`squads.ts`**. The birth date is the load-bearing one. Candidates came from a
Wikidata `ptwiki` sitelink joined on date of birth, and three of 160 still drew
the wrong person — the article offered for "Willian Oliveira" opens "6 de junho
de 1989" against a squad list saying 1993-05-16, because it is about Willian
Farias. A title match cannot see that; only reading the article can. One trap
when editing the checker: pt-BR writes the first of the month as an ordinal, so
`1º` and `1.º` are accepted beside `1`, and without that Bruno Fuchs reads as a
mismatch on every run.

`src/data/player-photos.ts` holds a photograph for a player, keyed by player id,
from **Wikimedia Commons** — the bytes vendored into `public/players/` by
`npm run sync-player-photos` and served from our own origin. **70 players, 2.9 MB**,
chosen out of 100 candidates by opening every one at the size the card renders.

**Instagram is not a source and cannot be**, which is worth stating because the
handle sits in the file next door and the question comes up. A player's own
photographs are their copyright; a public profile licenses nothing, the CDN
addresses expire, and hotlinking them republishes someone's work without
permission. Commons is the source precisely because every file carries a licence
that says what a reuser may do.

The vendoring argument is **stronger here than for stadiums**. That one had to be
made from what a future design might do, since a stadium page shows one image.
Opening several player cards in a row is not a future design — it is how the
Jogadores page is read, and it is exactly the shape that earns Commons' 429.

```sh
npm run sync-player-photos    # re-reads every licence and credit, then vendors
npm run check-player-photos   # …and verifies what is on disk still matches
```

`credit`, `license` and `licenseUrl` are **required** on `PlayerPhoto`: a player
may have no photograph, but may not have an unattributed one. The credit renders
at the foot of the card as a condition of showing the picture — if it goes, the
picture goes with it. `tests/player-photos.test.ts` asserts the *data* rather
than the code for that reason: the compiler is satisfied by an empty string,
which reads on the page as a missing attribution.

**`redistributable` refuses "Public domain", and that is the licence to think
hardest about before widening.** It is the second most common among candidate
player photographs (23 of 125 surveyed), so the temptation is real; but on
Commons it is an umbrella over dozens of tags, some country-specific and some
contested, and `deedFor` cannot name the deed a reuser would rely on. Widening it
is a change to `commons-core.ts` with the stadium photographs downstream.

**Two traps, both of which the stadium photographs hit first, and a survey that
rejected 30 of 100 on them.** A file that resolves is not a photograph of the
right person — for a player the trap is a **team photograph**, and it is far
commoner than the stadium equivalent: the lead images offered for João Paulo and
Cristian Medina are a Santos line-up and Argentina's starting eleven, Edenilson's
is captioned "Players of SC Corinthians" under a file named for a different
player, and Dudu and Marllon were offered the *same* match photograph. The rest
of the rejections are real pictures of the right player that are unusable at
64px — a full-body action shot leaves a face a few pixels wide, and one player's
only free photograph has his face covered by a snood. Two more were rejected by
the rules rather than by looking: one candidate named the player nowhere, and one
carried no attribution at all.

And a free photograph of a footballer is usually **old**, and usually another
club's: Commons has what somebody was free to release. Memphis Depay's shows him
at Olympique Lyonnais in 2019. That is why `alt` names the shirt and the year
rather than the player, whom the card already names beside it.

`scripts/commons-api.ts` holds the HTTP half — fetching a file's metadata and its
bytes — shared by all four Commons scripts. It was extracted when the player
scripts would have made a fourth copy, and the two stadium copies had already
drifted: one asked Commons for `ImageDescription` and the other did not. It stays
separate from `commons-core.ts`, which is pure and holds the *judgement*, because
that split is what lets the licence rules be unit-tested without a network.

`src/data/player-sofascore.ts` holds each player's profile on **Sofascore**,
keyed by player id and storing the **id alone** — the curated player file whose
stored value is smallest, for a reason worth reading. A Sofascore URL looks like `/pt/football/player/memphis-depay/138833`, but none of
that path except the number is load-bearing: **`_` in the slug position resolves
by id** and redirects to the canonical address, which is Wikidata's own
formatter for this identifier (P12302). So `sofascoreUrl` in `player-core.ts`
builds `…/player/_/<id>`, the file stays a plain `Record<string, string>` like
its two neighbours, and a slug Sofascore renames tomorrow cannot rot a link
here. The `/pt/` prefix is not stored either and must not be added: `/pt/player/_/138833`
is a **404**, and the prefixed form a reader pastes redirects to the unprefixed
address regardless — Sofascore negotiates the language itself.

Coverage is 427 of 948. Candidates came from Wikidata's P12302 joined to
`squads.ts` on exact date of birth **plus** an exact normalised name, and 141 of
them needed no name match at all — their `ptwiki` title is the one
`player-wikipedia.ts` already records, so they ride on a join
`check-player-wikipedia` has verified against the article's own birth date.
Every match was then re-queried for citizenship and occupation; that caught
three real cross-person matches on the name+date path (Vitinho, Matheus Reis,
Alexandre Guedes), all dropped.

**There is no `check-player-sofascore`, and like the Instagram file that is a
property of the host rather than of diligence.** Sofascore sits behind
Cloudflare and answers **403** to every scripted request, `api.sofascore.com`
included, whatever the User-Agent — so a checker would have nothing to read.
Eight ids were opened in a real browser instead. Do not add one from a search
result without opening it.

`src/data/player-overrides.ts` is the one curated player file that **corrects**
the provider rather than adding to it. Keyed by player id like its neighbours,
with an optional correction per field, and applied by
`withSquadOverrides`/`withScorerNames`/`withPlayerOverrides` in `server.ts` on
the way out of `/api/squads`, `/api/scorers` and `/api/players/:id` — inside
**both** branches of each cache fill, so the live and offline answers cannot come
to differ. The suite runs the seed branch and production runs the other, which is
exactly the split that would hide this.

**All three routes, and `/api/players/:id` is the one that looks optional and is
not.** `mergePlayer` keeps the card's existing *name*, so a correction there is
belt-and-braces — but it prefers `extra.nationality`, so without the same
correction on the person route the card **visibly undoes** it: measured by
reverting that one line, the card read "Brasil" on open and flipped to
"Bulgária" a second later when the enrichment landed. A field-by-field merge
means "which routes need this" is a per-field question, and the answer is
already written down in `mergePlayer`.

**One file with optional fields, not one file per field.** It held only names for
the hour between #213 and #214; a parallel `player-nationality-overrides.ts`
would have been two near-identical doc comments stating two versions of one rule,
and a third file the first time somebody wanted a position. The per-field rules
genuinely differ, so they live on `PlayerOverride` in `src/types.ts` where a
reader adding an entry will look:

- **`name` — only where the recorded value is not a name at all.** Corinthians'
  fourth goalkeeper arrives as `"Felipexxx"`, `firstName` empty and `lastName`
  "Felipe": a placeholder somebody typed into a database and left. Not a place to
  prefer one spelling to another — the provider's nicknames and single names are
  what every other football site shows the same reader, and an ambiguous real
  name stays. `259933` renders as "Guilherme" where the club says "Gui Negão" and
  there are three Guilhermes in that squad; it is still a name, so it is still
  "Guilherme".
- **`nationality` — only where it is factually wrong**, in the **provider's**
  vocabulary ("Brazil") so `nationalityLabel` still does the translating and a
  country reaches the page one way rather than two. `1609` is served as
  `Bulgaria`; he is Brazilian, born in Atibaia, and the cause looks like a
  country-of-club leak — he played for Ludogorets and pt.wikipedia files him
  under *Brasileiros expatriados na Bulgária*.
- **Not positions**, though upstream gets six of Corinthians' 33 first-team
  players wrong against the club's own sections — a volante filed under
  Defensores, two attackers under Meio-campistas. A position is genuinely
  arguable where a placeholder name is not, six entries is where a curated table
  starts drifting against the provider every transfer window, and the club's own
  page is not a stable machine-readable source. Recorded rather than fixed.

Verify against the person endpoint **and** an independent source before adding
one, joined on **exact date of birth** — the evidence `check-player-wikipedia`
rests on, and for the same reason: a name match cannot tell two people apart.
That matters more here than it sounds. Wikidata offers a second Corinthians
player born 2005-03-05, so the birth-date join alone was ambiguous for Felipe
Longo; what settles him is that upstream says goalkeeper with `lastName`
"Felipe" and the club lists exactly one goalkeeper at 40.

**Absence of a source is not evidence of an error, and this is where the file
stops.** A sweep of all 948 players found 29 nationalities, of which `Bulgaria`
is the only wrong one — but `Mexico` and `Ukraine` each name one base player with
no article in any language, so they are *unverified* and left alone. The same
sweep found `Felipexxx` to be the only placeholder-shaped name in the division.

**`squads.ts` cannot carry any of this**, which is the whole reason the file
exists: it is generated, so `sync-seed-data` overwrites a hand-edit on its next
run and says nothing. Overriding at serve time survives the regeneration.

There is no checker, because what goes stale here is the **override** rather than
a third-party link, and that is local. `tests/player-core.test.ts` fails when an
entry names an id no longer in `squads.ts`, when a field's recorded value already
matches (upstream having fixed their data, which arrives as a regenerated seed
and in no other way), when an entry *fills* an absent field rather than
correcting a wrong one, and when a corrected nationality is one
`NATIONALITY_LABELS` does not know — which would put the English word on the card
through the one path that bypasses the provider. Each was confirmed red before
being believed, except the fills-an-absence branch, which cannot be reached today
because every player in the seed carries both fields. Note none of them can
redden on somebody's unrelated commit, only on a deliberate `sync-seed-data`,
which is what keeps this a unit test rather than a monthly workflow.

`src/data/stadiums.ts` holds each ground's official name, capacity and year of
inauguration, hand-maintained for the same reason as the hymns — **no provider carries
any of it**, and CBF's feed stops at a name, a city and a state. Keyed by stadium slug,
not by match id, which is what `venues.ts` uses. Every value was read out of the
stadium's article on the Portuguese Wikipedia (the infobox's `nome_completo`,
`capacidade`, `datainauguração`) before being written down, because **a plausible
capacity is indistinguishable from a correct one** to anyone reading the page — an
invented number would never be caught. Two grounds' articles state no inauguration year;
`opened` is absent for them rather than guessed, and the page simply omits the tile.
`name` is the popular name properly cased, which is what overrides CBF's `ARENA MRV` on
both the stadium page and the match page's Estádio line; `officialName` is carried only
where it genuinely differs.

It also holds each ground's **photograph**, named by its **file title on Wikimedia
Commons** — `"ARENA MRV.jpg"` — exactly as `wikipedia` stores an article title. The
title is the *source*; the bytes are **vendored into `public/stadiums/`** by
`npm run sync-stadium-photos` and served from our own origin, the same answer the
broadcaster marks got and for the same reason (`docs/roadmap.md` principle 4). They
shipped hotlinked and were vendored afterwards — one image per page had not tripped
Commons' 429, but that is a property of the layout rather than of the code.

The sync's licence rule is deliberately **looser than the marks'**: `redistributable`
in `commons-core.ts` admits CC0, CC BY and CC BY-SA, because a photograph renders its
credit as a condition of display and so the obligation is met, where a mark has no
credit line beside it. It refuses any licence it cannot *name* rather than anything on
a blocklist. `commons-core.ts` is shared with `check-stadium-photos` on purpose — a
second copy of that judgement is how the checker comes to pass a file the sync refuses.

```sh
npm run sync-stadium-photos   # 19 grounds × 2 widths, ~17 MB, re-reads every licence
```

**The credit is not decoration.** Every licence in that file except one CC0 upload
requires the photographer to be named wherever the image appears, so `credit`,
`license` and `licenseUrl` are **required** fields on `StadiumPhoto` while everything
else about a stadium is optional — a ground may have no photo, but it may not have an
unattributed one. Credit strings are copied **verbatim**, trailing semicolons and all:
where Commons publishes an `Attribution` field the photographer dictated that wording,
and tidying it into house style is exactly the edit that is not ours to make. Three of
them were tidied in the first draft and `check-stadium-photos` caught all three.

**A file that resolves is not a photo of the right ground.** The obvious automation —
take the lead image of the ground's Wikipedia article — is wrong often enough to be a
trap: the Maracanã, the Mineirão and the Arena do Grêmio all lead with the stadium's
*logo*, and a correctly-titled Commons file for the Nilton Santos is described there as
a journalist posing outside it. Every file was opened and looked at, and `alt` was
written from that viewing rather than from the name. Verify with:

```sh
npm run check-stadium-photos                                  # each file, credit and licence still match Commons
npm run check-stadium-photos https://brasileirao.mpbarbosa.com # …and the deploy serves the same files
```

It talks to Commons only, so it costs nothing from the football-data budget, and like
`check-hymns` it prints the whole table — it narrows what a person has to look at, it
does not replace looking. No build runs it, and the monthly `curated-data.yml` does,
both for the reason given there.

`src/data/rank-history.ts` is generated by `npm run sync-rank-history`, which fetches
nothing — it derives the campanha from the seed fixtures already on disk. It is therefore
only as current as `matches.ts`, so **regenerate it after every `sync-seed-data`** or the
two files describe different seasons. The generator validates its own output: every club
must have an entry for every round, and each round's positions must be a permutation of
1..N, because a duplicated or missing position is invisible once it is drawn as a line.

`src/data/squads.ts` is generated by the same `sync-seed-data` run and costs **no extra
request**: the club rows, the postal address the state is parsed from, and every club's
squad all come out of the one `/competitions/BSA/teams` payload. It references clubs
through `CLUBS_BY_CODE` rather than restating them, so it cannot come to disagree with
`clubs.ts` about a crest or a name, and it throws at import time if it names a club that
file does not have. The generator **warns but does not fail** when a club has no squad
upstream: that is a gap the page renders honestly, and the alternative is noticing it
months later on the page itself.

`src/data/clubs.ts` and `src/data/matches.ts` are **generated files** — a frozen snapshot of
the real division and season, serving as the offline fallback. Regenerate with:

```sh
npx tsx scripts/sync-seed-data.ts   # costs 3 calls against the 10/min budget
```

Do not hand-edit them; hand-maintenance is what let the original list drift to the wrong
division. The generator validates its own output: it rejects duplicate club codes, rejects
duplicate display names, and rejects a duplicate display name, which is what an override keyed to the
wrong club id produces.

**A club's `coach` in that snapshot is a floor, not the answer.** It is captured
from the same teams payload as everything else there, so it costs no extra
request — but a Série A club changes técnico several times a season and
`clubs.ts` is regenerated far less often than that. `coachOf` in `club-core.ts`
therefore prefers `/api/coaches`, which reads the live team list, and falls back
to the frozen name only so a failed request still leaves the club page naming
someone. This is the reverse of `withClubDetails`' rule, where the committed list
supplies what no live payload carries at all; do not collapse the two.

**Club identity is the upstream numeric id, never `tla`.** The abbreviation is not unique:
Corinthians and Coritiba both report `tla: "COR"`, so keying on it merges two clubs into
one standings row. `tla` rides along on `Club` for display only. `/api/matches` ships the
clubs it saw alongside the fixtures so the UI resolves names from the payload.

`src/types.ts` is the single source of truth for shared shapes. Extend it before adding
fields to data files or components.

## Working alongside other sessions

Several Claude sessions share this checkout. Each takes its own **git worktree**
and branch under `.claude/worktrees/`, so their edits cannot collide — the
commands are at the top of this file, under **Before anything else**, and are
deliberately not repeated here: two copies of a setup snippet is how one of them
comes to be wrong.

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
  **That applies to the dev server only, not to the test harness.** Playwright
  boots its own server with `STRICT_PORT`, deliberately: a suite that quietly
  moved to another port would be testing a server its own config does not
  describe. So a second concurrent `npm run test:e2e` fails rather than walks —
  pass **`E2E_PORT=3101`** to run one alongside another session's. CI needs
  nothing; it runs alone.
- **Identify a worktree by the branch it holds, not by the directory name you
  gave it.** `git worktree list` prints both on one line; compare them before
  every destructive command. A directory named for your task can be checked out
  on a branch you never created — a prepared worktree with `node_modules`
  already installed costs a peer nothing to reuse, so they reuse it. After that
  the name is a fact about who *made* the directory, not about who is working
  in it, and the second reading is the one that matters.
- **Remove your worktree in the same turn its PR merges, or hand it over in
  words. Do not defer it.** "Say the word and I'll tear it down later" sounds
  careful and is the opposite. The window between your work landing and your
  cleanup is exactly when a peer adopts the directory, and by the time the word
  comes you can no longer answer your own question: `account-store-test` was
  re-pointed at another session's branch, carrying a merged commit of theirs,
  **nineteen minutes** after its own PR merged. Deferring turned a one-command
  cleanup into an ownership hunt across a dozen sessions.
- **If you adopt someone else's worktree, rename it to match the branch you put
  on it.** `git worktree move .claude/worktrees/<old> .claude/worktrees/<new>`
  is one command and makes `git worktree list` self-describing again. Adoption
  itself is fine and usually sensible — a prepared checkout with `node_modules`
  already installed is worth reusing — but an adopted directory still carrying
  its creator's name is indistinguishable, from outside, from one that session
  forgot it had re-pointed. This is the half that turned the incident above into
  a broadcast to a dozen sessions: recording a worktree when you create it only
  closes the loop if the **adopter** records too, and nothing prompts them to.
- The root checkout is for integration. Do the work in a worktree.

**Two separate questions, and the ancestor test only answers the first.**
Whether a *branch* is finished is `git merge-base --is-ancestor <branch>
origin/main`. Whether a *directory* is yours to delete is whether you are the
session working in it — and a branch that has merged says nothing about that,
because the peer who adopted your worktree may still be sitting in it with the
next task already started. Where you cannot establish both, leave it standing
and say so: an idle directory costs a little tidiness, and `git worktree prune`
collects it once its owner is done.

**A branch that was never worked in is an ancestor of `origin/main` too**, and
that is the blind spot in the paragraph above rather than a footnote to it.
`git worktree add -b worktree-<name>` leaves the new branch pointing at the
commit it was created from, so `--is-ancestor` says yes and
`git rev-list --count origin/main..<branch>` says 0 — the two answers a merged
branch gives. Measured across the branches standing on 2026-08-27:
`worktree-shots-refresh` and `worktree-drill-workflow` had merged,
`worktree-check-before-destroy` and `worktree-rehearsal-in-ci` had never held a
commit, and **all four** answered `ancestor=yes, ahead=0`. A prepared worktree
was swept on exactly that reading.

The branch reflog separates them, and it is readable from inside a worktree
because every worktree shares the root checkout's `.git`:

```sh
born=$(git reflog show <branch> --format='%H' | tail -1)
test -z "$born" && echo "UNKNOWN — reflog expired; do not delete"
test "$born" = "$(git rev-parse <branch>)" && echo "never held a commit — not merged, unstarted"
```

A branch that has never held a commit has exactly one reflog entry, `branch:
Created from …`, and its tip still equals it. Note what the test actually
answers — not *finished* versus *abandoned*, which no command can tell you, but
**has this branch ever held work that deleting it would destroy**, which is the
question the destructive step needs. It fails safe: a worktree holding
*uncommitted* work also answers "never held a commit", and that is a stronger
reason to leave it standing, not a weaker one. It fails unsafe only once the
reflog has expired — 90 days by default, against branches that live for hours —
so an **empty** reflog is `UNKNOWN` and never "merged".

**The record that would have settled it is `COORDINATION.md`, and until this
paragraph nothing committed named it:**

    /home/mpb/Documents/GitHub/portal_brasileirao/.claude/worktrees/COORDINATION.md

`.gitignore` excludes `.claude/worktrees/`, so the ledger exists only in the root
checkout and does not appear in any worktree's own tree — and a worktree is the
only place sessions work. **It is readable, though: `cat` that absolute path from
inside any worktree and it opens.** The distinction matters because the two are
fixed by opposite changes, and getting it backwards sends you to re-address a
file that is already reachable. What is unreachable is the *discovery* — nothing
in a worktree lists it, so a session that has not been told the path will not
find one. Before this commit `git grep COORDINATION origin/main` returned nothing at
all, so no session had a reachable way to learn the file existed; that is the
mechanical reason recording gets skipped, and it is not a discipline problem.
Four committed files name it now — this one, `docs/development-environment-memory.md`
and the `session-pending` and `session-teardown` skills — which is deliberate
redundancy rather than duplication: the address has to be wherever the question
is being asked, and the two skills are what a session reads while deciding to
delete something. Read it by that absolute path,
and add an entry at the moment you create **or adopt** a worktree. The rules stay
here, in the file that travels into every worktree; the ledger is the running log
and the trap catalogue, and it says so itself.

**A report that something merged is not evidence that it merged.** A peer's
message, a PR list read a minute ago and your own recollection are readings taken
somewhere else at some other time — #139 was reported merged when it was #138
that had merged, four minutes earlier. Re-run `git merge-base --is-ancestor
<branch> origin/main` in the same turn as the `git worktree remove`, not in the
turn that decided to remove it; that re-run is the only reason an unmerged branch
survived. It is the destructive-step twin of *a status message is not consent*
below, and the same discipline as anchoring a claim about a shared ref.

**A probe that reverts its own subject reports the absence of what it was testing
as a pass.** A `git checkout -- <file>` inside a probe silently undid the
uncommitted edit the guard existed to catch; the guard then ran against a clean
file, found nothing to complain about, and exited green — which reads as
*verified* and is its opposite. Before believing a green probe, make the subject
fail on purpose once and watch the probe go red. Same failure as the Playwright
stub under **End-to-end tests**, which passed against the very bug it named, and
worth stating twice because the first statement was filed under a section nobody
reaches while debugging shell.

### The protocol for commit, push, merge and deploy

Four verbs, in order. Each has one check that makes it safe, and each check
exists because skipping it cost real work rather than because it sounds prudent.

**0. Before you start, claim the work.**

```sh
git worktree list && git branch -a --list '*<topic>*'
gh pr list --state all --limit 10
L=/home/mpb/Documents/GitHub/portal_brasileirao/.claude/worktrees/COORDINATION.md
grep -n '^## ' "$L" | grep -viE 'merged|removed|torn down|closed|resolved|stood down'
grep -n -i '<topic>' "$L" | grep -i 'claim\|worktree-\|PR #'
```

**The second grep is narrowed, and that is not tidiness — it is what stops the
rule above it being defeated.** Telling you never to pipe the search into `head`
or `tail` is half a fix if the prescribed search hands back a wall. Measured on
2026-08-29, an hour apart: a bare `grep -i` for `shots` returned **99** lines and
then **114**; `header` **25** and then **33**. Narrowed, the same two searches
gave 21 and 24, then 3 and 3. Both were live topics that evening.

Those counts are **readings and not constants** — they grew while this paragraph
was being written, which is the same discipline the anchored-claim rule below
asks for, and the reason no number here is worth citing without its date.

**The pull toward truncation does not wait for the output to be long, which is
the part worth internalising.** The session that raised this reached for `| head`
on a **six**-line result and then said so unprompted — it was the *anticipation*
of noise, not the noise. So a search that *could* be noisy is one you will
truncate eventually, on the run where it happens to matter.

**The narrowing is a first pass, not the whole answer.** It keeps only lines
carrying `claim`, `worktree-` or `PR #`, so an entry whose heading uses none of
those words is invisible to it. That is what the unfinished-entries grep above it
is for; run both, and treat a narrowed search that returns nothing as a reason to
widen rather than as an all-clear.

**Read the ledger with a search, never with a line range**, and the reason is
structural rather than a matter of picking a bigger number. **The file has two
insertion conventions.** Some sessions prepend, some append at the end; measured
on 2026-08-29, one session's six entries sat at 85, 287 and 405 because it had
been prepending all evening, while others were at 2936 and 3018 because they
appended. Nobody had ever agreed either way. The ledger's **own header** now
prescribes one — prepend, immediately below the header, anchored on its
`HOW TO ADD AN ENTRY` heading rather than on "the first `## `", which is the bug
that had pushed the title block and the addressing instructions down to line 46.
But entries written the other way are deliberately **not** retro-moved: sessions
cite line numbers to each other and the file is written concurrently, so a bulk
reshuffle is a lost update waiting to happen. Both conventions therefore remain
present in the file, and will.

So **no positional read can be correct, because there is no agreed end.**
Widening `sed -n '1,80p'` to `1,200p`, or adding a `tail`, would each still be
wrong for whichever convention it is not pointed at — and a search is the only
form that cannot rot the next time somebody picks the other one. When this line
was first written as `sed -n '1,80p'`, live claims sat at 1, 68 and 510 *and* at
2936 and 3018; `crest-fallback — CLAIMED, no PR yet` was the last of those, an
unpublished session, exactly the case this line exists to surface and invisible
to the command then prescribed. The claim that would have prevented the #192/#193
collision was at 693.

**Do not cite a line number here as though it were an address.** Every number in
this paragraph is a reading, not a location: `crest-fallback` was at 2980 when
this was drafted and 3018 an hour later, having moved because other sessions
wrote above it. That is the same discipline the anchored-claim rule asks for
below, applied to a file rather than to a ref.

**And do not pipe that search into `head` or `tail`.** This is the failure that
actually happened, and it is worse than not looking, because it feels like
looking. Before starting the refresh that became #193, the session searched this
file for the literal string `shots-targets` — and piped the result through
`| tail -40`. The search produced **677 lines**; tail showed 638-677; the hit was
at output line ~90. The answer was retrieved and discarded, and a truncated view
is indistinguishable from an empty one. Same family as the `A..B` versus `A...B`
traps below: the right command, run in a way that cannot answer.

**The third line is the one that gets skipped, and it is the only one that can
show you a session that has not published yet.** The first two answer *who has
published*; the ledger answers *who has said they are starting*. That difference
is the whole window a collision lives in — as long as the work takes.

Measured on 2026-08-29, two tasks, five pull requests, three of them closed as
duplicates:

- **Three sessions independently separated a control's touch target from its
  box.** #181 (00:08, merged 00:20), #184 (00:20) and #188 (00:31). Same
  diagnosis, same technique, same evening.
- **Two sessions re-shot the same eighteen captures.** #192 (00:55, merged
  00:59) and #193 (00:56). 16 of the 18 images came back byte-identical.

Every session ran the two commands above. One also ran the reflog born-vs-tip
test on the prepared worktree, checked `/proc` cwds, and asked a peer directly —
and still collided, because the peer it asked was not the owner and the owner had
not published yet. **The protocol as written cannot close this**, which is why
reading the ledger is now in it rather than only in the teardown skills.

**Those checks were all for a different question, which is why passing them all
still cost the work.** `--is-ancestor`, the reflog test, `/proc` cwds and asking a
peer answer *may I destroy this?* — and they answered it correctly: leave the
worktree standing. *Is somebody already doing this?* is a separate question, it
has the opposite failure mode, and until this line it had no procedure at all. A
session can run every documented check, get every answer right, and duplicate a
day of work, because none of the checks was ever pointed at what it was about to
do.

The ledger is **readable by absolute path from inside any worktree** — verified,
2892 lines — even though `.claude/worktrees/` is gitignored and so does not exist
in the worktree's own tree. Four committed files name it. What was missing was
never its address; it was that no loop anyone runs opened it.

So the other half is yours: **write your claim there before you start**, not when
you finish. A claim written at the end is a record; written at the start it is the
only thing that makes the window visible to anybody else. And where the work
touches a shared artefact — `docs/screenshots`, CLAUDE.md, a docs sweep — say so
to the other sessions as well as to the file, because a file write reaches nobody
inside the window that matters.

**And create the worktree and branch BEFORE you write the claim, not after.**
The ledger closes the window between claiming and publishing a PR. It cannot
close the window between **reading** the file and **writing** to it — which is
however long you spend composing the entry, and a careful entry takes minutes.
That inverts the obvious advice: a fuller, more thoughtful claim is a *wider*
collision window, so "write a better entry" makes this worse rather than better.

`git worktree add .claude/worktrees/<name> -b worktree-<name>` is one command
and it is the **only atomic check in this step**. Git refuses a duplicate branch
name; a markdown file cannot refuse anything. It costs nothing to run first, and
it converts an unenforceable convention into a guard the tooling holds.

On 2026-08-29 two sessions claimed the same screenshot refresh within the same
minute, both having run every command above correctly. One grepped the ledger at
14:58:27Z and found no holder — true when taken — and wrote its claim about
forty-five seconds later; the other's claim is stamped 14:59:23Z. What caught it
was `fatal: a branch named 'worktree-shots-218' already exists`, roughly forty
seconds **after** the grep had returned clean and before either session could
have learned it from the file. The branch namespace collided before the ledger
did.

**Do not cite the delta between two claims as though it timed the race**, which
an earlier draft of this paragraph did. The two *writes* were seconds apart; the
two *headings* differ by more than a minute, because one was rounded by hand and
the other read off `date -u`. A recorded stamp is what a session wrote down, not
when it acted, and only one of these was an instrument reading — so the
difference measures the rounding, not the window. That the second session read
before the first's write landed is an inference too; the collision is
established, the ordering inside it is not.

**The guard is atomic on the branch *name*, not on the *task*, and it must be
read with that limit or it looks like it closes the class.** It worked there
only because the naming convention made two independent sessions derive
`worktree-shots-218` from the same PR number. Two sessions naming one job
differently — `shots-218` against `screenshot-refresh` — are two branches to git
and one task to a person, and git will happily create both. That is exactly the
#181/#184/#188 shape, where three sessions fixed one touch-target bug under
three names and nothing refused anything. So: a real guard, on the case where
the convention converges, and the remaining exposure is the case where it does
not. Naming your branch the obvious thing is therefore part of the guard rather
than a matter of taste.

**The limit is not hypothetical, and the commit adding this rule is the
demonstration.** It collided with a second session writing the same rule, under
`worktree-branch-first-rule` against `worktree-step0-branch-first`. Same task,
two names, both branches created without complaint, and neither ledger entry
landed before the other session had read. **The guard did not fire on its own
commit.** One of the two was closed as a duplicate after the fact, which is the
cost this rule exists to avoid and did not.

**When two claims do collide, the tie-break is who is provisioned, not who was
first.** Priority by timestamp hands the work to the session with neither
worktree nor branch, which is the wrong way round. In the case above the earlier
claimant stood down explicitly — and saying so outright rather than going quiet
is what let it resolve in one round, because a silent withdrawal is
indistinguishable from a session that simply stopped reporting.

**A follow-up named in a merged PR or a plan document is a magnet.** Both of the
collisions above were exactly that: #174 handed the account control on in
`docs/md3-completion-plan.md` under M9, and the screenshot refresh was owed in
prose by two merged PRs. Several sessions read the same document and reach the
same "this is the obvious next thing" — so a task that looks conveniently unowned
is the case to check hardest, not the case to start fastest. **A prose hand-off
is not an assignment**, however directly it is worded.

Someone may already be doing it. A worktree that is clean, stale and untouched
for an hour is **not** evidence of abandonment — that is also exactly what one
looks like immediately after its owner pushed and merged, and what a live session
looks like while it reads files and runs tests. Ask two things, not one: whether
its branch is an ancestor of `origin/main`, **and** whether that branch has ever
held a commit. A finished one is an ancestor and has; a prepared or unstarted one
is an ancestor and has not; a live or abandoned one is usually neither. The
ancestor test alone answers *yes, finished* for a worktree nobody has started —
see **A branch that was never worked in** above for why, and for the second
command. If it is still ambiguous, **ask the session** rather than infer from
timing. Ownership guessed from "who started recently" was wrong four times in one
evening.

**And check the prompt that sent you: a dispatch prompt's setup lines are
assertions, not facts.** They are frequently wrong, and wrong in ways that
survive a confident-sounding sentence. On 2026-08-27 two sessions were
dispatched onto the same task and given an identical false trio — a repository
path of `/home/user/portal_brasileirao` (it is under `/home/mpb/...`), a
worktree count of three, and **"you are root"** (this machine runs uid 1000,
with no passwordless sudo). Both found all three false independently — and the
count was not merely wrong but *moving*: one session counted seven that
evening and the other eleven, an hour apart. A number in a prompt is stale even
when it was once right. Three commands settle all of it:

```sh
pwd && git worktree list && id -u
```

**"You are root" is the one to check hardest, because it is the only member of
that trio that does not fail loudly.** A wrong path errors on the first
command. A wrong worktree count is contradicted by the listing you already run
above. But a false uid claim silently *inverts which way a privilege-dependent
test fails* — and both those sessions had been sent to fix exactly such a test.
A session that believes it is root reads its own passing run as the bug
reproducing, and draws the opposite conclusion from identical evidence. Real
uid 0 here comes from a container (`docker run -u 0`), never from `sudo`.

Treat a named worktree or branch the same way: **create it if it is not there**
rather than assuming you are in it, and never assume it is still yours later —
see the two worktree rules above.

**The trio is not the whole set: a prompt's claims about *other work* go stale
fastest of all.** On 2026-08-28 a prompt opened a docs task with two setup
lines, both wrong, and neither in a way that errors:

- **"PR #149 is already open against `roadmap.md`, so it needs coordinating
  there rather than a blind edit."** #149 had merged the previous afternoon
  (`2026-08-27T16:22:36Z`, `1ae9010`). Acting on it means either stalling on a
  merged PR or coordinating with nobody.
- **A base of `4a01114`, given as `main`.** `origin/main` was `17521d6` —
  thirteen commits and five merged PRs further on. That is the *root checkout's*
  stale local `main`, which is exactly the reading **Compare against
  `origin/main`** warns about, arriving through a prompt instead of a diff.

Both were probably true when written. That is the point: a PR state and a branch
tip have a shelf life measured in minutes here, so they are stale by the time a
session reads them even when nobody was careless. Two commands, the same shape as
the trio above:

```sh
gh pr view <n> --json state,mergedAt
git fetch origin && git rev-parse origin/main
```

Never `git worktree add -b <branch> <sha-from-the-prompt>` — derive the base
yourself, or you inherit the staleness into your branch point.

**And the same shelf life applies to a *committed file* describing the working
environment, which is where the two commands above stop reaching.** Reported by
a second session the same day: distrusting its prompt, it turned to notes a
prior pass had committed on that branch — and those notes asserted the same
wrong worktree count the prompt had. So "distrust the prompt, check the in-repo
notes instead" lands in the same wrong place *with more confidence*, because a
checked-in file reads as authoritative in a way a prompt does not, and because
you have already verified once and feel done.

A checked-in file describing the environment — a worktree count, who holds what,
which branch is current — is **a snapshot of when it was written, not a fact
about now**. It has a PR state's shelf life and none of its cues. `git worktree
list` and `git rev-parse origin/main` are still the answer; the discipline is to
run them *again* rather than to pick a better document.

That session's prompt carried four false claims, not three — the `/home/user/...`
path, "the worktree exists with `npm ci` already run" when it had been torn down
(so `git worktree list` showed nothing while `git branch -a` showed the surviving
remote branch), "four other worktrees exist" when there was one, and the stale
base above. The trio is at least a quartet, and the stale-base member is not
specific to any one prompt.

**The unifying shape, which is worth more than any of the cases: a claim that
produces no work when it holds is never exercised, so nothing distinguishes
"still true" from "quietly false".** That covers the carve-out above, an
environment note nobody re-derives, and a committed number nobody recomputes.
Where such a claim is load-bearing, give it a command that would fail — the way
`tests/node-version.test.ts` makes the five Node declarations disagree loudly
instead of drifting quietly.

**And check the prompt's carve-outs hardest, because they are the assertions you
are least likely to test.** The same prompt listed two stale documents and then
excluded a third: *"`docs/data-sources.md:204` reads similarly but is about
`check-stadium-photos` and is still true — leave it."* Grepping the workflows
before honouring that exclusion showed `.github/workflows/curated-data.yml` had
landed **that same morning** (`cd4e831`), running all four curated-data checkers
monthly — so the sentence was stale in three places rather than none, and one of
them sat directly above a paragraph the very same commit had added. **The commit
that makes a claim stale is frequently adjacent to it.** A carve-out is the one
class of claim that produces no work when it holds, which is precisely why it
gets waved through; grep the whole repository for the sentence rather than only
the lines you were pointed at.

None of this reaches whoever writes those prompts. A session authoring a
handoff uses the real path, so a prompt naming a directory that exists nowhere
in this checkout came from an external template or dispatcher that no session
here can edit. **Verifying is mitigation, not a fix — say so upward when a
prompt turns out to be wrong**, or the next session is handed the same trio.

**"Upward" means the user, and this was checked rather than assumed.** Asked on
2026-08-28 to tell the dispatcher directly, a session looked for an address and
found none: `ListAgents` returns sibling sessions only — all ten named
`portal-brasileirao-*`, none of them the thing that dispatches — and `.claude/`
holds `launch.json`, `skills/` and `worktrees/` with no dispatcher config to
edit. So there is nothing to reply to, and a session that goes hunting will
spend the time and reach the same conclusion. **This paragraph is the channel**:
it is committed, so it travels into every worktree and is read by the next
dispatched session, which is the only audience a fix here can actually reach.
Tell the user, add the case above, and move on.

**1. Commit explicit paths, and stage only what changed.**

Never `git add -A` — another session's work is probably in the tree. And when a
tool rewrites a directory (screenshot captures are the usual case), commit the
files whose bytes actually moved, not the directory. Committing the whole
directory from a stale base is what produces a diff that looks like a deliberate
revert of someone else's merged work.

**2. Push your own branch. That is the whole of what is yours.**

Your worktree, your branch, force-pushing your own branch, closing your own PR
and deleting your own merged branch (`-d`, never `-D`, so an unmerged one
refuses) need nobody's permission.

**`-d` will refuse a branch that is fully merged, and the message is
misleading twice over.** It says "not fully merged", which reads as *you are
about to lose work*; what it means is "not merged into whatever I compared
against", and there are two such comparisons.

It compares against the branch's **upstream** when one is set. If your branch
still tracks its own pushed copy and that copy is identical, `-d` succeeds
trivially — which is the common case and why this often just works. But
`delete_branch_on_merge` is **false** on this repository, so a merged branch
stays on the remote until somebody removes it; once someone does (the button on
the merged PR, or `git push origin --delete`) and you `fetch --prune`, the
upstream is gone.

**In practice somebody always does, and `git push origin --delete` then reports
your teardown as a failure.** Five for five on 2026-08-29: by the time a session
reached that command the remote branch was already gone, because whoever merges
presses the button. Git says

    error: unable to delete 'worktree-<name>': remote ref does not exist
    error: failed to push some refs to 'github.com:mpbarbosa/portal_brasileirao.git'

and exits **1**. Nothing is wrong — the branch is gone, which is what you asked
for — but the wording is *failed to push*, and in the usual
`remove && branch -d && push --delete` chain it aborts whatever you put after it
and reads as a teardown that did not finish.

Note the setting above is what makes this surprising rather than obvious: because
`delete_branch_on_merge` is false you expect the branch to survive the merge, so
the error looks like a real failure rather than a race you already won. **Check
the state, never the exit code**, and run it after `fetch --prune` so a stale
remote-tracking ref does not answer for the remote:

```sh
git fetch origin --prune
git branch -a --list '*<name>*'    # empty = local and remote both gone
```

Same shape as the `-d` message above and as the `2>&1`-in-a-command-substitution
trap under the backup scripts: **the exit status is answering a different
question than the one you are asking.**

**That trivial success is also why `-d` protects nothing while a PR is open**,
and this half is worth more than the half above it: the paragraph you just read
describes the *convenience*, and it is the same sentence. The comparison is
against the branch's own pushed copy, so it is satisfied by the act of **pushing**
rather than by the work **landing** — and a branch awaiting review is in precisely
that state. Reproduced in a throwaway repo on a branch that was not an ancestor of
`origin/main`:

    warning: deleting branch 'feature' that has been merged to
             'refs/remotes/origin/feature', but not yet merged to HEAD
    Deleted branch feature (was ab0e1df)

Exit **0** — a warning, not a refusal. It is the misleading-message family again
in the opposite direction: there the wording cries loss where there is none, here
it names the comparison it actually made and is read as a routine notice.
`worktree-check-before-destroy` was deleted this way on 2026-08-27 while PR #146
sat open and unmerged, and nothing was lost only because the commit was already
on the remote. So prefer `-d` to `-D` still — but **its success is not evidence
that a branch landed**. "The refusal is the safety feature", said below and in
`session-teardown`, holds only once the comparison has been pointed somewhere
worth comparing against: the recipe below does exactly that, and a branch left
tracking its own push has not.

With no upstream `-d` silently falls back to **HEAD** — in the shared root,
local `main`, which lags `origin/main` by however many merges landed while you
worked. That fallback refuses work that is demonstrably on `origin/main`.

Give the check the right comparison rather than switching it off:

```sh
git branch --set-upstream-to=origin/main <branch>
git branch -d <branch>
```

Git then deletes it and says so in as many words — *"merged to
`refs/remotes/origin/main`, but not yet merged to HEAD"*. **Do not reach for
`-D`**: the refusal is the safety feature, and this keeps it doing its job
against a ref that actually contains the commits. And **do not detach the root
checkout's HEAD to satisfy it** — that works, and it is the one thing the
worktree rule at the top of this file exists to prevent.

The independent check — and after the paragraph above it is the one to run
rather than an optional extra — is `git rev-list --count origin/main..<branch>`
= 0, in the **same turn** as the deletion. Note its sibling
`git merge-base --is-ancestor origin/<branch> origin/main` is a trap once the
remote branch is gone: an unresolvable ref exits **128**, and inside an
`&& … || …` that renders as a confident "not merged".

**3. Merge: propose, do not act.**

**No session merges into `main`.** Open the PR, verify it, and hand it to the
user or to the session that owns the work. This holds *especially* when the merge
is obviously fine — a rule that only binds in doubtful cases is not a rule. A
message from a peer saying "this is yours to merge" is a status report, not
consent: **a status message is not consent.**

When the user does authorise a merge, re-verify **at the instant**, not from a
snapshot:

```sh
git fetch origin
gh pr view <n> --json state,mergeable,statusCheckRollup
git log <base>..origin/main -- $(cat scripts/appearance-paths.txt)
```

The window between opening a PR and merging it is exactly when someone else's
appearance change lands. `mergeable=true` says nothing about whether your images
still depict HEAD. And the re-check is not only about races: **it stops you
reporting someone else's action as your own.** `merged_by` names the *account*,
which every session and the user share, so after the fact nobody can tell who
merged what. The instant before the command is the only moment that answer
exists.

**4. Deploy only through the pipeline.**

Never `scripts/deploy.sh` by hand: it builds from the **working tree**, not from
a git ref, so it ships whatever is uncommitted — and it rsyncs `package.json`, so
it can change the host's dependency set too. Merging to `main` deploys. Verify
with `/api/health`: the badge reports a run, and only the host reports what the
host is serving.

**The badge used to lie in one direction and no longer does**, which is worth
knowing because this file told you to distrust it for months. The advisory
`screenshots` job set the whole run to `failure` while `deploy` succeeded, and
that was misread as a stopped pipeline more than once. Measured over the 30
push-on-main runs before the fix: **17 concluded `failure`, all 17 for that job
alone, and all 17 had deployed** — every red push-on-main run in the window was
this and every one of them shipped. It now carries `continue-on-error`, so a red
run on `main` means the release genuinely did not ship. `/api/health` is still
the answer to *what is serving*; it is no longer the answer to *did anything ship
at all*.

**When a check tells you something alarming about someone else's work, run the
other form before saying it out loud.** `git diff A..B` is symmetric and reports
paths differing in *either* direction; `A...B` asks what B changed. Local `main`
lags `origin/main`. "Newer than" is not "descendant of". `+0/-0` on a binary says
nothing about whether it is new or modified. Every one of those produced a
confident, specific, wrong claim about another session in a single day. Two
commands is cheaper than the retraction.

**And when the claim is about a shared ref, state the anchor inside it.** The
four traps above are about running the *wrong* command; this one is about
running the right one too early. `main` moves every few minutes here, so an
ancestry answer has a shelf life — it can be true when you measure it and false
by the time a peer reads it. On 2026-08-27 a session told another that a branch
was "pushed but unmerged", anchored to its own merge `a6d2a38` (02:59:05); the
merge that landed that branch was `30c19bc` at **03:01:35**, two and a half
minutes later. Both sessions were right, about different instants:

```
066d8c9 ancestor of origin/main (5f6c124)   -> YES
066d8c9 ancestor of a6d2a38     (the anchor) -> NO
066d8c9 ancestor of main        (42c0ea9)    -> NO   # local main lags
```

So write *"not an ancestor of `a6d2a38`, my merge, as of 02:59"* rather than
*"unmerged"*. The bare form asserts a property of the branch; the anchored form
asserts what it actually is — a reading, taken somewhere, at a time — and lets
the receiver see the shelf life without re-deriving it. **The sender pays that
cost, because only the sender knows the anchor.** It is the same discipline
`/api/health` applies to a running build: report the commit you were built from,
not merely that you are up.

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
  The trap: `STICKY_CLUB`'s `left-12` must equal `STICKY_POSITION`'s `w-12`. Widen the
  position column alone and the two frozen columns overlap or gap — and only while
  scrolled, because ordinary table layout puts them adjacent either way. Three specs in
  `tests/e2e/standings.spec.ts` scroll a 380px viewport and check exactly these three
  things; nothing else would catch any of them.
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
- **A club's external links live in `ClubLinks`** once they have more than one
  call site. `WikipediaLink` owns the whole anchor — glyph, label, `target`,
  `rel` and the screen-reader suffix — because those last three are what drift
  when a link is copied: a second copy missing `rel="noopener"` is a real defect
  that looks identical on the page. `GLYPH` holds the shared mark attributes, so
  an icon defined in `ClubView` cannot drift from one defined there. The other
  three marks stay local to `ClubView` because they still have one call site
  each; that is the rule, not an inconsistency — the Wikipédia mark moved out the
  moment the match page became its second caller.
- **A match's status is `StatusChip`.** Both the fixture list and the match page used
  to carry their own copy of the label map *and* the colour map. Two copies of a lookup
  table is how a new status renders in one place and blank in the other.
  **Broadcaster marks are a plate, not a chip**, and deliberately so: a chip takes its
  container colour from the tonal system, and `--color-plate` must stay `#ffffff` in both
  themes or the marks that are dark artwork on transparent grounds vanish silently. Keep
  the `data-mark` attribute — nine specs select on it precisely so markup can change.
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

**Two targets.** The default boots `server.ts` through tsx with Vite in
middleware mode. `PLAYWRIGHT_TARGET=bundle` boots **`dist/server.cjs` under
`NODE_ENV=production`** instead — the branch the host actually runs, which
serves `dist/` through `express.static`, reads the shell once at boot and has
no Vite. Only `seo`, `page-meta` and `routing` run there, because those are the
specs reaching `registerSpaFallback` and `injectMeta`; the rest would re-assert
what the Vite run already proved. `npm run test:e2e:bundle` builds and runs it.
**`server.ts` refuses to start with `ACCOUNTS_DEV_LOGIN` set when `NODE_ENV` is
production**, so the config empties that variable in bundle mode rather than
omitting it — an inherited value would otherwise take the whole run down.

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
- **`page.route` fulfilment completes Playwright's own request accounting, so a stub
  cannot reproduce a failure whose nature is that the accounting never completes.**
  `useAccount` returned on a 404 without reading the response body; Chromium held the
  stream open, the request never reached `finished`, and `waitUntil: "networkidle"`
  therefore never resolved — which broke every `screenshot.ts` capture while the page
  itself rendered perfectly. The obvious guard is to stub that 404 with `page.route` and
  assert the page reaches idle. It was written, run against the **known-broken** code,
  and **passed**: Playwright settles what it fulfils. A test that passes against the bug
  it names is worse than no test, because it converts an open question into a false
  answer — the next reader sees green and stops. It was deleted; the reasoning lives in
  `src/useAccount.ts` where the next person will meet it. Where a stub cannot reach,
  measure the real thing: `requestfinished` against a real server is what settled this.
- **The harness does not merely miss some configurations — it configures the app out of
  them.** `env` in `playwright.config.ts` sets `DISABLE_FOOTBALL_DATA: "true"` *and*
  `ACCOUNTS_DEV_LOGIN: "true"`. That second one is why nothing caught the bug above:
  with dev login on, `/api/account/me` answers 200 and the body is consumed by
  `response.json()` on the way past, so the suite never takes the 404 branch at all —
  and the 404 branch is **production's** shape, and every fresh clone's. A green suite
  says the app works in a configuration nothing ships. Before trusting coverage of
  anything touching accounts or the provider, check which side of that `env` block the
  code under test falls on.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull request,
in two parallel jobs:

- **check** — `tsc --noEmit`, unit tests, build, then boots `dist/server.cjs` and
  smoke-tests it, then shellchecks the deploy scripts and **runs the four
  rehearsals**. The boot step is the one that catches a runtime
  dependency stranded in `devDependencies`; the rehearsals are the only thing
  that catches a script which no longer does what it says. The two host-script
  ones gate the deploy because `shell_scripts/` is packaged into the payload by
  this same job, a few steps later — so the bytes that ship have been exercised,
  not just read.
  They run on `.nvmrc`'s Node rather than a developer's, which is the whole
  point: the first bug this placement found was invisible on a newer major.
  **Count the `run:` lines rather than this sentence** — it said "both" through
  the third and the fourth, which is the failure the eighteen-captures paragraph
  below records about a number written in prose.
- **e2e** — Playwright, with the browser cached on the exact `@playwright/test`
  version. A version bump needs a matching browser build, so the cache key must
  include it or the run fails with "Executable doesn't exist".

A third job, **screenshots**, checks that `docs/screenshots` still depicts the app. It is
advisory — never in `deploy`'s `needs`, for the reason the workflow gives — and it asks two
questions rather than one. First, are the appearance sources at the commit the images
*depict* identical to HEAD's? That is a content comparison, and it replaced an ancestry
test that went red for merges which changed nothing on main. Second, for whatever genuinely
differs, is every commit accounted for?

**Which commit the images depict is not the commit that stored them.** The anchor is the
sha inside `docs/screenshots/CAPTURED`, falling back to `git log -1 -- docs/screenshots`
only when that cannot be read. The two differ exactly when a capture is taken, main moves
underneath it, and the images are committed after: the image commit's *tree* then carries
an appearance change the photographs do not show, and the weaker anchor calls that current.
CAPTURED is trusted the way the trailer below is — a person's assertion standing in a diff,
not something the check can verify.

**An appearance path can move without a pixel moving.** A rule that is never in effect
during a paint, a selector nothing matches, a comment: the edit is real and the render is
identical. `docs/screenshots/CAPTURED` records which commit the images depict, so a refresh
always leaves something to commit — that is the mechanical answer and it is the right one
wherever it applies. But it still charges **eighteen** captures from a live-data
production build to certify that nothing changed, and records no reason.

**`src/data` is a watched path, and it is the one on the list that reports too
much.** The other four are markup and CSS; this one is data that gets *merged
into what production serves* — broadcaster marks onto four captured pages, a
stadium's name and photograph onto the estádio page, a curated player name onto
Jogadores. So an edit there moves a captured pixel with nothing in
`src/components`, `src/index.css`, `src/App.tsx` or `index.html` having changed,
and before it was added the gate could not see that at all. It was found by
asking whether #221 owed a refresh: it edits `src/data/player-overrides.ts`, the
gate said nothing, and only reading the data *diff* established that the one new
entry is a nationality — which renders on the player card, and no capture opens
one.

**The cost, which is real and was accepted rather than missed: the seed snapshot
cannot move a capture and is watched anyway.** `matches.ts`, `clubs.ts`,
`squads.ts`, `rank-history.ts` and `scorers.ts` are the offline fallback, and
every capture is taken from **production**, which serves live provider data — so
a `sync-seed-data` run reddens the gate for something structurally incapable of
changing an image. A `Screenshots-unaffected:` trailer is the answer, and that is
the mechanism working rather than a workaround for it. A path list cannot
separate `matches.ts` from `broadcasts.ts`, and between a gate that reports too
much and one that reports nothing, this is the direction to fail in.
`tests/check-screenshots.test.ts` holds both halves — one test that a curated
edit is caught, one that a seed sync is listed and cleared by a trailer. The
second replaced a test asserting the opposite, whose reasoning was correct about
the seed and wrong about the file it generalised from.

**Count the directory rather than this paragraph.** It said sixteen for as long as there
were sixteen, and `partida-554977-{light,dark}` made it eighteen without anything here
noticing. A number in prose has no gate on it.

**Four of the eighteen can no longer come back byte-identical, and this paragraph twice
said fewer than the truth.** They vary for two unrelated reasons, on two different clocks:

- **The desktop Classificação pair, per deploy.** `fullPage` is `!mobile && route === "/"`,
  so it photographs the whole page — including the **Rodapé**, whose Saúde do serviço
  prints `Versão`, `Compilado` and `No ar desde`. All three move on every deploy.
  `bb223e2` is where that started, and `0719e73 Re-shoot at bb7a2ec: sixteen captures,
  zero pixels moved` is an outcome that can no longer occur.
- **The Ao vivo pair, per minute.** `countdownLabel` prints "Começa em 20h37" against a
  live fixture list, so the label is different every time the page is drawn. This was
  found by two sessions refreshing the set within a minute of each other: 16 of their 18
  images were byte-identical and the two Ao vivo ones were not. The difference is three
  bands 14px tall in a column 10px wide — the minute digits of the three nearest kickoffs,
  and nothing else on the page. Fixtures more than a day out read "Começa em 1 dia" and do
  not move, which is why the band is three rows and not six.

Both are the same lesson at different speeds, and the Ao vivo one is the sharper: the
Classificação pair moves only when something shipped, while Ao vivo moves while you are
looking at it. **Two refreshes of one build are expected to disagree on those four
images.** Disagreeing on any of the other fourteen is a real difference and worth reading.

Nothing automated is affected — `check-screenshots.sh` compares appearance *sources*
between CAPTURED's sha and HEAD and never compares image bytes. What is lost is a **human**
signal: "classificacao-light.png changed" used to mean the table looks different, and now
means a deploy happened, on the two most information-dense images in the set. Accepted
rather than fixed, because the alternatives all give up something real — the rodapé is in
that frame deliberately, and the README alt text describes it. Where an edit *provably* cannot reach a paint, say so instead:

```
Screenshots-unaffected: <why no rendered pixel can change>
Screenshots-unaffected: <sha>: <why>   # for a commit already on main
```

The reason is required, and is printed on every run, green or red — a claim nobody reads is
the thing this replaced. Nothing verifies it. **"It looks the same to me" is a refresh, not
a trailer**; reach for it only when the edit cannot reach a paint at all.

**A trailer used to be unable to survive its own merge, which halved what this
paragraph promised.** The gate enumerated merge commits alongside the topic commits they
land, and a merge made from the GitHub button has nowhere to carry a trailer — so it
credited the claim, printed the reason, then flagged the identical edit again under the
merge sha. #205, #202 and #217 all hit it, and the effect was that a trailer *deferred* a
re-shoot rather than removing it. Fixed: a merge whose **combined** diff over the
appearance paths is empty introduced nothing of its own and is skipped, `git show --cc`
being git's own statement of that. An **evil merge** — a conflict resolved by hand into an
appearance path — is exactly what `--cc` does print, so it stays enumerated and still owes
a trailer or a capture. That is why the fix is not `--no-merges`, which is simpler and
blinds the gate to the one merge that can genuinely change a pixel.

**The defect lived in a script everybody had read, through three pull requests**, which is
the argument for `scripts/rehearse-screenshot-gate.sh` rather than a fourth careful
reading. It builds nine throwaway repositories — a plain change, a trailer on a direct
commit, the same trailer landed by a merge, an untrailered change landed by a merge, an
evil merge, a catch-up merge, an empty trailer, the retroactive `<sha>:` form — and asserts
the gate's exit status on each. It is hermetic (git and bash, no network) and `check` runs
it. **Its own first draft passed against the unfixed gate**, because the fixture merged a
branch into a main that had not moved: git's history simplification then never lists the
merge at all, so there was nothing for the gate to get wrong. The defect needs a merge
differing from *both* parents, which is what a shared checkout produces daily and a lone
branch never does.

**It must sit in the message's *last* paragraph, beside `Co-Authored-By:`.** Git parses
trailers out of the final paragraph only, so one separated from that block by a blank line
is not a trailer at all — `git interpret-trailers --parse` prints only the co-author, the
gate honours nothing, and the commit is listed as owing a capture. Nothing says so: the
message reads correctly to a person, the wording is exactly what the gate documents, and
the claim is silently dropped. It happened on `6a876d9`. Check with:

```sh
git log -1 --format=%B <sha> | git interpret-trailers --parse
```

Wrapping across lines is fine — the script unfolds it. It is the blank line that kills it.

**It has to be a real git trailer, and a malformed one is dropped in silence.**
This is the failure mode to know, because it is invisible from both ends: the check
collects trailers with `%(trailers:key=Screenshots-unaffected,...)`, and git parses
trailers **only in the commit message's last paragraph**. A trailer git does not parse
is never collected, and since the run only prints trailers it *has* collected, nothing
anywhere says the claim was ignored. The gate simply reports the commit as
unaccounted, which reads as "nobody wrote one".

Two shapes break it independently, and M6's `c842640` had both — its trailer never
once reached the check, and #172's refresh went red on the next run because of it:

```
Screenshots-unaffected: a reason that wraps onto
a second line with no indent.                    <- DROPPED: unindented continuation

Screenshots-unaffected: a reason, then a blank line.

Co-Authored-By: …                                <- DROPPED: not the last paragraph
```

Both forms below parse, verified in a throwaway repo rather than reasoned out — a
continuation indented by any whitespace folds, and the trailer may sit *beside*
`Co-Authored-By:` so long as no blank line separates them:

```
Screenshots-unaffected: a reason that wraps onto
  a second line, indented.
Co-Authored-By: …
```

Check it rather than trusting the shape, in the commit you are about to push:

```sh
git log -1 --format='%(trailers:key=Screenshots-unaffected,valueonly,unfold)'
```

Empty output means the claim does not exist as far as the gate is concerned. The
retroactive `<sha>:` form is the fix once the commit is on main and cannot be amended.

**A capture waits for the page to stop moving, and that is not a nicety.**
Playwright's `click` moves the pointer to the element and leaves it there, so the
Jogadores shot — the one capture that clicks anything — sat on the club summary
with `STATE_LAYER`'s 8% veil fading in over 200ms, and photographed an arbitrary
point in that fade. Measured at alpha 0.008 against a settled 0.08. Two
consequences, and the second is the one that matters: the image was **not
reproducible** (three captures of one build against one payload all differed
across the summary row, so every re-shoot committed that band as noise), and it
documented the page **as it looks with a cursor resting on it**, which is not
what a reader sees. `settle` now parks the pointer at `(0, 0)` — the bare sticky
header, which carries no state layer — and awaits every running transition.

**It awaits `CSSTransition` only, never everything `getAnimations()` returns.**
`animate-pulse` on the Ao vivo live indicator is a `CSSAnimation` with infinite
iterations whose `finished` promise never resolves; awaiting it hangs the capture
for the full timeout on exactly the page where a live match is the thing worth
photographing. Verified both ways — awaiting all animations hung, the filtered
form settled in 2ms.

`scripts/screenshot.ts` deliberately does **not** honour the trailer. It refuses a capture
whose build differs from HEAD on any appearance path, which stays a plain file comparison —
its refusal writes to `docs/screenshots/local` and self-clears on the next deploy, so it is
a nuisance where the gate was a deadlock.

**The weekly broadcast sync opens a pull request; it does not push to `main`.**
`sync-broadcasts.yml` commits the refreshed `broadcasts.ts` to
`automation/sync-broadcasts` and opens a pull request from it, adding to the
open one rather than replacing it when a previous week's is still waiting — the
sync merges across the window it is asked about, so restarting from `main` each
week would drop whatever had aged out of that window.

**That pull request arrives with no checks on it, and that is the token rather
than a fault.** GitHub starts no workflow run for an event raised with the
repository's own `GITHUB_TOKEN`, so neither the push nor the pull request
triggers `ci.yml`. The gate is inside the sync's own run instead: it lints and
unit-tests the written file and fails the job rather than committing. Two things
follow — an empty commit from a person is what gets the full suite to run on it,
and **branch protection requiring `check` and `e2e` would make it permanently
unmergeable** without an exemption or a different token. `docs/cicd-plan.md`
gaps E and F carry that coupling.

`scripts/rehearse-broadcast-sync-pr.sh` is that workflow's only behavioural
coverage and `check` runs it, beside the two host-script rehearsals. It matters
more than the shellcheck it sits next to: the workflow is **scheduled**, so no
pull request can exercise it, and a green tick on a change to that file says
only that the other workflows still pass. It extracts the steps from the shipped
YAML rather than holding a copy — and refuses loudly when it cannot find them,
because a rehearsal that quietly tests nothing reports as a broken workflow
rather than as a broken rehearsal.

**Dependabot keeps the pins current**, weekly on Monday, for `github-actions`
and `npm` (`.github/dependabot.yml`). Actions are grouped into one pull request;
npm's minor and patch updates are grouped while a **major arrives on its own**,
because `express`, `vite` or `react` crossing a major is a change to read rather
than one to approve. Monday rather than Tuesday, because `sync-broadcasts`
already runs Tuesday and two automated pushes on one morning is how the second
gets merged unread beside the first.

It exists because the manual alternative was measured: a node20 deprecation
warning on the deploy of `35a7074` cost a survey of six actions across three
workflows, two release-note readings, a PR, a merge and a deploy — all of which
Dependabot would have pre-empted. Note the rule below is what makes it work
without further configuration: a Dependabot pull request gets a read-only token
and no secrets, and since CI needs neither, it sees the same signal as any other.

**CI needs no secrets.** Both jobs run against the frozen snapshot with no token,
so a red build always means the code broke — never that the upstream had a bad
minute or the free-tier budget ran out. Keep it that way: do not add
`FOOTBALL_DATA_TOKEN` as a repository secret to "test the live path". If the live
mapping needs coverage, add a unit test with a captured payload.

## The deploy pipeline

`main` deploys itself. A push to `main` that passes `check` and `e2e` runs the
`deploy` job, and about four minutes after a merge the new commit is serving.

**There are no long-lived AWS credentials and no inbound SSH.** The job mints an
OIDC token, assumes `portal-brasileirao-deploy`, writes the payload to S3 and
drives the host over SSM — so the security group stays pinned to the maintainer's
address and GitHub holds no key that outlives the run.

```
push to main ──▶ check ──▶ build ──▶ boot the bundle, smoke-test 3 endpoints
                   │                      │
                   │                      └─▶ tar ──▶ artifact + sha256 ──┐
                 e2e                                                      │
                   │                                                      ▼
                   └──────────────────────▶ deploy ──▶ assert sha256 == check's
                                              ├─▶ OIDC ──▶ sts:AssumeRoleWithWebIdentity
                                              ├─▶ s3://…/releases/<sha>.tar.gz
                                              ├─▶ ancestry guard vs live /api/health
                                              ├─▶ ssm send-command ──▶ host
                                              │     07_install_release.sh  (retain previous/,
                                              │                             rsync into place)
                                              │     06_redeploy.sh         (npm ci --omit=dev,
                                              │                             restart, health,
                                              │                             flip back if unhealthy)
                                              └─▶ assert <sha> at /api/health
```

**The payload is built once and promoted, never rebuilt.** `check` builds it,
boots it, smoke-tests three endpoints, then packages *that* `dist/` and uploads
it with its sha256; `deploy` downloads it and refuses to continue unless the
digest still matches. `deploy` therefore runs no `npm ci` and no build at all.
Before this the two jobs each built their own payload, so the bytes that reached
production were never the bytes anything had tested — only a second build of the
same commit. They agreed in practice, and "in practice" was doing the work that
build-once-promote does structurally. Note `check` packages only on a run that
can deploy: a `pull_request` run builds and smoke-tests identically, but its HEAD
is the synthetic merge ref rather than a commit that will ever ship.

**The release is self-describing, and that is what makes the last step mean
something.** `scripts/build.sh` stamps the commit and the build time into the
bundle at esbuild time, so `/api/health` reports the commit it was built from
whatever host it lands on. The workflow compares that against the sha it just
built — strictly stronger than an uptime heuristic, which a fast restart of the
*previous* bundle would also satisfy.

**Releases are recorded as GitHub Deployments**, because `deploy` declares
`environment: production`. That gives a per-environment history — what shipped,
when, from which run — which the Actions list cannot: runs are grouped by
workflow, and the one that deployed is indistinguishable from the four hundred
that did not. Defect 1 in `docs/cicd-plan.md` was reconstructed by hand from run
timestamps for exactly that reason.

Two things follow. **No protection rule exists on that environment and adding one
is a decision, not a tidy-up** — a required reviewer would make every deploy wait
for a human, the reconciler's unattended ones included. And **`rollback.yml` does
not declare it**, so the record is one of forward releases only and names the
wrong sha as live after a rollback; that is deliberate, because the same job also
serves the list-only mode, which changes nothing on the host and must not appear
as a deployment. `docs/cicd-plan.md` gap B has what closing it would cost.

**Every release that reaches production is tagged** `deploy-YYYYMMDD-HHMMSS-<sha7>`
by the `tag` job. `needs: deploy` is the invariant — the tag exists if and only if
the install happened and the live site answered with that commit — so the tag list
is the record of what has actually shipped. It is a **separate job** because it
needs `contents: write` and `deploy` holds the OIDC token and the payload, and it
is `continue-on-error` because a bookkeeping failure must not report a good
release as failed; per the entry above, that still leaves a red check row.

**Those tags are a release inventory that costs no AWS permission**, which matters
because the other one may not be readable: dispatched with an empty sha on
2026-08-27, `rollback.yml`'s list-only mode answered `AccessDenied` naming
`s3:ListBucket`. That is an observation of the role on that date, not a standing
property — IAM has been edited since, for the trust policy the Deployments record
needed — so re-dispatch it rather than believing this sentence. `git tag` needs no
such permission and cannot answer differently tomorrow. Two things it does not
tell you: a tag says a release **was** published, not that its
S3 object survives — nothing defines a lifecycle policy on `releases/` — and tags
begin at the commit that added the job, so older releases have none. **`rollback.yml` takes a
tag directly** — it resolves a `deploy-*` tag, a branch or an abbreviation to the
full sha the S3 key needs, and refuses only what is neither a commit nor a ref. It
does that by writing the resolved value to `$GITHUB_ENV`, which **overrides the
job-level `env:`** the three later steps read; that precedence was produced by a
throwaway workflow rather than assumed, because it is the entire reason the change
touches one step instead of four.

**A failed release flips back to the previous one, and the pipeline still goes
red.** `07_install_release.sh` copies the release already on disk into
`$DEPLOY_DIR/previous/` before the rsync destroys it, and hands
`06_redeploy.sh` the path in `ROLLBACK_FROM`. If the new payload will not
install, will not restart, or never reports healthy, `06` restores that
directory, reinstalls and restarts, and exits **2** — the previous build serving,
the workflow red. If the flip-back *itself* fails it exits **3** and says
`CRITICAL`, because "the deploy failed" and "the site is down" need different
responses. Before this, `rsync -a --delete` destroyed the previous build first,
so a bad release left systemd restart-looping every five seconds against nothing.

Four things about it are deliberate, and three are load-bearing:

- **`package.json` and `package-lock.json` are retained with `dist/`.** `npm ci
  --omit=dev` prunes, so a release that drops a dependency deletes modules the
  release before it needs. Restoring `dist/` alone would flip back to a build
  whose `node_modules` had just been removed — failing on exactly the change
  most likely to need a rollback.
- **The retained copy is staged as `previous.incoming/` and renamed into place.**
  `06` decides a target is usable by checking three files exist; a half-copied
  directory that passes is how a recoverable bad release becomes unrecoverable.
- **Flip-back is opt-in and only `07` opts in.** A standalone `06` — the operator
  redeploying after an `.env` change, which is what it is documented for — leaves
  `ROLLBACK_FROM` unset and behaves as it always did. `previous/` merely existing
  must not swap the build underneath someone.
- **A failed retention stops the deploy** rather than proceeding without a way
  back. The usual cause is a full disk, which is what makes the `npm ci` fail
  moments later anyway.

**`scripts/rehearse-flip-back.sh` is the only behavioural coverage these two
scripts have.** `npm run lint` is TypeScript and cannot see shell; CI only
shellchecks them. It drives all eight branches against a stubbed `systemctl`,
`sudo`, `npm` and `journalctl`, with a real HTTP server for the health endpoint
so the real `curl -sf` runs. **CI runs it on every push and pull request**, in
`check`, so a broken flip-back cannot reach the host — which matters because the
two travel *inside the release tarball*, so a broken one ships with the release
that carries it and the host runs it immediately.

That is deliberately the opposite of `check-hymns`, and the distinction is the
one worth carrying: `check-hymns` stays manual because it depends on a third
party, so a red build would mean somebody else's server had a bad minute. Every
rehearsal is hermetic — bash, python3, rsync, curl, node, gzip, git, no network,
no AWS, no token — so a red build here always means *this commit* broke
something. Hermetic is the test, not "is it a rehearsal a person reads".

One trap it caught, worth keeping: **`rsync -a`'s quick-check compares size and
mtime, not bytes.** Two fixture releases differing only in a sha, written in the
same second, were silently not installed at all — and the case still passed,
because both were healthy.

**A release must be a descendant of what is live.** `concurrency: deploy-production`
serialises releases but does **not** order them, and on 2026-08-26 a queue that
drained after an Actions incident installed `cbf98f7` and then `8d95b17`, which is
its parent — production moved backwards, and every check this pipeline had
*passed*. That is the part worth understanding: "Verify the live site is this
commit" asks whether the live commit is the one this run built, and it was.
Nothing asked whether it was newer than what it replaced. The `deploy` job now
reads the running `/api/health` immediately before installing and refuses a commit
that is an ancestor of it, naming how many commits the install would undo.

Three things about that guard are deliberate. It checks out with **`fetch-depth: 0`**,
because a depth-1 clone holds neither the live commit nor the history connecting
it to this one, and a guard that cannot answer protects nothing. It sits **after**
the S3 publish, so the window between reading the live commit and replacing it is
as narrow as possible — the orphaned object is keyed by sha and a rollback will
want it there anyway. And it fails **open** on an unreachable site, a health
payload with no usable sha, or a commit this checkout does not have: during an
outage the ability to deploy is worth more than the ordering this protects, and a
site that is down cannot tell you what it is running. Override it for a deliberate
rollback by dispatching the workflow with `allow_non_descendant=true`.

**`deploy` runs for any run *for* `main`, not only a push-triggered one.** The
event gate it used to carry made `workflow_dispatch` useless in precisely the
window it was needed: with push events being dropped in that same incident there
was no way to carry a merged commit to the host, and `6325fa5`, `e065a8d` and
`8fa12e5` are empty commits that exist only to emit a push event. It is also what
makes the guard testable at all — `main` only moves forward, so no push can ever
present an ancestor to refuse.

**A push that never becomes a deploy is reconciled, not noticed by hand.**
`.github/workflows/reconcile.yml` compares `main` against the sha at
`/api/health` every 15 minutes and dispatches `ci.yml` when production is behind.
Two things defeat the push path, both observed: a **dropped push event** (during
the 2026-08-26 Actions incident no run was ever created for `18e2014` or
`321fdcd`), and a **run cancelled before it started** — the workflow concurrency
group keeps at most one *pending* run per branch, so three merges inside a minute
cancel the middle one, which is what eight of thirty push-on-`main` runs did.
Neither looks broken, because the content still ships inside the next successful
run; the failure is when the **last** push of a burst is the cancelled one, and
then `main` sits ahead of production with nothing red to say so. `6325fa5`,
`e065a8d` and `8fa12e5` are empty commits that exist only to have emitted a push
event, which is the symptom this removes.

**The diagnostic that follows from this, because the obvious check answers wrong:
there is no successful run for your merge commit, and that is not evidence it did
not ship.** A cancelled run leaves the sha with no green run and
`/api/health` never reports it, while the content goes out perfectly inside the
*next* release. Observed on 2026-08-29: `54e4105` (#185) has one push run,
`completed/cancelled`, and no successful run at any point — and it shipped inside
`a469cf0`, which production was serving. From the run list alone,
**cancelled-and-carried is indistinguishable from cancelled-and-dropped**, and
only one of those needs anybody to do anything.

Ask ancestry against what is live, not whether your own sha has a green tick:

```sh
live=$(curl -sf "$APP_URL/api/health" | sed -n 's/.*"sha":"\([^"]*\)".*/\1/p')
git fetch origin && git merge-base --is-ancestor <your-merge-sha> "$live" \
  && echo "shipped, carried by a later release"
```

The same reading runs backwards, and it is the more common confusion: `/api/health`
reporting a sha that is *not* yours does not mean your change is missing. It means
a later release carried it. The sha names the build, not the changes in it.

One trap while checking, and it is the `git log` ordering trap in another costume:
**a merge commit's timestamp is not its merge order** as you remember it, so do not
reason from "that one looks older". It caught a wrong assumption here, where
`a469cf0` (00:37:14Z) was assumed to predate `54e4105` (00:35:40Z) and does not.

**Run the ancestry test in both directions always — not "if the answer surprises
you".** That conditional was the first spelling of this paragraph and it is wrong,
for a reason worth more than the case that produced it: **a one-directional check
is structurally incapable of contradicting you.** `is-ancestor A B` returning true
is the answer you expected *and* the answer you get when your ordering is backwards
and you asked the wrong pair — from one side the two are identical, so surprise
never arrives to trigger the second command. The near-miss above was not caught by
being careful; it was caught by running the direction that could **falsify** the
belief. Ask `is-ancestor B A` too and require it to come back false.

That is the same shape as the carve-out rule under *check the prompt that sent
you*, and as a committed number nobody recomputes: **a check that produces no work
when it holds is never exercised.** The general form, since it now has three
instances in this file — a test whose only reachable outcome is agreement is not a
test. Where the answer matters, spend the second command on the branch that could
prove you wrong.

It **decides**; `ci.yml` deploys. A reconciled release is dispatched as an
ordinary run, so it passes the same `check`, `e2e`, ancestry guard and
live-commit assertion — a second copy of the deploy logic is how the scheduled
path comes to differ from the pushed one.

**Its bias is the opposite of the guard's, deliberately.** The guard fails
**open** because it judges a release a person asked for, and in an outage
deploying matters more than ordering. The reconciler fails **safe** because it
starts a release nobody asked for, unattended: an unreachable site, an unusable
live sha, a commit it cannot resolve, a divergent history, or a CI run already in
flight all mean it does nothing and says why. A site that is down is an incident,
not a gap to close. Note the schedule is a safety net rather than a guarantee —
GitHub delays scheduled runs under exactly the load that drops push events, and
disables them after 60 days of repository inactivity.

**Rolling back is `.github/workflows/rollback.yml`, and it does not go through
`ci.yml`.** It installs a release S3 already holds, over whatever is live, in
about forty seconds and with no build — because those bytes were built, booted
and smoke-tested by `check` when they were made, and rebuilding them to roll
back would re-test them with a *newer* toolchain, which is the one thing you do
not want when the point is known-good bytes. It carries no ancestry guard for
the same reason the deploy does: going backwards is the purpose here and the
accident there. It shares the `deploy-production` concurrency group, so a
rollback and a release can never install at once. Dispatching it with an **empty
sha lists what the bucket holds and changes nothing** — which is also how you
find out what the bucket's lifecycle policy has left you, since nothing in this
repository defines one.

**A rollback pauses reconciliation, and nothing has to remember that it did.**
After a rollback production is behind `main`, which is precisely the shape
`reconcile.yml` exists to close — so without this it would dispatch `ci.yml` and
undo the rollback within fifteen minutes, while someone was still working out
what broke. The reconciler now holds whenever a successful `rollback.yml` run is
newer than the last successful `ci.yml` run on `main`. The test is **stateless**:
no flag is set, so none can be left set, and it clears itself the moment a fix
reaches `main` and deploys.

**The host is too small to build on.** It receives a prebuilt payload and runs
`npm ci --omit=dev`; nothing compiles there. That is also why a runtime dependency
stranded in `devDependencies` stays invisible until the bundle boots, which is the
failure `check`'s boot step exists to catch.

**`shell_scripts/` travels inside the tarball**, so the host always runs the deploy
logic matching the release it just received rather than whatever was left there by
the last one.

**The OIDC trap, because it fails in a way that reads as a permissions problem.**
This account issues the *immutable* form of the `sub` claim — it embeds the numeric
owner and repo ids (`repo:owner@<id>/repo@<id>:ref:…`), not the documented
`repo:owner/repo:ref:…` shape, so a trust policy written against the documented
form silently never matches. If role assumption starts failing with "Not authorized
to perform sts:AssumeRoleWithWebIdentity", print the claim before touching anything
else.

**A second thing reshapes that claim, and it is not in AWS at all.** Attaching a
job to a GitHub `environment:` rewrites the subject from `…:ref:refs/heads/main`
to `…:environment:<name>`. #151 added `environment: production` to `deploy` while
the trust policy pinned the ref form alone with `StringEquals`, and every release
then died at credential configuration with that same "Not authorized" message:
three merges failed and production sat ten commits behind. **Nothing in the
workflow looked wrong**, because the job itself was untouched — the change was
three lines declaring a record-keeping feature, and its own comment said in good
faith that behaviour was unchanged. #156 reverted it; #159 relanded it once the
policy accepted both subjects.

So the rule is wider than the paragraph above: **anything that could reshape the
claim is an IAM change first and a workflow change second.** Renaming the
environment does it too.

**Both subject forms are load-bearing, so never narrow the policy to one.**
`rollback.yml` and `flip-back-drill.yml` carry no environment and keep sending the
ref form; a policy holding only `…:environment:production` would leave production
deployable and **unrecoverable**, which is the worst of the available states.

**And read the claim rather than deriving it** —
`.github/workflows/oidc-subject-probe.yml` prints what the token actually carries.
Both subjects in the policy were read from it rather than reasoned out, which is
the same discipline `/api/health` applies to a running build.

`scripts/deploy.sh` is the workstation path — rsync over SSH — and ends in the same
`06_redeploy.sh`, so both routes converge and only the transport differs. It builds
from the **working tree** rather than from a git ref, which is why **Working
alongside other sessions** above says never to run it by hand.

What is still missing from this pipeline, and the phased plan for closing it, is
`docs/cicd-plan.md`.

### One Node major, named in five places

`.nvmrc` holds it. `package.json`'s `engines`, the `@types/node` devDependency,
`REQUIRED_NODE_MAJOR` in `shell_scripts/01_setup_app_directory.sh` and both
workflows' `node-version-file` all have to agree with it, and
`tests/node-version.test.ts` fails when they do not.

**The trap this closes is quiet by construction.** `tsconfig.json` sets
`types: ["node"]`, which makes `@types/node` the *entire* ambient type surface,
and `tsc --noEmit` is this repo's only lint gate. So the typings decide what the
gate certifies while the host decides what actually runs, and when those are
different majors the gate certifies code the host cannot execute — without a red
build anywhere. #91 took the typings 22 → 26 and went green; afterwards
`import { connect } from "node:quic"` type-checked clean while
`node -e "require('node:quic')"` threw `ERR_UNKNOWN_BUILTIN_MODULE`.

**Do not close that by raising the runtime instead.** `node:ffi`, `node:quic`,
`node:stream/iter` and `node:zlib/iter` are absent from Node **26** as well,
experimental flags included, and `node:vfs` needs `--experimental-vfs`. These
typings describe DefinitelyTyped's surface, which includes APIs no released Node
exposes at all — there is no version to catch up to, so the typings track the
runtime and not the other way round. `.github/dependabot.yml` therefore ignores
the **major** for `@types/node` only; minor and patch within the line still
arrive normally.

Moving Node is consequently a deliberate five-file commit starting at `.nvmrc`,
which is the point — before this, four of the five were literals that could each
move alone.

**The host floor is an exact major, not a floor**, for the same reason: a host
one major *older* than the typings is running unchecked code just as surely as
one newer. That script is one-time provisioning and is not run by `deploy.sh`,
so tightening it cannot break an existing deploy.

`/api/health` reports `node` — `process.versions.node`, what the host is
**actually** running, as against what the five files say it is supposed to be.
Nothing renders it: `parseHealth` in `health-core.ts` builds its result field by
field, so the extra key is dropped and the **Rodapé** is unchanged. It is a
diagnostic, and deliberately not a line in the footer — a Node version is
nothing to a reader of a football table, and the rodapé sits in two committed
full-page captures.

One TypeScript note that is part of the same hole rather than a separate tidy:
`noUncheckedSideEffectImports` is on because without it a **bare** side-effect
import (`import "node:quic";`) resolves nothing and reports **no error at all**,
whichever `@types/node` is pinned. Pinning the typings does not close that; the
flag does.

## Not built yet

*(Nothing outstanding — deploys are automated; see below.)*

### TLS

Certbot holds the certificate for `brasileirao.mpbarbosa.com` and rewrote the nginx site in
place to add the 443 listener and the HTTP→HTTPS redirect. `certbot.timer` runs twice daily
and `certbot renew --dry-run` passes, so renewal is unattended.

Because certbot owns that file, **re-running `04_setup_nginx.sh` overwrites its edits** and
drops the site back to plain HTTP. That is recoverable — re-run `05_setup_tls.sh` — but the
site serves HTTP in between, so do not run `04` casually on a host that already has TLS.

The live provider path is verified: with a real token the app renders the current Série A
table from football-data.org. Verified against a live payload, v4 reports scores as
`fullTime.home`/`away`.

**Every one of those paths has now run against the real host**, and this paragraph
used to say the opposite long after it stopped being true — which is worth knowing
about a file whose whole claim is that it describes what the code does. `06` and
`07` execute on every release, and the rsync semantics, including that the remote
`.env` survives, are exercised rather than reasoned about. What actually runs is
**The deploy pipeline** above.

One known data mismatch: upstream club codes are not always the local seed codes — São
Paulo is `PAU` upstream, not `SAO`, and the real 2026 division includes clubs absent from
`src/data/clubs.ts`. This is why `/api/matches` ships the clubs it saw; do not reintroduce
a dependency on the seed codes for name resolution.
