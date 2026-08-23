#!/bin/bash
#
# 01_setup_app_directory.sh
# -------------------------
# Purpose:      One-time: create the deploy directory on the EC2 host, owned by
#               the login user so later deploys need no sudo for file copies.
#
# Usage:        ./shell_scripts/01_setup_app_directory.sh
#
# Prerequisites: sudo access; Node.js 20+ installed on the host.
#
# Exit codes:
#   0  Directory ready.
#   1  Node.js missing or too old.

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/var/www/portal_brasileirao}"
RUN_USER="$(id -un)"

if ! command -v node > /dev/null; then
    echo "Error: node not found. Install Node.js 20+ first." >&2
    exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
    echo "Error: Node.js 20+ required (found $(node -v))." >&2
    exit 1
fi

echo "==> Creating ${DEPLOY_DIR} (requires sudo)..."
sudo mkdir -p "${DEPLOY_DIR}/dist"
sudo chown -R "${RUN_USER}:${RUN_USER}" "$DEPLOY_DIR"

echo "Ready: ${DEPLOY_DIR} (owner ${RUN_USER}, node $(node -v))"
