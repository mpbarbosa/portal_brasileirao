# The flip-back drill

Stage 2 of `cicd-plan.md` D5 — the controlled live exercise that proves a bad
release on the host leaves the **previous** release serving.

**Why it needs a drill at all.** Retention is already proven in production: every
deploy since `42c0ea9` prints `==> Retaining the current release in
/var/www/portal_brasileirao/previous` in the install step's host stdout. The
**restore** branch is not, and never will be by accident — a healthy deploy
exercises retention and skips the restore, so the untested half stays untested
precisely while everything looks fine. `scripts/rehearse-flip-back.sh` drives all
eight branches against stubs; this drives one of them against the real host.

## What this drill breaks, and why it is safer than it sounds

It installs a release **byte-identical to what is live except for the health
literal**: `status: "ok"` becomes `status: "drill"`. That is failure mode 2 from
the phase — *starts but is unhealthy* — and it is the one worth drilling, because
systemd cannot catch it: the process is alive, so `Restart=on-failure` never
fires and production would serve broken responses quietly.

**During the drill the site keeps working.** Verified locally against a patched
bundle before this was written:

```
server alive after 5s        yes
GET /                        HTTP 200
GET /api/health              {"status":"drill","sha":"…","uptime":5.0,…}
06's check: curl -sf … | grep -q '"status":"ok"'   -> fails, as intended
```

So the only visitor-visible difference for the length of the drill is that
`/api/health` reports `drill`. No page is down. **Even the worst case is
benign**: if the flip-back itself fails (exit 3) the host is left serving the
patched bundle, which serves every page correctly and lies only on `/api/health`.

That is a deliberate choice. The other failure mode — a bundle that crashes on
boot, leaving systemd restart-looping against an empty `dist/` — is the one that
actually takes the site down. **Drill the health variant first.** Only consider
the crash variant once this one has passed, and treat it as a separate exercise
with its own window.

## Who can run it, and why it is a workflow

**A workstation cannot drive this drill.** That is measured, not assumed, and it
was discovered by a preflight after the first version of this runbook told
readers to run `aws ssm send-command` themselves:

```
ssm:SendCommand as user/mpb          -> AccessDenied
sts:AssumeRole  on the deploy role   -> AccessDenied
the role's trust policy              -> Federated: GitHub OIDC only,
                                        sub = repo:…:ref:refs/heads/main
```

`sts get-caller-identity` succeeding proves *identity*, not *authorisation*, and
inferring one from the other is what put the wrong instruction here. The only
principal that can reach the host over SSM is a GitHub Actions run on `main`.

So the drill is `.github/workflows/flip-back-drill.yml`. That is not a
workaround — it is better in one way that matters: the workflow joins the
**`deploy-production` concurrency group**, the same one `ci.yml`'s deploy and
`rollback.yml` use. A workstation could not, and the hazard is real: a release
landing midway through the drill would retain the *patched* bundle as
`previous/`, poisoning the rollback target the drill exists to test.

## Preconditions

The workflow enforces most of them and refuses rather than guessing:

| checked by the workflow | refusal |
| --- | --- |
| `/api/health` answers with a sha it can resolve | won't drill a host whose state is unknown |
| `previous/` holds a `dist/server.cjs` | no retained release, so no flip-back to prove |
| the health literal appears exactly **once** | a `0` means the patch would leave the payload *healthy* and the drill would pass having tested nothing |
| a deploy is mid-flight | handled by the concurrency group, not by a check |

The live-sha check resolves the deployed commit against the workflow's own
checkout, which is why the job uses **`fetch-depth: 0`** — the same reason
`ci.yml`'s ancestry guard does. A depth-1 clone holds only the tip, so the moment
`main` moves ahead of what is deployed the lookup fails and the drill refuses.
The first dispatch of this workflow did exactly that: *"Live reports 8e5a969,
which is not a commit in this checkout"*, because a later commit had already
landed. It failed **safe** — refusing to drill a host whose state it could not
verify — which is the direction a guard on a deliberately destructive action
should fail.

What it does **not** check, and you should: that no round is being played. This
is a Brasileirão companion, so traffic tracks the fixture calendar — a weekday
morning Brazil time with no fixtures is the reasoning. **That is inference from
the domain, not measurement**; `08_install_cloudwatch_agent.sh` is what would
answer it properly and nobody has asked it.

## Step 0 — preflight, changes nothing

Dispatch with `confirm` **empty**. It reads the host, prints what it found, and
stops before installing anything.

```sh
gh workflow run flip-back-drill.yml
gh run watch "$(gh run list --workflow flip-back-drill.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
```

## The two modes

`mode=health` (the default) installs a payload byte-identical to live except the
health literal. The process stays up, every page serves 200, and only
`/api/health` reports otherwise. **Ran and passed on 2026-08-27**, run
`33079608222`.

`mode=crash` prepends `process.exit(1);` to the bundle, so the process dies on
boot and systemd restarts it on a timer against a bundle that cannot start.
**This one takes the site down** — roughly 10–15s, from the restart until the
flip-back's restart answers: a 5s health wait plus `npm ci` (~3s on the host)
plus restart and health.

### The start-limit hazard, and why the flip-back now clears it

A crash loop is the one thing that can strand this service. The unit sets
`Restart=on-failure` / `RestartSec=5` and no `StartLimit*`, so systemd's defaults
apply (burst 5). If those attempts breach the burst the unit enters **`failed`**
and `systemctl restart` is **refused** — which would make the flip-back exit 3
*and* leave `rollback.yml` unable to recover, because it ends in the same
restart. Only `systemctl reset-failed` gets out.

Both halves of that were tested against real systemd rather than reasoned about:

