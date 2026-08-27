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
