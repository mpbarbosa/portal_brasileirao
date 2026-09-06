# YouTube — velas do Flamengo

Texto que acompanha [`velas-flamengo.mp4`](velas-flamengo.mp4)
(1920×1080, 60fps, 21s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 21s não comporta.
- **Com capa:** `velas-flamengo-miniatura.png`, 1280×720, o quadro do fecho da
  própria cena — a regra que o `scripts/manim/README.md` registra para as velas.

> **Os números aqui saem de `scripts/manim/velas-flamengo.json`, rodada 25,
> snapshot de 2026-09-02** — 2º com 48 pts, 14V 6E 4D, e a oscilação entre o 2º
> e o 15º. Eles **envelhecem**: um `sync-seed-data` seguido de uma reexportação
> move o vídeo, e este arquivo não é regerado por nada. Reconferir antes de
> publicar, contra o JSON e não contra esta página.
>
> Os mesmos três números estão **no quadro do fecho do próprio mp4**, no painel
> de resumo, que é de onde a capa sai. Conferidos ali: o quadro de 20,6s diz
> `2º · 48 pts em 24 jogos`, `14V · 6E · 4D` e `oscilou entre o 2º e o 15º`.
>
> **O saldo, os gols e o aproveitamento foram conferidos contra o
> `computeStandings`**, a mesma função que monta a tabela do site: 48 gols pró,
> 21 sofridos, saldo +27, 67% de aproveitamento — e os três primeiros lugares
> em **gols pró (48)**, **gols sofridos (21, empatado com o Palmeiras)** e
> **saldo (+27)** são todos do Flamengo ou dividido com ele.

---

## São 25 RODADAS e 24 JOGOS, e essa diferença é o vídeo inteiro

**Leia isto antes de escrever qualquer número.** O Flamengo não jogou a **4ª
rodada** no recorte da semente, então a campanha atravessa 25 rodadas com 24
partidas. Duas consequências que é fácil errar:

- O painel de resumo diz **"48 pts em 24 jogos"**, não em 25. O do Palmeiras diz
  52 em 25. **A diferença de 4 pontos é sobre um jogo a menos** — dizer "4 atrás"
  sem dizer isso é a meia-verdade mais fácil de cometer aqui.
- No desenho, a 4ª rodada é uma vela **vazada** — só o contorno, sem
  preenchimento. É a convenção que o `rank-candles-core.ts` registra: uma rodada
  sem jogo é desenhada oca e não em cinza, porque cinza ficaria ao lado do empate
  em `ink-muted` e os dois não se distinguem numa marca de 5px.

**Este é o primeiro dos vídeos de velas em que essa vela aparece.** Fluminense,
Athletico-PR, Bahia, Cruzeiro e Palmeiras jogaram todas as 25 rodadas do
recorte; o Flamengo não. Vale conferir o quadro antes de publicar — a vela vazada
está entre a 3ª e a 5ª, e foi aberta e olhada em 1280×720 e num recorte ampliado
antes de este texto ser escrito.

## Título

Recomendado (77 caracteres):

```
Flamengo em velas: a campanha rodada a rodada do Brasileirão 2026 (até a 25ª)
```

Abre com o clube, diz o que o desenho é — "em velas" é a curiosidade que segura
o clique de quem conhece candlestick de outro assunto — e **data o recorte**, que
é a única defesa contra alguém assistir daqui a três meses e achar que os números
estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `14 rodadas seguidas em 2º: a campanha do Flamengo em velas` | 58 | o número que este desenho mostra e a tabela não; envelhece na próxima rodada |
| 3 | `Melhor ataque, melhor saldo, 2º lugar: o Flamengo em velas` | 58 | a tensão da temporada em seis palavras, e é tudo verificável |
| 4 | `Flamengo: 25 rodadas em 21 segundos, posição e pontos \| Brasileirão 2026` | 72 | promete a duração, bom para retenção |

**"Mengão" e "Rubro-Negro" não estão em nenhum deles, e estão nas tags**, pela
mesma regra dos outros vídeos de velas: o apelido é como o torcedor busca e não é
como o clube aparece no vídeo nem na tabela.

## Descrição

```
A campanha do Flamengo rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 02/09/2026 (25ª rodada):
• Flamengo — 2º, 48 pts em 24 JOGOS (não jogou a 4ª rodada)
• 14V · 6E · 4D — 48 gols pró, 21 sofridos, saldo +27
• 67% de aproveitamento, 4 pontos atrás do líder com um jogo a menos

O melhor ataque da Série A, a defesa menos vazada junto com o Palmeiras, o melhor saldo de gols — e o segundo lugar. É essa a tensão que a vela desenha: da 12ª rodada em diante o Flamengo fecha em 2º TODAS as vezes. Quatorze rodadas seguidas, sem uma única exceção, coladas na mesma linha.

E aqui está o que só este desenho conta: na 4ª rodada há uma vela VAZADA — só o contorno, sem preenchimento. É a rodada que o clube não jogou. Ela é o jogo a menos, desenhado; é por isso que a barra de pontos embaixo tem um degrau a menos que a dos rivais, e é por isso que "4 pontos atrás" não é a leitura completa da tabela.

O começo foi bem outro. O Flamengo abriu a temporada em 13º, perdeu a 1ª rodada e caiu ao 15º na 2ª — o pior lugar da campanha dele. A subida é da 5ª à 12ª: 2 a 0 no Cruzeiro, 3 a 0 no Botafogo, 3 a 0 no Remo, e o pavio da 5ª rodada abre onze posições, do 4º ao 15º, o mais largo da temporada fora da abertura.

São 4 derrotas em 24 jogos, e duas delas por 0 a 3 — Bragantino na 9ª e Palmeiras na 17ª. A da 17ª é a que mais diz: perdeu para o líder por três e NÃO saiu do 2º lugar. Corpo vermelho de altura zero. A cor diz o resultado e a geometria diz a direção, em canais separados de propósito, porque as rodadas que valem a pena olhar são as que os dois discordam.

A oscilação de 2º a 15º merece a mesma ressalva de sempre: o 15º é a 2ª rodada, quase no começo. Antes do primeiro jogo os clubes empatados em nada são ordenados por NOME, e as duas primeiras rodadas ainda carregam esse efeito.

O eixo mostra a divisão inteira, 1º no topo e 20º embaixo, com as faixas do G4 e do Z4 ao fundo. Uma escala por clube faria estas quatorze rodadas em 2º parecerem uma campanha movimentada.

Nenhum número foi digitado à mão. A animação lê a mesma função que calcula as velas no Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #Flamengo #Mengao #Manim #DataViz #VisualizacaoDeDados #Futebol #Python #Candlestick
```

### O parágrafo que muda, e por que ele não podia ser copiado

Cada vídeo de velas vendeu um ângulo diferente, e o deste é **uma marca que os
outros cinco não têm**. Medido sobre os seis payloads:

| clube | melhor | pior | rodadas sem jogo | maior sequência na mesma posição |
|---|---|---|---|---|
| **Flamengo** | 2º | 15º | **1 (a 4ª)** | **14 em 2º (12ª à 25ª)** |
| Palmeiras | 1º | 11º | 0 | 18 em 1º (8ª à 25ª) |
| Bahia | 1º | 8º | 0 | — |
| Fluminense | 2º | 12º | 0 | — |
| Athletico-PR | 2º | 13º | 0 | — |
| Cruzeiro | 5º | 20º | 0 | — |

O Palmeiras tem a sequência mais longa, então "ficou parado no mesmo lugar" não é
exclusivo daqui — o que é exclusivo é **a vela vazada**, e ela não é decoração:
é o jogo a menos, que é exatamente o que separa 48 pontos de 52. O vídeo do
Palmeiras vende a liderança; este vende **a distância até ela, e o asterisco que
a explica**.

**Publicado ao lado dos vídeos do Palmeiras e do Cruzeiro, os três se leem
juntos**: mesma rodada, mesma cena, mesmo eixo — a linha reta no topo, a escada
de quinze degraus subindo do 20º, e a linha reta um degrau abaixo do topo com um
buraco no meio.

### Versão curta

Para Short, ou onde a descrição longa não couber.

```
A campanha do Flamengo em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela, e a barra de baixo são os pontos. Da 12ª rodada em diante ele fecha em 2º todas as vezes — 14 seguidas. A vela vazada na 4ª é a rodada que ele não jogou, e é o jogo a menos que explica os 4 pontos de diferença. Dados até a 25ª: 48 pts em 24 jogos, 14V 6E 4D, melhor saldo da Série A (+27).

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #Flamengo #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola. 468
caracteres, 28 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, flamengo, cr flamengo, clube de regatas do flamengo, mengão, rubro-negro, campanha do flamengo, vice-líder, classificação brasileirão, tabela do brasileirão, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, data visualization, dataviz, manim, animação em python, python, estatísticas de futebol, football analytics, portal brasileirão, rodada 25
```

Quatro blocos deliberados, na ordem do volume de busca: futebol, o clube, o
vocabulário do desenho (`candlestick` e `gráfico de velas` trazem um público que
não busca futebol), e por fim dataviz e Manim — menor, mas é quem assiste 21
segundos de gráfico até o fim e clica no repositório. `brasileirao` sem acento
está na lista de propósito: muita gente digita sem, e o YouTube não normaliza
acentuação em tags.

**O bloco do clube tem cinco grafias e a sigla ficou de fora**, como nos vídeos
do Cruzeiro e do Palmeiras. `flamengo` é o nome como a tabela escreve, `cr
flamengo` e `clube de regatas do flamengo` são as formas formais, `mengão` e
`rubro-negro` são os apelidos. O `tla` do payload é `FLA` e **não** entrou: vale
o aviso do `CLAUDE.md` sobre `tla` não ser identidade, e três letras que são o
começo do nome não acrescentam alcance sobre a tag `flamengo`.

**`vice-líder` é a tag que envelhece**, e mais rápido que as outras deste
conjunto, porque o Flamengo tem um jogo a menos: uma rodada pode trocar a
liderança sem que ninguém perca ponto nenhum. Primeira a sair.

## Miniatura

`velas-flamengo-miniatura.png`, 1280×720, o **quadro do fecho da própria cena** —
e não um layout à parte como as capas do `campanhas` e do `pontos`, porque os
primeiros segundos são um gráfico vazio.

```sh
ffmpeg -ss 20.6 -i docs/medias/flamengo/velas-flamengo.mp4 -frames:v 1 -vf scale=1280:720 \
  docs/medias/flamengo/velas-flamengo-miniatura.png
```

O `-ss 20.6` num vídeo de 21,1s é estreito de propósito e **não** sobra para
arredondar: antes disso o painel de resumo ainda está entrando, e depois o vídeo
acabou. Conferir o PNG antes de subir. Aqui ele foi aberto: o painel de resumo
inteiro com `2º · 48 pts em 24 jogos` e o card da 25ª rodada com
`3 × 0 Botafogo (casa)`.

**Como capa este clube rende mais que o Palmeiras e menos que o Cruzeiro:** a
campanha sobe do 15º ao 2º na primeira metade e depois achata, então o quadro
tem um movimento visível à esquerda e uma reta à direita — e a vela vazada da 4ª
é um detalhe que só se vê ampliado, não em miniatura.

## O resto do formulário

- **Público:** "Não, não é conteúdo para crianças". Marcar "sim" desliga
  comentários e cards, e um gráfico de futebol não é conteúdo infantil.
- **Elementos do vídeo:** telas finais precisam de 5s livres no fim, e aqui esses
  5s são exatamente o painel de resumo — que é a parte que vale. Pular.
- **Playlists:** este é o oitavo vídeo do conjunto (campanhas, pontos, velas) e o
  sexto com a cena `velas.py`.

## Título do arquivo

O YouTube usa o nome do arquivo como título provisório, então subir
`velas-flamengo.mp4` deixa `velas flamengo` no campo — trocar antes de publicar.
