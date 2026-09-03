# Animações em Manim

Uma cena: **`campanhas.py`**, a campanha de dois clubes rodada a rodada — a
posição desenhada como linha sobre a divisão inteira, e ao lado o jogo daquela
rodada com o resultado.

## Como gerar

O Manim **não** é dependência deste repositório e não entra no `package.json`.
Ele vive num virtualenv à parte, porque nada no app o executa: é uma ferramenta
de quem faz o vídeo, não do servidor.

```sh
python3 -m venv .venv-manim
./.venv-manim/bin/pip install manim
```

Os dados saem do próprio seed do app, nunca digitados à mão:

```sh
npx tsx scripts/manim/export-campanhas.ts > scripts/manim/campanhas.json
./.venv-manim/bin/manim -qh scripts/manim/campanhas.py Campanhas
```

`export-campanhas.ts` aceita dois códigos de clube (`1769` Palmeiras, `1783`
Flamengo são o padrão) — são os **códigos numéricos do provedor**, nunca a
`tla`, pela razão que o CLAUDE.md registra: Corinthians e Coritiba compartilham
`COR`.

O vídeo sai em `media/videos/campanhas/1080p60/Campanhas.mp4`. `-ql` (480p15)
renderiza em segundos e serve para conferir o enquadramento.

## O render commitado

**`docs/videos/campanhas-palmeiras-flamengo.mp4`** — 1920×1080, 60fps, 23s,
3,3 MB — é o vídeo pronto, versionado junto do resto do projeto como os slides
em `docs/carrossel/` e as capturas em `docs/screenshots/`.

Ele é **regenerável** pelos dois comandos acima, e mesmo assim está commitado
pela razão que o `og-default.png` já registra: um artefato de divulgação precisa
existir para quem clona o repositório sem instalar o Manim. `media/` continua
ignorado — é a árvore de trabalho do Manim, cujo caminho muda com a flag de
qualidade; o entregável tem nome e lugar próprios.

**Regerar é um commit deliberado.** Nada compara os bytes: o vídeo não passa por
nenhum gate, e o `docs/screenshots` guard não olha para ele. Se os dados
mudarem — um `sync-seed-data` seguido de `sync-rank-history` — o mp4 commitado
descreve a temporada anterior e continua verde. O subtítulo do próprio vídeo diz
até que data os dados vão, que é a única defesa que ele tem.

## As miniaturas

**`docs/videos/campanhas-palmeiras-flamengo-miniatura.png`** e
**`-miniatura-11-ao-1.png`** — 1280×720, as capas que o YouTube mostra no lugar
de um frame qualquer da animação (os primeiros segundos são um gráfico vazio).
Uma nomeia o confronto, a outra a história; a segunda envelhece mal de
propósito, porque `1º` é uma afirmação sobre a rodada 25 em tipo de 96px.

```sh
npx tsx scripts/manim/thumbnail.ts                     # as duas
npx tsx scripts/manim/thumbnail.ts --variant fixture   # só uma
```

**Não precisa do Manim** — só do Chromium que o Playwright já traz — e é por
isso que este script pode viver no `package.json` do projeto onde a cena não
pode. Ele lê o **mesmo `campanhas.json`**, então as linhas, as posições da
manchete, a contagem de rodadas e os chips saem todos dos dados: uma reexportação
move a capa e o vídeo juntos. O nome do arquivo da segunda é construído a partir
dos próprios números que ela imprime, de modo que não pode se chamar `11-ao-1` e
dizer outra coisa.

**A paleta é lida de `campanhas.py`**, como `generate-og-image.ts` lê a sua de
`src/index.css` — uma segunda cópia de uma cor à mão é como a capa acaba um tom
fora do vídeo que ela anuncia. Uma constante renomeada quebra o run em vez de
desenhar em preto.

Regerar é um commit deliberado, como o mp4: nada compara os bytes.

## O que é decisão e o que é mecânica

- **O JSON é gerado, não editado.** `rank-history.ts` e `matches.ts` são a
  fonte; a cena não recalcula nenhuma classificação. Um número errado aqui está
  errado no site também — que é exatamente o que se quer de uma peça de
  divulgação.
- **O eixo y é a divisão inteira, 1º no topo.** É a regra do
  `rank-candles-core.ts`: a campanha de um líder deixa dois terços do desenho
  vazios, e é isso que dá sentido às faixas do G4 e do Z4. Uma escala por clube
  faria quem oscila entre 1º e 3º parecer quem sobe do 20º.
- **A moldura é desenhada à mão, sem `Axes`.** O Manim desenha a linha do eixo x
  em y=0 nas coordenadas dos dados; como a posição é plotada negada (para o 1º
  ficar no topo), o zero cai **fora** do intervalo e o eixo — com ponta de seta —
  é desenhado rente ao topo, atravessando a linha do líder. `at()` é todo o
  sistema de coordenadas, e a convenção de sinal está escrita uma vez só.
- **A troca dos cards é sequenciada, nunca simultânea.** `self.play(...,
  run_time=…)` estica **toda** animação que recebe até o fim do compasso, então
  um `FadeOut` e um `FadeIn` passados lado a lado se sobrepõem o tempo inteiro e
  os dois placares da rodada ficam legíveis ao mesmo tempo. `Succession` é o que
  resolve.
- **Uma rodada sem jogo é uma ausência, não um 0 × 0.** Flamengo não tem partida
  encerrada na rodada 4 no snapshot; o card diz "sem jogo nesta rodada" e a linha
  segue, porque a posição existe de qualquer modo.
- **O resumo final fica dentro da área vazia do gráfico**, não ao fim de cada
  linha: em 1º e 2º as duas linhas terminam a poucos pixels uma da outra, e uma
  etiqueta ao lado de cada uma se sobrepõe à vizinha e à coluna de cards.
