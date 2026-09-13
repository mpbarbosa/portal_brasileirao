import { clubsOf } from "@/match-core";
import { countdownLabel, liveBoard } from "@/live-core";
import { hasScore } from "@/matches-core";
import { BroadcasterMark } from "@/src/components/BroadcasterMark";
import { ClubCrest } from "@/src/components/ClubCrest";
import { ClubPageLink } from "@/src/components/ClubPageLink";
import { WikipediaLink } from "@/src/components/ClubLinks";
import { LINK_UNDERLINE } from "@/src/components/interaction";
import { isPlainClick } from "@/src/components/plainClick";
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

/**
 * One club's side of a live scoreboard: crest in a bordered tile, the name
 * beneath it as a link to the club's page, and its Wikipédia article — the
 * same idiom `MatchPage`'s own `Side` draws, at the same 56px, so a reader
 * moving from a live card to the fixture it links to meets one scoreboard
 * rather than two. The *A seguir* and *Últimos resultados* rows below stay on
 * `FixtureSides` at 20px, classificação size, where the arch is mush and three
 * letters read — that boundary is unchanged, only where it sits moved: every
 * crest here takes the mark, at the match page's own size rather than a third
 * one of its own.
 */
function Side({
  club,
  code,
  onSelectClub,
}: {
  club: Club | null;
  code: string;
  onSelectClub: (key: string) => void;
}) {
  const label = club?.shortName ?? code;

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      {club && (
        <span className="flex items-center justify-center rounded-medium border border-outline-variant bg-surface-container-low p-2">
          <ClubCrest club={club} size={56} fallback="mark" />
        </span>
      )}
      {club ? (
        <ClubPageLink club={club} onSelectClub={onSelectClub} className="truncate font-semibold">
          {label}
        </ClubPageLink>
      ) : (
        <span className="truncate font-semibold">{label}</span>
      )}
      {club && <WikipediaLink title={club.wikipedia} subject="do clube" extra="text-body-small" />}
    </div>
  );
}

/**
 * A match in progress, drawn as the same scoreboard `MatchPage` opens on.
 *
 * Deliberately *not* a `MatchList` row: everything below the fold on this page
 * is a row, and a live match that looked like one would be indistinguishable
 * from the fixture that kicks off tomorrow. The card is the difference, and it
 * now shares its whole shape with the Partida page's own scoreboard — the
 * bordered crest tile, the sized score tray, the round line above — rather
 * than a smaller, differently-sized card that happened to show the same
 * fixture. A reader following "Ver a partida" from here lands on a scoreboard
 * they have already seen once, not a new drawing of one.
 *
 * The round-and-status header keeps its own mark rather than adopting
 * `StatusChip`: the pulsing dot **plus the words "Bola rolando"** says more
 * than the chip's generic "Ao vivo" would, and the dot alone says nothing to a
 * screen reader and nothing at all to a reader who cannot separate its colour
 * from the chip beside it. `prefers-reduced-motion` stops the pulse globally
 * (src/index.css); the words are what carry the fact. It is stacked and
 * centred above the score, like `MatchPage`'s own round-plus-`StatusChip`
 * pair, rather than pinned to opposite corners.
 */
function LiveMatchCard({
  match,
  clubs,
  onSelectMatch,
  onSelectClub,
}: {
  match: Match;
  clubs: Club[];
  onSelectMatch: (id: string) => void;
  onSelectClub: (key: string) => void;
}) {
  const { home, away } = clubsOf(match, clubs);
  const path = formatRoute({ section: "partida", id: match.id });
  const played = hasScore(match);

  return (
    <Surface as="li" filled className="p-5 sm:p-6" data-live-match={match.id}>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="text-body-small text-ink-faint">{match.round}ª rodada</span>
        <span className="inline-flex items-center gap-1.5 text-primary">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-positive"
          />
          <span className="text-label-medium font-medium">Bola rolando</span>
        </span>
      </div>

      <div className="mt-5 flex items-center justify-center gap-3 sm:gap-6">
        <Side club={home} code={match.homeCode} onSelectClub={onSelectClub} />

        <div className="shrink-0 rounded-medium bg-surface-container-lowest px-4 py-3 text-center sm:px-6">
          {played ? (
            <p className="text-display-large font-bold tabular-nums">
              {match.homeGoals} <span className="text-ink-ghost">×</span> {match.awayGoals}
            </p>
          ) : (
            <p className="text-headline-medium font-bold text-ink-ghost">×</p>
          )}
        </div>

        <Side club={away} code={match.awayCode} onSelectClub={onSelectClub} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 border-t border-outline-variant pt-3">
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
  /** Opens a club's own page, from a live card's crest or name. */
  onSelectClub: (key: string) => void;
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
  onSelectClub,
  onBrowseRounds,
}: LiveViewProps) {
  const now = useNow(TICK_MS);
  // No `useMemo`, and that is measured rather than assumed. `now` changes on
  // every tick, which is the render this component mostly has, so a memo keyed
  // on it recomputes there anyway; the board costs 0.14 ms over the seed's 380
  // fixtures (median, warm, 2026-09-11).
  const board = liveBoard(matches, now);

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
                  onSelectClub={onSelectClub}
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
