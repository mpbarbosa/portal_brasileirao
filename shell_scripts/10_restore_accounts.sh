#!/bin/bash
#
# 10_restore_accounts.sh
# ----------------------
# Purpose:      Put a backed-up accounts database back, having first proved it
#               is readable and without destroying the one already there.
#
# Usage:        ./shell_scripts/10_restore_accounts.sh            # list what S3 holds
#               ./shell_scripts/10_restore_accounts.sh <key|path> # restore that one
#               ./shell_scripts/10_restore_accounts.sh latest     # newest in the bucket
#
#               Called with no argument it **lists and changes nothing**, which
#               is the same shape rollback.yml uses: the first thing you want
#               during an incident is to know what you have, and a tool whose
#               listing mode is also its acting mode is one nobody runs while
#               worried.
#
# Environment variables:
#   DEPLOY_DIR       Default: /var/www/portal_brasileirao
#   ACCOUNTS_DB      Default: $DEPLOY_DIR/data/accounts.db
#   DEPLOY_SERVICE   Default: portal-brasileirao
#   BACKUP_BUCKET    Required unless a local path is given.
#   BACKUP_PREFIX    Default: accounts
#   AWS_REGION       Default: sa-east-1
#
# Exit codes:
#   0  Restored, or listed.
#   1  Nothing was changed — bad argument, download failed, or the artefact did
#      not verify. The database that was already there is untouched.
#   2  The restore failed partway and the PREVIOUS database has been put back.
#   3  The restore failed and the put-back ALSO failed. A person is needed, and
#      the displaced database is named in the output.
#
# The exit codes mirror 06_redeploy.sh deliberately: same shapes, same meanings,
# so an operator who has read one already knows this one. 2 means "you are where
# you started", 3 means "you are not".
#
# **The displaced database is never deleted.** It is moved aside with a
# timestamp and left there. Restoring the wrong artefact is a mistake somebody
# makes at four in the morning, and the only thing worse than needing a restore
# is a restore that consumed the thing you actually wanted.

set -uo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/var/www/portal_brasileirao}"
ACCOUNTS_DB="${ACCOUNTS_DB:-$DEPLOY_DIR/data/accounts.db}"
SERVICE_NAME="${DEPLOY_SERVICE:-portal-brasileirao}"
BACKUP_BUCKET="${BACKUP_BUCKET:-}"
BACKUP_PREFIX="${BACKUP_PREFIX:-accounts}"
AWS_REGION="${AWS_REGION:-sa-east-1}"

WANTED="${1:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/restore-accounts-XXXXXXXX")"
trap 'rm -rf "$WORK"' EXIT INT TERM

# ------------------------------------------------------------------ list
if [[ -z "$WANTED" ]]; then
    if [[ -z "$BACKUP_BUCKET" ]]; then
        echo "Error: BACKUP_BUCKET is unset, so there is nothing to list." >&2
        echo "Pass a local path to restore from disk instead." >&2
        exit 1
    fi
    echo "Backups in s3://$BACKUP_BUCKET/$BACKUP_PREFIX/ (newest last):"
    aws s3 ls "s3://$BACKUP_BUCKET/$BACKUP_PREFIX/" --region "$AWS_REGION" | sort
    echo
    echo "Nothing has been changed. Re-run with a key, or with 'latest'."
    exit 0
fi

# ------------------------------------------------------------------ fetch
ARTEFACT="$WORK/restore.db.gz"

if [[ -f "$WANTED" ]]; then
    cp "$WANTED" "$ARTEFACT"
    SOURCE="$WANTED"
else
    if [[ -z "$BACKUP_BUCKET" ]]; then
        echo "Error: '$WANTED' is not a file and BACKUP_BUCKET is unset." >&2
        exit 1
    fi

    KEY="$WANTED"
    if [[ "$WANTED" == "latest" ]]; then
        KEY="$(aws s3 ls "s3://$BACKUP_BUCKET/$BACKUP_PREFIX/" --region "$AWS_REGION" \
            | sort | tail -1 | awk '{ print $4 }')"
        if [[ -z "$KEY" ]]; then
            echo "Error: the bucket holds no backups under $BACKUP_PREFIX/." >&2
            exit 1
        fi
        KEY="$BACKUP_PREFIX/$KEY"
        echo "latest resolves to $KEY"
    fi

    if ! aws s3 cp "s3://$BACKUP_BUCKET/$KEY" "$ARTEFACT" --region "$AWS_REGION"; then
        echo "Error: could not download s3://$BACKUP_BUCKET/$KEY." >&2
        exit 1
    fi
    SOURCE="s3://$BACKUP_BUCKET/$KEY"
