import { formatRoute } from "@/route-core";
import { BroadcasterMark } from "@/src/components/BroadcasterMark";
import { CLUBS_BY_CODE } from "@/src/data/clubs";
import { LINK_UNDERLINE } from "@/src/components/interaction";
import { Surface } from "@/src/components/Surface";
import type { Club, Match } from "@/src/types";

const STATUS_LABEL: Record<Match["status"], string> = {
  SCHEDULED: "A realizar",
  LIVE: "Ao vivo",
  FINISHED: "Encerrado",
  POSTPONED: "Adiado",
  CANCELLED: "Cancelado",
};

const STATUS_CLASS: Record<Match["status"], string> = {
  SCHEDULED: "bg-surface-container text-ink-soft",
  LIVE: "bg-positive/20 text-positive-ink",
  FINISHED: "bg-surface-container text-ink-muted",
  POSTPONED: "bg-warning/20 text-warning-ink",
  CANCELLED: "bg-negative/20 text-negative-ink",
};

const kickoffLabel = (kickoff: string): string => {
  const parsed = new Date(kickoff);
  if (Number.isNaN(parsed.getTime())) return "Horário a definir";

  return parsed.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const score = (match: Match): string =>
  match.homeGoals === null || match.awayGoals === null
    ? "×"
    : `${match.homeGoals} × ${match.awayGoals}`;

interface MatchListProps {
  matches: Match[];
  clubs?: Club[];
  /** Omit to render plain rows — the list stands on its own. */
  onSelectMatch?: (id: string) => void;
}

export function MatchList({ matches, clubs, onSelectMatch }: MatchListProps) {
  if (matches.length === 0) {
    return <p className="text-sm text-ink-muted">Nenhuma partida nesta rodada.</p>;
  }

  const byCode = new Map(clubs?.map((club) => [club.code, club]));
  const clubName = (code: string) =>
    byCode.get(code)?.shortName ?? CLUBS_BY_CODE.get(code)?.shortName ?? code;

  return (
    <ul className="space-y-2">
      {matches.map((match) => (
        <Surface
          as="li"
          filled
          key={match.id}
          className="flex items-center justify-between gap-4 px-4 py-3"
        >
          <div className="min-w-0">
            {onSelectMatch ? (
              <a
                href={formatRoute({ section: "partida", id: match.id })}
                onClick={(event) => {
                  if (
                    event.metaKey || event.ctrlKey || event.shiftKey ||
                    event.altKey || event.button !== 0
                  ) {
                    return;
                  }
                  event.preventDefault();
                  onSelectMatch(match.id);
                }}
                className={`block truncate font-medium ${LINK_UNDERLINE}`}
              >
                {clubName(match.homeCode)}{" "}
                <span className="font-semibold tabular-nums text-ink-soft">{score(match)}</span>{" "}
                {clubName(match.awayCode)}
              </a>
            ) : (
              <p className="truncate font-medium">
                {clubName(match.homeCode)}{" "}
                <span className="font-semibold tabular-nums text-ink-soft">{score(match)}</span>{" "}
                {clubName(match.awayCode)}
              </p>
            )}
            <p className="mt-0.5 text-xs text-ink-faint">{kickoffLabel(match.kickoff)}</p>
            {match.broadcasters && (
              <p className="mt-1 flex flex-wrap items-center gap-1">
                <span className="sr-only">Onde assistir: </span>
                {match.broadcasters.map((name) => (
                  <BroadcasterMark key={name} name={name} size="sm" />
                ))}
              </p>
            )}
          </div>
          <span
            className={`shrink-0 rounded-x-small px-2 py-1 text-xs font-medium ${STATUS_CLASS[match.status]}`}
          >
            {STATUS_LABEL[match.status]}
          </span>
        </Surface>
      ))}
    </ul>
  );
}
