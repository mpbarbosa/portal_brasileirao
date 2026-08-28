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

Other limits worth remembering: no player photos anywhere (see **Player
photographs** below for where they do exist, and why they are still not used);
squad entries carry only `name`, `position`, `nationality`, `dateOfBirth`; Série
B is TIER_THREE and Série C/D are TIER_FOUR with data frozen at 2020.

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

### Broken TLS chain — affects the two main CBF hosts

`www.cbf.com.br` and `cms.cbf.com.br` both serve a valid Sectigo certificate but
**omit the intermediate**, so a chain cannot be built:

```
verify error:num=21:unable to verify the first certificate
```

Browsers hide this by fetching the intermediate via AIA; `curl` fails outright.
Any automated client against either host needs special TLS handling. This is
their misconfiguration, not ours.

**Two CBF hosts are exceptions and serve a complete chain**, which is worth
knowing before writing off a whole domain: `conteudo.cbf.com.br` (the crests,
below) and `bid.cbf.com.br` (the player photographs, below). Both are reachable
with a plain `curl`.

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
that part stays with whoever looks. **No build runs it**: CI has no network
dependency on a third party by design.

`.github/workflows/curated-data.yml` does run it, on the first of the month,
alongside `check-hymns`, `check-player-wikipedia` and `check-player-photos`. That
is not a contradiction of the sentence above — the job is **always green** and
reports into an *issue*, so a photograph that vanished from Commons overnight
becomes something a person reads rather than a red build on an unrelated commit.
`workflow_dispatch` exercises it without waiting for the first.

## Player photographs

**Photographs do ship, and none of them are CBF's.**
`src/data/player-photos.ts` carries 70, from **Wikimedia Commons**, vendored
into `public/players/` by `npm run sync-player-photos` — the same arrangement as
the stadium photographs above, with `credit`, `license` and `licenseUrl`
required on each. football-data has no player imagery at any tier, so every
player outside those 70 still draws initials.

CBF is the obvious place to look for the rest: it holds an official headshot of
**every** registered athlete and serves them without auth. This section records
what is there, and why it is still not used. Established 2026-08-25, so that the
search is not run a second time.

### `bid.cbf.com.br/foto-atleta/{atleta_id}` — the photo itself

The BID (Boletim Informativo Diário), CBF's registration bulletin, serves each
athlete's official posed headshot as a 160×200 JPEG of roughly 25 KB — the
player in his club's kit on a white ground. `bid` is one of the two CBF hosts
with a **valid certificate chain**, so plain `curl` reaches it where `www` and
`cms` need the handling described under **Broken TLS chain** above.

**An unknown id answers 200, not 404.** It serves a grey silhouette placeholder,
exactly 2,079 bytes every time, so a missing photograph is detected by comparing
the body — by size or hash — and never by the status code. Any sync script needs
that check written in from the start.

Coverage is effectively total: of 120 athletes sampled at random from the Série A
list below, 120 had a real photograph.

### `www.cbf.com.br/api/cbf/atletas/campeonato/{id}/pagina/{n}` — where the id comes from

The feed behind `/futebol-brasileiro/atletas`, found by watching that page's
network rather than from any documentation. Série A 2026 is campeonato
`1260611`; the response paginates 25 to a page (30 pages, 746 athletes) and each
row carries `atleta_id`, `atleta_nome`, `atleta_apelido` and the club's id, name
and crest. `atleta_id` is exactly the key `foto-atleta` takes.

**It also carries `atleta_cpf`, unmasked, for all 746.** That is personal data
under the LGPD and has no business in this repository. Whatever else is taken
from this feed, that field is dropped at the point of reading — not filtered out
later, and never written to disk.

### Joining it to our players

CBF's ids are its own, so a join is by name, the same problem the broadcast feed
has. All 20 clubs line up with `src/data/squads.ts`. A naive normalised match on
`atleta_apelido` and `atleta_nome` resolves **630 of 746 (84.5%)**; the residue
is two different things and only one of them is a matching failure. football-data
lists 948 squad entries against CBF's 746 *registered* athletes, so roughly 200
of ours have no CBF row at all — youth and reserve players who were never
inscribed. The genuine misses (`Thiago Silva`, `Walace`, `SOSA`) would need a
better matcher plus hand curation, the way `highlights.ts` is maintained.

### Copyright — the reason none of this ships

**The photographs are CBF's, all rights reserved, and no licence is offered.**
That is not an inference from silence: the BID's own footer, on the host serving
the images, reads *Confederação Brasileira de Futebol © Todos os direitos
reservados*. The response carries no licence header, the site links no licence
page, and there is no field naming a photographer or a permitted use — nothing
here resembles the `credit`/`license`/`licenseUrl` trio that makes the Commons
photographs in `player-photos.ts` and `stadiums.ts` usable.

**CBF's Termos de uso then forbid the reuse explicitly.** Under *Vedações* the
user may not "copiar, reproduzir e alterar, total ou parcialmente, qualquer
dado" from CBF's site. That reaches vendoring and hotlinking alike — vendoring
is the copy it names, and hotlinking republishes the image on our page just the
same.

So this differs in kind from the photographs that do ship, not in degree. On
Commons, attribution is a **condition** that reuse can satisfy — which is why
`credit` is required on both `PlayerPhoto` and `StadiumPhoto`, and why the card
drops the picture if the credit goes. Here attribution buys nothing, because
nothing was granted: naming CBF beneath the image would be a citation, not a
licence. Shipping these needs CBF's written permission, not a sync script — the
same conclusion **Stadium photographs** above reaches about CBF's own venue
imagery, and for the same reason.

**This is the tempting fix for the coverage gap, and it is the wrong one.** 70
of ~950 is thin, and CBF has all of them at uniform quality with no team
photographs to weed out — which is precisely why it is worth having written down
that the blocker is permission rather than effort.

The mechanics point the same way even setting copyright aside: the response
carries `Cache-Control: private, must-revalidate` and a `Set-Cookie` on every
request, so hotlinking would mean an uncached, cookie-setting third-party fetch
per avatar — the arrangement the broadcaster marks and the stadium photographs
were both vendored to avoid (`docs/roadmap.md` principle 4).

One further caveat if permission is ever obtained: **the photographs age**.
Pedro's is a Flamengo kit carrying 2022's sponsors. A registration photo is
retaken when CBF retakes it, not when a season turns.

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
