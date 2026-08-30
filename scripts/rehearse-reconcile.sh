#!/usr/bin/env bash
#
# Behavioural rehearsal for `reconcile.yml`'s decision step.
#
# This workflow is **scheduled**, so no pull request can ever exercise it: a
# green tick on a change to it says only that the other workflows still pass.
# That is the same reason `rehearse-broadcast-sync-pr.sh` exists, and like that
# one this extracts the step's shell from the shipped YAML rather than holding a
# retyped copy — a rehearsal that tests a stale duplicate passes confidently
# while the shipped text is broken.
#
# Hermetic: bash, python3, git, curl, jq. No network, no AWS, no GitHub token.
# `gh` is stubbed and its invocations are logged, which is what lets the
# assertions check *that a deploy was not dispatched* rather than merely that
# the step exited a particular way.
#
# The contract under test, in one sentence: an EXPECTED HOLD exits 0 and a
# condition that NEEDS A PERSON exits 1. Before this, every terminal branch
# exited 0 — so the reconciler diagnosed a stuck production correctly, wrote
# "this needs a person, not another tick", and reported success. Nothing turned
# red for eighteen hours.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW="${REPO_ROOT}/.github/workflows/reconcile.yml"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

pass=0
fail=0

note() { printf '  %s\n' "$*"; }
ok()   { printf '  \033[32mok\033[0m   %s\n' "$*"; pass=$((pass + 1)); }
bad()  { printf '  \033[31mNOT OK\033[0m %s\n' "$*"; fail=$((fail + 1)); }

# --------------------------------------------------------------------------
# Extract the shipped step, and REFUSE if it cannot be found.
#
# A rehearsal that silently tests nothing reports as a broken workflow rather
# than as a broken rehearsal, which is the worse of the two failures.
# --------------------------------------------------------------------------
STEP="${WORK}/step.sh"
python3 - "$WORKFLOW" "$STEP" <<'PY'
import sys, io, yaml
wf, out = sys.argv[1], sys.argv[2]
d = yaml.safe_load(io.open(wf, encoding="utf-8"))
steps = d["jobs"]["reconcile"]["steps"]
named = [s for s in steps if "run" in s and "production is behind" in s.get("name", "")]
if len(named) != 1:
    sys.exit("REHEARSAL CANNOT FIND ITS SUBJECT: expected exactly one run-step "
             "whose name contains 'production is behind', found %d. The step was "
             "renamed or removed; fix this script rather than deleting it."
             % len(named))
io.open(out, "w", encoding="utf-8").write("#!/usr/bin/env bash\n" + named[0]["run"])
PY
[ -s "$STEP" ] || { echo "FATAL: step extraction produced nothing."; exit 1; }
chmod +x "$STEP"
echo "Extracted $(wc -l < "$STEP") lines from ${WORKFLOW#"$REPO_ROOT"/}"

# --------------------------------------------------------------------------
# A real git history. Not stubbed — ancestry is the thing being decided.
#
#   A ── B ── C        (main)
#    \
#     D                (divergent, reachable from neither)
# --------------------------------------------------------------------------
FIX="${WORK}/repo"
git init -q "$FIX"
git -C "$FIX" config user.email r@example.com
git -C "$FIX" config user.name Rehearsal
for n in A B C; do
  echo "$n" > "${FIX}/f"
  git -C "$FIX" add f
  git -C "$FIX" commit -qm "$n"
done
A="$(git -C "$FIX" rev-parse HEAD~2)"
B="$(git -C "$FIX" rev-parse HEAD~1)"
C="$(git -C "$FIX" rev-parse HEAD)"
# A divergent commit: A's tree on A's parent chain, so it is genuinely not an
# ancestor of C. `commit-tree` builds it without moving any branch.
#
# Computed in two steps deliberately. Nesting the tree lookup inside the
# commit-tree substitution left `$D` EMPTY when the inner command misfired, and
# an empty sha does not fail this rehearsal — it silently reroutes the case to
# the "no usable commit" branch, which also exits non-zero after the fix. The
# case would then have PASSED while testing something else entirely.
A_TREE="$(git -C "$FIX" rev-parse "${A}^{tree}")"
[ -n "$A_TREE" ] || { echo "FATAL: could not resolve A's tree."; exit 1; }
D="$(git -C "$FIX" commit-tree "$A_TREE" -p "$A" -m D)"
[ -n "$D" ] || { echo "FATAL: could not build the divergent commit."; exit 1; }
git -C "$FIX" merge-base --is-ancestor "$D" "$C" \
  && { echo "FATAL: D is an ancestor of C; the divergence fixture is wrong."; exit 1; }

# --------------------------------------------------------------------------
# Stubs: a real HTTP server for /api/health, and a `gh` that logs and answers.
# --------------------------------------------------------------------------
BIN="${WORK}/bin"; mkdir -p "$BIN"
cat > "${BIN}/gh" <<'GH'
#!/usr/bin/env bash
echo "$*" >> "$GH_LOG"
case "$*" in
  *"workflow run"*)          exit 0 ;;
  *rollback.yml*)            [ "${STUB_ROLLBACK:-}" = "ERR" ] && exit 1; printf '%s\n' "${STUB_ROLLBACK:-}" ;;
  *status=success*)          printf '%s\n' "${STUB_LAST_RELEASE:-}" ;;
  *head_sha*)                [ "${STUB_LAST_ATTEMPT:-}" = "ERR" ] && exit 1; printf '%s\n' "${STUB_LAST_ATTEMPT:-}" ;;
  *in_progress*)             [ "${STUB_INFLIGHT:-}" = "ERR" ] && exit 1; printf '%s\n' "${STUB_INFLIGHT:-0}" ;;
  *)                         printf '\n' ;;
