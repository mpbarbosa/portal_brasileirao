# Animações em Manim

Três cenas, três leituras da mesma campanha:

- **`campanhas.py`** — dois clubes rodada a rodada, a **posição** desenhada como
  linha sobre a divisão inteira, e ao lado o jogo daquela rodada com o
  resultado.
- **`pontos.py`** — os **20 clubes** rodada a rodada, os **pontos** no eixo y e a
  rodada no eixo x, com a classificação ao lado se reordenando a cada rodada.
- **`velas.py`** — **um** clube rodada a rodada em **velas**: o corpo vai da
  posição de abertura à de fechamento, o pavio cobre a melhor e a pior posição
  ocupada *durante* a rodada, e embaixo, no mesmo eixo x, a barra de **pontos
  acumulados** com o ganho da rodada na tampa.

Nenhuma das três recalcula classificação. As duas primeiras leem
`rank-history.ts`, que já carrega posição *e* pontos por rodada; a terceira lê
`computeRankCandles`, que é a mesma função que o Painel do site serve. Um número
errado aqui está errado no site também.

**A vela responde o que a linha não responde**, e é o argumento do
`rank-candles-core.ts`, não um novo: a linha liga a posição do *fim* de cada
rodada, então quem sentou em 4º no sábado e terminou em 9º porque três rivais
jogaram no domingo desenha o mesmo segmento de quem desceu andando.

## Como gerar

O Manim **não** é dependência deste repositório e não entra no `package.json`.
Ele vive num virtualenv à parte, porque nada no app o executa: é uma ferramenta
de quem faz o vídeo, não do servidor.

```sh
python3 -m venv .venv-manim
./.venv-manim/bin/pip install manim
```

Os dados saem do próprio seed do app, nunca digitados à mão:

```sh
npx tsx scripts/manim/export-campanhas.ts > scripts/manim/campanhas.json
./.venv-manim/bin/manim -qh scripts/manim/campanhas.py Campanhas

npx tsx scripts/manim/export-pontos.ts > scripts/manim/pontos.json
./.venv-manim/bin/manim -qh scripts/manim/pontos.py Pontos

npx tsx scripts/manim/export-velas.ts > scripts/manim/velas.json
./.venv-manim/bin/manim -qh scripts/manim/velas.py Velas
```

`export-velas.ts` aceita **um** código de clube (`1765` Fluminense é o padrão) —
uma vela por rodada só cabe para um clube: duas séries sobrepostas na mesma
faixa de posições ficariam ilegíveis, que é a razão oposta à do `pontos.py`.

**Um segundo clube é um segundo payload, nunca um `velas.json` sobrescrito.** O
`velas.json` é de onde o `velas-fluminense.mp4` foi desenhado; escrever outro
clube por cima dele deixa um vídeo commitado sem a fonte que o descreve, e o
`tests/manim-renders.test.ts` continua verde porque a data do snapshot não
mudou. A cena lê `VELAS_JSON` exatamente para isto:

```sh
npx tsx scripts/manim/export-velas.ts 1768 > scripts/manim/velas-athletico-pr.json
VELAS_JSON=$PWD/scripts/manim/velas-athletico-pr.json \
  ./.venv-manim/bin/manim -qh scripts/manim/velas.py Velas
```

**E a paleta precisa conhecer o clube antes.** `CLUB_COLOURS` no `velas.py`
mapeia código → tom, e quem não está lá cai no `FALLBACK_COLOUR` — um cinza que
é ausência visível e não erro, mas também não é a cor de ninguém. O tom vem do
`pontos.py`, que já resolveu essa paleta para os vinte pela regra dele
(distinguível primeiro, fiel ao clube em segundo); copiar o valor de lá é o que
impede dois vídeos deste projeto de discordarem sobre a cor de um clube.

`export-pontos.ts` não aceita argumento: a cena é a divisão inteira, e escolher
um subconjunto dos 20 seria outro desenho.

`export-campanhas.ts` aceita dois códigos de clube (`1769` Palmeiras, `1783`
Flamengo são o padrão) — são os **códigos numéricos do provedor**, nunca a
`tla`, pela razão que o CLAUDE.md registra: Corinthians e Coritiba compartilham
`COR`.

Os vídeos saem em `media/videos/<cena>/1080p60/<Cena>.mp4`. `-ql` (480p15)
renderiza em segundos e serve para conferir o enquadramento.

