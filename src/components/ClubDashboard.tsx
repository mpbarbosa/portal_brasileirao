import { useMemo } from "react";

import { clubKey, findClub, standingFor } from "@/club-core";
import { candlesFor, computeRankCandles, summariseCandles } from "@/rank-candles-core";
import { lastRecordedRound, lastRoundWithResult } from "@/rank-history-core";
import { formatRoute } from "@/route-core";
import type { CampaignPlotKind } from "@/campaign-plot-core";
import { CampaignPlotToggle } from "@/src/components/CampaignPlotToggle";
import { ClubCrest } from "@/src/components/ClubCrest";
import { ClubProfile } from "@/src/components/ClubProfile";
import { StatTile } from "@/src/components/ClubView";
import { BACK_LINK, LINK_UNDERLINE } from "@/src/components/interaction";
import { RankCandles } from "@/src/components/RankCandles";
import { RankSparkline } from "@/src/components/RankSparkline";
import { Surface } from "@/src/components/Surface";
import type { Club, ClubRankHistory, Match, StandingsRow } from "@/src/types";

interface ClubDashboardProps {
  /** Slug or code, straight from the URL — the same key the club page takes. */
  clubKey: string;
  /** Whether the first load is still in flight. Without it an empty payload and
   *  an unknown club are indistinguishable, and the page picks the wrong one. */
  loading?: boolean;
  standings: StandingsRow[];
  matches: Match[];
  clubs?: Club[];
  /**
   * Every club's campanha, for the line above the candles. Omit and that
   * section is left out entirely — the candles are computed here from the
   * fixture list and stand without it.
   */
  rankHistory?: ClubRankHistory[];
  /**
   * Which mark the campanha is drawn as, and the way to flip it — one choice
   * shared with the Classificação and the Partida page, owned by `App`. Omit
   * and the line is drawn with no control, which is what the section did
   * before the choice existed.
   */
  plotKind?: CampaignPlotKind;
  onTogglePlotKind?: () => void;
  /** Back to the club's own page, which is what this one drills down from. */
  onBack: () => void;
  /** Follow the link to the club page in-app. Omit and it stays a plain
   *  `<a href>`, which is what a crawler follows either way. */
  onSelectClub?: (key: string) => void;
}

/**
 * The **Painel do clube** — one club's season rodada a rodada.
 *
 * It exists because the campanha sparkline answers only "where did the club
 * finish each round". This page asks the next question: what happened *inside*
 * the round. A candle carries where the round opened, where it closed, how far
 * the club swung while it was being played, and — in its colour — what the
 * club's own result was, which is the fact most often at odds with the
 * movement: winning and dropping a place is an ordinary Sunday.
 *
 * Everything here is **derived from the fixture list the client already
 * holds**, exactly like the campanha: `/api/matches` ships the whole season in
 * one response, so a painel costs no request and no endpoint. That is also why
 * the calculation runs for the whole division rather than for this club — a
 * club's position at an instant depends on what everyone else had done by then,
 * so twenty clubs cost what one does.
 *
 * Not a nav destination, and it must not become one: it is reached from the
 * club page and from the sitemap, exactly as a stadium is reached from a
 * fixture. `NAV_ITEMS` is full at MD3's five.
 */
