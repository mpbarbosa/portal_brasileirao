import { useState } from "react";

import {
  videoPressedEmbedUrl,
  videoThumbnailHdUrl,
  videoThumbnailUrl,
  videoWatchUrl,
} from "@/club-core";
import { FOCUS_RING, LINK_UNDERLINE } from "@/src/components/interaction";
import { isPlainClick } from "@/src/components/plainClick";
import type { ClubVideo } from "@/src/types";

/**
 * The **Vídeos do clube** rail: curated videos about one club, each a
 * thumbnail — and each one **plays where it sits** once the reader presses it.
 *
 * **This reverses the refusal this component was built on, and the argument it
 * reverses had already expired.** The comment here used to say an iframe would
 * be "the first third-party **script** this app has ever shipped" — true when
 * it was written and false since `eb53d77`, which put YouTube's player on the
 * Partida page for the melhores momentos.
 *
 * **What replaces it is a facade, not `MatchHighlights`' always-mounted frame,
 * and the reason is that this page is not that page.** `CONTEXT.md` has drawn
 * that line for three entries now: the Partida page is where the video *is the
 * errand*, so a frame that renders with the section is charged to a reader who
 * came for it. A club page is where a video is **one of a dozen things
 * offered**, so the same frame would be charged to every reader who came for
 * the campanha, the artilheiros or the next fixture. The distinction is the
 * one those entries already make; only the mechanism is new.
 *
 * Three things follow, and each is strictly better than the always-mounted
 * frame on this page rather than a compromise with it:
 *
 * - **Nothing is requested from YouTube until a card is pressed.** Not a
 *   frame, not a cookie, not a script. The `<img>` was always hotlinked from
 *   `img.youtube.com` and still is; what is new is that this page can now play
 *   a video without ever having asked the player for anything.
 * - **The press count is unchanged at one.** An always-mounted frame carries
 *   no `autoplay`, so a reader presses YouTube's own play button; here they
 *   press the card and `videoPressedEmbedUrl` starts it. One gesture either
 *   way, and the video still never starts on a page load — which is the whole
 *   of `CONTEXT.md`'s **Hino do clube** objection.
 * - **The section does not change height, and that is measured rather than
 *   hoped.** The player replaces the thumbnail *inside the card's own
 *   `aspect-video` box*, so the box is the same box. An always-mounted 736px
 *   frame put this section's bottom at **1619px** against `screenshot.ts`'
 *   `MAX_HEIGHT` of **1170** — so `cropHeight` would have fallen back to
 *   Artilheiros and `clube-palmeiras-{light,dark}` would have lost the section
 *   entirely, which is exactly the #418 failure that raising the ceiling to
 *   1170 was meant to repair. That ceiling cannot absorb it: its measured safe
 *   band is [1146, 1189], bounded above by the estádio page.
 *
 * **One video plays at a time, and the state is the id rather than a flag per
 * card.** Two players on one page is two things able to play at once, which is
 * the **Melhores momentos** entry's own refusal; pressing a second card
 * therefore unmounts the first. It is a single value for the same reason
 * `MatchHighlights` keeps one: a flag per card is a way for two to be true.
 *
 * **The cards are still real `<a href>`s and a modified click still leaves.**
 * Ctrl, cmd, shift, alt and the middle button are the browser's, exactly as in
 * `MatchList`, `ClubView` and `MatchHighlights`: this is a link first, and
 * "open in new tab" has to keep working.
 *
 * **The badge is YouTube's red disc only while the card is a link out.** That
 * disc names the *host*, and it earned that when every press left for YouTube.
 * A card that plays in place does not go there, so once the player is mounted
 * there is no disc to name anything — and until it is pressed the disc is
 * still telling the truth about the one thing that press could also do.
 *
 * **A video that will not embed keeps the plain link-out.**
 * `videoPressedEmbedUrl` returns null for anything `youtubeVideoId` cannot
 * reduce to an id, and such a card simply never becomes a player — the
 * degradation `videoThumbnailUrl` and `hymnUrl` already take.
 *
 * A **horizontal rail** rather than a wrapping grid, because the count is
 * curated and small and a rail says "there may be more to the right" while a
 * one-row grid says "this is all of it". It scrolls inside its own container,
 * so the page body never scrolls sideways.
 *
 * **The card is the column, the size `MatchHighlights` draws its frame at.**
 * It was a flat `w-44` — 176px of card in a 736px content column — and then
 * `w-full` under a 26rem cap, which still drew a video at a little over half
 * the width the Partida page plays one at. Two video sections at two sizes read
 * as two kinds of thing, so the cap went. **`w-full` on a flex item resolves
 * against the rail's visible width**, so each card is exactly one column wide
 * at every viewport and the rail scrolls one video at a time, snapping to each.
 *
 * **What that costs is the club page's screenshot crop, and it was accepted
 * rather than missed.** A 736px card is about 180px taller than a 416px one,
 * which moves this section's bottom past `screenshot.ts`' `MAX_HEIGHT` — so the
 * next re-shoot of `clube-palmeiras-{light,dark}` crops above it, the #418
 * failure that comment records. Raising the ceiling is bounded by the estádio
 * page, so the fix there is a decision about the capture, not about this card.
 *
 * Renders **nothing** — not an empty heading — for a club with no entries.
 * `videosFor` has already dropped anything whose id will not parse, so this
 * component is handed a list it can draw in full.
 */
