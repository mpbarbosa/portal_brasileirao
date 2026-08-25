import { useMemo } from "react";

import { clubKey } from "@/club-core";
import { ClubCrest } from "@/src/components/ClubCrest";
import { LINK_UNDERLINE } from "@/src/components/interaction";
import { lastRecordedRound } from "@/rank-history-core";
import { RankSparkline } from "@/src/components/RankSparkline";
import { formatRoute } from "@/route-core";
import { Surface } from "@/src/components/Surface";
import type { ClubCode, ClubRankHistory, RankAtRound, StandingsRow } from "@/src/types";

/** Libertadores places (G4) and the relegation zone (Z4) get a rail colour.
 *  It rides on the first cell, not the row: the row scrolls horizontally and
 *  would carry the rail away underneath the frozen columns. */
const zoneClass = (position: number, total: number): string => {
  if (position <= 4) return "border-l-2 border-l-positive";
  if (position > total - 4) return "border-l-2 border-l-negative";
  return "border-l-2 border-l-transparent";
};

/** The row separator. It lives on every cell because the table is
 *  `border-separate` (see below), and that model does not paint borders set on
 *  a `<tr>` at all. */
const ROW_LINE = "border-t border-line";

/** The two frozen columns. `#` is pinned flush left and given a fixed width so
 *  Clube can be offset by exactly that much — an auto-sized first column would
 *  put the second one a few pixels off, which reads as a rendering bug. Each
 *  carries its own background, since the cells that slide beneath them would
 *  otherwise show through. */
const STICKY_POSITION = "sticky left-0 z-10 w-12";
const STICKY_CLUB = "sticky left-12 z-10 border-r border-line";

interface StandingsTableProps {
  rows: StandingsRow[];
  /** Receives the club's URL key (slug, or code as a fallback). Omit to render
   *  plain text — the table stays useful without a drill-down. */
  onSelectClub?: (key: string) => void;
  /** Each club's position after every round. Omit and the campanha column is
   *  left out entirely — the table predates it and still stands without it. */
  rankHistory?: ClubRankHistory[];
}

export function StandingsTable({ rows, onSelectClub, rankHistory }: StandingsTableProps) {
  const campaigns = useMemo(
    () => new Map<ClubCode, RankAtRound[]>((rankHistory ?? []).map((c) => [c.clubCode, c.entries])),
    [rankHistory],
  );

  /** One x domain for the whole table — see `lastRecordedRound`. */
  const lastRound = useMemo(() => lastRecordedRound(rankHistory ?? []), [rankHistory]);

  // Nothing to draw before the fixtures land. Rendering the column empty would
  // read as twenty broken cells rather than as data still in flight.
  const showCampaign = lastRound > 0;

  return (
    <Surface className="overflow-x-auto">
      {/* `border-separate` rather than the default collapse: in the collapsed
          model a cell's borders belong to the table, so they scroll out from
          under a sticky cell and the zone rail vanishes mid-scroll. */}
      <table
        className={`w-full border-separate border-spacing-0 text-body-medium ${
          showCampaign ? "min-w-[40rem]" : "min-w-[34rem]"
        }`}
      >
        <caption className="sr-only">Classificação do Campeonato Brasileiro Série A</caption>
        <thead className="bg-surface-container-low text-label-medium uppercase text-ink-muted">
          <tr>
            <th scope="col" className={`${STICKY_POSITION} bg-surface-container-low px-3 py-2 text-left`}>#</th>
            <th scope="col" className={`${STICKY_CLUB} bg-surface-container-low px-3 py-2 text-left`}>Clube</th>
            <th scope="col" className="px-2 py-2 text-right">P</th>
            <th scope="col" className="px-2 py-2 text-right">J</th>
            <th scope="col" className="px-2 py-2 text-right">V</th>
            <th scope="col" className="px-2 py-2 text-right">E</th>
            <th scope="col" className="px-2 py-2 text-right">D</th>
            <th scope="col" className="px-2 py-2 text-right">SG</th>
            {/* Last, so it is the column a narrow screen scrolls away from
                rather than one of the numbers the table exists for. */}
            {showCampaign && <th scope="col" className="px-3 py-2 text-left">Campanha</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.club.code}>
              <td
                className={`${ROW_LINE} ${STICKY_POSITION} ${zoneClass(row.position, rows.length)} bg-surface px-3 py-2 tabular-nums text-ink-muted`}
              >
                {row.position}
              </td>
              <td className={`${ROW_LINE} ${STICKY_CLUB} bg-surface px-3 py-2 font-medium`}>
                <span className="mr-2 inline-flex align-middle">
                  <ClubCrest club={row.club} size={18} />
                </span>
                {/* Name and state are separate elements: they are distinct data,
                    and running them together reads as one string to assistive
                    tech and to any text-based assertion. */}
                {onSelectClub ? (
                  <a
                    href={formatRoute({ section: "clube", key: clubKey(row.club) })}
                    onClick={(event) => {
                      // Let modified clicks open a new tab, as any link should.
                      if (
                        event.metaKey || event.ctrlKey || event.shiftKey ||
                        event.altKey || event.button !== 0
                      ) {
                        return;
                      }
                      event.preventDefault();
                      onSelectClub(clubKey(row.club));
                    }}
                    className={`rounded-x-small ${LINK_UNDERLINE}`}
                  >
                    {row.club.shortName}
                  </a>
                ) : (
                  <span>{row.club.shortName}</span>
                )}
                {row.club.state && (
                  <span className="ml-2 text-body-small text-ink-faint">{row.club.state}</span>
                )}
              </td>
              <td className={`${ROW_LINE} px-2 py-2 text-right font-semibold tabular-nums`}>{row.points}</td>
              <td className={`${ROW_LINE} px-2 py-2 text-right tabular-nums text-ink-muted`}>{row.played}</td>
              <td className={`${ROW_LINE} px-2 py-2 text-right tabular-nums text-ink-muted`}>{row.wins}</td>
              <td className={`${ROW_LINE} px-2 py-2 text-right tabular-nums text-ink-muted`}>{row.draws}</td>
              <td className={`${ROW_LINE} px-2 py-2 text-right tabular-nums text-ink-muted`}>{row.losses}</td>
              <td className={`${ROW_LINE} px-2 py-2 text-right tabular-nums text-ink-muted`}>
                {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
              </td>
              {showCampaign && (
                <td className={`${ROW_LINE} px-3 py-2`}>
                  <RankSparkline
                    entries={campaigns.get(row.club.code) ?? []}
                    clubCount={rows.length}
                    lastRound={lastRound}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}
