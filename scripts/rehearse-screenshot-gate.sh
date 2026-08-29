#!/bin/bash
#
# rehearse-screenshot-gate.sh
# ---------------------------
# Purpose:      Behavioural coverage for scripts/check-screenshots.sh.
#
#               That script decides whether the committed screenshots still
#               depict the app, and until this rehearsal it had none. `npm run
#               lint` is TypeScript and cannot see shell; CI shellchecks it,
#               which proves it parses. Every rule in it — the anchor, the
#               trailer, the topology filter — was verified by reading.
#
#               Reading is how the merge-sha defect survived: the gate credited
#               a `Screenshots-unaffected:` trailer on a topic commit and then
#               flagged the identical edit again under the merge commit that
#               landed it, because a merge made from the GitHub button has
#               nowhere to carry a trailer. Three PRs in the history hit it
#               (#205, #202, #217) and nothing said so.
#
# Hermetic:     git, bash, mktemp. No network, no npm, no AWS, no browser — so
#               a red run here always means this commit broke something, never
#               that somebody else's server had a bad minute. Same rule the
#               flip-back and backup rehearsals follow.
#
# Usage:        ./scripts/rehearse-screenshot-gate.sh
#               Exits 0 when every case holds, 1 otherwise.

set -uo pipefail

GATE="$(cd "$(dirname "$0")/.." && pwd)/scripts/check-screenshots.sh"
[ -x "$GATE" ] || { echo "Cannot find an executable $GATE"; exit 1; }

pass=0
fail=0

ok()   { pass=$((pass + 1)); printf '  ok    %s\n' "$1"; }
bad()  { fail=$((fail + 1)); printf '  NOT OK %s\n' "$1"; }

# --- fixture construction -------------------------------------------------------
# A throwaway repository with this one's shape: the appearance paths it declares,
# a component inside one of them, and a screenshots directory carrying CAPTURED.

new_repo() {
    repo="$(mktemp -d)"
    cd "$repo" || exit 1
    git init -q -b main
    git config user.email r@example.com
    git config user.name Rehearsal
    git config commit.gpgsign false

    mkdir -p scripts src/components docs/screenshots
    cp "$GATE" scripts/check-screenshots.sh
    chmod +x scripts/check-screenshots.sh
    printf 'src/components\nsrc/index.css\n' > scripts/appearance-paths.txt
    echo 'export const Table = () => null;' > src/components/Table.tsx
    echo 'export const Nav = () => null;' > src/components/Nav.tsx
    echo 'png' > docs/screenshots/home.png
    git add -A
    git commit -qm "base"
}

# Point CAPTURED at a commit and commit that note. Never touches an appearance
# path, so it cannot itself be the thing the gate complains about.
capture_at() {
    printf '# Which commit these screenshots depict.\ncommit %s\n' "$(git rev-parse --short "$1")" \
        > docs/screenshots/CAPTURED
    git add docs/screenshots/CAPTURED
    git commit -qm "Re-shoot at $(git rev-parse --short "$1")"
}

# One commit touching an appearance path, with an optional trailer body.
#
# The file is a parameter because two branches that both append to one file
# conflict, and a conflicted merge leaves the fixture mid-merge with nothing
# committed — every assertion after it then measures a repository in a state no
# case describes. The first draft did exactly that and reported a pass.
appearance_commit() {
    local subject="$1" trailer="${2:-}" file="${3:-src/components/Table.tsx}"
    echo "// $subject" >> "$file"
    git add "$file"
    if [ -n "$trailer" ]; then
        git commit -q -m "$subject" -m "$trailer"
    else
        git commit -qm "$subject"
    fi
}

# Assert the gate's exit status, and optionally that its output does or does not
# name a commit. Runs in the fixture's own directory, as CI runs it.
expect() {
    local label="$1" want="$2"
    local out status
    out="$(./scripts/check-screenshots.sh 2>&1)"
    status=$?
    if [ "$status" != "$want" ]; then
        bad "$label — wanted exit $want, got $status"
        printf '%s\n' "$out" | sed 's/^/        /'
        return
    fi
    shift 2
    local spec
    for spec in "$@"; do
        case "$spec" in
            names:*)
                if ! printf '%s' "$out" | grep -q "${spec#names:}"; then
                    bad "$label — output does not name ${spec#names:}"
                    printf '%s\n' "$out" | sed 's/^/        /'
                    return
                fi ;;
            silent:*)
                # Named anywhere is not enough: the commit must not be in the
                # unaccounted list. Look only above the claims block.
                if printf '%s' "$out" | sed -n '/appearance changed since/,/Declared not/p' \
                    | grep -q "${spec#silent:}"; then
                    bad "$label — output blames ${spec#silent:}"
                    printf '%s\n' "$out" | sed 's/^/        /'
                    return
                fi ;;
        esac
    done
    ok "$label"
}

