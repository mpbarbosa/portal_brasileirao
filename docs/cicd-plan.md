# Plan: a full CI/CD flow

Written 2026-08-26, against `184b75d`.

This is a planning document, not a specification. Anything here that contradicts
`CLAUDE.md` or `CONTEXT.md` about what the code *does* is wrong and those win —
except where this document says a claim in them is stale, which is the first
item below and is evidenced.

## The premise is wrong, and correcting it is the point

The obvious reading of "implement a full CI/CD flow" is that there isn't one.
There is. `.github/workflows/ci.yml` type-checks, unit-tests, gates the colour
contrast, builds, boots the bundle and smoke-tests it, shellchecks the deploy
scripts, runs 316 end-to-end specs across two devices, and then — on a push to
`main` — builds a payload, mints an OIDC token, publishes to S3, installs over
SSM with no inbound SSH, and asserts that the live site reports the commit it
just built. Run `32993785303` did all of it in four minutes.

So this is not a plan to build a pipeline. It is a plan to finish one, and the
work divides cleanly in two:

- **Defects that have already cost something.** Six of them, every one visible in
  the run history or written into a commit message by whoever was cleaning up
  after it. These are the plan.
- **Gaps that have not cost anything yet.** Supply-chain checks, deployment
  records, release identity. Worth doing, worth doing second.

