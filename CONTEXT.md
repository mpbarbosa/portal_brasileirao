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
Rendered twice by the same component (`RankSparkline`): as the last column of the
**Classificação**, a 72×20 sparkline per club, and as a section of the **Clube**
page at 480×96, where it sits under the Posição tile it explains. Same geometry
and same domains in both, so the shape a reader recognises in the table is the
shape they find on the club page — only the box grows. The club page names both
ends in text, because at that size a line with no axis is not readable on its own.
The **Partida** page carries both clubs' campanhas, stacked rather than overlaid in
two colours: the app has semantic tokens and no series palette, so a second hue
would need a CVD-safe pair and a legend. Stacked, the two share one scale and their
rounds line up vertically, so "who was above whom in the 12ª rodada" is read by
looking straight down.

The mark is **better on a phone than on a desktop**, which is the opposite of the
instinct. Measured on the deployed match page: the sparklines render 317px wide at
375px viewport and 710px at 1280px, and at the larger size the line is sparse with
a lot of empty box, while at the smaller it is compact and dense. Carrying both
clubs costs 277px on the densest page in the app — it goes from 1.00 to 1.10
screens at 375×812, with no horizontal overflow at either width. So a mobile
conditional would buy back a tenth of a screen by hiding the version of the
component that reads best, and would leave a phone reader with less than a laptop
reader. Read the measurement before reaching for the media query. The y axis is inverted — 1st at the top, so a climbing line
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

**Ao vivo** (the section):
The page that answers "o que está acontecendo agora?" — `LiveView`, at
`/ao-vivo`. Three parts, in the order a reader asks them: **Agora** (matches in
progress, as cards), **A seguir** (the next fixtures, each with a **contagem
regressiva**) and **Últimos resultados** (the most recent scorelines). Grouped by
`liveBoard` in `live-core.ts`, which takes `now` as a parameter like every other
pure module here. It is the only page that refetches on its own, because it is
the only one whose data changes while it is being read.
It deliberately shows **no match minute**: the provider reports a status and a
score, never an elapsed clock, and minutes-since-kickoff stops being the true
minute at half-time. "Bola rolando" is what we can say and mean.
_Avoid_: "Agora" as the section's own name (that is one of its three headings),
"Tempo real" (promises a push feed; this polls), duplicating **Jogos** — that
section answers a different question, the fixtures of a round you name, and Ao
vivo therefore never grows a round picker. Note the name is overloaded on
purpose: this is the *section*, while "Ao vivo" is also the label of the `LIVE`
**Status da partida**. Scope any lookup that must tell them apart.

**Bola rolando**:
That a specific match is being played right now, shown on the Ao vivo cards as a
pulsing dot **and** the words. The dot alone carries nothing to a screen reader
and nothing to a reader who cannot separate its colour from the chip beside it,
so the words are the statement and the dot is decoration.
_Avoid_: a bare red dot with no text, "em andamento" in the card (it is the
prose form, fine in a description, but flat where the page wants the commentator's
voice), and any minute or stoppage figure beside it — see **Ao vivo**.

**Contagem regressiva**:
The time left until a fixture kicks off, written by `countdownLabel` as "Começa
em 45 minutos" / "1h30" / "2 dias". Minute granularity, recomputed on a 30-second
tick. Once the instant passes it stops rather than going negative and reads
"Deve começar a qualquer momento", because a fixture whose kickoff has passed
while upstream still calls it `SCHEDULED` may be late *or* already underway and
not yet reported — and we cannot tell which. Such a fixture keeps its place under
**A seguir** for three hours (`LATE_GRACE_MS`) rather than vanishing during
exactly the window the page exists for.
_Avoid_: counting up after kickoff (that would be a match clock, which we do not
have), a seconds display (sixty renders for a number nobody reads that closely),
dropping a fixture the instant its kickoff passes.

