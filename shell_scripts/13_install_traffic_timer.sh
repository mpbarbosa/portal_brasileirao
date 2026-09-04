#!/bin/bash
#
# 13_install_traffic_timer.sh
# ---------------------------
# Purpose:      Install the systemd timer that runs 12_traffic_report.sh once an
#               hour. One-time provisioning, like 01, 03 and 11 — a deploy does
#               not run it.
#
# Usage:        ./shell_scripts/13_install_traffic_timer.sh
#
# Prerequisites: a deploy has landed, so 12_traffic_report.sh is on the host —
#                it travels inside the release tarball and arrives no other way.
#
# Environment variables:
#   DEPLOY_DIR        Default: /var/www/portal_brasileirao
#   ACCESS_LOG        Default: /var/log/nginx/portal-brasileirao.access.log
#   REPORT_ON_CAL     systemd OnCalendar. Default: *:07:00 — seven past the
#                     hour, because everything else on every host fires on the
#                     hour and a free offset costs nothing.
#   REPORT_KEEP       Snapshots to keep. Default: 720 (a month at one an hour).
#
# Exit codes:
#   0  Timer installed and enabled.
#   1  Prerequisites missing.
#
# ── Why an hour, and why the snapshots are pruned ────────────────────────────
#
# An hour is the shortest interval whose deltas mean anything: the report is a
# cumulative read of nginx's whole window, so a rate is the difference between
# two snapshots, and two snapshots a minute apart divide a small difference by a
# small interval and mostly measure rounding.
#
# The pruning is not housekeeping either. `/api/traffic-dashboard` reads **every**
# summary in the directory on a cache miss, so an unbounded directory is an
# unbounded read on the request path — a year of hourly snapshots is ~8,700
# files. Keeping a month bounds that, and the timeline is still a month long.
#
# ── The report needs to read a root-owned log ────────────────────────────────
#
# /var/log/nginx is root-owned, so 12_traffic_report.sh falls back to `sudo zcat`
# when the log is not directly readable. Under systemd there is no terminal to
# prompt at, so an interactive sudo would hang the unit for ever rather than
# fail. Two ways out, and this script takes the second:
#
#   1. A NOPASSWD sudoers rule for that one command.
#   2. Put the running user in the `adm` group, which owns the nginx logs on
#      Debian/Ubuntu with group read. Then no sudo is involved at all.
#
# The second is narrower — a group membership that grants reading logs, against
# a sudo rule that grants running a program as root — so it is what this
# installs. It only takes effect on the user's next login, which is why the
# unit is not started immediately and the script says so at the end.

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/var/www/portal_brasileirao}"
ACCESS_LOG="${ACCESS_LOG:-/var/log/nginx/portal-brasileirao.access.log}"
REPORT_ON_CAL="${REPORT_ON_CAL:-*:07:00}"
REPORT_KEEP="${REPORT_KEEP:-720}"

UNIT="portal-brasileirao-traffic"
RUN_USER="$(id -un)"
REPORT_DIR="$DEPLOY_DIR/traffic-reports"

if [[ ! -x "$DEPLOY_DIR/shell_scripts/12_traffic_report.sh" ]]; then
    echo "Error: $DEPLOY_DIR/shell_scripts/12_traffic_report.sh is not there." >&2
    echo "It travels inside the release tarball — deploy at least once first." >&2
    exit 1
fi

# Inside DEPLOY_DIR and outside dist/, for accounts.db's two reasons: the unit
# sets ProtectSystem=strict with ReadWritePaths=${DEPLOY_DIR}, and both rsyncs
# delete dist/ with --delete while express.static serves it over HTTP.
mkdir -p "$REPORT_DIR"

if ! id -nG "$RUN_USER" | tr ' ' '\n' | grep -qx adm; then
    echo "==> Adding $RUN_USER to the adm group, so the report can read the nginx log"
    echo "    without sudo (systemd has no terminal to prompt at)."
    sudo usermod -aG adm "$RUN_USER"
    GROUP_ADDED=1
else
    GROUP_ADDED=0
fi

sudo tee "/etc/systemd/system/${UNIT}.service" > /dev/null <<EOF
[Unit]
Description=Snapshot the Portal Brasileirão nginx access log

[Service]
Type=oneshot
User=${RUN_USER}
WorkingDirectory=${DEPLOY_DIR}
Environment=DEPLOY_DIR=${DEPLOY_DIR}
ExecStart=${DEPLOY_DIR}/shell_scripts/12_traffic_report.sh ${ACCESS_LOG} ${REPORT_DIR}
# Prune to the newest REPORT_KEEP snapshots. A separate ExecStartPost rather
# than a step inside the report script, so a pruning failure can never lose the
# snapshot that was just written — and so the retention is set where the timer
# that produces them is, not in a script anybody may run by hand.
ExecStartPost=/bin/sh -c 'ls -1t "${REPORT_DIR}"/summary-*.txt 2>/dev/null | tail -n +$((REPORT_KEEP + 1)) | xargs -r rm -f'
EOF

sudo tee "/etc/systemd/system/${UNIT}.timer" > /dev/null <<EOF
[Unit]
Description=Hourly traffic snapshot for Portal Brasileirão

[Timer]
OnCalendar=${REPORT_ON_CAL}
# Deliberately NOT Persistent=true, which is the opposite of the backup timer's
# choice and for a reason worth stating. A missed backup is data that no longer
# exists; a missed snapshot is a reading of a log that is still sitting there,
# and catching it up at boot would stamp it with the boot time rather than the
# hour it describes — a point on the timeline in the wrong place.
Persistent=false
RandomizedDelaySec=120

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "${UNIT}.timer"
sudo systemctl start "${UNIT}.timer"

echo
sudo systemctl list-timers "${UNIT}.timer" --no-pager
echo
echo "Installed. The report dir is $REPORT_DIR; the app reads it directly, so"
echo "nothing has to be committed or copied anywhere."
echo
if [[ "$GROUP_ADDED" == 1 ]]; then
    echo "NOTE: $RUN_USER was just added to 'adm'. A group change only applies to"
    echo "      NEW logins, so the first run may still fall back to sudo and hang."
    echo "      Log out and back in (or reboot) before trusting the timer, then:"
    echo
fi
echo "    sudo systemctl start ${UNIT}.service"
echo "    journalctl -u ${UNIT}.service -n 30 --no-pager"
echo "    ls -1 ${REPORT_DIR} | tail -3"
echo
echo "Verify the whole path NOW rather than at :07 — a timer whose first run is"
echo "also its first test is one you find out about from an empty page."
