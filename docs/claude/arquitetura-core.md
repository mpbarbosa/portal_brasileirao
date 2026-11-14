# Arquitetura: servidor e módulos `*-core.ts`

*Quando ler:* Leia antes de criar ou mexer num `*-core.ts`, ou ao tocar em `server.ts`.

Extraído do `CLAUDE.md`, que ficou um índice. Esta é a fonte canônica do assunto.

---

## Single-process server

`server.ts` is one Express server that owns the API routes, mounts Vite as middleware in
development, and serves `dist/` statically in production with an SPA catch-all. Dev and
prod run the same process — there is no separate frontend server to start. `resolveAppPort`
probes ports and walks upward from `PORT` so a stale dev server doesn't block a restart;
`STRICT_PORT=true` makes it fail instead, which is what CI wants.

## Pure `*-core.ts` modules

Calculation and integration logic lives in root-level `*-core.ts` modules that perform **no
I/O** — data in, data out. `server.ts` does any fetching and passes payloads in. Each core
module is imported by both `server.ts` and its own `tests/<name>-core.test.ts`, which is
what makes the logic testable without mocking HTTP.

- `standings-core.ts` — builds the table from a club list and a match list. `computeStandings`
  counts only `FINISHED` matches carrying both scores (a `LIVE` partial score must not move
  the table), emits a zeroed row for every club so an empty round renders 20 rows rather
  than a blank table, and drops fixtures naming an unknown club instead of throwing.
  `compareRows` implements the CBF tie-break order — points, wins, goal difference, goals
  scored — then falls back to club name for determinism. The regulation continues past that
  point (head-to-head, cards, draw) but needs data the app doesn't carry yet.
- `matches-core.ts` — round filtering and feed ordering. `compareForFeed` puts LIVE first,
  then SCHEDULED, then FINISHED. `currentRound` is the earliest round holding an unfinished
  match, else the last round.
- `live-core.ts` — the **Ao vivo** board: `liveBoard` splits the season into what is being
  played, what is next and what just finished, and `countdownLabel` writes the contagem
  regressiva. Takes `now` as a parameter, like `currentRound`. It computes **no match
  minute**, deliberately: the provider reports a status and a score and never an elapsed
  clock, and minutes-since-kickoff stops being the true minute at half-time — a page
  reading "73'" when the truth is "somewhere in the second half" is worse than one reading
  "bola rolando". A fixture whose kickoff has passed while upstream still calls it
  SCHEDULED keeps its place under "A seguir" for `LATE_GRACE_MS`, because upstream is
  polled rather than pushed and dropping it would hide a match during exactly the window
  the page exists for.

- `next-match-core.ts` — the **Próximo jogo do meu time**: which single fixture to
  put in front of a reader who follows a club. `clubFocus` prefers a match **in
  progress** over one that is merely sooner, because a club can be on the pitch
  while upstream still calls a later fixture SCHEDULED — "earliest kickoff" is
  the wrong rule and reads as right. It takes `now` as a parameter like
  `liveBoard`, reuses that module's `LATE_GRACE_MS` rather than picking its own
  window (two answers to *when does a fixture stop being next* is how the home
  page comes to name a match the Ao vivo board has already dropped), and reuses
  `club-core.ts`'s `playsIn`/`clubMatches` rather than restating them.
  **It is not `nextFixture` in `club-core.ts` and neither should be rewritten in
  terms of the other.** That one has no clock, so it counts a postponed fixture
  and a kickoff that passed an hour ago as still to come — right for a club's
  season at a glance, wrong for a line telling a reader when to sit down.
  The countdown is **not** reimplemented here: `countdownLabel` in `live-core.ts`
  already writes it, so the strip and the board say the same words about the same
  fixture. The sibling repo this was modelled on ships two functions named
  `formatCountdown` in two modules, which is the drift `StatusChip` exists to
  prevent. `isImminent` — a day, or already under way — is the whole of what
  makes the strip an *alert*, and it is one predicate rather than a comparison
  written into the component; it changes the rail's colour and never the wording,
  so there is only one sentence to keep true.
  Rendered by `FollowedClubStrip`, which owns its own `useNow` tick for the reason
  `LiveView` does — a clock in `App` would re-render twenty rows and twenty
  sparklines twice a minute to move four words. There is deliberately **no
  `aria-live`** on the contagem regressiva: a polite region would interrupt a
  screen-reader user every 30 seconds with a number they cannot act on.
  **The LIVE branch is unreachable from the frozen snapshot** — `src/data/matches.ts`
  holds no LIVE fixture and the suite boots with `DISABLE_FOOTBALL_DATA=true` — so
  `tests/e2e/meu-time.spec.ts` serves one prepared payload with a fixture flipped.
  Prepared once and fulfilled from memory, never `route.fetch()` per request: a
  proxying handler came back as something other than the envelope under the
  suite's seven workers, and passed in isolation.

- `rank-history-core.ts` — every club's position after each round (the **campanha**),
  plus the sparkline geometry that draws it in the Classificação. The **client** computes
  this from the `/api/matches` payload it already holds — the whole season ships in one
  response, so a second endpoint would buy nothing. Note the sparkline is therefore
  derived from the fixture list while the row's position comes from `/api/standings`: with
  a live provider the two legitimately differ by a place mid-round, for the IN_PLAY reason
  documented above. The mark is a trajectory, not a restatement of the position column.
  Both sparkline axes are shared across every row, because a per-row scale would make a
  club oscillating 1st–3rd look like one climbing from 20th.
  `computeRankHistory` re-runs `computeStandings` once per round rather than keeping an
  incremental tally: the CBF tie-breakers are what decide a position, and a second
  implementation of them is how a history comes to disagree with the table it describes.
  38 rounds × 20 clubs is a few thousand operations. It stops at the last round with a
  result — "no position yet" is an absence, not a zero.
  **The reader chooses the mark: `sparklinePoints` draws the linha, `sparklineBars`
  the barras, and one button above the Classificação flips between them.** The two
  do not share an axis convention and must not be made to. A line joins the position
  taken *at* the end of a round, so the x span is `lastRound - 1` and the first and
  last points sit on the box's edges; a bar covers the round as a band of
  `lastRound`, and — this is the load-bearing half — its meaning is its **length**,
  so it needs a zero. The zero is the foot of the division, which is why the y
  denominator is `clubCount` and not the line's `clubCount - 1`: with the line's
  span, last place maps exactly onto the baseline and draws a bar of height **zero**,
  which reads as a missing round rather than as 20th. A sliver is the honest picture
  of last place; nothing is a rendering fault.
  The choice is `campaign-plot-core.ts` — `theme-core.ts`'s shape to the letter, and
  in `localStorage` for `theme-core`'s reason rather than in `preferences-core.ts`:
  ask which side *owns* a key before asking how to reconcile it, and a plot kind is
  owned by the screen being read. No second side can hold a value, so there is
  nothing to merge and no clock to buy. It also needs **no inline script in
  `index.html`**, unlike the theme: the theme decides the colour of every pixel and
  repainting it is a flash, while this decides one 72px mark in a table whose rows
  have not landed at that point.
  **`App` owns the choice and all three campanha sections receive it**, which is
  `useTheme`'s arrangement — and **no test defends it**, which is the part to know
  before "simplifying" it back. Calling `useCampaignPlotKind` in the Classificação,
  `ClubDashboard` and `MatchPage` independently was built and run: **all 184 specs
  across the three suites pass**, including the two that navigate between sections
  and assert the mark carried over. (That reading was taken while the second
  section was `ClubView`; the sparkline has since moved to the **Painel**, which
  changes which component holds it and nothing about the argument.) They pass because a route change unmounts the other
  two, so the copies never coexist long enough to disagree — a property of the
  router, not a decision anybody made, and one that ends the first time two campanha
  sections render at once. The arrangement is held by this paragraph and by nothing
  else, which is the same shape as the shape-scale step: the vocabulary is enforced
  and the choice is not.
  **The toggle renders in three places and carries no margin or alignment of its
  own**, because the three place it differently: right-aligned above the table,
  and sharing the `Campanha` heading's row on the **Painel** and the **Partida**
  pages. Layout belonging to a
  control is layout that has to be cancelled at two of the three — the rule
  `Surface` already follows.
  In the Classificação it sits **above the table and outside the scrolling
  `Surface`**, for the reason the zone key sits below and outside it — that Surface
  is the horizontal scroll container, and Campanha is one of the columns that
  scrolls, so a control placed within it leaves a narrow-screen reader looking at
  the mark with its own control off-screen. It is deliberately **not** in the column
  header, which is where it looks like it belongs: `CAMPAIGN_COLUMN` is `w-0` so the
  column measures its 72px mark, and a control in that `<th>` would become the
  column's widest content and take the table's surplus straight back — the
  regression the "no wider than the mark it holds" spec exists for.
  The **Partida** page gets **one** control for the section rather than one per
  club: the two campanhas there are read against each other, and a page that could
  draw one as a line and the other as bars would be comparing two pictures rather
  than two clubs.
  **`rankMovement` is the same campanha read at its shortest — the variação**, one
  round against the one before it, drawn as a triangle beside the position. Both
  ends go through `positionAfterRound` and that is the whole decision: the row's
  own position comes from `/api/standings`, which counts `IN_PLAY` where this app
  does not, so *that* number minus a campanha position would be a real movement
  plus a disagreement between two sources — appearing and vanishing as matches
  kick off, and contradicting the sparkline in the same row while it did. It is
  `scatterTrail`'s rule, which takes the built scatter rather than the division.
  It returns a **direction and a count, never a signed number**, because the sign
  of a position runs backwards — 5º → 3º is a club climbing while its position
  falls — and every call site that subtracts is one `-` from drawing the arrow the
  wrong way, which is read rather than checked. A round with no round before it
  returns **null and not "same"**: nobody held a position they had never had, so
  round 1 draws twenty empty cells rather than twenty clubs standing still.
  The unit tests carry a property the per-club cases cannot see — **every place
  climbed is a place another club fell**, since a round's positions are a
  permutation — and `tests/e2e/standings.spec.ts` asserts it again off the words
  the rows actually say, where it also catches a lookup keyed to the wrong clubs.
  Five mutations were confirmed red, and one of them is worth recording because it
  is the one the permutation property does **not** catch: flipping the direction
  comparison swaps which total is which and leaves them equal.
  It is suppressed under **Casa** and **Fora** with the leader disc, the rails and
  the mark column — a whole-season movement beside a table re-ranked over a subset
  describes a different table from the one the row is in. That is #248's rule
  rather than a new judgement, and #248 is the commit that shipped having asked
  three of those five.

