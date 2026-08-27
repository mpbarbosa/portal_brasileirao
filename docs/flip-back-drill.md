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

## Preconditions

- A window when a failed drill would cost least. This is a Brasileirão companion,
  so traffic tracks the fixture calendar: a **weekday morning, Brazil time, on a
  day with no round** is the reasoning. That is inference from the domain, not a
  measurement — `08_install_cloudwatch_agent.sh` is what would answer it properly,
  and nobody has asked it.
- No deploy in flight. `ci.yml`'s `deploy` and `rollback.yml` share the
  `deploy-production` concurrency group, but this drill is driven from a
  workstation and is **outside** that group, so check by hand.
- The forward path ready: know the **full 40-character sha** that is live before
  you start. `rollback.yml` refuses an abbreviation, and you do not want to be
  looking it up during a bad drill.

```sh
LIVE=$(curl -sf https://brasileirao.mpbarbosa.com/api/health | jq -r .sha)
git rev-parse "$LIVE"          # the full sha — write it down
gh run list --workflow ci.yml --branch main --limit 3   # nothing in progress
```

## Step 0 — preflight, changes nothing

Proves the SSM path works and your credentials carry `ssm:SendCommand`, before
anything is at stake.

```sh
aws ssm send-command --region sa-east-1 \
  --instance-ids i-03a9afc8a469edc89 \
  --document-name AWS-RunShellScript \
  --comment "flip-back drill preflight" \
  --parameters 'commands=["set -eu","ls -la /var/www/portal_brasileirao","ls -la /var/www/portal_brasileirao/previous || echo NO-PREVIOUS-YET","grep -c '\''status: \"ok\"'\'' /var/www/portal_brasileirao/dist/server.cjs"]' \
  --query 'Command.CommandId' --output text
```

Read it back with the id it prints:

```sh
aws ssm get-command-invocation --region sa-east-1 \
  --instance-id i-03a9afc8a469edc89 --command-id <id> \
  --query 'StandardOutputContent' --output text
```

**Three things must hold before you go on.** `previous/` exists and holds a
`dist/server.cjs` — no `previous/`, no flip-back, and the drill would prove
nothing except that. The `grep -c` must print **1**: the bundle is not minified,
so the literal appears exactly once, and if it prints `0` the sed below would
silently produce a *healthy* payload and the drill would pass without testing
anything.

## Step 1 — run the drill

Builds the staging directory from the release already on the host, so the
payload is the live one plus three bytes. Nothing is downloaded and nothing is
built.

```sh
aws ssm send-command --region sa-east-1 \
  --instance-ids i-03a9afc8a469edc89 \
  --document-name AWS-RunShellScript \
  --comment "flip-back drill" \
  --parameters file://drill.json \
  --query 'Command.CommandId' --output text
```

with `drill.json`:

```json
{ "commands": [
  "set -eu",
  "D=/var/www/portal_brasileirao",
  "S=$(sudo -u ubuntu mktemp -d /tmp/drill-XXXXXXXX)",
  "sudo -u ubuntu cp -r \"$D/dist\" \"$S/dist\"",
  "sudo -u ubuntu cp \"$D/package.json\" \"$D/package-lock.json\" \"$S/\"",
  "sudo -u ubuntu mkdir -p \"$S/shell_scripts\"",
  "sudo -u ubuntu cp \"$D\"/shell_scripts/*.sh \"$S/shell_scripts/\"",
  "sudo -u ubuntu sed -i 's/status: \"ok\"/status: \"drill\"/' \"$S/dist/server.cjs\"",
  "grep -c 'status: \"drill\"' \"$S/dist/server.cjs\" | sed 's/^/patched occurrences (must be 1): /'",
  "sudo -u ubuntu env HEALTH_ATTEMPTS=5 bash \"$S/shell_scripts/07_install_release.sh\" \"$S\" || echo \"07 exited $?\"",
  "rm -rf \"$S\""
] }
```

`HEALTH_ATTEMPTS=5` shortens the failed health wait from 30s to 5s. It exists for
this: the flag was added with the flip-back and is the reason the unhealthy
window is seconds rather than half a minute.

