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
SURFACE=(src/components src/index.css src/App.tsx index.html)

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
echo "  Refresh against the deployed build, then commit docs/screenshots:"
echo "    S=https://brasileirao.mpbarbosa.com"
echo "    npx tsx scripts/screenshot.ts \"\$S/\" light"
echo "    npx tsx scripts/screenshot.ts \"\$S/\" dark"
echo "    npx tsx scripts/screenshot.ts \"\$S/\" light mobile"
echo "    npx tsx scripts/screenshot.ts \"\$S/\" dark mobile"
echo "    npx tsx scripts/screenshot.ts \"\$S/jogos\" light         # and dark"
echo "    npx tsx scripts/screenshot.ts \"\$S/clube/palmeiras\" light   # and dark"
echo "    npx tsx scripts/screenshot.ts \"\$S/partida/554972\" light    # and dark"
echo
echo "  Shoot the deployed build, not a dev server: a local capture goes to"
echo "  docs/screenshots/local and will not satisfy this check."
exit 1
