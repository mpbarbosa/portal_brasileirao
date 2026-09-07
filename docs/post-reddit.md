# Reddit — Portal Brasileirão

Plano de divulgação no Reddit. Escrito em 2026-09-03, ao lado de
[`post-linkedin.md`](post-linkedin.md), e **não é uma adaptação dele**: o texto do
LinkedIn é exatamente a forma que o Reddit remove.

> **As regras de cada sub não foram lidas.** O ambiente onde este arquivo foi escrito
> não alcança o reddit.com. Abra a barra lateral de cada comunidade e leia as regras
> antes de publicar — em várias delas há filtro automático por idade e karma da conta,
> e o post some sem aviso nenhum.

---

## 1. Por que o post do LinkedIn não serve

O corpo do LinkedIn tem, em ordem: uma lista de funcionalidades com marcadores de
emoji, uma lista de stack, uma pergunta de engajamento, `Link nos comentários.` e cinco
hashtags. Cada um desses cinco itens é, no Reddit, um sinal de anúncio:

- **Marcadores `•` e listas de stack** — lidos como release note, não como conversa.
- **Hashtags** — não existem no Reddit; são a assinatura de quem colou de outra rede.
- **`Link nos comentários`** — hábito do LinkedIn (que pune link no corpo). No Reddit
  esconder o link parece isca. O link vai **no corpo**, salvo se a sub proibir links.
- **A pergunta final de engajamento** — funciona lá, soa a marketing aqui.

O Reddit premia uma coisa só: **o artefato**. Uma imagem, um número, uma história de
implementação. O site é a consequência, não o assunto.

---

## 2. Três públicos, três posts diferentes

Nada de um texto só distribuído em cinco subs. Cada público quer uma coisa distinta, e
publicar o mesmo título em várias comunidades no mesmo dia é o gatilho clássico de
shadowban.

### A. Torcedor brasileiro (pt-BR) — o gancho é a vela da campanha

Subs: **r/futebol** (a maior geral), e sobretudo as **subs de clube** — r/Corinthians,
r/SEPalmeiras, r/Flamengo, r/saopaulofc, r/Gremio, r/Internacional, r/Fluminense,
r/Botafogo, r/CRVascodaGama, r/atleticomineiro, r/Cruzeiro, r/BahiaEC…

Zero tecnologia. Ninguém ali liga para React. O gancho é a pergunta que o painel do
clube responde e que nenhuma tabela responde: **por quantas posições o time passou
dentro da rodada.**

**As subs de clube são o maior rendimento e o menor risco** — comunidade pequena,
tolerante com quem fala do próprio time, e você posta o painel *daquele* clube. Mas:
uma por semana, nunca várias no mesmo dia, e sempre com a imagem do clube certo.

### B. Dev brasileiro (pt-BR) — **r/brdev**

Aqui o site é o pretexto; o assunto é a engenharia. Os ângulos que geram discussão de
verdade, em ordem de força:

1. **O provedor devolve registros que andam para trás.** Uma partida `FINISHED 1-1`
   volta a `TIMED` sem placar quatro minutos depois, com `lastUpdated` treze horas mais
   velho — e na *mesma* resposta outra partida anda para a frente, então "fica com a
   resposta mais nova" não resolve. E depois a variante em que o registro quebrado vem
   **mais novo**, em que frescor não é correção. É uma história boa, é rara, e é
   verificável no repositório.
2. **Deploy sem credencial de longa duração e sem SSH de entrada**, numa t3.micro, com
   volta atrás automática quando a versão nova não responde.
3. **A lógica pura em módulos sem I/O** — dá para testar critério de desempate sem rede
   e sem mock.
4. **Ter dirigido o Claude Code de ponta a ponta.** Ver §5: é ao mesmo tempo o maior
   gancho e o maior risco desta lista.

### C. Dev internacional (EN)

- **r/dataisbeautiful** — a melhor porta em inglês, porque **o post é a imagem** e o
  idioma do site deixa de importar. Exige flair `OC` e um comentário do autor dizendo
  a fonte dos dados e a ferramenta.
- **r/SideProject** — tolerante com divulgação, tráfego morno, comentários rasos.
- **r/webdev** — só no **Showoff Saturday**. Fora disso, remoção.
- **r/reactjs** — tem regra própria para vitrine; normalmente é a thread semanal.

