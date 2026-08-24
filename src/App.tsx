import { useEffect, useState } from "react";

import { fetchMatches, fetchScorers, fetchStandings, type MatchesPayload } from "@/src/api";
import { ClubView } from "@/src/components/ClubView";
import { MatchPage } from "@/src/components/MatchPage";
import { NavBar } from "@/src/components/NavBar";
import { PlayerOverlayCard } from "@/src/components/PlayerOverlayCard";
import { RoundBrowser } from "@/src/components/RoundBrowser";
import { ScorersTable } from "@/src/components/ScorersTable";
import { StandingsTable } from "@/src/components/StandingsTable";
import { findMatch } from "@/match-core";
import { parseRoute } from "@/route-core";
import { useRoute } from "@/src/useRoute";
import type { Scorer, StandingsRow } from "@/src/types";

export function App() {
  const { route, navigate } = useRoute();
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
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <NavBar current={route.section} onNavigate={navigate} />

      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="sr-only">Portal Brasileirão — Campeonato Brasileiro Série A</h1>

        {note && (
          <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {note}
          </p>
        )}

        {error && (
          <p className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        <main>
          {route.section === "classificacao" && (
            <StandingsTable
              rows={standings}
              onSelectClub={(key) => navigate({ section: "clube", key })}
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
              standings={standings}
              matches={matches?.matches ?? []}
              clubs={matches?.clubs}
              scorers={scorers}
              onBack={() => navigate({ section: "classificacao" })}
            />
          )}

          {route.section === "partida" && (
            <MatchPage
              match={findMatch(matches?.matches ?? [], route.id)}
              clubs={matches?.clubs ?? []}
              onBack={() => navigate({ section: "jogos", round: null })}
              onNavigate={(path) => navigate(parseRoute(path))}
            />
          )}

          {route.section === "artilharia" && (
            <>
              <h2 className="mb-3 text-sm font-medium text-slate-400">Artilharia</h2>
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
