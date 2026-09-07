#!/usr/bin/env bash
#
# Behavioural coverage for scripts/cartola-cron-check.sh.
#
# WHY IT NEEDS ANY. That script is a cron job: it runs unattended, hourly, on a
# workstation nobody is watching, and every one of its outcomes is a FILE rather
# than a message. A branch that stops working stops writing a marker, and a
# marker that is never written looks exactly like "nothing is due" — which is
# the reassuring answer. Silence is the failure mode, so the branches have to be
# driven deliberately.
#
# WHAT IS REAL AND WHAT IS STUBBED. The script under test is real, including its
# re-exec. `git`, `npm`, `node` and `sync-schedule.sh` are stubs, so there is no
# network, no clone and no caRtola probe: this exercises the poller's own
# decisions, never sync-schedule.sh's, which has its own rehearsal.
#
#   ./scripts/rehearse-cartola-cron.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUBJECT="$ROOT/scripts/cartola-cron-check.sh"
[ -x "$SUBJECT" ] || { echo "no executable subject at $SUBJECT" >&2; exit 2; }

ok=0; bad=0
pass() { printf '  ok   %s\n' "$*"; ok=$((ok + 1)); }
fail() { printf '  NOT OK %s\n' "$*"; bad=$((bad + 1)); }
check() { if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 (want [$3], got [$2])"; fi; }
has()   { if grep -qF -- "$2" "$3" 2>/dev/null; then pass "$1"; else fail "$1 (no [$2] in $3)"; fi; }
hasnt() { if grep -qF -- "$2" "$3" 2>/dev/null; then fail "$1 (unexpected [$2] in $3)"; else pass "$1"; fi; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# --- the fake installation --------------------------------------------------
# A directory shaped like ~/cartola-cron: a `wt` holding the subject and a stub
# sync-schedule.sh, with BASE beside it. `git`, `npm` and `node` come from a
# stub bin on PATH, so nothing here touches a real repository.
BASE="$TMP/base"; WT="$BASE/wt"; BIN="$TMP/bin"
mkdir -p "$WT/scripts" "$BIN" "$BASE"
cp "$SUBJECT" "$WT/scripts/cartola-cron-check.sh"
chmod +x "$WT/scripts/cartola-cron-check.sh"

cat > "$BIN/git" <<'STUB'
#!/usr/bin/env bash
# Records its argv, and answers only what the subject asks. GIT_FAIL_ON makes
# one subcommand fail, which is how the failure branches are reached.
printf '%s\n' "$*" >> "${STUB_LOG:?}/git.argv"
if [ -n "${GIT_FAIL_ON:-}" ] && [ "$1" = "$GIT_FAIL_ON" ]; then exit 1; fi
case "$1 ${2:-}" in
  "rev-parse HEAD:package-lock.json") printf '%s\n' "${LOCK_SHA:-lock-unchanged}" ;;
  "rev-parse --short")                printf '%s\n' "${HEAD_SHA:-abc1234}" ;;
  *) : ;;
esac
exit 0
STUB
cat > "$BIN/npm" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${STUB_LOG:?}/npm.argv"
exit "${NPM_EXIT:-0}"
STUB
printf '#!/usr/bin/env bash\nexit 0\n' > "$BIN/node"

# Stubbed from the very first case, and not only for the notification cases:
# without this the REAL notify-send is on PATH and the rehearsal pops desktop
# notifications at whoever runs it, CI included. It records its argv and the bus
# address it was given, which is what the DBUS case asserts.
cat > "$BIN/notify-send" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${STUB_LOG:?}/notify.argv"
printf '%s\n' "${DBUS_SESSION_BUS_ADDRESS:-<unset>}" >> "${STUB_LOG:?}/notify.bus"
exit "${NOTIFY_EXIT:-0}"
STUB
chmod +x "$BIN/git" "$BIN/npm" "$BIN/node" "$BIN/notify-send"

