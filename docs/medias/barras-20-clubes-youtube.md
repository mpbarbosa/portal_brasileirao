# YouTube — a corrida das barras, os 20 clubes

Texto que acompanha [`barras-20-clubes.mp4`](barras-20-clubes.mp4)
(1920×1080, 60fps, 21s), os dois cortes verticais e as duas capas ao lado dele.

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados. A lista abaixo usa 237, medidos com as
  vírgulas e os espaços exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 21s não comporta.
- **O corte 9:16 serve o Short E o Reels**, e é o mesmo arquivo. O Short entra
  como upload separado, com o título curto abaixo — a descrição longa não é lida
  ali.

> **Os números aqui saem de `scripts/manim/pontos.json`, rodada 26, snapshot de
> 2026-09-07.** Eles **envelhecem**: um `sync-seed-data` seguido de
> `sync-rank-history` e uma reexportação movem o vídeo e as capas, e este arquivo
> não é regerado por nada. Reconferir antes de publicar, contra o JSON e não
> contra esta página.

---

## Título

Recomendado (70 caracteres):

```
A corrida do Brasileirão 2026: 26 rodadas em 21 segundos, os 20 clubes
```

Diz o formato, **data o recorte** — a única defesa contra alguém assistir daqui
a três meses e achar que os números estão errados — e promete a duração, que
ajuda a retenção.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `O Flamengo ultrapassa o Palmeiras na 26ª: a corrida de barras do Brasileirão` | 76 | a virada, que acontece na última barra do vídeo |
| 3 | `Do 2º ao 20º: a queda da Chapecoense no Brasileirão 2026, rodada a rodada` | 73 | a queda; a Chapecoense fecha a 2ª rodada em 2º e a 26ª em 20º |
| 4 | `Corrida de barras: os 20 clubes do Brasileirão rodada a rodada (até a 26ª)` | 74 | nomeia o formato, que é o que se busca no YouTube |

### Para o Short (9:16)

Recomendado (59 caracteres). Um Short é lido numa linha e no meio de um
feed, então ele abre pelo formato e não pelo campeonato:

```
A corrida do Brasileirão: 26 rodadas em 21 segundos #Shorts
```

## Descrição

```
Os 20 clubes do Brasileirão Série A, rodada a rodada: o comprimento da barra são os pontos e a altura é a colocação, então ultrapassar é um movimento e não duas curvas se cruzando.

Dados até 07/09/2026 (26ª rodada):
• Flamengo — 1º, 54 pts em 26 jogos
• Palmeiras — 2º, 53 pts, depois de liderar 19 rodadas
• Chapecoense — 20º, 17 pts, tendo fechado a 2ª rodada em 2º
• Cruzeiro — 6º, 42 pts, tendo passado pelo 20º

A ultrapassagem está na última barra: o Palmeiras fechou em 1º em 19 das 26 rodadas, 15 delas seguidas, e perde a ponta por 1 ponto na 26ª.

Por que o eixo dos pontos NÃO se reescala a cada rodada, que é o contrário do que quase toda corrida de barras faz: reescalando, as barras ficam sempre compridas e um clube pode subir no desenho estando parado. Com o eixo fixo, uma barra que cresce é um clube que pontuou, e duas rodadas quaisquer do vídeo podem ser comparadas entre si. O preço é que a 1ª rodada são vinte tocos — que é o que a 1ª rodada é.

Os filetes marcam o G4 e o Z4. Nem todos os clubes têm o mesmo número de jogos neste recorte, e por isso a linha do fecho diz sobre quantos jogos o líder chegou aos 54.

Nenhum número foi digitado à mão. A animação lê o mesmo histórico de classificação que alimenta o Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.
```

## Tags

237 caracteres com os separadores, como coladas:

```
brasileirão, brasileirão 2026, série a, campeonato brasileiro, classificação, tabela do brasileirão, corrida de barras, bar chart race, visualização de dados, flamengo, palmeiras, cruzeiro, chapecoense, futebol brasileiro, manim, dataviz
```

## Onde cada arquivo vai

| arquivo | onde | por quê |
|---|---|---|
| `barras-20-clubes.mp4` | YouTube (vídeo normal) | 16:9, o corte de sempre |
| `barras-20-clubes-916.mp4` | YouTube Short · Instagram Reels | 9:16; o crédito fica abaixo da linha segura de propósito, então a legenda do post precisa repetir o endereço do site |
| `barras-20-clubes-45.mp4` | Instagram (feed) | 4:5; o feed não sobrepõe nada, então cabe o desenho inteiro |
| `barras-20-clubes.gif` | Reddit · README · issue · chat | toca sozinho onde não há player; ver `docs/post-reddit.md` |
| `barras-20-clubes-miniatura.png` | capa do YouTube | a divisão, oito barras |
| `barras-20-clubes-miniatura-54-pontos.png` | capa alternativa | a história: quem lidera e por quanto |
