# YouTube — velas do Fluminense

Texto que acompanha [`velas-fluminense.mp4`](velas-fluminense.mp4)
(1920×1080, 60fps, 22s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 22s não comporta.
- **Com capa:** `velas-fluminense-miniatura.png`, 1280×720, o quadro do fecho da
  própria cena — a regra que o `scripts/manim/README.md` registra para as velas.
- **Cortes verticais:** `velas-fluminense-45.mp4` (1080×1350, feed do Instagram) e `velas-fluminense-916.mp4` (1080×1920, Reels e YouTube Short).

> **Os números aqui saem de `scripts/manim/velas-fluminense.json`, rodada 26,
> snapshot de 2026-09-07** — 4º com 45 pts, 12V 9E 5D, e a oscilação entre
> o 2º e o 12º, que é a faixa que o painel do vídeo imprime. Eles **envelhecem**: um `sync-seed-data` seguido de uma
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
> entre o 3º e o 6º e o painel diz 2º e 12º.
>
> **O saldo e o aproveitamento vêm do `computeStandings`**, a mesma função que
> monta a tabela do site, e não somados à mão a partir do JSON.

---

## Título

Recomendado (72 caracteres):

```
Fluminense: 3º ao 6º em 26 rodadas, a campanha mais confinada da Série A
```

A amplitude de fechamento, a menor da divisão — e **data o recorte**, que é a única defesa contra
alguém assistir daqui a três meses e achar que os números estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `Fluminense em velas: 45 pontos, 12V 9E 5D até a 26ª rodada` | 58 | o número duro |
| 3 | `O que a vela mostra e a linha não: Fluminense do 3º ao 6º \| Brasileirão` | 71 | o argumento da cena, com este clube como o melhor exemplo |

**Os apelidos não estão em nenhum deles, e estão nas tags**: é como o torcedor
busca, e não é como o clube aparece no vídeo nem na tabela.

## Descrição

```
A campanha do Fluminense rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 07/09/2026 (26ª rodada):
• Fluminense — 4º, 45 pts em 26 jogos
• 12V · 9E · 5D — 40 gols pró, 32 contra, saldo +8
• 58% de aproveitamento · oscilou entre o 2º e o 12º

É a campanha mais confinada da Série A no fechamento das rodadas: em 26 rodadas o Fluminense nunca fechou acima do 3º nem abaixo do 6º. Quatro posições — a menor amplitude da divisão, conferida contra os vinte clubes.

O painel do vídeo diz 2º e 12º, e a diferença não é erro: ali entram as posições ocupadas DENTRO de cada rodada, que é o que o pavio desenha. Um clube pode passar pelo 12º num sábado à noite e fechar o domingo em 6º — e essa distância é a razão de a vela existir ao lado da linha.

São 5 derrotas em 26 jogos, o terceiro menor número da divisão, e 9 rodadas de invencibilidade na maior sequência.

O eixo mostra a divisão inteira, 1º no topo e 20º embaixo, com as faixas do G4 e do Z4 ao fundo — é isso que permite comparar este vídeo com o de qualquer outro clube.

Nenhum número foi digitado à mão. A animação lê a mesma função que calcula as velas no Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #Fluminense #Manim #DataViz #Futebol #Python #Candlestick
```

As duas primeiras linhas — o que aparece antes do "mostrar mais" — são a
abertura e a linha em branco seguinte, então a frase de abertura precisa
carregar o vídeo sozinha.

### Versão curta

Para Short, ou onde a descrição longa não couber.

```
A campanha do Fluminense em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela, e a barra de baixo são os pontos. Fechou 26 rodadas sem sair do 3º ao 6º. Dados até a 26ª: 45 pts, 12V 9E 5D, saldo +8.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #Fluminense #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola.
300 caracteres, 21 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, fluminense, flu, tricolor carioca, fluzão, fluzao, campanha do fluminense, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, dataviz, manim, python, portal brasileirão, rodada 26
```
