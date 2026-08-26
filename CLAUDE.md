# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before anything else: take a worktree

Several Claude sessions share this checkout. **Do your work in a git worktree, never in
the root checkout** — root is for integration.

```sh
git worktree add .claude/worktrees/<name> -b worktree-<name>
cp .env .claude/worktrees/<name>/.env   # gitignored, so it does not come along
cd .claude/worktrees/<name> && npm ci   # each worktree needs its own node_modules
```

This is the one rule here that protects *other people's* work rather than your own, which
is why it is at the top rather than filed under a section you reach after deciding what to
do. A branch switch in the shared root carries whatever is uncommitted across into
whatever gets checked out next. That is how a merged, deployed commit came to look like a
deliberate revert — several sessions spent an hour diagnosing files nobody had edited. The
tree was nine paths dirty at the time and nothing about it looked wrong.

The failure repeats because it resets: a session that has been told this moves out and
works cleanly, and the next one starts in root again. Assume you are the next one.

Full rules — commits, stashes, ports, and why the directory is gitignored — under
**Working alongside other sessions** below.

## Project

"Portal Brasileirão" — a companion app for the Campeonato Brasileiro Série A: standings and
round-by-round match detail. React 19 + Vite + TypeScript + Tailwind v4, served by an
Express backend that also runs Vite in dev. Deploy target is AWS.

Modeled on the sibling repo `../agora_na_copa_2026` (a World Cup 2026 companion built the
same way). When a structural question isn't answered here, that repo is the reference
implementation — read it rather than inventing a new pattern.

## Commands

- `npm run dev` — start `server.ts` via `tsx`; it runs Vite in middleware mode, so this is
  the single command for full-stack dev (port 3000, walking to the next free port if busy).
- `npm run build` — build the frontend with Vite, then bundle `server.ts` into
  `dist/server.cjs` with esbuild (`--packages=external`).
- `npm start` — run the production build (`NODE_ENV=production node dist/server.cjs`).
- `npm run lint` — `tsc --noEmit` over the whole project. There is no ESLint; this is the
  lint gate.
- `npm run test:unit` — Node's built-in test runner over the core-module tests.
- `npm run sync-og-image` — redraw `public/og-default.png`, the link-preview card.
- `npm run test:e2e` — Playwright, booting its own server on port 3100.
- One test file: `node --import tsx --test tests/standings-core.test.ts`
- One test by name: `node --import tsx --test --test-name-pattern "tie-breakers" tests/standings-core.test.ts`

`npm run test:unit` lists its test files explicitly, mirroring the sibling repo. A new
`tests/*.test.ts` file does **not** run until it is added to that script.

## Architecture

### Single-process server

`server.ts` is one Express server that owns the API routes, mounts Vite as middleware in
development, and serves `dist/` statically in production with an SPA catch-all. Dev and
prod run the same process — there is no separate frontend server to start. `resolveAppPort`
probes ports and walks upward from `PORT` so a stale dev server doesn't block a restart;
`STRICT_PORT=true` makes it fail instead, which is what CI wants.

### Pure `*-core.ts` modules

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

- `venue-core.ts` — the **Página do estádio**. `buildStadiums` groups fixtures into
  grounds, because **a stadium is not an entity in any payload**: football-data has no
  venue field at any tier, and CBF reports only a `Stadium - City - UF` string per match.
  Identity is therefore the **slug** of that string, which is what makes `ARENA MRV` and
  `Arena MRV` one stadium rather than two — CBF's casing drifts by design, since
  `venues.ts` stores its values verbatim rather than guessing at proper names. It reuses
  `slugify` from `club-core.ts` deliberately; a second normaliser is how two spellings of
  one ground come to disagree. Home clubs are derived from who hosted there, so the page
  needs no curated club list. A fixture whose venue slugs to nothing is skipped rather
  than bucketed under an empty key, which would collect unrelated grounds into one page.
  `stadiumPhotoUrl` builds the address of a vendored photograph on **our own
  origin**, keyed by stadium slug and width; `stadiumPhotoPage` still builds the
  Commons file-page link the licence requires. `PHOTO_WIDTHS` lives here rather
  than beside the `<img>`, because `sync-stadium-photos` writes exactly those
  files — two copies of that list is how the page comes to request a size nobody
  vendored, which fails as a missing image rather than as a build error.

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


Extract to a core module before logic in `server.ts` grows a branch worth testing.

### Data provider

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
  degrade to SCHEDULED rather than dropping the fixture.
- Scores are read from `fullTime.home`/`away` **and** the legacy `homeTeam`/`awayTeam`
  spelling, because the published docs disagree with the v4 payload and guessing wrong
  silently blanks every scoreline. Note `0` is a real score — only `null` means unplayed.
- Club codes prefer the upstream `tla` (FLA, PAL, …), which lines up with the local seed
  codes, falling back to a synthetic `FD-<id>`.
- Standings read the `TOTAL` group only, never the HOME/AWAY splits.
- **Squads arrive embedded in the competition's team list**, not from a per-team
  endpoint: `/competitions/BSA/teams` carries a `squad` array on each of the
  twenty clubs, so `mapSquads` builds the whole division's elencos from **one**
  request rather than twenty. That is the only reason the Jogadores page is
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

### Caching and failure handling

`cache-core.ts` holds a TTL cache and a circuit breaker. Both take `now` as a parameter
instead of reading the clock, so expiry and recovery are tested without sleeping.

The free tier allows **10 requests/minute** — caching is what makes it viable in
production, not a nicety. Standings cache 60s, fixtures 60s, dropping to 15s while any
match is LIVE, capping the app at roughly 5 upstream calls/minute at any traffic level.
The breaker opens after 3 consecutive failures for 60s, so a downed upstream gets one
probe a minute rather than one per request.

### API envelope

Every data endpoint returns `ApiEnvelope<T>`: `source`, a human-readable pt-BR `note`, and
`updatedAt` alongside `data`. `source` distinguishes `football-data` (live) from
`placeholder` (no token configured) and `fallback` (configured but failing) — the last two
look identical to a reader but only `fallback` is worth alerting on. The UI banners the
note for anything that isn't live. New endpoints keep this shape and degrade to local data
rather than returning a 500.

