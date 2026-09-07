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
# `npx` and `npm` (the syncs themselves) and two `git rev-parse` queries are
# stubbed.
#
# **WHY `git` IS STUBBED, AND WHY THIS FILE WAS RED ON `main` FOR HALF AN HOUR.**
# `sync-schedule.sh` refuses to run outside a linked worktree, because a sync
# rewrites every generated file the chain owns and several sessions share the
# root checkout. The
# test for that is `git rev-parse --git-dir` against `--git-common-dir`, which
# differ **only** inside a worktree — so the guard's answer is a property of
# WHERE THE REHEARSAL HAPPENS TO BE RUN FROM.
#
# On a workstation this file is executed from a worktree, so the guard passed and
# all 19 assertions did too. `actions/checkout` produces an ordinary clone, so in
# CI the guard fired on **every** case: 8 ok / 11 not ok, each failing case
# exiting 2 with no sync invoked at all. Case 8 — *the shared root checkout is
# refused* — passed there for the wrong reason, which is why the shape of the
# failure looked like one guard rather than eleven faults.
#
# Nobody was careless and no review could have caught it: a `pull_request` run
# takes `ci.yml` from the merge with base, so this step did not exist in its own
# PR's run. It first executed on the push to `main` after #330 merged, and by
# then `deploy` and `tag` were skipping.
#
# So the environment is now **constructed rather than inherited**: the stub
# reports a worktree for the cases that need to get past the guard, and case 8
# still runs the REAL git in a REAL root checkout so the mechanism itself keeps
# an assertion on it. Reproduce the CI shape before trusting a green run here:
#
#   git clone . /tmp/ciclone && ln -s "$PWD/node_modules" /tmp/ciclone/node_modules
#   cd /tmp/ciclone && ./scripts/rehearse-sync-schedule.sh
#
# That reproduced 8 ok / 11 not ok, byte-identical to CI, and is what this fix
# was verified against.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 2
SCRIPT=./scripts/sync-schedule.sh

# Resolved before PATH is shadowed below, or the stub would exec itself.
REAL_GIT="$(command -v git)"
export REAL_GIT REH_ROOT="$ROOT"

pass=0; fail=0
BIN="$(mktemp -d)"; LOG="$BIN/calls.log"
trap 'rm -rf "$BIN"' EXIT

# --- a constructed checkout -------------------------------------------------
# **The second inherited dependency, and the same class of bug as the first.**
# `--run` refuses without a `.env` carrying FOOTBALL_DATA_TOKEN. A workstation has
# one, so cases 4-6 passed there; CI has none, so they exited 2 with the sync
# order — the whole safety property this file exists for — never exercised at all.
#
# Fixing that by writing a `.env` into the real checkout is not an option: it
# would either clobber a developer's real one or depend on its contents, and a
# rehearsal that edits the tree it is testing has failed case 10 in spirit. So the
# script is pointed at a directory of SYMLINKS to the real top level, plus a
# `.env` of our own — the seed and the counters stay genuinely real, while the
# token and the worktree shape are ours to set. `.git` is excluded deliberately:
# the guard's signal comes from the stub, not from a second repository.
FAKE="$BIN/checkout"
mkdir -p "$FAKE"
for entry in "$ROOT"/* "$ROOT"/.[!.]*; do
  [ -e "$entry" ] || continue
  case "${entry##*/}" in .env | .git) continue ;; esac
  ln -s "$entry" "$FAKE/${entry##*/}"
done
printf 'FOOTBALL_DATA_TOKEN=rehearsal-not-a-real-token\n' > "$FAKE/.env"
export REH_FAKE="$FAKE"

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
# `git` answers ONLY the two rev-parse queries the root-checkout guard reads, and
# only while FAKE_WORKTREE is set. Everything else — `--show-toplevel`, the
# `git status` in case 10 — is the real binary, so this cannot mask a git
# behaviour the script depends on.
#
# FAKE_WORKTREE=1 reports a linked worktree, 0 reports the root checkout, and
# UNSET delegates so the real environment decides. Case 8 uses unset.
cat > "$BIN/git" <<'STUB'
#!/usr/bin/env bash
if [ -n "${FAKE_WORKTREE:-}" ] && [ "${1:-}" = "rev-parse" ]; then
  case "${2:-}" in
    --git-dir)
      if [ "$FAKE_WORKTREE" = 1 ]; then
        printf '%s\n' "$REH_ROOT/.git/worktrees/rehearsal"
      else
        printf '%s\n' "$REH_ROOT/.git"
      fi
      exit 0
      ;;
    --git-common-dir)
      printf '%s\n' "$REH_ROOT/.git"
      exit 0
      ;;
    --show-toplevel)
      printf '%s\n' "$REH_FAKE"
      exit 0
      ;;
  esac
fi
exec "$REAL_GIT" "$@"
STUB
chmod +x "$BIN/curl" "$BIN/npx" "$BIN/npm" "$BIN/git"
export PATH="$BIN:$PATH" CALLS="$LOG"

# Every case below except 8 needs to get PAST the guard to test anything at all.
export FAKE_WORKTREE=1

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

echo "8. the shared root checkout is refused — by the real git, and by the signal"
# FAKE_WORKTREE unset, so the stub delegates and the REAL git decides. This is
# the one case that keeps an assertion on the guard's actual mechanism rather
# than on the value the stub feeds it, and it holds in both environments: a
# worktree's common dir is the root's `.git`, and an ordinary clone's is its own.
#
# It asserts the REASON, not just the code. Exit 2 is every "a person must look at
# this" branch — a missing token, a moved caRtola path — so a bare code check here
# passes with the guard DELETED: measured, by deleting it. The message is what
# distinguishes the refusal from its neighbours.
err=$( (cd "$(env -u FAKE_WORKTREE git rev-parse --git-common-dir)/.." &&
  env -u FAKE_WORKTREE "$ROOT/scripts/sync-schedule.sh" --check 2>&1 >/dev/null) )
code=$?
check "exit 2 in a real root checkout" "$code" "2"
check "and says so" "$(printf '%s' "$err" | grep -c 'refusing to run in the shared root checkout')" "1"
# And on the signal alone, so the refusal is pinned deterministically rather than
# depending on where this file was run from — which is the bug in the header.
FAKE_WORKTREE=0 $SCRIPT --check >/dev/null 2>&1
check "exit 2 when git-dir IS the common dir" "$?" "2"

echo "9. an unknown option is refused rather than treated as --check"
$SCRIPT --nonsense >/dev/null 2>&1
check "exit 2" "$?" "2"

echo "10. --run without a token refuses BEFORE running anything"
# Untested until now, and the reason it is worth a case is that it shares a fate
# with the sync order: both live behind the same `--run` branch, so whatever hides
# one hides the other. Asserting no call was made is the half that matters — a
# refusal after the seed sync would leave the chain half-run.
: > "$LOG"
mv "$FAKE/.env" "$FAKE/.env.off"
CARTOLA_HAS=$((HAVE + 1)) $SCRIPT --run >/dev/null 2>&1
check "exit 2" "$?" "2"
check "nothing invoked" "$(wc -l < "$LOG" | tr -d ' ')" "0"
mv "$FAKE/.env.off" "$FAKE/.env"

echo "11. nothing was written to the checkout by any of the above"
check "git status clean" "$(git status --porcelain -- src/data | wc -l | tr -d ' ')" "0"

printf '\n%s ok / %s not ok\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
