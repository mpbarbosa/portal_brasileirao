# O protocolo de commit, push, merge e deploy

*Quando ler:* Leia ANTES do primeiro `git commit`, `git push` ou qualquer conversa sobre merge/deploy.

Extraído do `CLAUDE.md`, que ficou um índice. Esta é a fonte canônica do assunto.

---

## The protocol for commit, push, merge and deploy

Four verbs, in order. Each has one check that makes it safe, and each check
exists because skipping it cost real work rather than because it sounds prudent.

**0. Before you start, claim the work.**

```sh
git worktree list && git branch -a --list '*<topic>*'
gh pr list --state all --limit 10
L=/home/mpb/Documents/GitHub/portal_brasileirao/.claude/worktrees/COORDINATION.md
grep -n '^## ' "$L" | grep -viE 'merged|removed|torn down|closed|resolved|stood down'
grep -n -i '<topic>' "$L" | grep -i 'claim\|worktree-\|PR #'
```

**The second grep is narrowed, and that is not tidiness — it is what stops the
rule above it being defeated.** Telling you never to pipe the search into `head`
or `tail` is half a fix if the prescribed search hands back a wall. Measured on
2026-08-29, an hour apart: a bare `grep -i` for `shots` returned **99** lines and
then **114**; `header` **25** and then **33**. Narrowed, the same two searches
gave 21 and 24, then 3 and 3. Both were live topics that evening.

Those counts are **readings and not constants** — they grew while this paragraph
was being written, which is the same discipline the anchored-claim rule below
asks for, and the reason no number here is worth citing without its date.

**The pull toward truncation does not wait for the output to be long, which is
the part worth internalising.** The session that raised this reached for `| head`
on a **six**-line result and then said so unprompted — it was the *anticipation*
of noise, not the noise. So a search that *could* be noisy is one you will
truncate eventually, on the run where it happens to matter.

**The narrowing is a first pass, not the whole answer.** It keeps only lines
carrying `claim`, `worktree-` or `PR #`, so an entry whose heading uses none of
those words is invisible to it. That is what the unfinished-entries grep above it
is for; run both, and treat a narrowed search that returns nothing as a reason to
widen rather than as an all-clear.

**Read the ledger with a search, never with a line range**, and the reason is
structural rather than a matter of picking a bigger number. **The file has two
insertion conventions.** Some sessions prepend, some append at the end; measured
on 2026-08-29, one session's six entries sat at 85, 287 and 405 because it had
been prepending all evening, while others were at 2936 and 3018 because they
appended. Nobody had ever agreed either way. The ledger's **own header** now
prescribes one — prepend, immediately below the header, anchored on its
`HOW TO ADD AN ENTRY` heading rather than on "the first `## `", which is the bug
that had pushed the title block and the addressing instructions down to line 46.
But entries written the other way are deliberately **not** retro-moved: sessions
cite line numbers to each other and the file is written concurrently, so a bulk
reshuffle is a lost update waiting to happen. Both conventions therefore remain
present in the file, and will.

So **no positional read can be correct, because there is no agreed end.**
Widening `sed -n '1,80p'` to `1,200p`, or adding a `tail`, would each still be
wrong for whichever convention it is not pointed at — and a search is the only
form that cannot rot the next time somebody picks the other one. When this line
was first written as `sed -n '1,80p'`, live claims sat at 1, 68 and 510 *and* at
2936 and 3018; `crest-fallback — CLAIMED, no PR yet` was the last of those, an
unpublished session, exactly the case this line exists to surface and invisible
to the command then prescribed. The claim that would have prevented the #192/#193
collision was at 693.

**Do not cite a line number here as though it were an address.** Every number in
this paragraph is a reading, not a location: `crest-fallback` was at 2980 when
this was drafted and 3018 an hour later, having moved because other sessions
wrote above it. That is the same discipline the anchored-claim rule asks for
below, applied to a file rather than to a ref.

**And do not pipe that search into `head` or `tail`.** This is the failure that
actually happened, and it is worse than not looking, because it feels like
looking. Before starting the refresh that became #193, the session searched this
file for the literal string `shots-targets` — and piped the result through
`| tail -40`. The search produced **677 lines**; tail showed 638-677; the hit was
at output line ~90. The answer was retrieved and discarded, and a truncated view
is indistinguishable from an empty one. Same family as the `A..B` versus `A...B`
traps below: the right command, run in a way that cannot answer.

**The third line is the one that gets skipped, and it is the only one that can
show you a session that has not published yet.** The first two answer *who has
published*; the ledger answers *who has said they are starting*. That difference
is the whole window a collision lives in — as long as the work takes.

Measured on 2026-08-29, two tasks, five pull requests, three of them closed as
duplicates:

- **Three sessions independently separated a control's touch target from its
  box.** #181 (00:08, merged 00:20), #184 (00:20) and #188 (00:31). Same
  diagnosis, same technique, same evening.