**Clube**:
A Série A club. Modelled as `Club`, whose `code` is the **upstream numeric id as a
string** — never the three-letter abbreviation, because abbreviations are not
unique: Corinthians and Coritiba both report `tla: "COR"`, and keying on that
merges two clubs into one row.
_Avoid_: "team"/"time" for the entity (`Club` is the domain word here; "team" is
what the upstream API calls it, which is why the adapter type is `RawTeam`),
"sigla" as an identifier (see **tla**).

**Site oficial**:
The club's own website, linked from its page and shown as a globe glyph followed
by the bare host (`palmeiras.com.br`). The globe distinguishes the club's *own*
site from a profile it keeps somewhere else — it pairs with the Instagram mark
beside the handle, and both are drawn inline in `ClubView` under the same rules:
monochrome outline, `currentColor`, `inline-block` so the link's underline stops
at the icon, and `aria-hidden` because the host beside it already names the link.
Comes from the provider's teams endpoint, normalised by
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
oficial** and shown as Instagram's glyph followed by the bare handle
(`@palmeiras`). The glyph is drawn inline in `ClubLinks` rather than fetched —
the same rule the **Marca da emissora** follows, no runtime dependency on a
third party for an asset — and it is the monochrome outline rather than Meta's
gradient mark, so it takes the link's colour through `currentColor` and needs
no **Placa da emissora** to sit on in either theme. It is `aria-hidden`: the
handle beside it already names the link. No provider carries
social accounts at any tier, so `src/data/club-instagram.ts` is hand-curated and
keyed by club code. Stored as the handle alone; `instagramUrl` derives the
address, so a pasted URL loses Instagram's `?hl=pt-br` locale hint rather than
persisting it. Every handle was confirmed against the live profile, because
Wikidata lists Palmeiras as `sepalmeiras` — not the club's account — and a club
site advertises its sponsors' handles beside its own.
_Avoid_: keying on **tla** (Corinthians and Coritiba share `COR`, so one club's
readers land on another's profile), storing the full URL, showing the URL rather
than the handle, trusting a single source for a handle, giving the glyph a fixed
colour (it would then need a plate in one theme, which is a lot of chrome for one
mark beside a word), letting the link's underline run under it — an atomic inline
box is not decorated, which is why the glyph is `inline-block`.

**Instagram do jogador**:
A player's own Instagram profile, shown on the **Card do jogador** under the
club's name and rendered by the same `InstagramLink` as the **Instagram do
clube** — the glyph left `ClubView` for `ClubLinks` when this became its second
caller, which is the rule that moves a mark rather than copying it. Curated in
`src/data/player-instagram.ts` and keyed by **player id**, never by name: the
division fields two Dudus at one club, several Gabriels and more than one Pedro.
Coverage is partial and always will be — most of the ~950 listed players have no
account any source records — and a player without one shows no link rather than
a dash, because an absent profile is not a missing value. The handle is read
from the bundled table rather than from `/api/players/:id`, so it does not
disappear when the enrichment fails.
_Avoid_: keying on the player's name, waiting on the enrichment request before
showing it, rendering a placeholder for a player with no account, saying
"Instagram" alone where both a club's and a player's appear (the screen-reader
suffix says whose), and — above all — writing down a handle nobody has opened:
Wikidata was wrong or stale for nearly one in five of the candidates, including
one account that had been deactivated.

**Verbete do jogador**:
A player's article on the Portuguese Wikipedia, shown on the **Card do jogador**
beside the **Instagram do jogador** and rendered by the same `WikipediaLink` as
the club's — the component took a `title` and a `subject` when the card became
its third caller, so the screen-reader suffix says whose verbete it is rather
than defaulting to the club's. Reads as "Wikipédia", not as the title: the title
is usually the name printed two lines above, and where it is not, it is a
disambiguation ("Dudu (futebolista, 1992)") that means nothing to a reader.
Curated in `src/data/player-wikipedia.ts`, keyed by player id, storing the title
alone. Unlike the handle beside it this **can be verified**, and is, by
`npm run check-player-wikipedia` — against the article's own stated birth date,
not its title.
_Avoid_: deriving the title from the player's name (half of them are
disambiguated or sit at a fuller legal name), storing the URL, printing the
title as the link text, sharing the club's screen-reader suffix, and trusting a
Wikidata sitelink without reading the article — three of them named a different
player of the same name.