# The stub sync-schedule.sh: exits with whatever the case under test wants, and
# prints something recognisable so the marker's contents can be asserted.
cat > "$WT/scripts/sync-schedule.sh" <<'STUB'
#!/usr/bin/env bash
# Records the directory it was invoked from. That is the direct evidence for
# case 5: the subject cd's to the worktree before calling this, so a worktree
# resolved wrongly shows up here as /tmp or anywhere else.
pwd > "${STUB_LOG:?}/sync.pwd"
printf 'club-scouts.ts: rodada 25   caRtola: rodada %s\n' "${FAKE_CARTOLA:-25}"
exit "${SYNC_EXIT:-0}"
STUB
chmod +x "$WT/scripts/sync-schedule.sh"

STUB_LOG="$TMP/log"; mkdir -p "$STUB_LOG"
export STUB_LOG

# Computed once. Referring to $PATH inside and after a subshell that sets it
# is what makes shellcheck report SC2030/SC2031, and CI shellchecks this file.
RUN_PATH="$BIN:$PATH"

run() { # run <SYNC_EXIT> [extra env assignments...]
  local code="$1"; shift
  ( export PATH="$RUN_PATH" CARTOLA_CRON_BASE="$BASE" SYNC_EXIT="$code"
    for kv in "$@"; do export "${kv?}"; done
    "$WT/scripts/cartola-cron-check.sh" )
  printf '%s' "$?"
}

echo "1. nothing due — logs, writes no marker"
: > "$BASE/sync-check.log"
rc=$(run 0)
check "exit 0" "$rc" "0"
has  "logged the outcome"            "nothing due" "$BASE/sync-check.log"
check "no DUE marker"                "$([ -f "$BASE/DUE" ] && echo yes || echo no)" "no"
check "no ATTENTION marker"          "$([ -f "$BASE/ATTENTION" ] && echo yes || echo no)" "no"

echo "2. a sync IS due — writes DUE carrying the procedure"
rc=$(run 1)
check "exit 0 (cron must not report a due sync as a failure)" "$rc" "0"
check "DUE written"                  "$([ -f "$BASE/DUE" ] && echo yes || echo no)" "yes"
has  "DUE quotes the check's output" "caRtola: rodada" "$BASE/DUE"
has  "DUE names --run, not a sync it did itself" "sync-schedule.sh --run" "$BASE/DUE"
has  "DUE points at the ledger handoff" "COORDINATION.md" "$BASE/DUE"
# A literal string, never a path this shell should expand — the point is that
# the marker no longer names the file's old unversioned home.
hasnt "DUE does not name the old unversioned path" "cartola-cron/check.sh" "$BASE/DUE"

echo "3. DUE is self-clearing once main carries the sync"
rc=$(run 0)
check "exit 0" "$rc" "0"
check "DUE removed"                  "$([ -f "$BASE/DUE" ] && echo yes || echo no)" "no"
has  "and said so"                   "cleared DUE" "$BASE/sync-check.log"

echo "4. exit 2 — a person must look"
rc=$(run 2)
check "exit 0 from the poller"       "$rc" "0"
check "ATTENTION written"            "$([ -f "$BASE/ATTENTION" ] && echo yes || echo no)" "yes"
has  "names the exit code"           "exited 2" "$BASE/ATTENTION"
rc=$(run 0)
check "ATTENTION cleared on the next clean run" "$([ -f "$BASE/ATTENTION" ] && echo yes || echo no)" "no"

echo "5. the re-exec keeps the WORKTREE, not the pinned copy's /tmp"
# The bug this is written against: after `exec`, \$BASH_SOURCE is the mktemp
# copy, so a worktree derived there is /tmp and every git command runs in the
# wrong place — silently, because git just reports no repository.
rm -f "$STUB_LOG/sync.pwd"
rc=$(run 0)
check "still exits 0" "$rc" "0"
check "sync-schedule.sh ran from the worktree, not the pinned copy's /tmp" \
  "$(cat "$STUB_LOG/sync.pwd" 2>/dev/null)" "$WT"
