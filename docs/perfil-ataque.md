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

**Rule 1 protects against staleness and NOT against misreading, which is a distinction
that cost a correction to learn.** The rodada-24 entry first read *"nearly the lowest
volume"* when Coritiba was simply the lowest. That names no figure, it is exactly the
comparison this rule asks for, and it was wrong — so nothing here can catch it.

What does the work instead is the falsification line each entry ends with. And the
failure is worth naming precisely, because it does not feel like one: **a hedge is
normally the safe direction, and here it made the claim less falsifiable.** "Nearly the
lowest" cannot be refuted by a club overtaking Coritiba; "the lowest" can. Caution that
buys vagueness is a cost nobody counts, and it is the only defence available against
the class Rule 1 cannot see.

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

**The boundary is PUBLICATION, not merge.** An entry becomes unamendable the moment
somebody else could have read it and relied on it — which for a branch nobody has
built on is later than it sounds, and for a sentence quoted to another session is
earlier. Merging is usually where the two coincide; it is not what makes the rule
bite. So a known error in an unpublished entry is **fixed in place**, because shipping
it in order to append a correction below leaves the top of the history permanently
wrong and merely annotated at the bottom. This is the same axis as the commit-subject
one: the reading convention, not the medium and not the ref.

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

## Rodada 28 — Palmeiras drops out of the top pair in conversão for the first time, and the Coritiba reading takes a fourth vote

Written 2026-09-23 against `CLUB_SCOUTS_THROUGH_ROUND = 28`.

- **The top two in conversão change for the first time across these readings.**
  Flamengo and Palmeiras had held first and second through rodadas 25, 26 and 27,
  with only the seat below them moving. This window breaks that: Flamengo holds the
  top on its own, and the club beside it is now Coritiba, with Palmeiras falling to
  share third with Athletico-PR. Palmeiras is the club that moved — it converted
  worse than in any of the three previous readings while Coritiba edged up — so read
  this as Palmeiras stepping back rather than as Coritiba overtaking it.
- **Coritiba takes a fourth vote, and it is the strongest yet.** Volume is still the
  lowest in the division, by the same clear margin over Grêmio; conversion did not
  regress toward the middle, it climbed past Palmeiras. Rule 3 asked for three
  consecutive votes before a formulation moves into `scouts-core.ts`, and it now has
  four, the last two of which improved rather than held. Whether to make that move is
  still a decision about the page rather than about this rodada.
- **Vasco takes outright first in volume, and the Bragantino split widens.** Last
  entry pulled the two apart; this one pushes further in the same direction. Vasco
  passes Bragantino at the top of volume and climbs off the floor of conversion for a
  second entry running, while Bragantino stays alone at the bottom of conversion and
  gives up the volume lead. The pair that read as one shape two entries ago now sits
  at opposite ends of what a high-volume club can be.
- **Internacional reverses, and the previous entry's claim does not survive.** Rodada
  27 read it as climbing off the floor of conversion for a second running, by more
  than the entry before. It fell back this window, past both clubs it had overtaken,
  and is once again within touching distance of the bottom. Two entries of movement in
  one direction were not a trend — which is the caution rodada 27 attached to Santos
  and did not attach here.
- **Atlético-MG splits its two axes.** It rose three places in volume — as far as any
  club moved up that axis this window, level with Vitória and Corinthians — and gave
  up three in conversion, which is the largest fall on that axis this round. So it
  shoots more than the entry before and scores less from it. A shape worth a second
  look next round rather than a reading on one window.

**What would falsify the Coritiba reading from here**, unchanged since rodada 25: its
conversion regressing toward the division's middle while its volume stays at the
bottom. Four chances to fail it, none taken.

**What would falsify the Vasco/Bragantino split**: the two converging again on either
axis — Bragantino climbing off the bottom of conversion, or Vasco falling back behind
it in volume. Both moved further apart this window, so a single round of convergence
is the test.

## Rodada 27 — the Coritiba reading takes its third vote and holds, and the Bragantino/Vasco shape splits

Written 2026-09-16 against `CLUB_SCOUTS_THROUGH_ROUND = 27`. The third of the three
votes Rule 3 asked for on the Coritiba reading.

- **Coritiba holds, and this time it moved toward the reading rather than away from
  it.** Volume is unchanged in shape — still the lowest in the division, still trailing
  Grêmio by about the same gap as last entry. Conversion did not keep drifting toward
  the middle, which is what the standing falsification names: it climbed back, past
  Santos, and retook third. That is a stronger vote than a hold — the round rodada 26
  called a weaker confirmation is followed by one that recovers the ground it gave up.
  Three consecutive votes with no per-club judgement needed is exactly what Rule 3 asks
  before a formulation moves into `scouts-core.ts` and stops being written here; whether
  to make that move is left for a separate change, since it is a decision about the
  page rather than about this rodada.
- **Bragantino and Vasco stop being one shape.** Last entry had them level on both
  axes — tied at the top of volume, tied at the bottom of conversion. This window pulls
  them apart on both: Bragantino takes outright first in volume with Vasco now clearly
  second, and on conversion the two swap which one is worse — Bragantino falls alone to
  last, while Vasco climbs off the floor to sit beside Mirassol instead. A shape that
  looked settled for one entry did not survive a second.
- **Santos does not continue the Athletico-PR shape it took on last round.** Rodada 26
  read Santos as this entry's version of that reading — rising into the top three
  converters while its volume sat in the bottom half. Both halves reverse here:
  conversion drops out of the top three, and volume rises out of the bottom half into
  the middle of the table. Read as a one-round event rather than a trend, which is the
  caution the previous entry already attached to it.
