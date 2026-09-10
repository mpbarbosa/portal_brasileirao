# Error Handling Guide

Adapted for Portal Brasileirão from `doc_template_lib/code_quality/ERROR_HANDLING_GUIDE.md`.

## Goal

Failures here are mostly not exceptions. This app reads two upstreams that go
down, contradict themselves and rate-limit, and its answer is almost never to
throw — it is to **serve a worse answer and say so in the payload**.

So the generic taxonomy re-points: the question at each failure is not *which
error type* but **degrade, refuse, or fail — and who finds out**.

## Degrade: the `ApiEnvelope`

Every data endpoint returns `ApiEnvelope<T>` (`src/types.ts:1246`): the payload,
plus `source`, a human-readable pt-BR `note`, and `updatedAt`.

`source` is the classification, and it does the job a typed error class does
elsewhere:

| `source` | What happened | Who should care |
| --- | --- | --- |
| `football-data` | Live upstream data | Nobody |
| `open-meteo` | Live weather — a **second** upstream, named separately because it fails independently | Nobody |
| `traffic-log` | This deployment's own nginx log | Nobody |
| `placeholder` | No token configured; serving the frozen seed | Nobody — this is a fresh clone |
| `fallback` | Configured **and failing**; serving the frozen seed | **This is the one worth alerting on** |

`placeholder` and `fallback` look identical to a reader and are different facts.
Collapsing them would either alert on every unconfigured clone or alert on
nothing.

**New endpoints keep this shape and degrade to local data rather than returning a
500.** The UI banners the note for anything that is not live.

Naming each upstream separately is the same rule one level down: a reader told
the scores are stale because the *weather* timed out is being misinformed, and
`DISABLE_WEATHER` exists as its own kill switch beside `DISABLE_FOOTBALL_DATA`
for the same reason.

## The two documented exceptions to the envelope

The rule stays believable because its exceptions are written down rather than
discovered.

- **`/api/health`** describes the process, so it has no `source`, no `note` and
  nothing to degrade to. It is also the one payload the client cannot assume it
  understands — a host still serving last week's bundle answers the shape *that*
  build emitted — which is why `parseHealth` narrows it field by field.
- **`/api/auth/*` and `/api/account/*`** answer plain JSON with real status codes
  and `{ error }` in pt-BR. An account has no upstream, no staleness and no
  honest fallback, and *"não foi possível ler a sua conta"* must be a real status
  code rather than a cheerful envelope containing somebody else's defaults.

## Refuse: where a real status code is right

Degrading is for data that has a worse-but-honest version. A malformed *request*
has none:

- `/api/matches?round=` — a non-integer or `< 1` is a **400**.
- `/api/players/:id` — a non-numeric id is a **400**. (A *valid* id with no
  upstream answers `null`; that is enrichment, and enrichment degrades.)
- `pageStatus` in `seo-core.ts` — an unknown section, an unresolvable club or
  fixture, a round outside the season and an undecodable path are **404 +
  noindex**, with the classificação still rendered beneath. The body stays
  friendly; the status code tells the truth.

**Absent data is not proof of absence**, and this is the rule most easily lost:
`pageStatus` declares a club missing only when the club list actually arrived.
Otherwise a provider outage would 404 all 380 fixture pages at once and a crawler
would drop them over an incident lasting minutes.

## Fail-open or fail-safe is decided by who is watching

This is the most transferable decision in the repository, and the two halves sit
in the same pipeline pointing opposite ways.

- **The deploy ancestry guard fails OPEN.** An unreachable site, a health payload
  with no usable sha, or a commit this checkout does not have all mean *proceed*.
  It judges a release a person asked for, and during an outage the ability to
  deploy is worth more than the ordering it protects. A site that is down cannot
  tell you what it is running.
- **`.github/workflows/reconcile.yml` fails SAFE.** An unreachable site, an unusable live sha, a
  divergent history or a run already in flight all mean *do not dispatch*. It
  starts a release nobody asked for, unattended.

Same conditions, opposite answers, because one has a person watching and one does
not.

## Safe is not the same as silent

Every terminal branch of the reconciler used to `exit 0`. On 2026-08-30 `.github/workflows/ci.yml`
was startup-failing; the reconciler **detected it correctly**, wrote *"this needs
a person, not another tick"*, and went green on every tick from 03:40Z.
Production sat 4 commits behind for eighteen hours, and the row of green ticks is
what made it invisible.

The branches now split by **who has to do something**:

- **Expected holds exit 0** — in sync, a run already in flight, the API query
  failing, a deliberate rollback holding the line. Nothing is wrong.
- **Conditions needing a person exit 1** — main's own CI run failed, the site is
  unreachable, the live sha is unusable, production is not an ancestor of `main`.
  The schedule goes red and GitHub raises its notice.

The generic guide calls this the swallow test. Here it reads: *a handler that
knows something is wrong and reports success is a silent swallow, even when it
logged.*

## Exit codes are a taxonomy

Shell has no error classes, so the code carries the class — and the rule is
always "these need different responses from a person":

| Script | 1 | 2 | 3 |
| --- | --- | --- | --- |
| `shell_scripts/06_redeploy.sh` | ordinary failure | new release unhealthy, **previous build restored and serving** | **CRITICAL** — flip-back also failed, the site is down |
| `shell_scripts/09_backup_accounts.sh` | upload failed (a retry) | database will not open (an incident) | — |
| `shell_scripts/15_install_blocklist.sh` | ordinary failure | nginx rejected the render; previous file restored | — |

> "The upload failed" is a retry and "the database will not open" is an incident,
> and a timer reporting both the same way is one nobody reads.