## Os renders commitados

**`docs/medias/campanhas-palmeiras-flamengo.mp4`** (23s, 3,3 MB),
**`docs/medias/pontos-20-clubes.mp4`** (21s, 4,4 MB),
**`docs/medias/velas-fluminense.mp4`** (21s, 3,8 MB) e
**`docs/medias/velas-athletico-pr.mp4`** (21s, 3,8 MB) — todos 1920×1080, 60fps —
são os vídeos prontos, versionados junto do resto do projeto como os slides
em `docs/carrossel/` e as capturas em `docs/screenshots/`.

**Dois clubes na mesma cena são dois artefatos, e esse é o preço do `velas.py`.**
Ele desenha um clube por run, então cada clube que valha um vídeo acrescenta um
mp4, um payload, uma linha no `RENDERED` e mais um degrau na cadeia de
regeneração — e a cadeia é justamente onde um clube esquecido não aparece, porque
o `RENDERED` recebe a data nova de qualquer jeito. As outras duas cenas não têm
esse custo: uma fixa dois clubes e a outra é a divisão inteira.

**Nenhum dos dois `velas-*.mp4` tem miniatura**, e isso é uma decisão e não uma
pendência: as capas existem porque os primeiros segundos daqueles outros dois
vídeos são um gráfico vazio, e uma capa é um segundo artefato para manter
atualizado. Quando um destes for para o YouTube, `capa-core.ts` é o que os dois
scripts de miniatura já dividem — o desenho é que seria novo, e seria **um por
clube**, pela mesma razão que o vídeo é.

Eles são **regeneráveis** pelos comandos acima, e mesmo assim está commitado
pela razão que o `og-default.png` já registra: um artefato de divulgação precisa
existir para quem clona o repositório sem instalar o Manim. `media/` continua
ignorado — é a árvore de trabalho do Manim, cujo caminho muda com a flag de
qualidade; o entregável tem nome e lugar próprios.

**Regerar é um commit deliberado.** Nada compara os bytes: os vídeos não passam
por nenhum gate, e o `docs/screenshots` guard não olha para eles. Se os dados
mudarem — um `sync-seed-data` seguido de `sync-rank-history` — o mp4 commitado
descreve a temporada anterior e continua verde. O subtítulo do próprio vídeo diz
até que data os dados vão, que é a única defesa que ele tem.

## O gif

**Os quatro mp4 têm gif, todos 960×540 e 15fps** — conte o diretório, não esta
frase:

| gif | quadros | gif | mp4 |
|---|---|---|---|
| `campanhas-palmeiras-flamengo.gif` | 343 | 5,3 MB | 3,7 MB |
| `pontos-20-clubes.gif` | 309 | 5,7 MB | 4,6 MB |
| `velas-athletico-pr.gif` | 317 | 5,2 MB | 3,8 MB |
| `velas-fluminense.gif` | 317 | 5,1 MB | 4,0 MB |

Cada um é **derivado do mp4 commitado ao lado dele**, não um segundo render: sai
daquele arquivo por dois passos de `ffmpeg`, então não tem como descrever uma
temporada diferente da que o vídeo descreve. Um `-qh` a mais só gastaria dez
minutos para produzir os mesmos quadros.

**Os três últimos nasceram de uma decisão de divulgação**, não de uma pendência
técnica: as animações vão para o Reddit, onde o gif toca sozinho no feed e serve
a subs que aceitam imagem e recusam vídeo. A ressalva vale dita: o Reddit reconverte o gif
em vídeo de qualquer jeito, então lá dentro a paleta abaixo não compra quase
nada e o mp4 subiria com melhor qualidade. O que o formato compra é todo o resto
— comentário, README, issue, chat — com um arquivo só.

```sh
# Um por vez, e NUNCA os quatro num laço com uma /tmp/palette.png só: a paleta
# é tirada do vídeo que ela vai colorir, e reaproveitar a de outro desenha um
# clube com as cores do vizinho sem nada acusar.
V=velas-athletico-pr
ffmpeg -y -i docs/medias/$V.mp4 \
  -vf "fps=15,scale=960:-1:flags=lanczos,palettegen=max_colors=192:stats_mode=diff" \
  /tmp/palette-$V.png
ffmpeg -y -i docs/medias/$V.mp4 -i /tmp/palette-$V.png \
  -lavfi "fps=15,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle" \
  docs/medias/$V.gif
```

