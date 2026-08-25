import {
  clubMatches,
  findClub,
  nextFixture,
  instagramUrl,
  recentForm,
  resultFor,
  scorersFor,
  standingFor,
  type FormResult,
} from "@/club-core";
import { lastRecordedRound } from "@/rank-history-core";
import { ClubCrest } from "@/src/components/ClubCrest";
import { MatchList } from "@/src/components/MatchList";
import { RankSparkline } from "@/src/components/RankSparkline";
import { Surface } from "@/src/components/Surface";
import type { Club, ClubRankHistory, Match, Scorer, StandingsRow } from "@/src/types";

interface ClubViewProps {
  /** Slug or code, straight from the URL. */
  clubKey: string;
  /** Whether the first load is still in flight. Without it an empty payload and
   *  an unknown club are indistinguishable, and the page picks the wrong one. */
  loading?: boolean;
  standings: StandingsRow[];
  matches: Match[];
  clubs?: Club[];
  scorers: Scorer[];
  onBack: () => void;
  /** Omit to render fixtures as plain text — the page stands on its own. */
  onSelectMatch?: (id: string) => void;
  /** Every club's campanha. Omit and the section is left out entirely. */
  rankHistory?: ClubRankHistory[];
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
  loading = false,
  standings,
  matches,
  clubs,
  scorers,
  onBack,
  onSelectMatch,
  rankHistory,
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
        <p className="mt-4 text-sm text-ink-muted" role={loading ? "status" : undefined}>
          {loading ? "Carregando página…" : "Clube não encontrado."}
        </p>
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
  const instagram = instagramUrl(club.instagram);

  // Same domains as the Classificação, so the shape a reader recognises in the
  // table is the shape they find here — only the box is bigger. `clubCount`
  // comes from the table rather than from the history, because the y axis is
  // the size of the division, not the number of clubs that happen to have a
  // campanha recorded.
  const campaign = rankHistory?.find((entry) => entry.clubCode === code)?.entries ?? [];
  const lastRound = lastRecordedRound(rankHistory ?? []);
  const clubCount = standings.length || rankHistory?.length || 0;

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
          {/* Both links read as the thing itself — a bare host, a bare handle —
              rather than a full URL, which is what a reader recognises and what
              keeps the pair on one line. */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
            {club.website && (
              <a
                href={club.website}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate underline decoration-ink-ghost underline-offset-2 hover:decoration-ink-soft"
              >
                {club.website.replace(/^https:\/\//, "").replace(/\/$/, "")}
                <span className="sr-only"> — site oficial (abre em nova aba)</span>
              </a>
            )}
            {instagram && (
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate underline decoration-ink-ghost underline-offset-2 hover:decoration-ink-soft"
              >
                @{club.instagram}
                <span className="sr-only"> — Instagram oficial (abre em nova aba)</span>
              </a>
            )}
          </div>
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

      {campaign.length > 0 && lastRound > 0 && (
        <section className="mt-6">
          {/* Sits directly under the Posição tile, which it explains: the tile
              says where the club is, this says how it got there. */}
          <h3 className="mb-2 text-sm font-medium text-ink-muted">Campanha</h3>
          <Surface filled className="px-3 py-3">
            <RankSparkline
              entries={campaign}
              clubCount={clubCount}
              lastRound={lastRound}
              size="page"
            />
            {/* The drawing carries no axis, so the ends are named in text —
                which is also the only version a screen reader gets. */}
            <p className="mt-2 flex justify-between text-xs tabular-nums text-ink-faint">
              <span>{campaign[0].position}º · 1ª rodada</span>
              <span>
                {campaign[campaign.length - 1].position}º · {lastRound}ª rodada
              </span>
            </p>
          </Surface>
        </section>
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
