# YouTube — a corrida das barras, o corte do torcedor do Flamengo

Texto que acompanha [`barras-flamengo.mp4`](barras-flamengo.mp4)
(1920×1080, 60fps, 30s), os dois cortes verticais e as duas capas ao lado dele.

**É o mesmo desenho do [`barras-20-clubes`](barras-20-clubes-youtube.md), com
os vinte clubes e os mesmos números** — o que muda é que um deles fica achável
em todo quadro. A cena é a mesma e o corte é o `BARRAS_FOCUS=1783`; o
`scripts/manim/README.md` tem o porquê de cada escolha do destaque. **Não
descreva o vídeo como "a campanha do Flamengo"**: ele desenha a divisão inteira,
e prometer um clube entrega vinte.

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados. A lista abaixo usa 222, medidos com as
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
> contra esta página. **O 1º lugar é o mais perecível de todos** — o corte de
> torcedor é o mesmo vídeo com o Flamengo em 14º, e aí metade destas linhas está
> errada.

---

## Título

Recomendado (78 caracteres):

```
Do 15º à liderança: a corrida do Flamengo no Brasileirão 2026, rodada a rodada
```

Abre pelo trajeto e não pelo lugar de chegada, que é o que o torcedor já sabe —
e **data o recorte** pelo ano, a única defesa contra alguém assistir daqui a três
meses e achar que os números estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `A corrida do Flamengo no Brasileirão 2026: 28 rodadas em 30 segundos` | 68 | o formato e a duração; ajuda a retenção |
| 3 | `17 rodadas em 2º: a subida do Flamengo ao topo do Brasileirão 2026` | 66 | a espera, que é a parte da campanha que o torcedor viveu |
| 4 | `Flamengo x Palmeiras pela ponta: a corrida do Brasileirão 2026 em barras` | 72 | a disputa; nomeia o rival, que é o que move comentário |

### Para o Short (9:16)

Recomendado (51 caracteres). Um Short é lido numa linha e no meio de um feed,
então ele abre pelo clube e pelo formato:

```
A corrida do Flamengo no Brasileirão em 30s #Shorts
```

## Descrição

```
O Flamengo rodada a rodada contra os outros dezenove: a barra vermelha é a dele, o comprimento são os pontos e a altura é a colocação — então dá para acompanhar uma ultrapassagem como movimento, e não como duas curvas se cruzando.

Dados até 21/09/2026 (28ª rodada):
• Flamengo — 1º, 60 pontos em 28 jogos
• Começou a 2ª rodada em 15º, com 1 ponto
• Ficou 13 rodadas seguidas em 2º, da 10ª à 22ª
• Assumiu a ponta na 26ª e fechou a 28ª na frente
• Palmeiras — 2º, 57 pontos, depois de liderar 19 rodadas

A virada está perto do fim: o Palmeiras fechou em 1º em 19 das 28 rodadas, e perde a ponta por 1 ponto na 26ª.

O desenho é a divisão inteira e não só o Flamengo — o que muda neste corte é que a linha dele fica marcada em todo quadro, inclusive nas rodadas em que está no meio da tabela, que é exatamente quando ninguém acha o próprio time num gráfico de vinte barras.

Por que o eixo dos pontos NÃO se reescala a cada rodada, que é o contrário do que quase toda corrida de barras faz: reescalando, as barras ficam sempre compridas e um clube pode subir no desenho estando parado. Com o eixo fixo, uma barra que cresce é um clube que pontuou, e duas rodadas quaisquer do vídeo podem ser comparadas entre si. O preço é que a 1ª rodada são vinte tocos — que é o que a 1ª rodada é.

Os filetes marcam o G4 e o Z4. Nem todos os clubes têm o mesmo número de jogos neste recorte, e por isso a linha do fecho diz sobre quantos jogos o Flamengo chegou aos 60.

Nenhum número foi digitado à mão. A animação lê o mesmo histórico de classificação que alimenta o Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.
```

## Tags

222 caracteres com os separadores, como coladas:

```
flamengo, mengão, brasileirão, brasileirão 2026, série a, campeonato brasileiro, classificação, tabela do brasileirão, corrida de barras, bar chart race, visualização de dados, palmeiras, futebol brasileiro, manim, dataviz
```

## Onde cada arquivo vai

| arquivo | onde | por quê |
|---|---|---|
| `barras-flamengo.mp4` | YouTube (vídeo normal) | 16:9, o corte de sempre |
| `barras-flamengo-916.mp4` | YouTube Short · Instagram Reels | 9:16; o crédito fica abaixo da linha segura de propósito, então a legenda do post precisa repetir o endereço do site |
| `barras-flamengo-45.mp4` | Instagram (feed) | 4:5; o feed não sobrepõe nada, então cabe o desenho inteiro |
| `barras-flamengo.gif` | Reddit · README · issue · chat | toca sozinho onde não há player; ver `docs/post-reddit.md` |
| `barras-flamengo-miniatura.png` | capa do YouTube | a divisão com a linha do Flamengo marcada — a capa que diz de quem é o corte |
| `barras-flamengo-miniatura-60-pontos.png` | capa alternativa | a história: o clube, os pontos e a margem |

**A capa alternativa está hoje byte a byte igual à do `barras-20-clubes`, e isso
não é um arquivo duplicado por engano.** Ela estampa o *sujeito do corte*, que é
o Flamengo, e a do vídeo base estampa o *líder* — e hoje são o mesmo clube. As
duas se separam sozinhas na rodada em que o Flamengo não estiver em 1º, que é o
mesmo motivo pelo qual a nota de fecho da cena troca de sujeito.

## Como refazer

```sh
npx tsx scripts/manim/export-pontos.ts > scripts/manim/pontos.json
BARRAS_FOCUS=1783                   ./.venv-manim/bin/manim -qh scripts/manim/barras.py Barras
BARRAS_FOCUS=1783 BARRAS_ASPECT=4:5  ./.venv-manim/bin/manim -qh scripts/manim/barras.py Barras
BARRAS_FOCUS=1783 BARRAS_ASPECT=9:16 ./.venv-manim/bin/manim -qh scripts/manim/barras.py Barras
npx tsx scripts/manim/thumbnail-barras.ts --focus 1783
```

**Copie cada corte antes de renderizar o próximo**, e note que aqui o atropelo é
pior do que no vídeo base: o corte com foco e o sem foco escrevem **o mesmo**
`media/videos/barras/1080p60/Barras.mp4`, então renderizar os dois em sequência
e copiar depois põe um deles nos dois arquivos, com os nomes certos e nada para
acusar.
