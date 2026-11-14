# Publicando um vídeo no YouTube

*Quando ler:* Leia antes de renderizar ou publicar mídia (`docs/medias/`, `scripts/manim/`, upload no YouTube).

Extraído do `CLAUDE.md`, que ficou um índice. Esta é a fonte canônica do assunto.

---

## Publicando um vídeo no YouTube

`npm run upload-video` põe um render no canal, com o título, a descrição e as
tags lidos do `-youtube.md` escrito ao lado dele. `youtube-upload-core.ts` tem a
judgement e é puro; `scripts/youtube-api.ts` tem o HTTP e nenhuma regra — a
divisão de `commons-core.ts` / `scripts/commons-api.ts`, pelo mesmo motivo. Roda
numa workstation e **nunca em produção**, como `sync-goals`.

```sh
npm run upload-video -- authorize               # uma vez, por projeto do Google
npm run upload-video -- velas-vitoria --dry-run # lê, mede e não envia nada
npm run upload-video -- velas-vitoria
npm run upload-video -- register <videoId>      # depois que ficar público
```

**O projeto no Google Cloud é OUTRO, e não o que serve o login.** A tela de
permissão OAuth é por projeto — uma lista de escopos, um estado de publicação —
e `oauth-core.ts` registra que os três escopos do login são não-sensíveis
justamente para que ela publique sem revisão. `youtube.upload` é sensível, então
acrescentá-lo ali não cria um escopo "do uploader": põe um escopo sensível no
mesmo app publicado pelo qual os leitores entram, e a verificação, o teto de 100
usuários e uma eventual auditoria do YouTube passam a pesar sobre ele. Um segundo
projeto é de graça.

**Não escreve `src/data/club-videos.ts`, e isso é o desenho.** Aquele arquivo
exige confirmar o id pelo oEmbed antes de gravá-lo, e diz por quê: um vídeo que
ainda não está público responde **403**, que é exatamente o estado de um render
recém-subido — ou seja, o id colado da página de upload é precisamente o que ele
recusa. `register` é o segundo passo e imprime uma entrada feita das strings do
próprio oEmbed. Ele para no arquivo porque cada entrada de lá carrega um
comentário à mão dizendo por que aquele vídeo é daquele clube, e um comentário
gerado seria enchimento no lugar de um motivo. Conferido: para `doMq2ELvtrc` a
entrada impressa sai **idêntica** à que já está commitada.

**As duas coisas que decidiam se valia automatizar foram medidas, e nenhuma
delas prende.**

A primeira era a auditoria: um projeto que não passou por ela teria os uploads da
API travados em privado, e o padrão daqui era `--privacy private` precisamente
porque ninguém havia tentado o contrário. Foi tentado em 2026-09-29 —
**`--privacy public` é honrado.** O vídeo responde oEmbed **200 com o próprio
título** na hora, contra **403** para um privado e **400** para um id inventado;
três braços, então o 200 é evidência e não um formato. Consequência prática: o
`register` roda na mesma sessão em vez de esperar dias por uma ação no Studio.
Note que um upload privado **não** é prova de bloqueio — o de 2026-09-25 ficou
privado porque pediram privado, e isso foi lido como auditoria por dois dias.

A segunda era o orçamento. Esta página dizia que `videos.insert` custa **1600**
das 10.000 unidades/dia e que **seis uploads é o orçamento inteiro**, e essa frase
pautou dois dias de trabalho em lotes de seis. Medido em 2026-09-30: **dezoito
uploads no mesmo dia de cota, sem um único `quotaExceeded`** — seis por volta das
02:00 PDT e doze entre 03:25 e 03:45. A 1600 cada, seriam 28.800 de 10.000.
**Qual das duas premissas está errada não foi estabelecido daqui:** o custo por
chamada pode ser menor, ou a cota deste projeto pode ser maior que a padrão, e só
a página de cotas do Cloud console separa as duas. O que está medido é que o teto
de seis não existe — então não pace um lote por causa dele; tente e leia a recusa,
que chega limpa quando chega.

**A cota zera à meia-noite do Pacífico**, e não no fuso de quem roda o script. Os
seis da manhã de 2026-09-30 e os doze de minutos depois caíram no mesmo dia de
cota, que é o que faz da medição acima uma medição e não duas.

**Sem `googleapis`.** São dezenas de megabytes e um cliente gerado para alcançar
dois endpoints, num repositório que não embarca nem dependência de UI e escreve
o próprio HCT à mão para não embarcar uma. O transporte é escrito aqui, como em
`cbf-api.ts` e `commons-api.ts`.

O refresh token mora **fora do repositório** — `~/.config/portal-brasileirao/
youtube.json`, ou `YOUTUBE_TOKEN_FILE` — porque este checkout é compartilhado e
um `git add -A` está a uma tecla de commitar uma credencial que sobe vídeo num
canal de verdade. Se a tela de permissão ficar em **Teste**, o refresh token
expira em **7 dias**; publicar o app (mesmo sem verificação) é o que o torna
duradouro.

**`tests/youtube-upload-core.test.ts` também é um portão sobre os arquivos
reais**: todo `docs/medias/**/*-youtube.md` precisa ser lido e passar nos limites
do YouTube. Um `-youtube.md` com título de 104 caracteres é um defeito que mais
nada aqui enxerga — o render está certo, o markdown está certo, e a recusa
chegaria no upload, à mão, meses depois. Seis mutações foram confirmadas
vermelhas nele; duas delas **passavam** na primeira versão dos testes, que é o
que essas duas fixtures existem para consertar.

`src/data/goals.ts` holds who scored in each match, keyed by **our** match id and
generated by `npm run sync-goals [from] [to]`, which reads CBF on a workstation —
production never calls it, exactly as for `broadcasts.ts`. Coverage is the played
2026 season: **184 matches, 504 goals** — 35 pênaltis, 17 contra, 10 de falta. Every entry has been
reconciled against its own scoreline, so **a missing match means "not synced, or
did not reconcile", never "goalless"**: a real 0-0 is deliberately absent rather
than an empty array, because the two would be indistinguishable in the file.

**That reconciliation is repeated at the merge, because the two files drift apart
between syncs.** `goals.ts` is read from CBF on demand while `src/data/matches.ts`
is a frozen snapshot regenerated on its own schedule, so a fixture played after
that snapshot was taken carries scorers while the committed record still calls it
SCHEDULED with no score at all. Measured on production 2026-08-30: for as long as
the provider was failing and `/api/matches` answered `source: "fallback"`, round
25's Atlético-MG × Vitória and São Paulo × Bragantino each shipped three scorers
under `homeGoals: null`. `withGoals` therefore re-checks `goalsReconcile` against
the scoreline in the payload it is building, and drops a list that does not
agree — in the one function both cache branches call, which is the rule
`withSquadOverrides` follows and for the same reason.

