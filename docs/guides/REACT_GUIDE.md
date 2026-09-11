# React Guide

Adapted for Portal Brasileirão from `doc_template_lib/frontend/REACT_GUIDE.md`.

React 19, TypeScript, Vite, Tailwind v4. 46 components in `src/components/` (with
four `.ts` helpers beside them), twelve hooks at `src/`, one `src/App.tsx` —
counted on 2026-09-11. Recount rather than trust those numbers; the first version
of this guide said ten hooks while twelve existed.

## What was cut, and why

**This app ships no UI dependency at all.** Its whole runtime dependency list is
`react`, `react-dom`, `express`, `tailwindcss`, `@tailwindcss/vite` and `dotenv`.
Three sections of the source guide describe tools that are not here and are not
wanted:

- **No React Query or SWR.** Fetching is `src/api.ts` plus hooks. The payloads are
  cached server-side against a 10 req/min budget — see
  [REST_API_GUIDE.md](./REST_API_GUIDE.md) — so client-side caching would be
  duplicating a cache that already exists one hop away.
- **No Testing Library, no jsdom, no Storybook.** A component's behaviour is
  asserted in a real browser or not at all; see
  [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md).
- **No feature folders.** Files are organised by *layer*, which the source guide
  advises against, and it is right here: the pure logic lives in root
  `*-core.ts` modules **shared with `server.ts`**, so it cannot sit inside a
  `src/features/` tree.

| Layer | Where |
| --- | --- |
| Pure logic (shared with the server) | root `*-core.ts` |
| Hooks | `src/useAccount.ts`, `src/useCampaignPlotKind.ts`, `src/useMoreBelow.ts`, `src/useNow.ts`, `src/usePageMeta.ts`, `src/usePreferences.ts`, `src/useRoute.ts`, `src/useScrollEdges.ts`, `src/useScrolled.ts`, `src/useStandingsMark.ts`, `src/useTheme.ts`, `src/useVersionWatch.ts` |
| Composition root | `src/App.tsx` |
| Components | `src/components/*.tsx` |
| Transport | `src/api.ts`, and `src/drainBody.ts` for every body nobody reads |

## Effects run in declaration order, and that has cost a bug

This is the sharpest React lesson in the repository.

Effects in one component run in the order they are declared, **within one
commit**. So when the account lands, an effect declared *after* `usePreferences`
sees `accountState` already saying "signed in" while `preferences` still holds
the pre-account values.

`App`'s landing redirect ran exactly once on that render, found no landing,
latched its ref and never moved the page — with `tsc`, the unit suite and every
existing spec green. Only an end-to-end assertion on the URL could see it.

The fix is a published signal rather than an inferred one: `usePreferences`
exports **`syncedAccountId`**, and `App`'s landing redirect returns early while
`syncedAccountId !== accountState.account.id`.

> **Gate on the published id, not on `accountState.status`.** A hook that
> completes asynchronously owes its consumers a value that says *I have
> completed*, because "the other state changed" is not that value.

## StrictMode runs things twice, and not only effects

Development mounts every effect twice, so **"the second request" is not a thing
a test can name**. `tests/e2e/partida-refetch.spec.ts` flips its prepared payload
behind a **flag**, never a call count. The same property is why an effect must be
idempotent and must clean up: the double mount is a rehearsal for it.

**StrictMode also calls every `setState` updater twice, so an updater must be
pure.** `usePreferences` used to write `localStorage` and send its `PUT` from
inside `setPreferences((current) => …)`, in the reconcile effect, `toggleClub`
and `chooseLanding`. Measured, not assumed: `tests/e2e/contas-preferencias.spec.ts`
counted **two** `PUT`s for one click on the follow control, both issued in the
same flush. The server answered the same thing twice, because the `PUT` replaces
the whole set, which is why nothing had looked wrong. That was luck, not design.

The fix is to compute the next value outside, do the side effects, then set it:

```ts
const next = toggleFollow(preferences, code);
write(next);
if (account.id) upload(next);
setPreferences(next);
```

The callback then reads the rendered `preferences` and is re-created when they
change. That costs nothing here — no dependency list names it and nothing is
memoised on it — and two clicks cannot read one stale copy, because React flushes
a discrete event's update before the next event is dispatched.

## Every response body is read, on every branch

