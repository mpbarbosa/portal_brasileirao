# Proposal: what to take from Brasileirão Pro

**Source**: `brasileirao-pro.zip` — an AI Studio prototype of a Série A analytics
dashboard (React 19 + Vite + Tailwind v4, 42 files, entirely mock data). Its design
specification is imported verbatim at
[`brasileirao-pro-design.md`](brasileirao-pro-design.md).

**Status**: proposal. Nothing here is built. Each item carries the reason it is worth
doing *in this codebase*, and the ones that are not worth doing carry the reason for
that too — the rejections are the more useful half, because most of them look like
obvious wins until you check what data actually exists.

---

## What the prototype is, and what it is not

It is a **dashboard**: fixed 280px sidebar, 12-column grid, hero banner, five detail
modals, seven tabs. It is handsome and it is dense, and it is worth being explicit that
**every number in it is invented**. `src/data/mockData.ts` is 26KB of hand-written
fixtures: possession percentages, shots on target, starting elevens, title probabilities,
an xG conversion rate of 1.42. There is no provider behind it. `@google/genai` is a
declared dependency that nothing imports.

That matters for reading its component list. A "Lance a Lance" tab is trivial when you
write the events yourself. Portal Brasileirão's constraint is the opposite one: it has a
real provider on a free tier at 10 requests/minute, and the interesting question about any
feature here is not *how would it look* but *where would the numbers come from*.

So the ideas below are sorted by that question, not by how good they look.

---

## Adopt

Five of these need **no new upstream request at all** — they are derivations of payloads
the app already holds. One surfaces a field the provider sends today and the mapper throws
away. That is the whole of the adoptable set, and it is a deliberately short list.

### 1. Forma — the last five results, as pills

*Prototype*: a `FORMA` column of five 16px pills, `V` green / `E` grey / `D` red, each
carrying a `title` attribute naming the result.

**Why it fits.** It is derivable from the fixture list the client already has, exactly as
the **campanha** is — `computeStandings` already knows which matches count
(`countsTowardStandings`), and a club's last five decided results is a filter over the same
array. No endpoint, no cache, no request budget.

**Why it is genuinely different from the campanha**, which is the objection to answer
first: the campanha is a *position* trajectory and is therefore relative to nineteen other
clubs — a club can win four straight and still fall a place. Forma is what the club itself
did. A reader looking at 6th place asks both questions and the table answers only one.

**Two traps, both already documented in this repo and both of which this column walks
straight into.**

- **The surplus sink.** `CLAUDE.md` records that auto table layout hands surplus width to
  the widest column, and that this has already gone wrong twice — once for `STICKY_CLUB`
  (a functional failure on a phone) and once for `CAMPAIGN_COLUMN` (an ~80px hole in the
  row that every existing spec passed straight through). Forma is a fixed-width mark of
  five pills and cannot absorb space either, so it needs **`w-0` for the same reason**, and
  it makes the tally columns the third thing competing for what is left.
- **The bar is not the only thing that is full.** At 360dp the frozen pair plus seven
  tallies is already tight. Forma should be `hidden md:table-cell`, following the campanha
  column's own precedent, and the club page should carry it unconditionally.

**Recommendation**: build it in `standings-core.ts` as `recentForm(matches, club, n = 5)`,
render it on the **club page first**, and only then decide whether the table has room. The
core function is the valuable half and it is testable without touching a layout.

**Accessibility note worth generalising**: the prototype puts `title="Vitória"` on every
pill. A glyph-only mark needs a name. This repo's `StatusChip` and `RankSparkline` are the
existing precedent for getting that right; match them rather than the prototype, which uses
`title` where an `aria-label` or visually-hidden text belongs.

---

### 2. Aproveitamento (%)

*Prototype*: absent, actually — this is the idea its standings table makes you notice by
omission, since it shows `P J V E D SG` and stops exactly where a Brazilian table does not.

**Why it fits.** `pontos / (jogos × 3) × 100` is the metric Brazilian football quotes by
default — ge and CBF both print it, and it is how "70% de aproveitamento" enters an
ordinary sentence about a club. It is one line of arithmetic over a `StandingsRow` the app
already computes, and it is the single cheapest thing on this entire list.

