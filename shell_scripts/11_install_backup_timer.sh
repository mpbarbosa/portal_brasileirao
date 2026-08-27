#!/bin/bash
#
# 11_install_backup_timer.sh
# --------------------------
# Purpose:      Install the systemd timer that runs 09_backup_accounts.sh
#               nightly. One-time provisioning, like 01 and 03 — a deploy does
#               not run it.
#
# Usage:        BACKUP_BUCKET=my-bucket ./shell_scripts/11_install_backup_timer.sh
#
# Prerequisites, and the two this script CANNOT do for you:
#
#   1. **The instance role needs `s3:PutObject` on the backup prefix.** The host
#      already reads releases from the deploy bucket; writing backups is a
#      different permission on a different prefix, and it is granted in IAM
#      rather than here. Put backups somewhere **other than the deploy bucket**:
#      that one is written by CI's OIDC role and read by the host, and mixing
#      reader data into it widens both blast radii.
#   2. **A lifecycle rule on that prefix**, which is what actually defines your
#      retention period. Nothing in this repository sets one, and
#      `/privacidade` deliberately makes no retention claim — so if you add a
#      claim there, add the rule here in the same change.
#
# ---------------------------------------------------------------------------
# Prerequisite 1 is DONE and VERIFIED for account 655139684612, 2026-08-27:
#
#   bucket   portal-brasileirao-backups-655139684612  (sa-east-1)
#   access   all four public-access blocks on
#   policy   accounts-backup-write on role portal-brasileirao-ssm,
#            s3:PutObject on arn:aws:s3:::…-backups-…/accounts/* and nothing else
#   timer    enabled on i-03a9afc8a469edc89, next 04:17 UTC, User=ubuntu
#
# **Verified by restoring, not by reading a log line.** A throwaway database was
# created on the host, the service run, and the resulting object pulled back down
# and opened: `integrity_check` ok, `user_version` 2, and the one planted row
# present. Then the probe was deleted from both the host and the bucket. Without
# that last step the bucket holds an artefact somebody could restore in an
# incident, which is a worse landmine than having no backup at all.
#
# Two things that pass unnoticed and are worth knowing:
#
#   * The probe **refused to run if a real accounts.db already existed.** The
#     thing that proves your backups must never be the thing that overwrites one.
#   * Deleting the probe object needed an admin profile, because the instance
#     role has `PutObject` and nothing else — **the host cannot delete its own
#     backups.** That is the property that makes them worth having, and it was
#     confirmed here by accident rather than by design.
#
# The commands are kept below because they are the record of what was run, and
# because rebuilding this account — or standing up a second one — needs them
# again. Verify rather than assume, since nothing here can:
#
#   aws --profile <admin> iam get-role-policy \
#     --role-name portal-brasileirao-ssm --policy-name accounts-backup-write
#
# **Read the note on `--profile` below before running any of it.** The role is
# `portal-brasileirao-ssm` — the instance profile the host runs under, and the
# same one SSM drives during a deploy. `portal-brasileirao-deploy` is CI's OIDC
# role and is the wrong one.
#
#   BUCKET=portal-brasileirao-backups-655139684612
#
#   aws --profile <admin> s3 mb "s3://$BUCKET" --region sa-east-1
#
#   aws --profile <admin> s3api put-public-access-block --bucket "$BUCKET" \
#     --public-access-block-configuration \
#     BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
#
#   aws --profile <admin> iam put-role-policy \
#     --role-name portal-brasileirao-ssm \
#     --policy-name accounts-backup-write \
#     --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\
# \"Action\":\"s3:PutObject\",\"Resource\":\"arn:aws:s3:::$BUCKET/accounts/*\"}]}"
#
# `s3:PutObject` and nothing else — no `s3:DeleteObject`, no `s3:ListBucket`. A
# host that is compromised can then add backups but cannot destroy the ones
# already there, which is most of what a backup is for.
#
# ---------------------------------------------------------------------------
# **The `--profile` is not decoration, and omitting it fails in the worst way.**
#
# An unset profile does not error. It falls through to `default`, which on this
# workstation is `arn:aws:iam::655139684612:user/mpb` — an identity narrow
# enough to list bucket *names* and role *names* and almost nothing else. So
# `aws s3 mb …` answers:
#
#   AccessDenied … User: arn:aws:iam::655139684612:user/mpb is not authorized
#   to perform: s3:CreateBucket
#
# which reads as "this command is wrong" when the truth is "this identity is
# wrong". It survived `aws login` too: the login updates the *named* profile and
# the next unqualified command still uses `default`, so the same denial comes
# back verbatim after apparently fixing it. Confirm before you debug anything
# else:
#
#   aws --profile <admin> sts get-caller-identity   # must NOT be user/mpb
#
# `export AWS_PROFILE=<admin>` once beats remembering the flag three times.
#
# Note `scripts/aws-setup-monitoring.sh` documents itself as `AWS_PROFILE=mpb`,
# which is the same trap one step earlier: the profile that provisions
# infrastructure here is a *named* one, and the unnamed default is not it.
#
# Environment variables:
#   DEPLOY_DIR      Default: /var/www/portal_brasileirao
#   BACKUP_BUCKET   Required. Without it the timer would run and keep every
#                   snapshot on the same disk it is protecting.
#   BACKUP_PREFIX   Default: accounts
#   AWS_REGION      Default: sa-east-1
#   BACKUP_ON_CAL   systemd OnCalendar. Default: *-*-* 04:17:00
#
# Exit codes:
#   0  Timer installed and enabled.
#   1  Prerequisites missing.

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/var/www/portal_brasileirao}"
BACKUP_BUCKET="${BACKUP_BUCKET:-}"
BACKUP_PREFIX="${BACKUP_PREFIX:-accounts}"
AWS_REGION="${AWS_REGION:-sa-east-1}"
# 04:17 rather than 04:00: every cron on every host fires on the hour, and the
# randomised minute is free. RandomizedDelaySec below spreads it further.
BACKUP_ON_CAL="${BACKUP_ON_CAL:-*-*-* 04:17:00}"

