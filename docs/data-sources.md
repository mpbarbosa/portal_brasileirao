# Data sources

What each candidate source actually provides, established by inspecting real
payloads and specs rather than documentation claims. Written 2026-08-24.

## In use

### football-data.org — the app's provider

Competition `BSA` (id 2013) sits on the free **TIER_ONE** plan. Endpoints used:
`/standings`, `/matches`, `/scorers`, `/teams/{id}`, `/persons/{id}`.

**Has no broadcast data at any tier.** A match object carries exactly:

```
area, competition, season, id, utcDate, status, matchday, stage, group,
lastUpdated, homeTeam, awayTeam, score, odds, referees
```

No channel, TV, stream or broadcaster field. Verified against a live payload.

Other limits worth remembering: no player photos anywhere; squad entries carry
only `name`, `position`, `nationality`, `dateOfBirth`; Série B is TIER_THREE and
Série C/D are TIER_FOUR with data frozen at 2020.

## Evaluated and rejected

### API Futebol — no broadcast data

Brazil-focused, pt-BR domain terms, would otherwise be a good fit. Checked its
**OpenAPI 3.1 spec** (`https://www.api-futebol.com.br/api-futebol.openapi.json`,
301 KB, generated from the same source as its docs), not just the docs pages.

Across all 17 endpoints there are **zero** occurrences of `transmiss`, `canal`,
`canais`, `onde assistir`, `emissora`, `tv`, `streaming`, or any Brazilian
broadcaster name.

Its surface: `/ao-vivo`, `/atletas/{id}`, `/campeonatos[/{id}]`,
`/campeonatos/{id}/{artilharia,fases,partidas,rodadas,tabela}`, `/me`,
`/partidas/{id}`, `/times/{id}[/partidas/{anteriores,ao-vivo,proximas}]`.

Note their docs and pricing pages return **403 to WebFetch** but 200 to curl and
to a browser.

### Sportmonks — has it, but paid

The only provider confirmed to carry broadcast data: a `tv-stations` endpoint, a
`tvStations` include on any fixture, broadcaster logos, and a `countries` include
for filtering to Brazil. Not adopted on cost grounds.

## CBF's own systems

Both are **publicly readable but internal**. Public-readable is not a licence to
reuse: CBF's Termos de uso govern, and neither surface carries any stability
guarantee. Treated as reference, not as a dependency.

### Broken TLS chain — affects every CBF host

`www.cbf.com.br` and `cms.cbf.com.br` both serve a valid Sectigo certificate but
**omit the intermediate**, so a chain cannot be built:

```
verify error:num=21:unable to verify the first certificate
```

Browsers hide this by fetching the intermediate via AIA; `curl` fails outright.
Any automated client against a CBF host needs special TLS handling. This is their
misconfiguration, not ours.

### `www.cbf.com.br/futebol-brasileiro/onde-assistir`

The broadcast page. A client-rendered Next.js app with a date-range filter
(`Intervalo`) and a competition filter, listing:

```
Confronto | Onde assistir | Horário | Campeonato | Categoria | Estádio
```

across **all** CBF competitions — Série A, Série B, women's, youth — so any use
needs a `Categoria` filter.

Reading it programmatically is impractical: no server-side HTML, the only request
observed on load is `/api/auth/validation-token`, and scraping would mean a
headless browser per poll. A first read of the DOM showed empty rows; the table
does populate — the read was simply too early and the date filter untouched.

### `www.cbf.com.br/api/cbf/onde-assistir/jogos` — the broadcast API

The endpoint behind the Onde Assistir page. Clean, paginated JSON:

```
/api/cbf/onde-assistir/jogos?dataInicio=2026-08-24&dataTermino=2026-08-24
```

