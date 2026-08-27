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

Lower urgency, and each is genuinely small — with one exception, which has since
stopped qualifying and is recorded first.

**A. Supply chain — this one has now cost something, and is promoted to a phase
of its own.** It was filed here on the reasoning that nothing had gone wrong yet.
Then the deploy of `35a7074` ended with a deprecation warning that
`actions/download-artifact@v6` and `aws-actions/configure-aws-credentials@v5`
were being force-run on node24, and closing it by hand took a survey of all six
actions across three workflows, two release-note readings for the breaking
changes, a pull request, a merge and a deploy.

Dependabot would have opened that pull request itself, before the warning ever
appeared. The cost was not large, but it was **real, avoidable and recurring** —
the next runtime deprecation arrives on GitHub's schedule, and the failure mode
is silence until a build turns red on a commit that changed nothing. Everything
else in this section is still genuinely theoretical; this stopped being so. It
is **D4** below.

The rest of the item stands as written: `dependencies` ships to production via
`npm ci --omit=dev` on the host, so a vulnerable transitive dependency runs
there. `npm audit --audit-level=high` belongs in its own advisory job for the
same reason `screenshots` is advisory — an upstream advisory published on a
Tuesday must not stop an unrelated release.

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

### D3 — Build once, promote — **done**

Defect 3. `check` packages the `dist/` it just booted and smoke-tested, uploads
it with its sha256, and publishes that digest as a job output. `deploy`
downloads the artifact and refuses to continue unless it still hashes to the
same value — so "the tested build is the shipped build" is a checked fact, not
an assumption about the build being deterministic. `deploy` now runs no
`setup-node`, no `npm ci` and no build.

`check` packages only on a run that can deploy. A `pull_request` run builds and
smoke-tests identically, but its HEAD is the synthetic merge ref rather than a
commit that will ever ship, so uploading 19 MB per PR would buy nothing.

*Exit:* met. `deploy` no longer runs `npm run build`; the digest check was
exercised on a real 19 MB payload across its three branches — matching digest
promotes, mismatched digest refuses, absent digest refuses.

### D4 — Dependencies stay current without anyone watching — **done**

Gap A, promoted out of the "not yet cost anything" list because it stopped
qualifying — the node24 episode above is the evidence. `.github/dependabot.yml`
covering **`github-actions` and `npm`**, weekly, grouped so twenty minor bumps
arrive as one pull request rather than twenty.

The actions ecosystem is the half that just proved itself and is also the
cheaper half: action pins are a handful of lines, the blast radius of a bad bump
is one workflow, and CI tells you immediately. The npm half needs more care —
a major bump to `express` or `vite` deserves reading, which is what grouping and
a weekly cadence are for.

**This is deliberately placed before the rollback work even though rollback is
the more severe gap.** The ordering is cheapness, not severity: this is one file
and cannot break a release, while rollback needs a precondition established, a
host-side change and a rehearsal. Doing the ten-minute thing first is not the
same as thinking it matters more, and the severity ordering is recorded here so
the sequence is not misread as a ranking.

*Exit:* met, and sooner than expected. This was written saying the exit could
not be made to happen on demand — Dependabot in fact evaluated the manifests
within minutes of the file landing and opened five pull requests: two grouped
(`actions`, `npm-minor-and-patch`) and three isolated majors (`typescript`,
`@types/node`, `@vitejs/plugin-react`). The split worked exactly as designed.
GitHub also validates the file itself, as a `.github/dependabot.yml` check run.

**Two refinements came out of that first run, and both are now in the file.**
This is the useful shape for a phase like this: the config was wrong in ways
only its own output could reveal.

- **`vite` and `@vitejs/plugin-react` are a pair.** Isolating every major
  offered plugin-react 6 against vite 6, and plugin-react 6 declares
  `peer vite@^8` — so the pull request failed at `npm ci` with ERESOLVE before
  any code ran. Unmergeable by construction, and it would have returned every
  Monday. They are grouped now, so their majors arrive together or not at all.
- **`esbuild` is 0.x, where the minor is the breaking position.** Semver calls
  0.25 → 0.28 a minor and it was grouped as one; for a 0.x package that is a
  major in all but the number, and esbuild bundles `server.ts` into
  `dist/server.cjs`. Isolated now — though honestly the weaker of the two, since
  `check` builds the bundle, boots it and smoke-tests three endpoints, so that
  bump was in fact well covered and went green. It buys an unambiguous failure,
  not new safety.

### D5 — A bad release does not become an outage — **done, bar one live exercise**

Defect 5. Previously D4; renumbered when the item above was promoted.

**The value here is speed and autonomy, not possibility — and that is a
correction to what this document said before.** "There is no way back" was too
strong. In a forward-only `main` the idiomatic way back is `git revert`, which
produces a new commit that deploys through the ordinary pipeline and takes about
four minutes. What is missing is the part that needs no human at all, and the
part that takes forty seconds instead of four minutes:

