#!/bin/bash
#
# rehearse-broadcast-sync-pr.sh
# -----------------------------
# Purpose:      Drive every branch of the two shell steps in
#               .github/workflows/sync-broadcasts.yml that decide *where* a
#               refreshed broadcasts.ts lands — against a real git remote and a
#               stubbed `gh`.
#
#               That workflow used to push straight to `main` (docs/cicd-plan.md
#               gap E). It now opens a pull request instead, which means its
#               shell has branches: an open pull request to build on, an
#               abandoned branch to replace, nothing to commit, and a push that
#               is refused. None of them can be exercised by a pull request —
#               the workflow runs on a schedule, so a green tick on a change to
#               it says only that the *other* workflows still pass.
#
#               Same standing as scripts/rehearse-flip-back.sh: `npm run lint`
#               is TypeScript and cannot see shell, and CI only shellchecks it.
#               This is its only behavioural coverage.
#
# Usage:        ./scripts/rehearse-broadcast-sync-pr.sh
#
# What is real: git, entirely — a real bare remote, real branches, real pushes,
#               real rejections. Only `gh` is stubbed, and it logs every
#               invocation so the assertions can be about what was *not* called.
#
# The assertion that matters most is the boring one repeated in every case:
# **main on the remote is untouched.** That is the property this change exists
# to create, and it is the one a future edit is most likely to lose.
#
# Note the steps are extracted from the workflow file at run time rather than
# copied here. A retyped copy is how the rehearsed shell and the shipped shell
# come to differ, which is the failure this whole script exists to prevent.
#
set -uo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
WORKFLOW="$HERE/.github/workflows/sync-broadcasts.yml"
WF="$(mktemp -d)"
trap 'rm -rf "$WF"' EXIT

# `|| exit 1` is load-bearing: without it a failed extraction leaves the two
# scripts absent and every case fails on its own terms, which reads as
# "the workflow is broken" rather than "the rehearsal could not find its
# subject". Observed while writing this — 19 failures against a workflow that
# simply did not have the steps yet.
if ! python3 - "$WORKFLOW" "$WF" <<'EXTRACT'
import sys, io
try:
    import yaml
except ModuleNotFoundError:
    sys.exit("PyYAML is needed to read the shipped workflow: pip install pyyaml")

workflow, out = sys.argv[1], sys.argv[2]
steps = {s.get("name"): s for s in yaml.safe_load(io.open(workflow, encoding="utf-8"))["jobs"]["sync"]["steps"] if s.get("name")}
for name, dest in [("Decide which branch this run writes to", "target.sh"),
                   ("Commit, and open or add to the pull request", "commit.sh")]:
    if name not in steps:
        sys.exit(f"No step named {name!r} in {workflow} — the rehearsal is testing nothing.")
    io.open(f"{out}/{dest}", "w", encoding="utf-8").write("#!/bin/bash\n" + steps[name]["run"])
EXTRACT
then
  echo "Could not extract the steps under test from ${WORKFLOW}." >&2
  exit 1
fi
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); printf '    ok   %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '    FAIL %s  (%s)\n' "$1" "$2"; }
is()   { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "expected '$3', got '$2'"; fi; }

