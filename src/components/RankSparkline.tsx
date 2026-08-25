import {
  describeCampaign,
  sparklinePoints,
  sparklinePolyline,
  type SparklineBox,
} from "@/rank-history-core";
import type { RankAtRound } from "@/src/types";

/**
 * Small enough to sit inside a table row without changing its height. The
 * dimensions are fixed rather than fluid because every row must share one
 * scale — see `sparklinePoints`.
 */
const BOX: Omit<SparklineBox, "clubCount" | "lastRound"> = {
  width: 72,
  height: 20,
  padding: 2,
};

interface RankSparklineProps {
  /** The club's position after each round, oldest first. */
  entries: RankAtRound[];
  /** Size of the division — the y domain. Shared by every row. */
  clubCount: number;
  /** Last round any club has played — the x domain. Shared by every row. */
  lastRound: number;
}

/**
 * A club's campanha: its position after every round, drawn as a 72×20 line.
 *
 * Deliberately recessive. Twenty of these stack up in one table, and a loud
 * mark repeated twenty times would out-shout the numbers the table is actually
 * for. The line is `ink-muted`; only the end dot — where the club stands now —
 * carries full-strength ink.
 *
 * No crosshair or per-point tooltip, unlike a full-size chart: the reader is
 * scanning twenty rows, and twenty hover surfaces competing inside a table is
 * worse than none. The whole mark carries one `<title>` instead, which is also
 * what makes it readable when the drawing is not — screen readers, and
 * forced-colours mode where the stroke may not render at all.
 */
export function RankSparkline({ entries, clubCount, lastRound }: RankSparklineProps) {
  const label = describeCampaign(entries);
  const points = sparklinePoints(entries, { ...BOX, clubCount, lastRound });
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
      width={BOX.width}
      height={BOX.height}
      viewBox={`0 0 ${BOX.width} ${BOX.height}`}
      role="img"
      aria-label={label}
      className="overflow-visible text-ink-muted"
    >
      <title>{label}</title>
      {/* 1.5px rather than a full-size chart's 2px: at 20px tall with a round
          per point, 2px closes the gaps between steps into a blob. */}
      <polyline
        points={sparklinePolyline(points)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Where the club stands now. Also the entire mark when only one round
          has been played, since a one-point polyline draws nothing. */}
      <circle cx={last.x} cy={last.y} r={2} className="fill-ink" />
    </svg>
  );
}
