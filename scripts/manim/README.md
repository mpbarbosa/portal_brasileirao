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

**O procedimento está em `.claude/skills/campanha-video/SKILL.md`** — a ordem
dos passos, o que a falha de cada um parece e quais conferências pegam alguma
coisa. Este arquivo é a referência do *porquê*: leia-o antes de mexer numa cena.
A divisão é a mesma que o `find-highlights` já faz com o `highlights.ts`.

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

Hoje são três: `1765` Fluminense em `velas.json`, `1768` Athletico-PR e `1777`
Bahia nos seus próprios arquivos — conte os `velas*.json`, não esta frase.

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
renderiza em segundos e serve para conferir o enquadramento — e para conferir
LAYOUT sem esperar o vídeo inteiro, `-s` desenha só o último quadro, que é o que
carrega os dois gráficos cheios, os dois cards e o painel do fecho ao mesmo
tempo.

## Os cortes verticais, para o Instagram

`VELAS_ASPECT` escolhe o quadro: **`4:5`** (1080×1350) para o **feed** e
**`9:16`** (1080×1920) para os **Reels**. Sem a variável nada muda; um valor
que não seja um dos três **aborta** em vez de cair no 16:9 em silêncio.

```sh
VELAS_ASPECT=4:5  VELAS_JSON=$PWD/scripts/manim/velas-palmeiras.json \
  ./.venv-manim/bin/manim -qh scripts/manim/velas.py Velas
VELAS_ASPECT=9:16 VELAS_JSON=$PWD/scripts/manim/velas-palmeiras.json \
  ./.venv-manim/bin/manim -qh scripts/manim/velas.py Velas
```

Os dois compartilham **todo** o conteúdo — a coluna única, o card fundido, a
chave em duas linhas ao lado do desenho, a manchete do painel quebrada. O
`9:16` só move geometria em cima disso.

**Que ele é o de sempre foi MEDIDO e não deduzido**, porque é a única coisa que
justifica um interruptor em vez de uma segunda cena: renderizado o `-ql` inteiro
a partir do `velas.py` do `origin/main` e a partir deste, os dois mp4 saem
**byte a byte iguais** — conferido em dois clubes, Palmeiras e Botafogo, porque
o texto do painel do fecho difere entre eles e um deles sozinho não exercita o
ramo novo. Refaça isso antes de acreditar em qualquer mudança aqui:

```sh
git show origin/main:scripts/manim/velas.py > scripts/manim/velas_orig.py
for f in velas_orig velas; do VELAS_JSON=$PWD/scripts/manim/velas-botafogo.json \
  ./.venv-manim/bin/manim -ql -o chk_$f scripts/manim/$f.py Velas; done
md5sum media/videos/velas*/480p15/chk_*.mp4   # têm de bater
rm scripts/manim/velas_orig.py
```

**E confira o 4:5 contra o `HEAD` do mesmo jeito ao mexer no vertical**, porque
foi assim que este arquivo pegou uma regressão que nenhum olho pegaria: um
refactor que centralizou coisas em `CENTRE_X` moveu a chave **10px**, porque ela
nunca foi centrada no QUADRO — ela é centrada no GRÁFICO,
`(PLOT_LEFT + PLOT_RIGHT) / 2`, que no 4:5 vale 0,075 e não 0. O md5 do vídeo
já commitado é o que disse isso; o quadro parecia igual.

```sh
git show HEAD:scripts/manim/velas.py > scripts/manim/velas_head.py
for f in velas_head velas; do VELAS_ASPECT=4:5 \
  VELAS_JSON=$PWD/scripts/manim/velas-botafogo.json \
  ./.venv-manim/bin/manim -ql -o s45_$f scripts/manim/$f.py Velas; done
find media/videos -name 's45_*.mp4' -exec md5sum {} \;
rm scripts/manim/velas_head.py
```

**O 9:16 tem 4,22 unidades A MAIS que o 4:5 e é o corte APERTADO.** Isso é a
coisa a entender antes de mexer nele: o feed não sobrepõe nada sobre a mídia,
enquanto o Reels come ~250px no topo, ~480px embaixo (legenda, @, áudio) e
~140px na trilha de ação da direita. Sobram **1190px — 8,81 unidades contra as
10,0 inteiras do feed.**

Daí as três diferenças, e nenhuma delas é estética:

- **A coluna anda para a esquerda** (`CENTRE_X`) e estreita, para sair de
  debaixo da trilha. Medido sobre o render com as zonas sobrepostas: com a
  caixa do 4:5 ficavam **5.084 px** de conteúdo debaixo dela — as etiquetas do
  G4 e do Z4, o rótulo `rodada` e, o que importa, a **coluna de valores do
  card**. Um `1º · 1º` coberto pelo botão de comentar é o card mentindo. Depois
  do ajuste são **0 px** ali e **0 px** na faixa do topo.
- **Os gráficos ficam MAIORES que no 4:5** — 2,75 unidades de posições contra
  2,51 — porque a chave e o crédito desceram e liberaram a faixa segura.
- **A chave e o crédito ficam ABAIXO da linha segura**, nessa ordem e de
  propósito: são as duas coisas que a legenda do post pode repetir. **A legenda
  precisa repetir a chave**; sem isso o corte 9:16 publica uma vela sem dizer o
  que é o corpo e o que é o pavio, que é exatamente o que o `build_key` recusa.

**Os números da UI são estimativas de terceiros, não medidas nossas** — o
Instagram não publica um contrato — e a escolha aqui é conservadora nos dois
eixos. Se a trilha for mais estreita do que 140px, o custo é uma faixa de fundo
vazia à direita, que ninguém vê; se for mais larga, o custo seria um valor
coberto. Errar para o lado barato é deliberado.

**Nenhum tipo encolhe, e é isso que o corte compra.** 1080×1350 e 1920×1080 têm
a mesma densidade se `frame_width`/`frame_height` forem escritos à mão como
1080/135 e 1350/135 — 135 px por unidade nos dois. O que muda é que a coluna da
direita desce para baixo dos gráficos em vez de dividir a linha com eles.

⚠️ **O manim 0.21.0 NÃO deriva `frame_width` da razão dos pixels.** Pedir
`-r 1080,1350` sozinho deixa o quadro em 14,22 × 8,0 e a cena inteira sai pela
borda **sem erro nenhum**. Os dois valores são escritos no `velas.py`; se alguém
"simplificar" um deles, é assim que falha.

**Duas coisas saem do quadro no 4:5, e as duas por serem ditas em outro lugar
da mesma tela** — o raciocínio inteiro está no docstring do `build_round_card`.
Em resumo: `pontos na temporada` sai porque o gráfico de pontos está logo acima
com o eixo rotulado, e a fileira de amostras V/E/D da chave sai porque o card
nomeia o resultado na cor dele vinte e cinco vezes seguidas. Os dois cards e o
título da rodada viram **um** card de duas colunas — é a largura que paga a
altura, e a altura é o que falta.

**O painel do fecho é a única tipografia que encolhe**, e a manchete dele quebra
em duas linhas. Ele não é lido de longe como o resto: ele tem de caber no vazio
do gráfico de posições, e esse vazio perdeu 23% da largura. Numa linha o painel
mede 4,19 unidades num gráfico de 5,85 e `summary_anchor` não tem para onde ir —
medido no **Botafogo**, a campanha de maior amplitude da temporada (1º a 18º),
onde ele cobria a descida inteira, que é o assunto do vídeo dele. Quebrado, mede
3,16 (54% do gráfico, contra 60% que ele já ocupa no 16:9) e a descida aparece.
Renderize o Botafogo, não o Palmeiras, ao mexer nisso: o Palmeiras passou a
temporada no terço de cima e o painel nunca teve de desviar de nada.

**Não há gif e não há capa.** O Instagram não aceita gif, e num post de feed ele
escolhe a capa de dentro do próprio vídeo — a `-miniatura.png` ao lado é 16:9 e
é do YouTube. O vídeo é mudo, o que o Instagram trata como *áudio original* e
alcança menos; isso é uma escolha de publicação, não uma propriedade da cena.

## Os renders commitados

**A regra é uma só: um vídeo de UM clube mora em `docs/medias/<clube>/`; um
vídeo que não é de um clube só fica no nível de cima.** Não há mais exceção
nenhuma, e essa frase custou três correções para poder ser escrita assim.