esac
GH
chmod +x "${BIN}/gh"

HEALTH_DIR="${WORK}/health"; mkdir -p "${HEALTH_DIR}/api"
python3 -m http.server 0 --directory "$HEALTH_DIR" >/dev/null 2>&1 &
SRV=$!
trap 'kill "$SRV" 2>/dev/null; rm -rf "$WORK"' EXIT
for _ in $(seq 1 50); do
  PORT="$(ss -ltnp 2>/dev/null | grep -o "pid=${SRV}[^ ]*" >/dev/null && true; python3 - "$SRV" <<'PY'
import sys, subprocess, re
try:
    out = subprocess.run(["ss","-ltnp"], capture_output=True, text=True).stdout
except Exception:
    out = ""
m = re.search(r':(\d+)\s+[^\n]*pid=' + sys.argv[1] + r'\b', out)
print(m.group(1) if m else "")
PY
)"
  [ -n "${PORT:-}" ] && break
  sleep 0.1
done
[ -n "${PORT:-}" ] || { echo "FATAL: could not determine the stub server's port."; exit 1; }

# --------------------------------------------------------------------------
# One case.
#   run_case <name> <health-body|NONE> <live-sha-or-empty> <expected-exit> <expected-dispatch yes|no>
# Remaining knobs arrive through STUB_* in the environment.
# --------------------------------------------------------------------------
run_case() {
  local name="$1" body="$2" expect_exit="$3" expect_dispatch="$4"

  if [ "$body" = "NONE" ]; then
    rm -f "${HEALTH_DIR}/api/health"
  else
    printf '%s' "$body" > "${HEALTH_DIR}/api/health"
  fi

  export GH_LOG="${WORK}/gh.log"; : > "$GH_LOG"
  export GITHUB_STEP_SUMMARY="${WORK}/summary.md"; : > "$GITHUB_STEP_SUMMARY"
  export GITHUB_REPOSITORY="mpbarbosa/portal_brasileirao"
  export SITE_URL="http://127.0.0.1:${PORT}"
  export PATH="${BIN}:${PATH}"

  local out rc
  out="$(cd "$FIX" && bash "$STEP" 2>&1)"; rc=$?

  local dispatched=no
  grep -q "workflow run ci.yml" "$GH_LOG" && dispatched=yes

  local verdict=ok
  [ "$rc" = "$expect_exit" ]           || verdict=bad
  [ "$dispatched" = "$expect_dispatch" ] || verdict=bad

  if [ "$verdict" = ok ]; then
    ok "${name} (exit ${rc}, dispatch ${dispatched})"
  else
    bad "${name}: expected exit ${expect_exit}/dispatch ${expect_dispatch}, got exit ${rc}/dispatch ${dispatched}"
    printf '%s\n' "$out" | sed 's/^/       | /' | tail -6
  fi
}

echo
echo "EXPECTED HOLDS — these are not incidents and must stay green (exit 0)"
STUB_INFLIGHT=0 STUB_ROLLBACK='' STUB_LAST_ATTEMPT='' \
  run_case "in sync: live == main"                 "{\"sha\":\"${C}\"}" 0 no
STUB_INFLIGHT=2 STUB_ROLLBACK='' STUB_LAST_ATTEMPT='' \
  run_case "a CI run is already in flight"         "{\"sha\":\"${B}\"}" 0 no
STUB_INFLIGHT=ERR STUB_ROLLBACK='' STUB_LAST_ATTEMPT='' \
  run_case "cannot ask whether one is in flight"   "{\"sha\":\"${B}\"}" 0 no
STUB_INFLIGHT=0 STUB_ROLLBACK="2026-08-30T20:00:00Z" STUB_LAST_RELEASE="2026-08-30T10:00:00Z" STUB_LAST_ATTEMPT='' \
  run_case "deliberate rollback is newer"          "{\"sha\":\"${B}\"}" 0 no

echo
echo "THE HAPPY PATH — a real gap, dispatched"
STUB_INFLIGHT=0 STUB_ROLLBACK='' STUB_LAST_ATTEMPT="success" \
  run_case "behind main, everything clear"         "{\"sha\":\"${B}\"}" 0 yes

echo
echo "NEEDS A PERSON — these must FAIL the run (exit 1) and never dispatch"
STUB_INFLIGHT=0 STUB_ROLLBACK='' STUB_LAST_ATTEMPT="failure" \
  run_case "main's own CI run failed"              "{\"sha\":\"${B}\"}" 1 no
STUB_INFLIGHT=0 STUB_ROLLBACK='' STUB_LAST_ATTEMPT="timed_out" \
  run_case "main's own CI run timed out"           "{\"sha\":\"${B}\"}" 1 no
STUB_INFLIGHT=0 STUB_ROLLBACK='' STUB_LAST_ATTEMPT='' \
  run_case "the site is unreachable"               "NONE" 1 no
STUB_INFLIGHT=0 STUB_ROLLBACK='' STUB_LAST_ATTEMPT='' \
  run_case "health payload carries no sha"         "{\"status\":\"ok\"}" 1 no
STUB_INFLIGHT=0 STUB_ROLLBACK='' STUB_LAST_ATTEMPT='' \
  run_case "live commit is not in this repository" "{\"sha\":\"deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\"}" 1 no
STUB_INFLIGHT=0 STUB_ROLLBACK='' STUB_LAST_ATTEMPT='' \
  run_case "live is not an ancestor of main"       "{\"sha\":\"${D}\"}" 1 no

echo
echo "${pass} ok, ${fail} not ok"
[ "$fail" -eq 0 ]
