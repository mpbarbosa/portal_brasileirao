#!/bin/bash
#
# 05_setup_tls.sh
# ---------------
# Purpose:      Obtain and install a Let's Encrypt certificate via certbot,
#               which rewrites the nginx site from 04 to add the TLS listener
#               and the HTTP->HTTPS redirect.
#
# Usage:        SERVER_NAME=brasileirao.example.com CERTBOT_EMAIL=you@example.com \
#                   ./shell_scripts/05_setup_tls.sh
#
# Prerequisites:
#   - 04_setup_nginx.sh has run.
#   - DNS for SERVER_NAME already points at this host (certbot validates over
#     HTTP; it fails if the record has not propagated).
#   - Security group allows inbound 80 and 443.
#   - certbot and python3-certbot-nginx installed.
#
# Exit codes:
#   0  Certificate installed; renewal timer active.
#   1  Missing config or certbot failure.

set -euo pipefail

SERVER_NAME="${SERVER_NAME:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

if [[ -z "$SERVER_NAME" || -z "$CERTBOT_EMAIL" ]]; then
    echo "Error: SERVER_NAME and CERTBOT_EMAIL must both be set." >&2
    exit 1
fi

if ! command -v certbot > /dev/null; then
    echo "Error: certbot not found (sudo apt install certbot python3-certbot-nginx)." >&2
    exit 1
fi

echo "==> Requesting certificate for ${SERVER_NAME}..."
sudo certbot --nginx \
    -d "$SERVER_NAME" \
    --non-interactive \
    --agree-tos \
    --email "$CERTBOT_EMAIL" \
    --redirect

echo "==> Verifying automatic renewal..."
sudo systemctl status certbot.timer --no-pager || true
sudo certbot renew --dry-run

echo "Done. https://${SERVER_NAME} is live."
