# YouTube — velas do Palmeiras

Texto que acompanha [`velas-palmeiras.mp4`](velas-palmeiras.mp4)
(1920×1080, 60fps, 21s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 21s não comporta.
- **Com capa:** `velas-palmeiras-miniatura.png`, 1280×720, o quadro do fecho da
  própria cena — a regra que o `scripts/manim/README.md` registra para as velas.

> **Os números aqui saem de `scripts/manim/velas-palmeiras.json`, rodada 25,
> snapshot de 2026-09-02** — 1º com 52 pts, 15V 7E 3D, e a oscilação entre o 1º
> e o 11º. Eles **envelhecem**: um `sync-seed-data` seguido de uma reexportação
> move o vídeo, e este arquivo não é regerado por nada. Reconferir antes de
> publicar, contra o JSON e não contra esta página.
>
> Os mesmos três números estão **no quadro do fecho do próprio mp4**, no painel
> de resumo, que é de onde a capa sai — então uma divergência entre este texto e
> a imagem que o acompanha é visível a olho nu. Foi assim que eles foram
> conferidos: o quadro de 20,6s diz `1º · 52 pts em 25 jogos`,
> `15V · 7E · 3D` e `oscilou entre o 1º e o 11º`.
>
> **O saldo, o aproveitamento e a vantagem foram conferidos contra o
> `computeStandings`**, a mesma função que monta a tabela do site, e não somados
> à mão a partir do JSON: 45 gols pró, 21 contra, saldo +24, 69% de
> aproveitamento, 4 pontos à frente do Flamengo.

---

## Título

Recomendado (78 caracteres):

```
Palmeiras em velas: a campanha rodada a rodada do Brasileirão 2026 (até a 25ª)
```

Abre com o clube, diz o que o desenho é — "em velas" é a curiosidade que segura
o clique de quem conhece candlestick de outro assunto — e **data o recorte**, que
é a única defesa contra alguém assistir daqui a três meses e achar que os números
estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `18 rodadas seguidas na liderança: a campanha do Palmeiras em velas` | 66 | o número que só este clube tem nesta temporada; melhor gancho, e envelhece na próxima rodada |
| 3 | `Palmeiras: 25 rodadas em 21 segundos, posição e pontos \| Brasileirão 2026` | 73 | promete a duração, bom para retenção |
| 4 | `A campanha do líder em candlestick: Palmeiras, 52 pontos em 25 rodadas` | 70 | "líder" envelhece mais rápido que qualquer número aqui — usar só enquanto for verdade |

**"Verdão" e "Porco" não estão em nenhum deles, e estão nas tags**, pela mesma
regra dos outros vídeos de velas: o apelido é como o torcedor busca e não é como
o clube aparece no vídeo nem na tabela. Um título que o usa perde quem digita o
nome e ganha pouco, porque o YouTube casa a tag do mesmo jeito.

## Descrição

```
A campanha do Palmeiras rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 02/09/2026 (25ª rodada):
• Palmeiras — 1º, 52 pts em 25 jogos
• 15V · 7E · 3D — 45 gols pró, 21 contra, saldo +24
• 69% de aproveitamento, 4 pontos à frente do 2º colocado

Este é o desenho mais quieto que já fizemos, e é assim que a liderança se parece. O Palmeiras assumiu o primeiro lugar na 3ª rodada, e da 8ª em diante NÃO SAIU MAIS: são 18 rodadas seguidas fechando em 1º, 20 no total. A partir da 3ª rodada ele nunca fechou pior que o 3º lugar. Uma sequência de corpos quase nulos colados no topo do quadro — a vela dizendo, rodada após rodada, que nada mudou.

São apenas 3 derrotas em 25 jogos: a 5ª (1 a 2 para o Vasco), a 20ª e a 23ª (2 a 3 para o Fluminense). E aqui está o que a vela mostra e a tabela não: NENHUMA delas tirou o clube da liderança. Na 23ª o corpo é vermelho e tem altura zero — perdeu, e fechou em 1º do mesmo jeito. É exatamente por isso que a cor e a geometria são canais separados neste desenho: as rodadas que valem a pena olhar são as que os dois discordam.

O pavio é onde a temporada ainda tem movimento. Na 3ª rodada ele vai do 1º ao 9º — oito posições dentro de uma única rodada, no dia em que o clube subiu à liderança. Depois disso os pavios encurtam e praticamente somem: o que sobra é a barra de pontos embaixo, subindo em degraus de 3 em 3, e a maior invencibilidade da campanha, 14 rodadas.

A oscilação de 1º a 11º no painel de resumo merece uma ressalva honesta: o 11º é a 1ª e a 2ª rodada. Antes do primeiro jogo os clubes empatados em nada são ordenados por NOME, então aquela posição é alfabeto e não futebol.

O eixo mostra a divisão inteira, 1º no topo e 20º embaixo, com as faixas do G4 e do Z4 ao fundo. A campanha de quem briga em cima deixa dois terços do desenho vazios — e é isso que dá sentido às faixas, e o que permite comparar este vídeo com o de qualquer outro clube.

Nenhum número foi digitado à mão. A animação lê a mesma função que calcula as velas no Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #Palmeiras #Verdao #Manim #DataViz #VisualizacaoDeDados #Futebol #Python #Candlestick
```

### O parágrafo que muda, e por que ele não podia ser copiado

Cada vídeo de velas até aqui vendeu um ângulo diferente, e nenhum deles descreve
este. O do Athletico-PR vende **amplitude de pavio**; o do Bahia, a
**estabilidade causada pelo empate**; o do Cruzeiro, a **amplitude da campanha** —
15 posições, do 20º ao 6º. Medido sobre os cinco payloads:

| clube | melhor | pior | amplitude | pior fora das rodadas 1-2 | rodadas em 1º |
|---|---|---|---|---|---|
| **Palmeiras** | **1º** | 11º | 10 | **3º** | **20** |
| Bahia | 1º | 8º | 7 | 8º | 1 |
| Fluminense | 2º | 12º | 10 | 12º | 0 |
| Athletico-PR | 2º | 13º | 11 | 13º | 0 |
| Cruzeiro | 5º | 20º | 15 | 20º | 0 |

**A coluna que separa este vídeo é a última, e a penúltima é a que corrige a
terceira.** A amplitude bruta do Palmeiras (10) é igual à do Fluminense e maior
que a do Bahia, o que sugeriria uma campanha movimentada — e é falso: os dez
vêm inteiramente das duas primeiras rodadas, onde a ordenação é alfabética.
Descontadas elas, o Palmeiras oscila **duas posições em 23 rodadas**, contra as
onze do Athletico-PR e as quinze do Cruzeiro. Um número que a coluna ao lado
desmente é pior que nenhum, e é por isso que as duas estão na tabela.

**Publicado ao lado do vídeo do Cruzeiro, e os dois se leem melhor juntos**:
mesma rodada, mesma cena, mesmo eixo, campanhas opostas — uma escada de quinze
degraus subindo, uma linha reta no topo. É o argumento do eixo da divisão
inteira em duas imagens, e vale dizer isso na descrição de cada um se os dois
forem ao ar na mesma semana.

### Versão curta

Para Short, ou onde a descrição longa não couber.

```
A campanha do líder em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela, e a barra de baixo são os pontos. O Palmeiras assumiu a ponta na 3ª rodada e da 8ª em diante não saiu mais — 18 rodadas seguidas em 1º. Dados até a 25ª: 52 pts, 15V 7E 3D, saldo +24.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #Palmeiras #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola. 476
caracteres, 28 tags.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, palmeiras, se palmeiras, sociedade esportiva palmeiras, verdão, porco, campanha do palmeiras, líder do brasileirão, classificação brasileirão, tabela do brasileirão, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, data visualization, dataviz, manim, animação em python, python, estatísticas de futebol, football analytics, portal brasileirão, rodada 25
```

Quatro blocos deliberados, na ordem do volume de busca: futebol, o clube, o
vocabulário do desenho (`candlestick` e `gráfico de velas` trazem um público que
não busca futebol), e por fim dataviz e Manim — menor, mas é quem assiste 21
segundos de gráfico até o fim e clica no repositório. `brasileirao` sem acento
está na lista de propósito: muita gente digita sem, e o YouTube não normaliza
acentuação em tags.

**O bloco do clube tem cinco grafias e a sigla ficou de fora**, como no vídeo do
Cruzeiro e pela mesma razão. `palmeiras` é o nome como a tabela escreve, `se
palmeiras` e `sociedade esportiva palmeiras` são as formas formais, `verdão` e
`porco` são os apelidos. O `tla` do payload é `PAL`, e ele **não** entrou: vale o
aviso que o `CLAUDE.md` dá sobre `tla` não ser identidade, e três letras que são
o começo do próprio nome do clube não acrescentam alcance nenhum sobre a tag
`palmeiras` que já está ali.

**`líder do brasileirão` é a única tag aqui que envelhece**, e envelhece rápido —
quatro pontos de vantagem são uma rodada e meia. Ela fica porque é um termo que
as pessoas digitam durante a temporada, mas é a primeira a sair se este vídeo
continuar no ar depois que a liderança mudar.

## Miniatura

`velas-palmeiras-miniatura.png`, 1280×720, e ela **existe** — ao contrário do que
diziam as versões anteriores destes arquivos. As três cenas de velas ganharam
capa em `2c95b73`, o que a decisão anterior já previa em suas próprias palavras:
"quando um destes for para o YouTube… seria um por clube, pela mesma razão que o
vídeo é".

Ela é o **quadro do fecho da própria cena**, e não um layout à parte como as
capas do `campanhas` e do `pontos` — uma vela cheia já é a temporada inteira, e
os primeiros segundos são um gráfico vazio.

```sh
ffmpeg -ss 20.6 -i docs/medias/palmeiras/velas-palmeiras.mp4 -frames:v 1 -vf scale=1280:720 \
  docs/medias/palmeiras/velas-palmeiras-miniatura.png
```

O `-ss 20.6` num vídeo de 21,1s é estreito de propósito e **não** sobra para
arredondar: antes disso o painel de resumo ainda está entrando, e depois o vídeo
acabou. Conferir o PNG antes de subir — é um comando e é a única forma de saber
que o quadro certo saiu. Aqui ele foi aberto e conferido: 1280×720, o painel de
resumo inteiro com `1º · 52 pts em 25 jogos`, e o card da 25ª rodada com
`1 × 1 Mirassol (fora)`.

**Neste clube a capa tem um problema que os outros não têm, e vale saber antes
de julgá-la:** a campanha é uma linha reta colada no topo, então a metade de
baixo do gráfico de posições está vazia. Ela é honesta — é o que o vídeo mostra,
e é o argumento do eixo da divisão inteira — mas rende menos como miniatura que
a do Cruzeiro, onde a diagonal atravessa o quadro. Se algum dia valer a pena
desenhar uma capa própria para as velas, é este clube que a justifica.

## O resto do formulário

- **Público:** "Não, não é conteúdo para crianças". Marcar "sim" desliga
  comentários e cards, e um gráfico de futebol não é conteúdo infantil.
- **Elementos do vídeo:** telas finais precisam de 5s livres no fim, e aqui esses
  5s são exatamente o painel de resumo — que é a parte que vale. Pular.
- **Playlists:** este é o sétimo vídeo do conjunto (campanhas, pontos, velas) e o
  quinto com a cena `velas.py`.

## Título do arquivo

O YouTube usa o nome do arquivo como título provisório, então subir
`velas-palmeiras.mp4` deixa `velas palmeiras` no campo — trocar antes de
publicar. Medido no vídeo do Athletico-PR: foi exatamente o que apareceu.
