# YouTube — velas do Bahia

Texto que acompanha [`velas-bahia.mp4`](velas-bahia.mp4)
(1920×1080, 60fps, 21s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 21s não comporta.
- **Sem capa desenhada**, como nos vídeos do Fluminense e do Athletico-PR — o que
  existe é a saída provisória descrita no fim desta página.

> **Os números aqui saem de `scripts/manim/velas-bahia.json`, rodada 25,
> snapshot de 2026-09-02** — 5º com 40 pts, 10V 10E 5D, e a oscilação entre o 1º
> e o 8º. Eles **envelhecem**: um `sync-seed-data` seguido de uma reexportação
> move o vídeo, e este arquivo não é regerado por nada. Reconferir antes de
> publicar, contra o JSON e não contra esta página.
>
> Os mesmos três números estão **no quadro do fecho do próprio mp4**, no painel
> de resumo, e é de lá que sai a miniatura provisória — então uma divergência
> entre este texto e a imagem que o acompanha é visível a olho nu. Foi assim que
> eles foram conferidos, e não só contra o JSON: o quadro de 20,6s diz
> `5º · 40 pts em 25 jogos`, `10V · 10E · 5D` e `oscilou entre o 1º e o 8º`.

---

## Título

Recomendado (74 caracteres):

```
Bahia em velas: a campanha rodada a rodada do Brasileirão 2026 (até a 25ª)
```

Abre com o clube, diz o que o desenho é — "em velas" é a curiosidade que segura
o clique de quem conhece candlestick de outro assunto — e **data o recorte**, que
é a única defesa contra alguém assistir daqui a três meses e achar que os números
estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `10 empates em 25 rodadas: a campanha do Bahia em velas \| Brasileirão Série A` | 76 | o número que separa esta temporada de qualquer outra; melhor gancho, e envelhece na próxima rodada |
| 3 | `Bahia: 25 rodadas em 21 segundos, posição e pontos \| Brasileirão 2026` | 69 | promete a duração, bom para retenção |
| 4 | `A campanha do Bahia em candlestick: 5º lugar, 40 pontos, 25 rodadas` | 67 | o número no título envelhece rápido — usar só enquanto a 25ª for a rodada corrente |

**"Tricolor de Aço" e "Esquadrão" não estão em nenhum deles, e estão nas tags**,
pela mesma regra do vídeo do Athletico-PR: o apelido é como o torcedor busca e
não é como o clube aparece no vídeo nem na tabela. Um título que o usa perde quem
digita o nome e ganha pouco, porque o YouTube casa a tag do mesmo jeito.

## Descrição

```
A campanha do Bahia rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 02/09/2026 (25ª rodada):
• Bahia — 5º, 40 pts em 25 jogos
• 10V · 10E · 5D — 37 gols pró, 30 contra, saldo +7
• oscilou entre o 1º e o 8º ao longo da temporada

A temporada tem duas metades e a vela mostra as duas. Na 7ª rodada o Bahia fechou em PRIMEIRO, e esteve em 1º em algum momento de cinco rodadas seguidas (5ª à 9ª). Da 17ª em diante ele não fechou nenhuma rodada fora do 5º ou do 6º lugar — nove rodadas dentro de duas posições.

O que trava o clube ali é o empate, e são 10 deles, incluindo CINCO SEGUIDOS (19ª à 23ª). É aí que a vela diz o que uma tabela não diz: cinco rodadas de corpo quase nulo em amarelo, o clube somando 1 ponto por vez enquanto quem está em volta soma 3. A barra de pontos embaixo continua subindo o tempo todo — e a posição não se move. As duas leituras estão no mesmo eixo x de propósito.

A cor diz o resultado (verde vitória, amarelo empate, vermelho derrota) e a geometria diz a direção — em canais separados, porque as rodadas que valem a pena olhar são as que os dois discordam. A 15ª é uma derrota que não move o clube do 4º: vermelho de corpo nulo. A 8ª é o contrário — líder, perdeu por 4 a 1 no Remo e caiu só uma posição.

O eixo mostra a divisão inteira, 1º no topo e 20º embaixo, com as faixas do G4 e do Z4 ao fundo. Uma escala por clube faria quem oscila entre 5º e 6º parecer quem sobe do 20º.

Nenhum número foi digitado à mão. A animação lê a mesma função que calcula as velas no Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #Bahia #ECBahia #Manim #DataViz #VisualizacaoDeDados #Futebol #Python #Candlestick
```

### O parágrafo que muda, e por que ele não podia ser copiado

O texto do Athletico-PR vende **amplitude**: "olhe a 3ª rodada, nove posições de
pavio". Repetir esse ângulo aqui descreveria um vídeo que não existe. Medido
sobre os três payloads:

| clube | maior pavio na temporada | maior fora das rodadas 1-2 |
|---|---|---|
| Fluminense | 10 (rodada 1) | 5 |
| Athletico-PR | 9 (rodada 3) | 9 |
| **Bahia** | **4** (rodadas 1 e 2) | **3** |

**O Bahia tem os pavios mais curtos dos três**, e por uma margem que não é de
medição. O assunto do vídeo dele é o oposto: a estabilidade, e o empate como a
causa dela. Daí o terceiro e o quarto parágrafos serem sobre a sequência de
cinco empates e sobre o corpo nulo, e não sobre um pavio.

**As rodadas 1 e 2 estão de fora dessa conta de propósito, e isso é medido e não
suposto.** Antes do primeiro jogo os clubes empatados em nada são ordenados por
NOME — é a regra que o `rank-candles-core.ts` registra —, então o pavio da 1ª
rodada é largo para todo mundo e não diz nada sobre o clube. Conferido nos três:
6 posições no Athletico-PR, 4 no Bahia e 10 no Fluminense, onde a 1ª rodada é a
maior amplitude da temporada inteira. Usar a 1ª rodada como exemplo de vitrine
seria vender um artefato do alfabeto como se fosse futebol.

### Versão curta

Para Short, ou onde a descrição longa não couber.

```
A campanha do Bahia em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela, e a barra de baixo são os pontos. Dados até a 25ª rodada: 5º com 40 pts, 10V 10E 5D — com cinco empates seguidos entre a 19ª e a 23ª.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #Bahia #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola. 439
caracteres, 27 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, bahia, ec bahia, esporte clube bahia, tricolor de aço, bah, campanha do bahia, classificação brasileirão, tabela do brasileirão, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, data visualization, dataviz, manim, animação em python, python, estatísticas de futebol, football analytics, portal brasileirão, rodada 25
```

Quatro blocos deliberados, na ordem do volume de busca: futebol, o clube, o
vocabulário do desenho (`candlestick` e `gráfico de velas` trazem um público que
não busca futebol), e por fim dataviz e Manim — menor, mas é quem assiste 21
segundos de gráfico até o fim e clica no repositório. `brasileirao` sem acento
está na lista de propósito: muita gente digita sem, e o YouTube não normaliza
acentuação em tags.

**O bloco do clube tem cinco grafias e uma delas é curta demais para valer
sozinha.** `bahia` é o nome como a tabela escreve, `ec bahia` e `esporte clube
bahia` são as formas formais, `tricolor de aço` é o apelido e `bah` é a sigla —
a mesma que o `velas-bahia.json` carrega como `tla`. Vale o mesmo aviso que o
`CLAUDE.md` dá sobre `tla` não ser identidade: `bah` é uma tag de busca, não uma
chave, e aqui ela é fraca de um jeito que a `cap` do Athletico-PR não era, porque
"bah" é interjeição corrente em português. Se as recomendações vierem tortas,
é a primeira a sair.

**`bahia` é ambíguo fora do futebol** — é o estado — e isso não tem conserto do
lado das tags: `bahia` sozinho é o termo que o torcedor digita, então ele fica.
O que resolve é o título, que traz `Brasileirão` na mesma linha.

## Miniatura

**Não existe capa desenhada para os vídeos de velas**, ao contrário dos outros
dois — e isso é decisão registrada em `scripts/manim/README.md`: uma capa é um
segundo artefato para manter atualizado, e `capa-core.ts` só compartilha a
leitura da paleta e a captura, não o desenho.

Enquanto ela não existe, o quadro do **fecho** é a melhor escolha, e não um
qualquer: os primeiros segundos são um gráfico vazio, e é só no fim que o painel
de resumo diz `5º · 40 pts em 25 jogos`.

```sh
ffmpeg -ss 20.6 -i docs/medias/bahia/velas-bahia.mp4 -frames:v 1 -vf scale=1280:720 capa.png
```

O `-ss 20.6` num vídeo de 21,1s é estreito de propósito e **não** sobra para
arredondar: antes disso o painel de resumo ainda está entrando, e depois o vídeo
acabou. Conferir o PNG antes de subir — é um comando e é a única forma de saber
que o quadro certo saiu. Aqui ele foi conferido: o quadro traz o painel de resumo
inteiro e o card da 25ª rodada com `3 × 2 Internacional (casa)`.

## O resto do formulário

- **Público:** "Não, não é conteúdo para crianças". Marcar "sim" desliga
  comentários e cards, e um gráfico de futebol não é conteúdo infantil.
- **Elementos do vídeo:** telas finais precisam de 5s livres no fim, e aqui esses
  5s são exatamente o painel de resumo — que é a parte que vale. Pular.
- **Playlists:** este é o quarto vídeo do conjunto (campanhas, pontos, velas) e o
  terceiro com a cena `velas.py`.

## Título do arquivo

O YouTube usa o nome do arquivo como título provisório, então subir
`velas-bahia.mp4` deixa `velas bahia` no campo — trocar antes de publicar.
Medido no vídeo do Athletico-PR: foi exatamente o que apareceu.
