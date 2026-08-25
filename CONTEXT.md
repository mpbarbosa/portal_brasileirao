# Portal Brasileirão

Glossary of domain terms for the Campeonato Brasileiro Série A companion app.

Every term below is used in the code today. Check here before naming a new
concept, so one thing does not end up with two names — and add the term here in
the same commit that introduces it.

## Language

**Classificação**:
The league table for the season: one row per club, ordered by the CBF
tie-breakers. Rendered by `StandingsTable` and served by `/api/standings` as
`StandingsRow[]`. Also the label of the default tab (`TABS`, id `"classificacao"`).
_Avoid_: "tabela" (ambiguous — reads as the HTML `<table>` element as often as the
league table), "ranking" (not the Brazilian football word), "leaderboard".

**Campanha**:
A club's run through the season seen as a path rather than a final row: its
position in the **Classificação** after every round played, modelled as
`ClubRankHistory` and computed by `computeRankHistory` in `rank-history-core.ts`.
Each `RankAtRound` carries `played` alongside the position, because a postponed
fixture is the difference between "caiu quatro posições" and "tem um jogo a
menos". Positions come from re-running `computeStandings` round by round, so the
campanha can never disagree with the table it describes.
Rendered as the last column of the **Classificação**, a 72×20 sparkline per club
(`RankSparkline`). The y axis is inverted — 1st at the top, so a climbing line
means a climbing club — and both axes are shared by every row: the rows are small
multiples, and auto-fitting each club to its own range would draw a side rattling
between 1st and 3rd as dramatically as one climbing from 20th to 5th.
_Avoid_: "histórico" (reads as past seasons, not this one), "ranking" (not the
Brazilian football word, same as under **Classificação**), "evolução" on its own
(it also reads as a club improving, which a falling campanha is not).

**Rodada**:
One matchday of the championship — the set of fixtures sharing a `round` number.
The second tab (`TABS`, id `"rodada"`), whose heading renders as `Nª rodada`.
Upstream football-data calls this `matchday`; it is mapped to `round` at the
adapter boundary and is `rodada` everywhere the reader can see.
_Avoid_: "matchday" in user-facing copy (upstream's word, not the reader's),
"jornada" (Portugal, not Brazil), "week".

