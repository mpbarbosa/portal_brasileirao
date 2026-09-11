# End-to-End Test Guide

Adapted for Portal Brasileirão from `doc_template_lib/code_quality/E2E_TEST_GUIDE.md`.

## Goal

Drive the real assembled app in a browser and assert what a reader can see. Every
spec under `tests/e2e/` boots the real server. Count the directory rather than
trusting a number here: this guide said 40 while there were 41.

```sh
npm run test:e2e                       # the Vite/tsx target
npm run test:e2e:bundle                # build, then dist/server.cjs under NODE_ENV=production
E2E_PORT=3101 npm run test:e2e         # alongside another worktree's run
```

## Where this suite departs from the generic rules, and why

Two of the source guide's gates are **deliberately not met**, and knowing which
is more useful than the rules that are.

### The suite runs against a frozen snapshot, not live data

`playwright.config.ts` boots the server with `DISABLE_FOOTBALL_DATA=true`, so the
suite always sees `src/data/matches.ts`. That is load-bearing: live scores, table
positions and the current round all change mid-match, so asserting against them
makes every run a coin flip — and it would spend the 10 req/min budget.

The upstream is a third party, so excluding it is within the guide's own
allowance. The consequence is not: **every rule this suite proves, it proves
about the fallback path.**

### The clock is frozen too

The `page` fixture in `tests/e2e/clock.ts` is why specs import `test` and
`expect` from `tests/e2e/clock.ts` rather than from `@playwright/test`.
`clock.ts` builds on `tests/e2e/fixtures.ts`, which holds the network stubs, so
importing from `fixtures.ts` directly gets the stubs and the **real wall clock**.
That is right only for a spec that installs a clock of its own —
`tests/e2e/partida-refetch.spec.ts` is the one that does.

`E2E_NOW` is **derived from `SNAPSHOT_DATE`**, never written down, so a
`sync-seed-data` run moves the data and the clock together.

It is `setFixedTime`, never `install`: the full fake replaces the timer queue,
which would hang `useNow`, every transition `tests/e2e/motion.spec.ts` asserts on, and
`waitUntil: "networkidle"`.

**The failure this closes was live for four hours before anybody saw it.**
`tests/e2e/meu-time.spec.ts` then skipped when the snapshot's soonest unplayed fixture
was in the past, and one day that fixture slipped behind a real clock. Two specs across
two projects went silent, the suite reported `690 passed`, and the only trace was a
`4 skipped` line nobody reads. It skips nothing now — see **Current reality**.

Two follow-ons worth knowing:

- **Code that runs in Node is not covered by the page clock.** `upcomingFixture` in
  `tests/e2e/matches-payload.ts` dates the fixture it produces in the *test process*,
  so it takes `E2E_NOW` explicitly. Back when `meu-time` read the snapshot instead,
  freezing the page alone left all four specs still skipping.
- **`tests/e2e/clock.spec.ts` is the spec that names the cause when the fixture
  breaks.** Removing the `setFixedTime` call once left `meu-time` green and only
  `tests/e2e/clock.spec.ts` red. Measured again on 2026-09-11, after `meu-time` began
  producing its fixture: the same mutation also reddens its two *Próximo jogo* specs
  in both projects, since a kickoff a minute after the snapshot's noon is days in the
  past to a real clock. Its LIVE spec stays green — a match under way is under way
  whatever the clock says.

## The harness configures the app OUT of production's shape

This is the most important paragraph in the guide.

`playwright.config.ts` sets `DISABLE_FOOTBALL_DATA: "true"`,
`DISABLE_WEATHER: "true"` **and** `ACCOUNTS_DEV_LOGIN: "true"`, plus an
`ACCOUNTS_DB` per port. With the weather switched off the clima card never
renders unless a spec serves its own payload, as `tests/e2e/weather.spec.ts` does.
With dev login on, `/api/account/me` answers 200 and
its body is consumed on the way past — so the suite **never takes the 404
branch**, and the 404 branch is production's shape and every fresh clone's.

That is exactly how a real bug survived: `useAccount` returned on a 404 without
reading the response body, Chromium held the stream open, the request never
reached `finished`, and `waitUntil: "networkidle"` therefore never resolved —
breaking every screenshot capture while the page itself rendered perfectly.

**A green suite says the app works in a configuration nothing ships.** Before
trusting coverage of anything touching accounts, the provider or the weather,
check which side of that `env` block the code under test falls on.

## A test that passes against the bug it names is worse than no test

The obvious guard for the bug above is to stub the 404 with `page.route` and
assert the page reaches idle. It was written, run against the **known-broken**
code, and **passed** — because `page.route` fulfilment completes Playwright's own
request accounting, and the failure's whole nature is that the accounting never
completes.

It was deleted rather than kept. A passing test converts an open question into a
false answer; the next reader sees green and stops. The reasoning now lives in
`src/useAccount.ts`, where the next person will meet it.

**Where a stub cannot reach, measure the real thing** — `requestfinished` against
a real server is what settled this.

