import {
  axisCaption,
  axisPhrase,
  profileScatter,
  quadrantLabel,
  SCATTER_PAIRS,
  type ProfileScatter as Scatter,
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
 */
export function ProfileScatter({ division, clubCode, pair }: ProfileScatterProps) {
  const scatter = profileScatter(division, clubCode, SCATTER_PAIRS[pair]);
  if (!scatter) return null;

  const subject = scatter.points.find((point) => point.subject);
  if (!subject) return null;

  const label = summarise(scatter, subject);

  return (
    <figure data-scatter={scatter.points.length} data-scatter-pair={pair}>
      {/* The cap belongs to the whole figure, not to the drawing alone: with
          it on the box, "mais finalizações" sat at the far right of a 700px
          card pointing at nothing, half a card away from the axis it names. An
          axis label has to share the width of its axis. */}
      <div className="max-w-[28rem]">
        <p className="text-label-small text-ink-faint">{axisCaption(scatter.y)}</p>

        <div className="mt-0.5 flex gap-2">
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
            /* `grow min-w-0`, never `w-full`: in a flex row `w-full` is 100% of
               the container rather than of what the gutter leaves, which is how
               `RankCandles` came to paint outside its card. `h-auto` with the
               default `preserveAspectRatio` is what keeps the dots round. */
            className="h-auto min-w-0 grow"
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
        </div>

        <p className="mt-1 flex justify-between text-label-small text-ink-faint">
          <span>menos {scatter.x.label.toLowerCase()}</span>
          <span>mais {scatter.x.label.toLowerCase()}</span>
        </p>
      </div>

      <figcaption className="mt-2 text-body-small text-ink-muted">
        Cada ponto é um clube; o cheio é o {nameOf(subject.clubCode)}, com{" "}
        {axisPhrase(scatter.x, subject.x)} e {axisPhrase(scatter.y, subject.y)} —{" "}
        {quadrantLabel(scatter)}. As linhas tracejadas são as medianas da divisão.
      </figcaption>
    </figure>
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
