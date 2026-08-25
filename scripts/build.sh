#!/bin/bash
#
# build.sh
# --------
# Purpose:      Build the frontend and the server bundle, stamping the commit
#               and build time into the server so a running instance can say
#               exactly what it is.
#
#               Before this the app reported a hard-coded "0.1.0" for every
#               deploy ever made, which answered nothing. Verifying what was
#               live meant comparing an md5 of dist/server.cjs by hand.
#
# Usage:        ./scripts/build.sh
#               npm run build
#
# The values are injected at bundle time rather than read from the environment
# at runtime, so the artifact is self-describing: whatever host it lands on, it
# reports the commit it was built from.
#
# Exit codes:
#   0  dist/ built and stamped.
#   1  a build step failed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# CI checks out a detached HEAD, where `git rev-parse` still works; GITHUB_SHA is
# the fallback for shallow or export-based checkouts with no git dir at all.
sha="$(git rev-parse --short HEAD 2>/dev/null || true)"
if [[ -z "$sha" && -n "${GITHUB_SHA:-}" ]]; then
    sha="${GITHUB_SHA:0:7}"
fi
sha="${sha:-unknown}"

# A local build with uncommitted work is not the commit it claims to be, and
# that difference matters exactly when you are debugging what is running.
if git diff --quiet HEAD 2>/dev/null; then
    :
else
    sha="${sha}-dirty"
fi

built_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "==> Building ${sha} at ${built_at}"

npx vite build

npx esbuild server.ts \
    --bundle \
    --platform=node \
    --format=cjs \
    --packages=external \
    --sourcemap \
    --define:__BUILD_SHA__="\"${sha}\"" \
    --define:__BUILD_TIME__="\"${built_at}\"" \
    --outfile=dist/server.cjs

echo "Built dist/server.cjs (${sha})"