**Atrito real:** o site é inteiramente em pt-BR. Quem vier de sub em inglês cai numa
página que não lê. Ou você diz isso na primeira linha ("PT-BR, Brazilian league"), ou
escolhe a sub onde a imagem basta — que é r/dataisbeautiful.

---

## 3. Mecânica que decide se o post aparece

- **Idade e karma da conta.** Muitas subs removem automaticamente conta nova ou de
  karma baixo, sem notificar. Se `/u/<sua conta>` for nova, gaste duas semanas
  comentando em coisas alheias antes de postar qualquer coisa própria.
- **Post de texto com a imagem, não post de link.** Um post que é só uma URL lê-se como
  drive-by e rende menos.
- **Diga que é seu, na primeira linha.** "Fiz isto" — esconder a autoria é o caminho
  mais rápido para o ban, e é desonesto. O Reddit exige a divulgação.
- **O título é 90% do resultado.** Sem marca no título, sem "confira", sem emoji.
- **Horário:** 19h–22h (BRT) para as subs em português; 8h–10h ET para as em inglês.
- **Fique nos comentários nas primeiras 3 horas.** Velocidade de comentário é o que
  empurra o post no ranking, mais do que os upvotes.
- **Nunca apagar e repostar**, e nunca o mesmo título em várias subs no mesmo dia.
- **A prévia do link já está correta** — `public/og-default.png` é gerado e commitado,
  então o cartão do Reddit renderiza. Confira depois de postar.

---

## 4. Sequência de quatro semanas

| Semana | Onde | O quê |
|---|---|---|
| 0 | — | Comentar, sem postar nada próprio. Confirmar que a conta passa os filtros. |
| 1 | r/brdev | A história do provedor que anda para trás. O site aparece de passagem. |
| 2 | sub do seu clube | O painel daquele clube, imagem primeiro. |
| 3 | r/dataisbeautiful | A vela da campanha, flair OC, comentário com fonte e ferramenta. |
| 4 | r/futebol + outra sub de clube | Só se as anteriores tiverem corrido bem. |

Se a semana 1 for removida, pare e leia a regra que a removeu antes de seguir.

---

## 5. "Feito dirigindo o Claude Code" — onde dizer e onde calar

É a frase mais forte e mais perigosa do material.

- **r/brdev: diga, e diga primeiro.** Rende discussão — parte dela hostil, e a hostil
  também é engajamento. O que sustenta a frase não é o modelo: é a disciplina em volta
  (lógica isolada, testes perto, um documento no repositório com o porquê de cada
  decisão). Leve os números como prova, não como propaganda.
- **Subs de futebol: não mencione.** Não interessa a ninguém ali.
- **Subs de dev em inglês: cuidado.** Várias passaram a remover automaticamente post
  identificado como feito com IA. Em r/dataisbeautiful, a regra é sobre a ferramenta do
  gráfico — responda o que a ferramenta é, sem fazer disso o assunto.

---

## 6. O formato: GIF animado

Decidido: as animações vão para o Reddit como **GIF**, não como mp4.

**Uma ressalva, dita uma vez e depois seguindo em frente:** o Reddit reconverte
um GIF enviado num vídeo em laço, mudo, com autoplay — então, *para quem vê no
Reddit*, a otimização de paleta abaixo não compra quase nada, e o mp4 subiria
nativamente com melhor qualidade. O que o GIF compra, e que o mp4 não compra, é
tudo o que está **fora** do Reddit com o mesmo arquivo: comentário, README,
issue, Discord, Telegram, WhatsApp, e as subs que aceitam imagem e recusam
vídeo. Um artefato para todos os destinos é uma razão suficiente. Segue o GIF.

### O que existe hoje

**Todos têm GIF, todos commitados** — PR #362 (`95557a9`) renderizou os três que
faltavam com a receita do `scripts/manim/README.md`, sem tocar em cena nenhuma,
e a corrida de barras acrescentou o quinto. Conte `docs/medias/`, não esta
tabela:

