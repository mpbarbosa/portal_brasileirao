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
 * ## Checking an entry: by hand to add it, by browser to keep it
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
 * **That paragraph said "and there cannot be one", and that was too strong.
 * `npm run check-player-posts` now exists.** What no **HTTP** client can check,
 * a **browser** can: the `/embed/captioned/` page renders its content
 * client-side, so a real engine reads the account, the verified badge, the
 * follower count and the whole caption. `scripts/check-player-posts.ts` drives
 * the `chromium` this repo already carries for Playwright and
 * `screenshot.ts` — so no dependency was added — and checks that the post still
 * exists, that the publisher is still the recorded `account`, and that the
 * account is still verified.
 *
 * **The one it exists for is the deleted post**, which nothing else here can
 * see: a dead entry renders as an empty white frame inside the card, the facade
 * still reads correctly and the link still looks right. `DbPDTdToXCN` came back
 * from a search during this file's second pass with a plausible title and
 * answers *"The link to this photo or video may be broken, or the post may have
 * been removed."* It is the checker's own mutation case.
 *
 * **The checker does not re-check the two curation rules below.** A post does
 * not become old, and a player leaving the division is already refused by
 * `tests/player-posts.test.ts` with no network at all. What can rot is
 * somebody else's server, which is the only thing it asks about.
 *
 * ## The bar an entry has to clear, and what it rejected
 *
 * Two rules, both applied to every entry below:
 *
 * - **The account is the club's own or the player's own, and verified.** Not
 *   "whoever posted something true". This is checkable from the embed itself —
 *   the badge, the follower count, and the handle matching `club-instagram.ts`
 *   or `player-instagram.ts`.
 * - **Current season.** Instagram prints a bare "April 2" for a post from the
 *   current year and "April 27, 2025" for an older one, which is the tell; the
 *   canonical `/p/<code>/` page shows it where the embed does not.
 *
 * **9 of 11 candidates were rejected**, which is a far worse rate than the
 * 13-of-70 `player-instagram.ts` records for handles, and the reasons are why
 * a search result's *title* is worth nothing here: a broadcaster's advertisement
 * (`premiere`, ending "#BoraDePremiere"), two fan pages, a news outlet
 * (`lancedigital`), a **rival club's** analysis account posting a Palmeiras goal
 * (`analisacrvg`, a Vasco page), a **gossip** account whose Neymar caption is
 * about a poker tournament, one **dead** shortcode, and two posts from the right
 * club's own verified account that were simply a year old. Every one of those
 * reads as a reasonable match in a list of search results.
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

  // Yuri Alberto · Corinthians. Opened 2026-09-09: `corinthians`, verificada,
  // 16M seguidores, 14 de maio — o gol que garantiu a classificação. A conta
  // dele, `yurialberto`, está em `player-instagram.ts`; quem publicou foi o
  // clube.
  "1325": [
    {
      code: "DYV1l9tB11y",
      account: "corinthians",
      summary: "O gol de Yuri Alberto que sacramentou a classificação do Corinthians.",
    },
  ],

  // José Manuel López (Flaco) · Palmeiras. Opened 2026-09-09: `palmeiras`,
  // verificada, 7,7M seguidores, 2 de abril. Marco de carreira e não um lance,
  // que é o tipo de post que envelhece melhor num cartão de jogador.
  "170698": [
    {
      code: "DWpfDycoBoq",
      account: "palmeiras",
      summary:
        "O Palmeiras celebra as 200 partidas de Flaco López pelo clube — o 5º estrangeiro a chegar lá.",
    },
  ],

  // Carlos Vinícius · Grêmio. Opened 2026-09-11: publicado pela própria conta
  // dele, `carlosvinicius95`, verificada, 676 mil seguidores — o mesmo handle
  // que `player-instagram.ts` registra —, em 4 de setembro. Um carrossel dele
  // com a camisa do Grêmio, comemorando a classificação do clube. O primeiro
  // post aqui publicado pelo jogador e não pelo clube.
  "37833": [
    {
      code: "Dc2foWLjsoh",
      account: "carlosvinicius95",
      summary: "Carlos Vinícius comemora a classificação do Grêmio, com a camisa tricolor.",
    },
  ],

  // Gabriel Barbosa (Gabigol) · Santos. Opened 2026-09-11: `gabigol`,
  // verificada, 11,2M seguidores, publicada às 23:34 de 30 de maio (horário de
  // Brasília, lido do shortcode). É a noite do Santos 3x1 Vitória, em que ele
  // marcou aos 56'. Carrossel sem legenda; o primeiro slide mostra a camisa 9 do
  // Santos. O resumo diz a data e não afirma que as fotos são desse jogo.
  "1327": [
    {
      code: "DY_IgxsFUtf",
      account: "gabigol",
      summary:
        "Gabigol publica na noite do 3 a 1 do Santos sobre o Vitória, em que marcou o terceiro gol.",
    },
  ],
};