1. **The previous release is destroyed in place.** `07_install_release.sh` does
   `rsync -a --delete` into `dist/`, so when `06_redeploy.sh` finds the new build
   unhealthy it exits 1 and leaves the service down with nothing on disk to
   return to. **This is the item that matters**; the rest is convenience.
2. **Recovery requires a person**, who must be present, notice, and know the
   procedure — during exactly the window when the site is down.

**A precondition, to be established before any of it is designed:** does the S3
bucket have a lifecycle policy on `releases/`, and what does it retain? Nothing
in this repository says. A 30-day expiry would make an artifact-reinstall
rollback fail precisely when a long-lived regression is found, and would push the
design toward keeping the previous release **on the host** instead. This
determines the shape of the phase, so it is discovery, not a step.

**A finding about D1 that belongs here.** The `allow_non_descendant` override
shipped with the ancestry guard is, today, effectively **unreachable**. `deploy`
is gated on `github.ref == 'refs/heads/main'`; `workflow_dispatch` accepts a
branch or tag but never a bare sha; and `main` only moves forward. So the guard
can only refuse a commit that is an ancestor of live when `main` itself has been
moved backwards, which nobody should do. The override is not wrong — it is the
correct escape hatch for a guard that must be overridable — but it has no door
yet, and this phase is where it gets one. Worth knowing before someone reads it
as dead code and deletes it.

**Scope splits cleanly by risk, and should be shipped in that order:**

- **Low risk:** a `rollback.yml` dispatch that installs a stored release by sha
  over SSM. Touches no existing path; if it is wrong, nothing that works today
  breaks.
- **Higher risk:** retaining the previous release on the host and flipping back
  to it automatically on a failed health check. This edits `06_redeploy.sh` and
  `07_install_release.sh`, which run on every release. Note the `releases/<sha>/`
  plus `current` symlink layout also drags in the systemd unit from
  `03_install_systemd_service.sh` — provisioning, not deploy — whereas copying
  `dist/` to `dist.previous/` before the rsync touches nothing outside the two
  scripts. Prefer the smaller change unless the symlink layout earns itself.

**Rehearsal, because this is the one phase that can leave production down.** Do
it in two stages rather than by deliberately breaking a real release:

1. **Stub the externals and exercise the logic locally**, the way the ancestry
   guard and the reconciler were both exercised in this plan: extract the script,
   fake `systemctl` and the health URL, and drive every branch — healthy,
   unhealthy-with-a-previous, unhealthy-with-no-previous, flip-back-itself-fails.
   That last one is the one worth writing first, because a flip-back that fails
   silently is worse than no flip-back.
2. **Then one controlled live exercise**, in a low-traffic window, with the
   forward path ready to re-run.

*Exit:* a payload that fails its health check on the host leaves the **previous**
build serving and the workflow red — demonstrated, not argued. **Met against
stubs; the live half is still outstanding** — see both sections below.

#### What shipped: retention and flip-back on the host

The higher-risk half, and the one the phase said actually matters. It is the
**smaller** of the two designs the plan offered: `07_install_release.sh` copies
the release already on disk into `$DEPLOY_DIR/previous/` before the rsync
destroys it, and tells `06_redeploy.sh` where it went. Nothing outside those two
scripts changes — no `releases/<sha>/`, no `current` symlink, and so no edit to
`03_install_systemd_service.sh`. The unit still runs `dist/server.cjs` from
`WorkingDirectory=$DEPLOY_DIR`, which is exactly why swapping the contents of
`dist/` is enough.

**`package.json` and `package-lock.json` are retained alongside `dist/`, and
that is not tidiness.** `06_redeploy.sh` runs `npm ci --omit=dev`, which
*prunes*. A release that drops a dependency therefore deletes modules the
release before it still needs, so restoring `dist/` alone would flip back to a
build whose `node_modules` had just been removed — a flip-back that reliably
fails on precisely the kind of change most likely to need one.

**The retention is staged, then moved into place.** `previous.incoming/` is
built first and renamed over `previous/` only when complete, because
`06_redeploy.sh` decides a rollback target is usable by checking that three
files exist. A half-copied directory passing that check is how a recoverable bad
release becomes an unrecoverable one.

**A failed retention stops the deploy.** The usual cause is a full disk, which
is also what makes the `npm ci` and the restart fail moments later; refusing
while the running release is still intact beats destroying it and then
discovering the same problem.

**Flip-back is opt-in, and `07` is the only thing that opts in.** `06` reads
`ROLLBACK_FROM`; a standalone run — the operator redeploying after an `.env`
change, which is what `06` is documented for — leaves it unset and behaves
exactly as it did before. Having `previous/` on disk is deliberately not enough
to trigger a rollback, or an operator would find the build swapped underneath
them.

