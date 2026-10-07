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
    # gzip_types matches the response Content-Type EXACTLY. This app serves JS as
    # text/javascript (charset utf-8) via Express/mime-types, so the older list --
    # which named only application/javascript -- never matched, and the bundle
    # shipped raw at 485,770 B while only JSON compressed. Both spellings are
    # listed because the sibling site (agora_na_copa_2026) serves
    # application/javascript, and Phase 2 of the devops fleet roadmap puts both
    # behind one nginx.
    #
    # NOTE: a server-level gzip_types REPLACES an http-level one rather than
    # merging with it, so this list must stay complete on its own. A shared
    # /etc/nginx/conf.d/ drop-in will not rescue it.
    #
    # text/html is omitted on purpose: nginx always gzips it and rejects the
    # config with "duplicate MIME type text/html" if listed.
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/manifest+json
        application/xml
        text/xml
        image/svg+xml;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;

    # Vite emits content-hashed filenames, so assets can cache indefinitely.
    #
    # The expires directive is deliberately NOT used: it sets a Cache-Control of
    # its own, and add_header APPENDS rather than replaces, so expires 1y plus an
    # add_header emitted TWO conflicting Cache-Control headers (measured
    # 2026-10-06: max-age=31536000 and public, immutable together). The
    # upstream's own public, max-age=0 has to be hidden for the same reason.
    #
    # Backticks must never appear in these comments: this heredoc is unquoted, so
    # the shell would run them as command substitution when the script executes.
    location /assets/ {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_hide_header Cache-Control;
        proxy_hide_header Expires;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
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
