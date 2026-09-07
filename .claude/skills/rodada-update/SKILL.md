---
name: rodada-update
description: Bring the whole app up to date with a newly played rodada of the Brasileirão — the seed snapshot, the campanha, the caRtola scouts, the gols and escalações, the melhores momentos, the transmissões, the readings in docs/perfil-ataque.md, the artefacts drawn from the seed, and a closing report of what was updated and what was not. Use this whenever someone asks to atualizar a rodada, sync the last round, "update everything with the last round data", "a rodada 26 já saiu", "run the syncs", "os dados estão atrasados", when scripts/sync-schedule.sh --check reports a sync is due, or when a page shows a finished match with no scorers, no lineup and no highlight. Reach for it before running any sync-* script by hand: the ORDER between them is load-bearing and getting it wrong inflates every rate on the Perfil by about 4% with nothing going red.
---

# Updating everything with a new rodada

A rodada is not one file. Seven generated or curated files describe it, they
come from **four different upstreams on four different clocks**, and only one
pair of them has a gate that notices when they disagree. This skill is the
order, the windows, and what each step's failure actually looks like — because
almost every failure here is quiet.

`scripts/sync-schedule.sh` is the mechanism for the first three. This document
is the rest: what it deliberately does not do, what it cannot know about, and
the judgement it stops and hands back to you.

## What "everything" is

| Artefact | Upstream | Command | Clock |
|---|---|---|---|
| `src/data/{matches,clubs,squads,scorers}.ts` | football-data | `sync-seed-data` | live, 10 req/min |
| `src/data/rank-history.ts` | **the seed on disk** | `sync-rank-history` | derived, no network |
| `src/data/{club-scouts,club-scouts-history}.ts` | caRtola | `sync-cartola-scouts` | weekly, day drifts |
| `src/data/{goals,escalacoes}.ts` | CBF match API + súmula | `sync-goals` | per-match, throttled |
| `src/data/highlights.ts` | YouTube | `find-highlights` | hours after the whistle |
| `src/data/broadcasts.ts`, `venues.ts` | CBF onde-assistir | `sync-broadcasts` | **weekly PR, usually already done** |
| `docs/perfil-ataque.md` | a person | — | one entry per rodada |
| `docs/medias/*` + `RENDERED` | the seed | `campanha-video` skill | every seed sync |
| `docs/screenshots/*` + `CAPTURED` | production | `npm run screenshot` | usually **not** owed |
| the report — **what did and did not move** | all of the above | step 11 | every run |

The three rows in the middle of the top block are one chain and the order
between them is the single most consequential thing on this page. The rest are
independent axes: `sync-goals` and `find-highlights` are worth running whether
or not caRtola has published anything.

## 0. Take a worktree. `sync-schedule.sh` will refuse otherwise

A rodada update writes seven generated files. That is precisely the collision the
worktree rule at the top of `CLAUDE.md` exists to prevent, so the script tests
`--git-dir` against `--git-common-dir` and dies in the shared root.

```bash
git worktree add .claude/worktrees/rodada-<n> -b worktree-rodada-<n> origin/main
cp .env .claude/worktrees/rodada-<n>/.env
cd .claude/worktrees/rodada-<n> && npm ci
```

`.env` is gitignored and does not come along; `sync-seed-data` needs
`FOOTBALL_DATA_TOKEN` out of it and the script refuses without one. Create the
branch **before** writing your claim in the coordination ledger — the branch
namespace is the only atomic guard in that step, a markdown file cannot refuse
anything.

## 1. Ask what is actually due

```bash
./scripts/sync-schedule.sh --list     # computed schedule, no network
./scripts/sync-schedule.sh --check    # reads caRtola; exit 1 means a sync IS due
```

`--list` prints, per unsynced rodada, the day it completes and the day it becomes
worth checking — computed rather than stored, because two of its three inputs
move: the fixture calendar is refreshed by every seed sync (rodadas beyond the
published window carry **placeholder 00:00Z kickoffs**, so the day is real and
the hour is not), and caRtola's publish day drifts.

