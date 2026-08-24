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
import { ClubCrest } from "@/src/components/ClubCrest";
import { MatchList } from "@/src/components/MatchList";
import { Surface } from "@/src/components/Surface";
import type { Club, Match, Scorer, StandingsRow } from "@/src/types";

interface ClubViewProps {
  /** Slug or code, straight from the URL. */
  clubKey: string;
  standings: StandingsRow[];
  matches: Match[];
  clubs?: Club[];
  scorers: Scorer[];
  onBack: () => void;
  /** Omit to render fixtures as plain text — the page stands on its own. */
  onSelectMatch?: (id: string) => void;
}

const FORM_CLASS: Record<FormResult, string> = {
  V: "bg-positive/20 text-positive-ink",
  E: "bg-raised-strong text-ink-soft",
  D: "bg-negative/20 text-negative-ink",
};

const FORM_TITLE: Record<FormResult, string> = {
  V: "Vitória",
  E: "Empate",
  D: "Derrota",
};

const stat = (label: string, value: string) => (
  <Surface key={label} filled className="px-3 py-2">
    <p className="text-xs text-ink-faint">{label}</p>
    <p className="font-semibold tabular-nums">{value}</p>
  </Surface>
);

export function ClubView({
  clubKey: key,
  standings,
  matches,
  clubs,
  scorers,
  onBack,
  onSelectMatch,
}: ClubViewProps) {
  // The URL may name the club by slug or by code, and the club itself may only
  // appear in one of the two lists, so search both before giving up.
  const club =
    findClub(standings.map((entry) => entry.club), key) ?? findClub(clubs ?? [], key);

  if (!club) {
    return (
      <>
        <button type="button" onClick={onBack} className="text-sm text-ink-muted hover:text-ink-soft">
          ← Voltar
        </button>
        <p className="mt-4 text-sm text-ink-muted">Clube não encontrado.</p>
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
        className="text-sm text-ink-muted hover:text-ink-soft"
      >
        ← Voltar
      </button>

      <header className="mt-3 flex items-center gap-3">
        <ClubCrest club={club} size={44} />
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold tracking-tight">{club.shortName}</h2>
          <p className="truncate text-sm text-ink-muted">
            {club.name}
            {club.state ? ` · ${club.state}` : ""}
          </p>
        </div>
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
        <h3 className="mb-2 text-sm font-medium text-ink-muted">Últimos resultados</h3>
        {form.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhum jogo disputado ainda.</p>
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
          <h3 className="mb-2 text-sm font-medium text-ink-muted">Próximo jogo</h3>
          <MatchList matches={[next]} clubs={clubs} onSelectMatch={onSelectMatch} />
        </section>
      )}

      {clubScorers.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-ink-muted">
            Artilheiros do clube
          </h3>
          <ul className="space-y-1">
            {clubScorers.map((scorer) => (
              <Surface
                as="li"
                filled
                key={scorer.playerId}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <span>{scorer.playerName}</span>
                <span className="tabular-nums text-ink-muted">
                  {scorer.goals} {scorer.goals === 1 ? "gol" : "gols"}
                </span>
              </Surface>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h3 className="mb-2 text-sm font-medium text-ink-muted">Jogos disputados</h3>
        <MatchList matches={played} clubs={clubs} onSelectMatch={onSelectMatch} />
      </section>
    </>
  );
}
