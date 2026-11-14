# Dados, provedor, cache, envelope e rotas

*Quando ler:* Leia ao tocar no provedor de dados, no cache, no envelope da API, em `src/data/` ou nas rotas.

Extraído do `CLAUDE.md`, que ficou um índice. Esta é a fonte canônica do assunto.

---

## Data provider

`football-data-core.ts` adapts football-data.org v4. Série A is competition `BSA`
(TIER_ONE, i.e. free); Série B is TIER_THREE and Série C/D are TIER_FOUR with data frozen
at 2020, so **only Série A is reachable on a free token** — a request for other divisions
means changing provider, not just the competition code.

Auth is `X-Auth-Token` (a bare token, not a bearer scheme), read from `FOOTBALL_DATA_TOKEN`.
Unset is a supported state: the app serves seed fixtures so a fresh clone runs without a
signup. `DISABLE_FOOTBALL_DATA=true` is the incident kill switch.

Mapping notes, all covered by tests:
- Upstream status vocabulary is wider than the app's — `TIMED`→SCHEDULED, `PAUSED`→LIVE
  (half-time is still live), `SUSPENDED`→POSTPONED, `AWARDED`→FINISHED. Unknown statuses
  degrade to SCHEDULED rather than dropping the fixture. `EXTRA_TIME` and
  `PENALTY_SHOOTOUT` map to LIVE: every status in v4's documented lookup table is
  mapped (checked 2026-09-11), because the fallback is not harmless for a match in
  progress — `withPlayedStatus` repairs a SCHEDULED record carrying a score for a
  past kickoff into FINISHED.
- Scores are read from `fullTime.home`/`away`, verified against a live v4 payload.
  This bullet used to add a legacy `homeTeam`/`awayTeam` spelling as a second
  source; `mapMatch` reads no such thing (checked 2026-09-11) — `homeTeam` and
  `awayTeam` are the two clubs. Note `0` is a real score — only `null` means
  unplayed.
- A club's code is the upstream **numeric id** (`"1783"`), never the `tla` — see
  **Club identity is the upstream numeric id** below; the `tla` rides along for
  display. `clubFromTeam` falls back to the `tla` only for a team that carries no
  id. This bullet used to say the reverse — `tla` first, then a synthetic
  `FD-<id>` — and no code produces an `FD-<id>` (checked 2026-09-11).
- Standings read the `TOTAL` group only, never the HOME/AWAY splits — and a
  payload with no `TOTAL` group is refused rather than served its first split, which
  would be a well-formed HOME table labelled live. Measured 2026-09-11: one group,
  `REGULAR_SEASON`/`TOTAL`, 20 rows.
- A coach is read from `name` first and from `firstName`/`lastName` as a fallback,
  because `lastName` is frequently null for a coach known by one name. A club
  between coaches reports none at all, which is an **absence** — the club page
  leaves the line out rather than printing a dash. `clubFromTeam` therefore omits
  the key entirely, as it already does for a missing crest.
- **Squads and coaches arrive embedded in the competition's team list**, not from
  a per-team endpoint: `/competitions/BSA/teams` carries a `squad` array and a
  `coach` object on each of the twenty clubs, so `mapSquads` builds the whole
  division's elencos from **one** request rather than twenty, and the técnicos
  ride along on the same payload for nothing. That is the only reason the Jogadores page is
  affordable at 10 req/minute. The listing has **no `shirtNumber` and no
  `currentTeam`** for any player — the person endpoint has both, which is what
  the player card fills in when one is opened. `mapSquads` deliberately does not
  copy the club onto each of the ~950 entries: it is what the enclosing `Squad`
  already says, and repeating it more than doubled the payload (255KB → 109KB
  when it was removed). The page attaches it at the moment it opens a card.

**Known difference, deliberate:** football-data counts `IN_PLAY` matches in its standings
table — a club leading 1-0 at half-time is already credited 3 points. `computeStandings`
excludes them (`countsTowardStandings` requires FINISHED), because a league table should
move on the final whistle. So while matches are in progress, the live table (upstream) and
the fallback table (computed) legitimately differ. Verified against a live payload: the
entire delta was exactly the three in-play matches. Do not "fix" this by counting live
matches.

