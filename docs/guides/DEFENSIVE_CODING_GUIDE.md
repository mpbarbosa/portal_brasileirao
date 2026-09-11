# Defensive Coding Guide

Adapted for Portal Brasileirão from `doc_template_lib/code_quality/DEFENSIVE_CODING_GUIDE.md`.

## Goal

This app reads from providers that contradict themselves, spell one club four
ways, and file an own goal under the wrong side. The rule that follows is not
"validate at the boundary" — it is sharper:

**Refuse what you cannot establish. A plausible answer is worse than no answer.**

## The decision that comes before every other one

Ask what a wrong answer costs, then choose the direction to fail in. This
repository makes that choice explicitly and in **both** directions, one module
apart:

| Unknown value | Behaviour | Why |
| --- | --- | --- |
| A `resultado` code in CBF's goal payload (`isKnownGoalResult`, `goals-core.ts`) | **Refuse the whole match** | Being wrong is a wrong scoreline, and a wrong club credited with a goal |
| A referee role (`refereeRoleLabel`, `match-core.ts`), a position or nationality (`positionLabel`, `nationalityLabel`, `player-core.ts`) | **Render it verbatim** | Being wrong is an English word on the page, and the word is a visible prompt to add the row |

Both are correct. The asymmetry is the design, and copying either one everywhere
would be the mistake.

**The refusing half paid for itself within a day.** The first build knew only
`NR` and `PN`; the first season-wide sync **refused 25 matches** — 16 `CT`
(contra) and 9 `FT` (falta). Had unknown codes defaulted to ordinary, all 16 own
goals would have been credited to the wrong club and **nothing would have looked
amiss**.

## Reconciliation: the invariant that makes data checkable

Validation asks *is this well-formed*. Reconciliation asks *does this add up*,
and it is the stronger question wherever the data has internal arithmetic.

- **`goalsReconcile` (`goals-core.ts`)** — each club's goals must sum to that
  club's score. `scripts/sync-goals.ts` checks it twice, against CBF's own
  scoreline and against ours, and **writes only the matches that pass both**. A
  run that skipped any still writes its files — every entry in them reconciles —
  and then exits 1 naming what it skipped, so an incomplete run is loud without
  throwing away the matches it did verify.
- **It is checked *again* at merge time**, in `withGoals`, because the two files
  drift between syncs: `src/data/goals.ts` is read on demand while
  `src/data/matches.ts` is a frozen snapshot regenerated on its own schedule.
  Measured on production: for as long as the provider was failing, two round-25
  fixtures shipped three scorers each under `homeGoals: null`. The merge check
  tests **the scoreline, not the status**, which is what makes it self-clearing —
  the goals reappear the moment the two agree again, with nothing re-run.
- **`lineupsReconcile` (`escalacao-core.ts`)** is weaker by necessity: a lineup
  has no scoreline to agree with, so the check is what the laws of the game and
  a team sheet guarantee — two sides, eleven starters each with a bench beyond
  them, every player named and numbered.
  That is still enough to refuse the failure that produces plausible-looking
  data.

## The rule that decides what belongs in a gate

`sidesWithoutStartingKeeper` (`escalacao-core.ts`) is a **warning**, not a fifth
clause of `lineupsReconcile`, and folding it in is the obvious fix that is wrong.

Measured over all 486 sides served: 481 mark two goleiros, five mark only one,
and four of those leave the *starter* unmarked. Three are otherwise perfect
sheets whose keeper is plainly in the eleven, so refusing costs a reader 46 names
to punish one missing boolean.

> The all-or-nothing rule is about **plausible lies**. An absent `(GOL)` is a
> visible absence and lies to nobody.

That is the test for any new gate: does the defect **look like data**? If a
reader can see that something is missing, refusing the whole record is the wrong
trade.

The fourth sheet is the counter-case: it carries no shirt 1 anywhere. "Shirt 1
is the goalkeeper" is a convention rather than a law, and a wrong `(GOL)` is an
assertion about a person — so nothing infers it, and
`tests/e2e/escalacoes.spec.ts` goes red against exactly that mutation.

## Refuse rather than guess: the join rules

