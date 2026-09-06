# YouTube — velas do Cruzeiro

Texto que acompanha [`velas-cruzeiro.mp4`](velas-cruzeiro.mp4)
(1920×1080, 60fps, 21s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 21s não comporta.
- **Sem capa desenhada**, como nos outros vídeos de velas — o que existe é a
  saída provisória descrita no fim desta página.

> **Os números aqui saem de `scripts/manim/velas-cruzeiro.json`, rodada 25,
> snapshot de 2026-09-02** — 6º com 39 pts, 11V 6E 8D, e a oscilação entre o 5º
> e o 20º. Eles **envelhecem**: um `sync-seed-data` seguido de uma reexportação
> move o vídeo, e este arquivo não é regerado por nada. Reconferir antes de
> publicar, contra o JSON e não contra esta página.
>
> Os mesmos três números estão **no quadro do fecho do próprio mp4**, no painel
> de resumo, e é de lá que sai a miniatura provisória — então uma divergência
> entre este texto e a imagem que o acompanha é visível a olho nu. Foi assim que
> eles foram conferidos, e não só contra o JSON: o quadro de 20,6s diz
> `6º · 39 pts em 25 jogos`, `11V · 6E · 8D` e `oscilou entre o 5º e o 20º`.
>
> **O saldo e o aproveitamento foram conferidos contra o `computeStandings`**, a
> mesma função que monta a tabela do site, e não somados à mão a partir do JSON:
> 35 gols pró, 36 contra, saldo −1, 52% de aproveitamento.

---

## Título

Recomendado (77 caracteres):

```
Cruzeiro em velas: a campanha rodada a rodada do Brasileirão 2026 (até a 25ª)
```

Abre com o clube, diz o que o desenho é — "em velas" é a curiosidade que segura
o clique de quem conhece candlestick de outro assunto — e **data o recorte**, que
é a única defesa contra alguém assistir daqui a três meses e achar que os números
estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `Do 20º ao 6º: a campanha do Cruzeiro em velas \| Brasileirão Série A` | 67 | o gancho mais forte do conjunto, e o único que só vale para este clube |
| 3 | `Cruzeiro: 8 rodadas em último, 11 vitórias depois \| Brasileirão 2026` | 68 | a virada em dois números; envelhece na próxima rodada |
| 4 | `Cruzeiro: 25 rodadas em 21 segundos, posição e pontos \| Brasileirão 2026` | 72 | promete a duração, bom para retenção |

**O título 2 é o melhor gancho e não é o recomendado, de propósito.** "Do 20º ao
6º" descreve a temporada inteira num par de números e é exatamente o que separa
este vídeo dos outros três — mas os dois números envelhecem na rodada seguinte, e
um título que promete o 6º sobre um vídeo em que o clube aparece em 7º é pior que
um título morno. Usar enquanto a 25ª for a rodada corrente; depois disso, o 1.

**"Raposa" e "Cabuloso" não estão em nenhum deles, e estão nas tags**, pela mesma
regra dos vídeos do Bahia e do Athletico-PR: o apelido é como o torcedor busca e
não é como o clube aparece no vídeo nem na tabela. Um título que o usa perde quem
digita o nome e ganha pouco, porque o YouTube casa a tag do mesmo jeito.

## Descrição

```
A campanha do Cruzeiro rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 02/09/2026 (25ª rodada):
• Cruzeiro — 6º, 39 pts em 25 jogos
• 11V · 6E · 8D — 35 gols pró, 36 contra, saldo −1
• oscilou entre o 5º e o 20º ao longo da temporada

Nenhum dos outros clubes que já desenhamos atravessa o gráfico assim. O Cruzeiro passou as OITO primeiras rodadas em último ou penúltimo — 0 vitórias, 4 empates, 4 derrotas, 4 pontos — e fechou cinco delas em 20º. Da 9ª rodada em diante são 11 vitórias, 2 empates e 4 derrotas: 35 pontos em 17 jogos. A vela mostra a virada como ela foi, uma escada de corpos verdes subindo o quadro da beira de baixo até a faixa do G4.

A primeira vitória é a 9ª rodada, 3 a 0 no Vitória em casa. A 11ª é a última rodada que o clube fecha dentro do Z4. Depois vêm duas arrancadas — 11ª, 12ª e 13ª, e outra de quatro seguidas da 21ª à 24ª, que inclui um 2 a 1 no Flamengo em casa. Na 21ª o corpo sobe quatro posições de uma vez, o maior salto da temporada.

E aqui está o que a tabela sozinha esconde: são 15 posições entre a melhor e a pior do ano, a maior amplitude de qualquer campanha que já desenhamos — Bahia oscilou 7, Fluminense 10, Athletico-PR 11. É por isso que o eixo mostra a divisão inteira, 1º no topo e 20º embaixo, com as faixas do G4 e do Z4 ao fundo. Uma escala por clube faria uma escada de 15 degraus parecer igual a quem passou o ano entre o 5º e o 6º.

Um detalhe que o gráfico de pontos entrega e o de posição não: o Cruzeiro é 6º com saldo NEGATIVO, 35 gols pró contra 36 sofridos. Ele subiu somando resultado, não goleada — 52% de aproveitamento, e a barra de baixo crescendo em degraus de 3 em 3.

A cor diz o resultado (verde vitória, amarelo empate, vermelho derrota) e a geometria diz a direção — em canais separados, porque as rodadas que valem a pena olhar são as que os dois discordam. A 14ª é uma derrota que custa três posições; a 23ª é uma vitória que não move o clube do 5º, corpo nulo em verde.

Nenhum número foi digitado à mão. A animação lê a mesma função que calcula as velas no Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #Cruzeiro #Raposa #Manim #DataViz #VisualizacaoDeDados #Futebol #Python #Candlestick
```

### O parágrafo que muda, e por que ele não podia ser copiado

O texto do Bahia vende **estabilidade** — cinco empates seguidos, nove rodadas
dentro de duas posições — e o do Athletico-PR vende **amplitude de pavio**:
"olhe a 3ª rodada, nove posições". Nenhum dos dois descreve este vídeo. Medido
sobre os quatro payloads:

| clube | melhor | pior | amplitude | maior pavio fora das rodadas 1-2 |
|---|---|---|---|---|
| Bahia | 1º | 8º | 7 | 3 |
| Fluminense | 2º | 12º | 10 | 5 |
| Athletico-PR | 2º | 13º | 11 | 9 |
| **Cruzeiro** | **5º** | **20º** | **15** | **6** |

**O assunto do Cruzeiro é a amplitude da CAMPANHA, não a do pavio.** As duas
coisas são diferentes e o vídeo do Athletico-PR já usou a segunda: lá, uma única
rodada abre nove posições de pavio, o que é volatilidade dentro da rodada. Aqui
o pavio é modesto — 6 posições no maior deles fora da abertura — e o que é
grande é o percurso: o clube atravessa três quartos da tabela ao longo de 25
rodadas, sem nenhuma rodada especialmente selvagem. É uma escada, não um
terremoto, e o texto tinha de dizer isso.

**As rodadas 1 e 2 estão de fora dessa conta de propósito, e isso é medido e não
suposto.** Antes do primeiro jogo os clubes empatados em nada são ordenados por
NOME — é a regra que o `rank-candles-core.ts` registra —, então o pavio da 1ª
rodada é largo para todo mundo e não diz nada sobre o clube. No Cruzeiro ele é
de 10 posições, o maior da temporada inteira dele, e é puro alfabeto. Usá-lo
como exemplo de vitrine seria vender um artefato da ordenação como se fosse
futebol.

### Versão curta

Para Short, ou onde a descrição longa não couber.

```
A campanha do Cruzeiro em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela, e a barra de baixo são os pontos. Oito rodadas em último, 4 pontos, nenhuma vitória — e 35 pontos nas 17 seguintes. Dados até a 25ª: 6º com 39 pts, 11V 6E 8D.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #Cruzeiro #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola. 447
caracteres, 27 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, cruzeiro, cruzeiro ec, cruzeiro esporte clube, raposa, cabuloso, campanha do cruzeiro, classificação brasileirão, tabela do brasileirão, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, data visualization, dataviz, manim, animação em python, python, estatísticas de futebol, football analytics, portal brasileirão, rodada 25
```

Quatro blocos deliberados, na ordem do volume de busca: futebol, o clube, o
vocabulário do desenho (`candlestick` e `gráfico de velas` trazem um público que
não busca futebol), e por fim dataviz e Manim — menor, mas é quem assiste 21
segundos de gráfico até o fim e clica no repositório. `brasileirao` sem acento
está na lista de propósito: muita gente digita sem, e o YouTube não normaliza
acentuação em tags.

**O bloco do clube tem cinco grafias e a sigla ficou de fora.** `cruzeiro` é o
nome como a tabela escreve, `cruzeiro ec` e `cruzeiro esporte clube` são as
formas formais, `raposa` e `cabuloso` são os apelidos. O `tla` do payload é
`CRU`, e ele **não** entrou: vale o mesmo aviso que o `CLAUDE.md` dá sobre `tla`
não ser identidade, e aqui a sigla é fraca do mesmo jeito que o `bah` do Bahia —
"cru" é palavra corrente em português e traria recomendação torta. O Athletico-PR
pôde usar `cap` porque a sigla dele não é uma palavra.

**`cruzeiro` é ambíguo fora do futebol** — é a moeda antiga, e é o tipo de
viagem — e isso não tem conserto do lado das tags: `cruzeiro` sozinho é o termo
que o torcedor digita, então ele fica. O que resolve é o título, que traz
`Brasileirão` na mesma linha.

## Miniatura

**Não existe capa desenhada para os vídeos de velas**, ao contrário dos vídeos
de campanhas e de pontos — e isso é decisão registrada em
`scripts/manim/README.md`: uma capa é um segundo artefato para manter
atualizado, e `capa-core.ts` só compartilha a leitura da paleta e a captura, não
o desenho.

Enquanto ela não existe, o quadro do **fecho** é a melhor escolha, e não um
qualquer: os primeiros segundos são um gráfico vazio, e é só no fim que o painel
de resumo diz `6º · 39 pts em 25 jogos`.

```sh
ffmpeg -ss 20.6 -i docs/medias/velas-cruzeiro.mp4 -frames:v 1 -vf scale=1280:720 capa.png
```

O `-ss 20.6` num vídeo de 21,1s é estreito de propósito e **não** sobra para
arredondar: antes disso o painel de resumo ainda está entrando, e depois o vídeo
acabou. Conferir o PNG antes de subir — é um comando e é a única forma de saber
que o quadro certo saiu. Aqui ele foi conferido: o quadro traz o painel de resumo
inteiro e o card da 25ª rodada com `1 × 3 Vasco da Gama (fora)`.

**Neste clube o quadro do fecho é melhor do que nos outros três**, e vale dizer
por quê: como a campanha atravessa o gráfico na diagonal, o quadro final mostra
a escada inteira do 20º ao 5º de uma vez. Nos outros a linha é quase horizontal,
e a miniatura ganha menos.

## O resto do formulário

- **Público:** "Não, não é conteúdo para crianças". Marcar "sim" desliga
  comentários e cards, e um gráfico de futebol não é conteúdo infantil.
- **Elementos do vídeo:** telas finais precisam de 5s livres no fim, e aqui esses
  5s são exatamente o painel de resumo — que é a parte que vale. Pular.
- **Playlists:** este é o sexto vídeo do conjunto (campanhas, pontos, velas) e o
  quarto com a cena `velas.py`.

## Título do arquivo

O YouTube usa o nome do arquivo como título provisório, então subir
`velas-cruzeiro.mp4` deixa `velas cruzeiro` no campo — trocar antes de publicar.
Medido no vídeo do Athletico-PR: foi exatamente o que apareceu.
