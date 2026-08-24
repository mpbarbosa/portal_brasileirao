import type { Scorer } from "@/src/types";

/** Null means the upstream did not report the figure — not that it is zero. */
const count = (value: number | null) => (value === null ? "—" : String(value));

interface ScorersTableProps {
  rows: Scorer[];
  /** Omit to render plain names — the table stands on its own. */
  onSelectPlayer?: (scorer: Scorer) => void;
}

export function ScorersTable({ rows, onSelectPlayer }: ScorersTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">Artilharia indisponível no momento.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full min-w-[32rem] text-sm">
        <caption className="sr-only">
          Artilharia do Campeonato Brasileiro Série A
        </caption>
        <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th scope="col" className="px-3 py-2 text-left">#</th>
            <th scope="col" className="px-3 py-2 text-left">Jogador</th>
            <th scope="col" className="px-2 py-2 text-right">G</th>
            <th scope="col" className="px-2 py-2 text-right">A</th>
            <th scope="col" className="px-2 py-2 text-right">P</th>
            <th scope="col" className="px-2 py-2 text-right">J</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.playerId} className="border-t border-slate-800">
              <td className="px-3 py-2 tabular-nums text-slate-400">{row.position}</td>
              <td className="px-3 py-2">
                {onSelectPlayer ? (
                  <button
                    type="button"
                    onClick={() => onSelectPlayer(row)}
                    className="block rounded font-medium underline decoration-slate-600 underline-offset-2 hover:decoration-slate-300"
                  >
                    {row.playerName}
                  </button>
                ) : (
                  <span className="block font-medium">{row.playerName}</span>
                )}
                <span className="block text-xs text-slate-500">{row.club.shortName}</span>
              </td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums">{row.goals}</td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                {count(row.assists)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                {count(row.penalties)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                {count(row.playedMatches)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-slate-800 px-3 py-2 text-xs text-slate-500">
        G gols · A assistências · P pênaltis · J jogos · — não informado
      </p>
    </div>
  );
}