It is also the one that survives a **postponed fixture** honestly, which the points column
does not: a club a game short reads as worse than it is in the P column and correctly in
this one. `RankAtRound` already carries `played` for precisely that reason, so the codebase
has already made this argument once.

**Recommendation**: adopt. Add to `standings-core.ts` as a pure function; render on the
club page and in the classificação's row detail. Add **Aproveitamento** to `CONTEXT.md` in
the same commit — with an `_Avoid_` line for "eficiência" and "taxa de vitórias", both of
which mean something else.

---

### 3. Casa / Fora — the standings split

*Prototype*: a three-way segmented control above the table — `COMPLETA` / `CASA` / `FORA` —
that re-sorts and re-numbers all twenty rows against home-only or away-only tallies.

**Why it fits.** This is the prototype's best data idea. It is real information that the
app does not currently offer, it needs no new request, and `standings-core.ts` already
holds every part of the machinery: a home/away table is `computeStandings` with a predicate
on which side of the fixture counts, and `compareRows` sorts the result unchanged.

**One decision it forces, and getting it wrong reintroduces a bug this repo already fixed.**
football-data's `/standings` ships `HOME` and `AWAY` groups alongside `TOTAL`, and
`CLAUDE.md` records that the app reads `TOTAL` only. Taking the splits from upstream would
be the obvious shortcut and it is wrong, for the documented reason: **upstream counts
`IN_PLAY` matches and this app does not**. A live table whose Casa view credits a
half-time lead while its Completa view does not is a contradiction on one screen. Compute
all three locally from the fixture list, in every source mode.

**Recommendation**: adopt, after Forma and Aproveitamento. Note that a segmented control is
new *control* chrome — `Button`'s `tonal` variant is the closest existing pattern, and MD3
does have a segmented button spec, so this is a real component decision rather than three
`<button>`s in a row.

---

### 4. Árbitro on the match page

*Prototype*: absent. This one comes from reading the provider payload beside the
prototype's match modal and noticing which of its four tabs could have been real.

**Why it fits.** `docs/data-sources.md` records the exact shape of a football-data match
object, and it ends: `… lastUpdated, homeTeam, awayTeam, score, odds, referees`.
**`referees` is already in every response the app fetches**, and
`football-data-core.ts` drops it. Surfacing it is a mapper field, a `Match` field and a
line on `MatchPage` — no request, no cache change, no budget.

It is the only item on this list that adds information the app does not currently possess.

**Caveats to verify before building**, both cheap: the array is frequently **empty** for
scheduled fixtures and populates near kickoff, so the line must be absent rather than blank
— the same rule the player card already follows for every optional field. And the entries
carry a `type` (`REFEREE`, `ASSISTANT_REFEREE_N1`, …) whose vocabulary should be translated
at the edge under the rule `positionLabel` and `nationalityLabel` already establish: an
unmapped value renders **verbatim**, never guessed at and never blank.

**Recommendation**: adopt. Smallest genuine win here.

---

### 5. Derived league statistics — as a panel, not a section

*Prototype*: an `estatisticas` tab holding three big metric tiles (total de gols, média de
gols por partida, aproveitamento dos mandantes) and two leaderboards (melhores ataques,
melhores defesas).

**Why it fits.** Every one of those five numbers is a reduction over `StandingsRow[]` or
the fixture list. `goalsFor` and `goalsAgainst` are already on the row, so the two
leaderboards are a sort. Total goals is a sum. The home-win rate falls out of the same
predicate item 3 needs, which is why these two belong in one piece of work.

**Why it must not be a sixth nav entry, which is the whole design decision here.**
`src/navigation.ts` states the bound in its own comment and `CLAUDE.md` restates it:
MD3's navigation bar carries **three to five** destinations, there are five, and the fifth
one's padding arithmetic had to be measured at 320/360/375dp to fit at all. A sixth entry
breaks nothing, reddens nothing, and is off-spec — which is exactly why it is worth
refusing in writing rather than in a lint rule.

So this lands **beneath the Classificação**, on the section whose data it summarises, in
`Surface` cards. If it ever genuinely wants to be a destination, that is the MD3
**navigation drawer** conversation, and it should be opened as one.

**One number to drop.** The prototype's "Eficiência Mandante 54.2%" is hardcoded and its
"Total de Gols … em 380 partidas disputadas" divides by the full-season fixture count
regardless of how many have been played, so its average is wrong for all but the last
round. Divide by matches **finished**, and let a zero-match round render nothing rather
than `NaN` — the same absence-is-not-zero rule `computeRankHistory` follows.