## Caching and failure handling

`cache-core.ts` holds the TTL cache and `circuit-breaker-core.ts` the circuit breaker —
two modules because they answer two questions, and one first sentence naming both was
the tell. Both take `now` as a parameter instead of reading the clock, so expiry and
recovery are tested without sleeping.

**The order a fill takes is `fillStep` in `cache-core.ts`, and `server.ts` only does the
I/O around it.** Switched off → local; warm entry → served; breaker open → local; else
fetch. It was written out three times — `loadCached`, `loadMatches` around its merge, and
`/api/stadium-weather/:slug` — and the order is the rule: a warm entry is served even
while the breaker is open, and a switched-off upstream never reads its own cache. The
weather route passes `breakerOpen: () => false`, which is the "no circuit breaker"
decision above written at the call site rather than implied by an absent branch. The
fixture TTL is `matchesCacheTtl` beside the constants it chooses between.

The free tier allows **10 requests/minute** — caching is what makes it viable in
production, not a nicety. Standings cache 60s, fixtures 60s, dropping to 15s while any
match is LIVE, capping the app at roughly 5 upstream calls/minute at any traffic level.
The breaker opens after 3 consecutive failures for 60s, so a downed upstream gets one
probe a minute rather than one per request.

**The player card's lookup is not behind that breaker, and must not be.**
`/api/players/:id` takes its id from a URL anybody can type, and football-data
answers an id nobody issued with a **404** — measured 2026-09-11 on
`/v4/persons/99999999`. While the route went through `loadCached` that 404 was a
failure like any other, so three requests for made-up ids opened the breaker above
and every data route served `fallback` as its cache expired: 60 seconds per three
requests, for every reader, renewable at will. Nothing reported it, because the e2e
suite runs with the provider switched off and never reaches the breaker at all. It
was reproduced by booting the server with `fetch` stubbed — three person 404s, then
`/api/standings` answering `fallback` without asking upstream — and the same probe
reaches upstream after the fix.

`enrichment-core.ts` is the fix, and three things about it are decisions:

- **A 404 is an answer** (`isNoSuchResource`), cached for the hour like a name
  would be. A 403 or a 429 is not: that is the provider declining to answer.
- **The loader keeps its own breaker and receives the shared one as a predicate
  only.** It can see that upstream is down and hold off; it cannot report there,
  because it is never handed a `CircuitBreaker` to report to. A type holds the
  arrangement, not this paragraph.
- **It spends from `ENRICHMENT_BUDGET`, two requests a minute.** Without it the same
  outage returns by another road: a 404 still costs one of the ten, so a stream of
  fresh ids spends the minute the table needs and the data routes fail on 429s
  instead. The size is arithmetic — the caches above allow about 5.2 requests a
  minute while a match is live, and a token bucket's worst minute is its capacity
  plus a minute's refill — and `tests/enrichment-core.test.ts` computes that sum
  from the TTL constants and fails past 10.

Anything short of an answer is `null` with `Cache-Control: no-store`, so the card
renders from what the page knew, as it does offline, and a reader refused once is
not refused again for an hour by their own browser. That header is
`enrichmentCacheControl`, which reads the max-age off the loader's TTL rather than
carrying a second copy of the hour.

## The provider regresses individual records, and the app remembers

**football-data serves fixture records that go backwards**, and this is not a
staleness the cache above can absorb — it is upstream contradicting itself.
Measured 2026-08-31, one URL, one token, four minutes apart:

    554986  00:38 -> FINISHED 1-1  lastUpdated 2026-08-30T23:37:19Z
    554986  00:42 -> TIMED   null  lastUpdated 2026-08-30T10:20:34Z
    554982  00:38 -> FINISHED 3-2  lastUpdated 2026-08-31T00:32:15Z
    554982  00:42 -> FINISHED 3-2  lastUpdated 2026-08-31T00:40:35Z

