#!/bin/bash
#
# 14_install_geoip.sh
# -------------------
# Purpose:      Put a MaxMind-format (.mmdb) geolocation database on the host,
#               so 12_traffic_report.sh can fill the country and city sections
#               of the Tráfego page. One-time provisioning, like 01, 03, 11 and
#               13 — a deploy does not run it.
#
# Usage:        ./shell_scripts/14_install_geoip.sh [city|country]
#
# Prerequisites: curl, and sudo rights to write /var/lib/GeoIP. It installs
#                mmdb-bin itself if mmdblookup is missing.
#
# Environment variables:
#   GEO_DIR             Where the database lands. Default: /var/lib/GeoIP.
#   GEO_VENDOR          `dbip` (default, no signup) or `maxmind`.
#   MAXMIND_LICENSE_KEY Required for GEO_VENDOR=maxmind.
#   MAXMIND_ACCOUNT_ID  Required for GEO_VENDOR=maxmind.
#
# Exit codes:
#   0  A database is installed and answers a lookup.
#   1  Prerequisites missing, or the download failed.
#   2  Something downloaded but is not a usable database. Nothing was installed.
#
# ── Why this exists as its own script ────────────────────────────────────────
#
# 12_traffic_report.sh treats geolocation as optional and says so in the report
# when it is absent — which is right, and is also why the host ran for weeks
# with two empty country panels and nobody had a command to run. The report can
# only probe for a database; putting one there is a separate, one-time act, and
# this is it.
#
# ── Why DB-IP by default, and not GeoLite2 ───────────────────────────────────
#
# GeoLite2 is the better-known database and it is the one the report's own
# probe list was written around. It also requires a MaxMind account and a
# licence key since 2019, which means this script could not run on a fresh host
# without a signup — the property `FOOTBALL_DATA_TOKEN` and Open-Meteo are both
# arranged to avoid, and the reason the weather card could ship at all.
#
# DB-IP publish a City Lite database monthly, in the same .mmdb format, over
# plain HTTPS with no key and no account. Measured before choosing it: the
# 2026-09 build reports `Type: DBIP-City-Lite`, answers both `country names`
# and `city names`, and carries pt-BR among its languages. So the keyless path
# is not a degraded one — it answers every question the report asks.
#
# GEO_VENDOR=maxmind is still there, because an operator who already has a
# licence key has no reason to switch databases to use this.
#
# ── The attribution is a condition of use, not a nicety ──────────────────────
#
# DB-IP's Lite databases are CC BY 4.0: usable commercially, and only while the
# credit is displayed. That is the same bargain `src/data/stadiums.ts` strikes
# for the Commons photographs — "a ground may have no photo, but it may not have
# an unattributed one" — so the credit is carried by the DATABASE rather than
# written into the page: the report reads the `Type` out of the file it actually
# used and prints an attribution line from it, and the page renders whatever
# came back. A component that guessed the vendor from a filename would credit
# DB-IP for a GeoLite2 database the moment somebody renamed one.
#
# ── The filename is a fact about the vendor, not a label ─────────────────────
#
# The database is installed under its own vendor's name — `dbip-city-lite.mmdb`,
# not `GeoLite2-City.mmdb` — and 12_traffic_report.sh's probe list carries both.
# Writing DB-IP's bytes under MaxMind's filename would make every later reading
# of that host wrong about what it is running, and the report's own comment
# already says to ask the database what it is rather than reading its name.

set -euo pipefail

GEO_DIR="${GEO_DIR:-/var/lib/GeoIP}"
GEO_VENDOR="${GEO_VENDOR:-dbip}"
EDITION="${1:-city}"

case "$EDITION" in
    city | country) ;;
    *)
        echo "Error: edition must be 'city' or 'country', got '$EDITION'." >&2
        exit 1
        ;;
esac

if ! command -v curl > /dev/null 2>&1; then
    echo "Error: curl is not installed." >&2
    exit 1
fi

# mmdblookup is what the report uses to read the database, so a database
# without it is a file nothing can open. Installed here rather than assumed,
# because a fresh Ubuntu host has neither.
if ! command -v mmdblookup > /dev/null 2>&1; then
    echo "==> mmdblookup is missing; installing mmdb-bin"
    sudo apt-get update -qq
    sudo apt-get install -y mmdb-bin
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

ARCHIVE="$TMP_DIR/download"
CANDIDATE="$TMP_DIR/candidate.mmdb"