Soltas ficam as duas cenas que não são de um clube:
**`campanhas-palmeiras-flamengo.mp4`** (23s, 3,3 MB) e
**`pontos-20-clubes.mp4`** (21s, 4,4 MB). Em pasta fica **um `<clube>/` para cada
clube que tem vídeo**, com o seu `velas-<clube>.mp4` de 21,1s, o gif, a capa e o
`-youtube.md`. Quantos são e quais são, `ls docs/medias/` responde — esta frase
de propósito não responde, e o parágrafo abaixo diz por quê. Os vídeos são
1920×1080 60fps **menos os cortes verticais**: o `-45.mp4` do feed do Instagram
é 1080×1350 e o `-916.mp4` dos Reels é 1080×1920 — leia o sufixo, ou pergunte ao
`ffprobe`, em vez de supor pela pasta. Todos são versionados junto do resto do projeto como os slides em
`docs/carrossel/` e as capturas em `docs/screenshots/`.

**Conte o diretório antes de assumir uma convenção**, porque esta seção já errou
a contagem duas vezes seguidas e as duas passaram batido: dizia *"os dois
últimos moram numa pasta por clube e os quatro primeiros não"* enquanto
`flamengo/` e `corinthians/` já existiam e não apareciam na lista, e depois
*"sobram DOIS clubes soltos"* enquanto eles eram movidos. Uma contagem escrita em
prosa não tem portão nenhum em cima dela — e note que o erro não foi de
desatenção nas duas vezes: uma contagem envelhece sozinha, sem ninguém tocar na
frase. Quem tem portão é `docs/medias/RENDERED`, que lista cada artefato pelo
caminho relativo a `docs/medias/` e que `tests/manim-renders.test.ts` confere nos
dois sentidos. Se precisar do número, leia o `RENDERED`; se precisar do tamanho,
leia o disco.

**Foram TRÊS, e a terceira é a mais instrutiva porque quase passou.** O commit
que fechou esta convenção trazia, aqui mesmo, *"em pasta ficam os sete velas"*
seguido dos sete nomes — escrito e conferido enquanto eram mesmo sete. Entre
abrir a PR e mergear, o São Paulo entrou pela #401 e viraram oito. Só a
reconferência no instante do merge pegou; a PR estava verde, e o
`tests/manim-renders.test.ts` estava verde também, porque nada nele lê prosa. Ou
seja: quem escreveu a regra "não conte aqui" errou a contagem no mesmo commit em
que a escreveu, e o que salvou não foi cuidado, foi reler antes de mergear em vez
de confiar na leitura de vinte minutos antes. Por isso o parágrafo acima manda no
`ls` em vez de listar.

**`palmeiras/` e `flamengo/` carregam LINKS SIMBÓLICOS para o
`campanhas-palmeiras-flamengo.*`**, que é um vídeo de dois clubes: ele pertence
ao Palmeiras e ao Flamengo ao mesmo tempo, então arquivá-lo dentro da pasta de
um dos dois afirmaria que é sobre aquele. Os bytes ficam soltos em
`docs/medias/`, onde os dois clubes alcançam, e o link é o que faz cada uma das
duas pastas completa — os dois lados, porque um só seria a afirmação que o
parágrafo acaba de recusar. `tests/manim-renders.test.ts` **ignora links** de propósito:
um alias não é um artefato, e uma segunda linha no `RENDERED` para os mesmos
bytes seria uma segunda alegação sobre uma coisa só, capaz de discordar da
primeira.

**Cada clube é um artefato a mais, e esse é o preço do `velas.py`.**
Ele desenha um clube por run, então cada clube que valha um vídeo acrescenta um
mp4, um payload, uma linha no `RENDERED` e mais um degrau na cadeia de
regeneração — e a cadeia é justamente onde um clube esquecido não aparece, porque
o `RENDERED` recebe a data nova de qualquer jeito. As outras duas cenas não têm
esse custo: uma fixa dois clubes e a outra é a divisão inteira.

**Todo `velas-*.mp4` tem capa, e é a decisão anterior cumprindo o que ela
própria previa** — não uma reversão. Este parágrafo dizia que nenhum tinha, que
isso era decisão e não pendência, e que *"quando um destes for para o YouTube…
seria **um por clube**, pela mesma razão que o vídeo é"*. É o que aconteceu:
cada `<clube>/velas-<clube>-miniatura.png` tem 1280×720 como as outras, e a
regra vale para o próximo clube sem ninguém reescrever esta frase — que é
exatamente o que a contagem anterior aqui ("são três capas") não fazia.

