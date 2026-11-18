# YouTube — velas do Cruzeiro

Texto que acompanha [`velas-cruzeiro.mp4`](velas-cruzeiro.mp4)
(1920×1080, 60fps, 26s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 26s não comporta.
- **Com capa:** `velas-cruzeiro-miniatura.png`, 1280×720, o quadro do fecho da
  própria cena — a regra que o `scripts/manim/README.md` registra para as velas.
- **Cortes verticais:** `velas-cruzeiro-45.mp4` (1080×1350, feed do Instagram) e `velas-cruzeiro-916.mp4` (1080×1920, Reels e YouTube Short).

> **Os números aqui saem de `scripts/manim/velas-cruzeiro.json`, rodada 35,
> snapshot de 2026-11-18** — 3º com 60 pts, 18V 6E 10D, e a oscilação entre
> o 3º e o 20º, que é a faixa que o painel do vídeo imprime. Eles **envelhecem**: um `sync-seed-data` seguido de uma
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
> entre o 3º e o 20º e o painel diz 3º e 20º.
>
> **O saldo e o aproveitamento vêm do `computeStandings`**, a mesma função que
> monta a tabela do site, e não somados à mão a partir do JSON.
>
> **As duas réguas tracejadas saem do `events` do mesmo JSON**, pelo
> `eventMarks` que o Painel do site já desenha — a saída de Tite após a 6ª
> rodada e a paralisação para a Copa após a 18ª. Elas também envelhecem: um
> acontecimento acrescentado ao `src/data/events.ts` aparece na próxima
> reexportação, e a descrição abaixo nomeia duas.

---

## Título

Recomendado (57 caracteres):

```
Cruzeiro: do 20º ao 3º em 34 rodadas, a campanha em velas
```

A subida, medida do pior fechamento até o atual — e **data o recorte**, que é a única defesa contra
alguém assistir daqui a três meses e achar que os números estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `Cruzeiro em velas: 17 posições de amplitude real, a maior da Série A` | 68 | a amplitude descontada a ordenação alfabética das duas primeiras rodadas |
| 3 | `A campanha do Cruzeiro rodada a rodada \| Brasileirão 2026 em candlestick` | 72 | genérico e buscável |

**Os apelidos não estão em nenhum deles, e estão nas tags**: é como o torcedor
busca, e não é como o clube aparece no vídeo nem na tabela.

## Descrição

```
A campanha do Cruzeiro rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 18/11/2026 (34ª rodada):
• Cruzeiro — 3º, 60 pts em 34 jogos
• 18V · 6E · 10D — 55 gols pró, 48 contra, saldo +7
• 59% de aproveitamento · oscilou entre o 3º e o 20º

O Cruzeiro esteve em 20º e fecha o recorte em 3º — 17 posições ganhas desde o fundo da campanha. Nas velas isso é uma escada, e é o desenho oposto ao de quem lidera.

Uma ressalva que a maioria dos clubes não precisa dar, e que aqui vale a favor: a amplitude do Cruzeiro NÃO vem das duas primeiras rodadas, onde os empatados em nada são ordenados por nome. Descontadas elas, ele oscila 17 posições — **a maior faixa real da divisão**, à frente das 13 de Botafogo, Corinthians e São Paulo.

O preço está nas 10 derrotas em 34 jogos — mais que qualquer outro clube do G4 —, o número de quem começou mal, e a barra de pontos embaixo muda de inclinação e não volta.

As duas réguas tracejadas que cruzam o desenho são acontecimentos de fora de campo, e cada uma cai na FRONTEIRA entre duas rodadas em vez de sobre uma: a saída de Tite depois da 6ª rodada, e a paralisação para a Copa do Mundo depois da 18ª. A primeira é a explicação da escada — o clube estava em 19º quando ela aparece.

O eixo mostra a divisão inteira, 1º no topo e 20º embaixo, com as faixas do G4 e do Z4 ao fundo — é isso que permite comparar este vídeo com o de qualquer outro clube.

Nenhum número foi digitado à mão. A animação lê a mesma função que calcula as velas no Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #Cruzeiro #Manim #DataViz #Futebol #Python #Candlestick
```

As duas primeiras linhas — o que aparece antes do "mostrar mais" — são a
abertura e a linha em branco seguinte, então a frase de abertura precisa
carregar o vídeo sozinha.

### Versão curta

Para Short, ou onde a descrição longa não couber.

```
A campanha do Cruzeiro em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela, e a barra de baixo são os pontos. As réguas tracejadas marcam a saída de Tite e a parada para a Copa. Do 20º ao 3º: 17 posições de subida. Dados até a 34ª: 60 pts, 18V 6E 10D, saldo +7.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #Cruzeiro #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola.
286 caracteres, 21 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, cruzeiro, raposa, cabuloso, cec, campanha do cruzeiro, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, dataviz, manim, python, portal brasileirão, rodada 34, tite
```

`tite` entra porque o vídeo agora **marca** a saída dele, e é assim que o
torcedor busca esse recorte da temporada. As outras duas réguas do vocabulário
— "acontecimento", "régua" — ficam de fora: descrevem a marca e não o assunto.