---

### 6. A name filter on Jogadores

*Prototype*: `TeamsView` carries a search box filtering twenty clubs by name, code or city.

**Why it fits.** Twenty clubs do not need a search box. **948 players behind twenty
`<details>` elements do**, and that is what the Jogadores page is. It is pure client state
over a payload already in memory — no route change, no request — and it is the one place in
this app where a reader plausibly knows the name and cannot find the row.

**Recommendation**: adopt, filtering on the player name with pt-BR collation (`squad-core.ts`
already sorts that way, so reuse rather than re-implement — a second normaliser is how two
spellings come to disagree, as `venue-core.ts` records). A match should open the club's
`<details>` so the hit is visible rather than filtered into a collapsed section.

---

### 7. A crest fallback

*Prototype*: `TeamBadge` renders the crest, and an `onError` handler swaps in a monogram
built from the club's three-letter code, bordered in the club's own colour.

**Why it fits.** `ClubCrest` today renders the provider's CDN URL with `alt=""` and no
error path, so a CDN failure gives a broken image in twenty table rows. The app already
holds `tla` on `Club` for display, so the monogram costs no new data — noting that `tla`
is **optional** and that `code` may be a synthetic `FD-<id>`, so the fallback needs its own
fallback rather than assuming three letters exist.

**Recommendation**: adopt the mechanism, drop the club colour (see rejection 5). Keep
`alt=""` — the crest sits beside the club's name in text and the existing comment gives the
reason. This is small, and it is the only robustness item on the list.

---

## Reject, with reasons

### 1. Lance a lance, escalações, estatísticas de partida

The prototype's match modal has four tabs and **three of them cannot be built**. A
football-data match object carries `area, competition, season, id, utcDate, status,
matchday, stage, group, lastUpdated, homeTeam, awayTeam, score, odds, referees` — verified
against a live payload and recorded in `docs/data-sources.md`. There are no events, no
lineups, no possession, no shot counts, at any tier this app can reach.

The prototype's version reads convincingly because Léo Jardim, Payet and Vegetti are typed
into `mockData.ts` by hand. Building the tab and filling it from nowhere is the failure
mode `live-core.ts` was explicitly written to avoid: *a page reading "73'" when the truth is
"somewhere in the second half" is worse than one reading "bola rolando".* Same rule, larger
surface.

**Do not build these until a provider that carries them is adopted**, which is a cost
decision (`docs/data-sources.md` — Sportmonks has it and is paid), not a UI one.

### 2. Relatórios VIP — title probability, Z4 risk, xG

Three problems, any one sufficient. The numbers require a season simulation the app has no
model for. The xG figures require data no reachable provider supplies. And the "PRO
EDITION" badge gates a paywall onto a companion app that has none — this is a product
decision smuggled in as a component.

A **título/rebaixamento projection** computed from an explicit, documented Monte Carlo over
remaining fixtures would be a legitimate future feature and a genuinely good one. It is not
this modal, and it should not borrow this modal's confident percentages as a starting point.

### 3. The Direct Image Manager

The prototype lets a reader paste any URL for any crest, player photo or hero image, and
persists the overrides to `localStorage` under `brasileirao_pro_custom_images_v1`.

This is **the exact inverse of a discipline this repo built deliberately and paid for**.
Stadium and player photographs are vendored from Wikimedia Commons into `public/` and
served from this origin, with `credit`, `license` and `licenseUrl` **required** on the
record — `tests/player-photos.test.ts` asserts the data rather than the type, because the
compiler is satisfied by an empty string and an empty string reads on the page as a missing
attribution. A reader-supplied URL carries none of those fields by construction. It is
also republication of someone else's bytes with no licence check at all, which is the thing
`redistributable` in `commons-core.ts` exists to refuse.

**Reject outright.** Not "later", not "behind a flag".

### 4. Inter + JetBrains Mono

`docs/roadmap.md` M0 records the decision to ship **no webfont**: the system stack puts
Roboto fourth in Tailwind's default `--font-sans`, so Android renders in MD3's own face for
zero bytes, and the trade-off is written down there rather than being an oversight.