if [[ "$GEO_VENDOR" == "dbip" ]]; then
    # DB-IP publish one build a month at a date-stamped URL and do not keep a
    # `latest` alias. The current month does not exist until they publish it,
    # so the previous month is tried as well rather than failing on the 1st.
    THIS_MONTH="$(date -u +%Y-%m)"
    LAST_MONTH="$(date -u -d '1 month ago' +%Y-%m 2> /dev/null || date -u -v-1m +%Y-%m)"
    NAME="dbip-${EDITION}-lite"
    DEST="$GEO_DIR/${NAME}.mmdb"

    FOUND=""
    for month in "$THIS_MONTH" "$LAST_MONTH"; do
        URL="https://download.db-ip.com/free/${NAME}-${month}.mmdb.gz"
        echo "==> Trying $URL"
        # --fail so a 404 is a failure rather than an HTML error page written
        # to disk and later reported as a corrupt database.
        if curl -fsSL -o "$ARCHIVE" "$URL"; then
            FOUND="$month"
            break
        fi
    done

    if [[ -z "$FOUND" ]]; then
        echo "Error: no DB-IP build found for $THIS_MONTH or $LAST_MONTH." >&2
        exit 1
    fi
    gunzip -c "$ARCHIVE" > "$CANDIDATE"

elif [[ "$GEO_VENDOR" == "maxmind" ]]; then
    if [[ -z "${MAXMIND_LICENSE_KEY:-}" || -z "${MAXMIND_ACCOUNT_ID:-}" ]]; then
        echo "Error: GEO_VENDOR=maxmind needs MAXMIND_ACCOUNT_ID and" >&2
        echo "       MAXMIND_LICENSE_KEY. Get both from a free MaxMind account," >&2
        echo "       or drop the variable and take the keyless DB-IP default." >&2
        exit 1
    fi
    case "$EDITION" in
        city) NAME="GeoLite2-City" ;;
        country) NAME="GeoLite2-Country" ;;
    esac
    DEST="$GEO_DIR/${NAME}.mmdb"
    URL="https://download.maxmind.com/geoip/databases/${NAME}/download?suffix=tar.gz"
    echo "==> Downloading $NAME from MaxMind"
    curl -fsSL -u "${MAXMIND_ACCOUNT_ID}:${MAXMIND_LICENSE_KEY}" -o "$ARCHIVE" "$URL"
    # MaxMind ship a tarball with the .mmdb one directory down, under a
    # date-stamped name — so the member is found rather than named.
    tar -xzf "$ARCHIVE" -C "$TMP_DIR"
    MEMBER="$(find "$TMP_DIR" -name '*.mmdb' -print -quit)"
    if [[ -z "$MEMBER" ]]; then
        echo "Error: the MaxMind archive carried no .mmdb." >&2
        exit 2
    fi
    mv "$MEMBER" "$CANDIDATE"

else
    echo "Error: GEO_VENDOR must be 'dbip' or 'maxmind', got '$GEO_VENDOR'." >&2
    exit 1
fi

# ── Read it before trusting it, and BEFORE displacing anything ───────────────
#
# 09_backup_accounts.sh's rule, and for its reason: a script that moves the
# working database aside and then discovers the new one will not open has
# turned a working host into a broken one. A gzip that unpacked to an error
# page, a truncated download and a database for the wrong edition all reach
# this point looking like a file.
echo "==> Verifying the download before installing it"
if ! META="$(mmdblookup --file "$CANDIDATE" --ip 8.8.8.8 --verbose 2> /dev/null)"; then
    echo "Error: mmdblookup will not read the downloaded file. Nothing installed." >&2
    exit 2
fi

TYPE="$(printf '%s' "$META" | grep -iE '^[[:space:]]*Type:' | head -1 | sed 's/.*Type:[[:space:]]*//' || true)"
if [[ -z "$TYPE" ]]; then
    echo "Error: the file has no database Type. Nothing installed." >&2
    exit 2
fi

# A country lookup is the one thing every edition must answer — a database that
# opens but resolves nothing is the plausible-looking failure this catches.
if ! printf '%s' "$(mmdblookup --file "$CANDIDATE" --ip 8.8.8.8 country names en 2> /dev/null)" \
    | grep -q '[A-Za-z]'; then
    echo "Error: the database opened but resolved no country. Nothing installed." >&2
    exit 2
fi

echo "    Type: $TYPE"
echo "    Size: $(du -h "$CANDIDATE" | cut -f1)"

# Staged and renamed rather than written in place, for 07_install_release.sh's
# reason: the report may be running right now, and a half-written database is
# one it would read as corrupt.
sudo mkdir -p "$GEO_DIR"
sudo cp "$CANDIDATE" "$DEST.incoming"
sudo chmod 0644 "$DEST.incoming"
sudo mv "$DEST.incoming" "$DEST"

echo
echo "Installed $DEST"
echo
echo "12_traffic_report.sh probes for this path, so the NEXT hourly snapshot"
echo "carries the country sections. To see them without waiting:"
echo
echo "    sudo systemctl start portal-brasileirao-traffic.service"
echo "    curl -sf http://127.0.0.1:3000/api/traffic-dashboard | head -c 400"
echo
echo "Refreshing it is this same command again — DB-IP publish monthly and"
echo "MaxMind twice a week. Nothing here installs a timer for that: a month-old"
echo "geolocation database misfiles a few addresses, where a month-old backup"
echo "is data that is gone, which is the difference 11 and 13 exist across."
