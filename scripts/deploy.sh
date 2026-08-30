#!/bin/bash
#
# deploy.sh
# ---------
# Purpose:      Ship the built payload to the EC2 host and restart the service.
#               Builds locally and copies artifacts: the production instance is
#               a small box, and building there competes with the running app
#               for memory.
#
# Usage:        ./scripts/deploy.sh [--dry-run] [--skip-preflight] [-h|--help]
#
# Arguments:
#   --dry-run          Show what rsync would transfer; make no remote changes.
#   --skip-preflight   Skip the local build/verify step (payload must exist).
#
# Prerequisites:
#   - DEPLOY_HOST set (e.g. ubuntu@ec2-1-2-3-4.compute-1.amazonaws.com).
#   - SSH access to that host, with sudo for the service restart.
#   - Host already provisioned: see shell_scripts/01..04.
#   - rsync, ssh, curl on PATH.
#
# What it does:
#   1. Runs scripts/deploy-preflight.sh (unless --skip-preflight).
#   2. Rsyncs the release into a fresh staging directory on the host: dist/,
#      package.json, package-lock.json and shell_scripts/.
#   3. Runs shell_scripts/07_install_release.sh from that staging copy, which
#      retains the release currently on disk, installs the new one and hands off
#      to 06_redeploy.sh.
#   4. Removes the staging directory.
#
# Steps 2 and 3 are the same shape CI uses over SSM, and deliberately so. This
# script used to rsync straight into $DEPLOY_DIR/dist with --delete and then run
# its own inline copy of npm-ci-restart-health — which destroyed the running
# build before the new one was proven, and left an operator with nothing to
# return to at exactly the moment they needed it. Handing off to 07 gives the
# workstation path the retention and the automatic flip-back that D5b gave the
# pipeline, and removes the third copy of the restart logic rather than adding
# to it.
#
# The remote .env is never transferred and never deleted — production secrets
# live only on the host (shell_scripts/02_create_env.sh) and survive deploys.
# The staging directory is a fresh mktemp under /tmp, so nothing here can leave
# a partial payload in $DEPLOY_DIR.
#
# Environment variables:
#   DEPLOY_HOST      Required. user@host for ssh/rsync.
#   DEPLOY_DIR       Remote app directory. Default: /var/www/portal_brasileirao
#   DEPLOY_SERVICE   systemd unit name. Default: portal-brasileirao
#   DEPLOY_SSH_KEY   Optional path to an SSH private key.
#   HEALTH_URL       Post-deploy health URL. Default: http://127.0.0.1:3000/api/health
#                    (checked over SSH, from the host's own loopback)
#
# Exit codes (2, 3 and 4 come straight from 07_install_release.sh):
#   0  Deployed and health-checked.
#   1  Any step failed, with the running release left as it was or restored.
#   2  The new release was unhealthy and the PREVIOUS one is now serving.
#   3  The new release was unhealthy and the flip-back ALSO failed: service down.
#   4  Payload installed, but the host has no service unit yet: run
#      shell_scripts/03_install_systemd_service.sh there. First deploy only.

set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    sed -n '2,60p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/portal_brasileirao}"
DEPLOY_SERVICE="${DEPLOY_SERVICE:-portal-brasileirao}"
DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"

DRY_RUN=0
SKIP_PREFLIGHT=0
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --skip-preflight) SKIP_PREFLIGHT=1 ;;
        *) echo "Unknown argument: $arg (try --help)" >&2; exit 1 ;;
    esac
done

if [[ -z "$DEPLOY_HOST" ]]; then
    echo "Error: DEPLOY_HOST is not set (e.g. ubuntu@1.2.3.4). See --help." >&2
    exit 1
fi

SSH_OPTS=()
RSYNC_SSH="ssh"
if [[ -n "$DEPLOY_SSH_KEY" ]]; then
    if [[ ! -f "$DEPLOY_SSH_KEY" ]]; then
        echo "Error: DEPLOY_SSH_KEY not found: $DEPLOY_SSH_KEY" >&2
        exit 1
    fi
    SSH_OPTS=(-i "$DEPLOY_SSH_KEY")
    RSYNC_SSH="ssh -i $DEPLOY_SSH_KEY"
fi

cd "$PROJECT_ROOT"

if [[ "$SKIP_PREFLIGHT" -eq 0 ]]; then
    "$SCRIPT_DIR/deploy-preflight.sh"
else
    echo "==> Skipping preflight (--skip-preflight)"
    if [[ ! -f dist/server.cjs ]]; then
        echo "Error: dist/server.cjs missing; cannot skip preflight." >&2
        exit 1
    fi
