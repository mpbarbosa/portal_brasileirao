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

**And no match clock**, which that field list is also the evidence for: there is
no elapsed minute and no period. `lastUpdated` is when the record changed, not a
position in the match, and `status` collapses half-time into `PAUSED` — which the
adapter maps to `LIVE`. This is the assumption `live-core.ts` refuses to compute a
match minute on, and it holds. See **API Futebol** below, which carries a phase
and still no clock. **No other entry in this file has been asked the question** —
Sportmonks in particular is a full commercial feed and was surveyed for
broadcasters alone, so its silence here is an absence of evidence.

Other limits worth remembering: no player photos anywhere (see **Player
photographs** below for where they do exist, and why they are still not used);
squad entries carry only `name`, `position`, `nationality`, `dateOfBirth`; Série
B is TIER_THREE and Série C/D are TIER_FOUR with data frozen at 2020.

## Evaluated and rejected

### API Futebol — no broadcast data, and that was the only question it was asked

**Read the scope before reading the verdict.** This entry sits under *Evaluated
and rejected* and the rejection is real, but it answers exactly one question —
*does it carry broadcast data?* — because that is what sent us here in August. It
does not. It is **not** an assessment of the source as a whole, and the paragraph
below saying it "would otherwise be a good fit" is the load-bearing half. Re-read
2026-08-30 against the live API rather than the spec, and everything from
**What it carries that football-data does not** onward is from that pass.

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
to a browser. The whole reference is published for machines at
`https://www.api-futebol.com.br/ai.md` (~90 KB, every endpoint with real response
samples), which is the cheapest way to read it.

#### What it carries that football-data does not

Written down because the broadcast answer above is read as *nothing here*, and
three of these are things this app currently hand-maintains or does without:

- **`estadio: {estadio_id, nome_popular}` on every fixture.** `venue-core.ts`
  opens by stating that a stadium is not an entity in any payload and that
  identity therefore has to be the slug of CBF's `Stadium - City - UF` string.
  For this provider that sentence is false — there is a stable numeric id. It
  still carries **no city, UF, capacity or year**, so `src/data/stadiums.ts` and
  the CBF venue sweep are unaffected.
- **Match detail**: posse de bola, finalizações, passes, desarmes, escanteios,
  faltas; gols; substituições; cartões; and `escalacoes` with `esquema_tatico`,
  técnico, titulares/reservas, `posicao` **and `camisa`** — the shirt number
  CLAUDE.md records football-data as carrying for nobody in the division.
- **Table extras**: `ultimos_jogos`, `variacao_posicao`, and
  `faixa_classificacao` (`libertadores`, `rebaixamento`, …), which we compute.
- **Séries B, C and D, the estaduais, feminino and sub-20**, all live for 2026 —
  where football-data's free tier is Série A only and freezes C/D at 2020.

And what it does **not** have, beyond broadcasts — checked against the same
spec and by the same method, so it carries the same weight as the finding above.
Zero occurrences of `arbitr`, `juiz` or `referee`, and zero of `elenco`, `squad`
or `plantel`, across all 17 paths:

- **No árbitro**, so `partida` pages gain no official from this source.
- **No squad endpoint at all.** Lineups exist per match; an *elenco* does not, so
  the Jogadores page cannot be built from it.
- `/atletas/{id}` returns only `{atleta_id, nome, nome_popular, posicao}` — **no
  date of birth and no nationality**. That one is a regression rather than a gap:
  every curated player file here was built by joining on exact date of birth, and
  none of that evidence exists on this side.

#### The match clock: a phase, yes; an elapsed minute, no

Asked separately because `live-core.ts` opens by refusing to compute a match
minute, on the grounds that the provider reports a status and a score and never
an elapsed clock. Its own wording for what a page should say instead is *bola
rolando*; what the chip actually renders is `Ao vivo`. Whether any other feed
carries a clock had never been asked here — before this paragraph the whole of
this file said nothing about them.