The mono font's actual job — mathematically aligned numeric columns — is already done by
`tabular-nums`, which the standings table uses today at no network cost. Two webfonts to
re-achieve an effect already achieved is a straight regression on a page whose readers are
on phones during a match.

### 5. The colour tokens, and club colours

Every hex in the imported spec is hand-picked. This repo's palette is **generated**: values
between the `MD3-TOKENS` markers in `src/index.css` come from `npm run sync-md3-tokens`,
each is a tone from a tonal palette seeded by `#10b981`, and `npm run test:tokens` fails if
the file has drifted *and* re-runs a contrast gate across 70 text/background pairings in
both themes. Pasting `#96d4b1` and `#2D3232` in fails that gate by construction.

The prototype's spec is also **dark-only** (`#121414` base, "optimized specifically for
dark-mode interfaces"); this app has two themes stamped before first paint, and its light
palette is deliberately not the dark one inverted.

**The club-colour accents** (`primaryColor` / `secondaryColor` per club, used as a badge
border and a banner gradient) fail the same gate for a sharper reason: twenty clubs' brand
colours are twenty uncontrolled values, several of them — Vasco's black, Botafogo's black,
Corinthians' black — invisible on a dark surface and untestable by `test:tokens`, which
only knows about tokens.

**One idea here is worth keeping.** The gold `secondary: #ffdf0a` used for the champion row
and the live badge names a real gap: this app has no accent distinct from `primary`. The
right way to get it is to **emit a tertiary role from `sync-md3-tokens`** so it arrives with
a tone, a contrast check and a light-theme counterpart — not to add a hex.

### 6. The sidebar, and the dashboard grid

The prototype runs a 280px fixed sidebar *and* a top header nav, with a 12-column
`1600px` dashboard. Portal Brasileirão is a phone-first companion app read during a match,
with a full MD3 navigation bar. Adopting a desktop sidebar is not a styling change; it is
reopening the navigation question, and the honest framing is that **the drawer is the
answer to "we want a sixth section", which nobody has yet asked for.**

The **hero card** (`HighlightHero`) is a near miss worth naming: a cinematic background
image behind a gradient is exactly the surface this app has no licensed image for.
`og:image` reasoning already covers why — see `CLAUDE.md` on why a stadium page takes the
site card rather than its own photograph. The same argument applies on-page as soon as the
image is a backdrop rather than a credited photograph.

---

## Suggested order

Each row is independently shippable. Nothing below depends on anything above it except
where noted.

| # | Item | New data? | Effort | Risk |
| :- | :- | :- | :- | :- |
| 1 | Árbitro on the match page | field already in payload | XS | none |
| 2 | Aproveitamento (%) | derived | XS | none |
| 3 | Crest fallback monogram | none | XS | none |
| 4 | Name filter on Jogadores | none | S | none |
| 5 | `recentForm` + Forma on the club page | derived | S | none |
| 6 | Forma column in the classificação | — | M | **table width**; see item 1's traps |
| 7 | Casa / Fora split | derived | M | must compute locally, never from upstream groups |
| 8 | Estatísticas panel under the Classificação | derived; shares item 7's predicate | M | must not become a sixth nav entry |

Items 1–5 are a day's work between them and carry no architectural decision. Items 6–8 each
carry exactly one, and it is named in their sections.

## Checks any of this must still clear

Stated once here rather than repeated per item:

- Every calculation goes in a pure `*-core.ts` module with its own `tests/<name>-core.test.ts`,
  and the new test file is **added to `npm run test:unit`** — a `tests/*.test.ts` that is not
  listed there does not run.
- New pt-BR terms — **Aproveitamento**, **Forma**, **Árbitro** — go into `CONTEXT.md` with
  their `_Avoid_` lines, in the commit that introduces them.
- No new `Route` variant is proposed here, deliberately. If one is added later it is a
  **four-file change** and only `structured-data-core.ts` fails the compiler; the other
  three fall through silently, and the `pageStatus` one serves 200 + a shell copy for an
  unbounded set of URLs.
- Colours are semantic tokens; radii come from the MD3 shape scale; type comes from the MD3
  type scale. A raw `slate-*` / `rounded-lg` / `text-xs` from a pasted prototype component
  is a regression.
- The e2e suite runs the frozen snapshot, so **assert shape, never value** — no round
  numbers, no scorelines, and no count of how much curated data exists.