**It tests the scoreline and not the status, which is what makes it
self-clearing** and what lets it catch the case a status check cannot see: a
curated list left behind by a score the provider has since corrected. Nothing has
to be re-run — the moment the two agree again, the goals reappear. Regenerating
the seed would patch this for a day and drift again on the next `sync-goals`,
which is why the fix is in the merge rather than in the data. `MatchPage` keeps
its own `played` gate on top, now unreachable through `/api/matches` and retained
because the component is pure: a `Match` handed to it directly has passed no such
check, and `tests/e2e/goals.spec.ts` reaches it by fulfilling a modified payload.

**That sync is slow on purpose, and the reason is a property of CBF rather than
of the script.** The host throttles at the **socket** — no 429, no `Retry-After`
— so running a few hundred match fetches back to back (about one every 250ms)
made it stop completing TLS entirely, and plain `curl` was refused the same way
for minutes afterwards. A block is therefore indistinguishable from the host
being down. It paces at roughly one request a second; do not optimise the sleep
away. `scripts/cbf-api.ts` holds that transport half, shared with
`sync-broadcasts.ts` the way `scripts/commons-api.ts` is shared by every
Commons script, and for the same reason: the second copy is where drift starts.

**CBF's match endpoint also carries both starting elevens and the
substitutions**, which is worth knowing because `docs/roadmap.md` listed
escalações under *Explicitly not doing* on the grounds that no reachable tier
carried them. That was right about football-data and wrong to generalise; see
`docs/data-sources.md`. Goals shipped on the strength of it. Escalações remain
unbuilt, and now need a UI argument rather than an availability one.

`src/data/escalacoes.ts` holds each match's two team sheets, keyed by **our**
match id and written by the **same** `npm run sync-goals` run that writes
`goals.ts` — one request per match serves both. A command named for goals also
writing escalações is stated in both files and here rather than renamed, because
`sync-goals` is referenced across the docs and the surprise is cheaper than the
churn; what it buys is that the two files cannot disagree about which matches
they cover. Coverage grows a window at a time, like `broadcasts.ts`, and a
missing match means "not synced", never "no lineup published".

**`goals.ts` took the same tuple encoding, and its numbers are the argument
AGAINST assuming this generalises.** Both files are written by one `sync-goals`
run, so leaving one in objects would be an inconsistency inside a single
command — but the payoff is a different order of magnitude, and it is worth
having the figures here before anybody reaches for the third file:

    escalacoes.ts   791.7 KB -> 318.3 KB   gzip 84.9 -> 41.2 KB   18 017 -> 293 lines
    goals.ts         47.5 KB ->  24.1 KB   gzip  6.4 ->  6.4 KB    1 171 -> 281 lines

**The gzipped saving on `goals.ts` is nil**, and that is measured rather than
rounded: the tuple body does shrink, and the longer header explaining the
encoding costs back exactly what it saves. Deflate was already finding the
repetition that the encoding removes by hand — which is the same reason
`squads.ts` gzips *larger* as JSON than as TypeScript. So the rule is narrower
than "tuples are smaller": **the encoding pays on the raw file and on the diff,
and pays over the wire only where the file is big enough for the ratio to
matter.** On this one the case rests on 1171 lines becoming 281, which is what a
person reads when a rodada lands, plus 21.8 KB off `dist/server.cjs`.

Two decisions inside it are deliberately unlike the escalação's, both measured:
`kind` stays the **string union** rather than becoming an integer, because
numbering three kinds saves 0.6 KB raw and **nothing** gzipped over 83 rows
while costing a lookup table and a vocabulary `tsc` can no longer check; and
`minute` precedes `kind` in the tuple because a tuple cannot skip a middle
element and 665 of 669 goals carry a minute against 83 that carry a kind.

**The header still says "safe to hand-edit" and that is still true**, but it now
means writing `["1769","Lopez","26'"]`. The generated file spells the row out
where somebody adding a goal will be standing, because the capability is real
and unexercised — every commit that has ever touched `src/data/goals.ts` is a
sync — and the case it exists for is the sync **refusing** a match whose
`resultado` it does not know.

**It is stored as TUPLES, one fixture per line, and it is the second file here
that is** — `club-scouts-history.ts`' encoding, applied to the biggest file in
`src/data/` rather than to the one with the tightest bundle budget.
`decodeLineups` and `encodeLineups` in `escalacao-core.ts` are the only things
that cross between the stored shape and `Lineup`, so **nothing outside the data
file sees a tuple**: no component, no core module and no test changed when the
encoding did, which is the property that made the change safe to make at all.

**Measured before choosing, and the measurement is the argument.** As objects
the file was **791.7 KB over 18 017 lines, 84.9 KB gzipped**; as tuples it is
**318.3 KB over 293 lines, 41.2 KB gzipped**, and `dist/server.cjs` — which
rsyncs to the host on every release — went **1228.9 KB to 792.8 KB**. The
obvious other answer was **JSON**, and it loses on both axes: the same data
serialises to 645.6 KB raw and 69.8 KB gzipped, roughly half the saving, while
giving up the typecheck. `resolveJsonModule` types by inference, so
`keeper?: true` widens to `boolean`, the assignment to `Lineup[]` is refused
outright, and the only way past it is a cast that validates nothing. That is
the general rule for `src/data/`: **the lever is the encoding, not the format.**

**The re-encoding was verified as lossless rather than eyeballed**, which
matters because a plausible team sheet is indistinguishable from a correct one:
the file was re-rendered from the data already on disk — no CBF request, no new
reading — and the decoded result compared against a capture of the old one, key
order normalised, md5 `8a17ff3e…` on both sides. Five mutations of the
encoder were confirmed red, and **one of them passed first**: promoting a lone
shirt into the pair is unobservable from the committed data, because every one
of the 2417 substitutions carries both shirts or neither. That branch is
reachable from the *type* and not from the *data*, so the test for it is
hand-written and `tests/escalacao-core.test.ts` says so at the case.

**The renderer is `scripts/sync-goals-files.ts` rather than a heredoc inside the
sync**, and it renders BOTH of the run's files, and that is the one structural thing to know before editing either. The
committed file has to be byte-identical to what the next real sync writes, or a
resync rewrites all 293 lines and nobody can tell a formatting change from a
data change; the file is idempotent under re-render, checked. It is also how the
writer stops enumerating fields by hand — which is how adding
`Substitution.onShirt` to the type once left the sync emitting the three fields
it already knew, so a resync produced a file identical to the one it replaced
and the new field looked broken rather than unwritten.

