#!/bin/bash
#
# 15_install_blocklist.sh
# -----------------------
# Purpose:      Render shell_scripts/blocklist.txt into nginx's conf.d and
#               reload. One-time provisioning that is also the way to CHANGE
#               the list — re-run it after every edit. Like 11, 13 and 14, a
#               deploy does not run it.
#
# Usage:        ./shell_scripts/15_install_blocklist.sh
#               ./shell_scripts/15_install_blocklist.sh --dry-run
#
# Prerequisites: nginx installed, and a deploy landed so blocklist.txt is on the
#                host — it travels inside the release tarball and arrives no
#                other way.
#
# Environment variables:
#   BLOCKLIST_SRC   The list to render. Default: blocklist.txt beside this file.
#   BLOCKLIST_CONF  Where to write. Default: /etc/nginx/conf.d/blocklist.conf
#   NGINX           nginx binary. Default: nginx
#   SYSTEMCTL       systemctl binary. Default: systemctl
#   ALLOW_SELF_BLOCK  Set to "true" to permit blocking $SSH_CLIENT. See below.
#
# Exit codes:
#   0  Installed (or --dry-run printed what it would install).
#   1  Prerequisites missing, or the list contains something unusable.
#   2  nginx REFUSED the rendered config; the previous one was restored and
#      nginx is still serving what it was serving before.
#
# ── Why conf.d and not the site file ─────────────────────────────────────────
#
# certbot rewrites /etc/nginx/sites-available/<site> in place, and
# 04_setup_nginx.sh overwrites it outright. A `deny` put there is lost without a
# word the next time either runs. nginx.conf includes conf.d/*.conf, so this
# survives both — and being at `http` level it is inherited by every server
# block rather than needing a copy per site.
#
# ── Why the list is in the repository and not on the host ────────────────────
#
# Before this, the blocklist was a file somebody had written on the host by
# hand. Nothing reproduced it, nothing reviewed it, and a rebuilt host silently
# started with an empty one — the shape CLAUDE.md keeps warning about, where a
# claim that produces no work while it holds is never exercised. Keeping the
# list in git makes adding an address a reviewed one-line diff with a reason
# attached, and `shell_scripts/` is what CI packages into the release, so the
# list always matches the release that shipped it.
#
# The cost, stated: changing the list now needs a deploy AND a manual run. That
# is the right trade for something that can take the site off the air.
#
# ── The four refusals, and why each exists ───────────────────────────────────
#
# 1. **A malformed entry.** nginx rejects `deny not-an-ip;` at config test, so
#    without this the failure arrives as a rolled-back reload rather than as a
#    sentence naming the bad line.
#
# 2. **A /0 catch-all.** `deny 0.0.0.0/0;` is valid nginx and takes the entire
#    site off the air. It is never what anybody means, and the config test
#    cannot object to it.
#
# 3. **The address you are connected FROM.** Learned the hard way on
#    2026-09-06: proving a deny works by temporarily blocking one's own address
#    locked this workstation out of the site, and the cleanup command then
#    killed its own ssh session before it could undo it. `$SSH_CLIENT` is what
#    the host already knows about you and costs nothing to check. Override with
#    ALLOW_SELF_BLOCK=true if you really are blocking a network you also happen
#    to be sitting on.
#
# 4. **An nginx config test failure**, which restores the previous file and
#    re-tests before giving up. A blocklist must never be able to take the site
#    down: the whole point of the file is refusing traffic, and refusing all of
#    it is the failure mode closest to hand.
#
# An EMPTY list is valid and writes a file with no denies. That is how you
# unblock everybody, and it has to keep working.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLOCKLIST_SRC="${BLOCKLIST_SRC:-$HERE/blocklist.txt}"
BLOCKLIST_CONF="${BLOCKLIST_CONF:-/etc/nginx/conf.d/blocklist.conf}"
NGINX="${NGINX:-nginx}"
SYSTEMCTL="${SYSTEMCTL:-systemctl}"
ALLOW_SELF_BLOCK="${ALLOW_SELF_BLOCK:-false}"

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

if [[ ! -f "$BLOCKLIST_SRC" ]]; then
    echo "Error: no blocklist at $BLOCKLIST_SRC" >&2
    exit 1
fi

# `sudo` only where it is actually needed, so a --dry-run and the whole
# validation pass work unprivileged.
SUDO=""
if [[ "$(id -u)" -ne 0 ]]; then
    SUDO="sudo"
