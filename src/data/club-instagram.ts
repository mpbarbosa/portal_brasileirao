import type { ClubCode } from "@/src/types";

/**
 * HAND-MAINTAINED — the data provider carries no social accounts at any tier,
 * so these are curated, like `broadcasts.ts`.
 *
 * Keyed by **our** club code (the upstream numeric id), never by `tla`:
 * Corinthians and Coritiba both report `COR`, and pointing one club's readers
 * at another club's account is the exact failure that keying on an
 * abbreviation produces.
 *
 * The value is the handle alone. The profile URL is derived by `instagramUrl`
 * in `club-core.ts`, so the origin is written once rather than twenty times,
 * and a pasted URL with Instagram's `?hl=pt-br` locale hint normalises to the
 * canonical address instead of persisting the noise.
 *
 * Every handle here was confirmed against the live profile — its page titles
 * itself "<club> (@handle)". That matters more than it sounds: Wikidata lists
 * Palmeiras as `sepalmeiras`, which is not the club's account, and a club's own
 * site advertises its sponsors' handles alongside its own. Neither source is
 * reliable enough to copy without looking.
 */
export const CLUB_INSTAGRAM: Record<ClubCode, string> = {
  "1765": "fluminensefc",
  "1766": "atletico",
  "1767": "gremio",
  "1768": "athleticoparanaense",
  "1769": "palmeiras",
  "1770": "botafogo",
  "1771": "cruzeiro",
  "1772": "chapecoensereal",
  "1776": "saopaulofc",
  "1777": "ecbahia",
  "1779": "corinthians",
  "1780": "vascodagama",
  "1782": "ecvitoria",
  "1783": "flamengo",
  "4241": "coritiba",
  "4286": "redbullbragantino",
  "4287": "clubedoremo",
  "4364": "mirassolfc",
  "6684": "scinternacional",
  "6685": "santosfc",
};
