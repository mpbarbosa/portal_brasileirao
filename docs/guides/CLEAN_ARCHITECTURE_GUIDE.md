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

## Layer reference

| Layer | Where it lives | May import |
| --- | --- | --- |
| Shared contracts | `src/types.ts` | nothing |
| Domain logic (pure) | root `*-core.ts` — `standings-core.ts`, `matches-core.ts`, `scouts-core.ts`, … | `src/types.ts`, other core modules |
| Provider adapters | `football-data-core.ts` (upstream → internal), `health-core.ts` (our own API → client model), `sumula-core.ts` (PDF text → rows) | `src/types.ts` |
| Persistence adapters | `account-store.ts` (SQLite), `match-state-store.ts` (JSON file) | core modules, node builtins |
| Composition root | `server.ts` | everything |
| Client transport | `src/api.ts` | core modules, `src/types.ts` |
| Presentation | `src/App.tsx`, `src/components/*.tsx`, `src/use*.ts` hooks | core modules, `src/api.ts`, `src/types.ts` |
| Committed data | `src/data/*.ts` | `src/types.ts` |
| Workstation tools | `scripts/*.ts` | core modules, node, network |
| Host scripts | `shell_scripts/*.sh` | — |

Core modules **do** import each other, and that is not a violation: `next-match-core.ts`
imports `clubMatches` from `club-core.ts` and `LATE_GRACE_MS` from `live-core.ts`
rather than restating either. The rule is direction, not isolation — nothing in that
graph reaches outward.

## Required rules

1. **A `*-core.ts` module performs no I/O.** No `fetch`, no `node:fs`, no
   `node:sqlite`, no `express`. Verified mechanically:

   ```sh
   grep -ln 'from "express"\|from "node:fs"\|from "node:sqlite"\|fetch(' $(git ls-files ':(glob)*-core.ts')
   ```

   This must print nothing.

2. **A core module reads no clock and no environment.** `now` arrives as a
   parameter — see [REFERENTIAL_TRANSPARENCY.md](./REFERENTIAL_TRANSPARENCY.md),
   which is the other half of this rule and carries the reasoning.

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
   testing.** That file is 1 664 lines and is the composition root; it is allowed
   to be long, and it is not allowed to be the only place a rule exists.

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
- Two entry points already reuse the inner layer: the Express server and the 33
  workstation scripts under `scripts/`.

## Current reality

- **`server.ts` is the composition root and is doing a lot of it.** Routing,
  caching, the circuit breaker, the merge chain and the SPA fallback are all
  there. That is the intended shape; the pressure to watch is a *rule* appearing
  inline in a handler rather than in a core module beside its test.
- **`src/data/*.ts` is imported directly by both server and client.** It is
  committed data with no I/O, so it behaves as an inner layer, but nothing
  enforces that a generated file stays free of logic.
- **There is no dependency-direction check in CI.** `tsc --noEmit` will not
  object to a core module importing `express`; the grep in rule 1 is the only
  gate, and nothing runs it automatically.

## Review heuristics

**Import test.** Open the file's import block. A `*-core.ts` importing anything
but `src/types.ts` and other core modules is the violation.

**Isolation test.** Could this function be called from a unit test with literal
arguments? If it needs a server booted or a token set, the boundary is wrong.

**Two-branch test.** If the change adds a merge or a correction to a route, does
it sit inside *both* the live fill and the seed fill?

**Naming test.** A new root-level file whose name ends in `-core.ts` is making a
promise. `-store.ts` is the name for the other half.

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

## Related guides

- [REFERENTIAL_TRANSPARENCY.md](./REFERENTIAL_TRANSPARENCY.md) — purity, and why `now` is an argument.
- [HIGH_COHESION_GUIDE.md](./HIGH_COHESION_GUIDE.md) — one subject per core module.
- [DRY_GUIDE.md](./DRY_GUIDE.md) — why the judgement/transport split exists at all.
- [UNIT_TEST_GUIDE.md](./UNIT_TEST_GUIDE.md) — what the inner layer buys.
- [ERROR_HANDLING_GUIDE.md](./ERROR_HANDLING_GUIDE.md) — degrading at the boundary rather than in the rule.

## Checklist

- [ ] No `*-core.ts` imports `express`, `node:fs`, `node:sqlite`, or calls `fetch`.
- [ ] No core module reads the clock or `process.env`.
- [ ] Judgement and transport are separate files where both exist.
- [ ] Any new rule is callable from a unit test with literal arguments.
- [ ] A merge or correction is applied in every cache branch, not one.
- [ ] `server.ts` gained wiring, not a rule.
