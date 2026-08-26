---
name: session-teardown
description: Close a session down safely — release what others are waiting on, then remove your own worktrees, branches, servers and background tasks. Use this after session-pending has answered, or whenever someone says they are done, wants to wrap up, close, drop, end or kill a session, clean up after themselves, or asks what needs tidying before they stop. Several sessions share this checkout, so teardown destroys things and the listings do not say what is yours.
---

# Tearing a session down

Teardown is the dangerous phase. Everything you do here removes something, the
listings show the whole machine rather than your share of it, and the state you
measured a minute ago has already moved.

Almost every near-miss in this repository happened during cleanup, not during
work: servers killed by pattern that belonged to other sessions, a worktree
removed that turned out to be mid-task, a branch deleted with `-D` where `-d`
would have refused, an untracked file removed that was the only copy of itself.

## Run `session-pending` first, and act on *that* answer

Teardown without the pending check is guessing about what you are destroying. If
the check says **NOT YET**, resolve it — do not tear down around it. If it says
**CANNOT DETERMINE**, stop and say so; an unknown is not a no.

And do not tear down on a stale answer. **Re-measure immediately before each
destructive command**, not once at the start. This checkout moves between
commands, and a worktree that was clean when you listed it may not be when you
remove it.

## The order is release, then destroy

Others cannot recover what you take with you, and you cannot recover what you
delete. So the outward-facing half goes first, while you still have everything.

**1. Report and hand off what anyone is waiting on.** Unfinished work you claimed,
a result you promised, a monitor someone relies on, an open PR nobody knows is
orphaned. Say what you did, what you did not, and what you know that is not
written down. **A session that vanishes silently is worse than one that leaves a
mess**, because a mess is visible.

**2. Push anything unpushed.** One command, and it converts "would be lost" into
"is a branch on the remote". Do this before removing anything, so every later
step is reversible.

**3. Then remove your own artefacts** — worktrees, branches, servers, background
tasks. This is the destructive half and everything in it is yours only.

## The asymmetry that governs every command here

The same command is routine cleanup or irreversible loss, depending on whether
the work has landed:

| Command | Before the work lands | After |
|---|---|---|
| `rm` an untracked file | destroys the only copy | restores on next checkout |
| `git worktree remove` | loses uncommitted work | frees a directory |
| `git branch -d` | refuses, correctly | routine |
| stopping a server | breaks something mid-run | frees a port |

So establish landing *before* each one, not once at the top:

```sh
git log --oneline origin/main -- <path>          # has this file landed?
git merge-base --is-ancestor <branch> origin/main # has this branch landed?
```

## Only yours — and the listings will not tell you

`git worktree list`, `git branch -a`, `ss -ltnp` and the PR list all show the
whole machine. Nothing in them marks ownership. Remove only what you created,
and where you cannot establish that you created it, **leave it and say so.**

**Knowing what you created is a record, not a memory.** `session-pending` says to
write down each worktree and branch *at the moment you make it*; this is the step
that spends it. Without that record you are recalling branch names at the point
where being wrong deletes someone else's work — which is the one place the
measure-don't-recall rule matters most.

**Subtract your record from the listing, never the reverse.** Deriving the
removal list *from* the listing cannot distinguish something you forgot you made
from something that arrived while you were working — and the arrival is the more
dangerous reading, because a worktree created a minute ago is the one most likely
to hold work nobody has pushed. This is not hypothetical: during one teardown a
peer's worktree appeared between two commands, clean and a minute old.

Re-measuring guards against *the thing you measured having changed*. It does not
guard against *something new having appeared*. Only the record does that.

"It looked abandoned" is not attribution. A worktree that is clean, stale and
quiet is equally a finished session, a live session reading files, and an
abandoned one — and it has been each of those here.

**Branches:** `git branch -d`, never `-D`. The refusal is the safety feature; if
`-d` refuses, find out why rather than overriding it. Note it compares against
the branch's **upstream**, not against `main`, so a branch fast-forwarded past
its own upstream will refuse while being fully merged. The property you want is
`git rev-list --count origin/main..<branch>` = 0.

**Servers:** stop by **recorded PID**. `pkill -f <pattern>` matches every
session's process, and has. If you did not record the PID, attribute it first
with `readlink /proc/<PID>/cwd`.

**Servers and panes held through a tool are invisible to `ss`.** A browser pane
opened with `preview_start` is a client, not a listener, so no port scan will
find it, and the dev server behind it is released by **`preview_stop <serverId>`**
— not by port and not by PID. Record the `serverId` when you start it; that is
the only handle you get.

**Background tasks and monitors:** these have no on-disk trace and die silently
with the session. Terminate them deliberately, and if anyone was waiting on a
result, that belongs in step 1 rather than here.

## Leave the shared checkout as you found it

Do not move the root checkout's HEAD, do not switch its branch, and do not
commit or restore files there that you did not write. A branch switch in a shared
root drags other sessions' uncommitted work across — that is the origin of the
worktree rule, and it cost several sessions an hour.

## Verify after, not only before

Removal can partly fail, and a push can be rejected. Re-run the checks and report
what is actually gone:

```sh
git worktree list && git branch -a && git ls-remote --heads origin
ss -ltn 2>/dev/null | grep -E ':3[0-9]{3}'
git status --porcelain -uall
```

## An empty teardown is the good outcome

If you tidied as you went, the destructive half is a no-op and there is nothing
to remove. **Say so and stop.** This document is almost entirely about removal,
which creates a mild pull toward finding something to remove — resist it. A
session that arrives at teardown holding nothing did the work correctly earlier,
and the shortest honest report is the best one.

## The closing report

End with what you left behind, because the next session inherits it:

```
TORN DOWN

  merged     #67, #68 — both deployed
  left       .claude/worktrees/highlights — not mine, untouched
  handed off the Maracanã re-capture to <session>; they acknowledged
  nothing    no branches, worktrees, servers or tasks of mine remain
             (destructive half was a no-op — nothing was left to remove)
```

If something could not be cleaned up, name it and why. An honest leftover someone
can find beats a tidy report that is wrong.
