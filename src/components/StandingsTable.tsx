import { clubKey } from "@/club-core";
import { ClubCrest } from "@/src/components/ClubCrest";
import { formatRoute } from "@/route-core";
import type { StandingsRow } from "@/src/types";

/** Libertadores places (G4) and the relegation zone (Z4) get a rail colour. */
const zoneClass = (position: number, total: number): string => {
  if (position <= 4) return "border-l-2 border-l-emerald-400";
  if (position > total - 4) return "border-l-2 border-l-rose-500";
  return "border-l-2 border-l-transparent";
};

interface StandingsTableProps {
  rows: StandingsRow[];
  /** Receives the club's URL key (slug, or code as a fallback). Omit to render
   *  plain text — the table stays useful without a drill-down. */
  onSelectClub?: (key: string) => void;
}

export function StandingsTable({ rows, onSelectClub }: StandingsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full min-w-[34rem] text-sm">
        <caption className="sr-only">Classificação do Campeonato Brasileiro Série A</caption>
        <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th scope="col" className="px-3 py-2 text-left">#</th>
            <th scope="col" className="px-3 py-2 text-left">Clube</th>
            <th scope="col" className="px-2 py-2 text-right">P</th>
            <th scope="col" className="px-2 py-2 text-right">J</th>
            <th scope="col" className="px-2 py-2 text-right">V</th>
            <th scope="col" className="px-2 py-2 text-right">E</th>
            <th scope="col" className="px-2 py-2 text-right">D</th>
            <th scope="col" className="px-2 py-2 text-right">SG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.club.code}
              className={`${zoneClass(row.position, rows.length)} border-t border-slate-800`}
            >
              <td className="px-3 py-2 tabular-nums text-slate-400">{row.position}</td>
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
                    className="rounded underline decoration-slate-600 underline-offset-2 hover:decoration-slate-300"
                  >
                    {row.club.shortName}
                  </a>
                ) : (
                  <span>{row.club.shortName}</span>
                )}
                {row.club.state && (
                  <span className="ml-2 text-xs text-slate-500">{row.club.state}</span>
                )}
              </td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums">{row.points}</td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-400">{row.played}</td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-400">{row.wins}</td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-400">{row.draws}</td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-400">{row.losses}</td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