**"Check from" is a floor, not an appointment.** The measured lag from a round's
last kickoff to the publish that first carries it was 1.6–1.7 days on five of six
rounds; the script adds two. Run `--check` daily from that date rather than once
on it.

Exit codes are the contract: `0` nothing due or the run succeeded, `1` a sync is
due, `2` something a person must look at — no token, wrong directory, caRtola
moved.

## 2. The chain, in order — and why the order is the whole point

```bash
./scripts/sync-schedule.sh --run
```

That runs `sync-seed-data` → `sync-rank-history` → `sync-cartola-scouts`, and
stops at the first failure. Do not run them by hand in another order.

**The scouts sync divides caRtola's counters by match counts the seed bounds.**
A seed that lags inflates every rate — measured by reproducing it one rodada
early against data already on disk: **every club's finalizações inflated
4.3–4.5%, mean 4.4%**, and *nothing about the output looks wrong*. Twenty
plausible rates, the right-looking ranks, six rows on the card.

Two gates catch it now and neither is decorative: the sync refuses when
`CLUB_SCOUTS_THROUGH_ROUND` would exceed the seed's last round with a result,
and the coverage denominator throws on the same fault from the other side. The
gate fired for real on rodada 25 — caRtola at 25, seed at 24 — named both rounds
and wrote nothing.

**The goals-reconciliation band cannot stand in for that gate, and fails in the
flattering direction.** Under exactly this fault the scout goal total rises while
the seed total does not, so the reported shortfall moves *further inside* its
-2%..15% band. A number that reads more comfortably as the thing it guards gets
worse is not a gate.

After the run, sanity-read the two markers:

```bash
grep -n 'SNAPSHOT_DATE' src/data/matches.ts
grep -n 'CLUB_SCOUTS_THROUGH_ROUND' src/data/club-scouts.ts
```

Coverage short of the fixture list is **not** an error — it is caRtola not
recording a fixture, and the rates are right about it now that the denominator
follows. Coverage *above* it is refused.

## 3. Gols and escalações — a separate axis, and a date window with a trap

One `sync-goals` run writes both `goals.ts` and `escalacoes.ts`, from one request
per match. Do not look for a second script.

Derive the window from the round's own fixtures:

```bash
node --disable-warning=ExperimentalWarning --import tsx -e '
import { SEED_MATCHES } from "@/src/data/matches";
const r = Number(process.argv[1]);
const ks = SEED_MATCHES.filter((m) => m.round === r).map((m) => m.kickoff).sort();
console.log(ks[0].slice(0,10), ks.at(-1).slice(0,10), ks.length + " fixtures");
' 26
```

Then widen it **by a day on each side**:

```bash
npx tsx scripts/sync-goals.ts 2026-09-04 2026-09-08
```

**CBF's listing is keyed by LOCAL date and our kickoffs are UTC**, so a 00:30Z
fixture is listed under the previous day. A window aimed exactly at the derived
dates will silently miss it. Entries are merged, never replaced, so a wide window
costs only time.

It is slow on purpose — roughly one match a second. CBF throttles **at the
socket**, with no 429 and no `Retry-After`, and a run that goes too fast makes
plain `curl` fail for minutes afterwards, which is indistinguishable from the
host being down. Do not optimise the sleep away.

Exit **1** with the file still written is the interesting case, not a failure to
retry blindly: some matches did not reconcile, or used a `resultado` code the
closed vocabulary does not know. What was written is verified; the report says
what was not. Read it and diagnose rather than re-running:

- A fixture absent from CBF's listing entirely needs `--fixture=<ourId>:<cbfId>`.
- A fixture whose CBF kickoff disagrees with ours by more than the join allows is
  a rule change across four sync scripts, not a data commit.
- A team sheet recorded without substitutions means the súmula's table did not
  agree with the match API and `attachSubstitutions` refused the lot rather than
  record a partial list. A re-run picks them up when CBF publishes a súmula that
  agrees.

**A missing match means "not synced, or did not reconcile" — never "goalless".**
A real 0-0 is deliberately absent from `goals.ts`, because an empty array and an
unsynced match would be indistinguishable in the file. Do not report the count of
matches without goals as a gap without subtracting the genuine 0-0s.

## 4. Melhores momentos

