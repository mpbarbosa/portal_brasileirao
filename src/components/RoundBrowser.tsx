import { MatchList } from "@/src/components/MatchList";
import { matchesForRound } from "@/matches-core";
import type { Club, Match } from "@/src/types";

interface RoundBrowserProps {
  rounds: number[];
  round: number | null;
  matches: Match[];
  clubs?: Club[];
  onSelectRound: (round: number) => void;
  onSelectMatch?: (id: string) => void;
}

/**
 * Browse the fixtures of any round. Opens on the current round — see
 * `currentRound` in matches-core — so the default view is the one a reader
 * arriving mid-season wants, and the rest of the season is a step away.
 */
export function RoundBrowser({
  rounds,
  round,
  matches,
  clubs,
  onSelectRound,
  onSelectMatch,
}: RoundBrowserProps) {
  if (round === null || rounds.length === 0) {
    return <p className="text-sm text-slate-400">Nenhuma rodada disponível.</p>;
  }

  const index = rounds.indexOf(round);
  const previous = index > 0 ? rounds[index - 1] : null;
  const next = index >= 0 && index < rounds.length - 1 ? rounds[index + 1] : null;

  const stepClass =
    "rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 " +
    "hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          className={stepClass}
          onClick={() => previous !== null && onSelectRound(previous)}
          disabled={previous === null}
          aria-label="Rodada anterior"
        >
          <span aria-hidden="true">←</span>
        </button>

        <div className="flex items-center gap-2">
          <label htmlFor="seletor-rodada" className="text-sm text-slate-400">
            Rodada
          </label>
          <select
            id="seletor-rodada"
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
            value={round}
            onChange={(event) => onSelectRound(Number(event.target.value))}
          >
            {rounds.map((value) => (
              <option key={value} value={value}>
                {value}ª
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className={stepClass}
          onClick={() => next !== null && onSelectRound(next)}
          disabled={next === null}
          aria-label="Próxima rodada"
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <h2 className="mb-3 text-sm font-medium text-slate-400">{round}ª rodada</h2>
      <MatchList
        matches={matchesForRound(matches, round)}
        clubs={clubs}
        onSelectMatch={onSelectMatch}
      />
    </>
  );
}
