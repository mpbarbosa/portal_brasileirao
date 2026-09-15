import type { ClubCode, ClubYouTube } from "@/src/types";

/**
 * HAND-MAINTAINED — each club's official YouTube channel. No provider carries
 * one, so these are curated like `club-twitter.ts` and keyed the same way: by
 * **our** club code, never by `tla`.
 *
 * Each entry is a handle and the channel id that handle's own page stated, for
 * `ClubDiscord`'s reason (see `ClubYouTube`): the handle is the link, the id is
 * which channel it is, and `npm run check-club-youtube` compares the two. The
 * handle is stored in the casing the channel itself uses.
 *
 * **Where the club points at a channel, that decided** — a link from the club's
 * own website or its link-in-bio page, resolved to a channel id. Elsewhere the
 * channel's own name and scale did. The obvious handle was wrong four times,
 * measured 2026-09-15:
 *
 * - Vasco's site links `@vascodagama2108`, "Vasco TV" with 1.6 million
 *   subscribers; `@vascotvoficial`, also titled "Vasco TV", has 1.6 thousand.
 * - Bragantino's site links `@MassaBrutaTV`, which also published the videos
 *   the site embeds; `@RedBullBragantinoTV` is a 37-video channel.
 * - Mirassol's site links `@CanalMirassolFC`; `@mirassolfc` is another channel.
 * - `@Coritiba` is three videos and 160 subscribers; the club publishes as
 *   `@coritibaoficial`, "TV Coxa | Coritiba".
 *
 * And a club's own pointer can be stale: Grêmio's X profile still links
 * `/user/gremiotvoficial`, a 96-subscriber leftover, where its Linktree links
 * `@Gremio`. A club's link can also be an older form of the right channel —
 * Santos's site links `/c/santosfc` and `/user/santostvoficial` — and
 * `youtubeChannelHandle` refuses those, so each was resolved to its handle
 * rather than stored as written.
 */
export const CLUB_YOUTUBE: Record<ClubCode, ClubYouTube> = {
  "1765": { handle: "fluminensefc", channel: "UCAAPXtnzlg9krw6MtNbfR-g" },
  "1766": { handle: "atletico", channel: "UC0BhAOfmm1tJaJkPyTM9D_g" },
  "1767": { handle: "Gremio", channel: "UCHKbUAiKHsWCCZrkDY_PZ8Q" },
  "1768": { handle: "AthleticoParanaense", channel: "UCUN1ASH969TSwnuUUU56TmA" },
  "1769": { handle: "Palmeiras", channel: "UCBKc-rPDivvwFiWdG-81wxw" },
  "1770": { handle: "BotafogoTV", channel: "UCFxjZDrLCOCHkUCu632AmMQ" },
  "1771": { handle: "cruzeiro", channel: "UCqifkpdmE1z3VhfQoJzwpJQ" },
  "1772": { handle: "ChapeTv", channel: "UC5of5voGUqec9K9JqL9al4Q" },
  "1776": { handle: "saopaulofc", channel: "UCX3zTAsEoZ61rQMYb_08Tow" },
  "1777": { handle: "TvBahea", channel: "UCcqRCjHozEb9CQHwf_cffdQ" },
  "1779": { handle: "corinthians", channel: "UCqRraVICLr0asn90cAvkIZQ" },
  "1780": { handle: "vascodagama2108", channel: "UCZD5qcen7lbLPFTjfvdLFcw" },
  "1782": { handle: "tvvitoria1899", channel: "UCT2ACrmb364amkLW8L8IhBA" },
  "1783": { handle: "flamengo", channel: "UCOa-WaNwQaoyFHLCDk7qKIw" },
  "4241": { handle: "coritibaoficial", channel: "UCbCD35_3aBxTYcpm8M2LviA" },
  "4286": { handle: "MassaBrutaTV", channel: "UC0x9Ypk2Z1lUdR4a88jMC2Q" },
  "4287": { handle: "RemoTV", channel: "UCsLGx5V5iv-JHbG10oDZOcw" },
  "4364": { handle: "CanalMirassolFC", channel: "UCiz7EFM1alBWxE2hM8k4f4Q" },
  "6684": { handle: "scinternacional", channel: "UC7hAvFDWwVajRqrI86KCoxA" },
  "6685": { handle: "santosfc", channel: "UC0uRT_armQXqds_rjTjqJ0g" },
};
