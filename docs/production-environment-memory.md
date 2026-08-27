# Production environment memory

Captured: 2026-08-27T07:40-03:00. Imported from the sibling repo
`agora_na_copa_2026` and rewritten for this project's host and pipeline.

**Read the provenance before the values.** This document was assembled from
this repository's own deploy configuration and from one unauthenticated request
to the live `/api/health` — **nobody logged into the host to write it**. So the
runtime figures are what the running process reported, and the machine figures
are what the instance type entails rather than what `free` and `df` said on the
day. Where the sibling repo's copy prints a live filesystem reading, this one
does not, and inventing a plausible one is precisely the failure worth avoiding:
a made-up capacity is indistinguishable from a measured one to whoever reads it
next.

## Role

- This machine is the **production environment** for `portal_brasileirao`,
  serving https://brasileirao.mpbarbosa.com.
- The **development environment is a different machine**, documented in
  `docs/development-environment-memory.md`.
- **Nothing is built here.** The host is too small to build on; it receives a
  prebuilt payload and runs `npm ci --omit=dev`. That is also why a runtime
  dependency stranded in `devDependencies` stays invisible until the bundle
  boots, which is the failure CI's boot step exists to catch.

## Repository context

- Repository: `mpbarbosa/portal_brasileirao`
- There is **no git checkout on this host**, and that is the design. The unit of
  release is a tarball of `dist/`, `package.json`, `package-lock.json` and
  `shell_scripts/`, built once by CI and promoted unchanged. `shell_scripts/`
  travels inside it, so the host always runs the deploy logic matching the
  release it just received.

## Machine and runtime

- Instance: `i-03a9afc8a469edc89`, `t3.micro`, availability zone `sa-east-1a`
- Address: `54.232.242.45`, an Elastic IP (`eipalloc-07c282fdbbf3a18f6`), so it
  survives a stop/start
- AWS account: `655139684612`, region `sa-east-1`
- OS user: `ubuntu`
- Node.js: `22.23.2` — reported by `/api/health` at capture, which is
  `process.versions.node` on the running process rather than what any file says
  it ought to be. It agrees with `.nvmrc`'s **22**, and
  `shell_scripts/01_setup_app_directory.sh` enforces that major exactly rather
  than as a floor.

`t3.micro` is 2 vCPU / 1 GiB and **burstable**: sustained CPU means credits are
draining, which `scripts/aws-setup-monitoring.sh` alarms on. Under 1 GB of RAM
is also why the CloudWatch agent is installed at all — EC2 publishes neither
memory nor disk natively.

## Application layout on the host

- `DEPLOY_DIR`: `/var/www/portal_brasileirao`
- systemd unit: `portal-brasileirao`, with `ProtectSystem=strict` and
  `ReadWritePaths=${DEPLOY_DIR}` — so `/var/lib` is read-only to the process
- nginx terminates TLS in front of the app; certbot holds the certificate for
  `brasileirao.mpbarbosa.com` and `certbot.timer` renews twice daily,
  unattended
- `ACCOUNTS_DB` defaults to `./data/accounts.db` and must stay **inside
  `DEPLOY_DIR`** (the unit's `ReadWritePaths`) and **outside `dist/`**, which
  both rsyncs delete with `--delete` and `express.static` serves over HTTP. It
  is the first state here that no script can regenerate.
- `.env` lives on the host and is **not** updated by a deploy, which is why
  every new environment variable needs a safe in-code default.

**Re-running `shell_scripts/04_setup_nginx.sh` overwrites certbot's edits** and
drops the site to plain HTTP until `05_setup_tls.sh` is run again. Do not run
`04` casually on a host that already has TLS.

## How a release reaches this host

There is **no inbound SSH from CI and no long-lived AWS credential**. The
`deploy` job mints an OIDC token, assumes
`arn:aws:iam::655139684612:role/portal-brasileirao-deploy`, writes the payload
to `s3://portal-brasileirao-deploy-655139684612/releases/<sha>.tar.gz`, and
drives the host over SSM. The security group stays pinned to the maintainer's
address (`scripts/aws-allow-my-ip.sh`).

On the host, `07_install_release.sh` retains the current release into
`previous/` and rsyncs the new one into place; `06_redeploy.sh` runs `npm ci
--omit=dev`, restarts the unit and health-checks it, flipping back to
`previous/` and exiting **2** if the new build never reports healthy — the old
build serving, the pipeline red. Exit **3** with `CRITICAL` means the flip-back
itself failed, which is a different situation and needs a different response.

Rolling back deliberately is `.github/workflows/rollback.yml`, which installs
bytes S3 already holds without rebuilding them. Dispatching it with an empty sha
lists what the bucket has and changes nothing.

## Reading the state of this host

```sh
curl -s https://brasileirao.mpbarbosa.com/api/health
```

At capture that answered:

```json
{"status":"ok","sha":"8c3a6b1","builtAt":"2026-08-27T10:33:29Z",
 "uptime":126.36,"node":"22.23.2","provider":"football-data"}
```

`sha` is stamped into the bundle at esbuild time, so it names the commit the
running code was **built from** whatever host it landed on — which is what makes
it a stronger check than uptime, and what the pipeline's final assertion and the
ancestry guard both read. `provider` names what is **configured**, not whether
the last upstream call succeeded; that is the envelope's `source` on the data
endpoints.

**Verify a deploy with `/api/health`, never with the CI badge.** A red advisory
job (the screenshots check) sets the whole run to `failure` while `deploy`
succeeds, and that has been misread as a stopped pipeline more than once.

## Notes for future memory use

- Treat this document as environment-specific context for **production-only**
  tasks.
- Do not assume development behaviour, ports, Node version or machine capacity
  match this host — it has roughly a fourteenth of the cores and a thirtieth of
  the memory.
- The runtime values above were true at the capture timestamp and change on
  every release. Re-read `/api/health` rather than citing them.
- Machine figures here derive from the instance type and this repository's
  configuration. If a specific number matters, measure it on the host and note
  that you did.