```json
{ "jogos": [ { "id_jogo": "832121", "num_jogo": "238", "rodada": "24",
      "grupo": "GRUPO ÚNICO", "local": "Nilton Santos - Rio de Janeiro - RJ",
      "data": "24/08/2026", "hora": "20:00",
      "mandante": { "id": "…", "nome": "Botafogo", "url_escudo": "…", "gols": null },
      "visitante": { "nome": "Athletico Paranaense" },
      "transmissoes": [ { "nome": "Premiere", "logo": "" },
                        { "nome": "Sportv",   "logo": "" } ],
      "competicao": { "campeonato_id": "42", "campeonato_nome": "Campeonato Brasileiro",
                      "categoria_id": "1", "categoria_nome": "Série A" } } ],
  "meta": { "current_page": 1, "per_page": 15, "total": "4", "last_page": 1 } }
```

Useful properties: `categoria_id` selects the division cleanly (`1` Série A, `2`
Série B, `96` women's Sub-17); `transmissoes` is already an array; date range and
pagination are parameters.

Two things it does **not** solve. `id_jogo` is CBF's own id, unrelated to
football-data's, and club names differ (`Athletico Paranaense` vs `Athletico-PR`)
— so a join on kickoff instant plus home club is still required. And
`transmissoes` sometimes holds a combined string in one entry
(`"ESPN / Disney+"`), so the separator inconsistency lives in their data, not
just their rendering.

**Undocumented and internal.** No versioning, no stability guarantee, governed by
CBF's Termos de uso, and reachable only past the broken TLS chain above. If it is
ever used, use it from a **local sync script that writes `broadcasts.ts`**, the
way `sync-seed-data.ts` works — never as a request-time dependency of production.

### `cms.cbf.com.br/api/paginas` — Strapi v4, news only

A public Strapi v4 REST API, no auth, full query syntax (`fields`, `populate`,
`filters`, `sort`, `pagination`). Example:

```
/api/paginas?fields[0]=Titulo&populate[Area][fields][0]=Slug
  &filters[$or][0][Area][Slug][$eq]=futebol-brasileiro&pagination[pageSize]=3
```

Returns `{ data: [{ id, attributes: { publishedAt, Slug, Headline, publish_at,
Titulo, Sumary, Area, Categoria } }], meta: { pagination } }` —
**34,815 entries** across 11,605 pages.

This is **editorial content**: headlines, summaries, cover images, filed under an
`Area` (e.g. Futebol Brasileiro) and a `Categoria` (e.g. Sub-20). It contains no
fixtures and no channels, so it does not solve the broadcast problem. Recorded
because it is the only structured, openly readable CBF API found, and would be
the place to look if CBF news were ever wanted.

## Club crests

Taken from `crest` on football-data's team objects — already in every payload we
fetch, so no extra request and no id mapping. Transparent PNG, 2-4 KB.

CBF also publishes crests at
`https://conteudo.cbf.com.br/clubes/<cbf_club_id>/escudo.jpg` (that host, unlike
`www` and `cms`, has a *valid* certificate chain). Not used: the images are ~30 KB
JPEGs, so ten times larger and without transparency, and they are keyed by CBF's
club ids, which the app does not store. The `www.cbf.com.br/_next/image?url=…`
form seen on their pages is their own Next.js optimiser and is unusable from
outside a browser anyway, since `www` serves the broken chain.

## Stadium photographs

No provider carries one. football-data has no venue field at any tier, so it has
no venue imagery either, and CBF's Onde Assistir feed stops at a
`Stadium - City - UF` string. CBF's site does show photos, but they are
all-rights-reserved and served from `www`, which has the broken chain described
above — unusable twice over.

So the pictures come from **Wikimedia Commons**, curated per ground in
`src/data/stadiums.ts` and fetched by the reader's browser at render time, the
same arrangement as the club crests above. What is stored is the **file title**
("ARENA MRV.jpg"), not a URL:

- `https://commons.wikimedia.org/wiki/Special:FilePath/<title>?width=<n>` is the
  documented way to reach a file by name. It 302s to the CDN and follows a
  rename. The direct `upload.wikimedia.org/.../thumb/b/b5/...` form embeds a hash
  of the filename, so it is unreadable, uncheckable by eye and dead on rename.
- `?width=` returns a thumbnail. The originals routinely run to eight megapixels;
  the page draws a strip at most 736 CSS pixels wide.
- `https://commons.wikimedia.org/wiki/File:<title>` is the description page, and
  the link the licences ask a reuser to point back at.

**Attribution is the constraint, not the bandwidth.** Every licence in the file
except one CC0 upload requires the photographer to be named wherever the image
appears, so `credit`, `license` and `licenseUrl` sit beside the filename and the
page renders all three. Where Commons publishes an explicit `Attribution` field
the photographer has dictated the wording — the Morumbi's is
`Arne Müseler / www.arne-mueseler.com` — and that wording is copied verbatim
rather than reduced to a name.

**Finding a photo is not the same as picking one.** The obvious automation is to
take the lead image of the ground's Wikipedia article, and it is wrong often
enough to be a trap: the Maracanã, the Mineirão and the Arena do Grêmio all lead
with the stadium's *logo*, and a well-titled Commons file for the Nilton Santos
turns out to be described as a journalist posing outside it. Every file in the
data was opened and looked at.

`npm run check-stadium-photos` re-asks Commons whether each file still exists,
still renders at the width the page requests, and still carries the credit and
licence recorded here. Like `check-hymns`, it prints the whole table rather than
only the failures, and it cannot tell you the photograph is of the right ground —
that part stays with whoever looks. Nothing runs it automatically: CI has no
network dependency on a third party by design.

## How broadcast data actually reaches the app

`scripts/sync-broadcasts.ts` reads CBF's Onde Assistir API on a workstation and
writes `src/data/broadcasts.ts`. Production only ever reads the committed file.

```sh
npm run sync-broadcasts                       # today
npm run sync-broadcasts 2026-08-30            # one day
npm run sync-broadcasts 2026-08-30 2026-09-15 # a range
npm run sync-broadcasts 2026-08-30 -- --replace
```

It merges by default, so hand-added entries survive and a narrow range tops the
file up. Transcribing from a screenshot is still supported.

Three things the script had to solve, each found by running it:

- **CBF's broken TLS chain.** It reads the `caIssuers` URI from the leaf
  certificate, downloads that intermediate and trusts it *alongside* the real
  roots — completing the chain CBF should have sent, rather than disabling
  verification.
- **Pagination.** CBF ignores `per_page` and serves 15 per page, so the script
  walks pages. A first-page-only read would have looked exactly like "no
  broadcast listed".
- **Club names.** Most resolve by slug or a prefix (`Santos FC`, `Coritiba SAF`),
  but four are structurally different and need the alias map in
  `broadcast-core.ts`: `Atlético Mineiro`, `Athletico Paranaense`, `Remo`,
  `Red Bull Bragantino`. An unresolvable name is reported loudly and skipped —
  never guessed, since a wrong join mislabels a match.

The join itself is kickoff instant plus home club, keyed by **our match id**.

### How far ahead the data exists

Two independent limits, both upstream, both confirmed on 2026-08-24:

- **CBF publishes broadcasts about two to three weeks out.** A sync of
  16–30 Sep returned Série B only; October and November returned *nothing at all*
  (0 fixtures, 0 pages). There is no season-long broadcast feed to fetch.
- **football-data leaves kickoff times provisional for later rounds.** Rounds
  1–26 carry 5–8 distinct kickoff times each; rounds 27–38 carry exactly one,
  `T00:00:00Z` — its marker for "date known, time to be confirmed".

So the season cannot be synced in one pass. Re-run the script every week or two
as CBF publishes; it merges, so repeated runs accumulate.

The second limit would break the join even once CBF publishes, since no instant
can match `T00:00:00Z`. `joinMatch` therefore falls back to calendar date plus
home club **only** for fixtures whose time is still provisional — a club plays at
most once a day. Confirmed fixtures are never matched by date alone, so a wrong
kickoff cannot quietly attach channels to the wrong match. See the header of that file for transcription rules, and the
**Onde assistir** entry in `CONTEXT.md` for the domain terms.

The key must not be a team abbreviation. A single day's CBF page showed `ATH` as
both Athletic Club (Série B) and Athletico-PR (Série A) — the same collision class
as Corinthians and Coritiba both reporting `COR` upstream.
