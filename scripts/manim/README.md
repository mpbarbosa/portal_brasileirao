# Animações em Manim

Duas cenas, duas leituras da mesma campanha:

- **`campanhas.py`** — dois clubes rodada a rodada, a **posição** desenhada como
  linha sobre a divisão inteira, e ao lado o jogo daquela rodada com o
  resultado.
- **`pontos.py`** — os **20 clubes** rodada a rodada, os **pontos** no eixo y e a
  rodada no eixo x, com a classificação ao lado se reordenando a cada rodada.

Nenhuma das duas recalcula classificação: as duas leem `rank-history.ts`, que já
carrega posição *e* pontos por rodada. Um número errado aqui está errado no site
também.

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
```

`export-pontos.ts` não aceita argumento: a cena é a divisão inteira, e escolher
um subconjunto dos 20 seria outro desenho.

`export-campanhas.ts` aceita dois códigos de clube (`1769` Palmeiras, `1783`
Flamengo são o padrão) — são os **códigos numéricos do provedor**, nunca a
`tla`, pela razão que o CLAUDE.md registra: Corinthians e Coritiba compartilham
`COR`.

Os vídeos saem em `media/videos/<cena>/1080p60/<Cena>.mp4`. `-ql` (480p15)
renderiza em segundos e serve para conferir o enquadramento.

## Os renders commitados

**`docs/videos/campanhas-palmeiras-flamengo.mp4`** (23s, 3,3 MB) e
**`docs/videos/pontos-20-clubes.mp4`** (21s, 4,4 MB) — ambos 1920×1080, 60fps —
são os vídeos prontos, versionado junto do resto do projeto como os slides
em `docs/carrossel/` e as capturas em `docs/screenshots/`.

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

## As miniaturas

**`docs/videos/campanhas-palmeiras-flamengo-miniatura.png`** e
**`-miniatura-11-ao-1.png`** — 1280×720, as capas que o YouTube mostra no lugar
de um frame qualquer da animação (os primeiros segundos são um gráfico vazio).
Uma nomeia o confronto, a outra a história; a segunda envelhece mal de
propósito, porque `1º` é uma afirmação sobre a rodada 25 em tipo de 96px.

**`docs/videos/pontos-20-clubes-miniatura.png`** e
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

Os seis artefatos de `docs/videos/` — dois mp4 e quatro capas — são **velhos por
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
- `docs/videos/RENDERED` guarda de qual snapshot cada artefato foi desenhado. É o
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
#    dele, e o entregável tem nome e lugar próprios em docs/videos/.
python3 -m venv .venv-manim && ./.venv-manim/bin/pip install -q manim

# 3. Só agora a cadeia.
npx tsx scripts/manim/export-campanhas.ts > scripts/manim/campanhas.json
npx tsx scripts/manim/export-pontos.ts    > scripts/manim/pontos.json
./.venv-manim/bin/manim -qh scripts/manim/campanhas.py Campanhas
./.venv-manim/bin/manim -qh scripts/manim/pontos.py    Pontos
cp media/videos/campanhas/1080p60/Campanhas.mp4 docs/videos/campanhas-palmeiras-flamengo.mp4
cp media/videos/pontos/1080p60/Pontos.mp4       docs/videos/pontos-20-clubes.mp4
npx tsx scripts/manim/thumbnail.ts
npx tsx scripts/manim/thumbnail-pontos.ts
```

**Antes de tudo isso, pergunte se há o que regerar:** `./scripts/sync-schedule.sh
--check`. Se nada estiver devido, a cadeia redesenha a mesma temporada e o mp4
volta com bytes diferentes só pelo encoder — churn, exatamente o re-shoot
desnecessário que o `Screenshots-unaffected:` existe para evitar. O que obriga a
regerar é `tests/manim-renders.test.ts` ficar vermelho, e ele só fica num sync.

Depois **edite `docs/videos/RENDERED`** com o novo `SNAPSHOT_DATE`, no mesmo
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