**The two live endpoints carry neither a clock nor a phase.** `/ao-vivo` and
`/times/{id}/partidas/ao-vivo` return fifteen fields, listed in full so the count
is checkable rather than asserted:

```
partida_id, campeonato, placar, placar_mandante, placar_visitante,
time_mandante, time_visitante, disputa_penalti, status, slug,
data_realizacao, hora_realizacao, data_realizacao_iso, estadio, _link
```

Their description promises *placar em tempo real*: it is the **score** that is
real-time, not a position in the match. So the endpoint whose whole purpose is
live football is exactly the one with nothing to say about where the match is.

**`/partidas/{id}` carries `periodo`, and that is a phase rather than a minute.**
The only top-level value in their samples is `"fim-de-jogo"`; event-level
`periodo_slug` shows `primeiro-tempo`, `segundo-tempo` and `intervalo`. The
schema is a bare `{"type": "string"}` with no enum and no description, so the
vocabulary is undocumented — and every sample is of a **finished** match, which
means what this field says *during* one is not established by anything read here.

**`minuto` exists only on events**, never on the match: on gols, cartões and
substituições, as `"MM:SS"` measured within the period. It runs past 45 —
`"51:52"` in the 2º tempo — so it counts stoppage rather than capping, and it is
nullable, a card shown at `intervalo` having none. These are retrospective stamps
on things that happened, not a running clock.

**What that would and would not buy.** `live-core.ts`'s objection is specifically
that minutes-since-kickoff stops being the true minute at half-time and drifts
from there, and `periodo` is precisely the field that separates *intervalo* from
*bola rolando* — so it fixes the half of the problem the module names, and the
board could stop being silent about half-time. It still cannot produce `73'`,
because nothing here counts. Note football-data already distinguishes this and
the adapter throws it away: upstream `PAUSED` means half-time and
`football-data-core.ts` maps it to `LIVE`, which is right for a status vocabulary
the app renders as one chip and is not a reason to go looking elsewhere first.

**Read from the OpenAPI spec and `ai.md`, not from a live payload**, which is
below the standard the top of this file sets. There is no key here to do better
with: unauthenticated `/ao-vivo` answers **401** `Autenticação necessária`, and
the `test_` key is per-account through `/me`, which the plans section below
records as 401 on an unfunded account. Settling `periodo`'s real vocabulary needs
a funded key **and** a match in progress, since the documented samples cannot
show what a live one says.

#### The join is the risk, and the free tier structurally cannot test it

Every id in this app is football-data's. Their `partida_id` 27650 is not our
554977; their `time_id` 56 is not our club id. So anything of theirs rendered on
a page we already serve needs a fixture-to-fixture and club-to-club
reconciliation — the same join that **fails silently on TLA** for caRtola, two
sections below.

Their `test_` key is free and unmetered but returns **fictitious data by
design**, so it validates response *shape* and can never validate that join.
Only a funded `live_` key can. That is worth knowing before anyone writes an
adapter expecting to prove the integration cheaply first.

#### Plans, and what an unfunded key does

Flexível is **R$99 per campeonato per month**; Profissional R$599 for ten
campeonatos and **2.000 requests/day**; Elite R$999 for twenty and 5.000/day.
Note the limits are **per day**, resetting midnight UTC-3 — not football-data's
10/minute, so `cache-core.ts`'s reasoning does not carry over unexamined.

**An account with no plan is 401 on every route, including `/me`, so it cannot
ask what its plan is.** Measured against a real unfunded account. The status code
is useless for telling the cases apart and only the body distinguishes them —
established with two deliberate controls rather than inferred:

| request | body (all **401**) |
| --- | --- |
| real key, no entitlement | `Este campeonato não faz parte do seu plano…` |
| unknown key | `Credenciais Inválidas.` |
| no `Authorization` header *(control)* | `Autenticação necessária` |
| invented key *(control)* | `Credenciais Inválidas.` |

Two defects in their own documentation, both found by calling it rather than
reading it:

