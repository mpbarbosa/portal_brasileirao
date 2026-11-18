# YouTube — velas do Athletico-PR

Texto que acompanha [`velas-athletico-pr.mp4`](velas-athletico-pr.mp4)
(1920×1080, 60fps, 26s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 26s não comporta.
- **Com capa:** `velas-athletico-pr-miniatura.png`, 1280×720, o quadro do fecho da
  própria cena — a regra que o `scripts/manim/README.md` registra para as velas.
- **Cortes verticais:** `velas-athletico-pr-45.mp4` (1080×1350, feed do Instagram) e `velas-athletico-pr-916.mp4` (1080×1920, Reels e YouTube Short).

> **Os números aqui saem de `scripts/manim/velas-athletico-pr.json`, rodada 35,
> snapshot de 2026-11-18** — 5º com 54 pts, 15V 9E 10D, e a oscilação entre
> o 2º e o 13º, que é a faixa que o painel do vídeo imprime. Eles **envelhecem**: um `sync-seed-data` seguido de uma
> reexportação move o vídeo, e este arquivo não é regerado por nada. Reconferir
> antes de publicar, contra o JSON e não contra esta página.
>
> **A última vela é oca.** Da 35ª rodada só um jogo foi disputado até o
> snapshot (Mirassol 0x0 Atlético-MG), então este clube, como outros dezessete,
> fecha o desenho numa rodada em que ainda não jogou — o card do vídeo diz
> «sem jogo nesta rodada». Os 34 jogos são as 34 primeiras rodadas, sem partida
> em atraso, e é por isso que a cópia abaixo data o recorte na 34ª.
>
> Os mesmos números estão **no quadro do fecho do próprio mp4**, no painel de
> resumo, que é de onde a capa sai — então uma divergência entre este texto e a
> imagem que o acompanha é visível a olho nu.
>
> **A oscilação do painel é INTRA-rodada e não a faixa de fechamento**, e as
> duas diferem para 15 dos 20 clubes. O painel conta as posições ocupadas
> enquanto a rodada era jogada — o pavio —, então ele é sempre igual ou mais
> largo que o intervalo entre o melhor e o pior FECHAMENTO. Este clube fecha
> entre o 3º e o 12º e o painel diz 2º e 13º.
>
> **O saldo e o aproveitamento vêm do `computeStandings`**, a mesma função que
> monta a tabela do site, e não somados à mão a partir do JSON.
>
> **A régua tracejada sai do `events` do mesmo JSON**, pelo
> `eventMarks` que o Painel do site já desenha — a paralisação para a Copa do Mundo depois da 18ª rodada. Ela também
> envelhece: um acontecimento acrescentado ao `src/data/events.ts` aparece na
> próxima reexportação, e a descrição abaixo a nomeia.

---

## Título

Recomendado (62 caracteres):

```
Athletico-PR: 10 rodadas invicto e o 5º lugar até a 34ª rodada
```

A invencibilidade, a segunda maior da divisão, empatada com as do Bahia e do Flamengo — e **data o recorte**, que é a única defesa contra
alguém assistir daqui a três meses e achar que os números estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `A campanha do Athletico-PR rodada a rodada \| Brasileirão 2026 em candlestick` | 76 | genérico e buscável |
| 3 | `Athletico-PR em velas: 54 pontos, 15V 9E 10D e saldo +8` | 55 | o número duro |

**Os apelidos não estão em nenhum deles, e estão nas tags**: é como o torcedor
busca, e não é como o clube aparece no vídeo nem na tabela.

## Descrição

```
A campanha do Athletico-PR rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 18/11/2026 (34ª rodada):
• Athletico-PR — 5º, 54 pts em 34 jogos
• 15V · 9E · 10D — 51 gols pró, 43 contra, saldo +8
• 53% de aproveitamento · oscilou entre o 2º e o 13º

O Athletico-PR nunca liderou e nunca chegou perto do Z4: fecha a temporada inteira entre o 3º e o 12º. O painel do vídeo diz 2º e 13º porque conta também as posições ocupadas DENTRO das rodadas — é o pavio, e a diferença entre os dois números é exatamente o que esta cena existe para mostrar.

São 10 rodadas sem perder na maior série, atrás só das 14 do Palmeiras e do mesmo tamanho das do Bahia e do Flamengo, contra 10 derrotas em 34 jogos. O recorte fecha em queda: um ponto nos últimos quatro jogos, e o 3º lugar em que o clube fechou 12 das 13 rodadas entre a 19ª e a 31ª virou 5º.

A régua tracejada que cruza o desenho é o acontecimento de fora de campo que tocou os vinte clubes: a paralisação para a Copa do Mundo depois da 18ª rodada. Ela cai na FRONTEIRA entre duas rodadas em vez de sobre uma, porque é isso que ela separa — o que veio antes dela e o que veio depois. Aqui o clube parou em 4º com 30 pts.

O eixo mostra a divisão inteira, 1º no topo e 20º embaixo, com as faixas do G4 e do Z4 ao fundo — é isso que permite comparar este vídeo com o de qualquer outro clube.

Nenhum número foi digitado à mão. A animação lê a mesma função que calcula as velas no Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #AthleticoPR #Manim #DataViz #Futebol #Python #Candlestick
```

As duas primeiras linhas — o que aparece antes do "mostrar mais" — são a
abertura e a linha em branco seguinte, então a frase de abertura precisa
carregar o vídeo sozinha.

### Versão curta

Para Short, ou onde a descrição longa não couber.

```
A campanha do Athletico-PR em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela, e a barra de baixo são os pontos. A régua tracejada marca a parada para a Copa. 10 rodadas de invencibilidade, a segunda maior da série a. Dados até a 34ª: 54 pts, 15V 9E 10D, saldo +8.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #AthleticoPR #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola.
310 caracteres, 21 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, athletico-pr, furacão, furacao, cap, athletico paranaense, campanha do athletico-pr, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, dataviz, manim, python, portal brasileirão, rodada 34
```

Nenhuma tag nova: o único acontecimento que o vídeo marca é a paralisação
para a Copa, que não nomeia ninguém — e uma tag aqui nomeia a PESSOA que o
desenho passou a marcar, que foi o critério do `velas-cruzeiro`. O vocabulário
da marca — "acontecimento", "régua" — descreve o desenho e não o assunto.