- **Two sessions re-shot the same eighteen captures.** #192 (00:55, merged
  00:59) and #193 (00:56). 16 of the 18 images came back byte-identical.

Every session ran the two commands above. One also ran the reflog born-vs-tip
test on the prepared worktree, checked `/proc` cwds, and asked a peer directly —
and still collided, because the peer it asked was not the owner and the owner had
not published yet. **The protocol as written cannot close this**, which is why
reading the ledger is now in it rather than only in the teardown skills.

**Those checks were all for a different question, which is why passing them all
still cost the work.** `--is-ancestor`, the reflog test, `/proc` cwds and asking a
peer answer *may I destroy this?* — and they answered it correctly: leave the
worktree standing. *Is somebody already doing this?* is a separate question, it
has the opposite failure mode, and until this line it had no procedure at all. A
session can run every documented check, get every answer right, and duplicate a
day of work, because none of the checks was ever pointed at what it was about to
do.

**And one of those checks is worse than mis-aimed: a `/proc` cwd scan of a
worktree carries NO information when it comes back empty.** Measured 2026-09-09,
about to redo a re-shoot another session had been running for three hours: that
session held **three** live processes — the shell, its script, a second shell —
and **zero** of them appeared in a cwd scan of the worktree they were driving.
Its script names the worktree by absolute path and keeps its own cwd in the
shared root, so nothing it runs ever has a cwd inside the directory it is
rewriting. `pgrep -af <script>` saw all three.

**The asymmetry is what makes it unusable rather than merely weak.** The
*other* session's script that evening opened with `cd "$W"` and would have been
plainly visible. So whether a scan can see an occupant is a property of **how
the other session happened to write its script**, not of the worktree — which
means an empty result is not weak evidence of absence, it is no evidence at
all. Only a hit means anything, and that was already the rule; what is new is
that the miss has no floor under it.

Note this is a **third** arm, and the two that are written down do not reach it:
*live with its cwd inside*, and the `" (deleted)"` suffix of a worktree removed
underneath a running process. This one is **live on it, from outside**.

**What actually caught it was `git -C <worktree> status --porcelain`** — ten
modified PNGs in a directory `/proc` reported as unoccupied. That is the check
to lead with, because dirty paths you did not write are conclusive where a scan
is not, and it costs one command. Run the cwd scan still, and promote only its
hits.

The ledger is **readable by absolute path from inside any worktree** — verified by
opening it — even though `.claude/worktrees/` is gitignored and so does not exist
in the worktree's own tree. Four committed files name it. What was missing was
never its address; it was that no loop anyone runs opened it.

That sentence used to carry a line count, and the count is gone rather than
updated. It supported nothing — the claim is that the path *opens* — and it was
wrong within a day of being written: 2892 when recorded, 4994 the next time
anybody looked — and 657 of those lines arrived in the twenty-five minutes
between two readings on one evening, 4337 at 19:52:53Z against 4994 at
20:17:35Z. A length nobody recomputes is the shape this file
warns about under **check the prompt that sent you**, so the fix that cannot rot
again is to delete the number rather than re-measure it.

So the other half is yours: **write your claim there before you start**, not when
you finish. A claim written at the end is a record; written at the start it is the
only thing that makes the window visible to anybody else. And where the work
touches a shared artefact — `docs/screenshots`, CLAUDE.md, a docs sweep — say so
to the other sessions as well as to the file, because a file write reaches nobody
inside the window that matters.

**And create the worktree and branch BEFORE you write the claim, not after.**
The ledger closes the window between claiming and publishing a PR. It cannot
close the window between **reading** the file and **writing** to it — which is
however long you spend composing the entry, and a careful entry takes minutes.
That inverts the obvious advice: a fuller, more thoughtful claim is a *wider*
collision window, so "write a better entry" makes this worse rather than better.

`git worktree add .claude/worktrees/<name> -b worktree-<name>` is one command
and it is the **only atomic check in this step**. Git refuses a duplicate branch
name; a markdown file cannot refuse anything. It costs nothing to run first, and
it converts an unenforceable convention into a guard the tooling holds.

On 2026-08-29 two sessions claimed the same screenshot refresh within the same
minute, both having run every command above correctly. One grepped the ledger at
14:58:27Z and found no holder — true when taken — and wrote its claim about
forty-five seconds later; the other's claim is stamped 14:59:23Z. What caught it
was `fatal: a branch named 'worktree-shots-218' already exists`, roughly forty
seconds **after** the grep had returned clean and before either session could
have learned it from the file. The branch namespace collided before the ledger
did.

**Do not cite the delta between two claims as though it timed the race**, which
an earlier draft of this paragraph did. The two *writes* were seconds apart; the
two *headings* differ by more than a minute, because one was rounded by hand and
the other read off `date -u`. A recorded stamp is what a session wrote down, not
when it acted, and only one of these was an instrument reading — so the
difference measures the rounding, not the window. That the second session read
before the first's write landed is an inference too; the collision is
established, the ordering inside it is not.