- `ai.md` documents the error envelope as `{codigo, mensagem}`; the live API
  sends **`{code, message}`**, at every route tried. An adapter narrowing the
  documented Portuguese keys reads every error as empty.
- Their test-environment page says the `test_` key can be read back from
  `GET /me`. Not on an unfunded account, per the row above.

#### What would have to be true to adopt it

A funded `live_` key, and a reconciliation against our football-data fixtures
that is demonstrated rather than assumed. The natural first target is the
stadium id — smallest surface, exercises the club join for real, and replaces a
documented weak point instead of adding one. Like `sync-broadcasts`, it belongs
on the **workstation-sync** side of the line rather than as a request-time
dependency.

### Sportmonks — has it, but paid

The only provider confirmed to carry broadcast data: a `tv-stations` endpoint, a
`tvStations` include on any fixture, broadcaster logos, and a `countries` include
for filtering to Brazil. Not adopted on cost grounds.

### caRtola — player scouts only, no fixtures, and a week behind

`github.com/henriquepgomide/caRtola`, MIT. Cartola FC — the fantasy game — 2014
to 2026, as per-round CSVs. Checked 2026-08-30, at which point it was the only
free Brazil-focused source found carrying a **2026** directory, which is what
makes it look promising and is the reason it is written up rather than skipped.

**It carries no fixtures at all.** The unit is a *player-round*: 18 `atletas.*`
columns and 20 Cartola scout codes.

```
atletas.apelido, atletas.apelido_abreviado, atletas.atleta_id,
atletas.clube.id.full.name, atletas.clube_id, atletas.craque,
atletas.entrou_em_campo, atletas.foto, atletas.jogos_num, atletas.media_num,
atletas.nome, atletas.pontos_num, atletas.posicao_id, atletas.preco_num,
atletas.rodada_id, atletas.slug, atletas.status_id, atletas.variacao_num,
A, CA, CV, DE, DP, DS, FC, FD, FF, FS, FT, G, GC, GS, I, PC, PP, PS, SG, V
```

No home/away, no fixture id, no kickoff, no scoreline, no status — so it cannot
answer *what was the result* or *has this match finished*, which is the question
that sent us here. Only `data/01_raw/` is populated; `02_intermediate` through
`08_reporting` are each a bare `.gitkeep`.

**It is also behind the live round, structurally rather than incidentally.**
`data/01_raw/2026/` stopped at `rodada-24.csv` while round 25 was being played —
`rodada-25.csv` was a **404**. Data commits run roughly weekly (2026-08-26,
08-19, 08-11, 07-31, 07-28), so it is a post-hoc dataset. Even with the
right fields it would belong on the workstation-sync side of the line, like
CBF's Onde Assistir API — see **How broadcast data actually reaches the app**
below, where the rule is that production only ever reads a committed file.

**What it can do, and it is worth knowing.** `G` is **cumulative season goals**,
not per-round, so differencing two consecutive snapshots yields a round's goals
per club. Run over `rodada-24` minus `rodada-23` against `/api/matches?round=24`,
all **10 of 10** fixtures agreed with football-data. That makes caRtola usable as
an occasional **offline audit** of the provider's history — never as a source the
app reads.

#### The join is the trap, and it fails silently

**Do not join football-data to caRtola on `tla`.** The first attempt produced a
literal `COR 2-1 COR` row and a confident **5 of 10 "the sources disagree"**.
Nothing errored; the number simply looked like a finding. That is the
Corinthians/Coritiba collision `CLAUDE.md` already records under *Club identity
is the upstream numeric id, never `tla`* — met here from the outside, against a
second dataset. Re-joined on club name, the same comparison gave 10/10.

The two vocabularies are genuinely different beyond that collision, so there is
no shortcut: São Paulo is `PAU` upstream and `SAO` in caRtola, Grêmio `FBP` and
`GRE`, Internacional `SCI` and `INT`, Clube do Remo `CRE` and `REM`. Build the
map by hand, and treat an unmapped code as an error rather than as a zero — an
absent key differences to `undefined`, which is what dressed the failure up as a
disagreement instead of a crash.

