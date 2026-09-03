#!/usr/bin/env bash
#
# When is the next caRtola sync due, and run it if it is.
#
# WHY A SCRIPT AND NOT A TABLE OF DATES. Two of the three inputs move. The
# fixture calendar is refreshed by every `sync-seed-data` — rodadas 29-38
# currently carry PLACEHOLDER kickoffs, every fixture at 00:00Z, because the CBF
# has not published times that far out — and caRtola's publish day drifts
# (Wednesday for the last three, Tuesday and Friday before that). A date written
# down today is wrong by November; a computation is not.
#
# WHAT IT WILL NOT DO. It writes files and stops: no commit, no push, no merge,
# no deploy. That is the boundary every script in this repository keeps, and the
# reason is that the follow-up work is a judgement — a rodada entry in
# `docs/perfil-ataque.md`, and whatever specs the seed sync reddens.
#
#   ./scripts/sync-schedule.sh --list        the computed schedule, no network
#   ./scripts/sync-schedule.sh --check       is a sync due? (reads caRtola, writes nothing)
#   ./scripts/sync-schedule.sh --run         check, and run the chain if it is due
#
# Exit codes are the contract, so a timer can act on them:
#   0  nothing due, or the run succeeded
#   1  a sync IS due and --check was asked (so `--check && --run` reads well)
#   2  something a person must look at: no token, wrong directory, caRtola moved
set -uo pipefail

CARTOLA=https://raw.githubusercontent.com/henriquepgomide/caRtola/master/data/01_raw
SEASON="${SEASON:-2026}"

die() { printf '%s\n' "$*" >&2; exit 2; }

# --- where are we -----------------------------------------------------------
# `--show-toplevel` rather than `dirname $0`, so a symlinked or copied script
# still resolves the checkout it is meant to act on.
ROOT="$(git rev-parse --show-toplevel)" || die "not in a git checkout"
cd "$ROOT" || die "cannot enter $ROOT"

# **Refuse the shared root checkout.** CLAUDE.md's first rule: several sessions
# share it and a branch switch carries uncommitted work across. A sync writes
# six generated files, so running it here is exactly the collision that rule
# exists to prevent. `--git-common-dir` differs from `--git-dir` only inside a
# worktree, which is the cheapest way to tell them apart.
if [ "$(git rev-parse --git-dir)" = "$(git rev-parse --git-common-dir)" ]; then
  die "refusing to run in the shared root checkout — take a worktree first:
    git worktree add .claude/worktrees/<name> -b worktree-<name> origin/main
    cp .env .claude/worktrees/<name>/.env && cd .claude/worktrees/<name> && npm ci"
fi

# --- readings ---------------------------------------------------------------
# No `2>&1` in any command substitution below. A warning on stderr would be
# folded into the value and parsed as data — the trap `09_backup_accounts.sh`
# records, where an experimental-module warning landed inside a row count.
node_read() { node --disable-warning=ExperimentalWarning --import tsx -e "$1"; }

committed_round() {
  node_read 'import { CLUB_SCOUTS_THROUGH_ROUND as r } from "@/src/data/club-scouts"; console.log(r);'
}

seed_last_played() {
  node_read '
    import { SEED_MATCHES } from "@/src/data/matches";
    const played = SEED_MATCHES.filter((m) => m.status === "FINISHED" && m.homeGoals !== null);
    console.log(played.length ? Math.max(...played.map((m) => m.round)) : 0);'
}

# The schedule, one line per unsynced round: when it finishes, when it is worth
# looking, and whether its kickoffs are real yet.
schedule() {
  node_read '
    import { SEED_MATCHES } from "@/src/data/matches";
    import { CLUB_SCOUTS_THROUGH_ROUND as done } from "@/src/data/club-scouts";
    // 2 days: the measured lag from a round completing to the publish that first
    // carries it was 1.6-1.7d on five of six rounds, and 0.5d on the one that
    // finished just before a scheduled publish. Two days is the smallest whole
    // number above every reading.
    const LAG_DAYS = 2;
    const by = new Map();
    for (const m of SEED_MATCHES) {
      const a = by.get(m.round) ?? []; a.push(Date.parse(m.kickoff)); by.set(m.round, a);
    }
    const day = (t) => new Date(t).toISOString().slice(0, 10);
    for (const round of [...by.keys()].sort((a, b) => a - b)) {
      if (round <= done) continue;
      const ks = by.get(round);
      const last = Math.max(...ks);
      // All fixtures at exactly 00:00Z is football-data carrying a date with no
      // time. The DAY is real; the hour is not, so the check date is a floor.
      const placeholder = ks.every((k) => {
        const d = new Date(k);
        return d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
      });
      console.log([
        String(round).padStart(2),
        day(last),
        day(last + LAG_DAYS * 86400000),
        placeholder ? "kickoff times not published yet" : "",
      ].join("\t"));
    }'
}

