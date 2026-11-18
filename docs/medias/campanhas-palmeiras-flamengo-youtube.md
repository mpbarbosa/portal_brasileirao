# YouTube — campanhas Palmeiras × Flamengo

Texto que acompanha [`campanhas-palmeiras-flamengo.mp4`](campanhas-palmeiras-flamengo.mp4)
(1920×1080, 60fps, 29s) e as duas capas ao lado dele.

- **Título:** até 100 caracteres. Os títulos abaixo trazem a contagem medida.
- **Descrição:** até 5.000 caracteres, mas só as duas primeiras linhas aparecem
  antes do "mostrar mais" — a abertura precisa se sustentar sozinha.
- **Tags:** até 500 caracteres somados. A lista abaixo usa 271, medidos com as
  vírgulas e os espaços exatamente como estão no bloco.
- **Sem capítulos:** o YouTube exige pelo menos três, o primeiro em 00:00 e cada
  um com 10s. Um vídeo de 29s não comporta.

> **Os números aqui saem de `scripts/manim/campanhas.json`, rodada 35, snapshot
> de 2026-11-18** — 1º com 76 pts e 2º com 73, os dois em 34 jogos: da 35ª só um
> jogo foi disputado até o snapshot (Mirassol 0x0 Atlético-MG), e os cards do
> fecho dizem «sem jogo nesta rodada» para os dois. Eles **envelhecem**: um
> `sync-seed-data` seguido de `sync-rank-history` e uma reexportação movem o
> vídeo e as capas, e este arquivo não é regerado por nada. Reconferir antes de
> publicar, contra o JSON e não contra esta página.

---

## Título

Recomendado (80 caracteres):

```
Palmeiras × Flamengo: a campanha rodada a rodada do Brasileirão 2026 (até a 35ª)
```

Abre com os dois nomes que as pessoas buscam, diz o que o vídeo é e **data o
recorte** — que é a única defesa contra alguém assistir daqui a três meses e
achar que os números estão errados.

| | título | caracteres | ângulo |
|---|---|---|---|
| 2 | `O Flamengo assume a ponta na 26ª e a defende até a 34ª \| as duas campanhas` | 74 | a virada, que é o que a 26ª rodada fez, e que ela se sustentou por nove |
| 3 | `Palmeiras liderou 19 rodadas e perdeu a ponta \| Brasileirão 2026` | 64 | o mesmo fato pelo outro lado; envelhece na próxima rodada |
| 4 | `Palmeiras × Flamengo: 35 rodadas em 29 segundos \| Brasileirão Série A` | 69 | promete a duração, bom para retenção |

Manter o `×` (U+00D7) e não o `x`: é como o vídeo escreve na tela e como a
imprensa esportiva grafa confrontos.

## Descrição

```
Palmeiras × Flamengo: a campanha rodada a rodada do Brasileirão Série A, desenhada como linha sobre a divisão inteira — 1º no topo, 20º embaixo, com as faixas do G4 e do Z4 ao fundo. A cada rodada, o card ao lado mostra o jogo que moveu a linha: adversário, mando e placar.

Dados até 18/11/2026 (35ª rodada, que nenhum dos dois ainda jogou — são 34 jogos cada):
• Flamengo — 1º, 76 pts, 23V 7E 4D
• Palmeiras — 2º, 73 pts, 21V 10E 3D

O Palmeiras fechou em 1º em 19 das 34 rodadas que jogou — 15 delas seguidas —, chegou a perder a ponta por uma rodada na 23ª (empatados em pontos, o critério de desempate deu ao Flamengo) e a retomou na 24ª. É na 26ª que o Flamengo assume de vez, por um ponto, e segue na frente até o fim da 34ª, a última que os dois jogaram — agora por três pontos, depois de nove rodadas na ponta. Até ali são duas campanhas de formatos opostos: a do Palmeiras é uma reta colada no topo, com oscilação do 1º ao 3º depois das duas primeiras rodadas; a do Flamengo desce até o 15º antes de subir.

Por que o eixo é a divisão inteira e não a faixa onde os dois clubes andaram: uma escala por clube faz quem oscila entre 1º e 3º parecer quem sobe do 20º. Com os 20 lugares sempre à vista, a campanha do líder deixa dois terços do desenho vazios — e é isso que dá sentido às faixas.

Nenhum número foi digitado à mão. A animação lê o mesmo histórico de classificação que alimenta o Portal Brasileirão, então um valor errado aqui estaria errado no site também.

🔗 Portal Brasileirão (ao vivo): https://brasileirao.mpbarbosa.com
💻 Código aberto, incluindo a cena em Manim: https://github.com/mpbarbosa/portal_brasileirao

Feito com Manim (Python) · 1920×1080 60fps · app em React 19 + TypeScript + Express, publicado na AWS.
```

## Tags

271 caracteres com os separadores, como coladas:

```
brasileirão, brasileirao 2026, campeonato brasileiro, série a, palmeiras, flamengo, verdão, mengão, palmeiras x flamengo, campanha rodada a rodada, classificação brasileirão, futebol brasileiro, visualização de dados, dataviz, manim, python, portal brasileirão, rodada 35
```
