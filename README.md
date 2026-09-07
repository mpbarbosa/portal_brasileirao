# Portal Brasileirão

[![CI](https://github.com/mpbarbosa/portal_brasileirao/actions/workflows/ci.yml/badge.svg)](https://github.com/mpbarbosa/portal_brasileirao/actions/workflows/ci.yml)

Companion app for the Brazilian football championship — live match detail, standings, and
club data for the Campeonato Brasileiro Série A.

**React 19 · TypeScript · Express · AWS.** Built end-to-end by directing the AI coding
agent Claude Code.

> **Live:** https://brasileirao.mpbarbosa.com — a t3.micro in sa-east-1 running the bundle as a
> systemd service behind nginx, on a static Elastic IP, with an auto-renewing Let's
> Encrypt certificate.
>
> Live Série A data comes from [football-data.org](https://www.football-data.org) when
> `FOOTBALL_DATA_TOKEN` is set; without a token the app serves a frozen snapshot, so a
> fresh clone runs with no signup.

![Classificação do Campeonato Brasileiro Série A no tema claro: no alto, à esquerda, a marca do site — um arco cheio com três barras a subir vazadas nele — ao lado do nome Portal Brasileirão; à direita, o botão Entrar, ao lado do que alterna entre o tema claro e o escuro. Numa linha própria sob ele, as secções Classificação, Ao vivo, Jogos, Artilharia e Jogadores, a atual sublinhada. Acima da tabela, à esquerda, um seletor de três posições — Completa, Casa e Fora, com Completa marcada; à direita, dois botões: um mostra a forma na coluna da campanha, o outro oferece ver a campanha em barras em vez da linha. Abaixo, os 20 clubes com escudo, pontos, o gráfico da campanha, jogos, vitórias, empates, derrotas, saldo de gols e o aproveitamento em percentagem; a posição do líder vem num círculo cheio, e só a dele. À esquerda de cada posição, uma faixa diz o que aquela posição vale: verde contínua nos quatro primeiros, verde tracejada no quinto, azul-escura do sexto ao décimo primeiro e vermelha nos quatro últimos, com o meio da tabela sem faixa nenhuma. Logo abaixo, uma legenda de quatro linhas diz o que cada faixa significa: G4 Libertadores, as quatro primeiras posições; G5 Pré-Libertadores, a quinta posição; G11 Sul-Americana, da sexta à décima primeira posição; e Z4 Rebaixamento, as quatro últimas. Sob a legenda, o painel Números da temporada: em três cartões, os gols do campeonato e em quantos jogos, os gols por jogo e a percentagem de vitórias do mandante; e ao lado um do outro, os melhores ataques e as melhores defesas, três clubes em cada, com escudo, nome e o número de gols. Ao pé da página, o rodapé diz que o projeto é independente e sem vínculo com a CBF ou com os clubes, traz duas ligações para os outros sites do autor — mpbarbosa.com e copa2026.mpbarbosa.com — e a saúde do serviço: estado, fonte dos dados, versão, quando foi compilado e desde quando está no ar.](docs/screenshots/classificacao-light.png)

![A mesma classificação no tema escuro, com as mesmas 20 posições, as mesmas quatro faixas — G4, G5, G11 e Z4 — a mesma legenda de quatro linhas sob a tabela, o mesmo seletor de Completa, Casa e Fora e os mesmos dois botões acima dela, os mesmos gráficos da campanha, o mesmo painel de Números da temporada sob a legenda e o mesmo rodapé com a saúde do serviço.](docs/screenshots/classificacao-dark.png)

*Classificação, light and dark. The app follows your system setting and remembers an explicit
choice; the control in the header switches between them. **Campanha** is the club's position
after each round — the season behind a single row.*

<img src="docs/screenshots/classificacao-mobile-light.png" alt="A classificação num telemóvel no tema claro: acima da tabela, o seletor de Completa, Casa e Fora numa linha e, sob ele, dois botões, um para ver a forma e outro para ver a campanha em barras em vez da linha; as faixas das zonas à esquerda das posições, verde nos quatro primeiros, tracejada no quinto e azul-escura a partir do sexto; e a barra de navegação fixa no rodapé com Classificação, Ao vivo, Jogos, Artilharia e Jogadores, cada uma com ícone e rótulo, e a secção atual marcada por uma pílula atrás do ícone." width="300"> <img src="docs/screenshots/classificacao-mobile-dark.png" alt="A mesma classificação num telemóvel no tema escuro, com a mesma barra de navegação no rodapé." width="300">

*On a phone the five sections move to a navigation bar fixed at the bottom, icon above label,
the current one marked by a pill. Above `sm` they stay inline in the header — which is why the
desktop shots above look no different. Five is Material Design 3's ceiling for this pattern, and
the bar is now at it: the labels fit at 375dp because the items carry no horizontal padding, and
below 360dp the active indicator narrows rather than let the last destination fall off the edge.*

![Página Ao vivo no tema claro, num momento sem jogo em curso: a secção Agora diz "Nenhuma partida em andamento agora." — a rodada acabou e a próxima ainda não começou. Abaixo, A seguir lista seis jogos, cada um com os escudos e os nomes dos dois clubes, a data, o horário, a contagem regressiva e a etiqueta A realizar: Vitória × Grêmio às 20:00 de segunda 07/09, "Começa em 18h39", com as marcas do Premiere e do SporTV; depois quatro de sexta 11/09 às 21:00 — Bahia × Clube do Remo, Coritiba × Athletico-PR, Flamengo × Corinthians e Mirassol × Vitória —, todos com "Começa em 4 dias", que é a forma que a contagem toma para um jogo a mais de um dia; e Atlético-MG × Fluminense às 16:00 de sábado 12/09, "Começa em 5 dias". Por último, Últimos resultados abre com Corinthians 1 × 2 Chapecoense de domingo 06/09 às 19:30, marcado Encerrado e com a marca do Prime Video, e Botafogo 0 × 0 Palmeiras às 18:30 do mesmo dia, com as marcas do Premiere, da Record, do YouTube e da CazéTV, onde o enquadramento acaba](docs/screenshots/ao-vivo-light.png)

![A mesma página Ao vivo no tema escuro, com a mesma secção Agora vazia, a mesma lista A seguir de seis jogos com as mesmas contagens regressivas, os mesmos dois últimos resultados e as marcas das emissoras mantendo o fundo claro para continuarem legíveis](docs/screenshots/ao-vivo-dark.png)

*Ao vivo, light and dark — what is being played now, what is next, and what just finished.
Matches in progress get a card each rather than a row, so simultaneous kickoffs are all
visible at once. These shots caught none being played, which is the ordinary state:
between rounds "Agora" answers in a sentence rather than vanishing, which is the more common
state and the reason it is written as a sentence at all. It is the only page that
refetches on its own. There is deliberately no match minute: the provider reports a status
and a score and never an elapsed clock, so the page says **bola rolando** rather than
guessing a number.*

![Página do clube Palmeiras no tema claro: escudo, o técnico Abel Ferreira, o endereço da sede — com um alfinete, que abre o endereço no mapa —, site oficial, perfil no Instagram, hino do clube e artigo na Wikipédia; à direita, o botão Seguir, que marca o clube como o time do leitor; os números da temporada (2º lugar, 53 pontos, 26 jogos, saldo +24 e 68% de aproveitamento); logo abaixo, uma faixa Painel do clube, “A campanha inteira: onde cada rodada terminou e o que houve dentro dela”, que leva a essa página — a própria campanha não é desenhada aqui, mudou-se para o painel; os últimos cinco resultados, o próximo jogo — Palmeiras × São Paulo, com o escudo de cada clube, sábado 12/09 às 18:30 e marcado como A realizar, ainda sem emissora curada —, os artilheiros do clube, José Manuel López com 8 gols e Mauricio com 7, e os Vídeos do clube: dois cartões lado a lado num trilho que rola na horizontal, cada um com a miniatura do vídeo, um disco vermelho de play sobre ela, o título e o canal — “Palmeiras em velas: a campanha rodada a rodada do Brasileirão 2026 (até a 25ª)”, de Marcelo Barbosa, e ao lado “Palmeiras × Flamengo”, do mesmo canal, cortado à direita pela borda do trilho. Os Jogos disputados ficam abaixo do recorte](docs/screenshots/clube-palmeiras-light.png)

![A mesma página do clube Palmeiras no tema escuro: os mesmos escudo, técnico, endereço da sede com o seu alfinete, quatro links, o mesmo botão Seguir e os mesmos números da temporada; a mesma faixa do Painel do clube, igualmente sem gráfico da campanha acima dela; os mesmos últimos resultados, o mesmo próximo jogo, os mesmos artilheiros e os mesmos dois cartões de vídeo no mesmo trilho, com as miniaturas — que são desenhos de fundo escuro — iguais nos dois temas](docs/screenshots/clube-palmeiras-dark.png)

![Página de jogos no tema claro: o seletor de rodada na 26ª — a rodada mais antiga que ainda tem jogo por disputar, e por isso a que a página abre — com a rodada inteira já jogada no enquadramento. Nove jogos, todos com placar e a etiqueta Encerrado: Bragantino 2 × 3 Bahia às 16:00 de sábado 05/09, São Paulo 2 × 0 Atlético-MG às 18:30 e Fluminense 1 × 0 Vasco da Gama às 21:00; e no domingo 06/09, Coritiba 1 × 2 Mirassol às 11:00, Cruzeiro 3 × 1 Athletico-PR, Internacional 2 × 3 Santos e Clube do Remo 0 × 1 Flamengo às 16:00, Botafogo 0 × 0 Palmeiras às 18:30 e Corinthians 1 × 2 Chapecoense às 19:30, com que o enquadramento acaba. Cada linha tem os escudos dos dois clubes no título, a data, o horário e as marcas das emissoras](docs/screenshots/jogos-light.png)

![A mesma página de jogos no tema escuro, com o mesmo seletor de rodada, os mesmos nove placares Encerrado e as mesmas marcas das emissoras sobre fundo claro](docs/screenshots/jogos-dark.png)

*Jogos, light and dark. Every round of the season is reachable from the picker, and each
fixture carries the broadcasters showing it — ge, Globo, Premiere, SporTV, Cazé TV, YouTube
and Prime Video, with anyone we have no mark for rendered as their own name.*

![Página Jogadores no tema claro: um campo “Buscar jogador” no alto, o total de jogadores e de clubes do campeonato e o convite para escolher um clube; abaixo, um painel por clube com escudo, nome e o número de jogadores do elenco. O primeiro painel está aberto e mostra uma ligação para a página do clube e o elenco dividido em Goleiros, Defensores e Meio-campistas, cada jogador em duas colunas com o nome e a idade sob ele.](docs/screenshots/jogadores-light.png)

![A mesma página Jogadores no tema escuro, com o mesmo campo de busca, o mesmo painel aberto, as mesmas secções do elenco e os mesmos nomes e idades.](docs/screenshots/jogadores-dark.png)

*Jogadores, light and dark — the elenco of all twenty clubs. The panels are native `<details>`,
closed on arrival: the division fields close to a thousand players, and rendered flat the second
club would begin twenty screens below the first, which is exactly the by-club structure the page
exists to show. Two clubs can be open at once, which a picker would not allow. Positions arrive
from the provider at two levels of detail in the same list — a broad line for most players, a
specific role for a few — so they are folded onto the line they belong to, and a player's own
position is printed under the name only when it says something the heading did not.*

![Página da partida Palmeiras 4 x 1 Vasco da Gama no tema claro: a 24ª rodada à esquerda e a etiqueta Encerrado à direita; placar com escudos e, sob o nome de cada clube, uma ligação para o seu artigo na Wikipédia; sob uma linha divisória, quem marcou de cada lado e em que minuto — Lopez aos 46', Vitor Roque de pênalti aos 50', Mauricio aos 55' e Lopez aos 89' pelo Palmeiras, Facundo aos 90+3' pelo Vasco — os quatro nomes do Palmeiras sublinhados, porque abrem o cartão do jogador, e o do Vasco em texto simples, porque o elenco congelado não o resolve; os melhores momentos, que agora são o próprio vídeo: o quadro do player do YouTube ocupando a largura da página, com a capa do pacote da ge tv — "PALMEIRAS 4 X 1 VASCO | MELHORES MOMENTOS | 24ª RODADA" — e o botão vermelho de play ao centro, nada tocando por si; sob ele, "Melhores momentos por ge tv. Se não tocar aqui, abra no YouTube." e, na linha seguinte, "Também por UOL Esporte.", que troca o vídeo do quadro sem sair da página; a data e a hora; o estádio, com um alfinete ao lado do nome "Nubank Parque", que liga à página do próprio estádio, e a cidade e o estado em texto simples; e as emissoras que transmitiram, onde o enquadramento acaba. As Escalações e a Campanha dos dois clubes ficam abaixo do recorte — o player é mais alto do que a fila de marcas que substituiu, e empurrou-as para fora](docs/screenshots/partida-554977-light.png)

![A mesma página da partida no tema escuro, com o mesmo placar, as mesmas ligações para a Wikipédia sob cada clube, os mesmos marcadores e minutos dos dois lados, com os mesmos quatro nomes sublinhados e o quinto não, o mesmo quadro do player com a mesma capa e o mesmo botão de play — a arte do vídeo é a mesma nos dois temas —, as mesmas duas linhas de legenda, o mesmo estádio com o seu alfinete e as mesmas emissoras a fechar o enquadramento, com as marcas mantendo o fundo claro](docs/screenshots/partida-554977-dark.png)

*A match page, light and dark. **Gols** names who scored and for which club, from CBF's own
match feed — the club a goal *counts for* rather than the scorer's club, which is the whole of
what puts an own goal on the right side of a scoreboard. It is also what pushed the campanha
and the melhores momentos below this capture's crop — and goal coverage has since reached the
second fixture too, so that page's own Gols band has now evicted its melhores momentos in the
same way. The campanhas are the only one of the two any capture still shows.
Both clubs' campanhas are stacked rather than overlaid, so
they share one scale and their rounds line up — the app has no series palette, and inventing
a hue pair would be the only place colour carried meaning no token defines. **Melhores
momentos** *plays* the preferred package in the page, with the other broadcasters as links
under it that swap the frame; where none is curated it falls back to a YouTube search and
says so. It is also what pushed the Escalações out of both fixture captures: the player is
taller than the row of channel marks it replaced.*

![Página da partida Botafogo 1 x 1 Fluminense no tema claro: a 22ª rodada à esquerda e a etiqueta Encerrado à direita; o placar com os escudos dos dois clubes e, sob o nome de cada um, uma ligação para o seu artigo na Wikipédia; sob uma linha divisória, quem marcou de cada lado e quando — Alex Telles, de falta, aos 43' pelo Botafogo, e Ignacio aos 58' pelo Fluminense, ambos sublinhados porque abrem o cartão do jogador; os melhores momentos, que agora são o próprio vídeo: o quadro do player do YouTube com a capa do pacote da ge tv — "BOTAFOGO 1 X 1 FLUMINENSE | MELHORES MOMENTOS | 22ª RODADA" — e o botão vermelho de play ao centro, nada tocando por si; sob ele, "Melhores momentos por ge tv. Se não tocar aqui, abra no YouTube." e, na linha seguinte, "Também por CazéTV · UOL Esporte." — a CazéTV é ligação para o YouTube e não troca o quadro, porque o YouTube não deixa embutir os pacotes dela; a data e a hora do jogo; o estádio, com um alfinete ao lado do nome "Nilton Santos", que liga à página do próprio estádio, e a cidade e o estado; a linha do árbitro, que nomeia Bruno Arleu de Araujo; e as emissoras que transmitiram, onde o enquadramento acaba. As Escalações e a Campanha dos dois clubes ficam abaixo do recorte](docs/screenshots/partida-554951-light.png)

![A mesma página da partida no tema escuro, com o mesmo placar e escudos, as mesmas ligações para a Wikipédia sob cada clube, os mesmos marcadores com os seus minutos dos dois lados, ambos sublinhados, o mesmo quadro do player com a mesma capa e o mesmo botão de play, as mesmas duas linhas de legenda com as mesmas três emissoras, a mesma linha do árbitro, o mesmo estádio com o seu alfinete e as mesmas emissoras a fechar o enquadramento, com as marcas mantendo o fundo claro](docs/screenshots/partida-554951-dark.png)

*A second match page, and the only capture that shows the **Árbitro** line. It is here rather
than in place of the one above because no single fixture can carry both: upstream names an
official for 157 of the season's 380 fixtures, while the stadium and the broadcaster marks come
from data curated forward for coming rounds — 30 fixtures — and the two sets do not share a
single round. So the Palmeiras page documents the estádio and the emissoras, and this one
documents the árbitro. Where upstream names nobody the line is absent rather than blank, which
is the common case at 223 of 380.*

*A club page, in both themes. The **Painel do clube** row opens the club's campanha —
the line tracing where it sat after every round, and beneath it a candle per rodada — and
the marks under each fixture say which broadcaster showed it. The campanha is not drawn
here: moving it let **Jogos disputados** into the frame, which is what these two images
now reach.* The marks keep a light backing
in both themes on purpose — Globo's circle and the Premiere wordmark are dark artwork on a
transparent ground, and they vanish against a dark page without it.*

![Painel do clube Palmeiras no tema claro: o escudo ao lado do título “Painel do Palmeiras” e, sob ele, “A campanha inteira, rodada a rodada”; três números — 2º de posição, 53 pontos e 26 rodadas; a Campanha, com um botão que a troca de linha para barras, desenhada do 11º lugar na 1ª rodada ao 2º na 26ª; e, abaixo, a mesma campanha rodada a rodada em velas, com um seletor “Comparar com” à direita do título — em Nenhum, que é como a página abre — que desenha as velas de um segundo clube por baixo destas, no mesmo quadro. Cada vela vai da posição em que a rodada começou à do fim dela, verde para vitória, cinzenta para empate e vermelha para derrota, com a linha fina do pavio atravessando as posições ocupadas enquanto a rodada era disputada e duas linhas tracejadas marcando o G4 e o Z4; sob o desenho, a legenda das quatro cores e a frase que explica o que o corpo, o traço e o pavio significam. As secções Destaques e Perfil ficam abaixo do recorte](docs/screenshots/painel-palmeiras-light.png)

![O mesmo painel no tema escuro, com o mesmo escudo e título, os mesmos três números, a mesma campanha em linha e as mesmas velas rodada a rodada, com o mesmo seletor “Comparar com” em Nenhum, as mesmas cores dos resultados e as mesmas tracejadas do G4 e do Z4.](docs/screenshots/painel-palmeiras-dark.png)

*The **Painel do clube**, in both themes — the page that row opens. The line at the top is
the campanha as the Classificação draws it; the velas beneath read the same rounds one
grain finer, because a round is one point on the line and a club can lose four places
inside it. Colour carries the result and the geometry carries the direction, and the rounds
worth looking at are the ones where they disagree. **Destaques and Perfil sit below the
frame**: a capture is cropped at the last section fitting in 1080 CSS px, and the velas take
most of it.*


![Página do estádio Maracanã no tema claro: o nome popular em destaque, "Rio de Janeiro – RJ" abaixo, o nome oficial "Estádio Jornalista Mário Filho" e uma ligação para o artigo na Wikipédia; uma fotografia aérea do estádio ao entardecer, iluminado, com a cidade e os morros do Rio ao fundo, e logo abaixo a linha de crédito com o nome do fotógrafo e a licença; dois números lado a lado — capacidade de 78.838 e inaugurado em 1950; os mandantes Fluminense, Flamengo e Vasco da Gama, cada um com escudo e ligação para a sua página; e o clima no estádio, com um ícone de nuvem com chuva, 16 °C, “Garoa”, a sensação de 16 °C, a umidade de 93% e o vento de 15 km/h ao lado, e sob o cartão a hora da leitura — 01:22 — e a fonte, o Open-Meteo](docs/screenshots/estadio-maracana-light.png)

![A mesma página do estádio no tema escuro, com a mesma fotografia aérea e a mesma linha de crédito, o mesmo nome popular e oficial, a mesma capacidade e ano de inauguração, os mesmos três mandantes e o mesmo cartão do clima com a hora da leitura.](docs/screenshots/estadio-maracana-dark.png)

*A stadium page, light and dark, reached from a match's **Estádio** line — it has no nav
entry, because a ground is somewhere you arrive at from a fixture rather than a section
you set out to browse. No feed we read has a stadium in it:
football-data carries no venue field at any tier, and CBF reports only `Stadium - City - UF`
per match, so the roster is derived by grouping fixtures on the slug of that string. That
slug is the identity, which is what makes CBF's `ARENA MRV` and `Arena MRV` one ground
rather than two. **Mandantes** falls out of who actually hosted there — nobody had to say
the Maracanã has two tenants. Capacity, the official name and the year are hand-curated, and
each is left out rather than guessed where the source is silent. So is the
**photograph**, which no feed carries either — it is named by its file title on
Wikimedia Commons and fetched from there, and it always ships with the photographer
and the licence, because every licence in use but one requires the credit wherever
the picture appears.*

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 19 + TypeScript, Vite dev server and build |
| Styling | Tailwind CSS |
| API / SSR host | Express (TypeScript, bundled with esbuild for production) |
| Data | [football-data.org](https://www.football-data.org) v4, competition `BSA` |
| Hosting | AWS |
| Tests | `node --test` for unit logic, Playwright for end-to-end |

The Express server owns the data-sync layer (fetching and normalizing match, table, and
club data) and serves the built React bundle, so development and production run the same
single process.

## Local setup

1. Install dependencies:

```sh
npm install
```

2. Copy `.env.example` to `.env`. For live data, register a free token at
   [football-data.org](https://www.football-data.org/client/register) and set
   `FOOTBALL_DATA_TOKEN`. Skip it to run on seed fixtures.

3. Start the development server:

```sh
npm run dev
```

The dev server listens on port `3000`, or the next free port if `3000` is taken.

## Commands

- `npm run dev` — start the Express + Vite development server
- `npm run build` — build the frontend and bundle the server
- `npm start` — run the production build
- `npm run lint` — type-check with TypeScript
- `npm run test:unit` — run the Node unit test suite
- `npm run test:e2e` — run the Playwright end-to-end suite (boots its own server)
- `npm run clean` — remove `dist`
- `npx tsx scripts/sync-seed-data.ts` — regenerate the offline seed data from the live API
- `npm run screenshot [url] [light|dark]` — refresh the README screenshot from the live site
- `npm run deploy:preflight` — build and verify the production payload locally
- `DEPLOY_HOST=ubuntu@host npm run deploy` — deploy to EC2 (see `scripts/README.md`)

Run a single test file with `node --import tsx --test tests/standings-core.test.ts`.

## Layout

```
src/                    React application, shared types, seed data
standings-core.ts       pure table computation (no I/O)
matches-core.ts         pure round filtering and feed ordering (no I/O)
football-data-core.ts   pure football-data.org adapter: URLs + response mapping
cache-core.ts           TTL cache and circuit breaker
server.ts               Express host: API routes, Vite in dev, static serving in prod
tests/                  unit tests for the core modules
```

Calculation logic lives in root-level `*-core.ts` modules that do no I/O, so it can be
unit-tested without mocking HTTP. `server.ts` does any fetching and passes payloads in.

## API

Every data endpoint returns `{ source, note, updatedAt, data }`, where `source` is one of:

- `football-data` — live upstream data
- `placeholder` — seed fixtures, because no token is configured
- `fallback` — seed fixtures, because the upstream failed or was disabled

The UI banners the `note` for anything that isn't live. The free tier allows 10
requests/minute; standings cache for 60s and fixtures for 60s (15s while a match is live),
so the app makes at most ~5 upstream calls/minute no matter how much traffic it serves. A
circuit breaker opens after 3 consecutive failures and stays open for 60s.

- `GET /api/health` — status, version, uptime
- `GET /api/clubs` — the 20 Série A clubs
- `GET /api/standings` — the computed table
- `GET /api/matches[?round=N]` — fixtures, defaulting to the whole feed

## Working with Claude Code

This repository is developed by directing Claude Code rather than by hand.
[CLAUDE.md](CLAUDE.md) carries the architecture and conventions;
[CONTEXT.md](CONTEXT.md) is the domain glossary — what each Portuguese term means in
this codebase, and which near-synonyms were rejected and why. Read both before changing
behaviour, and update them in the same commit when a convention or a term changes.

## License

MIT — see [LICENSE](LICENSE).