**The guard is atomic on the branch *name*, not on the *task*, and it must be
read with that limit or it looks like it closes the class.** It worked there
only because the naming convention made two independent sessions derive
`worktree-shots-218` from the same PR number. Two sessions naming one job
differently — `shots-218` against `screenshot-refresh` — are two branches to git
and one task to a person, and git will happily create both. That is exactly the
#181/#184/#188 shape, where three sessions fixed one touch-target bug under
three names and nothing refused anything. So: a real guard, on the case where
the convention converges, and the remaining exposure is the case where it does
not. Naming your branch the obvious thing is therefore part of the guard rather
than a matter of taste.

**The limit is not hypothetical, and the commit adding this rule is the
demonstration.** It collided with a second session writing the same rule, under
`worktree-branch-first-rule` against `worktree-step0-branch-first`. Same task,
two names, both branches created without complaint, and neither ledger entry
landed before the other session had read. **The guard did not fire on its own
commit.** One of the two was closed as a duplicate after the fact, which is the
cost this rule exists to avoid and did not.

**When two claims do collide, the tie-break is who is provisioned, not who was
first.** Priority by timestamp hands the work to the session with neither
worktree nor branch, which is the wrong way round. In the case above the earlier
claimant stood down explicitly — and saying so outright rather than going quiet
is what let it resolve in one round, because a silent withdrawal is
indistinguishable from a session that simply stopped reporting.

**The general form, which is worth more than the branch-first rule it came from:
the checks that fire are the ones that can refuse.** `git checkout -b` refuses a
duplicate branch. The messaging layer refuses an unknown address — a peer
misaddressed as `portal-brasileirao-224710` bounced instantly with *"No agent
named ... is reachable"*. Against those, **adjacency and quotation refuse
nothing**: a ledger entry's *position* cannot decline to name an author, and a
peer's label repeated back cannot decline to be wrong. On 2026-08-29 one session
made three routing errors in an afternoon and **only the one that could refuse
announced itself** — the other two were an authorship inferred from where an
entry sat in a concurrently-prepended file (its text named the author four lines
below) and an identity taken from a peer. So prefer the check that can fail
loudly, and when reaching for a signal ask first what it would do if you were
wrong. If the answer is *nothing*, it is not a check.

**A first-hand reading is not exempt, because an instrument can be aimed at the
wrong subject** — and nothing in its output says where it was pointed. The usual
aim here is the shared root instead of your worktree, and the root's local `main`
lags: measured `941e81d` against an `origin/main` of `d40a3a0` minutes later, so
a command run there answers truthfully about a **different tree**. Two cases the
same day, from that cause, **failing in opposite directions**: `git check-ignore`
run in the root reported `src/data/clubs.ts` unignored, making a merged fix look
broken; `git rev-parse --show-toplevel` run the same way answered
`portal_brasileirao`, reporting a session's own slug as a mismatch. One a false alarm, one a false negative,
both first-hand, current and self-obtained. **That symmetry is the finding**: it
rules out *check hardest when the news is alarming* as sufficient, since the
reassuring-shaped one was equally wrong. Pass the path explicitly (`git -C "$W"`).

**Where no check can refuse, put a known-negative in the same output.** It is the
only defence here that does not require already knowing the answer — include
something whose answer you *do* know, and **incoherence then indicts the
instrument rather than the subject**. `clubs.ts` coming back unignored is
impossible under any spelling of the rule; `portal_brasileirao` is not a session
slug under any provisioning. Both misaims were caught that way, and the same tell
already appears above under grepping a curled payload: a new string **and** the
old one it replaced both missing is a broken instrument, not a broken deploy.

**The two rules above are written about `git` commands, and the read that slips
through is the one with NO REF IN IT.** Every example names a ref you could
doubt — `git check-ignore`, `git rev-parse`, `git -C "$W"`. `grep README.md`,
`ls docs/screenshots/` and `sed -n '255,300p' scripts/screenshot.ts` name no
commit at all, so nothing in the command's *shape* prompts the question, and **a
ref-less read is a reading of an unknown tree.** Three instances in one evening,
all out of the shared root while `origin/main` ran well ahead of it:

- A README caption read in root contradicted the screenshot it captions. It had
  been rewritten to match that frame in the same commit that re-shot it — on a
  tree the reader was not looking at. Reported as a live defect on `main`, and a
  worktree was cut to fix it.
- `ls docs/screenshots/` answered **18** where `git ls-tree --name-only
  origin/main docs/screenshots/` answers **20** (measured at `a8e8fbb`); the two
  missing were the newest pair. That figure had already been given to a user.
- `sed -n '255,300p'` on a file that had genuinely moved by 32 insertions, which
  happened to miss the moved region.

The fix has the same shape as `git -C "$W"`: `git show "origin/main:<path>"` for
a file, and **`git ls-tree origin/main <dir>` for a listing** — the second is the
one nobody derives from a rule phrased around file *contents*.

