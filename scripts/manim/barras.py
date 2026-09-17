"""
A corrida das barras: os 20 clubes, comprimento = pontos, altura = colocação.

    manim -qh scripts/manim/barras.py Barras

The fourth scene, and it answers what the other three do not. `pontos.py` draws
the same twenty clubs' points as *lines over time*, so the reader follows a
curve and reads the order off a column beside it; here the **order is the
drawing**. A bar's length is the points and its slot is the position, so
overtaking is a movement rather than two curves crossing — which is the one
thing a season is actually about and the one thing a line chart states worst.

**It reads `pontos.json`, deliberately, and there is no `export-barras.ts`.**
That payload already carries `{round, points, position, played}` per club, which
is exactly and entirely what this scene needs — a second exporter would be a
byte-identical copy of `export-pontos.ts`, and a second copy is where drift
starts, which is the argument `commons-core.ts` makes about
`scripts/commons-api.ts`. `BARRAS_JSON` overrides it for a payload of another
season. Nothing here recomputes a standing: a number wrong in this video is
wrong on the site too.

**The points axis is FIXED at the season's maximum and is never rescaled per
rodada.** This is the decision that separates this drawing from the bar-chart
race everybody has seen, and it is the one somebody will try to "fix", so:
rescaling the axis each round keeps the bars long and destroys the only reading
worth having. `scatterTrail` states the rule in `CLAUDE.md` — recomputing the
domain per rodada moves the frame and the mark together, so a club could climb
the drawing while standing still. With the axis pinned, a bar that grows is a
club that scored, the fill of the frame is the season passing, and two rodadas
of this video are comparable to each other. The cost is real and accepted:
rodada 1 is twenty stubs. That is what rodada 1 looks like.

**Zero points draws NO bar, and the number beside it is what says so.** A bar
means its length, so a zero has to be nothing — the rule `sparklineBars` states
for the sparkline's own axis, arriving here from the other side. The label sits
at the baseline and reads `0`, which is the honest picture; a minimum-width stub
would report a club that had scored.

**The position column is static and the ROWS move through it**, which is
`pontos.py`'s rule and holds for the same reason: drawing "1º…20º" into each row
would animate twenty ordinals into each other every rodada to end up spelling
the same twenty words. The slot carries the position.

**G4 and Z4 are hairlines, never a hue.** The division's own vocabulary
(`CONTEXT.md`) paints four bands, and a fifth and sixth colour is unavailable
here for a reason that is arithmetic rather than taste: twenty club colours
already span the whole wheel, so ANY zone hue is some club's colour and a
reader would be entitled to read the rail as identity. A rule between 4º and 5º
and another between 16º and 17º is a pattern rather than a colour — the escape
`CONTEXT.md` already names — and it cannot collide with anything.

**Every label goes through `label()` rather than `Text`**, for the reason both
sibling scenes give: Manim's glyph advances round to the pixel, so below roughly
20pt the space advance rounds to zero and words run together.

**`BARRAS_FOCUS` é o corte de TORCEDOR, e é um interruptor e não uma segunda
cena** — a razão do `BARRAS_ASPECT` logo abaixo, e a mesma que o `velas.py` já
registra: uma cópia do arquivo é onde a divergência começa. Com ele o desenho
continua sendo a divisão inteira; o que muda é que um clube fica achável em
todo quadro. Sem ele a cena sai exatamente como saía.

**O relevo é ALTURA e não cor, e isso é o que o torna barato.** A altura da
barra não carrega dado nenhum aqui — os vinte usam o mesmo `BAR_H`, e quem
carrega o número é o comprimento —, então gastá-la em foco não tira leitura de
lugar nenhum. É a regra do `RankCandles` pelo avesso: lá a cor carrega o
resultado e a geometria a direção, aqui a cor já está toda gasta nos vinte
clubes e a geometria é o canal que sobrou. Pintar os outros dezenove de cinza
era a outra saída e foi recusada: a paleta vem do `pontos.py` sem reescrita
justamente para que dois vídeos deste projeto não discordem da cor de um clube,
e apagá-la num corte é discordar dela.

**Recuar a opacidade das outras barras foi a terceira saída, foi construída, e
a medição a matou** — o comentário do `BAND_OPACITY` tem os números. Vale ler
antes de tentar de novo, porque a ideia é óbvia e o motivo de ela não servir
não é: o tom mais escuro desta paleta já está no piso com opacidade cheia.

**A faixa atrás da linha é o que responde a pergunta do torcedor**, que não é
"quem lidera" — é "onde está o meu". Ela anda com o clube a cada rodada, então
ele é achável mesmo em 14º, que é exatamente quando ninguém acha. Ela vai na
cor do clube e em opacidade baixa: é uma FAIXA e não tinta de texto, então o
piso que vale é o de marca.

**O número dos outros dezenove desce para `INK_SOFT`, nunca para `INK_FAINT`.**
A tentação é apagar mais, e `INK_FAINT` é régua e não texto — é o defeito que
as três cenas já tiveram uma vez, medido em 2,9–3,3:1 contra o piso de 4,5.

**A nota de fecho passa a ser sobre o clube do foco.** Um vídeo de torcedor que
fecha falando do líder fecha falando do rival na maioria dos clubes. O ramo de
quem NÃO lidera foi uma armadilha armada até o corte da Chapecoense (`1772`, em
20º) exercitá-lo — e ele disparou: a frase é mais comprida que a do líder e o
Pango a quebrou em duas linhas no 16:9, com a segunda em cima da barra do 1º.
É o que o `one_line_label` existe para impedir.
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
    Line,
    Rectangle,
    Scene,
    Text,
    Transform,
    VGroup,
    config,
)

DATA = Path(os.environ.get("BARRAS_JSON", Path(__file__).with_name("pontos.json")))

# ---- o formato do quadro -------------------------------------------------
#
# `BARRAS_ASPECT` escolhe o corte: `16:9` (o padrão — YouTube), `4:5` para o
# FEED do Instagram e `9:16` para os REELS e o YouTube SHORT. Um interruptor e
# não uma segunda cena, pela razão que o `velas.py` já registra: uma cópia do
# arquivo é onde a divergência começa.
#
# **O vocabulário é fechado e um valor desconhecido ABORTA**, em vez de cair no
# 16:9 — a regra do `isKnownGoalResult`. Um `BARRAS_ASPECT=9x16` digitado errado
# que renderizasse 1920×1080 em silêncio só apareceria ao abrir o arquivo, depois
# do render inteiro.
#
# **`frame_width` e `frame_height` são os dois escritos à mão.** No manim 0.21.0
# instalado aqui ele NÃO deriva um do outro pela razão dos pixels — pedir
# `-r 1080,1350` deixa o quadro em 14,22 × 8,0 e a cena sai pela borda sem erro
# nenhum. Os dois valores são 1080/135 e 1350/135, porque **135 px por unidade**
# é a densidade do 16:9 (1920/14,222 = 1080/8) e é o que faz um `label(…, 15, …)`
# render exatamente os mesmos pixels de altura nos três formatos. O corte
# vertical não encolhe tipo nenhum: ele estreita a pista da barra e realtura as
# linhas.
ASPECT = os.environ.get("BARRAS_ASPECT", "16:9")
if ASPECT not in ("16:9", "4:5", "9:16"):
    raise SystemExit(f"BARRAS_ASPECT={ASPECT!r}: use 16:9, 4:5 ou 9:16.")

# **O código do clube em foco, ou nada.** Validado contra o payload no
# `construct` e não aqui, porque a lista de clubes é o `pontos.json` — e como o
# `BARRAS_ASPECT`, um valor desconhecido ABORTA em vez de cair em silêncio no
# corte sem foco: um `BARRAS_FOCUS=1738` digitado errado renderizaria o vídeo
# base inteiro, com nome de arquivo de torcedor, e só apareceria ao assistir.
FOCUS = os.environ.get("BARRAS_FOCUS") or None

VERTICAL = ASPECT in ("4:5", "9:16")
REELS = ASPECT == "9:16"
if VERTICAL:
    config.pixel_width = 1080
    config.pixel_height = 1920 if REELS else 1350
    config.frame_width = 8.0
    config.frame_height = 14.2222222 if REELS else 10.0

FONT = "Inter"
TYPE_OVERSAMPLE = 4

INK = "#E6EAE8"
INK_SOFT = "#9AA5A0"
# **`INK_FAINT` é para RÉGUA, nunca para TEXTO.** Medido nos pixels do mp4 nas
# cenas irmãs e não deduzido da paleta: sobre o `SURFACE` este tom entrega
# 3,2:1, abaixo do piso de 4,5 que este projeto exige de texto. A paleta destas
# cenas é escrita à mão, então o `test:tokens` nunca olhou para ela e nada
# acusa. Moldura, grade e os filetes das zonas continuam aqui.
INK_FAINT = "#5C6763"
SURFACE = "#0B100E"

# One colour per club, keyed by the provider's numeric code — never `tla`, which
# Corinthians and Coritiba share.
#
# **Copied from `pontos.py` verbatim, which is the house rule** (`README.md`):
# that file solved the palette for all twenty by its own order — distinguishable
# first, faithful to the shirt second — and copying the value is what stops two
# videos of this project disagreeing about the colour of a club.
CLUB_COLOURS = {
    "1769": "#1FBF6B",  # Palmeiras      verde
    "4241": "#8BD94F",  # Coritiba       verde-claro
    "1772": "#2FD0A8",  # Chapecoense    verde-água
    "1777": "#35BCD6",  # Bahia          ciano
    "1771": "#4C7DF0",  # Cruzeiro       azul
    "1767": "#7C8FF5",  # Grêmio         azul-claro
    "4287": "#A66BE8",  # Clube do Remo  roxo
    "4286": "#E058B8",  # Bragantino     magenta
    "1780": "#F0748F",  # Vasco da Gama  rosa
    "1783": "#E5453A",  # Flamengo       vermelho
    "6684": "#FF6B3D",  # Internacional  laranja-vermelho
    "1768": "#FF9C3D",  # Athletico-PR   laranja
    "4364": "#F2CE3A",  # Mirassol       amarelo
    "6685": "#C9A227",  # Santos         ocre
    "1765": "#B0455F",  # Fluminense     grená
    "1782": "#8C6E5A",  # Vitória        marrom
    "1779": "#D7DDE0",  # Corinthians    cinza-claro
    "1770": "#98A3A8",  # Botafogo       cinza
    "1766": "#6E8894",  # Atlético-MG    cinza-azul
    "1776": "#FFC4B0",  # São Paulo      salmão
}
FALLBACK_COLOUR = "#9AA5A0"

# **NENHUMA barra recua no corte de torcedor, e isso foi MEDIDO em vez de
# escolhido.** A primeira versão apagava os outros dezenove para 0,62 e seis
# barras caíram abaixo do piso de 3 que uma marca exige — medido no quadro
# codificado do mp4, contra o `SURFACE`:
#
#     Fluminense 1,99 · Vitória 2,30 · Cruzeiro 2,57
#     Atlético-MG 2,58 · Clube do Remo 2,68 · Bragantino 2,76
#
# **A causa é que esta paleta não tem folga nenhuma para gastar.** O grená do
# Fluminense entrega **3,48** com opacidade 1,0 — já raspando no piso —, então
# *qualquer* recuo o derruba: 0,90 o põe em 3,06 e não recua nada que se veja.
# Clarear o tom resolveria e é o que o `README.md` proíbe acima de tudo, porque
# a paleta vem do `pontos.py` sem reescrita.
#
# Então o foco é ALTURA, FAIXA e PESO DO TIPO, três canais que só ACRESCENTAM —
# nenhum deles tira contraste de ninguém. O recuo que sobra é o do **texto**,
# de `INK` para `INK_SOFT`, que mede 7,8–8,0 e sobra sobre o piso de 4,5.
#
# A faixa atrás da linha do clube em foco. Baixa o bastante para a barra do
# próprio clube continuar sendo a coisa mais forte da linha.
BAND_OPACITY = 0.17

CLUBS_IN_DIVISION = 20
G4_CUT = 4    # entre 4º e 5º: a Libertadores fase de grupos
Z4_CUT = 16   # entre 16º e 17º: o rebaixamento
POINTS_STEP = 10

# ---- a geometria, por corte ----------------------------------------------
#
# Três blocos e nenhuma aritmética entre eles: cada corte diz onde as suas
# colunas ficam, medido abrindo o quadro. Derivar o vertical do 16:9 por um
# fator foi tentado e é o que empurra o rótulo de pontos para fora da moldura
# no clube líder, que é o único clube em que ninguém repara enquanto ajusta.
if REELS:
    # **A ZONA SEGURA dita estes números, não a altura do quadro.** A UI do
    # Reels/Shorts come ~250px no topo e ~480px embaixo (legenda, @ e áudio):
    # sobram 1190px, 8,81 unidades das 14,22. O desenho inteiro vive nelas,
    # **a nota de fecho inclusive** — ela é conteúdo, e é por isso que ela sobe
    # para o topo aqui em vez de descer. O crédito é o único que fica na faixa
    # comida, porque é a única coisa que a legenda do post repete.
    TITLE_Y, SUB_Y, HEAD_Y = 5.00, 4.60, 4.16
    CLOSING_Y, CLOSING_LINES = 3.72, 2
    ROW_TOP, ROW_BOTTOM = 3.10, -2.86
    POS_X, NAME_X = -3.30, -3.16
    BAR_LEFT, BAR_RIGHT = -1.30, 2.62
    AXIS_Y_GAP, CREDIT_Y = 0.40, -4.30
    TITLE_SIZE, SUB_SIZE, HEAD_SIZE = 28, 15, 24
    NAME_SIZE, PTS_SIZE, BAR_H, CLOSING_SIZE = 14, 14, 0.176, 15
    FOCUS_BAR_H = 0.27
elif VERTICAL:
    TITLE_Y, SUB_Y, HEAD_Y = 4.56, 4.16, 3.74
    CLOSING_Y, CLOSING_LINES = 3.30, 2
    ROW_TOP, ROW_BOTTOM = 2.72, -3.30
    POS_X, NAME_X = -3.30, -3.16
    BAR_LEFT, BAR_RIGHT = -1.30, 2.62
    AXIS_Y_GAP, CREDIT_Y = 0.40, -4.42
    TITLE_SIZE, SUB_SIZE, HEAD_SIZE = 28, 15, 24
    NAME_SIZE, PTS_SIZE, BAR_H, CLOSING_SIZE = 14, 14, 0.176, 15
    FOCUS_BAR_H = 0.27
else:
    TITLE_Y, SUB_Y, HEAD_Y = 3.60, 3.22, 3.44
    CLOSING_Y, CLOSING_LINES = 2.86, 1
    ROW_TOP, ROW_BOTTOM = 2.50, -2.94
    POS_X, NAME_X = -6.72, -6.58
    BAR_LEFT, BAR_RIGHT = -4.10, 5.42
    AXIS_Y_GAP, CREDIT_Y = 0.42, -3.64
    TITLE_SIZE, SUB_SIZE, HEAD_SIZE = 34, 16, 28
    NAME_SIZE, PTS_SIZE, BAR_H, CLOSING_SIZE = 15, 15, 0.185, 16
    # **O 16:9 é o corte APERTADO e é ele que dita este número.** Os postos
    # ficam a (2,50 + 2,94)/19 = 0,286 um do outro, então uma barra de foco
    # acima disso encosta na linha de cima — e encosta primeiro no clube que
    # está subindo, que é o único quadro em que ninguém repara enquanto mede.
    # 0,26 deixa 0,026 de folga. Os dois cortes verticais têm 0,31 de vão.
    FOCUS_BAR_H = 0.26

# O endereço do site. Escrito à mão porque o `APP_URL` mora no `.env` do host,
# que é gitignored e não existe na estação onde a cena é desenhada.
SITE = "brasileirao.mpbarbosa.com"


def label(
    text: str,
    size: float,
    colour: str,
    weight: str = "NORMAL",
    oversample: int = TYPE_OVERSAMPLE,
) -> Text:
    """A line of type, drawn oversized and scaled down. See the module docstring."""
    return Text(
        text,
        font=FONT,
        font_size=size * oversample,
        color=colour,
        weight=weight,
    ).scale(1 / oversample)


def one_line_label(text: str, size: float, colour: str, weight: str = "NORMAL") -> Text:
    """`label`, garantido numa linha só.

    **O Pango quebra a linha na largura do `config.pixel_width` medida no corpo
    SOBRE-AMOSTRADO**, então um texto que cabe folgado no quadro quebra mesmo
    assim: a nota de fecho da Chapecoense em 20º ("… 6 atrás do Clube do Remo,
    que tem um jogo a mais") terminaria perto de x=1520 de 1920 e saiu em duas
    linhas, com a segunda em cima da barra do 1º lugar — `manim` saindo 0. Só
    o ramo de quem NÃO lidera tem frase comprida o bastante para isso.

    Quando quebra, refaz com metade da sobre-amostragem, o que dobra a largura
    de quebra e mantém o corpo desenhado acima dos 20pt onde o avanço do espaço
    arredonda para zero. Quando não quebra, devolve o `label` de sempre — então
    um vídeo cuja nota cabia sai byte a byte como saía.
    """
    row = label(text, size, colour, weight)
    single = label("Ág", size, colour, weight).height
    if row.height <= single * 1.5:
        return row
    row = label(text, size, colour, weight, oversample=max(1, TYPE_OVERSAMPLE // 2))
    if row.height > single * 1.5:
        raise SystemExit(f"nota de fecho não cabe numa linha: {text!r}")
    return row


def ordinal(position: int) -> str:
    return f"{position}º"


class Barras(Scene):
    def construct(self) -> None:
        self.camera.background_color = SURFACE

        payload = json.loads(DATA.read_text(encoding="utf-8"))
        clubs = payload["clubs"]
        # Ver o comentário no `FOCUS`: um código que o payload não tem aborta.
        if FOCUS is not None and FOCUS not in {club["code"] for club in clubs}:
            raise SystemExit(
                f"BARRAS_FOCUS={FOCUS!r} não está no payload — "
                f"use um dos {len(clubs)} códigos de {DATA.name}."
            )
        self.focus = FOCUS
        for club in clubs:
            club["colour"] = CLUB_COLOURS.get(club["code"], FALLBACK_COLOUR)
            club["by_round"] = {entry["round"]: entry for entry in club["rounds"]}

        self.last_round = max(entry["round"] for club in clubs for entry in club["rounds"])
        top_points = max(entry["points"] for club in clubs for entry in club["rounds"])
        # Round the axis up to the next full step, so the leader's bar ends
        # inside the frame with its own number beside it rather than on the edge.
        self.top_points = ((top_points // POINTS_STEP) + 1) * POINTS_STEP

        title = label("A corrida do Brasileirão", TITLE_SIZE, INK, "BOLD")
        title.move_to([self.head_x(title.width), TITLE_Y, 0])
        subtitle = label(
            f"pontos rodada a rodada · Série A · dados até {payload['snapshot']}",
            SUB_SIZE,
            INK_SOFT,
        )
        subtitle.move_to([self.head_x(subtitle.width), SUB_Y, 0])
        self.play(FadeIn(title, shift=DOWN * 0.18), FadeIn(subtitle), run_time=0.9)

        slots, zones, axis = self.build_frame()
        heading = self.round_heading(1)
        # **A faixa entra COM a moldura e antes das linhas**, porque o manim
        # desenha na ordem em que recebe: montada depois, ela ficaria por cima
        # da própria barra que existe para destacar.
        band = self.build_band(clubs)
        rows = self.build_rows(clubs)
        self.play(
            FadeIn(slots),
            FadeIn(zones),
            FadeIn(axis),
            *([FadeIn(band)] if band is not None else []),
            Create(heading),
            run_time=0.8,
        )
        self.play(
            FadeIn(VGroup(*[part for row in rows.values() for part in row.values()])),
            FadeIn(self.build_credit()),
            run_time=0.7,
        )

        # **Cada rodada tem uma batida E um repouso, e o repouso não é uma
        # pausa decorativa.** Encadeadas sem ele, as vinte linhas nunca param:
        # todo quadro do vídeo é um quadro de transição, com nomes a meio
        # caminho entre dois postos e números a meio caminho entre dois valores,
        # e o leitor não chega a ver a classificação de rodada nenhuma. Medido
        # abrindo o quadro: em `t=3,2s` o desenho é ilegível e o `manim` sai 0.
        # O total mal se mexe — a batida encurta na mesma proporção.
        for round_number in range(2, self.last_round + 1):
            animations = self.update_rows(rows, clubs, round_number)
            if band is not None:
                animations.append(
                    band.animate.move_to([band.get_center()[0], self.focus_y(clubs, round_number), 0])
                )
            animations.append(Transform(heading, self.round_heading(round_number)))
            self.play(*animations, run_time=0.45)
            self.wait(0.16)

        self.play(FadeIn(self.build_closing(clubs), shift=UP * 0.14), run_time=0.9)
        self.wait(2.8)

    # ---- geometry -----------------------------------------------------------

    def head_x(self, width: float) -> float:
        """Left-aligned with the drawing's own left edge, whatever the cut."""
        return POS_X - 0.34 + width / 2

    def slot_y(self, position: int) -> float:
        return ROW_TOP - (position - 1) / (CLUBS_IN_DIVISION - 1) * (ROW_TOP - ROW_BOTTOM)

    def cut_y(self, position: int) -> float:
        """Halfway between a position's slot and the next one down."""
        return (self.slot_y(position) + self.slot_y(position + 1)) / 2

    def slot_gap(self) -> float:
        """A altura de um posto. Derivada do bloco do corte, nunca escrita à
        mão a quarta vez — é o que a faixa e a barra de foco medem contra."""
        return (ROW_TOP - ROW_BOTTOM) / (CLUBS_IN_DIVISION - 1)

    def focus_y(self, clubs, round_number: int) -> float:
        """Onde a linha do clube em foco está naquela rodada."""
        club = next(c for c in clubs if c["code"] == self.focus)
        return self.slot_y(club["by_round"][round_number]["position"])

    def build_band(self, clubs):
        """A faixa que anda com o clube do torcedor — ver o docstring.

        `None` quando não há foco, que é o corte base: a cena então não ganha
        um mobject invisível para animar vinte e seis vezes.
        """
        if self.focus is None:
            return None
        club = next(c for c in clubs if c["code"] == self.focus)
        left, right = POS_X - 0.34, BAR_RIGHT + 0.06
        return Rectangle(
            width=right - left,
            height=self.slot_gap() * 0.92,
            stroke_width=0,
            fill_color=club["colour"],
            fill_opacity=BAND_OPACITY,
        ).move_to([(left + right) / 2, self.focus_y(clubs, 1), 0])

    def bar_width(self, points: int) -> float:
        return points / self.top_points * (BAR_RIGHT - BAR_LEFT)

    def build_frame(self) -> tuple[VGroup, VGroup, VGroup]:
        slots = VGroup()
        for position in range(1, CLUBS_IN_DIVISION + 1):
            tag = label(ordinal(position), 13 if VERTICAL else 14, INK_SOFT)
            tag.move_to([POS_X - tag.width / 2, self.slot_y(position), 0])
            slots.add(tag)

        # As zonas, em filete e não em cor — ver o docstring do módulo.
        zones = VGroup()
        for cut, name in ((G4_CUT, "G4"), (Z4_CUT, "Z4")):
            y = self.cut_y(cut)
            zones.add(
                Line(
                    [POS_X - 0.34, y, 0],
                    [BAR_RIGHT + 0.06, y, 0],
                    stroke_color=INK_FAINT,
                    stroke_width=1.4,
                    stroke_opacity=0.85,
                )
            )
            tag = label(name, 11 if VERTICAL else 12, INK_SOFT)
            tag.move_to([BAR_RIGHT + 0.06 + tag.width / 2 + 0.10, y, 0])
            zones.add(tag)

        # A régua dos pontos, embaixo das barras: a grade sobe por trás delas.
        axis = VGroup()
        base_y = ROW_BOTTOM - AXIS_Y_GAP
        for points in range(0, self.top_points + 1, POINTS_STEP):
            x = BAR_LEFT + self.bar_width(points)
            axis.add(
                Line(
                    [x, ROW_TOP + 0.18, 0],
                    [x, base_y + 0.10, 0],
                    stroke_color=INK_FAINT,
                    stroke_width=1,
                    stroke_opacity=0.20,
                )
            )
            tick = label(str(points), 12 if VERTICAL else 13, INK_SOFT)
            tick.move_to([x, base_y - 0.06, 0])
            axis.add(tick)

        # **A unidade fica no PÉ do eixo, à direita do último tique**, que é
        # onde o `pontos.py` põe o "rodada" do seu eixo x — e é o que desocupa a
        # faixa do topo, onde o título, o subtítulo, a rodada e a nota de fecho
        # já disputam espaço. Na primeira versão ela ficava lá em cima e caía
        # em cima do subtítulo.
        unit = label("pontos", 12 if VERTICAL else 13, INK_SOFT)
        unit.next_to([BAR_LEFT + self.bar_width(self.top_points), base_y - 0.06, 0], RIGHT, buff=0.22)
        axis.add(unit)
        return slots, zones, axis

    # ---- as barras ----------------------------------------------------------

    def build_rows(self, clubs) -> dict:
        """One row per club: the name, the bar, the number at its tip.

        Three loose mobjects rather than a `VGroup`, for `pontos.py`'s reason:
        the beat moves the row and rewrites the number at the same time, and an
        animation on a group and one on its own submobject are two animations
        fighting over the same mobject.
        """
        rows = {}
        for club in clubs:
            entry = club["by_round"][1]
            y = self.slot_y(entry["position"])
            rows[club["code"]] = {
                "name": self.name_label(club, y),
                "bar": self.bar(club, entry["points"], y),
                "points": self.points_label(club, entry["points"], y),
            }
        return rows

    def name_label(self, club, y: float) -> Text:
        """O nome do clube, e o peso é o que diz de quem é o vídeo.

        No corte base todos os vinte são `INK` normal. Com foco, o clube ganha
        o **peso** e os outros descem para `INK_SOFT` — que é tom de TEXTO
        nesta paleta (subtítulo, ordinais, tiques, crédito), ao contrário do
        `INK_FAINT`, que é régua. Ver o docstring do módulo.
        """
        focused = club["code"] == self.focus
        if self.focus is None:
            name = label(club["name"], NAME_SIZE, INK)
        elif focused:
            name = label(club["name"], NAME_SIZE, INK, "BOLD")
        else:
            name = label(club["name"], NAME_SIZE, INK_SOFT)
        name.move_to([NAME_X + name.width / 2, y, 0])
        return name

    def bar(self, club, points: int, y: float) -> Rectangle:
        """A rectangle anchored at the axis origin, growing to the right.

        Zero points is drawn as a hairline at zero opacity rather than as a
        stub: the mobject has to exist for the next rodada to transform it, and
        a visible minimum would report a club that had scored. See the docstring.
        """
        width = max(self.bar_width(points), 0.002)
        focused = club["code"] == self.focus
        # Zero continua sendo zero em qualquer corte, e a opacidade é a mesma
        # para os vinte: o foco muda a ALTURA e nada mais aqui — ver o
        # comentário do `BAND_OPACITY` para o que aconteceu quando recuava.
        return Rectangle(
            width=width,
            height=FOCUS_BAR_H if focused else BAR_H,
            stroke_width=0,
            fill_color=club["colour"],
            fill_opacity=1.0 if points > 0 else 0.0,
        ).move_to([BAR_LEFT + width / 2, y, 0])

    def points_label(self, club, points: int, y: float) -> Text:
        """O número na ponta da barra, em `INK` e **nunca na cor do clube**.

        A primeira versão pintava cada número na cor da sua barra, e isso foi
        MEDIDO em vez de deduzido: contra o `SURFACE`, o grená do Fluminense
        entrega **3,53:1** e o marrom do Vitória **4,10:1**, os dois abaixo do
        piso de 4,5 que este projeto exige de texto — e o vermelho do Flamengo
        raspa em 4,79, que o h.264 come num algarismo estreito (o `0` de uma
        cena irmã mediu 2,96 onde a paleta prometia 3,36). Como MARCA a barra
        passa, porque o piso de um traço é 3; como TEXTO o número não passa.

        Clarear os dois tons resolveria o contraste e quebraria a regra que o
        `README.md` põe acima dele — a paleta vem do `pontos.py` sem reescrita,
        que é o que impede dois vídeos deste projeto de discordarem sobre a cor
        de um clube. Então quem muda é o texto: a barra carrega a identidade, o
        número carrega o dado, e a ligação entre os dois é a posição — o número
        encosta na ponta da sua própria barra.

        **No corte de torcedor os outros dezenove descem para `INK_SOFT`**, que
        é tom de texto nesta paleta, e **nunca para `INK_FAINT`** — esse é
        régua, e usá-lo como texto é o defeito que as três cenas já tiveram,
        medido em 2,9–3,3:1 contra o piso de 4,5. O clube em foco fica em `INK`.
        """
        colour = INK if (self.focus is None or club["code"] == self.focus) else INK_SOFT
        text = label(str(points), PTS_SIZE, colour, "BOLD")
        text.move_to([BAR_LEFT + self.bar_width(points) + 0.12 + text.width / 2, y, 0])
        return text

    def update_rows(self, rows, clubs, round_number: int) -> list:
        """As três animações de uma rodada, e cada uma é de um tipo diferente
        por uma razão.

        O **nome** só anda: o texto é o mesmo, então `.animate.move_to` desloca
        o mobject, enquanto um `Transform` interpolaria os contornos das letras
        de um mesmo nome para chegar ao mesmo lugar. Ele só entra na lista se o
        clube trocou de posto — a economia do `pontos.py`, e são 20 clubes
        vezes 24 rodadas.

        A **barra** e o **número** são `Transform` porque mudam de fato: a
        barra muda de largura e de altura na tela, o número muda de conteúdo.
        """
        animations = []
        for club in clubs:
            entry = club["by_round"][round_number]
            previous = club["by_round"][round_number - 1]
            y = self.slot_y(entry["position"])
            row = rows[club["code"]]

            if entry["position"] != previous["position"]:
                animations.append(
                    row["name"].animate.move_to([NAME_X + row["name"].width / 2, y, 0])
                )
            animations.append(Transform(row["bar"], self.bar(club, entry["points"], y)))
            animations.append(
                Transform(row["points"], self.points_label(club, entry["points"], y))
            )
        return animations

    # ---- os rótulos do quadro -----------------------------------------------

    def round_heading(self, round_number: int) -> Text:
        heading = label(f"Rodada {round_number}", HEAD_SIZE, INK, "BOLD")
        heading.move_to([BAR_RIGHT + 0.20 - heading.width / 2, HEAD_Y, 0])
        return heading

    def build_credit(self) -> Text:
        """De onde o vídeo veio.

        Um vídeo de divulgação é visto fora daqui — recortado, reencaminhado,
        sem a descrição junto —, então o endereço fica no quadro do começo ao
        fim. Sem o `https://`, que é como se lê e se digita um endereço.
        """
        credit = label(SITE, 16 if VERTICAL else 17, INK_SOFT)
        credit.move_to([(POS_X + BAR_RIGHT) / 2, CREDIT_Y, 0])
        return credit

    def build_closing(self, clubs) -> VGroup:
        """Quem lidera, por quanto, e sobre quantos jogos — contado das rodadas
        que o vídeo acabou de desenhar, então não pode discordar do desenho.

        **A cláusula dos jogos é a razão de a nota existir, e não um enfeite ao
        lado do que importa.** O último quadro de uma corrida de barras JÁ É a
        classificação — diz o líder, os pontos e a diferença melhor do que
        qualquer prosa —, então uma nota que repetisse isso seria redundante e
        ainda taparia o desenho, que é o que este módulo recusa. O que o desenho
        NÃO consegue dizer é quantas partidas cada barra cobre: neste recorte
        metade da divisão tem um jogo a menos, e duas barras de comprimentos
        diferentes sobre amostras diferentes é uma leitura errada — a armadilha
        que o `live-core.ts` recusa para o minuto da partida.

        **Ela mora numa faixa que o corte reserva, nunca colada no desenho.** A
        primeira versão punha a nota em `slot_y(1) + 0.46` e ela caía em cima do
        subtítulo, no 16:9, com o `manim` saindo 0 e nada acusando — o defeito
        que só aparece abrindo o quadro.
        """
        standing = sorted(clubs, key=lambda club: club["by_round"][self.last_round]["position"])

        def jogos(n: int) -> str:
            return "um jogo" if n == 1 else f"{n} jogos"

        def spare_clause(other_at, subject_at) -> str:
            """Quantos jogos o OUTRO tem a mais ou a menos que o sujeito."""
            spare = other_at["played"] - subject_at["played"]
            if spare < 0:
                return f", que tem {jogos(-spare)} a menos"
            if spare > 0:
                return f", que tem {jogos(spare)} a mais"
            return ""

        # **O sujeito da nota é o clube do foco, e o líder só por acaso.** Um
        # vídeo de torcedor que fecha falando do líder fecha falando do rival
        # em dezenove dos vinte clubes.
        subject = (
            next(club for club in standing if club["code"] == self.focus)
            if self.focus is not None
            else standing[0]
        )
        subject_at = subject["by_round"][self.last_round]
        position = subject_at["position"]

        if position == 1:
            rival = standing[1]
            rival_at = rival["by_round"][self.last_round]
            gap = subject_at["points"] - rival_at["points"]
            headline = f"{subject['name']} lidera com {subject_at['points']} pontos"
            if gap == 0:
                detail = f"empatado com o {rival['name']} nos critérios de desempate"
            else:
                detail = f"{gap} à frente do {rival['name']}" + spare_clause(rival_at, subject_at)
        else:
            # **O corte da Chapecoense (`1772`) é o que desenha este ramo** —
            # foi a primeira vez, e a nota saiu quebrada em duas linhas até o
            # `one_line_label`. Renderize um quadro dele antes de mexer aqui.
            rival = standing[position - 2]
            rival_at = rival["by_round"][self.last_round]
            gap = rival_at["points"] - subject_at["points"]
            headline = f"{subject['name']} em {ordinal(position)} com {subject_at['points']} pontos"
            if gap == 0:
                detail = f"empatado com o {rival['name']} nos critérios de desempate"
            else:
                detail = f"{gap} atrás do {rival['name']}" + spare_clause(rival_at, subject_at)

        headline += f" em {jogos(subject_at['played'])}"
        leader = subject

        lines = [headline, detail] if CLOSING_LINES == 2 else [f"{headline} — {detail}"]
        # **A nota é RECUADA e o filete ocupa o recuo**, e isso é a borda do
        # quadro e não estética: o título e o subtítulo já começam em
        # `POS_X - 0.34`, a 0,05 unidade da borda esquerda do 16:9, então um
        # filete à esquerda DELES cai fora do quadro. A primeira versão fez
        # exatamente isso — o filete foi desenhado em `x = -7,22` contra uma
        # borda em `-7,111`, o `manim` saiu 0, e no quadro não havia filete
        # nenhum. Recuar a nota é o que abre o vão para ele.
        left = POS_X - 0.10
        note = VGroup()
        for index, text in enumerate(lines):
            row = one_line_label(text, CLOSING_SIZE, INK, "BOLD")
            row.move_to([left + row.width / 2, CLOSING_Y - index * 0.26, 0])
            note.add(row)

        # **A cor do líder entra como FILETE e não como tinta do texto**, pela
        # razão medida no `points_label`: dois dos vinte tons não passam do piso
        # de 4,5 como texto. Hoje quem lidera é o Palmeiras, que passa com folga
        # — e é exatamente essa a armadilha, porque a nota ficaria ilegível no
        # dia em que o líder fosse o Fluminense e nada aqui acusaria. É a mesma
        # forma do `ink-faint` sobre `surface-container` que o `CLAUDE.md`
        # registra: correto hoje, e uma armadilha armada para depois. O filete é
        # a marca da cor do clube, e a marca tem piso 3.
        rule = Line(
            [left - 0.18, note.get_top()[1] - 0.02, 0],
            [left - 0.18, note.get_bottom()[1] + 0.02, 0],
            stroke_color=leader["colour"],
            stroke_width=4.0,
        )
        return VGroup(rule, note)
