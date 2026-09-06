#!/usr/bin/env bash
#
# rehearse-traffic-report.sh — behavioural coverage for
# shell_scripts/12_traffic_report.sh, which nothing else exercises.
#
# `npm run lint` is TypeScript and cannot see shell; CI shellchecks the script,
# which proves it parses and not that it reads a log correctly. This runs the
# real script against real fixture logs and asserts what it writes.
#
# **It is hermetic**: bash, coreutils, awk, gzip. No network, no nginx, no host,
# no GeoLite2 — the geo branch is exercised only in its absent form, which is
# what a host without mmdblookup does and what CI is.
#
# **Run it from a plain clone as well as from a worktree before believing it.**
# `rehearse-sync-schedule.sh` was green for fifty minutes on `main` while red in
# CI, because it read its subject's environment instead of constructing one.
# This script takes the log path and output directory as arguments, so it has no
# such environment to inherit — but that is a property to check, not to assume.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT="$SCRIPT_DIR/../shell_scripts/12_traffic_report.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

ok=0
bad=0

check() {
    local label="$1" expected="$2" actual="$3"
    if [[ "$actual" == "$expected" ]]; then
        echo "ok   — $label"
        ok=$((ok + 1))
    else
        echo "NOT OK — $label"
        echo "         expected: $expected"
        echo "         actual:   $actual"
        bad=$((bad + 1))
    fi
}

contains() {
    local label="$1" needle="$2" file="$3"
    if grep -qF "$needle" "$file"; then
        echo "ok   — $label"
        ok=$((ok + 1))
    else
        echo "NOT OK — $label (missing: $needle)"
        bad=$((bad + 1))
    fi
}

# The origin the visitor rule anchors on. Passed to the script explicitly so the
# rehearsal does not depend on the production default.
ORIGIN="https://brasileirao.mpbarbosa.com"

line() {
    # ip, timestamp, path, status
    echo "203.0.113.$1 - - [$2 +0000] \"GET $3 HTTP/1.1\" $4 100 \"$5\" \"$6\""
}

# ── Fixture: rotations whose GLOB order is not chronological ──────────────────
#
# This is the shape a real host has, and it is what made the first live snapshot
# report a range running backwards. logrotate numbers ascending as files age, so
# the shell's lexical glob yields: a.log, .1, .10.gz, .11.gz, .2.gz — the live
# log (newest) first and the oldest file in the middle.
LOG="$WORK/access.log"
{
    line 1 "04/Sep/2026:00:07:19" "/" 200 "-" "Mozilla/5.0"
    line 1 "03/Sep/2026:12:00:00" "/jogos" 200 "https://exemplo.com/a b" "Mozilla/5.0"
} > "$LOG"
line 2 "02/Sep/2026:08:00:00" "/api/health" 200 "-" "curl/8" > "$LOG.1"
line 3 "26/Aug/2026:23:41:49" "/api/health" 200 "-" "curl/8" | gzip > "$LOG.10.gz"
line 4 "25/Aug/2026:01:02:03" "/clube/palmeiras" 404 "-" "Googlebot/2.1" | gzip > "$LOG.11.gz"
line 5 "31/Aug/2026:09:00:00" "/api/health" 200 "-" "curl/8" | gzip > "$LOG.2.gz"
# Probe traffic really is in this log, and it shifts every awk field.
printf '203.0.113.9 - - [BOGUS] "GET /x" 200\n' >> "$LOG"

OUT="$WORK/reports"
DEPLOY_DIR="$WORK" DISABLE_GEO=true bash "$REPORT" "$LOG" "$OUT" > "$WORK/stdout.txt" 2>&1
check "the script exits 0 on a well-formed log" "0" "$?"

SUMMARY="$(find "$OUT" -name 'summary-*.txt' | head -1)"
if [[ -z "$SUMMARY" ]]; then
    echo "NOT OK — no summary was written; nothing further can be checked"
    exit 1
fi
echo "ok   — a summary file is written"
ok=$((ok + 1))

field() { sed -n "s/^$1:[[:space:]]*//p" "$SUMMARY" | head -1; }

# ── The regression this file exists for ──────────────────────────────────────
#
# The oldest stamp is in .11.gz and the newest is the live log's first line, so
# any implementation reading line 1 and the last line reports them backwards.
check "the date range runs oldest -> newest across unordered rotations" \
    "25/Aug/2026:01:02:03  ->  04/Sep/2026:00:07:19" \
    "$(field 'Date range')"