| arquivo | mp4 | GIF | duração |
|---|---|---|---|
| `velas-athletico-pr` | 3,8 MB | **5,2 MB** | 21,1 s |
| `velas-fluminense` | 4,0 MB | **5,1 MB** | 21,1 s |
| `campanhas-palmeiras-flamengo` | 3,7 MB | **5,3 MB** | 22,9 s |
| `pontos-20-clubes` | 4,6 MB | **5,7 MB** | 20,6 s |
| `barras-20-clubes` | 4,7 MB | **6,5 MB** | 20,5 s |

Todos 960×540, 15fps. **O `barras` é o primeiro a passar de 6 MB** e continua
muito abaixo do teto de upload de imagem do Reddit — **o tamanho não é o problema
aqui**, e é por isso que a seção seguinte é sobre outra coisa. Vale corrigir a
frase que estava aqui, e não só o número: "nenhum passa de 6 MB" era uma
propriedade do conjunto daquele dia, não um limite que alguém tivesse escolhido.

**A régua de legibilidade do README passa nos quatro.** Abri um quadro de cada
GIF e li: `melhor · pior na rodada` nos dois `velas`, os dois cards de placar no
`campanhas`, e — o caso mais apertado, porque é a legenda do vídeo inteiro — a
coluna `1º … 20º` com clube e pontos no `pontos-20-clubes`, legível a 960px. Os
960 do README tinham sido medidos contra o card do `velas`; valem para as outras
duas cenas também. **Medido abrindo os quadros, não deduzido da resolução** — e
conferido nos bytes que foram commitados, não nos de um render de rascunho.

O `barras` passa com a maior folga dos cinco, e é o caso oposto ao do `pontos`:
a legenda que lá é uma coluna de 20 linhas a 14pt aqui **é o desenho**, então
nome do clube, ordinal e pontos são o próprio conteúdo em vez de uma chave ao
lado dele. Lido num quadro do GIF commitado, a 960px: os vinte nomes, os vinte
ordinais e os vinte números.

### A coisa que realmente decide o post

**21 a 23 segundos é longo para um GIF de feed.** No Reddit o GIF toca sozinho
enquanto a pessoa rola, e a maioria vê três ou quatro segundos. Nas três cenas o
desfecho está no fim: o resumo do `campanhas`, a distância entre 1º e 20º do
`pontos`, o painel de leitura do `velas`. Quem rola vê um gráfico começando a se
desenhar e vai embora.

Três saídas, em ordem de esforço:

1. **Aceitar.** As cenas são legíveis em qualquer instante — não há um trecho
   morto —, e o título carrega o argumento sozinho. É o que eu faria primeiro.
2. **Cortar uma versão curta só para o Reddit**, 8 a 10 s, e deixar o link do
   site para quem quiser o resto. Custa um `-ss`/`-t` na primeira passagem do
   `ffmpeg` e mais um artefato para manter — que é exatamente o preço que o
   README já cobra por cada render a mais.
3. **Segurar o quadro final por mais tempo** antes do laço, para quem chega no
   meio ver o desfecho sem esperar um ciclo inteiro. Mexe na cena, não no GIF.

Não escolhi por você: (2) e (3) são commits deliberados em `scripts/manim/`, e
esse diretório teve seis PRs em dois dias.

### O quinto GIF entrou, e é o mais indicado dos cinco para cá

`barras-20-clubes` é uma **corrida de barras**, que é um formato que o
r/dataisbeautiful já reconhece de longe — o leitor não precisa da legenda para
saber o que está olhando, o que nenhuma das outras quatro cenas pode dizer.

E ele responde melhor à objeção da seção acima sem que ninguém tenha mexido em
nada: **o desfecho não está só no fim.** Numa corrida de barras cada rodada é uma
troca de posições, então três segundos no meio já mostram o assunto do vídeo, ao
contrário do resumo do `campanhas` ou da distância final do `pontos`. A saída (1)
— aceitar — é mais forte aqui do que nas outras.

**O que ainda não é:** um clube só. Os rascunhos 7.1 e 7.2 abaixo são de sub de
clube e pedem o `velas-<clube>`; este é um post de divisão inteira e vai para
r/dataisbeautiful e r/futebol, não para r/Palmeiras.

### E se entrar um sexto

Não é copiar arquivo. O `docs/medias/RENDERED` precisa nomear cada um com a data
do snapshot de que foi desenhado, senão `tests/manim-renders.test.ts` fica
vermelho — ele exige que **todo** artefato do diretório esteja listado, e é assim
que a `main` já ficou vermelha uma vez, por um `-youtube.md` que entrou sem a
linha dele.