**O gif é MAIOR que o mp4 que o gerou, nos quatro** — 5,2 MB contra 3,8 no
`velas-athletico-pr`, e a tabela acima diz o mesmo dos outros três — com metade
da resolução e um quarto dos quadros. Não é parâmetro mal escolhido: o formato tem
256 cores por quadro e nada que se compare à compressão entre quadros do h.264.
Ele existe pelo que o mp4 não faz — tocar sozinho, mudo e em laço, dentro de um
README, de uma issue ou de um chat que não abre player — e é por isso que ele
não substitui o mp4 nem é o formato para o YouTube.

**`dither=none` foi medido, não escolhido por gosto.** Este desenho dá 6,7 MB com
`bayer`, 5,9 com `sierra2_4a` e 5,2 sem dither nenhum, e o sem dither é também o
mais limpo: o quadro é fundo chapado, retângulo de cor sólida e tipo, não tem
gradiente que o dither salve, e o ruído que ele espalha é exatamente o que
impede o gif de comprimir.

**960px é o piso da legibilidade, e quem decide é o card da direita**, não o
gráfico: as chaves dele são tipo de 16px na cena, e abaixo dessa largura elas
embolam. A régua é abrir um quadro do gif e ler `melhor · pior na rodada`, do
mesmo jeito que a capa se confere olhando para ela — o tamanho do arquivo não
diz nada sobre isso.

**Os 960 foram medidos contra o card do `velas`, e valem para as outras duas
cenas — verificado abrindo um quadro de cada gif, não deduzido da resolução.**
O caso apertado não é o `campanhas`, cujos dois cards de placar são tipo grande:
é a coluna `1º … 20º` do `pontos`, que é a legenda do vídeo inteiro e o menor
tipo dos três desenhos. Ela está legível a 960 com clube e pontos. Se algum dia
uma cena nova não passar nessa régua, o que sobe é a largura dela e não o piso
das outras — um gif por cena, cada um no seu tamanho.

## As miniaturas

**`docs/medias/campanhas-palmeiras-flamengo-miniatura.png`** e
**`-miniatura-11-ao-1.png`** — 1280×720, as capas que o YouTube mostra no lugar
de um frame qualquer da animação (os primeiros segundos são um gráfico vazio).
Uma nomeia o confronto, a outra a história; a segunda envelhece mal de
propósito, porque `1º` é uma afirmação sobre a rodada 25 em tipo de 96px.

**`docs/medias/pontos-20-clubes-miniatura.png`** e
**`-miniatura-38-pontos.png`** são as capas do outro vídeo, pelas mesmas regras:
uma nomeia a divisão, a outra a distância entre o 1º e o 20º, e o nome do
arquivo da segunda sai do número que ela imprime.

```sh
npx tsx scripts/manim/thumbnail.ts                       # as duas do campanhas
npx tsx scripts/manim/thumbnail.ts --variant fixture     # só uma
npx tsx scripts/manim/thumbnail-pontos.ts                # as duas do pontos
npx tsx scripts/manim/thumbnail-pontos.ts --variant divisao
```

**Não precisa do Manim** — só do Chromium que o Playwright já traz — e é por
isso que este script pode viver no `package.json` do projeto onde a cena não
pode. Ele lê o **mesmo `campanhas.json`**, então as linhas, as posições da
manchete, a contagem de rodadas e os chips saem todos dos dados: uma reexportação
move a capa e o vídeo juntos. O nome do arquivo da segunda é construído a partir
dos próprios números que ela imprime, de modo que não pode se chamar `11-ao-1` e
dizer outra coisa.

**A paleta é lida da própria cena**, como `generate-og-image.ts` lê a sua de
`src/index.css` — uma segunda cópia de uma cor à mão é como a capa acaba um tom
fora do vídeo que ela anuncia. Uma constante renomeada quebra o run em vez de
desenhar em preto.

**`capa-core.ts` é o que os dois scripts dividem**: a leitura da paleta e a
captura no Chromium. O que ele deliberadamente **não** tem é o desenho — um `×`
entre dois nomes e um leque de vinte são dois layouts, e juntá-los num
renderizador parametrizado seria um design fingindo ser um laço. É a mesma linha
que o `thumbnail.ts` traça quando recusa um terceiro clube.

