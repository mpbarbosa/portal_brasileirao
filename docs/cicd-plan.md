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
scripts, runs the end-to-end suite across two devices, and then — on a push to
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

**Done.** `continue-on-error: true` on the job, and the check's findings written
to `$GITHUB_STEP_SUMMARY` — the verdict taken from the exit status rather than by
parsing the output, and the output folded into a `<details>` block because most
of it is the refresh recipe, which buries the finding until you have decided to
act.

The count was understated here. Measured over the 30 push-on-main runs before the
change: **17 concluded `failure`, in all 17 the only failing job was this one,
and in all 17 `deploy` succeeded.** Not "usually a false alarm" — every red
push-on-main run in that window was this defect, and every one of them shipped.
Six concluded `success`.

**It also unjammed something nobody had observed.** `reconcile.yml`'s rollback
hold asks for the last *successful* `ci.yml` run on main and holds while a
rollback is newer than it. Every release this job reddened was invisible to that
query, so after a rollback a fix that deployed and was reddened here would have
left the reconciler holding against a stale timestamp instead of clearing itself
— and with `screenshots` red on main until someone refreshes, it would not have
cleared at all. At the time of the change the newest successful run that query
could see was **47 minutes and nine releases behind** the newest run. It had
never fired only because a rollback has to happen first. The comment there is
updated rather than deleted: the old defence was sound, and a reader who meets
only the new state cannot tell that the hazard was removed at source rather than
never having existed.

**The other two options were weighed and not taken**, recorded because each is
the obvious next suggestion:

- **Its own workflow, its own badge.** The badge is per-workflow and per-default-
  branch, so this would put a *permanently red* badge in the README beside the
  very images it is complaining about. That reads well for one week and trains
  readers to ignore badges thereafter, which is the failure mode this whole
  defect is an instance of. It also duplicates the `fetch-depth: 0` checkout and
  the trigger matrix, and would drop the signal from pull requests unless both
  were maintained. The existing CI badge becoming *honest* is worth more than a
  second badge that is permanently not.
- **Open or update a single issue.** Needs `issues: write` on a job that today
  needs nothing, and produces a bot notification on every merge while the debt
  stands. An issue is the right shape for debt that nobody is otherwise looking
  at; this debt is created by a pull request and is visible on that pull
  request's own checks, which is where it is actionable.

The summary was enough, for the reason the plan gave and one it did not: the
debt is created by a change under review, and the pull request is where a person
can still act on it cheaply. On `main` it is history.

**And the claim that the debt stays visible was checked rather than assumed.** It
was this entry's weakest-evidenced clause, because `continue-on-error: true` at
**job** level has two possible renderings and nothing in this repository could
distinguish them — there was no `continue-on-error` anywhere in `.github/` to read
a run history from. Either the job still reports `failure` and the checks list
still shows a red row, only the *run's* conclusion flipping; or the job is
reported to the Checks API as succeeded, the pull request says "All checks have
passed", and the summary tab is the only trace. The first costs almost nothing.
The second is the objection: a visible debt traded for an invisible one, which is
the failure mode this defect is already an instance of.

The merge of the change is the first observation of the **full** scenario — a red
`screenshots` beside a **green `deploy`** — which no pull request can show,
because `deploy` is skipped there. Run `33074799866` (head `339a037`), against the
push-on-main run immediately before it under the old behaviour, `33067205785`
(head `27ea045`):

| surface | without (`27ea045`) | with (`339a037`) |
|---|---|---|
| run conclusion | `failure` | **`success`** |
| jobs API — `README screenshots are current` | `failure` | `failure` |
| jobs API — `Deploy to production` | `success` | `success` |
| check runs for the head sha — `README screenshots are current` | `failure` | `failure` |

The last row is what the question turned on. `/commits/{sha}/check-runs` is the
surface the pull request's checks list renders, and it still says `failure`; the
three surfaces can disagree, so reading the run conclusion alone would not have
answered this either way. Every conclusion is identical across the two arms except
the run's. So the reading is the first one: the debt keeps the red row it had, in
the place a person actually looks, and the only thing removed was the run's claim
about the release. The job log confirms it was not silenced from the other
direction either — it carries the check's real finding (`a9521f1`) and
`Process completed with exit code 1`. How GitHub *renders* the folded `<details>`
block remains unobserved; only that it was written without error.

