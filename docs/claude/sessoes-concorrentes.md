# Trabalhando ao lado de outras sessões

*Quando ler:* Leia ao criar, adotar ou remover um worktree, ou ao coordenar com outra sessão.

Extraído do `CLAUDE.md`, que ficou um índice. Esta é a fonte canônica do assunto.

---

## Working alongside other sessions

Several Claude sessions share this checkout. Each takes its own **git worktree**
and branch under `.claude/worktrees/`, so their edits cannot collide — the
commands are at the top of this file, under **Before anything else**, and are
deliberately not repeated here: two copies of a setup snippet is how one of them
comes to be wrong.

`git worktree list` shows who is where. The directory is gitignored, because a
worktree is a whole second checkout and one `git add -A` would otherwise commit
another session's entire tree into this one.

Rules that follow from sharing a repository:

- **Commit explicit paths, never `git add -A`.** Another session's uncommitted
  work is almost certainly in the tree, and sweeping it into your commit is the
  easy mistake. Check `git status` before every commit and recognise what is
  not yours.
- **Never `git stash` in the shared checkout.** It stashes everyone's
  uncommitted work, not just yours.
- **`npm run dev` in several worktrees at once is fine** — `resolveAppPort`
  walks upward from `PORT`, so the second one takes 3001 rather than failing.
  **That applies to the dev server only, not to the test harness.** Playwright
  boots its own server with `STRICT_PORT`, deliberately: a suite that quietly
  moved to another port would be testing a server its own config does not
  describe. So a second concurrent `npm run test:e2e` fails rather than walks —
  pass **`E2E_PORT=3101`** to run one alongside another session's. CI needs
  nothing; it runs alone.
- **Identify a worktree by the branch it holds, not by the directory name you
  gave it.** `git worktree list` prints both on one line; compare them before
  every destructive command. A directory named for your task can be checked out
  on a branch you never created — a prepared worktree with `node_modules`
  already installed costs a peer nothing to reuse, so they reuse it. After that
  the name is a fact about who *made* the directory, not about who is working
  in it, and the second reading is the one that matters.
- **Remove your worktree in the same turn its PR merges, or hand it over in
  words. Do not defer it.** "Say the word and I'll tear it down later" sounds
  careful and is the opposite. The window between your work landing and your
  cleanup is exactly when a peer adopts the directory, and by the time the word
  comes you can no longer answer your own question: `account-store-test` was
  re-pointed at another session's branch, carrying a merged commit of theirs,
  **nineteen minutes** after its own PR merged. Deferring turned a one-command
  cleanup into an ownership hunt across a dozen sessions.
- **If you adopt someone else's worktree, rename it to match the branch you put
  on it.** `git worktree move .claude/worktrees/<old> .claude/worktrees/<new>`
  is one command and makes `git worktree list` self-describing again. Adoption
  itself is fine and usually sensible — a prepared checkout with `node_modules`
  already installed is worth reusing — but an adopted directory still carrying
  its creator's name is indistinguishable, from outside, from one that session
  forgot it had re-pointed. This is the half that turned the incident above into
  a broadcast to a dozen sessions: recording a worktree when you create it only
  closes the loop if the **adopter** records too, and nothing prompts them to.
- The root checkout is for integration. Do the work in a worktree.

**Two separate questions, and the ancestor test only answers the first.**
Whether a *branch* is finished is `git merge-base --is-ancestor <branch>
origin/main`. Whether a *directory* is yours to delete is whether you are the
session working in it — and a branch that has merged says nothing about that,
because the peer who adopted your worktree may still be sitting in it with the
next task already started. Where you cannot establish both, leave it standing
and say so: an idle directory costs a little tidiness, and `git worktree prune`
collects it once its owner is done.

**A branch that was never worked in is an ancestor of `origin/main` too**, and
that is the blind spot in the paragraph above rather than a footnote to it.
`git worktree add -b worktree-<name>` leaves the new branch pointing at the
commit it was created from, so `--is-ancestor` says yes and
`git rev-list --count origin/main..<branch>` says 0 — the two answers a merged
branch gives. Measured across the branches standing on 2026-08-27:
`worktree-shots-refresh` and `worktree-drill-workflow` had merged,
`worktree-check-before-destroy` and `worktree-rehearsal-in-ci` had never held a
commit, and **all four** answered `ancestor=yes, ahead=0`. A prepared worktree
was swept on exactly that reading.

The branch reflog separates them, and it is readable from inside a worktree
because every worktree shares the root checkout's `.git`:

```sh
born=$(git reflog show <branch> --format='%H' | tail -1)
test -z "$born" && echo "UNKNOWN — reflog expired; do not delete"
test "$born" = "$(git rev-parse <branch>)" && echo "never held a commit — not merged, unstarted"
```

