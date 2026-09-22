# YouTube — a corrida das barras, o corte do torcedor da Chapecoense

Texto que acompanha [`barras-chapecoense.mp4`](barras-chapecoense.mp4)
(1920×1080, 60fps, 30s), os dois cortes verticais e as duas capas ao lado dele.

**É o mesmo desenho do [`barras-20-clubes`](../divisao/barras-20-clubes-youtube.md),
com os vinte clubes e os mesmos números** — o que muda é que um deles fica
achável em todo quadro. A cena é a mesma e o corte é o `BARRAS_FOCUS=1772`; o
`scripts/manim/README.md` tem o porquê de cada escolha do destaque. **Não
descreva o vídeo como "a campanha da Chapecoense"**: ele desenha a divisão
inteira, e prometer um clube entrega vinte.

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados. A lista abaixo usa 252, medidos com as
  vírgulas e os espaços exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 30s fica no limite exato de três capítulos de 10s, e
  não vale a pena.
- **O corte 9:16 serve o Short E o Reels**, e é o mesmo arquivo. O Short entra
  como upload separado, com o título curto abaixo — a descrição longa não é lida
  ali.

> **Os números aqui saem de `scripts/manim/pontos.json`, rodada 28, snapshot de
> 2026-09-21.** Eles **envelhecem**: um `sync-seed-data` seguido de
> `sync-rank-history` e uma reexportação movem o vídeo e as capas, e este arquivo
> não é regerado por nada. Reconferir antes de publicar, contra o JSON e não
> contra esta página. **A distância para o 19º e para fora do Z4 é o mais
> perecível**: duas vitórias mudam metade destas linhas.

**Este é o primeiro corte de torcedor de um clube que NÃO lidera**, e isso muda
o tom de tudo abaixo. A nota de fecho da cena fala do clube do foco e de quem
está logo acima dele — aqui, o Clube do Remo —, e o texto segue a mesma regra:
honesto sobre a lanterna, sem transformar a última posição em manchete de
deboche. Quem assiste a este corte é o torcedor da Chapecoense.

---

## Título

Recomendado (76 caracteres):

```
A corrida da Chapecoense no Brasileirão 2026: 28 rodadas contra os outros 19
```

Abre pelo clube e pelo formato, e não pela lanterna — o torcedor já sabe onde a
Chape está, e um título que abre por "último lugar" é um título que ele não
compartilha. **Data o recorte** pelo ano, a única defesa contra alguém assistir
daqui a três meses e achar que os números estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `Chapecoense no Brasileirão 2026: a luta contra o Z4 rodada a rodada, em barras` | 78 | a briga que ainda está aberta |
| 3 | `A Chapecoense contra a divisão: o Brasileirão 2026 em 28 rodadas e 30 segundos` | 78 | o formato e a duração; ajuda a retenção |
| 4 | `3 vitórias em 27 jogos: a Chapecoense contra a divisão no Brasileirão 2026` | 74 | o número duro; só se o canal aceitar o tom |

### Para o Short (9:16)

Recomendado (54 caracteres). Um Short é lido numa linha e no meio de um feed,
então ele abre pelo clube e pelo formato:

```
A corrida da Chapecoense no Brasileirão em 30s #Shorts
```

## Descrição