#### The two fields that look useful for the curated player files

Both are **rejected**, and for different reasons:

- **`atletas.foto`** is a Globo CDN address. The repository's MIT licence covers
  its own code and data compilation, not third-party photographs it links to, so
  this clears none of the `credit`/`license`/`licenseUrl` bar that makes the
  Commons files in `player-photos.ts` usable — see **Copyright** under *Player
  photographs* below for the standard, which this has not been assessed against
  and does not obviously meet.
- **`atletas.apelido`** is the popular name, and **`atletas.posicao_id`** a
  position — the two fields `player-overrides.ts` curates. Neither qualifies as a
  source for it. The `name` rule is deliberately narrow (correct only where the
  recorded value is *not a name*), so a nickname here is not a licence to
  rename; and `position` carries a two-source bar naming the club's own squad
  section and an article's stated role, which a fantasy-game classification is
  not.

### ge.globo.com / SDE — the classificação everyone reads, and why it fills neither curated file

Traced 2026-08-30. `ge.globo.com/futebol/brasileirao-serie-a/` performs **no
client-side request for its table**: of 250 subresources, `s.sde.globo.com` is a
media CDN (crests, player photos) and the rest is auth, ads and analytics. The
table is server-rendered into `<script id="scriptReact">` as
`const classificacao = {…}`, beside `const listaJogos` and
`const fase = {slug: "fase-unica-campeonato-brasileiro-2026"}`.

The renderer's own source is reachable and unauthenticated. `contentResource.tUUID`
in that same script is the **tabela id**:

```sh
curl 'https://api.globoesporte.globo.com/tabela/d1a37fa4-e948-43a6-ba53-ab24ab3a45b1/classificacao/'
```

200, ~18 KB, no token, `cache-control: max-age=60`. It carries the 20 rows, the
current round's `lista_jogos`, `rodada: {atual, ultima}` and the
`faixas_classificacao` colours. The whole season is
`/tabela/{tUUID}/fase/{fase-slug}/rodada/{n}/jogos/`, n = 1..38. To find the
`tUUID` for another competition, read `contentResource` out of its ge page.

Two access facts worth knowing before building on it: there is **no
`Access-Control-Allow-Origin`**, so it is server-side only; and **`?rodada=` is
ignored** — tested at 20 and 24, both returned the current round.

**Rejected for `venues.ts` and `broadcasts.ts`**, for three independent reasons:

- **No broadcasters at all.** `transmissao` looks promising and is not: it is a
  CTA state for ge's own UI — `ENCERRADA`, `LIVE`, `PRE_DIA`, `REAL_TIME` — plus
  a link to ge's match page. All 380 fixtures of the season were pulled and
  grepped for `premiere`, `sportv`, `cazé`, `youtube`, `amazon`, `record`,
  `canal`, `emissora`: zero hits.
- **No city or state.** `sede` is `{nome_popular}` and nothing more, where
  `Venue` requires all three. Five per-match endpoint shapes were probed for a
  richer venue object; all 500. Also only 259 of 380 fixtures carry a `sede` —
  rounds 27–38 have none yet.
- **A second stadium vocabulary through the same normaliser**, which is the one
  that would have done real damage. `venue-core.ts` uses the slug of the stadium
  string as stadium *identity*, and ge disagrees with CBF on 5 of 19 grounds:
  `arena-fonte-nova`/`casa-de-apostas-arena-fonte-nova`,
  `nilton-santos`/`nilton-santos-engenhao`, `morumbi`/`morumbis`,
  `manoel-barradas`/`barradao`, `jose-maria-de-campos-maia`/`maiao`. Mixing the
  two splits five estádio pages in two, silently, with nothing going red.

The join itself was never the problem and is worth recording as cheap if this is
ever revisited: `joinMatch` and `matchClub` in `broadcast-core.ts` already do it,
and of ge's 20 club names 18 match on exact slug, `Vasco` by prefix, and `Remo`
by the alias that is already there.

