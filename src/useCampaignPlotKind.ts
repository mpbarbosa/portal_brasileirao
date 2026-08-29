import { useCallback, useState } from "react";

import {
  CAMPAIGN_PLOT_STORAGE_KEY,
  otherPlotKind,
  parsePlotKind,
  type CampaignPlotKind,
} from "@/campaign-plot-core";

const read = (): CampaignPlotKind => {
  try {
    return parsePlotKind(localStorage.getItem(CAMPAIGN_PLOT_STORAGE_KEY));
  } catch {
    // Storage throws in private mode; the column still draws, on the default.
    return "line";
  }
};

/**
 * Which mark the Campanha column draws, and a way to flip it.
 *
 * Unlike `useTheme` there is **no inline script in `index.html`** stamping this
 * before first paint, and none is wanted: the theme needs one because it decides
 * the colour of the whole page, and repainting it is a flash the reader sees
 * across every pixel. This decides one 72px mark inside a table that has not
 * loaded its rows yet at that point — there is nothing on screen to flash.
 *
 * State is therefore read from storage on mount, which is also why the read is
 * lazy: `useState(read)` runs it once rather than on every render.
 */
export function useCampaignPlotKind(): {
  kind: CampaignPlotKind;
  toggle: () => void;
} {
  const [kind, setKind] = useState<CampaignPlotKind>(read);

  const toggle = useCallback(() => {
    setKind((current) => {
      const next = otherPlotKind(current);
      try {
        localStorage.setItem(CAMPAIGN_PLOT_STORAGE_KEY, next);
      } catch {
        /* the choice still applies for this session */
      }
      return next;
    });
  }, []);

  return { kind, toggle };
}
