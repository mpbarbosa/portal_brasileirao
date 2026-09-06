# YouTube — velas do Coritiba

Texto que acompanha [`velas-coritiba.mp4`](velas-coritiba.mp4)
(1920×1080, 60fps, 21s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 21s não comporta.
- **Com capa:** `velas-coritiba-miniatura.png`, 1280×720, o quadro do fecho da
  própria cena — a regra que o `scripts/manim/README.md` registra para as velas.

> **Os números aqui saem de `scripts/manim/velas-coritiba.json`, rodada 25,
> snapshot de 2026-09-02** — 7º com 37 pts em 25 jogos, 10V 7E 8D, e a oscilação
> entre o 5º e o 19º. Eles **envelhecem**: um `sync-seed-data` seguido de uma
> reexportação move o vídeo, e este arquivo não é regerado por nada. Reconferir
> antes de publicar, contra o JSON e não contra esta página.
>
> Os mesmos três números estão **no quadro do fecho do próprio mp4**, no painel
> de resumo, que é de onde a capa sai. Conferidos ali: o quadro de 20,6s diz
> `7º · 37 pts em 25 jogos`, `10V · 7E · 8D` e `oscilou entre o 5º e o 19º`.
>
> **O saldo e o aproveitamento foram conferidos contra o `computeStandings`**, a
> mesma função que monta a tabela do site: 33 gols pró, 33 sofridos, **saldo
> exatamente 0**, 49% de aproveitamento, 5 pontos atrás do G4 (Fluminense, 42) e
> 12 à frente do 17º (Vasco, 25).

---

## Nenhuma das duas pontas é um fechamento

O painel diz `oscilou entre o 5º e o 19º`. **O Coritiba nunca fechou uma rodada
em nenhuma das duas.** As duas pontas são pavios:

| ponta | rodada | o que aconteceu |
|---|---|---|
| **5º** | 5ª | vitória por 2 a 0 no Corinthians, **fora**. Abriu 13º, tocou o 5º, fechou 8º |
| **19º** | 2ª | vitória por 2 a 1 no Cruzeiro, **fora**. Abriu 16º, tocou o 19º, fechou 11º |

Nas duas ele **ganhou**. Nas duas a posição extrema aconteceu enquanto a rodada
corria, com os rivais em campo, e sumiu antes de o apito final registrar
qualquer coisa.

Uma linha da campanha só conhece fechamentos, então a dela vai do **7º ao 16º**:

| desenho | amplitude |
|---|---|
| a vela, de pavio a pavio | **5º .. 19º** — 14 posições |
| a linha, só fechamentos | 7º .. 16º — 9 posições |
| **o que a linha não mostra** | **5 posições** |

**Isso não é exclusivo deste clube e a frase honesta diz qual é o lugar dele.**
Das doze campanhas já desenhadas, quatro têm as duas pontas fora dos
fechamentos — Fluminense, Coritiba, Corinthians e Athletico-PR — e o Fluminense
esconde **7** posições contra as 5 daqui. O Coritiba é o **segundo**, e é aquele
em que a diferença é mais fácil de ver, porque as duas pontas caem em rodadas
vencidas e distantes uma da outra.

## O clube que volta sempre para o mesmo lugar

**Fechou a rodada em 7º onze vezes em vinte e cinco** — da 6ª à 13ª, oito
seguidas, e de novo na 17ª, na 18ª e na 25ª. Entre a primeira e a última vão
**19 rodadas**.

E não é uma campanha parada: nas mesmas 25 rodadas o clube soma **27 posições de
movimento** entre abertura e fechamento e **54 posições de pavio**. Ele mexe
bastante e continua caindo na mesma casa.

Vale a comparação certa, porque duas outras campanhas fecham numa posição só com
mais frequência — e as duas fazem isso no topo, onde há menos para onde ir:

| clube | posição mais fechada | movimento | pavio |
|---|---|---|---|
| Palmeiras | 1º em 20 de 25 | 14 | 31 |
| Flamengo | 2º em 14 de 25 | 21 | 46 |
| **Coritiba** | **7º em 11 de 25** | **27** | **54** |

O Palmeiras repete o 1º porque não tem acima; o Coritiba repete o 7º com quase o
dobro do pavio.

## Cinco rodadas em que a vela não é nada

Em cinco rodadas o clube abriu, fechou, subiu e desceu **exatamente no mesmo
lugar** — abertura, fechamento, melhor e pior todos em 7º. No desenho são cinco
marcas sem corpo e sem pavio, e **três delas são derrotas**:

| rodada | resultado | jogo |
|---|---|---|
| 8ª | **derrota** | 0 a 2 com o Athletico-PR, fora |
| 9ª | empate | 1 a 1 com o Vasco, em casa |
| 11ª | empate | 2 a 2 com o Botafogo, fora |
| 13ª | **derrota** | 0 a 1 com o Grêmio, fora |
| 18ª | **derrota** | 0 a 3 com o Flamengo, fora |

Perdeu de 3 a 0 para o Flamengo e não caiu uma posição — nem no fim da rodada
nem durante ela. É a cor e a geometria discordando na direção oposta à do
Bragantino: lá uma vitória com o pavio no fundo, aqui uma derrota sem geometria
nenhuma.

## Sem vela vazada, e o saldo é zero

O Coritiba jogou as **25 rodadas**, então não há retângulo vazado neste desenho —
ao contrário do Flamengo, do São Paulo, do Botafogo, do Atlético-MG e do
Bragantino, que têm um cada.

E o saldo é **exatamente 0**: 33 gols pró, 33 sofridos. É o único da divisão em
2026 com saldo zero na rodada 25, o que combina bem com uma campanha que insiste
em terminar onde começou.

## Título

Recomendado (74 caracteres):

```
Coritiba em velas: fechou 11 rodadas em 7º e nunca fechou no 5º nem no 19º
```

Abre com o clube, diz o que o desenho é — "em velas" é a curiosidade que segura o
clique de quem conhece candlestick de outro assunto — e vende as **duas** coisas
que só este vídeo tem: o platô e as pontas que não são fechamentos.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `As duas pontas que a linha não mostra: o Coritiba em velas` | 58 | o argumento do formato, direto |
| 3 | `Perdeu de 3 a 0 e não caiu uma posição: o Coritiba em velas` | 59 | a rodada 18, a mais estranha das cinco |
| 4 | `Coritiba: 25 rodadas em 21 segundos, posição e pontos \| Brasileirão 2026` | 72 | promete a duração, bom para retenção |

**"Coxa" e "Verdão do Alto da Glória" não estão em nenhum deles, e estão nas
tags**, pela mesma regra dos outros vídeos de velas: o apelido é como o torcedor
busca e não é como o clube aparece no vídeo nem na tabela.

## Descrição

```
A campanha do Coritiba rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 02/09/2026 (25ª rodada):
• Coritiba — 7º, 37 pts em 25 jogos
• 10V · 7E · 8D — 33 gols pró, 33 sofridos, saldo exatamente 0
• 49% de aproveitamento, 5 pontos atrás do G4

O painel do fim diz que ele oscilou entre o 5º e o 19º. Ele NUNCA FECHOU uma rodada em nenhuma das duas posições.

O 5º aconteceu dentro da 5ª rodada, enquanto ele ganhava por 2 a 0 do Corinthians fora de casa: abriu em 13º, tocou o 5º, fechou em 8º. O 19º aconteceu dentro da 2ª, enquanto ele ganhava por 2 a 1 do Cruzeiro, também fora: abriu em 16º, tocou o 19º, fechou em 11º. Nas duas ele venceu, e nas duas a posição extrema existiu só enquanto os rivais estavam em campo.

Um gráfico de linha só conhece fechamentos, então o dele vai do 7º ao 16º — nove posições. A vela vai do 5º ao 19º: quatorze. São CINCO posições que a linha não tem como mostrar, e as duas pontas da temporada estão entre elas.

O resto do desenho é um platô. O Coritiba fechou a rodada em 7º LUGAR onze vezes em vinte e cinco — da 6ª à 13ª, oito seguidas, e de novo na 17ª, na 18ª e na 25ª. Entre a primeira e a última vão dezenove rodadas.

E não é uma campanha parada: ele soma 27 posições de movimento entre abertura e fechamento e 54 posições de pavio ao longo do ano. Ele mexe bastante e continua voltando para a mesma casa. O Palmeiras fecha em 1º com mais frequência, mas com metade do pavio — e porque não existe nada acima do 1º.

Em cinco rodadas a vela não é nada: abertura, fechamento, melhor e pior todos em 7º, cinco marcas sem corpo e sem pavio. E três delas são derrotas — 0 a 2 com o Athletico-PR, 0 a 1 com o Grêmio e 0 a 3 com o Flamengo. Perdeu de 3 a 0 para o vice-líder e não caiu uma posição, nem no fim da rodada nem durante ela.

Ele jogou as 25 rodadas, então não há vela vazada aqui, ao contrário de cinco outros clubes desta série. E o saldo de gols é exatamente ZERO: 33 marcados, 33 sofridos — o único da divisão assim na 25ª rodada, o que combina com uma campanha que insiste em terminar onde começou.

O eixo mostra a divisão inteira, 1º no topo e 20º embaixo, com as faixas do G4 e do Z4 ao fundo. Uma escala por clube esconderia justamente o que este desenho tem: um platô estreito no meio de um eixo largo.

Nenhum número foi digitado à mão. A animação lê a mesma função que calcula as velas no Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #Coritiba #Coxa #CoritibaFBC #Manim #DataViz #VisualizacaoDeDados #Futebol #Python
```

### O parágrafo que muda, e por que ele não podia ser copiado

Cada vídeo de velas vendeu um ângulo diferente: o Palmeiras a liderança, o
Flamengo a vela vazada, o Cruzeiro a subida do fundo, o Corinthians a amplitude,
o São Paulo as duas taxas, o Atlético-MG a saída do Z4, o Botafogo a amplitude
mais larga, o Bragantino a 9ª rodada.

Este vende **o platô**, e é o primeiro em que a coisa notável é uma campanha
*não* se mexer. Os outros onze vendem movimento.

**O parágrafo das duas pontas é o argumento do formato na sua forma mais nua**,
e vale dizer o que ele não é: não é exclusivo. Quatro das doze campanhas têm as
duas pontas fora dos fechamentos, e o Fluminense esconde mais posições. O que é
deste clube é a *legibilidade* — as duas pontas caem em rodadas vencidas, com
treze rodadas entre elas, e o platô no meio deixa as duas visíveis de longe.

### Versão curta

Para Short, ou onde a descrição longa não couber.

```
A campanha do Coritiba em velas: o corpo vai da abertura ao fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela. O painel diz que ele oscilou entre o 5º e o 19º — e ele NUNCA FECHOU em nenhuma das duas. O 5º foi dentro da 5ª rodada, ganhando de 2 a 0 do Corinthians; o 19º dentro da 2ª, ganhando de 2 a 1 do Cruzeiro. Uma linha só veria do 7º ao 16º. Ele ainda fechou 11 das 25 rodadas em 7º. Dados até a 25ª: 7º, 37 pts, 10V 7E 8D, saldo 0.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #Coritiba #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola. 425
caracteres, 26 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, coritiba, coritiba fbc, coxa, coxa branca, campanha do coritiba, classificação brasileirão, tabela do brasileirão, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, data visualization, dataviz, manim, animação em python, python, estatísticas de futebol, football analytics, portal brasileirão, rodada 25
```

Quatro blocos deliberados, na ordem do volume de busca: futebol, o clube, o
vocabulário do desenho (`candlestick` e `gráfico de velas` trazem um público que
não busca futebol), e por fim dataviz e Manim — menor, mas é quem assiste 21
segundos de gráfico até o fim e clica no repositório. `brasileirao` e `serie a`
sem acento estão na lista ao lado das formas acentuadas, de propósito: muita
gente digita sem, e o YouTube não normaliza acentuação em tags.

**Aqui o `tla` não é só inútil, é AMBÍGUO — e este é o clube do exemplo.** O
provedor manda `COR` para o Coritiba **e** para o Corinthians, que é o caso que o
`CLAUDE.md` usa para dizer que identidade de clube neste projeto é o id numérico
do provedor e nunca a abreviação. Uma tag `cor` traria o público do clube errado,
e o payload deste vídeo foi exportado pelo id `4241` justamente por isso.

**Nenhuma tag de posição entrou.** 7º lugar não é algo que alguém busque, e
`campanha do coritiba` cobre a intenção sem prometer um número que a próxima
rodada muda.

## Miniatura

`velas-coritiba-miniatura.png`, 1280×720, o **quadro do fecho da própria cena** —
e não um layout à parte como as capas do `campanhas` e do `pontos`, porque os
primeiros segundos são um gráfico vazio.

```sh
ffmpeg -ss 20.6 -i docs/medias/coritiba/velas-coritiba.mp4 -frames:v 1 -vf scale=1280:720 \
  docs/medias/coritiba/velas-coritiba-miniatura.png
```

O `-ss 20.6` num vídeo de 21,1s é estreito de propósito e **não** sobra para
arredondar: antes disso o painel de resumo ainda está entrando — ele só assenta
em **t=19**, medido — e depois o vídeo acabou. Conferir o PNG antes de subir.
Aqui ele foi aberto: o painel de resumo inteiro com `7º · 37 pts em 25 jogos` e o
card da 25ª rodada com `3 × 2 Clube do Remo (fora)`.

**É a capa mais legível da série até agora**, e por uma razão que é do clube e
não do desenho: o platô é uma faixa estreita de marcas pequenas atravessando o
meio do quadro, com a vela verde alta da 5ª rodada subindo para dentro dele e as
duas rodadas iniciais lá embaixo. Dá para ler a forma sem ler número nenhum. O
painel cai na faixa vazia logo abaixo do platô e encosta em quase nada —
conferido num recorte ampliado.

## O resto do formulário

- **Público:** "Não, não é conteúdo para crianças". Marcar "sim" desliga
  comentários e cards, e um gráfico de futebol não é conteúdo infantil.
- **Elementos do vídeo:** telas finais precisam de 5s livres no fim, e aqui esses
  5s são exatamente o painel de resumo — que é a parte que vale. Pular.
- **Playlists:** conferir a posição contra `docs/medias/RENDERED` em vez de contra
  uma frase aqui — a contagem depende de quais velas já entraram, e ordem de
  merge não é ordem de renderização.

## Título do arquivo

O YouTube usa o nome do arquivo como título provisório, então subir
`velas-coritiba.mp4` deixa `velas coritiba` no campo — trocar antes de publicar.