**What this does not settle is whether the debt still gets cleared as fast.** The
signal being replaced was working. Over `origin/main`'s first-parent history since
the check began firing, an appearance commit was followed by a refresh in a median
of **0.50 hours**, p90 **3.70**, max **10.94**, with **no episode over a day**
across 51 commits; the three episodes over a day in the full history all predate
the check. That is the floor a replacement has to hold — but it is a *pre-change*
measurement, taken minutes after the change landed, and the one debt outstanding
(`a9521f1`, 3.7 hours old at the time of writing) accrued almost entirely under
the old behaviour. It is also a floor on responsiveness rather than a controlled
experiment: one maintainer, a short window, and an appearance-path filter that
counts commits touching a file without necessarily moving a pixel. Re-measure
before concluding the floor held. The mechanism is settled; the outcome is not.

**Correction: that floor is optimistic, because of how it was measured.** It
pairs each appearance commit with *the next commit touching `docs/screenshots` by
timestamp*, which credits a refresh that was **shot before the change and merely
committed after it** — the exact case `CAPTURED` exists to expose, and one the
measurement predated using.

The episode that revealed it is the one named above. `a9521f1` reached `main` in
`22f7740`; the measurement credited `50cffbd`, merged **two minutes** later, and
scored the episode at **0.03 hours**. But `50cffbd`'s own `CAPTURED` reads
`6045f2e` — a capture taken before `a9521f1` existed — so it cleared nothing. The
check stayed red for another **2.99 hours** across nine releases until `3ca6ee6`
landed a re-shoot anchored at `218707e`. A refresh being *newer than* the change
is not the same as its depicting the change, which is the same distinction
`check-screenshots.sh` draws and the measurement did not.

Re-measured the way the check actually decides — a refresh clears an appearance
commit only when the sha in its `CAPTURED` has that commit as an ancestor — over
the window where `CAPTURED` exists at all (13 refreshes, 18 episodes; every
refresh in that window has a readable anchor, and the 22 without one all predate
the file):

| | naive (next by timestamp) | anchored on `CAPTURED` |
|---|---|---|
| median hours | 0.40 | **0.78** |
| p90 hours | 1.81 | **2.99** |
| max hours | 10.94 | 10.94 |
| episodes over 24h | 0 | 0 |

So roughly **double on the median** and **1.6× at p90**. The headline figures
above cannot simply be restated in anchored form — they cover a wider window in
which `CAPTURED` does not exist for most episodes, so there is nothing to anchor
on — but the correction factor found where both can be computed is the right way
to read them. Treat the floor as optimistic by about that much.

**What does not change is the conclusion.** No episode exceeds a day under either
method, the maximum is identical, and the debt is still cleared the same day. The
floor is softer than it was stated to be; it is not a different verdict. Anchor
any future re-measurement on `CAPTURED` rather than on commit order.

**There is now a script, and it stopped guessing.** `npm run measure-refresh-latency`
(`scripts/measure-refresh-latency.ts`, with the arithmetic in
`refresh-latency-core.ts`) **replays `scripts/check-screenshots.sh` itself** across
`main`'s first-parent history in a throwaway worktree and measures the runs of red.
It forms no opinion about when debt begins or ends, because that is what the gate
already decides and the gate is the thing that goes red.

That matters more than tidiness: both hand-rolled measurements were pairing rules,
and **each was wrong in the same direction**. Four things the gate does that neither
of them did come free from replaying it — it compares appearance sources by
**content** rather than asking which commits touched a path, it walks every commit
rather than the first-parent line, it honours `Screenshots-unaffected:` trailers,
and it validates the `CAPTURED` anchor before trusting it. The replayed script is
the one that existed at each commit, so the verdict is the one the gate actually
gave; commits predating the script report as unmeasurable rather than as green.

**It confirms the corrected figures**, which is the useful part — 16 closed
episodes, median **0.76h**, p90 **2.99**, max **10.94**, none over a day, against
the 18 / 0.78 / 2.99 / 10.94 recorded above. The two extra episodes the anchored
pairing counted were commits the gate excuses; the shape of the distribution is
unchanged. So the correction above stands, and this is the tool to re-run rather
than a third method to reconcile.

    npm run measure-refresh-latency -- --split 339a037

`--split` partitions at a commit, which is how the open question is meant to be
answered: whether debt is still cleared as fast now that a red gate no longer
reddens the run. Git only, no network, nothing from the football-data budget.

**The first post-change episode has now closed, and it is longer than every
episode before it.** Measured 2026-08-29 00:22Z, `main` at `37bb199`:

| | before `339a037` | after |
|---|---|---|
| episodes | 16 | **1** |
| median | 0.76h | 11.76h |
| p90 | 2.99h | 11.76h |
| max | **10.94h** | **11.76h** |
| over 24h | 0 | 0 |