**Elas não são o desenho das outras duas cenas.** As capas do `campanhas` e do
`pontos` são um layout próprio — manchete à esquerda, gráfico à direita — porque
os primeiros segundos daqueles vídeos são um gráfico vazio. Estas são o **quadro
final da própria cena** com o painel de resumo por cima: uma vela cheia já é a
temporada inteira, então não há nada que um segundo layout diga melhor. É por
isso que `capa-core.ts` não aparece aqui — o que aquele módulo divide é a leitura
da paleta e a captura no Chromium, e nenhuma das duas é usada por uma capa que
sai do próprio render.

O preço que a decisão anterior nomeava continua de pé e agora é devido: **cada
clube é mais uma capa**, mais uma linha no `RENDERED` e mais um degrau na cadeia
de regeneração. Um quarto clube de velas deve três artefatos, não dois.

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

**Todo mp4 aqui tem gif MENOS os cortes verticais** (`-45.mp4`, `-916.mp4`) — os
dois vão para o Instagram, que não aceita gif, e um gif que nenhuma plataforma-alvo lê é peso commitado
para ninguém. Todos os que existem são 960×540 e 15fps — conte o diretório, não esta
frase:

| gif | quadros | gif | mp4 |
|---|---|---|---|
| `campanhas-palmeiras-flamengo.gif` | 343 | 5,3 MB | 3,7 MB |
| `pontos-20-clubes.gif` | 309 | 5,7 MB | 4,6 MB |
| `athletico-pr/velas-athletico-pr.gif` | 317 | 5,2 MB | 3,9 MB |
| `bahia/velas-bahia.gif` | 317 | 5,1 MB | 3,8 MB |
| `fluminense/velas-fluminense.gif` | 317 | 5,1 MB | 3,9 MB |
| `cruzeiro/velas-cruzeiro.gif` | 317 | 5,3 MB | 4,0 MB |
| `palmeiras/velas-palmeiras.gif` | 317 | 5,4 MB | 3,9 MB |

Cada um é **derivado do mp4 commitado ao lado dele**, não um segundo render: sai
daquele arquivo por dois passos de `ffmpeg`, então não tem como descrever uma
temporada diferente da que o vídeo descreve. Um `-qh` a mais só gastaria dez
minutos para produzir os mesmos quadros.

**Os três últimos nasceram de uma decisão de divulgação**, não de uma pendência
técnica: as animações vão para o Reddit, onde o gif toca sozinho no feed e serve
a subs que aceitam imagem e recusam vídeo. A ressalva vale dita: o Reddit reconverte o gif
em vídeo de qualquer jeito, então lá dentro a paleta abaixo não compra quase
nada e o mp4 subiria com melhor qualidade. O que o formato compra é todo o resto
— comentário, README, issue, chat — com um arquivo só. O plano inteiro, com o
rascunho de cada post e as regras de cada sub, está em `docs/post-reddit.md`.

```sh
# Um por vez, e NUNCA todos num laço com uma /tmp/palette.png só: a paleta
# é tirada do vídeo que ela vai colorir, e reaproveitar a de outro desenha um
# clube com as cores do vizinho sem nada acusar.
# O clube e o nome são DUAS variáveis de propósito: o vídeo mora numa pasta e
# a paleta vai para /tmp, que não tem essa pasta. Um $V só, valendo
# "athletico-pr/velas-athletico-pr", escreveria /tmp/palette-athletico-pr/... e
# o ffmpeg pararia no segundo comando, depois de já ter gasto o primeiro.
C=athletico-pr
V=velas-$C
ffmpeg -y -i docs/medias/$C/$V.mp4 \
  -vf "fps=15,scale=960:-1:flags=lanczos,palettegen=max_colors=192:stats_mode=diff" \
  /tmp/palette-$V.png
ffmpeg -y -i docs/medias/$C/$V.mp4 -i /tmp/palette-$V.png \
  -lavfi "fps=15,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle" \
  docs/medias/$C/$V.gif
```

**O gif é MAIOR que o mp4 que o gerou, em todos** — 5,2 MB contra 3,9 no
`velas-athletico-pr`, e a tabela acima diz o mesmo dos demais — com metade
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