export function ClubVideos({ videos, clubName }: { videos: ClubVideo[]; clubName: string }) {
  /**
   * Which video is playing, keyed by id, and `null` for "none yet" — which is
   * the state every reader arrives in and most leave in.
   *
   * **It is never seeded**, for the reason `MatchHighlights` gives and one of
   * its own: a `useState` initialiser runs once, and the same id appears under
   * more than one club — the comparação sits under Palmeiras and Flamengo both
   * — so a reader moving between two club pages would otherwise carry a
   * mounted player into a list that may not contain it.
   */
  const [playing, setPlaying] = useState<string | null>(null);

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

          const embed = videoPressedEmbedUrl(video.id);
          const isPlaying = embed !== null && playing === video.id;

          return (
            <li key={video.id} className="w-full shrink-0 snap-start">
              {isPlaying ? (
                /* **The player, in the box the thumbnail was in.** Same
                   `aspect-video`, same radius, same border — which is what
                   makes the swap cost the section no height at all, and the
                   whole reason this shape was chosen over a frame above the
                   rail. `overflow-hidden` is what makes the radius reach the
                   player, which paints to its own edges. */
                <div
                  data-club-video-frame={video.id}
                  className="relative block aspect-video overflow-hidden rounded-x-small border border-outline-variant bg-surface-container-lowest"
                >
                  <iframe
                    src={embed}
                    title={`${video.title} — ${video.channel}`}
                    // Each of these is refused by default in a frame and each
                    // is something a player is expected to be able to do.
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    // The default would send the full club URL to YouTube with
                    // every request. Same reasoning as the crests' own policy.
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
              ) : (
                <a
                  href={watch}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-club-video={video.id}
                  onClick={
                    embed
                      ? (event) => {
                          // Modified clicks are the browser's, exactly as in
                          // `MatchList` and `MatchHighlights`: this is a link
                          // first.
                          if (!isPlainClick(event)) return;
                          event.preventDefault();
                          setPlaying(video.id);
                        }
                      : undefined
                  }
                  // The clamp below cuts a long title visually; this is how a
                  // sighted reader still reaches the whole of it.
                  title={video.title}
                  className={`group block rounded-x-small ${FOCUS_RING}`}
                >
                  {/* 16:9, the shape a YouTube video is delivered in. The frame
                      is that shape whichever thumbnail lands inside it:
                      `maxresdefault` is native 16:9 and fills it exactly, while
                      the `hqdefault` fallback is 4:3 with the picture
                      letterboxed, so `object-cover` crops the bars away rather
                      than drawing two black bands under a card that has none.
                      It is also the box the player takes over, so these classes
                      and the `div`'s above are one shape written twice and must
                      stay that way. */}
                  <span className="relative block aspect-video overflow-hidden rounded-x-small border border-outline-variant bg-surface-container">
                    <VideoThumbnail id={video.id} fallback={thumb} />
                    {/* The badge, and the veil under it. Both are
                        `aria-hidden`: the link's text below already names the
                        video and the suffix already says what pressing it does,
                        so an announced mark would say it a third time.

                        **The disc is 11.5% of the card, never below 48px, and
                        the proportion was read off the picture rather than
                        derived.** It was 36 — right when the card was 176 wide,
                        where it filled a fifth of it, and adrift once the card
                        became 416, where it filled a twelfth. Four sizes were
                        drawn over the real thumbnail at 416 and looked at: 36
                        reads as small, 56 covers the campanha's own line — it
                        is a drawing under there, not a photograph, so a badge
                        that overlaps it hides the thing the video is about —
                        and 48 sat in the gap between the wordmark and the
                        chart, which is 11.5% of that card.

                        **A percentage rather than a fixed size or a `sm:`
                        pair**, because the card now tracks the viewport all the
                        way to the column: a fixed 48 is 6.5% of a 736 card, and
                        any breakpoint pair is wrong at every width between its
                        two steps. The thumbnail scales uniformly with the card,
                        so the gap the disc sits in scales with it — 11.5% keeps
                        the measured picture at every width, and `min-w-12`
                        holds the 48px floor on a phone, where it is about 14%.
                        `aspect-square` rather than a height, because a
                        percentage height would resolve against the veil's
                        16:9 height and draw an oval.

                        **The veil does not change on hover, and that is the
                        token gate's doing rather than a preference.**
                        Lightening it was the first draft and
                        `design-tokens-core.test.ts` refused it as a
                        hand-written state — correctly: a state colour belongs
                        in `interaction.ts`, and this is not `STATE_LAYER` (an
                        8% veil of `on-surface` over a container) but a constant
                        scrim over artwork, which is a different idea that
                        happens to look like one. Hover is carried by the badge
                        growing and the title gaining its underline, which is
                        two signals on the thing being pointed at. */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 flex items-center justify-center bg-scrim/25"
                    >
                      <span className="flex aspect-square w-[11.5%] min-w-12 items-center justify-center rounded-full bg-[#ff0000] transition group-hover:scale-110">
                        {/* YouTube's own red is a brand colour and deliberately
                            not a token: it is not this app's palette speaking,
                            and putting it in `index.css` would offer it to
                            components that have no business with it — the
                            argument `BroadcasterMark` already makes about
                            `plate`. It sits on artwork rather than on a themed
                            surface, so no contrast pairing changes with the
                            theme.

                            **It survives the facade because it is still true.**
                            A press plays the video here, and a *modified* press
                            still opens it on YouTube — so the mark names a
                            thing this control genuinely does, which is the test
                            the **Melhores momentos** entry applies to a
                            broadcaster's mark standing in for a name. Once the
                            player is mounted there is no disc at all, because
                            then there is nothing left that leaves. */}
                        {/* The glyph scales with the disc for the disc's own
                            reason — 20px in a 48px disc is 42%. `h-auto` lets the
                            viewBox square it, since a percentage height would
                            have nothing definite to resolve against. */}
                        <svg viewBox="0 0 24 24" className="h-auto w-[42%] translate-x-px fill-white">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </span>
                    </span>
                  </span>

                  {/* Three lines and then an ellipsis. A curated title is
                      written by the uploader and can run to a paragraph;
                      letting it push the card taller would leave a rail of
                      cards at four different heights.

                      **Three rather than two, and that was read off the page
                      rather than picked.** At two, the seed entry rendered
                      *"Palmeiras × Flamengo: a campanha rodada a rodada d…"* —
                      it loses the season and the rodada, which is the half that
                      says *which* campanha this is, and the rail's whole promise
                      is telling one entry from the next.

                      Clamping is visual only — the full string stays in the
                      DOM, so a screen reader hears all of it and `title` gives
                      a sighted reader the same on hover.

                      **There is no `block` here and adding one silently
                      switches the clamp off**, which is what the first draft
                      did. `line-clamp-3` works by setting `display:
                      -webkit-box`, so a `block` beside it wins on stylesheet
                      order and leaves `-webkit-line-clamp: 3` set on an element
                      the property does not apply to. Nothing fails: the class
                      compiles, the rule matches, the element renders — it
                      simply does not clamp. Measured with `getComputedStyle` in
                      the page, which is what `CLAUDE.md` prescribes for this
                      whole family after the disclosure chevron that rotated
                      0deg through two spellings. */}
                  <span className="mt-1.5 line-clamp-3 text-body-small text-on-surface group-hover:underline">
                    {video.title}
                  </span>
                  {/* Whose video it is. Faint, because it is provenance rather
                      than the thing being offered — but present, because for
                      the entries here the answer is *ours*, and a reader is
                      owed that before they take it for a broadcaster's
                      package. */}
                  <span className="block text-body-small text-ink-faint">{video.channel}</span>
                  {/* What pressing it does, said once per link. The title and
                      the channel above are already the accessible name; this is
                      what turns it from a description of a video into a
                      description of an action — and it is the only thing that
                      tells a reader who cannot see the swap that a card which
                      plays here differs from one that leaves. */}
                  <span className="sr-only">
                    {embed ? " — tocar aqui na página" : " — no YouTube (abre em nova aba)"}
                  </span>
                </a>
              )}

              {isPlaying && (
                /* **The title stays, and it stays a link**, which is two jobs
                    in one line. It keeps the card's own caption where a reader
                    was already reading it, and it is the way out: a frame can
                    fail for reasons no list anticipates — a video pulled since
                    it was curated, an embed the uploader later disallowed, a
                    country it is not licensed in — and what YouTube draws then
                    is its own error card, with no way forward inside it. */
                <p className="mt-1.5 text-body-small">
                  <a
                    href={watch}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-club-video-out={video.id}
                    className={`line-clamp-3 text-on-surface ${LINK_UNDERLINE}`}
                  >
                    {video.title}
                    <span className="sr-only"> — no YouTube (abre em nova aba)</span>
                  </a>
                  <span className="block text-body-small text-ink-faint">{video.channel}</span>
                </p>
              )}
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
