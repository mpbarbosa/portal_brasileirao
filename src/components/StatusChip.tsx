import type { Match } from "@/src/types";

/**
 * A match's **Status da partida**, as a chip.
 *
 * Exists because `MatchList` and `MatchPage` each carried their own copy of the
 * label map *and* the colour map — identical, four values apiece, in two files.
 * Two copies of a lookup table is how a new status ends up rendered in one place
 * and blank in the other, and how `LIVE` ends up a different green on the list
 * than on the page it links to.
 *
 * Material Design 3 calls this an assist chip. The shape and the label come from
 * that convention; the *colour* does not, because MD3's chips carry a single
 * container colour and the whole point of this one is that its colour is the
 * information. A live match and a cancelled one must not look alike.
 */
const LABEL: Record<Match["status"], string> = {
  SCHEDULED: "A realizar",
  LIVE: "Ao vivo",
  FINISHED: "Encerrado",
  POSTPONED: "Adiado",
  CANCELLED: "Cancelado",
};

/**
 * Tint plus its readable ink, never a bare status colour as text.
 *
 * The base tokens are for fills and rails; the `-ink` pairs are what clear AA as
 * text. `npm run test:tokens` measures each of these against the surfaces they
 * sit on.
 */
const TONE: Record<Match["status"], string> = {
  SCHEDULED: "bg-surface-container text-on-surface-variant",
  LIVE: "bg-positive/20 text-primary",
  FINISHED: "bg-surface-container text-ink-muted",
  POSTPONED: "bg-warning/20 text-warning-ink",
  CANCELLED: "bg-negative/20 text-error",
};

/** The label alone, for callers that need the text without the chrome. */
export const statusLabel = (status: Match["status"]): string => LABEL[status];

interface StatusChipProps {
  status: Match["status"];
  className?: string;
}

export function StatusChip({ status, className = "" }: StatusChipProps) {
  return (
    <span
      data-status={status}
      className={`inline-flex shrink-0 items-center rounded-x-small px-2 py-1 text-label-medium font-medium ${TONE[status]} ${className}`}
    >
      {LABEL[status]}
    </span>
  );
}