- `rank-candles-core.ts` — the **Painel do clube** (`/painel/<clube>`): the same
  campanha read one level closer, as a candle per rodada. **The sparkline is on
  this page too, directly above it**, and that is where the whole of a club's
  campanha now lives — the club page carries the door and no drawing. The line
  and the candles are one answer at two grains, and while they sat on two pages
  a reader comparing them was navigating rather than looking; the club page's
  own comment already said the painel was "the same subject read further", one
  click away. It exists because the
  sparkline joins the position held at the **end** of each round, so a round is one
  point and its inside is invisible — a club that sat 4th on Saturday night and
  finished the round 9th because three rivals played on Sunday draws the same
  segment as one that walked calmly down. The **corpo** runs open → close, and the
  **pavio** spans every position held while the round was played.
  **The intra-round positions are real, not interpolated**, and that is the whole
  of what the module computes: it re-runs `computeStandings` at each distinct
  kickoff instant of the round, so a snapshot is a table somebody could have looked
  at. Distinct instants rather than one per match, because four fixtures at 16:00
  on a Saturday resolve together and treating them as four steps would invent three
  tables nobody saw. **Measured rather than estimated**, since the page computes this
  on the main thread while it renders: a season played out to the last round is 192
  distinct kickoff instants across 380 fixtures, and `computeRankCandles` over it
  takes 41ms cold and about 13ms warm — against 2.8ms for `computeRankHistory` over
  the 24-round seed. A reading on this workstation on 2026-08-31 rather than a
  constant; what it is here for is the order of magnitude, which is one `useMemo`
  and not a jank budget.
  **What is counted at each step is the round's own state, never the wall clock**,
  and getting that backwards is the trap. A partial table inside round *r* counts
  everything from rounds before *r* plus the round-*r* matches that have kicked off
  by this instant. Filtering on kickoff alone lets a postponed round-3 fixture
  played in June drop out of the table at the start of round 20 — the club appears
  to fall several places and climb back, a swing that never happened, because
  `open` (the previous round's close) counts that fixture and a wall-clock filter
  does not. With the round convention a round's last partial **is** its close, by
  construction, so the candle's close is the campanha's own position.
  Nothing here re-implements a ranking rule: positions and points come from
  `computeStandings` and the per-round result from `club-core`'s `resultFor`, for
  the reason `computeRankHistory` re-runs the table rather than carrying a tally.
  `tests/rank-candles-core.test.ts` asserts every close equals `computeRankHistory`'s
  position for the same round, which is what makes that a property rather than a
  coincidence.
  **Colour carries the result and the geometry carries the direction**, and they
  are deliberately not the same channel — the rounds worth looking at are the ones
  where they disagree, and a club winning while it drops a place is an ordinary
  Sunday. So a candle needs a third mark to say which end it opened at, which is
  the stub on its left; 38 of those trace the same path the sparkline draws, since
  each round opens where the last closed.
  A round the club did not play is drawn **hollow** rather than in a grey fill: it
  sat next to an empate drawn in `ink-muted`, two greys a step apart on a 5px mark,
  and neither the marks nor the two swatches in the key could be told apart at
  343dp. Colour cannot separate a result from the absence of one when both are
  neutral by definition.
  Two things about the drawing are worth knowing before "fixing" them. The y
  domain is the **whole division**, so a leader's painel leaves its lower two
  thirds empty — that is what makes two clubs' painéis comparable and what gives
  the G4/Z4 guides a meaning. And **round 1's pavio is wide for everybody**,
  because before a club's first match the clubs level on nothing are ordered by
  name: the table really did show them there, and the alternative is a special
  case that hides a round of real data.
  The axes are **HTML around the SVG, never `<text>` inside it** — a drawing that
  scales to its container scales its type with it, so a label sized for a desktop
  is six pixels tall on a phone. Below `sm` the box takes a fixed height and
  `preserveAspectRatio="none"`, because at 2.4:1 a 343dp phone gets 143px for
  twenty position bands and a season reads as a strip of dashes; the marks are
  filled rects, so a non-uniform scale changes their proportions and nothing else.
  The SVG is `grow min-w-0` and **not `w-full`**: in a flex row `w-full` is 100% of
  the container rather than of what the y-axis gutter leaves, and with
  `overflow-visible` the last candles painted outside the card while every
  assertion about them passed. `tests/e2e/painel.spec.ts` measures the drawing's
  box against the panel's, and was confirmed red against that markup.
  **`eventMarks` puts the ACONTECIMENTOS on the same drawing, and the whole of
  it is one join: candles are indexed by rodada, an acontecimento is dated by a
  Brazil-local day.** The rule is drawn at the **boundary between two candles**,
  never over one — the sacking happened *after* round 6 closed, so shading round
  6 would claim the round that is precisely not covered by it.
  **The boundary is anchored on THIS CLUB's matches, and the round's own
  calendar is the trap.** A rodada is not an instant: its fixtures spread over
  three or four days. Cruzeiro sacked Tite late on Sunday 15 March; Cruzeiro's
  own round-6 match kicked off 20:30 BRT that evening, and **another round-6
  fixture was played on the 16th** — so "the last round that had *finished*"
  answers 5, and the rule lands before a match the club had already played under
  him. Reading the club's own fixtures answers 6. It is also the only anchor
  that means anything here: this is one club's season, so the reader's question
  is *which of these candles are before and which after*, and only the club's
  own matches divide them.
  It goes through `brasiliaDay` rather than the ISO date's first ten characters,
  which is the second half of the same trap — a kickoff at `02:00Z` is the
  previous evening in São Paulo, and slicing the string files it under the wrong
  day. That is `events-core.ts`' rule met from the other side: **that** module
  never constructs a `Date` because a `YYYY-MM-DD` read as one is midnight UTC,
  while a `kickoff` is a real instant and `brasiliaDay` is the named bridge.
  **`touchesClub` decides membership rather than a scope test written here**, so
  the paralisação para a Copa marks all twenty painéis for the reason it appears
  in all twenty timelines — which also means **no painel ever has zero marks**,
  and the sentence added to `CandlesKey` is never orphaned. On a **comparação**
  each drawing takes its own club's acontecimentos, and because both share the
  division's frame the general rule lands at the same x on both: a reader can
  drop a vertical line through the pair. Passing the subject's code to both is
  the mutation `tests/e2e/painel.spec.ts` was confirmed red against, and it is
  the one the other three cases pass — the wrong club's rules are still
  well-formed rules, which is why that spec checks the comparison figure against
  that club's **own** painel rather than against a list written in the spec.
  **The notch at the top of each rule is a rect and deliberately not a
  triangle**, for the reason stated one paragraph up: below `sm` the drawing
  scales non-uniformly, which is safe for filled rects and turns anything else
  into a shape whose proportions the reader's viewport decides. The rules are
  painted **before** the candles, like the G4 and Z4 guides, because a dashed
  line across a body reads as part of the body.
  **The band is computed and nothing renders one**, which is a measurement
  rather than a stub: a span shades the rounds it covers, and the one span this
  season ships covers none — the last round-18 match was played 31 May and the
  first round-19 match 16 July, so the paralisação collapses onto its own
  boundary and its width is zero. `EventMark.width` says so at the field.
  The acontecimentos are **named beneath the drawing in a `ul`, never a second
  `p` of spans**: `tests/e2e/painel.spec.ts` reads this figure's axis ends as
  `figure p span`, so a paragraph there would be caught by that selector and
  redden a spec that has nothing to do with acontecimentos. The list prints
  `EventMark.label`, the same string the mark's `<title>` carries, so a hover
  and the list cannot come to say different things about one rule.

- `scouts-core.ts` — the **Perfil** at the foot of the Painel: six rates read
  against the division rather than on their own. It exists because the
  Classificação and the campanha both report *where a club has got to* and
  nothing here reported *how it plays* — a side 4º em finalizações and 20º em
  conversão has an identity the table can only show the consequence of.
  Its input is `src/data/club-scouts.ts`, a committed file, so the section costs
  no request and cannot fail; and it is **stale by construction**, the source
  being a weekly snapshot, which is why the caption names the rodada it runs
  through instead of implying it is live — `StadiumWeather`'s rule.
  **`clubProfile` takes the whole division to describe one club**, for
  `computeRankCandles`' reason: 13 desarmes por jogo is either the most or the
  least in the league and the number alone cannot say which. Rank counts clubs
  strictly above, so a tie shares a place and the next is 7º.
  **`finishes` adds four counters, not three.** The source stops counting a shot
  once it is a goal, so a total of the three shot columns omits every goal — and
  a club scoring more than it misses would convert above 100%.
  **The mark is a position on the division's own range, and deliberately not a
  bar from zero.** That inverts the rule `sparklineBars` states one section up,
  and the inversion is the point: a bar means its *length* so it needs a zero,
  while a marker means its *position* so it does not. Measured before choosing —
  from zero, the twenty clubs' conversão bars occupy **65% to 100%** of the
  track and the division looks alike, because the information here is in the
  spread and a zero-based bar throws the spread away. Last place therefore sits
  at the left end rather than at nothing, which is the failure the zero rule
  exists to prevent, reached by the other road.
  Nothing here restates a result: gols sofridos and gols contra have
  authoritative answers in `/api/standings` and `src/data/goals.ts`, and the
  scout copy of each is measurably worse. `goals` is carried only as the
  numerator of the conversion rate.
  **`profileScatter` is the second half, and it is a different mark under the
  same rules.** The strip reports six rates one at a time; the scatter puts two
  on one drawing, because the fact worth seeing is a *pair* — a club finalizando
  muito whose goleiro also works hard is playing an open game, and one doing the
  first without the second is controlling matches, and those two are identical
  on every row of the strip. It **pads the domain by 6%** so the division's
  highest and lowest are not centred on the frame with half their mark outside
  it, which is `RankCandles`' painting-outside-the-card failure one mark down;
  and it returns **null below three clubs**, because a scatter is a claim about
  a distribution and two dots with a median line is a chart shaped like an
  argument nobody can make.
  `quadrantLabel` names the corner in words rather than in `<text>` inside the
  SVG, for `RankCandles`' reason, and the four names are **descriptive rather
  than appraising** — "jogo aberto" is a fact about how a match goes where
  "melhor ataque" would be a verdict two rates cannot support.
  **The y axis counts defesas, not finalizações sofridas**, and the label says
  exactly that: a defence beaten often in front of a beaten goleiro reads lower
  than the pressure on it was. It is a proxy, and the honest way to ship one is
  to name what it counts — `providerLabel`'s rule.
  **`scatterTrail` is the rastro, and it takes the built `ProfileScatter`
  rather than the division.** That is the decision the whole mark rests on: the
  axes come from the scatter, so the frame is frozen at the current rodada *by
  construction* and the function has no domain of its own to get wrong.
  Recomputing the domain per rodada would move the frame and the mark together,
  and a club could climb the drawing while standing still. It reads its rates
  through `rawValue`, the same switch the dots use, so the rule that
  finalizações add four counters and the rule that conversão at zero shots is an
  absence cannot be written twice and drift — which is why `rawValue` now takes
  a structural `ScoutCounters` whose four undrawn fields are **optional**: a
  history row genuinely has no desarmes, and an optional field makes that a
  `null` rate the strip already drops, where filling it with 0 would report a
  club that tackles nobody.
  **It plots the last EIGHT rodadas and not the season, and that was measured
  rather than chosen.** A whole-season rastro puts **34% of its points outside
  the frame, overshooting by up to 1.40 of the box**; windowed to eight, the same
  points fall outside 12% of the time and overshoot by at most **0.14**. The
  first design blamed early-season noise and put a floor on matches, which does
  not work: raising it from 5 to 15 throws away half the trail to reach 17%. The
  cause is not noise but **convergence** — the league mean is flat across the
  season (10.0 to 9.7 finalizações a game, 3.0 to 3.0 defesas) while the spread
  narrows from 5.3–16.3 at rodada 3 to 7.9–11.7 at rodada 25, and a frame padded
  6% around where twenty clubs *ended* cannot hold where they began. Widening the
  frame to fit was measured too (×1.26 median, ×2.40 worst) and rejected on a
  second ground: the domain would then depend on whose painel you are on, so two
  clubs' drawings stop being comparable — the property `RankCandles` uses the
  whole division to protect. `MIN_TRAIL_MATCHES` survives beneath the window for
  the opening of a season, where eight rodadas reaches back to rodada 1.
  **The points are clamped into the frame, and the clamp is not decoration**: at
  12% of points it is what stops the line painting outside the box, which is the
  failure `tests/e2e/painel.spec.ts` measures. A clamped point reads as *at or
  beyond the edge of today's division*, which is the honest answer.
  **Segments, not one `<polyline>`.** A single line cannot fade along its length
  without an SVG gradient — a `<defs>`, an id unique across two figures on one
  page, and a colour that stops being a theme token. Seven `<line>`s ramp from
  0.15 to 0.55 and carry the direction of travel with no seta and no legend
  entry beyond the swatch. Watch the two-point case: there is one segment and no
  ramp to sit on, and the obvious `Math.max(1, length - 2)` guard paints that
  lone segment at the *oldest* opacity, which is the faintest thing on the
  drawing.
  **The two caveats live in `ScatterKey`, not in either figcaption**, because
  they are true of both drawings where a caption is one club's reading: the line
  is a **média acumulada** and not a rodada's own figures, and the frame and
  corner names are **today's** division. Without the second, a rastro crossing a
  mediana reads as a club that changed corner that week.
  **The scatter scales uniformly and is capped in width**, unlike the candles.
  `preserveAspectRatio="none"` is available to `RankCandles` because its marks
  are filled rects; a circle under it becomes an ellipse whose eccentricity is a
  property of the reader's screen. Uniform scaling then makes a width cap
  necessary rather than decorative: uncapped, the figure renders as tall as the
  card is wide — one chart taller than the whole strip above it — and flattening
  the box instead would compress the y axis and misreport the distance between
  two clubs, which is the one thing the drawing is for.
  **What is general and what is about this club are two blocks, not one
  paragraph**, and the caption shipped as the second before it was the first.
  It read *"Cada ponto é um clube; o cheio é o Palmeiras, com 10,4 finalizações
  por jogo e 3,1 defesas do goleiro por jogo — jogo aberto: finaliza muito e o
  goleiro trabalha muito. As linhas tracejadas são as medianas da divisão."* —
  one run of prose in one weight, in which a reader after this club's reading
  steps over how the drawing works to reach it, and does so **twice**, since
  the page carries two scatters and each said the general half again.
  How the marks work is now `ScatterKey`, stated **once for the section**
  beside the strip's own key, the recency and the credit — the arrangement the
  campanha's plot toggle already takes on the Partida page, and for the same
  reason: two figures sharing a vocabulary entirely make a reader check whether
  two statements of it agree. What is left in each `figcaption` is one club's
  reading, marked as such by a rule in `primary` down its left — the colour of
  the mark it describes, which is what ties four lines of text to one dot
  without naming the club's dot in prose under both drawings.
  `axisFigure` and `quadrantParts` exist because that block sets a figure and
  its unit, and a corner's name and its gloss, at **different weights** — and
  both are the source the one-sentence forms compose *from*, never a split of
  them. Recovering "10,4" from `axisPhrase` by cutting at the first space is how
  a caption comes to print `3,1 defesas` as the figure; recovering "jogo aberto"
  by cutting `quadrantLabel` at its colon is one editorial comma away from
  rendering half a sentence as a heading. So `corners` holds `{ term, gloss }`
  rather than four strings, and `tests/scouts-core.test.ts` checks the two
  halves **separately** — a `Set` of four *objects* has four members whatever
  they contain, so the distinctness case that survived the change would have
  passed against anything.
  **The x axis's labels live in the drawing's own grid column**, which is what
  the complaint that started this was actually about. In the flex row they had,
  the label row spanned the y gutter as well, so "menos finalizações" sat
  directly beneath the y axis's "menos" — two axes' labels stacked into what
  reads as one broken sentence. `col-start-2` in a
  `grid-cols-[auto_minmax(0,1fr)]` puts them under the box and needs no spacer
  cell, and it is font-independent where a hand-tuned indent is not. Note the
  svg's `w-full` became correct in the same move: inside a grid track it is
  100% of the track, where in the flex row it was 100% of the container rather
  than of what the gutter left — `RankCandles`' painting-outside-the-card bug,
  which is why that class carried a comment forbidding it.
  **The drawing names the reader's corner, on itself.** The four quadrants are
  the whole point of the pairing, and until this landed nothing on the picture
  said which one a club was in — the medians divide the box into four
  equal-looking regions and the corner was stated only in prose beneath. So the
  subject's quadrant is **tinted** and the corner's **term printed over it**, and
  the dot carries a **ring**. `fill-surface-container` for the tint, one tonal
  step up from the card: a *surface*, not an accent at low opacity, which would
  be a state layer and MD3 spends those on interaction.
  `subjectQuadrant` is what makes that safe. It returns `aboveX`/`aboveY`
  **alongside** the phrase, and `quadrantParts` and `quadrantLabel` compose from
  it, because the tint, the label and the sentence a screen reader hears are one
  reading of one club. A component comparing the medians itself to place a tint
  is how a drawing comes to shade one corner while the caption names another —
  and the two would differ only for a club sitting on a median, which is the
  case nobody looks at and nobody writes a fixture for.
  **The label is HTML over the SVG, never `<text>` inside it** — `RankCandles`'
  rule, the same one that already put the axes outside the drawing — and it sits
  in the outer angle of its quadrant, the one region `PAD` guarantees is empty.
  **A left-hand label drops a line, and that asymmetry is load-bearing.** The y
  axis's own "mais"/"menos" live in the gutter at the box's top and bottom
  edges, 8dp from the frame, so a label hugging a *left* corner lands on their
  baseline and *"mais jogo recuado"* reads as one phrase — which is exactly the
  run-on the previous pass had just removed from the x axis, reappearing one
  axis over. A right-hand label keeps its corner, where there is nothing beside
  it, and asserting that is what stops the fix being "generalised" to all four.
  **No browser spec can reach three of those four cases**, which is why
  `cornerPlacement` is exported and `tests/scatter-corner.test.ts` asserts the
  class string — `tests/button-classes.test.ts`' precedent. `openPanel` opens
  the table's **leader**, which on any plausible table is above the median on
  finalizações, so every rendered assertion about this label is about a
  right-hand one: the case that had the bug is the case the end-to-end suite
  cannot see. That is the Perfil marker's trap again — an assertion that passes
  for eighteen of twenty clubs passes against the bug it names.
  **The ring's radius is bounded by `PAD`, not chosen by eye.** The padded
  domain leaves the division's extreme club about 10.7 box units of clearance on
  the short axis, so a wider ring paints outside the frame for whichever club is
  that extreme — never the club whose panel is open while somebody picks a
  radius, and `no dot is drawn outside the box it is plotted in` is what would
  catch it, on a different club's page.
  **The Painel now carries three `role="img"` drawings and two `<figure>`s.** A
  spec written when it had one of each resolves to all of them, which is why the
  scatter's `<svg>` takes `data-scatter-svg` and its figure `data-scatter` —
  `data-candles`' device, one mark later. Specs across `painel.spec.ts` and
  `standings.spec.ts` have had to narrow repeatedly — count the
  `data-scatter-svg` lookups rather than this sentence, and note the twenty-dot
  count itself moved from `circle` to `circle[data-scatter-point]` when the
  subject gained a ring: counting **elements** rather than marks-for-clubs is
  what obliged that lookup to be loosened by one every time the drawing gained
  a decoration — and they went red
  rather than quiet, which is the whole reason those lookups are written
  negatively. The second round is worth reading before adding a mark: a
  `figure`-wide `circle` count went to 21 the moment the caption carried a
  **swatch of the mark itself**, and `figure svg` became two svgs, which is a
  strict-mode violation rather than a wrong answer. Both now select through
  `svg[data-scatter-svg]`, so a key may gain a swatch without loosening an
  assertion about what the drawing plots.
- `venue-core.ts` — the **Página do estádio**. `buildStadiums` groups fixtures into
  grounds, because **a stadium is not an entity in any payload**: football-data has no
  venue field at any tier, and CBF reports only a `Stadium - City - UF` string per match.
  Identity is therefore the **slug** of that string, which is what makes `ARENA MRV` and
  `Arena MRV` one stadium rather than two — CBF's casing drifts by design, since
  `venues.ts` stores its values verbatim rather than guessing at proper names. It reuses
  `slugify` from `slug-core.ts` deliberately; a second normaliser is how two spellings of
  one ground come to disagree. Home clubs are derived from who hosted there, so the page
  needs no curated club list. A fixture whose venue slugs to nothing is skipped rather
  than bucketed under an empty key, which would collect unrelated grounds into one page.
  `stadiumPhotoUrl` builds the address of a vendored photograph on **our own
  origin**, keyed by stadium slug and width; `stadiumPhotoPage` still builds the
  Commons file-page link the licence requires. `PHOTO_WIDTHS` lives here rather
  than beside the `<img>`, because `sync-stadium-photos` writes exactly those
  files — two copies of that list is how the page comes to request a size nobody
  vendored, which fails as a missing image rather than as a build error.

- `goals-core.ts` — the **gols** under the Partida scoreline: who scored, and for
  which club. It exists because **no football-data tier this app can reach
  carries goal events** — verified against a live Série A match *and* a live
  Premier League one, both free TIER_ONE, both answering 200 with **no `goals`
  key at all**, not an empty array. The events come from CBF's own match
  endpoint, `/api/cbf/jogos/{id_jogo}`, read by `scripts/sync-goals.ts` on a
  workstation into `src/data/goals.ts` and merged in `server.ts` like
  `broadcasts.ts` — production never calls CBF.

  **`Goal.clubCode` is the club the goal *counts for*, not the scorer's club**,
  and the whole design turns on that distinction. **CBF files an own goal under
  the club of the player who scored it**, so it counts for the other side, and
  `goalsFromRegistros` flips it. Measured rather than assumed: Grêmio 2x0
  Vitória is listed as a `CT` by Camutanga — a *Vitória* player — plus one
  Grêmio goal, which counts 1x1 against the reported 2x0 until the flip.

  **The vocabulary is closed, and that decision paid for itself within a day.**
  `isKnownGoalResult` reports whether a `resultado` is one actually observed,
  and the sync **refuses** a code it does not know rather than filing it as
  ordinary — deliberately the opposite of `refereeRoleLabel` one module over,
  where an unmapped value renders verbatim, because there the cost of being
  wrong is an English word on the page and here it is a wrong scoreline. The
  first build knew only `NR` and `PN`; the first season-wide sync **refused 25
  matches** (16 `CT`, 9 `FT`). Had unknown codes defaulted to ordinary, all 16
  own goals would have been credited to the wrong club and nothing would have
  looked amiss.

  **CBF documents the vocabulary itself, in the súmula rather than the API** —
  every match report prints `NR = Normal | PN = Pênalti | CT = Contra | FT =
  Falta` at the foot of its Gols table. That PDF is served from
  `conteudo.cbf.com.br`, a **different edge from `www`** that stays up while
  `www` is refusing connections, and its URL is not derivable from `id_jogo`
  (take it from the payload's `documentos`).

  **One case stays undetectable and is not a gap in the checking so much as a
  limit of the source**: an own goal filed under the club it *counts for* and
  marked `NR` balances perfectly, so nothing refuses it and an opposing player
  is recorded as that club's scorer. All 16 `CT` matches reconciled once the
  flip landed, so CBF was consistent everywhere checkable — evidence, not proof.
  Only the súmula could settle it, since it carries both a `Tipo` and the
  `Equipe` a goal counted for.

  `goalsReconcile` is the invariant that makes this checkable rather than
  assumed — each club's goals must add up to that club's score — and
  `sync-goals.ts` checks it twice, against CBF's own scoreline and against ours,
  and writes only the matches that pass both — an incomplete run still writes
  those, then exits 1 naming the ones it skipped.

  **The minute does not come from the match API, and that is why it took a
  second source.** CBF's `tempo_jogo` there is `"2"` on every goal and
  `"TN1"`/`"TN2"` on the cards in the same array, so the two use different
  vocabularies, and `minutos` is `mm:ss` with no half attached — printing "10'"
  for a goal scored at 55 minutes would be `live-core.ts`'s "73'" failure on a
  larger surface. So goals shipped **minuteless** until `sumula-core.ts` parsed
  the súmula, which states the half. `Goal.minute` is optional for that reason
  and not as a nicety: a match synced before its súmula existed simply has none,
  and **nothing renders a placeholder**. Do not read the paragraph this replaces
  as current — it survived the arrival of the minute by 45 lines and said the
  opposite of the paragraph under `escalacao-core.ts`.
  The shirt number is dropped for a different reason: nothing renders it,
  and a field nothing dereferences is upkeep for no reader's benefit — the rule
  `Club.coach` already states.

  **A scorer opens the app's own player card, and `Goal.playerId` is how — a
  field that is DERIVED at serve time and never stored.** `src/data/goals.ts`
  records what CBF reported; `withGoals` reads each `scorer` against the
  elencos and attaches an id where the name can only be one player. Doing it
  in the merge rather than in the sync is the rule `withGoals`' reconciliation
  already follows: a squad correction reaches every past goal with no
  regeneration, and a wrong id cannot be committed.

  **The join is `matchPlayerByName`, and it refuses far more readily than it
  guesses.** Two providers name one footballer differently and neither carries
  the other's id — CBF prints what a scoreboard prints ("Lopez") where
  football-data lists "José Manuel López" — so it compares names with accents,
  case and punctuation folded, then reads every word of the short name as
  appearing among the long one's. **Exactly one candidate, or nothing.** That
  is not caution: an id opens a card carrying somebody's photograph,
  nationality and Wikipédia article, so being wrong prints a different
  footballer's life under the name of the one who scored, plausibly. One club
  lists three players called Arthur and another four called Lucas; picking the
  first would be right about a third of the time.
  It is deliberately **not** a prefix test — "Ander" would then match
  "Anderson", and the short name is the commoner input here.

  **"Exactly one candidate" was counted in an incomplete list, and linked the
  wrong man.** The elenco is football-data's, and a player it does not list
  leaves his namesake as the only candidate. CBF prints Flamengo's "Jorge" (21)
  and "Carrascal" (15) side by side; the elenco has Jorge Carrascal and no other
  Jorge; so both names resolved to him, and two penalties opened Carrascal's
  card — in 554874 he was not even on the sheet. `contestedPlayerIds` asks
  `escalacoes.ts` for the second opinion: **two shirts on one sheet are two
  people**, so an id both read as is given to no goal at that club. Season-wide
  rather than per fixture, for exactly the 554874 case, and computed once at boot
  (`CONTESTED_PLAYER_IDS` in `server.ts`) rather than inside `withGoals`, because
  the offline branch rebuilds the curated fixture list on every request and the
  pass costs about 35ms. Measured 2026-09-11:
  five ids contested — Jorge Carrascal (Flamengo), Marino Hinestroza and Paulo
  Henrique (Vasco), Rhuan Gabriel (Cruzeiro), Danilo dos Santos de Oliveira
  (Botafogo) — and **18 of 549 links removed, most of them probably right**,
  since "Carrascal" is very likely Carrascal. That is the price and it is paid on
  purpose: which of two people an id belongs to is a guess, and this join exists
  to refuse guesses. Exempting a name spelled exactly as the elenco spells it
  was considered and would recover **none** of the 18, so it was not built.

  **Coverage is 531 of the 669 goals `withGoals` attaches (79.4%, measured
  2026-09-11 — 549 before the contested-id refusal above, and 532 of 643 on
  2026-09-05) and the rest render as the plain text they always were.** A scorer who has left the
  division is unresolvable by construction, which is honest rather than a gap:
  the app holds no record of them either. Do not read a partial column as a
  bug — 554977's own Facundo is absent from Vasco's frozen elenco, which is why
  `tests/e2e/goals.spec.ts` asserts *at least one* link rather than five, and
  never asserts which.

  **The gap cannot be closed by adding the missing players to the seed, and
  that was measured rather than assumed** — it is the obvious next request, so
  the answer is written down here to stop it being re-investigated. Two
  independent reasons, either of which is sufficient:

  - **`squads.ts` is generated**, so a hand-edit is overwritten by the next
    `sync-seed-data` without a word. That is the rule `player-overrides.ts`
    already exists for, and overrides *correct* a value rather than adding a
    player.
  - **The provider does not have them.** Measured 2026-09-05 against a live
    `/competitions/BSA/teams`: **948 players, the seed's count exactly**, and
    every missing scorer checked is absent upstream too — Coutinho and Facundo
    not in Vasco's 49, Hulk not in Atlético-MG's 46, Erick Pulga and Kike
    Olivera not in Bahia's 51, Lorran not in Flamengo's 49. A resync adds
    nothing.

  **The artilharia is not a second source of ids either**, which is worth
  recording because it is the promising-looking idea: `/competitions/BSA/scorers`
  does carry football-data ids, and at `limit=100` **13 of 14** sampled missing
  scorers are simply not in it. The one that is, is the instructive case rather
  than the useful one — `Hulk` comes back on **Fluminense** while the goal is
  filed under Atlético-MG. That is a **transfer**, and it is the shape of much
  of this gap: a player scores for one club and is later listed at another, or
  leaves the division. Joining on the name across two sources would have put
  him on the wrong club's card, which is the orthography-matching this file
  refuses everywhere else.

  **On 2026-09-05 the 111 unresolved goals split three ways**, and only the third could ever
  be data: **31 ambiguous** at their own club, **10 now listed at another**,
  **70 absent from the division entirely**. The ambiguous 31 are unresolvable
  by *any* name rule — Bahia lists two players called Erick and Athletico-PR
  two called Dudu — and the thing that would separate them is a shirt number,
  which the competition's team payload carries for nobody. `escalacoes.ts` does
  carry shirt numbers, and still cannot bridge: its names are CBF's, so it
  yields the scorer's shirt and no football-data id to attach it to.

  **The lookup goes through `scorerClubCode`, not `clubCode`, and that is the
  trap.** `Goal.clubCode` is the club a goal counts *for*, so an own-goal
  scorer is in the **other** squad. Measured: of the season's 20 own goals, 13
  resolve with the flip and **0** without — and without it nothing goes red,
  because a name looked up in the wrong squad simply finds nobody and costs a
  link. The match page names the same club on the card it opens, from the same
  function, or it would open the right player under the wrong crest.

  **The elencos are `SEED_SQUADS`, not the live payload**, in both cache
  branches. `/api/squads` is a separate upstream request and `/api/matches`
  must not acquire a dependency on it to print a name; the ids are the same
  provider's either way.

- `escalacao-core.ts` — the **escalação**: who each club started, and who sat
  on the bench. Same source and same rules as `goals-core.ts` — CBF's
  `/api/cbf/jogos/{id}`, read on a workstation, never by the running app —
  and **the same request**: `sync-goals.ts` writes `escalacoes.ts` beside
  `goals.ts` rather than a second script walking the same listing and
  re-fetching every match. That is not tidiness; CBF throttles at the socket
  with no 429, so halving the traffic is the difference between a sync and a
  ban.

  **`squads.ts` is an elenco and this is not.** One is everyone under
  contract, the other a claim about one match. `CONTEXT.md` keeps the two
  words apart.

  **Three traps in the payload, each measured.** `reserva` is the **string**
  `"false"`, so `if (a.reserva)` is true for all 46 players and a naive filter
  reports *nobody* as a starter — which is exactly what the first pass here
  did, silently, on both sides. `apelido` carries the shirt number welded to
  the front in a *different* format from `numero_camisa` beside it (`"01 -
  Carlos"` against `"1"`), so rendering both prints it twice. And
  `entrou_jogando` does **not** mean "came on": it is true for precisely the
  players who started, the same fact under a name that reads as its opposite.
  `tests/escalacao-core.test.ts` builds its fixtures with string booleans for
  that reason — real ones would make every test pass against the bug.

  `lineupsReconcile` is the gate the sync writes through, and it is weaker
  than `goalsReconcile` by necessity: a lineup has no scoreline to agree with,
  so the check is what the laws of the game and a team sheet guarantee — two
  sides, eleven starters each with a bench beyond them, every player named and
  numbered. That is still enough to
  refuse the string-boolean failure, which is the one that produces
  plausible-looking data.

  **A goalkeeper is not among those guarantees, and `sidesWithoutStartingKeeper`
  is a WARNING rather than a fifth clause of that gate.** Measured over all 486
  sides served: 481 mark exactly two goleiros, one starting and one on the
  bench, and five mark only one — of which four leave the *starter* unmarked
  (r4/554773 Coritiba, r5/554784 Cruzeiro, r8/554816 and r17/554901 Bahia). So
  the page prints no `(GOL)` for eleven players on four sides of the season.

  **It is CBF's sheet and not our parse, probed rather than inferred.** `isTrue`
  demands the exact string `"true"`, so the obvious suspicion is a second
  spelling we drop — and the raw `/api/cbf/jogos/{id}` for all four fixtures
  carries `goleiro` as `"true"` or `"false"` on every one of the 92 atletas,
  with the single `"true"` sitting on a player whose `reserva` is `"true"`. CBF
  marked the reserve and not the starter.

  **Folding it into `lineupsReconcile` is the obvious fix and is wrong**, which
  is why a test pins the acceptance rather than leaving it to be tidied away.
  Three of the four are otherwise perfect sheets whose keeper is plainly in the
  eleven — Coritiba's 1 Pedro Morisco, Cruzeiro's 1 Cássio, Bahia's 1 Ronaldo
  Strada — so refusing costs a reader 46 names to punish one missing boolean.
  The all-or-nothing rule one paragraph down is about **plausible lies**; an
  absent `(GOL)` is a visible absence and lies to nobody.

  **The fourth cannot be repaired at all, and "shirt 1 is the goalkeeper" is the
  trap.** Bahia's r17/554901 names 23 players, flags only 34 João Paulo on the
  bench, and carries **no shirt 1 anywhere** — the starting keeper is not
  unmarked, he is not on the sheet. The number is a convention rather than a
  law, and a wrong `(GOL)` is an assertion about a person, so nothing infers it;
  `tests/e2e/escalacoes.spec.ts` goes red against exactly that mutation.

  **The spec that should have caught this asserted it and could not fail.** Its
  own name claimed each side *"names a goalkeeper"*, and it passed because 554977
  — the one fixture it opens — happens to be flagged correctly. That is the
  *which record happens to hold a value* trap this file already names for
  `goals.spec.ts`, arriving as a test's own title. It now asks the payload for a
  fixture whose starting keepers are both flagged, and the general case is
  produced by stripping the flag from the payload.

  **Substitutions carry a minute, and it comes from a second source.** The
  match API knows *who* — `alteracoes`, ids that resolve against the roster —
  and cannot say *when*: `tempo_jogo` is `"25:00"` beside a `tempo_subs` of
  `"TN2"`, the split clock that kept goals minuteless until `sumula-core.ts`.
  The súmula knows *when* and **truncates the name** to
  `"82 - Riquelme Avellar da Silva Fo..."`, so it cannot say who. **The shirt
  number is complete in both, and is the join.**

  `attachSubstitutions` is **all-or-nothing per fixture**: a row that cannot be
  placed returns null for the whole match. A list missing one change reads as a
  complete record of a match where that change never happened — the plausible
  lie `goalsReconcile` exists to refuse. It also requires both sources to agree
  on **how many**, per club, before believing either.

  **CBF's two surfaces do not spell the club the same way, and matching on the
  name alone cost 8 matches of the season backfill.** The súmula prints the
  corporate name and the match API the popular one: `Atlético Mineiro Saf/MG`
  against `Atlético Mineiro`, and `Coritiba S.a.f./PR` against `Coritiba SAF` —
  three spellings of "SAF" between two endpoints of one provider. Stripping the
  UF left a string matching nothing, so the row could not be placed and the
  all-or-nothing rule then took down **the side whose name did match too**.

  **The fix is not to strip `Saf` as well.** That is guessing at a corporate
  vocabulary CBF has never published, and it is the orthography-matching this
  file already refuses for club identity, where the rule is *the upstream id,
  never the `tla`*. A substitution instead names two shirts that must be on one
  side's sheet, which is structure rather than spelling. The name is still tried
  **first** — it is what CBF intends and it resolves almost every row — so the
  fallback can only ever add a resolution.

  **Two numbers are not always enough, and the tie-break is a law of the game.**
  Coritiba x Bragantino (2026-01-28) fields an 8 and a 29 on *both* sheets, so
  nine of ten rows resolved and the tenth refused the fixture. The narrowing is
  that **the player coming on cannot have started** — Bragantino's 8 did,
  Coritiba's is on the bench. Note the mirror is false and asserting it would
  refuse every double substitution: a player who came on earlier can be
  substituted again, so `off` is a starter only for a side's first change.

  **Those three fixtures are resolved, and the cause was mostly not the join at
  all.** `554753`, `554934` and `554945` were left unexplained above, plus
  `554984` which arrived later; every side of the season now carries its changes
  — **484 of 484**, 2318 recorded. Two causes, and the bigger one sits one module
  upstream in `sumula-core.ts`:

  **`pdftotext` stacks one row per súmula, and the parse could not see it.** In
  three of the four fixtures exactly one row arrives as five consecutive
  single-cell lines instead of one columnar line:

  ```
   12:00
   2T
   Flamengo/RJ
   20 - Lucas Tolentino Coelho de Lima
                                         7 - Luiz de Araujo Guimaraes Neto
  ```

  `parseSumulaSubstitutions` reads that shape now, requiring **all five** cells
  to match consecutively so it can never assemble a row out of neighbouring
  prose. Note what the all-or-nothing rule turns a single dropped row into: the
  count check disagreed, so `554934`, `554945` and `554984` lost **every**
  change on both sides — eight, ten and eight of them — over one row each. The
  rule is still right; the blast radius is worth knowing.

  **The join's other half was the name after all, and the widening is narrow.**
  `554753` parsed all ten rows and still refused: the shirt fallback resolved
  eight and two were genuinely ambiguous, both sides fielding the same pair of
  numbers. So the name had to resolve, and `codeForTeam` now compares the two
  spellings with **non-alphanumerics dropped**, asking whether the API's name is
  how the súmula's begins — `Coritiba S.a.f.` against `Coritiba SAF` is two full
  stops, and `Cruzeiro Saf` against `Cruzeiro` is a prefix. It still does **not**
  enumerate `SAF`/`S.A.F.`/`Ltda`, and a prefix fitting *both* sides resolves
  nothing, so the shirt structure still gets its turn and an ambiguous row still
  refuses the fixture.

  **A diagnostic trap that cost a probe here: CBF's listing is keyed by LOCAL
  date and our kickoffs are UTC**, so a 00:30Z fixture is listed under the
  previous day. That is a property of the listing rather than of the sync, whose
  month-wide windows absorb the shift — but a narrow window aimed at one fixture
  will miss it, and so will a single-page read of a busy date.

  **`INT` is why `sumulaSubstitutionLabel` exists rather than reusing
  `sumulaMinuteLabel`.** A half-time substitution prints `Tempo` as a literal
  `-`, and that function reckons `period === "1T" ? 0 : 45` — so `INT` would
  have rendered as `45'`, a number the document does not state. It prints
  **Intervalo**.

  **The súmula fetch moved above the goalless skip** for this, and that is a
  widening rather than a refactor: a 0-0 has no minutes to look up but it does
  have substitutions, and leaving the fetch where it was would have silently
  excluded every goalless match from the one feature that is mostly about time.
  One PDF per fixture serves both.

- `events-core.ts` — the **Acontecimentos** on the club page: what happened off
  the pitch, dated, in two scopes. A **geral** touches all twenty clubs (the
  paralisação for the Copa do Mundo); a **de clube** touches exactly one (Tite
  saindo do Cruzeiro). `CONTEXT.md` keeps the word apart from **Partida**, which
  is what `structured-data-core.ts` already calls an `Event`.

  It exists because the club page contains the question and never states it. A
  run of four defeats is on the **Forma**; that the club changed técnico in the
  middle of it is nowhere. And the season's single largest fact — that there was
  no football at all between 1 June and 15 July — is visible only as a hole in
  **Jogos disputados** that a reader has to notice and then explain to
  themselves.

  Its input is `src/data/events.ts`, a committed file, so the section costs no
  request and cannot fail — `scouts-core.ts`' arrangement — and coverage grows
  by hand like `broadcasts.ts`.

  **The two scopes are a discriminated union and not a `scope` field beside an
  optional `clubCode`.** `tsc` then refuses a general acontecimento carrying a
  club and a club one carrying none, where a runtime check would be a rule
  nobody runs. `clubCode` is our club code, never the `tla`, for the reason
  every keyed file here gives.

  **`clubTimeline` merges the general ones into every club's list rather than
  listing them apart, and that is the whole of what `geral` means**: one that
  touches all twenty belongs in all twenty timelines. So this is the one section
  of the club page that is **never empty**, for any club, including the nine
  with no acontecimento of their own. (Thirteen club entries across eleven
  clubs, as shipped — recount rather than trusting this sentence, which was
  wrong in both halves when first written.)

  **A range sorts by where it STARTS**, and ties break on `id`.
  `Array.prototype.sort` is stable only with respect to its *input*, so without
  the tie-break two sackings on one day would render in whatever order somebody
  appended them to the data file — and a spec asserting the order would go red
  on an unrelated edit.

  **NOTHING HERE EVER CONSTRUCTS A `Date`, and that is the whole design.** A
  date is a **Brazil-local calendar day** — `"2026-03-15"` — because that is
  what the press that reports these things reports. `new Date("2026-03-15")` is
  midnight **UTC** by the language spec, so formatting it in a browser west of
  Greenwich prints **14 March**: the one obvious way to render this field is off
  by a day for every reader this app has, and it renders *correctly* on a
  workstation in UTC and in CI, so nothing goes red. Labels are therefore built
  by indexing a month table with the digits of the string, and comparisons are
  ordinary string comparisons, which are correct on ISO dates by construction.
  `brasiliaDay` is the one bridge from an instant, through `Intl` with an
  explicit `timeZone`.

  **The same shift is what the data file's two-source bar caught.** One
  consolidated list dates Tite's sacking to 14 March; ge.globo files its report
  under `/2026/03/15/` and four others say "ao fim da noite de domingo (15)".
  Our **own** fixture list settles it — Cruzeiro 3x3 Vasco kicked off
  `2026-03-15T23:30:00Z`, 20:30 BRT, and finished after midnight UTC — so 14 is
  wrong, 15 is the local day and 16 is what a UTC conversion prints. That third
  source is free and applies to most entries: a sacking follows a named match,
  and `src/data/matches.ts` dates that match. Three entries were confirmed that
  way and two were corrected by it (the same list puts Anselmi's departure at
  "~27/03" against four reports saying Sunday 22 March).

  **The bound on that third source is the entry it got wrong, and it is worth
  more than the two it got right: our fixture list dates the MATCH, never what
  followed it.** Santos' round-7 defeat kicked off `2026-03-19T00:30:00Z`, which
  is 21:30 BRT on Wednesday the 18th, so deriving the sacking from the fixture
  gives the 18th — and the reports say "na madrugada desta quinta-feira (19)",
  with Cuca announced hours later the same morning. This file shipped that entry
  dated 18 until a second source was asked for it. A match date bounds an
  acontecimento from below and does not date it; where the two differ, the
  reports win, because they are the only source that knows what happened after
  the whistle.

  **`tests/events-core.test.ts` SETS the host's zone rather than inheriting
  it**, and the first version of that test was worthless on the machine it was
  written on. Deleting the explicit `timeZone` from `brasiliaDay` is the one
  mutation that matters, and the obvious assertion passed against it here
  because this workstation already runs `-03`; it would have gone red in CI,
  which runs UTC. That is `rehearse-sync-schedule.sh`'s inherited-environment
  failure arriving in a unit test — hermetic, and still answering differently in
  two places. It sweeps four zones now, and the mutation dies in all of them.

  **`SeasonEvents` renders below the Vídeos and above Jogos disputados, and the
  order is mechanical before it is editorial.** `screenshot.ts` crops at the
  last section fitting in 1080 CSS px, so a section inserted *above* one can
  evict it from the committed frame — the failure that cost `partida-554977`
  its campanha and 581px. Placed here the worst case is that this section falls
  outside the crop itself. Measured on the snapshot at 960px: on
  `/clube/palmeiras` it opens at **1241px**, 71px below the 1170 ceiling, so
  the crop stays at 873 and nothing above it moves; on `/clube/cruzeiro`, which
  carries a club row too, it sits at 875–1127 and is fully inside. Those are
  snapshot readings and the captures are taken from **production**, so they are
  evidence rather than a trailer.

  **A club may hold more than one, so nothing keys on the club.** Chapecoense
  and Botafogo each changed técnico twice in 2026 — the `Record<ClubCode, T>`
  shape every other curated file here uses would silently keep one of the two,
  and `tests/events-core.test.ts` asserts that a club with two exists so the
  point cannot be quietly lost.

  **A round the provider has dated but not timed carries placeholder
  kickoffs**, and a calendar hole beside one is an artefact rather than a
  stretch without football — so no entry may be derived from it. **Rounds 31 to
  38 as of 2026-09-28**, measured against the seed; it was 29 to 38 when this
  paragraph was written and the boundary climbs as the calendar firms up, so
  re-measure rather than citing the numbers here.

  **The marker is the ROUND, never the hour, and reading it per fixture is the
  trap.** `00:00Z` is 21:00 BRT, one of the commonest kickoff times in Brazil —
  round 28's `2026-09-20T00:00:00Z` is FINISHED and carries a score, and round
  30 has two among eight real times. `withKickoffPrecision` in `matches-core.ts`
  is the implementation and its comment is the argument; this paragraph exists
  only to say the same rule binds an acontecimento's date.

  **The two holes are no longer the same kind, which is what moved first.** The
  14-day one (r34 to r35) still sits between two untimed rounds and is an
  artefact. The 17-day one is now r28 to r29 with **real times on both sides** —
  round 28 finished 2026-09-20 and round 29 genuinely kicks off 2026-10-07 — so
  it is a real gap in the calendar, and the blanket refusal above does not cover
  it.

- `squad-core.ts` — the **Jogadores** page: every club's elenco, grouped into
  the lines a squad is read in. It exists because the provider reports a
  position at **two levels of detail in the same list** — mostly a broad line
  ("Defence", "Midfield"), occasionally a specific role ("Left-Back", "Right
  Winger"), and for a handful of players nothing at all. `lineOf` folds the
  roles onto the line they belong to, so a lateral does not become a section of
  one. An unrecognised position goes to **Outros** rather than being guessed at,
  and keeps its verbatim caption — the same rule `positionLabel` follows, whose
  table this module reuses rather than copying.
  `playerPositionLabel` returns **null** for a broad position, because the
  section heading has already said it; printing "Defesa" under a Defensores
  heading is the heading again, once per row, for two thirds of the squad.
  Sorting is alphabetical in pt-BR collation with the player id as a tie-break —
  **not** by shirt number, which the competition's team payload does not carry
  for anyone in the division. Athletico-PR really does list two Dudus, which is
  what the tie-break is for.

- `weather-core.ts` — the **clima no estádio**: what the sky is doing at a
  ground, from **Open-Meteo**. It is this app's **second upstream**, and every
  decision below follows from that rather than from the weather.
  It needs **no key and no signup**, which is why it can ship at all — a fresh
  clone runs it with no configuration, the same property that lets the app run
  without `FOOTBALL_DATA_TOKEN`. It spends nothing from football-data's 10
  requests a minute, and it gets **its own kill switch** (`DISABLE_WEATHER`)
  rather than riding on `DISABLE_FOOTBALL_DATA`: the two fail independently, and
  one flag covering both would take the table off the page to silence a weather
  card. `ApiEnvelope`'s `source` gains `open-meteo` for the same reason — a
  reader told the scores are stale because the weather timed out is being
  misinformed.
  **It reports what is happening now and never a forecast**, which is a decision
  rather than a limit: Open-Meteo will return hourly values sixteen days out, and
  a kickoff that far away has a forecast worth about as much as a guess. Printing
  one beside a fixture is the failure `live-core.ts` refuses for the match
  minute — a precise-looking number the data does not support. The card prints
  the instant it was read instead, so it says how old it is rather than implying
  it is live.
  **`describeWeather` returns a `WeatherKind`, not a character**, and that is the
  second time this codebase has reached that answer. The first draft used
  `☀`/`☁`/`☂` and a test asserting no glyph is `Extended_Pictographic` went red
  on the first one: U+2600 is emoji-presentation on several platforms, so a mark
  meant to sit in `currentColor` beside 24px icons would have rendered as a
  colour picture at whatever size the font chose. That is exactly what `SunIcon`
  and `MoonIcon` exist for, so `WeatherIcon` lives in `SectionIcons.tsx` and this
  module names the sky. Six kinds, fewer than WMO describes, because a mark has
  to be legible at 20px and "garoa" and "chuva forte" are the same picture — the
  **word** carries the precision.
  `parseWeather` narrows field by field like `parseHealth`, with **temperature
  the one required field**: a weather card with no temperature is not a weather
  card, and without it the endpoint answers null and the page omits the section.
  Zero is a real temperature, a real humidity and a real wind speed, so nothing
  here tests truthiness — the same trap `countsTowardStandings` records for a
  0-0 scoreline.
  Served by **`/api/stadium-weather/:slug`**, and the slug is load-bearing: the
  server resolves the coordinate from `STADIUMS`, so the deploy is not an open
  weather proxy for any point on earth. The sibling repo this was modelled on
  takes `?lat&lng`, which is simpler and turns a deploy into somebody else's
  free geolocation service on our bandwidth. Cached 15 minutes per ground, with
  **no circuit breaker**: one upstream's outage must not open the other's, and
  the cache already caps what a hard-down Open-Meteo costs.

- `traffic-report-core.ts` — the **Tráfego** page: this deployment's own nginx
  access log, read back as charts. Ported from `agora_na_copa_2026`, which is
  where the whole shape came from; what follows is what had to change and why.
  It is the **second** core module whose subject is this deployment rather than
  the championship — `health-core.ts` was the first — and it takes the same
  consequence: the payload is stale by construction, so it prints the instant
  the reading was taken instead of implying live numbers, which is
  `StadiumWeather`'s rule.
  **No visitor address ever reaches it.** The host aggregates before it writes —
  it resolves each unique IP to a country once and emits counts — so an address
  is not dropped in this module, it never arrives. That is a property of the
  shell script and this module cannot restore it if somebody widens the script,
  which is why `tests/traffic-report-core.test.ts` asserts an IP-shaped string
  in a summary does not survive into the payload. Read that as a floor and not
  a guarantee.
  **The counts are cumulative over nginx's whole log window and not per hour**,
  because each snapshot re-reads the entire log. So `requests` rises between
  snapshots, and a **rate** is the difference between two of them, derived here
  rather than written by the script — only a reader holding two snapshots can
  compute one. The rate is **clamped at zero**: logrotate drops the oldest
  lines, so a cumulative total legitimately falls across a rotation and the
  honest answer is "no measurable rate" rather than a negative one. The first
  snapshot's rate is **null**, which is not zero — "not measurable yet" and "an
  hour that served nobody" are different readings and the chart draws them
  differently. Every optional numeric goes through an explicit null check for
  the same reason: `Number(null)` is `0`, so a truthiness test would report a
  genuinely quiet hour as missing data — `countsTowardStandings`' 0-0 trap.
  **`/api/health` is dropped from the top paths and from nothing else.** It is
  polling for the most part — `reconcile.yml` reads it every fifteen minutes and
  the deploy job asserts the live commit through it — so left in it crowds a real
  content route out of a twenty-row chart. It stays in `requests`, the status
  codes and the hour buckets, because those answer *what did this server do*
  rather than *what did people read*, and filtering there would make the totals
  disagree with the log.
  **`monitorHits` is NOT the machine's share, and #375 shipped a rate chart that
  read it as one.** `App.tsx` fetches `/api/health` for the **Rodapé** on every
  page view, so a reader contributes one hit per visit. Measured on the host's
  own log for 2026-09-05: 427 hits — **327 curl** (reconciler and CI), **24
  node**, **76 a browser carrying this site's own Referer**. So 17.8% of
  "monitoring" was readers, and the second series subtracted them from the very
  line meant to count them.
  **That composition is superseded and the ratio moves the wrong way for this
  chart.** `useVersionWatch` re-reads `/api/health` every five minutes while a
  tab is visible, so a reader now contributes up to 12 hits an hour where the
  measurement above counted one per visit — the browser share of this path can
  only grow, which is exactly the direction that made `total − monitor` a lie in
  the first place. The two-series design already handles it, since `visitorHits`
  counts by Referer rather than by subtraction; what is stale is the **number**.
  Re-measure before citing 327/24/76, and read it as a reading taken before
  2026-09-09 rather than as a property of the traffic.
  **The page therefore draws two views: `Físico` and `Visitantes`** —
  `ratePerMin` and `visitorRatePerMin`. The first is every access the server
  served; the second is traffic a browser on this site caused, and it is a rate
  of **its own counter**, never a subtraction.
  **`visitorHits` is positive evidence, and the user-agent may only
  DISQUALIFY.** A request counts when its Referer names our own origin — what a
  browser sends for every sub-resource of a page it renders — minus anything
  self-declaring as a crawler, because a rendering crawler (Googlebot,
  OAI-SearchBot, meta-externalagent) loads sub-resources exactly as a browser
  does; 70 such lines in the day measured. Read the asymmetry as the security
  property it is: **a scanner spoofing `Claude-User` gains nothing.**
  **The 02:00Z hour of 2026-09-05 is why the definition had to change**, and it
  is the clearest thing in the log: **673 requests, 22 of them browser-caused**.
  643 came from one address probing `/wp-config.php.bak`, `/aws/*`,
  `/.github/workflows/*` and Vite's `/@fs/`, spoofing Perplexity, ChatGPT,
  Claude-User, OAI-SearchBot and TelegramBot in a single hour, and taking 635
  404s. Under `total − monitor` that hour drew at about 10/min as though people
  had been reading; under the visitor counter it draws **flat at zero** beneath
  a physical spike. Nothing leaked — every probe 404'd, `/@fs/` included, because
  production serves `dist/` statically and has no Vite.
  **Anchored on the origin, which is not pedantry**: 631 of those 643 carried no
  Referer and **12 named `https://54.232.242.45:443`**, this host's own IP. A
  rule of *has any Referer* counts those. And the anchor is a **prefix** —
  `index($4, o) == 1` — because our origin inside somebody else's query string
  is not our page; the rehearsal carries a case for each, and both go red when
  the anchor is loosened.
  **What it undercounts, stated rather than hidden:** the page navigation
  itself. A visit's first request is the HTML document, which carries no Referer
  or an external one, so it is uncounted while the five-or-so sub-requests it
  causes are counted. It measures browser-caused *traffic* and is deliberately
  not a visit count — `providerLabel`'s rule of naming what a proxy actually
  counts.
  **One dependency nothing here can test: no `Referrer-Policy` header is
  served** (checked against the live site), so browsers use their default and
  send the full URL same-origin. Hardening that to `no-referrer` would silently
  reclassify every reader as automated. The header is nginx's to set and this is
  a log, so the note lives at the awk that depends on it.
  **The bot share reads the USER-AGENT field, not the whole line**, and the old
  rule's false positives are worth keeping because they show the shape: over the
  real log it counted 62 hits on `/robots.txt`, a reader opening
  **`/clube/botafogo`** — a club in this division is named Botafogo — and an
  asset named `index-ChBoTmtl.css`, a **Vite content hash** that happens to
  contain `bot`. That last one is random per build, so the error changed size
  every time the bundle did.
  The old rule reported 2963 where the field rule reports 2887.
  A **label is everything after the count**, not the next whitespace field: a
  city reads `São Paulo, Brazil` and a referrer carries a URL with spaces in it
  often enough to matter, and splitting on whitespace files every such row
  under its first word and silently merges unrelated buckets.

- `health-core.ts` — the **Saúde do serviço** the **Rodapé** carries. It is the
  only core module whose input is *this app's own* API rather than a provider's,
  and it exists for the reason an adapter usually does: `/api/health` is the one
  endpoint that is deliberately **not** an `ApiEnvelope` — it describes the
  process, so it has no `source`, no `note` and nothing to degrade to — which
  also makes it the one payload the client cannot assume it understands, since
  a host still serving last week's bundle answers the shape *that* build
  emitted. `parseHealth` narrows field by field and lets every field but the
  status be absent; the rodapé then omits an item rather than printing
  `undefined`. `providerLabel` names what is **configured** and never claims
  "ao vivo" — whether the last upstream request succeeded is the envelope's
  `source`, which the banner above already carries, and claiming otherwise here
  would contradict a `fallback` banner three lines up. `startInstant` turns the
  reported uptime into the instant the process started, which is not a
  presentation preference: an elapsed label is different every time it renders,
  and the home route is one of the committed **full-page** captures, so that
  band would change between two captures of the same build and be committed as
  noise on every refresh — the failure `settle` was written for. It is read at
  the moment the payload lands rather than per render, because `now` moves and
  `uptime` does not.

- `version-core.ts` — whether the bundle a reader is running is still the one
  this host serves, and the second core module whose subject is this deployment
  rather than the championship — `health-core.ts` was the first, and they read
  the same field for opposite purposes: one reports the `Versão` in the Rodapé,
  the other acts on it. `main` deploys itself several times on a busy evening
  and a page already open goes on running whatever it loaded, so a reader
  watching a match finish is exactly the reader who never gets the fix.

  **It compares the CLIENT's build against the SERVER's, never the server
  against a previous reading of itself.** Watching `/api/health`'s sha *change*
  answers *did the host restart*, which is a different question with a worse
  failure: a restart on the same commit — a `systemctl restart`, an OOM, an
  `.env` edit — would reload every open page for a release nobody made, and a
  reader who arrived mid-deploy was already stale before the first reading and
  would never see a change at all. Comparing two builds is stateless, so it is
  right on the reading it already has.

  **The client's own sha is in the SHELL and not in the bundle, and that was
  measured rather than preferred.** The obvious place is a build-time Vite
  `define`, which was built first and works — and it puts the sha inside the
  client JavaScript, therefore inside its **content hash**, so every deploy
  issues a new asset filename and every returning reader downloads it again.
  Over the 60 commits before this landed, **35 of them changed nothing the
  client bundle contains**: 133 KB gzipped re-fetched by everybody to announce a
  release they run no part of. `injectMeta` writes one `<meta name="app-version">`
  instead, on a document that is revalidated on every navigation anyway. It also
  answers the better question — not *which build produced this script* but
  *which process served the document I am looking at*.

  **An absent sha is never a difference.** A host still serving a build older
  than this feature answers a payload with no `sha`, and a shell from one has no
  tag; reading either as "different" would put every reader of that deploy into
  an endless reload against a server that can never agree. Running from source
  both sides answer `dev` and match, which is what keeps a developer from being
  reloaded out of the page they are editing.

  **One reload per sha, and the guard is not hypothetical.** Anything that pins
  a client to an old bundle — a proxy holding the shell, a half-finished rsync,
  a `dist/` whose HTML and assets disagree — makes the reload land on the same
  mismatch it was trying to fix. The marker is in `sessionStorage` (per tab: a
  sibling tab's success must not talk this one out of its own attempt) and is
  written **before** `reload`, or it never lands. Removing it is the mutation
  `tests/e2e/version-reload.spec.ts` was confirmed red against, and it fails as
  *Execution context was destroyed* — the page reloading without bound.

  `useVersionWatch` is the impure half. It is fed the reading `App` already
  holds for the Rodapé, **so the check on load costs no request at all**; it
  re-reads `/api/health` only on the interval and on the moment a tab becomes
  visible again, which is the case that matters — a reader returning to a tab
  that sat through a deploy. **The interval is five minutes rather than the
  fixture poll's 30–60s, and the reason is that `/api/health` is counted:**
  `traffic-report-core.ts` draws `monitorHits` off that path and `visitorHits`
  off the Referer, and a browser poll lands in both. At 60s an open tab would
  contribute 60 hits an hour to the chart whose whole purpose is separating
  machines from readers; at five minutes it is 12, and only while visible. That
  does supersede the composition measured on 2026-09-05 (327 curl / 24 node / 76
  browser of 427) — re-measure rather than citing it after this ships.

  **The suite cannot see this feature by construction, which is why the spec is
  end-to-end and not only a unit test.** Both targets boot a server whose sha
  *agrees* with the client's — `dev` under `tsx`, the stamped commit under
  `PLAYWRIGHT_TARGET=bundle` — so the passing state is indistinguishable from
  the feature being deleted in every other spec. Only a prepared `/api/health`
  payload produces a disagreement; it is fulfilled from memory rather than
  proxied, which is `meu-time.spec.ts`' rule. Three mutations were confirmed red
  — the hook not called, the loop guard removed, the server not emitting the tag
  — and the two "nothing happens" cases are deliberately weak: they pass against
  anything, and exist so that *no reload* is a measured outcome rather than the
  absence of one.

- `session-core.ts`, `account-core.ts`, `oauth-core.ts`, `rate-limit-core.ts` — the
  **Conta** subsystem's judgement, all pure and all taking `now` as a parameter like
  `cache-core.ts`. Expiry, rolling renewal and the session row (`sessionRecord`, the one
  constructor a sign-in and a renewal share), PKCE, the sign-in transaction's cookie
  (`encodeSignInTransaction`/`decodeSignInTransaction`), the callback's refusals in the
  order they are checked (`readCallback`), the `id_token` claim checks and the token
  bucket are unit-tested without a database, a browser or a Google client. Only the
  token exchange's HTTP call stays in `server.ts`.
  `account-store.ts` is the only file that knows SQL, which is the same split
  `commons-core.ts` and `scripts/commons-api.ts` already draw.

Extract to a core module before logic in `server.ts` grows a branch worth testing.