TRAILER_BODY="Screenshots-unaffected: a constant moved module; no rendered pixel can change."

echo "check-screenshots.sh — behavioural rehearsal"
echo

# 1. Nothing has moved since the capture.
new_repo
capture_at HEAD
expect "a capture with no appearance change since is current" 0
rm -rf "$repo"

# 2. A plain appearance change nobody accounted for.
new_repo
capture_at HEAD
appearance_commit "restyle the table"
expect "an unaccounted appearance change is refused" 1 "names:restyle the table"
rm -rf "$repo"

# 3. A trailer on a direct commit — the mechanism working where it always did.
new_repo
capture_at HEAD
appearance_commit "move a constant" "$TRAILER_BODY"
expect "a trailer on a direct commit is honoured" 0 "names:Declared not to move a pixel"
rm -rf "$repo"

# 4. THE DEFECT. The same trailered commit, landed the way every PR here lands:
#    a merge commit, which has nowhere to carry a trailer.
#
#    MAIN HAS TO MOVE ON AN APPEARANCE PATH WHILE THE BRANCH IS OUT, and this
#    case does not reproduce without it. The first fixture written here did not,
#    and passed against the unfixed gate — the merge was then TREESAME to its
#    topic parent on these paths, so git's own history simplification never
#    listed it and there was nothing for the gate to get wrong. The defect needs
#    a merge that differs from BOTH parents on an appearance path, which is what
#    a shared checkout produces all day and what a lone branch never does.
new_repo
capture_at HEAD
git checkout -qb topic
appearance_commit "move a constant" "$TRAILER_BODY"
git checkout -q main
appearance_commit "somebody else's restyle" "$TRAILER_BODY" src/components/Nav.tsx
git merge -q --no-ff -m "Merge pull request #1 from topic" topic
expect "a trailer survives the merge commit that lands it" 0 \
    "names:Declared not to move a pixel" "silent:Merge pull request #1"
rm -rf "$repo"

# 5. The same topology with NO trailer on the topic commit. The fix must not let
#    real debt through: that commit is still enumerated and still unexcused.
new_repo
capture_at HEAD
git checkout -qb topic
appearance_commit "restyle the table"
git checkout -q main
appearance_commit "somebody else's change" "$TRAILER_BODY" src/components/Nav.tsx
git merge -q --no-ff -m "Merge pull request #2 from topic" topic
expect "an untrailered change is still refused when landed by a merge" 1 \
    "names:restyle the table"
rm -rf "$repo"

# 6. AN EVIL MERGE — a conflict resolved by hand into an appearance path, so the
#    result is in neither parent. Only the merge commit can answer for it, so
#    skipping merges wholesale would blind the gate here. This is the case that
#    makes `--no-merges` the wrong fix.
new_repo
capture_at HEAD
git checkout -qb left
echo '// left' >> src/components/Table.tsx
git commit -qam "left edit" -m "$TRAILER_BODY"
git checkout -q main
echo '// right' >> src/components/Table.tsx
git commit -qam "right edit" -m "$TRAILER_BODY"
git merge --no-ff -m "Merge branch left" left >/dev/null 2>&1
printf 'export const Table = () => null;\n// resolved by hand, in neither parent\n' \
    > src/components/Table.tsx
git add src/components/Table.tsx
git commit -q --no-edit
expect "an evil merge is still refused — its resolution is in neither parent" 1 \
    "names:Merge branch left"
rm -rf "$repo"

# 7. A catch-up merge: the branch changed nothing, main moved under it. The
#    pre-existing topology filter covers this and must keep doing so.
new_repo
capture_at HEAD
git checkout -qb idle
echo "not an appearance path" > README.md
git add README.md
git commit -qm "docs only"
git checkout -q main
git merge -q --no-ff -m "Merge branch idle" idle
expect "a catch-up merge changing nothing on main is current" 0
rm -rf "$repo"

# 8. A trailer with no reason is a rubber stamp, and refusing it is the whole
#    difference between a claim and a checkbox.
new_repo
capture_at HEAD
appearance_commit "restyle the table" "Screenshots-unaffected:"
expect "an empty trailer is refused" 1 "names:with no reason"
rm -rf "$repo"

# 9. The retroactive form, for a commit already on main and no longer amendable.
new_repo
capture_at HEAD
appearance_commit "restyle the table"
stale="$(git rev-parse --short HEAD)"
echo "// later" >> src/components/Table.tsx
git add src/components/Table.tsx
git commit -q -m "a later change" \
    -m "Screenshots-unaffected: $stale: the rule it added is never in effect during a paint.
Screenshots-unaffected: and this one changes a comment."
expect "the retroactive <sha>: form excuses an earlier commit" 0 \
    "names:Declared not to move a pixel"
rm -rf "$repo"

echo
echo "$pass ok, $fail not ok"
[ "$fail" -eq 0 ]
