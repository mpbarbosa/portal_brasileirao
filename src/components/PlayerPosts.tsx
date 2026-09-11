import { useEffect, useRef, useState } from "react";

import { instagramPostEmbedUrl, instagramPostUrl } from "@/club-core";
import { InstagramGlyph } from "@/src/components/ClubLinks";
import { FOCUS_RING, LINK_UNDERLINE, STATE_LAYER } from "@/src/components/interaction";
import { isPlainClick } from "@/src/components/plainClick";
import type { PlayerPost } from "@/src/types";

/**
 * The height a frame takes before Instagram has said what it needs.
 *
 * Measured rather than picked: the seed post's `/embed/captioned/` page reports
 * **818** at every width from 280 to 400, and a single-image post with a short
 * caption sits a little under that. It is the opening guess for one paint and
 * nothing rests on it — see `PostFrame` for what replaces it and why the frame
 * is allowed to scroll until it does.
 */
const OPENING_HEIGHT = 620;

/**
 * One mounted Instagram post, sized by the post's own report.
 *
 * **The height cannot be computed here and cannot be left fixed**, which is what
 * makes this component more than an `<iframe>`. A post is 1:1, 4:5 or 1.91:1,
 * it may be a carrossel or a 9:16 reel, and `captioned` adds a caption of
 * unbounded length —
 * so a constant either clips the picture or leaves a band of dead white under
 * it. Instagram's embed page answers the question itself: it posts a `MEASURE`
 * message carrying its content height, which is how its own `embed.js` sizes
 * the frame it builds.
 *
 * **Which endpoint is asked matters, and it is the whole of why
 * `instagramPostEmbedUrl` says `captioned`.** Measured on the seed post at four
 * widths: `/embed/` reports **226** against a true content height of **684**, so
 * a frame that believes it shows a header and a sliver of the picture;
 * `/embed/captioned/` reports **818** and fits to the pixel, verified by
 * rendering it at exactly that height against a coloured ground. The message is
 * sent **once** per frame, not on a stream, so there is no later correction to
 * wait for.
 *
 * Two guards on that message, and they are not interchangeable. The origin is
 * matched on its **hostname** — `endsWith("instagram.com")` would accept
 * `https://evilinstagram.com` — and the source must be this frame's own
 * `contentWindow`, because a card may in principle hold more than one and a
 * page certainly holds other frames.
 *
 * **Instagram's own header truncates at the width this card can give, and that
 * is accepted rather than worked around.** Measured: the frame gets **446px**
 * inside the card — 512 of `max-w-lg`, less the body's `px-5`, less the
 * dialog's scrollbar — and at that width the embed clips its own *View profile*
 * button, where the identical post at **472** renders the header whole. The
 * threshold is content-dependent rather than fixed: this post is a
 * **collaboration**, so its header carries two handles, and Instagram already
 * ellipsises the second before it runs out of room.
 *
 * Full-bleeding the frame with `-mx-5` buys 40px and reaches 486, which clears
 * it for *this* post and not for one with a longer pair of handles — and it
 * costs the frame's border and radius running into the card's own. So the
 * picture, the caption and the credit all render in full, one third-party
 * control is cut, and the destination that control offers is already on this
 * card twice: the `@handle` under **Onde acompanhar** and the *Abrir no
 * Instagram* link directly below the frame. Widening the dialog for it would be
 * a change to every player card.
 *
 * **`scrolling` is deliberately not set to `no`.** Between mount and the
 * message the frame is at `OPENING_HEIGHT` and the post is usually taller, so
 * the honest degradation for that window — and for the day Instagram changes
 * what it reports — is a scrollbar rather than a silently cropped photograph.
 * Once the height lands there is nothing to scroll.
 */
