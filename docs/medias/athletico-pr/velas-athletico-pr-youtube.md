# YouTube — velas do Athletico-PR

Texto que acompanha [`velas-athletico-pr.mp4`](velas-athletico-pr.mp4)
(1920×1080, 60fps, 21s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 21s não comporta.
- **Sem capa desenhada**, como no vídeo do Fluminense — o que existe é a saída
  provisória descrita no fim desta página.

> **Os números aqui saem de `scripts/manim/velas-athletico-pr.json`, rodada 25,
> snapshot de 2026-09-02** — 3º com 45 pts, 13V 6E 6D, e a oscilação entre o 2º e
> o 13º. Eles **envelhecem**: um `sync-seed-data` seguido de uma reexportação move
> o vídeo, e este arquivo não é regerado por nada. Reconferir antes de publicar,
> contra o JSON e não contra esta página.
>
> Os mesmos três números estão **no quadro do fecho do próprio mp4**, no painel de
> resumo, e é de lá que sai a miniatura provisória — então uma divergência entre
> este texto e a imagem que o acompanha é visível a olho nu. Foi assim que eles
> foram conferidos, e não só contra o JSON.

---

## Título

Recomendado (81 caracteres):

```
Athletico-PR em velas: a campanha rodada a rodada do Brasileirão 2026 (até a 25ª)
```

Abre com o clube, diz o que o desenho é — "em velas" é a curiosidade que segura
o clique de quem conhece candlestick de outro assunto — e **data o recorte**, que
é a única defesa contra alguém assistir daqui a três meses e achar que os números
estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `O que a linha esconde: a campanha do Athletico-PR em velas \| Brasileirão Série A` | 80 | a pergunta que a vela responde; melhor para o público de dataviz, pior para busca |
| 3 | `Athletico-PR: 25 rodadas em 21 segundos, posição e pontos \| Brasileirão 2026` | 76 | promete a duração, bom para retenção |
| 4 | `A campanha do Athletico-PR em candlestick: 3º lugar, 45 pontos, 25 rodadas` | 74 | o número no título envelhece rápido — usar só enquanto a 25ª for a rodada corrente |

**"Furacão" não está em nenhum deles, e está nas tags.** O apelido é como o
torcedor busca e não é como o clube aparece no vídeo nem na tabela; um título que
o usa perde quem digita o nome e ganha pouco, porque o YouTube casa a tag do
mesmo jeito.

## Descrição

```
A campanha do Athletico-PR rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 02/09/2026 (25ª rodada):
• Athletico-PR — 3º, 45 pts em 25 jogos
• 13V · 6E · 6D
• oscilou entre o 2º e o 13º ao longo da temporada

Por que uma vela e não uma linha: uma linha liga a posição do FIM de cada rodada, então tudo o que acontece dentro dela é invisível. Olhe a 3ª rodada: o Furacão abriu em 12º e fechou em 6º, mas dentro dela esteve em 4º e em 13º — nove posições de amplitude que uma linha desenha como um segmento calmo.

A cor diz o resultado (verde vitória, amarelo empate, vermelho derrota) e a geometria diz a direção — de propósito em canais separados, porque as rodadas que valem a pena olhar são justamente aquelas em que os dois discordam. Da 20ª em diante o Athletico venceu sem sair do 3º lugar três vezes: vela verde, posição parada.

O eixo mostra a divisão inteira, 1º no topo e 20º embaixo, com as faixas do G4 e do Z4 ao fundo. Uma escala por clube faria quem oscila entre 2º e 5º parecer quem sobe do 20º.

Nenhum número foi digitado à mão. A animação lê a mesma função que calcula as velas no Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #AthleticoPR #Furacao #Manim #DataViz #VisualizacaoDeDados #Futebol #Python #Candlestick
```

**O quarto parágrafo é o que muda em relação ao texto do Fluminense, e não é
estilo.** Lá o exemplo era vencer e ainda assim cair uma posição; aqui isso **não
acontece em nenhuma das 25 rodadas** — nenhuma vitória fecha abaixo de onde abriu,
e nenhuma derrota fecha acima. Repetir a frase de lá seria descrever um domingo
que este clube não teve. O que a temporada oferece no lugar é a discordância
parada: rodadas 20, 22 e 24 são vitórias que não movem o clube do 3º, e essa é
uma vela verde de corpo nulo.

O exemplo da 3ª rodada tem a **maior amplitude de pavio da temporada** (4º a 13º,
nove posições) — foi escolhido medindo `worst - best` sobre o JSON inteiro, não
por parecer bom.

### Versão curta

Para Short, ou onde a descrição longa não couber.

```
A campanha do Athletico-PR em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela, e a barra de baixo são os pontos. Dados até a 25ª rodada: 3º com 45 pts, 13V 6E 6D.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #AthleticoPR #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola. 433
caracteres.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, athletico paranaense, athletico-pr, furacão, cap, campanha do athletico, classificação brasileirão, tabela do brasileirão, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, data visualization, dataviz, manim, animação em python, python, estatísticas de futebol, football analytics, portal brasileirão, rodada 25
```

Quatro blocos deliberados, na ordem do volume de busca: futebol, o clube, o
vocabulário do desenho (`candlestick` e `gráfico de velas` trazem um público que
não busca futebol), e por fim dataviz e Manim — menor, mas é quem assiste 21
segundos de gráfico até o fim e clica no repositório. `brasileirao` sem acento
está na lista de propósito: muita gente digita sem, e o YouTube não normaliza
acentuação em tags.

**O bloco do clube tem quatro grafias porque nenhuma delas é dominante**:
`athletico paranaense` é o nome formal, `athletico-pr` é como a tabela escreve,
`furacão` é o apelido e `cap` é a sigla — a mesma que o `velas-athletico-pr.json`
carrega como `tla`. Vale o mesmo aviso que o `CLAUDE.md` dá sobre `tla` não ser
identidade: `cap` é uma tag de busca, não uma chave.

## Miniatura

**Não existe capa desenhada para os vídeos de velas**, ao contrário dos outros
dois — e isso é decisão registrada em `scripts/manim/README.md`: uma capa é um
segundo artefato para manter atualizado, e `capa-core.ts` só compartilha a
leitura da paleta e a captura, não o desenho.

Enquanto ela não existe, o quadro do **fecho** é a melhor escolha, e não um
qualquer: os primeiros segundos são um gráfico vazio, e é só no fim que o painel
de resumo diz `3º · 45 pts em 25 jogos`.

```sh
ffmpeg -ss 20.6 -i docs/medias/athletico-pr/velas-athletico-pr.mp4 -frames:v 1 -vf scale=1280:720 capa.png
```

O `-ss 20.6` num vídeo de 21,1s é estreito de propósito e **não** sobra para
arredondar: antes disso o painel de resumo ainda está entrando, e depois o vídeo
acabou. Conferir o PNG antes de subir — é um comando e é a única forma de saber
que o quadro certo saiu.

## O resto do formulário

- **Público:** "Não, não é conteúdo para crianças". Marcar "sim" desliga
  comentários e cards, e um gráfico de futebol não é conteúdo infantil.
- **Elementos do vídeo:** telas finais precisam de 5s livres no fim, e aqui esses
  5s são exatamente o painel de resumo — que é a parte que vale. Pular.
- **Playlists:** este é o terceiro vídeo do conjunto (campanhas, pontos, velas) e
  o segundo com a cena `velas.py`.

## Título do arquivo

O YouTube usa o nome do arquivo como título provisório, então subir
`velas-athletico-pr.mp4` deixa `velas athletico pr` no campo — trocar antes de
publicar. Medido: foi exatamente o que apareceu.
