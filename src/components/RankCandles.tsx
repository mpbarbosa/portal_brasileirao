import {
  candleShapes,
  describeCandle,
  describeCandles,
  zoneGuides,
  type CandleBox,
} from "@/rank-candles-core";
import type { FormResult, RoundCandle } from "@/src/types";

/**
 * The box the painel is drawn in, in user units.
 *
 * Wide and shallow because the x axis holds 38 rounds and the y axis holds 20
 * positions: at 720×300 a round gets about 19 units of width and a position 15
 * of height, which is enough for a candle body to read as a rectangle rather
 * than as a tick. The SVG scales to its container from here — on a 343dp phone
 * that is 143dp tall, where a one-place move is still a 14dp body.
 *
 * There is **no vertical padding**; see `CandleBox.padding` for why the ends of
 * the y axis have to sit exactly on the edges of the drawing.
 */
const BOX: Omit<CandleBox, "clubCount" | "lastRound"> = {
  width: 720,
  height: 300,
  padding: 6,
};

/**
 * What a candle's colour says: the **result**, not the direction.
 *
 * The direction is already in the drawing — the body runs from where the round
 * opened to where it closed, and the stub says which end is which. Spending
 * colour on it again would leave the chart saying one thing twice and the
 * result nowhere, and the rounds worth looking at are exactly the ones where
 * the two disagree: a club that wins and still drops a place because two rivals
 * won by more.
 *
 * The same three colours the **Forma** pills use on the club page, so a reader
 * arriving from there meets one vocabulary rather than two.
 */
const BODY_FILL: Record<FormResult, string> = {
  V: "fill-positive",
  E: "fill-ink-muted",
  D: "fill-negative",
};

const WICK_FILL: Record<FormResult, string> = {
  V: "fill-positive/40",
  E: "fill-ink-muted/40",
  D: "fill-negative/40",
};

/**
 * A round the club did not play — postponed, or a bye in an odd division.
 *
 * Drawn rather than skipped: a gap in the row would read as a rendering fault,
 * and "no game" is a fact about the campanha.
 *
 * **Outlined rather than filled, and that is not decoration.** It was a grey
 * fill first, next to an empate drawn in `ink-muted` — two greys a step apart
 * on a 5px mark, and two swatches in the key nobody could tell apart. Colour
 * cannot separate a result from the absence of one when both are neutral by
 * definition, so the difference is carried by the mark being hollow. Read at
 * 343dp before and after: the fills were indistinguishable and the outline is
 * not.
 */
const IDLE_MARK = "fill-none stroke-outline";

interface RankCandlesProps {
  candles: RoundCandle[];
  /** Size of the division — the y domain, 1 at the top. */
  clubCount: number;
  /** Last round any club has played — the x domain, shared with the campanha
   *  sparkline so the two drawings of one season line up. */
  lastRound: number;
  /**
   * The club this drawing is of, printed above it and folded into the chart's
   * accessible name.
   *
   * **Omitted on a painel showing one club**, where the page heading and the
   * section heading have both already said whose season this is and a third
   * statement of it is noise. It is what a **comparação** needs: two drawings
   * of the same shape, on the same frame, are told apart by nothing else.
   */
  name?: string;
}

/**
 * A club's season as candles, one per rodada.
 *
 * Each candle carries its own `<title>`, which the sparkline deliberately does
 * not: twenty marks competing for hover inside a table is worse than none, but
 * this is one full-size chart and the per-round detail is what it is for. The
 * whole figure still carries an `aria-label` summarising the season, because a
 * screen reader gets neither the rectangles nor thirty-eight tooltips.
 *
 * The axes are **HTML around the drawing, never `<text>` inside it.** An SVG
 * that scales to its container scales its type with it, so a label sized to be
 * readable on a desktop is six pixels tall on a phone. The club page already
 * names the ends of its sparkline in text for the same reason; this is that
 * idea with a gutter, and it costs the chart nothing it would otherwise have.
 */
