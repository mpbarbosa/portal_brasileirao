import {
  axisCaption,
  axisFigure,
  axisPhrase,
  profileScatter,
  quadrantLabel,
  quadrantParts,
  SCATTER_PAIRS,
  type ProfileScatter as Scatter,
  type ScatterAxis,
  type ScatterPairId,
  type ScatterPoint,
} from "@/scouts-core";
import { CLUBS_BY_CODE } from "@/src/data/clubs";
import type { ClubCode, ClubScouts } from "@/src/types";

/**
 * The box the drawing is laid out in, in its own units.
 *
 * **8:5 rather than the campanha's 2.4:1, and uniform scaling rather than
 * `preserveAspectRatio="none"`.** `RankCandles` may stretch because its marks
 * are filled rects, which a non-uniform scale changes the proportions of and
 * nothing else. A circle under the same treatment becomes an ellipse whose
 * eccentricity is a property of the reader's screen width, so this one scales
 * uniformly — and a squarer box is what keeps that legible on a phone, where a
 * 2.4:1 figure would be 125px tall.
 *
 * The figure is also **capped in width**, which uniform scaling makes
 * necessary: left to fill a desktop card it renders 700px wide and, at any
 * aspect that keeps a scatter readable, as tall again — a single chart taller
 * than the whole strip above it. Flattening the box instead would compress the
 * y axis and misreport the distance between two clubs, which is the one thing
 * this drawing is for.
 */
const BOX = { width: 320, height: 200 } as const;

/** The subject's mark, and everybody else's. Radii in box units. */
const DOT = { other: 4, subject: 6.5 } as const;

/**
 * The cap the drawing and its reading share.
 *
 * It belongs to both rather than to the drawing alone: with it on the box,
 * "mais finalizações" sat at the far right of a 700px card pointing at nothing,
 * half a card away from the axis it names. An axis label has to share the width
 * of its axis — and a reading measured against the drawing above it has to
 * share that column too, or the block reads as body copy that happens to follow
 * a chart.
 */
const COLUMN = "max-w-[28rem]";

interface ProfileScatterProps {
  division: ClubScouts[];
  clubCode: ClubCode;
  /**
   * Which pairing to draw. Required rather than defaulted: the page now carries
   * two of these, and a default is how the second one silently renders the
   * first one's axes when a prop is dropped in a refactor.
   */
  pair: ScatterPairId;
}

/**
 * **Ataque × defesa**: the twenty clubs on two axes at once, this one filled in.
 *
 * The strip above reports six rates one at a time, and this says the thing a
 * row cannot: a club that finalizes often *and* keeps its goalkeeper busy is
 * playing an open game, while one doing the first without the second is
 * controlling matches. Those two are identical on every row of the strip and sit
 * in opposite corners here.
 *
 * **No `<text>` inside the SVG.** A drawing that scales to its container scales
 * its type with it, so a label sized for a desktop is six pixels tall on a
 * phone — `RankCandles`' rule, and the reason the axes, the quadrant and this
 * club's own figures are all HTML around the box rather than marks inside it.
 *
 * That has a consequence worth stating rather than working around: **the other
 * nineteen dots are not named on the page.** Each carries a `<title>`, so a
 * pointer and a screen reader both reach it, and the drawing's job is to place
 * *this* club among the rest rather than to be a table of twenty. Naming a few —
 * the leaders, say — would pin which club happens to hold a value, which is the
 * assertion this repository has broken CI on twice.
 *
 * **What is general and what is about this club are two blocks, not one
 * paragraph**, and that is the whole of the caption's shape. It shipped as a
 * single run of prose — *"Cada ponto é um clube; o cheio é o Palmeiras, com
 * 10,4 finalizações por jogo e 3,1 defesas do goleiro por jogo — jogo aberto:
 * finaliza muito e o goleiro trabalha muito. As linhas tracejadas são as
 * medianas da divisão."* — in which a reader who wants this club's reading has
 * to step over how the drawing works to reach it, twice, since the two figures
 * on this page said it twice. How the marks work is now stated **once for the
 * section** by `ScatterKey`; what is left here is one club's reading, and the
 * accent rule down its left is what says so at a glance.
 */
