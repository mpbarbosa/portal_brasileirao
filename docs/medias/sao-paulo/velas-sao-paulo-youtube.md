# YouTube — velas do São Paulo

Texto que acompanha [`velas-sao-paulo.mp4`](velas-sao-paulo.mp4)
(1920×1080, 60fps, 21s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 21s não comporta.
- **Com capa:** `velas-sao-paulo-miniatura.png`, 1280×720, o quadro do fecho da
  própria cena — a regra que o `scripts/manim/README.md` registra para as velas.

> **Os números aqui saem de `scripts/manim/velas-sao-paulo.json`, rodada 25,
> snapshot de 2026-09-02** — 11º com 30 pts em 24 jogos, 8V 6E 10D, e a oscilação
> entre o 1º e o 16º. Eles **envelhecem**: um `sync-seed-data` seguido de uma
> reexportação move o vídeo, e este arquivo não é regerado por nada. Reconferir
> antes de publicar, contra o JSON e não contra esta página.
>
> Os mesmos três números estão **no quadro do fecho do próprio mp4**, no painel
> de resumo, que é de onde a capa sai. Conferidos ali: o quadro de 20,6s diz
> `11º · 30 pts em 24 jogos`, `8V · 6E · 10D` e `oscilou entre o 1º e o 16º`.
>
> **O saldo e o aproveitamento foram conferidos contra o `computeStandings`**, a
> mesma função que monta a tabela do site: 29 gols pró, 28 sofridos, saldo +1,
> 42% de aproveitamento, 12 pontos atrás do G4 (Fluminense, 42) e 5 à frente do
> 17º (Vasco, 25).

---

## O clube LIDEROU, e é isso que o desenho tem

**O São Paulo fechou a 5ª e a 6ª rodada em 1º lugar**, com o pavio tocando o 1º
da 3ª à 7ª. Foram **16 de 18 pontos nas seis primeiras rodadas — 89%**. Da 7ª em
diante são **14 pontos em 18 jogos, 26%**.

Duas taxas, a mesma temporada, o mesmo clube. É a campanha mais partida ao meio
das sete já desenhadas nesta série, e a única em que a vela toca o **topo** do
eixo e termina fora do G4.

| clube | melhor | pior | amplitude | forma |
|---|---|---|---|---|
| Corinthians | 3º | 19º | 16 | banheira |
| **São Paulo** | **1º** | **16º** | **15** | **penhasco** |
| Cruzeiro | 5º | 20º | 15 | escada subindo |
| Flamengo | 2º | 15º | 13 | sobe e assenta |
| Athletico-PR | 2º | 13º | 11 | — |
| Palmeiras | 1º | 11º | 10 | reta no topo |
| Bahia | 1º | 8º | 7 | — |

**O 16º é o pavio da 1ª rodada** e merece a ressalva de sempre: antes do primeiro
jogo os clubes empatados em nada são ordenados por **nome**, então as primeiras
rodadas carregam esse efeito. O **1º é real** — 5ª e 6ª rodadas, com 16 pontos.

## A 21ª rodada é uma vela VAZADA

O São Paulo não jogou a 21ª, então a campanha atravessa 25 rodadas com **24
partidas** — e no desenho essa rodada é um retângulo **só de contorno**, sem
preenchimento. É a convenção que o `rank-candles-core.ts` registra: uma rodada
sem jogo é desenhada oca e não em cinza, porque cinza ficaria ao lado do empate
em `ink-muted` e os dois não se distinguem numa marca de 5px.

**É o segundo clube da série com uma dessas** — o Flamengo, que não jogou a 4ª,
foi o primeiro. Vale conferir o quadro antes de publicar: a vela vazada está
entre a 20ª e a 22ª, e foi aberta e olhada num recorte ampliado antes de este
texto ser escrito.

## Título

Recomendado (79 caracteres):

```
São Paulo em velas: de líder ao 11º na campanha do Brasileirão 2026 (até a 25ª)
```

Abre com o clube, diz o que o desenho é — "em velas" é a curiosidade que segura
o clique de quem conhece candlestick de outro assunto — traz **a queda**, que é o
que este vídeo tem e os outros não, e **data o recorte**, que é a única defesa
contra alguém assistir daqui a três meses e achar que os números estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `11 rodadas sem vencer: a campanha do São Paulo em velas` | 55 | o buraco, e é o maior das sete campanhas |
| 3 | `Liderou a 6ª rodada e terminou em 11º: o São Paulo em velas` | 59 | as duas pontas, ambas verificáveis |
| 4 | `São Paulo: 25 rodadas em 21 segundos, posição e pontos \| Brasileirão 2026` | 73 | promete a duração, bom para retenção |

**"Tricolor" e "SPFC" não estão em nenhum deles, e estão nas tags**, pela mesma
regra dos outros vídeos de velas: o apelido é como o torcedor busca e não é como
o clube aparece no vídeo nem na tabela.

## Descrição

```
A campanha do São Paulo rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 02/09/2026 (25ª rodada):
• São Paulo — 11º, 30 pts em 24 JOGOS (não jogou a 21ª rodada)
• 8V · 6E · 10D — 29 gols pró, 28 sofridos, saldo +1
• 42% de aproveitamento, 12 pontos atrás do G4

Este é o único dos sete vídeos de velas em que a vela toca o TOPO do eixo e o clube termina fora do G4. O São Paulo fechou a 5ª e a 6ª rodada em 1º lugar, líder do Brasileirão, com 16 dos 18 pontos disputados — 89% de aproveitamento. Da 7ª rodada em diante foram 14 pontos em 18 jogos: 26%.

A mesma temporada, o mesmo clube, duas campanhas diferentes. O desenho mostra as duas de uma vez, que é uma coisa que a tabela não faz: 11º lugar com 42% descreve o conjunto e esconde as duas metades.

A queda tem data. As três primeiras derrotas são Atlético-MG (0 a 1) na 7ª, Palmeiras (0 a 1) na 8ª e Vitória (0 a 2) na 11ª — todas por um ou dois gols, nenhuma goleada, e é isso que faz a escada descer degrau a degrau em vez de despencar. Da 14ª à 24ª são ONZE rodadas sem vencer: dez jogos, 4 pontos de 30 possíveis, e o clube sai do 5º para o 13º.

E aqui está o que só este desenho conta: na 21ª rodada há uma vela VAZADA — só o contorno, sem preenchimento. É a rodada que o clube não jogou. Ela é o jogo a menos, desenhado, e é por isso que a barra de pontos embaixo tem um degrau a menos que a dos rivais naquele ponto.

O fim tem uma vírgula. A 25ª rodada é uma vitória por 2 a 1 sobre o Bragantino, em casa, que devolve duas posições — do 13º ao 11º. É a vela verde solitária à direita de um bloco vermelho, e é a única coisa no desenho que aponta para cima na segunda metade.

A oscilação de 1º a 16º precisa de uma ressalva honesta: o 16º é o pavio da 1ª rodada, antes de qualquer jogo, quando os clubes empatados em nada são ordenados por NOME. O 1º é real.

O eixo mostra a divisão inteira, 1º no topo e 20º embaixo, com as faixas do G4 e do Z4 ao fundo. Uma escala por clube esconderia justamente o que este desenho tem: a distância entre onde o São Paulo esteve e onde ele terminou.

Nenhum número foi digitado à mão. A animação lê a mesma função que calcula as velas no Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #SaoPaulo #SPFC #Tricolor #Manim #DataViz #VisualizacaoDeDados #Futebol #Python
```

### O parágrafo que muda, e por que ele não podia ser copiado

Cada vídeo de velas vendeu um ângulo diferente: o Palmeiras a liderança, o
Flamengo a vela vazada e o jogo a menos, o Cruzeiro a subida do fundo, o
Corinthians a amplitude. Este vende **duas taxas** — 89% e 26% — e elas são o
único par desta série em que a mesma campanha se lê como dois clubes.

**A vela vazada aparece nos dois**, aqui e no Flamengo, e a diferença é onde ela
cai: lá na 4ª rodada, no meio de uma subida, e aqui na 21ª, no meio do jejum. No
Flamengo ela explica 4 pontos de diferença para o líder; aqui ela é um jogo a
menos numa sequência em que o clube não estava ganhando de qualquer forma.

### Versão curta

Para Short, ou onde a descrição longa não couber.

```
A campanha do São Paulo em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela, e a barra de baixo são os pontos. Ele LIDEROU o Brasileirão na 5ª e na 6ª rodada, com 89% de aproveitamento — e fez 26% da 7ª em diante. Da 14ª à 24ª foram onze rodadas sem vencer. A vela vazada na 21ª é a rodada que ele não jogou. Dados até a 25ª: 11º, 30 pts em 24 jogos, 8V 6E 10D.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #SaoPaulo #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola. 444
caracteres, 27 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, são paulo, sao paulo, são paulo fc, spfc, tricolor paulista, campanha do são paulo, classificação brasileirão, tabela do brasileirão, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, data visualization, dataviz, manim, animação em python, python, estatísticas de futebol, football analytics, portal brasileirão, rodada 25
```

Quatro blocos deliberados, na ordem do volume de busca: futebol, o clube, o
vocabulário do desenho (`candlestick` e `gráfico de velas` trazem um público que
não busca futebol), e por fim dataviz e Manim — menor, mas é quem assiste 21
segundos de gráfico até o fim e clica no repositório. `brasileirao` e `sao paulo`
sem acento estão na lista de propósito: muita gente digita sem, e o YouTube não
normaliza acentuação em tags.

**`spfc` entra e o `tla` do payload NÃO**, e a distinção vale porque as duas
parecem a mesma coisa. `spfc` é como o torcedor escreve. O `tla` que o provedor
manda para este clube é **`PAU`** — o `CLAUDE.md` registra essa esquisitice em
*upstream club codes are not always the local seed codes* — e ninguém no mundo
busca o São Paulo por `PAU`. Mesma conclusão do vídeo do Corinthians, onde o
`tla` ficou de fora porque `COR` é também o do Coritiba, e por caminhos opostos:
lá o `tla` era ambíguo, aqui ele é simplesmente estranho.

**Nenhuma tag de posição entrou.** 11º lugar não é algo que alguém busque, e
`campanha do são paulo` cobre a intenção sem prometer um número que a próxima
rodada muda.

## Miniatura

`velas-sao-paulo-miniatura.png`, 1280×720, o **quadro do fecho da própria cena** —
e não um layout à parte como as capas do `campanhas` e do `pontos`, porque os
primeiros segundos são um gráfico vazio.

```sh
ffmpeg -ss 20.6 -i docs/medias/sao-paulo/velas-sao-paulo.mp4 -frames:v 1 -vf scale=1280:720 \
  docs/medias/sao-paulo/velas-sao-paulo-miniatura.png
```

O `-ss 20.6` num vídeo de 21,1s é estreito de propósito e **não** sobra para
arredondar: antes disso o painel de resumo ainda está entrando — ele só assenta
em **t=19**, medido — e depois o vídeo acabou. Conferir o PNG antes de subir.
Aqui ele foi aberto: o painel de resumo inteiro com `11º · 30 pts em 24 jogos` e
o card da 25ª rodada com `2 × 1 Bragantino (casa)`.

**Como capa este clube é o melhor do conjunto até agora.** A campanha desenha um
platô no alto e uma escada descendo, o que é legível em miniatura sem precisar
ler número nenhum — e o painel de resumo cai no canto inferior esquerdo, que
neste clube está genuinamente **vazio**, porque o São Paulo passou a primeira
metade da temporada na parte de cima do eixo. É o primeiro dos sete em que o
painel não cobre vela nenhuma.

## O resto do formulário

- **Público:** "Não, não é conteúdo para crianças". Marcar "sim" desliga
  comentários e cards, e um gráfico de futebol não é conteúdo infantil.
- **Elementos do vídeo:** telas finais precisam de 5s livres no fim, e aqui esses
  5s são exatamente o painel de resumo — que é a parte que vale. Pular.
- **Playlists:** este é o décimo vídeo do conjunto (campanhas, pontos, velas) e o
  sétimo com a cena `velas.py`.

## Título do arquivo

O YouTube usa o nome do arquivo como título provisório, então subir
`velas-sao-paulo.mp4` deixa `velas sao paulo` no campo — trocar antes de
publicar.