Regerar é um commit deliberado, como o mp4: nada compara os bytes.

## Quando regerar, e o que obriga a isso

Os artefatos de `docs/medias/` — quatro mp4, quatro gifs, quatro capas e dois `-youtube.md`; conte o
diretório, não esta frase — são **velhos por construção**. São desenhados do seed e commitados (como o `og-default.png`, para
que quem clona o repositório os tenha sem instalar o Manim), e descrevem uma
temporada congelada para sempre. Um `sync-seed-data` move a temporada debaixo
deles com **todos** os gates do repositório continuando verdes: o guard do
`docs/screenshots` não olha para este diretório, o CI nunca abre um mp4, e os
bytes não são comparados por nada.

`tests/manim-renders.test.ts` é o que fecha isso, e ele fica vermelho **de
propósito** na próxima sincronização:

- `SNAPSHOT_DATE` só se move num `sync-seed-data` e em mais nada, que é a
  propriedade que o `tests/player-core.test.ts` tem — não dá para ficar vermelho
  no commit não relacionado de outra pessoa, e quem ele interrompe é justamente
  quem pode agir.
- `docs/medias/RENDERED` guarda de qual snapshot cada artefato foi desenhado. É o
  mesmo dispositivo do `docs/screenshots/CAPTURED` **e o mesmo limite**: ele lê a
  afirmação de uma pessoa, não os bytes. Nada impede escrever uma data nova sobre
  artefatos que ninguém redesenhou. Pega o esquecimento, que é a falha que
  acontece; não pega a mentira, e nenhum teste deste lado do render pegaria.

A regeneração inteira, na ordem — **incluindo os pré-requisitos**, que não são
opcionais e não estão num checkout novo. Esta lista já falhou nos três degraus:

```sh
# 0. De onde rodar. NÃO é o checkout raiz: ele fica atrás do `origin/main` (22
#    commits, na vez em que isso mordeu) e uma regeneração escreve arquivos
#    gerados, que é a colisão que a regra do worktree existe para evitar. Um
#    `export-pontos.ts` que "não existe" quase sempre é esta linha.
git worktree add .claude/worktrees/<nome> -b worktree-<nome> origin/main
cd .claude/worktrees/<nome>
cp ../../../.env .env

# 1. O tsx. Sem isto o `npx` baixa uma cópia solta em ~/.npm/_npx e o stack
#    trace vem de lá, o que esconde o degrau que falhou.
npm ci

# 2. O Manim, que NÃO é dependência deste repositório — vive num virtualenv à
#    parte, ~460 MB, alguns minutos. `media/` é ignorado; é a árvore de trabalho
#    dele, e o entregável tem nome e lugar próprios em docs/medias/.
python3 -m venv .venv-manim && ./.venv-manim/bin/pip install -q manim

# 3. Só agora a cadeia.
npx tsx scripts/manim/export-campanhas.ts  > scripts/manim/campanhas.json
npx tsx scripts/manim/export-pontos.ts     > scripts/manim/pontos.json
npx tsx scripts/manim/export-velas.ts      > scripts/manim/velas.json
npx tsx scripts/manim/export-velas.ts 1768 > scripts/manim/velas-athletico-pr.json
./.venv-manim/bin/manim -qh scripts/manim/campanhas.py Campanhas
./.venv-manim/bin/manim -qh scripts/manim/pontos.py    Pontos
cp media/videos/campanhas/1080p60/Campanhas.mp4 docs/medias/campanhas-palmeiras-flamengo.mp4
cp media/videos/pontos/1080p60/Pontos.mp4       docs/medias/pontos-20-clubes.mp4

# 3b. As DUAS velas escrevem no MESMO media/videos/velas/1080p60/Velas.mp4: o
#     arquivo tem o nome da CENA, não o do clube. Copie uma antes de renderizar
#     a outra — juntar os dois `manim` e depois os dois `cp` faz sair o mesmo
#     clube nos dois arquivos, com os dois nomes certos e nada acusando.
./.venv-manim/bin/manim -qh scripts/manim/velas.py Velas
cp media/videos/velas/1080p60/Velas.mp4 docs/medias/velas-fluminense.mp4
VELAS_JSON=$PWD/scripts/manim/velas-athletico-pr.json \
  ./.venv-manim/bin/manim -qh scripts/manim/velas.py Velas
cp media/videos/velas/1080p60/Velas.mp4 docs/medias/velas-athletico-pr.mp4

# 3c. Os QUATRO gifs, dos mp4 já copiados e nunca de media/. Os comandos estão na
#     seção "O gif", com o porquê de cada parâmetro.

npx tsx scripts/manim/thumbnail.ts
npx tsx scripts/manim/thumbnail-pontos.ts
```