`src/data/coach-overrides.ts` corrects the **técnico** where the provider names
the wrong person — the sibling of `player-overrides.ts`, keyed by club code, and
existing for the same reason: `clubs.ts` and `squads.ts` are generated, so a
hand-edit is overwritten by the next `sync-seed-data` without a word.

**The bar is `nationality`'s, not `name`'s: correct only where the value is
factually wrong, and only where the right answer can be established.** Both
halves bind, and the second is what keeps the file short. Two independent
sources must agree against the provider — the `position` rule one file over —
and they rot in *different directions*, which is why one is not enough: an
infobox is edited within hours of a sacking, while Wikidata's `P286` keeps a
superseded claim ranked `preferred` for years. Where the sources disagree with
each other, the provider stands.

**Vasco is the entry that is deliberately absent**, and the file says so at the
point somebody would add it. It is served as `Possato`, which nothing
corroborates — but en.wikipedia says Pedro Emanuel, Wikidata's preferred `P286`
says Fábio Carille from 2024-12-19, and pt.wikipedia's infobox carries no coach
field at all. **Doubt that the provider is right is not knowledge of what is
right**, and this file may only hold the second.

`withCoachOverrides` in `club-core.ts` is separate from `withClubDetails` on
purpose, and the split is the same one `player-overrides.ts` draws from
`squads.ts`: that function **fills**, so it reads `club.coach ?? source` and the
provider wins every tie; this one **corrects**, so the override wins. Folding
them together would make `withClubDetails` mean both, and no call site would say
which a field had got.

**It has FIVE application sites and no compiler can see that it needs all
five** — once over the frozen `CLUBS` list, once at each of `withClubDetails`'
three call sites (that function prefers whatever the live payload carries), and
once in the **squads seed branch**, which reads `SEED_SQUADS` and its own frozen
club objects and never passes through `CLUBS` at all. The fifth was found by
`tests/e2e/coaches.spec.ts` and not by reading: `/api/clubs` was already correct
while `/api/coaches`, `/api/squads` and the club page served the wrong name from
one line. That spec is what makes five a rule rather than something to remember,
and it carries a case asserting at least one override exists, so emptying the
file cannot make the rest of it pass vacuously.

`src/data/events.ts` holds the season's **Acontecimentos** — 14 entries as
shipped, one geral and thirteen de clube — hand-maintained for the reason every
curated file here is: no provider reports a técnico being sacked. The judgement
lives in `events-core.ts`, above, which is also where the date rule and the
two-source bar are argued; what belongs here is the shape of an entry.

**`source` is a REQUIRED field, and that is the compiler doing a reviewer's
job.** Every other rule about this file is prose somebody has to remember; this
one refuses an entry nobody can trace. The bar for adding one is
`nationality`'s in `player-overrides.ts` rather than `name`'s — **two
independent sources have to agree on the day**, and where they disagree the
entry stays out. A plausible date is indistinguishable from a correct one, and
it bites harder here than for a capacity: a sacking dated three days wrong still
sits plausibly beside the run of results that caused it.

**The paralisação's span is read off our OWN fixture list and not off the
press**, and the two genuinely differ. Reports announce the return as 22 July;
CBF brought two round-19 matches forward to 16 July, before the Copa's own final
on the 19th. `src/data/matches.ts` says the last round-18 match kicked off
`2026-05-31T23:30:00Z` and the first round-19 match `2026-07-16T22:30:00Z`, with
**zero fixtures between** — so 1 June to 15 July is the stretch a reader of this
app actually finds empty, and it is the stretch the entry names. A date taken
from the press would leave six days of football inside a band captioned "sem
jogos".

**The Copa do Mundo is not a second entry beside it.** The tournament is the
cause; the halt is what touched the twenty clubs, and two rows for one thing
would say the championship stopped twice. Its own window is named in the halt's
`detail`.

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
what a human reads, it does not prove the recording is the right one. **No
build runs it**: CI has no network dependency on a third party by design, and a
link that rots on someone else's server is not a reason for a red build on a
commit that did not touch it. A monthly workflow does run it — see the next
paragraph, which is the whole of the difference between *scheduled* and *in
CI*.

**A monthly workflow now runs every one of them, and it still is not CI.**
`.github/workflows/curated-data.yml` runs the curated-data checkers — count the
`for c in` line rather than a number here (`tests/workflow-lists.test.ts`
holds it to `package.json`'s `check-*` scripts) — on the
first of the month and reports into an **issue** — opening one, commenting while
the failure persists, and closing it when everything resolves again. The job is
**always green**, which is the whole design: a rotted third-party link is data
for a person, never a red build on somebody's unrelated commit. `workflow_dispatch`
is how to exercise it without waiting for the first.

It creates its own `curated-data` label first, idempotently. That is not
housekeeping: `gh issue create --label` fails on an unknown label, and the label
did not exist when the workflow was written — so without it the job would have
gone red on the first run where a checker genuinely failed, which is precisely
when the always-green promise matters.

**Do not "tidy" its `set -uo pipefail` into `set -euo pipefail`.** Today that
changes nothing — a command in an `if` condition is exempt from `set -e` — but a
bare `npm run check-…` added outside an `if` exits 0 as written and **1** under
`set -euo`, which turns the rule above into a red build. The workflow says so at
the line itself.

`src/data/club-discord.ts` holds the **supporters' Discord** for a club, keyed
by club code and storing an **invite and the guild it opens** — `discordUrl` in
`club-core.ts` builds the address from the invite, and the guild id is never
rendered. Hand-maintained and partial, and it takes `club-reddit.ts`' rule
whole: a server is the torcida's and not the club's, so the screen-reader suffix
says "comunidade de torcedores" and the link is not filed beside the Site
oficial. **Five entries as of 2026-09-13** — Flamengo's **FlaDiscord**,
Palmeiras', Athletico-PR's, Fluminense's **Flucord** and Cruzeiro's — and every
one `expires_at: null`. Count the file rather than this sentence: it said *one*
for as long as it took the second entry to land, which is the number-in-prose
failure this file keeps recording.

**`discordInvite`'s upper length bound moved from 32 to 60, and it took a real
invite to find the old one wrong.** Cruzeiro's entry is a Discord-minted vanity
for a large Discoverable community — `cruzeiro-e-c-1k-1168068145848799313`, 35
characters — confirmed as genuine by the invite API returning it as the guild's
own `vanity_url_code`, not merely accepting it as a code. "Discord mints codes
of 7–10 characters and vanities are words" (the reasoning behind the 32-cap and
behind the snowflake refusal below it) is still right about an ordinary vanity
and was never true of this shape. The snowflake-only refusal is unaffected —
`^[0-9]{17,20}$` matches only an all-digit value, and this one is not — so
raising the ceiling widens what a legitimate code may look like without
reopening the bare-guild-id hole.

