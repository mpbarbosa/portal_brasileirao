/**
 * Pure preference resolution — what the app remembers about a reader **on this
 * device**. No storage, no DOM: values in, values out
 * (tests/preferences-core.test.ts).
 *
 * The precedent is `theme-core.ts`, deliberately: a reader choice that survives
 * a reload, parsed defensively because storage holds whatever was last written
 * there, including by a build that is no longer this one.
 *
 * This is Phase 0 of `docs/accounts.md` — the two thirds of "accounts" that
 * need no account. It costs no database, no session, no LGPD posture and no
 * state that can be lost by anyone but its owner. If cross-device or
 * notifications are ever wanted, `Preferences` is the shape an account syncs
 * (that plan's Phase 2), which is why the merge boundary is a plain object with
 * one key per decision rather than a bag of loose values.
 */

import { clubArticle } from "@/club-core";
import type { Club, ClubCode } from "@/src/types";

export interface Preferences {
  /**
   * **Meu time** — the club this reader follows, or `null` for nobody.
   *
   * Stored as the club's `code`, which is the upstream numeric id, never the
   * `tla` and never the slug: Corinthians and Coritiba both report `COR`, and a
   * slug is a URL concern that changes when a display name is tidied.
   */
  club: ClubCode | null;
}

/**
 * What a device should hold once its reader signs in, and what to send back.
 *
 * `docs/accounts.md` §4 sketches this as "last-write-wins per key, with the
 * local copy winning on a tie". That needs a timestamp per key on both sides,
 * and this is the argument for not paying for one.
 *
 * There is **one key**. Timestamps would resolve exactly one situation: the
 * reader signed out on device A, changed their club there, and then signed in
 * on device B — where the change on A is newer but B's account copy would win.
 * Buying that costs a stamp beside every value, a storage-shape migration for
 * everyone who already has a preference, and a rule nobody can predict from the
 * outside, because the deciding value is invisible.
 *
 * The rule here is one sentence instead: **the account is the source of truth,
 * and a device seeds an account that has none yet.** So:
 *
 * - the account names a club → the device adopts it, and nothing is uploaded;
 * - the account names none and the device does → the device's is uploaded,
 *   which is the case the plan actually cared about (a sign-in must never
 *   silently discard the choice the reader just made);
 * - neither names one → nothing happens.
 *
 * What it gives up is the A-then-B case above. What it gains is that a reader
 * can predict the outcome, which last-write-wins over an invisible clock does
 * not offer. Revisit when there is a second key whose value is expensive to
 * re-choose — this is a decision about *one* club, not a general position on
 * synchronisation.
 */
export interface SyncPlan {
  /** What this device should hold from now on. */
  device: Preferences;
  /** What to send to the server, or `null` when it already agrees. */
  upload: Preferences | null;
}

export const planSync = (device: Preferences, account: Preferences): SyncPlan => {
  if (account.club) return { device: account, upload: null };
  if (device.club) return { device, upload: device };
  return { device, upload: null };
};

/** Namespaced to match `THEME_STORAGE_KEY`, so one reader's keys sit together. */
export const PREFERENCES_STORAGE_KEY = "portal-brasileirao:preferences";

export const NO_PREFERENCES: Preferences = { club: null };

/**
 * Narrow an unknown stored value, tolerating junk.
 *
 * Anything unreadable resolves to "follows nobody" rather than throwing — the
 * app must render for a reader whose storage holds a half-written value, a
 * different app's key, or a shape some future build wrote.
 *
 * Note what is *not* validated here: whether the club code names a club that
 * exists. This module has no club list and must not acquire one. See
 * `followState`.
 */
export const parsePreferences = (raw: string | null | undefined): Preferences => {
  if (!raw) return NO_PREFERENCES;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return NO_PREFERENCES;
  }

  if (typeof value !== "object" || value === null) return NO_PREFERENCES;

  const club = (value as { club?: unknown }).club;
  return { club: typeof club === "string" && club.length > 0 ? club : null };
};

export const serialisePreferences = (preferences: Preferences): string =>
  JSON.stringify({ club: preferences.club });

/**
 * What the app can say about who a reader follows.
 *
 * Three states rather than a nullable club, because "follows nobody" and
 * "follows somebody we cannot name right now" are different facts that must
 * render differently — and, far more importantly, must be *stored* the same.
 */
export type FollowState =
  | { kind: "none" }
  | { kind: "following"; club: Club }
  | { kind: "unresolved"; code: ClubCode };

/**
 * Resolve the followed club against a club list.
 *
 * **A stored club that does not resolve is not a club that stopped existing.**
 * `seo-core.ts` already holds this rule one table over: `pageStatus` declares a
 * club missing only when the club list actually arrived, because otherwise a
 * provider outage 404s every fixture page at once. Here the stakes are a
 * reader's own choice rather than a crawler's index, so the rule is stricter —
 * the preference is **never** rewritten from a failed lookup, whether the list
 * is still loading, came back empty during an incident, or genuinely no longer
 * names the club. `unresolved` is a rendering state, not a cleanup signal.
 *
 * The tempting version of this function returns `Club | null` and lets the
 * caller "tidy up" the dangling code. That version deletes every reader's Meu
 * time the first time the provider has a bad five minutes.
 */
export const followState = (preferences: Preferences, clubs: Club[] | undefined): FollowState => {
  const code = preferences.club;
  if (!code) return { kind: "none" };

  const club = clubs?.find((candidate) => candidate.code === code);
  return club ? { kind: "following", club } : { kind: "unresolved", code };
};

export const isFollowing = (preferences: Preferences, code: ClubCode): boolean =>
  preferences.club === code;

/**
 * Follow a club, or stop following the one already followed.
 *
 * Returns a new object rather than mutating, so React state updates are honest
 * and a caller cannot accidentally share one across renders.
 */
export const toggleFollow = (preferences: Preferences, code: ClubCode): Preferences => ({
  ...preferences,
  club: isFollowing(preferences, code) ? null : code,
});

/**
 * pt-BR label for the control that follows or unfollows a club.
 *
 * The article is not decoration. "Seguir o Chapecoense" is wrong pt-BR, and
 * Chapecoense is in the division — 20th at the time of writing — so this is a
 * live defect rather than a hypothetical one. It shipped in 52ab8b9 behind a
 * comment claiming all twenty clubs take "o", which was written without reading
 * the twenty names in `clubs.ts`. That is the whole lesson: the list was one
 * grep away.
 *
 * The table itself lives in `club-core.ts`, beside `slugify` and `clubKey`: an
 * article is a property of a club's **name**, not of a reader's device-local
 * preference, and it now has four callers outside this module. This is the one
 * of the five that wants the bare "o"/"a" rather than the contracted `ofClub`.
 */
export const followLabel = (club: Club, following: boolean): string => {
  const article = clubArticle(club);
  return following
    ? `Deixar de seguir ${article} ${club.shortName}`
    : `Seguir ${article} ${club.shortName}`;
};
