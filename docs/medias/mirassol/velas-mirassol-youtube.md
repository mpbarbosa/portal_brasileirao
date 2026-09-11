# YouTube — velas do Mirassol

Texto que acompanha [`velas-mirassol.mp4`](velas-mirassol.mp4)
(1920×1080, 60fps, 22s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 22s não comporta.
- **Com capa:** `velas-mirassol-miniatura.png`, 1280×720, o quadro do fecho da
  própria cena — a regra que o `scripts/manim/README.md` registra para as velas.

> **Os números aqui saem de `scripts/manim/velas-mirassol.json`, rodada 26,
> snapshot de 2026-09-11** — 16º com 28 pts, 7V 7E 12D, e a oscilação entre
> o 2º e o 20º, que é a faixa que o painel do vídeo imprime. Eles **envelhecem**: um `sync-seed-data` seguido de uma
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
> entre o 4º e o 20º e o painel diz 2º e 20º.
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

Recomendado (67 caracteres):

```
Mirassol: do 4º ao 16º, 12 posições perdidas | Brasileirão em velas
```

A queda, conferida contra os vinte clubes — e **data o recorte**, que é a única defesa contra
alguém assistir daqui a três meses e achar que os números estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `A campanha do Mirassol rodada a rodada \| Brasileirão 2026 em candlestick` | 72 | genérico e buscável |
| 3 | `Mirassol em velas: 28 pontos, 7V 7E 12D até a 26ª rodada` | 56 | o número duro |

**Os apelidos não estão em nenhum deles, e estão nas tags**: é como o torcedor
busca, e não é como o clube aparece no vídeo nem na tabela.

## Descrição

```
A campanha do Mirassol rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 11/09/2026 (26ª rodada):
• Mirassol — 16º, 28 pts em 26 jogos
• 7V · 7E · 12D — 29 gols pró, 40 contra, saldo -11
• 36% de aproveitamento · oscilou entre o 2º e o 20º

O Mirassol abre a temporada perto do G4 e fecha o recorte na borda do Z4: 12 posições perdidas desde o seu melhor fechamento, a terceira maior queda da divisão, atrás das 13 do Botafogo e das 18 da Chapecoense.

A amplitude total de fechamento é do 4º ao 20º, e o painel diz 2º e 20º porque conta também o que aconteceu dentro das rodadas. São 12 derrotas em 26 jogos, com invencibilidade máxima de 3 rodadas.

A régua tracejada que cruza o desenho é o acontecimento de fora de campo que tocou os vinte clubes: a paralisação para a Copa do Mundo depois da 18ª rodada. Ela cai na FRONTEIRA entre duas rodadas em vez de sobre uma, porque é isso que ela separa — o que veio antes dela e o que veio depois. Aqui o clube parou em 19º com 16 pts.

O eixo mostra a divisão inteira, 1º no topo e 20º embaixo, com as faixas do G4 e do Z4 ao fundo — é isso que permite comparar este vídeo com o de qualquer outro clube.

Nenhum número foi digitado à mão. A animação lê a mesma função que calcula as velas no Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #Mirassol #Manim #DataViz #Futebol #Python #Candlestick
```

As duas primeiras linhas — o que aparece antes do "mostrar mais" — são a
abertura e a linha em branco seguinte, então a frase de abertura precisa
carregar o vídeo sozinha.

### Versão curta

Para Short, ou onde a descrição longa não couber.

```
A campanha do Mirassol em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela, e a barra de baixo são os pontos. A régua tracejada marca a parada para a Copa. Do 4º ao 16º: 12 posições perdidas desde o melhor fechamento. Dados até a 26ª: 28 pts, 7V 7E 12D, saldo -11.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #Mirassol #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola.
300 caracteres, 21 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, mirassol, leão, leao, mirassol fc, time do interior, campanha do mirassol, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, dataviz, manim, python, portal brasileirão, rodada 26
```

Nenhuma tag nova: o único acontecimento que o vídeo marca é a paralisação
para a Copa, que não nomeia ninguém — e uma tag aqui nomeia a PESSOA que o
desenho passou a marcar, que foi o critério do `velas-cruzeiro`. O vocabulário
da marca — "acontecimento", "régua" — descreve o desenho e não o assunto.
