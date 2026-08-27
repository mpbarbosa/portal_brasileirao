#!/bin/bash
#
# rehearse-flip-back.sh
# ---------------------
# Purpose:      Drive every branch of the host-side deploy scripts —
#               07_install_release.sh and 06_redeploy.sh — against stubs, so the
#               flip-back can be exercised without a host and without
#               deliberately breaking a real release.
#
#               These two scripts run on every release and can leave production
#               down. They are shell, so `npm run lint` cannot see them and CI
#               only shellchecks them. This is their only behavioural coverage.
#
# Usage:        ./scripts/rehearse-flip-back.sh
#
# Nothing runs this automatically, for the same reason as check-hymns: it is a
# rehearsal a person reads, and it must be re-run by whoever next edits either
# script. It needs only bash, python3, rsync and curl — no network, no AWS, no
# token.
#
# What is stubbed, and what deliberately is not:
#   - systemctl, journalctl, sudo, npm   stubbed; the systemctl stub reloads
#                                        whatever dist/ holds, so health after a
#                                        restart is a property of the bytes on
#                                        disk rather than of the harness.
#   - the health endpoint                a real HTTP server on localhost, so the
#                                        real curl and its real -f behaviour are
#                                        exercised rather than a mock of them.
#   - rsync, cp, the scripts themselves  real, and read from shell_scripts/ as
#                                        shipped. A retyped copy is how the
#                                        tested script and the shipped one drift.
#
# Exit codes:
#   0  Every branch behaved as the table says.
#   1  At least one did not.

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/flip-back-XXXXXXXX")"
trap 'rm -rf "$WORK"; [[ -n "${HEALTHD:-}" ]] && kill "$HEALTHD" 2>/dev/null' EXIT INT TERM

PASS=0
FAIL=0
RELEASE_SEQ=0
HEALTHD=""

# ------------------------------------------------------------------ stubs
mkdir -p "$WORK/bin"

cat > "$WORK/bin/systemctl" <<'EOF'
#!/bin/bash
echo "systemctl $*" >> "$STUB_LOG"
if [[ "${1:-}" == restart ]]; then
    # A restart loads whatever is in dist/ *now*. This is the whole point of the
    # rehearsal: health afterwards depends on the bytes the script put there.
    if [[ -f "$DEPLOY_DIR/dist/server.cjs" ]]; then
        grep -o 'MARKER=[A-Z]* sha=[a-z0-9]*' "$DEPLOY_DIR/dist/server.cjs" \
            | sed 's/MARKER=//' > "$STATE/running"
    else
        echo "NOTHING" > "$STATE/running"
    fi
fi
exit 0
EOF

cat > "$WORK/bin/journalctl" <<'EOF'
#!/bin/bash
echo "journalctl $*" >> "$STUB_LOG"
echo "(rehearsal: journal would print here)"
exit 0
EOF

cat > "$WORK/bin/sudo" <<'EOF'
#!/bin/bash
while [[ "${1:-}" == -* ]]; do shift; done
exec "$@"
EOF

cat > "$WORK/bin/npm" <<'EOF'
#!/bin/bash
echo "npm $*" >> "$STUB_LOG"
# `npm ci` refuses when the package.json on disk says so — that is how a release
# whose dependencies cannot be installed (or a full disk) is simulated.
if grep -q '"npmFails": *true' "$DEPLOY_DIR/package.json" 2>/dev/null; then
    echo "npm ERR! rehearsal: forced failure" >&2
    exit 1
fi
exit 0
EOF

