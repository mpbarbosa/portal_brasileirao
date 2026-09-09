import type { PlayerPost } from "@/src/types";

/**
 * HAND-MAINTAINED — publicações do Instagram shown on the **Card do jogador**,
 * keyed by **our** player id, exactly as `player-instagram.ts` beside it. No
 * provider carries a post at any tier, so this is curated and always will be.
 *
 * ## What this is, and why it is not the thing `player-photos.ts` refuses
 *
 * That file says in as many words that Instagram is not a source and cannot
 * be — *a player's own photographs are their copyright; a public profile
 * licenses nothing, the CDN addresses expire, and hotlinking them republishes
 * someone's work without permission.* Every word of that still holds, and this
 * file does not touch it: **nothing here copies an image.**
 *
 * What is stored is a post's shortcode. What is rendered is Instagram's own
 * `/embed/captioned/` page inside a frame — Meta's published route for showing
 * a post somewhere else, which is why that page carries the author's avatar,
 * their handle, the like count, the caption and a link back. Those are not
 * chrome to be trimmed: they are the attribution, and they are the reason this
 * is republication rather than a copy. Serving the picture ourselves would
 * strip all of it, which is the failure `PlayerPhoto`'s three required credit
 * fields exist to prevent one type over.
 *
 * So the rule for a later reader is short: **an `<img src="…cdninstagram.com">`
 * anywhere near this feature is the bug.** Both because the addresses expire —
 * so it breaks — and because it is the exact thing the neighbouring file
 * refuses.
 *
 * ## Nothing is fetched until a reader asks
 *
 * `PlayerPosts` renders a **facade**: a labelled button carrying the summary
 * below, and no frame at all until it is pressed. That is `ClubVideos`' rule
 * and its argument transfers intact — a card is opened for a player's figures
 * and links, so a reader who came for an age and a position must not be charged
 * a request to Meta, a cookie and a third-party script for a section they never
 * looked at. It is also why there is no thumbnail: a preview image would have to
 * come from Instagram's CDN, which is the copy this file refuses.
 *
 * ## Checking an entry, which is by hand and cannot be otherwise
 *
 * `player-instagram.ts` records why there is no `check-player-instagram`:
 * Instagram serves the **identical JavaScript shell** for a real handle and an
 * invented one — 200, `<title>Instagram</title>`, no Open Graph tags. The same
 * is true of a shortcode, and it was re-checked for this file rather than
 * assumed: `curl` of `/p/Dc1GBBADkfo/embed/captioned` and of
 * `/p/ZZZnotarealZZ/embed/captioned` came back **620 681 and 620 686 bytes**,
 * same title, same everything that matters. A script reporting "200 OK" would
 * confirm nothing while looking exactly like the ones that confirm something.
 *
 * So every entry is **opened in a browser**, and `summary` is written from that
 * viewing — `PlayerPhoto.alt`'s rule. Do not paste a link from a search result.
 *
 * ## `account` is the post's author and is often not the player
 *
 * The seed entry is the case: `Dc1GBBADkfo` is **Athletico-PR's** post, with
 * Viveros as a collaborator. A section headed "publicações do jogador" over a
 * club's post would assert an authorship nobody can check from the page, so the
 * card names the account on every entry. Read the field as *who published this*
 * and never as *whose player this is*.
 *
 * Coverage is deliberately **partial**, like `broadcasts.ts` and every curated
 * file here — count the entries rather than a number written in this comment,
 * which has no gate on it.
 */
export const PLAYER_POSTS: Record<string, PlayerPost[]> = {
  // Kevin Viveros · Athletico-PR. Opened 2026-09-09: a carrossel published by
  // the club with Viveros as collaborator, announcing him as the division's
  // jogador do mês. His own account is `kevinviveros9` in `player-instagram.ts`
  // — the two files agree, and this one records the club because the club is
  // who posted.
  "192070": [
    {
      code: "Dc1GBBADkfo",
      account: "athleticoparanaense",
      summary:
        "O Athletico anuncia Viveros como jogador do mês de agosto, com nota 7,28 do Sofascore.",
    },
  ],
};
