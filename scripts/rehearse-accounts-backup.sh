#!/bin/bash
#
# rehearse-accounts-backup.sh
# ---------------------------
# Purpose:      Drive 09_backup_accounts.sh and 10_restore_accounts.sh end to
#               end, so the round trip is exercised without an AWS account and
#               without a host.
#
#               `docs/accounts.md` §3.1 asks for a restore that has actually
#               happened rather than a documented procedure. This is that, with
#               one boundary stated plainly below.
#
# Usage:        ./scripts/rehearse-accounts-backup.sh
#
# What is REAL here, and it is the part that matters:
#   - The database. A real SQLite file, written through the app's own schema,
#     with rows in accounts, sessions and preferences. Real VACUUM INTO, real
#     PRAGMA integrity_check, real gzip. The restored file is opened afterwards
#     and its rows are counted — so "the backup restores" is a measurement here,
#     not a claim.
#   - The scripts, read from shell_scripts/ as shipped. A retyped copy is how
#     the rehearsed script and the shipped one drift.
#
# What is STUBBED, and therefore what this does NOT prove:
#   - `aws`, by a local directory standing in for the bucket. So S3 credentials,
#     the bucket policy, the instance profile's s3:PutObject on the backup
#     prefix, and the lifecycle rule are all unexercised. **The first real
#     upload is still a first.**
#   - `systemctl` and `sudo`, as in rehearse-flip-back.sh.
#
# CI runs this in `check`, on every push and pull request, alongside
# rehearse-flip-back.sh; re-run it by hand too when editing either script. It is
# hermetic — bash, node, gzip, no network, no AWS, no token — which is what lets
# it gate a release where check-hymns cannot.
#
# CI runs it on .nvmrc's Node, and that is load-bearing rather than incidental.
# node:sqlite is experimental on the pinned major and stable on newer ones, so
# the runtime differs in what it prints to stderr; the first bug this harness
# caught under CI was invisible on a developer's newer Node. Reproduce a failure
# here on the pinned major before concluding it does not reproduce:
#   docker run --rm -v "$PWD":/repo:ro -w /repo node:22-bookworm \
#     ./scripts/rehearse-accounts-backup.sh
#
# Exit codes:
#   0  Every case behaved as described.
#   1  At least one did not.

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/accounts-backup-XXXXXXXX")"
trap 'rm -rf "$WORK"' EXIT INT TERM

PASS=0
FAIL=0

ok()   { PASS=$((PASS + 1)); echo "  ok      $1"; }
bad()  { FAIL=$((FAIL + 1)); echo "  NOT OK  $1"; }
check() { if [[ "$2" == "$3" ]]; then ok "$1"; else bad "$1 (expected '$3', got '$2')"; fi; }

# ------------------------------------------------------------------ stubs
mkdir -p "$WORK/bin" "$WORK/bucket"

