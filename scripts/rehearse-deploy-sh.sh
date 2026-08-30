#!/bin/bash
#
# rehearse-deploy-sh.sh
# ---------------------
# Purpose:      Drive scripts/deploy.sh — the workstation deploy path — against
#               stubs, so the branch that matters can be exercised without an EC2
#               host, an SSH key or a real outage.
#
#               This is the only behavioural coverage deploy.sh has. `npm run
#               lint` is TypeScript and cannot see shell; CI shellchecks it,
#               which proves it parses and nothing about what it does. That gap
#               is why the script spent months rsyncing `--delete` over the
#               running build and nobody noticed: reading it, the destruction is
#               one flag on line 108.
#
# Usage:        ./scripts/rehearse-deploy-sh.sh
#
# What is real and what is stubbed:
#   REAL     deploy.sh itself, shell_scripts/07 and 06, rsync, curl, the health
#            endpoint (a python3 HTTP server), and the filesystem moves.
#   STUBBED  ssh (runs the command locally, the way a real ssh runs it through
#            the login shell), systemctl, sudo, npm, journalctl.
#
#   So the transport is faked and the logic is not. What this cannot prove is
#   anything about a real SSH connection, a real systemd unit or a real npm.
#
# Exit codes:
#   0  Every assertion held.
#   1  At least one did not.

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
PASS=0
FAIL=0
HEALTHD=""
RELEASE_SEQ=0

# ------------------------------------------------------------------ stubs
mkdir -p "$WORK/bin"

# A real ssh runs the remote command through the login shell, which is why one
# stub serves both deploy.sh's own `ssh host 'mktemp -d …'` and the `ssh host
# rsync --server …` that rsync itself invokes. Joining the arguments and handing
# them to `bash -c` is exactly that behaviour; exec'ing them as argv would break
# the first and quietly pass the second.
cat > "$WORK/bin/ssh" <<'EOF'
#!/bin/bash
while [[ "${1:-}" == -* ]]; do
    case "$1" in
        -i|-o|-p|-l|-F) shift 2 ;;
        *) shift ;;
    esac
done
shift            # the user@host, which is fiction here
exec bash -c "$*"
EOF

cat > "$WORK/bin/systemctl" <<'EOF'
#!/bin/bash
echo "systemctl $*" >> "$STUB_LOG"
if [[ "${1:-}" == list-unit-files ]]; then
    [[ -f "$STATE/no-unit" ]] && exit 1
    echo "${DEPLOY_SERVICE:-portal-brasileirao}.service enabled enabled"
    exit 0