```bash
npx tsx scripts/find-highlights.ts --round 26           # inspect
npx tsx scripts/find-highlights.ts --round 26 --write   # merge
```

Highlights go up within hours of the final whistle, so this is worth running on
the Monday whether or not caRtola has published. `--write` never touches an entry
that is already there. The `find-highlights` skill has the judgement half —
reach for it when a candidate is refused or when two videos look identical, which
they routinely do across seasons.

## 5. Transmissões — check before you run

`.github/workflows/sync-broadcasts.yml` runs weekly and **opens a pull request**;
it does not push. So the usual answer here is that the work is already done and
waiting for review.

```bash
gh pr list --state open --search 'sync-broadcasts in:title'
```

Only run `npx tsx scripts/sync-broadcasts.ts <from> <to>` if no such PR covers
the window — two copies of that data landing separately is a merge conflict in a
generated file, which is the worst kind.

## 6. The gates, and what predictably reddens

```bash
npm run lint
npm run test:unit
npx playwright test
```

**Do not pipe a test run through `head` or `tail`.** A pipeline's exit status is
the last command's, so `| tail` exits 0 however many specs failed — and
Playwright prints the failure list *before* the `N passed` summary, so the last
four lines of a red run are character-for-character the shape of a green one.
This shipped a red `main` once and skipped every deploy for twenty minutes.
Write to a file and grep for `failed`/`flaky`, or use `--reporter=line`, and
check the exit status of the test command itself.

What a seed sync predictably breaks, and how to read it:

- **A spec pinning a round number or a fixture id.** Rodada 25 broke two, both
  carrying comments saying they were stable "because the data is committed" —
  true when written, false the moment another round was played. `PLAYED_ROUND`,
  `UPCOMING_ROUND` and a `DISTANT` fixture id were the three. **A code bisect
  exonerates every commit in that class**; what moved is which round the page
  opens. Grep the failure for a literal round or a `5549xx` and derive it from
  `SEED_MATCHES` instead — that is `clock.ts`'s rule for `E2E_NOW` applied one
  file over, and it means the next sync moves it without anybody remembering.
- **`tests/manim-renders.test.ts`.** Expected: `SNAPSHOT_DATE` moved and
  `docs/medias/RENDERED` still names the old one. That is step 8, not a spec to
  fix.
- **`tests/player-core.test.ts`**, if upstream corrected a value an entry in
  `player-overrides.ts` was written to correct. The remedy is deleting the
  override, not widening the test.
- **`tests/scouts-core.test.ts`**, if you have already written the perfil entry
  and it names a figure. See step 7.

Nothing here should be fixed by loosening an assertion. Each of these is a test
doing its job.

## 7. `docs/perfil-ataque.md` — the one step no script can do

The scouts sync prints a request for a reading when the rodada actually advanced.
It is a *printed* reminder rather than a failing test on purpose: `test:unit`
runs in `check` and `deploy` needs `check`, so failing the suite on a missing
paragraph would hold a release for something whose only remedy is prose —
satisfiable without being fixable.

Append-only, **newest first**, prepended above every existing `## Rodada`
heading. Nothing in it is ever edited; a reading that has been overtaken is
simply older than the one above it.

**Rule 1 is enforced: no decimal, no percentage, no `Nº` rank appears below the
first entry heading**, and `tests/scouts-core.test.ts` refuses one. Write
comparisons — *finaliza mais que os dois líderes e converte pior que qualquer um
deles* — because a rate written here is frozen prose the next sync makes wrong.

Two things the rule does not protect against, both of which cost a correction:

- **Misreading.** "Nearly the lowest volume" names no figure, is exactly the
  comparison Rule 1 asks for, and was wrong: the club was simply the lowest.
  Nothing can catch that but the falsification line each entry ends with — and
  note the shape of the error, because it does not feel like one: **a hedge is
  normally the safe direction, and here it made the claim less falsifiable.**
- **Half the division may not have played.** Where a window advanced only some
  clubs, say so at the top of the entry, or every rank movement below reads as a
  club's own doing.

Carry a previous entry's falsification condition forward unchanged. Changing a
test after one favourable round is how it stops being a test.