A branch that has never held a commit has exactly one reflog entry, `branch:
Created from …`, and its tip still equals it. Note what the test actually
answers — not *finished* versus *abandoned*, which no command can tell you, but
**has this branch ever held work that deleting it would destroy**, which is the
question the destructive step needs. It fails safe: a worktree holding
*uncommitted* work also answers "never held a commit", and that is a stronger
reason to leave it standing, not a weaker one. It fails unsafe only once the
reflog has expired — 90 days by default, against branches that live for hours —
so an **empty** reflog is `UNKNOWN` and never "merged".

**There is a second way it misreports, and unlike the expired reflog it has no
`UNKNOWN` branch to fall into: a branch that was created and later moved
forward.** `git checkout -b` at one commit followed by a fast-forward to a newer
`main` leaves born ≠ tip while the branch has never held a commit of its own —
so **neither** line of the snippet prints, and silence reads as "the check ran
and had nothing to warn about". Measured on `worktree-gate-capture-advice`
(2026-08-29): born `c12dd0f`, tip `fb6320b`, both of them merge commits on
`main`, and `git rev-list --count origin/main..<branch>` = 0. Nothing about the
branch had changed between the two readings except which commit it pointed at.
Reproduced from scratch in a throwaway repo rather than reasoned out — create a
branch, commit nothing on it, let somebody else's work land on `main`, then
`git merge --ff-only main`. The reflog then reads `branch: Created from HEAD`
followed by `merge main: Fast-forward`, and no commit anywhere in it.

**The first fixture written for that was wrong in the way this file already warns
fixtures go wrong**, and it is worth a sentence because it looked right: it
committed on the branch before merging and fast-forwarding, which reproduces a
*merged* branch — the case the paragraph above already covers — and the snippet
is equally silent there, so the demonstration appeared to succeed. A fixture that
exercises the neighbouring case passes for the wrong reason.

Read the direction it fails in carefully, because it is not the one the
paragraph above describes. It reports a branch holding nothing as one holding
work — conservative at the *destructive* step, and simply **wrong** as an answer
to the question the test is offered for. Tonight it said "started" about a
branch nobody had started, which is the same false signal as inferring a peer
from timing: it invents an occupant. Ownership guessed from a re-pointed branch
is guessed all the same.

The count is what settles it, and it is one command rather than three:

```sh
test "$(git rev-list --count origin/main..<branch>)" = 0 &&
  echo "no commit of its own — unstarted or merged; the reflog says which"
```

Run it **with** the reflog test, not instead of it: the count cannot tell an
unstarted branch from a merged one, and the reflog cannot tell an unstarted
branch from a re-pointed one. Neither is sufficient alone, which is why both are
written here.

**There is a fourth state, and the pair above still cannot name it: a branch
whose commit was RESET AWAY.** `git reset --hard main` while standing on it —
the ordinary way a session abandons an approach — leaves born ≠ tip *and* a real
`commit:` in the reflog, so the snippet prints "never held a commit — not merged,
unstarted" for neither line and the reflog reads as work. It is the mirror of the
fast-forward case: that one invents an occupant where none existed, this one
reports work that is **gone** in a way indistinguishable from work that
**landed**. Measured on 2026-08-29 during a teardown that read `ahead=0` as "it
merged"; the commit had been discarded minutes earlier.

Build all four and the pattern is plain — and note **the count is 0 for every
one**, so it separates nothing, while born-vs-tip separates only the first:

    branch      count  born-vs-tip  reflog operations
    unstarted     0    born==tip    branch                  nothing was ever here
    merged        0    born!=tip    commit, branch          held work, and it landed
    ffwd          0    born!=tip    merge main, branch      held nothing
    resetaway     0    born!=tip    reset, commit, branch   held work, discarded

**So read the reflog's OPERATIONS, not its endpoints.** That one rule covers all
four, where born-vs-tip covers one and the count covers none:

```sh
git reflog show <branch> --format='%gs' | sed 's/:.*//'
```

`branch` alone is unstarted. A `commit` with nothing above it landed. A `merge`
means the branch only followed `main`. A `reset` above a `commit` means the ref
was **moved off a commit it held** — read on, because that is not the same claim
as *work was thrown away*.

**`reset` above `commit` does NOT establish that work was discarded, and no
git-side test can establish that it was.** The same shape is written by a reset
*forward* — `git reset --hard` back to a commit you still hold, which is how
anybody redoes a botched rebase — and an ordinary **rebase** produces the same
false answer with no `reset` in the reflog at all. Built as a fixture, branches
created before `main` advanced, per the fixture rule below:

    branch      reflog operations                what really happened
    resetaway   reset, commit, branch            held work, discarded
    redone      reset, commit, commit, branch    held work, redone, landed
    rebased     rebase (finish), commit, branch  held work, rebased, landed

    test                                resetaway  redone   rebased
    --is-ancestor <tip> main                yes       yes      yes
    every reflog commit reachable            no        no       no
    rev-list --count main..<branch>           0         0        0