UNIT="portal-brasileirao-backup"
RUN_USER="$(id -un)"

if [[ -z "$BACKUP_BUCKET" ]]; then
    echo "Error: BACKUP_BUCKET is required." >&2
    echo "A timer with nowhere to upload keeps every snapshot on the disk it is" >&2
    echo "meant to protect, which is not a backup." >&2
    exit 1
fi

if [[ ! -x "$DEPLOY_DIR/shell_scripts/09_backup_accounts.sh" ]]; then
    echo "Error: $DEPLOY_DIR/shell_scripts/09_backup_accounts.sh is not there." >&2
    echo "It travels inside the release tarball — deploy at least once first." >&2
    exit 1
fi

sudo tee "/etc/systemd/system/${UNIT}.service" > /dev/null <<EOF
[Unit]
Description=Back up the Portal Brasileirão accounts database to S3
# Not After=network-online.target: a Type=oneshot that has already missed its
# window is better retried tomorrow than held at boot.

[Service]
Type=oneshot
User=${RUN_USER}
WorkingDirectory=${DEPLOY_DIR}
Environment=DEPLOY_DIR=${DEPLOY_DIR}
Environment=BACKUP_BUCKET=${BACKUP_BUCKET}
Environment=BACKUP_PREFIX=${BACKUP_PREFIX}
Environment=AWS_REGION=${AWS_REGION}
ExecStart=${DEPLOY_DIR}/shell_scripts/09_backup_accounts.sh
EOF

sudo tee "/etc/systemd/system/${UNIT}.timer" > /dev/null <<EOF
[Unit]
Description=Nightly backup of the Portal Brasileirão accounts database

[Timer]
OnCalendar=${BACKUP_ON_CAL}
# Run on the next boot if the host was down when it was due. The database is
# the one thing here nothing can regenerate, so a missed night is worth
# catching up rather than skipping.
Persistent=true
RandomizedDelaySec=900

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now "${UNIT}.timer"

echo
sudo systemctl list-timers "${UNIT}.timer" --no-pager
echo
echo "Installed. Verify the whole path NOW rather than at 04:17 tomorrow:"
echo
echo "    sudo systemctl start ${UNIT}.service"
echo "    journalctl -u ${UNIT}.service -n 30 --no-pager"
echo "    aws s3 ls s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/ --region ${AWS_REGION}"
echo
echo "That first run is the only thing that proves the IAM permission exists."
echo "scripts/rehearse-accounts-backup.sh stubs aws, so it cannot tell you."
