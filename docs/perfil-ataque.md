# Perfil do ataque — leituras por rodada

An **append-only log of editorial readings** of the Perfil on the Painel do clube.
Newest entry first. Nothing here is ever edited; a reading that has been overtaken
is not corrected, it is simply older than the one above it.

## Why this exists beside a page that computes the same counters

`scouts-core.ts` recomputes and cannot curate. It will tell a reader that Palmeiras
is 2nd in finalizações and 2nd in conversão, correctly and forever, and it has no way
to say that the interesting club this round is Coritiba. Curation is judgement over
twenty clubs, and a pure function runs for all twenty.

A dated document curates and goes stale. So the two are combined, under two rules.

## Rule 1 — this file may not restate a figure the page computes

The page states what the figures are; this file says which clubs are worth looking at
and why the shape matters. A rate written here is frozen prose that the next
`sync-cartola-scouts` makes wrong, which is the defect `CLAUDE.md` catalogues at
length — and it would be a *second, worse* answer sitting beside the page's own.

**This is enforced**, not asked for: `tests/scouts-core.test.ts` refuses a decimal, a
percentage or a `Nº` rank anywhere below the first entry heading. Write comparisons
instead — *finaliza mais que os dois líderes e converte pior que qualquer um deles*
rather than two numbers.

That constraint turns out to buy something beyond tidiness. A comparison survives a
re-sync far more often than a figure does: a rate moves every week, while the fact
that one club out-shoots another and converts worse usually holds for months. It is
not immune — a comparison rots too — but what makes this log safe is the rodada stamp
on each entry, never the phrasing.

## Rule 2 — append-only, newest first, stamped with the rodada

**This is the rule that makes "we will adjust it as we go" safe.** An *edited*
document obliges somebody to re-verify every paragraph each round, and nobody does
that — it is the origin of most of the stale claims `CLAUDE.md` records. An
*appended* one obliges verifying nothing, because each entry is a reading of a stated
rodada rather than a claim about now. Same discipline as the anchored-claim rule
applied to a document.

**The ordering is enforced; the freshness deliberately is not.**
`tests/scouts-core.test.ts` asserts the rounds run strictly downward through the
file, with no round written twice. That half exists because
`.claude/worktrees/COORDINATION.md` acquired *two* insertion conventions once one
session prepended wrongly and every later prepend inherited the mistake; there,
prose was the only thing asking for order, and prose lost.

**What is NOT a test: "a sync landed with no fresh reading".** That was the first
design, and the session that holds `sync-cartola-scouts.ts` argued it down with three
of this repository's own rules. Recorded here because the reasoning outlives the
decision:

- `npm run test:unit` runs inside `check` (`ci.yml:47`) and `deploy` needs `check`
  (`ci.yml:426`) — verified rather than taken on report. So a missing paragraph in a
  prose file would stop a release. That is a far larger blast radius than the thing
  being guarded.
- **The remedy is editorial, so the gate's own fallback is filler.** The first draft
  of this file told whoever met the gate to "append two honest lines and move on".
  That trains a person to type filler, under exactly the time pressure where a reading
  is worth least — and by `CLAUDE.md`'s Playwright-stub rule, a check that passes for
  the wrong reason is worse than no check, because it converts an open question into a
  false answer. A gate is only sound where whoever trips it can *fix* it; here they
  can only *satisfy* it.
- The ordering tests above survive that objection precisely because their remedy is
  mechanical and belongs to whoever just wrote the entry.

**The reminder lives in the sync's own output instead**, which reaches the one person
who can write a good reading at the only moment they can write it — with the twenty
rates still on screen — rather than reaching whoever is unblocking CI three hours
later.

**The cost is real and is not being papered over: a printed line can be ignored and a
red test cannot.** This log can therefore fall behind the counters, and nothing will
stop it. That is the same bet `curated-data.yml` makes by being always-green, for the
same stated reason — a curated thing gone stale is data for a person, never a red
build on somebody's unrelated commit.

## Rule 3 — how a phrasing graduates into the code

A formulation that survives **three consecutive entries** and needs no per-club
judgement belongs in `scouts-core.ts`, rendered on the page, and stops being written
here. *Nth in volume, Nth in conversion* is positional and promotable on sight.
*Fluminense is the cheap inverse* never is — the whole of it is the choice of word.

Nothing enforces Rule 3, and that is stated rather than hidden: it is a reading of
three documents by a person. Where the other two rules have tests, this one has this
paragraph.

---

## Rodada 24 — two ways to be bad at attacking, and they look nothing alike

First entry. Written 2026-09-02 against `CLUB_SCOUTS_THROUGH_ROUND = 24`, seeded by a
question from the user: *quero saber a eficiência do ataque*.

**The division splits along volume and conversion independently, and that is the
finding.** A single "ataque" column would collapse two unrelated failures into one
number. Read apart, the four corners are populated and they describe different teams.

- **Shooting a lot is not the same as attacking well, and two clubs prove it in the
  same direction.** Bragantino and Vasco both finalize more than either of the two
  leaders and convert worse than anyone above them. Internacional is the extreme of
  that shape: heavy volume, the worst conversion in the division.
- **Efficiency is concentrated at the top and volume is not.** Flamengo, Palmeiras and
  Botafogo are the three best converters, and none of them leads the league in
  finalizações — Flamengo sits mid-table on volume while topping conversion outright.
  Whatever separates the leaders here, it is not how often they shoot.
- **Coritiba is the club to watch, and only this reading names it.** The lowest
  volume in the division — not nearly, the lowest — with one of its best conversions — a small, accurate attack.
  It is invisible in the table, invisible in gols marcados, and invisible on a page
  that reports its rank in each metric separately.
- **Fluminense is Coritiba inverted.** Near the top of the league in volume, mid-table
  in conversion: a great deal of shooting for a return the middle of the table also
  gets.
- **Mirassol is the only club poor at both.** Ordinary volume with one of the worst
  conversions, and the smallest attack in the division. The two other bottom attacks
  each have one half working.

**What would falsify the Coritiba reading, since it is the one worth promoting or
dropping:** low volume with high conversion is the classic shape of a small sample
that has been lucky. If it holds through the run-in it is a style; if conversion falls
back toward the division's middle while volume stays low, it was variance, and the
club will drop sharply. Two more entries decide it, which is exactly what Rule 3 asks
for.
