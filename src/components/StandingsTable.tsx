import type { StandingsRow } from "@/src/types";

/** Libertadores places (G4) and the relegation zone (Z4) get a rail colour. */
const zoneClass = (position: number, total: number): string => {
  if (position <= 4) return "border-l-2 border-l-emerald-400";
  if (position > total - 4) return "border-l-2 border-l-rose-500";
  return "border-l-2 border-l-transparent";
};

export function StandingsTable({ rows }: { rows: StandingsRow[] }) {
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
                {row.club.shortName}
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