**Foto do jogador**:
A photograph of a player, shown at 64px in the header of the **Card do jogador**,
from Wikimedia Commons and served from this app's own origin. Cropped square with
the crop anchored to the top, because these arrive at whatever shape their
photographer framed and a head-and-shoulders portrait keeps the face high.
Carries a **credit line** at the foot of the card naming the photographer and the
licence, both as links — that is a condition of showing the picture, not chrome.
The alt says what the picture *shows* — which shirt, which year — rather than the
player's name, which the heading beside it already gives: a free photograph of a
footballer is usually years old and taken at a previous club, and a reader who
cannot see it is owed that.
_Avoid_: taking a picture from the player's Instagram (their copyright; a public
profile licenses nothing), hotlinking Commons (it rate-limits, and several cards
in a row is normal reading), writing the alt from the file name, dropping the
credit in a redesign, and assuming the photograph shows the player's current club.

**Hino do clube**:
The club's hymn, linked from its page as a third external link beside the **Site
oficial** and the **Instagram do clube**, under the same rules: a monochrome
outline drawn inline in `ClubView`, `currentColor`, `inline-block`,
`aria-hidden`. The mark is a pair of quavers rather than YouTube's play button —
the song is what the link is for, and the platform is where it happens to live.
Unlike its two neighbours the link reads as a *name* rather than an address:
"Hino do clube", because a video id is nothing a reader recognises, and the
screen-reader suffix names the host. No provider carries a hymn at any tier, so
`src/data/club-hymns.ts` is hand-curated and keyed by club code. Stored as the
**video id alone**; `hymnUrl` derives the watch address, so a link copied while
the video played inside a mix loses its `&list=RD…&start_radio=1` rather than
dropping the reader into autoplaying radio. Every id was confirmed through
YouTube's oEmbed endpoint, which reports the title and the uploading channel: a
search for the Santos hymn returns the hymn of the *city* of Santos alongside
the club's, and nothing in the URL tells them apart. Source preference follows
**Melhores momentos** — the rights-holder first, which for hymns is Gravadora
Cid and its `Orquestra e Coro Cid - Topic` channel.
_Avoid_: keying on **tla**, storing the full URL, showing the URL or the video
title as the link text, taking a search result on trust without reading the
channel, YouTube's own mark (that names the host, not the hymn), an embedded
player on the club page (a hymn that can start playing is a hymn nobody asked
for).

**Wikipédia**:
The club's encyclopedia article, linked from its page as a fourth external link
beside the **Site oficial**, the **Instagram do clube** and the **Hino do
clube**, under the same rules: a monochrome outline drawn inline in `ClubView`,
`currentColor`, `inline-block`, `aria-hidden`. The mark is an open book rather
than Wikipedia's puzzle globe — the article is what the link is for, and a globe
would read as a second official site beside the one already in the row. Like the
hymn the link reads as a *name* rather than an address, but the name is the
host: "Wikipédia" is what a reader recognises, where the club's full legal name
is not. Always the **pt** edition, and a link naming another one is dropped
rather than rewritten: the pt title is rarely the en one, so rewriting would
produce a plausible address that 404s. No provider carries an article at any
tier, so `src/data/club-wikipedia.ts` is hand-curated and keyed by club code.
Stored as the **title alone** with spaces; `wikipediaUrl` converts to
underscores and percent-encodes, so `?action=edit` and `#História` do not
persist. Every title was confirmed through the MediaWiki API, which reports
whether a page exists, whether it redirects and what its first sentence says.
It appears a second time on the **partida** page, under each club's name on the
scoreboard, and it is the only *external* link there. It sits a type step below
the name on purpose: the scoreboard's job is the score, and a second link at the
same weight would read as two equal destinations. The club's other three links
stay on the club page, one tap away through the name above — repeating all four
per side would put eight external links around a scoreline. Both call sites
render `WikipediaLink` from `src/components/ClubLinks.tsx` rather than their own
anchor, so `target`, `rel` and the screen-reader suffix have one definition.
_Avoid_: keying on **tla**, deriving the title from `name` or `shortName` (the
article is at the full legal name and no rule maps between the three), storing
the full URL, showing the title or the address as the link text, stripping
accents the way a **slug** does (`Gremio…` is not an article), Wikipedia's own
mark, an English-edition link, a second hand-written copy of the anchor, and
carrying the site/Instagram/hino links onto the scoreboard beside it.

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