## Stubbing rules that were each paid for

- **Prepare a payload once and fulfil from memory. Never `route.fetch()` per
  request.** A proxying handler came back as something other than the envelope
  under the suite's seven workers, and passed in isolation.
- **Flip a prepared payload behind a flag, not a call count.** React mounts
  effects twice under StrictMode, so "the second request" is not a thing a test
  can name.
- **Produce the state you need; do not hunt the season for a fixture in it.**
  `withoutGoals` in `tests/e2e/goals.spec.ts` is the pattern.
- **`tests/e2e/fixtures.ts` stubs every third-party host the pages reach, and
  fulfils rather than aborts.** The crest CDN and YouTube's thumbnails get a
  one-pixel image; YouTube's and Instagram's players get an empty document. The
  crest stub is the one with constraints: two assertions read the
  `referrerpolicy` off the DOM and the `Referer` off the wire, so the request
  must still be made with the real external URL; a third drives a **503** to
  prove the letter fallback, which a global abort would raise everywhere.
  Verified by counting: 20 requests issued, 0 served from the network.

That last one closed a gap that had been open for as long as the claim "CI needs
no secrets" had been written: `DISABLE_FOOTBALL_DATA` takes the *API* out of the
suite and does nothing about `crests.football-data.org`. On an unmodified `main`
it measured **85 failed / 765 passed**, surfacing as `net::ERR_ABORTED` on the
navigation rather than as a failed assertion, because `page.goto` waits for
`load` and `load` waits for twenty images. `tests/e2e-fixture.test.ts` now refuses
a spec that imports `test` from `@playwright/test` directly.

## Assertion rules

- **Never assert the current round or a scoreline.** The snapshot ages and
  `currentRound` advances with the calendar. Assert shape — `/\d+ª rodada/`. A
  round the spec navigated to by address is safe: `/jogos/7` heads "7ª rodada"
  whatever the calendar says.
- **Never assert how much curated data exists**, or which record holds a value.
  See [UNIT_TEST_GUIDE.md](./UNIT_TEST_GUIDE.md); it broke CI twice.
- **`allInnerTexts()` and `locator.all()` do not auto-wait**, unlike
  `expect(locator)`. Wait for the table to populate first, or they sample a
  half-rendered DOM. This produced a real flake.
- **`getByText` is case-insensitive substring matching by default.** A bare
  `getByText("Ao vivo")` also matches the banner's "…para dados ao vivo". Scope
  the locator and pass `exact: true`.
- **A poll for an absence is a race dressed as an assertion.**
  `expect.poll(...).toBeNull()` passes on the **first** null it sees, so it was
  racing an upload rather than testing it: green alone, green on a re-run, red at
  923 specs. Assert the observable state directly. `tests/e2e-poll.test.ts`
  refuses the literal shape, and lets an absence poll stand only where the same
  read was polled *present* earlier in the file. It cannot see a matcher reached
  through an expression — `.toBe(x ? null : x)` — and its own tests pin that
  blind spot.
- **`page.request` cannot carry a session.** It is a Node-side fetch with no
  notion of a potentially trustworthy origin, so it will not send a `Secure`
  `__Host-` cookie over `http://127.0.0.1` — every signed-in call answers 401
  while the browser beside it is signed in. Use `page.evaluate(fetch)`. It is
  still fine for *establishing* a session.

## Selectors: name the thing, not its shape

**Turning text into a control changes its element.** Making a club name clickable
turned a `span` into a `button` and later an `<a>`, silently breaking every spec
selecting `span:first-child`. Select the cell's element children (`td > *`).

**Counting elements is not counting marks.** The Painel's scatter had its
twenty-dot count written as `circle`; the subject gained a ring and the count went
to 21, then a caption gained a swatch of the mark and a `figure`-wide count went
to 21 again while `figure svg` became two svgs — a strict-mode violation rather
than a wrong answer. Hence `data-scatter-svg`, `data-scatter`, `data-candles` and
`circle[data-scatter-point]`: a drawing may gain a decoration without loosening an
assertion about what it plots.

Keep `data-*` hooks for exactly this. `tests/e2e/broadcasts.spec.ts` selects
broadcaster marks on `data-mark` precisely so the markup can change.

## Two targets

| Target | Boots | Runs |
| --- | --- | --- |
| default | `server.ts` through `tsx`, Vite in middleware mode | every spec |
| `PLAYWRIGHT_TARGET=bundle` | `dist/server.cjs` under `NODE_ENV=production` | `seo`, `page-meta`, `routing` only |

The bundle target is the branch the host actually runs — `express.static`, the
shell read once at boot, no Vite — so it is where `registerSpaFallback` and
`injectMeta` are actually exercised. The rest would re-assert what the Vite run
already proved. CI runs both.

**`server.ts` refuses to start with `ACCOUNTS_DEV_LOGIN` set when `NODE_ENV` is
production**, so the config *empties* that variable in bundle mode rather than
omitting it. An inherited value would take the whole run down.

## Ports and concurrency