# Seven lines: six well-formed plus the probe. A malformed line is still a
# request that reached the server, so it is counted — only the timestamp scan
# skips it.
# A count, not just an exit code. The truncation this file was written after
# ended the report FOUR sections into twelve and still wrote a file — so "it exited 0"
# and "a summary exists" both pass against it, and only counting the headings
# says the report finished.
check "the summary carries every section" "12" "$(grep -c '^== ' "$SUMMARY")"

check "every line is counted, malformed ones included" "7" "$(field 'Requests')"
check "unique addresses are counted, not requests" "6" "$(field 'Unique IPs')"

# ── Sections that must survive a bare host ───────────────────────────────────
contains "the geo section degrades to a note rather than vanishing" \
    "No GeoLite2 database" "$SUMMARY"
contains "monitoring hits are counted and reported" "Monitor hits:   3 of 7" "$SUMMARY"
contains "bot-ish hits are counted" "Bot-ish hits:   1 of 7" "$SUMMARY"

# The referrer is quoted and contains a space; a field index truncates it at the
# space, so this is what proves the regex form is still in place.
contains "a referrer with a space in it survives whole" \
    'https://exemplo.com/a b' "$SUMMARY"

# The path is $7 under stock `combined`; under the sibling's `agora_timed` it is
# $6 and this assertion reports `"GET` instead.
contains "the path field is read at the combined-format offset" \
    "/clube/palmeiras" "$SUMMARY"
contains "the status field is read at the combined-format offset" "404" "$SUMMARY"

# ── An empty log is a real state, not a crash ────────────────────────────────
: > "$WORK/empty.log"
DEPLOY_DIR="$WORK" DISABLE_GEO=true bash "$REPORT" "$WORK/empty.log" "$WORK/empty-out" \
    > "$WORK/empty-stdout.txt" 2>&1
check "an empty log exits 0 rather than failing" "0" "$?"
EMPTY_SUMMARY="$(find "$WORK/empty-out" -name 'summary-*.txt' | head -1)"
if [[ -n "$EMPTY_SUMMARY" ]]; then
    check "an empty log reports zero requests" "0" \
        "$(sed -n 's/^Requests:[[:space:]]*//p' "$EMPTY_SUMMARY" | head -1)"
    contains "an empty log says so rather than printing a bogus range" \
        "no parseable timestamps" "$EMPTY_SUMMARY"
    # The regression itself: grep exits 1 on an empty log, pipefail propagates
    # it, set -e kills the brace group, and the report stopped at four of ten.
    check "an empty log still produces a COMPLETE summary" "12" \
        "$(grep -c '^== ' "$EMPTY_SUMMARY")"
else
    echo "NOT OK — an empty log wrote no summary at all"
    bad=$((bad + 1))
fi

# ── Visitors: browser-caused traffic, on a log built to separate the cases ───
#
# Its own log rather than lines added to the one above, so the existing counts
# ("Monitor hits: 3 of 7") keep meaning what they say.
#
# The rule is a Referer naming OUR origin, minus anything self-declaring as a
# crawler, and each line below is one case that rule has to get right. Three of
# them were found in the host's real log rather than imagined.
VLOG="$WORK/visitors.log"
{
    # A visit: the document carries no Referer, its sub-resources carry ours.
    line 1 "04/Sep/2026:10:00:00" "/" 200 "-" "Mozilla/5.0 Chrome/131"
    line 1 "04/Sep/2026:10:00:01" "/assets/index.css" 200 "$ORIGIN/" "Mozilla/5.0 Chrome/131"
    line 1 "04/Sep/2026:10:00:01" "/api/standings" 200 "$ORIGIN/" "Mozilla/5.0 Chrome/131"
    # The Rodapé's own health fetch — a READER, and what #375 subtracted.
    line 1 "04/Sep/2026:10:00:02" "/api/health" 200 "$ORIGIN/" "Mozilla/5.0 Chrome/131"
    # A rendering crawler sends our Referer exactly as a browser does. The UA is
    # allowed to disqualify it; 70 such lines were in the day measured.
    line 2 "04/Sep/2026:10:05:00" "/assets/index.css" 200 "$ORIGIN/jogos" "Googlebot/2.1"
    # A scanner: no Referer at all, which is 631 of the 02:00Z sweep's 643.
    line 3 "04/Sep/2026:10:06:00" "/wp-config.php.bak" 404 "-" "Mozilla/5.0 Chrome/131"
    # And the 12 that DID carry one — this host's raw IP, not its name. What
    # this case refuses is the rule "has any Referer at all".
    line 3 "04/Sep/2026:10:06:01" "/@fs/proc/self/environ" 404 "https://54.232.242.45:443" "Mozilla/5.0 Chrome/131"
    # Our origin appearing INSIDE somebody else's URL. This is what the `index(
    # $4, o) == 1` anchor is for, and the raw-IP line above does not test it:
    # an unanchored substring match counts this one, a prefix match does not.
    line 5 "04/Sep/2026:10:06:02" "/" 200 "https://exemplo.com/?u=$ORIGIN/jogos" "Mozilla/5.0 Chrome/131"
    # A foreign referer: arriving from a search engine is a real visit, but the
    # request itself is not evidence a browser on THIS site made it.
    line 4 "04/Sep/2026:10:07:00" "/" 200 "https://www.google.com/" "Mozilla/5.0 Chrome/131"
} > "$VLOG"