The last row is the whole reason the fix has the shape it does. In the response
that took one fixture back thirteen hours, **another moved forward** — so these
are not two snapshots alternating, and "prefer the newer response" does not
work. A finished match rendered as *A realizar* on the Partida page for as long
as the fill behind it held the regressed copy.

`mergeByFreshness` in `matches-core.ts` keeps, per fixture, whichever copy
upstream stamps newer. Three things about it are decisions:

- **It compares `lastUpdated`, never a status ordering.** The stamp is what the
  provider *said*; "FINISHED outranks SCHEDULED" is a guess about what it meant,
  and it would pin a genuine correction — a result voided to POSTPONED — for
  ever. `mapMatch` carries the stamp through for this and for nothing else.
- **Incoming decides which fixtures exist.** A record held only in memory is
  never resurrected; a fixture upstream genuinely drops must be able to vanish.
- **Except when incoming names none.** `requireFixtures` refuses a 2xx carrying
  no fixtures before the merge runs, because under the rule above an empty list
  wipes the memory, `rememberMatches` persists the wipe — switching this whole
  guard off for the next fill — and the fill caches it as live. Measured on
  production 2026-09-11 around 00:12Z: one 60s TTL of `/api/matches` and
  `/api/clubs` serving zero under `source: "football-data"`, with upstream
  answering 380 moments later. Whether upstream sent an empty list or a body
  with no `matches` key was not established — host logs are not readable from a
  workstation — and both are refused alike, so the fix does not depend on it.
  It refuses **only empty**: a truncated list still drops what it omits, and no
  threshold has been measured.
- **An absent stamp is "no claim" and loses every comparison**, so the behaviour
  collapses to "the newest response wins" where there is nothing to compare.
  `sync-seed-data` writes an explicit field list, so the frozen snapshot carries
  no stamps at all — which makes that the **end-to-end suite's path**, and green
  e2e is therefore not evidence this works. `tests/matches-core.test.ts` covers
  the rule; the live path was verified by replaying two captured payloads.

**The stamp comparison alone was defeated in production, and the fix is a second
rule rather than a change to that one.** The shape above replays an *older*
generation, which `lastUpdated` catches. Upstream also produces the opposite —
measured 2026-08-31T12:53:50Z, one token, straight off
`/v4/competitions/BSA/matches?matchday=25`:

    554982  FINISHED  3-2   lastUpdated 2026-08-31T08:25:09Z
    554985  TIMED     null  lastUpdated 2026-08-31T08:25:09Z
    554986  TIMED     null  lastUpdated 2026-08-31T08:25:09Z

One generation, one stamp, the result lost on two of the six records it touched.
Against `554986`'s good copy — `FINISHED 1-1` stamped `2026-08-30T23:37:19Z` —
the broken record is nine hours **newer**, so the guard working exactly as
designed prefers it. **Freshness is not correctness**, and persisting the memory
does not help: it stores the loser. Production served the fixture as *A
realizar* for fifteen hours on a process whose uptime showed no restart could
explain it.

`retractsResult` is the second rule, and it tests **coherence, not a status
ranking** — the objection in the first bullet above still stands and is not
worked around. A record saying *this match is scheduled to be played at a time
that has already passed, and has no score* contradicts itself whatever it is
stamped, so the held result stands. Every honest correction states itself some
other way and still wins: POSTPONED and CANCELLED are how a result is genuinely
voided, a corrected scoreline arrives carrying goals, and a real re-schedule
names a kickoff in the future. That is why it needs `now`, which arrives as a
parameter like everywhere else — an unparseable kickoff counts as *not* past, so
upstream wins, the direction `kickoffValue` already sorts it.

**Which of those tests can go red, and when, is the thing to know before editing
them.** Only two assert the new behaviour and fail with the rule switched off;
the other six exist to fail if it is ever made *broader*, and they pass with it
off by construction. All three directions were confirmed by mutation — the rule
disabled, its status check dropped, and its clock check dropped — each failing
exactly the tests named for it, and the whole thing was then replayed through
`mapMatches` against the captured payload above.

