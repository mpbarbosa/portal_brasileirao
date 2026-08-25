import { useEffect, useMemo, useState } from "react";

import { fetchMatches, fetchScorers, fetchStandings, type MatchesPayload } from "@/src/api";
import { ClubView } from "@/src/components/ClubView";
import { MatchPage } from "@/src/components/MatchPage";
import { NavBar } from "@/src/components/NavBar";
import { PlayerOverlayCard } from "@/src/components/PlayerOverlayCard";
import { RoundBrowser } from "@/src/components/RoundBrowser";
import { ScorersTable } from "@/src/components/ScorersTable";
import { StandingsTable } from "@/src/components/StandingsTable";
import { findMatch } from "@/match-core";
import { computeRankHistory } from "@/rank-history-core";
import { parseRoute } from "@/route-core";
import { usePageMeta } from "@/src/usePageMeta";
import { useTheme } from "@/src/useTheme";
import { useRoute } from "@/src/useRoute";
import type { Scorer, StandingsRow } from "@/src/types";

export function App() {
  const { route, navigate } = useRoute();
  const { theme, toggle: toggleTheme } = useTheme();
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [matches, setMatches] = useState<MatchesPayload | null>(null);
  const [scorers, setScorers] = useState<Scorer[]>([]);
  /** The round the URL asks for; null means "whatever is current". */
  const [currentRound, setCurrentRound] = useState<number | null>(null);
  /** The scorer whose card is open. Not a route: a card is a transient overlay,
   *  and a URL for it would survive a reload that the overlay should not. */
  const [openScorer, setOpenScorer] = useState<Scorer | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** True until the first load settles. A page that names something — a club, a
   *  match — cannot tell "no such thing" from "not fetched yet" on its own,
   *  since both look like an empty list, and answering "não encontrado" while
   *  the request is still in flight tells the reader something untrue. */
  const [loading, setLoading] = useState(true);

  /**
   * The campanha behind every row of the Classificação, computed here rather
   * than fetched: `/api/matches` already ships the whole season, so the client
   * holds everything the calculation needs and a second endpoint would buy
   * nothing. Recomputed only when the fixtures change.
   *
   * Note this is derived from the fixture list, while the table's own positions
   * come from `/api/standings`. With a live provider the two can disagree by a
   * place mid-round, because football-data counts IN_PLAY matches in its table
   * and `computeStandings` does not — the documented, deliberate difference.
   * The sparkline is a trajectory, not a restatement of the position column.
   */
  const rankHistory = useMemo(
    () => (matches ? computeRankHistory(matches.clubs, matches.matches) : []),
    [matches],
  );

  usePageMeta(route, {
    clubs: matches?.clubs,
    matches: matches?.matches,
    standings,
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [standingsResponse, matchesResponse, scorersResponse] = await Promise.all([
          fetchStandings(),
          fetchMatches(),
          fetchScorers(),
        ]);
        if (cancelled) return;

        setStandings(standingsResponse.data);
        setMatches(matchesResponse.data);
        setScorers(scorersResponse.data);
        setCurrentRound(matchesResponse.data.currentRound);
        // Only flag non-live sources; live data needs no disclaimer banner.
        setNote(standingsResponse.source === "football-data" ? null : standingsResponse.note);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Falha ao carregar os dados.");
        }
      } finally {
        // Also on failure: the request has settled, and leaving the page
        // reading "carregando" forever would be its own kind of lie.
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <NavBar
        current={route.section}
        onNavigate={navigate}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="sr-only">Portal Brasileirão — Campeonato Brasileiro Série A</h1>

        {note && (
          <p className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-ink">
            {note}
          </p>
        )}

        {error && (
          <p className="mb-4 rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative-ink">
            {error}
          </p>
        )}

        <main>
          {route.section === "classificacao" && (
            <StandingsTable
              rows={standings}
              onSelectClub={(key) => navigate({ section: "clube", key })}
              rankHistory={rankHistory}
            />
          )}

          {route.section === "jogos" && (
            <RoundBrowser
              rounds={matches?.rounds ?? []}
              // The URL wins when it names a round; otherwise fall back to the
              // current one, so /jogos stays a link that ages well.
              round={route.round ?? currentRound}
              matches={matches?.matches ?? []}
              clubs={matches?.clubs}
              onSelectRound={(value) => navigate({ section: "jogos", round: value })}
              onSelectMatch={(id) => navigate({ section: "partida", id })}
            />
          )}

          {route.section === "clube" && (
            <ClubView
              clubKey={route.key}
              loading={loading}
              standings={standings}
              matches={matches?.matches ?? []}
              clubs={matches?.clubs}
              scorers={scorers}
              rankHistory={rankHistory}
              onBack={() => navigate({ section: "classificacao" })}
              onSelectMatch={(id) => navigate({ section: "partida", id })}
            />
          )}

          {route.section === "partida" && (
            <MatchPage
              match={findMatch(matches?.matches ?? [], route.id)}
              loading={loading}
              clubs={matches?.clubs ?? []}
              onBack={() => navigate({ section: "jogos", round: null })}
              onNavigate={(path) => navigate(parseRoute(path))}
            />
          )}

          {route.section === "artilharia" && (
            <>
              <h2 className="mb-3 text-sm font-medium text-ink-muted">Artilharia</h2>
              <ScorersTable rows={scorers} onSelectPlayer={setOpenScorer} />
            </>
          )}
        </main>
      </div>

      {openScorer && (
        <PlayerOverlayCard
          player={{
            id: openScorer.playerId,
            name: openScorer.playerName,
            club: openScorer.club,
          }}
          scorer={openScorer}
          onClose={() => setOpenScorer(null)}
        />
      )}
    </div>
  );
}
