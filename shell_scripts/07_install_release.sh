#!/bin/bash
#
# 07_install_release.sh
# ---------------------
# Purpose:      Install a release tarball that CI published to S3 and already
#               extracted, then hand off to 06_redeploy.sh.
#
#               This is the host half of the automated deploy. It exists so CI
#               and a human deploy converge on the same code path: both end in
#               06_redeploy.sh, and only the transport differs (S3 for CI,
#               rsync-over-SSH for a workstation).
#
# Usage:        ./shell_scripts/07_install_release.sh <staging-dir>
#
# Prerequisites:
#   - <staging-dir> holds an extracted release: dist/, package.json,
#     package-lock.json, shell_scripts/.
#   - Run as the user that owns $DEPLOY_DIR (ubuntu), not root — root-owned
#     files here would break later manual deploys.
#
# Environment variables:
#   DEPLOY_DIR   Default: /var/www/portal_brasileirao
#
# Exit codes:
#   0  Release installed and the service is healthy.
#   1  Bad staging directory, or the redeploy failed.

set -euo pipefail

STAGING="${1:-}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/portal_brasileirao}"

if [[ -z "$STAGING" || ! -d "$STAGING" ]]; then
    echo "Error: usage: $0 <staging-dir>" >&2
    exit 1
fi

for required in "$STAGING/dist/server.cjs" "$STAGING/package.json" "$STAGING/package-lock.json"; do
    if [[ ! -f "$required" ]]; then
        echo "Error: incomplete release — missing ${required#"$STAGING"/}" >&2
        exit 1
    fi
done

if [[ ! -w "$DEPLOY_DIR" ]]; then
    echo "Error: $DEPLOY_DIR is not writable by $(id -un). Run as the owning user." >&2
    exit 1
fi

echo "==> Installing release into ${DEPLOY_DIR}"
# --delete on dist/ only: it is fully regenerated, while the app root holds
# .env and node_modules, which must survive.
rsync -a --delete "$STAGING/dist/" "$DEPLOY_DIR/dist/"
cp "$STAGING/package.json" "$STAGING/package-lock.json" "$DEPLOY_DIR/"

# Ship the scripts with the release so the host always runs the version that
# matches the payload it just received.
mkdir -p "$DEPLOY_DIR/shell_scripts"
cp "$STAGING"/shell_scripts/*.sh "$DEPLOY_DIR/shell_scripts/"
chmod +x "$DEPLOY_DIR"/shell_scripts/*.sh

echo "==> Handing off to 06_redeploy.sh"
exec bash "$DEPLOY_DIR/shell_scripts/06_redeploy.sh"
