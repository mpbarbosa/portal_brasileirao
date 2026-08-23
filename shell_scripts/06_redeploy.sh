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
# Usage:        ./shell_scripts/06_redeploy.sh
#
# Exit codes:
#   0  Service restarted and healthy.
#   1  Payload missing, or the service did not become healthy.

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/var/www/portal_brasileirao}"
SERVICE_NAME="${DEPLOY_SERVICE:-portal-brasileirao}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"

if [[ ! -f "$DEPLOY_DIR/dist/server.cjs" ]]; then
    echo "Error: $DEPLOY_DIR/dist/server.cjs not found." >&2
    exit 1
fi

if [[ ! -f "$DEPLOY_DIR/.env" ]]; then
    echo "Error: $DEPLOY_DIR/.env not found. Run 02_create_env.sh first." >&2
    exit 1
fi

cd "$DEPLOY_DIR"

echo "==> Installing production dependencies..."
npm ci --omit=dev --no-audit --no-fund

echo "==> Restarting ${SERVICE_NAME}..."
sudo systemctl restart "$SERVICE_NAME"

echo "==> Waiting for health..."
for _ in $(seq 1 30); do
    if curl -sf "$HEALTH_URL" | grep -q '"status":"ok"'; then
        echo ""
        echo "Healthy: $(curl -sf "$HEALTH_URL")"
        exit 0
    fi
    sleep 1
done

echo "Error: ${SERVICE_NAME} did not become healthy." >&2
sudo journalctl -u "$SERVICE_NAME" -n 40 --no-pager >&2
exit 1