cat > "$WORK/bin/aws" <<'EOF'
#!/bin/bash
# A directory standing in for a bucket. Understands exactly the three forms the
# two scripts use: `s3 cp` in each direction, and `s3 ls`.
shift  # drop "s3"
BUCKET_DIR="$STUB_BUCKET"
case "$1" in
  cp)
    SRC="$2"; DST="$3"
    if [[ "$SRC" == s3://* ]]; then
      KEY="${SRC#s3://*/}"
      [[ -f "$BUCKET_DIR/$KEY" ]] || { echo "NoSuchKey: $KEY" >&2; exit 1; }
      cp "$BUCKET_DIR/$KEY" "$DST"
    else
      KEY="${DST#s3://*/}"
      [[ -n "${STUB_UPLOAD_FAILS:-}" ]] && { echo "AccessDenied" >&2; exit 1; }
      mkdir -p "$BUCKET_DIR/$(dirname "$KEY")"
      cp "$SRC" "$BUCKET_DIR/$KEY"
    fi
    ;;
  ls)
    PREFIX="${2#s3://*/}"
    for f in "$BUCKET_DIR/$PREFIX"*; do
      [[ -e "$f" ]] || continue
      echo "2026-08-27 12:00:00 $(stat -c%s "$f") $(basename "$f")"
    done
    ;;
esac
EOF

cat > "$WORK/bin/systemctl" <<'EOF'
#!/bin/bash
echo "systemctl $*" >> "$STUB_LOG"
[[ -n "${STUB_START_FAILS:-}" && "${1:-}" == start ]] && exit 1
exit 0
EOF

cat > "$WORK/bin/sudo" <<'EOF'
#!/bin/bash
exec "$@"
EOF

chmod +x "$WORK/bin"/*
export PATH="$WORK/bin:$PATH"
export STUB_BUCKET="$WORK/bucket"
export STUB_LOG="$WORK/stub.log"
: > "$STUB_LOG"

# ------------------------------------------------------------------ fixtures
#
# A database built through the real schema. The rows matter: the whole question
# a backup answers is whether *these* survive, so they are counted at both ends
# rather than the file merely being compared for size.
read -r -d '' SEED_JS <<'JS' || true
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1]);
db.exec("PRAGMA journal_mode = WAL");
db.exec(`
  CREATE TABLE accounts (id TEXT PRIMARY KEY, provider TEXT NOT NULL,
    subject TEXT NOT NULL, display_name TEXT NOT NULL,
    created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL,
    UNIQUE(provider, subject));
  CREATE TABLE sessions (token_hash TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
  CREATE TABLE preferences (account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    key TEXT NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL,
    PRIMARY KEY (account_id, key));
  PRAGMA user_version = 2;
`);
const count = Number(process.argv[2]);
for (let i = 0; i < count; i += 1) {
  db.prepare("INSERT INTO accounts VALUES (?,?,?,?,?,?)")
    .run(`acc_${i}`, "google", `sub_${i}`, `Torcedor ${i}`, 1, 1);
  db.prepare("INSERT INTO preferences VALUES (?,?,?,?)")
    .run(`acc_${i}`, "preferences", JSON.stringify({ club: "1769" }), 1);
}
db.close();
JS

seed_database() { node -e "$SEED_JS" "$1" "$2"; }

read -r -d '' COUNT_JS <<'JS' || true
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1], { readOnly: true });
const [{ n }] = db.prepare("SELECT count(*) AS n FROM accounts").all();
const [{ p }] = db.prepare("SELECT count(*) AS p FROM preferences").all();
db.close();
console.log(n + "/" + p);
JS

accounts_in() { node -e "$COUNT_JS" "$1" 2>/dev/null || echo "unreadable"; }

# `ls` parsing is what shellcheck objects to and what breaks on odd names.
count_glob() {
    shopt -s nullglob
    local matches=("$@")
    echo "${#matches[@]}"
}

# Newest by the ISO timestamp in the name, not by mtime — same reason
# rehearse-flip-back.sh gives for not trusting mtime.
newest_in() {
    shopt -s nullglob
    local files=("$1"/*)
    [[ ${#files[@]} -eq 0 ]] && return 0
    printf '%s\n' "${files[@]##*/}" | sort -r | head -1
}

new_deploy_dir() {
    local dir="$WORK/deploy-$1"
    mkdir -p "$dir/data"
    echo "$dir"
}

export DEPLOY_SERVICE="portal-brasileirao-rehearsal"
export BACKUP_BUCKET="rehearsal-bucket"
export AWS_REGION="sa-east-1"

# Each case gets its own prefix inside the stub bucket.
#
# They shared one at first, and case 8's `latest` resolved to case 3's artefact
# — restoring 4 accounts where 9 were expected, with the restore itself exiting
# 0 because it did exactly what it was asked. The names carry a one-second
# timestamp and several cases back up inside the same second, so "newest" is not
# well defined across them.
#
# Same shape as the end-to-end suite sharing one database across two projects:
# a fixture that looks unique per case is not unique per *run*.
case_prefix() { export BACKUP_PREFIX="case-$1"; }

echo "Rehearsing the accounts backup round trip."
echo

