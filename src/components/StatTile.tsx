import { Surface } from "@/src/components/Surface";

/**
 * One figure in a row of figures: a label over a value.
 *
 * Its own file because three pages open with that row — the club page, the
 * **Painel** and the stadium page. It began exported from `ClubView`, which had
 * the Painel importing a component out of another page, and the stadium page
 * carried a third copy as a local `stat`. Two copies of a tile is how one of
 * them comes to be a step off the other in padding or in ink.
 */
export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Surface filled className="px-3 py-2">
      <p className="text-body-small text-ink-faint">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </Surface>
  );
}
