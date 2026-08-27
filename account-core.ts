/**
 * What an account *is*, separately from where it is stored.
 *
 * Pure: no database, no clock beyond what is passed in. The store
 * (`account-store.ts`) is the only file that knows SQL, and the split is what
 * lets these rules be tested without one — the same division `commons-core.ts`
 * and `scripts/commons-api.ts` already draw.
 */

import type { Preferences } from "@/preferences-core";

export type AuthProvider = "google" | "dev";

export interface Account {
  /** Opaque and ours. Never the provider's subject, and never an email: both
   *  can be reassigned, and a primary key may not. */
  id: string;
  provider: AuthProvider;
  /** The provider's own stable identifier for this person (`sub`). */
  subject: string;
  displayName: string;
  createdAt: number;
  lastSeenAt: number;
}

/**
 * What `/api/account/me` is allowed to say.
 *
 * A separate shape rather than the row with fields deleted, because "remember
 * to strip the sensitive ones" is a rule that holds until somebody adds a
 * column. Here a new column is invisible to the client until it is named here
 * on purpose.
 *
 * Note what is absent: `provider` and `subject`. Neither is any use to the
 * page, and `subject` is a stable cross-service identifier for a person — the
 * one field on the row that would matter if it reached a client-side error
 * report.
 */
export interface PublicAccount {
  id: string;
  displayName: string;
  /**
   * The account's preferences, carried here rather than behind a second
   * endpoint.
   *
   * A signed-in reader needs both on every page load, and `/api/account/me` is
   * already that request. A separate `GET /api/account/preferences` would
   * double it for the only readers who have anything to fetch.
   */
  preferences: Preferences;
}

export const publicAccount = (account: Account, preferences: Preferences): PublicAccount => ({
  id: account.id,
  displayName: account.displayName,
  preferences,
});

/** Longer than this is a display bug rather than a name. */
const NAME_MAX = 60;

/** C0 and C1 control characters, which have no business in a rendered name. */
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

/**
 * Tidy a provider-supplied display name into something renderable.
 *
 * Collapses whitespace, strips control characters, truncates. What it does
 * **not** do is reject: a name that arrives strange is still that person's
 * name, and refusing it would fail a sign-in over a rendering concern. An empty
 * result falls back to a neutral pt-BR word rather than to a page with a hole
 * in it — Google will send something, but a provider that sends only spaces
 * should not decide our layout.
 */
export const normaliseDisplayName = (raw: string | null | undefined): string => {
  const cleaned = (raw ?? "").replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();

  if (!cleaned) return "Torcedor";
  return cleaned.length > NAME_MAX ? `${cleaned.slice(0, NAME_MAX - 1).trimEnd()}…` : cleaned;
};

/**
 * The first name, for greeting somebody without shouting their full name back
 * at them. Falls back to the whole thing when there is only one word.
 */
export const firstName = (displayName: string): string =>
  displayName.split(" ")[0] || displayName;

/** A new account id. Opaque, and derived from nothing about the person. */
export const newAccountId = (random: () => string): string => `acc_${random()}`;