One episode, so there is no distribution to compare — but it exceeds the *maximum*
of the sixteen that preceded it, not merely their p90. On the face of it that is
the floor failing.

**It is recorded here rather than acted on, because the obvious confounder is not
excluded and cannot be by this measurement.** The sixteen pre-change episodes were
measured across roughly 36 hours of near-continuous merging; this one spans a
night. *Nobody was working* and *the red no longer prompts anyone* produce an
identical number, and nothing in the replay separates them. A single episode
straddling the quietest window of the week is the weakest possible evidence for a
behavioural claim, and the temptation to read it as a verdict is exactly what the
two corrections above were about.

So: **do not cite this as evidence the change was wrong.** What it does establish
is that the question is live and the answer is not obviously "the floor held" —
which is more than was known when `continue-on-error` was merged. Re-run the tool
rather than quoting this table; by the second or third closed episode the
overnight confounder will have washed out, and if the median stays anywhere near
11h that is a real finding worth acting on.

Two things to check before believing a future run of it: that the episodes it
counts are not all overnight, and that `over 24h` is still zero — the floor's
strongest claim was never the median but that debt has never once survived a day.

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

**B. Deployments are invisible to GitHub — done, on the second attempt.**
Shipped in #151, reverted in #156 because it took production down for ten
commits, and relanded once the trust policy accepted the claim it produces.

**What actually blocked it was IAM write access, not knowledge of the change.**
Worth recording, because two attempts were spent discovering it: the deploying
account (`user/mpb`) holds neither `iam:UpdateAssumeRolePolicy` under its default
credentials nor `sts:AssumeRole` on the deploy role, so the widening had to be
applied under a different profile. Anyone re-attempting this class of change
should establish *who can edit the role* before designing anything, the way the
phase's own precondition rule says.

**Both subjects were read, not derived.**
`.github/workflows/oidc-subject-probe.yml` prints the claim GitHub issues here,
with and without an environment, and touches no AWS. Run twice, independently,
with identical results — this repository's subject carries suffixes no document
predicts, so inference would have been a coin flip on a change whose failure mode
is a silent production freeze.

**The order that made it safe**, and the step most likely to be skipped: policy
first, then *confirm an ordinary release still deploys* (`192b50f`, an empty
commit, exercising the `ref` form against the widened condition), and only then
re-add the block. Reading a policy back proves it parses; only a deploy proves
STS evaluates it as intended.

**The original entry follows.**

**B (first attempt, reverted). Deployments are invisible to GitHub — blocked on
an IAM change.** Shipped in #151, it broke every release for ten commits and was removed
in #156 — not #155, which this document said until the merge that corrected it,
and which is in fact the broadcast-sync pull request in gap E below. Attaching the job to an environment **rewrites the OIDC subject claim**:
without one it is `repo:<owner>/<repo>:ref:refs/heads/main`, with one it becomes
`repo:<owner>/<repo>:environment:production`. The trust policy on
`portal-brasileirao-deploy` pins the first form with `StringEquals`, so STS
answered `Not authorized to perform sts:AssumeRoleWithWebIdentity` and the deploy
job died before reaching the host. Three merges failed and production sat ten
commits behind before anyone read a deploy log rather than the run's colour.

Nothing about the change looked wrong, which is the part worth carrying: the job
was untouched, and the entry below said in good faith that its behaviour was
unchanged. **The order to do this in is trust policy first** — then confirm a
release deploys, then re-add the block. Re-adding it alone takes production down
silently, and the failure reads as an AWS problem rather than a workflow one.

**Read the claim; do not derive it.** `.github/workflows/oidc-subject-probe.yml`
prints the `sub` GitHub actually issues here, in both forms, and touches no AWS.
It exists because this repository's subject carries suffixes no document predicts
(`mpbarbosa@19806781/portal_brasileirao@1344118398`), so inferring the
environment form from the ref form is a guess — and a trust policy built on a
wrong guess fails exactly the way the original bug did, at credential
configuration, with production frozen until someone reads a deploy log.

**The policy must accept BOTH forms, and this is the part most likely to be got
wrong.** Only `ci.yml`'s deploy job would carry the environment; `rollback.yml`
and `flip-back-drill.yml` have none and keep sending the ref form. A policy that
*replaces* the ref subject rather than adding to it leaves production deployable
and **unrecoverable** — the rollback and the drill lose access at the moment they
are most needed. `docs/oidc-trust-policy.json` is the widened document, differing
from the live policy only in that `sub` becomes a two-element list.