**A count is the quietest form of it, and worse than a wrong string.** The stale
caption *disagreed* with its frame, so an incoherence existed to be noticed. The
stale 18 was **correct for the tree it was read from**: no mismatch, no
impossible value, nothing for the known-negative rule above to bite on. A stale
count also omits precisely the *newest* work — it is not "slightly low", it is
blind to whatever just landed — and it travels as arithmetic, which reads as
derived rather than observed.

**And this bounds the known-negative rule directly: a WHOLLY stale reading is
self-consistent, and only a PARTLY stale one has a tell.** The session that first
reported that caption had read the README **and** the screenshot from the same
stale root, and within that tree the caption really did contradict the frame — a
coherent finding, correct for its tree. The session that "caught" it had *mixed*
trees, stale caption against a current image, which is the only reason a
contradiction existed at all. **The sloppier mixed reading was luckier than the
careful uniform one.** Incoherence indicts the instrument only where the
instrument is inconsistently aimed; point it uniformly at the wrong tree and
every check agrees with every other.

**The refusal that actually fired was at the WRITE step, not the read step.**
Every read in that chain agreed. What stopped a wrong commit was the edit itself:
a find-and-replace guarding `assert s.count(old) == 1`, built from the root's
text and applied in a worktree at `origin/main`, which raised `AssertionError:
0`. The general form outlives git — **an edit that names what it expects to find
is self-aiming; an edit that names a POSITION borrows the aim of whatever it is
pointed at.** Line numbers (that caption is line 105 in the stale tree and 121 on
`origin/main`), loose regexes and `sed -i` by address all apply cleanly to the
wrong tree and commit something plausible.

**Its bound belongs beside it, or the guard becomes an excuse to stop using a
ref: a PASSING assertion is not evidence you read the right tree.** It refuses
only where the two trees differ at exactly the span being edited. A second
session that night md5'd its own edited span at both trees — identical — so its
assertion passed and refused nothing, while the file around it had moved. It
refuses a wrong aim; it never confirms a right one. That evening it fired once
and was silent once.

**And the probe that cannot detect a thing is the one everybody reaches for.**
`rtk`, the harness wrapper in front of `git` here, injects `-10 --no-merges` into
a bare `git log` carrying no explicit count (upstream `rtk-ai/rtk#3661`,
reproduces on 0.46.0) — and **a pipe bypasses the hook.** Since you cannot count
`git log` output without `| wc -l`, `| grep -c` or `| cat`, every convenient way
of measuring it disables the thing being measured — **the probe has no failing
branch.** A session ran three piped probes, got the true figure three times, and
concluded the injection was not active, reporting it as a measurement. Repetition
cannot help there, and more probes would have produced more confirmations of
nothing. Measured on one range, one command per call, because several `git log`s
in one call contaminate each other:

    git rev-list --count 596d6ff..b6af028            39   ground truth
    git rev-list --count --merges 596d6ff..b6af028   20
    git log --oneline 596d6ff..b6af028   (unpiped)   19   the hook, silently
    git log 596d6ff..b6af028 | grep -c '^commit '    39   the hook, bypassed

Both endpoints are written as shas rather than as `origin/main`, so the reading
is reproducible: the point is the **disagreement between the rows**, and a moving
endpoint would change all four and settle nothing.

**The tell needs no known-good number: `git log A..B` must always include `B`.**
In the filtered run the range's own endpoint was absent from its own output —
self-evident from that output alone, with nothing to compare against and nothing
in it that can go stale. Every other check here needs a figure you already trust;
this one needs only the range you typed.

**This is the one claim on this page where repetition IS corroboration**, and the
distinction is worth keeping straight, because the rest of the section says the
opposite. Three sessions watched it fire at three different endpoints — 39 / 20
merges, 42 / 21, and one more — and each of those runs **could have shown the
endpoint present**. A probe with a failing branch, run three times, is evidence;
the piped probe above has no failing branch, so running it three times was worth
exactly as much as running it once. Ask which kind you have before counting.

Use `git rev-list --count`, which the hook does not touch, and treat any *"how
far is production behind"* or *"what shipped between X and Y"* figure taken from
a bare `git log` as suspect — especially one **confirmed** by a piped
re-derivation, where the confirmation is structurally guaranteed.

**The count above is called the quietest form of this; a stale ABSENCE is
quieter still, and it is the one that ends the work.** A count at least names
something that exists, so a later reader can re-derive it and disagree — which
is how the 18 was caught. *This is not here* has no such handle: the conclusion
terminates the task, so nothing downstream is ever in a position to contradict
it. On 2026-09-02, asked for a scatter of finalizações × gols, a session
surveyed for shot data — `ls src/data`, `grep -ril finaliza` over the working
tree — and reported that no source this app can reach carries them, offering a
paid API key and a substitute chart instead. Local `main` was `596d6ff`, **47
commits** behind an `origin/main` of `f0ac476`, where `scouts-core.ts`,
`src/data/club-scouts.ts` and `scripts/sync-cartola-scouts.ts` had already
shipped exactly that. The user answered with a screenshot of the feature
running.

