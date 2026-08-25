import { Button, controlClasses } from "@/src/components/Button";
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
    return <p className="text-body-medium text-ink-muted">Nenhuma rodada disponível.</p>;
  }

  const index = rounds.indexOf(round);
  const previous = index > 0 ? rounds[index - 1] : null;
  const next = index >= 0 && index < rounds.length - 1 ? rounds[index + 1] : null;

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button
          size="xs"
          onClick={() => previous !== null && onSelectRound(previous)}
          disabled={previous === null}
          aria-label="Rodada anterior"
        >
          <span aria-hidden="true">←</span>
        </Button>

        <div className="flex items-center gap-2">
          <label htmlFor="seletor-rodada" className="text-body-medium text-ink-muted">
            Rodada
          </label>
          <select
            id="seletor-rodada"
            /* No text-colour override: two utilities of equal specificity are
               resolved by stylesheet order, not class order, so an override
               here would be a coin flip. The base tone matches the steppers
               either side, which is what this should look like anyway. */
            className={controlClasses("xs", "bg-surface-container-low")}
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

        <Button
          size="xs"
          onClick={() => next !== null && onSelectRound(next)}
          disabled={next === null}
          aria-label="Próxima rodada"
        >
          <span aria-hidden="true">→</span>
        </Button>
      </div>

      <h2 className="mb-3 text-body-medium font-medium text-ink-muted">{round}ª rodada</h2>
      <MatchList
        matches={matchesForRound(matches, round)}
        clubs={clubs}
        onSelectMatch={onSelectMatch}
      />
    </>
  );
}
