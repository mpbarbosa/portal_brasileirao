import { hasProjection, oddsLabel, projectionBoard, type ProjectionField, type ProjectionPayload } from "@/projection-core";
import { countLabel, countNoun } from "@/count-core";
import { ZONES } from "@/standings-core";
import { Leaderboard } from "@/src/components/LeagueStats";
import type { StandingsRow } from "@/src/types";

/**
 * **Projeção** — each club's odds of the title, the G4 and the Z4, simulated
 * from the fixtures still to be played. Beneath the table it projects, and not a
 * column inside it: three more percentages on twenty rows would put mostly
 * zeros beside every club, where each board here names only the clubs the
 * question is still open for.
 *
 * **The framing is simulado, and the caption is what carries it.** `CONTEXT.md`
 * makes that the condition of the feature existing at all: the model reads its
 * strengths out of the same table, weighs every rodada alike, and is not a
 * forecast. The caption says so in as many words and names what it counted,
 * so a percentage never appears without the sentence that qualifies it.
 */
const BOARDS: readonly { field: ProjectionField; title: string }[] = [
  { field: "title", title: "Título" },
  ...(["g4", "z4"] as const).map((id) => {
    const zone = ZONES.find((z) => z.id === id);
    return { field: id, title: zone ? `${zone.term} · ${zone.competition}` : id.toUpperCase() };
  }),
];

export function SeasonProjection({
  projection,
  rows,
  onSelectClub,
}: {
  projection: ProjectionPayload | null;
  rows: StandingsRow[];
  onSelectClub?: (key: string) => void;
}) {
  // Nothing played means the model has read only its prior, and nothing left
  // means the table already answers every question — absent, not empty.
  if (!projection || !hasProjection(projection) || rows.length === 0) return null;

  const byCode = new Map(rows.map((row) => [row.club.code, row]));

  return (
    <section className="mt-6" data-projection>
      <h3 className="mb-2 text-body-medium font-medium text-ink-muted">Projeção</h3>

      <div className="grid gap-2 sm:grid-cols-3">
        {BOARDS.map(({ field, title }) => {
          const board = projectionBoard(projection.clubs, field).flatMap((club) => {
            const row = byCode.get(club.code);
            return row ? [{ row, value: club[field] }] : [];
          });
          if (board.length === 0) return null;
          const odds = new Map(board.map(({ row, value }) => [row.club.code, value]));
          return (
            <div key={field} data-board={field}>
              <Leaderboard
                title={title}
                rows={board.map(({ row }) => row)}
                value={(row) => oddsLabel(odds.get(row.club.code) ?? 0)}
                onSelectClub={onSelectClub}
              />
            </div>
          );
        })}
      </div>

      <p data-projection-caption className="mt-2 text-body-small text-ink-faint">
        Simulado: {countLabel(projection.iterations)} temporadas sorteadas a partir{" "}
        {countNoun(projection.remaining, "do", "dos")} {countLabel(projection.remaining)}{" "}
        {countNoun(projection.remaining, "jogo que falta", "jogos que faltam")}, com a força de cada
        clube lida na própria tabela — todas as rodadas pesam igual. Só aparecem clubes com pelo menos 1%
        de chance.
      </p>
    </section>
  );
}