Current routes: `/api/health`, `/api/clubs`, `/api/standings`, `/api/scorers`,
`/api/squads` (every club's elenco; one upstream request serves all twenty),
`/api/players/:id` (numeric id, else 400 — enrichment only, answers `null` offline;
note its `currentTeam` is often a national team, which is why the card prefers the
club the page already knew),
`/api/matches` (optional `?round=` — a non-integer or `< 1` is a 400).

Adding a section is: a `NAV_ITEMS` entry in `src/navigation.ts`, a `Route` variant plus
parse/format cases in `route-core.ts`, a case in `App`'s view switch, and — if it needs new
data — a pure mapper in `football-data-core.ts`, a seed snapshot in
`scripts/sync-seed-data.ts`, and a cached route in `server.ts`. `NavBar` needs no change
*for the entry itself* — that promise held when Jogadores was added — but see the width
arithmetic below: the bar had slack for four items' padding and not for five.

**A new `Route` variant is a four-file change, and only one of the four is enforced.**
Since the crawl surface landed, a variant also needs a case in `page-meta-core.ts`, a
`pageStatus` rule and sitemap entry in `seo-core.ts`, and breadcrumbs in
`structured-data-core.ts`. Only `structured-data-core`'s `trailFor` is caught by the
compiler — its switch returns a value, so a missing case makes it non-exhaustive and
`tsc` fails. The other three fall through to defaults and fail **silently**: the page
gets generic metadata, is absent from the sitemap, and — the one that actually
matters — `pageStatus` answers **200 with a copy of the shell** for every unrecognised
argument under the new section. That is an unbounded set of duplicate pages offered to a
crawler, and nothing goes red. `/estadio/qualquer-coisa` did exactly this until the rule
was added. Adding the variant is the easy half; grep the other three files for a sibling
section (`"partida"` is the closest analogue) and follow it through.

The `NAV_ITEMS` entry carries its own `Icon`, which is *why* `NavBar` never changes — an
icon looked up by id inside `NavBar` would break that promise the first time anyone added
a section.

**The promise is bounded, and the bound is now spent.** Material Design 3's navigation bar
carries **three to five** destinations. Ao vivo made it four; Jogadores took the fifth.
**The bar is full.** A sixth section wants MD3's navigation *drawer*, not a sixth entry
here — and at the sixth nothing fails, no build breaks and no test goes red, which is why
this is a real limit rather than a style note: the tooling cannot check it for you.

**The fifth entry was not free, and what it cost was measured rather than eyeballed.** A
nav item's minimum width is its 64dp MD3 indicator plus whatever padding it carries; at
`px-2` that is 80dp, and five of those is 400dp on a 375dp screen. The fifth label was
clipped at the screen edge with **no horizontal scroll to reveal it** — invisible on a
desktop, and invisible to every test in the suite until `tests/e2e/players.spec.ts` began
measuring each item's box against the bar's at 320, 360 and 375dp. The padding is what gave
way, because MD3 does not specify it while it does specify the indicator. Below 360dp even
that is not enough: five indicators at 64dp is 320dp exactly, leaving nothing for
"Classificação", whose label alone measures 79dp — so the indicator degrades to 56dp under
`min-[360px]:`, and only there, where the spec cannot be satisfied at all. A sixth entry has
no such slack left to find.

### Page metadata

`page-meta-core.ts` maps a route plus loaded data to a title, description and preview
image. It is used **twice on purpose**: `usePageMeta` sets `document.title` on the client,
and the production SPA handler injects the same values into the HTML it serves.

Both halves are needed. The client half updates the browser tab; **link previews never run
JavaScript**, so without the server half every shared URL unfurls as the generic site
name. `injectMeta` replaces the existing title and description rather than appending, so
the document never carries two, and escapes every value it writes.

The server only loads data for routes that name something (`clube`, `partida`,
`estadio`), and takes it from the same cached payload the API serves — no extra upstream
request. The stadium list is *derived* from that payload rather than fetched, for the
reason `venue-core.ts` gives. If that load fails the page still renders with generic
metadata: metadata is a nicety, never a reason to fail a page.

Canonical and `og:url` come from **`APP_URL`** in the host's `.env`. If that is stale,
every canonical points at the wrong origin.

### Crawlers and structured data

`seo-core.ts` and `structured-data-core.ts` are pure, like every other core module, and
cover the three things `page-meta-core.ts` does not: the canonical address of a route,
whether that address is worth indexing, and the JSON-LD that lets a fixture page be read
as a fixture rather than as prose about one.

**The app answers something for every path, and that is right for a reader and wrong for a
crawler.** `parseRoute` sends anything unrecognised to the table, so `/qualquer-coisa`
served a 200 was an indexable duplicate of the home page — and there are infinitely many
of those. `pageStatus` is where the two audiences part company: the body stays friendly,
the status code and `noindex` tell the truth. Unknown sections, a club or fixture that does
not resolve, a round outside the season and an undecodable path are all 404 + noindex with
the classificação still rendered beneath.

**Absent data is not proof of absence.** `pageStatus` only declares a club missing when the
club list actually arrived. Otherwise a provider outage would 404 all 380 fixture pages at
once and a crawler would drop them over an incident lasting minutes.

**The sitemap is load-bearing, not a nicety.** The round picker is a `<select>`, not a set
of links, so every round but the current one — and with it nearly every fixture page — has
no inbound link anywhere on the site. `/sitemap.xml` is the only way a crawler reaches
them. 442 URLs at full season, against a 50,000 limit, so no sitemap index is needed. A
finished match takes its kickoff as `lastmod`, because that is when the page stopped
changing; claiming today's date for a fixture played in April trains a crawler to stop
believing the field.

**The origin comes from `APP_URL` first and the request second.** The request fallback
keeps a fresh clone emitting working canonicals with no `.env`, and `resolveOrigin`
validates the host against a strict pattern before using it — the value lands in
`<link rel="canonical">`, so an unvalidated `Host` header lets a third party claim
ownership of this site's content. `X-Forwarded-*` is consulted only when `TRUST_PROXY=true`.

**The client half must not overwrite the server half before its data lands.** `usePageMeta`
now maintains canonical, `og:url` and robots as well as the title — an in-app navigation
otherwise leaves the canonical claiming the entry page owns every later one. But it renders
before its fetch resolves, and writing then would replace `/clube/athletico-pr` with
`/clube/1768` and strip the `noindex` off a page that really is missing. `subjectResolved`
gates it: where it is false, the server's tags stand.

Two traps, both found by their own tests rather than by reading:

- **`app.get("*")` matches through a wildcard *parameter*, and Express percent-decodes
  parameters while matching.** So `/clube/%` throws `URIError` inside the router and
  Express answers its own 400 error page before any handler runs. The guard registered by
  `registerSpaFallback` decodes first and hands the request to the normal renderer.
- **`vite.transformIndexHtml` decodes the URL it is given**, to resolve which HTML file is
  being asked for. Passing an undecodable `originalUrl` turns that 400 into a 500 from our
  own handler, which is why the dev branch passes `/` when the request URL will not decode.

**The dev server injects metadata too, and `appType` is `"custom"` for that reason.**
Vite's `"spa"` fallback serves `index.html` itself with a 200 and an untouched head, which
took the handler out of the loop and hid the metadata, the JSON-LD and every 404 rule from
the whole e2e suite. Assets still resolve because `vite.middlewares` runs first.

schema.org's event statuses describe **whether an event happened as announced**, not where
it is in its lifecycle: there is no "in progress" and no "finished". LIVE and FINISHED are
therefore both `EventScheduled`, and only POSTPONED and CANCELLED get a value of their own.

`jsonLdScript` escapes `<` as `\u003c`, not as `&lt;`: a `script` element's contents are
not HTML-parsed, so an entity would reach the JSON parser literally and break it, while an
unescaped `</script>` in a club name would close the tag and spill the payload into the
document.

### Link previews

`public/og-default.png` is the 1200×630 card, drawn by `npm run sync-og-image`
(`scripts/generate-og-image.ts`) and **committed**, because a preview has to resolve on a
host that only ever runs `npm ci --omit=dev`.

**It has to be a raster image.** No platform that matters renders SVG for `og:image` —
Facebook, X, LinkedIn and WhatsApp all reject or blank it — so the card is drawn with the
same headless Chromium `scripts/screenshot.ts` already uses rather than by adding an image
dependency. The colours are read out of `src/index.css` at generation time rather than
written into the script: every value in that file is emitted by `sync-md3-tokens`, and a
second hand-kept copy is how the card ends up a shade off the site it advertises. A token
that has been renamed away fails the run instead of drawing in black.

There is deliberately **no `--check` mode**, unlike `test:tokens`: the bytes vary with the
Chromium build and the host's fonts, so a byte-comparison gate would go red on an unrelated
browser bump. Regenerate by hand when the palette or the wording changes.

**Which image a page gets is a judgement, not a default.** A club page takes its crest,
because that is genuinely what the page is about. Everything else — including a fixture —
takes the site card: a match is *two* clubs, and illustrating it with the home crest asserts
the page is about that one, which is also how the away side's supporters read it.

A **stadium** page still takes the site card, even though it now shows a photograph of
the ground and that photograph would fill a wide card properly. Not an oversight: an
`og:image` is republication on somebody else's surface, where the credit line the
licence requires does not travel with it. Serving the site card is the choice that
does not put an unattributed CC BY-SA photo into every scraper's cache.

**`twitter:card` follows the image's shape**, which is what its two values mean. It used to
be inverted — `summary` whenever an image existed and `summary_large_image` when none did,
declaring the wide layout precisely when there was nothing to fill it. A square crest in a
wide card is a logo adrift in whitespace, so a crest takes `summary` and the site card takes
`summary_large_image`.

`og:image:width`/`height` ride along only for the site card. A crest arrives from the
provider at an unspecified size, and guessing would tell a scraper to reserve a box the
image does not fill. As with the canonical tag and the sitemap, no origin means **no
image tag at all** rather than a root-relative URL — a scraper fetches from its own host, so
`/og-default.png` resolves nowhere and renders as a broken preview rather than a plain one.

### Routing

The URL is the source of truth for the visible section; `App` holds no section state.
`route-core.ts` is pure parse/format with no History API and no React, so every path shape
is unit-tested without a browser. `src/useRoute.ts` binds it to `pushState`/`popstate`.

Nav entries and club names are real `<a href>` elements, so middle-click and "open in new
tab" behave. Their click handlers bail out on modified clicks rather than swallowing them.

**Deep links depend on the server's SPA catch-all.** `/clube/1783` is not a file, so
`express.static` misses and the `app.get("*")` handler serves `index.html`. That handler
must stay registered *after* the API routes, or `/api/*` would be swallowed by it. Verified
in both dev (Vite middleware, `appType: "custom"` — see **Crawlers and structured data**
for why) and the production bundle.

Unrecognised paths and nonsense rounds resolve to something useful rather than 404 — a
stale link should still land somewhere.

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
`club-core.ts`. The route carries a `key`, not a code, because the segment may be either:
`findClub` resolves a slug first and then a raw code, so `/clube/1783` — published before
slugs existed — still works. The seed generator rejects duplicate slugs the same way it
rejects duplicate codes and names; `atletico-mg` and `athletico-pr` differ by one letter
and both are real clubs.

### Data

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

`src/data/club-hymns.ts` holds each club's hymn on YouTube, hand-maintained the
same way and for the same reason — no provider carries one. It stores the video
id alone; `hymnUrl` in `club-core.ts` builds the address. Every id was checked
through YouTube's oEmbed endpoint (`/oembed?url=…&format=json`, which reports
title and channel) before being written down, because a search for a club's hymn
returns near-misses that the URL does not distinguish — the hymn of the *city* of
Santos among the club's, for one. That check is now a script:

```sh
npm run check-hymns                                  # every id resolves and names its club
npm run check-hymns https://brasileirao.mpbarbosa.com # …and the deploy serves the same ids
```

It talks to YouTube only, so it costs nothing from the football-data budget, and
it prints the whole table rather than only the failures — a title match narrows
what a human reads, it does not prove the recording is the right one. Nothing
runs it automatically: CI has no network dependency on a third party by design,
and a link that rots on someone else's server is not a reason for a red build on
a commit that did not touch it.

`src/data/player-instagram.ts` holds players' own Instagram accounts, keyed by
**player id** and hand-maintained for the same reason `club-instagram.ts` is: no
provider carries a social account at any tier. Coverage is deliberately
**partial** — 38 of ~950 listed players — and grows by hand, like `broadcasts.ts`.

**There is no `check-player-instagram` script, and that is not an oversight.**
Instagram serves the identical JavaScript shell for a real handle and an invented
one — 200, `<title>Instagram</title>`, no Open Graph tags — so the check
`check-hymns` and `check-stadium-photos` perform is simply unavailable here, and
a script that fetched a profile and reported success would confirm nothing while
looking exactly like the ones that confirm something. Candidates came from
Wikidata's `P2003` joined to `squads.ts` on **exact date of birth**, then each was
confirmed against a search result carrying the profile's own title, follower count
and — where visible — a bio naming the club. That pass rejected or corrected
**13 of 70**: six wrong handles (Ramón Sosa's `sosa` is somebody else's account;
Nicolás De La Cruz differs from the recorded handle by one underscore), one
account since **deactivated**, and the rest uncorroborated or split between two
rival profiles. Absent is the honest answer for those. Do not add a handle
without opening it.

`src/data/club-wikipedia.ts` holds each club's article on the **Portuguese**
Wikipedia, hand-maintained for the same reason. It stores the title alone
("Sociedade Esportiva Palmeiras"); `wikipediaUrl` in `club-core.ts` builds the
address. The title is not derivable from data the app holds — `name` is the
provider's abbreviation ("SE Palmeiras"), `shortName` the popular name, and the
article sits at the full legal one, with the club's own spelling ("Foot-Ball",
"Foot Ball", "Athletico"). Every title was checked through the MediaWiki API
(`/w/api.php?action=query&titles=…&redirects=1&prop=extracts&exintro=1`, which
reports existence, redirects and the first sentence) before being written down;
all twenty resolve directly, and each intro names the club.

`src/data/player-wikipedia.ts` holds each player's article on the **Portuguese**
Wikipedia, keyed by player id and storing the **title alone**, exactly as
`club-wikipedia.ts` does. `wikipediaUrl` builds the address. The title is not
derivable from anything the app holds — **79 of the 169 recorded titles differ
from the listed name**, most of them disambiguated ("Dudu (futebolista, 1992)",
"Luiz Gustavo (futebolista, 1987)"), because the popular name is shared.

**This one has a checker, and its Instagram sibling deliberately does not:**

```sh
npm run check-player-wikipedia   # 169 articles, one API call per 20
```

That asymmetry is a property of the two hosts, not of how carefully each file
was built. Wikipedia answers a machine honestly; Instagram serves the same
shell for a real handle and an invented one. Do not read it as an inconsistency
and do not "fix" it by adding a script that fetches a profile and reports 200.

The check is: the article resolves following redirects, its `wikibase_item`
round-trips to the Wikidata id the sitelink came from, it is not a
disambiguation page, and **its own intro states the same birth date as
`squads.ts`**. The birth date is the load-bearing one. Candidates came from a
Wikidata `ptwiki` sitelink joined on date of birth, and three of 160 still drew
the wrong person — the article offered for "Willian Oliveira" opens "6 de junho
de 1989" against a squad list saying 1993-05-16, because it is about Willian
Farias. A title match cannot see that; only reading the article can. One trap
when editing the checker: pt-BR writes the first of the month as an ordinal, so
`1º` and `1.º` are accepted beside `1`, and without that Bruno Fuchs reads as a
mismatch on every run.

`src/data/player-photos.ts` holds a photograph for a player, keyed by player id,
from **Wikimedia Commons** — the bytes vendored into `public/players/` by
`npm run sync-player-photos` and served from our own origin. **70 players, 2.9 MB**,
chosen out of 100 candidates by opening every one at the size the card renders.

