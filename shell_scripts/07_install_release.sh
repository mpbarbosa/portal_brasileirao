#!/bin/bash
#
# 07_install_release.sh
# ---------------------
# Purpose:      Install a release tarball that CI published to S3 and already
#               extracted, then hand off to 06_redeploy.sh.
#
#               This is the host half of the deploy, and both routes reach it:
#               CI downloads a tarball from S3 and runs it, scripts/deploy.sh
#               rsyncs a staging directory over SSH and runs it. Only the
#               transport differs; both end in 06_redeploy.sh, so there is one
#               copy of the retain / install / restart / flip-back logic.
#
#               Before overwriting dist/, the release currently on disk is
#               retained under $DEPLOY_DIR/previous/, and 06_redeploy.sh is told
#               where it is. A payload that fails its health check is then
#               flipped back to it automatically, so the default outcome of a bad
#               release is the previous release running rather than nothing.
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
#   DEPLOY_DIR       Default: /var/www/portal_brasileirao
#   DEPLOY_SERVICE   Default: portal-brasileirao. Read here only to name the unit
#                    in the first-deploy check below; 06_redeploy.sh reads it too.
#
# Exit codes:
#   0  Release installed and the service is healthy.
#   1  Bad staging directory, could not retain the current release, or the
#      redeploy failed with nothing to flip back to.
#   2  The release was unhealthy and the PREVIOUS release is now serving.
#   3  The release was unhealthy and the flip-back also failed: service down.
#   4  Payload installed, but this host has no service unit yet: run
#      03_install_systemd_service.sh. Only reachable on a first-ever deploy.

set -euo pipefail

STAGING="${1:-}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/portal_brasileirao}"
SERVICE_NAME="${DEPLOY_SERVICE:-portal-brasileirao}"

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

PREVIOUS="$DEPLOY_DIR/previous"
INCOMING="$DEPLOY_DIR/previous.incoming"

# Retain the release that is on disk before anything overwrites it. package.json
# and package-lock.json travel with dist/ because 06_redeploy.sh runs
# `npm ci --omit=dev`, which prunes: a release that drops a dependency would
# otherwise leave node_modules unable to satisfy the release before it, and the
# flip-back would restore a build whose modules had just been deleted.
#
# Staged into previous.incoming/ and moved into place, so an interrupted copy is
# never mistaken for a usable rollback target — 06_redeploy.sh checks the three
# files below, and a half-written previous/ passing that check is exactly how a
# recoverable bad release becomes an unrecoverable one.
#
# A first-ever deploy has nothing to retain and simply gets no rollback target.
if [[ -f "$DEPLOY_DIR/dist/server.cjs" ]]; then
    echo "==> Retaining the current release in ${PREVIOUS}"
    # Failing here stops the deploy rather than proceeding without a way back.
    # The usual cause is a full disk, which is also what makes `npm ci` and the
    # restart fail moments later — better to refuse while the running release is
    # still intact than to destroy it and discover the same problem.
    rm -rf "$INCOMING"
    mkdir -p "$INCOMING"
    rsync -a --delete "$DEPLOY_DIR/dist/" "$INCOMING/dist/"
    for carried in package.json package-lock.json; do
        if [[ -f "$DEPLOY_DIR/$carried" ]]; then
            cp "$DEPLOY_DIR/$carried" "$INCOMING/$carried"
        fi
    done
    rm -rf "$PREVIOUS"
    mv "$INCOMING" "$PREVIOUS"
else
    echo "==> No release on disk to retain; this deploy has no flip-back target."
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

# A first-ever deploy legitimately has no service unit:
# 03_install_systemd_service.sh refuses to run before dist/server.cjs exists, so
# the payload has to land first — which the install above has just done. Say what
# to do next rather than handing off to 06_redeploy.sh and failing on a restart
# that could never have worked.
#
# Not exit 0. Nothing is serving, and a caller reading 0 as "released" would be
# reporting a deploy that did not happen; CI's live-sha assertion would catch it
# one step later, which is a worse place to find out.
if ! systemctl list-unit-files --type=service --no-legend "${SERVICE_NAME}.service" 2>/dev/null \
        | grep -q "${SERVICE_NAME}.service"; then
    echo ""
    echo "Payload installed, but the ${SERVICE_NAME} service does not exist on this host."
    echo "Finish the first-time setup here:"
    echo "    ${DEPLOY_DIR}/shell_scripts/03_install_systemd_service.sh"
    exit 4
fi

echo "==> Handing off to 06_redeploy.sh"
# Only offer a flip-back target if the retention above actually produced one.
if [[ -f "$PREVIOUS/dist/server.cjs" ]]; then
    export ROLLBACK_FROM="$PREVIOUS"
fi
exec bash "$DEPLOY_DIR/shell_scripts/06_redeploy.sh"