**It counts in-progress matches**, like football-data and unlike
`computeStandings` — see the CBF standings page below, where that was measured.

## CBF's own systems

Both are **publicly readable but internal**. Public-readable is not a licence to
reuse: CBF's Termos de uso govern, and neither surface carries any stability
guarantee. Treated as reference, not as a dependency.

### Broken TLS chain — affects the two main CBF hosts

`www.cbf.com.br` and `cms.cbf.com.br` both serve a valid Sectigo certificate
whose **issuing intermediate is not in the chain they present**, so a chain
cannot be built and `curl` exits **60**:

```
SSL certificate problem: unable to get local issuer certificate
```

**It is not an empty chain, and that is the part that misleads.** Measured on
2026-08-30, `www.cbf.com.br` presents **four** certificates — so any check that
merely counts them, or eyeballs `-showcerts` for content, reports the chain as
healthy. Three of the four are an older, unrelated Sectigo path left over from a
previous certificate, and the one that actually signed the leaf is absent:

```
[0] subject *.cbf.com.br
    issuer  Sectigo Public Server Authentication CA OV R36   <- not sent
[1] AAA Certificate Services                     (self-signed)
[2] Sectigo RSA Organization Validation Secure Server CA
[3] USERTrust RSA Certification Authority
```

Browsers hide this by fetching the issuer via AIA; `curl` does not. Any
automated client against either host needs special TLS handling — in this repo
that is `scripts/cbf-api.ts`, which reads the AIA `CA Issuers` URI off the leaf
and completes the chain itself. This is their misconfiguration, not ours.

**To reach either host from a shell**, complete the chain once and reuse the
bundle. Verified end to end, `ssl_verify=0`, no `-k`:

```sh
curl -s http://crt.sectigo.com/SectigoPublicServerAuthenticationCAOVR36.crt \
  | openssl x509 -inform DER -out /tmp/cbf-inter.pem
cat /tmp/cbf-inter.pem /etc/ssl/certs/ca-certificates.crt > /tmp/cbf-bundle.pem
curl --cacert /tmp/cbf-bundle.pem https://www.cbf.com.br/...
```

Do not reach for `-k` instead. It works, and it turns off the check on the one
host in this document whose certificate is the only thing distinguishing it from
an impostor — on a request whose response is then written into committed data.
The intermediate URI is read off the leaf rather than hard-coded here, because
it changes when CBF renews; `openssl x509 -noout -text` on the leaf prints the
current one under `Authority Information Access`.

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

### `www.cbf.com.br/api/cbf/jogos/{id_jogo}` — the match API: goal events, and the escalações

The endpoint behind CBF's own match page, and the **only reachable source of who
scored a goal**. It is also the only reachable source of an **escalação**, and
both are read by the same `sync-goals` run — one request per match, which matters
against a host that throttles at the socket.

**`atletas` and `alteracoes` are nested under `mandante` and `visitante`**, as
the example below shows and as prose summarising this endpoint has been known to
omit. A probe looking for them at the top level of `jogo` finds `undefined` and
reads as "the data is gone".

Three things about `atletas` that only appear when you parse it: 23 a side with
exactly 11 whose `reserva` is `"false"`; **the booleans are strings**, so a
truthiness check reports nobody as a starter; and `apelido` carries a zero-padded
shirt number welded to the front (`"01 - Carlos"`) in a different format from the
`numero_camisa` beside it. `escalacao-core.ts` handles all three and
`CLAUDE.md` records why each is a trap rather than a quirk. Same host as the broadcast API above, so the same broken
certificate chain and the same Termos de uso apply.

```
/api/cbf/jogos/832123
```