`useAccount` returned on a 404 without reading the body. Chromium held the stream
open, the request never reached `finished`, and `waitUntil: "networkidle"`
therefore never resolved — breaking every screenshot capture while the page
rendered perfectly. Nothing errored, and the page was correct.

**The lesson was learned for that one fetch and not applied to the others.** On
2026-09-11 the `usePreferences` upload still discarded its reply — the route
answers the whole account as JSON — and the error branches of `src/api.ts`,
`PlayerOverlayCard`, `TrafficView`, the sign-out and the account deletion all
returned without reading. The upload was the one reached by the suite, and
`tests/e2e/contas-preferencias.spec.ts` now waits for its `requestfinished`: it
**timed out** against the unfixed code and finishes with the fix.

`drainBody` in `src/drainBody.ts` is the rule in one place — a read, not a
`body.cancel()`, because a cancel shows in devtools as a failed request. Call it
on every branch that does not consume the body, including success replies nobody
uses and 204s.

Two things about testing it, both paid for. A `page.route` stub **cannot** see
this: Playwright completes the request accounting when it fulfils, so a stubbed
spec passes against the broken code. And the harness signs in with
`ACCOUNTS_DEV_LOGIN`, so a branch production takes (the 404 with accounts
disabled) may be one the suite never reaches — see E2E_TEST_GUIDE.

## Where state and clocks live

**Clocks are owned by the components that need them, not by `App`.**
`src/App.tsx` never calls `useNow`; `src/components/LiveView.tsx` and
`src/components/MeuTime.tsx` each hold their own. A clock in `App` would
re-render twenty standings rows and twenty sparklines twice a minute to move four
words. `SeasonEvents` deliberately holds **no** clock: it reads the day once per
render, since a timeline of acontecimentos does not change while it is read.

That is the state-scope rule with a measured reason, and it runs the opposite way
from the reflex to lift.

**`useTheme` seeds from the DOM, not from `localStorage`.** An inline script in
`index.html` stamps `data-theme` **before first paint** — without it the page
renders dark and repaints light, a flash no CSS ordering can fix because the
choice lives in `localStorage`. The hook reads the attribute the script already
set rather than recomputing.

**A fetched value is kept with what it was fetched for, and the view is derived
from it.** `PlayerOverlayCard` used to open its enrichment effect with
`setEnriched(player)`, and `StadiumWeather` with `setWeather(null)` — state reset
from a prop inside an effect. That costs a second render, and between the two
renders the previous player's shirt or the previous ground's weather is painted
under the new name. Both now store `{ id, data }` / `{ slug, weather }` and derive
at render: an answer about somebody else simply does not apply.

**`useVersionWatch` is fed the reading `App` already holds** for the Rodapé, so
the check on load costs **no request at all**. It re-reads `/api/health` only on
its interval and when a tab becomes visible again. Its first effect has **no
dependency list on purpose**: it runs after every render of `App`, and that is
what retries a reload deferred because the player card was open — closing the
card is an `App` state change. `[reading]` would leave that reload waiting for the
five-minute interval.

## `useMemo` states its reason, and there are only two

**Derive rather than store**, and memoise only for one of these:

1. **A measured cost.** `ClubDashboard`'s `allCandles` memoises
   `computeRankCandles`, which re-runs `computeStandings` at every distinct
   kickoff instant — 41 ms cold and about 13 ms warm over 192 instants. The
   measurement lives in `rank-candles-core.ts`, beside the function it measures.
2. **An identity another hook depends on.** `App`'s `knownClubs` feeds `follow`,
   and `follow` is in the landing redirect's dependency list; `rankHistory` is the
   array the Classificação keys its own campanha memos on. A fresh value on every
   render would re-run those regardless of how cheap it is to build.

Where neither holds, the call is plain. Measured over the frozen seed (20 clubs,
380 fixtures, 26 rounds; median, warm, 2026-09-11):

| Computation | Cost | Memoised? |
| --- | --- | --- |
| `computeRankHistory` (App) | 0.29 ms | yes — identity |
| `liveBoard` (LiveView) | 0.14 ms | **no** — keyed on `now`, it recomputed on every tick anyway |
| `buildStadiums` (App) | 0.002 ms | **no** — nothing depends on its identity |
| `filterSquads` with a query (PlayersView) | 0.34 ms | yes, reason unstated |
| `recentForm` × 20 (StandingsTable) | 0.24 ms | yes, reason unstated |
| `clubProfile` (ClubProfile) | 0.04 ms | yes, reason unstated |
| `clubFocus` (MeuTime) | 0.01 ms | yes, reason unstated |