chmod +x "$WORK/bin"/*

cat > "$WORK/healthd.py" <<'EOF'
import http.server, io, os, sys

STATE = sys.argv[1]

class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            running = io.open(os.path.join(STATE, "running"), encoding="utf-8").read().strip()
        except OSError:
            running = ""
        if running.startswith("GOOD"):
            sha = running.split()[-1].replace("sha=", "")
            body = ('{"status":"ok","sha":"%s","builtAt":"2026-08-27T00:00:00Z"}' % sha).encode()
            self.send_response(200)
        else:
            body = b'{"status":"degraded"}'
            self.send_response(503)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass

srv = http.server.HTTPServer(("127.0.0.1", 0), H)
io.open(os.path.join(STATE, "port"), "w").write(str(srv.server_address[1]))
srv.serve_forever()
EOF

# --------------------------------------------------------------- fixtures
# A release is a staging directory whose dist/server.cjs carries a marker the
# systemctl stub reads back: GOOD becomes a 200 from the health endpoint, BAD a
# 503.
make_release() {   # <dir> <GOOD|BAD> <sha> [npm-fails]
    local dir="$1" marker="$2" sha="$3" npmfails="${4:-false}" pad
    rm -rf "$dir"
    mkdir -p "$dir/dist" "$dir/shell_scripts"
    # Pad so two releases differ in SIZE, and stamp distinct mtimes below:
    # `rsync -a`'s quick-check compares size and mtime rather than bytes, so
    # same-size fixtures written in the same second are silently skipped and the
    # install looks like a no-op. Real builds differ in both, and the release
    # tarball carries the build's own mtime.
    RELEASE_SEQ=$((RELEASE_SEQ + 1))
    pad="$(head -c "$((RELEASE_SEQ * 37 + 64))" /dev/zero | tr '\0' 'x')"
    printf '// MARKER=%s sha=%s\n%s\n' "$marker" "$sha" "$pad" > "$dir/dist/server.cjs"
    echo "asset-$sha" > "$dir/dist/index.html"
    printf '{"name":"portal","sha":"%s","npmFails": %s}\n' "$sha" "$npmfails" > "$dir/package.json"
    printf '{"lockfileVersion":3,"sha":"%s"}\n' "$sha" > "$dir/package-lock.json"
    cp "$REPO/shell_scripts"/*.sh "$dir/shell_scripts/"
    find "$dir" -exec touch -d "2026-08-27 12:00:$(printf '%02d' $((RELEASE_SEQ % 60)))" {} +
}

install_as_current() {   # <release-dir> — put a release on disk as the live one
    rm -rf "${DEPLOY_DIR:?}/dist"
    cp -r "$1/dist" "$DEPLOY_DIR/dist"
    cp "$1/package.json" "$1/package-lock.json" "$DEPLOY_DIR/"
}

start_env() {
    STATE="$WORK/state"; rm -rf "$STATE"; mkdir -p "$STATE"
    DEPLOY_DIR="$WORK/deploy"; rm -rf "$DEPLOY_DIR"; mkdir -p "$DEPLOY_DIR"
    STUB_LOG="$STATE/stub.log"; : > "$STUB_LOG"
    echo "APP_URL=http://example.invalid" > "$DEPLOY_DIR/.env"
    export STATE DEPLOY_DIR STUB_LOG
    export PATH="$WORK/bin:$PATH"
    python3 "$WORK/healthd.py" "$STATE" & HEALTHD=$!
    local _
    for _ in $(seq 1 50); do [[ -s "$STATE/port" ]] && break; sleep 0.1; done
    HEALTH_URL="http://127.0.0.1:$(cat "$STATE/port")/api/health"
    export HEALTH_URL
    export HEALTH_ATTEMPTS=2
    export DEPLOY_SERVICE=portal-rehearsal
}

stop_env() {
    [[ -n "$HEALTHD" ]] && kill "$HEALTHD" 2>/dev/null
    wait "$HEALTHD" 2>/dev/null
    HEALTHD=""
}

sha_in_dist() { grep -o 'sha=[a-z0-9]*' "$DEPLOY_DIR/dist/server.cjs" 2>/dev/null | head -1; }
sha_in_pkg()  { grep -o '"sha":"[a-z0-9]*"' "$DEPLOY_DIR/package.json" 2>/dev/null | head -1; }
said()        { grep -q "$1" <<<"$OUT" && echo yes || echo no; }
health_sha()  { curl -sf "$HEALTH_URL" 2>/dev/null | sed 's/.*"sha":"\([a-z0-9]*\)".*/\1/'; }
exists()      { [[ -e "$1" ]] && echo present || echo absent; }