- **`matchPlayerByName` (`player-core.ts`)** resolves a CBF scorer name against a
  football-data squad, folding accents, case and punctuation, then requiring
  every word of the short name to appear in the long one. **Exactly one
  candidate, or nothing.** An id opens a card carrying somebody's photograph,
  nationality and Wikipédia article, so being wrong prints a different
  footballer's life under the name of the one who scored, plausibly. One club
  lists three players called Arthur and another four called Lucas; picking the
  first would be right about a third of the time. It is deliberately **not** a
  prefix test — "Ander" would then match "Anderson".

  **And "exactly one" is only as good as the list it is counted in.** The squad
  is incomplete, so a player it omits leaves his namesake as the only
  candidate: CBF's "Jorge" (21) and "Carrascal" (15) share Flamengo's team
  sheets, the squad lists only Jorge Carrascal, and both resolved to him.
  `contestedPlayerIds` (`goals-core.ts`) asks the team sheets, where **two
  shirts on one sheet are two people**, and refuses an id both read as — across
  the season, because the second match it went wrong in had only one of them on
  the sheet.
- **`attachSubstitutions` (`escalacao-core.ts`)** is all-or-nothing per fixture:
  a row that cannot be placed returns null for the whole match, because a list
  missing one change reads as a complete record of a match where that change
  never happened. It also requires both sources to agree on **how many**, per
  club, before believing either.
- **`discordInvite` (`club-core.ts`)** refuses rather than salvages. A bare guild
  id satisfies every character rule and would build `discord.gg/956…` — a link
  that looks minted and resolves to nothing. The snowflake rule (17–20 digits)
  is what refuses it.
- **`redistributable` (`commons-core.ts`)** admits only licences it can *name*,
  rather than refusing a blocklist. It therefore refuses "Public domain" — the
  second commonest tag among candidate photographs — because on Commons that is
  an umbrella over dozens of country-specific and contested tags, and the module
  cannot name the deed a reuser would rely on. An allowlist fails toward
  refusing; a blocklist fails toward publishing.

## Parsing at the boundary

`parseHealth` (`health-core.ts`) and `parseWeather` (`weather-core.ts`) narrow
field by field and let almost every field be absent — the **Rodapé** omits an
item rather than printing `undefined`. `parseWeather` has exactly one required
field, temperature, because a weather card with no temperature is not a weather
card; without it the endpoint answers null and the page omits the section.

`/api/health` is the payload that most needs this: it is deliberately not an
`ApiEnvelope`, and a host still serving last week's bundle answers the shape
*that* build emitted.

**Zero is a real value, and truthiness is the trap.** `countsTowardStandings`
exists because a 0-0 is a real scoreline; `parseWeather` because 0 °C, 0% and
0 km/h are real readings; `traffic-report-core.ts` because `Number(null)` is `0`,
so a truthiness test reports a genuinely quiet hour as missing data. That last
module is also the warning that the trap outlives the parse: its parser kept an
unreadable count null while its timeline turned the null back into 0 with
`?? 0`, drawing a collapse and then a spike that never happened. Check against
`null` explicitly, at every step that carries the value, not only the first.

**A provider's field may lie about its own name.** `startedFor`
(`escalacao-core.ts`) demands the exact string `"false"` because CBF's `reserva`
is the *string* `"false"` — so `if (a.reserva)` is true for all 46 players and
reports nobody as a starter. `isTrue` holds the same rule for `goleiro`,
demanding the exact string `"true"`. `tests/escalacao-core.test.ts` builds its fixtures
with string booleans for that reason; real ones would make every test pass
against the bug.

## Coherence beats ranking

`retractsResult` (`matches-core.ts`) is the guard against a provider withdrawing
a result it already reported. It tests **coherence, not a status ranking**: a
record saying *this match is scheduled for a time that has already passed, and
has no score* contradicts itself whatever it is stamped, so the held result
stands. Every honest correction still wins — POSTPONED and CANCELLED are how a
result is genuinely voided, a corrected scoreline arrives carrying goals, and a
real re-schedule names a kickoff in the future.

A status ranking ("FINISHED outranks SCHEDULED") would have pinned a genuine
correction for ever. Prefer a rule the data can contradict.

## Refusing in shell, too

`shell_scripts/15_install_blocklist.sh` has four refusals, and every one is a way
the site goes off the air or an operator is locked out: a malformed entry named
by line; a `/0` catch-all (valid nginx, takes the whole site down); **the address
you are connected from**, read from `$SSH_CLIENT`; and nginx rejecting the render,
which restores the previous file and exits **2** rather than 1 — because "the
blocklist did not install" and "the site is down" need different responses.