- **Internacional keeps climbing.** Off the floor of conversion for a second entry
  running, and by more than last time — no longer within touching distance of the
  bottom pair.
- **Third place in conversion changes hands for a third consecutive round.** Santos
  held it last entry, Coritiba held it the entry before, and Coritiba takes it back
  now. Flamengo and Palmeiras have not moved from first and second across any of the
  three readings; only the seat below them keeps changing.

**What would falsify the Coritiba reading from here**, unchanged: its conversion
regressing toward the division's middle while its volume stays at the bottom. It has
now had three chances to fail that test and has not — the third chance being the
strongest of the three, since it recovered ground rather than merely holding it.

## Rodada 26 — Coritiba steps back for the first time, and Bragantino and Vasco become one shape

Written 2026-09-11 against `CLUB_SCOUTS_THROUGH_ROUND = 26`. The second of the three
votes Rule 3 asks for on the Coritiba reading.

**The whole division advanced this window.** Unlike rodada 25, every club's counters
cover exactly one more match than last entry, so a change of place below is a club's
own round measured against everybody else's, not the artefact of some clubs standing
still while others played.

- **Coritiba: the reading holds, and for the first time it moved the way its
  falsification names.** It is still the lowest volume in the division, by some
  distance from Grêmio just above it. Its conversion slipped one place, out of the top
  three and into fourth, overtaken by Santos. That is the direction the test watches
  and the smallest step in it: still among the best converters, nowhere near the
  middle. Counted as the second vote for, with the note that it is a weaker vote than
  the first.
- **Bragantino and Vasco are now the same club on both axes.** They share the top of
  volume and share the second-worst conversion, level on both counts. Rodada 24 named
  that shape on the two of them together and rodada 25 had them swapping ends of the
  volume order; this window closes the gap entirely. Finishing more than anybody and
  converting worse than almost anybody is now one sentence about two clubs.
- **Internacional climbs off the floor of conversion**, which both previous entries
  called settled. It is no longer the worst converter, and with Mirassol also climbing a
  place the bottom of conversion is now Bragantino and Vasco, level. A club named
  "unmoved" for two entries moved in the first window where everybody played.
- **Santos is this entry's version of Athletico-PR's shape.** It climbs into the top
  three converters while its volume drops into the bottom half — the Coritiba shape at
  a bigger club, which rodada 25 saw on Athletico-PR. Athletico-PR itself did not
  continue it: its volume rose and its conversion slipped a place. So the shape moved
  club rather than hardened, which is a reason to keep not concluding anything from it.
- **The top of conversion is now Flamengo, Palmeiras and Santos.** Flamengo still
  leads it outright and Palmeiras is still second; the third place changed hands for the
  second entry running, Botafogo to Coritiba last round and Coritiba to Santos now.

**What would falsify the Coritiba reading from here**, unchanged, because rewording it
after a round that moved toward it is exactly how a test stops being one: its
conversion regressing toward the division's middle while its volume stays at the
bottom. Rodada 27 is the third vote. If it holds there, the promotion under Rule 3
should carry both caveats this log has now earned — the smallest-sample risk rodada 25
named, and that the second confirmation was a step back rather than a hold.

## Rodada 25 — the Coritiba reading survives its first vote, and Vasco takes the lead it did not want

Written 2026-09-02 against `CLUB_SCOUTS_THROUGH_ROUND = 25`. First entry appended
under Rule 2, and the first test of whether Rule 3 has anything to promote.

**Read the window before the movement.** Only half the division advanced a match in
this window; the rest carry the same counters they carried last entry. So a club can
change place here **without having played**, purely because others did, and any
movement below that is not called out as a club's own is that artefact rather than a
change in how it plays. This is the first entry able to say that at all, which is
itself the argument for a log over a single dated document.

- **Coritiba: the reading holds, and on the axis it was written to be tested on.** Last
  entry recorded what would falsify it — conversion regressing toward the division's
  middle while volume stayed at the bottom. Neither happened. It is still the lowest
  volume in the division, and its conversion moved **up** a place rather than back. One
  vote of the three Rule 3 asks for.
- **Vasco now leads the division in finalizações, and is still among its worst
  converters.** Last entry named that shape on Bragantino and Vasco together; this one
  sharpens it, because the club that took the volume lead is the one that converts
  worse. The two swapped ends of the volume order without either changing what it is.
  Internacional stays the floor of conversion, unmoved.
- **Athletico-PR is the entry's genuine mover.** It climbs into the best converters
  while staying in the bottom third of volume — which is Coritiba's shape arriving a
  round later at a bigger club, and the reason to keep watching it rather than to
  conclude anything now.
- **Botafogo slipped out of the top three converters** without its volume moving. Last
  entry named Flamengo, Palmeiras and Botafogo as the three clear converters; that trio
  is now Flamengo, Palmeiras and Coritiba, which is a sentence the previous entry could
  not have predicted and the page cannot say.
- **Nothing moved at the two extremes.** Flamengo keeps conversion outright and does
  not lead volume; Mirassol is still poor at both, and Internacional still the worst
  converter. The clubs the last entry called settled stayed settled.

**What would falsify the Coritiba reading from here**, unchanged from last entry
because changing it after one favourable round is how a test stops being one: its
conversion regressing toward the division's middle while its volume stays at the
bottom. Two more entries decide it. Note the honest risk in the other direction too —
three consecutive confirmations of a club that has played the fewest shots in the
division is exactly what a lucky small sample also produces, so promotion under Rule 3
should carry that caveat into whatever `scouts-core.ts` ends up saying.

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