**It cannot resurrect a result already lost from the held state**, which is the
same bound `match-state-store.ts` carries: if the memory has only ever seen the
broken record, there is nothing to hold and recovery still waits on upstream
reporting the result once. This stops the next withdrawal winning, not the one
already won.

**The memory is persisted, and that half was learned the hard way.** It was
process-local at first, which the code comment described honestly and which
still was not enough: measured that night, the tick before a deploy served the
regression correctly (upstream had regressed 4 records, production refilled 12s
later and served none of them wrong) and the tick *after* the restart served two
finished matches as unplayed — then every tick for the next fifteen minutes did
the same, because upstream sat on its stale generation throughout. **Five
deploys landed in thirty-five minutes** that night. "It self-heals on the next
good fill" is true and is not a bound worth resting on.

`match-state-store.ts` is the only file that knows where those bytes go — the
`account-core.ts`/`account-store.ts` split again. The file is `MATCH_STATE_FILE`,
defaulting to `./data/match-state.json`, and on the host it must stay **inside
`DEPLOY_DIR`** and **outside `dist/`** for exactly `accounts.db`'s reasons: the
systemd unit sets `ProtectSystem=strict` with `ReadWritePaths=${DEPLOY_DIR}`,
both rsyncs delete `dist/` with `--delete`, and `express.static` serves it over
HTTP. Unlike `accounts.db` it is **regenerable** — losing it costs one window,
not data — so it is deliberately not in the backup.

Two traps, both of which the tests hold:

- **`writeFileSync` is not atomic and a deploy kills the process.** A write
  interrupted mid-flight leaves truncated JSON, and the next boot would read
  nothing at the moment it most needs to read something. It writes to a sibling
  and renames.
- **Every read failure is an empty memory, never a throw.** This runs at boot,
  so a missing, truncated or wrongly-shaped file must leave the server starting
  normally — same class as `node:sqlite`'s lazy load. A site that is down
  because a cache warmed badly is far worse than one serving a stale scoreline.

**A stale file is harmless, before anyone adds an expiry to it.** A stored
record only ever *wins* by carrying a newer stamp than what upstream just
served, so an old file can prevent a regression and cannot cause one.

**The client half: `App` polls for an unsettled Partida as well as for Ao vivo.**
The server can hold the freshest record it has ever seen, and a page that read
the payload once still shows whatever arrived then — so a reader watching a match
finish never saw it finish, and one who landed during the regression above stayed
on the wrong answer until they reloaded by hand.

`isAwaitingResult` in `matches-core.ts` is the gate, because polling *every*
match page would spend requests on fixtures decided months ago. Two of its
branches are decisions rather than mechanics. **A kickoff already past keeps its
page asking, with no late bound** — the regression above lasted about five hours,
so a bound of `LATE_GRACE_MS` (three) would have stopped asking an hour before
the answer arrived. And **POSTPONED is not settled**, following `isConcluded`,
because a postponed fixture acquires a new kickoff worth learning.

**One cadence for both sections, and `refreshMs` stays where it is.** The Partida
page could reasonably poll on whether *its own* fixture is live, but the number
that argument is pinned to is the server's fixture-cache TTL, which is driven by
whether **any** match is — so a per-fixture cadence would ask more often than
there is anything new to get, and would be a second thing to keep true the next
time that TTL moves.

The gate is read at render rather than from a ticking clock: `App` owns twenty
standings rows and twenty sparklines, and a clock there would re-render all of
them to answer a question whose answer changes once — which is why `FollowedClubStrip`
and `LiveView` carry their own `useNow` instead of asking `App` for one. The one
case it cannot catch is a page left open across the moment its fixture comes
*within* a day of kickoff, which fails toward waiting rather than toward a wrong
answer.

**`tests/e2e/partida-refetch.spec.ts` installs its own clock, and that is a
deliberate exception to `tests/e2e/clock.ts`.** The shared fixture uses
`setFixedTime` precisely because the full fake replaces the timer queue — which
would hang `useNow`, the transitions `motion.spec.ts` asserts on, and
`networkidle`. But a 60s poll cannot be observed without moving time, and waiting
a real minute per assertion is not a suite. That file takes the full fake
knowingly: nothing on the Partida route calls `useNow`, it never awaits
`networkidle`, and the clock does not leave the file. It also flips its prepared
payload behind a **flag rather than a call count**, because React mounts effects
twice under StrictMode and "the second request" is not a thing a test can name.