```
A Chapecoense rodada a rodada contra os outros dezenove: a barra verde-água é a dela, o comprimento são os pontos e a altura é a colocação — então dá para acompanhar cada ultrapassagem como movimento, e não como duas curvas se cruzando.

Dados até 21/09/2026 (28ª rodada):
• Chapecoense — 20º, 18 pontos em 27 jogos (3 vitórias, 9 empates, 15 derrotas)
• Na lanterna desde a 12ª rodada, 17 rodadas seguidas
• 21 jogos sem vencer, da 2ª à 23ª rodada
• Duas vitórias nas últimas cinco rodadas, na 24ª e na 26ª, e um empate na 28ª: de 11 para 18 pontos
• Clube do Remo — 19º, 23 pontos, com um jogo a mais
• Vasco da Gama — 16º e primeiro fora do Z4, 31 pontos

A reação está no fim do vídeo: a barra que ficou parada por metade da temporada volta a crescer nas últimas rodadas.

O desenho é a divisão inteira e não só a Chapecoense — o que muda neste corte é que a linha dela fica marcada em todo quadro, inclusive nas rodadas do meio da tabela, que é exatamente quando ninguém acha o próprio time num gráfico de vinte barras.

A ressalva do começo: nas primeiras rodadas vários clubes estão empatados em quase nada, e a colocação entre eles sai dos critérios de desempate e, no fim, da ordem alfabética. As colocações daquelas rodadas dizem pouco sobre a campanha.

Por que o eixo dos pontos NÃO se reescala a cada rodada, que é o contrário do que quase toda corrida de barras faz: reescalando, as barras ficam sempre compridas e um clube pode subir no desenho estando parado. Com o eixo fixo, uma barra que cresce é um clube que pontuou, e duas rodadas quaisquer do vídeo podem ser comparadas entre si. O preço é que a 1ª rodada são vinte tocos — que é o que a 1ª rodada é.

Os filetes marcam o G4 e o Z4. Nem todos os clubes têm o mesmo número de jogos neste recorte, e por isso a linha do fecho diz sobre quantos jogos a Chapecoense chegou aos 18 — e que o Remo, logo acima, tem um jogo a mais.

Nenhum número foi digitado à mão. A animação lê o mesmo histórico de classificação que alimenta o Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.
```

## Tags

252 caracteres com os separadores, como coladas:

```
chapecoense, chape, verdão do oeste, brasileirão, brasileirão 2026, série a, campeonato brasileiro, classificação, tabela do brasileirão, zona de rebaixamento, corrida de barras, bar chart race, visualização de dados, futebol brasileiro, manim, dataviz
```

## Onde cada arquivo vai

| arquivo | onde | por quê |
|---|---|---|
| `barras-chapecoense.mp4` | YouTube (vídeo normal) | 16:9, o corte de sempre |
| `barras-chapecoense-916.mp4` | YouTube Short · Instagram Reels | 9:16; o crédito fica abaixo da linha segura de propósito, então a legenda do post precisa repetir o endereço do site |
| `barras-chapecoense-45.mp4` | Instagram (feed) | 4:5; o feed não sobrepõe nada, então cabe o desenho inteiro |
| `barras-chapecoense.gif` | Reddit · README · issue · chat | toca sozinho onde não há player; ver `docs/post-reddit.md` |
| `barras-chapecoense-miniatura.png` | capa do YouTube | os seis primeiros, a lacuna e a linha da Chapecoense marcada — a capa que diz de quem é o corte |
| `barras-chapecoense-miniatura-18-pontos.png` | capa alternativa | a história: o clube, os pontos e a distância para o 19º |

**A capa alternativa se chama `18-pontos` e não `60-pontos` como a do Flamengo**:
ela estampa o *sujeito do corte*, e o nome sai do número que ela mostra. Diferente
da do Flamengo, ela não coincide com a do `barras-20-clubes`, que estampa o líder.

## Como refazer

```sh
npx tsx scripts/manim/export-pontos.ts > scripts/manim/pontos.json
BARRAS_FOCUS=1772                    ./.venv-manim/bin/manim -qh scripts/manim/barras.py Barras
BARRAS_FOCUS=1772 BARRAS_ASPECT=4:5  ./.venv-manim/bin/manim -qh scripts/manim/barras.py Barras
BARRAS_FOCUS=1772 BARRAS_ASPECT=9:16 ./.venv-manim/bin/manim -qh scripts/manim/barras.py Barras
npx tsx scripts/manim/thumbnail-barras.ts --focus 1772
```

**Copie cada corte antes de renderizar o próximo**, e note que o corte com foco e
o sem foco escrevem **o mesmo** `media/videos/barras/1080p60/Barras.mp4`, então
renderizar os dois em sequência e copiar depois põe um deles nos dois arquivos,
com os nomes certos e nada para acusar.

**Este corte é o que exercita o ramo de quem NÃO lidera na nota de fecho**, e a
primeira renderização dele quebrou a nota em duas linhas no 16:9, com a segunda
em cima da barra do 1º lugar. Ver `one_line_label` no `barras.py`.