**An invite code and never a guild id, and both halves of that were measured.**
What a person pastes is `discord.com/channels/<guild>/@home`, because it is what
the address bar shows while they read the server — and it is an in-app pointer
for somebody **already a member**: a non-member following it gets their own
Discord, no join affordance, no sign anything was meant to happen. It is also
unverifiable, which is the half that decides the design: `widget.json` answers
403 unless the server opted in, `/v10/guilds/<id>/preview` answers 401, and
`discord.com/channels/<id>/@home` answers **200 with `<title>Discord</title>` for
a real id and for two invented ones**, within 50 bytes of each other — the
Instagram trap `player-instagram.ts` records, met at a second host. An invite is
public: `api/v10/invites/<code>?with_counts=true` names the guild with no auth
and answers `Unknown Invite` for a code nobody minted, which is `check-hymns`'
oEmbed test in another costume and why **this file has a checker where
`player-instagram.ts` deliberately has none**.

```sh
npm run check-club-discord    # every invite still opens the guild it was written against
```

**That checker is EXACT where every other curated checker here is a hint, and
it had to become so.** It first asked whether the guild's *name* named the club
and refused the only correct entry in the file: the server is called
**FlaDiscord**, which contains no word of "CR Flamengo" — supporters name their
servers the way supporters talk. A rule strict enough to be worth something
rejects that, and one loose enough to accept it accepts nearly anything; the
false negative was reached by trying to be careful. So `ClubDiscord` carries the
**guild id**, and the check is identity rather than resemblance. It also catches
what no name rule could: **a vanity code is transferable** — Discord releases
one when a server drops below the boost level that earned it, and whoever claims
it next inherits our link, plausibly under a name that is also Fla-ish. Both
directions were confirmed by mutation (the recorded id changed, and the invite
re-pointed at another server); `tests/club-core.test.ts` checks distinctness on
the **guild** and not the invite, since two vanity codes can resolve to one
community and an invite-keyed `Set` would call that two.

**`discordInvite` therefore REFUSES rather than salvages, and the first test
written for it passed against the bug it named.** Deleting the refusal changes
nothing for `https://discord.com/channels/956…/@home` — that value is already
refused by the character rule, its first path segment being `https:` — so three
assertions built from full URLs were green against a parser with no refusal in
it at all. Two shapes actually reach it, and both were found by running the
mutation rather than by reading: a hand-trimmed `channels/956…/@home` yields the
segment `channels` and would be stored as the invite code **"channels"**, and a
**bare guild id** — the likeliest hand-edit of all — satisfies every rule and
builds `discord.gg/956…`, a link that looks minted and resolves to nothing. The
snowflake rule (17–20 digits) is what refuses the second, and
`tests/club-core.test.ts` carries a case pinning that a short numeric code still
stands, so it cannot be widened into refusing real invites.

**Prefer an invite set to never expire with no use limit.** Discord's default is
7 days and one use, so an invite copied without editing those two fields is dead
before most readers arrive — rot that is scheduled rather than accidental, which
is what the checker's expiry clause is for.

**`tests/e2e/club-discord.spec.ts` prepares a payload rather than opening a club
that has an entry, and the reason outlived the one it was written for.** It
shipped when the file was **empty**, so the anchor rendered nowhere and without a
payload the feature would have shipped having never once rendered —
`meu-time.spec.ts`' arrangement. The file has entries now and the payload is still
right: a spec pinned to *which record happens to hold a value* is the trap
**End-to-end tests** records for `goals.spec.ts`, and curated data moves by hand.
The trap it cost: **`ClubView` resolves its club from `/api/standings` first and
falls back to `/api/matches`**, so a fixture preparing only the fixtures payload
injects into the copy that loses and the link silently never appears — measured,
with the page holding `discord` on the club it was handed and drawing nothing
while the subreddit beside it drew fine. It prepares both, so the spec does not
encode which one wins.

`src/data/club-twitter.ts` holds each club's **official X account** (formerly
Twitter), keyed by club code and storing the **handle alone** in the casing the
account displays; `twitterUrl` in `club-core.ts` builds `https://x.com/<handle>`.
Official like `club-instagram.ts`, so the link's suffix says "X oficial do clube"
and not the supporters' wording `club-reddit.ts` and `club-discord.ts` use, and
the address joins `sameAs` in the club's JSON-LD beside Instagram's.

```sh
npm run check-club-twitter    # every handle still names an existing account
```

**That checker sits between Instagram's absence and Discord's exactness, and both
halves were measured on 2026-09-15.** X answers a profile address with **200**
for an account that exists and **404** for an invented handle — with or without
a browser user agent, and case-insensitively, `x.com/FLAMENGO` being byte-for-byte
`x.com/Flamengo` — which is the honest answer Instagram never gives. But the 200
page carries no title, no Open Graph tags and not even the handle in its bytes,
so nothing a script reads says *whose* account answered: a handle a club abandons
and somebody else registers passes. **A suspended account passes too**:
`x.com/Chapecoense` read "Conta suspensa" in a browser and answered 200 to a
script the same afternoon, which is why that club's entry is `ChapecoenseReal`.
The run catches deletion and renames; ownership and standing still rest on
having opened each profile in a browser.

**X's own app paths are the trap, and `twitterHandle` refuses them.** `x.com/home`,
`/search`, `/hashtag`, `/settings`, `/login`, `/share` and more all answer 200 and
all satisfy the handle rule, and a logged-out browser is redirected to
`x.com/i/flow/login?…` — the address bar somebody copies from. Without the
refusal that paste stores the handle `i` and the checker calls it live.

`src/data/club-youtube.ts` holds each club's **official YouTube channel**, keyed
by club code and storing a **handle and the channel id** — `ClubYouTube`, which
is `ClubDiscord`'s shape for `ClubDiscord`'s reason. `youtubeChannelUrl` in
`youtube-core.ts` builds `https://www.youtube.com/@<handle>`, and only the handle
travels onto the club.

```sh
npm run check-club-youtube    # every handle still opens the channel it was written against
```

**This checker is exact, like Discord's and unlike X's, and that was measured on
2026-09-15.** A handle nobody holds answers **404**; a real one answers 200 with
the channel's own id in the page (`"externalId"`), so the run compares ids and
catches a handle that has changed hands. **A 200 is not enough on its own**: an
invented `/channel/UC…` address also answers 200, with no id in it — so a 200
without an id is reported as inconclusive rather than passed.

**Which channel is official was decided by what the club links, and the obvious
handle lost twice.** Mirassol's site links `@CanalMirassolFC`, a different
channel from `@mirassolfc`; `@Coritiba` is three videos, while the club
publishes as `@coritibaoficial`. Club sites and bios also link older `/c/` and
`/user/` forms of the right channel — `youtubeChannelHandle` refuses those, so
resolve each to its handle rather than pasting it.

