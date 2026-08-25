import { useEffect, useRef, useState } from "react";

import { ageOn, mergePlayer, positionLabel } from "@/player-core";
import { Button } from "@/src/components/Button";
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
      <dt className="text-body-small text-ink-faint">{label}</dt>
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
  const dialogRef = useRef<HTMLDialogElement>(null);

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

  /**
   * Open as a *modal* dialog rather than rendering a fixed overlay.
   *
   * `showModal` is what buys the behaviour this card was missing. Before M4 it
   * looked modal and was not: Tab walked straight out of it into the page
   * behind, which is still there and still focusable. The browser's own modality
   * gives four things at once — a focus trap, `inert` on everything behind, the
   * top layer (so no ancestor's `overflow` can clip it), and focus returned to
   * whatever opened it when it closes. Each is fiddly to hand-roll and easy to
   * get subtly wrong.
   *
   * Escape arrives as `cancel`, not `keydown`, so it is handled below rather
   * than through a document listener.
   */
  useEffect(() => {
    const node = dialogRef.current;
    if (!node || node.open) return;
    node.showModal();
    // The dismiss, not the card: opening on the first *control* means Escape
    // and Enter both do something sensible without a further keystroke.
    closeRef.current?.focus();
  }, []);

  // A modal dialog makes the page inert but does not stop it scrolling behind.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const age = ageOn(enriched.dateOfBirth, new Date());
  const position = positionLabel(enriched.position);
  const club = enriched.club ?? scorer?.club;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="jogador-nome"
      // Escape reaches a modal dialog as `cancel`. Prevented so the close runs
      // through React rather than the browser tearing the element out from
      // under it, which would leave the parent still thinking it is open.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click on the backdrop lands on the dialog element itself, because the
      // backdrop is its pseudo-element. Anything inside the card has the inner
      // wrapper as its target. Using mousedown, not click, so a drag that starts
      // on the card and ends outside does not dismiss.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      // MD3 puts a dialog at its largest corner. The card is rebuilt here, so it
      // takes the shape MD3 gives it; controls elsewhere kept their own.
      // `mt-auto` bottoms it on a phone and `sm:m-auto` centres it above that,
      // reproducing the sheet-then-card behaviour the fixed overlay had.
      // `mt-auto mb-4` bottoms it on a phone with the inset the fixed overlay's
      // `p-4` used to give — flush to the edge would hide the bottom corners the
      // shape scale just widened. `sm:my-auto` centres it vertically above that.
      //
      // `mx-auto` is not redundant with the user agent's `dialog { margin: auto }`:
      // Tailwind's preflight resets `margin: 0` on every element, so relying on
      // the UA rule left the dialog hard against the left edge on desktop while
      // vertical centring worked, because only the vertical margins were set here.
      className="mx-auto mt-auto mb-4 w-full max-w-md rounded-x-large border border-line-strong bg-surface-container-low p-5 text-ink shadow-xl backdrop:bg-scrim/70 backdrop:backdrop-blur-sm sm:my-auto"
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="jogador-nome" className="truncate text-title-large font-bold">
              {enriched.shirtNumber !== undefined && (
                <span className="mr-2 text-ink-faint tabular-nums">
                  {enriched.shirtNumber}
                </span>
              )}
              {enriched.name}
            </h2>
            {club && <p className="truncate text-body-medium text-ink-muted">{club.shortName}</p>}
          </div>

          <Button ref={closeRef} size="sm" onClick={onClose} aria-label="Fechar" className="shrink-0">
            <span aria-hidden="true">✕</span>
          </Button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-body-medium sm:grid-cols-3">
          {detail("Posição", position)}
          {detail("Nacionalidade", enriched.nationality ?? null)}
          {detail("Idade", age === null ? null : `${age} anos`)}
        </dl>

        {scorer && (
          <section className="mt-5 border-t border-line pt-4">
            <h3 className="mb-2 text-label-medium uppercase text-ink-faint">
              No campeonato
            </h3>
            <dl className="grid grid-cols-4 gap-3 text-body-medium">
              <div>
                <dt className="text-body-small text-ink-faint">Gols</dt>
                <dd className="font-semibold tabular-nums">{scorer.goals}</dd>
              </div>
              <div>
                <dt className="text-body-small text-ink-faint">Assist.</dt>
                <dd className="tabular-nums">{countOrDash(scorer.assists)}</dd>
              </div>
              <div>
                <dt className="text-body-small text-ink-faint">Pênaltis</dt>
                <dd className="tabular-nums">{countOrDash(scorer.penalties)}</dd>
              </div>
              <div>
                <dt className="text-body-small text-ink-faint">Jogos</dt>
                <dd className="tabular-nums">{countOrDash(scorer.playedMatches)}</dd>
              </div>
            </dl>
          </section>
        )}
      </div>
    </dialog>
  );
}
