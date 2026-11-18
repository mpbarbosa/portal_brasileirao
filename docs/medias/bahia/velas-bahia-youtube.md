# YouTube — velas do Bahia

Texto que acompanha [`velas-bahia.mp4`](velas-bahia.mp4)
(1920×1080, 60fps, 26s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 26s não comporta.
- **Com capa:** `velas-bahia-miniatura.png`, 1280×720, o quadro do fecho da
  própria cena — a regra que o `scripts/manim/README.md` registra para as velas.
- **Cortes verticais:** `velas-bahia-45.mp4` (1080×1350, feed do Instagram) e `velas-bahia-916.mp4` (1080×1920, Reels e YouTube Short).

> **Os números aqui saem de `scripts/manim/velas-bahia.json`, rodada 35,
> snapshot de 2026-11-18** — 6º com 53 pts, 14V 11E 9D, e a oscilação entre
> o 1º e o 8º, que é a faixa que o painel do vídeo imprime. Eles **envelhecem**: um `sync-seed-data` seguido de uma
> reexportação move o vídeo, e este arquivo não é regerado por nada. Reconferir
> antes de publicar, contra o JSON e não contra esta página.
>
> **A última vela é oca.** Da 35ª rodada só um jogo foi disputado até o
> snapshot (Mirassol 0x0 Atlético-MG), então este clube, como outros dezessete,
> fecha o desenho numa rodada em que ainda não jogou — o card do vídeo diz
> «sem jogo nesta rodada». Os 34 jogos são as 34 primeiras rodadas, sem partida
> em atraso, e é por isso que a cópia abaixo data o recorte na 34ª.
>
> **O recorte fecha com um 2x3 fora de casa contra o Cruzeiro**, na 34ª, que
> manteve o 6º lugar.
>
> Os mesmos números estão **no quadro do fecho do próprio mp4**, no painel de
> resumo, que é de onde a capa sai — então uma divergência entre este texto e a
> imagem que o acompanha é visível a olho nu.
>
> **A oscilação do painel é INTRA-rodada e não a faixa de fechamento**, e as
> duas diferem para 15 dos 20 clubes. O painel conta as posições ocupadas
> enquanto a rodada era jogada — o pavio —, então ele é sempre igual ou mais
> largo que o intervalo entre o melhor e o pior FECHAMENTO. Este clube fecha
> entre o 1º e o 7º e o painel diz 1º e 8º.
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

Recomendado (60 caracteres):

```
Bahia em velas: 34 rodadas fechando sempre entre o 1º e o 7º
```

O fato que separa esta campanha, medido contra os vinte: só o Fluminense
(3º-6º) e o Clube do Remo (16º-20º) fecham numa faixa mais estreita, e a do
Bahia é a única faixa estreita que inclui a liderança. **Um título anterior era
sobre os empates e foi retirado por estar errado** — e o número segue mudando
de dono: hoje são 11, o maior da divisão, dividido com outros quatro clubes.
E **data o recorte**, que é a única defesa contra
alguém assistir daqui a três meses e achar que os números estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `Bahia: 11 empates em 34 jogos, o maior número da Série A ao lado de mais quatro` | 79 | o empate, dito com o número certo |
| 3 | `Bahia: 53 pontos, 14V 11E 9D e saldo +5 \| Brasileirão 2026` | 58 | o número duro |

**Os apelidos não estão em nenhum deles, e estão nas tags**: é como o torcedor
busca, e não é como o clube aparece no vídeo nem na tabela.

## Descrição

```
A campanha do Bahia rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 18/11/2026 (34ª rodada):
• Bahia — 6º, 53 pts em 34 jogos
• 14V · 11E · 9D — 50 gols pró, 45 contra, saldo +5
• 52% de aproveitamento · oscilou entre o 1º e o 8º

O Bahia tem 11 empates em 34 jogos, o maior número da Série A — dividido com Clube do Remo, Internacional, Mirassol e Santos. No desenho isso é uma fileira de corpos amarelos de altura curta — a rodada aconteceu, a posição mal se moveu.

É também uma campanha que chegou a liderar (1 rodada em 1º, a 7ª) e que fecha sempre entre o 1º e o 7º. 10 rodadas de invencibilidade na maior série, 9 derrotas no total. A estabilidade aqui é causada pelo empate, não pela vitória — e é a vela, não a tabela, que deixa isso à vista.

A régua tracejada que cruza o desenho é o acontecimento de fora de campo que tocou os vinte clubes: a paralisação para a Copa do Mundo depois da 18ª rodada. Ela cai na FRONTEIRA entre duas rodadas em vez de sobre uma, porque é isso que ela separa — o que veio antes dela e o que veio depois. Aqui o clube parou em 6º com 29 pts.

O eixo mostra a divisão inteira, 1º no topo e 20º embaixo, com as faixas do G4 e do Z4 ao fundo — é isso que permite comparar este vídeo com o de qualquer outro clube.

Nenhum número foi digitado à mão. A animação lê a mesma função que calcula as velas no Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #Bahia #Manim #DataViz #Futebol #Python #Candlestick
```

As duas primeiras linhas — o que aparece antes do "mostrar mais" — são a
abertura e a linha em branco seguinte, então a frase de abertura precisa
carregar o vídeo sozinha.

### Versão curta

Para Short, ou onde a descrição longa não couber.

```
A campanha do Bahia em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela, e a barra de baixo são os pontos. A régua tracejada marca a parada para a Copa. 11 empates, o maior número da divisão ao lado de outros quatro clubes. Dados até a 34ª: 53 pts, 14V 11E 9D, saldo +5.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #Bahia #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola.
304 caracteres, 22 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, bahia, esquadrão, esquadrao, tricolor de aço, bahêa, bahea, campanha do bahia, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, dataviz, manim, python, portal brasileirão, rodada 34
```

Nenhuma tag nova: o único acontecimento que o vídeo marca é a paralisação
para a Copa, que não nomeia ninguém — e uma tag aqui nomeia a PESSOA que o
desenho passou a marcar, que foi o critério do `velas-cruzeiro`. O vocabulário
da marca — "acontecimento", "régua" — descreve o desenho e não o assunto.