**`/api/standings` and `/api/scorers` do not get this treatment, and cannot.**
Watched across the same incident, standings held one fingerprint over 10
samples and scorers likewise, while `/matches` regressed in the very same
ticks — and the standings table agreed with the **fresh** matches generation
exactly, disagreeing with the stale one on precisely the four clubs whose
fixtures had regressed. So upstream's table was *ahead* of its own match list.
More to the point, **neither payload carries a usable stamp**: standings has
none at all, and scorers' only `lastUpdated` fields sit on the player and team
identity records (2023, 2022), never on the tally. Any guard there would have to
be a semantic guess of the kind the first bullet above rejects.

**An empty table is refused anyway, and that is not the guess ruled out above.**
`requireStandings` is `requireFixtures`' rule one payload over: it reads no
stamp and ranks nothing, it only declines to cache a Classificação with **no
rows** as live, and the fill falls back to the table `computeStandings` builds
from the seed. It was **not** observed — standings kept all twenty rows through
the 2026-09-11 incident that emptied the fixture list — and it costs less than
that case would have: standings hold no memory, so the failure it names lasts
one TTL. **The artilharia gets no twin**, because before anybody has scored an
empty scorers list is a real answer.

## API envelope

Every data endpoint returns `ApiEnvelope<T>`: `source`, a human-readable pt-BR `note`, and
`updatedAt` alongside `data`. `source` distinguishes `football-data` (live) from
`placeholder` (no token configured) and `fallback` (configured but failing) — the last two
look identical to a reader but only `fallback` is worth alerting on. The note, the key
order and that `placeholder`/`fallback` choice are `envelope-core.ts` (`buildEnvelope`,
`seedSource`); `server.ts` binds the snapshot's day and its own configuration and does
nothing else to an envelope. The UI banners the note for anything that isn't live. New endpoints keep this shape and degrade to local data
rather than returning a 500.

