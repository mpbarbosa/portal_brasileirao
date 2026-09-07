#!/usr/bin/env bash
#
# Poll caRtola for the next syncable rodada, from cron.
#
# WHERE IT RUNS, AND WHY THAT IS NOT WHERE IT LIVES. `scripts/sync-schedule.sh`
# refuses any checkout where `git rev-parse --git-dir` equals `--git-common-dir`
# — true of the shared root checkout AND of any plain clone (measured, not
# assumed). So the checkout this drives must be a *worktree*, and a worktree of
# a clone no other session can see: worktrees under the shared repo's
# `.claude/worktrees/` are swept by every session's teardown, and one holding no
# commit reads as "unstarted, safe to delete".
#
# That is a constraint on where it RUNS. It was read for years as a constraint
# on where it LIVES, so this file sat unversioned in `~/cartola-cron/` — and
# drifted. It carried a count of the generated files a sync writes; the count
# said six, the answer was seven, and the three copies of that sentence inside
# the repository were fixed in a reviewed diff while this one was fixed only
# because somebody happened to open it. A file nothing reviews is the shape
# `shell_scripts/blocklist.txt` already argues against in CLAUDE.md.
#
# INSTALLING IT. One line of crontab, pointing at the private worktree:
#
#   17 * * * * /home/mpb/cartola-cron/wt/scripts/cartola-cron-check.sh
#
# and that worktree is built once, of a clone rather than of the shared repo:
#
#   git clone https://github.com/mpbarbosa/portal_brasileirao ~/cartola-cron/repo
#   git -C ~/cartola-cron/repo worktree add ~/cartola-cron/wt origin/main
#   cd ~/cartola-cron/wt && npm ci
#
# WHY IT RE-EXECS ITSELF, WHICH IS THE WHOLE REASON IT COULD NOT BE VERSIONED.
# The script brings its own checkout to current `main` with `git reset --hard`
# — so once it lives INSIDE that checkout, it rewrites the file bash is reading.
# bash reads a script incrementally by byte offset, so a file replaced mid-run
# resumes at an offset into different bytes: it does not fail loudly, it runs
# whatever now sits there. Pinning a copy in `mktemp` and re-execing that, before
# any git command, is what makes running from inside the tree safe.
#
# WHAT IT WILL NOT DO. Only `--check`, never `--run`. A run rewrites every
# generated file the chain owns under `src/data/` (the seed, the campanha and
# the scouts), and the follow-up is judgement — specs that pin data go red, and
# `docs/perfil-ataque.md` wants a written reading. Neither is cron's job. This
# only ever answers "is a sync due", and `--check` never reads `.env`, so no
# FOOTBALL_DATA_TOKEN is copied to this directory.
#
# Exit codes it acts on, which are sync-schedule.sh's contract:
#   0  nothing due
#   1  a sync IS due          -> writes the DUE marker
#   2  a person must look     -> writes the ATTENTION marker
set -uo pipefail

# The worktree this script drives is the one it is INSTALLED in, resolved from
# its own path — so a second installation under another path needs no edit.
#
# It must be resolved BEFORE the re-exec below and carried across it. After the
# re-exec `$BASH_SOURCE` is the pinned copy under /tmp, so deriving the worktree
# from it there yields `/tmp` and every git command runs in the wrong place. The
# rehearsal has a case for exactly that, because nothing about the failure is
# loud: `git -C /tmp` simply reports no repository and the run exits 2.
CARTOLA_CRON_WT="${CARTOLA_CRON_WT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
export CARTOLA_CRON_WT

# Pin a copy and run THAT, before any git command can rewrite this file. See
# WHY IT RE-EXECS ITSELF above. The guard is the env var, so the pinned copy
# falls straight through.
if [ -z "${CARTOLA_CRON_PINNED:-}" ]; then
  pinned=$(mktemp -t cartola-cron-XXXXXXXX.sh) || exit 2
  if ! cp "${BASH_SOURCE[0]}" "$pinned" || ! chmod +x "$pinned"; then
    rm -f "$pinned"
    exit 2
  fi
  CARTOLA_CRON_PINNED="$pinned" exec "$pinned" "$@"
