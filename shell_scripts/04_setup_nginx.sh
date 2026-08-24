#!/bin/bash
#
# 04_setup_nginx.sh
# -----------------
# Purpose:      Put nginx in front of the Node process as a reverse proxy, so
#               the app never binds :80 directly and static assets are served
#               with long cache headers.
#
# Usage:        SERVER_NAME=brasileirao.example.com ./shell_scripts/04_setup_nginx.sh
#
# Prerequisites: nginx installed; sudo access.
#
# Environment variables:
#   SERVER_NAME   Required. The public hostname, or "_" to accept any Host —
#                 which is what you want while the site is reached by bare IP.
#   APP_PORT      Upstream Node port. Default: 3000.
#
# Note: this writes a plain HTTP server block. Run 05_setup_tls.sh afterwards —
# certbot rewrites this file in place to add the TLS listener and redirect.
#
# Exit codes:
#   0  Config installed and nginx reloaded.
#   1  Missing SERVER_NAME, nginx absent, or config test failed.

set -euo pipefail

SERVER_NAME="${SERVER_NAME:-}"
APP_PORT="${APP_PORT:-3000}"
SITE_NAME="portal-brasileirao"
SITE_FILE="/etc/nginx/sites-available/${SITE_NAME}"

if [[ -z "$SERVER_NAME" ]]; then
    echo "Error: SERVER_NAME is not set (e.g. brasileirao.example.com)." >&2
    exit 1
fi

if ! command -v nginx > /dev/null; then
    echo "Error: nginx not found. Install it first (sudo apt install nginx)." >&2
    exit 1
fi

echo "==> Writing $SITE_FILE (requires sudo)..."
sudo tee "$SITE_FILE" > /dev/null <<EOF
server {
    # default_server, and the packaged default site is removed below: without
    # both, a request whose Host matches no server_name lands on nginx's welcome
    # page instead of the app — which is exactly what a bare-IP request does.
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${SERVER_NAME};

    access_log /var/log/nginx/${SITE_NAME}.access.log;
    error_log  /var/log/nginx/${SITE_NAME}.error.log;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # Vite emits content-hashed filenames, so assets can cache indefinitely.
    location /assets/ {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_set_header Host \$host;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
    }
}
EOF

sudo ln -sfn "$SITE_FILE" "/etc/nginx/sites-enabled/${SITE_NAME}"

# Two default_server blocks on the same port is a hard nginx config error, so the
# packaged default has to go rather than merely losing precedence.
if [[ -e /etc/nginx/sites-enabled/default ]]; then
    echo "==> Removing the packaged default site..."
    sudo rm -f /etc/nginx/sites-enabled/default
fi

echo "==> Testing nginx configuration..."
sudo nginx -t

echo "==> Reloading nginx..."
sudo systemctl reload nginx

echo "Done. http://${SERVER_NAME} now proxies to 127.0.0.1:${APP_PORT}"