**One documentation correction comes before either.** `CLAUDE.md` still says, in
the last section, **"No deploy has ever run against a real host."** That was true
when it was written and is now false by a wide margin: deploys to
`i-03a9afc8a469edc89` succeed routinely and take about forty seconds from role
assumption to the live-commit assertion. `docs/roadmap.md` already says the
opposite ("Live at brasileirao.mpbarbosa.com, deployed from `main` by GitHub
Actions through OIDC → S3 → SSM"), so the two authoritative documents disagree
about whether production exists. Fix `CLAUDE.md` first, in its own commit, before
anyone plans anything else on top of a false premise.

---

## The six defects

Ranked by what each one can cost, not by effort.

### 1. Production can move backwards, and nothing stops it

**Observed 2026-08-26.** From the commit message of `e065a8d`, written while it
was happening:

> The backlog that did fire at 16:16-16:26 landed **out of order**: cbf98f7
> deployed, then 8d95b17, which is its parent — so production moved backwards.

The `deploy` job's `concurrency: deploy-production` with
`cancel-in-progress: false` **serialises releases but does not order them**. A
drained queue lands whichever finishes last, and that can be an ancestor. The
host installs it without complaint, `06_redeploy.sh` health-checks it green, and
the workflow's "Verify the live site is this commit" step passes — because the
live commit *is* the one that run built. Every check the pipeline has is
satisfied by a release that undoes newer work.

**The fix is a monotonicity guard on the host side of the deploy**: before
installing, read the running `/api/health`, and refuse the install if the
incoming commit is an ancestor of what is already live. The workflow knows the
full sha; `git merge-base --is-ancestor` answers it in the runner, not on the
host, so the host needs no git checkout. Refuse with a distinct exit code and a
message naming both commits, and let a deliberate rollback opt out with an
explicit input (see defect 5 — the two features are the same mechanism read in
opposite directions).

This is the one to do first. It is cheap, it is precise, and it closes a
failure mode that produced an outage-shaped event that looked like a revert.

### 2. A commit can reach `main` and never deploy

**Eight of the last thirty push-on-`main` runs were cancelled**, among them real
merges: `#69`, `#68`, `#62`, `#61`, `#60`, `#59`, `#58`. The workflow-level
concurrency group is `CI-refs/heads/main` with `cancel-in-progress` false for
pushes — but GitHub keeps at most **one** pending run per group, so when three
merges land inside a minute the middle one is cancelled before it starts. Its
content still reaches production inside the next successful run, so nothing looks
broken; what is lost is the *guarantee*. If the last push in a burst is the one
that gets cancelled, `main` sits ahead of production indefinitely and no red
build says so.

That is not hypothetical either — `6325fa5` and `e065a8d` are empty commits whose
entire purpose was to emit a push event and drag a stalled tip to the host, and
`8fa12e5` is a third. Three commits of pipeline exhaust in the history of one
repository is the symptom.

**Two changes, both small:**

- **Make the deploy reconcile rather than react.** A scheduled job (every 15
  minutes, plus `workflow_dispatch`) compares `origin/main` against the sha at
  `/api/health` and, when they differ and `main` is descended from live, deploys
  the tip. A pipeline that converges on "live == main" cannot be defeated by a
  dropped event; one that only reacts to pushes can, and was.
- **Stop gating `deploy` on `github.event_name == 'push'`.** That gate is what
  made `workflow_dispatch` useless during the incident — recorded in `8fa12e5`'s
  message: "Deploy is gated on `github.event_name == 'push'`, so a
  workflow_dispatch cannot stand in for one — it skips the job." Gate on the ref
  and on the run being for `main`, not on the event that produced it.

### 3. The artifact that is tested is not the artifact that ships

`check` builds a payload, boots `dist/server.cjs`, and smoke-tests three
endpoints. `deploy` then checks out again, runs `npm ci` again, and builds a
**second, different** payload — which is the one that goes to S3. Nothing tests
the bytes that reach production.

In practice the two builds agree, because `build.sh` is deterministic given a
checkout. But "in practice" is doing the work that a build-once-promote pipeline
does structurally, and the divergence it protects against is exactly the kind
that appears once, under a toolchain change, at the worst moment. It also costs
a redundant install-and-build on every release.

**Build once in `check`, upload `release.tar.gz` as a workflow artifact, and have
`deploy` download it.** The tarball is what the smoke test ran against, so the
promotion carries the evidence with it. `e2e` should take the same artifact — see
gap C.

### 4. A green deploy reports a red run

Run `32993785303` deployed `8fa12e5` successfully, verified the live commit, and
**concluded `failure`** — because the advisory `screenshots` job went red in the
same run. `CLAUDE.md` already warns about this ("a red advisory job sets the whole
run to `failure` while `deploy` succeeds, and that has been misread as a stopped
pipeline more than once"), which is a documentation fix for a tooling problem.

The workflow comment defends, at length and correctly, why `screenshots` must not
be in `deploy`'s `needs`. That argument is sound and none of it is disturbed by
also making the job **not turn the run red**: `continue-on-error: true` on the
job, with the check's findings written to `$GITHUB_STEP_SUMMARY` so the debt is
still visible where someone reads it. An advisory that can only speak by lying
about the release is worse than one that speaks in the summary.

Two further options, either of which can follow later: move it to its own
workflow so it has its own badge, or have it open/update a single issue. Neither
is needed to stop the misreading.

### 5. There is no way back

`07_install_release.sh` does `rsync -a --delete "$STAGING/dist/" "$DEPLOY_DIR/dist/"`.
The previous build is destroyed in place. If `06_redeploy.sh` finds the new one
unhealthy it exits 1 and prints forty lines of journal — and leaves the service
down, with nothing on disk to go back to.

Recovery today means finding the previous sha by hand, knowing that S3 holds
`releases/<sha>.tar.gz`, and driving SSM manually. That is a runbook nobody has
written and nobody has rehearsed, to be performed during an outage.

**Three changes, in order of value:**

- **Keep the previous release.** Install into `releases/<sha>/` and flip a
  `current` symlink, or at minimum copy `dist/` to `dist.previous/` before the
  rsync. The systemd unit follows `current`.
- **Roll back automatically on a failed health check.** `06_redeploy.sh` already
  knows the deploy failed; put the flip-back and restart in that branch, so the
  default outcome of a bad release is the previous release running, not nothing
  running.
- **Add a `rollback` workflow**, `workflow_dispatch` with a sha input, that
  installs `releases/<sha>.tar.gz` and sets the monotonicity guard's override
  flag. This is the deliberate-descent case from defect 1.

Note the S3 objects have no stated lifecycle policy in this repository. Before
depending on them for rollback, **verify one exists and that it retains enough
history** — a 30-day expiry would make the rollback target vanish exactly when a
long-lived regression is found.

### 6. Nothing proves the *bundle* passes the end-to-end suite

`playwright.config.ts` boots `npx tsx server.ts` — the **dev** server, through
Vite middleware. The 316 specs that gate every release therefore never touch
`dist/server.cjs`, which is what production runs. `check` boots the bundle but
only asks it three questions: health, standings, and that the index says
"Portal Brasileirão".

The gap that matters is the production-only path: `registerSpaFallback`,
`injectMeta`, the 404 rules, the JSON-LD. `CLAUDE.md` records that Vite's `"spa"`
fallback once "took the handler out of the loop and hid the metadata, the JSON-LD
and every 404 rule from the whole e2e suite" — the same class of failure, caught
once by hand.

**Add a `PLAYWRIGHT_TARGET=bundle` mode** that boots `node dist/server.cjs`
against the built payload instead, and run a small subset of specs — the SEO,
metadata and 404 ones — against it in the `deploy` path. Not the whole suite:
the dev-server run is the fast feedback and should stay.

---

## The gaps that have not cost anything yet

Lower urgency, and each is genuinely small.

**A. Supply chain.** No Dependabot, no `npm audit`, no CodeQL. `dependencies`
ships to production via `npm ci --omit=dev` on the host, so a vulnerable
transitive dependency runs there. Add `.github/dependabot.yml` (npm + actions,
weekly, grouped) and an `npm audit --audit-level=high` step. Run audit in its own
advisory job for the same reason `screenshots` is advisory: an upstream advisory
published on a Tuesday must not be able to stop an unrelated release.

**B. Deployments are invisible to GitHub.** No `environment:` on the `deploy`
job, so there is no Deployments tab, no per-environment history, no URL badge,
and no place to hang a protection rule later. Adding
`environment: {name: production, url: https://brasileirao.mpbarbosa.com}` costs
two lines and gives the pipeline a record of what went where and when — which is
the thing you want when reconstructing an incident like defect 1.

**C. Redundant installs.** `check`, `e2e` and `deploy` each run `npm ci`.
`setup-node`'s cache makes this cheap but not free. Folding the built payload
into an artifact (defect 3) removes one of the three.

**D. No release identity beyond a sha.** No tags, no releases, no changelog.
This is fine for a solo-maintained app and becomes not-fine the moment a rollback
needs a human to choose a target from a list. A lightweight tag per successful
deploy (`deploy-YYYYMMDD-HHMMSS-<sha7>`) makes the rollback workflow's input
something a person can pick rather than something they have to derive.

**E. `sync-broadcasts` pushes straight to `main`.** It works today and will break
the day branch protection is enabled — which is the next item. Have it open a PR
instead; the data is not urgent enough to need direct-push privileges, and its own
workflow already lints and unit-tests the result, so the PR would be green on
arrival.

**F. `main` is protected by convention only.** `CLAUDE.md`'s protocol says "No
session merges into `main`" and "propose, do not act", and that has held. It is
a social rule with no mechanical backing: verify what branch protection actually
exists and, if none does, require `check` and `e2e` as status checks. Note this
interacts with E and with the reconciling deploy — do those first.

**G. The curated-data checkers never run.** `check-hymns`,
`check-stadium-photos`, `check-player-wikipedia`, `check-player-photos` are all
manual. `CLAUDE.md` is explicit that this is deliberate — "CI has no network
dependency on a third party by design, and a link that rots on someone else's
server is not a reason for a red build on a commit that did not touch it" — and
that rule is right and must not be softened. A **scheduled monthly workflow that
opens an issue** rather than failing a build honours it exactly: it is not CI on
a commit, and it cannot redden anything. Worth doing last, and only in that shape.

---

## Phases

Each phase is independently shippable and leaves the pipeline working.

### D0 — Tell the truth about what exists — **done**

Correct `CLAUDE.md`'s "No deploy has ever run against a real host", and the
paragraph after it about `shell_scripts/` being unexercised. Add a short
**Pipeline** section recording the actual topology: OIDC → S3 → SSM → 
`07_install_release.sh` → `06_redeploy.sh` → live-commit assertion.

*Exit:* the two authoritative documents agree about whether production exists.
No workflow change. No risk.

### D1 — Production cannot move backwards — **done**

Defect 1. Ancestry guard in the `deploy` job before the SSM call, comparing
`GITHUB_SHA` to the sha at `${SITE_URL}/api/health`, with an explicit override
input for rollbacks.

*Exit:* a manually-dispatched deploy of a known ancestor is refused, naming both
commits; a normal push still deploys.

### D2 — Every commit on `main` reaches production — **done**

Defect 2. `.github/workflows/reconcile.yml`, every 15 minutes.

**Half of this shipped with D1**: the `event_name == 'push'` gate had to go
before the ancestry guard could be tested at all, because `main` only moves
forward and no push can present an ancestor to refuse. The reconciler is the
other half.

It **decides**; `ci.yml` deploys. Dispatching a normal run rather than carrying
a second copy of the deploy logic means a reconciled release goes through the
same `check`, `e2e`, ancestry guard and live-commit assertion as any other.

Its bias is the **opposite** of the ancestry guard's, and that asymmetry is the
design. The guard fails **open** — it decides whether a release a person asked
for may proceed, and during an outage deployability beats ordering. The
reconciler fails **safe** — it starts a release nobody asked for, unattended, so
anything it cannot establish means it does nothing and says why. It hands off on
an unreachable site (that is an incident, not a gap), an unusable or unknown live
sha, a live commit absent from the checkout, a divergent history, and whenever a
CI run for `main` is already in flight.

*Exit:* met. Nine cases exercised against the shipped script; it dispatches in
exactly one — a real gap where `main` descends from live — and holds in the other
eight.

*Exit:* delete the tip's workflow run mid-flight (or dispatch from a stale state)
and observe the reconciler deploy within one interval, once. Then no more empty
nudge commits, ever.

### D3 — Build once, promote

Defect 3. `check` produces `release.tar.gz` as a workflow artifact; `deploy`
consumes it. Depends on nothing; unblocks D5.

*Exit:* the sha inside the deployed bundle's `/api/health` matches a payload the
smoke test ran against in the same run; `deploy` no longer runs `npm run build`.

### D4 — A bad release does not become an outage

Defect 5. Previous release retained, automatic flip-back on a failed health
check, `rollback.yml` with a sha input. Verify the S3 lifecycle policy first.

*Exit:* a deliberately-broken payload deployed to the host leaves the *previous*
build serving and the workflow red. This is the one phase that must be rehearsed
rather than reasoned about.

### D5 — The bundle is what gets tested

Defect 6. `PLAYWRIGHT_TARGET=bundle`; SEO/metadata/404 specs run against
`dist/server.cjs` from the D3 artifact.

*Exit:* deliberately breaking `registerSpaFallback` for the production branch
only turns the suite red.

### D6 — Hygiene

Defects 4 and gaps A, B, D, E, F, G, in that order. Small, independent, each one
a commit.

---

## What this deliberately does not add

Recorded because a deliberate no is worth more than an unconsidered yes, and
because each of these is the obvious next suggestion.

- **A staging environment.** One EC2 instance, one maintainer, and a deploy that
  takes forty seconds with a live-commit assertion and (after D4) an automatic
  rollback. A second host doubles the provisioning surface — nginx, certbot,
  systemd, the CloudWatch agent, a second `.env` that will drift — to catch
  failures that the bundle smoke test and the bundle-mode e2e run catch on a
  runner for nothing. Revisit if the app grows a database or anything else with
  migration state, which is the thing a staging host genuinely earns its keep on.
- **Blue/green or canary.** Same argument, one step further. The unit of traffic
  here is small enough that "restart and health-check, roll back if unhealthy" is
  the honest shape.
- **Containers.** The payload is `dist/` plus a lockfile and the host runs
  `npm ci --omit=dev`. An image would make the artifact more hermetic and would
  also add a registry, a build step that cannot run on the small production box,
  and a second way for the `.env` to go missing. Not now.
- **PR preview environments.** The e2e suite runs against the frozen snapshot on
  every PR and the screenshots document appearance. A preview host would want the
  live provider and the 10 req/min budget does not stretch to one per PR.
- **`FOOTBALL_DATA_TOKEN` as a CI secret.** `CLAUDE.md` forbids it and is right:
  a red build must always mean the code broke, never that the upstream had a bad
  minute. Nothing in this plan needs it. The `sync-broadcasts` workflow already
  holds it and that is the correct and only place.

## Order, and the one thing to do today

D0 and D1 are both an afternoon and both close things that have already gone
wrong. D2 removes an entire category of manual intervention and is the phase that
will feel like the pipeline stopped needing supervision. D4 is the one that needs
a rehearsal rather than an argument, so give it a window rather than fitting it
in.

If only one thing gets done: **D1**. Everything else in this document costs time.
That one prevents the pipeline from silently undoing merged work, which is the
only failure here that has already looked, to the people watching it, like data
loss.
