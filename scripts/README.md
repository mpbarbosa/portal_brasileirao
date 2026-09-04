# Deployment

Target: a single EC2 instance running the built bundle as a systemd service
behind nginx. The build happens **locally** and only artifacts are copied — the
production box is small, and building there competes with the running app for
memory.

## First-time host setup

Run these on the EC2 host, in order. Steps 1–2 come before the first deploy;
step 3 needs a payload, so it comes after.

```sh
./shell_scripts/01_setup_app_directory.sh     # create /var/www/portal_brasileirao
./shell_scripts/02_create_env.sh              # write .env (prompts for the token)
# ... run scripts/deploy.sh from your workstation now ...
./shell_scripts/03_install_systemd_service.sh # install + start the service
SERVER_NAME=brasileirao.mpbarbosa.com ./shell_scripts/04_setup_nginx.sh
SERVER_NAME=brasileirao.mpbarbosa.com CERTBOT_EMAIL=you@example.com \
    ./shell_scripts/05_setup_tls.sh

# Careful: 04 rewrites the site file that certbot edited, dropping TLS back to
# plain HTTP. On a host that already has a certificate, re-run 05 afterwards.
```

## The live host

Instance `i-03a9afc8a469edc89` (t3.micro, sa-east-1a) at `54.232.242.45`, serving
https://brasileirao.mpbarbosa.com. The address is an Elastic IP (`eipalloc-07c282fdbbf3a18f6`), so it survives a stop/start.

## Deploying

Pushing to `main` deploys automatically once CI is green — see the `deploy` job in
`.github/workflows/ci.yml`. To deploy by hand from your workstation:

```sh
DEPLOY_HOST=ubuntu@54.232.242.45 DEPLOY_SSH_KEY=~/.ssh/portal-brasileirao.pem npm run deploy
```

Preview exactly what would change without touching the host:

```sh
DEPLOY_HOST=ubuntu@1.2.3.4 ./scripts/deploy.sh --dry-run
```

`deploy.sh` runs the preflight, rsyncs the release into a fresh staging directory
on the host — `dist/`, the package manifests and `shell_scripts/` — and then runs
`07_install_release.sh` from that staging copy. That is the same handoff CI makes
after untarring a release from S3, so both routes end in `06_redeploy.sh` and only
the transport differs.

What that buys, and the reason the inline version was replaced: the release
currently on disk is **retained** before anything overwrites it, and a payload
that fails its health check is **flipped back** to it automatically. Before this
the workstation path rsynced `--delete` over the running build and then found out
whether the new one worked.

So it can now end other than 0 or 1:

| exit | meaning |
| --- | --- |
| 0 | deployed and healthy |
| 1 | a step failed; the running release was left alone or restored |
| 2 | the new release was unhealthy and the **previous** one is now serving |
| 3 | unhealthy **and** the flip-back failed — the service is down |
| 4 | payload installed, but the host has no service unit: run `03_install_systemd_service.sh` there |

`--dry-run` compares the local `dist/` against the live one rather than against an
empty staging directory, since that is the transfer `07` will actually perform.
Nothing is staged and nothing is run.

`scripts/rehearse-deploy-sh.sh` drives all of it against stubs — no host, no key,
no outage.

## Secrets

The football-data token lives only in `/var/www/portal_brasileirao/.env` on the
host, written by `02_create_env.sh` (mode 600, read without echo so it stays out
of shell history and the process list).

Deploys never transfer or delete it: `dist/` syncs with `--delete` because it is
fully regenerated, while the app root syncs without `--delete` precisely so
`.env` and `node_modules/` survive. Rotating the token means editing that file
and running `06_redeploy.sh` — no rebuild.

## Locked out?

SSH is authorized only from the deployer's current public IP, which on a home
connection changes without warning. Re-point the rule:

```sh
AWS_PROFILE=mpb ./scripts/aws-allow-my-ip.sh
```

If that still fails, the instance carries an SSM instance profile, so this works
regardless of IP or security group:

```sh
AWS_PROFILE=mpb aws ssm start-session --target i-03a9afc8a469edc89
```

## Monitoring — currently OFF

Monitoring was built and then removed for cost; nothing watches either site today.
To re-enable:

```sh
AWS_PROFILE=mpb ./scripts/aws-setup-monitoring.sh
```

Idempotent — re-run it to change a threshold. Re-enabling memory/disk alarms also needs
`CloudWatchAgentServerPolicy` re-attached to the `portal-brasileirao-ssm` role and the
agent restarted on the host (`08_install_cloudwatch_agent.sh`). Alerts go to an SNS topic per region;
**the email subscription must be confirmed from the inbox** before AWS delivers anything.

Check current state:

```sh
AWS_PROFILE=mpb aws cloudwatch describe-alarms --region sa-east-1 \
    --alarm-name-prefix portal-brasileirao \
    --query 'MetricAlarms[].{Name:AlarmName,State:StateValue}' --output table
```

## Traffic snapshots — currently OFF

Nothing reads the access log until the timer is installed. It is not part of a
deploy: the report script ships inside every release tarball, and installing the
timer is one-time provisioning like `01`, `03` and `11`.

```sh
./shell_scripts/13_install_traffic_timer.sh    # hourly, :07 past, keeps a month
```

The snapshots land in `/var/www/portal_brasileirao/traffic-reports/` and the app
reads that directory directly — nothing is committed and nothing is copied. Then
`/trafego` on the live site draws them, and `npm run traffic-dashboard -- --url
https://brasileirao.mpbarbosa.com` draws the same payload in a local window.

**Verify it by hand once, before trusting the timer.** The report has to read a
root-owned log under `/var/log/nginx`, and the installer's answer is to put the
running user in the `adm` group rather than to add a sudoers rule — narrower,
but a group change only applies to **new logins**, so the first timed run can
still fall back to an interactive `sudo` that has no terminal to prompt at and
will simply hang.

```sh
sudo systemctl start portal-brasileirao-traffic.service
journalctl -u portal-brasileirao-traffic.service -n 30 --no-pager
ls -1 /var/www/portal_brasileirao/traffic-reports | tail -3
```

Optional, and only worth it if you want the country and city sections — the
lookups are entirely local, so no visitor address leaves the host:

```sh
sudo apt-get install -y mmdb-bin
# then place GeoLite2-City.mmdb in /var/lib/GeoIP/ (free MaxMind account),
# or point GEO_DB at it. A Country database works and yields no cities.
```

To turn it off again:

```sh
sudo systemctl disable --now portal-brasileirao-traffic.timer
```

## Recovering a broken service

On the host:

```sh
./shell_scripts/06_redeploy.sh
```

Reinstalls dependencies, restarts, and health-checks against the payload already
on disk. For the app-level kill switch, set `DISABLE_FOOTBALL_DATA="true"` in
`.env` and redeploy — the app serves seed fixtures instead of calling the
upstream, with no code change.
