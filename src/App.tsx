import { useEffect, useState } from "react";

import { fetchMatches, fetchScorers, fetchStandings, type MatchesPayload } from "@/src/api";
import { ClubView } from "@/src/components/ClubView";
import { NavBar } from "@/src/components/NavBar";
import { RoundBrowser } from "@/src/components/RoundBrowser";
import { ScorersTable } from "@/src/components/ScorersTable";
import { StandingsTable } from "@/src/components/StandingsTable";
import { DEFAULT_SECTION, type SectionId } from "@/src/navigation";
import type { ClubCode, Scorer, StandingsRow } from "@/src/types";

export function App() {
  const [section, setSection] = useState<SectionId>(DEFAULT_SECTION);
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [matches, setMatches] = useState<MatchesPayload | null>(null);
  const [scorers, setScorers] = useState<Scorer[]>([]);
  /** Null until the payload lands; then it follows the round the reader picks. */
  const [round, setRound] = useState<number | null>(null);
  const [clubCode, setClubCode] = useState<ClubCode | null>(null);
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
        setRound(matchesResponse.data.currentRound);
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
      <NavBar current={section} onSelect={setSection} />

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
          {section === "classificacao" && (
            <StandingsTable
              rows={standings}
              onSelectClub={(code) => {
                setClubCode(code);
                setSection("clube");
              }}
            />
          )}

          {section === "jogos" && (
            <RoundBrowser
              rounds={matches?.rounds ?? []}
              round={round}
              matches={matches?.matches ?? []}
              clubs={matches?.clubs}
              onSelectRound={setRound}
            />
          )}

          {section === "clube" && clubCode && (
            <ClubView
              code={clubCode}
              standings={standings}
              matches={matches?.matches ?? []}
              clubs={matches?.clubs}
              scorers={scorers}
              onBack={() => setSection("classificacao")}
            />
          )}

          {section === "artilharia" && (
            <>
              <h2 className="mb-3 text-sm font-medium text-slate-400">Artilharia</h2>
              <ScorersTable rows={scorers} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
