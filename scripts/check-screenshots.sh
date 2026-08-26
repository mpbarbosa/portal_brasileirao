#!/bin/bash
#
# check-screenshots.sh
# --------------------
# Purpose:      Fail when the README's screenshots no longer depict the app.
#
#               A screenshot is a claim about the current app that nothing
#               verifies. It rots on every merge that touches a component, and
#               in this repository — where several sessions ship independently —
#               that happened three times in one day: twice mid-capture during
#               the MD3 migration, once between capture and push.
#
# Why not compare pixels: a baseline rendered on a workstation does not match
# one rendered on a CI runner. Fonts differ (1300+ files here, a fraction of
# that on ubuntu-latest), so every comparison would fail for a reason that has
# nothing to do with the app. Git already knows what we need.
#
# WHAT IT ASKS, AND WHY IT IS NO LONGER AN ANCESTRY TEST
#
# This used to ask whether the newest commit touching an appearance path is an
# ancestor of the newest commit touching docs/screenshots. That was a proxy for
# the real question — *do the committed images still depict the app?* — and it
# answered red in two situations where they do. Both were measured on main, not
# reasoned about.
#
#   1. Topology, not appearance. A merge that brings a behind-branch forward
#      changes appearance paths relative to its second parent while changing
#      nothing on the first-parent line. `c38e722` was reported as an appearance
#      change whose appearance tree is byte-identical to the screenshot commit's.
#      No refresh could clear it, because there was nothing to refresh.
#
#      So the first question here is about content: are the appearance sources
#      at the screenshot commit identical to HEAD's? That is a direct answer
#      where ancestry was an inference, and it is strictly weaker as a bar —
#      an ancestry pass implies identical trees, never the reverse. Every case
#      the old test passed, this one passes.
#
#   2. A change can touch an appearance path without moving a pixel. PR #42 put
#      a rule in src/index.css that is only in effect inside one synchronous
#      block in applyTheme, so no paint anyone can capture ever sees it — and
#      the revert of it, a few hours later, was equally invisible. Both reddened
#      the gate. Re-shooting produced sixteen byte-identical files, and no new
#      blob means no commit, so `git log -1 -- docs/screenshots` could not be
#      made newer at all.
#
#      `docs/screenshots/CAPTURED` (2129da0) closed that deadlock from the other
#      end: screenshot.ts records the commit it captured, so a refresh is always
#      something this can see. Read that first — it is the mechanical answer and
#      it is better than a claim wherever it applies.
#
#      What it does not remove is the price. Clearing an invisible edit still
#      means re-capturing sixteen images from a live-data production build of
#      HEAD to certify that nothing changed, and the commit that results says
#      only that a capture happened, not why it was identical. Where an edit
#      provably cannot reach a paint, a sentence is cheaper than a photograph
#      and says more — see TRAILER below. Where it is merely *probably*
#      identical, the photograph is the honest answer and CAPTURED makes it
#      cheap. That is the line between the two.
#
# THE TRAILER
#
# A commit may declare that its appearance edit moves no pixel:
#
#     Screenshots-unaffected: <why no rendered pixel can change>
#
# and any later commit may say it for an earlier one, which is what the case
# above needed — by the time the problem is visible the commit is on main and
# cannot be amended:
#
#     Screenshots-unaffected: f5e21ca: <why no rendered pixel can change>
#
# The reason is required and is printed on every run, green or red, so the claim
# is reviewed rather than remembered. Nothing can verify it — that is the point
# of writing it down where a reader will meet it beside the diff it excuses.
# Reach for it only when the edit cannot reach a paint. "It looks the same to me"
# is a screenshot refresh, not a trailer.
#
# Requires full history — `actions/checkout` with `fetch-depth: 0`.
#
# Usage:        ./scripts/check-screenshots.sh
#
# Exit codes:
#   0  the screenshots depict HEAD's appearance, or every difference is excused.
#   1  they do not, or history is too shallow to tell.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(cd "$SCRIPT_DIR/.." && pwd)"

# What changes how a page looks. Deliberately not src/data: the data moves with
# every match and every sync, and the README does not claim its numbers are
# current — it claims the app looks like this.
#
# Shared with scripts/screenshot.ts, which refuses to commit a capture of a
# build whose appearance differs from HEAD's. Two copies of this list would
# drift, and the drift would be silent in both directions at once.
mapfile -t SURFACE < scripts/appearance-paths.txt

