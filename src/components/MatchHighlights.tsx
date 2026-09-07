import { useId, useState } from "react";

import { videoEmbedUrl } from "@/club-core";
import { playsInPage } from "@/match-core";
import { controlClasses } from "@/src/components/Button";
import { LINK_UNDERLINE } from "@/src/components/interaction";
import type { Highlight } from "@/src/types";

/**
 * The **Melhores momentos** section of the Partida page: the match's own
 * highlights, playing in the page.
 *
 * **The video is the section, and the row of channel pills that used to be is
 * gone.** Those were link-outs wearing a control's chrome — a play glyph and a
 * broadcaster's mark — so the one thing a reader opens a finished match for
 * was represented by two 40dp buttons and delivered in another tab. The player
 * is now what the section *is*, and the other channels are text beneath it.
 *
 * That reverses `CONTEXT.md`'s standing refusal of an embedded player, which
 * is argued in the **Hino do clube** and **Vídeos do clube** entries. Neither
 * of those decisions changes and neither is weakened: both are about the
 * *club* page, where a video is one of a dozen things offered and a player
 * that can start playing is a hymn nobody asked for. This is the one page in
 * the app where the video is the errand — the section already sits directly
 * above **Data e hora** for that reason — and the two objections are answered
 * rather than overruled:
 *
 * - **Nothing plays by itself.** `videoEmbedUrl` sets no `autoplay`, so what
 *   renders is a poster and YouTube's own play button. A reader who came for
 *   the scoreline hears nothing, which is the whole of the hymn objection.
 * - **`youtube-nocookie.com`**, YouTube's privacy-enhanced host, so the frame
 *   sets no tracking cookie for a reader who never presses play.
 *
 * What is genuinely spent is one third-party frame on a finished match's page.
 * That is the cost of the request, and it is charged where the reader is
 * asking for a video rather than on a page that merely mentions one.
 *
 * **One frame, never one per channel.** Several broadcasters publish their own
 * package for the same match, and mounting all of them would be two or three
 * players on one page — the *rail* objection in full, and two things able to
 * play at once. So the preferred package is in the frame and the rest are
 * links under it; picking one swaps the frame rather than adding to it.
 *
 * **Those links are still real `<a href>`s to the watch page.** A modified
 * click — ctrl, cmd, shift, alt, middle button — is left to the browser, so
 * "open in new tab" still opens the package on YouTube, which is the rule
 * every other navigation in this app follows.
 *
 * **A channel YouTube refuses to embed keeps the link-out**, which is
 * `playsInPage`' job and the reason the frame's own caption always carries a
 * way to YouTube: see `embedFor` below, and that function in `match-core.ts`
 * for what was measured.
 *
 * Renders the search fallback when nothing is curated, and pointedly **not** a
 * player: `highlightsSearchUrl` builds a query, and embedding the first result
 * of one is exactly the "presenting the search as an official video" that
 * entry forbids. It keeps its button, because there is no video for the
 * section to be.
 */
