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

The reader chooses which mark it is drawn as — **Linha** or **Barras** — from a
button labelled with the mark it switches to ("Ver a campanha em barras"): above the
table in the **Classificação**, and beside the Campanha heading on the **Painel do
clube** and the **Partida** page. It is **one choice for all three**, not one per
page, so a reader who picks barras in the table finds barras when they open a
painel. The **Clube** page draws no campanha at all: the mark sits on the Painel
above the candles, because a line and the candles that read the same rounds one
grain finer are one answer, and they were on two pages. The choice is
`campaign-plot-core.ts`'s `CampaignPlotKind`, held in `localStorage` beside the theme
and never on the account: it is a property of the screen being read rather than of
the person reading, so no side but the device can hold a value and there is nothing
to reconcile.
Both marks are the same component (`RankSparkline`) on the same shared domains, but
they do not share an axis convention, and that is not a bug to fix. A **linha** joins
the position taken *at* the end of each round, so round 1 is on the left edge and the
last round on the right. A **barra** covers the whole round as a band, and its
meaning is its *length*, so it needs a zero — which here is the foot of the division:
a club is drawn tall when it is high, last place is a sliver rather than an empty
column, and only that makes a bar readable without an axis.
The **Partida** page carries one control for the section rather than one per club:
the two campanhas there are read against each other, and drawing one as a linha and
the other as barras would compare two pictures rather than two clubs.
_Avoid_: "gráfico" for the mark itself (it is a sparkline inside a table row, and the
word promises axes and a legend that are deliberately absent), "colunas" for the bars
kind (the table already has columns and one of them is this one), "tipo de gráfico" in
the control's copy (the button names the mark, not a setting).

**Escalação** (pl. **escalações**):
The eleven a club put on the pitch for **one match**, and the bench beside them.
A section of the **Partida** page, closed by default. Deliberately not the same
word as **Elenco**, which is the whole squad under contract and is what the
**Jogadores** page shows: the two answer different questions, and only the first
is a fact about a fixture.
Within it, **Titulares** are the eleven who started, **Reservas** the bench, and
**Substituições** the changes, each read as "*entrou* X **por** Y" — the minute,
then who came on, then whom they replaced. A change made at half time is
**Intervalo** rather than a minute, because the súmula prints no time for one.
_Avoid_ an arrow between the two names: it needs a glyph kept monochrome and
correctly sized on every platform (the trap `SunIcon`/`MoonIcon` record), and a
single arrow does not say which way it points.
The goalkeeper is marked `(GOL)` because it is the one position CBF reports; no
other is labelled, since naming them would mean guessing.
_Avoid_: "elenco" for a match sheet (that is the season squad), "formação" and
"esquema" (those name the shape — 4-3-3 — which this app does not carry),
"lineup" and "starting XI" in user-facing copy, "titular" for a squad regular
in general rather than for this match's starter.

**Painel**:
The page that reads one club's **Campanha** rodada a rodada, at
`/painel/<clube>` and reached from a row on the **Clube** page and from the
sitemap — never from the nav bar, which is full at MD3's five destinations.
Modelled as `ClubCandles` and computed by `computeRankCandles` in
`rank-candles-core.ts`, drawn by `RankCandles`.
**It carries the whole campanha, not only the velas**: the sparkline sits
directly above them, and the **Clube** page draws no campanha at all. The two
are one answer at two grains, and while they sat on two pages a reader
comparing them was navigating rather than looking.
It answers what the sparkline cannot. A **Campanha** joins the position a club
held at the *end* of each round, so a round is one point and its inside is
invisible: a club that sat 4º on Saturday night and finished 9º because three
rivals played on Sunday draws the same segment as one that walked calmly down.
A **vela** keeps the two apart.
Beneath the velas it carries the **Perfil**, which is the one thing on the page
not derived from the campanha.
_Avoid_: "dashboard" (English, and it promises a grid of panels this page is
not), "gráfico do clube" (it is one chart among tiles, and the page is named for
what it is *for*), "estatísticas" (too broad to name anything — the
**Classificação** is statistics too, and so is a scoreline; say **Perfil** or
**Campanha** and mean one of them). That last line used to say the page held no
statistic the app did not already print, which was true until the **Perfil**
landed and is recorded here rather than quietly deleted: the word is still
avoided, for a different reason.

**Vela** (and **corpo**, **pavio**):
One rodada in the **Painel**, drawn as a candle. The **corpo** runs from the
position the round opened at to the one it closed at; the **pavio** is the thin
line through it, spanning every position the club held while the round was being
played. A stub on the left marks which end is the opening — direction cannot be
carried by colour here, because colour carries the club's **result**: verde for
vitória, cinza for empate, vermelho for derrota, and a hollow mark for a round
the club did not play.
Those two facts are separate on purpose, and the rounds worth looking at are
exactly the ones where they disagree: winning and still dropping a place is an
ordinary Sunday. `open`, `close`, `best` and `worst` are the field names on
`RoundCandle`; `best` is the numerically *smallest* position, since 1º is the
top of the chart.
_Avoid_: "candlestick"/"high"/"low" in code or copy (a high drawn at the bottom
of the picture is a trap for whoever reads the numbers next; the y axis here is
inverted and the names say so), "sombra" for the pavio (it reads as a drop
shadow), "abertura/fechamento" in user-facing copy (market words for a football
page — the legend says "onde a rodada começou" instead).

**Perfil**:
The section at the foot of the **Painel** saying what kind of side a club is:
six rates — finalizações, conversão, desarmes, faltas cometidas, cartões and
defesas do goleiro — each read against the twenty clubs rather than on its own.
Modelled as `ClubScouts`, computed by `clubProfile` in `scouts-core.ts` and
drawn by `ClubProfile`.
It answers what neither the **Classificação** nor the **Campanha** can. Those
report where a club has got to; this reports how it plays, and the two come
apart in the way that is worth looking at — a side 4º em finalizações and 20º em
conversão has an identity the table can only show the consequence of.
**A rate alone says nothing**, which is why every row carries its place: 13
desarmes por jogo is either the most or the least in the division and the number
cannot tell you which. The bar runs from the division's lowest to its highest
and the traço marks the mediana, so the mark is a *position* rather than a
length — and therefore owes no zero, unlike the **barras** of a campanha.
Beneath the strip it carries the **ataque × defesa**: the twenty clubs plotted
on finalizações against defesas do goleiro, this one filled in. It says what a
row cannot, because the fact worth seeing is a *pair* — a club finalizando muito
whose goleiro also works hard is playing an open game, and one doing the first
without the second is controlling matches. Those two are identical on every row
of the strip and sit in opposite corners here. The two dashed lines are the
division's **medianas**, and they are what make the corners readable; the corner
a club is in is **tinted and named on the drawing itself** (**jogo aberto**,
**jogo controlado**, **jogo recuado**, **jogo fechado**), with the same term
repeated in the reading beneath. The words are HTML positioned over the figure
rather than `<text>` inside it, because a figure that scales to its container
scales its type with it. Each term names *how a match goes* and never how well:
the corner is a description, so "jogo aberto" is a fact and "melhor ataque"
would be a verdict two rates cannot support.
_Avoid_: "quadrante" on the page — the reader is told the corner's name, not the
geometry; and any of the four terms as praise or blame.
Beneath it, on the same x axis, it carries the **volume × conversão**: the same
twenty clubs plotted on finalizações against conversão. The pair exists because
**finalizar muito e marcar muito são coisas diferentes**, and the first drawing
cannot separate them — a club can lead the division in finalizações and sit at
the foot of it in conversão, which is one identity and two opposite corners. It
is the reading that answers "eficiência do ataque" without the word: conversão
*is* the efficiency, so it is an axis rather than something to infer from a
slope. The four corners are **volume e aproveitamento**, **volume sem
aproveitamento**, **aproveitamento sem volume** and **nem volume nem
aproveitamento** — descriptive like the first pairing's, and the rule bites
harder here because conversão sounds like a virtue and "melhor ataque" is one
word away.
The x axis is shared with the drawing above on purpose: finalizações is the
volume every other rate is spent on, so reading it against two different y axes
is the point rather than a repetition.
**The y axis is a percentage, so it is never captioned "por jogo"** — that reads
as a typo and is a claim about what the figure counts.
Note what this pairing deliberately does **not** plot: **gols marcados**. The
`scouts` carry a goals column and it is measurably worse than the one the
**Classificação** and `src/data/goals.ts` already answer, so plotting it would
put two answers to one question in front of a reader. Conversão uses that column
only as a numerator, which is a fact about *finalizar* rather than a scoreline.