export function RankCandles({ candles, clubCount, lastRound, name }: RankCandlesProps) {
  const domain: CandleBox = { ...BOX, clubCount, lastRound };
  const shapes = candleShapes(candles, domain);
  const guides = zoneGuides(domain);
  const label = describeCandles(candles, name);

  if (shapes.length === 0) {
    return <p className="text-body-medium text-ink-muted">{label}.</p>;
  }

  return (
    <figure data-candles-figure={name ?? ""}>
      {/* The drawing's own name, which a painel of one club does not need and a
          comparação cannot do without. An `h4` under the section's `h3` rather
          than a styled paragraph, so the document outline and a screen
          reader's heading list carry the pairing too — `ProfileScatter`'s
          arrangement, one section down the same page. */}
      {name && <h4 className="mb-1 text-body-small font-medium text-ink-muted">{name}</h4>}
      <div className="flex gap-2">
        {/* The y axis. A flex column stretched to the drawing's own height, so
            it stays aligned at every width without either side knowing what
            that height turned out to be. `justify-between` puts 1º on the top
            edge and the last position on the bottom edge, which is exactly
            where those bands begin and end — the reason the box has no
            vertical padding. */}
        <div className="flex shrink-0 flex-col justify-between text-label-small tabular-nums text-ink-faint">
          <span>1º</span>
          <span>{clubCount}º</span>
        </div>

        <svg
          width={BOX.width}
          height={BOX.height}
          viewBox={`0 0 ${BOX.width} ${BOX.height}`}
          /* **Not `h-auto` at every width, and `preserveAspectRatio` is what
             lets that work.** At 2.4:1 the box is 293px tall on a desktop and
             143px on a 343dp phone — where twenty position bands are 7px each
             and a season reads as a strip of dashes rather than as a chart.
             Fixing the height below `sm` and letting the drawing stretch to it
             buys back 13px bands. The marks are filled rects, so a non-uniform
             scale changes their proportions and nothing else; the two guide
             lines carry `non-scaling-stroke`, which is what stops their weight
             stretching with the y axis. */
          preserveAspectRatio="none"
          /* `grow min-w-0`, never `w-full`. In a flex row `w-full` is 100% of
             the *container* rather than of what the gutter leaves, so the
             drawing sat 30px wider than the panel and — with
             `overflow-visible` — painted the last candles and both guide lines
             outside the card. It cannot shrink back on its own: an SVG with
             width and height attributes has an intrinsic size, and `min-width:
             auto` is what stops a flex item shrinking below one. */
          className="h-64 min-w-0 grow overflow-visible sm:h-auto"
          role="img"
          aria-label={label}
          data-candles={shapes.length}
          /* Which club this drawing is of, so a spec can address one of two.
             `data-candles` alone counts rounds, and both drawings of one
             season report the same number — the trap `data-scatter-pair` was
             added for when the Perfil grew its second figure. */
          data-candles-club={name ?? ""}
        >
          <title>{label}</title>

          {/* G4 and Z4, from `ZONE_DEPTH` rather than from a 4 written here.
              Dashed and in the outline token: they are the page's reference
              lines, not marks, and a solid rule at full strength would compete
              with the candles it exists to place. */}
          <line
            x1={0}
            x2={BOX.width}
            y1={guides.g4}
            y2={guides.g4}
            className="stroke-outline-variant"
            strokeWidth={1}
            strokeDasharray="6 6"
            vectorEffect="non-scaling-stroke"
          />
          {guides.z4 !== null && (
            <line
              x1={0}
              x2={BOX.width}
              y1={guides.z4}
              y2={guides.z4}
              className="stroke-outline-variant"
              strokeWidth={1}
              strokeDasharray="6 6"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {shapes.map((shape) => {
            const { candle } = shape;
            const body = candle.result ? BODY_FILL[candle.result] : IDLE_MARK;
            const wick = candle.result ? WICK_FILL[candle.result] : IDLE_MARK;

            return (
              <g key={candle.round} data-round={candle.round} data-result={candle.result ?? "none"}>
                <title>{describeCandle(candle)}</title>
                {/* Behind the body, and only ever visible where it reaches
                    past it — which is precisely the fact the pavio carries:
                    the round went somewhere its two ends do not show. */}
                <rect
                  x={shape.wick.x}
                  y={shape.wick.y}
                  width={shape.wick.width}
                  height={shape.wick.height}
                  className={wick}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <rect
                  x={shape.body.x}
                  y={shape.body.y}
                  width={shape.body.width}
                  height={shape.body.height}
                  className={body}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                {/* Where the round opened. Thirty-eight of these trace the same
                    path the campanha line draws — each round opens where the
                    last one closed — so the chart carries the sparkline's shape
                    inside it rather than contradicting it. */}
                <rect
                  x={shape.openTick.x}
                  y={shape.openTick.y}
                  width={shape.openTick.width}
                  height={shape.openTick.height}
                  className="fill-on-surface"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* The x axis, named at its ends for the reason the club page names its
          sparkline's: the drawing carries no scale a reader can read off. */}
      <p className="mt-1 flex justify-between text-label-small tabular-nums text-ink-faint">
        <span>1ª rodada</span>
        <span>{lastRound}ª rodada</span>
      </p>

    </figure>
  );
}

/**
 * What the marks mean, stated **once for the section** rather than under each
 * drawing.
 *
 * It lived in this figure's own `figcaption` while the painel drew one club,
 * which was right then and stops being right the moment a **comparação** puts
 * a second drawing beneath the first: the key would then sit *between* the two
 * charts it describes, and the paragraph explaining corpo and pavio would be
 * printed twice for one vocabulary — which is a reader checking whether two
 * statements of one thing agree. `ScatterKey` reached this same answer when
 * the Perfil grew its second figure, and this is that arrangement.
 *
 * Nothing here is about a club, which is the line that decides what may move
 * in: the axis ends stay in the figure because "1º … 20º" is that drawing's
 * own scale, and every general sentence lands here.
 */
export function CandlesKey({ className }: { className?: string }) {
  return (
    <div data-candles-key="" className={`space-y-1.5 text-body-small text-ink-muted ${className ?? ""}`}>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Swatch className="bg-positive">Vitória</Swatch>
        <Swatch className="bg-ink-muted">Empate</Swatch>
        <Swatch className="bg-negative">Derrota</Swatch>
        {/* Hollow, exactly as the mark is — a key that fills this one in is a
            key that describes a different drawing. */}
        <Swatch className="border border-outline">Sem jogo</Swatch>
      </p>
      <p>
        O corpo vai da posição em que a rodada começou até a do fim dela, e o traço
        à esquerda marca o começo. A linha fina atravessa todas as posições que o
        clube ocupou enquanto a rodada era disputada. As linhas tracejadas são o G4
        e o Z4.
      </p>
    </div>
  );
}

/** A colour key entry. The swatch is `aria-hidden` and the word carries the
 *  meaning, which is the same split `FormPill` makes on the club page — a
 *  colour announced as well as read out is the fact twice. */
function Swatch({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-x-small ${className}`} />
      {children}
    </span>
  );
}