**Página do estádio**:
The detail page for one ground, at `/estadio/<slug>`, reached from a **Página da
partida**'s **Estádio** line — the only door there is, and never from the
navigation bar. Shows the name, city and state, the official name where it
differs, a **foto do estádio** where one is curated, capacity, year of
inauguration, the clubs that host there, and every fixture of the season played
there.
A stadium is **not an entity in any payload**: `buildStadiums` in `venue-core.ts`
derives the roster by grouping fixtures on the slug of their venue string, which
is the only thing tying a fixture to a ground. The slug is therefore the
identity, and it is what absorbs CBF's casing drift — `ARENA MRV` and `Arena MRV`
are one stadium, not two.
_Avoid_: a nav-bar entry for it (MD3's bar is full at five, and a ground is
somewhere you arrive at from a fixture rather than a section you set out to
browse), keying stadiums on the raw venue string, treating the absence of a
curated fact as a zero, and describing a club page as a way in — the
**Mandantes** tiles point *from* this page *to* the clubs, and reading that
relationship backwards is how three files came to promise a link the club page
has never had.

**Foto do estádio**:
The photograph at the top of a **Página do estádio**, under the name and above
the capacity tiles. Comes from Wikimedia Commons, named in `src/data/stadiums.ts`
by its **file title alone** and fetched through `Special:FilePath` so the address
survives a rename.
It always ships with its **crédito da foto** — photographer, licence and a link
back to Commons — because every licence in use but CC0 requires the photographer
to be named wherever the picture appears. That caption is a condition of showing
the image, not a caption in the editorial sense.
**The files are served from our own origin**, vendored into `public/stadiums/`
by `npm run sync-stadium-photos`, exactly as the broadcaster marks are. They
shipped hotlinked from Commons and were vendored afterwards: Commons answers a
browser's third or fourth request with 429 because it is an archive rather than
a CDN, and a single image per page had not tripped that only because the page
happens to show one. That is a property of today's layout rather than of the
code — a gallery, a second photograph, or an index of grounds each showing one
would all restore the shape that produced the 429, and none would look like a
performance decision to whoever wrote them.

Unlike the marks, these are **not public domain**, and the sync's licence rule
is looser to match: `redistributable` in `commons-core.ts` admits CC0, CC BY and
CC BY-SA, because the app renders the credit as a condition of display and so
can meet the obligation. It refuses any licence it cannot *name* rather than
anything on a blocklist — an unrecognised licence is one nobody has checked. The
credit is re-read from Commons on every sync and must still match, because
hosting our own copy makes this app the publisher of it.

The Commons file title stays in the data as the **source**, and the credit line
still links to the file page: vendoring the bytes does not vendor the
attribution.

_Avoid_: calling it "imagem" or "capa" (it is a photograph of a real ground, and
"capa" would suggest the link-preview card, which is `og-default.png`), showing
one without its credit, tidying a credit string into house style — the wording
Commons publishes is the wording with legal force, hotlinking Commons instead
of syncing (that is what `sync-stadium-photos` is for), adding a photograph to
`stadiums.ts` without re-running the sync — the page would ask for a file that
does not exist.

