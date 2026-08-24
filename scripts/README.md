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
SERVER_NAME=brasileirao.example.com ./shell_scripts/04_setup_nginx.sh
SERVER_NAME=brasileirao.example.com CERTBOT_EMAIL=you@example.com \
    ./shell_scripts/05_setup_tls.sh
```

## The live host

Instance `i-03a9afc8a469edc89` (t3.micro, sa-east-1a) at `54.232.242.45`, serving
http://54.232.242.45. The address is an Elastic IP (`eipalloc-07c282fdbbf3a18f6`), so it survives a stop/start.

## Deploying

From your workstation:

```sh
DEPLOY_HOST=ubuntu@54.232.242.45 DEPLOY_SSH_KEY=~/.ssh/portal-brasileirao.pem npm run deploy
```

Preview exactly what would change without touching the host:

```sh
DEPLOY_HOST=ubuntu@1.2.3.4 ./scripts/deploy.sh --dry-run
```

`deploy.sh` runs the preflight, syncs `dist/` plus the package manifests, then
over SSH runs `npm ci --omit=dev`, restarts the service, and polls
`/api/health` — failing loudly with the last 40 journal lines if the service
doesn't come back.

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

## Recovering a broken service

On the host:

```sh
./shell_scripts/06_redeploy.sh
```

Reinstalls dependencies, restarts, and health-checks against the payload already
on disk. For the app-level kill switch, set `DISABLE_FOOTBALL_DATA="true"` in
`.env` and redeploy — the app serves seed fixtures instead of calling the
upstream, with no code change.