E gere a paleta do vídeo que ela vai colorir: rodar os quatro num laço com uma
`/tmp/palette.png` só desenha um clube com as cores do vizinho e nada acusa. O
README diz isso no próprio comando.

---

## 7. Rascunhos

Com o GIF, **o post é a animação**. O corpo encolhe: o título carrega o
argumento, o GIF prova, e o texto só credita a fonte e diz que o site é seu.
Corpo longo embaixo de um GIF é lido por quase ninguém.

### 7.1 Sub de clube — pt-BR — GIF `velas-<clube>`

O maior rendimento dos três, e o mais fácil: é o clube da pessoa, animado.

**Título:** `Por quantas posições o [CLUBE] passou DENTRO de cada rodada — a campanha inteira em velas`

**Corpo (curto de propósito):**

> A tabela diz onde o time terminou a rodada. Não diz que ele estava em 4º no
> sábado e terminou em 9º porque três rivais jogaram no domingo.
>
> Corpo da vela: da posição em que a rodada abriu até a do fechamento. Pavio:
> todas as posições ocupadas no meio dela — reais, não interpoladas; recalculo a
> tabela a cada horário de bola rolando, então cada ponto é uma classificação que
> alguém podia ter aberto naquele momento. Cor é o resultado, geometria é a
> direção — e as rodadas boas de ver são as em que os dois discordam.
>
> Fiz o site de onde isso sai, é de graça e sem cadastro:
> brasileirao.mpbarbosa.com

### 7.2 r/dataisbeautiful — EN — GIF `velas-*`

**Leve a vela, não o `pontos-20-clubes`.** A cena dos 20 clubes com a tabela se
reordenando ao lado é vizinha de porta da *bar chart race*, gênero de que essa
sub está saturada há anos — o mesmo desenho que rende num sub de futebol é o que
lá chega marcado. A vela não se parece com nada que eles vejam toda semana.

**Título:** `[OC] Every position a football club held *during* each round, not just where it finished — Brazilian Série A`

**Comentário do autor (exigido pela regra da sub):**

> Data: football-data.org fixtures for the Brazilian Série A, through round 25.
> Tool: Manim (Python) for the animation; the underlying figures come from the
> same function my site serves, so the video can't disagree with the site.
>
> A league table tells you where a club finished a round. It hides that they sat
> 4th on Saturday night and ended 9th because three rivals played on Sunday. The
> candle body runs from the club's position when the round opened to its position
> when it closed; the wick spans every position they held in between.
>
> Those in-between positions are measured, not interpolated — the table is
> recomputed at each distinct kickoff instant in the round, so every point on a
> wick is a standing somebody could actually have looked at. Colour is the result,
> geometry is the direction; they're deliberately different channels, because the
> rounds worth looking at are the ones where they disagree.
>
> Site is mine and it's in Portuguese: brasileirao.mpbarbosa.com

### 7.3 r/brdev — pt-BR — o GIF entra, mas não é o assunto

Aqui o post continua sendo a história do provedor que devolve registros que andam
para trás (§2B e o rascunho da versão anterior deste arquivo, que continua
válido). O GIF entra **no fim**, como prova de que a coisa existe — não na
abertura. Um GIF no topo de um post técnico faz o post ser lido como divulgação.

Se preferir um post só sobre a animação, o ângulo que rende ali é o **pipeline**:
a cena lê o mesmo `computeRankCandles` que o site serve, o JSON é exportado do
seed e nunca digitado à mão, e por isso um número errado no vídeo está errado no
site também. Isso é uma decisão de engenharia com consequência, que é o que aquela
sub discute.

---

## 8. O que não fazer

- Reaproveitar o corpo do LinkedIn.
- Postar só a URL.
- Hashtags, emoji em marcador, `Confira!`.
- Postar em cinco subs no mesmo dia.
- Apagar um post que foi mal e repostar.
- Levar o `pontos-20-clubes` para r/dataisbeautiful. Ver §7.2.
- Escrever um corpo longo embaixo do GIF.
- Responder a crítica com defesa da stack. Se disserem que está feio ou que o dado
  está errado, agradeça e conserte — o histórico de "o autor consertou em duas
  horas" vale mais do que o post.
