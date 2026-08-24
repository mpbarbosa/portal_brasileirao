import { clubsOf, goalsSearchUrl, hasGoalsToShow, venueLabel } from "@/match-core";
import { ClubCrest } from "@/src/components/ClubCrest";
import { clubKey } from "@/club-core";
import { formatRoute } from "@/route-core";
import type { Club, Match } from "@/src/types";

interface MatchPageProps {
  match: Match | null;
  clubs: Club[];
  onBack: () => void;
  onNavigate: (path: string) => void;
}

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
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** A club's side of the scoreboard: crest, name, and a link to its page. */
function Side({ club, code, onNavigate }: { club: Club | null; code: string; onNavigate: (p: string) => void }) {
  const label = club?.shortName ?? code;

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      {club && <ClubCrest club={club} size={56} />}
      {club ? (
        <a
          href={formatRoute({ section: "clube", key: clubKey(club) })}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
            onNavigate(formatRoute({ section: "clube", key: clubKey(club) }));
          }}
          className="truncate font-semibold underline decoration-slate-600 underline-offset-2 hover:decoration-slate-300"
        >
          {label}
        </a>
      ) : (
        <span className="truncate font-semibold">{label}</span>
      )}
    </div>
  );
}

/**
 * One fixture in full: scoreboard, kickoff, venue, and either where to watch it
 * or where to find its goals.
 *
 * Every field beyond the score is optional — the provider supplies no venue and
 * no broadcast data, both arriving from the CBF sync — so each section renders
 * only when its data exists rather than showing an empty row.
 */
export function MatchPage({ match, clubs, onBack, onNavigate }: MatchPageProps) {
  if (!match) {
    return (
      <>
        <button type="button" onClick={onBack} className="text-sm text-slate-400 hover:text-slate-200">
          ← Voltar
        </button>
        <p className="mt-4 text-sm text-slate-400">Partida não encontrada.</p>
      </>
    );
  }

  const { home, away } = clubsOf(match, clubs);
  const venue = venueLabel(match);
  const played = match.homeGoals !== null && match.awayGoals !== null;

  return (
    <>
      <button type="button" onClick={onBack} className="text-sm text-slate-400 hover:text-slate-200">
        ← Voltar
      </button>

      <article className="mt-3 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>{match.round}ª rodada</span>
          <span className={`rounded px-2 py-1 font-medium ${STATUS_CLASS[match.status]}`}>
            {STATUS_LABEL[match.status]}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <Side club={home} code={match.homeCode} onNavigate={onNavigate} />

          <div className="shrink-0 text-center">
            {played ? (
              <p className="text-3xl font-bold tabular-nums">
                {match.homeGoals} <span className="text-slate-600">×</span> {match.awayGoals}
              </p>
            ) : (
              <p className="text-2xl font-bold text-slate-600">×</p>
            )}
          </div>

          <Side club={away} code={match.awayCode} onNavigate={onNavigate} />
        </div>
      </article>

      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Data e hora</dt>
          <dd className="font-medium first-letter:uppercase">{kickoffLabel(match.kickoff)}</dd>
        </div>

        {venue && (
          <div>
            <dt className="text-xs text-slate-500">Estádio</dt>
            <dd className="font-medium">{venue}</dd>
          </div>
        )}

        {match.broadcasters && (
          <div>
            <dt className="text-xs text-slate-500">Onde assistir</dt>
            <dd className="font-medium">{match.broadcasters.join(" · ")}</dd>
          </div>
        )}
      </dl>

      {hasGoalsToShow(match) && (
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-slate-400">Gols</h3>
          <a
            href={goalsSearchUrl(home?.shortName ?? match.homeCode, away?.shortName ?? match.awayCode)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            <span aria-hidden="true">▶</span>
            Procurar os gols no YouTube
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
          {/* Honest about what this is: no provider we use exposes highlight
              links, so this opens a search rather than pretending to know the
              official video. */}
          <p className="mt-2 text-xs text-slate-500">
            Abre uma busca no YouTube — não é um vídeo oficial escolhido por nós.
          </p>
        </section>
      )}
    </>
  );
}
