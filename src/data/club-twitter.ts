import type { ClubCode } from "@/src/types";

/**
 * HAND-MAINTAINED — each club's official X (formerly Twitter) account. No
 * provider carries a social account at any tier, so these are curated like
 * `club-instagram.ts` and keyed the same way: by **our** club code, never by
 * `tla` — Corinthians and Coritiba both report `COR`.
 *
 * The value is the handle alone, in the casing the account itself displays.
 * The address is derived by `twitterUrl` in `club-core.ts`, so a pasted post
 * permalink or its `?s=20` share suffix does not survive into this file.
 *
 * Every handle was opened in a real browser and read against the account's own
 * name and its recent posts before being written down. That is the check that
 * establishes *whose* account it is, and `npm run check-club-twitter` cannot
 * repeat it. What the script can do is narrower and still worth having: X
 * answers **200 for a handle that exists and 404 for one that does not** —
 * measured 2026-09-15, where Instagram serves one shell for both — so it
 * catches an account deleted or renamed out from under a link. Two things
 * answer 200 all the same: a handle released and re-registered by somebody
 * else, and a **suspended** account — `x.com/Chapecoense` read "Conta suspensa"
 * in a browser and answered 200 to `curl` on the same afternoon, which is why
 * Chapecoense's entry is `ChapecoenseReal` and not the obvious handle.
 */
export const CLUB_TWITTER: Record<ClubCode, string> = {
  "1765": "FluminenseFC",
  "1766": "Atletico",
  "1767": "Gremio",
  "1768": "AthleticoPR",
  "1769": "Palmeiras",
  "1770": "Botafogo",
  "1771": "Cruzeiro",
  "1772": "ChapecoenseReal",
  "1776": "SaoPauloFC",
  "1777": "ecbahia",
  "1779": "Corinthians",
  "1780": "VascodaGama",
  "1782": "ECVitoria",
  "1783": "Flamengo",
  "4241": "Coritiba",
  "4286": "RedBullBraga",
  "4287": "ClubeDoRemo",
  "4364": "mirassolfc",
  "6684": "SCInternacional",
  "6685": "SantosFC",
};