`src/data/club-facebook.ts` holds each club's **official Facebook page**, keyed
by club code and storing the **username and the page id** — `ClubFacebook`,
`ClubYouTube`'s shape for its reason. `facebookUrl` in `club-core.ts` builds
`https://www.facebook.com/<username>/`, and only the username travels onto the
club.

```sh
npm run check-club-facebook   # every username still opens the page it was written against
```

**This checker is exact about identity and blind about absence, and both halves
were measured on 2026-09-15.** A real username answers 200 with the page's own
id in it (`"userID"`), so the run compares ids — which is not caution for its own
sake: `facebook.com/flamengo` answers 200 with **a stranger's page**. But a
username nobody holds answers 200 too, with the bare shell Facebook also serves a
request it declines, so a deleted page and a refused request cannot be told apart
and both fail the run for a person to open. **Never give it a browser
User-Agent**: Facebook answered Chrome's with 400 for every page, real or
invented, while curl's and Node's defaults got the page. No GitHub-hosted runner
had run it when this was written.

**Every source was wrong somewhere, which is why no single one decided.**
Athletico-PR's own website links `atleticopr`, a page titled "CAP antiga" with
293 followers, where its Linktree and Wikidata name `clubathleticoparanaense`.
Wikidata in turn names `sePalmeiras` for Palmeiras, a supporters' page, where
the club's Linktree links `Palmeiras`. Vasco's site refuses a script and puts a
human-verification challenge in front of a browser, so `vascodagama` rests on
Wikidata and the page's own "Página oficial" — the one entry no club pointer
decided.

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
("Sociedade Esportiva Palmeiras"); `wikipediaUrl` in `wikipedia-core.ts` builds the
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
derivable from anything the app holds — **166 of the 378 recorded titles differ
from the listed name**, most of them disambiguated ("Dudu (futebolista, 1992)",
"Luiz Gustavo (futebolista, 1987)"), because the popular name is shared.

**This one has a checker, and its Instagram sibling deliberately does not:**