Current routes: `/api/health`, `/api/clubs`, `/api/standings`, `/api/scorers`,
`/api/squads` (every club's elenco; one upstream request serves all twenty),
`/api/coaches` (every club's técnico, keyed by club code — a **projection of the
squads payload**, so it shares that cache entry and costs nothing upstream; it
exists because the club page is built from fixtures and standings, and neither
carries a coach),
`/api/players/:id` (numeric id, else 400 — enrichment only, answers `null` offline, over
budget or while upstream is down; an unknown id is a cached `null`, and the route never
touches the shared breaker — see **Caching and failure handling**;
note its `currentTeam` is often a national team, which is why the card prefers the
club the page already knew),
`/api/matches` (optional `?round=` — a non-integer or `< 1` is a 400).
`/api/projection` (the **Projeção**: título, G4 and Z4 odds from `season-sim-core.ts`,
carrying `/api/matches`' envelope because it is derived from it; memoised on
`projectionKey`, so the ~330ms simulation runs once per change in the results rather than
per request — `projection-core.ts` is the half the client imports).
`/api/traffic-dashboard` (the traffic snapshots on this host, parsed — see
**Tráfego** below; cached 5 minutes, because the timer that writes its input
runs hourly). **It is NOT `Disallow`ed**, and this bullet said it was: `robotsTxt`
disallows `/trafego`, the *page*, and the payload is crawlable and `noindex`ed
like every other content route — which is the rule, since a fetch of it has no
side effect. Read the page's unlisted-not-private paragraph below as being about
the page alone.

## Routing

The URL is the source of truth for the visible section; `App` holds no section state.
`route-core.ts` is pure parse/format with no History API and no React, so every path shape
is unit-tested without a browser. `src/useRoute.ts` binds it to `pushState`/`popstate`.

Nav entries and club names are real `<a href>` elements, so middle-click and "open in new
tab" behave. Their click handlers bail out on modified clicks rather than swallowing them,
through the one `isPlainClick` in `src/components/plainClick.ts` — a copy per link had
already drifted, two of them never testing the button.

**Deep links depend on the server's SPA catch-all.** `/clube/1783` is not a file, so
`express.static` misses and the `app.get("*")` handler serves `index.html`. That handler
must stay registered *after* the API routes, or `/api/*` would be swallowed by it. Verified
in both dev (Vite middleware, `appType: "custom"` — see **Crawlers and structured data**
for why) and the production bundle.

Unrecognised paths and nonsense rounds resolve to something useful rather than 404 — a
stale link should still land somewhere.

`/trafego` is the third address with **no inbound link anywhere in the app** —
`conta` and `entrar` at least have the top app bar's account control, and this
has nothing. It is reached by typing it. See **Tráfego** above for why that is
the arrangement rather than a nav entry, and for what "unlisted, not private"
does and does not buy. It is the one section deliberately **absent from the
sitemap** as well: `noindex` and a sitemap entry together would be the sitemap
inviting a crawl the page's own tag then refuses.

Stadium URLs use the same **slug** mechanism (`/estadio/maracana`), derived from CBF's
venue string. `findStadium` re-slugs the segment before comparing, so a hand-typed
`/estadio/Maracanã` lands rather than 404-ing on an accent. There is deliberately **no
`/estadios` index and no nav entry** — see the bound on `NAV_ITEMS` above; a ground is
reached from a fixture, and from nowhere else. The club page carries no link to one:
`ClubView` names no venue at all, and the stadium page's **Mandantes** tiles run the
other way, stadium → club. Three files described that relationship backwards and
promised a door the club page has never had, which is worth knowing before you go
looking for it. So `/sitemap.xml` is the only route a crawler has to the 19 stadium
pages, exactly as it is for the rounds — the same reason, one section further on.

Club URLs use a **slug** (`/clube/flamengo`), derived from the short name by `slugify` in
`slug-core.ts`. The route carries a `key`, not a code, because the segment may be either:
`findClub` resolves a slug first and then a raw code, so `/clube/1783` — published before
slugs existed — still works. The seed generator rejects duplicate slugs the same way it
rejects duplicate codes and names; `atletico-mg` and `athletico-pr` differ by one letter
and both are real clubs.

`/painel/<key>` takes **the same key**, resolved by the same `findClub`, and inherits
the same duplicate — so `canonicalRoute` rewrites it to the slug exactly as it does for
`/clube/…`, and `pageStatus` judges both with one `unknown-club` branch rather than two
copies of one rule. It is a second section rather than `/clube/<key>/painel` for a
mechanical reason: `pageStatus` refuses a third path segment outright, and loosening
that is what keeps `/jogos/24/qualquer-coisa` from being an indexable page. The club
page is the only link to it, so `/sitemap.xml` is a crawler's only other route there —
the same argument the rounds and the stadiums already make, and 20 more URLs.

## Data

`src/data/broadcasts.ts` holds "onde assistir" channels. Regenerate with
`npm run sync-broadcasts [from] [to]`, which reads CBF's API **on a workstation** and
merges into the file — production never calls CBF. Hand-editing stays supported.
It holds "onde assistir" channels keyed by our match id, because no provider we use
carries broadcast data. `src/data/venues.ts` is generated by the same script and holds
stadium/city/state, because football-data has **no venue field at any tier** either. `docs/data-sources.md` records what every candidate source
actually provides, including CBF's undocumented broadcast API and why it is not a
request-time dependency.

`src/data/highlights.ts` holds "melhores momentos" links, hand-maintained but
fillable with `npx tsx scripts/find-highlights.ts --round <n> --write`. The
judgement of whether a video really is a given fixture lives in
`highlight-search-core.ts`, because a search returns the same clubs, score and
channel from previous seasons — proximity of the upload to kickoff is what
separates them, and a candidate whose exact date has not been read is held
rather than accepted. See `.claude/skills/find-highlights/SKILL.md`.
