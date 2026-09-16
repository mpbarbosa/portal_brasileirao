import type { ClubCode, ClubPost } from "@/src/types";

/**
 * HAND-MAINTAINED — publicações do Instagram shown on the **Página do clube**,
 * keyed by **our** club code (the upstream numeric id) and never by `tla`:
 * Corinthians and Coritiba both report `COR`. No provider carries a post at any
 * tier, so this is curated and always will be — `club-videos.ts`' arrangement,
 * one section further down the same page.
 *
 * ## It is `player-posts.ts`' rules, at a different key
 *
 * Everything that file argues holds here unchanged and is deliberately **not
 * restated**: nothing copies an image, an `<img src="…cdninstagram.com">`
 * anywhere near this feature is the bug, the section is a **facade** that
 * requests nothing from Meta until a reader presses it, and what is stored is
 * the shortcode alone because Instagram's "copy link" appends a `stkn` share
 * token identifying whoever copied it. `InstagramPost` in `src/types.ts` is the
 * one shape both files write, so those rules cannot come to differ between the
 * two sections. Read that file before adding an entry here.
 *
 * ## The one rule that is STRICTER here, and it is checkable offline
 *
 * `player-posts.ts` accepts "the club's own account or the player's own, and
 * verified", because a post about a player is very often published by the club
 * — its seed entry is Athletico-PR's post with Viveros as a collaborator.
 *
 * A **Publicação do clube** has no such latitude: the section is the club's own
 * publicações, so `account` must be the handle `club-instagram.ts` already
 * records for that same club code. That turns the bar into a comparison
 * between two committed files rather than a judgement about a badge, which is
 * why `tests/club-posts.test.ts` can hold it **with no network at all** —
 * `check-player-posts` still asks Instagram whether the account is verified and
 * whether the post is still there, and that is the half only a browser can do.
 *
 * Read the asymmetry as the security property it is, in `visitorHits`' idiom:
 * an entry naming some other verified account is refused by a unit test on
 * every commit, where the player file can only be refused by a monthly run.
 *
 * ## Current season, and the tell
 *
 * The second of `player-posts.ts`' two rules transfers verbatim. Instagram
 * prints a bare "April 2" for a post from the current year and
 * "April 27, 2025" for an older one; the canonical `/p/<code>/` page shows a
 * date where the embed does not, and a post published within the last week
 * reads as "1 day ago" there.
 *
 * ## Adding an entry: look for the key on `origin/main` first
 *
 * `player-posts.ts` records what this costs when it is skipped, and the trap is
 * identical because the shape is: a club that already has a post has a key, and
 * a second key is **not** a second list.
 *
 *     git grep -n '"<club code>"' origin/main -- src/data/club-posts.ts
 *
 * If that answers, append to that key's array. Read `origin/main` rather than
 * the working tree — several sessions edit curated files on the same day, and a
 * local copy is precisely the one missing the other session's key. `tsc` is the
 * only gate that refuses a duplicate key (TS1117); the unit tests run through
 * tsx, which type-checks nothing, and esbuild prints a warning and exits 0,
 * both keeping the **second** key and dropping the first. So the page would
 * show one plausible list with a post missing, which is why no test here has a
 * duplicate-key case: the collapse has already happened by the time a test can
 * look.
 *
 * Coverage is deliberately **partial** — count the entries rather than a number
 * written in this comment, which has no gate on it. A club with no entry
 * renders no section at all rather than an empty heading.
 */
export const CLUB_POSTS: Record<ClubCode, ClubPost[]> = {
  // Flamengo. Opened 2026-09-16: a reel published by the club's own verified
  // account, `flamengo`, which is the handle `club-instagram.ts` records for
  // `1783` — the two files agree, which is the bar this file states. Posted
  // "1 day ago" and so current-season on the rule above; 28.6K likes, 226
  // comments, read off the canonical page because the embed carries no date.
  //
  // It is the melhores momentos of **555005**, Flamengo 2 x 1 Corinthians in
  // the 27ª rodada. That fixture's own `highlights.ts` entries are the ge tv
  // and UOL Esporte uploads on YouTube, and this is deliberately not one of
  // them: `highlights.ts` is **YouTube only** — `isHighlightUrl` drops anything
  // else silently — and a club's own reel is the club publishing, not a
  // broadcaster's package. The two sections answer different questions.
  "1783": [
    {
      code: "DdRg1_tTnJs",
      account: "flamengo",
      summary:
        "Reel do FlamengoTV com os melhores momentos da vitória por 2 x 1 " +
        "sobre o Corinthians, na 27ª rodada, vistos da câmera do Adm.",
    },
  ],
};