**Antes de tudo isso, pergunte se há o que regerar:** `./scripts/sync-schedule.sh
--check`. Se nada estiver devido, a cadeia redesenha a mesma temporada e o mp4
volta com bytes diferentes só pelo encoder — churn, exatamente o re-shoot
desnecessário que o `Screenshots-unaffected:` existe para evitar. O que obriga a
regerar é `tests/manim-renders.test.ts` ficar vermelho, e ele só fica num sync.

Depois **edite `docs/medias/RENDERED`** com o novo `SNAPSHOT_DATE`, no mesmo
commit. E confira os nomes: a capa da história de cada vídeo é nomeada pelos
números que imprime, então `-miniatura-11-ao-1.png` e `-miniatura-38-pontos.png`
viram outros arquivos quando a temporada anda — o antigo tem que sair do
`git`, e o `RENDERED` tem que nomear o novo, senão o segundo teste acusa.

### O que o `thumbnail-pontos.ts` registra

- **O que liga uma chip a uma linha é a POSIÇÃO, e a cor só confirma.** Isso saiu
  de olhar o quadro, não de raciocinar: a capa da história marca o 1º e o 20º, e
  esta paleta desenha o Palmeiras em `#1FBF6B` contra a Chapecoense em `#2FD0A8`
  — um verde e um verde-azulado, distantes o bastante numa coluna de vinte linhas
  e nada distantes quando são as duas únicas marcas do desenho. Num gráfico de
  pontos o ordinal é inequívoco por construção: o 1º **é** a linha de cima e o
  20º **é** a de baixo. Consertar na paleta da cena era o outro caminho e é pior
  — mexeria numa cor de um vídeo já renderizado e commitado para comprar uma
  distinção que um dado já no payload dá de graça.
- **As chips são uma coluna, e foi um guarda que decidiu isso.** Três lado a lado
  chegavam a 788px contra um gráfico que começa em 690 — legíveis, e por cima do
  leque. O `check` de cada variante mede a caixa renderizada e **recusa**: as
  falhas de uma capa são geométricas, e nem o `tsc` nem o tipo do payload nem
  ninguém que não abra o arquivo consegue vê-las. Ele acusou na primeira execução.
- **Todos os 20 são desenhados, e os que as chips nomeiam ficam em cheio.** A
  divisão é o assunto, então nenhuma linha some; sem o destaque, porém, quem lê
  tem vinte curvas anônimas e três números sem nada ligando os dois.
- **A ordem vem da classificação que o payload carrega**, nunca de reordenar por
  pontos aqui: os critérios de desempate da CBF é que decidem um lugar, e uma
  segunda implementação deles é como a capa passa a discordar do próprio vídeo.

## Duas regras que valem para as três cenas

- **As três carregam o endereço do site**, do começo ao fim: um quadro recortado
  por alguém tem de dizer de onde veio. Sem o `https://`, que é como se lê e se
  digita um endereço, e escrito em cada cena porque o `APP_URL` mora no `.env`
  do host — gitignored, ausente da estação onde a cena é desenhada. Fica no
  único retângulo grande e vazio de cada quadro, que é embaixo da coluna da
  direita nas três.

