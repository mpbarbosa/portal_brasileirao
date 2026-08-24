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
`/clube/<code>`, so it is shareable and Back returns to the table.

**Forma**:
The last five *finished* results from one club's point of view, oldest first:
`V` vitória, `E` empate, `D` derrota. Only finished matches count, so a postponed
fixture mid-run does not punch a hole in the guide, and a live match never
appears — consistent with **Conta para a classificação**.
_Avoid_: "W/D/L" (English initials), counting a live scoreline as a result.

**Rota**:
The URL is the source of truth for which section is showing: `/` classificação,
`/jogos` (current round) or `/jogos/N`, `/artilharia`, `/clube/<code>`. Parsing
and formatting live in `route-core.ts` as total functions — an unrecognised path
or a nonsense round degrades to something useful rather than erroring, because a
stale link should still land somewhere. `useRoute` only binds them to the History
API.
_Avoid_: keeping section state in `App` alongside the URL (they drift), a route
that 404s, adding a router dependency for four routes.

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
