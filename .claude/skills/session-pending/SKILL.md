---
name: session-pending
description: Answer "is there anything pending in this session?" — a measured account of what this session still holds, so the user can decide whether to close it. Use this whenever someone asks whether a session can be dropped, closed, ended or killed, whether it is safe to stop, whether anything would be lost, or says things like "am I done here", "can I close this", "anything outstanding?", "wrapping up", "what's left". Several Claude sessions share this checkout, so "pending" includes work others are waiting on — background monitors, promises, claimed tasks — not only uncommitted files.
---

# Is there anything pending in this session?

The real question is **"can I close this window without losing work or stranding
someone?"** Answer that.

Two halves: what *you* would lose, and what *others* are still waiting on. A
session with a spotless tree can be holding up three people.

## Two rules that outrank the checks

**Measure, do not recall.** Report only what a command just told you. A wrong
"nothing pending" is the single answer that destroys work.

**The answer expires in seconds.** This checkout moves under you: servers appear
and vanish between commands, `origin/main` advances mid-decision, PRs get merged
by someone else while you are reading them. So re-measure *immediately before*
acting on any finding. A snapshot is evidence for a verdict, never a licence to
act later.

## Presence is not ownership

Every listing here shows the whole machine, not your share of it. Before check 1,
write down what is actually yours: **the branches and worktrees you created this
session.** Then read every listing against that.

This matters most in check 1. Uncommitted files in a shared checkout are usually
*someone else's* — committing them is the exact accident the worktree rule
exists to prevent. Never widen a commit to something you did not write.

For PRs, ownership often **cannot** be established: sessions share one GitHub
account, so `--author` cannot separate you from anyone else. Say so rather than
claiming or disclaiming.

## The checks

**1. Uncommitted — but only yours.**
```sh
git status --porcelain --untracked-files=all
```
Ignore paths you did not create. Ignore this skill's own file: `.claude/skills/`
is tracked, so installing a skill leaves an untracked file that check 1 will
report on its first run forever.

**2. Commits that exist on one disk only.** The plain form has a false negative
in exactly the dangerous case — a branch with **no upstream** makes
`@{upstream}..HEAD` error, and a swallowed error looks identical to "nothing
unpushed":
```sh
up=$(git rev-parse --abbrev-ref --symbolic-full-name @{upstream} 2>/dev/null)
if [ -n "$up" ]; then git log --oneline "$up"..HEAD
else echo "NO UPSTREAM — everything below exists only here:"
     git log --oneline origin/main..HEAD; fi
```

**3. Open PRs.** `gh pr list --state open --json number,title,headRefName`
Yours are awaiting the user, not unfinished — see the weights below.

**4. Worktrees you hold.** `git worktree list` — then subtract the ones you did
not create.

**5. Servers you started, attributed.** A port number is not an owner:
```sh
ss -ltnp 2>/dev/null | grep -E ':3[0-9]{3}'
readlink /proc/<PID>/cwd        # whose tree is it serving?
```
The cwd also tells you whether it serves **root** or your worktree — `preview_start`
reads `.claude/launch.json` from the session's primary directory, so a session in
a worktree gets a server running root's code. If you stop one, stop it **by PID**.
A broad `pkill -f` pattern matches every session's server, and has.

**6. Distance behind `origin/main`.** `git fetch origin && git log --oneline HEAD..origin/main`
Informational only.

**7. Background tasks, monitors and scheduled work.** The largest gap, because it
leaves no trace on disk. Did you arm a monitor, start a long-running background
command, or schedule something the user is relying on for notification? Dropping
the session silently ends it and nothing will say so.

**8. Promises.** Re-read your last several messages and ask the concrete
questions, not the general one — "did I promise anything?" is too easy to answer
no to from memory:
- did I say "I'll report back" / "I'll tell you when"?
- did I claim a task, or accept a handoff?
- did I tell another session I would do something, or ask them to wait?

## Weighing what you found

| Finding | Weight |
|---|---|
| Uncommitted work **you wrote** | **Blocks** — exists in one place only |
| Commits not pushed, or a branch with no upstream | **Blocks** — one disk, no copy |
| An armed monitor or background task someone relies on | **Blocks** — dies silently with the session |
| A promise, claim or accepted handoff | **Blocks** — nothing else will surface it |
| An open PR you opened | Mention — awaiting the user by design, not unfinished |
| A worktree you hold, clean and merged | Mention — costs only tidiness |
| A server you started | Mention — give the PID and what it serves |
| Uncommitted work **someone else wrote** | Mention — flag it, never commit it |
| Behind `origin/main` | Ignore |

## The answer

Lead with the verdict. Three are available, and the third is not a hedge:

```
SAFE TO DROP
NOT YET — <the one thing>
CANNOT DETERMINE — <which check failed, and why it matters>
```

Reach for the third when a check could not run or returned contradictory
answers. That is not rare here: GitHub has reported one run as `queued` with zero
jobs, then refused to cancel it as `completed`, then refused again as "not been
queued yet" — three mutually exclusive states for one object. Forced into a
binary you would pick one and be wrong; "I could not establish X" is a true
answer and a useful one.

Then one line per check that **found** something, and silence for the rest. The
reader is deciding, not auditing.

If something blocks, give the command that clears it.

**Clear:**
```
SAFE TO DROP.

  holding    .claude/worktrees/jogadores — clean, merged, removable
  server     pid 2094463 on :3001, serving your worktree — yours to stop
  not yours  ?? live-core.ts in root — another session's; left alone
```

**Not clear:**
```
NOT YET — two commits exist only on this disk, and a monitor is armed.

  no upstream  shots-jogadores: 97445f3, 3221126 have never been pushed
  monitor      watching the deploy pipeline; the user expects it to report
  promised     told the estádio session you would re-shoot the Maracanã pair

  git push -u origin shots-jogadores
```