function PostFrame({ post }: { post: PlayerPost }) {
  const src = instagramPostEmbedUrl(post.code);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(OPENING_HEIGHT);

  useEffect(() => {
    if (!src) return;

    const onMessage = (event: MessageEvent) => {
      let host: string;
      try {
        host = new URL(event.origin).hostname;
      } catch {
        return;
      }
      if (!/(^|\.)instagram\.com$/.test(host)) return;
      if (event.source !== frameRef.current?.contentWindow) return;

      let payload: unknown;
      try {
        payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        // A non-JSON message from some other embed. Keep the opening height.
        return;
      }

      const measured = (payload as { type?: string; details?: { height?: unknown } } | null);
      if (measured?.type !== "MEASURE") return;
      const value = Number(measured.details?.height);
      if (Number.isFinite(value) && value > 0) setHeight(Math.ceil(value));
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [src]);

  if (!src) return null;

  return (
    <iframe
      ref={frameRef}
      src={src}
      data-post-frame={post.code}
      title={`Publicação de @${post.account} no Instagram`}
      // Refused by default in a frame, and what an embedded video needs.
      allow="encrypted-media"
      // The default would send the whole player-card URL to Meta on every
      // request. Same reasoning as the crests' own policy and `ClubVideos`'.
      referrerPolicy="strict-origin-when-cross-origin"
      // `bg-plate` rather than a surface token: the embed paints itself white in
      // both themes, so a dark container behind it is a dark flash before the
      // page inside loads and a dark hairline around it afterwards. `plate`
      // exists for exactly this — artwork whose own colours this app does not
      // control. `overflow-hidden` is what makes the radius reach the page
      // inside, which paints to its own edges.
      className="w-full overflow-hidden rounded-x-small border border-outline-variant bg-plate"
      style={{ height }}
    />
  );
}

/**
 * The **Publicações** section of the player card: curated Instagram posts, each
 * drawn by Instagram's own embed once a reader asks for it.
 *
 * **Nothing is requested from Meta until a card is pressed** — not a frame, not
 * a cookie, not a script. That is `ClubVideos`' facade and its argument carries
 * over unchanged: a player card is opened for a position, an age and a row of
 * links, so a reader who came for those must not be charged a third-party
 * request for a section they never looked at. It matters more here than there,
 * because the third party is Meta and the surface is a modal a reader opens
 * dozens of times while reading an elenco.
 *
 * **The facade carries the summary and cannot carry a thumbnail**, which is the
 * one way it differs from `ClubVideos`. That rail hotlinks `img.youtube.com`;
 * the equivalent here would be an image from `*.cdninstagram.com`, which is the
 * copy `src/data/player-photos.ts` refuses in as many words and which expires
 * besides. So the offer is made in words — written by hand from opening the
 * post — and the picture arrives only when it is asked for.
 *
 * **One post is mounted at a time**, keyed by code rather than by a flag per
 * card: two mounted frames is two things loading Meta at once, and a flag per
 * card is a way for two to be true. Pressing a second closes the first.
 *
 * **The facade is a real `<a href>` and a modified click still leaves.** Ctrl,
 * cmd, shift, alt and the middle button are the browser's, exactly as in
 * `MatchList`, `ClubVideos` and `MatchHighlights`: this is a link to the post
 * first, and "open in new tab" has to keep working.
 *
 * **A plain link sits under the mounted frame**, and it is not a duplicate of
 * the facade it replaced: a frame that fails to load — a blocked third party, a
 * post since deleted — leaves a reader looking at a white rectangle with no way
 * out, and this is the way out.
 *
 * Renders **nothing** for a player with no entries. `playerPosts` has already
 * dropped anything whose code will not parse, so this is handed a list it can
 * draw in full.
 */
export function PlayerPosts({ posts, playerName }: { posts: PlayerPost[]; playerName: string }) {
  /**
   * Which post is open, or `null` for none — the state every reader arrives in
   * and most leave in. Never seeded: the card is remounted per player and a
   * seeded frame would load Meta on open, which is the whole thing the facade
   * exists to avoid.
   */
  const [open, setOpen] = useState<string | null>(null);

  if (posts.length === 0) return null;

  return (
    <ul aria-label={`Publicações sobre ${playerName}`} className="space-y-3">
      {posts.map((post) => {
        const href = instagramPostUrl(post.code);
        // `playerPosts` guarantees this, but the component is pure and a caller
        // may hand it a list that never passed through one — the rule
        // `ClubVideos` keeps its own `watch`/`thumb` guard under.
        if (!href) return null;

        return (
          <li key={post.code}>
            {open === post.code ? (
              <div className="space-y-2">
                <PostFrame post={post} />
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex min-h-12 items-center text-body-small ${LINK_UNDERLINE}`}
                >
                  <InstagramGlyph />
                  Abrir no Instagram
                  <span className="sr-only"> — publicação de @{post.account} (abre em nova aba)</span>
                </a>
              </div>
            ) : (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                data-post-facade={post.code}
                onClick={(event) => {
                  if (!isPlainClick(event)) return;
                  event.preventDefault();
                  setOpen(post.code);
                }}
                className={`flex min-h-12 w-full items-center gap-3 rounded-small border border-outline-variant px-3 py-2.5 text-left ${STATE_LAYER} ${FOCUS_RING}`}
              >
                <InstagramGlyph />
                <span className="min-w-0 flex-1">
                  <span className="block text-body-medium">{post.summary}</span>
                  <span className="block truncate text-label-small text-ink-faint">
                    @{post.account} · no Instagram
                  </span>
                </span>
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