**Jogos**:
The fixtures section, replacing the older fixed "Rodada" view. It opens on
**Rodada atual** and lets the reader step through any round of the season with
the arrows or the picker. It needs no extra request: `/api/matches` already ships
the whole fixture list, so switching rounds is a client-side filter.
_Avoid_: a second section that shows only the current round (that is this
section's default), "Partidas" (reserved for the singular **Partida**). Note the
word is overloaded on purpose: the nav entry means "fixtures", while the `Jogos`
stat on a club page means *jogos disputados*, a count. Both are standard; scope
any lookup that must tell them apart.

**Rodada atual**:
The round the app opens the Rodada tab on, computed by `currentRound(matches, now)`.
Precedence: a round with a match in progress, else the round of the next fixture
due, else the last round that produced a result. Deliberately **not** "the earliest
round with an unfinished match" — a postponed fixture can sit unplayed for months,
which once pinned the view to round 4 in August.
_Avoid_: "próxima rodada" (it is often the round being played right now, not the
next one), "última rodada" (that is the fallback branch only).

**Clube**:
A Série A club. Modelled as `Club`, whose `code` is the **upstream numeric id as a
string** — never the three-letter abbreviation, because abbreviations are not
unique: Corinthians and Coritiba both report `tla: "COR"`, and keying on that
merges two clubs into one row.
_Avoid_: "team"/"time" for the entity (`Club` is the domain word here; "team" is
what the upstream API calls it, which is why the adapter type is `RawTeam`),
"sigla" as an identifier (see **tla**).

**Site oficial**:
The club's own website, linked from its page and shown as the bare host
(`palmeiras.com.br`). Comes from the provider's teams endpoint, normalised by
`officialSiteUrl` to an **HTTPS origin**: most clubs are listed as `http://`,
and Flamengo is listed as its basketball landing page, so both the scheme and
the path are corrected. Every one of the twenty terminates TLS — verified by
hand, including those whose bot protection answers a script with 403.
_Avoid_: linking the raw provider value, keeping a path (this link means the
club's home, not a section of it), assuming standings or fixtures carry it —
only the teams endpoint does, so the committed club list supplies it at request
time via `withWebsites`.

**Instagram do clube**:
The club's official Instagram profile, linked from its page beside the **Site
oficial** and shown as the bare handle (`@palmeiras`). No provider carries
social accounts at any tier, so `src/data/club-instagram.ts` is hand-curated and
keyed by club code. Stored as the handle alone; `instagramUrl` derives the
address, so a pasted URL loses Instagram's `?hl=pt-br` locale hint rather than
persisting it. Every handle was confirmed against the live profile, because
Wikidata lists Palmeiras as `sepalmeiras` — not the club's account — and a club
site advertises its sponsors' handles beside its own.
_Avoid_: keying on **tla** (Corinthians and Coritiba share `COR`, so one club's
readers land on another's profile), storing the full URL, showing the URL rather
than the handle, trusting a single source for a handle.

**slug**:
URL-safe form of a club's short name — `Atlético-MG` → `atletico-mg` — used for
readable addresses like `/clube/flamengo`. Accents are stripped rather than
percent-encoded so the address stays typeable. Derived, not upstream, and
absent when a name yields nothing usable, in which case the URL falls back to
`code`. `findClub` accepts either form, so `/clube/1783` still resolves.
_Avoid_: treating it as identity (that is `code`), assuming it is unique without
the generator's duplicate check — `atletico-mg` and `athletico-pr` differ by one
letter and both are real clubs.

**Escudo**:
A club's crest, shown beside its name in the **Classificação** and on its page.
Comes from the data provider's CDN (`crests.football-data.org`) as a transparent
PNG of two to four kilobytes, which is why it sits correctly on the dark
background. Purely decorative — the club's name is always beside it, so the
image is `alt=""` and `aria-hidden`, and announcing it would say the club twice.
_Avoid_: CBF's `conteudo.cbf.com.br/clubes/<id>/escudo.jpg` (ten times larger, a
JPEG so no transparency, and needs CBF club ids the app does not hold), giving
the crest descriptive alt text.

**tla**:
The three-letter abbreviation upstream reports for a club (`FLA`, `PAL`, `CAP`).
Carried on `Club` for compact display only. **Not an identity** — see **Clube**.
_Avoid_: using it as a map key, a React `key`, or a foreign key of any kind.

**Partida**:
A single fixture between two clubs, modelled as `Match`. Carries `round`,
`kickoff` (always an ISO-8601 UTC instant), a `MatchStatus`, the two club codes,
and goals that are `null` until there is a score to report.
_Avoid_: "game"/"jogo" for the entity (`J` in the table means *jogos disputados*,
a count, not a fixture), "event".

**Página da partida**:
The detail page for one fixture, at `/partida/<id>`, reached from the fixture
list. Shows the scoreboard, round, status, kickoff, **Estádio** and — depending
on state — either **Onde assistir** or a link to the goals. Every field beyond
the score is optional, since the provider supplies neither venue nor channels,
so each section renders only when its data exists.
_Avoid_: rendering an empty row for a field the sync has not filled, showing a
goals link before a match has been played.

**Estádio**:
Where a match is played: stadium, city and two-letter state, from
`src/data/venues.ts`. The data provider has **no venue field at any tier**, so
this comes from CBF's Onde Assistir feed, which reports it as
`Stadium - City - UF`. Values are stored verbatim — CBF's casing and accents
drift (`ARENA MRV`, `Sao Paulo` without the tilde) and correcting them would
mean guessing at proper names.
_Avoid_: title-casing or re-accenting CBF's values, expecting football-data to
supply a venue.

**Melhores momentos**:
The highlights section of a **Página da partida**, shown for **any** match that
has finished with a score — a 0-0 included, since it still has chances and saves
and broadcasters publish a package for it either way. When
`src/data/highlights.ts` has entries it lists one link per broadcaster, labelled
by channel; several publish their own package for the same match and the reader
picks. With no entry it falls back to a YouTube *search* for "melhores
momentos", and says so, because no provider we use exposes highlight links and
guessing a video id would eventually point at the wrong match or a reupload.
_Avoid_: "Gols" anywhere in this section (that is the count, as in the artilharia
column) or "gols" in the search query — it has to serve a goalless match;
gating the section on goals scored; labelling several links with the same
generic verb; presenting the search as an official video; offering either for a
fixture that has not finished.

**Status da partida**:
The five values of `MatchStatus`, shown as badges: `SCHEDULED` → "A realizar",
`LIVE` → "Ao vivo", `FINISHED` → "Encerrado", `POSTPONED` → "Adiado",
`CANCELLED` → "Cancelado". Postponed and cancelled are first-class rather than
folded into scheduled: Série A rounds move often enough that collapsing them
would misreport a round as playable.
_Avoid_: treating "adiado" and "cancelado" as the same state — a postponed match
is still coming, a cancelled one is not, which is exactly what `isConcluded`
distinguishes.

**Encerrada** (of a partida):
`isConcluded` — a match that will never be played again: `FINISHED` **or**
`CANCELLED`. Distinct from "not finished", which would also catch a postponement
that is still to come.
_Avoid_: "final", "over" (both read as "the score is final", which is untrue of a
cancelled match).

**Conta para a classificação**:
`countsTowardStandings` — a match enters the table only when it is `FINISHED`
**and** carries both scores. A `LIVE` match with a partial score does not: the
table moves on the final whistle. Note that football-data's own table *does*
count in-play matches, so while matches are in progress the live table and the
computed fallback table legitimately differ. This is deliberate; see CLAUDE.md.
_Avoid_: "played" as the predicate (a live match is being played and still must
not count).

**G4 / Z4**:
The Libertadores places (positions 1–4) and the relegation zone (the last four
positions), marked with a coloured rail in `StandingsTable` via `zoneClass`. Z4 is
computed from the row count rather than hard-coded to 17–20, so the table stays
correct if the division ever changes size.
_Avoid_: hard-coding `position > 16`; "top four"/"bottom four" in pt-BR copy.

**P, J, V, E, D, SG**:
The `Classificação` column headers: pontos, jogos, vitórias, empates, derrotas,
saldo de gols. Points are always `vitórias × 3 + empates` — an e2e test asserts
this for every row, so a scoring change must update `POINTS_FOR_WIN` in
`standings-core.ts` rather than the table.
_Avoid_: "PTS"/"GP"/"GD" (English abbreviations), reordering the columns — this is
the order every Brazilian table uses.

**Fonte dos dados**:
The `source` field of `ApiEnvelope`, and the reason the app can be honest about
what it is showing. Exactly three values: `football-data` (live upstream),
`placeholder` (seed data, because no token is configured) and `fallback` (seed
data, because the upstream failed or was disabled). The last two look identical
to a reader but only `fallback` is worth alerting on.
_Avoid_: collapsing `placeholder` and `fallback` into one value, adding a fourth
value without a matching pt-BR note, and letting any non-live source render
without its banner.

**Dados congelados**:
The frozen snapshot in `src/data/clubs.ts` and `src/data/matches.ts` — real
historical fixtures captured on `SNAPSHOT_DATE`, served whenever the app is not
live. Both files are **generated**; regenerate with `npx tsx scripts/sync-seed-data.ts`.
Because it is frozen, it never claims a match is in progress: the generator
rewrites in-play matches as not-yet-played rather than inventing a final score.
_Avoid_: "dados de demonstração" and "mock data" (these are real results, not
invented ones — the old copy said "demonstração" and was wrong), hand-editing
either file.

**Artilharia**:
The top-scorer table: `Scorer[]` from `/api/scorers`, ordered by the provider
rather than recomputed, since it knows how it breaks ties. Columns are G (gols),
A (assistências), P (pênaltis) and J (jogos). `assists`, `penalties` and
`playedMatches` are **nullable** — the upstream omits penalties for most players
— and null renders as an em dash, never as `0`: "not reported" and "scored none"
are different claims and only one is supported by the data.
_Avoid_: "goleadores" as the section label ("Artilharia" is the term a Brazilian
reader expects), coercing a null count to zero anywhere between the mapper and
the cell.

**Clube** (a página do clube):
The per-club drill-down, reached by choosing a club in the **Classificação** —
never from the menu, because without a selection it has nothing to show. Composes
data the client already holds: standing, form, next fixture, the club's scorers
and its played matches. Needs no request of its own; the slicing rules live in
`club-core.ts` so they are testable outside a component.
_Avoid_: adding it to `NAV_ITEMS`, fetching per-club data (everything it needs is
already on the page), "time" for the entity — see **Clube** above. Its address is
`/clube/<slug>`, so it is shareable and Back returns to the table.

**Forma**:
The last five *finished* results from one club's point of view, oldest first:
`V` vitória, `E` empate, `D` derrota. Only finished matches count, so a postponed
fixture mid-run does not punch a hole in the guide, and a live match never
appears — consistent with **Conta para a classificação**.
_Avoid_: "W/D/L" (English initials), counting a live scoreline as a result.

**Rota**:
The URL is the source of truth for which section is showing: `/` classificação,
`/jogos` (current round) or `/jogos/N`, `/artilharia`, `/clube/<slug>`. Parsing
and formatting live in `route-core.ts` as total functions — an unrecognised path
or a nonsense round degrades to something useful rather than erroring, because a
stale link should still land somewhere. `useRoute` only binds them to the History
API.
_Avoid_: keeping section state in `App` alongside the URL (they drift), a route
that 404s, adding a router dependency for four routes.

**Carregando página**:
What a page that names something — a **Clube**, a **Partida** — shows while the
first load is still in flight. It matters because an empty payload and a
genuinely unknown key look identical to the component: both are a list with
nothing in it. Before this, `/clube/flamengo` answered "Clube não encontrado."
for the moment before its data landed, which is not a slower truth but a
different, false one. `App` passes an explicit `loading` flag rather than letting
each page infer it, and clears it in a `finally` so a failed request does not
leave the page loading forever.
_Avoid_: inferring the state from an empty array, showing "não encontrado" before
the request settles, leaving the line up after a failure, spinners (the wait is
one request and a line of text says more).

**Cartão do jogador**:
The overlay opened by choosing a player in **Artilharia**. It renders
immediately from the row it was opened from (name, club, season figures), then
fills in shirt number, position, nationality and age from `/api/players/:id`.
That request is an *enrichment*, not a dependency — when it fails or the app is
offline the card omits those fields rather than showing blanks. Deliberately not
a route: an overlay should not survive a reload.
_Avoid_: blocking the card on the fetch, rendering an empty label for a detail
the provider did not supply, giving it a URL.

**Posição**:
A player's position. The upstream reports it in English, at two levels of detail
— broad lines (`Offence`) and specific roles (`Centre-Back`) — so `positionLabel`
maps both to pt-BR. An unmapped value is shown **verbatim** rather than replaced
by a guess or a dash: a reader seeing the English word is better served than one
seeing nothing.
_Avoid_: inventing a translation for a value the map does not cover, collapsing
specific roles into their broad line.

**Onde assistir**:
The channels showing a match, rendered under its kickoff in the fixture list.
Comes from `src/data/broadcasts.ts` — the one hand-maintained file in
`src/data/`, everything else there being generated — keyed by **our match id**.
Absent means unknown, which is the common case, and renders nothing rather than
an empty line.
_Avoid_: keying on a team abbreviation (CBF's own codes collide across divisions:
one day's page showed `ATH` as both Athletic Club and Athletico-PR), editing the
generated `matches.ts` to add channels, calling any CBF endpoint at request time
— see `docs/data-sources.md`.

**Marca da emissora**:
A broadcaster shown as its own logo rather than its name, under **Onde assistir**
and on the **Melhores momentos** buttons. The files come from Wikimedia Commons —
a deliberate choice over a broadcaster's own site, since everything Commons hosts
is freely licensed or public domain, and each of these is public domain because a
plain wordmark is not original enough to copyright.
They are downloaded once by `npm run sync-marks` into `public/marks/` and served
from our own origin. Hotlinking Commons was the first attempt and it fails in
production: Commons answers a browser's third or fourth request with 429, so a
reader sees some marks and empty plates where the rest should be. It is an
archive, not a CDN. The sync script re-reads each licence and refuses anything
that is not public domain, so what is served cannot drift from what `CREDITS.md`
claims.
Every mark sits on a **plate** — light in both themes, since Globo's circle, the
YouTube wordmark and CazéTV are dark artwork on a transparent ground and vanish
against a dark page. A broadcaster with no mark is rendered as its own name on
the same plate: that is the ordinary case, not a defect, since CBF's feed already
names ESPN/Disney+, Band and a dozen others we curate nothing for.
_Avoid_: copying logo artwork from a broadcaster's site (no licence comes with
it), hotlinking Commons, letting a control's accessible name rest on an image's
`alt` (they load lazily — carry the name in text and mark the image decorative),
asserting a mark's `src` instead of whether it painted, showing a mark with no
plate, treating a missing mark as an error.

**Menu de seções**:
The navigation in the sticky header. Its entries come from `NAV_ITEMS`
(`src/navigation.ts`), which is the single source of truth for what sections exist
— adding one means an entry there plus a case in `App`'s view switch; `NavBar`
itself needs no change. Below Tailwind's `sm` breakpoint the entries collapse
behind a toggle labelled "Abrir menu" / "Fechar menu"; the same entries render
either way, so every section stays reachable at any width.
_Avoid_: "abas"/"tabs" (these are sections of one page, and the collapsed form is
a menu rather than a tab strip), "hambúrguer" in user-facing copy, `title`
tooltips on the entries (they never appear on touch and they compete with the
visible label for the accessible name).

**Módulo core**:
A root-level `*-core.ts` module holding pure logic with **no I/O** — data in, data
out. `server.ts` performs every fetch and passes payloads in, which is what makes
the logic testable without mocking HTTP. Current modules: `standings-core`,
`matches-core`, `football-data-core`, `cache-core`.
_Avoid_: "service", "helper", "util" (all three invite I/O to creep in, which is
the one thing these modules must not do).
