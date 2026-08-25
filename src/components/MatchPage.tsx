import {
  clubsOf,
  highlightsSearchUrl,
  highlights,
  hasHighlights,
  venueLabel,
} from "@/match-core";
import { BroadcasterMark } from "@/src/components/BroadcasterMark";
import { controlClasses } from "@/src/components/Button";
import { ClubCrest } from "@/src/components/ClubCrest";
import { clubKey } from "@/club-core";
import { lastRecordedRound } from "@/rank-history-core";
import { RankSparkline } from "@/src/components/RankSparkline";
import { formatRoute } from "@/route-core";
import type { Club, ClubRankHistory, Match, RankAtRound } from "@/src/types";

interface MatchPageProps {
  match: Match | null;
  /** Whether the first load is still in flight. Without it a missing match and
   *  a payload that has not arrived look the same, and the page picks wrong. */
  loading?: boolean;
  clubs: Club[];
  onBack: () => void;
  onNavigate: (path: string) => void;
  /** Every club's campanha. Omit and the section is left out entirely. */
  rankHistory?: ClubRankHistory[];
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

/**
 * One club's campanha, stacked with its opponent's rather than drawn on shared
 * axes in two colours.
 *
 * Two lines in one box would compare better, but only by introducing a
 * categorical palette: this app has semantic tokens and no series colours, so a
 * second hue would need a CVD-safe pair, a legend, and a rule for which club
 * gets which — none of which exists yet, for one chart. Stacked small multiples
 * compare almost as well, because the two share one scale and their rounds line
 * up vertically, and they keep the mark identical to the Classificação and the
 * club page.
 */
function Campaign({
  club,
  code,
  entries,
  clubCount,
  lastRound,
}: {
  club: Club | null;
  code: string;
  entries: RankAtRound[];
  clubCount: number;
  lastRound: number;
}) {
  const first = entries[0];
  const last = entries[entries.length - 1];

  return (
    <div>
      <p className="mb-1 text-xs font-medium">{club?.shortName ?? code}</p>
      <RankSparkline
        entries={entries}
        clubCount={clubCount}
        lastRound={lastRound}
        size="page"
      />
      <p className="mt-1 flex justify-between text-xs tabular-nums text-ink-faint">
        <span>{first.position}º · 1ª rodada</span>
        <span>
          {last.position}º · {last.round}ª rodada
        </span>
      </p>
    </div>
  );
}

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
export function MatchPage({
  match,
  loading = false,
  clubs,
  onBack,
  onNavigate,
  rankHistory,
}: MatchPageProps) {
  if (!match) {
    return (
      <>
        <button type="button" onClick={onBack} className="text-sm text-ink-muted hover:text-ink-soft">
          ← Voltar
        </button>
        <p className="mt-4 text-sm text-ink-muted" role={loading ? "status" : undefined}>
          {loading ? "Carregando página…" : "Partida não encontrada."}
        </p>
      </>
    );
  }

  const { home, away } = clubsOf(match, clubs);
  const campaignOf = (code: string) =>
    rankHistory?.find((entry) => entry.clubCode === code)?.entries ?? [];
  const homeCampaign = campaignOf(match.homeCode);
  const awayCampaign = campaignOf(match.awayCode);
  const lastRound = lastRecordedRound(rankHistory ?? []);
  // Both or neither: one club's season drawn beside a gap invites the reading
  // that the other has not played, rather than that we lack its history.
  const showCampaigns =
    lastRound > 0 && homeCampaign.length > 0 && awayCampaign.length > 0;
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
            <dd className="mt-1 flex flex-wrap items-center gap-1.5">
              {match.broadcasters.map((name) => (
                <BroadcasterMark key={name} name={name} />
              ))}
            </dd>
          </div>
        )}
      </dl>

      {showCampaigns && (
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-ink-muted">Campanha</h3>
          {/* Stacked, not side by side: the rounds line up vertically, so "who
              was above whom in round 12" is read by looking straight down. */}
          <div className="space-y-4 rounded-lg border border-line bg-surface/50 px-3 py-3">
            <Campaign
              club={home}
              code={match.homeCode}
              entries={homeCampaign}
              clubCount={rankHistory?.length ?? 0}
              lastRound={lastRound}
            />
            <Campaign
              club={away}
              code={match.awayCode}
              entries={awayCampaign}
              clubCount={rankHistory?.length ?? 0}
              lastRound={lastRound}
            />
          </div>
        </section>
      )}

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
                      {/* The publisher is a broadcaster like any other, so it
                          wears the same mark it wears under "Onde assistir".
                          The mark carries the channel name as its alt, so the
                          link still reads aloud as "ge tv". */}
                      <BroadcasterMark name={video.channel} size="sm" decorative />
                      <span className="sr-only">
                        {video.channel} — melhores momentos no YouTube (abre em nova
                        aba)
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
