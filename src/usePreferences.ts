import { useCallback, useEffect, useState } from "react";

import {
  NO_PREFERENCES,
  parsePreferences,
  planSync,
  PREFERENCES_STORAGE_KEY,
  serialisePreferences,
  toggleFollow,
  type Preferences,
} from "@/preferences-core";
import type { ClubCode } from "@/src/types";

const write = (preferences: Preferences): void => {
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, serialisePreferences(preferences));
  } catch {
    /* the choice still holds for this session */
  }
};

/** Send the whole set. Failures are swallowed: the device copy is authoritative
 *  for this session either way, and an error banner over a working page is a
 *  message about the network dressed as a message about the app. */
const upload = (preferences: Preferences): void => {
  void fetch("/api/account/preferences", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: serialisePreferences(preferences),
  }).catch(() => undefined);
};

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
export function usePreferences(account: {
  /** Null while signed out, or while the answer is still in flight. */
  id: string | null;
  /** What the account holds, once known. */
  preferences: Preferences | null;
}): {
  preferences: Preferences;
  toggleClub: (code: ClubCode) => void;
} {
  const [preferences, setPreferences] = useState<Preferences>(read);

  /**
   * Reconcile once, when an account becomes known.
   *
   * Keyed on the account id rather than on the preference object, so this runs
   * on sign-in and on a change of account and **not** every time the reader
   * picks a club — otherwise the branch below would fight `toggleClub` for
   * ownership of the same state.
   *
   * The device copy is written and uploaded from the plan rather than from
   * either input directly, so the two sides end a sign-in agreeing.
   */
  useEffect(() => {
    if (!account.id || !account.preferences) return;

    setPreferences((device) => {
      const plan = planSync(device, account.preferences!);
      if (plan.device.club !== device.club) write(plan.device);
      if (plan.upload) upload(plan.upload);
      return plan.device;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id]);

  const toggleClub = useCallback(
    (code: ClubCode) => {
      setPreferences((current) => {
        const next = toggleFollow(current, code);
        write(next);
        // The device is always written; the account only when there is one.
        // A guest choosing a club must not be a request to an endpoint that
        // would answer 401.
        if (account.id) upload(next);
        return next;
      });
    },
    [account.id],
  );

  return { preferences, toggleClub };
}