**Nothing in that survey looked careless, which is the whole difficulty.**
Alongside the two ref-less reads it ran live probes, and those were current and
correct: CBF's `/api/cbf/jogos/{id}` really does carry no `finaliza`, `chute`,
`estatistic` or `posse`, and the súmula PDF really does not either. So a current
artefact agreed with a stale one — but unlike the caption, where the agreement
was luck, here it is **structural**: *the free tier does not carry it* is the
answer a survey of a free tier expects, so the conclusion arrived pre-confirmed
and read as measured. This is the *a claim that produces no work when it holds*
shape, twice named elsewhere on this page, arriving as a finding rather than as
a carve-out.

The refusal therefore belongs at the **conclusion** rather than at the read, and
it is one command beside the search:

```sh
git grep -il <term> origin/main -- '*.ts' '*.tsx'
git rev-list --count main..origin/main
```

**Print the count in the same output as the finding**, not as a separate check
somebody remembers to run: a 47 sitting beside a *nothing here* indicts itself,
where a 47 read a minute earlier is a number nobody carries forward. And note
what this does **not** ask for — it is not *search harder*. That survey was
thorough, and thoroughness is what made it convincing; it was aimed at a tree
nobody had named.

**A follow-up named in a merged PR or a plan document is a magnet.** Both of the
collisions above were exactly that: #174 handed the account control on in
`docs/md3-completion-plan.md` under M9, and the screenshot refresh was owed in
prose by two merged PRs. Several sessions read the same document and reach the
same "this is the obvious next thing" — so a task that looks conveniently unowned
is the case to check hardest, not the case to start fastest. **A prose hand-off
is not an assignment**, however directly it is worded.

Someone may already be doing it. A worktree that is clean, stale and untouched
for an hour is **not** evidence of abandonment — that is also exactly what one
looks like immediately after its owner pushed and merged, and what a live session
looks like while it reads files and runs tests. Ask two things, not one: whether
its branch is an ancestor of `origin/main`, **and** whether that branch has ever
held a commit. A finished one is an ancestor and has; a prepared or unstarted one
is an ancestor and has not; a live or abandoned one is usually neither. The
ancestor test alone answers *yes, finished* for a worktree nobody has started —
see **A branch that was never worked in** above for why, and for the second
command. If it is still ambiguous, **ask the session** rather than infer from
timing. Ownership guessed from "who started recently" was wrong four times in one
evening.

**And check the prompt that sent you: a dispatch prompt's setup lines are
assertions, not facts.** They are frequently wrong, and wrong in ways that
survive a confident-sounding sentence. On 2026-08-27 two sessions were
dispatched onto the same task and given an identical false trio — a repository
path of `/home/user/portal_brasileirao` (it is under `/home/mpb/...`), a
worktree count of three, and **"you are root"** (this machine runs uid 1000,
with no passwordless sudo). Both found all three false independently — and the
count was not merely wrong but *moving*: one session counted seven that
evening and the other eleven, an hour apart. A number in a prompt is stale even
when it was once right. Three commands settle all of it:

```sh
pwd && git worktree list && id -u
```

**"You are root" is the one to check hardest, because it is the only member of
that trio that does not fail loudly.** A wrong path errors on the first
command. A wrong worktree count is contradicted by the listing you already run
above. But a false uid claim silently *inverts which way a privilege-dependent
test fails* — and both those sessions had been sent to fix exactly such a test.
A session that believes it is root reads its own passing run as the bug
reproducing, and draws the opposite conclusion from identical evidence. Real
uid 0 here comes from a container (`docker run -u 0`), never from `sudo`.

Treat a named worktree or branch the same way: **create it if it is not there**
rather than assuming you are in it, and never assume it is still yours later —
see the two worktree rules above.

**The trio is not the whole set: a prompt's claims about *other work* go stale
fastest of all.** On 2026-08-28 a prompt opened a docs task with two setup
lines, both wrong, and neither in a way that errors:

- **"PR #149 is already open against `roadmap.md`, so it needs coordinating
  there rather than a blind edit."** #149 had merged the previous afternoon
  (`2026-08-27T16:22:36Z`, `1ae9010`). Acting on it means either stalling on a
  merged PR or coordinating with nobody.
- **A base of `4a01114`, given as `main`.** `origin/main` was `17521d6` —
  thirteen commits and five merged PRs further on. That is the *root checkout's*
  stale local `main`, which is exactly the reading **Compare against
  `origin/main`** warns about, arriving through a prompt instead of a diff.

Both were probably true when written. That is the point: a PR state and a branch
tip have a shelf life measured in minutes here, so they are stale by the time a
session reads them even when nobody was careless. Two commands, the same shape as
the trio above:

```sh
gh pr view <n> --json state,mergedAt
git fetch origin && git rev-parse origin/main
```

Never `git worktree add -b <branch> <sha-from-the-prompt>` — derive the base
yourself, or you inherit the staleness into your branch point.