export function ClubDashboard({
  clubKey: key,
  loading = false,
  standings,
  matches,
  clubs,
  rankHistory,
  plotKind = "line",
  onTogglePlotKind,
  onBack,
  onSelectClub,
}: ClubDashboardProps) {
  // Both lists, in the club page's order and for its reason: the URL may name
  // the club by slug or by code, and the club itself may appear in only one of
  // the two payloads.
  const club =
    findClub(standings.map((entry) => entry.club), key) ?? findClub(clubs ?? [], key);

  // The whole division, because the candles need every club's matches to know
  // where this one stood. Preferring the fixtures' club list over the table's
  // for the reason `App` prefers it for **Meu time**: it survives a standings
  // failure, and a painel drawn from fixtures alone is still a painel.
  const division = useMemo<Club[]>(
    () => (clubs?.length ? clubs : standings.map((entry) => entry.club)),
    [clubs, standings],
  );

  const candles = useMemo(
    () => (club ? candlesFor(computeRankCandles(division, matches), club.code) : []),
    [division, matches, club],
  );

  if (!club) {
    return (
      <>
        <button type="button" onClick={onBack} className={BACK_LINK}>
          ← Voltar
        </button>
        <p className="mt-4 text-body-medium text-ink-muted" role={loading ? "status" : undefined}>
          {loading ? "Carregando painel…" : "Clube não encontrado."}
        </p>
      </>
    );
  }

  const row = standingFor(standings, club.code);
  const summary = summariseCandles(candles);
  // The x domain, taken across the season rather than off this club's own
  // candles — a club with a game in hand must not be drawn on a shorter axis
  // than the rest, which is `lastRecordedRound`'s argument for the sparkline.
  const lastRound = lastRoundWithResult(matches) ?? 0;
  // The y domain is the size of the division, not the number of clubs that
  // happen to have a campanha recorded. **Both marks on this page share it**:
  // two drawings of one season on two y domains would be two pictures of two
  // different divisions stacked on top of each other.
  const clubCount = standings.length || division.length;

  // The line's own x domain, and deliberately not the candles' `lastRound`
  // above. The sparkline is the mark the Classificação draws, where the domain
  // is `lastRecordedRound` over the history payload; drawing it here against
  // the fixtures' last round would give the reader a different shape from the
  // one they clicked through from. The candles are computed here from the
  // fixture list and keep the domain that computation used.
  const campaign = rankHistory?.find((entry) => entry.clubCode === club.code)?.entries ?? [];
  const campaignLastRound = lastRecordedRound(rankHistory ?? []);

  const href = formatRoute({ section: "clube", key: clubKey(club) });

  return (
    <>
      <button type="button" onClick={onBack} className={BACK_LINK}>
        ← Voltar
      </button>

      <header className="mt-3 flex items-center gap-3">
        {/* `fallback="mark"` for the reason `ClubView` takes it — this is the
            same 44px club header, and the club page is the only link to this
            one. Two headers a click apart holding a missing crest two different
            ways reads as a bug rather than as a choice. */}
        <ClubCrest club={club} size={44} fallback="mark" />
        <div className="min-w-0 grow">
          <h2 className="truncate text-title-large font-bold">Painel do {club.shortName}</h2>
          {/* Both grains, because the page holds both: the line says where
              each rodada ended and the velas say what happened inside it. It
              read "A campanha rodada a rodada" while the line was still on the
              club page, which now describes only the lower half. */}
          <p className="truncate text-body-medium text-ink-muted">
            A campanha inteira, rodada a rodada
          </p>
        </div>
      </header>

      {summary && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatTile label="Posição" value={row ? `${row.position}º` : `${candles[candles.length - 1].close}º`} />
          <StatTile label="Pontos" value={String(summary.points)} />
          <StatTile label="Rodadas" value={String(summary.rounds)} />
        </div>
      )}

      {/* The line first and the candles beneath it, because they are the same
          season at two grains and the coarse one is how a reader gets their
          bearings: this says where each round *ended*, and the candles below
          say what happened while it was being played. It used to sit on the
          club page with the candles a click away, which put the two halves of
          one answer on two pages.

          The control shares the heading's row rather than sitting above the
          section: it changes this drawing and nothing else on the page, and a
          full-width row of its own would read as a page-level setting.
          `flex-wrap` because the label is a sentence — at 375dp it takes the
          second line rather than squeezing the heading. */}
      {campaign.length > 0 && campaignLastRound > 0 && (
        <section className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-body-medium font-medium text-ink-muted">Campanha</h3>
            {onTogglePlotKind && (
              <CampaignPlotToggle kind={plotKind} onToggle={onTogglePlotKind} />
            )}
          </div>
          <Surface filled className="px-3 py-3">
            <RankSparkline
              entries={campaign}
              clubCount={clubCount}
              lastRound={campaignLastRound}
              size="page"
              kind={plotKind}
            />
            {/* The drawing carries no axis, so the ends are named in text —
                which is also the only version a screen reader gets. */}
            <p className="mt-2 flex justify-between text-body-small tabular-nums text-ink-faint">
              <span>{campaign[0].position}º · 1ª rodada</span>
              <span>
                {campaign[campaign.length - 1].position}º · {campaignLastRound}ª rodada
              </span>
            </p>
          </Surface>
        </section>
      )}

      <section className="mt-6">
        <h3 className="mb-2 text-body-medium font-medium text-ink-muted">
          Campanha rodada a rodada
        </h3>
        <Surface filled className="px-3 py-3">
          {candles.length === 0 || lastRound === 0 ? (
            <p className="text-body-medium text-ink-muted">
              O campeonato ainda não teve resultados. O painel aparece a partir da 1ª rodada.
            </p>
          ) : (
            <RankCandles candles={candles} clubCount={clubCount} lastRound={lastRound} />
          )}
        </Surface>
      </section>

      {summary && (
        <section className="mt-6">
          <h3 className="mb-2 text-body-medium font-medium text-ink-muted">Destaques</h3>
          <Surface filled className="px-3 py-2">
            {/* A definition list rather than more tiles: each of these is a
                figure *and* the round it happened in, and a tile has room for
                one of the two. Cramming "3º (12ª)" into a value is a puzzle,
                not a summary. */}
            <dl className="divide-y divide-outline-variant text-body-medium">
              <Fact term="Melhor posição">
                {summary.best.position}º · {summary.best.round}ª rodada
              </Fact>
              <Fact term="Pior posição">
                {summary.worst.position}º · {summary.worst.round}ª rodada
              </Fact>
              {/* Absent rather than zeroed where a club has never climbed or
                  never fallen — "0 posições" reads as a measurement, and this
                  is the lack of one. */}
              {summary.rise && (
                <Fact term="Maior subida">
                  {summary.rise.places} {summary.rise.places === 1 ? "posição" : "posições"} ·{" "}
                  {summary.rise.round}ª rodada
                </Fact>
              )}
              {summary.fall && (
                <Fact term="Maior queda">
                  {summary.fall.places} {summary.fall.places === 1 ? "posição" : "posições"} ·{" "}
                  {summary.fall.round}ª rodada
                </Fact>
              )}
            </dl>
          </Surface>
        </section>
      )}

      {/* Below the Destaques rather than above the Campanha: the velas are what
          this page is, and the Perfil is the context they are read in. It also
          renders from a committed file while everything above it comes from
          `/api/matches`, so putting it first would leave a reader looking at a
          full section while the page's own subject was still loading. */}
      <ClubProfile clubCode={club.code} />

      {/* A real link, not only the back control above it. The breadcrumb says
          this page sits under the club's, and a crawler that is told so should
          find a way there — the back control is a `<button>` and leads nowhere
          it can follow. */}
      <p className="mt-6 text-body-medium">
        <a
          href={href}
          onClick={(event) => {
            // Let modified clicks open a new tab, as any link should.
            if (
              event.metaKey || event.ctrlKey || event.shiftKey ||
              event.altKey || event.button !== 0
            ) {
              return;
            }
            event.preventDefault();
            onSelectClub?.(clubKey(club));
          }}
          className={LINK_UNDERLINE}
        >
          Página do {club.shortName}
        </a>
      </p>
    </>
  );
}

/** One row of the Destaques list: the term, then the figure and its round. */
function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-ink-muted">{term}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}
