#!/usr/bin/env bash
#
# Behavioural coverage for `sync-schedule.sh`, which has none otherwise.
#
# `npm run lint` is TypeScript and cannot see shell; CI shellchecks the file,
# which proves it parses. This drives every branch and asserts what happened —
# the same split `rehearse-flip-back.sh` draws, and for the same reason: the
# script decides whether to run three data syncs in a fixed order, and getting
# the order wrong inflates every rate in `club-scouts.ts` by about 4%.
#
# REAL where it matters, STUBBED where it costs nothing. The seed and the
# counters are read by real node against the real checkout, so the schedule
# arithmetic and the round numbers are genuine. Only `curl` (the caRtola probe),
# `npx` and `npm` (the syncs themselves) are stubbed.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 2
SCRIPT=./scripts/sync-schedule.sh

pass=0; fail=0
BIN="$(mktemp -d)"; LOG="$BIN/calls.log"
trap 'rm -rf "$BIN"' EXIT

ok()   { pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad()  { fail=$((fail+1)); printf '  NOT OK %s\n' "$1"; }
check() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (got '$2', want '$3')"; fi; }

# --- stubs ------------------------------------------------------------------
# `curl` answers the rodada probe from CARTOLA_HAS, so a test can put caRtola
# any number of rounds ahead without a network.
cat > "$BIN/curl" <<'STUB'
#!/usr/bin/env bash
url="${*: -1}"
round="${url##*rodada-}"; round="${round%%.csv*}"
if [ "${round:-x}" -le "${CARTOLA_HAS:-0}" ] 2>/dev/null; then printf '200'; else printf "${CARTOLA_CODE:-404}"; fi
STUB
# `npx` and `npm` record the call and obey FAIL_AT, so order and short-circuit
# are both observable.
cat > "$BIN/npx" <<'STUB'
#!/usr/bin/env bash
printf 'npx %s\n' "$*" >> "$CALLS"
case "${FAIL_AT:-}" in *"$2"*) exit 1 ;; esac
exit 0
STUB
cat > "$BIN/npm" <<'STUB'
#!/usr/bin/env bash
printf 'npm %s\n' "$*" >> "$CALLS"
case "${FAIL_AT:-}" in *sync-rank-history*) [ "$*" != "${*/sync-rank-history/}" ] && exit 1 ;; esac
exit 0
STUB
chmod +x "$BIN/curl" "$BIN/npx" "$BIN/npm"
export PATH="$BIN:$PATH" CALLS="$LOG"

run() { : > "$LOG"; "$@" >/dev/null 2>&1; }

HAVE=$(node --disable-warning=ExperimentalWarning --import tsx -e \
  'import { CLUB_SCOUTS_THROUGH_ROUND as r } from "@/src/data/club-scouts"; console.log(r);')
printf 'club-scouts.ts is at rodada %s\n\n' "$HAVE"

echo "1. --list needs no network and lists only unsynced rounds"
CARTOLA_HAS=0 run env PATH="$BIN:$PATH" $SCRIPT --list
out=$($SCRIPT --list 2>/dev/null)
check "exit 0" "$?" "0"
if printf '%s' "$out" | grep -qE "^  $((HAVE + 1)) "; then ok "starts at rodada $((HAVE+1))"; else bad "does not start at $((HAVE+1))"; fi
if printf '%s' "$out" | grep -qE "^  $HAVE "; then bad "lists an already-synced rodada"; else ok "omits synced rodadas"; fi
if printf '%s' "$out" | grep -q "times not published"; then ok "flags placeholder kickoffs"; else bad "no placeholder note"; fi

echo "2. --check with caRtola level: nothing due, exit 0"
CARTOLA_HAS=$HAVE $SCRIPT --check >/dev/null 2>&1
check "exit 0" "$?" "0"

echo "3. --check with caRtola ahead: due, exit 1, and NOTHING run"
: > "$LOG"
CARTOLA_HAS=$((HAVE + 1)) $SCRIPT --check >/dev/null 2>&1
check "exit 1" "$?" "1"
check "no sync invoked" "$(wc -l < "$LOG" | tr -d ' ')" "0"

echo "4. --run with caRtola ahead: the three syncs, in order"
: > "$LOG"
CARTOLA_HAS=$((HAVE + 1)) $SCRIPT --run >/dev/null 2>&1
check "exit 0" "$?" "0"
check "call 1 is sync-seed-data"      "$(sed -n 1p "$LOG" | grep -c sync-seed-data)"      "1"
check "call 2 is sync-rank-history"   "$(sed -n 2p "$LOG" | grep -c sync-rank-history)"   "1"
check "call 3 is sync-cartola-scouts" "$(sed -n 3p "$LOG" | grep -c sync-cartola-scouts)" "1"

echo "5. a failing seed sync stops the chain — the ORDER is the safety property"
: > "$LOG"
CARTOLA_HAS=$((HAVE + 1)) FAIL_AT=scripts/sync-seed-data.ts $SCRIPT --run >/dev/null 2>&1
check "exit 2" "$?" "2"
check "only one call made" "$(wc -l < "$LOG" | tr -d ' ')" "1"

echo "6. a failing scouts sync is reported, not swallowed"
: > "$LOG"
CARTOLA_HAS=$((HAVE + 1)) FAIL_AT=scripts/sync-cartola-scouts.ts $SCRIPT --run >/dev/null 2>&1
check "exit 2" "$?" "2"
check "all three attempted" "$(wc -l < "$LOG" | tr -d ' ')" "3"

echo "7. an unexpected HTTP code from caRtola is a person's problem, not a 404"
CARTOLA_HAS=$HAVE CARTOLA_CODE=500 $SCRIPT --check >/dev/null 2>&1
check "exit 2" "$?" "2"

echo "8. the shared root checkout is refused"
(cd "$(git rev-parse --git-common-dir)/.." && "$ROOT/scripts/sync-schedule.sh" --check >/dev/null 2>&1)
check "exit 2" "$?" "2"

echo "9. an unknown option is refused rather than treated as --check"
$SCRIPT --nonsense >/dev/null 2>&1
check "exit 2" "$?" "2"

echo "10. nothing was written to the checkout by any of the above"
check "git status clean" "$(git status --porcelain -- src/data | wc -l | tr -d ' ')" "0"

printf '\n%s ok / %s not ok\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
