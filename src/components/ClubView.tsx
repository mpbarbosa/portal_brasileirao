import {
  clubMatches,
  findClub,
  nextFixture,
  recentForm,
  resultFor,
  scorersFor,
  standingFor,
  type FormResult,
} from "@/club-core";
import { MatchList } from "@/src/components/MatchList";
import type { Club, Match, Scorer, StandingsRow } from "@/src/types";

interface ClubViewProps {
  /** Slug or code, straight from the URL. */
  clubKey: string;
  standings: StandingsRow[];
  matches: Match[];
  clubs?: Club[];
  scorers: Scorer[];
  onBack: () => void;
}

const FORM_CLASS: Record<FormResult, string> = {
  V: "bg-emerald-500/20 text-emerald-300",
  E: "bg-slate-700 text-slate-300",
  D: "bg-rose-500/20 text-rose-300",
};

const FORM_TITLE: Record<FormResult, string> = {
  V: "Vitória",
  E: "Empate",
  D: "Derrota",
};

const stat = (label: string, value: string) => (
  <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
    <p className="text-xs text-slate-500">{label}</p>
    <p className="font-semibold tabular-nums">{value}</p>
  </div>
);

export function ClubView({
  clubKey: key,
  standings,
  matches,
  clubs,
  scorers,
  onBack,
}: ClubViewProps) {
  // The URL may name the club by slug or by code, and the club itself may only
  // appear in one of the two lists, so search both before giving up.
  const club =
    findClub(standings.map((entry) => entry.club), key) ?? findClub(clubs ?? [], key);

  if (!club) {
    return (
      <>
        <button type="button" onClick={onBack} className="text-sm text-slate-400 hover:text-slate-200">
          ← Voltar
        </button>
        <p className="mt-4 text-sm text-slate-400">Clube não encontrado.</p>
      </>
    );
  }

  const code = club.code;
  const row = standingFor(standings, code);
  const fixtures = clubMatches(matches, code);
  const form = recentForm(matches, code);
  const next = nextFixture(matches, code);
  // Most recent first: on a club page the latest result is the headline, which
  // is the opposite of the round view's chronological order.
  const played = fixtures.filter((match) => resultFor(match, code) !== null).reverse();
  const clubScorers = scorersFor(scorers, code);

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-slate-400 hover:text-slate-200"
      >
        ← Voltar
      </button>

      <header className="mt-3">
        <h2 className="text-xl font-bold tracking-tight">{club.shortName}</h2>
        <p className="text-sm text-slate-400">
          {club.name}
          {club.state ? ` · ${club.state}` : ""}
        </p>
      </header>

      {row && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stat("Posição", `${row.position}º`)}
          {stat("Pontos", String(row.points))}
          {stat("Jogos", String(row.played))}
          {stat("Saldo", row.goalDifference > 0 ? `+${row.goalDifference}` : String(row.goalDifference))}
        </div>
      )}

      <section className="mt-6">
        <h3 className="mb-2 text-sm font-medium text-slate-400">Últimos resultados</h3>
        {form.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum jogo disputado ainda.</p>
        ) : (
          <ul className="flex gap-1.5">
            {form.map((result, index) => (
              <li
                key={index}
                title={FORM_TITLE[result]}
                className={`flex h-7 w-7 items-center justify-center rounded text-xs font-bold ${FORM_CLASS[result]}`}
              >
                {result}
              </li>
            ))}
          </ul>
        )}
      </section>

      {next && (
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-slate-400">Próximo jogo</h3>
          <MatchList matches={[next]} clubs={clubs} />
        </section>
      )}

      {clubScorers.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-slate-400">
            Artilheiros do clube
          </h3>
          <ul className="space-y-1">
            {clubScorers.map((scorer) => (
              <li
                key={scorer.playerId}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm"
              >
                <span>{scorer.playerName}</span>
                <span className="tabular-nums text-slate-400">
                  {scorer.goals} {scorer.goals === 1 ? "gol" : "gols"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h3 className="mb-2 text-sm font-medium text-slate-400">Jogos disputados</h3>
        <MatchList matches={played} clubs={clubs} />
      </section>
    </>
  );
}