The original entry follows.

**B (as shipped, now reverted). Deployments are invisible to GitHub.** There was no `environment:` on
the `deploy` job, so there was no Deployments tab, no per-environment history, no
URL badge, and no place to hang a protection rule later. The job now declares
`environment: {name: production, url: https://brasileirao.mpbarbosa.com}`, which
gives the pipeline a record of what went where and when — the thing you want when
reconstructing an incident like defect 1, which was in fact reconstructed by hand
from run timestamps.

No protection rule exists on that environment, so the job's behaviour is
unchanged. Worth knowing before anyone adds one: a required reviewer on
`production` would make **every** deploy wait for a human, including the
reconciler's unattended ones. That is a deliberate choice to make, not a side
effect to discover.

**`rollback.yml` deliberately does not carry it, so the record covers forward
releases only** and will name the wrong sha as live after a rollback. That is a
known incompleteness rather than an oversight, and the reason is its shape: the
same single job also serves the **list-only mode**, which reads a bucket and
changes nothing on the host, and recording a deployment for that run would make
the record actively wrong rather than merely incomplete. `environment` is
job-level, so there is no per-step escape. Closing it means splitting that job in
two — a `list` job that always runs and an `install` job gated on a non-empty
`sha` — which is a real change to a workflow that has now been exercised against
production, and not one to make in passing.

**C. Redundant installs.** `check`, `e2e` and `deploy` each run `npm ci`.
`setup-node`'s cache makes this cheap but not free. Folding the built payload
into an artifact (defect 3) removes one of the three.

**D. No release identity beyond a sha — the tag half is done.** There were no
tags, no releases and no changelog, which is fine for a solo-maintained app and
becomes not-fine the moment a rollback needs a human to choose a target from a
list. A `tag` job now writes `deploy-YYYYMMDD-HHMMSS-<sha7>` after every release
that reached production and answered from it.

Three things about its shape are deliberate:

- **`needs: deploy` is the whole invariant.** A deploy tag exists if and only if
  a release installed and the live site reported it. It carries no `if:` of its
  own — a `pull_request` run skips `deploy` and this skips with it, and a second
  copy of that condition is how the two come to disagree.
- **It is a separate job rather than four lines at the end of `deploy`**, because
  it needs `contents: write` and `deploy` holds the OIDC token and the release
  payload. Splitting them keeps the writable repository token off the job with
  the most reach.
- **`continue-on-error: true`**, because this is Defect 4's shape exactly: an
  advisory step that must not report a successful release as failed. What that
  flag does is no longer assumed — the entry above establishes it leaves the job
  and its check run concluding `failure` while the run concludes `success`, so an
  untagged release keeps a red row where a person looks.

**The tags are also a release inventory that costs no AWS permission**, which
matters more than it sounds. Dispatched with an empty sha on 2026-08-27,
`rollback.yml`'s list-only mode answered `AccessDenied` naming `s3:ListBucket` —
an observation of the role on that date rather than a standing property, and IAM
has been edited since for the reland's trust policy, so re-dispatch rather than
trusting this line. The tag list answers the same question from git and cannot
stop being readable. Two caveats, because the two
lists are not the same list: a tag records that a release **was** published, not
that its object still exists — nothing here defines a lifecycle policy on
`releases/`, so S3 may have expired an object whose tag remains. And tags begin
now, so releases before this one have none.

**And `rollback.yml` now resolves a ref, so D is done.** It demanded a full
40-character sha and refused an abbreviation, because the S3 key is the full sha —
so a person picked a tag and then transcribed forty hex characters from it, mid
incident. It now accepts a `deploy-*` tag, a branch, or an abbreviation and
resolves it, refusing only what is neither a commit nor a ref.

**The trap was real and the experiment made the change smaller, not bigger.**
`TARGET_SHA` is a job-level `env` that three later steps consume, and whether a
value written to `$GITHUB_ENV` overrides a job-level `env` of the same name was
the whole design. Nothing in this repository did it, so a throwaway workflow
produced the answer (run `33133690027`):

| where | value |
| --- | --- |
| job-level `env`, in the writing step itself | `from-job-env` |
| **the next step** | **`from-github-env`** |
| a step re-declaring it at step level | `from-step-env` |

So the resolution reaches all three consuming steps **with no edits to them at
all** — where this entry had predicted touching three steps in a workflow already
exercised against production. The prediction was wrong in the safe direction, and
only because it was checked rather than acted on.