**Nome oficial**:
The formal name of a ground, shown under its popular one only where the two
differ — the Maracanã is *Estádio Jornalista Mário Filho*, and almost nobody says
so. Held in `src/data/stadiums.ts` alongside capacity and year of inauguration,
all hand-curated from the Portuguese Wikipedia because no provider in the
pipeline carries any of them.
_Avoid_: printing it when it merely restates the popular name ("Arena MRV /
Arena MRV"), calling it "apelido" — the nickname is the *popular* name here, and
naming both the same thing is how one row ends up rendering twice.

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

**Elenco**:
The set of players a club fields, as the provider lists it — `Squad` in
`src/types.ts`, one per club. The word for the collection; **Jogadores** is the
page that shows all twenty of them. An elenco may be **empty**: a club upstream
has not filled in is still a club in the championship, and the panel says
"elenco não informado" rather than vanishing.
_Avoid_: "time" or "plantel" for the collection (see **Clube**), dropping a club
whose squad is missing, and the word "escalação" — that is the eleven picked for
one match, which the app does not carry.

**Jogadores**:
The page listing every club's **Elenco**, one collapsible panel per club, each
squad split into its **Linha**. Backed by `/api/squads`, which is the only page
in the app with an endpoint of its own rather than a slice of the fixture
payload — a squad is not derivable from anything already loaded. One upstream
request carries all twenty, so it costs what a single club would.
Panels are closed by default: a thousand players rendered flat puts the second
club twenty screens below the first, which destroys the by-club structure the
page exists for. They are native `<details>`, so two clubs can be open at once
and compared.
_Avoid_: "elencos" as the section label ("Jogadores" is what a reader scans the
bar for), a club picker that shows one squad at a time (it makes comparing two
mean losing the first), asserting a squad size anywhere in the tests — it moves
with every transfer window.

**Linha**:
The part of the field a player belongs to, and the heading a squad is split
under: **Goleiros**, **Defensores**, **Meio-campistas**, **Atacantes**, and
**Outros** for anyone the provider places nowhere. It exists because upstream
mixes two levels of detail in the same list — mostly a broad line ("Defence"),
occasionally a specific role ("Left-Back") — so `lineOf` folds the roles back
onto the line they belong to and a lateral does not become its own section.
A player's own **Posição** is printed under the name only when it says something
the heading did not: a "Defesa" caption under a Defensores heading is the
heading again, once per row.
_Avoid_: a section per specific role, guessing a line for a position the map
does not cover (it goes to Outros and keeps its verbatim caption), separate
headings for "no position" and "unrecognised position" — a reader cannot tell
those apart, and both mean the provider did not say.

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
it), hotlinking Commons — stadium photographs are vendored the same way, see
**Foto do estádio**; letting a control's accessible name rest on an image's
`alt` (they load lazily — carry the name in text and mark the image decorative),
asserting a mark's `src` instead of whether it painted, showing a mark with no
plate, treating a missing mark as an error.

**Barra de navegação**:
The app's sections, wherever they are shown. Entries come from `NAV_ITEMS`
(`src/navigation.ts`), the single source of truth for what sections exist —
adding one means an entry there plus a case in `App`'s view switch; `NavBar`
itself needs no change, which is why the entry carries its own icon rather than
`NavBar` looking one up.

Two presentations of the one model. Above Tailwind's `sm` breakpoint the entries
sit inline in the sticky header. Below it they are a Material Design 3
navigation bar fixed to the bottom edge, each an icon above its label, the
current one marked by a pill behind the *icon*. Both render from the same list,
so every section is reachable at any width and neither can drift.

**Three to five destinations.** That is MD3's bound for this pattern and there
are three, so two more sections fit. A sixth does not fail — it crowds, silently
— and wants a different pattern rather than a sixth entry. This bound replaced a
toggle that hid the entries behind a hamburger, which is the arrangement the
pattern exists to correct.
_Avoid_: "menu" (nothing opens or closes any more), "hambúrguer" (gone as of the
MD3 migration), "abas"/"tabs" for the mobile form (a bar is not a tab strip),
`title` tooltips on the entries — they never appear on touch and compete with
the visible label for the accessible name.