setup() {              # $1 = case name
  ROOT="$(mktemp -d)"; export ROOT
  git init -q --bare "$ROOT/origin.git"
  git clone -q "file://$ROOT/origin.git" "$ROOT/seed" 2>/dev/null
  cd "$ROOT/seed" || exit 1
  git config user.email a@b.c; git config user.name A
  mkdir -p src/data; echo "export const BROADCASTS = { 1: 'Globo' };" > src/data/broadcasts.ts
  git add -A; git commit -qm "seed"; git branch -M main; git push -q origin main
  MAIN_SHA="$(git rev-parse HEAD)"; export MAIN_SHA

  # `gh` stub: logs every invocation, answers `pr list` from GH_OPEN_PR.
  mkdir -p "$ROOT/bin"
  cat > "$ROOT/bin/gh" <<'GH'
#!/bin/bash
echo "$*" >> "$GH_LOG"
if [ "$1" = "pr" ] && [ "$2" = "list" ]; then echo "${GH_OPEN_PR:-}"; exit 0; fi
if [ "$1" = "pr" ] && [ "$2" = "create" ]; then echo "https://github.com/x/y/pull/999"; exit 0; fi
exit 0
GH
  chmod +x "$ROOT/bin/gh"
  export PATH="$ROOT/bin:$PATH"
  export GH_LOG="$ROOT/gh.log"; : > "$GH_LOG"
  export GITHUB_OUTPUT="$ROOT/out.env"; : > "$GITHUB_OUTPUT"
  export GITHUB_STEP_SUMMARY="$ROOT/summary.md"; : > "$GITHUB_STEP_SUMMARY"
  export GITHUB_SHA="$MAIN_SHA"
  export GH_TOKEN=stub
  printf '  %s\n' "$1"
}

run_target() { ( cd "$ROOT/seed" && bash "$WF/target.sh" >"$ROOT/target.out" 2>&1 ); echo $?; }
run_commit() {
  BRANCH="$(sed -n 's/^branch=//p' "$GITHUB_OUTPUT" | tail -1)"
  PR="$(sed -n 's/^pr=//p' "$GITHUB_OUTPUT" | tail -1)"
  ( cd "$ROOT/seed" && BRANCH="$BRANCH" PR="$PR" bash "$WF/commit.sh" >"$ROOT/commit.out" 2>&1 ); echo $?
}
sync_writes()   { echo "export const BROADCASTS = { 1: 'Globo', 2: 'Premiere' };" > "$ROOT/seed/src/data/broadcasts.ts"; }
remote_sha()    { git -C "$ROOT/origin.git" rev-parse --verify -q "$1" 2>/dev/null || echo MISSING; }
gh_called()     { grep -qF "$1" "$GH_LOG" && echo yes || echo no; }

echo "== 1. no open PR, CBF published something =="
setup "starts from main, force-pushes the bot branch, opens one PR"
export GH_OPEN_PR=""
is "target step exits 0" "$(run_target)" 0
sync_writes
is "commit step exits 0" "$(run_commit)" 0
is "changed=true recorded"     "$(sed -n 's/^changed=//p' "$GITHUB_OUTPUT" | tail -1)" true
is "gh pr create called"       "$(gh_called 'pr create')" yes
is "main on the remote is untouched" "$(remote_sha main)" "$MAIN_SHA"
is "bot branch exists on the remote" "$([ "$(remote_sha automation/sync-broadcasts)" != MISSING ] && echo yes || echo no)" yes
is "bot branch descends from main" "$(git -C "$ROOT/seed" merge-base --is-ancestor "$MAIN_SHA" "$(remote_sha automation/sync-broadcasts)" && echo yes || echo no)" yes

echo "== 2. a previous sync is still open =="
setup "builds on the open PR's branch instead of beside it"
git -C "$ROOT/seed" switch -q -c automation/sync-broadcasts
echo "export const BROADCASTS = { 1: 'Globo', 9: 'SporTV' };" > "$ROOT/seed/src/data/broadcasts.ts"
git -C "$ROOT/seed" commit -qam "earlier sync"; git -C "$ROOT/seed" push -q origin automation/sync-broadcasts
PENDING="$(git -C "$ROOT/seed" rev-parse HEAD)"
git -C "$ROOT/seed" switch -q main
git -C "$ROOT/seed" branch -qD automation/sync-broadcasts
export GH_OPEN_PR="42"
is "target step exits 0" "$(run_target)" 0
is "pr=42 carried to the commit step" "$(sed -n 's/^pr=//p' "$GITHUB_OUTPUT" | tail -1)" 42
is "checked out the pending branch, not main" "$(git -C "$ROOT/seed" rev-parse HEAD)" "$PENDING"
sync_writes
is "commit step exits 0" "$(run_commit)" 0
is "no second PR opened"  "$(gh_called 'pr create')" no
is "the earlier sync is still an ancestor" "$(git -C "$ROOT/seed" merge-base --is-ancestor "$PENDING" "$(remote_sha automation/sync-broadcasts)" && echo yes || echo no)" yes
is "main on the remote is untouched" "$(remote_sha main)" "$MAIN_SHA"

