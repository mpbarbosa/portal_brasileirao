# YouTube — campanhas Palmeiras × Flamengo

Texto que acompanha [`campanhas-palmeiras-flamengo.mp4`](campanhas-palmeiras-flamengo.mp4)
(1920×1080, 60fps, 23s) e as duas capas ao lado dele.

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do “mostrar mais” — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados. A lista abaixo usa 372, medidos com as
  vírgulas e os espaços exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 23s não comporta.

> **Os números aqui saem de `scripts/manim/campanhas.json`, rodada 25, snapshot
> de 2026-09-02** — 1º com 52 pts e 2º com 48. Eles **envelhecem**: um
> `sync-seed-data` seguido de `sync-rank-history` e uma reexportação movem o
> vídeo e as capas, e este arquivo não é regerado por nada. Reconferir antes de
> publicar, contra o JSON e não contra esta página.

---

## Título

Recomendado (80 caracteres):

```
Palmeiras × Flamengo: a campanha rodada a rodada do Brasileirão 2026 (até a 25ª)
```

Abre com os dois nomes que as pessoas buscam, diz o que o vídeo é e **data o
recorte** — que é a única defesa contra alguém assistir daqui a três meses e
achar que os números estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `Do 11º ao 1º: a campanha do Palmeiras contra a do Flamengo no Brasileirão` | 73 | a virada; o Palmeiras sai mesmo da 11ª posição na 1ª rodada e o Flamengo da 13ª |
| 3 | `Palmeiras × Flamengo: 25 rodadas em 23 segundos \| Brasileirão Série A 2026` | 74 | promete a duração, bom para retenção |
| 4 | `A corrida pelo topo do Brasileirão: Palmeiras × Flamengo, rodada a rodada` | 73 | mais editorial, menos buscável |

Manter o `×` (U+00D7) e não o `x`: é como o vídeo escreve na tela e como a
imprensa esportiva grafa confrontos.

## Descrição

```
Palmeiras × Flamengo: a campanha rodada a rodada do Brasileirão Série A, desenhada como linha sobre a divisão inteira — 1º no topo, 20º embaixo, com as faixas do G4 e do Z4 ao fundo. A cada rodada, o card ao lado mostra o jogo que moveu a linha: adversário, mando e placar.

Dados até 02/09/2026 (25ª rodada):
• Palmeiras — 1º, 52 pts, 15V 7E 3D
• Flamengo — 2º, 48 pts, 14V 6E 4D

Por que o eixo é a divisão inteira e não a faixa onde os dois clubes andaram: uma escala por clube faz quem oscila entre 1º e 3º parecer quem sobe do 20º. Com os 20 lugares sempre à vista, a campanha do líder deixa dois terços do desenho vazios — e é isso que dá sentido às faixas.

Nenhum número foi digitado à mão. A animação lê o mesmo histórico de classificação que alimenta o Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.

#Brasileirao #SerieA #Palmeiras #Flamengo #Manim #DataViz #VisualizacaoDeDados #Futebol #Python #TypeScript
```

### Versão curta

Para Short, ou onde a descrição longa não couber.

```
A campanha de Palmeiras e Flamengo, rodada a rodada, sobre a tabela inteira do Brasileirão — com o jogo de cada rodada ao lado. Dados até a 25ª rodada: Palmeiras 1º com 52 pts, Flamengo 2º com 48.

Animação em Manim, dados do Portal Brasileirão: https://brasileirao.mpbarbosa.com
Código: https://github.com/mpbarbosa/portal_brasileirao

#Brasileirao #Palmeiras #Flamengo #DataViz #Manim
```

## Tags

372 dos 500 caracteres permitidos, então ainda há folga. Medido sobre o bloco
como está — separado por `, `; um join sem o espaço dá 351, e não é o que se
cola.

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, serie a, palmeiras, flamengo, palmeiras x flamengo, classificação brasileirão, tabela do brasileirão, campanha rodada a rodada, futebol brasileiro, visualização de dados, data visualization, dataviz, manim, animação em python, python, estatísticas de futebol, football analytics, portal brasileirão, rodada 25
```

Três blocos deliberados: as buscas de futebol primeiro, que é de onde vem o
volume; depois os dois clubes; depois o público de dataviz e Manim, que é menor
mas é quem assiste 23 segundos de gráfico até o fim e clica no repositório.
`brasileirao` sem acento está na lista de propósito — muita gente digita sem, e
o YouTube não normaliza acentuação em tags.

## Miniatura

Duas, escritas por `npx tsx scripts/manim/thumbnail.ts`:

| arquivo | usar com |
|---|---|
| [`campanhas-palmeiras-flamengo-miniatura.png`](campanhas-palmeiras-flamengo-miniatura.png) | o título recomendado |
| [`campanhas-palmeiras-flamengo-miniatura-11-ao-1.png`](campanhas-palmeiras-flamengo-miniatura-11-ao-1.png) | o título 2 |

**Emparelhar assim não é preferência.** A capa `DO 11º AO 1º` estampa uma
informação que o título recomendado não promete, e miniatura e título brigando
pelo mesmo espaço de atenção é o erro mais comum aqui. A segunda também envelhece
mais rápido: `1º` é uma afirmação sobre a rodada 25 em tipo de 96px, errada no dia
em que a liderança mudar.
