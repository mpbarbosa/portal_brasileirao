#!/bin/bash
#
# check-screenshots.sh
# --------------------
# Purpose:      Fail when the README's screenshots predate the last change to
#               the app's appearance.
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
# nothing to do with the app. Git already knows what we need: whether the
# newest commit touching the appearance is an ancestor of the newest commit
# touching the images.
#
# Requires full history — `actions/checkout` with `fetch-depth: 0`.
#
# Usage:        ./scripts/check-screenshots.sh
#
# Exit codes:
#   0  screenshots are at least as new as the appearance they document.
#   1  they predate it, or history is too shallow to tell.

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

if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
    echo "Error: shallow clone — cannot compare commit ancestry."
    echo "  actions/checkout needs fetch-depth: 0 for this check."
    exit 1
fi

last_ui="$(git log -1 --format=%H -- "${SURFACE[@]}")"
last_shot="$(git log -1 --format=%H -- docs/screenshots)"

if [ -z "$last_ui" ] || [ -z "$last_shot" ]; then
    echo "Error: could not find commits for the appearance or the screenshots."
    exit 1
fi

if git merge-base --is-ancestor "$last_ui" "$last_shot"; then
    echo "Screenshots are current."
    echo "  last appearance change: $(git log -1 --format='%h %s' "$last_ui")"
    echo "  last screenshot refresh: $(git log -1 --format='%h %s' "$last_shot")"
    exit 0
fi

echo "Error: the screenshots predate the last change to the app's appearance."
echo
echo "  last screenshot refresh: $(git log -1 --format='%h %s' "$last_shot")"
echo "  appearance changed since, in:"
git log --format='    %h %s' "$last_shot..$last_ui" -- "${SURFACE[@]}"
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
echo "  Refresh docs/screenshots, then commit them."
echo
echo "  The rule is that the images must depict THIS commit — not that they come"
echo "  from production. scripts/screenshot.ts enforces it: it reads /api/health"
echo "  from whatever it captured and writes into docs/screenshots only if that"
echo "  build carries the same appearance as HEAD and is serving real provider"
echo "  data. Anything else lands in docs/screenshots/local, which is gitignored."
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
echo "  A refusal into docs/screenshots/local is the tool working, not a fault:"
echo "  it means the build you captured is not the one you are documenting."
exit 1
