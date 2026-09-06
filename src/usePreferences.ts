import { useCallback, useEffect, useState } from "react";

import {
  forgetAccountPreferences,
  NO_PREFERENCES,
  parsePreferences,
  planSync,
  PREFERENCES_STORAGE_KEY,
  serialiseDevicePreferences,
  serialisePreferences,
  setLanding,
  toggleFollow,
  type LandingId,
  type Preferences,
} from "@/preferences-core";
import type { ClubCode } from "@/src/types";

/**
 * Write the **device** copy, which is the club and nothing else.
 *
 * `serialiseDevicePreferences`, never `serialisePreferences`: the landing
 * choice belongs to the account, and a device that kept its own copy would go
 * on honouring it after the reader changed it somewhere else. The rule is
 * argued in `preferences-core`; this is the only place it could be broken.
 */
const write = (preferences: Preferences): void => {
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, serialiseDevicePreferences(preferences));
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

/**
 * Drop the device's whole copy, key and all.
 *
 * Only `onDelete` calls this, and the asymmetry with sign-out is the point:
 * `forgetAccountPreferences` keeps the club because signing out had nothing to
 * do with it, while deleting the account is an erasure and the club is the one
 * thing this app planted on the reader's machine.
 */
const erase = (): void => {
  try {
    localStorage.removeItem(PREFERENCES_STORAGE_KEY);
  } catch {
    /* the state below is cleared either way, so this session forgets it */
  }
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
 *
 * **Two keys, two lifetimes.** `club` survives a sign-out because it is this
 * device's; `landing` does not exist without an account, so it arrives with one
 * and leaves with it.
 */
export function usePreferences(account: {
  /** Null while signed out, or while the answer is still in flight. */
  id: string | null;
  /** What the account holds, once known. */
  preferences: Preferences | null;
}): {
  preferences: Preferences;
  /**
   * The account id `preferences` has been reconciled against, or `null` for
   * "none, or not yet".
   *
   * Published rather than kept private because **a caller cannot infer it**,
   * and one that guesses gets it wrong in a way nothing reports. Effects run in
   * declaration order within one commit: when the account arrives, this hook's
   * effect and any effect declared after it in the same component run against
   * the *same* render — so `preferences` still holds the pre-account values
   * while `accountState` already says "signed-in". `App`'s landing redirect ran
   * exactly once, on that render, decided there was nothing to do, and latched.
   * The page never moved and no test but an end-to-end one could see it.
   *
   * So the answer is a value that changes in the same update as the
   * preferences it describes, rather than a second party's guess about when
   * this one has caught up.
   */
  syncedAccountId: string | null;
  toggleClub: (code: ClubCode) => void;
  /** Choose where the app opens. A no-op signed out — see below. */
  chooseLanding: (landing: LandingId | null) => void;
  /**
   * Forget everything this device holds. For account **deletion** and nothing
   * else.
   *
   * It has to be pushed in rather than observed, because the effect below sees
   * only `account.id` going null — which a sign-out does too, and a sign-out
   * must keep the club. Deleting is the one case where it must not.
   *
   * The `localStorage` key alone would not be enough: the reconcile effect
   * seeds from **state**, so a device copy cleared on disk but left in memory
   * is uploaded to the next account exactly as before.
   */
  forgetEverything: () => void;
} {
  const [preferences, setPreferences] = useState<Preferences>(read);
  const [syncedAccountId, setSyncedAccountId] = useState<string | null>(null);

  /**
   * Reconcile once, when an account becomes known — and forget the account's
   * half when one stops being.
   *
   * Keyed on the account id rather than on the preference object, so this runs
   * on sign-in, on a change of account and on sign-out, and **not** every time
   * the reader picks a club — otherwise the branches below would fight
   * `toggleClub` for ownership of the same state.
   *
   * The device copy is written and uploaded from the plan rather than from
   * either input directly, so the two sides end a sign-in agreeing.
   */
  useEffect(() => {
    if (!account.id) {
      // Signed out, or still asking. Both mean there is no account behind the
      // landing choice, and a page that went on opening somewhere a signed-out
      // reader cannot change is worse than one that simply stops. The club
      // stays: it is the device's, and Phase 0 predates every account here.
      setPreferences((current) => (current.landing ? forgetAccountPreferences(current) : current));
      setSyncedAccountId(null);
      return;
    }
    if (!account.preferences) return;

    setPreferences((device) => {
      const plan = planSync(device, account.preferences!);
      if (plan.device.club !== device.club) write(plan.device);
      if (plan.upload) upload(plan.upload);
      return plan.device;
    });
    // Set in the same update as the preferences above, which is the whole
    // point of it — see the field's own note.
    setSyncedAccountId(account.id);
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

  const chooseLanding = useCallback(
    (landing: LandingId | null) => {
      // A guard rather than an assumption. The control is only rendered on
      // `/conta` for a signed-in reader, so this cannot be reached today — but
      // the failure if it ever were is the nastiest kind: the state would
      // change, the page would obey it for one session, nothing would be
      // stored anywhere, and the setting would silently forget itself on the
      // next load with no error to explain why.
      if (!account.id) return;

      setPreferences((current) => {
        const next = setLanding(current, landing);
        // No device write: this key is the account's. `write` would drop it
        // anyway, and calling it here would read as though it did not.
        upload(next);
        return next;
      });
    },
    [account.id],
  );

  const forgetEverything = useCallback(() => {
    erase();
    setPreferences(NO_PREFERENCES);
  }, []);

  return { preferences, syncedAccountId, toggleClub, chooseLanding, forgetEverything };
}