fi

# ── Read and validate ────────────────────────────────────────────────────────

SELF_IP=""
if [[ -n "${SSH_CLIENT:-}" ]]; then
    SELF_IP="$(echo "$SSH_CLIENT" | awk '{print $1}')"
fi

entries=()
bad=0
lineno=0
while IFS= read -r raw || [[ -n "$raw" ]]; do
    lineno=$((lineno + 1))
    # Strip comments and surrounding whitespace.
    line="${raw%%#*}"
    line="$(echo "$line" | tr -d '[:space:]')"
    [[ -z "$line" ]] && continue

    # An address or a CIDR. Deliberately a shape check and not a range check:
    # nginx is the authority on what it accepts, and this exists to catch the
    # typo that would otherwise surface as a rolled-back reload.
    if [[ ! "$line" =~ ^[0-9a-fA-F.:]+(/[0-9]{1,3})?$ ]]; then
        echo "Error: $BLOCKLIST_SRC line $lineno is not an address or CIDR: $line" >&2
        bad=1
        continue
    fi

    # A /0 is every address there is. Valid nginx, and the end of the website.
    if [[ "$line" == */0 ]]; then
        echo "Error: $BLOCKLIST_SRC line $lineno blocks EVERYTHING: $line" >&2
        bad=1
        continue
    fi

    if [[ -n "$SELF_IP" && "$line" == "$SELF_IP" && "$ALLOW_SELF_BLOCK" != "true" ]]; then
        echo "Error: $BLOCKLIST_SRC line $lineno is the address you are connected from ($SELF_IP)." >&2
        echo "       Installing it would lock you out of the site. Set ALLOW_SELF_BLOCK=true if deliberate." >&2
        bad=1
        continue
    fi

    entries+=("$line")
done < "$BLOCKLIST_SRC"

if [[ "$bad" -ne 0 ]]; then
    echo "Refusing to install a blocklist with unusable entries." >&2
    exit 1
fi

# ── Render ───────────────────────────────────────────────────────────────────

RENDERED="$(mktemp)"
trap 'rm -f "$RENDERED"' EXIT

{
    echo "# GENERATED by shell_scripts/15_install_blocklist.sh — do not edit here."
    echo "# Source of truth: shell_scripts/blocklist.txt in the repository."
    echo "# Written $(date -u '+%Y-%m-%dT%H:%M:%SZ') from ${#entries[@]} entr$([[ ${#entries[@]} -eq 1 ]] && echo y || echo ies)."
    echo "#"
    echo "# At http level, so every server block inherits it. Note a graceful"
    echo "# reload keeps old workers alive, so the first request or two after"
    echo "# this lands may still be served under the previous config."
    for e in "${entries[@]}"; do
        echo "deny $e;"
    done
} > "$RENDERED"

if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "--dry-run; would write $BLOCKLIST_CONF:"
    echo
    cat "$RENDERED"
    exit 0
fi

# ── Install, with the previous file kept until nginx has accepted the new ────

BACKUP=""
if [[ -f "$BLOCKLIST_CONF" ]]; then
    BACKUP="$(mktemp)"
    $SUDO cat "$BLOCKLIST_CONF" > "$BACKUP"
fi

$SUDO install -m 0644 "$RENDERED" "$BLOCKLIST_CONF"

if ! $SUDO "$NGINX" -t >/dev/null 2>&1; then
    echo "nginx REFUSED the rendered blocklist. Restoring the previous config." >&2
    if [[ -n "$BACKUP" ]]; then
        $SUDO install -m 0644 "$BACKUP" "$BLOCKLIST_CONF"
        rm -f "$BACKUP"
    else
        $SUDO rm -f "$BLOCKLIST_CONF"
    fi
    if $SUDO "$NGINX" -t >/dev/null 2>&1; then
        echo "Previous config restored and valid; nginx is unchanged." >&2
        exit 2
    fi
    echo "CRITICAL: nginx does not accept the restored config either. Look at it now." >&2
    exit 2
fi

[[ -n "$BACKUP" ]] && rm -f "$BACKUP"

$SUDO "$SYSTEMCTL" reload nginx

echo "Blocklist installed: ${#entries[@]} address$([[ ${#entries[@]} -eq 1 ]] && echo "" || echo es) at $BLOCKLIST_CONF"
for e in "${entries[@]}"; do
    echo "  deny $e"
done
