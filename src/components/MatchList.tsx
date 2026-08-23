import { CLUBS_BY_CODE } from "@/src/data/clubs";
import type { Match } from "@/src/types";

const STATUS_LABEL: Record<Match["status"], string> = {
  SCHEDULED: "A realizar",
  LIVE: "Ao vivo",
  FINISHED: "Encerrado",
};

const STATUS_CLASS: Record<Match["status"], string> = {
  SCHEDULED: "bg-slate-800 text-slate-300",
  LIVE: "bg-emerald-500/20 text-emerald-300",
  FINISHED: "bg-slate-800 text-slate-400",
};

const clubName = (code: string) => CLUBS_BY_CODE.get(code)?.shortName ?? code;

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

export function MatchList({ matches }: { matches: Match[] }) {
  if (matches.length === 0) {
    return <p className="text-sm text-slate-400">Nenhuma partida nesta rodada.</p>;
  }

  return (
    <ul className="space-y-2">
      {matches.map((match) => (
        <li
          key={match.id}
          className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">
              {clubName(match.homeCode)}{" "}
              <span className="font-semibold tabular-nums text-slate-300">{score(match)}</span>{" "}
              {clubName(match.awayCode)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{kickoffLabel(match.kickoff)}</p>
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
