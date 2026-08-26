import type { PlayerPhoto } from "@/src/types";

/**
 * HAND-MAINTAINED — photographs of players, from Wikimedia Commons, keyed by
 * player id.
 *
 * **Instagram is not a source here and cannot be.** A player's own photographs
 * are their copyright; nothing about a public profile licenses reuse, the CDN
 * addresses expire, and hotlinking them would republish someone's work without
 * permission. Commons is the source precisely because a licence is attached to
 * every file and says what may be done with it. If a photograph is wanted that
 * Commons does not have, the answer is that the app does not show one — not
 * that it takes one from elsewhere.
 *
 * The bytes are **vendored into `public/players/`** by
 * `npm run sync-player-photos` and served from our own origin, the same answer
 * the broadcaster marks and the stadium photographs got (`docs/roadmap.md`
 * principle 4). That reasoning is sharper here than for stadiums: a stadium
 * page shows one photograph, whereas opening several cards in a row is the
 * ordinary way to read the Jogadores page, and Commons throttles at the third
 * or fourth request.
 *
 * `credit`, `license` and `licenseUrl` are required by the type. A player may
 * have no photograph; a player may not have an unattributed one. Credits are
 * copied **verbatim**, trailing punctuation and all — where Commons publishes
 * an `Attribution` field the photographer dictated that wording, and tidying it
 * into house style is the edit that is not ours to make.
 *
 * ## Two traps, both of which the stadium photographs hit first
 *
 * **A file that resolves is not a photograph of the right person.** The obvious
 * automation — take the lead image of the player's article — is exactly what
 * put a journalist posing outside the Nilton Santos into `stadiums.ts` as a
 * photograph of the ground. For a player the same trap is a team group shot, a
 * different player in the frame, or a namesake. Every file here was opened and
 * looked at, and `alt` was written from that viewing rather than from the name.
 *
 * **A free photograph of a footballer is usually old.** Commons has what
 * somebody was free to release, which is rarely this season and rarely this
 * club: the picture below shows Memphis Depay at Olympique Lyonnais in 2019,
 * not at Corinthians. That is not a defect to hide — it is why `alt` names the
 * shirt and the year, so a reader who cannot see the image is not left assuming
 * it is current.
 *
 * Verify with:
 *
 *   npm run check-player-photos
 *
 * which re-reads every licence and credit from Commons. Like `check-hymns` it
 * prints the whole table: it narrows what a person has to look at, it does not
 * replace looking.
 */
export const PLAYER_PHOTOS: Record<string, PlayerPhoto> = {
  // Memphis Depay · Corinthians
  "8472": {
    file: "Memphis Depay 2019.jpg",
    alt: "Memphis Depay de perto, com a camisa azul do Olympique Lyonnais, em 2019",
    credit: "Derivative work: Joe Sins",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
};