Two things about the change beyond the resolution itself. The checkout now says
`fetch-tags: true` — `fetch-depth: 0` is documented to bring tags along, but this
is the input a person reaches for during an incident and "documented to" is not
the standard the rest of this pipeline is held to. And `check-screenshots`-style
coverage was not available, so the step's own extracted `run:` block was driven
against a real repository with a real `deploy-*` tag across five inputs — full sha
present, tag, abbreviation, garbage, and a full sha absent from the repository —
then **mutated twice** to prove the drill was not vacuous: deleting the
`$GITHUB_ENV` write empties it, and turning the failure branch into a no-op takes
the garbage case from exit 1 to exit 0.

**E. `sync-broadcasts` pushes straight to `main` — done.** It now commits to
`automation/sync-broadcasts` and opens a pull request from it, so the data
lands the way every other change does. An open pull request is **built on
rather than replaced**: the sync merges into `broadcasts.ts` across the window
it is asked about, so starting again from `main` each week would silently drop
whatever had aged out of that window since.

**"The PR would be green on arrival" was wrong, and the correction is the
useful part of this item.** GitHub does not start a workflow run for an event
raised with the repository's own `GITHUB_TOKEN`, so neither the push nor the
pull request triggers `ci.yml`: the pull request arrives carrying **no checks
at all**, not green ones. What the sync workflow lints and unit-tests is the
file *before it commits it*, failing the job instead — a real gate, in a
different place, and one that reports on the sync's own run rather than on the
pull request.

**That couples E to F harder than "do E first" suggested.** Requiring `check`
and `e2e` as status checks would make this pull request permanently
unmergeable, because those checks can never appear on it unattended. Whoever
does F needs either a token that is not `GITHUB_TOKEN` here, or an explicit
exemption for that branch — a decision, and cheaper to make now than to
discover after protection is switched on.

*Exit:* the Tuesday run opens a pull request instead of pushing, and `main`
does not move. `scripts/rehearse-broadcast-sync-pr.sh` covers the shell in the
meantime — five cases, thirty assertions, against a real git remote and a
stubbed `gh`, run by `check` beside the other two rehearsals. It cannot prove
the token behaviour above, which is a property of GitHub rather than of the
shell; that is read off the first scheduled run.

**F. `main` is protected by convention only — verified, designed, and waiting on
one action nobody here can take.** The first half is answered: the GitHub API
reports `main` as **`protected: false`**. There is no rule set, no required check
and no required review. Every merge in this repository's history was allowed by
nothing but the protocol in `CLAUDE.md`.

**But the motivation in the sentence above does not survive contact, and that is
the most useful thing in this entry.** Required status checks stop a merge whose
`check` or `e2e` is red. They do **not** stop a session from merging a green
pull request — only *required approvals* would, and with a single human
maintainer that setting blocks everything, because GitHub does not let an author
approve their own pull request. So "No session merges into `main`" **stays a
social rule whatever is configured here.** F buys two narrower things, both real:
nothing can be pushed to `main` directly, and nothing red can be merged.

**E was genuinely the precondition, and is now met.** Nothing pushes to `main` any
more: `grep` over `.github/workflows/` and `scripts/` finds no `push … main`. The
`tag` job pushes *tags*, which branch protection on `main` does not govern.

### The settings, exactly

On `main`: require a pull request before merging, **0 required approvals**;
require status checks to pass; block force pushes and deletions. Leave
**"require branches to be up to date"** OFF and **allow administrators to
bypass**.

Two required checks, and **they must be spelled as the job's `name`, not its
id** — this is the trap that costs a day:

| write this | not this |
| --- | --- |
| `Type-check, unit tests, build` | `check` |
| `End-to-end (Playwright)` | `e2e` |

A name that matches no check never arrives, and GitHub shows the pull request as
*waiting* rather than misconfigured — indefinitely, on every pull request at once.

### Four things that are deliberate, each with its reason

- **0 required approvals.** One maintainer cannot approve their own pull request,
  so any non-zero value blocks every merge including theirs. This is the setting
  that would look like the rule being enforced and would in fact be an outage of
  the merge path.
- **`screenshots` is NOT required**, and must never be. It is `continue-on-error`,
  so its check run still concludes `failure` while the run concludes `success` —
  requiring it would block every merge carrying a screenshot debt, which is
  exactly the deadlock D7's first item removed.
- **"Up to date before merging" is off.** `main` moves several times an hour here;
  requiring it turns every pull request into a rebase treadmill against a branch
  that has already moved again.
- **Administrators can bypass.** A locked-out maintainer during an incident is
  worse than an unguarded merge. The guard is for the ordinary path.

### The exemption E discovered, which is not optional

