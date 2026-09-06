# YouTube — velas do Botafogo

Texto que acompanha [`velas-botafogo.mp4`](velas-botafogo.mp4)
(1920×1080, 60fps, 21s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 21s não comporta.
- **Com capa:** `velas-botafogo-miniatura.png`, 1280×720, o quadro do fecho da
  própria cena — a regra que o `scripts/manim/README.md` registra para as velas.

> **Os números aqui saem de `scripts/manim/velas-botafogo.json`, rodada 25,
> snapshot de 2026-09-02** — 12º com 30 pts em 24 jogos, 8V 6E 10D, e a oscilação
> entre o 1º e o 18º. Eles **envelhecem**: um `sync-seed-data` seguido de uma
> reexportação move o vídeo, e este arquivo não é regerado por nada. Reconferir
> antes de publicar, contra o JSON e não contra esta página.
>
> Os mesmos três números estão **no quadro do fecho do próprio mp4**, no painel
> de resumo, que é de onde a capa sai. Conferidos ali: o quadro de 20,6s diz
> `12º · 30 pts em 24 jogos`, `8V · 6E · 10D` e `oscilou entre o 1º e o 18º`.
>
> **O saldo e o aproveitamento foram conferidos contra o `computeStandings`**, a
> mesma função que monta a tabela do site: 37 gols pró, 40 sofridos, saldo −3,
> 42% de aproveitamento, 12 pontos atrás do G4 (Fluminense, 42) e 5 à frente do
> 17º (Vasco, 25).

---

## A campanha mais LARGA da série, e por 17 posições

O Botafogo abre a temporada em **1º** — 4 a 0 no Cruzeiro na 1ª rodada — e chega
ao **18º** na 7ª. Nenhuma das outras nove campanhas já desenhadas nesta série
atravessa tanto eixo:

| clube | melhor | pior | amplitude |
|---|---|---|---|
| **Botafogo** | **1º** | **18º** | **17** |
| Corinthians | 3º | 19º | 16 |
| São Paulo | 1º | 16º | 15 |
| Cruzeiro | 5º | 20º | 15 |
| Atlético-MG | 4º | 17º | 13 |
| Flamengo | 2º | 15º | 13 |
| Athletico-PR | 2º | 13º | 11 |
| Palmeiras | 1º | 11º | 10 |
| Fluminense | 2º | 12º | 10 |
| Bahia | 1º | 8º | 7 |

**E aqui a ressalva de sempre se INVERTE, o que vale dizer porque ela aparece em
quase todos os outros textos desta série.** Nas outras campanhas o extremo
costuma ser o pavio da 1ª rodada, quando os clubes empatados em nada são
ordenados por **nome** e a vela nasce larga para todo mundo. Aqui o pavio da 1ª
vai do 1º ao 11º — e **nem uma ponta nem a outra é extremo da temporada**. O 1º é
o *fechamento* da 1ª rodada, uma tabela real depois de um 4 a 0; o 18º é o
fechamento da 7ª, seis rodadas depois. **As duas pontas da amplitude são reais.**

## Três campanhas numa temporada

| trecho | rodadas | pontos | de → até |
|---|---|---|---|
| a largada | 1ª | 3 de 3 | — → 1º |
| a queda | 2ª a 7ª | 1 de 18 | 1º → 18º |
| a volta | 8ª a 20ª | 25 de 39 | 18º → 7º |
| o fecho | 22ª a 25ª | 1 de 12 | 7º → 12º |

A queda não é uma sequência de jogos apertados: nas seis rodadas o clube leva
**5, 1, 0, 4, 3 e 2 gols** — 15 em seis jogos, com um 3 a 5 fora com o Grêmio e
um 1 a 4 fora com o Athletico-PR. A volta é o oposto e dura o dobro: treze
rodadas com **cinco vitórias, quatro empates e duas derrotas**, saindo da faixa
do Z4 até encostar no 7º.

## O empate técnico com o vídeo anterior

O São Paulo — o clube da vela desenhada logo antes desta — fecha a 25ª rodada
com **30 pontos em 24 jogos, 8V 6E 10D**. O Botafogo fecha com **30 pontos em 24
jogos, 8V 6E 10D**. Os dois têm o mesmo número de pontos, o mesmo número de
vitórias, a mesma quantidade de jogos, e a tabela ainda assim os separa: o
critério seguinte da CBF é o **saldo de gols**, +1 contra −3, e é só isso que põe
um em 11º e o outro em 12º.

Duas linhas idênticas, duas campanhas que não se parecem em nada — o São Paulo
lidera e despenca, o Botafogo despenca e sobe. É o argumento inteiro deste
desenho numa comparação: a linha da tabela descreve o conjunto e não conta como
se chegou nele.

**O saldo −3 é o pior das dez campanhas**, e o segundo negativo — o Cruzeiro, que
fecha em 6º, tem −1. Os 40 gols sofridos também são o maior número das dez.

## A 21ª rodada é uma vela VAZADA

O Botafogo não jogou a 21ª, então a campanha atravessa 25 rodadas com **24
partidas** — e no desenho essa rodada é um retângulo **só de contorno**, sem
preenchimento. É a convenção que o `rank-candles-core.ts` registra: uma rodada
sem jogo é desenhada oca e não em cinza, porque cinza ficaria ao lado do empate
em `ink-muted` e os dois não se distinguem numa marca de 5px.

**São quatro os adiamentos daquela rodada** — Atlético-MG × Bragantino, Botafogo
× Grêmio, Chapecoense × Vasco e São Paulo × Santos — o que faz a vela vazada uma
propriedade da rodada e não deste clube. Ela foi aberta e olhada num recorte
ampliado antes de este texto ser escrito: está entre a 20ª e a 22ª.

## O painel de resumo cobre velas, e isso não é defeito

Nas campanhas que passaram a temporada inteira na metade de cima do eixo o painel
cai num retângulo genuinamente vazio. **Aqui não existe retângulo vazio**: com 17
posições de amplitude a campanha ocupa quase todo o eixo, e o `summary_anchor`
varre a grade e escolhe o canto **superior esquerdo**, que é o que sobra. O painel
tem 94% de opacidade de propósito, então as velas atrás dele continuam visíveis
como fantasmas — conferido no recorte ampliado do quadro de 20,6s.

Mesma situação do Atlético-MG, e pela mesma causa. Vale registrar que o
comportamento é o desejado: o ponto fixo antigo — 13ª rodada, 13,5º — cairia bem
no meio da subida da 8ª à 20ª, que é o assunto do vídeo.

## Título

Recomendado (75 caracteres):

```
Botafogo em velas: do 1º ao 18º e de volta, na campanha do Brasileirão 2026
```

Abre com o clube, diz o que o desenho é — "em velas" é a curiosidade que segura
o clique de quem conhece candlestick de outro assunto — e traz **as duas quedas
e a subida no meio**, que é o que só este vídeo tem. Não data o recorte no
título, ao contrário do São Paulo, porque as duas pontas já ocupam o espaço; a
data está na primeira linha da descrição, que é o que aparece antes do "mostrar
mais".

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `Líder na 1ª rodada, 18º na 7ª: a campanha do Botafogo em velas` | 62 | as duas pontas, ambas verificáveis |
| 3 | `A campanha mais larga do Brasileirão 2026: o Botafogo em velas` | 62 | a amplitude, que é medida e não impressão |
| 4 | `Botafogo: 25 rodadas em 21 segundos, posição e pontos \| Brasileirão 2026` | 72 | promete a duração, bom para retenção |

**"Glorioso", "Fogão" e "BFR" não estão em nenhum deles, e estão nas tags**, pela
mesma regra dos outros vídeos de velas: o apelido é como o torcedor busca e não é
como o clube aparece no vídeo nem na tabela.

## Descrição

```
A campanha do Botafogo rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 02/09/2026 (25ª rodada):
• Botafogo — 12º, 30 pts em 24 JOGOS (não jogou a 21ª rodada)
• 8V · 6E · 10D — 37 gols pró, 40 sofridos, saldo −3
• 42% de aproveitamento, 12 pontos atrás do G4

Esta é a campanha mais LARGA das dez já desenhadas nesta série: 17 posições entre o melhor e o pior momento. O clube fecha a 1ª rodada em 1º lugar, com um 4 a 0 no Cruzeiro em casa — e chega ao 18º na 7ª, seis rodadas depois.

E as duas pontas são reais, o que nem sempre acontece. Nos outros vídeos o extremo costuma ser o pavio da 1ª rodada, antes de qualquer jogo, quando os clubes empatados em nada são ordenados por NOME. Aqui esse pavio vai do 1º ao 11º e nenhuma das duas pontas é extremo da temporada: o 1º é o fechamento da 1ª rodada e o 18º é o fechamento da 7ª.

A queda tem número. Da 2ª à 7ª são 1 ponto em 18 disputados, com 15 gols sofridos em seis jogos — um 3 a 5 fora com o Grêmio e um 1 a 4 fora com o Athletico-PR entre eles. Não é uma sequência de jogos apertados; é uma escada descendo depressa.

A volta dura o dobro. Da 8ª à 20ª são 25 pontos em 39: cinco vitórias, quatro empates e duas derrotas, saindo da faixa do Z4 até o 7º lugar. É o bloco verde no meio do desenho, e é a parte da temporada que a linha da tabela não mostra.

O fecho desmonta boa parte disso. Da 22ª à 25ª é 1 ponto em 12, com três derrotas seguidas — Vitória fora, Athletico-PR em casa e Flamengo fora por 3 a 0 — e o clube cai do 7º ao 12º.

Na 21ª rodada há uma vela VAZADA: só o contorno, sem preenchimento. É a rodada que o clube não jogou. Aquela rodada teve quatro adiamentos no total, então a vela oca é uma propriedade dela e não deste clube — mas é por isso que a barra de pontos embaixo tem um degrau a menos que a dos rivais naquele ponto.

Uma última coisa que só a tabela mostra e o desenho explica: o Botafogo termina a 25ª rodada com exatamente os mesmos 30 pontos, os mesmos 24 jogos e o mesmo 8V 6E 10D do São Paulo, que é o 11º. O que separa os dois é o saldo de gols — +1 contra −3. Duas linhas idênticas, e duas campanhas que não se parecem em nada.

O eixo mostra a divisão inteira, 1º no topo e 20º embaixo, com as faixas do G4 e do Z4 ao fundo. Uma escala por clube esconderia justamente o que este desenho tem: o tamanho da queda e o tamanho da volta.

Nenhum número foi digitado à mão. A animação lê a mesma função que calcula as velas no Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #Botafogo #Fogao #Glorioso #Manim #DataViz #VisualizacaoDeDados #Futebol #Python
```

### O parágrafo que muda, e por que ele não podia ser copiado

Cada vídeo de velas vendeu um ângulo diferente: o Palmeiras a liderança, o
Flamengo a vela vazada e o jogo a menos, o Cruzeiro a subida do fundo, o
Corinthians a amplitude, o São Paulo as duas taxas, o Atlético-MG a saída do Z4.
Este vende **a amplitude de novo — e é a única vez em que isso é legítimo**,
porque as 17 posições passam as 16 do Corinthians e porque a forma é outra: lá
uma banheira, aqui uma queda, uma subida e uma queda menor.

**O empate técnico com o São Paulo é o parágrafo que nenhum outro vídeo poderia
ter**, e ele só existe porque os dois foram desenhados. É a defesa mais direta do
formato inteiro que esta série já produziu: mesma linha na tabela, campanhas
irreconhecíveis uma na outra.

### Versão curta

Para Short, ou onde a descrição longa não couber.

```
A campanha do Botafogo em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela, e a barra de baixo são os pontos. Ele fechou a 1ª rodada em 1º com um 4 a 0 — e chegou ao 18º na 7ª, com 1 ponto em 18 e 15 gols sofridos. Da 8ª à 20ª fez 25 de 39 e voltou ao 7º. A vela vazada na 21ª é a rodada que ele não jogou. Dados até a 25ª: 12º, 30 pts em 24 jogos, 8V 6E 10D.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #Botafogo #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola. 429
caracteres, 27 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, botafogo, botafogo fr, glorioso, fogão, fogao, campanha do botafogo, classificação brasileirão, tabela do brasileirão, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, data visualization, dataviz, manim, animação em python, python, estatísticas de futebol, football analytics, portal brasileirão, rodada 25
```

Quatro blocos deliberados, na ordem do volume de busca: futebol, o clube, o
vocabulário do desenho (`candlestick` e `gráfico de velas` trazem um público que
não busca futebol), e por fim dataviz e Manim — menor, mas é quem assiste 21
segundos de gráfico até o fim e clica no repositório. `brasileirao`, `serie a` e
`fogao` sem acento estão na lista ao lado das formas acentuadas, de propósito:
muita gente digita sem, e o YouTube não normaliza acentuação em tags.

**O `tla` do payload NÃO entra**, como nos outros. Para este clube ele é `BOT`,
que é legível e ainda assim não é como ninguém busca — e o `CLAUDE.md` registra
por que a identidade de clube aqui é o id numérico do provedor e nunca o `tla`:
Corinthians e Coritiba mandam os dois `COR`. `botafogo fr` entra no lugar, que é
como o clube se escreve por extenso.

**Nenhuma tag de posição entrou.** 12º lugar não é algo que alguém busque, e
`campanha do botafogo` cobre a intenção sem prometer um número que a próxima
rodada muda.

## Miniatura

`velas-botafogo-miniatura.png`, 1280×720, o **quadro do fecho da própria cena** —
e não um layout à parte como as capas do `campanhas` e do `pontos`, porque os
primeiros segundos são um gráfico vazio.

```sh
ffmpeg -ss 20.6 -i docs/medias/botafogo/velas-botafogo.mp4 -frames:v 1 -vf scale=1280:720 \
  docs/medias/botafogo/velas-botafogo-miniatura.png
```

O `-ss 20.6` num vídeo de 21,1s é estreito de propósito e **não** sobra para
arredondar: antes disso o painel de resumo ainda está entrando — ele só assenta
em **t=19**, medido — e depois o vídeo acabou. Conferir o PNG antes de subir.
Aqui ele foi aberto: o painel de resumo inteiro com `12º · 30 pts em 24 jogos` e
o card da 25ª rodada com `0 × 3 Flamengo (fora)`.

**Como capa a forma é o argumento.** A queda da esquerda, o bloco verde subindo
no meio e as três velas vermelhas à direita são legíveis em miniatura sem ler
número nenhum. O custo é o painel de resumo cobrindo velas no canto superior
esquerdo, pelo motivo da seção acima — este clube não tem canto vazio, e a
alternativa seria tapar a subida.

## O resto do formulário

- **Público:** "Não, não é conteúdo para crianças". Marcar "sim" desliga
  comentários e cards, e um gráfico de futebol não é conteúdo infantil.
- **Elementos do vídeo:** telas finais precisam de 5s livres no fim, e aqui esses
  5s são exatamente o painel de resumo — que é a parte que vale. Pular.
- **Playlists:** este é o décimo vídeo com a cena `velas.py`. Conferir contra
  `docs/medias/RENDERED` em vez de contra esta frase: a contagem depende do
  Atlético-MG ter entrado antes, e ordem de merge não é ordem de renderização.

## Título do arquivo

O YouTube usa o nome do arquivo como título provisório, então subir
`velas-botafogo.mp4` deixa `velas botafogo` no campo — trocar antes de publicar.
