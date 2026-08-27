#!/bin/bash
#
# 01_setup_app_directory.sh
# -------------------------
# Purpose:      One-time: create the deploy directory on the EC2 host, owned by
#               the login user so later deploys need no sudo for file copies.
#
# Usage:        ./shell_scripts/01_setup_app_directory.sh
#
# Prerequisites: sudo access; Node.js 22.x installed on the host.
#
# Exit codes:
#   0  Directory ready.
#   1  Node.js missing, or not the major this app is built for.

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/var/www/portal_brasileirao}"
RUN_USER="$(id -un)"

# The one Node major this app is built for. It is written here as a literal
# because this script runs on a bare host before anything has been deployed —
# .nvmrc is not there to be read. tests/node-version.test.ts is what stops the
# literal drifting from .nvmrc, package.json's `engines` and @types/node.
#
# It is an EXACT major, not a floor. A floor was what this said before (">= 20"),
# and a floor cannot catch the failure that matters: `tsc --noEmit` certifies
# against @types/node, so a host running a DIFFERENT major than the typings is
# running code the gate never checked — whether that major is older or newer.
REQUIRED_NODE_MAJOR=22

if ! command -v node > /dev/null; then
    echo "Error: node not found. Install Node.js ${REQUIRED_NODE_MAJOR}.x first." >&2
    exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$NODE_MAJOR" -ne "$REQUIRED_NODE_MAJOR" ]]; then
    echo "Error: Node.js ${REQUIRED_NODE_MAJOR}.x required (found $(node -v))." >&2
    echo "       The type gate runs against @types/node ${REQUIRED_NODE_MAJOR}; another major is unchecked code." >&2
    exit 1
fi

echo "==> Creating ${DEPLOY_DIR} (requires sudo)..."
sudo mkdir -p "${DEPLOY_DIR}/dist"
sudo chown -R "${RUN_USER}:${RUN_USER}" "$DEPLOY_DIR"

echo "Ready: ${DEPLOY_DIR} (owner ${RUN_USER}, node $(node -v))"