| setup | result |
| --- | --- |
| `RestartSec=5` (production's value), 6 crash-restarts | `systemctl restart` **succeeded**; unit came back active and healthy |
| `RestartSec=0`, limit deliberately tripped | unit `failed`; `systemctl restart` **refused**; `reset-failed` + restart rescued it |

So the lockout does not occur at the setting production runs. `06_redeploy.sh`
now calls `systemctl reset-failed` before every restart anyway — a no-op on a
unit that is not failed, and the difference between a 15s drill and a stranded
service in the case where it is.

## Both modes have now run, against production

| mode | run | 07 exit | outage |
| --- | --- | --- | --- |
| `health` | `33079608222` | 2, rolled back | **none** — every page served 200 |
| `crash` | `33096969376` | 2, rolled back | **4–8s**, measured |

The crash run's transcript, which is the one worth recognising because systemd
cannot rescue it:

```
PATCHED=1
==> Retaining the current release in /var/www/portal_brasileirao/previous
==> Installing release into /var/www/portal_brasileirao
==> Handing off to 06_redeploy.sh
==> Installing production dependencies and restarting portal-brasileirao...
==> Waiting for health...
Error: portal-brasileirao did not become healthy.
==> Flipping back to the retained release in …/previous...
ROLLED BACK: portal-brasileirao is serving the PREVIOUS release from …/previous.
Health: {"status":"ok","sha":"0e07d83",…}
SEVEN_EXIT=2
```

**The outage was measured rather than estimated**, by polling `/api/health` from
outside every two seconds for the length of the run: exactly three non-200
samples, `17:10:05` through `17:10:09`. The written estimate had been 10–15s.
Quote the measured figure — four to eight seconds is what an unbootable release
now costs, and the difference matters when someone is deciding whether the
mechanism is worth trusting.

**The `reset-failed` call in `06_redeploy.sh` stayed a no-op**, as the
real-systemd rehearsal predicted it would at `RestartSec=5`. It is insurance for
the case where a crash loop breaches the start limit, not something this run
exercised.

## Step 1 — run it

Dispatch with `confirm` set to exactly `DRILL`. `health_attempts` defaults to
`5`, which is how long the bad payload is allowed to try before the flip-back
fires — 5s rather than the standard 30s, which is what `HEALTH_ATTEMPTS` was
added for.

```sh
gh workflow run flip-back-drill.yml -f confirm=DRILL                  # health mode
gh workflow run flip-back-drill.yml -f confirm=DRILL -f mode=crash    # takes the site down
```

## Step 2 — read the verdict

The workflow judges the outcome itself and writes a table to the run summary.
**It fails the job for every outcome except a genuine pass**, including the two
that look like success:

| 07 exit | meaning | job |
| --- | --- | --- |
| `2` + `ROLLED BACK` + live healthy on the pre-drill sha | the unhealthy release was rolled back | **pass** |
| `0` | the payload was not actually unhealthy — **proves nothing** | fail |
| `3` | the flip-back itself failed; host serves the patched bundle | fail, loudly |
| `9` | aborted at the patch gate; nothing installed | fail |

The host transcript appears under *host stdout* in the run. A genuine pass looks
like this — reproduced from an actual run of these exact commands against a real
bundle and a real server process, with the paths substituted:

```
PATCHED=1
==> Retaining the current release in /var/www/portal_brasileirao/previous
==> Installing release into /var/www/portal_brasileirao
==> Handing off to 06_redeploy.sh
==> Installing production dependencies and restarting portal-brasileirao...
==> Waiting for health...
Error: portal-brasileirao did not become healthy.
<40 lines of journal>
==> Flipping back to the retained release in /var/www/portal_brasileirao/previous...

ROLLED BACK: portal-brasileirao is serving the PREVIOUS release from …/previous.
Health: {"status":"ok","sha":"<the pre-drill sha>",…}
The release that was being installed is NOT live. Failing so the pipeline goes red.
SEVEN_EXIT=2
```

**Note the SSM script always exits 0 and reports 07's real code as
`SEVEN_EXIT`.** Letting it exit non-zero would make SSM report `Failed` for the
*success* case, since `07` exits 2 when it has rolled back — and that inversion
is precisely what gets misread. The workflow reads the number, not the status.

## Recovery

**After a pass, nothing is owed.** The flip-back already restored `dist/` and
restarted; `previous/` still holds the good release. The workflow has already
confirmed `/api/health` is `ok` on the pre-drill sha.

**After exit 3**, the host is serving the patched bundle: every page renders,
`/api/health` lies. The workflow prints the exact recovery command with the full
sha filled in:

```sh
gh workflow run rollback.yml -f sha=<full-40-char-sha>
```

Dispatching `rollback.yml` with an **empty** sha lists what S3 holds and changes
nothing, which is the safe way to confirm the artifact is still there first —
nothing in this repository defines a lifecycle policy on `releases/`. If it has
expired, an empty commit to `main` rebuilds and redeploys through the pipeline:
about four minutes against the rollback's forty seconds.

## What this does not cover

- ~~The crash-on-boot mode.~~ **Drilled on 2026-08-27**, run `33096969376`; see
  *Both modes have now run* above.
- **`scripts/deploy.sh`.** The workstation path carries its own inline remote
  block and calls neither `06` nor `07`, so it neither retains nor flips back.
  Recorded under *Near term* in `roadmap.md`; `CLAUDE.md` forbids running it by
  hand.
- **A concurrent deploy.** This drill is driven from a workstation and is outside
  the `deploy-production` concurrency group that serialises `ci.yml` and
  `rollback.yml`. Check by hand; nothing enforces it.