# ------------------------------------------------------------------ 1
echo "1. A database with rows is snapshotted, verified and uploaded."
DIR="$(new_deploy_dir one)"
case_prefix 1
seed_database "$DIR/data/accounts.db" 7
DEPLOY_DIR="$DIR" "$REPO/shell_scripts/09_backup_accounts.sh" > "$WORK/1.log" 2>&1
check "exits 0" "$?" "0"
UPLOADED="$(count_glob "$WORK/bucket/$BACKUP_PREFIX"/*)"
check "one object reached the bucket" "$UPLOADED" "1"
if grep -q "7 account(s)" "$WORK/1.log"; then ok "counted the rows it copied"; else bad "did not count rows"; fi

# ------------------------------------------------------------------ 2
echo
echo "2. The uploaded artefact really is a readable database with the same rows."
KEY="$(newest_in "$WORK/bucket/$BACKUP_PREFIX")"
gunzip -c "$WORK/bucket/$BACKUP_PREFIX/$KEY" > "$WORK/roundtrip.db"
check "rows survive the round trip" "$(accounts_in "$WORK/roundtrip.db")" "7/7"

# ------------------------------------------------------------------ 3
echo
echo "3. WAL commits that never reached the main file are in the backup."
#    This is the case a plain `cp` gets wrong while still producing a file that
#    opens — the reason the script uses VACUUM INTO.
DIR="$(new_deploy_dir wal)"
case_prefix 3
seed_database "$DIR/data/accounts.db" 3
read -r -d '' LATE_ROW_JS <<'JS' || true
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1]);
db.exec("PRAGMA journal_mode = WAL");
db.prepare("INSERT INTO accounts VALUES (?,?,?,?,?,?)")
  .run("acc_late", "google", "sub_late", "Chegou depois", 1, 1);
// Left open deliberately: no checkpoint, so this row lives in the -wal file.
JS
node -e "$LATE_ROW_JS" "$DIR/data/accounts.db"
DEPLOY_DIR="$DIR" "$REPO/shell_scripts/09_backup_accounts.sh" > "$WORK/3.log" 2>&1
LATEST="$(newest_in "$WORK/bucket/$BACKUP_PREFIX")"
gunzip -c "$WORK/bucket/$BACKUP_PREFIX/$LATEST" > "$WORK/wal.db"
check "the late row is in the snapshot" "$(accounts_in "$WORK/wal.db")" "4/3"

# ------------------------------------------------------------------ 4
echo
echo "4. No database is not a failure."
DIR="$(new_deploy_dir empty)"
case_prefix 4
DEPLOY_DIR="$DIR" "$REPO/shell_scripts/09_backup_accounts.sh" > "$WORK/4.log" 2>&1
check "exits 0 on a host with accounts off" "$?" "0"
if grep -q "nothing to back up" "$WORK/4.log"; then ok "says so plainly"; else bad "did not explain"; fi

# ------------------------------------------------------------------ 5
echo
echo "5. An unreadable database exits 2, not 1 — an incident, not a retry."
DIR="$(new_deploy_dir corrupt)"
case_prefix 5
head -c 4096 /dev/urandom > "$DIR/data/accounts.db"
DEPLOY_DIR="$DIR" "$REPO/shell_scripts/09_backup_accounts.sh" > "$WORK/5.log" 2>&1
check "exits 2" "$?" "2"

# ------------------------------------------------------------------ 6
echo
echo "6. A failed upload exits 1 and leaves the artefact on disk."
DIR="$(new_deploy_dir upload)"
case_prefix 6
seed_database "$DIR/data/accounts.db" 2
STUB_UPLOAD_FAILS=1 DEPLOY_DIR="$DIR" "$REPO/shell_scripts/09_backup_accounts.sh" > "$WORK/6.log" 2>&1
check "exits 1" "$?" "1"
KEPT="$(count_glob "$DIR/backups"/*.gz)"
check "the snapshot is still there to retry with" "$KEPT" "1"

# ------------------------------------------------------------------ 7
echo
echo "7. Listing changes nothing."
DIR="$(new_deploy_dir list)"
case_prefix 7
seed_database "$DIR/data/accounts.db" 5
BEFORE="$(accounts_in "$DIR/data/accounts.db")"
DEPLOY_DIR="$DIR" "$REPO/shell_scripts/10_restore_accounts.sh" > "$WORK/7.log" 2>&1
check "exits 0" "$?" "0"
check "the live database is untouched" "$(accounts_in "$DIR/data/accounts.db")" "$BEFORE"
if grep -q "Nothing has been changed" "$WORK/7.log"; then ok "says so"; else bad "did not say so"; fi

