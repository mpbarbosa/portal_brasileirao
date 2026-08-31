import { useMemo } from "react";

import { clubKey, findClub, standingFor } from "@/club-core";
import { candlesFor, computeRankCandles, summariseCandles } from "@/rank-candles-core";
import { lastRoundWithResult } from "@/rank-history-core";
import { formatRoute } from "@/route-core";
import { ClubCrest } from "@/src/components/ClubCrest";
import { StatTile } from "@/src/components/ClubView";
import { BACK_LINK, LINK_UNDERLINE } from "@/src/components/interaction";
import { RankCandles } from "@/src/components/RankCandles";
import { Surface } from "@/src/components/Surface";
import type { Club, Match, StandingsRow } from "@/src/types";

interface ClubDashboardProps {
  /** Slug or code, straight from the URL — the same key the club page takes. */
  clubKey: string;
  /** Whether the first load is still in flight. Without it an empty payload and
   *  an unknown club are indistinguishable, and the page picks the wrong one. */
  loading?: boolean;
  standings: StandingsRow[];
  matches: Match[];
  clubs?: Club[];
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
  // happen to have a campanha recorded.
  const clubCount = standings.length || division.length;

  const href = formatRoute({ section: "clube", key: clubKey(club) });

  return (
    <>
      <button type="button" onClick={onBack} className={BACK_LINK}>
        ← Voltar
      </button>

      <header className="mt-3 flex items-center gap-3">
        <ClubCrest club={club} size={44} />
        <div className="min-w-0 grow">
          <h2 className="truncate text-title-large font-bold">Painel do {club.shortName}</h2>
          <p className="truncate text-body-medium text-ink-muted">
            A campanha rodada a rodada
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