SITE="https://brasileirao.mpbarbosa.com"
SHOT_DIR="docs/screenshots"
TRAILER="Screenshots-unaffected"

if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
    echo "Error: shallow clone — cannot compare commit ancestry."
    echo "  actions/checkout needs fetch-depth: 0 for this check."
    exit 1
fi

last_shot="$(git log -1 --format=%H -- "$SHOT_DIR")"

if [ -z "$last_shot" ]; then
    echo "Error: could not find a commit touching $SHOT_DIR."
    exit 1
fi

# The content question. `git diff` between two commits compares their trees, so
# this is true exactly when the appearance sources the images were taken against
# are the ones HEAD ships — whatever route the history took to get here.
if git diff --quiet "$last_shot" HEAD -- "${SURFACE[@]}"; then
    echo "Screenshots are current."
    echo "  last screenshot refresh: $(git log -1 --format='%h %s' "$last_shot")"
    echo "  the appearance has not changed since."
    exit 0
fi

# Something differs. Collect the claims first: a trailer may sit on any commit
# in the range, not only on an appearance commit, because the retroactive form
# is written after the fact by a commit that need not touch a component at all.
excused_sha=()
excused_reason=()
excused_by=()
malformed=()

while IFS= read -r -d '' record; do
    claimant="${record%%$'\x1f'*}"
    rest="${record#*$'\x1f'}"
    # `keyonly` is how presence is told from emptiness. `valueonly` alone reports
    # a bare "Screenshots-unaffected:" and a commit with no trailer at all as the
    # same empty string, which swallowed the one case the reason is required for.
    keys="${rest%%$'\x1f'*}"
    values="${rest#*$'\x1f'}"
    [ -n "$keys" ] || continue

    while IFS= read -r -d $'\x1e' value; do
        # `unfold` already joins a wrapped trailer onto one line; this squeezes
        # the indentation it joins with, and tabs, down to single spaces.
        value="$(printf '%s' "$value" | tr -s '[:space:]' ' ')"
        value="${value# }"
        value="${value% }"

        if [[ "$value" =~ ^([0-9a-f]{7,40}):[[:space:]]*(.*)$ ]]; then
            target="${BASH_REMATCH[1]}"
            reason="${BASH_REMATCH[2]}"
        else
            target="$claimant"
            reason="$value"
        fi

        # An empty reason is a rubber stamp. Refusing it is the whole difference
        # between a claim and a checkbox.
        if [ -z "$reason" ]; then
            malformed+=("$claimant")
            continue
        fi

        excused_sha+=("$target")
        excused_reason+=("$reason")
        excused_by+=("$claimant")
    done < <(printf '%s\x1e' "$values")
done < <(git log -z \
    --format="%H%x1f%(trailers:key=$TRAILER,keyonly,separator=%x1e)%x1f%(trailers:key=$TRAILER,valueonly,unfold,separator=%x1e)" \
    "$last_shot..HEAD")

unexplained=()
honoured=()
topology=()

while IFS= read -r sha; do
    # A merge is listed here when it differs from *a* parent, which includes the
    # merge that only catches a branch up. It introduced no appearance change on
    # the first-parent line, and the first-parent line is what main is. A
    # non-merge cannot reach this branch: git would not have listed it unless it
    # changed one of these paths against its only parent.
    if parent="$(git rev-parse --verify --quiet "$sha^1")" \
        && git diff --quiet "$parent" "$sha" -- "${SURFACE[@]}"; then
        topology+=("$sha")
        continue
    fi

    matched=""
    for i in "${!excused_sha[@]}"; do
        if [[ "$sha" == "${excused_sha[$i]}"* ]]; then
            matched="$i"
            break
        fi
    done

    if [ -n "$matched" ]; then
        honoured+=("$matched:$sha")
    else
        unexplained+=("$sha")
    fi
done < <(git log --format=%H "$last_shot..HEAD" -- "${SURFACE[@]}")

