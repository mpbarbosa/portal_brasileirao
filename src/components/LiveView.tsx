import { useMemo } from "react";

import { clubsOf } from "@/match-core";
import { countdownLabel, liveBoard } from "@/live-core";
import { BroadcasterMark } from "@/src/components/BroadcasterMark";
import { ClubCrest } from "@/src/components/ClubCrest";
import { LINK_UNDERLINE } from "@/src/components/interaction";
import { MatchList } from "@/src/components/MatchList";
import { formatRoute } from "@/route-core";
import { Surface } from "@/src/components/Surface";
import { useNow } from "@/src/useNow";
import type { Club, Match } from "@/src/types";

/**
 * How often the contagem regressiva is recomputed.
 *
 * Half a minute for a label written in minutes: a one-second timer would
 * re-render the page sixty times for each number a reader actually sees change.
 * The refetch cadence is a separate decision and lives in `App` — this clock
 * only moves the text the page already holds.
 */
const TICK_MS = 30_000;

/** Only a plain left-click is ours; modified clicks belong to the browser. */
const isPlainClick = (event: React.MouseEvent) =>
  !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0;

/** One club's side of a live scoreboard: crest above the name, centred. */
function Side({ club, code }: { club: Club | null; code: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
      {club && <ClubCrest club={club} size={40} />}
      <span className="truncate text-body-medium font-semibold">{club?.shortName ?? code}</span>
    </div>
  );
}

/**
 * A match in progress, at the size the page's whole point deserves.
 *
 * Deliberately *not* a `MatchList` row: everything below the fold on this page
 * is a row, and a live match that looked like one would be indistinguishable
 * from the fixture that kicks off tomorrow. The card is the difference.
 *
 * The mark is a pulsing dot **plus the words "Bola rolando"** — the dot alone
 * says nothing to a screen reader and nothing at all to a reader who cannot
 * separate its colour from the chip beside it. `prefers-reduced-motion` stops
 * the pulse globally (src/index.css); the words are what carry the fact.
 */
function LiveMatchCard({
  match,
  clubs,
  onSelectMatch,
}: {
  match: Match;
  clubs: Club[];
  onSelectMatch: (id: string) => void;
}) {
  const { home, away } = clubsOf(match, clubs);
  const path = formatRoute({ section: "partida", id: match.id });
  const played = match.homeGoals !== null && match.awayGoals !== null;

  return (
    <Surface as="li" filled className="p-4" data-live-match={match.id}>
      <div className="flex items-center justify-between gap-2 text-body-small text-ink-faint">
        <span>{match.round}ª rodada</span>
        <span className="inline-flex items-center gap-1.5 text-primary">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-positive"
          />
          <span className="text-label-medium font-medium">Bola rolando</span>
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <Side club={home} code={match.homeCode} />
        <p className="shrink-0 text-headline-small font-bold tabular-nums">
          {played ? (
            <>
              {match.homeGoals} <span className="text-ink-ghost">×</span> {match.awayGoals}
            </>
          ) : (
            <span className="text-ink-ghost">×</span>
          )}
        </p>
        <Side club={away} code={match.awayCode} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <a
          href={path}
          onClick={(event) => {
            if (!isPlainClick(event)) return;
            event.preventDefault();
            onSelectMatch(match.id);
          }}
          className={`text-body-small ${LINK_UNDERLINE}`}
        >
          Ver a partida
          <span className="sr-only">
            {` ${home?.shortName ?? match.homeCode} × ${away?.shortName ?? match.awayCode}`}
          </span>
        </a>

        {match.broadcasters && (
          <span className="flex flex-wrap items-center gap-1">
            <span className="sr-only">Onde assistir: </span>
            {match.broadcasters.map((name) => (
              <BroadcasterMark key={name} name={name} size="sm" />
            ))}
          </span>
        )}
      </div>
    </Surface>
  );
}

interface LiveViewProps {
  matches: Match[];
  clubs?: Club[];
  /** Whether the first load is still in flight — see `App`. */
  loading?: boolean;
  onSelectMatch: (id: string) => void;
  /** Where "ver todos os jogos" goes. */
  onBrowseRounds: () => void;
}

/**
 * **Ao vivo** — the page that answers "o que está acontecendo agora?".
 *
 * Three questions, in the order a reader asks them: what is being played, what
 * comes next, and what just finished. `/jogos` answers a different one — the
 * fixtures of a round you name — so this page never grows a round picker.
 *
 * The "Agora" section renders even when nothing is live, because an absent
 * section reads as a page that failed to load; a sentence saying the round is
 * not being played is the answer, and it is the honest one for five days out of
 * seven.
 *
 * No match minute is shown anywhere here. See `live-core.ts` for why an elapsed
 * clock derived from kickoff is a lie from half-time onward.
 */
export function LiveView({
  matches,
  clubs,
  loading = false,
  onSelectMatch,
  onBrowseRounds,
}: LiveViewProps) {
  const now = useNow(TICK_MS);
  const board = useMemo(() => liveBoard(matches, now), [matches, now]);

  if (loading && matches.length === 0) {
    return (
      <p className="text-body-medium text-ink-muted" role="status">
        Carregando jogos…
      </p>
    );
  }

  const clubList = clubs ?? [];

  return (
    <>
      <section aria-labelledby="ao-vivo-agora">
        <h2 id="ao-vivo-agora" className="mb-3 text-body-medium font-medium text-ink-muted">
          Agora
        </h2>

        {board.live.length > 0 ? (
          <>
            {/* `aria-live="polite"`: the page refetches on its own, so a score
                can change with no interaction to explain it. Polite rather than
                assertive — a goal is worth announcing, not worth interrupting
                whatever is being read. */}
            <ul className="space-y-3" aria-live="polite">
              {board.live.map((match) => (
                <LiveMatchCard
                  key={match.id}
                  match={match}
                  clubs={clubList}
                  onSelectMatch={onSelectMatch}
                />
              ))}
            </ul>
            <p className="mt-2 text-body-small text-ink-faint">
              Placares atualizados automaticamente enquanto a página estiver aberta.
            </p>
          </>
        ) : (
          <p className="text-body-medium text-ink-muted">
            Nenhuma partida em andamento agora.
          </p>
        )}
      </section>

      {board.upcoming.length > 0 && (
        <section className="mt-8" aria-labelledby="ao-vivo-a-seguir">
          <h2 id="ao-vivo-a-seguir" className="mb-3 text-body-medium font-medium text-ink-muted">
            A seguir
          </h2>
          <MatchList
            matches={board.upcoming}
            clubs={clubs}
            onSelectMatch={onSelectMatch}
            note={(match) => countdownLabel(match.kickoff, now)}
          />
        </section>
      )}

      {board.recent.length > 0 && (
        <section className="mt-8" aria-labelledby="ao-vivo-resultados">
          <h2
            id="ao-vivo-resultados"
            className="mb-3 text-body-medium font-medium text-ink-muted"
          >
            Últimos resultados
          </h2>
          <MatchList matches={board.recent} clubs={clubs} onSelectMatch={onSelectMatch} />
        </section>
      )}

      <p className="mt-8 text-body-small text-ink-faint">
        <a
          href={formatRoute({ section: "jogos", round: null })}
          onClick={(event) => {
            if (!isPlainClick(event)) return;
            event.preventDefault();
            onBrowseRounds();
          }}
          className={LINK_UNDERLINE}
        >
          Ver todos os jogos por rodada
        </a>
      </p>
    </>
  );
}