check() {   # <label> <expected> <actual>
    if [[ "$2" == "$3" ]]; then
        printf '    ok   %-42s %s\n' "$1" "$3"
        PASS=$((PASS + 1))
    else
        printf '    FAIL %-42s expected [%s] got [%s]\n' "$1" "$2" "$3"
        FAIL=$((FAIL + 1))
    fi
}

deploy_release() {   # <release-dir> — run the shipped 07, capture output and code
    OUT="$(bash "$1/shell_scripts/07_install_release.sh" "$1" 2>&1)"
    RC=$?
}

# =========================================================================
# The table. Each case names what must hold; the value is in the refusals,
# not in the happy path.
# =========================================================================

# -------------------------------------------------------------------------
# 1. THE FLIP-BACK ITSELF FAILS — written first, deliberately. A flip-back
#    that fails quietly is worse than no flip-back: the pipeline would go
#    green-ish, the site would be down, and nothing would say so.
# -------------------------------------------------------------------------
echo "1  unhealthy release, retained previous is ALSO broken   -> exit 3, says so"
start_env
make_release "$WORK/old" BAD aaaa1111
install_as_current "$WORK/old"
make_release "$WORK/new" BAD bbbb2222
deploy_release "$WORK/new"
check "exit code" 3 "$RC"
check "announces CRITICAL" yes "$(said CRITICAL)"
check "says the service is down" yes "$(said 'is DOWN and needs a person')"
check "did attempt the flip-back" yes "$(said 'Flipping back')"
stop_env

echo "1b the flip-back's own npm ci fails                      -> exit 3, says so"
start_env
make_release "$WORK/old" GOOD aaaa1111 true
install_as_current "$WORK/old"
make_release "$WORK/new" BAD bbbb2222
deploy_release "$WORK/new"
check "exit code" 3 "$RC"
check "announces CRITICAL" yes "$(said CRITICAL)"
stop_env

# -------------------------------------------------------------------------
# 2. HEALTHY — the dangerous thing must not happen. Asserting the flip-back
#    was *not* attempted is the point; a rollback that fires on a good
#    release would undo every deploy.
# -------------------------------------------------------------------------
echo "2  healthy release                                       -> exit 0, no flip-back"
start_env
make_release "$WORK/old" GOOD aaaa1111
install_as_current "$WORK/old"
make_release "$WORK/new" GOOD bbbb2222
deploy_release "$WORK/new"
check "exit code" 0 "$RC"
check "dist is the new release" "sha=bbbb2222" "$(sha_in_dist)"
check "package.json is the new release" '"sha":"bbbb2222"' "$(sha_in_pkg)"
check "health reports the new sha" bbbb2222 "$(health_sha)"
check "no flip-back attempted" no "$(said 'Flipping back')"
check "previous release retained" "sha=aaaa1111" \
      "$(grep -o 'sha=[a-z0-9]*' "$DEPLOY_DIR/previous/dist/server.cjs" | head -1)"
check "staging dir cleaned up" absent "$(exists "$DEPLOY_DIR/previous.incoming")"
stop_env

# -------------------------------------------------------------------------
# 3. THE HEADLINE CASE — unhealthy release, good previous.
# -------------------------------------------------------------------------
echo "3  unhealthy release, good previous                      -> exit 2, previous serving"
start_env
make_release "$WORK/old" GOOD aaaa1111
install_as_current "$WORK/old"
make_release "$WORK/new" BAD bbbb2222
deploy_release "$WORK/new"
check "exit code" 2 "$RC"
check "dist restored to previous" "sha=aaaa1111" "$(sha_in_dist)"
check "package.json restored too" '"sha":"aaaa1111"' "$(sha_in_pkg)"
check "health reports the PREVIOUS sha" aaaa1111 "$(health_sha)"
check "announces the rollback" yes "$(said 'ROLLED BACK')"
stop_env