# Print the claims whether or not they carried the run. A trailer that is only
# read when it changes the verdict is a trailer nobody reviews.
report_honoured() {
    [ ${#honoured[@]} -gt 0 ] || return 0
    echo
    echo "  Declared not to move a pixel:"
    for entry in "${honoured[@]}"; do
        i="${entry%%:*}"
        sha="${entry#*:}"
        echo "    $(git log -1 --format='%h %s' "$sha")"
        echo "      $TRAILER: ${excused_reason[$i]}"
        if [ "${excused_by[$i]}" != "$sha" ]; then
            echo "      claimed by $(git log -1 --format='%h %s' "${excused_by[$i]}")"
        fi
    done
}

report_malformed() {
    [ ${#malformed[@]} -gt 0 ] || return 0
    echo
    echo "  Ignored — $TRAILER with no reason:"
    for sha in "${malformed[@]}"; do
        echo "    $(git log -1 --format='%h %s' "$sha")"
    done
}

if [ ${#unexplained[@]} -eq 0 ]; then
    echo "Screenshots are current."
    echo "  last screenshot refresh: $(git log -1 --format='%h %s' "$last_shot")"
    if [ ${#topology[@]} -gt 0 ]; then
        echo "  appearance paths moved only by a catch-up merge, changing nothing on main:"
        for sha in "${topology[@]}"; do
            echo "    $(git log -1 --format='%h %s' "$sha")"
        done
    fi
    report_honoured
    report_malformed
    exit 0
fi

echo "Error: the screenshots predate the last change to the app's appearance."
echo
echo "  last screenshot refresh: $(git log -1 --format='%h %s' "$last_shot")"
echo "  appearance changed since, in:"
for sha in "${unexplained[@]}"; do
    echo "    $(git log -1 --format='%h %s' "$sha")"
done
report_honoured
report_malformed
echo
# What to tell the reader, and why it is not a fixed recipe.
#
# This block used to print a literal list of commands against the live site,
# ending "shoot the deployed build, not a dev server". Both halves rotted. The
# advice stopped being true when screenshot.ts began checking what the build it
# captured actually is, and the fixture id in the list outlived the image it
# named — following it wrote a PNG the README no longer referenced, which is a
# quieter failure than an error because the file looks perfectly correct.
#
# So: state the rule, and derive the file list from what is committed. A recipe
# built from `ls` cannot name an image that does not exist.
echo "  Refresh $SHOT_DIR, then commit them."
echo
echo "  Re-read the alt text in README.md for every image you retake. It"
echo "  describes what the picture shows, so a recaptured image can leave it"
echo "  describing a page that no longer exists — and nothing here checks the"
echo "  two against each other. Nothing can: the one reader alt text is written"
echo "  for is the one who cannot see that it has drifted. Not hypothetical —"
echo "  the Ao vivo alt quoted a countdown, a refresh moved it, and the stale"
echo "  description passed review and a merge before anyone opened the PNG."
echo
echo "  The rule is that the images must depict THIS commit — not that they come"
echo "  from production. scripts/screenshot.ts enforces it: it reads /api/health"
echo "  from whatever it captured and writes into $SHOT_DIR only if that"
echo "  build carries the same appearance as HEAD and is serving real provider"
echo "  data. Anything else lands in $SHOT_DIR/local, which is gitignored."
echo
echo "  So capture from either:"
echo "    - a local production build of HEAD (npm run build && npm start) — the"
echo "      normal case, and the only one available while a change is unreleased"
echo "    - $SITE, but only once it already carries the change"
echo
echo "  The committed set, each needing its light and dark pair:"
for shot in "$SHOT_DIR"/*.png; do
    [ -e "$shot" ] || continue
    echo "    $(basename "$shot")"
done
echo
echo "  A refusal into $SHOT_DIR/local is the tool working, not a fault:"
echo "  it means the build you captured is not the one you are documenting."
echo
echo "  If a listed commit CANNOT move a rendered pixel — a rule that is never in"
echo "  effect during a paint, a selector nothing matches, a comment — say so in"
echo "  a commit message and this will honour it and print it:"
echo
echo "    $TRAILER: <why no rendered pixel can change>"
echo "    $TRAILER: <sha>: <why>   (for a commit already on main)"
echo
echo "  Nothing verifies that claim. It is a note to the next reader, standing"
echo "  where they will meet it beside the diff. \"It looks the same to me\" is a"
echo "  refresh, not a trailer."
exit 1