export function MatchHighlights({
  videos,
  searchUrl,
}: {
  videos: Highlight[];
  searchUrl: string;
}) {
  /**
   * Which package is in the frame, keyed by URL — the one field a curated
   * entry is unique on. `null` means "whichever is preferred", resolved below
   * rather than seeded into state: a `useState` initialiser runs once, and the
   * Partida page re-fetches an unsettled match, so a list that arrives or
   * changes under a mounted component would leave a seeded id naming an entry
   * that is no longer there.
   */
  const [picked, setPicked] = useState<string | null>(null);
  const frameId = useId();

  const playable = videos.filter((video) => embedFor(video) !== null);
  // The file is written in the rights-holder preference order that
  // `KNOWN_CHANNELS` states — ge tv, CazéTV, UOL Esporte — so the first entry
  // that can play is the one to show unasked.
  const current = playable.find((video) => video.url === picked) ?? playable[0] ?? null;
  const currentEmbed = current && embedFor(current);
  const others = videos.filter((video) => video !== current);

  return (
    <section className="mt-4">
      <h3 className="mb-2 text-body-medium font-medium text-ink-muted">Melhores momentos</h3>

      {videos.length > 0 ? (
        <>
          {currentEmbed && current && (
            <div
              id={frameId}
              // 16:9, the shape a YouTube video is delivered in, so the frame
              // is the video's own shape at every width and nothing is
              // letterboxed. `overflow-hidden` is what makes the radius reach
              // the player, which paints to its own edges.
              className="relative aspect-video overflow-hidden rounded-small border border-outline-variant bg-surface-container-lowest"
            >
              <iframe
                // Keyed by URL so picking another channel *replaces* the frame
                // rather than re-pointing one: an iframe whose `src` changes
                // keeps its history entry, and Back would then walk the reader
                // through videos they had already left.
                key={currentEmbed}
                src={currentEmbed}
                title={`Melhores momentos — ${current.channel}`}
                // Each of these is refused by default in a frame and each is
                // something a player is expected to be able to do. `autoplay`
                // is delegated for the *reader's* press inside the player, not
                // for the page: the URL asks for none.
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                // The default would send the full Partida URL to YouTube with
                // every request. Same reasoning as the crests' own policy.
                referrerPolicy="strict-origin-when-cross-origin"
                // The frame sits high on the page and will usually load
                // anyway; what this buys is the narrow screen where it does
                // not, and the first paint, where the player's own requests
                // would otherwise compete with `/api/matches`. It is not a
                // second gate on the third party — `playsInPage` and the
                // absence of `autoplay` are what bound that.
                loading="lazy"
                className="absolute inset-0 h-full w-full"
              />
            </div>
          )}

          {current ? (
            <p className="mt-2 text-body-small text-ink-faint">
              Melhores momentos por {current.channel}.{" "}
              {/* **The way out, and it is not a courtesy.** A frame can fail
                  for reasons no list can anticipate — a video pulled since it
                  was curated, a rights window that closed, a country the
                  package is not licensed in — and what YouTube draws then is
                  its own error card. This is one click to the video from where
                  the reader is already looking, and it is why `playsInPage`
                  may be an incomplete list without that leaving anybody
                  stuck. */}
              Se não tocar aqui,{" "}
              <a
                href={current.url}
                target="_blank"
                rel="noopener noreferrer"
                className={LINK_UNDERLINE}
              >
                abra no YouTube
                {/* The channel rides in the accessible name because that is
                    what this link opens — the sentence above names it in text,
                    where a screen reader meets the anchor on its own. It is
                    also what keeps every curated channel reachable *by name*,
                    which is the promise `each link is labelled by its channel`
                    has been asserting since the section was a row of pills. */}
                <span className="sr-only"> — {current.channel} (abre em nova aba)</span>
              </a>
              .
            </p>
          ) : (
            // Every channel that covered this match is one YouTube will not
            // play in a frame. Not reachable from today's curated file — all
            // 238 matches carry a channel that plays — and the section still
            // has to say something true, which is what it always said.
            <p className="mt-2 text-body-small text-ink-faint">
              Melhores momentos no YouTube, por emissora.
            </p>
          )}

          {others.length > 0 && (
            <p className="mt-1 text-body-small text-ink-faint">
              Também por{" "}
              {others.map((video, index) => {
                const embed = embedFor(video);

                return (
                  <span key={video.url}>
                    {index > 0 && " · "}
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      // Only where there is a frame to swap in. A channel this
                      // refuses is an ordinary link-out, and saying so in the
                      // suffix below is what keeps the two apart for a reader
                      // who cannot see which one moved.
                      aria-controls={embed ? frameId : undefined}
                      onClick={
                        embed
                          ? (event) => {
                              // Modified clicks are the browser's, exactly as
                              // in `MatchList` and `ClubView`: this is a link
                              // first.
                              if (
                                event.metaKey ||
                                event.ctrlKey ||
                                event.shiftKey ||
                                event.altKey ||
                                event.button !== 0
                              )
                                return;
                              event.preventDefault();
                              setPicked(video.url);
                            }
                          : undefined
                      }
                      className={LINK_UNDERLINE}
                    >
                      {video.channel}
                      <span className="sr-only">
                        {embed
                          ? " — trocar o vídeo aqui na página"
                          : " — melhores momentos no YouTube (abre em nova aba)"}
                      </span>
                    </a>
                  </span>
                );
              })}
              .
            </p>
          )}
        </>
      ) : (
        <>
          <a
            href={searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={controlClasses("md", "inline-flex items-center gap-2")}
          >
            <span aria-hidden="true">▶</span>
            Procurar melhores momentos no YouTube
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
          {/* Honest about what this is: without a curated link we do not
              know the official video, so this opens a search and says so. */}
          <p className="mt-2 text-body-small text-ink-faint">
            Abre uma busca no YouTube — não é um vídeo oficial escolhido por nós.
          </p>
        </>
      )}
    </section>
  );
}

/**
 * The address the frame takes for one package, or null where there is no frame
 * to draw.
 *
 * Two independent refusals, and they fail the same safe way — the channel
 * stays a link to YouTube:
 *
 * - **`playsInPage`**, for a channel YouTube will not play in an embed at all.
 *   A player that resolves to *"This video is unavailable"* is worse than the
 *   link it replaced, which is the one way this change could make the section
 *   harder to use rather than easier.
 * - **`videoEmbedUrl`**, for a curated line `isHighlightUrl` accepts and
 *   `youtubeVideoId` cannot reduce to an id.
 */
const embedFor = (video: Highlight): string | null =>
  playsInPage(video) ? videoEmbedUrl(video.url) : null;