# ------------------------------------------------------------------ 8
echo
echo "8. THE ONE THAT MATTERS: a real restore, over a database that has lost rows."
DIR="$(new_deploy_dir restore)"
case_prefix 8
seed_database "$DIR/data/accounts.db" 9
DEPLOY_DIR="$DIR" "$REPO/shell_scripts/09_backup_accounts.sh" > /dev/null 2>&1

# Now lose almost everything, the way a bad migration or a stray DELETE would.
read -r -d '' TRIM_JS <<'JS' || true
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1]);
db.prepare("DELETE FROM accounts WHERE id != ?").run("acc_0");
db.close();
JS
node -e "$TRIM_JS" "$DIR/data/accounts.db"
check "the live database has lost its rows" "$(accounts_in "$DIR/data/accounts.db")" "1/1"

DEPLOY_DIR="$DIR" "$REPO/shell_scripts/10_restore_accounts.sh" latest > "$WORK/8.log" 2>&1
check "restore exits 0" "$?" "0"
check "every account is back" "$(accounts_in "$DIR/data/accounts.db")" "9/9"
DISPLACED="$(count_glob "$DIR/data"/*.displaced-*)"
check "the database it replaced was kept, not deleted" "$DISPLACED" "1"
if grep -q "systemctl stop" "$STUB_LOG"; then ok "stopped the service before swapping"; else bad "swapped a live database"; fi

# ------------------------------------------------------------------ 9
echo
echo "9. A corrupt artefact is refused BEFORE anything is stopped or moved."
DIR="$(new_deploy_dir refuse)"
case_prefix 9
seed_database "$DIR/data/accounts.db" 4
mkdir -p "$WORK/bucket/$BACKUP_PREFIX"
head -c 2048 /dev/urandom | gzip > "$WORK/bucket/$BACKUP_PREFIX/accounts-99999999T999999Z.db.gz"
: > "$STUB_LOG"
DEPLOY_DIR="$DIR" "$REPO/shell_scripts/10_restore_accounts.sh" \
    "$BACKUP_PREFIX/accounts-99999999T999999Z.db.gz" > "$WORK/9.log" 2>&1
check "exits 1" "$?" "1"
check "the live database is untouched" "$(accounts_in "$DIR/data/accounts.db")" "4/4"
if grep -q "systemctl stop" "$STUB_LOG"; then bad "took the service down before checking"; else ok "never touched the service"; fi
rm -f "$WORK/bucket/$BACKUP_PREFIX/accounts-99999999T999999Z.db.gz"

# ------------------------------------------------------------------ 10
echo
echo "10. A service that will not start puts the previous database back (exit 2)."
DIR="$(new_deploy_dir flipback)"
case_prefix 10
seed_database "$DIR/data/accounts.db" 6
DEPLOY_DIR="$DIR" "$REPO/shell_scripts/09_backup_accounts.sh" > /dev/null 2>&1
read -r -d '' EMPTY_JS <<'JS' || true
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1]);
db.exec("DELETE FROM accounts");
db.close();
JS
node -e "$EMPTY_JS" "$DIR/data/accounts.db"

STUB_START_FAILS=1 DEPLOY_DIR="$DIR" "$REPO/shell_scripts/10_restore_accounts.sh" latest \
    > "$WORK/10.log" 2>&1
check "exits 3 when the put-back cannot start either" "$?" "3"
if grep -q "CRITICAL" "$WORK/10.log"; then
    ok "says CRITICAL rather than reporting a rollback"
else
    bad "did not distinguish a failed put-back"
fi

# ------------------------------------------------------------------ done
echo
echo "----------------------------------------------------------------"
echo "$PASS ok, $FAIL not ok"
if [[ $FAIL -gt 0 ]]; then
    echo
    echo "Logs are under $WORK — re-run with the trap removed to keep them."
    exit 1
fi
echo
echo "The round trip is exercised. What is NOT: S3 credentials, the bucket"
echo "policy, the instance profile's s3:PutObject, and the lifecycle rule."
echo "The first real upload is still a first."
exit 0