**Exit codes now distinguish the three outcomes**, because "the deploy failed"
and "the site is down" need different responses at different hours: `2` means the
previous release is serving and the pipeline should be red, `3` means the
flip-back also failed and a person is needed. `1` keeps its old meaning. `ci.yml`
treats every non-zero the same way, so nothing downstream had to change.

**Rehearsal: stage 1 is done and is committed as
`scripts/rehearse-flip-back.sh`.** It drives all eight branches against a stubbed
`systemctl`, `sudo`, `npm` and `journalctl`, with a real HTTP server standing in
for the health endpoint so the real `curl -sf` is exercised. The `systemctl` stub
reloads whatever `dist/` holds at that moment, so health after a restart is a
property of the bytes the script put there rather than of the harness. 31
assertions, and the flip-back-fails case was written first as the plan asks.

Three deliberate mutations were run against it to check it has teeth: a
`flip_back` that returns success without restoring anything, a `07` that never
retains, and a flip-back that fires on a *healthy* release. All three go red —
10, 12 and 5 assertions respectively.

**One thing the rehearsal caught that reading would not have.** `rsync -a`'s
quick-check compares size and mtime, not bytes, so the first fixtures — two
releases whose `server.cjs` differed only in a sha and were written in the same
second — were silently *not installed*, and the case still passed because both
were healthy. That is a property of the harness rather than of production, where
a release tarball carries the build's own mtime, but it is the exact shape of
failure that makes a green run meaningless.

**Stage 2 now has a runbook: [`flip-back-drill.md`](flip-back-drill.md)**, whose
command block was dry-run in full against a real bundle and a real server
process before being written down. It drills the starts-but-unhealthy mode,
which is the one systemd cannot catch, and which keeps every page serving while
it runs.

**Still outstanding: stage 2 itself, the controlled live exercise.** Nothing here has
run against the host. The observable that will prove it is `/api/health`
reporting the **previous** sha while the `deploy` job is red — and the host
stdout in the "Install the release on the host" step carrying `ROLLED BACK` and
the retained path. Until that has been read, this is verified logic on an
unexercised path, which is what `CLAUDE.md` already says about all of
`shell_scripts/`.

**Not covered, and deliberately:** `scripts/deploy.sh` neither retains nor flips
back. It carries its own inline remote block and never calls `06` or `07`, so it
is untouched by this change. `CLAUDE.md` already forbids running it by hand, and
teaching it this would mean a third copy of the restart-and-health logic.

#### What shipped: `.github/workflows/rollback.yml`

The low-risk half, as the risk ordering above says it should be. It installs a
release S3 already holds, over whatever is live, in about forty seconds and
with no build. It deliberately does not route through `ci.yml`: those bytes
were built, booted and smoke-tested by `check` when they were made, and
rebuilding them to roll back would re-test them with a *newer* toolchain, which
is the one thing you do not want when the point is known-good bytes. It carries
no ancestry guard for the same reason — going backwards is the purpose here,
where in `ci.yml` it is the accident.

It shares `ci.yml`'s `deploy-production` concurrency group, so a rollback and a
release can never install at the same moment.

**The precondition got answered operationally instead of in advance.**
Dispatching with an empty sha lists what the bucket holds and changes nothing.
Nothing in this repository defines a lifecycle policy on `releases/` and no
session working from a checkout can read one, so rather than guess a retention
window, the workflow's safe default *is* the question: run it and look. The
listing is best-effort — the deploy role demonstrably holds `s3:PutObject` and
the SSM permissions, and may or may not hold `s3:ListBucket` — and a failure to
list says which permission is missing and does not stop a rollback, because the
host's own `aws s3 cp` is what proves the object is there.

#### The finding that made this phase necessary rather than merely nice

**The reconciler would have undone every rollback within fifteen minutes.**
After a rollback, production is behind `main` — which is *exactly* the shape
D2 exists to close. Nothing distinguished a deliberate rollback from a dropped
push event, so `reconcile.yml` would have dispatched `ci.yml` and rolled
production forward again while somebody was still working out what broke.

`reconcile.yml` now holds when a successful `rollback.yml` run is newer than the
last successful `ci.yml` run on `main`. That test is **stateless on purpose**:
no flag is set, so none can be left set. It clears itself the moment a fix
reaches `main` and deploys, because that run then becomes the newer of the two.
Fifteen cases exercised against the shipped script — the five new ones plus all
ten from D2, which had to keep passing.

#### Correction: `allow_non_descendant` still has no door

This plan said D5 was where `ci.yml`'s override would become reachable. Having
designed the phase, that turns out to be wrong. `rollback.yml` does its own SSM
install and never enters `ci.yml`, so the override remains reachable only if
`main` is moved backwards. It is not costing anything and it is the correct
escape hatch for a guard that must be overridable — but the door is still not
there, and a later phase should either build one or remove it deliberately
rather than leaving this note to rot.

