import type { StandingsSide } from "@/standings-core";
import { FOCUS_RING, STATE_LAYER } from "@/src/components/interaction";

/**
 * The Completa / Casa / Fora control above the Classificação.
 *
 * **A segmented button, which is MD3's own component for exactly this** — one
 * choice among a few, all visible, all of equal weight. It is the first in this
 * app, so the chrome is written here rather than folded into `Button`: that
 * component's two variants are a *single* control's shape, and a segment needs
 * a shared outline, collapsed inner borders and end caps that only make sense
 * as a group. Three `Button`s in a row would be three controls that happen to
 * be adjacent, which is what the pattern exists to stop looking like.
 *
 * **`radiogroup`, not three buttons.** The choices are mutually exclusive and
 * exactly one is always on, which is a radio group's contract and not a
 * button's; it also gives arrow-key selection for nothing. `aria-checked` says
 * which, so the state reaches a screen reader as state rather than as styling.
 *
 * The shape scale gives the caps: `rounded-full` is MD3's segmented-button
 * container, the same pill `Button`'s `tonal` variant takes, and the inner
 * edges are square so the three read as one control.
 */
const SIDES: { side: StandingsSide; label: string; hint: string }[] = [
  { side: "all", label: "Completa", hint: "Todos os jogos" },
  { side: "home", label: "Casa", hint: "Só os jogos como mandante" },
  { side: "away", label: "Fora", hint: "Só os jogos como visitante" },
];

export function StandingsSideControl({
  side,
  onSelect,
}: {
  side: StandingsSide;
  onSelect: (side: StandingsSide) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Recortar a classificação"
      data-side-control
      className="inline-flex overflow-hidden rounded-full border border-outline"
    >
      {SIDES.map(({ side: value, label, hint }, index) => {
        const selected = value === side;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={hint}
            data-side={value}
            onClick={() => onSelect(value)}
            className={[
              "relative px-3 py-1.5 text-label-large font-medium transition",
              index > 0 ? "border-l border-outline" : "",
              // The selected segment is MD3's `secondary-container`, the same
              // pairing the account avatar uses and one the contrast gate
              // already measures as live.
              selected
                ? "bg-secondary-container text-on-secondary-container"
                : "text-on-surface-variant",
              STATE_LAYER,
              FOCUS_RING,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