- **`INK_FAINT` é RÉGUA e nunca TEXTO, e isso foi medido nos pixels do mp4.**
  A paleta destas cenas é escrita à mão, então o `npm run test:tokens` nunca
  olhou para ela e nada acusou. O que estava em texto, antes:

  | | medido | onde |
  |---|---|---|
  | `velas.py` — tiques de pontos e de rodada | **3,2:1** | 18px, sobre o fundo |
  | `velas.py` — chaves dos cards | **2,9:1** | sobre o card |
  | `pontos.py` — **a coluna da classificação** (`1º … 20º`) | **3,1:1** | a legenda do vídeo inteiro |
  | `campanhas.py` — tiques de rodada e `… pts · … jogos` | mesmo tom, mesmo fundo | |
  | comparação: tiques de posição, que já eram `INK_SOFT` | **7,5:1** | |

  O piso deste projeto para texto é 4,5. A do `pontos.py` é a pior das três
  porque não é um tique de eixo: é a chave que faz vinte linhas serem legíveis, e
  o próprio README argumenta que ela precisa funcionar *durante* o vídeo. Duas
  coisas que só a medição no quadro mostra — um glifo estreito perde as hastes na
  compressão, então o `0` sozinho cai para **2,96** contra 3,36 do `50 pts`, e um
  quadro de 1080p num celular põe esses 18px em cerca de 2 mm.

  Agora todo rótulo é `INK_SOFT` (7,2 a 7,8:1 remedidos) e `INK_FAINT` ficou com
  grade, moldura e filete. A única exceção é o **ponto de origem** do `pontos.py`,
  que é marca e não texto: 3,2:1 passa o piso de 3 que objetos gráficos têm.

## O que é decisão e o que é mecânica

- **O JSON é gerado, não editado.** `rank-history.ts` e `matches.ts` são a
  fonte; a cena não recalcula nenhuma classificação. Um número errado aqui está
  errado no site também — que é exatamente o que se quer de uma peça de
  divulgação.
- **O eixo y é a divisão inteira, 1º no topo.** É a regra do
  `rank-candles-core.ts`: a campanha de um líder deixa dois terços do desenho
  vazios, e é isso que dá sentido às faixas do G4 e do Z4. Uma escala por clube
  faria quem oscila entre 1º e 3º parecer quem sobe do 20º.
- **A moldura é desenhada à mão, sem `Axes`.** O Manim desenha a linha do eixo x
  em y=0 nas coordenadas dos dados; como a posição é plotada negada (para o 1º
  ficar no topo), o zero cai **fora** do intervalo e o eixo — com ponta de seta —
  é desenhado rente ao topo, atravessando a linha do líder. `at()` é todo o
  sistema de coordenadas, e a convenção de sinal está escrita uma vez só.
- **A troca dos cards é sequenciada, nunca simultânea.** `self.play(...,
  run_time=…)` estica **toda** animação que recebe até o fim do compasso, então
  um `FadeOut` e um `FadeIn` passados lado a lado se sobrepõem o tempo inteiro e
  os dois placares da rodada ficam legíveis ao mesmo tempo. `Succession` é o que
  resolve.
- **Uma rodada sem jogo é uma ausência, não um 0 × 0.** Flamengo não tem partida
  encerrada na rodada 4 no snapshot; o card diz "sem jogo nesta rodada" e a linha
  segue, porque a posição existe de qualquer modo.
- **O resumo final fica dentro da área vazia do gráfico**, não ao fim de cada
  linha: em 1º e 2º as duas linhas terminam a poucos pixels uma da outra, e uma
  etiqueta ao lado de cada uma se sobrepõe à vizinha e à coluna de cards.

### `pontos.py`

- **A classificação ao lado é a legenda, e uma etiqueta no fim da linha não
  seria.** Vinte linhas precisam de uma chave que funcione *durante* o vídeo; um
  rótulo no fim de cada curva só existe no último segundo, e até lá o desenho é
  vinte curvas anônimas. A tabela reordenando também é a comparação que o
  gráfico não faz: os pontos dizem a distância, a ordem diz quem está na frente.
- **A coluna de posições é fixa e as LINHAS é que se movem por ela.** Desenhar
  `1º…20º` dentro de cada linha animaria vinte ordinais a cada rodada para
  soletrar as mesmas vinte palavras.
- **O eixo y começa no zero e o x na rodada 0.** Pontos são cumulativos, então
  todo clube parte da mesma origem e o desenho é um leque abrindo de um ponto só
  — que é a forma de uma temporada. Um eixo cortado em 14–52 faria o lanterna
  parecer não ter nada, que é a regra do zero que o `sparklineBars` já registra
  no `CLAUDE.md`.
