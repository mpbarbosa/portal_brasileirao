/**
 * Pure preference resolution — what the app remembers about a reader. No
 * storage, no DOM: values in, values out (tests/preferences-core.test.ts).
 *
 * The precedent is `theme-core.ts`, deliberately: a reader choice that survives
 * a reload, parsed defensively because storage holds whatever was last written
 * there, including by a build that is no longer this one.
 *
 * This began as Phase 0 of `docs/accounts.md` — the two thirds of "accounts"
 * that need no account. **It is no longer only that**, and the boundary now
 * runs *through* this file rather than around it: `club` is device-local first
 * and syncs to an account, while `landing` exists only in an account. The two
 * are one object because the endpoint is a whole-object PUT and the client must
 * always send the complete set; they are told apart at exactly two points, the
 * device serialiser and `planSync`, and nowhere else.
 */

import { clubArticle, clubKey } from "@/club-core";
import type { Route } from "@/route-core";
import type { Club, ClubCode } from "@/src/types";

/**
 * **Página inicial** — where the app opens for a signed-in reader.
 *
 * Deliberately *not* `SectionId` from `src/navigation.ts`, which would be the
 * obvious reuse: that module imports React components for the nav bar's
 * glyphs, and this one is pure and unit-tested without a DOM. It is also not
 * the same set — `meu-time` is a destination this app has no section for, and
 * a detail view like `partida` is not a place anybody can *land*, because it
 * names a fixture that will have been played by next week.
 *
 * The ids match `Route`'s section names where one exists, so `landingRoute`
 * reads as a mapping rather than a translation table.
 */
export type LandingId =
  | "classificacao"
  | "ao-vivo"
  | "jogos"
  | "artilharia"
  | "jogadores"
  /** The page of the club under **Meu time** — the one option whose
   *  destination is a different address for every reader. */
  | "meu-time";

export interface LandingOption {
  id: LandingId;
  /** What the control shows. */
  label: string;
  /** One line beneath it, so the choice is legible without opening the menu. */
  description: string;
}

/**
 * The options, in the nav bar's own order, with `meu-time` appended.
 *
 * Order is not cosmetic here: a reader scanning this list is looking for the
 * destination they already know from the bar at the top of the page, and a
 * second ordering of the same five things is a small puzzle for no gain.
 * `meu-time` goes last because it is the only entry that is not in that bar.
 */
export const LANDING_OPTIONS: LandingOption[] = [
  {
    id: "classificacao",
    label: "Classificação",
    description: "A tabela da Série A. É onde o Portal abre para todo mundo.",
  },
  {
    id: "ao-vivo",
    label: "Ao vivo",
    description: "O que está em campo agora, o que vem a seguir e o que acabou.",
  },
  { id: "jogos", label: "Jogos", description: "As partidas da rodada atual." },
  { id: "artilharia", label: "Artilharia", description: "Os maiores goleadores do campeonato." },
  { id: "jogadores", label: "Jogadores", description: "Os elencos de todos os clubes." },
  {
    id: "meu-time",
    label: "Meu time",
    // Deliberately does not mention the fallback. The card says so, louder and
    // in the second person, exactly when it applies — saying it here too tells
    // a reader who *does* follow a club about a case that is not theirs, and
    // tells one who does not the same thing twice.
    description: "A página do clube que você segue.",
  },
];

const LANDING_IDS = new Set<string>(LANDING_OPTIONS.map((option) => option.id));

export const landingLabel = (landing: LandingId): string =>
  LANDING_OPTIONS.find((option) => option.id === landing)?.label ?? landing;

export interface Preferences {
  /**
   * **Meu time** — the club this reader follows, or `null` for nobody.
   *
   * Stored as the club's `code`, which is the upstream numeric id, never the
   * `tla` and never the slug: Corinthians and Coritiba both report `COR`, and a
   * slug is a URL concern that changes when a display name is tidied.
   */
  club: ClubCode | null;
  /**
   * **Página inicial** — the section the app opens on, or `null` for "has not
   * chosen", which behaves as the Classificação.
   *
   * **Account-only**, which is the one thing to know before touching it: no
   * copy is written to `localStorage`, so a guest has nowhere to keep this and
   * is not offered it. That is a decision rather than an oversight — the whole
   * point of the setting is that it follows a person between aparelhos, and a
   * device-local version would silently *disagree* with the account one on the
   * device that set it. `serialiseDevicePreferences` is where the rule is
   * enforced; `planSync` is where it is reconciled.
   */
  landing: LandingId | null;
}

/**
 * What a device should hold once its reader signs in, and what to send back.
 *
 * This module used to argue the rule from there being **one key**, and said in
 * as many words to revisit it when a second arrived. This is that revisit, and
 * the answer is still not the last-write-wins that `docs/accounts.md` §4
 * sketched — for a reason that has changed shape rather than gone away.
 *
 * The two keys are not the same *kind* of preference:
 *
 * - **`club` is device-local first.** A guest may follow a club, so both sides
 *   can hold a value and something has to pick one. The account is the source
 *   of truth, and a device seeds an account that has none yet. So: the account
 *   names a club → the device adopts it and nothing is uploaded; the account
 *   names none and the device does → the device's is uploaded, which is the
 *   case the plan actually cared about (signing in must never silently discard
 *   the club just chosen); neither names one → nothing happens. What it gives
 *   up is a change made signed-out on aparelho A losing to aparelho B's older
 *   account copy. What it gains is that a reader can predict the outcome, which
 *   last-write-wins over an invisible clock does not offer.
 * - **`landing` is account-only.** There is no device copy that could
 *   disagree, by construction, so there is nothing to merge: the account's
 *   value is adopted, and this function never uploads one.
 *
 * A timestamp per key would still buy exactly the one case above, at the price
 * of a stamp beside every value, a storage-shape migration for everyone who
 * already has a preference, and a rule nobody can predict from outside because
 * the deciding value is invisible.
 *
 * **The general form, now that there are two keys, is worth more than either:
 * a merge rule is only owed where both sides can hold a value.** Ask which side
 * *owns* a key before asking how to reconcile it. Two of these have needed no
 * clock; a third that a guest cannot set will not need one either.
 *
 * One trap the shape here exists to close: `upload` carries the **whole** set,
 * `landing` included, because the endpoint is a whole-object PUT. Seeding the
 * account with `{ club }` alone would erase a reader's landing choice the first
 * time they followed a club.
 */
