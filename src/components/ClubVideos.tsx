import { useState } from "react";

import { videoThumbnailHdUrl, videoThumbnailUrl, videoWatchUrl } from "@/club-core";
import { FOCUS_RING } from "@/src/components/interaction";
import type { ClubVideo } from "@/src/types";

/**
 * The **Vídeos do clube** rail: curated videos about one club, each a
 * thumbnail that opens on YouTube.
 *
 * **It links out; it does not embed.** `CONTEXT.md`'s **Hino do clube** entry
 * already settled that for this page — "an embedded player on the club page (a
 * hymn that can start playing is a hymn nobody asked for)" — and everything in
 * that argument applies harder to a rail of several. An iframe per entry would
 * also be the first third-party **script** this app has ever shipped: the
 * broadcaster marks, the crests and the vendored photographs are all images,
 * and YouTube's player brings its own JavaScript, cookies and tracking with it.
 *
 * **The thumbnail is the whole affordance.** A row of titles is a list of
 * links; a row of thumbnails is recognisably video, and the play badge says so
 * without a word of copy. The mark is YouTube's red disc rather than one of
 * this app's monochrome outlines, and that is the one place in the app where
 * naming the *host* is right: everywhere else — the hymn's quavers, the sede's
 * pin — the link's own words name the thing and the platform is incidental,
 * where here the reader is being told, before they click, that this leaves for
 * YouTube.
 *
 * A **horizontal rail** rather than a wrapping grid, because the count is
 * curated and small and a rail says "there may be more to the right" while a
 * one-row grid says "this is all of it". It scrolls inside its own container,
 * so the page body never scrolls sideways.
 *
 * **The card is `w-full` under a 26rem cap, and both halves were measured
 * rather than picked.** It was a flat `w-44` — 176px of card in a 736px content
 * column (`max-w-3xl` less `px-4` in `App`), so the thumbnail drew 176×99 and
 * the one thing the rail is offering was the smallest thing on the page.
 *
 * The **cap** is what keeps that a widening rather than a redesign. Uncapped at
 * the full 736 the thumbnail is 414px tall and the card grows by about 320px,
 * which on the Painel is enough to push a section out of the 1080px screenshot
 * crop — the eviction `CLAUDE.md` records for the Partida and estádio captures,
 * arrived at from the other direction. At 26rem the card is 416px and the
 * growth is about 135, which is a bigger picture and the same page.
 *
 * **What the cap does NOT save is the club page's capture, and that was
 * measured on both sides rather than predicted.** `clube-palmeiras-{light,dark}`
 * ends *on this section*: at the old `w-44` the card's bottom sits at 1072.5px
 * against `screenshot.ts`' 1080 ceiling — **7.5px of headroom** — so the crop
 * took the rail as the last thing that fits. At any width worth having it does
 * not fit, `cropHeight` falls back to the section above, and the whole rail
 * leaves the frame. There is no cap that keeps it: 176.5px of card is the
 * budget, which is a 189px card, which is the width it already had. So the two
 * captures shorten and their README captions lose a sentence — a re-shoot, and
 * never a `Screenshots-unaffected:` trailer.
 *
 * The Painel is untouched by that: its own rail sits **2077px** below its crop,
 * as `3565b70`'s trailer measured when the section landed there.
 *
 * The **`w-full`** is what makes it responsive rather than a second fixed
 * number. Percentages on a flex item resolve against the container's *visible*
 * width and not its scroll width, so on a 360dp phone the card is the column —
 * 328px, a card a thumb can actually aim at — and the cap simply never binds.
 * A `sm:`-prefixed pair of widths would say the same thing in two places and
 * be wrong at every width between them.
 *
 * Renders **nothing** — not an empty heading — for a club with no entries,
 * which is 18 of 20 today. `videosFor` has already dropped anything whose id
 * will not parse, so this component is handed a list it can draw in full.
 */