has "the run reached sync-schedule.sh" "nothing due" "$BASE/sync-check.log"

echo "6. a changed package-lock triggers npm ci; an unchanged one does not"
: > "$STUB_LOG/npm.argv"; : > "$BASE/sync-check.log"
rc=$(run 0)
check "no npm ci when the lock is unchanged" "$(wc -l < "$STUB_LOG/npm.argv")" "0"
# The stub answers the same value both times it is asked, so make it differ by
# flipping LOCK_SHA between the two rev-parse calls via a counter file.
# Replaces the stub above with one whose lock sha DIFFERS between the two
# rev-parse calls. It must keep GIT_FAIL_ON: case 7 runs after this one, and a
# stub that silently dropped the hook made that case pass for the wrong reason
# — it asserts exit 2, which is also what a wholly broken run produces.
cat > "$BIN/git" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${STUB_LOG:?}/git.argv"
if [ -n "${GIT_FAIL_ON:-}" ] && [ "$1" = "$GIT_FAIL_ON" ]; then exit 1; fi
case "$1 ${2:-}" in
  "rev-parse HEAD:package-lock.json")
    n=$(cat "$STUB_LOG/lockcalls" 2>/dev/null || echo 0); echo $((n + 1)) > "$STUB_LOG/lockcalls"
    if [ "$n" = "0" ]; then echo before; else echo after; fi ;;
  "rev-parse --short") printf 'abc1234\n' ;;
  *) : ;;
esac
exit 0
STUB
chmod +x "$BIN/git"
: > "$STUB_LOG/npm.argv"; rm -f "$STUB_LOG/lockcalls"
rc=$(run 0)
has "npm ci ran when the lock changed" "ci" "$STUB_LOG/npm.argv"
has "and said why"                     "package-lock.json changed" "$BASE/sync-check.log"

echo "7. a failing git fetch stops the run and says so"
: > "$BASE/sync-check.log"
rc=$(run 0 GIT_FAIL_ON=fetch)
check "exit 2"                       "$rc" "2"
has  "named the fetch"               "git fetch failed" "$BASE/sync-check.log"
check "no marker invented"           "$([ -f "$BASE/DUE" ] && echo yes || echo no)" "no"

echo "8. a held lock is a skip, not a failure"
: > "$BASE/sync-check.log"
( flock 9; rc=$(run 0); printf '%s' "$rc" > "$TMP/lockrc" ) 9>"$BASE/.lock"
check "exit 0"                       "$(cat "$TMP/lockrc")" "0"
has  "logged the skip"               "another run holds the lock" "$BASE/sync-check.log"

echo "9. the DUE transition notifies ONCE, not once an hour"
rm -f "$BASE/DUE" "$BASE/ATTENTION"; : > "$STUB_LOG/notify.argv"; : > "$BASE/sync-check.log"
rc=$(run 1)
check "notified on the transition"        "$(wc -l < "$STUB_LOG/notify.argv")" "1"
has  "and said so in the log"             "notified:" "$BASE/sync-check.log"
rc=$(run 1)
check "silent while it stays due"         "$(wc -l < "$STUB_LOG/notify.argv")" "1"
rc=$(run 0)   # synced: marker clears
rc=$(run 1)   # and a later rodada becomes due
check "notifies again after the marker cleared" "$(wc -l < "$STUB_LOG/notify.argv")" "2"

echo "10. the ATTENTION transition notifies once too"
rm -f "$BASE/DUE" "$BASE/ATTENTION"; : > "$STUB_LOG/notify.argv"
rc=$(run 2)
check "notified"                          "$(wc -l < "$STUB_LOG/notify.argv")" "1"
rc=$(run 2)
check "silent while it stays broken"      "$(wc -l < "$STUB_LOG/notify.argv")" "1"