DEPLOY_DIR="$WORK" DISABLE_GEO=true SITE_ORIGIN="$ORIGIN" \
    bash "$REPORT" "$VLOG" "$WORK/v-out" > "$WORK/v-stdout.txt" 2>&1
VSUMMARY="$(find "$WORK/v-out" -name 'summary-*.txt' | head -1)"
if [[ -n "$VSUMMARY" ]]; then
    # Three of the nine: the css, the standings call and the Rodapé's health
    # fetch. Not the document, not Googlebot, not either scanner line, not the
    # one arriving from Google, and not the one with our origin in a query
    # string.
    contains "only browser-caused requests count as visitors" \
        "Visitor hits:   3 of 9" "$VSUMMARY"
    # One crawler in this log. The case for reading the UA field rather than the
    # whole line is the next log, which has no crawler in it at all.
    contains "the bot share counts the crawler" "Bot-ish hits:   1 of 9" "$VSUMMARY"
else
    echo "NOT OK — the visitor log wrote no summary"
    bad=$((bad + 1))
fi

# ── The bot rule reads the USER-AGENT field, not the whole line ──────────────
#
# The rule was `grep -aiE` over the raw line, so it also matched the PATH. Found
# in the real log: 62 hits on /robots.txt, a Vite asset whose content hash was
# `index-ChBoTmtl.css`, and a reader opening `/clube/botafogo` — a club in this
# division is named Botafogo, so a content page was filed as a crawler. The hash
# case is the sharpest: it is random, so the error changed on every build.
BLOG="$WORK/bot-words.log"
{
    line 1 "04/Sep/2026:11:00:00" "/clube/botafogo" 200 "-" "Mozilla/5.0 Chrome/131"
    line 1 "04/Sep/2026:11:00:01" "/assets/index-ChBoTmtl.css" 200 "-" "Mozilla/5.0 Chrome/131"
    line 2 "04/Sep/2026:11:00:02" "/robots.txt" 200 "-" "Mozilla/5.0 Chrome/131"
} > "$BLOG"
DEPLOY_DIR="$WORK" DISABLE_GEO=true bash "$REPORT" "$BLOG" "$WORK/b-out" \
    > "$WORK/b-stdout.txt" 2>&1
BSUMMARY="$(find "$WORK/b-out" -name 'summary-*.txt' | head -1)"
if [[ -n "$BSUMMARY" ]]; then
    # Zero. The whole-line rule answers 3 — every one of them.
    contains "a path containing a bot word is not a bot hit" \
        "Bot-ish hits:   0 of 3" "$BSUMMARY"
else
    echo "NOT OK — the bot-words log wrote no summary"
    bad=$((bad + 1))
fi

# ── A missing log is an error, and a loud one ────────────────────────────────
DEPLOY_DIR="$WORK" bash "$REPORT" "$WORK/nope.log" "$WORK/nope-out" \
    > "$WORK/missing.txt" 2>&1
check "a missing log exits 1" "1" "$?"
contains "and says which path it looked at" "$WORK/nope.log" "$WORK/missing.txt"

echo
echo "$ok ok / $bad not ok"
[[ "$bad" -eq 0 ]]
