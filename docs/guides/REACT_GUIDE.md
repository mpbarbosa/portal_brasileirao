# React Guide

Adapted for Portal Brasileirão from `doc_template_lib/frontend/REACT_GUIDE.md`.

React 19, TypeScript, Vite, Tailwind v4. 42 files in `src/components/`, ten hooks
at `src/`, one `src/App.tsx`.

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
| Hooks | `src/useAccount.ts`, `src/useNow.ts`, `src/usePreferences.ts`, `src/useRoute.ts`, `src/useTheme.ts`, `src/useScrolled.ts`, `src/usePageMeta.ts`, `src/useVersionWatch.ts`, `src/useStandingsMark.ts`, `src/useCampaignPlotKind.ts` |
| Composition root | `src/App.tsx` |
| Components | `src/components/*.tsx` |
| Transport | `src/api.ts` |

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
exports **`syncedAccountId`**, and `App` gates on
`syncedAccountId !== accountState.account.id` (`src/App.tsx:363`).

> **Gate on the published id, not on `accountState.status`.** A hook that
> completes asynchronously owes its consumers a value that says *I have
> completed*, because "the other state changed" is not that value.

## StrictMode mounts effects twice

Development mounts every effect twice, so **"the second request" is not a thing
a test can name**. `tests/e2e/partida-refetch.spec.ts` flips its prepared payload
behind a **flag**, never a call count.

The same property is why an effect must be idempotent and must clean up: the
double mount is a rehearsal for it.

## A `useEffect` that reads a response must read the whole response

`useAccount` returned on a 404 without reading the body. Chromium held the stream
open, the request never reached `finished`, and `waitUntil: "networkidle"`
therefore never resolved — breaking every screenshot capture while the page
rendered perfectly. Nothing errored, and the page was correct.

Consume the body on every branch, including the ones you do not care about.

## Where state and clocks live

**Clocks are owned by the components that need them, not by `App`.**
`src/App.tsx` never calls `useNow`; `src/components/LiveView.tsx`, `src/components/MeuTime.tsx` and
`src/components/SeasonEvents.tsx` each hold their own. A clock in `App` would re-render twenty
standings rows and twenty sparklines twice a minute to move four words.

That is the state-scope rule with a measured reason, and it runs the opposite way
from the reflex to lift.

**`useTheme` seeds from the DOM, not from `localStorage`.** An inline script in
`index.html` stamps `data-theme` **before first paint** — without it the page
renders dark and repaints light, a flash no CSS ordering can fix because the
choice lives in `localStorage`. The hook reads the attribute the script already
set rather than recomputing.

**Derive rather than store, and `useMemo` where it is measured.**
`src/components/ClubDashboard.tsx:112` memoises `computeRankCandles` because it re-runs
`computeStandings` at every distinct kickoff of the season — 41 ms cold and about
13 ms warm over 192 instants, against 2.8 ms for `computeRankHistory`. That is one
`useMemo`, chosen from a reading, not a reflex.

**`useVersionWatch` is fed the reading `App` already holds** for the Rodapé, so
the check on load costs **no request at all**. It re-reads `/api/health` only on
its interval and when a tab becomes visible again.

## Rendering rules that are specific to this app

**Build from a list of what is present, never from a fixed grid.** Almost every
field on the player card is optional — the competition's team payload carries no
shirt number for anyone, and the artilharia knows a name and four tallies. Nothing
renders a dash standing in for a value that was never reported.

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
- **`Button` defaults `type` to `"button"`** (`src/components/Button.tsx:138`).
  The HTML default is `"submit"`, which silently submits any enclosing form.
- **`controlClasses` exists separately from `Button`** because not every control
  is a `<button>` — the round picker is a `<select>` and the goals link an
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
  functions taking a colour.
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
2. **Effects must be idempotent and must clean up** — StrictMode mounts twice.
3. **Consume every response body**, on every branch.
4. **Put the clock in the component that needs it**, not in `App`.
5. **Derive; do not store.** `useMemo` only where a reading justifies it.
6. **Compose from what is present**; render nothing for an absent value.
7. **A shared control owns its chrome and never its layout.**
8. **Never build a Tailwind class name dynamically.**

## Current reality

- **`src/App.tsx` is 686 lines** and owns routing, every fetch, the preference
  sync and the view switch. It is the composition root and is allowed to be
  large; the pressure to watch is *rendering logic* accumulating in it, not size.
- **There is no component-level test tier.** Anything not reachable from a
  Playwright spec has assertions only where a class string can be checked
  directly — `tests/button-classes.test.ts`, `tests/scatter-corner.test.ts`.
- **No `React.memo` anywhere, and no `useCallback` discipline.** Rendering has not
  been a measured problem; the clock-ownership decision above is the one place
  render cost drove a design.
- **Props are typed and mostly narrow**, but several components accept whole
  domain objects (`Match`, `Club`) rather than the fields they use. That is
  deliberate where the object *is* the subject.

## Review heuristics

**Order test.** Does this effect read state another hook in the same component
sets? Then it needs that hook's published signal.

**Double-mount test.** What happens if this effect runs twice?

**Body test.** Does every branch of this fetch consume the response?

**Scope test.** Would this state force a large subtree to re-render for a small
change?

**Dynamic-class test.** Is any Tailwind class name built by interpolation?

**Applies test.** Did you check the computed style, or only that the rule emitted?

## Positive signals

- A hook publishes the fact its consumers actually need.
- A `useMemo` cites the measurement that justified it.
- A conditional block adds no margin of its own.
- A control's chrome comes from `Surface`, `Button` or `controlClasses`.

## Warning signs

- An effect gated on `status === "signed-in"` rather than a synced id.
- A `useEffect` that derives state from props.
- A fetch branch that returns without reading the body.
- A clock or a ticking value held above the subtree that displays it.
- An interpolated Tailwind class.
- A `min-h-*` added beside an existing `h-*`.
- A dash rendered where a value was never reported.

## Related guides

- [MOBILE_FIRST_GUIDE.md](./MOBILE_FIRST_GUIDE.md) — the design system these components render.
- [HIGH_COHESION_GUIDE.md](./HIGH_COHESION_GUIDE.md) — when a mark earns its own component.
- [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md) — the only place component behaviour is asserted.
- [REFERENTIAL_TRANSPARENCY.md](./REFERENTIAL_TRANSPARENCY.md) — why the logic behind these components is not in them.

## Checklist

- [ ] Effects gate on published values, not on sibling state.
- [ ] Effects are idempotent and clean up.
- [ ] Every response body is consumed.
- [ ] State and clocks sit at the narrowest scope that works.
- [ ] `useMemo`/`memo` added only against a measurement.
- [ ] No dynamically built Tailwind class.
- [ ] Absent values render nothing, not a placeholder.