fi
trap 'rm -f "${CARTOLA_CRON_PINNED:-}"' EXIT

WT="$CARTOLA_CRON_WT"
# The state directory is the parent of the worktree by default; CARTOLA_CRON_BASE
# overrides it, which is what the rehearsal sets.
BASE="${CARTOLA_CRON_BASE:-$(dirname "$WT")}"
LOG="$BASE/sync-check.log"
DUE="$BASE/DUE"
ATTENTION="$BASE/ATTENTION"

# cron's PATH has neither nvm's node nor much else, so one is built here — but
# ONLY when the inherited PATH cannot already find node. Replacing PATH
# unconditionally is what the first version did, and it is wrong twice over: it
# discards a working environment when the script is run by hand, and it makes
# the script untestable, because a rehearsal's stubs are on the PATH it throws
# away. `scripts/rehearse-cartola-cron.sh` depends on this property — that is a
# real coupling and is stated here rather than left to be discovered.
#
# Resolved by GLOB rather than pinned to v22.15.0, so an `nvm install` inside the
# 22 line does not break it. 22 because that is `.nvmrc`, which is what CI and
# the host run — note this pin only binds the cron path: a shell that already
# has node uses whatever it has, which for `--check` is a read through tsx and
# not something the major changes.
if ! command -v node >/dev/null 2>&1; then
  NODE_BIN=$(for d in "$HOME"/.nvm/versions/node/v22.*/bin; do [ -d "$d" ] && printf '%s\n' "$d"; done | sort -V | tail -1)
  export PATH="${NODE_BIN}:/usr/local/bin:/usr/bin:/bin"
fi

