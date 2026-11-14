# O pipeline de deploy

*Quando ler:* Leia ao investigar um release, a infraestrutura AWS ou a versão de Node.

Extraído do `CLAUDE.md`, que ficou um índice. Esta é a fonte canônica do assunto.

---

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

**"If and only if" is wrong in one direction, and it is the direction a reader
reaches for: the install can happen with NO tag.** The sentence above grants the
`tag` job permission to fail and then treats its output as an invariant, and
`continue-on-error` is exactly what breaks the biconditional. Measured
2026-09-16 on the run for `165eb5d`: `Deploy to production` **succeeded**
00:25:14 -> 00:26:15 while `Tag the release` **failed** 00:26:18 -> 00:26:39, so a
release that really did serve carries no `deploy-*` tag at all. A present tag
still means what that paragraph says; an **absent** one means nothing whatever.

**The run's own job records are what settle it**, and neither the tag list nor
`gh run list` can — the run's own conclusion is `success`, since the failing job
is `continue-on-error`:

```sh
gh api repos/mpbarbosa/portal_brasileirao/actions/runs/<id>/jobs \
  -q '.jobs[] | "\(.name): \(.conclusion) \(.started_at) \(.completed_at)"'
```

This was reached from the wrong end and nearly published as *"no tag, so nothing
installed"* — a missing record read as evidence of a missing deploy. That is
this file's own rule — *"when a check tells you something alarming about someone
else's work, run the other form before saying it out loud"* — met at a CI record
rather than at a `git` command, and the other form here costs one call.

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
scripts have**, and `scripts/rehearse-deploy-sh.sh` is the only coverage the
workstation path that now calls them has. `npm run lint` is TypeScript and cannot see shell; CI only
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

**Hermetic is necessary and not sufficient, which `rehearse-sync-schedule.sh`
cost fifty minutes of stalled deploys to establish.** It was hermetic throughout —
no network, no token, no AWS — and still passed only where it was written, because
it read its subject's environment from wherever it happened to be run: a worktree
on a workstation, an ordinary clone in CI. The second question to ask of a
rehearsal is therefore **would this give the same answer somewhere else**, and the
cheap way to find out is to run it in a plain `git clone` of the checkout before
believing a green run.

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
site that is down cannot tell you what it is running.

**There is no override, and there deliberately is not one.** The guard shipped
with an `allow_non_descendant` input, and the two were reachable on **disjoint
events**: a push carries no `github.event.inputs` at all, so the flag was always
`false` there — and a push is the only event where the guard realistically
fires, since a queue draining out of order installs an older `main` commit over
a newer one. A dispatch could set the flag but carries the chosen ref's *tip*,
an ancestor of live only if `main` has been rewound. The refusal even told the
operator to re-run with the input set, which cannot be done: re-running a push
run replays its payload. Both paths already have a better answer — dispatch
`ci.yml` on `main` to recover from an out-of-order queue, since its tip is a
descendant and passes unaided, and use **`rollback.yml`** to go backwards
deliberately, which does its own SSM install and carries no guard on purpose.

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
flight all mean it does not dispatch. A site that is down is an incident, not a
gap to close. Note the schedule is a safety net rather than a guarantee —
GitHub delays scheduled runs under exactly the load that drops push events, and
disables them after 60 days of repository inactivity.

**Safe is not the same as silent, and conflating the two cost eighteen hours.**
Every terminal branch used to `exit 0`, so the job reported `success` whether it
had reconciled, held for a good reason, or found an incident it could not act on.
On 2026-08-30 `ci.yml` was startup-failing from an orphaned `env:` key; the
reconciler detected it correctly, wrote *"main already has a failure CI run — this
needs a person, not another tick"*, and went green on every tick from 03:40Z.
Production sat 4 commits behind for the whole of it, and the row of ticks is what
made it invisible. The branches now split by **who has to do something**:

- **Expected holds exit 0** — in sync, a run already in flight, the API query
  failing, and a deliberate rollback holding the line. Nothing is wrong.
