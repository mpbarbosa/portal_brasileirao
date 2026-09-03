"""
Campanha, rodada a rodada: two clubs' positions drawn as a line, with each
round's fixture and result beside it.

    manim -qh scripts/manim/campanhas.py Campanhas

The data is `scripts/manim/campanhas.json`, written by the sibling
`export-campanhas.ts` out of the app's own seed — so the drawing cannot invent a
position or a scoreline. Nothing here recomputes a standing; if a figure is wrong
it is wrong in `rank-history.ts` and wrong on the site too.

The y axis is the WHOLE division, 1º at the top, for `rank-candles-core.ts`'s
reason: a leader's line leaves the lower two thirds empty, and that is what makes
the G4 and Z4 bands mean anything.

**The plot frame is drawn by hand rather than with `Axes`, and that is not
taste.** Manim draws an `Axes`' x line at y=0 in data coordinates; positions are
plotted negated so that 1º is at the top, which puts 0 *outside* the range and
the axis line — arrow tip and all — along the top edge of the drawing, directly
through the leader's own line. `at()` is the whole coordinate system instead, so
the sign convention is written once and the frame is a rectangle that means what
it looks like.

**Every label goes through `label()` rather than `Text` directly**, for a reason
that is invisible until it is read: Manim lays glyphs out from a rasterisation
whose advances round to the pixel, so below roughly 20pt the *space* advance
rounds to zero and words run together. Measured with Inter on the subtitle —
legible at 32, `campanharodadaarodada` at 16, and the same collapse on every
`41 pts · 18 jogos` in the cards. Nothing errors and nothing in the API hints at
it; the only symptom is a frame you have to look at.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from manim import (
    DOWN,
    Succession,
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
    VGroup,
    Write,
)

TYPE_OVERSAMPLE = 4


def label(text: str, size: float, colour: str, weight: str = "NORMAL") -> Text:
    """A line of type, drawn oversized and scaled down.

    See the module docstring: at the sizes this scene actually uses, drawing at
    the nominal size loses the spaces between words. Same geometry, drawn where
    the rounding does not bite.
    """
    return Text(
        text,
        font=FONT,
        font_size=size * TYPE_OVERSAMPLE,
        color=colour,
        weight=weight,
    ).scale(1 / TYPE_OVERSAMPLE)

DATA = Path(os.environ.get("CAMPANHAS_JSON", Path(__file__).with_name("campanhas.json")))

FONT = "Inter"

# The app's own palette in spirit: a near-black surface, a card one tonal step
# up, and each club's colour for its own line. Written here rather than sampled
# from `index.css`, because a video is not a page and nothing regenerates these.
INK = "#E6EAE8"
INK_SOFT = "#9AA5A0"
INK_FAINT = "#5C6763"
SURFACE = "#0B100E"
CARD = "#161F1B"
POSITIVE = "#2ECC71"
WARNING = "#E8B931"
NEGATIVE = "#E5533D"

CLUB_COLOURS = {
    "1769": "#12B15E",  # Palmeiras
    "1783": "#E24B3C",  # Flamengo
}
FALLBACK_COLOURS = ["#12B15E", "#E24B3C", "#4C8DF6", "#E0A33B"]

RESULT_WORD = {"V": "Vitória", "E": "Empate", "D": "Derrota"}
RESULT_COLOUR = {"V": POSITIVE, "E": WARNING, "D": NEGATIVE}

CLUBS_IN_DIVISION = 20
NAMED_POSITIONS = (1, 4, 8, 12, 16, 20)

# The plot's box, in scene units. Everything inside it goes through `at()`.
PLOT_LEFT, PLOT_RIGHT = -6.15, 1.05
PLOT_TOP, PLOT_BOTTOM = 2.42, -2.62

CARD_X = 4.42
CARD_WIDTH = 5.05


def ordinal(position: int) -> str:
    return f"{position}º"


class Campanhas(Scene):
    def construct(self) -> None:
        self.camera.background_color = SURFACE

        payload = json.loads(DATA.read_text(encoding="utf-8"))
        clubs = payload["clubs"]
        for index, club in enumerate(clubs):
            club["colour"] = CLUB_COLOURS.get(club["code"], FALLBACK_COLOURS[index % len(FALLBACK_COLOURS)])

        self.last_round = max(entry["round"] for club in clubs for entry in club["rounds"])

        title = label(
            " × ".join(club["name"] for club in clubs), 38, INK, "BOLD"
        ).move_to([-2.55, 3.55, 0])
        subtitle = label(
            f"campanha rodada a rodada · Brasileirão Série A · dados até {payload['snapshot']}",
            16,
            INK_SOFT,
        )
        subtitle.next_to(title, DOWN, buff=0.16)

        self.play(FadeIn(title, shift=DOWN * 0.18), FadeIn(subtitle), run_time=0.9)

        frame, grid, labels = self.build_plot()
        bands, band_captions = self.build_bands()

        self.play(Create(frame), FadeIn(grid), FadeIn(labels), run_time=1.0)
        self.play(FadeIn(bands), FadeIn(band_captions), run_time=0.5)

        legend = self.build_legend(clubs)
        self.play(FadeIn(legend), run_time=0.45)

        round_label = self.round_label(clubs[0]["rounds"][0]["round"])
        cards = VGroup()
        for index, club in enumerate(clubs):
            card = self.build_card(club, club["rounds"][0])
            card.move_to([CARD_X, 0.85 - index * 2.42, 0])
            cards.add(card)

        self.play(FadeIn(round_label), *[FadeIn(card) for card in cards], run_time=0.7)

        # Round by round. Each round is one beat: the segment grows, the dot
        # lands, and both cards are replaced by the round they now describe.
        marker = Line(
            self.at(1, 0.5),
            self.at(1, CLUBS_IN_DIVISION + 0.5),
            stroke_color=INK,
            stroke_width=1.4,
            stroke_opacity=0.34,
        )
        dots = [self.dot_at(club, club["rounds"][0]) for club in clubs]
        self.play(FadeIn(marker), *[FadeIn(dot, scale=0.4) for dot in dots], run_time=0.4)

        for step in range(1, self.last_round):
            animations = []
            for index, club in enumerate(clubs):
                previous, current = club["rounds"][step - 1], club["rounds"][step]
                segment = Line(
                    self.at(previous["round"], previous["position"]),
                    self.at(current["round"], current["position"]),
                    color=club["colour"],
                    stroke_width=4.5,
                )
                animations.append(Create(segment))
                animations.append(FadeIn(self.dot_at(club, current), scale=0.5))

                replacement = self.build_card(club, current)
                replacement.move_to(cards[index].get_center())
                # Sequenced, never concurrent: `self.play(..., run_time=...)`
                # stretches every animation it is given to the full beat, so a
                # FadeOut and a FadeIn passed side by side overlap for the whole
                # of it and the round's two scorelines are legible at once.
                animations.append(
                    Succession(FadeOut(cards[index], run_time=0.2), FadeIn(replacement, run_time=0.4))
                )
                cards.submobjects[index] = replacement

            new_label = self.round_label(clubs[0]["rounds"][step]["round"])
            animations.append(Succession(FadeOut(round_label, run_time=0.2), FadeIn(new_label, run_time=0.4)))
            round_label = new_label

            animations.append(marker.animate.move_to(self.marker_position(clubs[0]["rounds"][step]["round"])))

            self.play(*animations, run_time=0.6)

        self.wait(0.5)

        self.play(FadeOut(marker), run_time=0.3)
        summary = self.build_summary(clubs)
        self.play(FadeIn(summary, shift=UP * 0.16), run_time=0.9)
        self.wait(2.8)

    # ---- geometry -----------------------------------------------------------

    def at(self, round_number: float, position: float):
        """A round and a position as a point in the scene.

        The one place the two conventions live: rounds run 0.5 … last+0.5 across
        the box, and a *lower* position number is *higher* on the screen, so 1º
        is the top edge rather than the bottom.
        """
        x = PLOT_LEFT + (round_number - 0.5) / self.last_round * (PLOT_RIGHT - PLOT_LEFT)
        y = PLOT_TOP - (position - 0.5) / CLUBS_IN_DIVISION * (PLOT_TOP - PLOT_BOTTOM)
        return [x, y, 0]

    def dot_at(self, club, entry) -> Dot:
        return Dot(self.at(entry["round"], entry["position"]), radius=0.05, color=club["colour"])

    def build_plot(self) -> tuple[Rectangle, VGroup, VGroup]:
        frame = Rectangle(
            width=PLOT_RIGHT - PLOT_LEFT,
            height=PLOT_TOP - PLOT_BOTTOM,
            stroke_color=INK_FAINT,
            stroke_width=1.6,
            fill_opacity=0,
        ).move_to([(PLOT_LEFT + PLOT_RIGHT) / 2, (PLOT_TOP + PLOT_BOTTOM) / 2, 0])

        grid = VGroup()
        for position in NAMED_POSITIONS[1:]:
            grid.add(
                Line(
                    self.at(0.5, position),
                    self.at(self.last_round + 0.5, position),
                    stroke_color=INK_FAINT,
                    stroke_width=1,
                    stroke_opacity=0.28,
                )
            )
        for round_number in range(5, self.last_round + 1, 5):
            grid.add(
                Line(
                    self.at(round_number, 0.5),
                    self.at(round_number, CLUBS_IN_DIVISION + 0.5),
                    stroke_color=INK_FAINT,
                    stroke_width=1,
                    stroke_opacity=0.2,
                )
            )

        labels = VGroup()
        # Only a few positions are named: twenty labels down a five-unit axis is
        # a grey column rather than a scale.
        for position in NAMED_POSITIONS:
            tick = label(ordinal(position), 15, INK_SOFT)
            tick.next_to(self.at(0.5, position), LEFT, buff=0.16)
            labels.add(tick)
        for round_number in [1] + list(range(5, self.last_round + 1, 5)):
            tick = label(str(round_number), 14, INK_FAINT)
            tick.next_to(self.at(round_number, CLUBS_IN_DIVISION + 0.5), DOWN, buff=0.15)
            labels.add(tick)

        caption = label("rodada", 14, INK_FAINT)
        caption.move_to([PLOT_RIGHT + 0.42, PLOT_BOTTOM - 0.3, 0])
        labels.add(caption)

        return frame, grid, labels

    def build_bands(self) -> tuple[VGroup, VGroup]:
        """G4 and Z4, drawn as bands rather than as lines.

        A band says *this is a region a club is in*, where a rule says *this is a
        threshold*; a campanha is read as which region a club sits in, so the band
        is the honest mark.
        """
        bands, captions = VGroup(), VGroup()
        for low, high, colour, caption in (
            (1, 4, POSITIVE, "G4"),
            (17, CLUBS_IN_DIVISION, NEGATIVE, "Z4"),
        ):
            top = self.at(0.5, low - 0.5)
            bottom = self.at(self.last_round + 0.5, high + 0.5)
            band = Rectangle(
                width=bottom[0] - top[0],
                height=top[1] - bottom[1],
                stroke_width=0,
                fill_color=colour,
                fill_opacity=0.10,
            ).move_to([(top[0] + bottom[0]) / 2, (top[1] + bottom[1]) / 2, 0])
            bands.add(band)

            # Nudged to the far edge of its own band rather than centred in it:
            # centred, G4's caption lands exactly where a leader's line runs.
            anchor = self.at(self.last_round + 0.5, high - 0.1 if low == 1 else low + 0.5)
            tag = label(caption, 14, colour)
            tag.set_opacity(0.8)
            tag.move_to([anchor[0] - 0.32, anchor[1], 0])
            captions.add(tag)
        return bands, captions

    def marker_position(self, round_number: int):
        return [self.at(round_number, 0.5)[0], (PLOT_TOP + PLOT_BOTTOM) / 2, 0]

    def build_summary(self, clubs) -> VGroup:
        """The closing panel: where each club finished, and how it got there.

        The record is counted from the rounds themselves rather than carried in
        the payload, so it cannot disagree with the cards the video just showed.
        """
        rows = VGroup()
        for club in clubs:
            final = club["rounds"][-1]
            tally = {"V": 0, "E": 0, "D": 0}
            for entry in club["rounds"]:
                if entry["match"]:
                    tally[entry["match"]["result"]] += 1

            name = label(club["name"], 20, club["colour"], "BOLD")
            standing = label(
                f"{ordinal(final['position'])} · {final['points']} pts", 20, INK, "BOLD"
            )
            record = label(f"{tally['V']}V · {tally['E']}E · {tally['D']}D", 17, INK_SOFT)
            row = VGroup(name, standing, record).arrange(RIGHT, buff=0.42)
            rows.add(row)
        rows.arrange(DOWN, buff=0.22, aligned_edge=LEFT)

        panel = RoundedRectangle(
            width=rows.width + 0.7,
            height=rows.height + 0.56,
            corner_radius=0.14,
            stroke_color=INK_FAINT,
            stroke_width=1.5,
            fill_color=CARD,
            fill_opacity=0.94,
        )
        panel.move_to(rows.get_center())
        summary = VGroup(panel, rows)
        summary.move_to(self.at(self.last_round * 0.62, 13.4))
        return summary

    def build_legend(self, clubs) -> VGroup:
        entries = VGroup()
        for club in clubs:
            swatch = Line(LEFT * 0.17, RIGHT * 0.17, color=club["colour"], stroke_width=5)
            name = label(club["name"], 17, INK_SOFT).next_to(swatch, RIGHT, buff=0.14)
            entries.add(VGroup(swatch, name))
        entries.arrange(RIGHT, buff=0.7)
        entries.move_to([(PLOT_LEFT + PLOT_RIGHT) / 2, PLOT_BOTTOM - 0.72, 0])
        return entries

    def round_label(self, round_number: int) -> Text:
        heading = label(f"Rodada {round_number}", 25, INK, "BOLD")
        heading.move_to([CARD_X, 2.66, 0])
        return heading

    # ---- the round's card ---------------------------------------------------

    def build_card(self, club, entry) -> VGroup:
        """One club's round: where it stands, and the match that put it there.

        Built fresh per round and faded in over its predecessor rather than
        transformed into it — the two differ in how many marks they carry (a
        postponed round has no scoreline at all), and morphing between mismatched
        groups reads as a glitch rather than as an update.
        """
        colour = club["colour"]
        frame = RoundedRectangle(
            width=CARD_WIDTH,
            height=2.02,
            corner_radius=0.16,
            stroke_color=INK_FAINT,
            stroke_width=1.5,
            fill_color=CARD,
            fill_opacity=1.0,
        )
        left = frame.get_left()[0] + 0.26
        right = frame.get_right()[0] - 0.26
        top = frame.get_top()[1] - 0.30
        bottom = frame.get_bottom()[1] + 0.30

        name = label(club["name"], 21, colour, "BOLD")
        name.move_to([left + name.width / 2, top, 0])

        position = label(ordinal(entry["position"]), 29, INK, "BOLD")
        position.move_to([right - position.width / 2, top, 0])

        body = VGroup(frame, name, position)

        match = entry["match"]
        if match is None:
            note = label("sem jogo nesta rodada", 18, INK_FAINT)
            note.move_to([frame.get_center()[0], frame.get_center()[1] - 0.05, 0])
            tally = label(f"{entry['points']} pts · {entry['played']} jogos", 16, INK_FAINT)
            tally.move_to([right - tally.width / 2, bottom, 0])
            body.add(note, tally)
            return body

        where = "casa" if match["home"] else "fora"
        score = label(f"{match['goalsFor']} × {match['goalsAgainst']}", 26, INK, "BOLD")
        versus = label(f"{match['opponent']} ({where})", 18, INK_SOFT)
        scoreline = VGroup(score, versus).arrange(RIGHT, buff=0.22)
        scoreline.move_to([left + scoreline.width / 2, frame.get_center()[1] - 0.02, 0])

        verdict = label(
            RESULT_WORD.get(match["result"], "—"),
            17,
            RESULT_COLOUR.get(match["result"], INK_SOFT),
            "BOLD",
        )
        verdict.move_to([left + verdict.width / 2, bottom, 0])

        tally = label(f"{entry['points']} pts · {entry['played']} jogos", 16, INK_FAINT)
        tally.move_to([right - tally.width / 2, bottom, 0])

        body.add(scoreline, verdict, tally)
        return body
