import { useMemo } from "react";

import { clubKey } from "@/club-core";
import { ClubCrest } from "@/src/components/ClubCrest";
import { RankSparkline } from "@/src/components/RankSparkline";
import { formatRoute } from "@/route-core";
import { Surface } from "@/src/components/Surface";
import type { ClubCode, ClubRankHistory, RankAtRound, StandingsRow } from "@/src/types";

/** Libertadores places (G4) and the relegation zone (Z4) get a rail colour. */
const zoneClass = (position: number, total: number): string => {
  if (position <= 4) return "border-l-2 border-l-positive";
  if (position > total - 4) return "border-l-2 border-l-negative";
  return "border-l-2 border-l-transparent";
};

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

  /**
   * One x domain for the whole table, taken from the club that has played the
   * most rounds — not from each row's own entries. Rows are small multiples of
   * each other, and a per-row axis would draw a club with a game in hand on a
   * different scale from the rest.
   */
  const lastRound = useMemo(
    () =>
      (rankHistory ?? []).reduce(
        (max, club) => Math.max(max, club.entries[club.entries.length - 1]?.round ?? 0),
        0,
      ),
    [rankHistory],
  );

  // Nothing to draw before the fixtures land. Rendering the column empty would
  // read as twenty broken cells rather than as data still in flight.
  const showCampaign = lastRound > 0;

  return (
    <Surface className="overflow-x-auto">
      <table className={`w-full text-sm ${showCampaign ? "min-w-[40rem]" : "min-w-[34rem]"}`}>
        <caption className="sr-only">Classificação do Campeonato Brasileiro Série A</caption>
        <thead className="bg-surface text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            <th scope="col" className="px-3 py-2 text-left">#</th>
            <th scope="col" className="px-3 py-2 text-left">Clube</th>
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
            <tr
              key={row.club.code}
              className={`${zoneClass(row.position, rows.length)} border-t border-line`}
            >
              <td className="px-3 py-2 tabular-nums text-ink-muted">{row.position}</td>
              <td className="px-3 py-2 font-medium">
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
                    className="rounded underline decoration-ink-ghost underline-offset-2 hover:decoration-ink-soft"
                  >
                    {row.club.shortName}
                  </a>
                ) : (
                  <span>{row.club.shortName}</span>
                )}
                {row.club.state && (
                  <span className="ml-2 text-xs text-ink-faint">{row.club.state}</span>
                )}
              </td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums">{row.points}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{row.played}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{row.wins}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{row.draws}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{row.losses}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-muted">
                {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
              </td>
              {showCampaign && (
                <td className="px-3 py-2">
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