**Instagram is not a source and cannot be**, which is worth stating because the
handle sits in the file next door and the question comes up. A player's own
photographs are their copyright; a public profile licenses nothing, the CDN
addresses expire, and hotlinking them republishes someone's work without
permission. Commons is the source precisely because every file carries a licence
that says what a reuser may do.

The vendoring argument is **stronger here than for stadiums**. That one had to be
made from what a future design might do, since a stadium page shows one image.
Opening several player cards in a row is not a future design — it is how the
Jogadores page is read, and it is exactly the shape that earns Commons' 429.

```sh
npm run sync-player-photos    # re-reads every licence and credit, then vendors
npm run check-player-photos   # …and verifies what is on disk still matches
```

`credit`, `license` and `licenseUrl` are **required** on `PlayerPhoto`: a player
may have no photograph, but may not have an unattributed one. The credit renders
at the foot of the card as a condition of showing the picture — if it goes, the
picture goes with it. `tests/player-photos.test.ts` asserts the *data* rather
than the code for that reason: the compiler is satisfied by an empty string,
which reads on the page as a missing attribution.

**`redistributable` refuses "Public domain", and that is the licence to think
hardest about before widening.** It is the second most common among candidate
player photographs (23 of 125 surveyed), so the temptation is real; but on
Commons it is an umbrella over dozens of tags, some country-specific and some
contested, and `deedFor` cannot name the deed a reuser would rely on. Widening it
is a change to `commons-core.ts` with the stadium photographs downstream.

**Two traps, both of which the stadium photographs hit first, and a survey that
rejected 30 of 100 on them.** A file that resolves is not a photograph of the
right person — for a player the trap is a **team photograph**, and it is far
commoner than the stadium equivalent: the lead images offered for João Paulo and
Cristian Medina are a Santos line-up and Argentina's starting eleven, Edenilson's
is captioned "Players of SC Corinthians" under a file named for a different
player, and Dudu and Marllon were offered the *same* match photograph. The rest
of the rejections are real pictures of the right player that are unusable at
64px — a full-body action shot leaves a face a few pixels wide, and one player's
only free photograph has his face covered by a snood. Two more were rejected by
the rules rather than by looking: one candidate named the player nowhere, and one
carried no attribution at all.

And a free photograph of a footballer is usually **old**, and usually another
club's: Commons has what somebody was free to release. Memphis Depay's shows him
at Olympique Lyonnais in 2019. That is why `alt` names the shirt and the year
rather than the player, whom the card already names beside it.

`scripts/commons-api.ts` holds the HTTP half — fetching a file's metadata and its
bytes — shared by all four Commons scripts. It was extracted when the player
scripts would have made a fourth copy, and the two stadium copies had already
drifted: one asked Commons for `ImageDescription` and the other did not. It stays
separate from `commons-core.ts`, which is pure and holds the *judgement*, because
that split is what lets the licence rules be unit-tested without a network.

`src/data/player-sofascore.ts` holds each player's profile on **Sofascore**,
keyed by player id and storing the **id alone** — the curated player file whose
stored value is smallest, for a reason worth reading. A Sofascore URL looks like `/pt/football/player/memphis-depay/138833`, but none of
that path except the number is load-bearing: **`_` in the slug position resolves
by id** and redirects to the canonical address, which is Wikidata's own
formatter for this identifier (P12302). So `sofascoreUrl` in `player-core.ts`
builds `…/player/_/<id>`, the file stays a plain `Record<string, string>` like
its two neighbours, and a slug Sofascore renames tomorrow cannot rot a link
here. The `/pt/` prefix is not stored either and must not be added: `/pt/player/_/138833`
is a **404**, and the prefixed form a reader pastes redirects to the unprefixed
address regardless — Sofascore negotiates the language itself.

Coverage is 427 of 948. Candidates came from Wikidata's P12302 joined to
`squads.ts` on exact date of birth **plus** an exact normalised name, and 141 of
them needed no name match at all — their `ptwiki` title is the one
`player-wikipedia.ts` already records, so they ride on a join
`check-player-wikipedia` has verified against the article's own birth date.
Every match was then re-queried for citizenship and occupation; that caught
three real cross-person matches on the name+date path (Vitinho, Matheus Reis,
Alexandre Guedes), all dropped.

**There is no `check-player-sofascore`, and like the Instagram file that is a
property of the host rather than of diligence.** Sofascore sits behind
Cloudflare and answers **403** to every scripted request, `api.sofascore.com`
included, whatever the User-Agent — so a checker would have nothing to read.
Eight ids were opened in a real browser instead. Do not add one from a search
result without opening it.

`src/data/stadiums.ts` holds each ground's official name, capacity and year of
inauguration, hand-maintained for the same reason as the hymns — **no provider carries
any of it**, and CBF's feed stops at a name, a city and a state. Keyed by stadium slug,
not by match id, which is what `venues.ts` uses. Every value was read out of the
stadium's article on the Portuguese Wikipedia (the infobox's `nome_completo`,
`capacidade`, `datainauguração`) before being written down, because **a plausible
capacity is indistinguishable from a correct one** to anyone reading the page — an
invented number would never be caught. Two grounds' articles state no inauguration year;
`opened` is absent for them rather than guessed, and the page simply omits the tile.
`name` is the popular name properly cased, which is what overrides CBF's `ARENA MRV` on
both the stadium page and the match page's Estádio line; `officialName` is carried only
where it genuinely differs.

It also holds each ground's **photograph**, named by its **file title on Wikimedia
Commons** — `"ARENA MRV.jpg"` — exactly as `wikipedia` stores an article title. The
title is the *source*; the bytes are **vendored into `public/stadiums/`** by
`npm run sync-stadium-photos` and served from our own origin, the same answer the
broadcaster marks got and for the same reason (`docs/roadmap.md` principle 4). They
shipped hotlinked and were vendored afterwards — one image per page had not tripped
Commons' 429, but that is a property of the layout rather than of the code.

The sync's licence rule is deliberately **looser than the marks'**: `redistributable`
in `commons-core.ts` admits CC0, CC BY and CC BY-SA, because a photograph renders its
credit as a condition of display and so the obligation is met, where a mark has no
credit line beside it. It refuses any licence it cannot *name* rather than anything on
a blocklist. `commons-core.ts` is shared with `check-stadium-photos` on purpose — a
second copy of that judgement is how the checker comes to pass a file the sync refuses.

```sh
npm run sync-stadium-photos   # 19 grounds × 2 widths, ~17 MB, re-reads every licence
```

**The credit is not decoration.** Every licence in that file except one CC0 upload
requires the photographer to be named wherever the image appears, so `credit`,
`license` and `licenseUrl` are **required** fields on `StadiumPhoto` while everything
else about a stadium is optional — a ground may have no photo, but it may not have an
unattributed one. Credit strings are copied **verbatim**, trailing semicolons and all:
where Commons publishes an `Attribution` field the photographer dictated that wording,
and tidying it into house style is exactly the edit that is not ours to make. Three of
them were tidied in the first draft and `check-stadium-photos` caught all three.

**A file that resolves is not a photo of the right ground.** The obvious automation —
take the lead image of the ground's Wikipedia article — is wrong often enough to be a
trap: the Maracanã, the Mineirão and the Arena do Grêmio all lead with the stadium's
*logo*, and a correctly-titled Commons file for the Nilton Santos is described there as
a journalist posing outside it. Every file was opened and looked at, and `alt` was
written from that viewing rather than from the name. Verify with:

```sh
npm run check-stadium-photos                                  # each file, credit and licence still match Commons
npm run check-stadium-photos https://brasileirao.mpbarbosa.com # …and the deploy serves the same files
```