## 8. The artefacts drawn from the seed

`docs/medias/` holds two mp4s, several capas and the velas per club, and they are
**drawn from the seed**, so after a sync they describe last season's shape. The
only gate is `tests/manim-renders.test.ts`, which step 6 has already turned red.

Use the **`campanha-video` skill** — it owns the render order, the prerequisites
(the Manim virtualenv is not a dependency of this repo), the capas and the
`-youtube.md` copy. Two rules travel with it:

- **Write the new `SNAPSHOT_DATE` into `docs/medias/RENDERED` in the same commit
  that redraws, never before.** The test reads the claim, not the bytes: it
  catches the forgetting, which is the failure that happens, and cannot catch a
  date written over artefacts nobody redrew.
- **Count the `velas*.json` files, not a sentence** — which clubs have a velas
  render moves.

## 9. Screenshots — usually a trailer, and measure rather than assert

A seed sync usually owes **no re-shoot**, and the reason is structural: every
capture is taken from **production**, which serves live provider data, while the
seed files are the offline fallback. `rank-history.ts` renders nowhere — the
client computes the campanha from the `/api/matches` payload.

`club-scouts.ts` is the one that genuinely does render, in the Painel's Perfil —
and the Painel *is* captured. On rodada 25 it was still not owed, because the
capture is shot at 960×1080 and the crop caps around 1104, while `PERFIL_TOP`
measured 1323. **Re-measure that; do not quote it.** It is a reading from one
rodada on one build, and the section moves down the page as content is added
above it — content added above a section is exactly what evicts it from a frame,
silently, with no gate that can see it.

`src/data` is a watched appearance path and cannot distinguish the seed from
`broadcasts.ts`, so the gate will list your commit either way. That is the
mechanism working. Answer it with a trailer stating **why no rendered pixel can
change**, in the message's **last paragraph beside `Co-Authored-By:`** — git
parses trailers from the final paragraph only, and one separated by a blank line
is silently dropped with nothing anywhere saying so:

```bash
git log -1 --format='%(trailers:key=Screenshots-unaffected,valueonly,unfold)'
```

Empty output means the claim does not exist as far as the gate is concerned.
"It looks the same to me" is a re-shoot, not a trailer.

## 10. Commit shape

**One commit per axis**, which is what the rodada-25 history did and what makes a
later bisect legible: the chain (`seed + rank-history + scouts` and whatever
specs it obliged), then the goals/escalações window, then highlights, then the
perfil reading, then the renders.

- `git add` **explicit paths**. Another session's uncommitted work is probably in
  the tree.
- State the movement in the subject — `Rodada 26: goals 229 -> 2xx, escalações
  242 -> 2xx` — read off the file, never carried from the previous commit.
- Open a PR and **hand it over**. No session merges into `main`, including when
  the merge is obviously fine.
- The deploy is the merge. Verify with `/api/health`, which reports the commit
  the running bundle was built from.

## 11. The report — say what did NOT move, and why

Finish by writing a report of the whole update. It is the last step because it is
the only one that can see all of them, and it exists for the half nobody records:
**an axis that was not updated leaves no artefact, so nothing downstream is ever
in a position to contradict a silent omission.** A rodada that shipped without
its escalações looks exactly like one that had none to ship.

So the report enumerates **every** row of the table at the top of this file,
including the ones you did not touch, and a row that did not move owes a reason
in one of three shapes:

- **Not due** — caRtola has published nothing newer; the broadcasts PR already
  covers the window. Nothing is owed.
- **Refused** — a sync ran and declined to write. Name what it refused and the
  diagnosis, not "did not join": a fixture absent from CBF's listing, a kickoff
  disagreeing by more than the join allows, a súmula whose substitution table did
  not agree. These are the ones that need a person, and they are the ones that
  vanish if the report only lists successes.
- **Deferred** — real work, consciously left for another PR or session. Say which,
  so it is a hand-off rather than a gap. A prose hand-off is not an assignment;
  if somebody must pick it up, say so to them as well as in the report.

### Derive the figures; do not carry them