The scripts are taken from the **host**, not shipped, because the drill is
testing what is installed there. `shell_scripts/` normally travels inside the
release tarball; copying the host's own copy keeps the drill from smuggling in a
different version of the thing under test.

## Step 2 — read the result

```sh
aws ssm get-command-invocation --region sa-east-1 \
  --instance-id i-03a9afc8a469edc89 --command-id <id> \
  --query '[Status,StandardOutputContent,StandardErrorContent]' --output text
```

**A `Failed` SSM status is the SUCCESS case.** `07` exits 2 when it has rolled
back, so SSM reports the command as failed. Read the output, not the status —
this is the same inversion as the advisory screenshots job reddening a run whose
deploy succeeded.

Success looks like this, in order:

```
patched occurrences (must be 1): 1
==> Retaining the current release in /var/www/portal_brasileirao/previous
==> Installing release into /var/www/portal_brasileirao
==> Handing off to 06_redeploy.sh
==> Installing production dependencies and restarting portal-brasileirao...
==> Waiting for health...
Error: portal-brasileirao did not become healthy.
<40 lines of journal>
==> Flipping back to the retained release in /var/www/portal_brasileirao/previous...

ROLLED BACK: portal-brasileirao is serving the PREVIOUS release from …/previous.
Health: {"status":"ok","sha":"<the sha you wrote down>",…}
The release that was being installed is NOT live. Failing so the pipeline goes red.
07 exited 2
```

**That transcript is not written from memory.** The command block above was
dry-run in full against a real built bundle and a real server process — a fake
`$DEPLOY_DIR` holding the actual `dist/server.cjs`, with `systemctl` stubbed to
start and stop the genuine binary so health reflected the bytes on disk rather
than a mock. The lines above are that run's output with the paths and service
name substituted. `07 exited 2`, and `/api/health` came back `ok` on the
restored release.

Then, from outside:

```sh
curl -sf https://brasileirao.mpbarbosa.com/api/health
# -> {"status":"ok","sha":"<the sha you wrote down>",…}
```

**Failure to recognise, and what each means:**

| what you see | meaning |
| --- | --- |
| `Healthy:` and `07 exited 0` | the payload was not actually bad. Check `patched:` printed 1. **The drill proved nothing** — do not record it as a pass. |
| `07 exited 2` + health `ok` | pass. The restore fired and the previous release is serving. |
| `CRITICAL` + `07 exited 3` | the flip-back failed. This is the outcome the drill exists to discover. Go to recovery. |
| no `Retaining` line | there was no `previous/` to keep. Preflight should have caught it. |

## Recovery

**After a pass, nothing is owed.** The flip-back already restored `dist/` and
restarted; `previous/` still holds the good release. Confirm the sha and stop.

**After exit 3**, the site is serving the patched bundle — every page works,
`/api/health` lies. Restore by dispatching `rollback.yml` with the full sha you
wrote down:

```sh
gh workflow run rollback.yml -f sha=<full-40-char-sha>
```

Dispatching with an **empty** sha lists what S3 holds and changes nothing, which
is the safe way to check the artifact is still there first. Note nothing in this
repository defines a lifecycle policy on `releases/`, so confirm rather than
assume.

If S3 has expired the artifact, the way back is an ordinary empty commit to
`main`, which rebuilds and redeploys through the pipeline — about four minutes
against the rollback's forty seconds.

## What this does not cover

- **The crash-on-boot mode.** A bundle that exits immediately leaves systemd
  restart-looping every 5s against whatever is in `dist/`. That is the variant
  that actually takes the site down, and it deserves its own window.
- **`scripts/deploy.sh`.** The workstation path carries its own inline remote
  block and calls neither `06` nor `07`, so it neither retains nor flips back.
  Recorded under *Near term* in `roadmap.md`; `CLAUDE.md` forbids running it by
  hand.
- **A concurrent deploy.** This drill is driven from a workstation and is outside
  the `deploy-production` concurrency group that serialises `ci.yml` and
  `rollback.yml`. Check by hand; nothing enforces it.
