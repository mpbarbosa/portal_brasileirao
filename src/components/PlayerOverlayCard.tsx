import { useEffect, useRef, useState } from "react";

import { ageOn, mergePlayer, positionLabel } from "@/player-core";
import type { Player, Scorer } from "@/src/types";

interface PlayerOverlayCardProps {
  /** What the caller already knows — the card renders immediately from this. */
  player: Player;
  /** Season figures, when the player was opened from a scoring table. */
  scorer?: Scorer;
  onClose: () => void;
}

const detail = (label: string, value: string | null) =>
  value === null ? null : (
    <div key={label}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );

const countOrDash = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : String(value);

/**
 * Modal card for one player.
 *
 * It renders from data the caller already holds, then fills in shirt number,
 * position, nationality and birth date from `/api/players/:id`. That request is
 * an enrichment, not a dependency: if it fails or the app is offline, the card
 * still shows everything the page already knew.
 */
export function PlayerOverlayCard({ player, scorer, onClose }: PlayerOverlayCardProps) {
  const [enriched, setEnriched] = useState<Player>(player);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setEnriched(player);

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/players/${encodeURIComponent(player.id)}`);
        if (!response.ok) return;
        const body = (await response.json()) as { data: Player | null };
        if (!cancelled) setEnriched((current) => mergePlayer(current, body.data));
      } catch {
        // Enrichment is optional — the card is already useful without it.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [player]);

  // Focus the dismiss control on open, so the keyboard lands inside the dialog
  // rather than behind it.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const age = ageOn(enriched.dateOfBirth, new Date());
  const position = positionLabel(enriched.position);
  const club = enriched.club ?? scorer?.club;

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center"
      // A click on the backdrop dismisses; a click that started inside the card
      // and ended here must not.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="jogador-nome"
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="jogador-nome" className="truncate text-lg font-bold tracking-tight">
              {enriched.shirtNumber !== undefined && (
                <span className="mr-2 text-slate-500 tabular-nums">
                  {enriched.shirtNumber}
                </span>
              )}
              {enriched.name}
            </h2>
            {club && <p className="truncate text-sm text-slate-400">{club.shortName}</p>}
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-lg border border-slate-700 px-2.5 py-1 text-sm text-slate-300 hover:bg-slate-800"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          {detail("Posição", position)}
          {detail("Nacionalidade", enriched.nationality ?? null)}
          {detail("Idade", age === null ? null : `${age} anos`)}
        </dl>

        {scorer && (
          <section className="mt-5 border-t border-slate-800 pt-4">
            <h3 className="mb-2 text-xs uppercase tracking-wide text-slate-500">
              No campeonato
            </h3>
            <dl className="grid grid-cols-4 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Gols</dt>
                <dd className="font-semibold tabular-nums">{scorer.goals}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Assist.</dt>
                <dd className="tabular-nums">{countOrDash(scorer.assists)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Pênaltis</dt>
                <dd className="tabular-nums">{countOrDash(scorer.penalties)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Jogos</dt>
                <dd className="tabular-nums">{countOrDash(scorer.playedMatches)}</dd>
              </div>
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
