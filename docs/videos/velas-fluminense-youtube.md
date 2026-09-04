# YouTube — velas do Fluminense

Texto que acompanha [`velas-fluminense.mp4`](velas-fluminense.mp4)
(1920×1080, 60fps, 21s).

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados, medidos com as vírgulas e os espaços
  exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 21s não comporta.
- **Sem capa desenhada**, ao contrário dos outros dois vídeos — o que existe é a
  saída provisória descrita no fim desta página.

> **Os números aqui saem de `scripts/manim/velas.json`, rodada 25, snapshot de
> 2026-09-02** — 4º com 42 pts, 11V 9E 5D, e a oscilação entre o 2º e o 12º. Eles
> **envelhecem**: um `sync-seed-data` seguido de uma reexportação move o vídeo, e
> este arquivo não é regerado por nada. Reconferir antes de publicar, contra o
> JSON e não contra esta página.

---

## Título

Recomendado (79 caracteres):

```
Fluminense em velas: a campanha rodada a rodada do Brasileirão 2026 (até a 25ª)
```

Abre com o clube, diz o que o desenho é — "em velas" é a curiosidade que segura
o clique de quem conhece candlestick de outro assunto — e **data o recorte**, que
é a única defesa contra alguém assistir daqui a três meses e achar que os números
estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `O que a linha esconde: a campanha do Fluminense em velas \| Brasileirão Série A` | 78 | a pergunta que a vela responde; melhor para o público de dataviz, pior para busca |
| 3 | `Fluminense: 25 rodadas em 21 segundos, posição e pontos \| Brasileirão 2026` | 74 | promete a duração, bom para retenção |
| 4 | `A campanha do Fluminense em candlestick: 4º lugar, 42 pontos, 25 rodadas` | 72 | o número no título envelhece rápido — usar só enquanto a 25ª for a rodada corrente |

## Descrição

```
A campanha do Fluminense rodada a rodada, desenhada como vela: o corpo vai da posição em que o clube ABRIU a rodada até onde ele FECHOU, e o pavio cobre a melhor e a pior posição que ele ocupou enquanto a rodada era jogada. Embaixo, no mesmo eixo, os pontos acumulados — a barra é o total e a tampa clara é o que a rodada acrescentou.

Dados até 02/09/2026 (25ª rodada):
• Fluminense — 4º, 42 pts em 25 jogos
• 11V · 9E · 5D
• oscilou entre o 2º e o 12º ao longo da temporada

Por que uma vela e não uma linha: uma linha liga a posição do FIM de cada rodada, então tudo o que acontece dentro dela é invisível. Quem sentou em 4º no sábado e terminou em 9º porque três rivais jogaram no domingo desenha o mesmo segmento de quem desceu andando. A vela separa os dois fatos.

A cor diz o resultado (verde vitória, amarelo empate, vermelho derrota) e a geometria diz a direção — de propósito em canais separados, porque as rodadas que valem a pena olhar são justamente aquelas em que os dois discordam: vencer e ainda assim cair uma posição é um domingo comum no Brasileirão.

O eixo mostra a divisão inteira, 1º no topo e 20º embaixo, com as faixas do G4 e do Z4 ao fundo. Uma escala por clube faria quem oscila entre 2º e 5º parecer quem sobe do 20º.

Nenhum número foi digitado à mão. A animação lê a mesma função que calcula as velas no Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #Fluminense #Manim #DataViz #VisualizacaoDeDados #Futebol #Python #Candlestick
```

### Versão curta

Para Short, ou onde a descrição longa não couber.

```
A campanha do Fluminense em velas: o corpo vai da posição de abertura à de fechamento da rodada, o pavio mostra até onde o clube subiu e desceu dentro dela, e a barra de baixo são os pontos. Dados até a 25ª rodada: 4º com 42 pts, 11V 9E 5D.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #Fluminense #DataViz #Manim
```

## Tags

Medido sobre o bloco como está — separado por `, `, que é o que se cola.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, fluminense, fluminense fc, flu, campanha do fluminense, classificação brasileirão, tabela do brasileirão, campanha rodada a rodada, candlestick, gráfico de velas, futebol brasileiro, visualização de dados, data visualization, dataviz, manim, animação em python, python, estatísticas de futebol, football analytics, portal brasileirão, rodada 25
```

Quatro blocos deliberados, na ordem do volume de busca: futebol, o clube, o
vocabulário do desenho (`candlestick` e `gráfico de velas` trazem um público que
não busca futebol), e por fim dataviz e Manim — menor, mas é quem assiste 21
segundos de gráfico até o fim e clica no repositório. `brasileirao` sem acento
está na lista de propósito: muita gente digita sem, e o YouTube não normaliza
acentuação em tags.

## Miniatura

**Não existe capa desenhada para este vídeo**, ao contrário dos outros dois — e
isso é decisão registrada em `scripts/manim/README.md`: uma capa é um segundo
artefato para manter atualizado, e `capa-core.ts` só compartilha a leitura da
paleta e a captura, não o desenho.

Enquanto ela não existe, o quadro do **fecho** é a melhor escolha, e não um
qualquer: os primeiros segundos são um gráfico vazio, e é só no fim que o painel
de resumo diz `4º · 42 pts em 25 jogos`.

```sh
ffmpeg -ss 20.6 -i docs/videos/velas-fluminense.mp4 -frames:v 1 -vf scale=1280:720 capa.png
```

## Título do arquivo

O YouTube usa o nome do arquivo como título provisório, então subir
`velas-fluminense.mp4` deixa `velasfluminense` no campo — trocar antes de
publicar.
