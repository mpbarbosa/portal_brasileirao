# Referential Transparency Guide

Adapted for Portal Brasileirão from `doc_template_lib/code_quality/REFERENTIAL_TRANSPARENCY.md`.

## Goal

A rule in this codebase is a function of its arguments and nothing else. Same
inputs, same answer, every time, on any machine, in any timezone, at any hour.

## What it means here

Purity is the reason the core modules exist at all — see
[CLEAN_ARCHITECTURE_GUIDE.md](./CLEAN_ARCHITECTURE_GUIDE.md) for the layer rule.
This guide is about the three hidden inputs that actually bite here: **the
clock**, **the timezone**, and **shared mutable state**.

### The clock is a parameter

Every core module that reasons about time takes `now` as an argument. The list
that used to sit here was repaired once, by hand, and was two short again when
next audited — `live-core.ts` and `enrichment-core.ts` — so it is a command
instead, which cannot rot:

```sh
grep -lE '\bnow\s*:\s*(Date|number)' *-core.ts
```

That is not a testing convenience; it is what lets `TtlCache` expiry
(`cache-core.ts`) and `CircuitBreaker` recovery (`circuit-breaker-core.ts`) be
tested **without sleeping**, and what lets the end-to-end suite freeze the
browser clock to the snapshot date instead of asking the app to reason about a
world its data does not describe.

`tests/e2e/clock.ts` derives `E2E_NOW` from `SNAPSHOT_DATE` rather than writing a
date down, so a `sync-seed-data` run moves the data and the clock together.

### The timezone is a hidden input, and `events-core.ts` is the case

`events-core.ts` **never constructs a `Date`** — the only `new Date` in the file
is inside a comment explaining why. A date there is a Brazil-local calendar day,
`"2026-03-15"`, and `new Date("2026-03-15")` is midnight **UTC** by the language
spec. Formatting that in a browser west of Greenwich prints **14 March**: the one
obvious implementation is off by a day for every reader this app has, and it
renders correctly on a workstation in UTC and in CI, so nothing goes red.

So labels are built by indexing a month table with the digits of the string, and
comparisons are ordinary string comparisons, which are correct on ISO dates by
construction. `brasiliaDay(now: Date)` is the single named bridge from an instant
to a local day, and it passes an explicit `timeZone` to `Intl`.

### The same trap from the other side: `joinMatch`

`events-core.ts` is the case where a **day** must not become an instant.
`broadcast-core.ts` was the case where an **instant** must not become a day, and
it shipped the bug for as long as the fallback existed.

`joinMatch` attaches CBF's broadcast listing to our fixtures. Where our fixture
still carries a provisional kickoff it falls back to matching on the calendar
date — and it derived that date by slicing the ISO instant `kickoffToIso` had
just built from CBF's *local* date and hour. Brasília is UTC-3, so every kickoff
from 21:00 BRT onward — the commonest Série A slot — crossed into the next UTC
day and matched nothing:

```
CBF 24/10/2026 20:00 BRT -> 2026-10-24T23:00:00Z  slice 2026-10-24  joined
CBF 24/10/2026 21:30 BRT -> 2026-10-25T00:30:00Z  slice 2026-10-25  MISS
```

Two things about it are worth more than the fix. **The suite was green over it**:
the test covering that exact branch used `hora: "16:00"` and its neighbours
`20:00`, all of which stay inside the same UTC day, so all three passed against
the bug and none of them could have failed. And **the failure was not only a
miss** — the slice does not land on nothing, it lands on the *following* day, so
a provisional fixture there for the same home club would have taken another
match's channels.

The fix reads CBF's own `data` field, so a calendar day never becomes an instant
at all. Note the **asymmetry**, which is why `brasiliaDay` is not the answer on
both sides: our date-only fixtures are UTC midnight by `withKickoffPrecision`'s
definition and `kickoffLabel` renders them with an explicit `timeZone: "UTC"`, so
slicing is correct on our side and `brasiliaDay` would shift them a day
backwards. One join, two frames; asking which frame each side is in is the whole
job.

`tests/events-core.test.ts` **sets** the host's zone across four zones rather
than inheriting it. The first version of that test was worthless on the machine
it was written on: deleting the explicit `timeZone` is the mutation that matters,
and the obvious assertion passed against it locally because this workstation runs
`-03`. It would have gone red in CI, which runs UTC. A hermetic test that reads
its answer from the environment is still a test that answers differently in two
places.

### Recomputing beats accumulating

`computeRankHistory` re-runs `computeStandings` once per round rather than
carrying an incremental tally. The tie-breakers are what decide a position, and a
second implementation of them is how a history comes to disagree with the table
it describes. 38 rounds × 20 clubs is a few thousand operations.

The counter-example is instructive. `scripts/sync-cartola-scouts.ts` **does**
accumulate, and its `accumulate` mutates one object per club — pushing it by
reference yields twenty-five identical rows that satisfy every other check. The
sync therefore refuses to write unless some counter strictly increases across the
season. The guard has since been extracted to `scouts-validation-core.ts`, where
it is unit-tested in its own right — and the first test written for it found it
could not fire. That guard exists because the aliasing bug is invisible in the
output.

## Required rules

1. **A core module reads no clock.** `Date.now()` and `new Date()` with no
   argument do not appear in `*-core.ts`. Pass `now`.