Os artefatos de `docs/medias/` — um mp4 e um gif por cena renderizada, mais as
capas e os `-youtube.md`; conte o diretório, não esta frase — são **velhos por
construção**. São desenhados do seed e commitados (como o `og-default.png`, para
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
npx tsx scripts/manim/export-velas.ts 1777 > scripts/manim/velas-bahia.json
./.venv-manim/bin/manim -qh scripts/manim/campanhas.py Campanhas
./.venv-manim/bin/manim -qh scripts/manim/pontos.py    Pontos
cp media/videos/campanhas/1080p60/Campanhas.mp4 docs/medias/campanhas-palmeiras-flamengo.mp4
cp media/videos/pontos/1080p60/Pontos.mp4       docs/medias/pontos-20-clubes.mp4

# 3b. TODAS as velas escrevem no MESMO media/videos/velas/1080p60/Velas.mp4: o
#     arquivo tem o nome da CENA, não o do clube. Copie uma antes de renderizar
#     a próxima — juntar os `manim` e depois os `cp` faz sair o mesmo clube em
#     todos os arquivos, com todos os nomes certos e nada acusando.
./.venv-manim/bin/manim -qh scripts/manim/velas.py Velas
cp media/videos/velas/1080p60/Velas.mp4 docs/medias/fluminense/velas-fluminense.mp4
VELAS_JSON=$PWD/scripts/manim/velas-athletico-pr.json \
  ./.venv-manim/bin/manim -qh scripts/manim/velas.py Velas
cp media/videos/velas/1080p60/Velas.mp4 docs/medias/athletico-pr/velas-athletico-pr.mp4
VELAS_JSON=$PWD/scripts/manim/velas-bahia.json \
  ./.venv-manim/bin/manim -qh scripts/manim/velas.py Velas
cp media/videos/velas/1080p60/Velas.mp4 docs/medias/bahia/velas-bahia.mp4
VELAS_JSON=$PWD/scripts/manim/velas-cruzeiro.json \
  ./.venv-manim/bin/manim -qh scripts/manim/velas.py Velas
cp media/videos/velas/1080p60/Velas.mp4 docs/medias/cruzeiro/velas-cruzeiro.mp4
VELAS_JSON=$PWD/scripts/manim/velas-palmeiras.json \
  ./.venv-manim/bin/manim -qh scripts/manim/velas.py Velas
cp media/videos/velas/1080p60/Velas.mp4 docs/medias/palmeiras/velas-palmeiras.mp4

# 3c. Um gif por mp4, dos mp4 já copiados e nunca de media/. Os comandos estão na
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

- **A barra tem CONTORNO, e o `fill_opacity=0,55` do corpo não pode subir.** O
  corpo sozinho entregava **1,83:1** para o Fluminense sobre o fundo, contra o
  piso de 3 de uma marca gráfica — e **dez dos vinte clubes** do `pontos.py`
  ficavam abaixo dele em 0,55 (Fluminense 1,83 · Vitória 2,04 · Flamengo 2,16 ·
  Cruzeiro 2,30 · Atlético-MG 2,35 · Remo 2,40 · Bragantino 2,46 · Grêmio 2,74 ·
  Internacional 2,76 · Vasco 2,83). Não é o tom de um clube, é a classe inteira.

  **Subir a opacidade fecha esse número e abre um buraco pior.** Em `a=0,90`
  nenhum clube fica abaixo de 3 — e a tampa some dentro do corpo: em 22 pares
  clube×resultado a separação corpo/tampa cai de 1,67–2,73 para **1,01–1,26**. O
  vermelho do Flamengo (`#E5453A`) e o da derrota (`#E5533D`) são a mesma cor, e
  o verde do Palmeiras (`#1FBF6B`) e o da vitória (`#2ECC71`) também. **O 0,55 é
  quem separa a cor do clube da cor do resultado quando as duas coincidem** —
  ele é load-bearing, e é o oposto do que "a barra está apagada" sugere fazer.

  Clarear os tons no `CLUB_COLOURS` foi a outra opção descartada: a paleta é
  compartilhada com o `pontos.py`, onde a regra é distinguível primeiro, e um
  grená clareado o bastante encosta no rosa do Vasco e no magenta do Bragantino.
  O contorno fecha a classe **sem tocar na paleta**, então os vídeos já
  publicados continuam concordando sobre a cor de cada clube.

- **Dois pisos, dois fundos, e a subida é de VALOR.** `lift_to_floor` sobe um tom
  só até passar do piso que vale para aquela marca, sobre o fundo em que ela se
  apoia: o contorno é marca (piso 3) sobre o `SURFACE`, o `11V · 9E · 5D` do
  painel é **texto** (piso 4,5) sobre o `CARD` a 94%. Multiplicar os canais até o
  maior chegar a 255 preserva matiz e saturação exatamente; lavar no branco
  dessatura, então a lavagem é o último recurso — e com a margem recalibrada
  (abaixo) **nenhum clube chega a precisar dela**: as três subidas que restam,
  Fluminense, Cruzeiro e Flamengo, são de valor puro, com matiz e saturação
  intactos.

  **No contorno a subida não pega ninguém, e é um resultado e não um acaso.** O
  tom cru do Fluminense — o pior dos vinte sobre o `SURFACE` — entrega 3,53
  modelado, então qualquer margem abaixo de **1,177** deixa os vinte com o
  contorno na cor registrada do clube. A margem é 1,15. O `MARK_FLOOR` fica de
  pé como o piso que pegaria um clube mais escuro que o Fluminense; o que não é
  exercitado hoje é a aplicação dele à marca, e vale saber disso antes de ler o
  `self.mark` como código morto.

  Subir o contorno até o piso de TEXTO foi a primeira versão desta correção e
  está errado: dava ao Fluminense uma borda `#FB6287`, um rosa que não é mais o
  grená do clube e que faz o painel de baixo competir com o de cima. **A marca
  não deve passar do piso que a aperta.**

- **O `11V · 9E · 5D` era TEXTO na cor do clube, e entregava 2,74.** Achado ao
  consertar a barra, e pior que ela: o piso de texto é 4,5. É o
  `INK_FAINT é régua e nunca texto` outra vez, um tom adiante — o tom de um clube
  virou tinta sem ninguém medir, porque a paleta desta cena é escrita à mão e o
  `test:tokens` não olha para ela.

- **O alvo não é o piso, e a primeira medição desta perda estava ERRADA por mira,
  não por aritmética.** Ela dizia ~18% e valia `ENCODED_MARGIN = 1,30`. As quatro
  leituras que a sustentavam saíram todas de **t=18s** — um segundo dentro do
  fade com que o painel de resumo entra, que só assenta em **t=19**:

  | t | 17 | 18 | 19 | 19,5 | 20 | 20,6 | 21 |
  |---|---|---|---|---|---|---|---|
  | texto do painel | sem tinta | 4,81 | **6,11** | 6,11 | 6,11 | 6,11 | 6,11 |

  Quase toda a "perda do encoder" era a opacidade da animação. **As barras não
  têm fade**, e por isso os números de marca daquela leva estavam certos.

  **O método que isola a perda de verdade não mede o mp4 contra um modelo — mede
  o mp4 contra o PNG que o próprio manim escreveu.** `manim -qh -s` grava o
  quadro final antes de qualquer compressão; ler as **mesmas coordenadas** nos
  dois dá registro perfeito, dispensa qualquer mira e separa o h.264 do
  antialiasing do tipo desenhado a 4×, que toda leitura anterior somava. Assim,
  entregue/modelado:

  | clube | texto | marca | | clube | texto | marca |
  |---|---|---|---|---|---|---|
  | Fluminense | 0,961 | 0,955 | | Cruzeiro | 0,976 | 0,954 |
  | Athletico-PR | 0,957 | 0,964 | | Palmeiras | **0,898** | 0,905 |
  | Bahia | 0,927 | 0,934 | | | | |

  A pior perda é **10,2%**, e é do Palmeiras: o verde carrega 0,7152 da
  luminância, então o subamostrado de croma do 4:2:0 bate onde mais dói. Entre os
  clubes que a subida realmente **prende** no alvo a perda é menor (0,961 e
  0,976), mas a margem é dimensionada pela pior de todas.

  **1,15 cobre os 1,114 que a pior perda pede, e tem um segundo motivo que vale
  mais que o primeiro** — é o maior valor que ainda deixa os vinte clubes com o
  contorno na cor crua, conforme o parágrafo acima. Um alvo igual ao piso
  reprova: 1,00 entrega 4,32 para o Fluminense contra um piso de 4,5.

  A margem é um ponto de partida e nunca a prova: o valor entregue é reconferido
  **em t≥19**, no `-ss 21` que a capa já usa. Medir um clube em t=18 pode
  reprovar quem passa — o texto do Cruzeiro entrega 4,70 no quadro estável e 3,99
  um segundo antes.

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