`sync-broadcasts.yml` opens its weekly pull request with the repository's own
`GITHUB_TOKEN`, and **GitHub starts no workflow run for an event raised with that
token**. Its pull request therefore arrives carrying *no checks at all* — not
pending ones, not green ones. Under required status checks it is **permanently
unmergeable**, and the failure looks like the automation being broken rather than
the rule being wrong.

Two ways out, and the choice is a real one:

1. **Exempt `automation/sync-broadcasts`** from the rule set. Simple, and honest
   about what it gives up: that branch's data is then reviewed by a person and by
   the sync's own in-run lint and unit tests, which is what gates it today.
2. **Raise the pull request with a credential that is not `GITHUB_TOKEN`** — a
   fine-grained PAT or a GitHub App. Checks then run normally, at the cost of a
   secret to store and rotate, in a repository whose CI is deliberately
   secret-free.

Option 1 unless someone wants to own a token. Either way it must be decided
**before** the rule set is enabled, not discovered on the Tuesday after.

### What is left, and who can do it

Applying it. No session can: branch protection is a repository **setting**, not a
file, and it is reachable from neither the GitHub MCP server available here nor
any checked-in configuration. This entry is the design; the maintainer applies it
under Settings → Rules, and the observable afterwards is a pull request with a
red `check` refusing to merge.

**G. The curated-data checkers never run — done, in exactly the shape this entry
required.** `check-hymns`, `check-stadium-photos`, `check-player-wikipedia` and
`check-player-photos` were all manual. `CLAUDE.md` is explicit that this is
deliberate — "CI has no network dependency on a third party by design, and a link
that rots on someone else's server is not a reason for a red build on a commit
that did not touch it" — and that rule is right and was not softened.

`.github/workflows/curated-data.yml` runs the four monthly (`0 6 1 * *`, plus
`workflow_dispatch`) and reports into an **issue**. It is always green: a failing
checker is its subject, not a fault in it. It opens one issue, comments on it
while the failure persists rather than opening a second, and **closes it** when
everything resolves again.

**What keeps it green was measured rather than asserted, and the first comment
written for it was wrong.** A command in an `if` condition is exempt from
`set -e`, so the `if` is what holds green today and switching `set -uo` to
`set -euo` changes nothing; the trailing `exit 0` is belt-and-braces too. The
missing `-e` protects the *next* edit — a bare `npm run check-…` outside an `if`
exits 0 as written and 1 under `set -euo`. The comment now says that, because a
future contributor tidying `set -uo` into `set -euo` is exactly how this rule
gets softened by accident.

Coverage is both steps' extracted `run:` blocks against stubbed `gh` and `npm`:
four issue branches (open, add to, close, do nothing — and the do-nothing case
makes exactly one `gh` call and creates nothing), and four runner branches. Each
mutation is checked for having **applied** before its result is read, after three
in this session silently did not — twice because a `sed` pattern carried the YAML
indentation a block scalar strips, once because `s|…||…|` met a pattern containing
`||` and emptied the file, where an empty script exits 0 and reads as a pass.

**The drill found a real defect before merge, and it is the shape worth naming.**
The workflow filters and creates on a `curated-data` label, and that label **did
not exist**. `gh issue create --label` fails on an unknown label; the issue step
keeps `set -e` deliberately, because a broken `gh` is a fault in the workflow
rather than a rotted link. So the job would have gone red on the first run where a
checker genuinely failed — the exact moment the always-green promise is load
bearing, months after anyone remembered writing it. It now creates the label
idempotently, and removing that guard turns the second run red, which is what
makes it more than decoration.

**The observable is a `workflow_dispatch` run**, and it has not been taken: a
monthly cron means the alternative is waiting until the first. Dispatching it
spends third-party rate limit (~169 Wikipedia articles, 70 Commons files, 19
stadium photographs, 20 YouTube lookups) and may open a real issue, so it is the
maintainer's to run rather than something to fire off unasked.

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

### D5 — A bad release does not become an outage — **done**

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
build serving — demonstrated, not argued. **Met**, against stubs and then against
production: drill run `33079608222`, 2026-08-27. See below, including the one
wording this exit line got wrong ("and the workflow red").

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

**The workstation path did not get any of this, and that took a while to notice.**
`07` and `06` gained retention and flip-back; `scripts/deploy.sh` carried its own
inline heredoc and called neither, so `rsync -a --delete` still destroyed the
running build before the new one was proven — on the one route a person takes
during an incident. It now stages the release into a temporary directory on the
host and runs `07` from it, which is the same handoff the SSM command makes after
untarring, so the phase's exit criterion holds for both routes rather than one.