`STRICT_PORT` is deliberate: a suite that quietly moved to another port would be
testing a server its own config does not describe. So a second concurrent
`npm run test:e2e` **fails rather than walks** — pass `E2E_PORT=3101` to run
alongside another session. CI runs alone and needs nothing.

## Required rules

1. **Import `test` and `expect` from `tests/e2e/clock.ts`.** Never from
   `@playwright/test`, and from `tests/e2e/fixtures.ts` only in a spec that
   installs its own clock.
2. **Assert shape, never a value that a sync can move.**
3. **Prepare payloads once and fulfil from memory.**
4. **Reach for a `data-*` hook** rather than a tag name or an element count.
5. **Do not pipe the run through `head` or `tail`** — see
   [UNIT_TEST_GUIDE.md](./UNIT_TEST_GUIDE.md) for why the tail of a failing run
   looks like a passing one.
6. **Before trusting a green spec touching accounts, the provider or the
   weather**, check which side of the config's `env` block it falls on.
7. **Confirm the spec red** against the mutation it names.

## Current reality

- **The Playwright specs are the only coverage of the client at all.** There is no
  component-level test tier — no jsdom, no Testing Library. A React component's
  behaviour is either asserted in a browser or not asserted.
- **There is no integration tier for the server either.** `tests/e2e/api.spec.ts`
  exercises the HTTP surface, and CI's `check` job boots the bundle and smoke-tests
  three endpoints. Between the pure units and the browser there is nothing.
- **The shell scripts have their own harness**, `scripts/rehearse-*.sh`, run by
  CI's `check` job.
- **`tests/e2e/partida-refetch.spec.ts` takes the full clock fake knowingly**, as
  a documented exception: a 60s poll cannot be observed without moving time, and
  nothing on that route calls `useNow` or awaits `networkidle`.
- **No spec skips itself.** `tests/e2e-fixture.test.ts` refuses a `test.skip` or
  `test.fixme` call in any spec, because a skip reports as a count nothing in CI
  reads. A state the frozen snapshot cannot reach on its own — a round still to
  play, a fixture with a curated venue, a LIVE match — is produced with
  `tests/e2e/matches-payload.ts`. A curated record a spec needs, such as an own
  goal or a ground with a photograph, is derived from the committed data and
  fails by name when none exists.
- **No spec opens a fixture by a literal id**, and `tests/e2e-fixture.test.ts`
  refuses one. A spec produces the fixture it needs in a prepared payload, or reads
  one with the right shape off the payload the server built — a scorer the elencos
  could place, two full team sheets — and fails by name when none exists. Only
  specs are swept: the README captures still depict particular fixtures, and an
  image of a page is not an assertion about it.

## Review heuristics

**Configuration test.** Would this pass in production's configuration? Which
`env` value is holding it up?

**Mutation test.** Break the thing the spec names. Does it go red?

**Drift test.** Will the next `sync-seed-data` or `sync-goals` move what this
asserts?

**Silence test.** Can this spec *skip*? What would report that it did?

**Selector test.** Does this break when the element gains a decoration, or changes
tag?

**Isolation test.** Does it pass at one worker and at seven?

## Positive signals

- The spec constructs the state it needs from a prepared payload.
- Assertions read the words a reader sees, not the DOM's shape.
- A `data-*` hook names the mark rather than counting elements.
- The spec records the mutation it was confirmed against.

## Warning signs

- `import { test } from "@playwright/test"`.
- `import { test } from "@/tests/e2e/fixtures"` in a spec that never installs a clock.
- An assertion on the current round, a scoreline, or a specific fixture id.
- `route.fetch()` inside a handler.
- `expect.poll(...)` waiting for something to become absent.
- `page.request` in a signed-in assertion.
- A `circle`, `svg` or `span` count standing in for a count of things.
- A skip condition with nothing watching it.

## Related guides

- [UNIT_TEST_GUIDE.md](./UNIT_TEST_GUIDE.md) — the fast suite, and the shared rules on mutation and curated data.
- [REFERENTIAL_TRANSPARENCY.md](./REFERENTIAL_TRANSPARENCY.md) — why the clock can be frozen at all.
- [ERROR_HANDLING_GUIDE.md](./ERROR_HANDLING_GUIDE.md) — the degraded paths this suite always runs.
- [REST_API_GUIDE.md](./REST_API_GUIDE.md) — what `tests/e2e/api.spec.ts` covers.
- [MOBILE_FIRST_GUIDE.md](./MOBILE_FIRST_GUIDE.md) — the viewport-measuring specs.

## Checklist

- [ ] `test`/`expect` imported from `tests/e2e/clock.ts` — or from `fixtures.ts` in a spec with a clock of its own.
- [ ] No assertion on a value a sync can move.
- [ ] Payloads prepared once and fulfilled from memory.
- [ ] Selectors use `data-*` hooks, not tags or element counts.
- [ ] The spec was confirmed red against a named mutation.
- [ ] Any skip condition is itself observable.
- [ ] Checked whether the config's `env` is what makes it pass.