export interface SyncPlan {
  /** What this device should hold from now on. */
  device: Preferences;
  /** What to send to the server, or `null` when it already agrees. */
  upload: Preferences | null;
}

export const planSync = (device: Preferences, account: Preferences): SyncPlan => {
  // Adopted, never seeded and never uploaded on its own account: the device
  // has no opinion about this key and is not allowed to acquire one.
  const landing = account.landing;

  if (account.club) return { device: { club: account.club, landing }, upload: null };
  if (device.club) {
    const merged: Preferences = { club: device.club, landing };
    return { device: merged, upload: merged };
  }
  return { device: { club: null, landing }, upload: null };
};

/**
 * What is left of a reader's preferences once they sign out.
 *
 * Not `NO_PREFERENCES`: the club is this **device's** to remember, and Phase 0
 * behaviour — a guest following a club — must survive a sign-out that had
 * nothing to do with it. The landing choice goes, because it never lived here.
 */
export const forgetAccountPreferences = (preferences: Preferences): Preferences => ({
  club: preferences.club,
  landing: null,
});

/** Namespaced to match `THEME_STORAGE_KEY`, so one reader's keys sit together. */
export const PREFERENCES_STORAGE_KEY = "portal-brasileirao:preferences";

export const NO_PREFERENCES: Preferences = { club: null, landing: null };

/** Whether there is anything worth a row. The store deletes rather than writing
 *  an empty set, so that "chose nothing" and "has never chosen" stay the same
 *  state — which is what `planSync` assumes when it decides whether to seed. */
export const hasPreferences = (preferences: Preferences): boolean =>
  preferences.club !== null || preferences.landing !== null;

/**
 * Narrow an unknown stored value, tolerating junk.
 *
 * Anything unreadable resolves to "follows nobody, lands nowhere in
 * particular" rather than throwing — the app must render for a reader whose
 * storage holds a half-written value, a different app's key, or a shape some
 * future build wrote. The same function narrows the request body of
 * `PUT /api/account/preferences`, which is why an unrecognised `landing` is
 * dropped rather than stored: a value this build cannot map to a route would
 * otherwise sit in the database sending somebody nowhere.
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
  const landing = (value as { landing?: unknown }).landing;

  return {
    club: typeof club === "string" && club.length > 0 ? club : null,
    landing: typeof landing === "string" && LANDING_IDS.has(landing) ? (landing as LandingId) : null,
  };
};

/** The wire form: the whole set, because the endpoint replaces the whole set. */
export const serialisePreferences = (preferences: Preferences): string =>
  JSON.stringify({ club: preferences.club, landing: preferences.landing });

/**
 * The device form: **the club and nothing else.**
 *
 * A separate function rather than a flag on the one above, because this is the
 * single place the account-only rule is enforced and a boolean argument at a
 * call site is easy to pass wrong and impossible to see. Writing `landing` here
 * would give a device an opinion the account is supposed to own — and the
 * device that wrote it would then disagree with every other one the reader
 * signs in on, which is the exact failure the setting exists to avoid.
 */
export const serialiseDevicePreferences = (preferences: Preferences): string =>
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

/** Choose where the app opens. `null` restores the default. */
export const setLanding = (preferences: Preferences, landing: LandingId | null): Preferences => ({
  ...preferences,
  landing,
});

/**
 * Where a reader's landing choice should send them, or `null` for "stay on the
 * Classificação".
 *
 * Null rather than `HOME` on purpose, and the caller depends on the
 * distinction: this runs on a page that has **already rendered** the table, so
 * "stay" has to be expressible as *doing nothing at all*. Returning the home
 * route would make the caller navigate to where it already is on every load —
 * harmless with `useRoute`'s same-route guard, and a redirect that a future
 * reader of `App` would have to prove was a no-op.
 *
 * `meu-time` resolves only from a `following` state. An `unresolved` club is a
 * code this build cannot turn into a URL — the club list has not arrived, or
 * came back empty during an incident — and guessing at one would land a reader
 * on a 404 generated by their own preference, at the moment the provider is
 * already struggling. That is `followState`'s rule applied one layer out: an
 * absent club list is not evidence of an absent club.
 */
export const landingRoute = (landing: LandingId | null, follow: FollowState): Route | null => {
  switch (landing) {
    case null:
    case "classificacao":
      return null;
    case "ao-vivo":
      return { section: "ao-vivo" };
    case "jogos":
      // `round: null` — "whatever the current round is", the link that stays
      // useful next week. A landing page pinned to round 24 is a bug that takes
      // a season to notice.
      return { section: "jogos", round: null };
    case "artilharia":
      return { section: "artilharia" };
    case "jogadores":
      return { section: "jogadores" };
    case "meu-time":
      return follow.kind === "following" ? { section: "clube", key: clubKey(follow.club) } : null;
  }
};

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