It talks to Commons only, so it costs nothing from the football-data budget, and like
`check-hymns` it prints the whole table — it narrows what a person has to look at, it
does not replace looking. Nothing runs it automatically, for the reason given there.

`src/data/rank-history.ts` is generated by `npm run sync-rank-history`, which fetches
nothing — it derives the campanha from the seed fixtures already on disk. It is therefore
only as current as `matches.ts`, so **regenerate it after every `sync-seed-data`** or the
two files describe different seasons. The generator validates its own output: every club
must have an entry for every round, and each round's positions must be a permutation of
1..N, because a duplicated or missing position is invisible once it is drawn as a line.

`src/data/squads.ts` is generated by the same `sync-seed-data` run and costs **no extra
request**: the club rows, the postal address the state is parsed from, and every club's
squad all come out of the one `/competitions/BSA/teams` payload. It references clubs
through `CLUBS_BY_CODE` rather than restating them, so it cannot come to disagree with
`clubs.ts` about a crest or a name, and it throws at import time if it names a club that
file does not have. The generator **warns but does not fail** when a club has no squad
upstream: that is a gap the page renders honestly, and the alternative is noticing it
months later on the page itself.

`src/data/clubs.ts` and `src/data/matches.ts` are **generated files** — a frozen snapshot of
the real division and season, serving as the offline fallback. Regenerate with:

```sh
npx tsx scripts/sync-seed-data.ts   # costs 3 calls against the 10/min budget
```

Do not hand-edit them; hand-maintenance is what let the original list drift to the wrong
division. The generator validates its own output: it rejects duplicate club codes, rejects
duplicate display names, and rejects a duplicate display name, which is what an override keyed to the
wrong club id produces.

**Club identity is the upstream numeric id, never `tla`.** The abbreviation is not unique:
Corinthians and Coritiba both report `tla: "COR"`, so keying on it merges two clubs into
one standings row. `tla` rides along on `Club` for display only. `/api/matches` ships the
clubs it saw alongside the fixtures so the UI resolves names from the payload.

`src/types.ts` is the single source of truth for shared shapes. Extend it before adding
fields to data files or components.

## Working alongside other sessions

Several Claude sessions share this checkout. Each takes its own **git worktree**
and branch under `.claude/worktrees/`, so their edits cannot collide — the
commands are at the top of this file, under **Before anything else**, and are
deliberately not repeated here: two copies of a setup snippet is how one of them
comes to be wrong.

`git worktree list` shows who is where. The directory is gitignored, because a
worktree is a whole second checkout and one `git add -A` would otherwise commit
another session's entire tree into this one.

Rules that follow from sharing a repository:

- **Commit explicit paths, never `git add -A`.** Another session's uncommitted
  work is almost certainly in the tree, and sweeping it into your commit is the
  easy mistake. Check `git status` before every commit and recognise what is
  not yours.
- **Never `git stash` in the shared checkout.** It stashes everyone's
  uncommitted work, not just yours.
- **`npm run dev` in several worktrees at once is fine** — `resolveAppPort`
  walks upward from `PORT`, so the second one takes 3001 rather than failing.
  **That applies to the dev server only, not to the test harness.** Playwright
  boots its own server with `STRICT_PORT`, deliberately: a suite that quietly
  moved to another port would be testing a server its own config does not
  describe. So a second concurrent `npm run test:e2e` fails rather than walks —
  pass **`E2E_PORT=3101`** to run one alongside another session's. CI needs
  nothing; it runs alone.
- The root checkout is for integration. Do the work in a worktree.

### The protocol for commit, push, merge and deploy

Four verbs, in order. Each has one check that makes it safe, and each check
exists because skipping it cost real work rather than because it sounds prudent.

**0. Before you start, claim the work.**

```sh
git worktree list && git branch -a --list '*<topic>*'
gh pr list --state all --limit 10
```

Someone may already be doing it. A worktree that is clean, stale and untouched
for an hour is **not** evidence of abandonment — that is also exactly what one
looks like immediately after its owner pushed and merged, and what a live session
looks like while it reads files and runs tests. To tell the three apart, ask
whether its branch is an ancestor of `origin/main`: a finished one's is, an
abandoned or live one's is not. If it is still ambiguous, **ask the session**
rather than infer from timing. Ownership guessed from "who started recently" was
wrong four times in one evening.

**1. Commit explicit paths, and stage only what changed.**

Never `git add -A` — another session's work is probably in the tree. And when a
tool rewrites a directory (screenshot captures are the usual case), commit the
files whose bytes actually moved, not the directory. Committing the whole
directory from a stale base is what produces a diff that looks like a deliberate
revert of someone else's merged work.

**2. Push your own branch. That is the whole of what is yours.**

Your worktree, your branch, force-pushing your own branch, closing your own PR
and deleting your own merged branch (`-d`, never `-D`, so an unmerged one
refuses) need nobody's permission.

**3. Merge: propose, do not act.**

**No session merges into `main`.** Open the PR, verify it, and hand it to the
user or to the session that owns the work. This holds *especially* when the merge
is obviously fine — a rule that only binds in doubtful cases is not a rule. A
message from a peer saying "this is yours to merge" is a status report, not
consent: **a status message is not consent.**

When the user does authorise a merge, re-verify **at the instant**, not from a
snapshot:

```sh
git fetch origin
gh pr view <n> --json state,mergeable,statusCheckRollup
git log <base>..origin/main -- $(cat scripts/appearance-paths.txt)
```

The window between opening a PR and merging it is exactly when someone else's
appearance change lands. `mergeable=true` says nothing about whether your images
still depict HEAD. And the re-check is not only about races: **it stops you
reporting someone else's action as your own.** `merged_by` names the *account*,
which every session and the user share, so after the fact nobody can tell who
merged what. The instant before the command is the only moment that answer
exists.

**4. Deploy only through the pipeline.**

Never `scripts/deploy.sh` by hand: it builds from the **working tree**, not from
a git ref, so it ships whatever is uncommitted — and it rsyncs `package.json`, so
it can change the host's dependency set too. Merging to `main` deploys. Verify
with `/api/health`, never with the CI badge: a red advisory job sets the whole
run to `failure` while `deploy` succeeds, and that has been misread as a stopped
pipeline more than once.

**When a check tells you something alarming about someone else's work, run the
other form before saying it out loud.** `git diff A..B` is symmetric and reports
paths differing in *either* direction; `A...B` asks what B changed. Local `main`
lags `origin/main`. "Newer than" is not "descendant of". `+0/-0` on a binary says
nothing about whether it is new or modified. Every one of those produced a
confident, specific, wrong claim about another session in a single day. Two
commands is cheaper than the retraction.

## Key conventions

- **Colours are semantic tokens, never palette shades.** `src/index.css` defines the
  full set under `@theme` — the `surface`/`surface-container-*` ladder,
  `line`/`line-strong`, `ink` through `ink-ghost`, and `positive`/`negative`/`warning`
  each with a lighter `-ink` for text. Components say `text-ink-muted`, not
  `text-slate-400`. A raw `slate-*`, `emerald-*`, `rose-*` or `amber-*` utility in a
  component is a regression: before tokens there were 32 distinct colour utilities and
  five shades of grey text.
  The surface ladder took its MD3 role names in M2: the page is **`surface`** (it was
  `canvas`), a card is **`surface-container-low`** (it was `surface`, which is the trap
  — MD3 means the page by that word), and `raised`/`raised-strong` became
  `surface-container`/`surface-container-high`. The `ink` and `line` names are still
  aliases onto `on-surface` and `outline-variant`; renaming those is a separate pass and
  nothing to do with elevation.