# The highest rodada caRtola has, probed upward. Cheap: a HEAD-shaped GET that
# discards the body, stopping at the first 404.
cartola_latest() {
  local round="$1" code
  for _ in $(seq 1 20); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "${CARTOLA}/${SEASON}/rodada-$((round + 1)).csv")
    case "$code" in
      200) round=$((round + 1)) ;;
      404) printf '%s\n' "$round"; return 0 ;;
      *)   printf 'unexpected HTTP %s probing rodada %s\n' "$code" "$((round + 1))" >&2; return 2 ;;
    esac
  done
  printf '%s\n' "$round"
}

# --- modes ------------------------------------------------------------------
mode="${1:---check}"

case "$mode" in
  --list)
    printf 'Rodadas not yet in club-scouts.ts (through %s):\n\n' "$(committed_round)"
    printf '  %-3s %-12s %-12s %s\n' rodada completes "check from" note
    schedule | while IFS=$'\t' read -r round completes check note; do
      printf '  %-3s %-12s %-12s %s\n' "$round" "$completes" "$check" "$note"
    done
    printf '\ncaRtola publishes weekly and the day drifts (qua lately; ter and sex before),\n'
    printf 'so "check from" is a floor, not an appointment. Run --check daily from it.\n'
    ;;

  --check|--run)
    have=$(committed_round) || die "cannot read club-scouts.ts"
    latest=$(cartola_latest "$have") || die "caRtola probe failed — check the path has not moved"
    seed=$(seed_last_played) || die "cannot read matches.ts"

    printf 'club-scouts.ts: rodada %s   caRtola: rodada %s   seed played through: %s\n' \
      "$have" "$latest" "$seed"

    if [ "$latest" -le "$have" ]; then
      echo "Nothing due — caRtola has published nothing newer."
      exit 0
    fi

    printf '\nRodada %s is available and not synced.\n' "$latest"
    [ "$mode" = "--check" ] && exit 1

    [ -f .env ] || die "no .env here — sync-seed-data needs FOOTBALL_DATA_TOKEN"
    grep -q '^FOOTBALL_DATA_TOKEN=.\+' .env || die ".env has no FOOTBALL_DATA_TOKEN"

    # THE ORDER IS THE WHOLE POINT. The scouts sync divides caRtola's counters by
    # the seed's match counts, so a seed that lags inflates every rate — measured
    # at 4.3-4.5% per club. It refuses rather than guessing, so getting this
    # wrong is loud; running them in order is how it stays quiet.
    echo "==> npx tsx scripts/sync-seed-data.ts"
    npx tsx scripts/sync-seed-data.ts || die "sync-seed-data failed — nothing else run"
    echo "==> npm run sync-rank-history"
    npm run --silent sync-rank-history || die "sync-rank-history failed"
    echo "==> npx tsx scripts/sync-cartola-scouts.ts"
    npx tsx scripts/sync-cartola-scouts.ts --season "$SEASON" || die "sync-cartola-scouts failed"

    cat <<'NEXT'

==> Written, and NOT committed. What is left is judgement, not mechanism:

  1. npm run lint && npm run test:unit && npx playwright test
     A seed sync reddens specs that pin data. Rodada 25 broke three, and a code
     bisect exonerates every commit in that class — what moves is which round
     the page opens. Grep the failures for a pinned round number or fixture id.

  2. docs/perfil-ataque.md — the sync printed a request for a reading if the
     rodada advanced. Prepend above every existing `## Rodada` heading. Name
     clubs and shapes, never a rate: test:unit refuses a decimal, a percentage
     or a `Nº` rank in that file.

  3. Commit with a Screenshots-unaffected: trailer, or re-shoot. The seed files
     cannot move a capture (captures come from production, which serves live
     data); club-scouts.ts does render, in the Painel's Perfil, which sits below
     the crop. Re-measure rather than quoting a number from a previous commit.
NEXT
    ;;

  -h|--help) sed -n '2,30p' "$0" | sed 's|^# \{0,1\}||' ;;
  *) die "unknown option: $mode (try --list, --check, --run)" ;;
esac
