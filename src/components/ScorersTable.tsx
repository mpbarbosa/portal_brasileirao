import { Surface } from "@/src/components/Surface";
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
    return <p className="text-sm text-ink-muted">Artilharia indisponível no momento.</p>;
  }

  return (
    <Surface className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-sm">
        <caption className="sr-only">
          Artilharia do Campeonato Brasileiro Série A
        </caption>
        <thead className="bg-surface text-xs uppercase tracking-wide text-ink-muted">
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
            <tr key={row.playerId} className="border-t border-line">
              <td className="px-3 py-2 tabular-nums text-ink-muted">{row.position}</td>
              <td className="px-3 py-2">
                {onSelectPlayer ? (
                  <button
                    type="button"
                    onClick={() => onSelectPlayer(row)}
                    className="block rounded font-medium underline decoration-ink-ghost underline-offset-2 hover:decoration-ink-soft"
                  >
                    {row.playerName}
                  </button>
                ) : (
                  <span className="block font-medium">{row.playerName}</span>
                )}
                <span className="block text-xs text-ink-faint">{row.club.shortName}</span>
              </td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums">{row.goals}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-muted">
                {count(row.assists)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-muted">
                {count(row.penalties)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-muted">
                {count(row.playedMatches)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-3 py-2 text-xs text-ink-faint">
        G gols · A assistências · P pênaltis · J jogos · — não informado
      </p>
    </Surface>
  );
}