Note what the first pairing's y axis counts and say no more than that: a
**defesa**, not a finalização sofrida. A defence beaten often in front of a beaten goleiro reads
lower than the pressure on it was.
The numbers are **scouts**, and they come from outside: no provider this app
reads reports a finalização or a desarme at any tier. They are curated into
`src/data/club-scouts.ts` from caRtola, a week at a time, so the section names
the rodada it runs through instead of implying it is live.
_Avoid_: "scouts" in user-facing copy (Cartola FC jargon, and this is a
championship companion rather than a fantasy tool — the word is fine in code and
in the data file, where it names what the source calls them), "estatísticas"
(the **Painel** entry above says why), "índice"/"nota" (nothing here is scored
or weighted; every row is a count divided by matches), "ataque"/"defesa" as
row labels (faltas and cartões are neither, and a heading that sorts six rates
into two virtues is a judgement the data does not carry — the phrase names the
*scatter's two axes*, where it is accurate, and nothing else), "melhor
ataque"/"defesa mais vazada" for a corner of that scatter (a verdict two rates
cannot support; the four names describe how a match goes and stop there),
"finalizações sofridas" for the y axis (it counts defesas, which is not the
same number and is lower by every goal conceded), "gols por jogo" as an axis of
the second scatter (the scout copy of a result, worse than the one the table
already gives — see above), "pontaria" for conversão (it reads as aim, where the
number counts finishing), "aproveitamento" as a *row* label in the strip (the
row is **conversão**; the word belongs to the scatter's corner names).

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

**Técnico**:
The club's head coach, named on the **Clube** page directly beneath the club's
own name — "Técnico: Abel Ferreira", the label in `ink-muted` and the name in
`ink`, so what is read is the person and not the caption. Modelled as
`Club.coach`, a bare name and nothing else: nothing in the app looks a coach up,
so an id would be a field to keep in step for no reader's benefit.

It is **identity, not a statistic**, which is why it sits with the club's name
rather than in a tile beside Posição and Pontos — those are figures a reader
scans and compares, and a name in that row would be read as one.

The only endpoint that reports one is the teams list, which is neither of the
payloads the club page is built from — a fixture names two clubs and no coach,
and so does a standings row. So `/api/coaches` serves the map, projected from
the same cached team payload the **Elenco** comes from, and `coachOf` prefers it
over the copy `sync-seed-data` froze into `clubs.ts`: a Série A club changes
coach several times a season and the snapshot is regenerated far less often than
that. The frozen value is the floor, kept so a failed request still names
someone.
It sits directly above the **Sede**, and the three lines are a descending
ladder rather than a list: the club's name, then who it plays under, then where
it keeps its office, each step fainter than the one before.
A club upstream lists no coach for has **no line at all** — never a dash, and
never a bare label.
Where the provider names the **wrong person**, `src/data/coach-overrides.ts`
replaces it on the way out. The bar is *factually wrong and establishable*, both
halves: an abbreviated or unfamiliar spelling stays, because it is what every
other source shows the same reader, and a name nobody can corroborate stays too
— doubt about the provider is not knowledge of the answer.
_Avoid_: "treinador" (correct Portuguese, but "técnico" is what Brazilian
football says and what every source the app reads writes), "coach", "manager",
"comissão técnica" (the whole staff, which the app does not carry), putting the
name in a **Ficha** tile (a name is a word, not a figure — see **Linha do
cartão** for the same split on the player card).

**Sede**:
The club's headquarters as a postal address, carried on `Club.address` and shown
on the **Clube** page under the club's name, above the row of links, as a pin
glyph followed by one line of text. **The whole line is a link**, mark and
address together, opening the address on Google Maps — where the **Pino do
mapa** on the **Página da partida** is the mark alone, because there the name
beside it already leads somewhere else and a reader clicking it would have to be
asked which of the two they meant. Here the address leads nowhere else, so there
is nothing to disambiguate. Built by `clubMapUrl`, the sibling of
`stadiumMapUrl`: same documented `?api=1&query=` form, but a search for a postal
line rather than a pin on a verified coordinate — an address can land on the
street rather than the door, and for a club whose address arrived half-populated
it lands on the city. That is a weaker promise than the estádio pin's and the
two should not be read as one.
Comes from the provider's teams endpoint, like the **Site oficial**, and is the
same field the club's `state` is already parsed out of — so it costs no request
that was not already being made.
Cleaned by `clubAddress` before it is written down, because football-data
interpolates the string without checking its own columns: a club missing a street
or a postcode arrives as the literal `"null São Paulo, SP null"`, and three of the
twenty do. Only a leading and a trailing `null` token is stripped. Everything
between them is left verbatim — there is no separator between the neighbourhood
and the city (`"Bairro Laranjeiras Rio de Janeiro, RJ"`), so the address cannot be
split into components, which is why it is **a line rather than fields**.
_Avoid_: "endereço" on the page (it is the club's seat, not a delivery address,
and "endereço" also reads as a URL — which is exactly what the four links beside
it are), "localização" (reads as a claim to know where the place is, which a
search for a postal line is not — the pin is now a link, but it opens a *search*
and the word has to stay honest about that), parsing the line into
street/bairro/cidade, truncating it (the cut falls on the city and the state,
which is the half worth reading).

**Pino do mapa**:
The teardrop-and-hole mark that opens a place on Google Maps, drawn by
`MapPinGlyph` in `ClubLinks.tsx`. It has two call sites and they promise
different things: on a **Página da partida** it carries a ground's *verified
coordinate*, so it names a point; on a **Clube** page it carries the **Sede**'s
postal line as a *search*, so it names whatever Google decides that line means.
Both build Google's documented `?api=1&query=` address rather than the
`/maps/place/…` shape a browser's address bar hands you, which is the app's own
internal form and changes without notice.
One mark, defined once, for the same reason the **Wikipédia** mark is: the two
pages had drawn two slightly different pins for what turned out to be one idea,
and the drift only became visible the day the second one started leading
somewhere.
_Avoid_: Google's own pin (fixed artwork in a fixed red — it cannot take
`currentColor`, so it would sit cold beside a link that brightens, the same
argument the **Instagram do clube** mark makes about Meta's gradient), embedding
a map (the app holds none, and one would be a runtime dependency on a third
party for an asset), calling either use a "localização" — one is a coordinate
and the other is a search, and the word claims more than the search delivers.

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

**Estatísticas do jogador**:
A player's profile on Sofascore, shown under **Onde acompanhar** on the **Cartão
do jogador** as a third link beside the **Instagram do jogador** and the
**Verbete do jogador**, under the same rules: a monochrome outline taking
`currentColor`, `inline-block`, `aria-hidden`. It belongs under that heading
rather than under **Pesquisar na web** because it is a page *about* this player
that somebody maintains, not a query the card composed. The mark is three rising
bars rather than Sofascore's wordmark — the destination is a page of numbers, and
a wordmark is fixed artwork that would sit cold beside links that warm on hover.
Reads as "Sofascore", not as the id, for the reason the verbete reads as
"Wikipédia": a seven-digit number is nothing a reader recognises. Curated in
`src/data/player-sofascore.ts`, keyed by player id, storing the **id alone** —
the slug a Sofascore URL carries is decoration, since `_` in that position
resolves by id, and `sofascoreUrl` builds the address from that.
_Avoid_: storing the slug or the `/pt/` prefix (the first can rot on a rename,
the second is a 404), printing the id as the link text, giving this a `subject`
argument like its two neighbours (no club has a Sofascore page, so there is
nothing to confuse it with), filing it under **Pesquisar na web**, and writing
down an id nobody has opened — the site answers every scripted request with 403,
so unlike the verbete this cannot be checked by a script.

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
It is the **one asset class this app still hotlinks** — stadium and player
photographs are vendored to our own origin — so it carries
`referrerPolicy="no-referrer"`: without it every row tells the provider's CDN
which page of this site the reader is on, twenty times per render.
_Avoid_: CBF's `conteudo.cbf.com.br/clubes/<id>/escudo.jpg` (ten times larger, a
JPEG so no transparency, and needs CBF club ids the app does not hold), giving
the crest descriptive alt text, sending a `Referer` with the request.