export function ProfileScatter({ division, clubCode, pair }: ProfileScatterProps) {
  const scatter = profileScatter(division, clubCode, SCATTER_PAIRS[pair]);
  if (!scatter) return null;

  const subject = scatter.points.find((point) => point.subject);
  if (!subject) return null;

  const label = summarise(scatter, subject);
  const corner = quadrantParts(scatter);

  return (
    <figure data-scatter={scatter.points.length} data-scatter-pair={pair}>
      <div className={COLUMN}>
        {/* The drawing's own name, which it had nowhere before: a reader met the
            y axis as the topmost line and had to infer the pairing from its two
            ends. `h4` under the section's `h3` rather than a styled paragraph,
            so the outline and a screen reader's heading list carry it too — and
            one step lighter than the section heading, which it must not
            compete with. */}
        <h4 className="text-body-small font-medium text-ink-muted">{scatter.title}</h4>
        <p className="mt-1 text-label-small text-ink-faint">{axisCaption(scatter.y)}</p>

        {/* A grid rather than a flex row, so the x axis's own labels line up
            with the drawing instead of with the figure's left edge. In the flex
            version the row beneath spanned the y gutter as well, which put
            "menos finalizações" directly under the y axis's "menos" — two axes'
            labels stacked into what reads as one broken sentence, and the
            complaint that started this. `col-start-2` puts the row in the
            drawing's own column and needs no spacer cell; `minmax(0,1fr)` is
            what stops the svg widening the track past the cap above. */}
        <div className="mt-0.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
          {/* The y axis, as words rather than numbers. The domain is padded so
              that no mark is drawn half outside the frame, which means its ends
              are values no club actually has — printing `1,96` there would be a
              figure the drawing cannot support. */}
          <div className="flex shrink-0 flex-col justify-between text-label-small text-ink-faint">
            <span>mais</span>
            <span>menos</span>
          </div>

          <svg
            width={BOX.width}
            height={BOX.height}
            viewBox={`0 0 ${BOX.width} ${BOX.height}`}
            /* `w-full` is correct here and was wrong before: inside a grid
               track it is 100% of the track, where in the old flex row it was
               100% of the container rather than of what the gutter left — the
               way `RankCandles` came to paint outside its card. `h-auto` with
               the default `preserveAspectRatio` is what keeps the dots round. */
            className="h-auto w-full"
            role="img"
            aria-label={label}
            /* Named so the campanha's own specs can exclude it. This page now
               carries three `role="img"` drawings and two `<figure>`s, and a
               lookup written when there was one of each resolves to all of
               them — `data-candles` is the same device, one mark earlier. */
            data-scatter-svg={pair}
          >
            <title>{label}</title>

            {/* The two medians, which is what makes the four corners readable at
                all. Dashed and in the outline token for the reason the G4 and Z4
                guides are: they place the marks rather than being marks.
                `non-scaling-stroke` keeps them a hairline at every width. */}
            <line
              x1={BOX.width * scatter.x.medianAt}
              y1={0}
              x2={BOX.width * scatter.x.medianAt}
              y2={BOX.height}
              className="stroke-outline"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={0}
              y1={BOX.height * (1 - scatter.y.medianAt)}
              x2={BOX.width}
              y2={BOX.height * (1 - scatter.y.medianAt)}
              className="stroke-outline"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />

            {/* The subject last, so it is painted over its neighbours rather than
                under one of them — with twenty clubs on one box, two dots
                overlapping is ordinary and the reader's own club disappearing
                under another is not. */}
            {[...scatter.points]
              .sort((a, b) => Number(a.subject) - Number(b.subject))
              .map((point) => (
                <circle
                  key={point.clubCode}
                  cx={BOX.width * point.atX}
                  /* Inverted, because SVG y grows downward and "mais defesas"
                     reads as up. */
                  cy={BOX.height * (1 - point.atY)}
                  r={point.subject ? DOT.subject : DOT.other}
                  className={point.subject ? "fill-primary" : "fill-ink-ghost"}
                  data-scatter-point={point.subject ? "subject" : "other"}
                >
                  <title>{describe(scatter, point)}</title>
                </circle>
              ))}
          </svg>

          <p className="col-start-2 mt-1 flex justify-between text-label-small text-ink-faint">
            <span>menos {scatter.x.label.toLowerCase()}</span>
            <span>mais {scatter.x.label.toLowerCase()}</span>
          </p>
        </div>
      </div>

      {/* This club's reading, and nothing that is true of every club. The rule
          down the left is `primary`, the colour of the mark it describes, which
          is what ties four lines of text to one dot without repeating "o cheio
          é o …" under both drawings. */}
      <figcaption className={`mt-3 border-l-2 border-primary pl-3 ${COLUMN}`}>
        <p className="flex items-center gap-1.5 text-body-medium font-semibold text-on-surface">
          <MarkSwatch kind="subject" />
          {nameOf(subject.clubCode)}
        </p>

        {/* The two figures the dot is placed by, one per line rather than joined
            with an "e": the numbers then sit in a column a reader can compare,
            and each unit stays attached to the figure it belongs to. The figure
            is set in the page's own ink against a muted unit — the player
            card's Ficha rule, which is what makes a number look like data
            instead of like the middle of a sentence. */}
        <Reading axis={scatter.x} value={subject.x} />
        <Reading axis={scatter.y} value={subject.y} />

        {corner && (
          /* The corner in two weights. The term is what a scanning eye should
             land on and the gloss is what it means, which is why
             `quadrantParts` hands them over separately rather than the
             component cutting the sentence at its colon. Lowercase, because
             these words are descriptive rather than a verdict and read the same
             way here as they do inside the drawing's own label. */
          <p className="mt-1.5 text-body-small text-ink-muted">
            <span className="font-medium text-on-surface">{corner.term}</span> —{" "}
            {corner.gloss}
          </p>
        )}
      </figcaption>
    </figure>
  );
}

