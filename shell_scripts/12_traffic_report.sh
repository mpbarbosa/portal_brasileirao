#!/bin/bash
#
# 12_traffic_report.sh
# --------------------
# Purpose:      Summarise nginx's access log into one text snapshot, so the
#               Tráfego page and the local dashboard have something to read.
#               Runs ON THE HOST, where the log is.
#
# Usage:        ./shell_scripts/12_traffic_report.sh [ACCESS_LOG] [OUT_DIR]
#
# Prerequisites: coreutils and awk, both of which are on every Ubuntu image.
#                Optionally mmdblookup + a GeoLite2 database, for the geo
#                sections; without them every other section still works.
#
# Environment variables:
#   DEPLOY_DIR  Where the app runs from. Default: /var/www/portal_brasileirao.
#               Only used to place OUT_DIR when one is not given.
#   GEO_DB      A GeoLite2 .mmdb to resolve countries with. Default: probed.
#   DISABLE_GEO Set to "true" to skip geolocation entirely. Every other
#               section still works; the geo ones print a note.
#   TOP_N       Rows per ranked section. Default: 20.
#
# Exit codes:
#   0  Snapshot written.
#   1  The access log could not be found or read.
#
# ── Why this lives in shell_scripts/ and not in scripts/ ──────────────────────
#
# Because it has to reach the host, and `scripts/` does not. CI packages
# `dist package.json package-lock.json shell_scripts` and nothing else, so a
# report script under `scripts/` would be a script the host has never seen. The
# sibling this was ported from (`agora_na_copa_2026`) keeps its copy in
# `scripts/` and gets away with it because its host carries a git checkout and
# the scheduled wrapper runs `git pull` before every report. This host carries a
# deploy directory, so the release tarball is the delivery path — which is also
# better: the report script always matches the release that shipped it, the
# property `shell_scripts/` exists for.
#
# ── Where the snapshots go, and why exactly there ────────────────────────────
#
# `$DEPLOY_DIR/traffic-reports/`, which is inside DEPLOY_DIR and outside dist/ —
# the same two constraints `accounts.db` and `match-state.json` are placed by,
# and for the same two reasons. The systemd unit sets ProtectSystem=strict with
# ReadWritePaths=${DEPLOY_DIR}, so anywhere else is read-only to the app that
# reads these; and both rsyncs delete `dist/` with `--delete`, while
# express.static serves it over HTTP.
#
# Nothing commits them. The app reads this directory directly, so the host is
# the source of truth and there is no snapshot in git to go stale.
#
# ── THE LOG FORMAT, which is the one thing to check before editing an awk ─────
#
# 04_setup_nginx.sh writes no `log_format`, so nginx uses stock **combined**:
#
#   $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent
#     "$http_referer" "$http_user_agent"
#
# Space-tokenised, that is:
#   $1 ip   $2 -   $3 remote_user   $4 [dd/Mon/yyyy:HH:MM:SS   $5 +0000]
#   $6 "METHOD   $7 path   $8 HTTP/1.1"   $9 status   $10 bytes   $11 "referer…
#
# The sibling parses its own `agora_timed` format, which **drops $remote_user**,
# so every field index there is one lower than the index here. Porting its awks
# unchanged reads the timestamp as a user name, the status as a byte count and
# the path as a protocol — and none of that errors, it just produces a summary
# full of plausible nonsense. If this repo ever adds a `log_format`, this block
# is what has to change with it.
#
# The referrer is quoted and may contain spaces, so it is taken with a regex
# over the whole line rather than as $11 — `$11` alone truncates every referrer
# at its first space, which is most of the interesting ones.

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/var/www/portal_brasileirao}"
ACCESS_LOG="${1:-/var/log/nginx/portal-brasileirao.access.log}"
OUT_DIR="${2:-$DEPLOY_DIR/traffic-reports}"
TOP_N="${TOP_N:-20}"
STAMP="$(date +%Y%m%d-%H%M%S)"