- **The token *values* are generated, not chosen.** Since the Material Design 3
  migration (`docs/roadmap.md`, phase M1) everything between the `MD3-TOKENS`
  markers in `src/index.css` comes from `npm run sync-md3-tokens`. Do not hand-edit
  inside those markers — `npm run test:tokens` fails if the file has drifted from
  the generator, and it also re-runs the contrast gate. Each value is a *tone* from
  a tonal palette seeded by `#10b981`, so contrast is a property of the tone pair
  rather than something checked afterwards. The MD3 role names (`primary`,
  `on-surface`, `outline`, the `surface-container` ladder) are emitted alongside the
  names above, which are aliases onto them until M2 renames the call sites. One trap:
  MD3 spells the page `surface`, but here that is still `canvas` and `surface` means
  a card. `scripts/md3-color-core.ts` implements HCT so no runtime dependency is added.
- **Two themes, one set of tokens.** `src/index.css` defines the palette under
  `@theme` (dark, the fallback) and again under `:root[data-theme="dark"]` and
  `:root[data-theme="light"]`. Components never change: only the values do. An inline
  script in `index.html` stamps `data-theme` **before first paint** — without it the page
  renders dark then repaints light, a flash no CSS ordering can fix because the choice
  lives in `localStorage`. `useTheme` seeds its state from that attribute rather than
  recomputing, for the same reason.
  The light palette is not the dark one inverted: status colours go *darker* to stay
  readable on a light page, and the faint inks go darker still. This is not symmetry for
  its own sake — `raised` sits at tone 94 on light but tone 12 on dark, so light has far
  less room beneath it before AA fails. Contrast was measured, not eyeballed, and is now
  enforced rather than recorded: `npm run test:tokens` checks every text token against
  `canvas`, `surface` **and** `raised` in both themes and refuses to emit a palette that
  falls below AA. Worst text pairing is 4.59 across 70 pairings; `ink-ghost`, used only
  for underline decoration and the large score separator, clears the 3:1 non-text floor.
  Checking all three backgrounds rather than `canvas` alone is what caught light's
  `ink-faint` on `bg-raised` at about 4.35. That pairing is **latent, not shipped** — every
  `bg-raised` call site today pairs with `ink-soft` or `ink-muted`, and `ink-faint` only
  appears inside filled surfaces. Which is the point: it is a trap that springs the first
  time someone puts faint text on a badge, a hover state or a dialog, and nothing would
  have flagged it. Enforcing the floor beats recording a number that was true when written.
  `scrim` is deliberately dark in both themes: a near-white veil over a light page does not
  read as "the content behind is inactive". `plate` is its mirror — light in both themes,
  because the broadcaster marks it backs are dark artwork on a transparent ground and
  disappear against a dark page.
- **Type comes from the MD3 type scale.** `text-body-small` through
  `text-display-large`, defined in `src/index.css`. The scale is hand-written and
  sits *outside* the `MD3-TOKENS` markers, so adding a step is an ordinary edit —
  and steps are added only when something renders them, which is how
  `display-large` arrived for the player card's shirt-number watermark. A bare `text-sm`, `text-xs`
  or `text-2xl` in a component is a regression, and so is a `tracking-*` utility:
  each step carries size, line height **and** letter spacing together, so naming
  one thing is the point.
  **Weight is not part of the scale.** MD3 prescribes 500 for its title and label
  steps; this app's headings are bold by choice, so components keep their explicit
  `font-*`. Weight is separable from the scale the same way the typeface is.
  **The typeface is the system stack** — no webfont ships. Roboto is already fourth
  in Tailwind's default `--font-sans`, so Android renders in MD3's own face for
  nothing. See `docs/roadmap.md` M0 for what that trades away.
