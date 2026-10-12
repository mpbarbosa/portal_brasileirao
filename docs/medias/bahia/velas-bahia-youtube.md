# YouTube — velas do Bahia

Texto que acompanha [`velas-bahia.mp4`](velas-bahia.mp4)
(1920×1080, 60fps, 24s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 24s não comporta.
- **Com capa:** `velas-bahia-miniatura.png`, 1280×720, o quadro do fecho da
  própria cena — a regra que o `scripts/manim/README.md` registra para as velas.
- **Cortes verticais:** `velas-bahia-45.mp4` (1080×1350, feed do Instagram) e `velas-bahia-916.mp4` (1080×1920, Reels e YouTube Short).

> **Os números aqui saem de `scripts/manim/velas-bahia.json`, rodada 30,
> snapshot de 2026-10-12** — 5º com 49 pts, 13V 10E 7D, e a oscilação entre
> o 1º e o 8º, que é a faixa que o painel do vídeo imprime. Eles **envelhecem**: um `sync-seed-data` seguido de uma
> reexportação move o vídeo, e este arquivo não é regerado por nada. Reconferir
> antes de publicar, contra o JSON e não contra esta página.
>
> **O clube jogou as 30 rodadas do recorte**, então não há vela oca nem
> denominador torto aqui — ao contrário de seis clubes da divisão, que ainda
> não disputaram a 30ª. O recorte fecha com um 1x0 em casa sobre o Mirassol,
> que manteve o 5º lugar.
>
> Os mesmos números estão **no quadro do fecho do próprio mp4**, no painel de
> resumo, que é de onde a capa sai — então uma divergência entre este texto e a
> imagem que o acompanha é visível a olho nu.
>
> **A oscilação do painel é INTRA-rodada e não a faixa de fechamento**, e as
> duas diferem para 16 dos 20 clubes. O painel conta as posições ocupadas
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
Bahia em velas: 30 rodadas fechando sempre entre o 1º e o 7º
```

O fato que separa esta campanha, medido contra os vinte: só o Fluminense fecha
numa faixa mais estreita (3º-6º), e a do Bahia é a única faixa estreita que
inclui a liderança. **O título anterior era sobre os empates e foi retirado por
estar errado**: dizia 10, "o maior número ao lado do Internacional", e o
Internacional tem agora 11 — a tabela na página ao lado desmentiria o título.
E **data o recorte**, que é a única defesa contra
alguém assistir daqui a três meses e achar que os números estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `Bahia: 10 empates em 30 jogos, atrás só dos 11 do Internacional` | 63 | o empate, dito com o número certo |
| 3 | `Bahia: 49 pontos, 13V 10E 7D e saldo +8 \| Brasileirão 2026` | 58 | o número duro |

**Os apelidos não estão em nenhum deles, e estão nas tags**: é como o torcedor
busca, e não é como o clube aparece no vídeo nem na tabela.

## Descrição

```
A campanha do Bahia rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 12/10/2026 (30ª rodada):
• Bahia — 5º, 49 pts em 30 jogos
• 13V · 10E · 7D — 44 gols pró, 36 contra, saldo +8
• 54% de aproveitamento · oscilou entre o 1º e o 8º

O Bahia tem 10 empates em 30 jogos, o segundo maior número da Série A — atrás dos 11 do Internacional, e ao lado do Grêmio e do Clube do Remo. No desenho isso é uma fileira de corpos amarelos de altura curta — a rodada aconteceu, a posição mal se moveu.

É também uma campanha que chegou a liderar (1 rodada em 1º, a 7ª) e que fecha sempre entre o 1º e o 7º. 10 rodadas de invencibilidade na maior série, 7 derrotas no total. A estabilidade aqui é causada pelo empate, não pela vitória — e é a vela, não a tabela, que deixa isso à vista.

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
A campanha do Bahia em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela, e a barra de baixo são os pontos. A régua tracejada marca a parada para a Copa. 10 empates, o segundo maior número da divisão. Dados até a 30ª: 49 pts, 13V 10E 7D, saldo +8.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #Bahia #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola.
304 caracteres, 22 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, bahia, esquadrão, esquadrao, tricolor de aço, bahêa, bahea, campanha do bahia, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, dataviz, manim, python, portal brasileirão, rodada 30
```

Nenhuma tag nova: o único acontecimento que o vídeo marca é a paralisação
para a Copa, que não nomeia ninguém — e uma tag aqui nomeia a PESSOA que o
desenho passou a marcar, que foi o critério do `velas-cruzeiro`. O vocabulário
da marca — "acontecimento", "régua" — descreve o desenho e não o assunto.