fi

# ------------------------------------------------------------------ verify
#
# Before anything is stopped or moved. A restore that takes the site down and
# *then* discovers the artefact is unreadable has turned a recoverable morning
# into an outage.
gunzip -f "$ARTEFACT" || { echo "Error: $SOURCE is not gzip." >&2; exit 1; }
CANDIDATE="$WORK/restore.db"

read -r -d '' RESTORE_VERIFY_JS <<'JS' || true
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1], { readOnly: true });
// The column is named after the pragma — `integrity_check`, not `result`.
// Destructuring the wrong name yields undefined, which !== "ok", so every
// artefact fails verification and the backup exits 2 on a perfectly good file.
const [{ integrity_check: result }] = db.prepare("PRAGMA integrity_check").all();
if (result !== "ok") { console.error("integrity_check: " + result); process.exit(1); }
const [{ n }] = db.prepare("SELECT count(*) AS n FROM accounts").all();
const [{ user_version: v }] = db.prepare("PRAGMA user_version").all();
db.close();
console.log(n + " " + v);
JS

# Same folding trap as 09, and this one was merely lucky rather than correct:
# `read` below takes the first line, which is the count only because the warning
# is deferred past it. Ordering is not a guarantee to rest a restore on.
SUMMARY="$(node --disable-warning=ExperimentalWarning \
    -e "$RESTORE_VERIFY_JS" "$CANDIDATE" 2>&1)" || {
    echo "Error: $SOURCE did not verify: $SUMMARY" >&2
    echo "Nothing has been changed." >&2
    exit 1
}

read -r ACCOUNTS SCHEMA <<< "$SUMMARY"
echo "Artefact: $SOURCE — $ACCOUNTS account(s), schema v$SCHEMA"

# ------------------------------------------------------------------ install
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DISPLACED=""

sudo systemctl stop "$SERVICE_NAME" || true

if [[ -f "$ACCOUNTS_DB" ]]; then
    DISPLACED="$ACCOUNTS_DB.displaced-$STAMP"
    mv "$ACCOUNTS_DB" "$DISPLACED"
    # The WAL and shm belong to the file they were written beside; leaving them
    # next to a *different* database is how a restored copy is read with another
    # database's uncommitted tail.
    rm -f "$ACCOUNTS_DB-wal" "$ACCOUNTS_DB-shm"
fi

mkdir -p "$(dirname "$ACCOUNTS_DB")"

restore_previous() {
    [[ -z "$DISPLACED" ]] && return 0
    rm -f "$ACCOUNTS_DB" "$ACCOUNTS_DB-wal" "$ACCOUNTS_DB-shm"
    mv "$DISPLACED" "$ACCOUNTS_DB"
}

if ! cp "$CANDIDATE" "$ACCOUNTS_DB"; then
    echo "Error: could not write $ACCOUNTS_DB. Putting the previous one back." >&2
    if restore_previous && sudo systemctl start "$SERVICE_NAME"; then
        exit 2
    fi
    echo "CRITICAL: the previous database is at $DISPLACED and the service is down." >&2
    exit 3
fi

chmod 600 "$ACCOUNTS_DB"

if ! sudo systemctl start "$SERVICE_NAME"; then
    echo "Error: the service did not start with the restored database." >&2
    if restore_previous && sudo systemctl start "$SERVICE_NAME"; then
        echo "The previous database is serving again."
        exit 2
    fi
    echo "CRITICAL: the previous database is at $DISPLACED and the service is down." >&2
    exit 3
fi

echo "Restored $ACCOUNTS_DB from $SOURCE."
if [[ -n "$DISPLACED" ]]; then
    echo "The database that was there is at $DISPLACED — not deleted, and not pruned by anything."
fi
exit 0