Every count goes in as a reading taken **after** the last write, off the files
themselves. A script's printed total is a claim about what it meant to write, and
a figure copied from the previous rodada's commit message is the failure this
whole document keeps naming.

```bash
node --disable-warning=ExperimentalWarning --import tsx -e '
import { SEED_MATCHES, SNAPSHOT_DATE } from "@/src/data/matches";
import { CLUB_SCOUTS_THROUGH_ROUND } from "@/src/data/club-scouts";
import { GOALS } from "@/src/data/goals";
import { ESCALACOES } from "@/src/data/escalacoes";
import { HIGHLIGHTS } from "@/src/data/highlights";
const played = SEED_MATCHES.filter((m) => m.status === "FINISHED" && m.homeGoals !== null);
const n = (r) => Object.keys(r).length, sum = (r) => Object.values(r).reduce((a, v) => a + v.length, 0);
console.log("seed        ", SNAPSHOT_DATE, "played through rodada", Math.max(...played.map((m) => m.round)), `(${played.length} fixtures)`);
console.log("scouts      ", "through rodada", CLUB_SCOUTS_THROUGH_ROUND);
console.log("goals       ", n(GOALS), "matches,", sum(GOALS), "gols");
console.log("escalacoes  ", n(ESCALACOES), "matches,", sum(ESCALACOES), "sides");
console.log("highlights  ", n(HIGHLIGHTS), "matches");'
```

Take the "before" the same way, from a tree you name rather than from memory —
`git show "origin/main:src/data/goals.ts"` piped through the same count, or the
command above run in a clean checkout. **Never from the previous rodada's commit
message**, which describes a tree that has moved since. A ref-less read here
reports whatever the shared root happens to be holding.

### Shape

The report is the **PR body**, and the per-axis detail belongs in whichever
commit made that axis move. It is deliberately *not* a committed status file: a
dated inventory nobody regenerates is the claim-that-produces-no-work shape, and
`docs/perfil-ataque.md` is already the one append-only log this update owes.

```markdown
## Rodada 26 — o que entrou e o que não entrou

### Entrou
| Axis | Before → after | Note |
|---|---|---|
| seed | 2026-09-02 → 2026-09-09, r25 → r26 | 245 → 255 fixtures |
| campanha (rank-history) | derived, no network | 20 clubs × 26 rodadas |
| scouts | r25 → r26 | 20 clubs; goals reconcile 6.8% short |
| gols | 230 → 236 matches, 645 → 66x gols | window 04–08/09, +1 day each side |
| escalações | 243 → 249 matches | one side without substitutions, below |
| melhores momentos | 238 → 24x matches | |

### Não entrou
| Axis | Why | Shape |
|---|---|---|
| transmissões | weekly PR #4xx already covers 04–08/09 | not due |
| 554xxx gols | absent from CBF's onde-assistir listing entirely | refused |
| 554xxx substituições | súmula table disagrees with the match API | refused |
| docs/medias | manim renders describe r25; `manim-renders` red | deferred → PR #… |
| docs/screenshots | no captured route renders what moved | not due (trailer) |

### Gates
tsc clean · N unit tests pass · N specs pass, M skipped · check-screenshots exits 0
```

**A "não entrou" table with no rows is a claim worth doubting**, not a clean
sheet. Every rodada so far has had at least one refused fixture, one deferred
render, or one axis that was not due — an empty table more often means the report
was written from the commands that succeeded.

## Traps, in one place

- **Order.** Seed before scouts, always. The failure is 4.4% on every rate and
  looks like nothing.
- **`| tail` on a test run.** Exit 0 on a red suite, in the shape of a green one.
- **The UTC/local date shift** on CBF's listing. Widen the sync-goals window by a
  day each side.
- **A missing match in `goals.ts`** is not a goalless match.
- **A pinned round or fixture id in a spec** is the sync revealing an old defect,
  not the sync causing one. Derive it from `SEED_MATCHES`.
- **`RENDERED` written before the render** turns a record into a lie no test can
  see.
- **A trailer above a blank line** is not a trailer.
- **A number in prose has no gate on it.** Every count in this file — rounds,
  goals, coverage, crop heights — is a reading from a dated run. Re-derive it.
