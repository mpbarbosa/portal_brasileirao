"""
Uma campanha lida como VELA: UM clube, rodada a rodada.

    manim -qh scripts/manim/velas.py Velas

    VELAS_JSON=$PWD/scripts/manim/velas-athletico-pr.json \
      manim -qh scripts/manim/velas.py Velas

As duas cenas irmãs desenham a campanha como **linha** — `campanhas.py` a
posição de dois clubes, `pontos.py` os pontos dos vinte. Uma linha liga a
posição do FIM de cada rodada, então a rodada é um ponto e o que aconteceu
dentro dela é invisível: quem sentou em 4º no sábado e terminou em 9º porque
três rivais jogaram no domingo desenha o mesmo segmento de quem desceu andando.
A vela separa os dois fatos, e é o argumento do `rank-candles-core.ts` — não um
novo.

O JSON é `scripts/manim/velas.json`, escrito por `export-velas.ts`, e
`VELAS_JSON` aponta para outro. **Um clube por run é a cena inteira**: quem ela
desenha, como ela se chama e de que temporada ela fala saem todos do payload —
o único acoplamento no sentido contrário é o `CLUB_COLOURS` abaixo, que é uma
tabela e não um caso especial. Um segundo clube é um segundo payload ao lado do
primeiro, nunca um `velas.json` sobrescrito: o `velas.json` é a fonte de um mp4
já commitado.

**Nada aqui calcula uma vela**: `computeRankCandles` é a única implementação, a
mesma que o Painel do site serve. Um número errado neste vídeo está errado no
site também.

O que vale a pena saber antes de mexer:

- **A cor carrega o RESULTADO e a geometria carrega a DIREÇÃO**, e é de
  propósito que não são o mesmo canal: as rodadas que valem a pena olhar são
  aquelas em que os dois discordam, e um clube vencer e mesmo assim cair uma
  posição é um domingo comum. É por isso que o corpo precisa de uma terceira
  marca dizendo por qual ponta ele abriu — o toco à esquerda. Vinte e cinco
  tocos traçam a mesma linha que o `campanhas.py` desenha, porque cada rodada
  abre onde a anterior fechou.
- **O eixo y é a divisão inteira, 1º no topo.** Regra do `rank-candles-core.ts`:
  a campanha de quem briga em cima deixa dois terços do desenho vazios, e é isso
  que dá sentido às faixas do G4 e do Z4. Uma escala por clube faria quem oscila
  entre 2º e 5º parecer quem sobe do 20º.
- **O pavio da rodada 1 é largo para todo mundo**, e não é defeito: antes do
  primeiro jogo os clubes empatados em nada são ordenados por nome, e a tabela
  realmente mostrou o clube ali. A alternativa é um caso especial que esconde uma
  rodada de dado real.
- **O painel de pontos começa no ZERO e a barra é o total, não o ganho.** Pontos
  são cumulativos: a altura é a temporada inteira e a **tampa** clara é o que a
  rodada acrescentou. Uma derrota não acrescenta nada, então a barra não cresce —
  que é a leitura honesta, e é justamente o que a vela ao lado mostra por outro
  canal.
- **Uma rodada sem jogo é uma ausência, não um 0 × 0**: o corpo fica vazado (só
  contorno) em vez de pintado de cinza, porque um cinza ao lado do cinza do
  empate são dois cinzas num traço de poucos pixels. É a mesma escolha do
  `RankCandles` no site.
- **A moldura é desenhada à mão, sem `Axes`**, pela razão do `campanhas.py`:
  `at_pos()` e `at_pts()` são todo o sistema de coordenadas, e a convenção de
  sinal está escrita uma vez só.
- **Todo texto passa por `label()`**, também pela razão do `campanhas.py`: os
  avanços de glifo do Manim arredondam para o pixel, e abaixo de ~20pt o avanço
  do espaço vira zero e as palavras grudam. Esta cena desenha quase tudo abaixo
  disso.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    Create,
    FadeIn,
    FadeOut,
    GrowFromEdge,
    Line,
    Rectangle,
    RoundedRectangle,
    Scene,
    Succession,
    Text,
    VGroup,
)

DATA = Path(os.environ.get("VELAS_JSON", Path(__file__).with_name("velas.json")))

FONT = "Inter"
TYPE_OVERSAMPLE = 4

INK = "#E6EAE8"
INK_SOFT = "#9AA5A0"
# **`INK_FAINT` é para RÉGUA, nunca para TEXTO**, e isso foi medido no quadro
# codificado e não deduzido da paleta. Sobre o `SURFACE` ele entrega 3,2:1 e
# sobre o `CARD` 2,9:1 — abaixo do piso de 4,5 que este projeto exige de texto,
# e num tipo de 18px que um leitor vê num celular. Os tiques do painel de baixo
# nasceram assim e ficavam visivelmente mais apagados que os `1º … 20º` logo
# acima deles, que são `INK_SOFT`: o mesmo papel, dois tokens. Régua e grade
# continuam aqui, que é o que este tom serve para fazer.
INK_FAINT = "#5C6763"
SURFACE = "#0B100E"
CARD = "#161F1B"
POSITIVE = "#2ECC71"
WARNING = "#E8B931"
NEGATIVE = "#E5533D"

# O grená do Fluminense é o mesmo tom que o `pontos.py` já dá a ele: a paleta
# daquela cena é distinguível primeiro e fiel ao clube em segundo, e repetir o
# tom aqui é o que impede dois vídeos do mesmo projeto de discordarem sobre a
# cor de um clube. Um clube sem entrada cai no cinza, que é uma ausência
# visível e não um chute.
CLUB_COLOURS = {
    "1765": "#B0455F",  # Fluminense    grená
    "1768": "#FF9C3D",  # Athletico-PR  laranja
    "1769": "#1FBF6B",  # Palmeiras     verde
    "1783": "#E5453A",  # Flamengo      vermelho
    "1779": "#D7DDE0",  # Corinthians   cinza-claro
    "1777": "#35BCD6",  # Bahia         ciano
    "1771": "#4C7DF0",  # Cruzeiro      azul
    "1776": "#FFC4B0",  # São Paulo     salmão
    "1766": "#6E8894",  # Atlético-MG   cinza-azul
    "1770": "#98A3A8",  # Botafogo      cinza
    "4286": "#E058B8",  # Bragantino    magenta
}
FALLBACK_COLOUR = "#9AA5A0"


# O tom de um clube não pode virar tinta sem passar por aqui, e isto é a lição do
# `INK_FAINT` logo acima repetida um tom adiante: sobre este fundo quase preto o
# grená do Fluminense entrega **3,13:1 como TEXTO** no painel de resumo, contra o
# piso de 4,5 do projeto. Nada nesta cena mede isso sozinho — a paleta é escrita
# à mão e o `test:tokens` não olha para ela —, então a medida vira código.
#
# **A subida é de VALOR, nunca uma lavagem no branco.** Multiplicar os três
# canais até o maior chegar a 255 preserva matiz e saturação EXATAMENTE; clarear
# em direção ao branco dessatura, e um grená dessaturado deixa de ser a cor do
# clube — que é justamente o que o `CLUB_COLOURS` acima existe para não deixar
# acontecer. Por isso o valor vem primeiro e o branco só entra quando o valor
# esgota.
#
# **Ela sobe só até o piso que a aperta**, então quase todo mundo passa intacto:
# medido sobre a paleta inteira do `pontos.py` e não sobre os seis daqui, no
# contorno **19 dos 20 não mudam nada** e no texto do painel **12 dos 20**.
# O `CLUB_COLOURS` continua sendo a fonte: nada aqui reescreve a paleta, então o
# `pontos.py` não é tocado e os vídeos já publicados continuam concordando com
# esta cena sobre a cor de cada clube.
def _channels(colour: str) -> tuple[float, float, float]:
    value = colour.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def _hex(channels) -> str:
    return "#" + "".join(f"{max(0, min(255, round(v))):02X}" for v in channels)


def _luminance(channels) -> float:
    total = 0.0
    for value, weight in zip(channels, (0.2126, 0.7152, 0.0722)):
        c = value / 255.0
        total += weight * (c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return total


def _contrast(a, b) -> float:
    la, lb = _luminance(a), _luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def _over(colour: str, opacity: float, ground: str) -> str:
    """O que o olho recebe quando `colour` é pintado com alfa sobre `ground`."""
    return _hex(
        opacity * a + (1 - opacity) * b
        for a, b in zip(_channels(colour), _channels(ground))
    )


def lift_to_floor(colour: str, ground: str, floor: float) -> str:
    """O mesmo tom, subido só até passar de `floor` sobre `ground`.

    Valor primeiro, branco só se o valor não bastar. A ordem é a decisão: subir
    o valor preserva matiz e saturação EXATAMENTE, e lavar no branco dessatura —
    então a lavagem é o último recurso e não o primeiro. Medido sobre os vinte
    do `pontos.py` no piso de TEXTO: oito sobem, e só Cruzeiro, Flamengo e Remo
    chegam a precisar de lavagem — de poucos por cento. No piso de MARCA, que é
    mais baixo, sobe só o Fluminense e ninguém lava.
    """
    ground_channels = _channels(ground)
    channels = _channels(colour)
    if _contrast(channels, ground_channels) >= floor:
        return colour

    ceiling = 255.0 / max(max(channels), 1)
    if _contrast(tuple(v * ceiling for v in channels), ground_channels) >= floor:
        low, high = 1.0, ceiling
        for _ in range(40):
            middle = (low + high) / 2
            if _contrast(tuple(v * middle for v in channels), ground_channels) >= floor:
                high = middle
            else:
                low = middle
        return _hex(v * high for v in channels)

    # O valor esgotou. Devolver o tom CRU aqui seria jogar fora a subida que já
    # se conseguiu — pior que lavar, e não mais honesto —, então a lavagem entra.
    channels = tuple(v * ceiling for v in channels)
    low, high = 0.0, 1.0
    for _ in range(40):
        middle = (low + high) / 2
        washed = tuple(middle * 255 + (1 - middle) * v for v in channels)
        if _contrast(washed, ground_channels) >= floor:
            high = middle
        else:
            low = middle
    return _hex(high * 255 + (1 - high) * v for v in channels)


# O fundo real do texto do painel de resumo, que não é o `CARD` nem o `SURFACE`:
# o painel é o `CARD` a 94% sobre o fundo da cena. Medir contra o `CARD` puro
# daria um número otimista sobre uma cor que não existe em pixel nenhum.
SUMMARY_GROUND = _over(CARD, 0.94, SURFACE)

# **O alvo não é o piso, porque o h.264 come um pouco do tom no caminho — e a
# perda foi ISOLADA, não estimada de um quadro qualquer.**
#
# A versão anterior desta margem valia 1,30 e dizia "~18% de perda do tipo a 4×
# mais h.264". **Estava errada, e o erro era de mira:** todas aquelas leituras
# saíram de **t=18s**, um segundo dentro do fade com que o painel de resumo
# entra. Ele só assenta em **t=19** e daí até o fim do vídeo é estático:
#
#     t=        17         18      19      19,5    20     20,6   21
#     texto     sem tinta  4,81  **6,11**  6,11   6,11   6,11   6,11
#
# Ou seja o que foi medido como perda do encoder era, quase todo, a opacidade da
# animação. **As BARRAS não têm fade** e por isso os números de marca do #384
# estavam certos o tempo todo.
#
# **O método que isola a perda de verdade é comparar o PNG que o manim escreve
# (`manim -qh -s`, antes de qualquer compressão) com o quadro do mp4 nas MESMAS
# coordenadas.** Registro perfeito, nenhuma mira a errar, e separa o h.264 do
# antialiasing do tipo desenhado a 4× — duas coisas que toda leitura anterior
# aqui somava. Medido assim, no quadro final, entregue/modelado:
#
#     clube          texto   marca        clube          texto   marca
#     Fluminense     0,961   0,955        Cruzeiro       0,976   0,954
#     Athletico-PR   0,957   0,964        Palmeiras      0,898   0,905
#     Bahia          0,927   0,934
#
# A pior perda é **10,2%** (Palmeiras), não 18% — e o verde perde mais que o
# grená porque o canal verde carrega 0,7152 da luminância, então o subamostrado
# de croma do 4:2:0 bate onde mais dói. Entre os clubes que a subida realmente
# PRENDE no alvo a perda é menor ainda (0,961 e 0,976), mas a margem é dimensionada
# pela pior de todas, que é a leitura conservadora.
#
# **1,15 cobre 1,114 com folga, e o número tem um segundo motivo que vale mais
# que o primeiro: abaixo de 1,177 NENHUM clube da divisão precisa de subida na
# MARCA.** O tom cru do Fluminense — o pior dos vinte sobre o `SURFACE` — entrega
# 3,53 modelado, e 3,0 × 1,177 é exatamente onde ele deixaria de bastar. Então o
# contorno da barra é sempre a cor registrada do clube, e a cena perde um tom
# derivado inteiro em vez de carregar dois.
#
# O `MARK_FLOOR` fica: ele é o piso que pegaria um clube mais escuro que o
# Fluminense, e `lift_to_floor` continua exercitada pelo caminho do TEXTO, que
# prende sete dos vinte. O que não é exercitado hoje é a APLICAÇÃO dela à marca —
# vale saber antes de ler o `self.mark` abaixo como código morto.
#
# **A margem é um ponto de partida e nunca a prova**: o valor entregue é
# reconferido no quadro **t>=19** depois de cada render, com o `-ss 21` que a
# capa já usa.
#
# **Cada marca sobe até o piso QUE VALE PARA ELA, sobre o fundo em que ELA se
# apoia.** Texto na cena tem piso 4,5 e o do painel se apoia no `SUMMARY_GROUND`;
# uma marca gráfica tem piso 3 e o contorno da barra se apoia no `SURFACE`, que é
# mais escuro. Subir o contorno até o piso de TEXTO dava ao Fluminense uma borda
# `#FB6287`, um rosa que não é mais o grená do clube.
TEXT_FLOOR = 4.5
MARK_FLOOR = 3.0
ENCODED_MARGIN = 1.15

RESULT_WORD = {"V": "Vitória", "E": "Empate", "D": "Derrota"}
RESULT_COLOUR = {"V": POSITIVE, "E": WARNING, "D": NEGATIVE}

CLUBS_IN_DIVISION = 20
NAMED_POSITIONS = (1, 4, 8, 12, 16, 20)

# As duas caixas, em unidades de cena. Tudo dentro delas passa por `at_pos()` e
# `at_pts()`; elas compartilham o eixo x de propósito, porque as duas leituras
# são da mesma rodada e ler uma contra a outra é metade do desenho.
PLOT_LEFT, PLOT_RIGHT = -6.30, 1.30
POS_TOP, POS_BOTTOM = 2.86, -0.30
PTS_TOP, PTS_BOTTOM = -0.95, -2.35

BODY_WIDTH = 0.19
BAR_WIDTH = 0.19
# Um corpo de altura zero — abriu e fechou no mesmo lugar — ainda é uma rodada
# que aconteceu, então ele vira um traço em vez de sumir. O mesmo raciocínio da
# barra de última colocação no `sparklineBars`: nada se lê como falha de
# renderização, não como o fato.
MIN_BODY = 0.035

CARD_X = 4.52
CARD_WIDTH = 5.05

# O endereço do site, para um vídeo que sai daqui e é visto em outro lugar.
# Escrito sem o esquema porque é assim que se lê e se digita um endereço, e
# escrito à mão porque o `APP_URL` mora no `.env` do host — que é gitignored e
# não existe na estação onde a cena é desenhada. Uma origem errada aqui é uma
# origem errada em todo lugar, então ela é a mesma que o `docs/` já publica.
SITE = "brasileirao.mpbarbosa.com"


def label(text: str, size: float, colour: str, weight: str = "NORMAL") -> Text:
    """Uma linha de tipo, desenhada grande e reduzida. Ver o docstring do módulo."""
    return Text(
        text,
        font=FONT,
        font_size=size * TYPE_OVERSAMPLE,
        color=colour,
        weight=weight,
    ).scale(1 / TYPE_OVERSAMPLE)


def ordinal(position: int) -> str:
    return f"{position}º"


class Velas(Scene):
    def construct(self) -> None:
        self.camera.background_color = SURFACE

        payload = json.loads(DATA.read_text(encoding="utf-8"))
        club = payload["club"]
        rounds = payload["rounds"]
        self.colour = CLUB_COLOURS.get(club["code"], FALLBACK_COLOUR)
        # Duas derivações porque são dois pisos sobre dois fundos, não porque a
        # cena queira duas cores. A massa da barra continua no tom CRU: é a área
        # grande, e é onde a cor registrada do clube tem que aparecer.
        self.mark = lift_to_floor(self.colour, SURFACE, MARK_FLOOR * ENCODED_MARGIN)
        self.ink = lift_to_floor(self.colour, SUMMARY_GROUND, TEXT_FLOOR * ENCODED_MARGIN)
        self.last_round = max(entry["round"] for entry in rounds)
        # O teto do eixo de pontos é o próximo múltiplo de dez acima do total —
        # calculado, nunca escrito à mão, senão uma reexportação mais adiante na
        # temporada desenha barras saindo pela borda de cima.
        self.points_ceiling = max(10, ((rounds[-1]["totalPoints"] // 10) + 1) * 10)

        title = label(club["name"], 40, INK, "BOLD").move_to([-2.6, 3.62, 0])
        subtitle = label(
            "campanha rodada a rodada, em velas · Brasileirão Série A · "
            f"dados até {payload['snapshot']}",
            16,
            INK_SOFT,
        )
        subtitle.next_to(title, DOWN, buff=0.15)
        self.play(FadeIn(title, shift=DOWN * 0.18), FadeIn(subtitle), run_time=0.9)

        frames, grid, labels = self.build_frames()
        bands, band_captions = self.build_bands()
        self.play(Create(frames), FadeIn(grid), FadeIn(labels), run_time=1.0)
        self.play(FadeIn(bands), FadeIn(band_captions), run_time=0.45)

        key = self.build_key()
        # O crédito entra junto com a chave e fica o vídeo inteiro: um quadro
        # qualquer que alguém recorte tem de carregar de onde ele veio.
        self.play(FadeIn(key), FadeIn(self.build_credit()), run_time=0.45)

        marker = Line(
            [self.at_pos(1, 0.5)[0], POS_TOP, 0],
            [self.at_pos(1, 0.5)[0], PTS_BOTTOM, 0],
            stroke_color=INK,
            stroke_width=1.4,
            stroke_opacity=0.30,
        )
        self.play(FadeIn(marker), run_time=0.3)

        # Rodada a rodada. Cada rodada é um compasso: a vela nasce, a barra de
        # pontos cresce e os dois cards são trocados pela rodada que descrevem.
        heading = None
        match_card = None
        reading_card = None
        previous_total = 0

        for index, entry in enumerate(rounds):
            animations = []

            candle = self.build_candle(entry)
            animations.append(Create(candle))
            animations.append(GrowFromEdge(self.build_bar(entry, previous_total), DOWN))

            new_heading = self.round_heading(entry["round"])
            new_match = self.build_match_card(entry)
            new_reading = self.build_reading_card(entry)

            if heading is None:
                animations += [FadeIn(new_heading), FadeIn(new_match), FadeIn(new_reading)]
            else:
                # Sequenciado, nunca simultâneo: `self.play(..., run_time=…)`
                # estica TODA animação que recebe até o fim do compasso, então um
                # FadeOut e um FadeIn passados lado a lado se sobrepõem o tempo
                # inteiro e os dois placares ficam legíveis ao mesmo tempo.
                for old, new in ((heading, new_heading), (match_card, new_match), (reading_card, new_reading)):
                    animations.append(
                        Succession(FadeOut(old, run_time=0.18), FadeIn(new, run_time=0.34))
                    )
            heading, match_card, reading_card = new_heading, new_match, new_reading

            animations.append(marker.animate.move_to(self.marker_position(entry["round"])))

            self.play(*animations, run_time=0.52 if index else 0.8)
            previous_total = entry["totalPoints"]

        self.wait(0.4)
        self.play(FadeOut(marker), run_time=0.3)
        self.play(FadeIn(self.build_summary(club, rounds), shift=UP * 0.16), run_time=0.9)
        self.wait(2.8)

    # ---- geometria ----------------------------------------------------------

    def x_of(self, round_number: float) -> float:
        """A rodada no eixo x, compartilhado pelos dois painéis."""
        return PLOT_LEFT + (round_number - 0.5) / self.last_round * (PLOT_RIGHT - PLOT_LEFT)

    def at_pos(self, round_number: float, position: float):
        """Uma rodada e uma posição como ponto na cena.

        A convenção de sinal mora aqui e em nenhum outro lugar: um número de
        posição MENOR fica MAIS ALTO na tela, então o 1º é a borda de cima.
        """
        y = POS_TOP - (position - 0.5) / CLUBS_IN_DIVISION * (POS_TOP - POS_BOTTOM)
        return [self.x_of(round_number), y, 0]

    def at_pts(self, round_number: float, points: float):
        y = PTS_BOTTOM + points / self.points_ceiling * (PTS_TOP - PTS_BOTTOM)
        return [self.x_of(round_number), y, 0]

    def marker_position(self, round_number: int):
        return [self.x_of(round_number), (POS_TOP + PTS_BOTTOM) / 2, 0]

    def build_frames(self) -> tuple[VGroup, VGroup, VGroup]:
        frames = VGroup()
        for top, bottom in ((POS_TOP, POS_BOTTOM), (PTS_TOP, PTS_BOTTOM)):
            frames.add(
                Rectangle(
                    width=PLOT_RIGHT - PLOT_LEFT,
                    height=top - bottom,
                    stroke_color=INK_FAINT,
                    stroke_width=1.6,
                    fill_opacity=0,
                ).move_to([(PLOT_LEFT + PLOT_RIGHT) / 2, (top + bottom) / 2, 0])
            )

        grid = VGroup()
        for position in NAMED_POSITIONS[1:]:
            grid.add(
                Line(
                    self.at_pos(0.5, position),
                    self.at_pos(self.last_round + 0.5, position),
                    stroke_color=INK_FAINT,
                    stroke_width=1,
                    stroke_opacity=0.26,
                )
            )
        for points in range(10, self.points_ceiling + 1, 10):
            grid.add(
                Line(
                    self.at_pts(0.5, points),
                    self.at_pts(self.last_round + 0.5, points),
                    stroke_color=INK_FAINT,
                    stroke_width=1,
                    stroke_opacity=0.22,
                )
            )

        labels = VGroup()
        # Só algumas posições são nomeadas: vinte rótulos em três unidades e meia
        # é uma coluna cinza, não uma escala.
        for position in NAMED_POSITIONS:
            tick = label(ordinal(position), 15, INK_SOFT)
            tick.next_to(self.at_pos(0.5, position), LEFT, buff=0.16)
            labels.add(tick)
        for points in range(0, self.points_ceiling + 1, 10):
            # The unit rides on the topmost tick rather than on a caption of its
            # own. A caption inside either box lands on a mark — the first
            # version put "posição" straight through round 1's pavio, which is
            # the widest one in the drawing — and neither box has room above it.
            # The position axis needs no caption at all: "1º … 20º" says it.
            tick = label(
                f"{points} pts" if points == self.points_ceiling else str(points), 14, INK_SOFT
            )
            tick.next_to(self.at_pts(0.5, points), LEFT, buff=0.16)
            labels.add(tick)
        for round_number in [1] + list(range(5, self.last_round + 1, 5)):
            tick = label(str(round_number), 14, INK_SOFT)
            tick.move_to([self.x_of(round_number), PTS_BOTTOM - 0.24, 0])
            labels.add(tick)

        rodada = label("rodada", 13, INK_SOFT)
        rodada.move_to([PLOT_RIGHT + 0.38, PTS_BOTTOM - 0.24, 0])
        labels.add(rodada)

        return frames, grid, labels

    def build_bands(self) -> tuple[VGroup, VGroup]:
        """G4 e Z4, faixas e não linhas.

        Uma faixa diz *esta é a região em que o clube está*, uma régua diz *este
        é o limite*; uma campanha é lida como em qual região o clube senta.
        """
        bands, captions = VGroup(), VGroup()
        for low, high, colour, caption in ((1, 4, POSITIVE, "G4"), (17, CLUBS_IN_DIVISION, NEGATIVE, "Z4")):
            top = self.at_pos(0.5, low - 0.5)
            bottom = self.at_pos(self.last_round + 0.5, high + 0.5)
            bands.add(
                Rectangle(
                    width=bottom[0] - top[0],
                    height=top[1] - bottom[1],
                    stroke_width=0,
                    fill_color=colour,
                    fill_opacity=0.10,
                ).move_to([(top[0] + bottom[0]) / 2, (top[1] + bottom[1]) / 2, 0])
            )
            # FORA da moldura, na margem entre o gráfico e a coluna de cards.
            # Dentro dela não existe canto seguro: o `campanhas.py` põe a
            # etiqueta do G4 rente à borda de baixo da faixa e, para um clube que
            # termina em 4º, as últimas velas passam exatamente por cima dela.
            # Aqui a marca nunca encosta em vela nenhuma, para clube nenhum.
            tag = label(caption, 13, colour)
            tag.set_opacity(0.8)
            tag.move_to([PLOT_RIGHT + 0.34, self.at_pos(1, (low + high) / 2)[1], 0])
            captions.add(tag)
        return bands, captions

    # ---- as marcas ----------------------------------------------------------

    def build_candle(self, entry) -> VGroup:
        """Uma rodada: pavio, corpo e o toco que diz por onde ela abriu."""
        played = entry["points"] is not None
        colour = RESULT_COLOUR.get(entry["result"], INK_SOFT)
        x = self.x_of(entry["round"])

        wick = Line(
            self.at_pos(entry["round"], entry["best"]),
            self.at_pos(entry["round"], entry["worst"]),
            stroke_color=colour,
            stroke_width=1.6,
            stroke_opacity=0.85,
        )

        open_y = self.at_pos(entry["round"], entry["open"])[1]
        close_y = self.at_pos(entry["round"], entry["close"])[1]
        body = Rectangle(
            width=BODY_WIDTH,
            height=max(abs(open_y - close_y), MIN_BODY),
            stroke_color=colour,
            stroke_width=1.4,
            # Vazado quando o clube não jogou. Ver o docstring: um cinza ao lado
            # do cinza do empate não se distingue num traço destes.
            fill_color=colour,
            fill_opacity=1.0 if played else 0.0,
        ).move_to([x, (open_y + close_y) / 2, 0])

        # O toco da abertura. Sem ele o corpo é um retângulo entre duas posições
        # e não diz qual delas veio primeiro — e é exatamente nas rodadas em que
        # a cor e a direção discordam que a vela vale alguma coisa.
        stub = Line(
            [x - BODY_WIDTH / 2 - 0.085, open_y, 0],
            [x - BODY_WIDTH / 2, open_y, 0],
            stroke_color=colour,
            stroke_width=2.2,
        )
        return VGroup(wick, body, stub)

    def build_bar(self, entry, previous_total: int) -> VGroup:
        """A barra de pontos: o total inteiro, com o que a rodada acrescentou em cima.

        A tampa clara é o ganho da rodada. Uma derrota não acrescenta nada, então
        a barra não cresce — e a vela ao lado é que conta o resto da história.
        """
        x = self.x_of(entry["round"])
        base = self.at_pts(entry["round"], 0)[1]
        top = self.at_pts(entry["round"], entry["totalPoints"])[1]
        carried = self.at_pts(entry["round"], min(previous_total, entry["totalPoints"]))[1]

        bar = VGroup()
        if top > base:
            bar.add(
                Rectangle(
                    width=BAR_WIDTH,
                    height=top - base,
                    # **O contorno é o que faz a altura ser legível, e o
                    # `fill_opacity` continua em 0,55 de propósito.** O corpo
                    # sozinho entrega 1,83:1 para o Fluminense sobre o fundo,
                    # contra o piso de 3 de uma marca gráfica — e são DEZ dos
                    # vinte clubes abaixo do piso, não um caso isolado. Subir a
                    # opacidade fecharia esse número em 0,90 e abriria um buraco
                    # pior: a tampa some dentro do corpo. Em 22 pares
                    # clube×resultado a separação corpo/tampa cai de 1,67–2,73
                    # para 1,01–1,26, e o vermelho do Flamengo (`#E5453A`) contra
                    # o da derrota (`#E5533D`) — como o verde do Palmeiras contra
                    # o da vitória — viram a mesma cor. **O 0,55 é quem separa a
                    # cor do clube da cor do resultado quando os dois coincidem**,
                    # que é exatamente o par que a tampa precisa distinguir.
                    #
                    # O `self.mark` e não o tom cru, e a diferença é de margem e
                    # não de piso: cru, o contorno entrega **3,26** no quadro
                    # codificado para o Fluminense, que passa o piso de 3 por
                    # 0,26 — margem nenhuma, no pior clube da divisão. Só o
                    # Fluminense muda; os outros dezenove recebem o tom cru de
                    # volta, porque `lift_to_floor` não sobe quem já passa.
                    stroke_color=self.mark,
                    stroke_width=1.4,
                    fill_color=self.colour,
                    fill_opacity=0.55,
                ).move_to([x, (base + top) / 2, 0])
            )
        if top > carried:
            bar.add(
                Rectangle(
                    width=BAR_WIDTH,
                    height=top - carried,
                    stroke_width=0,
                    fill_color=RESULT_COLOUR.get(entry["result"], INK_SOFT),
                    fill_opacity=0.95,
                ).move_to([x, (carried + top) / 2, 0])
            )
        return bar

    def build_key(self) -> VGroup:
        """A chave da vela, e ela não é opcional.

        Uma vela é uma marca que quem lê uma tabela de futebol não encontra em
        outro lugar: sem dizer o que é o corpo e o que é o pavio, o desenho é
        bonito e ilegível. Fica embaixo dos dois painéis, fora deles, pela razão
        que o `CLAUDE.md` registra sobre a chave de zonas na Classificação.
        """
        sample_colour = INK_SOFT
        wick = Line([0, -0.26, 0], [0, 0.26, 0], stroke_color=sample_colour, stroke_width=1.6)
        body = Rectangle(
            width=0.17,
            height=0.30,
            stroke_color=sample_colour,
            stroke_width=1.4,
            fill_color=sample_colour,
            fill_opacity=1.0,
        ).move_to([0, 0.02, 0])
        stub = Line([-0.16, 0.17, 0], [-0.085, 0.17, 0], stroke_color=sample_colour, stroke_width=1.8)
        drawing = VGroup(wick, body, stub)

        legend = label(
            "corpo: abertura → fechamento da rodada   ·   pavio: melhor e pior posição durante ela",
            13,
            INK_SOFT,
        )
        second = VGroup(label("toco à esquerda: a posição de abertura", 13, INK_SOFT))
        for code in ("V", "E", "D"):
            swatch = Rectangle(
                width=0.16,
                height=0.16,
                stroke_width=0,
                fill_color=RESULT_COLOUR[code],
                fill_opacity=1.0,
            )
            word = label(RESULT_WORD[code], 13, INK_SOFT).next_to(swatch, RIGHT, buff=0.12)
            second.add(VGroup(swatch, word))
        second.arrange(RIGHT, buff=0.55)

        key = VGroup(VGroup(drawing, legend).arrange(RIGHT, buff=0.3), second).arrange(
            DOWN, buff=0.18
        )
        key.move_to([(PLOT_LEFT + PLOT_RIGHT) / 2, PTS_BOTTOM - 0.98, 0])
        return key

    def build_credit(self) -> Text:
        """De onde o vídeo veio, embaixo da coluna de cards.

        Ali é o único retângulo grande e vazio do quadro: os cards param em
        -2,25 e a chave da vela ocupa a metade esquerda, então o crédito não
        divide espaço com marca nenhuma.
        """
        credit = label(SITE, 17, INK_SOFT)
        credit.move_to([CARD_X, -3.24, 0])
        return credit

    # ---- os cards da rodada -------------------------------------------------

    def round_heading(self, round_number: int) -> Text:
        heading = label(f"Rodada {round_number}", 26, INK, "BOLD")
        heading.move_to([CARD_X, 2.95, 0])
        return heading

    def card_frame(self, height: float) -> RoundedRectangle:
        return RoundedRectangle(
            width=CARD_WIDTH,
            height=height,
            corner_radius=0.16,
            stroke_color=INK_FAINT,
            stroke_width=1.5,
            fill_color=CARD,
            fill_opacity=1.0,
        )

    def build_match_card(self, entry) -> VGroup:
        """O jogo da rodada. Construído do zero a cada rodada e sobreposto ao
        anterior em vez de transformado nele: uma rodada adiada não tem placar
        nenhum, e transformar grupos de tamanhos diferentes lê como falha."""
        frame = self.card_frame(1.72).move_to([CARD_X, 1.58, 0])
        left = frame.get_left()[0] + 0.28
        right = frame.get_right()[0] - 0.28
        top = frame.get_top()[1] - 0.30
        bottom = frame.get_bottom()[1] + 0.30

        heading = label("O jogo", 15, INK_SOFT)
        heading.move_to([left + heading.width / 2, top, 0])
        body = VGroup(frame, heading)

        match = entry["match"]
        if match is None:
            note = label("sem jogo nesta rodada", 19, INK_SOFT)
            note.move_to([frame.get_center()[0], frame.get_center()[1] - 0.08, 0])
            body.add(note)
            return body

        score = label(f"{match['goalsFor']} × {match['goalsAgainst']}", 30, INK, "BOLD")
        versus = label(
            f"{match['opponent']} ({'casa' if match['home'] else 'fora'})", 18, INK_SOFT
        )
        scoreline = VGroup(score, versus).arrange(RIGHT, buff=0.24)
        scoreline.move_to([left + scoreline.width / 2, frame.get_center()[1] - 0.02, 0])

        verdict = label(
            RESULT_WORD.get(match["result"], "—"),
            18,
            RESULT_COLOUR.get(match["result"], INK_SOFT),
            "BOLD",
        )
        verdict.move_to([left + verdict.width / 2, bottom, 0])

        gained = entry["points"]
        tally = label(
            "—" if gained is None else f"+{gained} pt" + ("s" if gained != 1 else ""),
            18,
            INK,
            "BOLD",
        )
        tally.move_to([right - tally.width / 2, bottom, 0])

        body.add(scoreline, verdict, tally)
        return body

    def build_reading_card(self, entry) -> VGroup:
        """A leitura da vela: por onde a rodada abriu, onde fechou, e até onde foi.

        As três linhas são as três marcas do desenho, nomeadas — e a linha do
        movimento é a única que interpreta, porque a direção é o que a cor não diz.
        """
        frame = self.card_frame(2.50).move_to([CARD_X, -1.00, 0])
        left = frame.get_left()[0] + 0.28
        right = frame.get_right()[0] - 0.28
        top = frame.get_top()[1] - 0.30

        heading = label("A vela", 15, INK_SOFT)
        heading.move_to([left + heading.width / 2, top, 0])

        moved = entry["moved"]
        if moved > 0:
            movement, colour = f"subiu {moved} posiç" + ("ão" if moved == 1 else "ões"), POSITIVE
        elif moved < 0:
            movement, colour = f"caiu {-moved} posiç" + ("ão" if moved == -1 else "ões"), NEGATIVE
        else:
            movement, colour = "manteve a posição", INK_SOFT

        rows = (
            ("abriu", ordinal(entry["open"]), INK_SOFT),
            ("fechou", ordinal(entry["close"]), INK),
            ("melhor · pior na rodada", f"{ordinal(entry['best'])} · {ordinal(entry['worst'])}", INK_SOFT),
            ("no movimento", movement, colour),
            ("pontos na temporada", f"{entry['totalPoints']} em {entry['played']} jogos", INK),
        )

        body = VGroup(frame, heading)
        y = top - 0.42
        for caption, value, value_colour in rows:
            key_text = label(caption, 16, INK_SOFT)
            key_text.move_to([left + key_text.width / 2, y, 0])
            value_text = label(value, 18, value_colour, "BOLD")
            value_text.move_to([right - value_text.width / 2, y, 0])
            rule = Line(
                [left, y - 0.20, 0], [right, y - 0.20, 0], stroke_color=INK_FAINT, stroke_width=1
            ).set_opacity(0.35)
            body.add(key_text, value_text)
            if caption != rows[-1][0]:
                body.add(rule)
            y -= 0.38
        return body

    # ---- o fecho ------------------------------------------------------------

    def build_summary(self, club, rounds) -> VGroup:
        """Onde a campanha terminou, e a forma dela.

        O retrospecto é contado das próprias rodadas em vez de vir no payload,
        então ele não pode discordar dos cards que o vídeo acabou de mostrar. E
        fica dentro da área vazia do gráfico de posições — que existe justamente
        porque o eixo é a divisão inteira.
        """
        final = rounds[-1]
        tally = {"V": 0, "E": 0, "D": 0}
        for entry in rounds:
            if entry["result"] in tally:
                tally[entry["result"]] += 1
        best = min(entry["best"] for entry in rounds)
        worst = max(entry["worst"] for entry in rounds)

        headline = label(
            f"{ordinal(final['close'])} · {final['totalPoints']} pts em {final['played']} jogos",
            26,
            INK,
            "BOLD",
        )
        # `self.ink` e não `self.colour`: isto é TEXTO, piso 4,5, e o tom cru do
        # Fluminense entrega 3,13 sobre este painel.
        #
        # **Quantos clubes sobem aqui é uma MEDIDA e não uma constante**, então
        # não há número nesta linha: ele depende do `ENCODED_MARGIN`, que já se
        # moveu uma vez, e da paleta dos vinte, que cresce. Esta frase dizia
        # "quatro clubes" e a varredura sobre os vinte tons do `pontos.py` dá
        # SETE (2026-09-06) — uma contagem em prosa sem portão nenhum em cima,
        # que é a falha que o `CLAUDE.md` cataloga. Para recontar:
        #
        #     lift_to_floor(tom, SUMMARY_GROUND, TEXT_FLOOR * ENCODED_MARGIN) != tom
        #
        # E leia a margem pelo que ela é. O Bragantino entra em 5,08 contra o
        # ALVO de 5,17 — ou seja, acima do piso de 4,5 do projeto e abaixo da
        # folga de 15% que a codificação pede. A correção existe para a folga,
        # não para uma reprovação: medido no quadro codificado, o tom cru dá
        # 5,24 e o corrigido 5,47, e os dois passariam. Dizer que sem a subida
        # a etiqueta ficaria ilegível seria mais forte do que a medida sustenta.
        record = label(
            f"{tally['V']}V · {tally['E']}E · {tally['D']}D", 19, self.ink, "BOLD"
        )
        extremes = label(
            f"oscilou entre o {ordinal(best)} e o {ordinal(worst)}", 17, INK_SOFT
        )
        # Three lines rather than two: the panel has to fit between round 1's
        # pavio on the left — the widest in the drawing, for the reason the
        # docstring gives — and the Z4 tag on the right, and a wide panel covers
        # one or the other.
        rows = VGroup(headline, record, extremes).arrange(DOWN, buff=0.18, aligned_edge=LEFT)

        panel = RoundedRectangle(
            width=rows.width + 0.7,
            height=rows.height + 0.56,
            corner_radius=0.14,
            stroke_color=INK_FAINT,
            stroke_width=1.5,
            fill_color=CARD,
            fill_opacity=0.94,
        ).move_to(rows.get_center())

        summary = VGroup(panel, rows)
        summary.move_to(self.summary_anchor(rounds, panel.width, panel.height))
        return summary

    def summary_anchor(self, rounds, width: float, height: float):
        """O lugar vazio do gráfico de posições, LIDO das velas e não fixado.

        Este painel morava num ponto fixo — rodada 13, 13,5º — e o comentário
        ali dizia que aquilo era "a área vazia do gráfico de posições, que
        existe justamente porque o eixo é a divisão inteira". Era verdade para
        os três clubes desenhados antes do Cruzeiro, e pelo mesmo motivo: os
        três passaram a temporada no terço de cima, então o meio de um eixo que
        é a divisão inteira sobrava. **Isso é propriedade dos clubes, não do
        desenho.** O Cruzeiro abre a temporada em 20º e fecha em 6º, então a
        campanha dele atravessa exatamente aquela faixa, e o painel fixo tapava
        a subida que é o assunto do vídeo.

        Então o lugar sai das velas. O ponto antigo é testado primeiro e é
        mantido sempre que estiver livre, o que é de propósito: um re-render
        dos clubes já publicados não pode mexer o painel deles por causa desta
        mudança. Só quando ele encosta em alguma vela é que a grade é varrida,
        e vence o centro que deixa a maior folga.
        """
        # Cada vela ocupa o corpo mais o toco à esquerda, e vai do melhor ao
        # pior do pavio — que é o que precisa ficar visível.
        boxes = []
        for entry in rounds:
            x = self.x_of(entry["round"])
            top = self.at_pos(entry["round"], entry["best"])[1]
            bottom = self.at_pos(entry["round"], entry["worst"])[1]
            boxes.append((x - BODY_WIDTH / 2 - 0.085, x + BODY_WIDTH / 2, bottom, top))

        half_w, half_h = width / 2, height / 2

        def clearance(centre) -> float:
            """A menor separação entre o painel e uma vela. Negativa se cruzam.

            Separação de retângulos: em cada eixo, o quanto um está fora do
            outro; o MAIOR dos dois é a distância real, porque dois retângulos
            só se cruzam quando se sobrepõem nos dois eixos ao mesmo tempo.
            """
            cx, cy = centre[0], centre[1]
            worst = float("inf")
            for x0, x1, y0, y1 in boxes:
                dx = max(x0 - (cx + half_w), (cx - half_w) - x1)
                dy = max(y0 - (cy + half_h), (cy - half_h) - y1)
                worst = min(worst, max(dx, dy))
            return worst

        # O ponto antigo é mantido sempre que NÃO CRUZAR uma vela, e o limiar é
        # zero de propósito: com 0,10 o Athletico-PR saía do lugar por uma folga
        # de 0,049 — apertada, e apertada não é defeito. Mover o painel de um
        # vídeo já publicado por causa disso seria esta mudança inventando
        # trabalho onde não havia problema.
        default = self.at_pos(self.last_round * 0.52, 13.5)
        if clearance(default) >= 0:
            return default

        # A margem mantém o painel dentro da moldura e longe das etiquetas do
        # G4 e do Z4, que moram logo fora da borda direita.
        margin = 0.12
        left, right = PLOT_LEFT + half_w + margin, PLOT_RIGHT - half_w - margin
        top, bottom = POS_TOP - half_h - margin, POS_BOTTOM + half_h + margin
        if right < left or top < bottom:
            return default

        best, best_score = default, clearance(default)
        steps = 24
        for i in range(steps + 1):
            for j in range(steps + 1):
                centre = [
                    left + (right - left) * i / steps,
                    bottom + (top - bottom) * j / steps,
                    0,
                ]
                score = clearance(centre)
                if score > best_score:
                    best, best_score = centre, score
        return best