echo "== 3. CBF published nothing =="
setup "commits nothing, pushes nothing, opens nothing"
export GH_OPEN_PR=""
is "target step exits 0" "$(run_target)" 0
is "commit step exits 0" "$(run_commit)" 0
is "changed=false recorded" "$(sed -n 's/^changed=//p' "$GITHUB_OUTPUT" | tail -1)" false
is "no PR opened"           "$(gh_called 'pr create')" no
is "no bot branch on the remote" "$(remote_sha automation/sync-broadcasts)" MISSING
is "main on the remote is untouched" "$(remote_sha main)" "$MAIN_SHA"

echo "== 4. a branch left behind by a closed PR =="
setup "replaces the abandoned branch rather than failing"
git -C "$ROOT/seed" switch -q -c automation/sync-broadcasts
echo "abandoned" > "$ROOT/seed/src/data/broadcasts.ts"
git -C "$ROOT/seed" commit -qam "abandoned sync"; git -C "$ROOT/seed" push -q origin automation/sync-broadcasts
ABANDONED="$(git -C "$ROOT/seed" rev-parse HEAD)"
git -C "$ROOT/seed" switch -q main
git -C "$ROOT/seed" branch -qD automation/sync-broadcasts
export GH_OPEN_PR=""
is "target step exits 0" "$(run_target)" 0
sync_writes
is "commit step exits 0" "$(run_commit)" 0
is "abandoned commit is gone from the branch" "$(git -C "$ROOT/seed" merge-base --is-ancestor "$ABANDONED" "$(remote_sha automation/sync-broadcasts)" && echo yes || echo no)" no
is "a PR was opened for the fresh branch" "$(gh_called 'pr create')" yes
is "main on the remote is untouched" "$(remote_sha main)" "$MAIN_SHA"

echo "== 5. somebody pushed to the open PR's branch mid-run =="
setup "refuses rather than forcing over it"
git -C "$ROOT/seed" switch -q -c automation/sync-broadcasts
git -C "$ROOT/seed" commit -q --allow-empty -m "earlier sync"
git -C "$ROOT/seed" push -q origin automation/sync-broadcasts
git -C "$ROOT/seed" switch -q main
git -C "$ROOT/seed" branch -qD automation/sync-broadcasts
export GH_OPEN_PR="42"
# case 5 passed for the wrong reason while the target step was failing: assert it worked
is "target step exits 0" "$(run_target)" 0
is "it is on the branch it will push" "$(git -C "$ROOT/seed" rev-parse --abbrev-ref HEAD)" automation/sync-broadcasts
# a third party advances the branch after the fetch
OTHER="$(mktemp -d)"; git clone -q "file://$ROOT/origin.git" "$OTHER/c" 2>/dev/null
git -C "$OTHER/c" config user.email a@b.c; git -C "$OTHER/c" config user.name A
git -C "$OTHER/c" switch -q automation/sync-broadcasts
git -C "$OTHER/c" commit -q --allow-empty -m "a human edit"
git -C "$OTHER/c" push -q origin automation/sync-broadcasts
THEIRS="$(git -C "$OTHER/c" rev-parse HEAD)"
sync_writes
rc="$(run_commit)"
is "commit step fails rather than forcing" "$([ "$rc" != 0 ] && echo yes || echo no)" yes
is "the human's commit survives" "$(remote_sha automation/sync-broadcasts)" "$THEIRS"
is "main on the remote is untouched" "$(remote_sha main)" "$MAIN_SHA"

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