2. **A calendar day is a string; an instant is a `Date`.** Going from a real
   instant to a local day is `brasiliaDay` and nothing else, and it names its
   timezone. Two narrow exceptions hold, and both only because the parse side
   and the read side agree on **UTC**: `player-core.ts` passes a bare
   `YYYY-MM-DD` to `Date` and reads every field back through `getUTC*`; and a
   **date-only** fixture is UTC midnight by definition, so slicing its first ten
   characters recovers the day the provider meant. Neither licenses slicing a
   real instant — `joinMatch` above is what that costs.
3. **A test that depends on the environment must set the environment**, not read
   it. Sweep the values that matter.
4. **Do not mutate an argument.** Return a new value. Where an accumulator is
   genuinely worth it, the writer owes a guard that a reference leak would fail.
5. **Zero is a value.** `countsTowardStandings` exists because a 0-0 is a real
   scoreline; `parseWeather` because 0 °C, 0% humidity and 0 km/h are real
   readings; `traffic-report-core.ts` because `Number(null)` is `0`, so a
   truthiness test reports a quiet hour as missing data. Test for `null`
   explicitly, never for falsiness.

## Why it matters here

- The upstream allows 10 requests a minute. A rule that can only be exercised by
  calling it is a rule nobody exercises.
- The end-to-end suite runs against a **frozen snapshot** with a **frozen clock**
  precisely because live scores and current round change mid-match. Purity is
  what makes that substitution legal.
- A date bug here is off by one day, renders correctly on the machine that wrote
  it, and is wrong for every reader.

## Current reality

- **The clock rule is mechanically checked, and this bullet used to say it was
  not.** `tests/core-purity.test.ts` runs in `test:unit` and is stronger than
  rule 1: an **allowlist** over every `*-core.ts` in the repository — not only
  the root ones — refusing the clock, entropy, I/O and the environment alike. It
  is an allowlist because the grep it replaced was green over two violations it
  could not see, `randomBytes` in `oauth-core.ts` and `session-core.ts` among
  them. A rule written as a list of things it forbids passes the one nobody
  thought of.
- **Components own their own ticks deliberately.** `src/App.tsx` never calls
  `useNow`; the two components that need a moving clock —
  `src/components/MeuTime.tsx` and `src/components/LiveView.tsx` — each hold
  their own. A clock in `App` would re-render twenty standings rows and twenty
  sparklines twice a minute to move four words. That is impurity placed on
  purpose, at the smallest surface that needs it.
  **`src/components/SeasonEvents.tsx` is not the third**, though this guide
  listed it as one: it reads `brasiliaDay(new Date())` once at render, and says
  in its own comment that it deliberately holds no `useNow`. A section whose
  finest grain is a calendar day has nothing to tick for.
- **`health-core.ts` reads its instant once.** `startInstant` converts uptime to
  a start instant when the payload lands rather than per render — an elapsed
  label would differ between two captures of the same build and commit as noise.

## Review heuristics

**Substitution test.** Could you replace the call with its result? If the answer
depends on when you ask, `now` is missing from the signature.

**Timezone test.** Would this render the same in `UTC` and in `America/Sao_Paulo`?
Run the test under both — `tests/events-core.test.ts` shows how.

**Frame test.** Where two values are compared as days, is each one in the frame
it claims? `joinMatch` compared a local day against a UTC one and the types were
identical — both `string`, both `YYYY-MM-DD`. Nothing but reading catches that.

**Aliasing test.** Does anything push the same object into an array twice? Would
a test notice if it did?

**Zero test.** Is any optional number tested with `if (x)` rather than
`if (x != null)`?

## Positive signals

- A rule's test constructs its inputs literally and asserts a value.
- `now` appears in the signature of anything that reasons about time.
- A date field's type says whether it is a day or an instant.
- Impurity sits in a hook, a route handler or a script — never in a core module.

## Warning signs

- `new Date()` or `Date.now()` inside `*-core.ts`.
- A `YYYY-MM-DD` string passed to the `Date` constructor.
- `Intl` used with no explicit `timeZone` **where the output is a calendar day**.
  Rendering an *instant* for a reader in their own zone is correct, and is what
  `kickoff.ts` and `Footer.tsx` do on purpose — each says so at the call site.
- An accumulator reused across loop iterations.
- `if (value)` guarding a number that could legitimately be `0`.
- A test that passes here and would answer differently in CI.

## Related guides

- [CLEAN_ARCHITECTURE_GUIDE.md](./CLEAN_ARCHITECTURE_GUIDE.md) — where pure logic lives.
- [UNIT_TEST_GUIDE.md](./UNIT_TEST_GUIDE.md) — what purity buys the suite.
- [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md) — the frozen clock and the frozen snapshot.
- [DEFENSIVE_CODING_GUIDE.md](./DEFENSIVE_CODING_GUIDE.md) — guarding an accumulator that has to exist.

## Checklist

- [ ] No clock read inside a core module; `now` is an argument.
- [ ] Calendar days stay strings; instants stay `Date`; `brasiliaDay` is the bridge.
- [ ] Every `Intl` call that yields a calendar day names its `timeZone`; one
      rendering an instant for a reader deliberately does not.
- [ ] No argument is mutated; any accumulator has a guard that a leak would fail.
- [ ] Optional numbers are checked against `null`, not against falsiness.
- [ ] A test that could inherit the environment sets it instead.