**Monograma do clube**:
What an **Escudo** falls back to — the club's `tla` in a quiet disc, the same
box the crest would have taken, when the image does not arrive. Built by
`crestMonogram` in `club-core.ts`; `tla` first and the short name's initial when
the provider reports none, never `code`, which for such a club is a synthetic
`FD-<id>`.
It carries **no information**: the club's name is beside it either way, which is
also why the crest is `alt=""`. Its whole job is to keep the slot from looking
broken, so it takes no club colour and no treatment a crest does not have — and
it is `aria-hidden` for the same reason the crest is.
_Avoid_: "placeholder" and "avatar" (this is the club's abbreviation, not a stand-in
person), colouring it by club (rejected in `docs/brasileirao-pro-proposal.md`),
deriving initials word by word — "Vasco da Gama" needs a stopword list to reach
`VG` and every such rule is a way to print something wrong beside a name that is
already right.

**tla**:
The three-letter abbreviation upstream reports for a club (`FLA`, `PAL`, `CAP`).
Carried on `Club` for compact display only. **Not an identity** — see **Clube**.
_Avoid_: using it as a map key, a React `key`, or a foreign key of any kind.

**Artigo do clube**:
The **o** or **a** a Brazilian puts in front of a club's popular name — o
Palmeiras, a Chapecoense — and the contracted **do**/**da** that almost every
sentence about a club actually needs. Both come from `club-core.ts`, beside
**slug**, because the article belongs to the *name* rather than to whatever page
is printing it: a club relegated and promoted again keeps its article and may
not keep its `code`. `ofClub` is the form to reach for; `clubArticle` returns
the bare word and has one caller, the **Meu time** control, which puts a verb in
front of it.
Hand-kept, and it has to be: no provider reports grammatical gender and the
spelling does not give it away — "a Chapecoense" and "o Fluminense" end
identically. The table is **exhaustive** over `src/data/clubs.ts` rather than a
list of the exceptions, and a club with no entry fails the build; masculine
survives only as a runtime default, for a club the live payload names and the
snapshot does not. The exceptions-plus-default shape shipped first and could not
see an *unknown* feminine club arriving, which is the same silence as the bug it
was written to fix.
A list of clubs repeats it — **Casa do Fluminense e do Flamengo**, not "Casa do
Fluminense e Flamengo" — which is what `ofClubs` is for.
_Avoid_: writing `do ${shortName}` at a call site (it was wrong in four files at
once, two of them page metadata that reaches every link preview), inferring
gender from the final letter, keying the table on `code` or on **tla**, and
dropping a club's state suffix from the *name* rather than only from the lookup
key.

**Partida**:
A single fixture between two clubs, modelled as `Match`. Carries `round`,
`kickoff` (always an ISO-8601 UTC instant), a `MatchStatus`, the two club codes,
and goals that are `null` until there is a score to report.
_Avoid_: "game"/"jogo" for the entity (`J` in the table means *jogos disputados*,
a count, not a fixture), "event".

**Página da partida**:
The detail page for one fixture, at `/partida/<id>`, reached from the fixture
list. Shows the scoreboard, round, status, kickoff, **Estádio**, **Árbitro**
and — depending on state — either **Onde assistir** or a link to the goals. Every field beyond
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

**Árbitro**:
Who officiated a **Partida**, from football-data's `referees` array — the one
field on `Match` that comes from **no local file**, so it is **live-only**:
`src/data/matches.ts` carries none and the end-to-end suite, which boots frozen,
never sees one. Rendered as its own row of the match page's `<dl>`, labelled by
role: `REFEREE` → "Árbitro", and a named official whose role upstream omitted
gets "Arbitragem", the collective noun, since that is all the payload claimed.
Any other role reaches the page **verbatim**, the rule **Posição** and
**Nacionalidade** already follow — every one of the 356 entries across BSA, PL
and CL is `REFEREE`, so translating an assistant's token would be a claim this
app cannot check. Upstream names nobody for 223 of the season's 380 fixtures,
finished ones included, so it fills in retroactively rather than at kickoff.
_Avoid_: "arbitragem" for the person (it is the collective — the activity and
the crew, which is exactly why it stands in when the role is unknown); "juiz"
(the spoken word, but CBF and the provider both say *árbitro*); rendering an
empty row, a dash or "a definir" for the 223 fixtures with no official; printing
the reported nationality, which is `Brazil` for 156 of the 157 entries and wrong
for the one that is not.

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

**Súmula**:
CBF's own match report, published as a PDF at `conteudo.cbf.com.br/sumulas/…`
and parsed by `sumula-core.ts`. It is the **only** source that says when a goal
was scored: CBF's match API sends `tempo_jogo: "2"` on every goal and a
`minutos` with no half attached, while the súmula prints a **1T/2T** column
beside the time and renders stoppage as `+N`. It also states its own half-time
and final scorelines in prose, which is what lets a parse be checked against the
document that produced it.
The word stays **súmula** in code and in comments — it is what CBF calls the
document and what a Brazilian reader would search for. Nothing user-facing says
it yet; if anything ever does, it is *a súmula*, never "the match report".
_Avoid_: "match report" or "boletim" (neither is CBF's word); treating the
súmula and the match API as interchangeable sources — they carry different
fields and only one of them has a clock; **"minuto do gol" as a value read from
the API**, which is the thing that does not exist and the reason this document
is read at all.

**Conta para a classificação**:
`countsTowardStandings` — a match enters the table only when it is `FINISHED`
**and** carries both scores. A `LIVE` match with a partial score does not: the
table moves on the final whistle. Note that football-data's own table *does*
count in-play matches, so while matches are in progress the live table and the
computed fallback table legitimately differ. This is deliberate; see CLAUDE.md.
_Avoid_: "played" as the predicate (a live match is being played and still must
not count).

**G4 / G5 / G11 / Z4**:
The four bands of the **Classificação**, declared once as `ZONES` in
`standings-core.ts` and painted as a coloured rail by `zoneClass`. **G4** is the
Libertadores fase de grupos (1º–4º), **G5** the pré-Libertadores (5º alone),
**G11** the Sul-Americana fase de grupos (6º–11º) and **Z4** the rebaixamento
(the last four positions). Eleven continental places, not the twelve a reader may
remember: the Copa do Brasil and Libertadores champions hold berths of their own,
so a champion finishing outside the zone slides every boundary below it up by one.
**That is why the numbers are one literal rather than four conditions** — nothing
here can check them against the CBF, a wrong band is indistinguishable from a
right one to anyone reading the page, and re-reading them each season is a
person's job that should touch exactly one place.
A term names the **cumulative zone**, in the Brazilian idiom where G-4, G-6 and
G-12 all count from the top; the rail beside it paints only that band's own
positions, and the `where` clause is what says which. Z4 is computed from the row
count rather than hard-coded to 17–20, so the table stays correct if the division
ever changes size, and `zoneAt` asks the relegation band first so a division small
enough for the two ends to overlap still has one defined answer.
The **legenda das zonas** beneath the table is where all four names reach the
reader — "G4 Libertadores — as quatro primeiras posições", "G5 Pré-Libertadores —
a quinta posição", "G11 Sul-Americana — da sexta à décima primeira posição", "Z4
Rebaixamento — as quatro últimas posições". It spells positions in words rather
than ordinals, both because Z4 is derived from the row count and because that
sentence is the whole of what a colourblind reader or a grayscale capture gets:
the rail carries hue and a border style and nothing else.
**Three hues and one pattern, because a fourth hue does not clear 3:1.** G4 and
G5 share `positive`, G5 broken (`[border-left-style:dashed]`, never
`border-dashed`, which would dash `ROW_LINE` across every cell); G11 is
`tertiary` and Z4 `negative`. `warning` — the orange the reference table uses for
the pré-Libertadores band — measures **2.19:1** against `surface` on light, a
rail carrying hue and nothing else.
Every banded row also **says its zone in text** — an `sr-only` span in the
position cell, beside the number rather than replacing it, naming the band and
never the rule. The rail is a `border-left` and a border carries no text, so
without it the key named the bands and fifteen rows said nothing about which of
them they were in. Rows 12 to 16 say nothing, because they are in no band.
**The bands do not apply to a split** — in **Completa / Casa / Fora**, position 4
of the Casa table is the fourth-best host and not a Libertadores place, so the
words, the rail and the key are all absent there.
_Avoid_: hard-coding `position > 16`; "top four"/"bottom four" in pt-BR copy;
"17º ao 20º" in the key; "Sudamericana" (the sponsor's spelling — pt-BR press
writes **Sul-Americana**); "qualificatórias" where **pré-Libertadores** is the
word a reader here uses; reading G5 as "the fifth band" rather than "everything
down to 5th"; a key that names only the colours ("verde", "vermelho") — that is
the single-channel encoding again, one line further down.

**Líder**:
The club in 1st, marked in the **Classificação** by its position number sitting
in a filled `tertiary` disc, with " — líder" beside it as `sr-only`. It is the
only position that gets a mark: the leader's is the most-looked-at row on the
page and read exactly like 2nd to 4th, which carry the same **G4** rail.
**Only the leader is marked this way.** The pré-Libertadores and Sul-Americana
bands beneath are drawn too, but as *rails* — a rail says which band a row is
in, where the disc says which row. Their boundaries move with who wins the Copa
do Brasil, which is the hazard `ZONES` exists to hold in one place; the leader is
the one position here that no competition rule can relocate.
The fill is the solid role and **not `tertiary-container`**, which measures
1.23:1 against the page on light: the disc would carry hue and nothing else, so
it would say nothing in grayscale or to a colour-blind reader. The solid role is
6.11 there and 10.96 on dark.
_Avoid_: "primeiro colocado" as the mark's wording (the disc already shows the
1), a trophy glyph (the app draws no such mark and it says nothing in text),
tiering any position but the first until the qualification rules are data rather
than a magic number.

**P, J, V, E, D, SG**:
The `Classificação` column headers: pontos, jogos, vitórias, empates, derrotas,
saldo de gols. Points are always `vitórias × 3 + empates` — an e2e test asserts
this for every row, so a scoring change must update `POINTS_FOR_WIN` in
`standings-core.ts` rather than the table.
_Avoid_: "PTS"/"GP"/"GD" (English abbreviations), reordering the columns — this is
the order every Brazilian table uses.

**Aproveitamento**:
The share of the points a club could have taken that it actually took,
`pontos / (jogos × 3)`, printed as a whole percentage — the metric a Brazilian
reader quotes by default, and the one ge and CBF both carry where the header list
above stops. `pointsPercentage` and `pointsPercentageLabel` in `standings-core.ts`;
the `%` column of the **Classificação**, last as every Brazilian table puts it, and
the fifth tile of the **Clube** page.
It is **derived from `points` and `played`, never stored on `StandingsRow`**, so it
cannot disagree with the two numbers beside it whichever table `/api/standings`
served — upstream's own or the computed one.
It is the column that reads a **postponed fixture** honestly, which is the whole
reason to carry it: a club a game short is understated by P and stated correctly
here, the same argument **Campanha** makes by carrying `played`.
A club with no game played has **no** aproveitamento and renders an em dash. `0%`
is a club that has played and taken nothing; the two are different claims, and only
one of them is about the club — the same rule the **Artilharia** applies to an
unreported tally.
_Avoid_: "eficiência" and "taxa de vitórias" (both mean something else — the second
counts only wins, where a draw is a third of a result here), "%" as the term in
prose (it is the column header, not the word), a decimal place (ge prints whole
numbers in a table, and the column costs width to widen), coercing the no-games
case to zero anywhere between the function and the cell.

**Projeção**:
Each club's odds of finishing champion, inside the **G4** and inside the **Z4**,
estimated by simulating every fixture still to be played — `projectSeason` in
`season-sim-core.ts`, a seeded Monte Carlo over a Dixon–Coles model — two
independent Poissons with the τ correction on the four lowest scorelines — fitted
to the current table. It is never a forecast and the copy must not read as
one: it is **simulado**, a model with its parameters read out of the same snapshot
the **Classificação** is built from, and `docs/brasileirao-pro-proposal.md` names
that framing as the condition on the feature existing at all.
**One model, two scopes.** `projectSeason` samples the whole remaining season;
`predictMatchOutcome` narrows to a single fixture and sums the same scoreline
grid in closed form, with no RNG at all — win, draw and loss, each side's
expected goals, and the modal placar with its own probability beside it. Both
read `buildScoreGrid`, so a match page and the **Classificação** cannot come to
describe different models. The single-fixture form keeps the season's name for
that reason, and because the words a reader would otherwise expect there are the
two ruled out below.
The modal placar is **shown with its probability or not at all**: it is routinely
under 12%, so printing "1-1" alone reads as a prediction where the number is the
whole of what makes it a mode.
Expected goals are the **mean of that grid, not the Poisson λ** it was built
from — the grid truncates and applies the Dixon–Coles correction before
renormalising, so λ is not the mean of what the reader is shown, and where the
clamp binds it is not a mean at all.
Each iteration re-runs `computeStandings`, so a simulated table is ranked by the
CBF tie-breakers rather than by a second implementation of them — the argument
**Campanha** already makes, and a sharper one here, because the third and fourth
tie-breakers are goal difference and goals scored and the model therefore has to
produce a **placar**, not a result.
The headline numbers are derived from `positionOdds`, the club's probability of
each finishing position, for the reason **Aproveitamento** is derived from points
and played: two counts of one thing can disagree and one cannot.
_Avoid_: "previsão" and "prognóstico" (both claim knowledge of the result;
"projeção" and "simulado" are what this is), presenting a percentage without the
simulado framing, a título column that moves on refresh with no match played
(the RNG is seeded precisely so it cannot), hard-coding a zone depth beside the
one in `standings-core.ts`, "Poisson bivariado"/"bivariate Poisson" for the model
(that is Karlis & Ntzoufras, a shared covariance component this app does not
implement — Dixon–Coles corrects two *independent* Poissons, and `buildScoreGrid`
multiplies two marginals; this entry and two comments in `season-sim-core.ts`
carried the wrong name for months while the code carried the right one).

**Clima no estádio**:
What the sky is doing at a ground, right now — temperature, a pt-BR description
of the sky, and where reported the sensação térmica, umidade and vento. A
section of the **Estádio** page, built by `weather-core.ts` from Open-Meteo and
served by `/api/stadium-weather/:slug`.
It is **current conditions and never a forecast**, and the copy must not imply
one: the card prints the instant it was read ("Leitura das 18:17") precisely so
it says how old it is rather than claiming to be live. A kickoff days away has a
forecast worth about as much as a guess, and printing one would be the failure
**Ao vivo** already refuses for the match minute.
**Absent is a real answer.** No coordinate, the feature switched off, the
upstream unreachable or a payload that will not parse all end in the section not
rendering — never a spinner, a dash or an apology on a page that has otherwise
worked. The same rule the **Estádio** page already applies to a ground with no
year of inauguration.
The mark is one of six drawn skies, not a character: `☀` and `☁` are
Extended_Pictographic, so a font would pick their size and several platforms
their colour.
_Avoid_: "previsão" and "tempo" (the first claims a forecast, the second is the
word for *time* as often as for weather in pt-BR), "clima" alone for a single
reading in prose (clima is the pattern, this is the condition — the section
heading names the place, which is what disambiguates it), a temperature with a
decimal place, showing the card while the reading is unavailable.

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

**Números da temporada**:
The panel beneath the **Classificação**: gols, gols por jogo, **Vitórias do
mandante**, and the *melhores ataques* and *melhores defesas* leaderboards.
`league-stats-core.ts`, every figure a reduction over data the client already
holds, so it costs no request.
**Not a sixth destination**, which is the decision rather than a placement: MD3's
**Barra de navegação** carries three to five and there are five. A sixth breaks
nothing and reddens nothing, which is why refusing it is written down. If it ever
wants to be one, that is the navigation *drawer* conversation.
Averages divide by matches **finished**, never by the 380 a season schedules —
otherwise the figure is wrong every week but the last. Nothing played renders
**nothing**, not zero: a zero average claims the season is producing no goals
where the truth is it has not started. A club with no match played is left out of
the leaderboards rather than ranked, or it leads the meanest defence on no
evidence at all.
_Avoid_: "aproveitamento dos mandantes" for the home-win share — **Aproveitamento**
is points taken over points available and reusing the word gives it two meanings
on one screen; a sixth `NAV_ITEMS` entry; dividing by the fixture count;
rendering `0` or `NaN` before a match has been played.

**Completa / Casa / Fora**:
The three slices of the **Classificação**, chosen by a segmented control above
the table. `computeStandings(clubs, matches, side)` — one computation, three
subsets: `casa` counts only the matches a club hosted, `fora` only those it
visited, and the two add up to `completa` club by club.
**All three are computed from the fixture list**, never taken from upstream's
`HOME`/`AWAY` groups. That would be one line and it is wrong for the reason
`/api/standings` is read as `TOTAL` only: **upstream counts `IN_PLAY` matches
and this app does not**, so a Casa view crediting a half-time lead beside a
Completa view that does not is a contradiction a reader produces by pressing a
button.
A split **hides the mark column and the leader disc**. Both marks are
whole-season facts — a campanha is a trajectory through the real table, a forma
is the last five wherever they were played — and position 1 of the Casa table is
the best host, not the **Líder**.
The choice is **not persisted**, unlike **Marca da classificação** and the
theme: it is a question asked of one table and then done with, and a reader
arriving at the Classificação expects the Classificação.
_Avoid_: "mandante/visitante" as the control's labels (correct, and longer than
the segments allow — the `title` carries them), taking the splits from the
provider, persisting the choice, tiering the zones off a split's positions.

**Marca da classificação**:
Which mark the Classificação's one narrow column shows — the **Campanha** or the
**Forma**. `standings-mark-core.ts`, held in `localStorage` by
`useStandingsMark`, chosen with a button above the table.
**One column rather than two, and that was measured.** At desktop the table is
734px inside a 734px container: an eleventh column of five 28px pills overflowed
it by 22px, and one of 20px pills took 154px out of the tallies. Sharing costs
nothing, and the two marks answer different questions about the same club — a
campanha is a *position* trajectory and so is relative to nineteen other clubs,
where the forma is what the club itself did.
**Distinct from the plot kind, which is global.** `CampaignPlotKind` says how a
campanha is *drawn* and governs the Painel and the Partida page too; this says
what *this column holds*, and nothing outside the table has such a column.
Folding "forma" into that union would put pill strips on the Clube page directly
above its own **Últimos resultados** — the same five results twice, eight lines
apart. (That argument was written when the Clube page drew a campanha; the
campanha has since moved to the Painel, and the pill strips folding would put
there are the objection either way.)
_Avoid_: a third member of `CampaignPlotKind`; a shared storage key; showing
both marks at once (the width is the whole reason there is a choice).

**Forma**:
The last five *finished* results from one club's point of view, oldest first:
`V` vitória, `E` empate, `D` derrota. Only finished matches count, so a postponed
fixture mid-run does not punch a hole in the guide, and a live match never
appears — consistent with **Conta para a classificação**.
Each pill carries the **word** as well as the letter: `title` for a mouse, and an
`sr-only` span with the letter `aria-hidden`, so the announcement is "Vitória"
rather than "V" or "V Vitória". `title` alone was the whole of its naming and is
neither reliably announced nor reachable by touch — the same fix `RankSparkline`
already applies to the campanha. **Oldest first is named on the list**, not left
to the heading: "Últimos resultados" says which matches these are and never which
end is now, and which end is now is what the guide is read for.
_Avoid_: "W/D/L" (English initials), counting a live scoreline as a result,
`title` as a control's only name, announcing the letter and the word together.

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
The overlay opened by choosing a player in **Artilharia** or in an **Elenco**. It
renders immediately from the row it was opened from (name, club, season figures),
then fills in shirt number, position, nationality and birth date from
`/api/players/:id`. That request is an *enrichment*, not a dependency — when it
fails or the app is offline the card omits those fields rather than showing
blanks. Deliberately not a route: an overlay should not survive a reload.

It is laid out around one distinction: a **Ficha** is a number, a **Linha do
cartão** is a word. Numbers are what a reader scans a card for and they carry the
size and the accent; words are read once and sit quietly beneath them.

**The club is whichever the *page* knew**, not the one the enrichment reports:
`currentTeam` is often a player's national team, which had Memphis Depay's card
reading "Netherlands" under his name and again as his nationality.
_Avoid_: blocking the card on the fetch, rendering an empty label for a detail
the provider did not supply, giving it a URL, setting words at the same size as
figures (the card was a wall of equal-looking values before the two were split),
and letting `currentTeam` overwrite a club the page already knew.

**Ficha**:
One labelled number on the **Cartão do jogador** — *Camisa*, *Idade*, and a
scorer's *Gols*, *Assist.*, *Pênaltis* and *Jogos*. Set at the headline step in
the accent colour against a short accent rule, with a small uppercase caption
beneath. The unit lives in the caption, never in the value: the tile reads "32"
under `Idade`, not "32 anos".
_Avoid_: "estatística" (the word for the discipline, not for one figure), putting
a word in a ficha, printing the unit in the value, and rendering a ficha for a
figure the provider did not report — an absent value is not a zero, and an
unreported one is an em dash.

**Linha do cartão**:
One label-and-value row on the **Cartão do jogador** — *Posição*,
*Nacionalidade*, *Nascimento* — label left, value right, separated by hairlines.
The shape for facts that are words rather than figures.
_Avoid_: "campo" (that is the pitch), a row whose value is a bare number (that is
a **Ficha**), and a row rendered empty for a fact the provider did not supply.

**Nascimento**:
A player's date of birth, written the way a reader writes one — "13 fev. 1994".
Shown as a **Linha do cartão** beside the derived *Idade*, which is a **Ficha**;
the two are not a duplication, because one answers "how old" and the other
"when". Read in **UTC**: the provider sends a bare date, which parses as UTC
midnight, and reading that through a Brazilian calendar moves every date back by
one day.
_Avoid_: "data de nascimento" as the label (the noun alone is the caption in this
column), formatting through `Intl` (the host's ICU decides, and a trimmed image
silently answers in English), and reading the date locally.

**Pesquisar na web**:
Two links at the foot of the **Cartão do jogador** — Google and *Notícias* —
built from the player's name and club rather than curated. The only part of the
card that works for every player rather than for the handful with a recorded
account, and the honest answer to what the card cannot hold: the app knows a
position and a birth date, and a reader who opened the card usually wanted this
week's news.
_Avoid_: "buscar" (pt-BR prefers "pesquisar" for a web search), curating these by
hand, and building the news link as a second query rather than as a tab of the
first.

**Onde acompanhar**:
The heading over the pages a reader can follow a player on, in the **Cartão do
jogador** — the **Instagram do jogador**, the **Verbete do jogador** and the
**Estatísticas do jogador**. Named for what a reader does with them rather than
for what they are, which is what tells them apart from **Pesquisar na web**
below: these are maintained pages about this player, that one is a query the card
composed.
_Avoid_: "Redes sociais" (neither a Wikipedia article nor a stats profile is
one), "Links" (says nothing), and rendering the heading over an empty row for a
player with none of the three recorded.

**Posição**:
A player's position. The upstream reports it in English, at two levels of detail
— broad lines (`Offence`) and specific roles (`Centre-Back`) — so `positionLabel`
maps both to pt-BR. An unmapped value is shown **verbatim** rather than replaced
by a guess or a dash: a reader seeing the English word is better served than one
seeing nothing.
_Avoid_: inventing a translation for a value the map does not cover, collapsing
specific roles into their broad line.

**Nacionalidade**:
The country a player represents, shown as a **Linha do cartão**. The provider
reports it in English and `nationalityLabel` writes it in pt-BR — "Brasil", not
"Brazil", which is what the card said for months while the position beside it
was translated from the first day.

Hand-written, because there is no `Intl` route to it: `Intl.DisplayNames` speaks
ISO region codes and the provider sends **its own names** — `DR Congo` and
`Ivory Coast` are not what any standard calls those countries. `England` rather
than the United Kingdom is football counting the home nations separately, which
is right here and is another thing a region-code table would get wrong.

The table covers every value the division actually carries, measured against the
live squads; a unit test fails the moment `sync-seed-data` brings in one that is
missing, so it cannot quietly fall behind a transfer window.
_Avoid_: "Holanda" for the Netherlands — a data row is a reference surface and
takes the country's current pt-BR name, "Países Baixos", where the
broadcast voice governs prose rather than proper nouns; the demonym form
("brasileiro"), since the column names countries and not people; guessing at a
country the table does not list, which is shown **verbatim in English** instead,
as a visible prompt to add the row.

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

**Buscar jogador**:
The name filter above the **Jogadores** panels — `filterSquads` in
`squad-core.ts` over the payload already in memory, so it costs no request and
does not touch the address: the page stays shareable as the page rather than as
somebody's search. It is the one place in the app where a reader plausibly knows
the name and cannot find the row, which is what 948 players behind twenty closed
panels does.
A match **opens its club**, or the filter hides its own hits inside collapsed
panels and reads as "nothing found" while showing club rows. Clubs left with
nobody are dropped rather than rendered empty.
Matching folds accents, case and punctuation and keeps spaces (`foldForSearch`).
**Not `slugify`** — that turns punctuation into a hyphen, which is right for an
address and wrong here: the division carries `Ariel Sant'Anna`, and `santanna`
does not occur in `ariel-sant-anna`. Keeping spaces is what stops a match
straddling two words, so `Carlos Antonio` does not answer to `osan`.
_Avoid_: "filtro" as the visible label (a reader searches, the code filters),
putting the query in the URL, matching on club name too (the twenty-row index
above already is that), a second normaliser — `foldForSearch` is the one.

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
Tailwind's `rounded-lg` is 8px where MD3's large is 16dp.
**A step is chosen by what the thing is, never by how deeply it is nested** —
marks and inline targets x-small, panels and banners small, a modal `<dialog>`
x-large, an MD3 pill control `full`; `medium` holds only the player card's
photograph and `large` is used nowhere. The list lives beside the scale in
`src/index.css`, because a rule written away from the values it governs is one
nobody meets while choosing.
This sentence used to read *"the app currently uses only the first three"*,
which stopped being true when the player card took `x-large` in M4 — an example
of the thing the entry is now about, in the entry itself.
_Avoid_: "border radius" in prose (the token is the unit of meaning, not the CSS
property), "arredondamento" (accurate but nobody says it), reusing Tailwind's
`sm`/`md`/`lg` names for MD3 sizes, "one step down per level of nesting" (the
assumption the written rule exists to contradict).

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

**Rodapé**:
The strip closing every page: what this site is, and what is currently serving
it. Rendered by `Footer`, and placed **inside** the page container rather than
under it, so the `pb-28` that clears the navigation bar on a phone clears the
rodapé too — under it, the last line would sit beneath the bar and be invisible
until someone scrolled to the end of a twenty-club table. It is a sibling of
`<main>`, not a child, because a drill-down replaces what is inside `main` and
the rodapé must survive it.
It carries three bands, in this order: what the site is, the **Sites do autor**,
and the **Saúde do serviço**.
_Avoid_: "footer" in user-facing copy (upstream's word, not the reader's),
putting navigation in it (the destinations are `NAV_ITEMS` and the bar is
already full — see the bound in CLAUDE.md; the **Sites do autor** are outbound
links and not a second set of destinations, which is why they carry no `<nav>`),
treating it as the place to park anything with nowhere else to go.

**Sites do autor**:
The two places this app's author writes, as the middle band of the **Rodapé**:
`mpbarbosa.com`, the personal and professional site, and
`copa2026.mpbarbosa.com`, the Copa do Mundo FIFA 2026 companion built the same
way this app is.
They **leave the site** rather than moving around it, which is the whole reason
they are not navigation and the reason the rodapé's rule against navigation is
not being bent: a `<ul>` of outbound anchors, no `<nav>`, no landmark, and the
sections stay `NAV_ITEMS`.
**Both print their bare domain, and that is a decision — do not "restore"
either to a friendlier name.** The first draft printed the sibling as **Agora
na Copa 26**, reasoning from the rule that a link reads as the thing a reader
recognises (the rule that prints **Wikipédia** rather than an article's full
legal title). That rule holds where the name is the only handle a reader has,
and it is the wrong rule here: this band exists to say *these are the same
author's other addresses*, and the shared `mpbarbosa.com` stem is what carries
that. A name on one and a domain on the other hides the relationship the band
is for, and reads as two unrelated links that happen to sit together.
Two consequences worth knowing. A bare domain names no subject, so the
screen-reader `subject` is no longer a nicety — it is the only thing saying
where the link goes, and must not be trimmed to match the visible text. And
one label is now a **substring** of the other, so every test locator is
anchored with `^`; an unanchored `mpbarbosa.com` matches both.
Rendered by `AuthorLinks`, through `OutboundLink`, which owns the whole anchor
for the reason `ClubLinks` does — `target`, `rel` and the screen-reader suffix
are what a copied link loses, and a copy missing `rel="noopener"` looks
identical on the page. They carry MD3's 48dp floor because they are standalone
controls on their own line, the distinction that keeps that floor off the
twenty club names in the **Classificação**.
_Avoid_: "links úteis" or "parceiros" (neither is what these are — one is the
author's own page and the other is his other app), printing the author's name
on the page (the destination introduces them; this app does not), naming either
site rather than printing its domain, adding a third site here without opening
it first, calling this band navigation.

**Saúde do serviço**:
What `/api/health` reports about the process that answered — its state, the
provider it is **configured** with, the commit it was built from, when it was
built, and when it started. Read once at load, narrowed by `parseHealth` in
`health-core.ts`, and rendered as the second half of the **Rodapé**.
Two distinctions the wording turns on. The **Fonte** here names what is
configured, never what the last request returned: `/api/health` knows whether a
token is present and the kill switch is off, and whether the upstream answered a
minute ago is the envelope's `source`, which the banner above already carries.
Saying "dados ao vivo" here would contradict a `fallback` banner three lines up.
And **No ar desde** is an instant rather than an elapsed count, though the
endpoint reports elapsed seconds: an instant answers "did it restart?" without
the reader subtracting, and it holds still, where a "há 5 h 12 min" would differ
between two captures of the same running process and commit that band as noise
every screenshot refresh.
Every field but the state may be absent — from source there is no build time —
and an absent one is a missing item, never a dash.
_Avoid_: "status" (the app says estado; `Status da partida` is a different
thing and is a match's), "uptime" in user-facing copy, "versão" for
`package.json`'s number — it sat at 0.1.0 for every deploy ever made and
answered nothing, so the commit is what the rodapé shows.

**Meu time**:
The one club a reader follows, chosen from the **Clube** page and remembered on
that device. Held as `Preferences.club` in `preferences-core.ts` — the club's
`code`, which is the upstream numeric id, never the **tla** and never the
**slug**. It renders in exactly three places: a strip above the **Classificação**
naming the club, the **Próximo jogo do meu time** line inside that strip, and a
star on that club's row in the table.
It is **one** club, not a list: choosing another is a change of allegiance, so
`toggleFollow` replaces rather than appends. And it is **device-first**: it
needs no account, no server and nothing that can be lost by anyone but its
owner — that is Phase 0 of `docs/accounts.md` and it is still exactly true for
a guest. With a **Conta** it also syncs, under `planSync`'s one-sentence rule:
the account is the source of truth, and a device seeds an account that has none
yet. Contrast **Página inicial**, which has no device copy at all.
Two rules the copy and the code both turn on. A reader who has chosen nobody is
shown **nothing at all** about it: no strip, no prompt, no invitation on the
home page, because a permanent nag is the soft end of the same thing a sign-in
wall is, and guests are first class. And a stored club that the current payload
does not name is **kept**, not cleared — the strip says so and the preference
stands, since a provider outage is not a reader changing their mind.
The control's label carries the club's **Artigo do clube** — "Seguir **a**
Chapecoense" — and is the one caller that wants the bare `o`/`a` rather than the
contracted `do`/`da`, because a verb comes in front of it. The table itself is
`club-core.ts`'s, not this module's.
_Avoid_: "time favorito" or "favorito" (reads as a bookmark, and the mark is a
star for a reason — it says *mine*, not *starred*), "time do coração" (warm, and
what a broadcaster says, but this is a setting rather than a declaration),
"seguir" as a noun, "clube preferido", and "Seguir o Chapecoense" — which is
what shipped first.

**Próximo jogo do meu time**:
The one fixture put in front of a reader who has chosen a **Meu time** — the
second line of that strip, above the **Classificação**. It names the two sides,
says whether the club plays **em casa** or **fora de casa**, prints the kickoff
in the reader's own zone and carries the **Contagem regressiva**; it links to
the **Página da partida**. While the club is playing it says **Bola rolando**
and shows the score instead of counting down to something already under way.
Decided by `clubFocus` in `next-match-core.ts`, which prefers a match in
progress over one that is merely sooner, keeps a late kickoff for the same
`LATE_GRACE_MS` the **Ao vivo** board does, and never offers a postponed or
cancelled fixture as the next one — a reader cannot plan around either. Neither
is *hidden*: both keep their place in the round and on the board, and this line
simply does not point at them.
Three rules the copy turns on. It is **an absence, not a zero**: a club with
nothing left to play, an unresolved **Meu time** and a payload that has not
landed all render the strip with no fixture line, because none of them is
evidence the season is over. It is shown to **anyone who has chosen a club**,
signed in or not — a **Conta** carries the choice between aparelhos and buys no
extra line here, and making a device-local thing account-only is the soft wall
`docs/accounts.md` §8 pushes back on. And **imminence changes the tone, never
the wording**: within a day, or under way, the rail goes `primary`; further out
it is `outline-variant`. The sentence is the same either way, so there is only
one form of it to keep true.
_Avoid_: "alerta" and "notificação" (nothing is pushed and nothing arrives with
the tab closed — see `docs/accounts.md` Phase 3 for what would), "lembrete"
(implies the app will tell you later), "seu próximo jogo" (the reader is not
playing), and a match minute, for the reason **Bola rolando** already gives.

**Preferências**:
What the app remembers about a reader, as one object with one key per decision —
today **Meu time** and **Página inicial**. Parsed by `parsePreferences`, which
tolerates anything at all in storage, and bound to `localStorage` by
`usePreferences` under `portal-brasileirao:preferences`, beside the theme's own
key.
**The two keys do not have the same home, and that is the thing to know about
this word.** Meu time is device-first and syncs with an account; Página inicial
exists *only* in an account, and `serialiseDevicePreferences` is what keeps it
out of the browser's storage. They travel as one object because the endpoint
replaces the whole set, and they are told apart at exactly two places — that
serialiser and `planSync`. So a merge rule is owed only where both sides can
hold a value: ask which side **owns** a key before asking how to reconcile it.
The **Tema** is deliberately *not* one of them, though it is stored the same
way: it belongs to the device and the light in the room rather than to the
person, which is why `useTheme` keeps its own key and why syncing it to an
account later would be a conflict-resolution problem bought for nothing.
A failed write is silent. Telling somebody in private mode that their choice
will not be remembered is a message about their browser dressed as a message
about the app, delivered at the moment they did something that otherwise worked.
_Avoid_: "configurações" (there is no settings *page* — **Página inicial** is a
single control inside **Conta**, and naming the concept "configurações" promises
a screen this app does not have), "ajustes", "perfil" (that is a person, and an
account is not one).

**Página inicial**:
The section the Portal opens on for a signed-in reader — the **Classificação**
by default, or **Ao vivo**, **Jogos**, **Artilharia**, **Jogadores**, or the
page of their **Meu time**. Held as `Preferences.landing`, chosen from a single
`<select>` in **Conta**, and **stored only in the account**: it is the one
preference a guest is not offered, because its whole purpose is to follow a
person between aparelhos and a device-local copy would be the one that
disagreed.
It is a **redirect**, not a different page under `/`: the app replaces the
address on the first load of the home address, so the canonical tag, the link
preview and the JSON-LD keep describing what is actually on screen — and a
crawler, which has no session, still sees the table at `/` permanently.
Three rules the code turns on, each of which is a way it could be a trap. A
**deep link wins**: somebody who followed a link asked for that page. The
**Classificação tab still works**: the redirect fires once per document, on the
home address, so it cannot make the home page unreachable. And **Meu time falls
back to the table** when the club cannot be named right now, rather than
guessing an address out of a stored code — `followState`'s rule, one layer out.
Choosing the Classificação stores nothing, so "chose the default" and "never
chose" stay one state, exactly as they do for **Meu time**.
_Avoid_: "home" and "homepage" (English, and the site has one home *address*
regardless of what a reader lands on), "tela inicial" (that is a phone's), "página
padrão" (says default rather than *whose*), and "abrir em" as the name of the
concept — that is the control's label, not the thing.

**Conta**:
A reader's account, held only so that what they choose can follow them between
aparelhos. One row per person in `accounts`, keyed by an opaque id of ours and
never by the provider's `sub` or by an email — both can be reassigned, and a
primary key may not. Rendered by `AccountView` at `/conta`; `/api/account/me`
answers `PublicAccount`, which names the id and the display name and nothing
else.
Distinguish from **Conta para a classificação**, which is a verb — whether a
match counts toward the table — and was in this glossary first.
Signing in is always an **offer**: every page works without one, and none may be
gated behind one. See `docs/accounts.md`, whose guest invariant this is.
_Avoid_: "usuário" (the app says conta, and "usuário" reads as a row in a
database rather than a person), "perfil" (suggests a public page and a bio,
neither of which exists), "cadastro" (there is no registration form — Google has
already said who this is).

**Entrar / Sair**:
Signing in and out. **Entrar** is at `/entrar`, offers one provider today, and
says plainly that everything works without it. **Sair** ends this session;
**Sair de todos os aparelhos** ends every session the account has, which is the
operation a signed token could not really perform and the reason sessions are
rows in a table.
_Avoid_: "login"/"logout" as verbs in pt-BR copy, "logar", "deslogar",
"autenticar" (a machine's word for it), "conectar-se".

**Sessão**:
One signed-in browser, not one person: `sessions` holds a row per aparelho. What
is stored is the SHA-256 of the cookie value, never the value itself, so reading
the database yields no usable session. Thirty days, renewed once past halfway —
a reader who visits at all regularly never meets an expiry, and one who
disappears for a month is signed out, which is the point of having one.
_Avoid_: "token" in user-facing copy, "login" as a noun for it, "sessão" for the
`ApiEnvelope` cache window (a different thing entirely).

**Privacidade**:
The public notice at `/privacidade`: what the app stores about someone with a
**Conta**, why, who else sees it, and how to delete it. Rendered by
`PrivacyView` and written to be true of this build rather than legally
decorative — every claim in it is checkable against `account-store.ts`, so a new
column there makes this page wrong until it is edited.
**Indexable, unlike `/conta` and `/entrar`**, which are `PRIVATE` in
`pageStatus`. A notice only a signed-in reader can find is not a notice: the
point is to be readable *before* deciding, and Google's consent screen links to
it from outside this site entirely. It is in the sitemap for the same reason the
rounds are — the only links to it are on two pages a crawler is told not to
fetch.
_Avoid_: "política de privacidade" as the label (longer, and the page is not a
policy document), "termos" (there are none, and inventing them would be a
promise nobody is keeping), "LGPD" in the copy — the law is why the page exists,
not what a reader came to read.
