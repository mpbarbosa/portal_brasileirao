import type { CampaignPlotKind } from "@/campaign-plot-core";
import {
  describeCampaign,
  sparklineBars,
  sparklinePoints,
  sparklinePolyline,
  type SparklineBox,
} from "@/rank-history-core";
import type { RankAtRound } from "@/src/types";

type Size = "row" | "page";

/**
 * Two sizes of the same mark, not two marks.
 *
 * `row` sits inside a Classificação row without changing its height. `page` is
 * the club page, where the campanha is a section of its own rather than a
 * column, and there is room to read a whole season across.
 *
 * Both keep the same geometry and the same shared domains — only the box grows,
 * so a club's line has the same shape in both places. A reader who recognises
 * the shape in the table must find that shape again on the club page.
 */
const BOXES: Record<Size, Omit<SparklineBox, "clubCount" | "lastRound">> = {
  row: { width: 72, height: 20, padding: 2 },
  page: { width: 480, height: 96, padding: 6 },
};

const STROKE: Record<Size, number> = { row: 1.5, page: 2 };
const DOT: Record<Size, number> = { row: 2, page: 3.5 };

interface RankSparklineProps {
  /** The club's position after each round, oldest first. */
  entries: RankAtRound[];
  /** Size of the division — the y domain. Shared by every mark. */
  clubCount: number;
  /** Last round any club has played — the x domain. Shared by every mark. */
  lastRound: number;
  size?: Size;
  /**
   * Which mark to draw. Defaults to the line the campanha has always been, so
   * every caller that does not offer the reader a choice keeps what it had.
   */
  kind?: CampaignPlotKind;
}

/**
 * A club's campanha: its position after every round, drawn as a line or as a
 * column of bars — the reader's choice (`CampaignPlotToggle`), and one choice
 * for the whole app rather than one per page. `App` owns it; all three callers
 * receive it.
 *
 * One component and not two, because the two marks share everything that
 * matters: the same entries, the same shared domains, the same accessible name,
 * the same emphasis on the round the club is in now. A second component would
 * be a second place for those to drift.
 *
 * Deliberately recessive. Twenty of these stack up in the Classificação, and a
 * loud mark repeated twenty times would out-shout the numbers the table is
 * actually for. The line is `ink-muted`; only the end dot — where the club
 * stands now — carries full-strength ink.
 *
 * No crosshair or per-point tooltip, unlike a full-size chart: in the table the
 * reader is scanning twenty rows, and twenty hover surfaces competing inside a
 * table is worse than none. The whole mark carries one `<title>` instead, which
 * is also what makes it readable when the drawing is not — screen readers, and
 * forced-colours mode where the stroke may not render at all.
 */
export function RankSparkline({
  entries,
  clubCount,
  lastRound,
  size = "row",
  kind = "line",
}: RankSparklineProps) {
  const box = BOXES[size];
  const label = describeCampaign(entries);
  const domain = { ...box, clubCount, lastRound };
  const points = sparklinePoints(entries, domain);
  const bars = kind === "bars" ? sparklineBars(entries, domain) : [];
  const last = points[points.length - 1];
  const lastBar = bars[bars.length - 1];

  // No rounds played yet. An empty cell would read as a rendering fault, so say
  // it in the one character a table has room for.
  if (!last) {
    return (
      <span className="text-ink-faint" title={label}>
        —
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <svg
      // Scales down with its container on a narrow screen; the viewBox keeps
      // the proportions, and non-scaling strokes keep the line the same weight
      // whatever the rendered width turns out to be.
      width={box.width}
      height={box.height}
      viewBox={`0 0 ${box.width} ${box.height}`}
      className={`overflow-visible text-ink-muted ${size === "page" ? "h-auto w-full" : ""}`}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      {kind === "bars" ? (
        /* Every round as a column from the foot of the division — see
           `sparklineBars` for why the baseline is 20th place and not the box's
           edge. The bars are filled rather than stroked, so `non-scaling-stroke`
           has nothing to do here: a column that kept its width while the box
           scaled would overlap its neighbours on a narrow screen. */
        bars.map((bar) => (
          <rect
            key={bar.round}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            fill="currentColor"
            /* The round the club is in now, at full-strength ink — the same
               emphasis the line kind gives its end dot, so the two marks
               answer "where does this club stand today" the same way. */
            className={bar.round === lastBar?.round ? "fill-on-surface" : undefined}
          />
        ))
      ) : (
        <>
          {/* Thinner than a full-size chart's 2px in the row: at 20px tall with a
              round per point, 2px closes the gaps between steps into a blob. */}
          <polyline
            points={sparklinePolyline(points)}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE[size]}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* Where the club stands now. Also the entire mark when only one round
              has been played, since a one-point polyline draws nothing. */}
          <circle cx={last.x} cy={last.y} r={DOT[size]} className="fill-on-surface" />
        </>
      )}
    </svg>
  );
}