fi
if [[ "${1:-}" == restart ]]; then
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
            body = ('{"status":"ok","sha":"%s"}' % sha).encode()
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
# A "workstation checkout": the shipped deploy.sh, copied rather than retyped,
# beside a payload it can send. deploy.sh resolves PROJECT_ROOT from its own
# location, so this is what it will `cd` into and rsync from.
make_checkout() {   # <GOOD|BAD> <sha>
    local marker="$1" sha="$2" pad
    rm -rf "$SRC"
    mkdir -p "$SRC/scripts" "$SRC/dist" "$SRC/shell_scripts"
    cp "$REPO/scripts/deploy.sh" "$SRC/scripts/"
    cp "$REPO/shell_scripts"/*.sh "$SRC/shell_scripts/"
    # Differ in size and mtime: `rsync -a`'s quick-check compares those rather
    # than bytes, so same-size fixtures written in one second are silently
    # skipped and the install reads as a no-op. The flip-back rehearsal records
    # the same trap.
    RELEASE_SEQ=$((RELEASE_SEQ + 1))
    pad="$(head -c "$((RELEASE_SEQ * 37 + 64))" /dev/zero | tr '\0' 'x')"
    printf '// MARKER=%s sha=%s\n%s\n' "$marker" "$sha" "$pad" > "$SRC/dist/server.cjs"
    echo "asset-$sha" > "$SRC/dist/index.html"
    printf '{"name":"portal","sha":"%s"}\n' "$sha" > "$SRC/package.json"
    printf '{"lockfileVersion":3,"sha":"%s"}\n' "$sha" > "$SRC/package-lock.json"
    find "$SRC" -exec touch -d "2026-08-30 12:00:$(printf '%02d' $((RELEASE_SEQ % 60)))" {} +
    chmod +x "$SRC/scripts/deploy.sh" "$SRC"/shell_scripts/*.sh
}

install_as_current() {   # <GOOD|BAD> <sha> — a release already live on the host
    local marker="$1" sha="$2"
    rm -rf "${DEPLOY_DIR:?}/dist"
    mkdir -p "$DEPLOY_DIR/dist"
    printf '// MARKER=%s sha=%s\n' "$marker" "$sha" > "$DEPLOY_DIR/dist/server.cjs"
    printf '{"name":"portal","sha":"%s"}\n' "$sha" > "$DEPLOY_DIR/package.json"
    printf '{"lockfileVersion":3,"sha":"%s"}\n' "$sha" > "$DEPLOY_DIR/package-lock.json"
    echo "$marker sha=$sha" > "$STATE/running"
}

start_env() {
    STATE="$WORK/state"; rm -rf "$STATE"; mkdir -p "$STATE"
    DEPLOY_DIR="$WORK/deploy"; rm -rf "$DEPLOY_DIR"; mkdir -p "$DEPLOY_DIR"
    SRC="$WORK/checkout"
    STUB_LOG="$STATE/stub.log"; : > "$STUB_LOG"
    echo "APP_URL=http://example.invalid" > "$DEPLOY_DIR/.env"
    export STATE DEPLOY_DIR STUB_LOG
    export PATH="$WORK/bin:$PATH"
    python3 "$WORK/healthd.py" "$STATE" & HEALTHD=$!
    local _
    for _ in $(seq 1 50); do [[ -s "$STATE/port" ]] && break; sleep 0.1; done
    HEALTH_URL="http://127.0.0.1:$(cat "$STATE/port")/api/health"
    export HEALTH_URL
    export DEPLOY_SERVICE=portal-rehearsal
    export DEPLOY_HOST=ubuntu@rehearsal.invalid
    # 06_redeploy.sh polls 30 times by default, which would make the two
    # unhealthy cases take a minute. It reaches 06 through the environment the
    # ssh stub inherits, which a real ssh would NOT forward — so this shortens
    # the rehearsal and says nothing about production, where the poll stays 30.
    export HEALTH_ATTEMPTS=2
}

stop_env() {
    [[ -n "$HEALTHD" ]] && kill "$HEALTHD" 2>/dev/null
    wait "$HEALTHD" 2>/dev/null
    HEALTHD=""
}

sha_in_dist() { grep -o 'sha=[a-z0-9]*' "$DEPLOY_DIR/dist/server.cjs" 2>/dev/null | head -1; }
health_sha()  { curl -sf "$HEALTH_URL" 2>/dev/null | sed 's/.*"sha":"\([a-z0-9]*\)".*/\1/'; }
said()        { grep -q "$1" <<<"$OUT" && echo yes || echo no; }
exists()      { [[ -e "$1" ]] && echo present || echo absent; }
staging_dir() { grep -o '/tmp/release-[A-Za-z0-9]*' <<<"$OUT" | head -1; }
# "the staging directory is gone" is satisfied by never having made one, which is
# how the OLD deploy.sh passed that assertion — a test green against the absence of
# the thing it tests. Assert the directory was NAMED before asserting it is gone.
staged()      { [[ -n "$(staging_dir)" ]] && echo yes || echo no; }

check() {   # <label> <expected> <actual>
    if [[ "$2" == "$3" ]]; then
        printf '    ok   %-42s %s\n' "$1" "$3"
        PASS=$((PASS + 1))
    else
        printf '    FAIL %-42s expected [%s] got [%s]\n' "$1" "$2" "$3"
        FAIL=$((FAIL + 1))
    fi
}

deploy() {   # [args…] — run the shipped deploy.sh, capture output and code
    OUT="$(cd "$SRC" && ./scripts/deploy.sh "$@" 2>&1)"
    RC=$?
}

# =========================================================================
# The table. Every case asserts what the host looks like afterwards, because
# that is the only thing an operator cares about at 3am.
# =========================================================================

# -------------------------------------------------------------------------
# 1. THE DRY RUN MUST CHANGE NOTHING. Written first: it is the one mode a
#    person reaches for precisely because they are unsure, and a dry run with
#    a side effect is worse than no dry run.
# -------------------------------------------------------------------------
echo "1  --dry-run                                             -> exit 0, host untouched"
start_env
install_as_current GOOD aaaa1111
make_checkout GOOD bbbb2222
deploy --skip-preflight --dry-run
check "exit code" 0 "$RC"
check "says it is a dry run" yes "$(said 'DRY RUN')"
check "dist untouched" "sha=aaaa1111" "$(sha_in_dist)"
check "no previous/ created" absent "$(exists "$DEPLOY_DIR/previous")"
check "never staged anything" "" "$(staging_dir)"
check "never restarted the service" no "$(grep -q 'systemctl restart' "$STUB_LOG" && echo yes || echo no)"
stop_env

# -------------------------------------------------------------------------
# 2. THE HAPPY PATH — and the assertion that the roadmap item was written
#    for: previous/ exists afterwards. Before this change deploy.sh rsynced
#    --delete straight into dist/ and there was nothing to retain.
# -------------------------------------------------------------------------
echo "2  healthy release                                       -> exit 0, previous retained"
start_env
install_as_current GOOD aaaa1111
make_checkout GOOD bbbb2222
deploy --skip-preflight
check "exit code" 0 "$RC"
check "dist holds the new release" "sha=bbbb2222" "$(sha_in_dist)"
check "health reports the new sha" bbbb2222 "$(health_sha)"
check "the OLD release was retained" "sha=aaaa1111" "$(grep -o 'sha=[a-z0-9]*' "$DEPLOY_DIR/previous/dist/server.cjs" | head -1)"
check "retained its package.json too" present "$(exists "$DEPLOY_DIR/previous/package.json")"
check "shipped the scripts with it" present "$(exists "$DEPLOY_DIR/shell_scripts/06_redeploy.sh")"
check "a staging directory was used" yes "$(staged)"
check "staging cleaned up" absent "$(exists "$(staging_dir)")"
stop_env

# -------------------------------------------------------------------------
# 3. AN UNHEALTHY RELEASE — the whole point of the change. The workstation
#    path must now leave the PREVIOUS build serving rather than a dead one.
# -------------------------------------------------------------------------
echo "3  unhealthy release, previous on disk                   -> exit 2, previous serving"
start_env
install_as_current GOOD aaaa1111
make_checkout BAD bbbb2222
deploy --skip-preflight
check "exit code" 2 "$RC"
check "dist restored to the previous" "sha=aaaa1111" "$(sha_in_dist)"
check "health reports the PREVIOUS sha" aaaa1111 "$(health_sha)"
check "says it rolled back" yes "$(said 'ROLLED BACK')"
check "does not claim it deployed" no "$(said 'Deployed to')"
check "a staging directory was used" yes "$(staged)"
check "staging cleaned up even on failure" absent "$(exists "$(staging_dir)")"
stop_env

# -------------------------------------------------------------------------
# 4. FIRST-EVER DEPLOY, NO SERVICE UNIT. deploy.sh used to answer this
#    inline and exit 0; it now comes from 07 as a 4, so the exit code stops
#    contradicting the script's own documented meaning of 0.
# -------------------------------------------------------------------------
echo "4  host has no service unit                              -> exit 4, names 03"
start_env
touch "$STATE/no-unit"
make_checkout GOOD bbbb2222
deploy --skip-preflight
check "exit code" 4 "$RC"
check "payload was delivered anyway" "sha=bbbb2222" "$(sha_in_dist)"
check "names the script to run next" yes "$(said '03_install_systemd_service.sh')"
check "never restarted the service" no "$(grep -q 'systemctl restart' "$STUB_LOG" && echo yes || echo no)"
stop_env

# -------------------------------------------------------------------------
# 5. A MISSING PAYLOAD must be refused locally, before anything is sent.
# -------------------------------------------------------------------------
echo "5  --skip-preflight with no dist/server.cjs              -> exit 1, nothing sent"
start_env
install_as_current GOOD aaaa1111
make_checkout GOOD bbbb2222
rm -f "$SRC/dist/server.cjs"
deploy --skip-preflight
check "exit code" 1 "$RC"
check "dist untouched" "sha=aaaa1111" "$(sha_in_dist)"
check "never staged anything" "" "$(staging_dir)"
stop_env

echo ""
if [[ "$FAIL" -eq 0 ]]; then
    echo "All $PASS assertions held across 5 branches."
else
    echo "$PASS passed, $FAIL FAILED."
    exit 1
fi