echo "11. cron has no session bus, so one is derived from the running uid"
rm -f "$BASE/DUE"; : > "$STUB_LOG/notify.bus"
# DBUS_SESSION_BUS_ADDRESS MUST BE UNSET HERE, and this case passed for the
# wrong reason until a mutation said so. An interactive shell exports it, so the
# subject's `[ -z ... ]` was false, the derivation never ran, and deleting the
# derivation outright still gave 42/42 — the case was reading the environment it
# inherited rather than the code it names. Same shape as the CI failure
# rehearse-sync-schedule.sh records: construct the environment, never inherit it.
env -u DBUS_SESSION_BUS_ADDRESS PATH="$RUN_PATH" CARTOLA_CRON_BASE="$BASE" \
  SYNC_EXIT=1 "$WT/scripts/cartola-cron-check.sh"
rc=$?
bus=$(tail -1 "$STUB_LOG/notify.bus")
# Only assert a real address was passed where a socket exists; a machine with no
# session bus (a CI runner) legitimately takes the other branch, and the case
# below is the one that covers it.
if [ -S "/run/user/$(id -u)/bus" ]; then
  check "a bus address was passed" "$bus" "unix:path=/run/user/$(id -u)/bus"
else
  hasnt "no bus: said so rather than pretending" "notified:" "$BASE/sync-check.log"
fi

echo "12. a notifier that cannot run NEVER changes the outcome of the poll"
rm -f "$BASE/DUE"; : > "$BASE/sync-check.log"
rc=$(run 1 NOTIFY_EXIT=1)
check "exit unchanged when notify-send fails" "$rc" "0"
check "the marker was still written"          "$([ -f "$BASE/DUE" ] && echo yes || echo no)" "yes"
has  "and the failure is logged, not hidden"  "notify-send failed" "$BASE/sync-check.log"

# ABSENCE IS A PROPERTY OF $PATH, NOT OF $BIN — and getting that wrong fired a
# REAL desktop notification at whoever ran the rehearsal. Moving the stub aside
# leaves /usr/bin/notify-send on PATH, so `command -v` finds it, the subject
# takes the happy branch, and the assertion below fails while a notification
# pops. So this case runs against a PATH built from symlinks to exactly the
# externals the subject uses, with no notify-send among them.
SAFE="$TMP/safebin"; mkdir -p "$SAFE"
# `bash` is on this list because the subject's shebang is `#!/usr/bin/env bash`
# — and its re-exec runs a second copy through the same shebang. Leaving it out
# makes every run exit 127 with `env: 'bash': No such file or directory`, which
# reads as the subject being broken rather than the fixture being short.
for c in bash sh date mktemp cp chmod rm id sed wc cat flock dirname grep sort tail env pwd; do
  t=$(command -v "$c" 2>/dev/null) && ln -sf "$t" "$SAFE/$c"
done
ln -sf "$BIN/git" "$SAFE/git"; ln -sf "$BIN/npm" "$SAFE/npm"; ln -sf "$BIN/node" "$SAFE/node"
if [ -e "$SAFE/notify-send" ]; then
  fail "safe PATH still has notify-send"
else
  pass "the safe PATH really lacks notify-send"
fi

rm -f "$BASE/DUE"; : > "$BASE/sync-check.log"
# `env` rather than an exporting subshell: the subshell form makes shellcheck
# report SC2030/SC2031 against run() above, and CI runs shellcheck over this.
env PATH="$SAFE" CARTOLA_CRON_BASE="$BASE" SYNC_EXIT=1 "$WT/scripts/cartola-cron-check.sh"
rc=$?
check "exit unchanged with no notify-send at all" "$rc" "0"
check "the marker was still written"              "$([ -f "$BASE/DUE" ] && echo yes || echo no)" "yes"
has  "and says nobody was told"                   "nobody told" "$BASE/sync-check.log"

printf '\n%s ok / %s not ok\n' "$ok" "$bad"
[ "$bad" -eq 0 ]