**And the same shelf life applies to a *committed file* describing the working
environment, which is where the two commands above stop reaching.** Reported by
a second session the same day: distrusting its prompt, it turned to notes a
prior pass had committed on that branch — and those notes asserted the same
wrong worktree count the prompt had. So "distrust the prompt, check the in-repo
notes instead" lands in the same wrong place *with more confidence*, because a
checked-in file reads as authoritative in a way a prompt does not, and because
you have already verified once and feel done.

A checked-in file describing the environment — a worktree count, who holds what,
which branch is current — is **a snapshot of when it was written, not a fact
about now**. It has a PR state's shelf life and none of its cues. `git worktree
list` and `git rev-parse origin/main` are still the answer; the discipline is to
run them *again* rather than to pick a better document.

That session's prompt carried four false claims, not three — the `/home/user/...`
path, "the worktree exists with `npm ci` already run" when it had been torn down
(so `git worktree list` showed nothing while `git branch -a` showed the surviving
remote branch), "four other worktrees exist" when there was one, and the stale
base above. The trio is at least a quartet, and the stale-base member is not
specific to any one prompt.

**The unifying shape, which is worth more than any of the cases: a claim that
produces no work when it holds is never exercised, so nothing distinguishes
"still true" from "quietly false".** That covers the carve-out above, an
environment note nobody re-derives, and a committed number nobody recomputes.
Where such a claim is load-bearing, give it a command that would fail — the way
`tests/node-version.test.ts` makes the five Node declarations disagree loudly
instead of drifting quietly.

**And check the prompt's carve-outs hardest, because they are the assertions you
are least likely to test.** The same prompt listed two stale documents and then
excluded a third: *"`docs/data-sources.md:204` reads similarly but is about
`check-stadium-photos` and is still true — leave it."* Grepping the workflows
before honouring that exclusion showed `.github/workflows/curated-data.yml` had
landed **that same morning** (`cd4e831`), running the curated-data checkers
monthly — so the sentence was stale in three places rather than none, and one of
them sat directly above a paragraph the very same commit had added. **The commit
that makes a claim stale is frequently adjacent to it.** A carve-out is the one
class of claim that produces no work when it holds, which is precisely why it
gets waved through; grep the whole repository for the sentence rather than only
the lines you were pointed at.

None of this reaches whoever writes those prompts. A session authoring a
handoff uses the real path, so a prompt naming a directory that exists nowhere
in this checkout came from an external template or dispatcher that no session
here can edit. **Verifying is mitigation, not a fix — say so upward when a
prompt turns out to be wrong**, or the next session is handed the same trio.

**"Upward" means the user, and this was checked rather than assumed.** Asked on
2026-08-28 to tell the dispatcher directly, a session looked for an address and
found none: `ListAgents` returns sibling sessions only — all ten named
`portal-brasileirao-*`, none of them the thing that dispatches — and `.claude/`
holds `launch.json`, `skills/` and `worktrees/` with no dispatcher config to
edit. So there is nothing to reply to, and a session that goes hunting will
spend the time and reach the same conclusion. **This paragraph is the channel**:
it is committed, so it travels into every worktree and is read by the next
dispatched session, which is the only audience a fix here can actually reach.
Tell the user, add the case above, and move on.

**1. Commit explicit paths, and stage only what changed.**

Never `git add -A` — another session's work is probably in the tree. And when a
tool rewrites a directory (screenshot captures are the usual case), commit the
files whose bytes actually moved, not the directory. Committing the whole
directory from a stale base is what produces a diff that looks like a deliberate
revert of someone else's merged work.

**2. Push your own branch. That is the whole of what is yours.**

Your worktree, your branch, force-pushing your own branch, closing your own PR
and deleting your own merged branch (`-d`, never `-D`, so an unmerged one
refuses) need nobody's permission.

**`-d` will refuse a branch that is fully merged, and the message is
misleading twice over.** It says "not fully merged", which reads as *you are
about to lose work*; what it means is "not merged into whatever I compared
against", and there are two such comparisons.

It compares against the branch's **upstream** when one is set. If your branch
still tracks its own pushed copy and that copy is identical, `-d` succeeds
trivially — which is the common case and why this often just works. But
`delete_branch_on_merge` is **false** on this repository, so a merged branch
stays on the remote until somebody removes it; once someone does (the button on
the merged PR, or `git push origin --delete`) and you `fetch --prune`, the
upstream is gone.

**In practice somebody always does, and `git push origin --delete` then reports
your teardown as a failure.** Five for five on 2026-08-29: by the time a session
reached that command the remote branch was already gone, because whoever merges
presses the button. Git says

    error: unable to delete 'worktree-<name>': remote ref does not exist
    error: failed to push some refs to 'github.com:mpbarbosa/portal_brasileirao.git'

and exits **1**. Nothing is wrong — the branch is gone, which is what you asked
for — but the wording is *failed to push*, and in the usual
`remove && branch -d && push --delete` chain it aborts whatever you put after it
and reads as a teardown that did not finish.

Note the setting above is what makes this surprising rather than obvious: because
`delete_branch_on_merge` is false you expect the branch to survive the merge, so
the error looks like a real failure rather than a race you already won. **Check
the state, never the exit code**, and run it after `fetch --prune` so a stale
remote-tracking ref does not answer for the remote:

```sh
git fetch origin --prune
git branch -a --list '*<name>*'    # empty = local and remote both gone
```

Same shape as the `-d` message above and as the `2>&1`-in-a-command-substitution
trap under the backup scripts: **the exit status is answering a different
question than the one you are asking.**

**That trivial success is also why `-d` protects nothing while a PR is open**,
and this half is worth more than the half above it: the paragraph you just read
describes the *convenience*, and it is the same sentence. The comparison is
against the branch's own pushed copy, so it is satisfied by the act of **pushing**
rather than by the work **landing** — and a branch awaiting review is in precisely
that state. Reproduced in a throwaway repo on a branch that was not an ancestor of
`origin/main`:

    warning: deleting branch 'feature' that has been merged to
             'refs/remotes/origin/feature', but not yet merged to HEAD
    Deleted branch feature (was ab0e1df)

Exit **0** — a warning, not a refusal. It is the misleading-message family again
in the opposite direction: there the wording cries loss where there is none, here
it names the comparison it actually made and is read as a routine notice.
`worktree-check-before-destroy` was deleted this way on 2026-08-27 while PR #146
sat open and unmerged, and nothing was lost only because the commit was already
on the remote. So prefer `-d` to `-D` still — but **its success is not evidence
that a branch landed**. "The refusal is the safety feature", said below and in
`session-teardown`, holds only once the comparison has been pointed somewhere
worth comparing against: the recipe below does exactly that, and a branch left
tracking its own push has not.

With no upstream `-d` silently falls back to **HEAD** — in the shared root,
local `main`, which lags `origin/main` by however many merges landed while you
worked. That fallback refuses work that is demonstrably on `origin/main`.

Give the check the right comparison rather than switching it off:

```sh
git branch --set-upstream-to=origin/main <branch>
git branch -d <branch>
```

Git then deletes it and says so in as many words — *"merged to
`refs/remotes/origin/main`, but not yet merged to HEAD"*. **Do not reach for
`-D`**: the refusal is the safety feature, and this keeps it doing its job
against a ref that actually contains the commits. And **do not detach the root
checkout's HEAD to satisfy it** — that works, and it is the one thing the
worktree rule at the top of this file exists to prevent.

The independent check — and after the paragraph above it is the one to run
rather than an optional extra — is `git rev-list --count origin/main..<branch>`
= 0, in the **same turn** as the deletion. Note its sibling
`git merge-base --is-ancestor origin/<branch> origin/main` is a trap once the
remote branch is gone: an unresolvable ref exits **128**, and inside an
`&& … || …` that renders as a confident "not merged".

**3. Merge: propose, do not act.**

**No session merges into `main`.** Open the PR, verify it, and hand it to the
user or to the session that owns the work. This holds *especially* when the merge
is obviously fine — a rule that only binds in doubtful cases is not a rule. A
message from a peer saying "this is yours to merge" is a status report, not
consent: **a status message is not consent.**

When the user does authorise a merge, re-verify **at the instant**, not from a
snapshot:

```sh
git fetch origin
gh pr view <n> --json state,mergeable,statusCheckRollup
git log <base>..origin/main -- $(cat scripts/appearance-paths.txt)
```

The window between opening a PR and merging it is exactly when someone else's
appearance change lands. `mergeable=true` says nothing about whether your images
still depict HEAD. And the re-check is not only about races: **it stops you
reporting someone else's action as your own.** `merged_by` names the *account*,
which every session and the user share, so after the fact nobody can tell who
merged what. The instant before the command is the only moment that answer
exists.

**4. Deploy only through the pipeline.**

Never `scripts/deploy.sh` by hand: it builds from the **working tree**, not from
a git ref, so it ships whatever is uncommitted — and it rsyncs `package.json`, so
it can change the host's dependency set too. Merging to `main` deploys. Verify
with `/api/health`: the badge reports a run, and only the host reports what the
host is serving.

**The badge used to lie in one direction and no longer does**, which is worth
knowing because this file told you to distrust it for months. The advisory
`screenshots` job set the whole run to `failure` while `deploy` succeeded, and
that was misread as a stopped pipeline more than once. Measured over the 30
push-on-main runs before the fix: **17 concluded `failure`, all 17 for that job
alone, and all 17 had deployed** — every red push-on-main run in the window was
this and every one of them shipped. It now carries `continue-on-error`, so a red
run on `main` means the release genuinely did not ship. `/api/health` is still
the answer to *what is serving*; it is no longer the answer to *did anything ship
at all*.

**When a check tells you something alarming about someone else's work, run the
other form before saying it out loud.** `git diff A..B` is symmetric and reports
paths differing in *either* direction; `A...B` asks what B changed. Local `main`
lags `origin/main`. "Newer than" is not "descendant of". `+0/-0` on a binary says
nothing about whether it is new or modified. Every one of those produced a
confident, specific, wrong claim about another session in a single day. Two
commands is cheaper than the retraction.

**And when the claim is about a shared ref, state the anchor inside it.** The
four traps above are about running the *wrong* command; this one is about
running the right one too early. `main` moves every few minutes here, so an
ancestry answer has a shelf life — it can be true when you measure it and false
by the time a peer reads it. On 2026-08-27 a session told another that a branch
was "pushed but unmerged", anchored to its own merge `a6d2a38` (02:59:05); the
merge that landed that branch was `30c19bc` at **03:01:35**, two and a half
minutes later. Both sessions were right, about different instants:

```
066d8c9 ancestor of origin/main (5f6c124)   -> YES
066d8c9 ancestor of a6d2a38     (the anchor) -> NO
066d8c9 ancestor of main        (42c0ea9)    -> NO   # local main lags
```

So write *"not an ancestor of `a6d2a38`, my merge, as of 02:59"* rather than
*"unmerged"*. The bare form asserts a property of the branch; the anchored form
asserts what it actually is — a reading, taken somewhere, at a time — and lets
the receiver see the shelf life without re-deriving it. **The sender pays that
cost, because only the sender knows the anchor.** It is the same discipline
`/api/health` applies to a running build: report the commit you were built from,
not merely that you are up.

**And an anchor has to carry its provenance, because the rule above is defeated
by one hop.** An anchored claim tells the receiver *when* a reading was taken; it
does not tell them **whether it was ever read off an instrument**. So the anchor
survives relaying while the thing that made it worth anything does not, and the
second hop republishes a guess in the voice of a measurement. Four instances on
2026-08-29, one afternoon, three sessions:

1. A session wrote `~15:0x` beside a clock it never ran; `date -u` said 14:47:30Z.
2. A second stamped a ledger heading `14:58Z` — **rounded**, not read.
3. A third subtracted that heading from a measured `14:59:23Z`, published
   **"65 seconds apart"**, and carried it into a **merged** PR body.
4. The same delta was then relayed onward into a draft of this very section.

**A stamp still looks like a claim somebody made. A delta between two stamps
reads as arithmetic, and arithmetic reads as derived** — which is why nobody
re-checks it, and why the corruption accelerates at the second hop rather than
decaying. In that chain the two claims' *writes* were **seconds** apart; only the
rounded heading made them 65. The number described nothing.

**A MEASURED value dated by a field that is not a clock is the same failure one
step further in, and it arrives looking like the most solid of the four.**
Measured 2026-09-16: `/api/health` was read once, honestly, and then reported as
a reading *"at 00:27:33Z"* — a time nothing had measured. That turn ran no
`date -u` at all; the stamp was the payload's own `builtAt`, which
`scripts/build.sh` writes at esbuild time inside `check` and which therefore
dates the **bundle**, minutes before any deploy installs it. The reading's real
instant was recoverable and thirteen minutes later: `uptime` (26.18s) against a
process start of 00:40:20.9Z — itself derived from a later reading taken beside a
measured clock — puts it at about **00:40:47Z**, *after* the install rather than
before it. **`uptime` is the one field in that payload measured relative to the
read**, so it recovers the instant where `builtAt` cannot.
Two things follow. The cost was not a wrong number in prose: it was a phantom
disagreement with a peer whose 30s-cadence watch was right all along, and three
messages between two sessions about a host that had supposedly restarted twice on
one sha and never had. And the bad half was **inside** a well-formed sentence —
the sha, the payload and the conclusion drawn from it were all correct, and only
the four digits nobody had measured were invented, which is why nothing in the
reading looked wrong.

**Repetition among relayers is not independent corroboration, and it is worse
than a single relay because volume reads as consensus.** If the first relayer is
wrong the rest inherit it, so the count measures **circulation, not accuracy**.
The test is therefore **falsifiability, never volume**: mark a claim by whether
you hold something that could return *no*. A session cannot see its own short
name — `ListAgents` omits the caller — so a label appearing dozens of times in
the ledger, every occurrence written by somebody else, is not corroborated at all.
One that agrees with your own `git rev-parse` is, at one occurrence.

Two consequences worth having. **A merged PR body cannot be amended**, so a
relayed number that reaches one is repaired only by appending a correction where
nobody re-reads. And **do not cite an occurrence count in a file the citing
conversation is writing to** — that count was measured at 35, 37 and 38 within
twenty minutes, rising because it was being discussed. A metric that grows with
attention to itself is worse than a constant.

The repair is one clause, and only the sender can write it: say *where the number
came from*, not merely when. "Measured, `date -u`" and "relayed from a peer's
heading, not re-derived" are different claims, and the second is still worth
sending — it is the unmarked form that is not.