#### What remains: the half that can leave production down

Untouched, and still the reason this phase wants a window rather than a gap
between other things:

- `07_install_release.sh` still does `rsync -a --delete` into `dist/`, so a
  payload that fails its health check leaves the service down with **nothing on
  disk to return to**. `rollback.yml` shortens that outage from "find the sha,
  drive SSM by hand" to one dispatch, which is worth having — but it still
  needs a person.
- The automatic flip-back on a failed health check, which needs no person at
  all, is the item that actually closes defect 5.

Do that with the two-stage rehearsal above: stub `systemctl` and the health URL
and drive every branch — writing *flip-back itself fails* first — before any
live exercise.

### D6 — The bundle is what gets tested — **done**

Defect 6. Previously D5. `PLAYWRIGHT_TARGET=bundle` boots `dist/server.cjs`
under `NODE_ENV=production` instead of `server.ts` through tsx, and runs the
three specs — `seo`, `page-meta`, `routing` — that cover a path production has
and development does not. 48 tests.

Only those three. Re-running the whole suite against the bundle would double
the wall clock to re-assert what the Vite run already proved; the production
branch of `server.ts` differs in exactly one region — `express.static` over
`dist/`, the shell read **once at boot**, and no Vite — and that is what these
reach through `registerSpaFallback` and `injectMeta`.

**It builds its own payload rather than consuming D3's artifact**, and the
distinction is worth stating: this tests the production **code path**, not the
shipped **bytes**. D3's digest already covers the bytes, and `check` packages
only on a run that can deploy — so waiting for an artifact would leave every
pull request without this, which is precisely where it earns its keep.

One trap, and it is a hard failure rather than a subtle one: `server.ts`
**refuses to start** with `ACCOUNTS_DEV_LOGIN` set when `NODE_ENV` is
production. The config empties it in bundle mode rather than omitting it, so a
value inherited from the surrounding shell cannot take the whole run down; the
Contas specs stay outside `testMatch` there for the same reason.

*Exit:* met, and demonstrated rather than argued. `express.static(distPath,
{ index: false })` — a line that exists only in the production branch — was
flipped to `{ index: "index.html" }`, which is the exact failure `CLAUDE.md`
records for Vite's own SPA fallback: the static handler serves the shell for
`/` and takes `registerSpaFallback` out of the loop, so no metadata is
injected. The result:

| mode | outcome |
|---|---|
| **dev** — the suite as it was | **48 passed**, entirely blind to it |
| **bundle** | **1 failed** — `seo.spec.ts:128 › the table describes the site` |

Then reverted, rebuilt, and green again at 48.

### D7 — Hygiene

Previously D6. Defect 4 and gaps B, D, E, F, G — gap A having become D4.
Small, independent, each one a commit.

Defect 4 (the advisory `screenshots` job reddening a successful release) has now
been observed **six times** in the runs behind this plan, including on three of
its own pull requests. It is the cheapest item left and the one most likely to
cause a real misreading, so take it first.

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

## Order, and what is left

**D0 through D3 are done, merged, and each verified against production rather
than against CI**: the ancestry guard printing `OK: 73810f3 is 5 commit(s) ahead
of live c6e2f47`, the reconciler printing `In sync`, and — for build-once-promote
— the live `builtAt` timestamp predating the deploy job that shipped it, which is
the observable that only holds if the payload was carried forward rather than
rebuilt. The node24 bump is merged too, verified by the deprecation warning's
absence.

What remains, in order: **D4** (Dependabot, one file), **D5** (rollback),
**D6** (bundle-mode e2e), **D7** (hygiene).

**D5 is the one to give a window to rather than fit in.** It is the only
remaining change that can leave production down if it is wrong, and the only one
with a precondition — the S3 lifecycle policy — that could change its design
before a line is written. Everything else here can be done between other things.

### How this plan has changed since it was written

Recorded because a plan that quietly renumbers itself is worse than one that
says so.

- **Gap A became D4.** It was filed as theoretical; the node24 deprecation made
  it concrete. The old D4–D6 shifted to D5–D7.
- **"There is no way back" was too strong.** `git revert` plus the ordinary
  pipeline is a way back. D5's case is now speed and autonomy — forty seconds
  without a human, against four minutes with one — and specifically that
  `rsync --delete` leaves nothing on disk to return to when a health check fails.
- **D1's `allow_non_descendant` has no door.** Found while adjusting this plan,
  not while writing it: the deploy gate pins to `refs/heads/main`,
  `workflow_dispatch` cannot name a sha, and `main` is forward-only. D5 is where
  it becomes reachable.
- **Defect 4's count is now six**, three of them on this plan's own pull
  requests. It leads D7 for that reason.