/**
 * What the marks mean, stated once for the section rather than under each
 * drawing.
 *
 * **One key for two figures**, which is the arrangement the campanha's plot
 * toggle already uses on the Partida page and for the same reason: the two
 * scatters share their vocabulary entirely, so saying it twice makes a reader
 * check whether the two statements agree. It also puts every general sentence
 * in this section — the strip's track, the marks here, the rodada, the credit —
 * in one place at the foot, leaving each figure to say only what is true of
 * its own club.
 *
 * The swatches are the marks themselves rather than words for them, so nothing
 * has to describe a filled circle in prose. They are `aria-hidden` and carry no
 * `role`, which is deliberate twice over: the item's text is the whole of what
 * a screen reader needs, and the Painel's campanha specs select
 * `svg[role='img']` and count what they find.
 */
export function ScatterKey({ className }: { className?: string }) {
  return (
    <div data-scatter-key="" className={className}>
      Nos gráficos, cada ponto é um clube:
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
        <li className="flex items-center gap-1.5">
          <MarkSwatch kind="subject" />o clube deste painel
        </li>
        <li className="flex items-center gap-1.5">
          <MarkSwatch kind="other" />cada um dos outros
        </li>
        <li className="flex items-center gap-1.5">
          <MedianSwatch />as medianas da divisão
        </li>
      </ul>
    </div>
  );
}

/** One axis's reading: the figure in the page's ink, its unit beside it. */
function Reading({ axis, value }: { axis: ScatterAxis; value: number }) {
  const { figure, noun } = axisFigure(axis, value);
  return (
    <p className="mt-0.5 text-body-small text-ink-muted">
      <span className="font-semibold tabular-nums text-on-surface">{figure}</span> {noun}
    </p>
  );
}

/** A dot at the size and colour the drawing paints it. */
function MarkSwatch({ kind }: { kind: "subject" | "other" }) {
  return (
    <svg viewBox="0 0 13 13" aria-hidden="true" className="size-2.5 shrink-0">
      <circle
        cx="6.5"
        cy="6.5"
        r={kind === "subject" ? DOT.subject : DOT.other}
        className={kind === "subject" ? "fill-primary" : "fill-ink-ghost"}
      />
    </svg>
  );
}

/** The median guide, dashed as the drawing dashes it. */
function MedianSwatch() {
  return (
    <svg viewBox="0 0 12 2" aria-hidden="true" className="h-px w-3 shrink-0">
      <line
        x1="0"
        y1="1"
        x2="12"
        y2="1"
        strokeWidth="2"
        strokeDasharray="4 4"
        className="stroke-outline"
      />
    </svg>
  );
}

function nameOf(clubCode: ClubCode): string {
  return CLUBS_BY_CODE.get(clubCode)?.shortName ?? clubCode;
}

/** One club's dot, in words. Every mark says what it draws — `RankCandles`' rule. */
function describe(scatter: Scatter, point: ScatterPoint): string {
  return (
    `${nameOf(point.clubCode)} — ${axisPhrase(scatter.x, point.x)} ` +
    `e ${axisPhrase(scatter.y, point.y)}`
  );
}

/** The whole figure, for a reader who gets the label instead of the picture. */
function summarise(scatter: Scatter, subject: ScatterPoint): string {
  return (
    `${nameOf(subject.clubCode)} entre os ${scatter.points.length} clubes: ` +
    `${axisPhrase(scatter.x, subject.x)} e ${axisPhrase(scatter.y, subject.y)} — ` +
    `${quadrantLabel(scatter)}.`
  );
}