```sh
npm run check-player-wikipedia   # 378 articles, one API call per 20
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
Farias. A title match cannot see that; only reading the article can.

**Two traps when editing the checker, and both are false *negatives* — the
direction a gate must never fail in.** pt-BR writes the first of the month as
an ordinal, so `1º` and `1.º` are accepted beside `1`, and without that Bruno
Fuchs reads as a mismatch on every run. And the comparison is **case-folded**,
because some articles capitalise the month: Alexander Barboza's opens "16 de
Março de 1995", which a case-sensitive `includes` refuses against a correct
date. Both fixes widen how a date may be *written* and neither widens what
counts as a match — folding case cannot make two different dates equal — which
is the line to stay on the right side of if a third spelling turns up.

**Exact name plus exact date of birth is not a unique key in this division**,
which the division-wide sweep found the only way it can be found. `179144`
(Mirassol) and `13421` (Vitória) are both "Carlos Eduardo", both born
1996-10-10, and are two different people; the join offered one article to both
and **every per-entry check passed for both**, because each was asked in
isolation. Only a question about the *set* — has any article been claimed
twice? — can see it. Ask that before trusting a bulk pass's per-row green.

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
bytes — shared by every Commons script, the broadcaster marks' sync included. It
was extracted when the player scripts would have made a fourth copy, and the two
stadium copies had already drifted: one asked Commons for `ImageDescription` and
the other did not. It stays
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

`src/data/player-overrides.ts` is the one curated player file that **corrects**
the provider rather than adding to it. Keyed by player id like its neighbours,
with an optional correction per field, and applied by
`withSquadOverrides`/`withScorerNames`/`withPlayerOverrides` in `server.ts` on
the way out of `/api/squads`, `/api/scorers` and `/api/players/:id` — inside
**both** branches of each cache fill, so the live and offline answers cannot come
to differ. The suite runs the seed branch and production runs the other, which is
exactly the split that would hide this.

**All three routes, and `/api/players/:id` is the one that looks optional and is
not.** `mergePlayer` keeps the card's existing *name*, so a correction there is
belt-and-braces — but it prefers `extra.nationality`, so without the same
correction on the person route the card **visibly undoes** it: measured by
reverting that one line, the card read "Brasil" on open and flipped to
"Bulgária" a second later when the enrichment landed. A field-by-field merge
means "which routes need this" is a per-field question, and the answer is
already written down in `mergePlayer`.

**One file with optional fields, not one file per field.** It held only names for
the hour between #213 and #214; a parallel `player-nationality-overrides.ts`
would have been two near-identical doc comments stating two versions of one rule,
and a third file the first time somebody wanted a position. The per-field rules
genuinely differ, so they live on `PlayerOverride` in `src/types.ts` where a
reader adding an entry will look:

- **`name` — only where the recorded value is not a name at all.** Corinthians'
  fourth goalkeeper arrives as `"Felipexxx"`, `firstName` empty and `lastName`
  "Felipe": a placeholder somebody typed into a database and left. Not a place to
  prefer one spelling to another — the provider's nicknames and single names are
  what every other football site shows the same reader, and an ambiguous real
  name stays. `259933` renders as "Guilherme" where the club says "Gui Negão" and
  there are three Guilhermes in that squad; it is still a name, so it is still
  "Guilherme".
- **`nationality` — only where it is factually wrong**, in the **provider's**
  vocabulary ("Brazil") so `nationalityLabel` still does the translating and a
  country reaches the page one way rather than two. `1609` is served as
  `Bulgaria`; he is Brazilian, born in Atibaia, and the cause looks like a
  country-of-club leak — he played for Ludogorets and pt.wikipedia files him
  under *Brasileiros expatriados na Bulgária*.
- **`position` — only where the recorded value puts the player on the wrong
  LINE**, not a shade within one. Upstream files Raniele, a volante, among the
  **Defensores**; that is a claim about what he does rather than a nuance of it.
  In the provider's vocabulary (`Defensive Midfield`, `Left Winger`), so `lineOf`
  places it and `positionLabel` captions it with no special case anywhere —
  prefer the *specific* role where a source states one, since the broad word
  earns no caption under a heading that has already said it.

  **This field has a two-source bar, and it is the only one that needs it**,
  because a position is genuinely arguable where a placeholder name is not. An
  entry needs the club's own squad section **and** an article's stated role to
  agree that we are wrong. Jesse Lingard is the proof the bar bites: upstream
  says Midfield, the club says atacantes, and his article says "meio-campista ou
  atacante" — the sources disagree, so the provider's value stands. Without that
  rule this field is taste, and taste is what the `name` rule above exists to
  keep out.

  This was argued against before it was built — six entries is where a curated
  table starts drifting against the provider every transfer window, and a club's
  own page is not a stable machine-readable source. Both objections stand; the
  bar is what they bought. Coverage is **Corinthians only**, which is the club
  whose squad was validated, and partial like every curated file here.

- **`dateOfBirth` — only where it is factually wrong, and it is the one field
  the join below cannot vouch for.** ISO `YYYY-MM-DD`, the provider's spelling,
  so `ageOn` and `birthDateLabel` read it exactly as they read an uncorrected
  value. It is visible twice — the card prints **Idade** and **Nascimento** from
  this one field — which is how it was noticed: Víctor Cantillo read 34 where he
  is 32.

  **Every other rule here says "joined on exact date of birth", and that is
  unavailable precisely when the date is what is wrong.** So the bar differs in
  kind rather than degree: the article must be established as this player by
  something *other* than the date — the club and role it names, matching the row
  — and several **independent** sources must agree against the provider.
  Wikidata `P569` plus the article in more than one language is what settled the
  two entries here.

  **A single disagreeing article is not evidence, and the sweep proves it by
  going both ways.** Of five date disagreements found across the division, two
  were the provider's error (Leonel Picco `113224`, Víctor Cantillo `3738`, both
  corrected here) and **three were pt.wikipedia's** — Matheus Martins, Lucas
  Ramon and Lucas Arcanjo are served correctly and their articles are the
  outlier against Wikidata, en and es. Those three are therefore absent from
  `player-wikipedia.ts` and stay absent; `src/data/player-wikipedia.ts` records
  why, so nobody re-chases them.

  Note `check-player-wikipedia` now reads the **overridden** squad. Without that
  it would refuse Picco's and Cantillo's articles for stating the right date,
  which is a gate rejecting an entry because it is correct.

Verify against the person endpoint **and** an independent source before adding
one, joined on **exact date of birth** — the evidence `check-player-wikipedia`
rests on, and for the same reason: a name match cannot tell two people apart.
That matters more here than it sounds. Wikidata offers a second Corinthians
player born 2005-03-05, so the birth-date join alone was ambiguous for Felipe
Longo; what settles him is that upstream says goalkeeper with `lastName`
"Felipe" and the club lists exactly one goalkeeper at 40.

**Absence of a source is not evidence of an error, and this is where the file
stops.** A sweep of all 948 players found 29 nationalities, of which `Bulgaria`
is the only wrong one — but `Mexico` and `Ukraine` each name one base player with
no article in any language, so they are *unverified* and left alone. The same
sweep found `Felipexxx` to be the only placeholder-shaped name in the division.

**`squads.ts` cannot carry any of this**, which is the whole reason the file
exists: it is generated, so `sync-seed-data` overwrites a hand-edit on its next
run and says nothing. Overriding at serve time survives the regeneration.

**A wrong `position` fails in a way the other two fields cannot**, and it looks
like a fix: a value `LINES` does not know sends the player to **Outros**, which
is further from the truth than the wrong line the entry was written to undo. The
value type-checks, the page renders, and the player is simply somewhere nobody
looks. `tests/squad-core.test.ts` asserts every corrected position places into a
real line and that `playerPositionLabel` never hands the English word back.

There is no checker, because what goes stale here is the **override** rather than
a third-party link, and that is local. `tests/player-core.test.ts` fails when an
entry names an id no longer in `squads.ts`, when a field's recorded value already
matches (upstream having fixed their data, which arrives as a regenerated seed
and in no other way), when an entry *fills* an absent field rather than
correcting a wrong one, and when a corrected nationality is one
`NATIONALITY_LABELS` does not know — which would put the English word on the card
through the one path that bypasses the provider. Each was confirmed red before
being believed, except the fills-an-absence branch, which cannot be reached today
because every player in the seed carries both fields. Note none of them can
redden on somebody's unrelated commit, only on a deliberate `sync-seed-data`,
which is what keeps this a unit test rather than a monthly workflow.

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
does not replace looking. No build runs it, and the monthly `curated-data.yml` does,
both for the reason given there.

Each ground's **coordinate** lives in `src/data/stadiums.ts` as
`[latitude, longitude]`, from Wikidata's `P625` joined on the `wikipedia` title
that file already stores — so the whole file still rests on one source. It is a
tuple rather than `{ lat, lng }` because the order is the universal one and two
named fields invite a call site that swaps them silently.

```sh
npm run check-stadium-coordinates   # 19 grounds, against Wikidata and the CBF city
```

**A plausible coordinate is indistinguishable from a correct one**, which is the
rule that file already states about capacity and is sharper here: a wrong number
does not look wrong, it silently reports the weather somewhere else. So the
checker asks two things, and the second is the load-bearing one — the pair still
matches `P625` within 500 m, **and** it is within 40 km of the city `venues.ts`
records, resolved through Open-Meteo's own geocoder. Only the second can catch a
coordinate for the *wrong stadium*, which agrees with Wikidata perfectly. The
radius is generous on purpose: Itaquera puts the Neo Química Arena 16.5 km from
São Paulo's centre and that is correct. Verified by mutation rather than by
reading — nudging one ground 2 km fails the Wikidata check, swapping two grounds'
pairs fails both.

`src/data/club-scouts.ts` is generated by `npm run sync-cartola-scouts` and holds
each club's season **scouts** — finalizações, desarmes, faltas, cartões, defesas
— which **no provider this app can reach reports at any tier**. Read from
caRtola (MIT) on a workstation and committed; production never fetches it,
exactly as for `broadcasts.ts` and `goals.ts`. `docs/data-sources.md` assessed
that source and **rejected it for fixtures**, correctly and still — it carries no
scoreline, no status and no kickoff, and it is a week behind. Neither objection
binds a season aggregate, and the same file records why in as many words.

Four things about the generator are load-bearing:

- **The counters are cumulative season totals and a counter follows the player
  through a transfer**, so summing the latest snapshot by club is wrong in a way
  that looks like data: Botafogo's `GS` sums to **5** against 37 conceded, and
  Internacional's to **39** against 28, because a goalkeeper's whole season moves
  with him. Differencing consecutive snapshots and attributing each increment to
  the club he was listed at *in that snapshot* matched the seed exactly for 12 of
  20 clubs. Positive increments only — a negative one is a player leaving, never
  an action undone.
- **A gap in the round files is refused rather than skipped.** Differencing
  rodada 6 against rodada 8 succeeds and quietly folds two rounds into one
  window, which is invisible in the output and changes every rate downstream. The
  walk stops at the first absence — **and a run that stops short of the committed
  file is refused too.** Stopping at a 404 is right, but the committed round was
  never compared with where the walk stopped, so rounds 1..19 could be written
  over a file covering 1..25 and exit 0. `fewerRoundsRefusal` refuses that unless
  `--allow-fewer-rounds` declares a new season, which the file does not record.
- **The club map is hand-written and may not become a `tla` join**, however much
  it looks like one. Our Coritiba `tla` is `COR`, which is caRtola's
  **Corinthians** — the collision this file already records under *Club identity
  is the upstream numeric id*, met against a second dataset. Four more disagree
  without colliding. An unmapped abbreviation throws; a silent zero would render
  an empty Perfil for nobody's attention.
- **A counter column the file does not carry is refused, never read as zeros.**
  The walk used to check only the id, the club and `jogos_num`, and read any
  other missing column as blank — so a caRtola rename of `DS` would have
  published 0 desarmes for all twenty clubs, a plausible zero nothing
  downstream compares with anything. `cartola-csv-core.ts` now requires every
  column the walk reads and refuses a present cell that is not a number.
  **Blank still reads as 0, and that is measured**: all 26 round files of 2026
  (read 2026-09-11) carry every column, with 4,293–5,657 blank counter cells
  each and not one non-numeric cell. The CSV half lives in that module rather
  than in the script because the script starts a sync when it is imported, so
  nothing inside it could be tested.

**Nothing plots a scout against a rodada, and that is a measurement rather than
a preference.** The snapshot is weekly and a midweek round falls between two of
them: of 470 club-rounds in 2026 to rodada 24, **441 windows held exactly one
match, 19 held none and 10 held two** — 94%. A season total is the same either
way; a bar per rodada would draw an empty column for a club that played.

`matches` travels with the counters and is **not** a club's `played` in the live
table. The source is weekly and the standings are live, so by Saturday the table
holds a round these figures do not, and dividing by the live count understates
every rate by exactly the amount that reads as a form dip.

**It is not the fixture list either, and shipped as one for months.** The
denominator is what the counters *cover*, read from caRtola's own per-player
`jogos_num`, because **the source does not always record a match at all**.
Measured on 2026: Athletico-PR's windows 2 and 5 are zero across all five
counters, and they are exactly its two fixtures played out of round order — r2
on 19/02 after r3, r5 on 29/03 after r6-r8. The actions are **lost rather than
shifted** into a neighbouring window, which is the benign case one paragraph up:
the club's scout goals are 33 against 37 in the seed, its own goals in favour are
0 and fully known (`goals.ts` covers 23 of its 25 and the two it misses are both
0-0), and the 4-goal gap is precisely round 5's 4-1. So 219 finalizações were
divided by 25 where the counted matches give 23 — **8,8 a game reported against
9,5, which is 17º de 20 against 14º**, on a card whose whole purpose is reading
one club against the division.

**That rank shipped as 12º first, and the way it was wrong is this file's own
recurring failure.** It was computed by correcting *Athletico's* denominator
while leaving the other nineteen clubs on their old ones — a corrected club
measured against an uncorrected division, which is the mixed reading the
stale-tree paragraphs warn about, reached through arithmetic instead of a ref.
The fix raises thirteen clubs' rates, so the club climbs three places and not
five. The commit that introduced it had already written down the risk — *the
rank table holds the other 19 clubs fixed* — and published the number anyway,
which is what a claim with no gate on it costs. 14º was read back off the
**bytes production serves**: 219/23 = 9,5217, thirteen clubs strictly above, and
an exact tie with Chapecoense, which is also 219/23. 13 of the 20 clubs are short, Botafogo by three,
and the 20 uncovered club-matches together with the own goals account for
essentially all of the goals band's 6.8%.

**The maximum is the statistic, and the sum is the trap the superseded comment
was right about.** A club's matches in a window is the largest step any one of
its players took in `jogos_num` — eleven start, so one of them stepped by exactly
the number played — where a *sum* over players cannot separate a window holding
two rounds from one holding a heavily-rotated eleven. **Only players present in
BOTH snapshots count**: reading an absent player's cumulative total as a step
imports his whole season, and unfiltered that put Botafogo at 29 matches covered
against 24 played and São Paulo at 32, off single windows reporting steps of 7
and 9. Filtered, no window in the season steps by more than one.

**The seed is now the BOUND rather than the value.** Coverage above it is a stale
seed or a transfer read as an appearance, it inflates every rate, and the sync
refuses it; falling short is not refused, because that is caRtola not recording a
fixture and the rates are right about it now that the denominator follows. A club
well short of its fixtures is described on a thinner sample than the division
around it — the rate is right, the sample is not the same size.

**The seed must still reach at least as far as caRtola does — and that is a
refusal in the sync rather than a note here.** The
numerators advance weekly and the seed advances whenever somebody runs
`sync-seed-data`, so the order is `sync-seed-data` **then**
`sync-cartola-scouts`, which is `rank-history.ts`' rule with something behind it.
Measured by reproducing the mismatch one round earlier against data already on
disk — scouts through 24 over a seed through 23 — **every club's finalizações
inflated, 4.3%–4.5%, mean 4.4%**, and nothing about the output looks wrong:
twenty plausible rates, the right ranks, six rows.

That measurement describes the **old** derivation, where the denominator *was*
the seed. Under the coverage denominator a lagging seed no longer inflates a
rate: `jogos_num` still reports 25 matches covered while the seed can only bound
it at 23, so the coverage bound throws as well as the explicit refusal. Two
gates on one fault, which is why neither was removed.

**The goals band cannot stand in for it, and fails in the flattering
direction.** Under exactly this fault the scout total rises while the seed total
does not, so the reported shortfall goes **7.0% → 3.1%** — *further inside* its
-2%..15%. A gate that reports more comfortably as the thing it guards gets worse
is not a gate, which is why the refusal is a separate check and why
`tests/scouts-core.test.ts` asserts `CLUB_SCOUTS_THROUGH_ROUND` never exceeds the
seed's last round with a result. A seed *ahead* of caRtola is fine and is not
refused: `playedThrough` bounds on the round, not on the snapshot date.

**When to run the three syncs, and in what order, is `scripts/sync-schedule.sh`.**
`--list` prints the remaining rodadas with the date each completes and the date
it becomes worth checking; `--check` asks caRtola and exits **1** if a sync is
due; `--run` does it. It writes files and **stops** — no commit, no push, no
deploy — because what follows is judgement: the specs a seed sync reddens, and
the reading `docs/perfil-ataque.md` asks for.

**It computes the schedule rather than storing it, because two of the three
inputs move.** The fixture calendar is refreshed by every `sync-seed-data`, and
the tail of the season carries **placeholder kickoffs** — a whole round at
exactly 00:00Z, which is football-data serving a date with no time, so the day is
real and the hour is not. **Rodadas 31-38 on 2026-09-28**, having been 29-38 when
this was written: the boundary climbs every time the CBF times another round, so
it is a reading and not a constant. The test is the round's and not the
fixture's — `withKickoffPrecision` in `matches-core.ts` carries why. And caRtola's publish day drifts: Wednesday for the
last three, Tuesday and Friday before that. A table of dates written today is
wrong by November.

The one measured constant is the **lag**: from a round's last kickoff to the
publish that first carries it was 1.6–1.7 days on five of six rounds, and 0.5
days on the one that finished just before a scheduled publish. The script adds
**two** days, the smallest whole number above every reading, and says in its own
output that the result is a floor rather than an appointment — run `--check`
daily from it rather than once on it.

**It refuses the shared root checkout**, since a sync rewrites every generated
file the chain owns — the seed, the campanha and the scouts — and that is exactly
the collision the worktree rule exists to prevent. That clause used to count them
and said **six**, which was one short from the day it was written; the script's
own comment records why naming the outputs is the fix and re-counting them is not.

`scripts/rehearse-sync-schedule.sh` is its only behavioural coverage and `check`
runs it: the seed and the counters are read by real node, while `curl`, `npx`,
`npm` and two `git rev-parse` queries are stubbed so the caRtola probe, the syncs
and the checkout's shape are all observable. **The order is the property it exists
for** — the scouts sync divides caRtola's counters by the seed's match counts, so
a lagging seed inflates every rate — and it is confirmed by mutation: swapping the
two syncs fails 3 of its 23 assertions, deleting the root guard fails 2, dropping
the token check fails 2.

**It was RED on `main` for fifty minutes and the cause is worth more than the
fix: it inherited its environment instead of constructing it.** Two of the
script's refusals answer questions about *where it is running* — the root-checkout
guard compares `--git-dir` with `--git-common-dir`, which differ only inside a
worktree, and `--run` demands a `.env` carrying `FOOTBALL_DATA_TOKEN`. A
workstation satisfies both, so all 19 assertions passed there. `actions/checkout`
produces an ordinary clone with no `.env`, so in CI the guard fired on **every**
case: **8 ok / 11 not ok**, each failure exiting 2 with no sync invoked, and the
sync order — the whole point — never exercised at all.

**Nothing could have caught it, which is the part to internalise.** A
`pull_request` run takes `ci.yml` from the **merge with base**, not from the
branch, so this step did not exist in its own PR's run; #330 merged green and the
step first executed on the push to `main` afterwards, by which time `deploy` and
`tag` were skipping and production sat on `770a993`. Reading the branch's own
`ci.yml` says nothing about what will run on your PR.

So the rehearsal now points the script at a **constructed checkout** — a directory
of symlinks to the real top level plus a `.env` of its own — and stubs `git` for
the two rev-parse queries the guard reads. The seed and the counters stay
genuinely real; only the token and the worktree shape are set. It is **23 ok / 0
not ok, assertion-for-assertion identical, from a worktree and from an ordinary
clone**, which is the property that was missing rather than a higher number.

Two things about that fix are deliberate. **Case 8 still runs the REAL git in a
real root checkout**, so the guard's mechanism keeps an assertion on it rather
than only the value a stub feeds it — and it now asserts the **message**, not just
the code, because exit 2 is every *a person must look at this* branch and a bare
code check passes with the guard **deleted**. Measured, by deleting it. And
nothing writes a `.env` into the real checkout: that would either clobber a
developer's own or depend on its contents, which is the inherited-state bug again
in a costume.

**Do not trust a green run of this file from a worktree.** Reproduce the CI shape,
which is three commands and was what this fix was verified against:

```sh
git clone . /tmp/ciclone && ln -s "$PWD/node_modules" /tmp/ciclone/node_modules
cd /tmp/ciclone && ./scripts/rehearse-sync-schedule.sh
```

That returned 8 ok / 11 not ok before the fix — **byte-identical to CI's own
failure**, compared assertion by assertion rather than eyeballed — and 23 ok / 0
not ok after, including on `node:22-bookworm`.

**One recorded mutation figure does not reproduce, and the direction it is wrong
in is the tell.** This paragraph used to say *dropping the root guard fails 11*.
Deleting the guard fails **1** (2 since case 8 gained its message check): the 11
is what happens when the guard **fires everywhere**, which is not a mutation
anybody applied — it is the CI failure itself. The number was right about a
condition nobody had run and wrong about the one it named.

`src/data/club-scouts-history.ts` is written by the **same** `npm run
sync-cartola-scouts` run that writes `club-scouts.ts`, from the same snapshots
and one set of requests — the arrangement `sync-goals.ts` uses for `goals.ts`
and `escalacoes.ts`, and for the same reason: two files that cannot disagree
about which rodadas they cover. It holds every club's counters **cumulative
through each rodada**, for the Perfil scatters' rastro. The sync **refuses to
write** unless the last rodada of every club's history reproduces that club's
aggregate field for field, and unless some counter strictly increases across the
season — the second is the aliasing guard, because `accumulate` mutates one
object per club and pushing it by reference yields twenty-five identical rows
that satisfy every other check.
**It is tuple-encoded**, which is a measurement rather than a taste — and it was
the first file here to be, which is why the argument lives at this paragraph;
`escalacoes.ts` took the same encoding later and for a larger saving, on a file
that never reaches the client at all. On a real `vite build`, one object per rodada
costs **+9.3 kB gzip** on the client bundle against **+5.7 kB** for tuples, for
760 rows nobody reads. `ScoutHistoryEntry` states the field order and `tsc`
holds the arity. **The rodada is the array index**, never a stored field.
**It carries only the counters the scatters draw** — no desarmes, faltas or
cartões — so a third pairing on one of those is a generator edit and a resync.

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

**A club's `coach` in that snapshot is a floor, not the answer.** It is captured
from the same teams payload as everything else there, so it costs no extra
request — but a Série A club changes técnico several times a season and
`clubs.ts` is regenerated far less often than that. `coachOf` in `club-core.ts`
therefore prefers `/api/coaches`, which reads the live team list, and falls back
to the frozen name only so a failed request still leaves the club page naming
someone. This is the reverse of `withClubDetails`' rule, where the committed list
supplies what no live payload carries at all; do not collapse the two.

**Club identity is the upstream numeric id, never `tla`.** The abbreviation is not unique:
Corinthians and Coritiba both report `tla: "COR"`, so keying on it merges two clubs into
one standings row. `tla` rides along on `Club` for display only. `/api/matches` ships the
clubs it saw alongside the fixtures so the UI resolves names from the payload.

`src/types.ts` is the single source of truth for shared shapes. Extend it before adding
fields to data files or components.
