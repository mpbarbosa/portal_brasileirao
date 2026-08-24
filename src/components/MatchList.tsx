import { formatRoute } from "@/route-core";
import { CLUBS_BY_CODE } from "@/src/data/clubs";
import type { Club, Match } from "@/src/types";

const STATUS_LABEL: Record<Match["status"], string> = {
  SCHEDULED: "A realizar",
  LIVE: "Ao vivo",
  FINISHED: "Encerrado",
  POSTPONED: "Adiado",
  CANCELLED: "Cancelado",
};

const STATUS_CLASS: Record<Match["status"], string> = {
  SCHEDULED: "bg-slate-800 text-slate-300",
  LIVE: "bg-emerald-500/20 text-emerald-300",
  FINISHED: "bg-slate-800 text-slate-400",
  POSTPONED: "bg-amber-500/20 text-amber-300",
  CANCELLED: "bg-rose-500/20 text-rose-300",
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
    return <p className="text-sm text-slate-400">Nenhuma partida nesta rodada.</p>;
  }

  const byCode = new Map(clubs?.map((club) => [club.code, club]));
  const clubName = (code: string) =>
    byCode.get(code)?.shortName ?? CLUBS_BY_CODE.get(code)?.shortName ?? code;

  return (
    <ul className="space-y-2">
      {matches.map((match) => (
        <li
          key={match.id}
          className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3"
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
                className="block truncate font-medium underline decoration-slate-700 underline-offset-2 hover:decoration-slate-400"
              >
                {clubName(match.homeCode)}{" "}
                <span className="font-semibold tabular-nums text-slate-300">{score(match)}</span>{" "}
                {clubName(match.awayCode)}
              </a>
            ) : (
              <p className="truncate font-medium">
                {clubName(match.homeCode)}{" "}
                <span className="font-semibold tabular-nums text-slate-300">{score(match)}</span>{" "}
                {clubName(match.awayCode)}
              </p>
            )}
            <p className="mt-0.5 text-xs text-slate-500">{kickoffLabel(match.kickoff)}</p>
            {match.broadcasters && (
              <p className="mt-0.5 truncate text-xs text-slate-400">
                <span className="mr-1" aria-hidden="true">
                  📺
                </span>
                <span className="sr-only">Onde assistir: </span>
                {match.broadcasters.join(" · ")}
              </p>
            )}
          </div>
          <span
            className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${STATUS_CLASS[match.status]}`}
          >
            {STATUS_LABEL[match.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}
