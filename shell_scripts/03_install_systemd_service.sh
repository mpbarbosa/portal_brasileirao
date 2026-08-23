#!/bin/bash
#
# 03_install_systemd_service.sh
# -----------------------------
# Purpose:      Install and enable the systemd unit that runs the production
#               server, restarting it on failure and at boot.
#
# Usage:        ./shell_scripts/03_install_systemd_service.sh
#
# Prerequisites:
#   - ${DEPLOY_DIR}/dist/server.cjs present (deploy at least once).
#   - ${DEPLOY_DIR}/.env present (02_create_env.sh).
#   - sudo access.
#
# Exit codes:
#   0  Service installed, enabled, started.
#   1  Prerequisites missing.

set -euo pipefail

SERVICE_NAME="${DEPLOY_SERVICE:-portal-brasileirao}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/portal_brasileirao}"
RUN_USER="$(id -un)"

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
    echo "Error: node not found on PATH" >&2
    exit 1
fi

if [[ ! -f "$DEPLOY_DIR/dist/server.cjs" ]]; then
    echo "Error: $DEPLOY_DIR/dist/server.cjs not found. Deploy once first." >&2
    exit 1
fi

if [[ ! -f "$DEPLOY_DIR/.env" ]]; then
    echo "Error: $DEPLOY_DIR/.env not found. Run 02_create_env.sh first." >&2
    exit 1
fi

echo "==> Writing $SERVICE_FILE (requires sudo)..."
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Portal Brasileirão
After=network.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${DEPLOY_DIR}
EnvironmentFile=${DEPLOY_DIR}/.env
ExecStart=${NODE_BIN} dist/server.cjs
Restart=on-failure
RestartSec=5

# The process only needs to read its own directory and reach the network.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DEPLOY_DIR}

[Install]
WantedBy=multi-user.target
EOF

echo "==> Reloading systemd daemon..."
sudo systemctl daemon-reload

echo "==> Enabling and starting ${SERVICE_NAME}..."
sudo systemctl enable --now "$SERVICE_NAME"

echo ""
sudo systemctl status "$SERVICE_NAME" --no-pager
