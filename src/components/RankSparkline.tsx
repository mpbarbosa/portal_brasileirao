import {
  describeCampaign,
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
}

/**
 * A club's campanha: its position after every round, drawn as a line.
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
}: RankSparklineProps) {
  const box = BOXES[size];
  const label = describeCampaign(entries);
  const points = sparklinePoints(entries, { ...box, clubCount, lastRound });
  const last = points[points.length - 1];

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
      <circle cx={last.x} cy={last.y} r={DOT[size]} className="fill-ink" />
    </svg>
  );
}
