import { useCallback, useState } from "react";

import {
  NO_PREFERENCES,
  parsePreferences,
  PREFERENCES_STORAGE_KEY,
  serialisePreferences,
  toggleFollow,
  type Preferences,
} from "@/preferences-core";
import type { ClubCode } from "@/src/types";

const read = (): Preferences => {
  try {
    return parsePreferences(localStorage.getItem(PREFERENCES_STORAGE_KEY));
  } catch {
    // Storage throws outright in private mode in some browsers — the same
    // failure `useTheme` already absorbs. A reader who cannot store a
    // preference still gets a working app for this session.
    return NO_PREFERENCES;
  }
};

/**
 * What this device remembers about the reader, and a way to change it.
 *
 * Unlike `useTheme`, the initial value is read from storage rather than from
 * the DOM: nothing paints differently before hydration on account of a followed
 * club, so there is no inline script to agree with and no flash to prevent.
 *
 * A failed write is deliberately not surfaced. The alternative — telling
 * somebody in private mode that their choice will not be remembered — is a
 * message about the browser dressed as a message about the app, and it would
 * appear at the moment they were doing something that otherwise worked.
 */
export function usePreferences(): {
  preferences: Preferences;
  toggleClub: (code: ClubCode) => void;
} {
  const [preferences, setPreferences] = useState<Preferences>(read);

  const toggleClub = useCallback((code: ClubCode) => {
    setPreferences((current) => {
      const next = toggleFollow(current, code);
      try {
        localStorage.setItem(PREFERENCES_STORAGE_KEY, serialisePreferences(next));
      } catch {
        /* the choice still holds for this session */
      }
      return next;
    });
  }, []);

  return { preferences, toggleClub };
}