- **A paleta é distinguível primeiro e fiel ao clube em segundo.** Cinco clubes
  desta divisão vestem vermelho, quatro vestem preto e branco, três vestem azul:
  uma paleta fiel às camisas desenha quatro linhas indistinguíveis e chama isso
  de precisão. Cada clube fica com o tom livre mais próximo do seu — o Mirassol
  mantém o amarelo, o Palmeiras o verde, o Flamengo o vermelho, o Fluminense o
  grená — e quem chegou depois anda na roda. Os alvinegros ficam com os cinzas,
  que é o mais perto que um fundo escuro permite: o preto é o fundo.
- **O resumo final vai no canto de CIMA à esquerda**, não embaixo à direita, que
  é onde ele parece pertencer. Pontos só sobem, então a região vazia do desenho
  é a de *cima*: na rodada 5 ninguém tem 45 pontos e ninguém nunca terá. O canto
  de baixo à direita parece vazio e não está — toda linha passa por ali saindo
  da rodada 1.
- **O número de jogos entra no resumo.** Dois clubes na mesma rodada podem ter
  jogado quantidades diferentes de partidas, e uma diferença de pontos lida sem
  isso é uma leitura errada — a mesma armadilha que o `live-core.ts` recusa para
  o minuto da partida.

### `velas.py`

- **A cor carrega o RESULTADO e a geometria carrega a DIREÇÃO**, e não são o
  mesmo canal de propósito: as rodadas que valem a pena olhar são aquelas em que
  os dois discordam, e vencer e mesmo assim cair uma posição é um domingo comum.
  É por isso que o corpo precisa de uma terceira marca dizendo por qual ponta
  abriu — o toco à esquerda. Vinte e cinco tocos traçam a mesma linha que o
  `campanhas.py` desenha, porque cada rodada abre onde a anterior fechou.
- **O pavio da rodada 1 é largo, e não é defeito.** Antes do primeiro jogo os
  clubes empatados em nada são ordenados por nome — a tabela mostrou o clube ali
  de verdade. Um caso especial aqui esconderia uma rodada de dado real. Ele é
  também o vizinho da esquerda do painel de resumo, que é o que decide a largura
  daquele painel.
- **A barra de pontos é o TOTAL e a tampa clara é o ganho.** Pontos são
  cumulativos, então o eixo começa no zero e a altura é a temporada inteira. Uma
  derrota não acrescenta nada e a barra não cresce — leitura honesta, e é
  exatamente o que a vela ao lado mostra pelo outro canal.
- **Nenhum dos dois painéis tem legenda de eixo dentro dele.** A primeira versão
  escrevia "posição" no canto superior esquerdo da caixa e a palavra caía em cima
  do pavio da rodada 1; acima da caixa não há espaço, porque ali está o subtítulo.
  O eixo de posições não precisa de legenda — `1º … 20º` já diz —, e a unidade do
  outro anda no tique de cima (`50 pts`).
- **As etiquetas do G4 e do Z4 ficam FORA da moldura**, na margem entre o gráfico
  e a coluna de cards. Dentro dela não existe canto seguro: o `campanhas.py` põe
  a do G4 rente à borda de baixo da faixa, e para um clube que termina em 4º as
  últimas velas passam por cima dela.
- **`INK_FAINT` é régua e nunca texto, e isso foi MEDIDO no quadro codificado.**
  Os tiques do painel de pontos e das rodadas nasceram nesse tom e entregavam
  **3,2:1** sobre o fundo, num tipo de 18px; as chaves dos cards, **2,9:1**
  sobre o card. Os `1º … 20º` logo acima deles são `INK_SOFT` a **7,5:1** — o
  mesmo papel em dois tokens, e o mais apagado justamente no eixo cujos números
  não se explicam sozinhos (`0 … 50` não é `4º`). A medida saiu de amostrar os
  pixels do mp4, não da paleta: o `0` sozinho cai para **2,96** porque um glifo
  estreito perde as hastes na compressão, então a etiqueta mais curta é a mais
  frágil. **A paleta desta cena é escrita à mão** — o `test:tokens` do projeto
  não olha para ela, e é por isso que nada acusou.

- **A chave da vela não é opcional.** Corpo, pavio e toco são marcas que quem lê
  uma tabela de futebol não encontra em outro lugar; sem a chave o desenho é
  bonito e ilegível. Ela fica embaixo dos dois painéis e fora deles, pela mesma
  razão que a chave de zonas da Classificação fica fora da `Surface` que rola.