**And the exit status frequently answers a different question than the one you
asked.** Three instances, each of which cost real time here:

- A **pipeline's** exit status is the last command's. `npx playwright test | tail`
  exits 0 however many specs failed — and Playwright prints the failure list
  *before* the `N passed` summary, so the last four lines of a failing run are
  character-for-character the shape of a passing one. A red `main` skipped every
  deploy for twenty minutes behind that.
- `git push origin --delete` says **`failed to push`** and exits 1 when the branch
  is already gone — which is what you asked for.
- `2>&1` inside a command substitution folds stderr into the *value*, so an
  experimental-feature warning landed inside a row count.

**Check the state, not the exit code.**

## Never throw where a degraded answer exists

- **`match-state-store.ts`**: every read failure is an empty memory, never a
  throw. It runs at boot, so a missing, truncated or wrongly-shaped file must
  leave the server starting normally. *A site that is down because a cache warmed
  badly is far worse than one serving a stale scoreline.*
- **`node:sqlite` is loaded lazily inside `openStore`**, never imported at the
  top. A static import is evaluated at boot, so a runtime without the module
  fails the **whole process** — a site that is down, on a release that only added
  a feature nobody had switched on.
- **Metadata never fails a page.** If the server-side load for a route's title
  and description fails, the page still renders with generic metadata.
- **The circuit breaker degrades rather than erroring.** It opens after
  `CIRCUIT_BREAKER_FAILURE_THRESHOLD` (3) consecutive failures for
  `CIRCUIT_BREAKER_OPEN_MS` (60s), so a downed upstream gets one probe a minute
  rather than one per request — and the envelope says `fallback` throughout.

## Fail fast where the alternative is worse

- **`server.ts` refuses to start** with `ACCOUNTS_DEV_LOGIN` set when
  `NODE_ENV=production`. The route is registered conditionally too, so in
  production it does not exist rather than existing and declining.
- **A sync writes nothing** rather than a run's worth of unverified data — see
  [DEFENSIVE_CODING_GUIDE.md](./DEFENSIVE_CODING_GUIDE.md).
- **`shell_scripts/07_install_release.sh` stops the deploy** if it cannot retain the previous
  release, rather than proceeding with no way back.

## Required rules

1. **A data endpoint degrades and banners; it does not 500.** Keep the envelope.
2. **A malformed request gets a real status code.** A malformed *upstream* gets a
   degraded payload.
3. **Name each upstream separately in `source`**, so one outage cannot be
   reported as another's.
4. **Choose fail-open or fail-safe from who is watching**, and write the reason
   at the branch.
5. **A branch that knows something is wrong must not report success.** Exit codes
   split by *who must act*, not by *what failed*.
6. **Check the state, never the exit code**, wherever a pipe, a `2>&1` or a
   remote is involved.
7. **Nothing that only adds a feature may prevent the process starting.** Lazy
   loads, safe defaults, and every new env var must work when unset.

## Current reality

- **There are no custom error classes.** Failures are envelope `source` values,
  HTTP status codes, `null` returns and shell exit codes. For an app of this
  shape that is proportionate; a typed hierarchy would have almost no callers.
- **`/api/account/*` returns `{ error }` strings in pt-BR**, discriminated by
  status code rather than by an error type field. Any client branching would be
  on the code.
- **Nothing structured is logged.** Diagnosis is `journalctl`, `/api/health`, and
  the traffic snapshots. There is no error rate, no alerting, and the reconciler's
  exit code is the closest thing to a monitor.

## Review heuristics

**Envelope test.** Does this new endpoint return `ApiEnvelope<T>`? If not, is it
one of the two written-down exceptions?

**Direction test.** If this guard cannot decide, does it proceed or stop? Is
there a person watching?

**Silence test.** Is there a branch that detects a problem and exits 0?

**State test.** Is this conclusion drawn from an exit code that could be
answering a different question?

**Boot test.** Could this change stop the process starting on a host where the
feature is not configured?

## Positive signals

- A new upstream gets its own `source` value and its own kill switch.
- A guard's comment says which direction it fails in and why.
- Two failure modes that need different human responses have different exit codes.
- A store's read path returns empty rather than throwing.
- A degraded page still renders, with a banner that says what is stale.

## Warning signs

- A `500` from a data route.
- A new endpoint that is neither an envelope nor a documented exception.
- A CI or timer branch that logs a problem and exits 0.
- A conclusion drawn from `$?` after a pipe.
- A top-level import of an optional runtime module.
- A new env var with no safe default.
- One banner covering two independent upstreams.

## Related guides

- [DEFENSIVE_CODING_GUIDE.md](./DEFENSIVE_CODING_GUIDE.md) — deciding what to refuse before deciding how to report it.
- [REST_API_GUIDE.md](./REST_API_GUIDE.md) — the envelope, its exceptions, and status codes.
- [CLEAN_ARCHITECTURE_GUIDE.md](./CLEAN_ARCHITECTURE_GUIDE.md) — degrading at the boundary, never inside a rule.
- [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md) — why a green suite says nothing about the failing path.

## Checklist

- [ ] Data endpoints degrade inside the envelope; only requests get error codes.
- [ ] A new upstream has its own `source` and its own kill switch.
- [ ] The guard's failure direction is chosen deliberately and documented.
- [ ] No branch reports success while knowing something is wrong.
- [ ] Exit codes distinguish "retry" from "a person must look".
- [ ] Conclusions come from observed state, not from an exit code after a pipe.
- [ ] The change cannot prevent the process starting when unconfigured.