- **Radii come from the MD3 shape scale.** `rounded-x-small` / `rounded-small` /
  `rounded-medium` / `rounded-large` / `rounded-x-large`, defined in `src/index.css`.
  A bare `rounded`, `rounded-lg` or `rounded-xl` in a component is a regression —
  Tailwind's scale and MD3's share names but not sizes (`rounded-lg` is 8px in Tailwind,
  MD3's large is 16dp), which is exactly how one panel ends up a step off from the one
  beside it.
- **Raised panels use `Surface`.** It owns the rounded-border chrome that was
  hand-repeated in five components. Padding and layout stay with the caller, since those
  genuinely differ. `filled` adds the card background; table containers stay unfilled
  because the table header supplies its own. Buttons and the round selector are *control*
  chrome, a separate pattern, and deliberately not folded in.
  Use `as` when the element matters: `MatchPage`'s scoreboard is `as="article"`, both for
  the document outline and because an end-to-end spec selects `main article`. This is the
  rule that drifted once already — that card was hand-rolled with a *different* radius
  than every other card until M2 folded it back in.
- **The Classificação freezes `#` and Clube.** Both are `sticky`, so the numbers scroll
  out from under the club name on a narrow screen rather than taking the name with them.
  Three things had to move together, and each is invisible until someone scrolls:
  the table is **`border-separate border-spacing-0`**, because in the collapsed model a
  cell's borders belong to the table and slide out from under a sticky cell — which means
  the row separator lives on every cell (`ROW_LINE`) rather than on the `<tr>`, since the
  separated model does not paint row borders at all; and the **G4/Z4 rail rides on the
  first cell, not the row**, because a row scrolls and would carry its rail away.
  The trap: `STICKY_CLUB`'s `left-12` must equal `STICKY_POSITION`'s `w-12`. Widen the
  position column alone and the two frozen columns overlap or gap — and only while
  scrolled, because ordinary table layout puts them adjacent either way. Three specs in
  `tests/e2e/standings.spec.ts` scroll a 380px viewport and check exactly these three
  things; nothing else would catch any of them.
  **A frozen column must never be the one that absorbs the table's `min-w` surplus.**
  Auto layout hands surplus to the widest column, which is Clube — so it rendered 219px
  around 137px of content at 360dp, and because that column is frozen the 82px of empty
  space was subtracted from the viewport permanently instead of scrolling away, leaving
  59px of a 326px container for all seven data columns. `STICKY_CLUB` therefore carries
  **`w-0`**, which does not mean zero: a specified width below a column's minimum is
  clamped up to it, so the column takes its content and the surplus goes to the columns
  that scroll. It needs no maintenance as club names change, where a hand-tuned `w-40`
  would clip a promoted club.
  The trap underneath it is that **the obvious measurement cannot see the failure**. A
  table column's minimum is its widest *unbreakable* run, so without `whitespace-nowrap`
  the clamp lands lower and the browser pays for it by wrapping the state onto a second
  line — 12 of 20 rows going 37px to 57px. Width alone reports that as a success, and it
  passed a `scrollWidth > clientWidth` clip check too, because a wrapped cell is not a
  clipped one. Assert **row height**, which is what `no club name wraps to a second line`
  does; the sibling spec asserts the frozen pair stays under 70% of the container.
- **Motion is MD3's, and `prefers-reduced-motion` is honoured.** A bare `transition`
  already means MD3 standard easing at 200ms, because `--default-transition-duration`
  and `--default-transition-timing-function` are overridden in `src/index.css` — do not
  add `duration-*`/`ease-*` per call site. **There is no `--duration-*` utility namespace
  in Tailwind v4**: `duration-short-4` compiles to nothing and silently leaves the
  default in place. The tokens are real custom properties, so hand-written CSS can use
  them; only the utility does not exist.
  **A Tailwind class that compiles is not a Tailwind class that applies.** A rotating
  disclosure chevron on the Jogadores page was written twice — `group-open:rotate-90` and
  an arbitrary `[details[open]_&]:rotate-90` — and *both* emitted a rule that the element
  genuinely matched, while `rotate` still computed to `0deg` in the page. The fix was to
  stop hand-drawing the mark and let `<details>` use the browser's own `::marker`, which
  rotates for free and cannot fail to compile. Two things worth keeping from it: the
  summary must **not** be `display: flex` or Chrome drops the marker (which is what pushes
  people toward a hand-drawn chevron in the first place), and a movement you cannot see is
  worth measuring in the page — `getComputedStyle(el).rotate`, not `.transform`, since
  Tailwind's `rotate-*` sets the `rotate` property.
  The reduced-motion block sets near-zero rather than `none`, so `transitionend` still
  fires, and it stops movement only — colour feedback survives, because a control that
  stops reacting is harder to use rather than calmer. `tests/e2e/motion.spec.ts` asserts
  both that motion exists and that the preference removes it.
- **Hover, focus and pressed come from `interaction.ts`.** `STATE_LAYER` is MD3's veil
  (8% hover, 10% focus and pressed, of `on-surface`); `FOCUS_RING` is the keyboard
  indicator; `LINK_UNDERLINE` and `BACK_LINK` cover the two text patterns. A
  hand-written `hover:` colour in a component is a regression.
  `FOCUS_RING` is deliberately **separate** from `STATE_LAYER`: they were one constant
  first, and the current nav entry — a filled chip that takes no veil — silently lost its
  focus ring with it. Anything focusable takes the ring; only things with a container
  take the veil. The general rule is worth more than the incident: hover and focus are
  two different affordances, and coupling them is invisible until exactly one control
  opts out of one of them. A focus ring must not be reachable only through a hover
  effect.
  Note these constants are plain strings, not functions taking a colour. Tailwind
  extracts class names by scanning source text, so `hover:bg-${role}/8` generates no CSS
  at all. Write a second constant rather than making one dynamic.
- **A club's external links live in `ClubLinks`** once they have more than one
  call site. `WikipediaLink` owns the whole anchor — glyph, label, `target`,
  `rel` and the screen-reader suffix — because those last three are what drift
  when a link is copied: a second copy missing `rel="noopener"` is a real defect
  that looks identical on the page. `GLYPH` holds the shared mark attributes, so
  an icon defined in `ClubView` cannot drift from one defined there. The other
  three marks stay local to `ClubView` because they still have one call site
  each; that is the rule, not an inconsistency — the Wikipédia mark moved out the
  moment the match page became its second caller.
- **A match's status is `StatusChip`.** Both the fixture list and the match page used
  to carry their own copy of the label map *and* the colour map. Two copies of a lookup
  table is how a new status renders in one place and blank in the other.
  **Broadcaster marks are a plate, not a chip**, and deliberately so: a chip takes its
  container colour from the tonal system, and `--color-plate` must stay `#ffffff` in both
  themes or the marks that are dark artwork on transparent grounds vanish silently. Keep
  the `data-mark` attribute — nine specs select on it precisely so markup can change.
- **The player card sets numbers apart from words.** A **Ficha** is a figure —
  `Camisa`, `Idade`, a scorer's four tallies — set at the headline step in
  `text-primary` against a short accent rule, with the unit in its caption rather
  than in the value. A **Linha do cartão** is a word — `Posição`,
  `Nacionalidade`, `Nascimento` — label left, value right, on a hairline. Before
  the split every fact on the card was the same size and the same grey, which is
  a wall of equal-looking values with nothing to look at first.
  Both are built from *lists of what is present* rather than from a fixed grid,
  because almost every field is optional: the competition's team payload carries
  no shirt number for anyone, so `Camisa` and the watermark exist only once
  `/api/players/:id` has answered, and the artilharia knows a name and four
  tallies and nothing else. Nothing renders a dash standing in for a value that
  was never reported.
  The body is spaced with `space-y`, not a `mt-*` per block, for the same reason:
  a margin belonging to a conditional block leaves a gap above whichever one
  happens to be first — the artilharia card opened with exactly that.
  **`text-primary` is text here, which MD3 does not promise.** Its guarantee is
  that `on-primary` is readable on `primary`; primary *as ink on a surface* is a
  pairing nothing had used, so it was added to the contrast gate as a live
  pairing rather than measured once and written down. It clears AA in both
  themes, tightest at 5.49 on light.
- **The provider's English is translated at the edge, never rendered.**
  `positionLabel` and `nationalityLabel` in `player-core.ts` are the two, and
  both follow the same contract: an unmapped value is shown **verbatim** rather
  than guessed at or blanked, because the English word serves a reader better
  than nothing and is a visible prompt to add the row. `NATIONALITY_LABELS` is
  hand-written — `Intl.DisplayNames` speaks ISO region codes while the provider
  sends its own names (`DR Congo`, `Ivory Coast`), and `England` is football
  counting the home nations separately. A unit test asserts every nationality in
  `squads.ts` is mapped, so the table goes red on the next `sync-seed-data`
  rather than silently leaking English after a transfer window.
- **The card's club comes from the page, not from the enrichment.**
  `/api/players/:id` reports football-data's `currentTeam`, which for an
  international is frequently the **national team** — opened from the Corinthians
  elenco, Memphis Depay's card read "Netherlands" under his name and
  "Netherlands" again as his nationality, verified on a live payload. Whoever
  opened the card already knows better: `PlayersView` attaches the club whose
  elenco the player was listed in, and a scorer carries the club they scored for,
  and both are Série A clubs by construction. `mergePlayer` is deliberately left
  alone — it is right for every other field.
- **The player card is a native `<dialog>` opened with `showModal()`.** Not an overlay
  div: modality has to be real. It carried `aria-modal="true"` for months while Tab
  walked straight out of it. The browser gives the focus trap, `inert` behind, the top
  layer and focus restoration; body scroll is locked separately, because modality does
  not stop the page scrolling. Two traps if you touch it: Escape arrives as `cancel`,
  not `keydown`; and Tailwind's preflight resets `margin: 0`, which kills the user
  agent's `dialog { margin: auto }`, so horizontal centring must be set explicitly.
- **Controls use `Button` or `controlClasses`.** The bordered chrome was hand-written in
  six places, which is how a stepper ends up with a `transition` its neighbour lacks.
  Two variants exist — `outlined` and `tonal` — and MD3's other three are absent because
  nothing renders them. `tonal` also takes MD3's pill where `outlined` keeps the shape
  scale, because a pill beside a right-aligned `tabular-nums` column reads as floating.
  `Button` also defaults `type="button"` — the HTML default is `"submit"`, which silently
  submits any enclosing form. `controlClasses` exists separately because not every control
  is a `<button>`: the goals link is an anchor and the round picker a `<select>`, and both
  should look identical to the buttons beside them.
  **Do not pass a utility through `extra` that the base already sets.** Two utilities of
  equal specificity are resolved by *stylesheet* order, not class order, so an override
  like `text-ink` against the base's `text-ink-soft` is a coin flip. Change the base, or
  live with it.
- **Brazilian Portuguese copy** — all user-facing text and error messages are pt-BR in the
  football-broadcast voice. `CONTEXT.md` is the domain glossary: read it before naming a new
  concept, and add the term there in the same commit that introduces it. Each entry carries
  an `_Avoid_` line recording names that were considered and rejected, so a rejected name
  does not quietly come back.
- **Path alias `@/*` maps to the repo root**, declared in both `tsconfig.json` and
  `vite.config.ts`. Imports read `@/standings-core`, `@/src/types`.
- **Server dependencies go in `dependencies`, not `devDependencies`** — the build bundles
  the server with `--packages=external` and the production host installs `npm ci --omit=dev`,
  so anything needed at runtime must survive that. Commit the updated `package-lock.json`.
- **New env vars must work when unset** — the production `.env` is not updated
  automatically on deploy, so every new variable needs a safe in-code default.

## End-to-end tests

`tests/e2e/` runs against a server the config boots itself with
`DISABLE_FOOTBALL_DATA=true`, so the suite always sees the **frozen snapshot**.
This is deliberate and load-bearing: live scores, table positions and the current
round all change mid-match, so asserting against live data makes every run a coin
flip. It also keeps the suite from spending the 10 req/min budget.

Rules that follow from that:

- Never assert a specific round number or scoreline — the snapshot ages, and
  `currentRound` advances with the calendar. Assert shape (`/\d+ª rodada/`), not value.
- `allInnerTexts()` and `locator.all()` query immediately and do **not** auto-wait,
  unlike `expect(locator)`. Wait for the table to populate first, or they sample a
  half-rendered DOM — this produced a real flake.
- **Never assert how much curated data exists.** `broadcasts.ts` grows on every sync,
  so a test counting curated fixtures fails the next time the script runs. Assert the
  *shape* of a rendered line instead. This broke CI once already.
- **Turning text into a control changes its element.** Making a club or player name
  clickable turned a `span` into a `button` (later an `<a>`), which silently broke every
  spec selecting `span:first-child`. Select the cell's element children (`td > *`) rather
  than a tag name.
- `getByText("...")` is case-insensitive substring matching by default. A bare
  `getByText("Ao vivo")` also matches the banner's "…para dados ao vivo". Scope the
  locator and pass `exact: true`.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull request,
in two parallel jobs:

- **check** — `tsc --noEmit`, unit tests, build, then boots `dist/server.cjs` and
  smoke-tests it, plus shellcheck over the deploy scripts. The boot step is the
  one that catches a runtime dependency stranded in `devDependencies`.
- **e2e** — Playwright, with the browser cached on the exact `@playwright/test`
  version. A version bump needs a matching browser build, so the cache key must
  include it or the run fails with "Executable doesn't exist".

A third job, **screenshots**, checks that `docs/screenshots` still depicts the app. It is
advisory — never in `deploy`'s `needs`, for the reason the workflow gives — and it asks two
questions rather than one. First, are the appearance sources at the commit the images
*depict* identical to HEAD's? That is a content comparison, and it replaced an ancestry
test that went red for merges which changed nothing on main. Second, for whatever genuinely
differs, is every commit accounted for?

**Which commit the images depict is not the commit that stored them.** The anchor is the
sha inside `docs/screenshots/CAPTURED`, falling back to `git log -1 -- docs/screenshots`
only when that cannot be read. The two differ exactly when a capture is taken, main moves
underneath it, and the images are committed after: the image commit's *tree* then carries
an appearance change the photographs do not show, and the weaker anchor calls that current.
CAPTURED is trusted the way the trailer below is — a person's assertion standing in a diff,
not something the check can verify.

**An appearance path can move without a pixel moving.** A rule that is never in effect
during a paint, a selector nothing matches, a comment: the edit is real and the render is
identical. `docs/screenshots/CAPTURED` records which commit the images depict, so a refresh
always leaves something to commit even when all sixteen PNGs come back byte-identical —
that is the mechanical answer and it is the right one wherever it applies. But it still
charges sixteen captures from a live-data production build to certify that nothing changed,
and records no reason. Where an edit *provably* cannot reach a paint, say so instead:

```
Screenshots-unaffected: <why no rendered pixel can change>
Screenshots-unaffected: <sha>: <why>   # for a commit already on main
```

The reason is required, and is printed on every run, green or red — a claim nobody reads is
the thing this replaced. Nothing verifies it. **"It looks the same to me" is a refresh, not
a trailer**; reach for it only when the edit cannot reach a paint at all.

**A capture waits for the page to stop moving, and that is not a nicety.**
Playwright's `click` moves the pointer to the element and leaves it there, so the
Jogadores shot — the one capture that clicks anything — sat on the club summary
with `STATE_LAYER`'s 8% veil fading in over 200ms, and photographed an arbitrary
point in that fade. Measured at alpha 0.008 against a settled 0.08. Two
consequences, and the second is the one that matters: the image was **not
reproducible** (three captures of one build against one payload all differed
across the summary row, so every re-shoot committed that band as noise), and it
documented the page **as it looks with a cursor resting on it**, which is not
what a reader sees. `settle` now parks the pointer at `(0, 0)` — the bare sticky
header, which carries no state layer — and awaits every running transition.

**It awaits `CSSTransition` only, never everything `getAnimations()` returns.**
`animate-pulse` on the Ao vivo live indicator is a `CSSAnimation` with infinite
iterations whose `finished` promise never resolves; awaiting it hangs the capture
for the full timeout on exactly the page where a live match is the thing worth
photographing. Verified both ways — awaiting all animations hung, the filtered
form settled in 2ms.

`scripts/screenshot.ts` deliberately does **not** honour the trailer. It refuses a capture
whose build differs from HEAD on any appearance path, which stays a plain file comparison —
its refusal writes to `docs/screenshots/local` and self-clears on the next deploy, so it is
a nuisance where the gate was a deadlock.

**CI needs no secrets.** Both jobs run against the frozen snapshot with no token,
so a red build always means the code broke — never that the upstream had a bad
minute or the free-tier budget ran out. Keep it that way: do not add
`FOOTBALL_DATA_TOKEN` as a repository secret to "test the live path". If the live
mapping needs coverage, add a unit test with a captured payload.

## Not built yet

*(Nothing outstanding — deploys are automated; see below.)*

### TLS

Certbot holds the certificate for `brasileirao.mpbarbosa.com` and rewrote the nginx site in
place to add the 443 listener and the HTTP→HTTPS redirect. `certbot.timer` runs twice daily
and `certbot renew --dry-run` passes, so renewal is unattended.

Because certbot owns that file, **re-running `04_setup_nginx.sh` overwrites its edits** and
drops the site back to plain HTTP. That is recoverable — re-run `05_setup_tls.sh` — but the
site serves HTTP in between, so do not run `04` casually on a host that already has TLS. Port the deploy scripts
from the sibling repo when shipping, including its constraint that the production host is
too small to build on (it pulls a prebuilt payload rather than running `npm run build`).

The live provider path is verified: with a real token the app renders the current Série A
table from football-data.org. Verified against a live payload, v4 reports scores as
`fullTime.home`/`away`.

**No deploy has ever run against a real host.** The preflight, every argument-validation
path, and the rsync semantics (including that the remote `.env` survives) are verified
locally, but no EC2 instance has received this payload — the remote half of `deploy.sh` and
all of `shell_scripts/` are unexercised.

One known data mismatch: upstream club codes are not always the local seed codes — São
Paulo is `PAU` upstream, not `SAO`, and the real 2026 division includes clubs absent from
`src/data/clubs.ts`. This is why `/api/matches` ships the clubs it saw; do not reintroduce
a dependency on the seed codes for name resolution.