- **Conditions needing a person exit 1** — main's own CI run failed or timed out,
  the site is unreachable, the live sha is unusable or unknown here, or
  production is not an ancestor of `main`. The schedule goes red and GitHub
  raises its scheduled-failure notice.

**A dispatch is not the only thing worth observing here, which is what the old
shape got wrong.** A reconciler is read as "did it deploy?", and under that
reading exiting 0 while refusing to deploy is correct. The question it actually
answers is *is production where it should be* — and "no, and I cannot fix it"
is the answer that needs a person, not the quietest one.

`scripts/rehearse-reconcile.sh` is the only behavioural coverage this workflow
has, and `check` runs it. It extracts the step from the shipped YAML, drives all
eleven branches against a stubbed `gh` and a real HTTP server, and asserts the
**exit code against the branch taken** as well as whether a deploy was
dispatched. It was confirmed red against the pre-fix workflow first — 5 of 11,
failing on exactly the six that now exit 1 — because a harness that has never
failed is not evidence of anything.

**One trap if you extend it: `actionlint` would not have caught the bug that
started this, and `yaml.safe_load` would not either.** The orphaned `env:` is
valid YAML (`env: null`), so a local parse passes; actionlint *does* reject it
(`expecting a single ${{...}} expression or mapping value for "env" section`) but
only when pointed at the broken file, and the natural command —
`git show origin/main:.github/workflows/ci.yml` — silently fetches whatever main
holds now, which after the fix is the good one. That produced a confident
"actionlint does not catch it" before the subject was checked. Verify the subject
contains the defect before believing the instrument, exactly as
**check the prompt that sent you** says one directory up.

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

`scripts/deploy.sh` is the workstation path — rsync over SSH — and it now really
does converge with CI: it stages the release in a temporary directory on the host
and runs `07_install_release.sh` from that staging copy, exactly as the SSM command
does after untarring. Only the transport differs.

**This paragraph asserted that convergence for months while it was false**, which
is worth more than the fix. `deploy.sh` carried its own inline heredoc — `npm ci`,
restart, health poll, `journalctl` — reaching neither `07` nor `06`, so it rsynced
`--delete` straight over the running build and left an operator with nothing to
return to. `07`'s own header made the same claim. Both read as descriptions and
were memories: the retention and flip-back D5b added went to the pipeline only,
and the two documents describing the shared path were never re-read against it.
The failure is the one this file names under *a claim that produces no work when
it holds is never exercised* — nothing in CI ran `deploy.sh`, so nothing could
disagree with the sentence.

**`scripts/rehearse-deploy-sh.sh` is what makes it exercised**, and it is the
first behavioural coverage that script has ever had. It stubs `ssh` — running the
command locally, the way a real `ssh` runs it through the login shell, which is
what lets one stub serve both `ssh host 'mktemp -d'` and the `ssh host rsync
--server` that rsync itself invokes — and asserts what the host looks like
afterwards. It was confirmed **red against the previous `deploy.sh`**: ten
assertions across retention, flip-back and the exit code, rather than taken on
trust.

Note it does **not** gate the release the way the flip-back and backup rehearsals
do, because `deploy.sh` does not travel in the payload. It is in `check` because
this is the script somebody reaches for during an incident.

It still builds from the **working tree** rather than from a git ref, which is why
**Working alongside other sessions** above says never to run it by hand.

What is still missing from this pipeline, and the phased plan for closing it, is
`docs/cicd-plan.md`.

## One Node major, named in several places

`.nvmrc` holds it. `package.json`'s `engines`, the `@types/node` devDependency,
`REQUIRED_NODE_MAJOR` in `shell_scripts/01_setup_app_directory.sh` and the
`node-version-file` of every workflow that sets up Node all have to agree with
it, and `tests/node-version.test.ts` fails when they do not. The test **finds**
those workflows by `actions/setup-node` rather than naming them: the list it
used to carry had already fallen behind, leaving `curated-data.yml` unchecked.

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

Moving Node is consequently a deliberate commit across every one of them,
starting at `.nvmrc`, which is the point — before this, each of the others was a
literal that could move alone.

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