```json
{ "jogo": { "id_jogo": "832123", "rodada": "24", "local": "Nubank Parque  - Sao Paulo - SP",
    "mandante": { "id": "20002", "nome": "Palmeiras", "gols": "4", "atletas": [ … ], "alteracoes": [ … ] },
    "visitante": { "id": "60646", "nome": "Vasco da Gama Saf", "gols": "1", … },
    "registros": [
      { "tipo": "GOL", "resultado": "NR", "clube_id": "20002",
        "atleta_nome": "Jose Manuel Alberto Lopez", "atleta_apelido": "Lopez",
        "atleta_camisa": "42", "atleta_id": "773040", "tempo_jogo": "2", "minutos": "01:00" },
      { "tipo": "PENALIDADE", "resultado": "AMARELO", "clube_id": "60646", … } ],
    "arbitros": [ { "nome": "Braulio da Silva Machado", "funcao": "Arbitro", "uf": "SC" }, … ],
    "documentos": [ { "url": "https://conteudo.cbf.com.br/sumulas/2026/142234se.pdf", "title": "Súmula" } ] } }
```

**This is the fact that overturns a decision recorded elsewhere in this repo.**
`docs/roadmap.md` listed "lance a lance, escalações and match statistics" under
*Explicitly not doing*, and `docs/brasileirao-pro-proposal.md` §1 gives the
reason: a football-data match object carries no events, no lineups, "at any tier
this app can reach". That is **correct about football-data** — re-verified while
writing this, against a live BSA match *and* a live Premier League one, both free
TIER_ONE, both answering 200 with no `goals` key at all — and it was generalised
to every reachable source. CBF was surveyed for the broadcast page and not past
it. `registros` carries goals and cards, `atletas` carries both starting elevens
with `reserva`/`entrou_jogando`, and `alteracoes` carries substitutions.

So the proposal's own condition — *"do not build these until a provider that
carries them is adopted, which is a cost decision"* — turns out to be satisfiable
without spending anything, because the provider was already adopted.

What is used today is **goals only**, via `scripts/sync-goals.ts` into
`src/data/goals.ts`. Lineups, substitutions and the súmula are recorded here as
available, not as planned: the proposal's UI reasoning about them is untouched by
this and still stands on its own.

Three things to know before using it.

**`id_jogo` is CBF's id**, unrelated to football-data's, exactly as for the
broadcast API — so the same join on kickoff instant plus home club is required,
and `joinMatch` in `broadcast-core.ts` already performs it.

**The `resultado` vocabulary is complete, and CBF documents it itself — in the
súmula rather than in the API.** Every match report prints the legend at the foot
of its Gols table:

```
NR = Normal | PN = Pênalti | CT = Contra | FT = Falta
```

`AMARELO` appears on `PENALIDADE` rows, which are cards sharing the same array.

**`CT` is the one that changes meaning rather than wording, and CBF files it
under the club of the player who scored it** — so an own goal counts for the
*other* side. Measured, not inferred: Grêmio **2x0** Vitória is listed as a `CT`
by Camutanga, a Vitória player, plus one Grêmio goal, which counts 1x1 against
the reported 2x0 until the attribution is flipped. `goalsFromRegistros` performs
that flip; `FT` and `PN` count normally.

This was found the hard way and is the argument for the closed vocabulary. The
first build shipped knowing only `NR` and `PN`, and the first season-wide sync
**refused 25 matches** — 16 `CT`, 9 `FT` — rather than filing them wrong. Had
unknown codes defaulted to "ordinary", all 16 own goals would have been credited
to the wrong club, with the page looking entirely plausible. `sync-goals.ts`
still refuses any `resultado` it does not recognise, and reconciles every match
against both CBF's scoreline and ours before writing.

**One case remains undetectable from this API**, and it is worth knowing before
trusting the reconciliation as complete: an own goal filed under the club it
**counts for** and marked `NR` would balance perfectly and be recorded with an
opposing player as that club's scorer. All 16 `CT` matches reconciled once the
flip was in place, so CBF was consistent everywhere it could be checked — that is
evidence, not proof. The **súmula** is the only source that could settle it,
since its Gols table carries both a `Tipo` and the `Equipe` a goal counted for,
where `registros` carries the type alone.