Of the memoised computations measured, only `allCandles` costs more than half a
millisecond over the seed (`TrafficView`'s two have no local data to measure).
Rendering has never been a measured problem here; a memo is about identity far
more often than about time.

## Rendering rules that are specific to this app

**Build a card from a list of what is present, never from a fixed grid.** Almost
every field on the player card is optional — the competition's team payload
carries no shirt number for anyone, and the artilharia reports assists, penalties
and matches as `null` where it did not count them. The card leaves those tiles
out: `scorerTiles` in `PlayerOverlayCard` lists only reported figures. It printed
`—` for them until 2026-09-11, under a doc comment saying it did not.

**A table is the one place a dash is right.** Its columns are fixed, and a blank
cell reads as a rendering fault — so `ScorersTable` prints `countLabel`'s `—` for
an unreported figure, and the Classificação's Forma cell prints `—` before a club's first
decided match. That is the distinction to keep: on a card, absent means not
rendered; in a fixed column, absent is a dash.

**Space conditional blocks with `space-y`, not a `mt-*` per block.** A margin
belonging to a conditional block leaves a gap above whichever block happens to be
first; the artilharia card opened with exactly that.

**A layout-owning component carries no margin of its own.** `CampaignPlotToggle`
renders in three places that position it differently, so layout belonging to the
control is layout that has to be cancelled at two of the three — the rule
`Surface` already follows.

## Shared component contracts

- **`Surface`** owns the raised-panel chrome that was hand-repeated in five
  components; padding and layout stay with the caller. Use `as` when the element
  matters — `MatchPage`'s scoreboard is `as="article"`. `href` is declared on
  `SurfaceProps` because `ComponentPropsWithoutRef<"div">` knows nothing of it,
  and without that one optional string a whole-panel link does not type-check and
  the next author hand-rolls the chrome beside it.
- **`Button` defaults `type` to `"button"`** (`type={type ?? "button"}`). The HTML
  default is `"submit"`, which silently submits any enclosing form.
- **`controlClasses` exists separately from `Button`** because not every control
  is a `<button>` — the round picker is a `<select>` and the highlights link an
  anchor, and both must look identical to the buttons beside them.

## The player card is a native `<dialog>`

Opened with `showModal()`, not an overlay div: modality has to be real. It carried
`aria-modal="true"` for months while Tab walked straight out of it. The browser
gives the focus trap, `inert` behind, the top layer and focus restoration.

Two traps if you touch it:

- **Escape arrives as `cancel`, not `keydown`.**
- **Tailwind's preflight resets `margin: 0`**, which kills the user agent's
  `dialog { margin: auto }`, so horizontal centring must be set explicitly.

Body scroll is locked separately — modality does not stop the page scrolling.

## Tailwind rules that fail silently

- **Tailwind extracts class names by scanning source text**, so
  `hover:bg-${role}/8` generates **no CSS at all**. Write a second constant
  rather than making one dynamic. This is why `src/components/interaction.ts` holds plain
  strings — `STATE_LAYER`, `FOCUS_RING`, `LINK_UNDERLINE`, `BACK_LINK` — and not
  functions taking a colour. Interpolating *whole* class strings is fine
  (`${TONE[status]}`, `${zoneClass(…)}`); interpolating a *fragment* of one is not.
- **A class that compiles is not a class that applies.** A rotating disclosure
  chevron was written twice — `group-open:rotate-90` and an arbitrary
  `[details[open]_&]:rotate-90` — and *both* emitted a rule the element genuinely
  matched, while `rotate` still computed to `0deg`. The fix was to stop drawing
  the mark and let `<details>` use the browser's own `::marker`. Note the summary
  must **not** be `display: flex` or Chrome drops the marker, and that measuring
  it needs `getComputedStyle(el).rotate`, not `.transform`.
- **Do not pass a utility through `extra` that the base already sets.** Two
  utilities of equal specificity are resolved by **stylesheet** order, not class
  order, so an override is a coin flip. Change the base.
- **A `min-height` beats a `height` whatever the class order.** M9's `min-h-12`
  silently overrode an `h-10` that had just been used to level the top app bar —
  two changes each right on their own, shipping a 48×48 toggle beside a 40×97
  control.

## Required rules

1. **Gate on a published completion signal**, never on a sibling hook's state.
2. **Effects must be idempotent and clean up, and updaters must be pure** —
   StrictMode runs both twice.
3. **Read every response body**, on every branch, through `drainBody`.
4. **Put the clock in the component that needs it**, not in `App`.
5. **Derive; do not store.** Key a fetched value by what it was fetched for;
   `useMemo` only for a measured cost or an identity a dependency list needs.
6. **Compose a card from what is present**; a fixed table column may carry a dash.
7. **A shared control owns its chrome and never its layout.**
8. **Never build a Tailwind class name from fragments.**

## Current reality

- **`src/App.tsx` is 700 lines** (2026-09-11) and owns routing, every fetch, the
  preference sync and the view switch. It is the composition root and is allowed
  to be large; the pressure to watch is *rendering logic* accumulating in it, not
  size. It is not the largest file — `StandingsTable` and `TrafficView` are
  longer.
- **There is no component-level test tier.** Anything not reachable from a
  Playwright spec has assertions only where a class string can be checked
  directly — `tests/button-classes.test.ts`, `tests/scatter-corner.test.ts`.
- **No `React.memo` anywhere.** Every hook that returns a function wraps it in
  `useCallback` (`useAccount`, `useCampaignPlotKind`, `usePreferences`,
  `useRoute`, `useStandingsMark`, `useTheme`), but nothing downstream memoises on
  those identities, so it is a convention rather than a performance measure.
- **Several `useMemo`s still do not state their reason**: `StandingsTable`'s five,
  and one each in `MeuTime`, `PlayersView`, `ClubProfile`, plus `ClubDashboard`'s
  `division` and `TrafficView`'s two. Every one measured under half a millisecond
  over the seed (the `TrafficView` pair has no local data to measure), so none is
  a cost problem either way; write the reason, or make it a plain call, when you
  next touch the file.
- **Props are typed and mostly narrow**, but several components accept whole
  domain objects (`Match`, `Club`) rather than the fields they use. That is
  deliberate where the object *is* the subject.

## Review heuristics

**Order test.** Does this effect read state another hook in the same component
sets? Then it needs that hook's published signal.

**Double-run test.** What happens if this effect — or this updater — runs twice?

**Body test.** Does every branch of this fetch read the response?

**Reset test.** Does an effect set state from a prop before fetching? Key the
result instead.

**Memo test.** Can you name the measurement, or the dependency list, this memo is
for?

**Scope test.** Would this state force a large subtree to re-render for a small
change?

**Dynamic-class test.** Is any Tailwind class name built from a fragment?

**Applies test.** Did you check the computed style, or only that the rule emitted?

## Positive signals

- A hook publishes the fact its consumers actually need.
- A `setState` updater computes and does nothing else.
- A `useMemo` names its reason: a measurement, or the dependency list that needs
  its identity.
- A conditional block adds no margin of its own.
- A control's chrome comes from `Surface`, `Button` or `controlClasses`.

## Warning signs

- An effect gated on `status === "signed-in"` rather than a synced id.
- A `useEffect` that resets state from props.
- A `write`, `upload` or `fetch` inside a `setState` updater.
- A fetch branch that returns without reading the body.
- A clock or a ticking value held above the subtree that displays it.
- An interpolated Tailwind class fragment.
- A `min-h-*` added beside an existing `h-*`.
- A dash on a card where a value was never reported.

## Related guides

- [MOBILE_FIRST_GUIDE.md](./MOBILE_FIRST_GUIDE.md) — the design system these components render.
- [HIGH_COHESION_GUIDE.md](./HIGH_COHESION_GUIDE.md) — when a mark earns its own component.
- [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md) — the only place component behaviour is asserted.
- [REFERENTIAL_TRANSPARENCY.md](./REFERENTIAL_TRANSPARENCY.md) — why the logic behind these components is not in them.

## Checklist

- [ ] Effects gate on published values, not on sibling state.
- [ ] Effects are idempotent and clean up; updaters are pure.
- [ ] Every response body is read, through `drainBody`.
- [ ] A fetched value is keyed by what it was fetched for, not reset in an effect.
- [ ] State and clocks sit at the narrowest scope that works.
- [ ] Each `useMemo` names a measured cost or a dependency list that needs it.
- [ ] No Tailwind class built from a fragment.
- [ ] Absent values render nothing on a card; a dash only in a fixed table column.