# Read the live log plus its rotations together — `.1` plain and `.2.gz` onward —
# so a snapshot taken just after logrotate is not a report on twenty minutes of
# traffic. `zcat -f` passes uncompressed files through untouched. sudo only when
# the log is not directly readable, which it is not by default: /var/log/nginx
# is root-owned.
read_log() {
    if [[ -r "$ACCESS_LOG" ]]; then
        zcat -f "$ACCESS_LOG"*
    else
        sudo zcat -f "$ACCESS_LOG"*
    fi
}

if ! compgen -G "$ACCESS_LOG*" > /dev/null 2>&1 && ! sudo test -e "$ACCESS_LOG"; then
    echo "Error: no access log at $ACCESS_LOG (pass the path as the first argument)." >&2
    exit 1
fi

mkdir -p "$OUT_DIR"
TXT_OUT="$OUT_DIR/summary-$STAMP.txt"

# Buffer the log once. Every section below scans it, and re-running a possibly
# sudo-gated zcat a dozen times would re-prompt and re-decompress each time.
TMP_LOG="$(mktemp)"
GEO_MAP=""
trap 'rm -f "$TMP_LOG" "$GEO_MAP"' EXIT
read_log > "$TMP_LOG"

TOTAL="$(wc -l < "$TMP_LOG")"

# ── Resolve a GeoLite2 database, if the host has one ─────────────────────────
#
# Entirely local: mmdblookup reads a file on disk, so **no visitor address ever
# leaves this host**, which is the only reason geo is here at all. City is
# preferred over Country when both exist — a City database also answers the
# country question, so choosing it loses nothing and adds the city sections.
# DISABLE_GEO=true skips the lookup entirely — the kill-switch idiom
# DISABLE_FOOTBALL_DATA and DISABLE_WEATHER already use. Two callers want it: an
# operator on a large log, where one lookup per unique address is the slowest
# part of the run by far, and scripts/rehearse-traffic-report.sh, which
# otherwise gives a different answer on a machine that happens to carry a
# GeoLite2 database than on one that does not — the environment-inheriting
# failure rehearse-sync-schedule.sh was red on `main` for.
GEO_DB="${GEO_DB:-}"
GEO_HAS_CITY=0
if [[ "${DISABLE_GEO:-}" == "true" ]]; then
    GEO_DB=""
else
for candidate in "$GEO_DB" \
    /var/lib/GeoIP/GeoLite2-City.mmdb /var/lib/GeoIP/GeoLite2-Country.mmdb \
    /usr/share/GeoIP/GeoLite2-City.mmdb /usr/share/GeoIP/GeoLite2-Country.mmdb; do
    if [[ -n "$candidate" && -r "$candidate" ]]; then
        GEO_DB="$candidate"
        break
    fi
done
fi

# Ask the database what it is rather than reading its filename, so a GEO_DB
# pointing at a renamed City database is still detected as one. 8.8.8.8 is just
# a well-formed address to satisfy the required --ip; the Type line does not
# depend on it.
if [[ -n "$GEO_DB" ]] && command -v mmdblookup > /dev/null 2>&1; then
    if mmdblookup --file "$GEO_DB" --ip 8.8.8.8 --verbose 2> /dev/null \
        | grep -iE '^[[:space:]]*Type:' | grep -qi 'city'; then
        GEO_HAS_CITY=1
    fi
fi

# One lookup per UNIQUE address rather than per line, which is what keeps this
# affordable on a log with hundreds of thousands of lines and a few thousand
# addresses. Columns, tab-separated: ip <TAB> country <TAB> "City, Country".
#
# mmdblookup exits non-zero when a path is absent from an otherwise-present
# record, which is routine for `city` — many City records have no city node. On
# `set -e` that would abort the whole run, so both lookups tolerate it and fall
# through to (unknown).
if [[ -n "$GEO_DB" ]] && command -v mmdblookup > /dev/null 2>&1; then
    GEO_MAP="$(mktemp)"
    awk '{ print $1 }' "$TMP_LOG" | sort -u | while read -r ip; do
        country="$(mmdblookup --file "$GEO_DB" --ip "$ip" country names en 2> /dev/null \
            | awk -F'"' 'NF > 1 { print $2; exit }' || true)"
        city_label=""
        if [[ "$GEO_HAS_CITY" == 1 ]]; then
            city="$(mmdblookup --file "$GEO_DB" --ip "$ip" city names en 2> /dev/null \
                | awk -F'"' 'NF > 1 { print $2; exit }' || true)"
            # Qualified with the country so two same-named cities in different
            # countries do not collapse into one bucket.
            [[ -n "$city" ]] && city_label="$city, ${country:-?}"
        fi
        printf '%s\t%s\t%s\n' "$ip" "${country:-(unknown)}" "$city_label"
    done > "$GEO_MAP"
