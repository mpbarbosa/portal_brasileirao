# Clean Architecture Guide

Adapted for Portal Brasileirão from `doc_template_lib/code_quality/CLEAN_ARCHITECTURE_GUIDE.md`.

## Goal

Keep the rules that decide *what the app says* free of everything that decides
*where the bytes came from*. Dependencies point inward: a module that computes a
table must not know that a table is fetched over HTTP, cached for 60 seconds, or
rendered in a `<td>`.

## What it means here

This repository has one name for the inner layer: a **core module**. Every
root-level `*-core.ts` performs **no I/O** — data in, data out. `server.ts` does
the fetching and passes payloads in; a component does the rendering and reads
values out.

That is the whole architecture, and it is worth stating plainly because it is
unusual: there are **no ports and no injected interfaces**. A core module never
calls out at all, so there is nothing to inject. The guide's canonical rule —
*define an interface in the inner layer for each external collaborator* — has no
application here, and adding one would be ceremony around a function that already
takes its inputs as arguments.

The nearest thing to an injection is **entropy**, and it is a function argument
rather than a port. Randomness is the one input that cannot be handed over as a
value, so it arrives as a generator — `mintToken(randomBytes)`,
`newVerifier(randomBytes)`, `newAccountId(() => randomUUID())` — which is what
lets a test pass fixed bytes and assert the result.

## Layer reference

| Layer | Where it lives | May import |
| --- | --- | --- |
| Shared contracts | `src/types.ts` | nothing |
| Domain logic (pure) | root `*-core.ts` — `standings-core.ts`, `matches-core.ts`, `scouts-core.ts`, … | `src/types.ts`, other core modules, `node:crypto`'s `createHash` and `timingSafeEqual` |
| Provider adapters | `football-data-core.ts` (upstream → internal), `health-core.ts` (our own API → client model), `sumula-core.ts` (PDF text → rows) | `src/types.ts`, other core modules |
| Persistence adapters | `account-store.ts` (SQLite), `match-state-store.ts` (JSON file) | core modules, node builtins |
| Composition root | `server.ts` | everything |
| Client transport | `src/api.ts` | core modules, `src/types.ts` |
| Presentation | `src/App.tsx`, `src/components/*.tsx`, `src/use*.ts` hooks | core modules, `src/api.ts`, `src/types.ts`, `src/data/*.ts` |
| Committed data | `src/data/*.ts` | `src/types.ts`, other `src/data` files, a core module's decoder |
| Workstation tools | `scripts/*.ts`, `scripts/manim/*.ts` | core modules, node, network |
| Host scripts | `shell_scripts/*.sh` | — |

**Only the two core rows are enforced** — by `tests/core-purity.test.ts`, below.
The other rows describe the code as it stands and are held by reading.

Core modules **do** import each other, and that is not a violation: `next-match-core.ts`
imports `clubMatches` from `club-core.ts` and `LATE_GRACE_MS` from `live-core.ts`
rather than restating either, and `football-data-core.ts` takes `slugify` from
`club-core.ts` rather than writing a second normaliser. The rule is direction, not
isolation — nothing in that graph reaches outward.

Two rows point inward at the core in ways worth naming. **Committed data imports a
decoder**: `goals.ts` calls `decodeGoals` and `escalacoes.ts` calls `decodeLineups`,
because both files are stored as tuples and the decoder is the only thing that may
know the encoding. **Presentation imports committed data**: the Perfil reads
`club-scouts.ts`, the player card reads the curated player files, and the club page
reads `club-videos.ts` and `events.ts` — files that cost no request, so there is no
route to put between them and the page.

## Required rules

1. **A `*-core.ts` module performs no I/O**, and the rule is enforced as an
   allowlist: a core module may import `src/types`, other root core modules and
   `node:crypto`'s two deterministic functions, and nothing else.
   `tests/core-purity.test.ts` holds **every** `*-core.ts` in the repository to
   that, and it runs in `npm run test:unit`, which `check` runs on every push:

   ```sh
   node --import tsx --test tests/core-purity.test.ts
   ```

   This rule shipped as a grep over `express`, `node:fs`, `node:sqlite` and
   `fetch(`, and the grep printed nothing while three files broke the rule it
   stated. `oauth-core.ts` and `session-core.ts` imported `randomBytes`, and
   `scripts/manim/capa-core.ts` read files and drove Chromium outside the
   root-only glob the grep ran over. A list of what is forbidden passes whatever
   it did not think of; an allowlist names it. The test was confirmed red against
   all three before they were fixed.

