import { useCallback, useState } from "react";

import {
  STANDINGS_MARK_STORAGE_KEY,
  otherMarkKind,
  parseMarkKind,
  type StandingsMarkKind,
} from "@/standings-mark-core";

/**
 * The reader's choice of what the Classificação's mark column shows, held on
 * the device.
 *
 * `useCampaignPlotKind`'s shape exactly, and deliberately: this is a property
 * of the screen being read rather than of the person reading, so it lives in
 * `localStorage` and never in `preferences-core.ts`. CLAUDE.md's rule is to ask
 * which side owns a key before asking how to reconcile it, and nothing here has
 * a second side that can hold a value.
 */
const read = (): StandingsMarkKind => {
  try {
    return parseMarkKind(localStorage.getItem(STANDINGS_MARK_STORAGE_KEY));
  } catch {
    // Private mode can throw on localStorage, as `useTheme` records.
    return "campanha";
  }
};

export function useStandingsMark(): { kind: StandingsMarkKind; toggle: () => void } {
  const [kind, setKind] = useState<StandingsMarkKind>(read);

  const toggle = useCallback(() => {
    setKind((current) => {
      const next = otherMarkKind(current);
      try {
        localStorage.setItem(STANDINGS_MARK_STORAGE_KEY, next);
      } catch {
        // Unwritable storage is not a reason to refuse the change on screen.
      }
      return next;
    });
  }, []);

  return { kind, toggle };
}