# -------------------------------------------------------------------------
# 4. FIRST-EVER DEPLOY — nothing to retain. Must behave exactly as before
#    this change: report and stop, without inventing a rollback target.
# -------------------------------------------------------------------------
echo "4  unhealthy release, no previous (first deploy)         -> exit 1, unchanged behaviour"
start_env
make_release "$WORK/new" BAD bbbb2222
deploy_release "$WORK/new"
check "exit code" 1 "$RC"
check "said it had nothing to retain" yes "$(said 'no flip-back target')"
check "no flip-back attempted" no "$(said 'Flipping back')"
check "no previous/ invented" absent "$(exists "$DEPLOY_DIR/previous")"
stop_env

# -------------------------------------------------------------------------
# 5. AN INCOMPLETE RETAINED RELEASE must be refused rather than used. Half a
#    release passing the check is how a recoverable bad deploy becomes an
#    unrecoverable one.
# -------------------------------------------------------------------------
echo "5  retained release is incomplete                        -> exit 1, refuses to use it"
start_env
make_release "$WORK/new" BAD bbbb2222
install_as_current "$WORK/new"
mkdir -p "$DEPLOY_DIR/previous/dist"
echo "// MARKER=GOOD sha=aaaa1111" > "$DEPLOY_DIR/previous/dist/server.cjs"   # no package.json
OUT="$(ROLLBACK_FROM="$DEPLOY_DIR/previous" bash "$REPO/shell_scripts/06_redeploy.sh" 2>&1)"; RC=$?
check "exit code" 1 "$RC"
check "refuses explicitly" yes "$(said 'does not hold a complete release')"
check "did not flip back" no "$(said 'Flipping back')"
stop_env

# -------------------------------------------------------------------------
# 6. A STANDALONE 06 RUN — an operator redeploying after an .env change must
#    never have the build swapped underneath them, even though previous/ is
#    sitting right there. ROLLBACK_FROM is the opt-in, and 07 is what sets it.
# -------------------------------------------------------------------------
echo "6  standalone 06, previous/ on disk but not offered      -> exit 1, dist untouched"
start_env
make_release "$WORK/new" BAD bbbb2222
install_as_current "$WORK/new"
make_release "$WORK/old" GOOD aaaa1111
mkdir -p "$DEPLOY_DIR/previous"
cp -r "$WORK/old/dist" "$DEPLOY_DIR/previous/dist"
cp "$WORK/old/package.json" "$WORK/old/package-lock.json" "$DEPLOY_DIR/previous/"
OUT="$(bash "$REPO/shell_scripts/06_redeploy.sh" 2>&1)"; RC=$?
check "exit code" 1 "$RC"
check "dist untouched" "sha=bbbb2222" "$(sha_in_dist)"
check "no flip-back attempted" no "$(said 'Flipping back')"
stop_env

# -------------------------------------------------------------------------
# 7. THE FORWARD PATH FAILS BEFORE ANY RESTART — `npm ci` refuses the new
#    release. The bad payload is already on disk, so this must flip back too:
#    a failure earlier than the health check is still a failed release.
# -------------------------------------------------------------------------
echo "7  new release's npm ci fails, before any restart        -> exit 2, previous serving"
start_env
make_release "$WORK/old" GOOD aaaa1111
install_as_current "$WORK/old"
make_release "$WORK/new" GOOD bbbb2222 true
deploy_release "$WORK/new"
check "exit code" 2 "$RC"
check "dist restored to previous" "sha=aaaa1111" "$(sha_in_dist)"
check "health reports the PREVIOUS sha" aaaa1111 "$(health_sha)"
stop_env

echo ""
if [[ "$FAIL" -eq 0 ]]; then
    echo "All $PASS assertions held across 8 branches."
else
    echo "$PASS passed, $FAIL FAILED."
fi
[[ "$FAIL" -eq 0 ]]