2. **A core module reads no clock, no environment and no entropy.** `now`
   arrives as a parameter, and so does randomness, so every function in the inner
   layer can be asserted by value. The test refuses `Date.now()`, `new Date()`,
   `process.*`, `Math.random()`, `crypto.randomUUID` and a `randomBytes` import.
   See [REFERENTIAL_TRANSPARENCY.md](./REFERENTIAL_TRANSPARENCY.md), which is the
   other half of this rule and carries the reasoning.

3. **Where a subject needs both judgement and transport, split it in two.** The
   pattern is named after its first instance and repeats four times:

   | Judgement (pure, unit-tested) | Transport (HTTP/SQL, no rules) |
   | --- | --- |
   | `account-core.ts`, `session-core.ts`, `oauth-core.ts` | `account-store.ts` |
   | `commons-core.ts` (licence rules) | `scripts/commons-api.ts` |
   | `youtube-upload-core.ts` | `scripts/youtube-api.ts` |
   | `traffic-report-core.ts` (parsing) | `shell_scripts/12_traffic_report.sh` |

   The split is what lets the licence rules, the PKCE checks and the token bucket
   be tested with no database, no browser and no Google client.

4. **Extract to a core module before logic in `server.ts` grows a branch worth
   testing.** That file is the composition root; it is allowed to be long, and it
   is not allowed to be the only place a rule exists.

5. **Enrichment and correction live in core, and `server.ts` only calls them.**
   `withGoals` is in `goals-core.ts`, `withCoachOverrides` in `club-core.ts`,
   `withSquadOverrides` in `player-core.ts`. The route wires them together; none
   of them knows it is inside a route.

6. **Apply a merge inside every cache branch, not beside one.** `server.ts` fills
   each cache from a live payload or from the frozen seed, and a correction
   applied to only one branch makes the offline and online answers differ — which
   the end-to-end suite cannot see, because it always runs the seed branch.

## Why it matters here

- The upstream allows **10 requests a minute**. Logic that could only be exercised
  by calling it is logic that cannot be exercised.
- `tests/*.test.ts` run `computeStandings`, `liveBoard`, `clubFocus` and
  `computeRankCandles` with no server, no browser and no token. That is a property
  of the split, not of the test runner.
- The same core module is imported by `server.ts` **and** by its own test, which is
  what makes a green unit test evidence about production.
- Two entry points already reuse the inner layer: the Express server and the
  workstation scripts under `scripts/`.

## Current reality

Re-validated in full against the code at `314d528` on 2026-09-11. A bullet added after
that was checked by the change that added it — say which, rather than moving this line
without re-running the whole check.

- **`server.ts` is the composition root and is doing a lot of it.** Routing,
  caching, the circuit breaker, the merge chain and the SPA fallback are all
  there. That is the intended shape; the pressure to watch is a *rule* appearing
  inline in a handler rather than in a core module beside its test.
- **The small rules that used to live only there are in core, each with a unit
  test.** The cross-origin check in front of the state-changing account routes is
  `isSameOriginRequest` (`session-core.ts`); which routes load data before their
  shell renders is `namesSubject` (`route-core.ts`), an exhaustive switch; the
  fixture TTL reads `hasLiveMatch`, the predicate the client's refresh rate
  already used; and `/api/matches` and `/api/players/:id` validate through
  `parseRoundParam` and `isPersonId`. `firstHeaderValue` moved to `seo-core.ts`
  beside `resolveOrigin`, its one remaining consumer. `decodable` moved to
  `route-core.ts`, beside `pathSegments` — which `pageStatus` now shares rather
  than carrying its own copy — so a request's address is decoded in exactly one
  place, and the guard, the router and the status code cannot disagree about
  what a readable address is. (`club-core`'s Wikipédia parser keeps its own
  catch, for an article URL pasted into curated data rather than an address
  being served.) And which traffic snapshots the dashboard reads — the
  `summary-*.txt` filter, the name order and the month-long cap — is
  `selectSnapshotFiles` in `traffic-report-core.ts`; `readTrafficReports` only
  lists the directory and reads what it is told. The frozen-data note's date is
  `numericDayLabel` in `events-core.ts`, beside the app's other Brazil-local day
  labels.
- **Moving `firstHeaderValue` found a bypass in the sign-in rate limiter.** The
  limiter keyed its bucket on the same client-most entry of `X-Forwarded-For`,
  and nginx's `$proxy_add_x_forwarded_for` appends the address it saw to whatever
  the client sent — so that entry is the client's to write, and rotating it never
  met a bucket. The key is now `clientKey` in `rate-limit-core.ts`, the entry our
  proxy appended. A rule inline in `server.ts` had no test to make that question
  askable, which is rule 4's argument arriving with a security consequence.
