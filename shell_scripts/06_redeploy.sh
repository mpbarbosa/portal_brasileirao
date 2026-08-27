#!/bin/bash
#
# 06_redeploy.sh
# --------------
# Purpose:      Restart the service against whatever payload is currently in
#               the deploy directory, and verify it came back healthy. Run on
#               the host when you have changed .env, or need to recover a
#               service that failed — scripts/deploy.sh does this step remotely
#               as part of a normal deploy.
#
#               When ROLLBACK_FROM names a retained release, a payload that
#               fails to come up healthy is **flipped back** to that release
#               rather than left broken. 07_install_release.sh sets it; a
#               standalone run does not, so an operator redeploying after an
#               .env change never has the build swapped underneath them.
#
# Usage:        ./shell_scripts/06_redeploy.sh
#
# Environment variables:
#   DEPLOY_DIR        Default: /var/www/portal_brasileirao
#   DEPLOY_SERVICE    Default: portal-brasileirao
#   HEALTH_URL        Default: http://127.0.0.1:3000/api/health
#   HEALTH_ATTEMPTS   Health poll attempts, one per second. Default: 30
#   ROLLBACK_FROM     A directory holding dist/, package.json and
#                     package-lock.json to flip back to. Unset disables
#                     flip-back entirely.
#
# Exit codes:
#   0  Service restarted and healthy.
#   1  Payload missing, or unhealthy with no usable release to flip back to.
#   2  The new payload was unhealthy and the PREVIOUS release is now serving.
#   3  The new payload was unhealthy and the flip-back ALSO failed: the service
#      is down. This is the one that needs a person.

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/var/www/portal_brasileirao}"
SERVICE_NAME="${DEPLOY_SERVICE:-portal-brasileirao}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-30}"
ROLLBACK_FROM="${ROLLBACK_FROM:-}"

# Install the dependencies the payload on disk asks for, then restart. Both
# halves matter on a flip-back: `npm ci --omit=dev` prunes, so a release that
# dropped a dependency leaves node_modules unable to satisfy the release before
# it. Restoring dist/ alone would flip back to a build whose modules are gone.
install_and_restart() {
    npm ci --omit=dev --no-audit --no-fund || return 1
    # Pick up any unit-file change shipped with this release, and silence the
    # "unit file changed on disk" warning that otherwise masks a real one.
    sudo systemctl daemon-reload || return 1
    sudo systemctl restart "$SERVICE_NAME" || return 1
}

wait_for_health() {
    local _
    for _ in $(seq 1 "$HEALTH_ATTEMPTS"); do
        if curl -sf "$HEALTH_URL" 2>/dev/null | grep -q '"status":"ok"'; then
            return 0
        fi
        sleep 1
    done
    return 1
}

# A retained release is only a rollback target if it is complete. A half-copied
# one would turn a recoverable bad release into an unrecoverable one.
rollback_available() {
    [[ -n "$ROLLBACK_FROM" ]] || return 1
    [[ -f "$ROLLBACK_FROM/dist/server.cjs" ]] || return 1
    [[ -f "$ROLLBACK_FROM/package.json" ]] || return 1
    [[ -f "$ROLLBACK_FROM/package-lock.json" ]] || return 1
}

flip_back() {
    echo "==> Flipping back to the retained release in ${ROLLBACK_FROM}..." >&2
    rsync -a --delete "$ROLLBACK_FROM/dist/" "$DEPLOY_DIR/dist/" || return 1
    cp "$ROLLBACK_FROM/package.json" "$ROLLBACK_FROM/package-lock.json" "$DEPLOY_DIR/" || return 1
    install_and_restart || return 1
    wait_for_health || return 1
}

if [[ ! -f "$DEPLOY_DIR/dist/server.cjs" ]]; then
    echo "Error: $DEPLOY_DIR/dist/server.cjs not found." >&2
    exit 1
fi

if [[ ! -f "$DEPLOY_DIR/.env" ]]; then
    echo "Error: $DEPLOY_DIR/.env not found. Run 02_create_env.sh first." >&2
    exit 1
fi

cd "$DEPLOY_DIR"

echo "==> Installing production dependencies and restarting ${SERVICE_NAME}..."
failure=""
if ! install_and_restart; then
    failure="did not install its dependencies or restart"
else
    echo "==> Waiting for health..."
    if ! wait_for_health; then
        failure="did not become healthy"
    fi
fi

if [[ -z "$failure" ]]; then
    echo ""
    echo "Healthy: $(curl -sf "$HEALTH_URL")"
    exit 0
fi

echo "Error: ${SERVICE_NAME} ${failure}." >&2
sudo journalctl -u "$SERVICE_NAME" -n 40 --no-pager >&2 || true

if [[ -z "$ROLLBACK_FROM" ]]; then
    # Today's behaviour, kept for a standalone run: report and stop.
    exit 1
fi

if ! rollback_available; then
    echo "Error: ROLLBACK_FROM=${ROLLBACK_FROM} does not hold a complete release" \
         "(dist/server.cjs, package.json, package-lock.json); not flipping back." >&2
    exit 1
fi

if flip_back; then
    echo ""
    echo "ROLLED BACK: ${SERVICE_NAME} is serving the PREVIOUS release from ${ROLLBACK_FROM}."
    echo "Health: $(curl -sf "$HEALTH_URL")"
    echo "The release that was being installed is NOT live. Failing so the pipeline goes red."
    exit 2
fi

echo "" >&2
echo "CRITICAL: the new release was unhealthy AND the flip-back failed." >&2
echo "CRITICAL: ${SERVICE_NAME} is DOWN and needs a person." >&2
sudo journalctl -u "$SERVICE_NAME" -n 40 --no-pager >&2 || true
exit 3