Two things about how it was missed are worth more than the fix. The convergence
was **asserted in two places** — `CLAUDE.md` and `07`'s own header — while being
false, because both were written from the design rather than read off the code.
And nothing exercised `deploy.sh`: CI shellchecked it, which proves it parses.
`scripts/rehearse-deploy-sh.sh` now drives it against a local `ssh` stub, and was
confirmed red against the previous version before being believed.

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

**Stage 2 is DONE, both modes.** Runs `33079608222` (`health`) and
`33096969376` (`crash`), 2026-08-27, against production. The exit criterion is
met by demonstration; the `health` run first:

```
PATCHED=1
==> Retaining the current release in /var/www/portal_brasileirao/previous
==> Installing release into /var/www/portal_brasileirao
==> Handing off to 06_redeploy.sh
Error: portal-brasileirao did not become healthy.
==> Flipping back to the retained release in …/previous...
ROLLED BACK: portal-brasileirao is serving the PREVIOUS release from …/previous.
Health: {"status":"ok","sha":"8ed6f60",…}
SEVEN_EXIT=2
```

`07 exit: 2 · ROLLED BACK: yes · CRITICAL: no`, and `/api/health` came back `ok`
on `8ed6f60` — the release that was live before the drill. `/`, `/classificacao`
and `/ao-vivo` all served 200 throughout, which is the property the
starts-but-unhealthy variant was chosen for.

**Both failure modes have now been drilled, and the second is the one that
matters most.** Run `33096969376`, `mode=crash`: `process.exit(1);` prepended to
the bundle, so the process dies on boot and **systemd cannot help** — there is
nothing healthy to restart into, which is precisely why `Restart=on-failure`
was never a substitute for this. Same verdict: `07 exit: 2`, `ROLLED BACK: yes`,
health back on `0e07d83`.

**The outage it caused was measured, not estimated.** Polling `/api/health` from
outside every two seconds for the length of the run caught exactly three non-200
samples, `17:10:05` to `17:10:09` — between four and eight seconds, against a
written estimate of ten to fifteen. Quote the measured number: that is what an
unbootable release now costs, and it is the figure someone weighing whether to
trust the mechanism should be given.

So the two modes divide as intended. `starts-but-unhealthy` is invisible to
systemd (the process is alive) and cost **no downtime at all**;
`crash-on-boot` is visible to systemd and unfixable by it, and cost seconds.

**A hazard the crash rehearsal found, closed before the drill ran.** A crash loop
is the one thing that can *strand* this service rather than interrupt it: the
unit sets `RestartSec=5` and no `StartLimit*`, so if restarts breach systemd's
default burst the unit enters `failed` and `systemctl restart` is **refused** —
which would make the flip-back exit 3 *and* leave `rollback.yml` unable to
recover, since it ends in the same restart. Tested against real systemd both
ways: at `RestartSec=5` the limit is not reached (six crash-restarts, restart
still succeeded), and with it deliberately tripped only `reset-failed` got out.
`06_redeploy.sh` now calls `reset-failed` before every restart. It stayed a no-op
during the real drill, as predicted.

**One wording correction the run forces.** This phase said the proof would be the
`deploy` job going *red*. It is not, and should not be: the drill is dispatched,
not pushed, and its workflow goes **green** when the flip-back works, because a
drill that fails to roll back is the failure. Red remains correct for `ci.yml`,
where a rolled-back release really is a failed release. The observable that
matters is `SEVEN_EXIT=2` plus `ROLLED BACK` in the host stdout, not the colour
of a run.

**Three defects were found on the way, none by reading.** The workstation SSM
path in the first runbook did not exist — the IAM user holds neither
`ssm:SendCommand` nor `sts:AssumeRole`, and the deploy role trusts GitHub OIDC
alone, restricted to `refs/heads/main`. The drill workflow's jq program failed to
compile, because single quotes inside a single-quoted shell argument close it.
And the workflow checked out at depth 1, so it could not resolve the deployed
commit the moment `main` moved ahead — it refused rather than drilling a host it
could not describe, which is the direction that guard should fail.

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

#### Resolved: `allow_non_descendant` is removed, not doored

The two corrections below stand as written and are kept for the reasoning. What
they could not see is that **the guard and the override were reachable on
disjoint events**: a push carries no `inputs`, so the override was always
`false` there — and a push is the only event where the guard realistically
fires, because a queue draining out of order installs an older `main` commit
over a newer one. A dispatch can set the flag but carries the chosen ref's
*tip*, which is an ancestor of live only if `main` has been rewound.

