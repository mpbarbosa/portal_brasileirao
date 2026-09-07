# YouTube — velas do Bahia

Texto que acompanha [`velas-bahia.mp4`](velas-bahia.mp4)
(1920×1080, 60fps, 22s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 22s não comporta.
- **Com capa:** `velas-bahia-miniatura.png`, 1280×720, o quadro do fecho da
  própria cena — a regra que o `scripts/manim/README.md` registra para as velas.
- **Cortes verticais:** `velas-bahia-45.mp4` (1080×1350, feed do Instagram) e `velas-bahia-916.mp4` (1080×1920, Reels e YouTube Short).

> **Os números aqui saem de `scripts/manim/velas-bahia.json`, rodada 26,
> snapshot de 2026-09-07** — 5º com 43 pts, 11V 10E 5D, e a oscilação entre
> o 1º e o 8º, que é a faixa que o painel do vídeo imprime. Eles **envelhecem**: um `sync-seed-data` seguido de uma
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
> entre o 1º e o 6º e o painel diz 1º e 8º.
>
> **O saldo e o aproveitamento vêm do `computeStandings`**, a mesma função que
> monta a tabela do site, e não somados à mão a partir do JSON.

---

## Título

Recomendado (67 caracteres):

```
Bahia em velas: 10 empates, o maior número do Brasileirão até a 26ª
```

O fato que separa esta campanha; empatado com o internacional — e **data o recorte**, que é a única defesa contra
alguém assistir daqui a três meses e achar que os números estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `A campanha do Bahia rodada a rodada: fecha entre o 1º e o 6º` | 60 | a amplitude de fechamento, curta |
| 3 | `Bahia: 43 pontos, 11V 10E 5D e saldo +8 \| Brasileirão 2026` | 58 | o número duro |

**Os apelidos não estão em nenhum deles, e estão nas tags**: é como o torcedor
busca, e não é como o clube aparece no vídeo nem na tabela.

## Descrição

```
A campanha do Bahia rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 07/09/2026 (26ª rodada):
• Bahia — 5º, 43 pts em 26 jogos
• 11V · 10E · 5D — 40 gols pró, 32 contra, saldo +8
• 55% de aproveitamento · oscilou entre o 1º e o 8º

O Bahia é um dos dois clubes com mais empates da Série A: 10 em 26 jogos, o mesmo do Internacional. No desenho isso é uma fileira de corpos amarelos de altura curta — a rodada aconteceu, a posição mal se moveu.

É também uma campanha que chegou a liderar (1 rodada em 1º) e que fecha sempre entre o 1º e o 6º. 9 rodadas de invencibilidade na maior série, 5 derrotas no total. A estabilidade aqui é causada pelo empate, não pela vitória — e é a vela, não a tabela, que deixa isso à vista.

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
A campanha do Bahia em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela, e a barra de baixo são os pontos. 10 empates, o maior número da divisão junto com o internacional. Dados até a 26ª: 43 pts, 11V 10E 5D, saldo +8.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #Bahia #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola.
304 caracteres, 22 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, bahia, esquadrão, esquadrao, tricolor de aço, bahêa, bahea, campanha do bahia, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, dataviz, manim, python, portal brasileirão, rodada 26
```
