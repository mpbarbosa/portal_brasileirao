# YouTube — velas do Bragantino

Texto que acompanha [`velas-bragantino.mp4`](velas-bragantino.mp4)
(1920×1080, 60fps, 21s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 21s não comporta.
- **Com capa:** `velas-bragantino-miniatura.png`, 1280×720, o quadro do fecho da
  própria cena — a regra que o `scripts/manim/README.md` registra para as velas.

> **Os números aqui saem de `scripts/manim/velas-bragantino.json`, rodada 25,
> snapshot de 2026-09-02** — 9º com 35 pts em 24 jogos, 10V 5E 9D, e a oscilação
> entre o 1º e o 16º. Eles **envelhecem**: um `sync-seed-data` seguido de uma
> reexportação move o vídeo, e este arquivo não é regerado por nada. Reconferir
> antes de publicar, contra o JSON e não contra esta página.
>
> Os mesmos três números estão **no quadro do fecho do próprio mp4**, no painel
> de resumo, que é de onde a capa sai. Conferidos ali: o quadro de 20,6s diz
> `9º · 35 pts em 24 jogos`, `10V · 5E · 9D` e `oscilou entre o 1º e o 16º`.
>
> **O saldo e o aproveitamento foram conferidos contra o `computeStandings`**, a
> mesma função que monta a tabela do site: 29 gols pró, 25 sofridos, saldo +4,
> 49% de aproveitamento, 7 pontos atrás do G4 (Fluminense, 42) e 10 à frente do
> 17º (Vasco, 25).

---

## A 9ª rodada é a melhor vela já desenhada nesta série

O `rank-candles-core.ts` diz, com todas as letras, que **a cor carrega o
resultado e a geometria carrega a direção**, e que as rodadas que valem olhar são
as em que as duas discordam. A 9ª rodada do Bragantino é essa frase inteira num
retângulo só:

| | |
|---|---|
| corpo | **verde** — vitória |
| jogo | **3 a 0 no Flamengo**, em casa |
| abriu | 14º |
| pavio, para baixo | **16º — o pior momento da temporada inteira** |
| fechou | 11º |

O clube entrou na rodada em 14º, **afundou até o 16º enquanto os rivais jogavam**
— o ponto mais baixo de toda a campanha, e ele nunca esteve em campo para isso —
e então bateu o Flamengo por 3 a 0 e fechou em 11º.

A linha da campanha desenha essa rodada como um segmento do 14º ao 11º e nada
mais. O 16º não existe nela: é intra-rodada, e a vela é o único desenho desta
série que o mostra. **O extremo inferior da amplitude de 15 posições deste clube
só é visível porque o pavio existe.**

## O 1º também é real, e o pavio da 1ª rodada não é extremo nenhum

O Bragantino fecha a **2ª rodada em 1º lugar**, com dois 1 a 0 — no Coritiba fora
e no Atlético-MG em casa. É um *fechamento*, uma tabela real.

Vale a ressalva de sempre, e aqui ela não morde: nos outros vídeos o extremo
costuma ser o pavio da 1ª rodada, antes de qualquer jogo, quando os clubes
empatados em nada são ordenados por **nome**. Aqui esse pavio vai do 3º ao 9º —
**nenhuma das duas pontas é extremo da temporada**. As duas pontas da amplitude
são reais, e por caminhos diferentes: o 1º é um fechamento e o 16º é um pavio.

| clube | melhor | pior | amplitude |
|---|---|---|---|
| Botafogo | 1º | 18º | 17 |
| Corinthians | 3º | 19º | 16 |
| **Bragantino** | **1º** | **16º** | **15** |
| São Paulo | 1º | 16º | 15 |
| Cruzeiro | 5º | 20º | 15 |
| Atlético-MG | 4º | 17º | 13 |
| Flamengo | 2º | 15º | 13 |
| Athletico-PR | 2º | 13º | 11 |
| Palmeiras | 1º | 11º | 10 |
| Fluminense | 2º | 12º | 10 |
| Bahia | 1º | 8º | 7 |

## A vela vazada é a MESMA PARTIDA da do Atlético-MG

O Bragantino não jogou a 21ª, então a campanha atravessa 25 rodadas com **24
partidas**, e no desenho essa rodada é um retângulo **só de contorno**. Isso já
aconteceu em outros vídeos desta série. O que só acontece aqui:

**a partida adiada é Atlético-MG × Bragantino** — e o Atlético-MG é exatamente o
clube que está **um ponto à frente**, em 8º com 36 contra 35, também com 24
jogos. Os dois vídeos desenham a mesma ausência, de lados opostos, e o jogo que
falta nos dois é o jogo entre eles: **a vela vazada de um é a vela vazada do
outro, e ela decide qual dos dois fica na frente.**

Aquela rodada teve **quatro adiamentos** — Atlético-MG × Bragantino, Botafogo ×
Grêmio, Chapecoense × Vasco e São Paulo × Santos — então a vela oca é uma
propriedade da rodada. O que é deste par é que os dois adiados estão colados na
tabela.

## Três trechos, contados do payload

| trecho | rodadas | pontos | de → até |
|---|---|---|---|
| a largada | 1ª a 2ª | 6 de 6 | — → **1º** |
| a queda | 3ª a 8ª | 2 de 18 | 1º → 14º |
| a subida | 9ª a 20ª | 23 de 36 | 14º → **5º** |
| o fecho | 22ª a 25ª | 4 de 12 | 6º → 9º |

A subida é o trecho longo, e é o que a capa mostra: doze rodadas de bloco verde
subindo pela metade de cima do eixo, com o clube parado em 5º da 17ª à 21ª.

## O tom do clube é o único da série que a correção de contraste tocou por MARGEM

O magenta `#E058B8` vem do `pontos.py`, que já resolveu a paleta dos vinte. Sobre
o painel de resumo ele entrega **5,08** contra um alvo de **5,17** — que é o piso
de texto do projeto (4,5) vezes a margem de 15% que a cena reserva para a
codificação. O `lift_to_floor` então sobe o tom para `#E259BA`.

**Leia isso como o que é.** O tom cru já passava no piso de 4,5; o que ele não
alcançava era a folga. Medido no **quadro codificado**, o cru dá 5,24 e o
corrigido 5,47 — os dois passariam. Dizer que sem a correção a etiqueta ficaria
ilegível seria mais forte do que a medida sustenta.

Isso corrigiu um comentário no `velas.py` que dizia **"quatro clubes da divisão
sobem aqui"**: varrendo os vinte tons do `pontos.py` com a regra atual, **são
sete**. Uma contagem em prosa sem portão nenhum em cima, exatamente a falha que o
`CLAUDE.md` cataloga — a frase agora diz como recontar em vez de dizer quantos.

## Título

Recomendado (70 caracteres):

```
Bragantino em velas: liderou a 2ª rodada e caiu ao 16º no dia do 3 a 0
```

Abre com o clube, diz o que o desenho é — "em velas" é a curiosidade que segura
o clique de quem conhece candlestick de outro assunto — e vende **a rodada 9**,
que é o que só este vídeo tem: um clube no seu pior momento da temporada dentro
da rodada em que goleou o vice-líder.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `Bragantino em velas: do 1º ao 16º e de volta ao 9º \| Brasileirão 2026` | 69 | as duas pontas, ambas reais |
| 3 | `O jogo que os dois não fizeram: Bragantino e Atlético-MG em velas` | 65 | a vela vazada compartilhada |
| 4 | `Bragantino: 25 rodadas em 21 segundos, posição e pontos \| Brasileirão 2026` | 74 | promete a duração, bom para retenção |

**"Massa Bruta" e "RB" não estão em nenhum deles, e estão nas tags**, pela mesma
regra dos outros vídeos de velas: o apelido é como o torcedor busca e não é como
o clube aparece no vídeo nem na tabela.

## Descrição

```
A campanha do Bragantino rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 02/09/2026 (25ª rodada):
• Bragantino — 9º, 35 pts em 24 JOGOS (não jogou a 21ª rodada)
• 10V · 5E · 9D — 29 gols pró, 25 sofridos, saldo +4
• 49% de aproveitamento, 7 pontos atrás do G4

Olhe a 9ª rodada, porque ela é o motivo de este desenho existir. A vela é VERDE: o Bragantino ganhou de 3 a 0 do Flamengo, em casa. E o pavio dela desce até o 16º lugar, que é o pior momento de toda a temporada do clube.

As duas coisas são verdade ao mesmo tempo. Ele entrou na rodada em 14º, afundou até o 16º enquanto os rivais jogavam — sem ter entrado em campo — e então venceu e fechou em 11º. A cor conta o resultado e a geometria conta a direção, e a rodada que vale olhar é aquela em que as duas discordam.

Num gráfico de linha essa rodada é um segmento do 14º ao 11º e mais nada. O 16º simplesmente não aparece: ele é intra-rodada. O pavio é a única marca deste desenho que o mostra, e sem ele a amplitude de 15 posições deste clube seria invisível pela metade.

A outra ponta também é real. O Bragantino fechou a 2ª rodada em 1º LUGAR, com dois 1 a 0 — Coritiba fora e Atlético-MG em casa. Depois vieram 2 pontos em 18 disputados entre a 3ª e a 8ª, e o clube caiu ao 14º.

A volta é o trecho longo: da 9ª à 20ª rodada são 23 pontos em 36, e ele sobe do 14º ao 5º, onde fica parado da 17ª à 21ª.

E há uma vela VAZADA na 21ª — só o contorno, sem preenchimento: a rodada que o clube não jogou. Essa é a parte que só se vê comparando dois vídeos desta série. A partida adiada é Atlético-MG × Bragantino, e o Atlético-MG é o 8º colocado, UM ponto à frente, também com 24 jogos. Os dois desenhos carregam a mesma ausência de lados opostos, e o jogo que falta nos dois é o jogo entre eles.

O eixo mostra a divisão inteira, 1º no topo e 20º embaixo, com as faixas do G4 e do Z4 ao fundo. Uma escala por clube esconderia justamente o que este desenho tem: a distância entre o 1º da 2ª rodada e o 16º da 9ª.

Nenhum número foi digitado à mão. A animação lê a mesma função que calcula as velas no Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #Bragantino #RedBullBragantino #MassaBruta #Manim #DataViz #VisualizacaoDeDados #Futebol #Python
```

### O parágrafo que muda, e por que ele não podia ser copiado

Cada vídeo de velas vendeu um ângulo diferente: o Palmeiras a liderança, o
Flamengo a vela vazada e o jogo a menos, o Cruzeiro a subida do fundo, o
Corinthians a amplitude, o São Paulo as duas taxas, o Atlético-MG a saída do Z4,
o Botafogo a amplitude mais larga.

Este vende **a rodada 9**, e é o primeiro que vende uma *rodada* em vez de um
trecho de temporada. É também o primeiro caso em que o pavio não é uma nuance do
desenho mas a única coisa que segura metade do número que o painel de resumo
imprime.

**E o parágrafo do Atlético-MG só existe porque os dois foram desenhados.** Uma
vela vazada num vídeo é uma ausência; duas velas vazadas em dois vídeos, da mesma
partida, entre dois clubes separados por um ponto, é um jogo pendente que a
tabela não mostra como pendente.

### Versão curta

Para Short, ou onde a descrição longa não couber.

```
A campanha do Bragantino em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela. Olhe a 9ª: a vela é VERDE, porque ele ganhou de 3 a 0 do Flamengo — e o pavio dela desce até o 16º, o pior momento da temporada inteira. Ele entrou em 14º, caiu ao 16º enquanto os outros jogavam, venceu e fechou em 11º. Num gráfico de linha nada disso aparece. Dados até a 25ª: 9º, 35 pts em 24 jogos, 10V 5E 9D.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #Bragantino #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola. 445
caracteres, 26 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, bragantino, red bull bragantino, massa bruta, rb bragantino, campanha do bragantino, classificação brasileirão, tabela do brasileirão, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, data visualization, dataviz, manim, animação em python, python, estatísticas de futebol, football analytics, portal brasileirão, rodada 25
```

Quatro blocos deliberados, na ordem do volume de busca: futebol, o clube, o
vocabulário do desenho (`candlestick` e `gráfico de velas` trazem um público que
não busca futebol), e por fim dataviz e Manim — menor, mas é quem assiste 21
segundos de gráfico até o fim e clica no repositório. `brasileirao` e `serie a`
sem acento estão na lista ao lado das formas acentuadas, de propósito: muita
gente digita sem, e o YouTube não normaliza acentuação em tags.

**O `tla` do payload NÃO entra**, como nos outros. Para este clube ele é `RBB`,
que ninguém digita — e o `CLAUDE.md` registra por que a identidade de clube aqui
é o id numérico do provedor e nunca o `tla`: Corinthians e Coritiba mandam os
dois `COR`. `rb bragantino` e `red bull bragantino` entram no lugar, que é como o
clube se escreve por extenso, e `massa bruta` é o apelido.

**Nenhuma tag de posição entrou.** 9º lugar não é algo que alguém busque, e
`campanha do bragantino` cobre a intenção sem prometer um número que a próxima
rodada muda.

## Miniatura

`velas-bragantino-miniatura.png`, 1280×720, o **quadro do fecho da própria cena** —
e não um layout à parte como as capas do `campanhas` e do `pontos`, porque os
primeiros segundos são um gráfico vazio.

```sh
ffmpeg -ss 20.6 -i docs/medias/bragantino/velas-bragantino.mp4 -frames:v 1 -vf scale=1280:720 \
  docs/medias/bragantino/velas-bragantino-miniatura.png
```

O `-ss 20.6` num vídeo de 21,1s é estreito de propósito e **não** sobra para
arredondar: antes disso o painel de resumo ainda está entrando — ele só assenta
em **t=19**, medido — e depois o vídeo acabou. Conferir o PNG antes de subir.
Aqui ele foi aberto: o painel de resumo inteiro com `9º · 35 pts em 24 jogos` e
o card da 25ª rodada com `1 × 2 São Paulo (fora)`.

**O painel cai numa região quase vazia, e isso é sorte da campanha e não do
desenho.** O Bragantino passou a segunda metade da temporada entre o 5º e o 9º,
então a faixa do 10º ao 16º à direita está livre e é ali que o `summary_anchor`
o coloca. Ele encosta na 9ª e na 10ª rodada pela esquerda, e os 94% de opacidade
deixam essas duas visíveis como fantasmas — conferido num recorte ampliado.

## O resto do formulário

- **Público:** "Não, não é conteúdo para crianças". Marcar "sim" desliga
  comentários e cards, e um gráfico de futebol não é conteúdo infantil.
- **Elementos do vídeo:** telas finais precisam de 5s livres no fim, e aqui esses
  5s são exatamente o painel de resumo — que é a parte que vale. Pular.
- **Playlists:** conferir a posição contra `docs/medias/RENDERED` em vez de
  contra uma frase aqui — a contagem depende de quais velas já entraram, e ordem
  de merge não é ordem de renderização.

## Título do arquivo

O YouTube usa o nome do arquivo como título provisório, então subir
`velas-bragantino.mp4` deixa `velas bragantino` no campo — trocar antes de
publicar.
