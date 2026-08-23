#!/bin/bash
#
# deploy-preflight.sh
# -------------------
# Purpose:      Build the production payload and prove it actually boots and
#               serves before anything is shipped to a remote host. Catches the
#               class of failure that only appears in the bundled CJS build —
#               a runtime dep left in devDependencies, a bad import path — which
#               `npm run dev` cannot surface.
#
# Usage:        ./scripts/deploy-preflight.sh [-h|--help]
#
# Prerequisites:
#   - Node.js and npm on PATH.
#   - curl on PATH.
#
# What it does:
#   1. Type-checks (npm run lint) and runs the unit suite.
#   2. Builds dist/ (frontend bundle + dist/server.cjs).
#   3. Verifies the expected payload files exist.
#   4. Boots dist/server.cjs on a scratch port with NODE_ENV=production and no
#      provider token, so the smoke test exercises the offline fallback rather
#      than depending on a live upstream or spending API quota.
#   5. Smoke-tests /api/health, /api/standings, and the SPA index.
#   6. Stops the server and reports the payload size.
#
# Environment variables:
#   PREFLIGHT_PORT   Port for the smoke-test server. Default: 3399.
#
# Exit codes:
#   0  Payload built and verified.
#   1  Any step failed.

set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    sed -n '2,35p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PREFLIGHT_PORT="${PREFLIGHT_PORT:-3399}"
SERVER_PID=""

cleanup() {
    if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

cd "$PROJECT_ROOT"

echo "==> Type-checking..."
npm run lint

echo "==> Running unit tests..."
npm run test:unit

echo "==> Building production payload..."
npm run build

echo "==> Verifying payload contents..."
for artifact in dist/server.cjs dist/index.html; do
    if [[ ! -f "$artifact" ]]; then
        echo "Error: expected $artifact after build" >&2
        exit 1
    fi
done
if ! compgen -G "dist/assets/*.js" > /dev/null; then
    echo "Error: no JS bundle in dist/assets/" >&2
    exit 1
fi

# No token on purpose: preflight must not depend on the upstream being healthy,
# and must not spend the free tier's 10 req/min budget. The fallback path is
# what we assert here; the live path is checked post-deploy against /api/health.
echo "==> Booting dist/server.cjs on port ${PREFLIGHT_PORT}..."
NODE_ENV=production \
    PORT="$PREFLIGHT_PORT" \
    STRICT_PORT=true \
    FOOTBALL_DATA_TOKEN="" \
    node dist/server.cjs &
SERVER_PID=$!

for _ in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:${PREFLIGHT_PORT}/api/health" > /dev/null 2>&1; then
        break
    fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        echo "Error: server exited during startup" >&2
        exit 1
    fi
    sleep 1
done

echo "==> Smoke-testing endpoints..."
if ! curl -sf "http://127.0.0.1:${PREFLIGHT_PORT}/api/health" | grep -q '"status":"ok"'; then
    echo "Error: /api/health did not report ok" >&2
    exit 1
fi

if ! curl -sf "http://127.0.0.1:${PREFLIGHT_PORT}/api/standings" | grep -q '"source"'; then
    echo "Error: /api/standings did not return an envelope" >&2
    exit 1
fi

if ! curl -sf "http://127.0.0.1:${PREFLIGHT_PORT}/" | grep -q "Portal Brasileirão"; then
    echo "Error: SPA index did not render" >&2
    exit 1
fi

echo ""
echo "Preflight OK — payload size: $(du -sh dist | cut -f1)"