An empty list is **valid** and writes a file with no denies. That is how you
unblock everybody, and the obvious implementation refuses it as an error.

## Required rules

1. **Decide the failure direction from the cost of being wrong**, and write the
   reason at the refusal.
2. **A gate refuses plausible lies, not visible absences.** If a reader can see
   something is missing, do not discard the record around it.
3. **Where the data has arithmetic, reconcile it** — and reconcile again at the
   point of use if the inputs can drift apart.
4. **A join resolves to exactly one candidate or to nothing.** Never "the first
   match", never a prefix — and count the candidates somewhere that can see the
   one who is missing.
5. **Prefer an allowlist to a blocklist** wherever the unknown case is the
   dangerous one.
6. **Never infer an assertion about a person** from a convention (a shirt
   number, a name prefix, a country of club).
7. **Check optional numbers against `null`**, never against falsiness.
8. **Confirm a gate red by mutation before believing it.** A refusal that has
   never fired is a claim, not a check.

## Current reality

- **Validation lives at three boundaries and is uneven.** The HTTP boundary in
  `server.ts` validates route parameters (a non-integer round is a 400); the
  parse functions narrow provider payloads; the sync scripts hold the strongest
  gates. There is no schema library and no runtime type validation — narrowing is
  hand-written per payload.
- **`tsc --noEmit` is the only lint gate.** There is no ESLint. A type says
  nothing about a value that arrived over the wire.
- **The strongest gates are outside the served app.** `goalsReconcile`,
  `lineupsReconcile` and the checkers run on a workstation, so production cannot
  fail them — which is the point, and also means a bad sync is caught only if
  somebody runs it.

## Review heuristics

**Cost test.** What does a wrong answer look like on the page? A wrong word, or a
wrong fact stated confidently?

**Plausibility test.** Would the defect look like data? If yes, refuse. If a
reader would see a hole, do not.

**Arithmetic test.** Does this record contain numbers that must agree with each
other? Then assert it, and assert it again where the two sources meet.

**Ambiguity test.** Can this join return two candidates? What happens then?

**Zero test.** Any `if (x)` guarding a number that could legitimately be `0`.

**Mutation test.** Break it on purpose. Did the gate go red?

## Positive signals

- A refusal carries a comment saying what a wrong answer would have cost.
- A sync writes only the rows that passed its checks, and exits non-zero naming
  the ones it skipped.
- A merge re-checks an invariant that its two inputs could have drifted past.
- An unmapped provider value reaches the page verbatim, in the places where that
  is the cheaper failure.

## Warning signs

- A `default:` that files an unknown code as the ordinary case.
- A join taking `[0]` or using `startsWith`.
- A gate nobody has watched fail.
- `if (value)` on a number.
- A convention treated as a law — "shirt 1 is the keeper", "the first Lucas".
- A refusal added to a reconcile that would discard otherwise sound data.

## Related guides

- [ERROR_HANDLING_GUIDE.md](./ERROR_HANDLING_GUIDE.md) — what to do once you have refused, and fail-open versus fail-safe.
- [REFERENTIAL_TRANSPARENCY.md](./REFERENTIAL_TRANSPARENCY.md) — why zero, `null` and the clock are the three hidden traps.
- [UNIT_TEST_GUIDE.md](./UNIT_TEST_GUIDE.md) — confirming a gate red by mutation.
- [NAMING_GUIDE.md](./NAMING_GUIDE.md) — provider fields whose names lie.
- [REST_API_GUIDE.md](./REST_API_GUIDE.md) — validating a route parameter versus degrading a payload.

## Checklist

- [ ] The failure direction was chosen from the cost of being wrong, and the reason is written down.
- [ ] The gate refuses plausible lies and tolerates visible absences.
- [ ] Any internal arithmetic is reconciled, at the sync and at the point of use.
- [ ] Every join is one-candidate-or-nothing.
- [ ] Unknown values hit an allowlist, not a blocklist.
- [ ] No assertion about a person is inferred from a convention.
- [ ] Optional numbers are compared to `null`.
- [ ] The gate was confirmed red by mutation.
