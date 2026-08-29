import { plotKindToggleLabel, type CampaignPlotKind } from "@/campaign-plot-core";
import { Button } from "@/src/components/Button";
import { BarsPlotIcon, LinePlotIcon } from "@/src/components/SectionIcons";

/**
 * The control that chooses which mark a **Campanha** is drawn as.
 *
 * Its own component because it has three call sites — the Classificação, the
 * Clube page and the Partida page — which is the same threshold `WikipediaLink`
 * moved out of `ClubView` at. A second copy of a control is how one of them
 * comes to be labelled differently or to lose its icon.
 *
 * **One button, not a pair**, and its label names the mark you would get rather
 * than the one you have. That is `themeToggleLabel`'s contract: a one-button
 * toggle is read as "press this to get that", and the page itself is what shows
 * the current state. The glyph names the destination for the same reason the
 * app bar's sun and moon do.
 *
 * **It carries no margin and no alignment.** The three call sites place it
 * differently — right-aligned above the table, beside a section heading on the
 * two pages — and layout belonging to a control is layout that has to be
 * cancelled at two of the three, which is the rule `Surface` already follows.
 */
export function CampaignPlotToggle({
  kind,
  onToggle,
}: {
  kind: CampaignPlotKind;
  onToggle: () => void;
}) {
  const label = plotKindToggleLabel(kind);
  const Icon = kind === "line" ? BarsPlotIcon : LinePlotIcon;

  return (
    <Button size="sm" onClick={onToggle} className="inline-flex items-center gap-2">
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );
}
