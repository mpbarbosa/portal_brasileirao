#!/bin/bash
#
# 09_backup_accounts.sh
# ---------------------
# Purpose:      Copy the accounts database to S3, having first proved the copy
#               is readable. Runs on the host, from a systemd timer.
#
#               This is the only backup of the only state in this app that
#               nothing can regenerate. Everything else here is derived, fetched
#               or committed — lose the volume and a redeploy reconstructs the
#               site exactly. Lose this and the readers are gone.
#
# Usage:        ./shell_scripts/09_backup_accounts.sh
#
# Environment variables:
#   DEPLOY_DIR       Default: /var/www/portal_brasileirao
#   ACCOUNTS_DB      Default: $DEPLOY_DIR/data/accounts.db
#   BACKUP_BUCKET    Required to upload. Unset means rehearse locally and keep
#                    the artefact — see the note on exit 0 below.
#   BACKUP_PREFIX    Default: accounts
#   BACKUP_KEEP      Local artefacts to retain under $DEPLOY_DIR/backups.
#                    Default: 3
#   AWS_REGION       Default: sa-east-1
#
# Exit codes:
#   0  Backed up, or there was nothing to back up.
#   1  There was something to back up and it did not reach S3.
#   2  The database exists and could not be read — the alarming one. See below.
#
# Three decisions worth reading before editing:
#
#   * `VACUUM INTO` rather than `cp`. SQLite in WAL mode keeps recent commits in
#     a sidecar file, so copying accounts.db alone captures a database missing
#     its most recent writes — and it looks fine, because the result opens. The
#     app has one process and the database has one writer, so a hot copy is
#     otherwise tempting and otherwise wrong.
#
#   * The copy is opened and checked before it is uploaded. A backup nobody has
#     read is a belief, not a backup, and integrity_check on a few thousand rows
#     costs milliseconds. This is why an unreadable database exits **2** rather
#     than 1: "the upload failed" is a retry, "the database will not open" is an
#     incident, and a timer that reports both the same way trains whoever reads
#     the log to ignore it.
#
#   * **No database is not a failure.** Accounts are absent unless the host is
#     configured for them, so on a host that has never enabled them there is
#     nothing to copy and nothing wrong. Exiting non-zero there would mean a
#     timer that fails every night on most installations, which is how a real
#     failure comes to be filtered out of a mailbox.

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/var/www/portal_brasileirao}"
ACCOUNTS_DB="${ACCOUNTS_DB:-$DEPLOY_DIR/data/accounts.db}"
BACKUP_BUCKET="${BACKUP_BUCKET:-}"
BACKUP_PREFIX="${BACKUP_PREFIX:-accounts}"
BACKUP_KEEP="${BACKUP_KEEP:-3}"
AWS_REGION="${AWS_REGION:-sa-east-1}"

STAGING="$DEPLOY_DIR/backups"

if [[ ! -f "$ACCOUNTS_DB" ]]; then
    echo "No accounts database at $ACCOUNTS_DB — nothing to back up."
    exit 0
fi

mkdir -p "$STAGING"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SNAPSHOT="$STAGING/accounts-$STAMP.db"

# ------------------------------------------------------------------ snapshot
#
# node rather than the sqlite3 CLI: the host is not provisioned with sqlite3 and
# adding a package to take a backup is a dependency for the one path that has to
# work when things are already wrong. Node is there because the app is.
#
# The programs below are **quoted heredocs**, not `node -e '...'`. A JS body
# passed as a single-quoted shell argument cannot contain a single quote — and
# SQL string literals are single-quoted, so `VACUUM INTO '<path>'` silently ends
# the shell's quoting and hands node bare words. Backticks have the same problem
# inside command substitution. A quoted heredoc expands nothing, so both are safe.
read -r -d '' SNAPSHOT_JS <<'JS' || true
const { DatabaseSync } = require("node:sqlite");
const [source, target] = process.argv.slice(1);
const db = new DatabaseSync(source, { readOnly: true });
// VACUUM INTO takes a consistent snapshot including anything still in the WAL,
// and writes a defragmented copy — which is also why the artefact is smaller
// than the live file. Single-quoted SQL literal, embedded quotes doubled; NOT
// JSON.stringify, whose double quotes SQLite reads as an identifier.
db.exec("VACUUM INTO '" + target.replace(/'/g, "''") + "'");
db.close();
JS

read -r -d '' VERIFY_JS <<'JS' || true
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1], { readOnly: true });
// The column is named after the pragma — `integrity_check`, not `result`.
// Destructuring the wrong name yields undefined, which !== "ok", so every
// artefact fails verification and the backup exits 2 on a perfectly good file.
const [{ integrity_check: result }] = db.prepare("PRAGMA integrity_check").all();
if (result !== "ok") { console.error("integrity_check: " + result); process.exit(1); }
const [{ n }] = db.prepare("SELECT count(*) AS n FROM accounts").all();
db.close();
console.log(n);
JS

if ! node -e "$SNAPSHOT_JS" "$ACCOUNTS_DB" "$SNAPSHOT" 2>&1; then
    echo "Error: could not snapshot $ACCOUNTS_DB." >&2
    exit 2
fi

# ------------------------------------------------------------------ verify
#
# Read the copy, not the original. The question is whether *this artefact*
# restores, and the only way to answer it is to open it.
VERIFY="$(node -e "$VERIFY_JS" "$SNAPSHOT" 2>&1)" || {
    echo "Error: the snapshot did not verify: $VERIFY" >&2
    rm -f "$SNAPSHOT"
    exit 2
}

gzip -9 "$SNAPSHOT"
SNAPSHOT="$SNAPSHOT.gz"
echo "Snapshot: $SNAPSHOT ($VERIFY account(s), $(du -h "$SNAPSHOT" | cut -f1))"

# ------------------------------------------------------------------ upload
if [[ -z "$BACKUP_BUCKET" ]]; then
    # Deliberately exit 0. An unconfigured bucket is a host that has not been
    # given one yet, which is the same class of thing as accounts being off —
    # and the artefact is on disk either way, which is better than nothing and
    # honest about being less than a backup.
    echo "BACKUP_BUCKET unset — snapshot kept locally, NOT uploaded."
    exit 0
fi

KEY="$BACKUP_PREFIX/$(basename "$SNAPSHOT")"
if ! aws s3 cp "$SNAPSHOT" "s3://$BACKUP_BUCKET/$KEY" --region "$AWS_REGION"; then
    echo "Error: upload to s3://$BACKUP_BUCKET/$KEY failed." >&2
    exit 1
fi

echo "Uploaded s3://$BACKUP_BUCKET/$KEY"

# ------------------------------------------------------------------ prune
#
# Local only. What S3 retains is a lifecycle policy's business, and expressing a
# retention period in two places is how the notice at /privacidade comes to
# describe something nobody enforces.
# Sorted by the timestamp in the name, not by mtime. rehearse-flip-back.sh
# records why that matters: two files written in the same second are
# indistinguishable by mtime, and the names here are ISO-ordered anyway.
shopt -s nullglob
ARTEFACTS=("$STAGING"/accounts-*.db.gz)
if [[ ${#ARTEFACTS[@]} -gt 0 ]]; then
    mapfile -t ARTEFACTS < <(printf '%s\n' "${ARTEFACTS[@]}" | sort -r)
    for stale in "${ARTEFACTS[@]:$BACKUP_KEEP}"; do
        rm -f "$stale"
    done
fi

exit 0
