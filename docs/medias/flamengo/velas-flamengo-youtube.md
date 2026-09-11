# YouTube — velas do Flamengo

Texto que acompanha [`velas-flamengo.mp4`](velas-flamengo.mp4)
(1920×1080, 60fps, 22s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 22s não comporta.
- **Com capa:** `velas-flamengo-miniatura.png`, 1280×720, o quadro do fecho da
  própria cena — a regra que o `scripts/manim/README.md` registra para as velas.
- **Cortes verticais:** `velas-flamengo-45.mp4` (1080×1350, feed do Instagram) e `velas-flamengo-916.mp4` (1080×1920, Reels e YouTube Short).

> **Os números aqui saem de `scripts/manim/velas-flamengo.json`, rodada 26,
> snapshot de 2026-09-11** — 1º com 54 pts, 16V 6E 4D, e a oscilação entre
> o 1º e o 15º, que é a faixa que o painel do vídeo imprime. Eles **envelhecem**: um `sync-seed-data` seguido de uma
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
> entre o 1º e o 15º e o painel diz 1º e 15º.
>
> **O saldo e o aproveitamento vêm do `computeStandings`**, a mesma função que
> monta a tabela do site, e não somados à mão a partir do JSON.
>
> **As duas réguas tracejadas saem do `events` do mesmo JSON**, pelo
> `eventMarks` que o Painel do site já desenha — a demissão de Filipe Luís após
> a 3ª rodada e a paralisação para a Copa após a 18ª. Elas também envelhecem: um
> acontecimento acrescentado ao `src/data/events.ts` aparece na próxima
> reexportação, e a descrição abaixo nomeia duas.
>
> **NÃO leia a vela à direita da primeira régua como o que veio depois dela**, e
> este clube é o único da divisão em que isso morde. A 4ª rodada do Flamengo é o
> ÚNICO jogo fora de ordem da temporada: foi disputado em 02/09, seis meses
> depois da demissão e depois de outras 21 rodadas. O desenho é em ordem de
> RODADA — que é o que o `computeRankCandles` promete —, então a maior subida do
> ano (+7, do 11º ao 4º) encosta na régua sem ter vindo em seguida no calendário.
> A cópia abaixo diz o que o clube tinha QUANDO a régua aparece e para aí, de
> propósito: a leitura causal é a que o quadro convida e os dados não sustentam.

---

## Título

Recomendado (71 caracteres):

```
Flamengo assume a ponta na 26ª: a campanha em velas do Brasileirão 2026
```

A virada, que é o assunto do vídeo e envelhece na próxima rodada — e **data o recorte**, que é a única defesa contra
alguém assistir daqui a três meses e achar que os números estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `Flamengo em velas: 54 pontos, 16V 6E 4D até a 26ª rodada` | 56 | o número duro, data o recorte |
| 3 | `A campanha do líder do Brasileirão em candlestick \| Flamengo 2026` | 65 | 'líder' envelhece mais rápido que qualquer número aqui |

**Os apelidos não estão em nenhum deles, e estão nas tags**: é como o torcedor
busca, e não é como o clube aparece no vídeo nem na tabela.

## Descrição

```
A campanha do Flamengo rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 11/09/2026 (26ª rodada):
• Flamengo — 1º, 54 pts em 26 jogos
• 16V · 6E · 4D — 51 gols pró, 21 contra, saldo +30
• 69% de aproveitamento · oscilou entre o 1º e o 15º

O vídeo termina no quadro em que a campanha vira. O Flamengo fechou 26 rodadas com apenas 2 delas em 1º — e é na última vela do desenho que ele assume a ponta, por um ponto.

A campanha que chega lá é a segunda menos derrotada da divisão, 4 derrotas em 26 jogos, atrás só das 3 do Palmeiras. Fecha entre o 1º e o 15º, e o 15º está na 1ª rodada, onde os clubes empatados em nada são ordenados por NOME — é alfabeto e não futebol.

As duas réguas tracejadas que cruzam o desenho são acontecimentos de fora de campo, e cada uma cai na FRONTEIRA entre duas rodadas em vez de sobre uma: a demissão de Filipe Luís depois da 3ª rodada, e a paralisação para a Copa do Mundo depois da 18ª. Quando a primeira aparece, o Flamengo tinha 4 pontos em 3 jogos e vinha de fechar em 11º.

O eixo mostra a divisão inteira, 1º no topo e 20º embaixo, com as faixas do G4 e do Z4 ao fundo — é isso que permite comparar este vídeo com o de qualquer outro clube.

Nenhum número foi digitado à mão. A animação lê a mesma função que calcula as velas no Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #Flamengo #Manim #DataViz #Futebol #Python #Candlestick
```

As duas primeiras linhas — o que aparece antes do "mostrar mais" — são a
abertura e a linha em branco seguinte, então a frase de abertura precisa
carregar o vídeo sozinha.

### Versão curta

Para Short, ou onde a descrição longa não couber.

```
A campanha do Flamengo em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela, e a barra de baixo são os pontos. As réguas tracejadas marcam a demissão de Filipe Luís e a parada para a Copa. Assumiu a ponta na 26ª rodada e o desenho registra a troca. Dados até a 26ª: 54 pts, 16V 6E 4D, saldo +30.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #Flamengo #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola.
309 caracteres, 23 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, flamengo, mengão, mengao, rubro-negro, fla, crf, campanha do flamengo, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, dataviz, manim, python, portal brasileirão, rodada 26, filipe luís
```

`filipe luís` entra porque o vídeo agora **marca** a saída dele, e é assim que
o torcedor busca esse recorte da temporada. O vocabulário da marca —
"acontecimento", "régua" — fica de fora: descreve o desenho e não o assunto.
