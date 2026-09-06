# YouTube — velas do Vitória

Texto que acompanha [`velas-vitoria.mp4`](velas-vitoria.mp4)
(1920×1080, 60fps, 21s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 21s não comporta.
- **Com capa:** `velas-vitoria-miniatura.png`, 1280×720, o quadro do fecho da
  própria cena.

> **Os números aqui saem de `scripts/manim/velas-vitoria.json`, rodada 25,
> snapshot de 2026-09-02** — 13º com 29 pts em **25** jogos, 8V 5E 12D, e a
> oscilação entre o 1º e o 16º. Eles **envelhecem** e nada regera este arquivo:
> reconferir contra o JSON antes de publicar, nunca contra esta página.
>
> Os mesmos três números estão **no quadro do fecho do próprio mp4**: `13º · 29
> pts em 25 jogos`, `8V · 5E · 12D` e `oscilou entre o 1º e o 16º`.
>
> **25 jogos: este clube não tem vela vazada.** Conferido contra o
> `computeStandings`: 24 gols pró, 37 sofridos, **saldo −13**, 39% de
> aproveitamento.

---

## Foi 1º na primeira rodada e 13º na segunda

A campanha inteira cabe entre duas velas vizinhas, e são as duas primeiras.

| rodada | abriu | melhor | pior | fechou | o jogo |
|---|---|---|---|---|---|
| **1ª** | 3º | **1º** | 3º | 3º | vitória por 2 a 0 no Clube do Remo, em casa |
| **2ª** | 3º | 3º | **13º** | 13º | **derrota por 5 a 1 para o Palmeiras**, fora |

**Dez posições numa rodada.** É a maior queda de uma rodada só das dezessete
campanhas já desenhadas nesta série — a seguinte é a do Botafogo, com sete.

E o **1º** da primeira rodada é a única vez que este clube apareceu no topo:
ganhou de 2 a 0 na abertura e, enquanto os outros ainda jogavam, esteve em
primeiro. Fechou a rodada em 3º e **nunca mais** passou do 8º.

> A 1ª rodada é larga para todo mundo, e o desenho não esconde isso: antes do
> primeiro jogo os clubes empatados em nada são ordenados por nome, então a
> abertura em 3º é alfabética e não uma conquista. O **1º**, esse é de verdade —
> aconteceu depois da vitória, com a tabela já contando gols.

## Vinte e três rodadas entre o 8º e o 15º

Depois daquele tombo, o resto do ano é estreito: da 3ª à 25ª o Vitória fechou
sempre entre o **8º e o 15º**, com oito fechamentos no **13º**. A linha da
campanha é uma faixa fina, e a vela mais alta do desenho é aquela vermelha
gigantesca da 2ª rodada, que ninguém repete.

| desenho | amplitude |
|---|---|
| a vela, de pavio a pavio | 1º .. 16º |
| a linha, só fechamentos | 3º .. 15º |
| **o que a linha não mostra** | **3 posições** |

## Nunca fechou uma rodada no Z4 — com o segundo pior saldo da divisão

Este é o número que o desenho torna estranho: o Vitória tem **24 gols marcados,
o pior ataque da divisão**, e **saldo −13, o segundo pior**, atrás só da
Chapecoense. Ainda assim, em 25 rodadas, **nunca fechou uma sequer dentro do
Z4** — a faixa vermelha do desenho está sempre logo abaixo dele e nunca o
alcança.

Três clubes que estão **abaixo** dele na tabela têm saldo melhor: Vasco (−12),
Remo (−12) e Mirassol (−10). O Vitória perde por muito e ganha por pouco — oito
vitórias, cinco delas por 2 a 0 ou 1 a 0.

## As três velas que não são nada, e todas são derrotas

Em três rodadas — a 21ª, a 22ª e a 24ª — abertura, fechamento, melhor e pior são
o mesmo número. Todas as três são **derrotas**: 0 a 4 do Palmeiras em casa, 0 a 2
do Flamengo fora, 0 a 2 do Bahia em casa. Levou oito gols sem responder em três
rodadas e não se moveu um lugar.

## O marrom deste vídeo não é o marrom do clube, e foi medido

O tom do Vitória na paleta é `#8C6E5A`. **Escrito assim, no painel de resumo, ele
não passa o piso de contraste deste projeto** — e este é o primeiro clube da
série em que a correção automática salva um rótulo de verdade, e não por margem.

Medido no quadro codificado, mesmo vídeo, mesma qualidade, com e sem a correção:

| a linha `8V · 5E · 12D` | contraste |
|---|---|
| com o tom cru `#8C6E5A` | **3,68 — abaixo do piso de 4,5** |
| com o tom corrigido `#AB866E` | **5,22** |

Os outros seis tons que a mesma regra corrige sobem por causa da margem de 15%
que o projeto reserva para a compressão — o Bragantino, por exemplo, já passaria
os 4,5 sem ela. Aqui não: o marrom cru falha, e falha no quadro que as pessoas
baixam. Por isso o `8V · 5E · 12D` do vídeo é um marrom mais claro que a régua da
paleta.

## Título

Recomendado (69 caracteres):

```
Vitória em velas: foi 1º na 1ª rodada e 13º na 2ª, e nunca mais subiu
```

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `Dez posições numa rodada só: a queda do Vitória em velas` | 56 | a 2ª rodada, a maior queda da série |
| 3 | `Pior ataque da divisão e nunca no Z4: o Vitória em velas` | 56 | o paradoxo da tabela |
| 4 | `Vitória: 25 rodadas em 21 segundos \| Brasileirão 2026` | 53 | promete a duração |

## Descrição

```
A campanha do Vitória rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados.

Dados até 02/09/2026 (25ª rodada):
• Vitória — 13º, 29 pts em 25 jogos
• 8V · 5E · 12D — 24 gols pró, 37 sofridos, saldo −13
• 39% de aproveitamento

A campanha inteira cabe entre as duas primeiras velas. Na 1ª rodada o Vitória ganhou de 2 a 0 do Clube do Remo em casa e, enquanto os outros ainda jogavam, ESTEVE EM PRIMEIRO — fechou em 3º. Na 2ª levou 5 a 1 do Palmeiras fora e fechou em 13º.

DEZ POSIÇÕES NUMA RODADA SÓ. É a maior queda de uma rodada das dezessete campanhas já desenhadas nesta série; a seguinte é a do Botafogo, com sete. E aquele 1º é a única vez que o clube apareceu no topo o ano inteiro: depois da 2ª rodada ele nunca mais passou do 8º.

O resto é estreito. Da 3ª à 25ª o Vitória fechou sempre entre o 8º e o 15º, com oito fechamentos no 13º. A vela vermelha gigante da 2ª rodada é a maior do desenho e ninguém a repete.

E aqui está o número que o desenho torna estranho: o Vitória tem o PIOR ATAQUE DA DIVISÃO, com 24 gols, e o segundo pior saldo, −13, atrás só da Chapecoense. Ainda assim, em 25 rodadas, nunca fechou uma sequer dentro do Z4 — a faixa vermelha está sempre logo abaixo dele e nunca o alcança. Três clubes que estão ABAIXO dele na tabela têm saldo melhor. Ele perde por muito e ganha por pouco: cinco das oito vitórias foram por 2 a 0 ou 1 a 0.

Em três rodadas a vela não é nada: abertura, fechamento, melhor e pior no mesmo número. Todas as três são derrotas — 0 a 4 do Palmeiras em casa, 0 a 2 do Flamengo fora, 0 a 2 do Bahia em casa. Levou oito gols sem responder e não se moveu um lugar.

Uma nota sobre a cor: o marrom do painel é mais claro que o tom do clube na paleta, e isso foi medido. O tom cru não passa o piso de contraste do projeto no quadro codificado — 3,68 contra um piso de 4,5 — e a correção automática o leva a 5,22. É o primeiro clube desta série em que essa regra salva um rótulo de verdade, e não apenas por margem.

O eixo mostra a divisão inteira, 1º no topo e 20º embaixo, com as faixas do G4 e do Z4 ao fundo.

Nenhum número foi digitado à mão. A animação lê a mesma função que calcula as velas no Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #Vitoria #ECVitoria #Leao #Manim #DataViz #VisualizacaoDeDados #Futebol #Python
```

### Versão curta

```
A campanha do Vitória em velas: o corpo vai da abertura ao fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela. Na 1ª rodada ele ganhou de 2 a 0 e ESTEVE EM PRIMEIRO; na 2ª levou 5 a 1 do Palmeiras e fechou em 13º — dez posições numa rodada, a maior queda desta série. Depois disso nunca mais passou do 8º. Tem o pior ataque da divisão e o segundo pior saldo, e mesmo assim nunca fechou uma rodada no Z4. Dados até a 25ª: 13º, 29 pts em 25 jogos.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #Vitoria #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola. 426
caracteres, 26 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, vitória, vitoria, ec vitória, leão da barra, rubro-negro baiano, campanha do vitória, classificação brasileirão, tabela do brasileirão, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, data visualization, dataviz, manim, animação em python, python, estatísticas de futebol, portal brasileirão, rodada 25
```

**`vitoria` sem acento está ao lado da forma acentuada de propósito**, e aqui isso
pesa mais do que nos outros vídeos: o nome do clube é uma palavra comum do
futebol, então quem digita "vitoria" sem acento pode estar procurando qualquer
coisa. As tags do clube vêm acompanhadas de `ec vitória`, `leão da barra` e
`rubro-negro baiano`, que só significam o clube.

**Nenhuma tag de rebaixamento**, pela regra da série: o vídeo mostra 25 rodadas
jogadas e não faz projeção nenhuma.

## Miniatura

`velas-vitoria-miniatura.png`, 1280×720, o **quadro do fecho da própria cena**.

```sh
ffmpeg -ss 20.6 -i docs/medias/vitoria/velas-vitoria.mp4 -frames:v 1 -vf scale=1280:720 \
  docs/medias/vitoria/velas-vitoria-miniatura.png
```

O `-ss 20.6` num vídeo de 21,1s é estreito de propósito: antes disso o painel de
resumo ainda está entrando — ele só assenta em **t=19**, medido — e depois o
vídeo acabou.

**O painel cruza velas nesta capa**: a melhor folga possível é **−0,424** numa
varredura fina de 201×201, com o painel medindo 4,84 × 1,49 unidades de cena num
gráfico de 7,6 × 3,16. Não existe posição livre, como em Botafogo, Grêmio, Vasco
e Internacional.

> **A varredura geométrica é o teste; contar pixels da cor da vela dentro da
> caixa não é.** O painel tem `fill_opacity=0.94`, então uma vela atrás dele chega
> ao quadro com 6% da cor e a busca pela cor pura devolve zero havendo vela atrás
> ou não — um teste sem ramo de falha. O `-youtube.md` do Internacional registra
> a medição que estabelece isso.

## O resto do formulário

- **Público:** "Não, não é conteúdo para crianças".
- **Elementos do vídeo:** telas finais precisam de 5s livres no fim, e aqui esses
  5s são o painel de resumo. Pular.
- **Playlists:** conferir a posição contra `docs/medias/RENDERED`.

## Título do arquivo

O YouTube usa o nome do arquivo como título provisório, então subir
`velas-vitoria.mp4` deixa `velas vitoria` no campo — trocar antes de publicar.
