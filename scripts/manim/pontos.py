"""
Os 20 clubes, rodada a rodada: pontos no eixo y, rodada no eixo x.

    manim -qh scripts/manim/pontos.py Pontos

The sibling `campanhas.py` draws two clubs' *positions*; this draws the whole
division's *points*. They are two readings of one campanha, and neither
recomputes a standing — the data is `scripts/manim/pontos.json`, written by
`export-pontos.ts` out of `rank-history.ts`. A number wrong here is wrong on the
site too, which is what a divulgação piece should be.

**Twenty lines need a key that works while the video is playing, and an end
label is not it.** A label at the end of each line only exists in the last
second, and until then the drawing is twenty anonymous curves. So the right hand
side carries the classificação itself, ordered live: each club's row slides to
its new place as the rounds land, and its swatch is the same mark, in the same
colour, as its line. The reordering is also the comparison the chart cannot make
— points say how far apart two clubs are, the order says who is ahead.

**The position column is static and the ROWS move through it.** Drawing "1º…20º"
as part of each row would animate twenty ordinals into each other every round to
end up spelling the same twenty words; the slot is what carries the position, so
the ordinals are painted once and never move.

**The y axis starts at zero and the x axis at rodada 0.** Points are cumulative,
so every club leaves the same origin and the drawing is a fan opening from one
point — that is the whole shape of a season. A y axis cropped to 14–52 would
make the bottom club look like it has nothing, which is the zero rule
`sparklineBars` states in `CLAUDE.md`.

**The frame is drawn by hand rather than with `Axes`**, for `campanhas.py`'s
reason: `at()` is the entire coordinate system, written once.

**Every label goes through `label()` rather than `Text`**, also for
`campanhas.py`'s reason — Manim's glyph advances round to the pixel, so below
roughly 20pt the space advance rounds to zero and words run together. This scene
draws almost everything below 20pt, so it is not an edge case here.
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
    Dot,
    FadeIn,
    FadeOut,
    Line,
    Rectangle,
    RoundedRectangle,
    Scene,
    Text,
    Transform,
    VGroup,
)

DATA = Path(os.environ.get("PONTOS_JSON", Path(__file__).with_name("pontos.json")))

FONT = "Inter"
TYPE_OVERSAMPLE = 4

INK = "#E6EAE8"
INK_SOFT = "#9AA5A0"
# **`INK_FAINT` é para RÉGUA, nunca para TEXTO.** Medido nos pixels do próprio
# mp4, não deduzido da paleta: sobre o `SURFACE` este tom entrega 3,2:1 e sobre o
# `CARD` 2,9:1, abaixo do piso de 4,5 que este projeto exige de texto, em tipo de
# 18px que num celular vira cerca de 2 mm. A paleta destas cenas é escrita à mão,
# então o `test:tokens` nunca olhou para ela e nada acusou. Grade, moldura e
# filete continuam aqui, que é o que este tom serve para fazer.
INK_FAINT = "#5C6763"
SURFACE = "#0B100E"
CARD = "#161F1B"

# One colour per club, keyed by the provider's numeric code — never `tla`, which
# Corinthians and Coritiba share.
#
# **Distinguishable first, club-identifying second, and that order is the
# decision.** Twenty clubs in this division share about six colours between
# them: five wear red, four wear black-and-white, three wear blue. A palette
# faithful to the shirts draws four indistinguishable lines and calls it
# accuracy. So each club gets the nearest free hue to its own — Mirassol keeps
# its yellow, Palmeiras its green, Flamengo its red, Fluminense its grená — and
# the clubs whose colour was already taken are moved along the wheel rather than
# doubled up. The black-and-white sides take the greys, which is as close as a
# dark surface allows: black is the background.
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

CLUBS_IN_DIVISION = 20

# The plot's box, in scene units. Everything inside it goes through `at()`.
PLOT_LEFT, PLOT_RIGHT = -6.30, 1.30
PLOT_TOP, PLOT_BOTTOM = 2.55, -3.20

# The classificação beside it. The rows slide between these slots.
SLOT_TOP, SLOT_BOTTOM = 2.46, -3.16
POS_X = 2.10  # right edge of the ordinal
SWATCH_X = 2.42  # centre of the swatch
NAME_X = 2.70  # left edge of the name
PTS_X = 6.92  # right edge of the points

POINTS_STEP = 10

# O endereço do site. Escrito à mão porque o `APP_URL` mora no `.env` do host,
# que é gitignored e não existe na estação onde a cena é desenhada.
SITE = "brasileirao.mpbarbosa.com"


def label(text: str, size: float, colour: str, weight: str = "NORMAL") -> Text:
    """A line of type, drawn oversized and scaled down. See the module docstring."""
    return Text(
        text,
        font=FONT,
        font_size=size * TYPE_OVERSAMPLE,
        color=colour,
        weight=weight,
    ).scale(1 / TYPE_OVERSAMPLE)


def ordinal(position: int) -> str:
    return f"{position}º"


class Pontos(Scene):
    def construct(self) -> None:
        self.camera.background_color = SURFACE

        payload = json.loads(DATA.read_text(encoding="utf-8"))
        clubs = payload["clubs"]
        for club in clubs:
            club["colour"] = CLUB_COLOURS.get(club["code"], FALLBACK_COLOUR)
            club["by_round"] = {entry["round"]: entry for entry in club["rounds"]}

        self.last_round = max(entry["round"] for club in clubs for entry in club["rounds"])
        top_points = max(entry["points"] for club in clubs for entry in club["rounds"])
        # Round the axis up to the next full step, so the leader's line ends
        # inside the frame rather than on its edge.
        self.top_points = ((top_points // POINTS_STEP) + 1) * POINTS_STEP

        title = label("Os 20 clubes, rodada a rodada", 34, INK, "BOLD")
        title.move_to([PLOT_LEFT + title.width / 2, 3.56, 0])
        subtitle = label(
            f"pontos conquistados · Brasileirão Série A · dados até {payload['snapshot']}",
            16,
            INK_SOFT,
        )
        subtitle.move_to([PLOT_LEFT + subtitle.width / 2, 3.16, 0])
        self.play(FadeIn(title, shift=DOWN * 0.18), FadeIn(subtitle), run_time=0.9)

        frame, grid, ticks = self.build_plot()
        self.play(Create(frame), FadeIn(grid), FadeIn(ticks), run_time=1.0)

        # The classificação starts in the order the first round leaves it, so
        # nothing has to be shuffled before the first beat.
        slots = self.build_slots()
        row_group, rows = self.build_rows(clubs)
        round_heading = self.round_heading(1)
        self.play(
            FadeIn(slots),
            FadeIn(row_group),
            FadeIn(round_heading),
            FadeIn(self.build_credit()),
            run_time=0.8,
        )

        marker = Line(
            self.at(1, 0),
            self.at(1, self.top_points),
            stroke_color=INK,
            stroke_width=1.4,
            stroke_opacity=0.30,
        )
        # Every club leaves rodada 0 on zero points: the fan's single origin.
        origin = Dot(self.at(0, 0), radius=0.045, color=INK_FAINT)
        first = VGroup()
        for club in clubs:
            entry = club["by_round"][1]
            first.add(
                Line(
                    self.at(0, 0),
                    self.at(1, entry["points"]),
                    color=club["colour"],
                    stroke_width=3.2,
                )
            )
        self.play(FadeIn(marker), FadeIn(origin), Create(first), run_time=0.7)

        for round_number in range(2, self.last_round + 1):
            animations = []
            segments = VGroup()
            for club in clubs:
                previous = club["by_round"][round_number - 1]
                current = club["by_round"][round_number]
                segments.add(
                    Line(
                        self.at(previous["round"], previous["points"]),
                        self.at(current["round"], current["points"]),
                        color=club["colour"],
                        stroke_width=3.2,
                    )
                )
            animations.append(Create(segments))
            animations.extend(self.update_rows(rows, clubs, round_number))
            animations.append(marker.animate.move_to(self.marker_position(round_number)))

            replacement = self.round_heading(round_number)
            animations.append(Transform(round_heading, replacement))

            self.play(*animations, run_time=0.55)

        self.play(FadeOut(marker), run_time=0.3)
        closing = self.build_closing(clubs)
        self.play(FadeIn(closing, shift=UP * 0.14), run_time=0.9)
        self.wait(2.8)

    # ---- geometry -----------------------------------------------------------

    def at(self, round_number: float, points: float):
        """A rodada and a points total as a point in the scene.

        The one place the two conventions live: rodada 0 is the left edge and
        the last rodada the right, zero points the bottom edge and `top_points`
        the top. Unlike `campanhas.py` neither axis is negated, because more
        points really is higher.
        """
        x = PLOT_LEFT + round_number / self.last_round * (PLOT_RIGHT - PLOT_LEFT)
        y = PLOT_BOTTOM + points / self.top_points * (PLOT_TOP - PLOT_BOTTOM)
        return [x, y, 0]

    def marker_position(self, round_number: int):
        return [self.at(round_number, 0)[0], (PLOT_TOP + PLOT_BOTTOM) / 2, 0]

    def slot_y(self, position: int) -> float:
        return SLOT_TOP - (position - 1) / (CLUBS_IN_DIVISION - 1) * (SLOT_TOP - SLOT_BOTTOM)

    def build_plot(self) -> tuple[Rectangle, VGroup, VGroup]:
        frame = Rectangle(
            width=PLOT_RIGHT - PLOT_LEFT,
            height=PLOT_TOP - PLOT_BOTTOM,
            stroke_color=INK_FAINT,
            stroke_width=1.6,
            fill_opacity=0,
        ).move_to([(PLOT_LEFT + PLOT_RIGHT) / 2, (PLOT_TOP + PLOT_BOTTOM) / 2, 0])

        grid, ticks = VGroup(), VGroup()
        for points in range(POINTS_STEP, self.top_points + 1, POINTS_STEP):
            grid.add(
                Line(
                    self.at(0, points),
                    self.at(self.last_round, points),
                    stroke_color=INK_FAINT,
                    stroke_width=1,
                    stroke_opacity=0.26,
                )
            )
        for points in range(0, self.top_points + 1, POINTS_STEP):
            tick = label(str(points), 14, INK_SOFT)
            tick.next_to(self.at(0, points), LEFT, buff=0.16)
            ticks.add(tick)

        for round_number in range(5, self.last_round + 1, 5):
            grid.add(
                Line(
                    self.at(round_number, 0),
                    self.at(round_number, self.top_points),
                    stroke_color=INK_FAINT,
                    stroke_width=1,
                    stroke_opacity=0.18,
                )
            )
        for round_number in [1] + list(range(5, self.last_round + 1, 5)):
            tick = label(str(round_number), 14, INK_SOFT)
            tick.next_to(self.at(round_number, 0), DOWN, buff=0.14)
            ticks.add(tick)

        axis_x = label("rodada", 14, INK_SOFT)
        axis_x.move_to([PLOT_RIGHT - axis_x.width / 2, PLOT_BOTTOM - 0.58, 0])
        axis_y = label("pontos", 14, INK_SOFT)
        axis_y.move_to([PLOT_LEFT - 0.06 - axis_y.width / 2, PLOT_TOP + 0.26, 0])
        ticks.add(axis_x, axis_y)

        return frame, grid, ticks

    # ---- the classificação beside the plot ----------------------------------

    def build_slots(self) -> VGroup:
        """The position column, painted once. See the module docstring."""
        slots = VGroup()
        for position in range(1, CLUBS_IN_DIVISION + 1):
            tag = label(ordinal(position), 14, INK_SOFT)
            tag.move_to([POS_X - tag.width / 2, self.slot_y(position), 0])
            slots.add(tag)
        return slots

    def build_rows(self, clubs) -> tuple[VGroup, dict]:
        """One row per club: a swatch in the line's own colour, the name, the points.

        Kept as three loose mobjects rather than a `VGroup`, because the round
        beat moves the row and *transforms* the points at the same time — and an
        animation on a group and one on its own submobject are two animations
        fighting over the same mobject.
        """
        rows = {}
        for club in clubs:
            entry = club["by_round"][1]
            y = self.slot_y(entry["position"])

            swatch = Line(
                [SWATCH_X - 0.12, y, 0],
                [SWATCH_X + 0.12, y, 0],
                color=club["colour"],
                stroke_width=4.5,
            )
            name = label(club["name"], 14, INK)
            name.move_to([NAME_X + name.width / 2, y, 0])
            points = self.points_label(entry["points"], y)

            rows[club["code"]] = {"swatch": swatch, "name": name, "points": points}
        return VGroup(*[part for row in rows.values() for part in row.values()]), rows

    def points_label(self, points: int, y: float) -> Text:
        text = label(str(points), 15, INK, "BOLD")
        text.move_to([PTS_X - text.width / 2, y, 0])
        return text

    def update_rows(self, rows, clubs, round_number: int) -> list:
        animations = []
        for club in clubs:
            entry = club["by_round"][round_number]
            previous = club["by_round"][round_number - 1]
            row = rows[club["code"]]
            y = self.slot_y(entry["position"])

            if entry["position"] != previous["position"]:
                animations.append(row["swatch"].animate.move_to([SWATCH_X, y, 0]))
                animations.append(
                    row["name"].animate.move_to([NAME_X + row["name"].width / 2, y, 0])
                )

            # The points text is replaced rather than moved even when the club
            # holds its place, because the number itself changes on any round it
            # took a point.
            animations.append(Transform(row["points"], self.points_label(entry["points"], y)))
        return animations

    def build_credit(self) -> Text:
        """De onde o vídeo veio.

        Um vídeo de divulgação é visto fora daqui — recortado, reencaminhado,
        sem a descrição junto —, então o endereço fica no quadro do começo ao
        fim. Sem o `https://`, que é como se lê e se digita um endereço.
        """
        credit = label(SITE, 17, INK_SOFT)
        credit.move_to([(POS_X + PTS_X) / 2, -3.62, 0])
        return credit

    def round_heading(self, round_number: int) -> Text:
        heading = label(f"Rodada {round_number}", 22, INK, "BOLD")
        heading.move_to([(POS_X + PTS_X) / 2, 3.10, 0])
        return heading

    # ---- the closing note ---------------------------------------------------

    def build_closing(self, clubs) -> VGroup:
        """Who leads, by how much, and whether the gap is a real one.

        Counted from the rounds the video just drew rather than written down, so
        it cannot disagree with the drawing. The games-played clause is not a
        flourish: two clubs on the same rodada can have played a different
        number of matches, and a points gap read without that is a wrong
        reading, which is the trap `live-core.ts` refuses for the match minute.

        **The detail is two short lines rather than one long one, and that is
        placement rather than typography.** The panel goes in the drawing's only
        empty region — see `place_closing` — and that region is bounded above by
        the frame and below by the leader's own line, so the panel's WIDTH is
        what decides whether it fits. One line of prose made it nearly as wide as
        the plot, which pushed its right edge out to rodada 24 and its lower edge
        straight through the leader's last four rounds: the climb the whole video
        is about, covered by the sentence describing it.
        """
        standing = sorted(clubs, key=lambda club: club["by_round"][self.last_round]["position"])
        leader, second = standing[0], standing[1]
        leader_at = leader["by_round"][self.last_round]
        second_at = second["by_round"][self.last_round]
        gap = leader_at["points"] - second_at["points"]

        headline = label(
            f"{leader['name']} · {leader_at['points']} pontos", 25, leader["colour"], "BOLD"
        )
        details = [
            f"{gap} à frente do {second['name']}"
            if gap
            else f"empatado em pontos com o {second['name']}"
        ]
        if second_at["played"] != leader_at["played"]:
            difference = abs(leader_at["played"] - second_at["played"])
            behind = second if leader_at["played"] > second_at["played"] else leader
            plural = "jogo" if difference == 1 else "jogos"
            details.append(f"e o {behind['name']} tem {difference} {plural} a menos")

        lines = VGroup(headline, *[label(text, 15, INK_SOFT) for text in details])
        lines.arrange(DOWN, buff=0.16)

        panel = RoundedRectangle(
            width=lines.width + 0.80,
            height=lines.height + 0.58,
            corner_radius=0.16,
            stroke_color=INK_FAINT,
            stroke_width=1.5,
            fill_color=CARD,
            fill_opacity=0.95,
        ).move_to(lines.get_center())

        closing = VGroup(panel, lines)
        self.place_closing(closing, clubs)
        return closing

    def place_closing(self, closing: VGroup, clubs) -> None:
        """Top left, above the leader's line — and *above* is computed, not chosen.

        **The bottom right looks like the empty corner and is not.** Points only
        ever go up, so every line passes through the lower right on its way out
        of rodada 1, while the region above the fan is empty by construction: at
        rodada 5 nobody has 45 points and nobody ever will.

        Which leaves one question the panel cannot be given a fixed answer to —
        *how far down* — because that is the leader's line, and the leader is
        different data every season. So the panel's own right edge is read back
        as a rodada, the best points total anybody holds by then is looked up,
        and the panel is floated above it. A fixed offset from the top of the
        frame was the first spelling and it covered four of Palmeiras' last
        rounds; nothing would have reported that but looking at the frame.
        """
        left = PLOT_LEFT + 0.34
        right_round = self.round_at(left + closing.width)
        highest = max(
            entry["points"]
            for club in clubs
            for entry in club["rounds"]
            if entry["round"] <= right_round
        )
        bottom = self.at(0, min(highest + 2, self.top_points))[1]
        top = min(bottom + closing.height, PLOT_TOP - 0.22)
        closing.move_to([left + closing.width / 2, top - closing.height / 2, 0])

    def round_at(self, x: float) -> float:
        """The inverse of `at()`'s x half. Used only to place the closing note."""
        return (x - PLOT_LEFT) / (PLOT_RIGHT - PLOT_LEFT) * self.last_round