**All three tests answer identically for all three branches.** Ancestry of the
*tip* cannot separate them because a discarded branch is reset **to** `main`,
so its tip is trivially an ancestor. And checking whether the reflog's own
commits survive fails the other way: a rebase orphans the pre-rebase hashes, so
a branch whose work landed in full reports unreachable commits exactly as a
discard does. Measured on a real branch as well as the fixture —
`worktree-scouts-round-25` merged as `4e0f926` while `fae8a05` and `e6a625a`,
its own pre-rebase commits, are not ancestors of `main`.

**What settles it is outside git**, because the reflog records what happened to
the ref and never *why*. Ask whether the branch's pull request merged:

```sh
gh pr list --head <branch> --state merged --json number,mergeCommit
```

One row and a merge commit is *landed*; zero rows on a branch that was pushed is
*not*. Failing that, look for the content on `main` rather than for the commit.

**And read the direction this fails in before treating it as urgent: it is a
false report, not lost work.** Every row of the table is `count 0`, and a
session that believes work was discarded deletes the branch anyway — on that
belief there is nothing left to save. What the misreading costs is telling
somebody a branch's work was thrown away when it shipped, and whatever gets
needlessly redone on the strength of that. Say *the ref was moved and I could
not tell which* rather than guessing either way.

**Read it on the topic branch you are about to delete, never on `main`.** A
topic branch's reflog is three or four entries and the shape is legible at a
glance; `main` here carries `commit`, `merge`, `rebase (finish)`, `pull
--ff-only` *and* `reset` accumulated over months, so the same command shows a
`reset` above a `commit` on a branch nobody has ever abandoned — and a reader
applying the shorthand this section has just spent four paragraphs qualifying
will call that discarded work. The rule is
scoped to the question it serves — *may I delete this branch, and did its work
land* — and that question is never asked about `main`.

**The endpoints of a re-pointed branch and a merged one are identical by
construction**, which is why every endpoint-comparing test agrees with itself and
is wrong. The operation log is the only record of how the ref got where it is.

**Build the fixture with the branches created BEFORE `main` advances**, or it
cannot contain the bug. The first attempt here created each one *after* the move,
so there was nothing to fast-forward or reset across and all four returned
`born==tip` — which reads as "both reported findings are false". That is the same
trap the merge-case fixture above records, and it caught a second session inside
a paragraph warning about it.

**The record that would have settled it is `COORDINATION.md`, and until this
paragraph nothing committed named it:**

    /home/mpb/Documents/GitHub/portal_brasileirao/.claude/worktrees/COORDINATION.md

`.gitignore` excludes `.claude/worktrees/`, so the ledger exists only in the root
checkout and does not appear in any worktree's own tree — and a worktree is the
only place sessions work. **It is readable, though: `cat` that absolute path from
inside any worktree and it opens.** The distinction matters because the two are
fixed by opposite changes, and getting it backwards sends you to re-address a
file that is already reachable. What is unreachable is the *discovery* — nothing
in a worktree lists it, so a session that has not been told the path will not
find one. Before this commit `git grep COORDINATION origin/main` returned nothing at
all, so no session had a reachable way to learn the file existed; that is the
mechanical reason recording gets skipped, and it is not a discipline problem.
Four committed files name it now — this one, `docs/development-environment-memory.md`
and the `session-pending` and `session-teardown` skills — which is deliberate
redundancy rather than duplication: the address has to be wherever the question
is being asked, and the two skills are what a session reads while deciding to
delete something. Read it by that absolute path,
and add an entry at the moment you create **or adopt** a worktree. The rules stay
here, in the file that travels into every worktree; the ledger is the running log
and the trap catalogue, and it says so itself.

**A report that something merged is not evidence that it merged.** A peer's
message, a PR list read a minute ago and your own recollection are readings taken
somewhere else at some other time — #139 was reported merged when it was #138
that had merged, four minutes earlier. Re-run `git merge-base --is-ancestor
<branch> origin/main` in the same turn as the `git worktree remove`, not in the
turn that decided to remove it; that re-run is the only reason an unmerged branch
survived. It is the destructive-step twin of *a status message is not consent*
below, and the same discipline as anchoring a claim about a shared ref.

**A probe that reverts its own subject reports the absence of what it was testing
as a pass.** A `git checkout -- <file>` inside a probe silently undid the
uncommitted edit the guard existed to catch; the guard then ran against a clean
file, found nothing to complain about, and exited green — which reads as
*verified* and is its opposite. Before believing a green probe, make the subject
fail on purpose once and watch the probe go red. Same failure as the Playwright
stub under **End-to-end tests**, which passed against the very bug it named, and
worth stating twice because the first statement was filed under a section nobody
reaches while debugging shell.