export function ClubVideos({ videos, clubName }: { videos: ClubVideo[]; clubName: string }) {
  if (videos.length === 0) return null;

  return (
    <section className="mt-6">
      <h3 className="mb-2 text-body-medium font-medium text-ink-muted">Vídeos do clube</h3>

      {/* The list names the **group** — whose videos these are — and each
          anchor names its own destination below. That split is deliberate and
          the first draft had it wrong, putting "abrem em nova aba" here alone:
          a list label is announced on *entering* the list, so a reader who
          tabbed straight to the third card from elsewhere on the page would
          never have heard it. `ClubLinks`' rule is that the suffix travels with
          the anchor, and it is one of the three things that drift when a link
          is copied. */}
      <ul
        aria-label={`Vídeos sobre ${clubName}`}
        className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1"
      >
        {videos.map((video) => {
          const watch = videoWatchUrl(video.id);
          const thumb = videoThumbnailUrl(video.id);
          // `videosFor` guarantees both, but the component is pure and a caller
          // may hand it a list that never passed through one — the rule
          // `MatchPage` keeps its own `played` gate under.
          if (!watch || !thumb) return null;

          return (
            <li key={video.id} className="w-full max-w-[26rem] shrink-0 snap-start">
              <a
                href={watch}
                target="_blank"
                rel="noopener noreferrer"
                data-club-video={video.id}
                // The clamp below cuts a long title visually; this is how a
                // sighted reader still reaches the whole of it.
                title={video.title}
                className={`group block rounded-x-small ${FOCUS_RING}`}
              >
                {/* 16:9, the shape a YouTube video is delivered in. The frame
                    is that shape whichever thumbnail lands inside it:
                    `maxresdefault` is native 16:9 and fills it exactly, while
                    the `hqdefault` fallback is 4:3 with the picture letterboxed,
                    so `object-cover` crops the bars away rather than drawing two
                    black bands under a card that has none. */}
                <span className="relative block aspect-video overflow-hidden rounded-x-small border border-outline-variant bg-surface-container">
                  <VideoThumbnail id={video.id} fallback={thumb} />
                  {/* The badge, and the veil under it. Both are `aria-hidden`:
                      the link's text below already names the video and the
                      list's label already says where it goes, so an announced
                      mark would read the destination a third time.

                      **The disc is 48px and that was read off the picture
                      rather than derived.** It was 36 — right when the card was
                      176 wide, where it filled a fifth of it, and adrift once
                      the card became 416, where it filled a twelfth. Four
                      sizes were drawn over the real thumbnail and looked at:
                      36 reads as small, 56 covers the campanha's own line — it
                      is a drawing under there, not a photograph, so a badge
                      that overlaps it hides the thing the video is about — and
                      48 sits in the gap between the wordmark and the chart at
                      both widths, 11.5% of the desktop card and 14.6% of the
                      phone's.

                      **It is deliberately one size rather than a `sm:` pair.**
                      The card reaches its 26rem cap at a viewport of about 448
                      and the `sm` breakpoint is 640, so a responsive pair would
                      draw the small badge on a card already at full width for
                      almost 200px of viewport — the "wrong at every width
                      between them" the card's own width note refuses.

                      **The veil does not change on hover, and that is the token
                      gate's doing rather than a preference.** Lightening it was
                      the first draft and `design-tokens-core.test.ts` refused
                      it as a hand-written state — correctly: a state colour
                      belongs in `interaction.ts`, and this is not `STATE_LAYER`
                      (an 8% veil of `on-surface` over a container) but a
                      constant scrim over artwork, which is a different idea
                      that happens to look like one. Hover is carried by the
                      badge growing and the title gaining its underline, which
                      is two signals on the thing being pointed at. */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center justify-center bg-scrim/25"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ff0000] transition group-hover:scale-110">
                      {/* YouTube's own red is a brand colour and deliberately
                          not a token: it is not this app's palette speaking,
                          and putting it in `index.css` would offer it to
                          components that have no business with it — the
                          argument `BroadcasterMark` already makes about
                          `plate`. It sits on artwork rather than on a themed
                          surface, so no contrast pairing changes with the
                          theme. */}
                      <svg viewBox="0 0 24 24" className="h-5 w-5 translate-x-px fill-white">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </span>
                </span>

                {/* Three lines and then an ellipsis. A curated title is written
                    by the uploader and can run to a paragraph; letting it push
                    the card taller would leave a rail of cards at four
                    different heights.

                    **Three rather than two, and that was read off the page
                    rather than picked.** At two, the seed entry rendered
                    *"Palmeiras × Flamengo: a campanha rodada a rodada d…"* — it
                    loses the season and the rodada, which is the half that says
                    *which* campanha this is, and the rail's whole promise is
                    telling one entry from the next. A title is the only thing
                    doing that here, so the clamp has to fall past the part that
                    distinguishes rather than before it. The bound still exists;
                    it is set where a real title needed it.

                    Clamping is visual only — the full string stays in the DOM,
                    so a screen reader hears all of it and `title` gives a
                    sighted reader the same on hover.

                    **There is no `block` here and adding one silently switches
                    the clamp off**, which is what the first draft did.
                    `line-clamp-2` works by setting `display: -webkit-box`, so a
                    `block` beside it wins on stylesheet order and leaves
                    `-webkit-line-clamp: 2` set on an element the property does
                    not apply to. Nothing fails: the class compiles, the rule
                    matches, the element renders — it simply does not clamp, and
                    a three-line title was drawn under a two-line promise.
                    Measured with `getComputedStyle` in the page, which is what
                    `CLAUDE.md` prescribes for this whole family after the
                    disclosure chevron that rotated 0deg through two spellings. */}
                <span className="mt-1.5 line-clamp-3 text-body-small text-on-surface group-hover:underline">
                  {video.title}
                </span>
                {/* Whose video it is. Faint, because it is provenance rather
                    than the thing being offered — but present, because for the
                    entries here the answer is *ours*, and a reader is owed that
                    before they take it for a broadcaster's package. */}
                <span className="block text-body-small text-ink-faint">{video.channel}</span>
                {/* Where the link goes, said once per link. The title and the
                    channel above are already the accessible name; this is what
                    turns it from a description of a video into a description of
                    a destination. */}
                <span className="sr-only"> — no YouTube (abre em nova aba)</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The picture itself: `maxresdefault` where the platform has one, `hqdefault`
 * where it does not.
 *
 * **It is its own component because it holds state, and the parent must not.**
 * `ClubVideos` renders a list, so a hook there would have to be a hook per
 * entry — which React forbids inside `map` — and the alternative of one shared
 * flag would make a single missing thumbnail downgrade every card in the rail.
 * One component per card is the ordinary answer and it keeps the failure where
 * the failure is.
 *
 * **The state is the `src` that failed, not a boolean**, which is
 * `ClubCrest`'s reasoning and holds here for the same mechanical reason: these
 * are reconciled by position in a list, so a boolean would latch and a card
 * that re-renders for a *different* video would serve the fallback for a video
 * whose HD thumbnail is fine. The same id repeats across clubs — the Palmeiras
 * × Flamengo comparação is one entry under two codes — so this is not
 * hypothetical the moment a reader moves between two club pages.
 *
 * **Nothing here is a loading state and there deliberately is none.** A 404
 * from the CDN swaps one address for another, both of which are pictures of
 * the same video; a spinner would be announcing a repair the reader has no
 * stake in. The frame keeps its `bg-surface-container` throughout, so what
 * shows while either request is in flight is the card, not a hole.
 */
function VideoThumbnail({ id, fallback }: { id: string; fallback: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const hd = videoThumbnailHdUrl(id);
  const src = hd && failedSrc !== hd ? hd : fallback;

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      // Only the HD address is ever retried away from. `fallback` is
      // `hqdefault`, which YouTube generates for every video — if *that* 404s
      // the video is gone, and there is no third size to reach for, so the
      // handler recording its failure would only re-render the same broken
      // image. The comparison above is what makes this idempotent rather than
      // a loop.
      onError={() => setFailedSrc(src)}
      className="h-full w-full object-cover"
    />
  );
}