**Módulo core**:
A root-level `*-core.ts` module holding pure logic with **no I/O** — data in, data
out. `server.ts` performs every fetch and passes payloads in, which is what makes
the logic testable without mocking HTTP. Current modules: `standings-core`,
`matches-core`, `football-data-core`, `cache-core`.
_Avoid_: "service", "helper", "util" (all three invite I/O to creep in, which is
the one thing these modules must not do).

**Semente**:
The single colour every other colour in the app is derived from: `#10b981`, the
emerald the app already used as its accent. Recorded in
`scripts/generate-md3-tokens.ts` as `SEED`. Chosen so the Material Design 3
migration re-derives the palette the reader already knows rather than rebranding
underneath them. Changing it changes every colour in both themes, so it is a
brand decision rather than a styling one.
_Avoid_: "cor primária" (the **Papel de cor** `primary` is one output of the
seed, not the seed itself — conflating them suggests changing `primary` alone
would work), "tema" (that is the light/dark choice, which the seed is orthogonal
to).

**Paleta tonal**:
Thirteen-odd shades sharing one hue and chroma, distinguished only by **Tom**.
Generated by `tonalPalette` in `scripts/md3-color-core.ts`. The app carries six:
primary, secondary, tertiary, neutral, neutral-variant and error, plus an
extended one for `warning`, which Material Design 3 has no role for. The neutral
palettes deliberately do *not* follow the **Semente** — they keep the app's slate
hue, because a neutral derived from the emerald would tint every surface green.
_Avoid_: "escala" (reads as the type or spacing scale), "gradiente" (these are
discrete steps, never interpolated at runtime).

**Tom**:
A colour's lightness on Material Design 3's 0–100 scale, where 0 is black and
100 is white. It is CIE L\*, not an arbitrary index, which is the point: two tones
a fixed distance apart have a known contrast ratio, so "tom 40 sobre tom 90"
clears AA by construction rather than by inspection. This is what lets
`scripts/generate-md3-tokens.ts` gate the palette instead of a human eyeballing it.
_Avoid_: "brilho"/"luminosidade" (both read as the sRGB value, which is a
different and non-linear quantity), "peso" (that is typography).

**Papel de cor**:
What a colour is *for*, in Material Design 3's vocabulary: `primary`,
`on-primary`, `surface`, `on-surface-variant`, `outline`, `error` and the rest.
Each is a **Tom** drawn from a **Paleta tonal**. Every `on-` role is guaranteed
readable against the role it names. The app's own token names (`ink`, `line`,
`canvas`) are aliases onto these while the migration runs — see `docs/roadmap.md`,
phase M1. Note `surface`: Material spells the page `surface`, but here that is
still `canvas` and `surface` means a card, until M2 renames the call sites.
_Avoid_: "variante" on its own (`on-surface-variant` is a text role, not a
variant of anything), naming a role after its value ("verde", "cinza-claro") —
that is exactly the coupling the tokens exist to break.

**Escala de forma**:
Material Design 3's five corner radii — `rounded-x-small` (4dp) through
`rounded-x-large` (28dp) — defined in `src/index.css` and used in place of
Tailwind's own `rounded-*`. Spelled out in full rather than abbreviated because
the two scales share the names `sm`/`md`/`lg` and disagree about what they mean:
Tailwind's `rounded-lg` is 8px where MD3's large is 16dp. The app currently uses
only the first three, which is why adopting the scale changed nothing visually.
_Avoid_: "border radius" in prose (the token is the unit of meaning, not the CSS
property), "arredondamento" (accurate but nobody says it), reusing Tailwind's
`sm`/`md`/`lg` names for MD3 sizes.