**The súmula is reachable while `www` is not**, which is what made the legend
obtainable during a ban: it is served from `conteudo.cbf.com.br`, a different
edge. Its URL is **not derivable from `id_jogo`** — for `id_jogo=832123` the
report is `sumulas/2026/142234se.pdf` — so take it from the `documentos` array
in the match payload, where it arrives titled `Súmula`. `pdftotext -layout`
reads it.

**`tempo_jogo` and `minutos` are not safe to read as a match minute**, and the
goals are deliberately shipped **without one**. The two fields use different
vocabularies for different event types in the same array — every `GOL` in the
captured payload carries `tempo_jogo: "2"` while the cards carry `"TN1"`/`"TN2"`
— and `minutos` is `mm:ss` with no half attached. Guessing produces a page that
says "10'" for a goal scored at 55 minutes, which is the failure `live-core.ts`
was written to avoid, one surface larger. Establish what those fields mean before
printing a minute.

**It throttles, and it does so at the socket.** Fetching a few hundred match
payloads back to back — roughly one every 250ms — got this host to stop
completing TLS altogether: every subsequent connection failed with `ECONNRESET`
*before* the handshake, and plain `curl` was refused the same way for some
minutes afterwards. There is no 429 and no `Retry-After` to read, so a block is
indistinguishable from the host being down. Pace a sync at about one request a
second and expect a season to take minutes.

### `www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-a/{year}` — the standings page

Traced 2026-08-30. Next.js App Router, server-rendered: the table is inlined in
the RSC flight payload (`self.__next_f.push`), and **no `/api/cbf/` endpoint
serves it** — the namespace was probed with eight plausible names and every one
returned the 404 shell. The fetch happens server-side, so the endpoint never
reaches the client bundle; all 44 chunks were downloaded and searched for
`/api/cbf/` with no hits.

The payload is fetchable over the RSC protocol rather than by parsing 222 KB of
HTML:

```sh
curl --cacert /tmp/cbf-bundle.pem -H 'RSC: 1' \
  'https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-a/2026'
```

`text/x-component`, 62 KB, against 222 KB for the HTML. The `--cacert` is not
optional and not decoration: this is one of the two hosts with the broken chain
above, a bare `curl` exits 60, and `/tmp/cbf-bundle.pem` is what that section
builds. From code, use `scripts/cbf-api.ts` instead. 2023, 2024 and 2025 all serve a table; 2027 is
empty. `?rodada=` is ignored, exactly as on ge.

**Its schema is richer than ge's**, and one field is the interesting one:

```
cod_time uf_time time escudo evolucao posicao pontos jogos vitorias empates
derrotas gols_pro gols_contra gols_saldo cartoes_vermelho cartoes_amarelo
aproveitamento rodada ultimos_jogos proximo_jogo
```

`cartoes_amarelo` and `cartoes_vermelho` are **the cards the CBF tie-break
chain needs** and that `standings-core.ts` says the app does not carry — the
reason `compareRows` stops after goals scored and falls back to club name. This
is where that data exists, should anyone want to close it. Note `cod_time` is a
**third club id space** (Palmeiras is `20002` here, `275` at ge, `1769` at
football-data); do not key anything on it without a join.

**And it excludes in-progress matches, which ge and football-data do not.**
Measured rather than reasoned: on 2026-08-30 the two tables disagreed on exactly
four clubs, each by +1 point and +1 game — Palmeiras 51/24 against 52/25, Grêmio
25/23 against 26/24, Mirassol 24/23 against 25/24, Chapecoense 14/23 against
15/24. ge's own fixture list at that instant showed `MIR 0x0 PAL` as
`REAL_TIME` and `GRE 0x0 CHA` as `LIVE`: two live goalless draws, four clubs,
one point each. The other sixteen rows agreed exactly.

So **CBF's published table follows the same rule `computeStandings` does** —
the league table moves on the final whistle. That is independent corroboration
of a choice CLAUDE.md flags as a deliberate difference from football-data, and
it is worth having written down before somebody reads the live/fallback gap as a
bug and "fixes" it by counting live matches.

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
