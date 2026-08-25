import {
  clubsOf,
  highlightsSearchUrl,
  highlights,
  hasHighlights,
  venueLabel,
} from "@/match-core";
import { controlClasses } from "@/src/components/Button";
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
  SCHEDULED: "bg-raised text-ink-soft",
  LIVE: "bg-positive/20 text-positive-ink",
  FINISHED: "bg-raised text-ink-muted",
  POSTPONED: "bg-warning/20 text-warning-ink",
  CANCELLED: "bg-negative/20 text-negative-ink",
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
          className="truncate font-semibold underline decoration-ink-ghost underline-offset-2 hover:decoration-ink-soft"
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
        <button type="button" onClick={onBack} className="text-sm text-ink-muted hover:text-ink-soft">
          ← Voltar
        </button>
        <p className="mt-4 text-sm text-ink-muted">Partida não encontrada.</p>
      </>
    );
  }

  const { home, away } = clubsOf(match, clubs);
  const venue = venueLabel(match);
  const videos = highlights(match);
  const played = match.homeGoals !== null && match.awayGoals !== null;

  return (
    <>
      <button type="button" onClick={onBack} className="text-sm text-ink-muted hover:text-ink-soft">
        ← Voltar
      </button>

      <article className="mt-3 rounded-xl border border-line bg-surface/50 p-5">
        <div className="flex items-center justify-between gap-2 text-xs text-ink-faint">
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
                {match.homeGoals} <span className="text-ink-ghost">×</span> {match.awayGoals}
              </p>
            ) : (
              <p className="text-2xl font-bold text-ink-ghost">×</p>
            )}
          </div>

          <Side club={away} code={match.awayCode} onNavigate={onNavigate} />
        </div>
      </article>

      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs text-ink-faint">Data e hora</dt>
          <dd className="font-medium first-letter:uppercase">{kickoffLabel(match.kickoff)}</dd>
        </div>

        {venue && (
          <div>
            <dt className="text-xs text-ink-faint">Estádio</dt>
            <dd className="font-medium">{venue}</dd>
          </div>
        )}

        {match.broadcasters && (
          <div>
            <dt className="text-xs text-ink-faint">Onde assistir</dt>
            <dd className="font-medium">{match.broadcasters.join(" · ")}</dd>
          </div>
        )}
      </dl>

      {hasHighlights(match) && (
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-ink-muted">Melhores momentos</h3>

          {/* Curated links beat the search: they point at the rights holders'
              own packages rather than whatever a query happens to surface.
              Several broadcasters cover the same match, so all are offered and
              labelled by channel — the reader picks. */}
          {videos.length > 0 ? (
            <>
              <ul className="flex flex-wrap gap-2">
                {videos.map((video) => (
                  <li key={video.url}>
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={controlClasses("md", "inline-flex items-center gap-2")}
                    >
                      <span aria-hidden="true">▶</span>
                      {video.channel}
                      <span className="sr-only">
                        {" "}
                        — melhores momentos no YouTube (abre em nova aba)
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-faint">
                {videos.length === 1
                  ? "Melhores momentos no YouTube."
                  : "Melhores momentos no YouTube, por emissora."}
              </p>
            </>
          ) : (
            <>
              <a
                href={highlightsSearchUrl(
                  home?.shortName ?? match.homeCode,
                  away?.shortName ?? match.awayCode,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className={controlClasses("md", "inline-flex items-center gap-2")}
              >
                <span aria-hidden="true">▶</span>
                Procurar melhores momentos no YouTube
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
              {/* Honest about what this is: without a curated link we do not
                  know the official video, so this opens a search and says so. */}
              <p className="mt-2 text-xs text-ink-faint">
                Abre uma busca no YouTube — não é um vídeo oficial escolhido por nós.
              </p>
            </>
          )}
        </section>
      )}
    </>
  );
}