- **Both branches of `loadMatches` share one curated-merge chain,
  `withCuratedData`, and the seed is repaired as a live fill is.** The chain used
  to be written out twice, and `withPlayedStatus` ran in the live branch only;
  `seedMatches()` now feeds the seed payload and the seed standings alike. The
  seed held no record the repair changes when this landed, so it closed a latent
  gap rather than a visible one — `sync-seed-data` copies the provider, which is
  where such records come from.
- **`hasScore` in `matches-core.ts` is the one has-a-score test.** It replaced
  eight identical null checks: three in components, and `countsTowardStandings`,
  `withGoals`, `pageMeta` and two rules inside `matches-core` itself. The saldo's
  sign, which the Classificação and the club page each wrote out, is
  `goalDifferenceLabel` in `standings-core.ts`.
- **The traffic page and the local window no longer keep copies of the
  parser's rules.** The per-minute rate between two cumulative readings —
  clamped at zero, null where the instants do not separate — is
  `ratePerMinute`, and the dashboard's three rates and the page's per-country
  line (`countryRateSeries`) all go through it; the log's `dd/Mon/yyyy` day
  order is `chronologicalDays`; the bot share is `botShareLabel`. All live in
  `traffic-report-core.ts`, which `npm run traffic-dashboard` already imported
  for everything else. Goals per match is `goalsPerMatchLabel`
  (`league-stats-core.ts`), and with it no code hand-rolls the pt-BR decimal
  comma any more.
- **`src/data/*.ts` is imported directly by both server and client.** It is
  committed data with no I/O, so it behaves as an inner layer, but nothing
  enforces that a generated file stays free of logic.
- **Only the inner layer's imports are enforced.** `tsc --noEmit` does not object
  to a component importing `server.ts` or a data file importing a component, and
  no test does either.

## Review heuristics

**Import test.** Open the file's import block. A `*-core.ts` importing anything
but `src/types.ts`, other core modules and `createHash`/`timingSafeEqual` is the
violation — and `tests/core-purity.test.ts` will say so before a reviewer does.

**Isolation test.** Could this function be called from a unit test with literal
arguments? If it needs a server booted or a token set, the boundary is wrong.

**Two-branch test.** If the change adds a merge or a correction to a route, does
it sit inside *both* the live fill and the seed fill? For fixtures the answer is
structural: a curated merge goes into `withCuratedData`, which both call.

**Naming test.** A file whose name ends in `-core.ts`, wherever it lives, is
making a promise, and the test holds it to it. `-store.ts` is the name for the
other half; `scripts/manim/capa-shared.ts` was `capa-core.ts` until it was
measured against what it does.

## Positive signals

- A new curated data file reaches the page through a core function, not a route
  handler.
- A provider change touches `football-data-core.ts` and nothing else.
- A test for a scoring rule constructs its inputs literally.
- The same function serves `/api/matches` and a `scripts/sync-*.ts` run.

## Warning signs

- A conditional in `server.ts` that a reviewer would want a test for.
- A core module that would need a fixture server to test.
- A component computing a rule that a core module already answers.
- A correction applied in one cache branch.
- `new Date()` inside a core module.
- A core function taking no arguments that returns something different on every
  call.

## Related guides

- [REFERENTIAL_TRANSPARENCY.md](./REFERENTIAL_TRANSPARENCY.md) — purity, and why `now` is an argument.
- [HIGH_COHESION_GUIDE.md](./HIGH_COHESION_GUIDE.md) — one subject per core module.
- [DRY_GUIDE.md](./DRY_GUIDE.md) — why the judgement/transport split exists at all.
- [UNIT_TEST_GUIDE.md](./UNIT_TEST_GUIDE.md) — what the inner layer buys.
- [ERROR_HANDLING_GUIDE.md](./ERROR_HANDLING_GUIDE.md) — degrading at the boundary rather than in the rule.

## Checklist

- [ ] `tests/core-purity.test.ts` passes: no `*-core.ts` imports outside the allowlist.
- [ ] No core module reads the clock, `process.env` or a random source.
- [ ] Judgement and transport are separate files where both exist.
- [ ] Any new rule is callable from a unit test with literal arguments.
- [ ] A merge or correction is applied in every cache branch, not one.
- [ ] `server.ts` gained wiring, not a rule.
