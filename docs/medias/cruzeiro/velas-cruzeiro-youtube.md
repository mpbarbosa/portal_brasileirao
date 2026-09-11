# YouTube — velas do Cruzeiro

Texto que acompanha [`velas-cruzeiro.mp4`](velas-cruzeiro.mp4)
(1920×1080, 60fps, 22s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 22s não comporta.
- **Com capa:** `velas-cruzeiro-miniatura.png`, 1280×720, o quadro do fecho da
  própria cena — a regra que o `scripts/manim/README.md` registra para as velas.
- **Cortes verticais:** `velas-cruzeiro-45.mp4` (1080×1350, feed do Instagram) e `velas-cruzeiro-916.mp4` (1080×1920, Reels e YouTube Short).

> **Os números aqui saem de `scripts/manim/velas-cruzeiro.json`, rodada 26,
> snapshot de 2026-09-11** — 6º com 42 pts, 12V 6E 8D, e a oscilação entre
> o 5º e o 20º, que é a faixa que o painel do vídeo imprime. Eles **envelhecem**: um `sync-seed-data` seguido de uma
> reexportação move o vídeo, e este arquivo não é regerado por nada. Reconferir
> antes de publicar, contra o JSON e não contra esta página.
>
> Os mesmos números estão **no quadro do fecho do próprio mp4**, no painel de
> resumo, que é de onde a capa sai — então uma divergência entre este texto e a
> imagem que o acompanha é visível a olho nu.
>
> **A oscilação do painel é INTRA-rodada e não a faixa de fechamento**, e as
> duas diferem para 15 dos 20 clubes. O painel conta as posições ocupadas
> enquanto a rodada era jogada — o pavio —, então ele é sempre igual ou mais
> largo que o intervalo entre o melhor e o pior FECHAMENTO. Este clube fecha
> entre o 5º e o 20º e o painel diz 5º e 20º.
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
Cruzeiro: do 20º ao 6º em 26 rodadas, a campanha em velas
```

A subida, medida do pior fechamento até o atual — e **data o recorte**, que é a única defesa contra
alguém assistir daqui a três meses e achar que os números estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `Cruzeiro em velas: 15 posições de amplitude real, a maior da Série A` | 68 | a amplitude descontada a ordenação alfabética das duas primeiras rodadas |
| 3 | `A campanha do Cruzeiro rodada a rodada \| Brasileirão 2026 em candlestick` | 72 | genérico e buscável |

**Os apelidos não estão em nenhum deles, e estão nas tags**: é como o torcedor
busca, e não é como o clube aparece no vídeo nem na tabela.

## Descrição

```
A campanha do Cruzeiro rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 11/09/2026 (26ª rodada):
• Cruzeiro — 6º, 42 pts em 26 jogos
• 12V · 6E · 8D — 38 gols pró, 37 contra, saldo +1
• 54% de aproveitamento · oscilou entre o 5º e o 20º

O Cruzeiro esteve em 20º e fecha o recorte em 6º — 14 posições ganhas desde o fundo da campanha. Nas velas isso é uma escada, e é o desenho oposto ao de quem lidera.

Uma ressalva que a maioria dos clubes não precisa dar, e que aqui vale a favor: a amplitude do Cruzeiro NÃO vem das duas primeiras rodadas, onde os empatados em nada são ordenados por nome. Descontadas elas, ele oscila 15 posições — a maior faixa real da divisão.

O preço está nas 8 derrotas em 26 jogos, o número alto de quem começou mal, e a barra de pontos embaixo muda de inclinação e não volta.

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
A campanha do Cruzeiro em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela, e a barra de baixo são os pontos. As réguas tracejadas marcam a saída de Tite e a parada para a Copa. Do 20º ao 6º: 14 posições de subida. Dados até a 26ª: 42 pts, 12V 6E 8D, saldo +1.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #Cruzeiro #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola.
286 caracteres, 21 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, cruzeiro, raposa, cabuloso, cec, campanha do cruzeiro, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, dataviz, manim, python, portal brasileirão, rodada 26, tite
```

`tite` entra porque o vídeo agora **marca** a saída dele, e é assim que o
torcedor busca esse recorte da temporada. As outras duas réguas do vocabulário
— "acontecimento", "régua" — ficam de fora: descrevem a marca e não o assunto.