fi

# Every ranked section ends in `awk -v n="$TOP_N" 'NR <= n'` rather than
# `head -n`. `head` closes the pipe once it has its rows, the upstream `sort`
# then dies of EPIPE, and under `set -euo pipefail` that aborts the whole script
# after the first section — which in the sibling truncated every report on a
# large log to its first two sections, silently, for weeks. Draining the stream
# costs nothing here and cannot do that.
top() { awk -v n="$TOP_N" 'NR <= n'; }

{
    echo "Portal Brasileirão — traffic snapshot"
    echo "Generated: $(date --iso-8601=seconds)"
    echo "Source:    $ACCESS_LOG* ($TOTAL log lines)"
    echo

    echo "== Totals =="
    printf "Requests:       %s\n" "$TOTAL"
    printf "Unique IPs:     %s\n" "$(awk '{ print $1 }' "$TMP_LOG" | sort -u | wc -l)"
    # The oldest and newest stamps ANYWHERE in the window, scanned — deliberately
    # not the first and last lines of the file.
    #
    # `zcat -f "$ACCESS_LOG"*` concatenates in the shell's glob order, which is
    # lexical: access.log, .1, .10.gz, .11.gz, .2.gz, .3.gz … So the buffer is
    # neither chronological nor reverse-chronological, and taking line 1 and the
    # last line reported a range that ran BACKWARDS on the first real run —
    # `04/Sep/2026:00:07:19 -> 26/Aug/2026:23:41:49`, printed straight onto the
    # page. Sorting the glob would fix the endpoints and still leave the middle
    # interleaved, so the scan is the honest fix.
    #
    # The key is a sortable YYYYMMDD HH:MM:SS built from nginx's own
    # dd/Mon/yyyy:HH:MM:SS; the month name is looked up rather than parsed, and a
    # line whose month is not one of the twelve is skipped rather than sorted as
    # month zero. Malformed lines are real here — the log carries probe traffic
    # that shifts every field.
    awk '
        $4 ~ /^\[[0-9][0-9]\/[A-Za-z][a-z][a-z]\/[0-9][0-9][0-9][0-9]:/ {
            stamp = substr($4, 2)
            split(stamp, part, ":")
            split(part[1], ymd, "/")
            pos = index("JanFebMarAprMayJunJulAugSepOctNovDec", ymd[2])
            if (pos == 0) next
            key = sprintf("%s%02d%s %s:%s:%s", ymd[3], (pos + 2) / 3, ymd[1],
                          part[2], part[3], part[4])
            if (oldest == "" || key < oldest) { oldest = key; first = stamp }
            if (key > newest)                 { newest = key; last  = stamp }
        }
        END {
            if (first == "") print "Date range:     (no parseable timestamps)"
            else printf "Date range:     %s  ->  %s\n", first, last
        }
    ' "$TMP_LOG"
    echo

    # $7 is the path — see the field map at the top of this file.
    echo "== Top $TOP_N requested paths =="
    awk '{ print $7 }' "$TMP_LOG" | sort | uniq -c | sort -rn | top
    echo

    echo "== HTTP status codes =="
    awk '{ print $9 }' "$TMP_LOG" | sort | uniq -c | sort -rn
    echo

    # Taken by regex rather than as $11: the referrer is quoted and routinely
    # contains spaces, and a field index truncates it at the first one.
    echo "== Top $TOP_N referrers =="
    # `|| true` is load-bearing, and its absence truncated the report exactly as
    # `head` did: grep exits 1 when NOTHING matches, `pipefail` propagates that,
    # and `set -e` then kills the whole brace group mid-stream — so the summary
    # simply STOPPED after this section, with four of ten headings and exit 1.
    # An empty log does it (a freshly rotated one at midnight), and so does a log
    # holding only malformed probe lines. Same family as the `head` EPIPE trap
    # above: a routine non-match ending the run, silently, partway through.
    { grep -aoE '"[^"]*" "[^"]*"$' "$TMP_LOG" || true; } \
        | sed 's/" "[^"]*"$/"/' \
        | sort | uniq -c | sort -rn | top
    echo

    echo "== Top countries =="
    if [[ -n "$GEO_MAP" ]]; then
        echo "Geo source: $GEO_DB"
        echo "-- by unique visitor (top $TOP_N) --"
        cut -f2 "$GEO_MAP" | sort | uniq -c | sort -rn | top
        echo "-- by request volume (top $TOP_N) --"
        awk 'FNR == NR { split($0, a, "\t"); c[a[1]] = a[2]; next }
             { print ($1 in c ? c[$1] : "(unknown)") }' "$GEO_MAP" "$TMP_LOG" \
            | sort | uniq -c | sort -rn | top
    else
        echo "(No GeoLite2 database — install mmdb-bin and place GeoLite2-City.mmdb"
        echo " in /var/lib/GeoIP/, or set GEO_DB, then re-run. Every other section"
        echo " works without it.)"
    fi
    echo

    echo "== Top cities =="
    if [[ -n "$GEO_MAP" && "$GEO_HAS_CITY" == 1 ]]; then
        echo "Geo source: $GEO_DB"
        echo "Note: city geolocation is far less precise than country, especially for"
        echo "      mobile and CGNAT addresses — expect a large (unknown) bucket."
        echo "-- by unique visitor (top $TOP_N) --"
        cut -f3 "$GEO_MAP" | sed 's/^$/(unknown)/' | sort | uniq -c | sort -rn | top
        echo "-- by request volume (top $TOP_N) --"
        awk 'FNR == NR { split($0, a, "\t"); c[a[1]] = a[3]; next }
             { print (($1 in c) && c[$1] != "" ? c[$1] : "(unknown)") }' "$GEO_MAP" "$TMP_LOG" \
            | sort | uniq -c | sort -rn | top
    elif [[ -n "$GEO_MAP" ]]; then
        echo "(The database is Country-level. GeoLite2-City.mmdb is a superset that"
        echo " also answers the country sections — swapping it in adds cities and"
        echo " loses nothing.)"
    else
        echo "(No GeoLite2 database — see the note under Top countries.)"
    fi
    echo

    # $4 is "[dd/Mon/yyyy:HH:MM:SS"; field 2 after splitting on : is the hour.
    echo "== Requests by hour of day =="
    awk '{ print $4 }' "$TMP_LOG" | cut -d: -f2 | sort | uniq -c | sort -k2 -n
    echo

    echo "== Requests by day =="
    awk '{ print $4 }' "$TMP_LOG" | cut -d: -f1 | tr -d '[' | sort | uniq -c
    echo

    # Reduce to unique (day, address) pairs, then count per day. `sort -u | cut`
    # drops the addresses before anything is printed, so the snapshot carries
    # per-day counts and no address — which is what makes this section safe to
    # serve to a page.
    echo "== Unique IPs by day =="
    awk '{ d = $4; sub(/^\[/, "", d); sub(/:.*/, "", d); print d "\t" $1 }' "$TMP_LOG" \
        | sort -u | cut -f1 | sort | uniq -c
    echo

    echo "== Bot / crawler share =="
    printf "Bot-ish hits:   %s of %s\n" \
        "$(grep -aiEc 'bot|crawl|spider|slurp|bytespider|facebookexternalhit|WhatsApp' "$TMP_LOG" || true)" \
        "$TOTAL"
    echo

    # Machine polling, counted rather than filtered: reconcile.yml reads
    # /api/health every 15 minutes, the deploy job asserts the live commit
    # through it, and an uptime monitor would too. traffic-report-core drops it
    # from the top-paths chart alone — this line is what makes that visible
    # instead of silent.
    echo "== Monitoring (/api/health) =="
    printf "Monitor hits:   %s of %s\n" \
        "$(awk '$7 ~ /^\/api\/health/ { n++ } END { print n + 0 }' "$TMP_LOG")" \
        "$TOTAL"
} | tee "$TXT_OUT"

echo
echo "Snapshot written to: $TXT_OUT"
