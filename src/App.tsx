import { useEffect, useState } from "react";

import { fetchMatches, fetchStandings, type MatchesPayload } from "@/src/api";
import { MatchList } from "@/src/components/MatchList";
import { StandingsTable } from "@/src/components/StandingsTable";
import { matchesForRound } from "@/matches-core";
import type { StandingsRow } from "@/src/types";

type Tab = "classificacao" | "rodada";

const TABS: { id: Tab; label: string }[] = [
  { id: "classificacao", label: "Classificação" },
  { id: "rodada", label: "Rodada" },
];

export function App() {
  const [tab, setTab] = useState<Tab>("classificacao");
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [matches, setMatches] = useState<MatchesPayload | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [standingsResponse, matchesResponse] = await Promise.all([
          fetchStandings(),
          fetchMatches(),
        ]);
        if (cancelled) return;

        setStandings(standingsResponse.data);
        setMatches(matchesResponse.data);
        setNote(standingsResponse.source === "placeholder" ? standingsResponse.note : null);
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

  const round = matches?.currentRound ?? null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Portal Brasileirão</h1>
        <p className="mt-1 text-sm text-slate-400">Campeonato Brasileiro Série A</p>
      </header>

      {note && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {note}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      <nav className="mt-6 flex gap-2" aria-label="Seções">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            aria-current={tab === entry.id ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === entry.id
                ? "bg-slate-100 text-slate-900"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      <main className="mt-4">
        {tab === "classificacao" ? (
          <StandingsTable rows={standings} />
        ) : (
          <>
            <h2 className="mb-3 text-sm font-medium text-slate-400">
              {round === null ? "Rodada" : `${round}ª rodada`}
            </h2>
            <MatchList
              matches={
                matches && round !== null ? matchesForRound(matches.matches, round) : []
              }
            />
          </>
        )}
      </main>
    </div>
  );
}