say() { printf '%s  %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >> "$LOG"; }

# Tell a person, once per transition. The markers are files on disk and reach
# nobody; a rodada stays due for days, so the reader who needs this is by
# definition not sitting at a terminal.
#
# CRON HAS NO SESSION BUS, AND THAT IS THE WHOLE DIFFICULTY. Measured on this
# workstation rather than assumed: `notify-send` with no
# DBUS_SESSION_BUS_ADDRESS answers "Cannot autolaunch D-Bus without X11
# $DISPLAY" and exits 1; with `unix:path=/run/user/<uid>/bus` it exits 0. The
# address is therefore derived from the running uid when absent, and only when
# the socket is really there — inventing one puts us back to a notifier that
# does not notify, which is worse than none because it is believed.
#
# IT MAY NEVER CHANGE THE OUTCOME OF A RUN. A logged-out desktop has no bus, and
# that is normal rather than a failure of the poll: the marker is still written,
# the log still records what happened, and the exit code still describes the
# SYNC and not the notification. Every failure here is logged and swallowed.
notify() { # notify <summary> <body>
  local sock
  command -v notify-send >/dev/null 2>&1 || { say "      (no notify-send; marker written, nobody told)"; return 0; }
  if [ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]; then
    sock="/run/user/$(id -u)/bus"
    if [ -S "$sock" ]; then
      export DBUS_SESSION_BUS_ADDRESS="unix:path=$sock"
    else
      say "      (no session bus at $sock; marker written, nobody told)"
      return 0
    fi
  fi
  if notify-send --app-name=caRtola --urgency=normal "$1" "$2" 2>>"$LOG"; then
    say "      notified: $1"
  else
    say "      (notify-send failed; marker written, nobody told)"
  fi
  return 0
}

# One instance at a time. A 30-minute cron against a probe that walks up to 20
# HTTP requests can overlap if the network is slow.
exec 9>"$BASE/.lock"
flock -n 9 || { say "SKIP  another run holds the lock"; exit 0; }

command -v node >/dev/null || { say "FAIL  no node on PATH (looked in \$HOME/.nvm/versions/node/v22.*/bin)"; exit 2; }
cd "$WT" || { say "FAIL  cannot enter $WT"; exit 2; }

# Bring the checkout to current main. Shallow: the cron needs a working tree and
# a fetch, never history. Without this the check reads a stale club-scouts.ts and
# reports a round as due that somebody already synced.
if ! git fetch --depth 1 -q origin main 2>>"$LOG"; then
  say "FAIL  git fetch failed — network, or the remote moved"
  exit 2
fi
before_lock=$(git rev-parse HEAD:package-lock.json 2>/dev/null || echo none)
git reset --hard -q FETCH_HEAD 2>>"$LOG" || { say "FAIL  git reset failed"; exit 2; }
after_lock=$(git rev-parse HEAD:package-lock.json 2>/dev/null || echo none)
head=$(git rev-parse --short HEAD)

# A dependency bump on main would otherwise leave node_modules unable to run tsx.
if [ "$before_lock" != "$after_lock" ]; then
  say "package-lock.json changed — npm ci"
  npm ci --no-audit --no-fund >>"$LOG" 2>&1 || { say "FAIL  npm ci failed"; exit 2; }
fi

out=$(./scripts/sync-schedule.sh --check 2>&1)
ec=$?

case "$ec" in
  0)
    say "ok    $head  nothing due"
    # Self-clearing: if a round was due and has since been synced on main, the
    # marker must not outlive it, or it reads as a standing request for ever.
    if [ -f "$DUE" ]; then rm -f "$DUE"; say "      cleared DUE — it has been synced"; fi
    rm -f "$ATTENTION"
    ;;
  1)
    # Was it already due last hour? The marker persists until the sync lands, so
    # this branch runs every hour while a rodada waits — notifying here rather
    # than on the TRANSITION would ping once an hour for days, which is how a
    # person learns to ignore it.
    was_due=$([ -f "$DUE" ] && echo yes || echo no)
    say "DUE   $head  a sync is due"
    printf '%s\n' "$out" | sed 's/^/      /' >> "$LOG"
    { date -u '+%Y-%m-%dT%H:%M:%SZ'; echo; printf '%s\n' "$out"; cat <<'NEXT'

A caRtola sync is due. This marker is written by scripts/cartola-cron-check.sh
in the worktree cron drives, and clears itself once main carries the sync.

Cron does NOT run it: the follow-up is judgement, not mechanism. To do it:

  git -C ~/Documents/GitHub/portal_brasileirao fetch origin
  git -C ~/Documents/GitHub/portal_brasileirao worktree add \
      .claude/worktrees/cartola-<n> -b worktree-cartola-<n> origin/main
  cd ~/Documents/GitHub/portal_brasileirao/.claude/worktrees/cartola-<n>
  cp ~/Documents/GitHub/portal_brasileirao/.env .env && npm ci
  ./scripts/sync-schedule.sh --run

Then the three things --run prints and will not do: run the suites (a seed sync
reddens specs that pin data), write the rodada entry in docs/perfil-ataque.md
(clubs and shapes, never a rate), and commit with a Screenshots-unaffected:
trailer in the LAST paragraph.

The full procedure, including the Coritiba reading this round votes on, is in
.claude/worktrees/COORDINATION.md — search for "RODADA 26 IS OWED".
NEXT
    } > "$DUE"
    [ "$was_due" = no ] && notify "Rodada da caRtola disponivel" \
      "Um sync esta em falta. Veja ~/cartola-cron/DUE para o procedimento."
    rm -f "$ATTENTION"
    ;;
  *)
    was_attention=$([ -f "$ATTENTION" ] && echo yes || echo no)
    say "LOOK  $head  sync-schedule.sh exited $ec — a person must look"
    printf '%s\n' "$out" | sed 's/^/      /' >> "$LOG"
    { date -u '+%Y-%m-%dT%H:%M:%SZ'; printf 'sync-schedule.sh --check exited %s\n\n' "$ec"; printf '%s\n' "$out"; } > "$ATTENTION"
    [ "$was_attention" = no ] && notify "caRtola: o poller precisa de uma pessoa" \
      "sync-schedule.sh saiu $ec. Veja ~/cartola-cron/ATTENTION."
    ;;
esac

# Keep the log bounded without losing the recent past.
if [ "$(wc -l < "$LOG")" -gt 5000 ]; then
  tail -2000 "$LOG" > "$LOG.trim" && mv "$LOG.trim" "$LOG"
fi
exit 0