So the refusal's own advice — re-run with the input set — could not be followed,
because re-running a push run replays its payload. The input and its branch are
gone; the step points at `rollback.yml`, and at dispatching `ci.yml` on `main`
for the out-of-order case, where the tip is a descendant and passes unaided.

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

Defect 4 (the advisory `screenshots` job reddening a successful release) is
**done** — see its entry above, including the two options weighed and declined
and the `reconcile.yml` hold it turned out to unjam. It was taken first as the
cheapest item and the one most likely to cause a real misreading; the count in
its entry went from six to a measured seventeen once it was actually queried.

Gap B (no Deployments record) is **done, on its second attempt.** It shipped in
#151, broke every release for ten commits because attaching the job to an
environment rewrites the OIDC subject claim, and was reverted in #156. #159
relanded it after the trust policy was widened to accept **both** subject forms —
read from the token by `oidc-subject-probe.yml` rather than derived. Both are
needed: `rollback.yml` and `flip-back-drill.yml` carry no environment and keep
sending the ref form. This paragraph said "reverted and blocked" for several
merges after that stopped being true, which is the failure the entry itself is
about.

Gap D's tag half is **done** — see its entry above, including why the tags double
as the release inventory the missing `s3:ListBucket` permission denies, and the
one piece left (teaching `rollback.yml` to accept a ref) with the trap that makes
it more than a one-liner.

Gap E (`sync-broadcasts` pushing straight to `main`) is **done** — this change.
It was F's precondition, so **F is now unblocked**, and its entry carries a
correction worth reading before anyone relies on the same assumption elsewhere:
the pull request the sync opens arrives with **no checks at all**, not green
ones, because GitHub starts no workflow run for an event raised with the
repository's own `GITHUB_TOKEN`.

Gap F is **designed and verified but not applied** — `main` is confirmed
unprotected, the exact rule set and its four deliberate choices are in its entry
above, and applying it is a repository setting no session can reach. Read the
`GITHUB_TOKEN` exemption there before switching it on.

Gap D is **done in full** — the tag half and, now, `rollback.yml` resolving a
`deploy-*` tag rather than demanding forty hex characters. Its entry carries the
`$GITHUB_ENV` precedence answer, which is worth reading before anyone writes a
job-level `env` they intend to override.

What remains under D7: **applying F**, which is a repository setting rather than a
change to this repository, and **dispatching G once** to see it work. Nothing else
— every defect and every gap in this plan has shipped.

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
- **Defect 4's count was six, then seventeen, and is now zero.** Six was a count
  of runs noticed while writing this plan; seventeen is what the API said when
  the fix was written and the 30 most recent push-on-main runs were actually
  queried. Worth keeping as a note about counting by noticing: it undercounted
  by a factor of three, and the thing being undercounted was how often a green
  release reported itself red.
- **Defect 4's fix was challenged, and upheld on evidence that did not exist when
  it was proposed.** The clause saying the debt would stay visible was this plan's
  weakest-evidenced claim, and it was load-bearing: job-level `continue-on-error`
  could equally have reported the job as *succeeded*, which would have left the
  step summary as the only trace and sent D7 to one of the two alternatives
  recorded in the entry — its own workflow and badge, or a single open/updated
  issue. It could not be settled from the run history, because there was no
  `continue-on-error` in `.github/` to read one from. The merge run `33074799866`
  settled it: `screenshots` still concludes `failure` on the jobs API and,
  decisively, on `/commits/{sha}/check-runs`, which is the surface the checks list
  renders — while the run concludes `success`. Against `33067205785` immediately
  before it, the only difference between the two arms is the run conclusion. The
  proposal stands and the objection was overstated. What remains unmeasured is
  whether the debt is still cleared as quickly as the red made it; the entry
  records the floor to hold it to and the caveats on that number.
- **And that floor was then corrected downward.** It was measured by pairing each
  appearance commit with the next commit touching `docs/screenshots` by timestamp,
  which credits a refresh shot *before* the change and committed after it. The
  first episode measured after the assessment merged exposed it: scored at 0.03
  hours, actually 2.99, because the crediting refresh's `CAPTURED` named a capture
  predating the change. Re-measured anchored on `CAPTURED` — the test the check
  itself applies — the median roughly doubles and p90 rises by 1.6×. The verdict
  is unchanged (still nothing over a day, identical maximum); the number is
  softer than it was published as. Recorded rather than quietly restated, since
  the floor was offered as the bar a replacement must clear.
