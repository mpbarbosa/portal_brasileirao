# YouTube — velas do Atlético-MG

Texto que acompanha [`velas-atletico-mg.mp4`](velas-atletico-mg.mp4)
(1920×1080, 60fps, 22s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 22s não comporta.
- **Com capa:** `velas-atletico-mg-miniatura.png`, 1280×720, o quadro do fecho da
  própria cena — a regra que o `scripts/manim/README.md` registra para as velas.
- **Cortes verticais:** `velas-atletico-mg-45.mp4` (1080×1350, feed do Instagram) e `velas-atletico-mg-916.mp4` (1080×1920, Reels e YouTube Short).

> **Os números aqui saem de `scripts/manim/velas-atletico-mg.json`, rodada 26,
> snapshot de 2026-09-07** — 8º com 36 pts, 10V 6E 9D, e a oscilação entre
> o 4º e o 17º, que é a faixa que o painel do vídeo imprime. Eles **envelhecem**: um `sync-seed-data` seguido de uma
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
> entre o 8º e o 17º e o painel diz 4º e 17º.
>
> **O saldo e o aproveitamento vêm do `computeStandings`**, a mesma função que
> monta a tabela do site, e não somados à mão a partir do JSON.

---

## Título

Recomendado (63 caracteres):

```
Atlético-MG em velas: fecha entre o 8º e o 17º até a 26ª rodada
```

A faixa de fechamento, que é o que a campanha é — e **data o recorte**, que é a única defesa contra
alguém assistir daqui a três meses e achar que os números estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `A campanha do Atlético-MG rodada a rodada \| Brasileirão 2026 em candlestick` | 75 | genérico e buscável |
| 3 | `Atlético-MG: 36 pontos em 25 jogos, 10V 6E 9D` | 45 | o número duro, com o denominador certo |

**Os apelidos não estão em nenhum deles, e estão nas tags**: é como o torcedor
busca, e não é como o clube aparece no vídeo nem na tabela.

## Descrição

```
A campanha do Atlético-MG rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 07/09/2026 (26ª rodada):
• Atlético-MG — 8º, 36 pts em 25 jogos
• 10V · 6E · 9D — 32 gols pró, 30 contra, saldo +2
• 48% de aproveitamento · oscilou entre o 4º e o 17º

O Atlético-MG atravessa a temporada fechando rodadas entre o 8º e o 17º, sem chegar ao G4 nem ao Z4. É a campanha do meio, e o desenho a mostra como uma faixa larga de corpos curtos. O painel diz 4º e 17º porque conta o que aconteceu dentro das rodadas.

Repare no denominador: são 25 jogos contra 26 rodadas, então este clube tem partida em atraso e comparar o total de pontos com quem já jogou tudo é uma leitura torta. 9 derrotas e 7 rodadas de invencibilidade na maior série.

O eixo mostra a divisão inteira, 1º no topo e 20º embaixo, com as faixas do G4 e do Z4 ao fundo — é isso que permite comparar este vídeo com o de qualquer outro clube.

Nenhum número foi digitado à mão. A animação lê a mesma função que calcula as velas no Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #AtléticoMG #Manim #DataViz #Futebol #Python #Candlestick
```

As duas primeiras linhas — o que aparece antes do "mostrar mais" — são a
abertura e a linha em branco seguinte, então a frase de abertura precisa
carregar o vídeo sozinha.

### Versão curta

Para Short, ou onde a descrição longa não couber.

```
A campanha do Atlético-MG em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela, e a barra de baixo são os pontos. Fecha entre o 8º e o 17º, e tem jogo a menos que a maioria. Dados até a 26ª: 36 pts, 10V 6E 9D, saldo +2.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #AtléticoMG #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola.
310 caracteres, 21 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, atlético-mg, galo, atlético mineiro, atletico mineiro, cam, campanha do atlético-mg, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, dataviz, manim, python, portal brasileirão, rodada 26
```
