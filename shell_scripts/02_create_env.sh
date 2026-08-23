#!/bin/bash
#
# 02_create_env.sh
# ----------------
# Purpose:      Create the production .env on the host. This file holds the
#               only copy of the football-data token in production — it is
#               never committed, never rsynced, and survives every deploy.
#
# Usage:        ./shell_scripts/02_create_env.sh
#
# The token is read interactively (never echoed, never passed as an argument,
# so it stays out of shell history and the process list). Leaving it empty is
# valid: the app then serves seed fixtures as source:"placeholder".
#
# Exit codes:
#   0  .env written (mode 600).
#   1  Deploy directory missing.

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/var/www/portal_brasileirao}"
ENV_FILE="${DEPLOY_DIR}/.env"

if [[ ! -d "$DEPLOY_DIR" ]]; then
    echo "Error: $DEPLOY_DIR not found. Run 01_setup_app_directory.sh first." >&2
    exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
    read -r -p "$ENV_FILE exists. Overwrite? [y/N] " reply
    if [[ ! "$reply" =~ ^[Yy]$ ]]; then
        echo "Kept existing $ENV_FILE."
        exit 0
    fi
fi

read -r -p "APP_URL [https://brasileirao.example.com]: " app_url
app_url="${app_url:-https://brasileirao.example.com}"

read -r -p "PORT [3000]: " app_port
app_port="${app_port:-3000}"

# -s: no echo. Keeps the token off the terminal and out of history.
read -r -s -p "FOOTBALL_DATA_TOKEN (blank = seed fixtures): " token
echo ""

umask 077
cat > "$ENV_FILE" <<EOF
NODE_ENV="production"
APP_URL="${app_url}"
PORT="${app_port}"
STRICT_PORT="true"
FOOTBALL_DATA_TOKEN="${token}"
DISABLE_FOOTBALL_DATA="false"
EOF
chmod 600 "$ENV_FILE"

echo "Wrote $ENV_FILE (mode 600, token $([ -n "$token" ] && echo "set" || echo "empty"))."