**Camada de estado**:
The veil a control paints over itself when hovered, focused or pressed: MD3's
state layer, at 8% for hover and 10% for focus and pressed, in the container's
`on-` colour. Lives in `src/components/interaction.ts` as `STATE_LAYER`. Exists
so two controls side by side cannot hover to slightly different greys, which is
what a hand-written `hover:` colour per component produces.
_Avoid_: "hover" alone (the layer covers three states, and naming it after one
is how focus and pressed get forgotten), "overlay" (that is the **Cartão do
jogador**'s scrim), "highlight".

**Anel de foco**:
The keyboard focus indicator: a two-pixel `primary` outline, offset so it sits
outside the control rather than on its fill. `FOCUS_RING` in
`src/components/interaction.ts`, kept deliberately separate from **Camada de
estado** — they were one constant at first, and the current **Barra de navegação**
entry, a filled chip that takes no veil, silently lost its ring along with it.
Anything focusable takes the ring; only things with a container take the veil.
_Avoid_: "outline" on its own (it collides with the `outline`/`outline-variant`
colour roles, which are borders and not focus), folding it back into the state
layer.

**Escala tipográfica**:
Material Design 3's type steps — `text-body-small` through
`text-headline-medium`, defined in `src/index.css`. Each carries size, line
height and letter spacing together, so a component names one thing rather than
pairing a size with a leading and trusting the next component to pair them the
same way. Weight is *not* part of it: MD3 prescribes 500 for its title and label
steps, and this app's headings are bold by choice, so components keep an explicit
`font-*`. The typeface is likewise separate — the app ships no webfont and uses
the system stack.
_Avoid_: Tailwind's own `text-sm`/`text-xs` names (they carry no line height or
tracking, which is the whole point of the step), `tracking-*` alongside a step
(it overrides the letter spacing the step defines), "fonte" for the scale (that
is the typeface, which is a different and still-unshipped decision).

**Selo de status**:
The **Status da partida** rendered as a chip — `StatusChip` in
`src/components/StatusChip.tsx`, used by both the fixture list and the match
page. Its colour is information rather than decoration: a live match and a
cancelled one must not look alike, which is why it does not take Material Design
3's single-container-colour convention for chips even though the shape and label
come from there. Both call sites previously carried their own copy of the label
map and the colour map.
_Avoid_: "badge" (the app says selo), duplicating the maps at a call site, using
a bare status colour as text — the base tokens are for fills, the `-ink` pairs
are what clear AA.

**Placa da emissora**:
The light backing a **Marca da emissora** sits on. Deliberately *not* a Material
Design 3 chip, despite behaving like one at a glance: a chip takes its container
colour from the tonal system, and this must stay `#ffffff` in both themes or the
marks that are dark artwork on a transparent ground disappear entirely. It is a
background for foreign artwork, not a container for our own content — that
difference is what decides every other property, including the ring rather than a
border and the 16px/20px content height floor.
_Avoid_: "chip" for this (the word invites the tonal container that breaks it),
deriving `--color-plate` from the palette, a border in place of the ring — a
border adds to the box, a ring does not, and the plate is sized to artwork.

**Movimento**:
Material Design 3's easing curves and durations, in `src/index.css`. The app uses
two of each: `standard` at 200ms for small frequent changes a reader should
barely notice, and `emphasized-decelerate` at 300ms for the **Cartão do jogador**
arriving — the slow finish is what makes it read as placed rather than snapped.
A bare `transition` already means the standard pair, because Tailwind's defaults
are overridden rather than annotated at each call site.
_Avoid_: `duration-*` utilities (Tailwind v4 has no such namespace — they compile
to nothing and leave the default silently in place), emphasized easing on a hover
(it reads as sluggish), adding motion without checking **Movimento reduzido**.

**Movimento reduzido**:
A reader who has asked their system for less motion, via
`prefers-reduced-motion: reduce`. Honoured since M5: movement stops, colour
feedback does not. Durations go near-zero rather than to `none`, so
`transitionend` still fires and anything waiting on it keeps working.
_Avoid_: removing hover and focus feedback along with the movement — a control
that stops reacting is harder to use, not calmer; treating it as optional
polish, since it is the reader stating a need rather than a preference.