fi

RSYNC_FLAGS=(-az --human-readable)

if [[ "$DRY_RUN" -eq 1 ]]; then
    # A dry run previews the transfer that will actually land. 07 rsyncs
    # staging/dist/ into $DEPLOY_DIR/dist/ with the same -a --delete, so
    # comparing the local dist/ against the live one is the honest preview —
    # where diffing against an empty staging directory would report every file
    # as new and tell you nothing. Nothing is staged and nothing is run.
    echo ""
    echo "==> DRY RUN — no remote changes will be made"
    RSYNC_FLAGS+=(--dry-run --itemize-changes)

    echo ""
    echo "==> dist/ against ${DEPLOY_HOST}:${DEPLOY_DIR}/dist"
    rsync "${RSYNC_FLAGS[@]}" --delete -e "$RSYNC_SSH" \
        dist/ "${DEPLOY_HOST}:${DEPLOY_DIR}/dist/"

    echo "==> package manifests against ${DEPLOY_HOST}:${DEPLOY_DIR}"
    rsync "${RSYNC_FLAGS[@]}" -e "$RSYNC_SSH" \
        package.json package-lock.json "${DEPLOY_HOST}:${DEPLOY_DIR}/"

    echo ""
    echo "Dry run complete — nothing was changed on ${DEPLOY_HOST}."
    exit 0
fi

echo ""
echo "==> Creating a staging directory on ${DEPLOY_HOST}"
STAGING="$(ssh "${SSH_OPTS[@]}" "$DEPLOY_HOST" 'mktemp -d /tmp/release-XXXXXXXX')"
if [[ -z "$STAGING" ]]; then
    echo "Error: could not create a staging directory on ${DEPLOY_HOST}." >&2
    exit 1
fi
echo "    ${STAGING}"

# Remove it however this script ends, including on a failed install: a staging
# copy left behind is a whole release worth of bytes in /tmp, and it is the
# release that just failed.
# shellcheck disable=SC2329  # invoked by the trap below, not by name.
cleanup_staging() {
    # shellcheck disable=SC2029  # expanding on the client is the point: printf %q
    # quotes the path here so the remote shell receives one safe literal.
    ssh "${SSH_OPTS[@]}" "$DEPLOY_HOST" "rm -rf -- $(printf %q "$STAGING")" 2>/dev/null || true
}
trap cleanup_staging EXIT

echo ""
echo "==> Staging the release"
# shell_scripts/ travels with the payload for the reason CI's tarball carries it:
# the host then runs the deploy logic that matches the release it just received,
# rather than whatever the last one left behind.
rsync "${RSYNC_FLAGS[@]}" -e "$RSYNC_SSH" \
    dist package.json package-lock.json shell_scripts \
    "${DEPLOY_HOST}:${STAGING}/"

echo ""
echo "==> Installing the release (07_install_release.sh on the host)"
rc=0
# shellcheck disable=SC2029  # deliberate: every value is quoted with printf %q on
# this side, so the remote shell is handed literals rather than anything to expand.
ssh "${SSH_OPTS[@]}" "$DEPLOY_HOST" \
    "DEPLOY_DIR=$(printf %q "$DEPLOY_DIR") \
     DEPLOY_SERVICE=$(printf %q "$DEPLOY_SERVICE") \
     HEALTH_URL=$(printf %q "$HEALTH_URL") \
     bash $(printf %q "$STAGING/shell_scripts/07_install_release.sh") $(printf %q "$STAGING")" \
    || rc=$?

echo ""
case "$rc" in
    0)
        echo "Deployed to ${DEPLOY_HOST}."
        ;;
    2)
        echo "ROLLED BACK: ${DEPLOY_HOST} is serving the PREVIOUS release." >&2
        echo "The build you just sent is NOT live. Nothing further is needed to" >&2
        echo "keep the site up; fix the build and deploy again." >&2
        ;;
    3)
        echo "CRITICAL: the new release was unhealthy AND the flip-back failed." >&2
        echo "CRITICAL: ${DEPLOY_SERVICE} on ${DEPLOY_HOST} is DOWN and needs a person." >&2
        ;;
    4)
        echo "Payload installed, but ${DEPLOY_SERVICE} does not exist on ${DEPLOY_HOST} yet."
        echo "Finish the first-time setup on the host:"
        echo "    ./shell_scripts/03_install_systemd_service.sh"
        ;;
    *)
        echo "Deploy failed (exit ${rc}) — see the output above." >&2
        ;;
esac

exit "$rc"
