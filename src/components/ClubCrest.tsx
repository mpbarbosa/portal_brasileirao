import { useState } from "react";

import { crestMonogram } from "@/club-core";
import { BrandMark } from "@/src/components/BrandMark";
import type { Club } from "@/src/types";

interface ClubCrestProps {
  club: Club;
  /** Rendered pixel size; the source PNGs are small, so keep this modest. */
  size?: number;
  /**
   * What stands in when there is no crest.
   *
   * `"monogram"` everywhere by default. `"mark"` is for the two places that
   * render a crest big enough to read a picture in — the club page at 44px and
   * the match page at 56px — and the reasoning is in the component comment
   * below. It is an explicit prop rather than a size threshold because the
   * threshold would silently recruit call sites nobody looked at: `LiveView` is
   * 40px and sits four pixels under any line you would draw.
   */
  fallback?: "monogram" | "mark";
}

/**
 * The monogram's type size as a share of the box.
 *
 * Checked against the rendered mark at every size this component is asked for,
 * with the CDN failing: 18px in the classificação, 20 in the Meu time strip, 24
 * on Jogadores, 40 on Ao vivo, 44 on the club page, 56 on the match page — so
 * 8px through 24px of type. **18 is the size that decides it**, and it is also
 * the one that matters most: twenty of them, all at once, is what a CDN outage
 * looks like. Three letters sit inside the disc there with a little room; a
 * larger share starts pushing them against its edge, which reads worse than the
 * smaller type does.
 *
 * It is a ratio rather than a step off the type scale because this is not type
 * in a text flow: it is a mark that must fit a box whose size the caller
 * chooses, and the scale has no step that follows a prop. That is the same
 * reason `RankSparkline` carries its own geometry.
 */
const MONOGRAM_SCALE = 0.42;

/**
 * The mark's size as a share of the box, and it is larger than the monogram's
 * for a reason that is not taste: three letters are a wide, short block that
 * fills a disc at 0.42, while the mark is a tall narrow arch that would sit in
 * the middle of one looking dropped. 0.6 puts its cap and foot about where the
 * letters' do.
 */
const MARK_SCALE = 0.6;

/**
 * A club's crest, its letters, or nothing at all.
 *
 * Decorative by design: every crest sits beside the club's name in text, so
 * announcing it again would just make a screen reader say the club twice. Hence
 * `alt=""` rather than a description — and hence `aria-hidden` on the monogram
 * too, which would otherwise read out three letters the name beside it has
 * already spelled.
 *
 * Crests come from the data provider's CDN as transparent PNGs, which is why
 * they sit correctly on a dark background. Lazy and async so a 20-row table
 * does not block paint on twenty image requests.
 *
 * **`referrerPolicy="no-referrer"`, because crests are the one asset class this
 * app still hotlinks.** Stadium and player photographs are vendored to our own
 * origin precisely so a reader's browsing does not reach a third party; a crest
 * request carrying a `Referer` tells the provider's CDN which page of this site
 * the reader is on, twenty times per render of the classificação. The header is
 * not needed for the image to load and nothing here reads it back.
 *
 * **The fallback is a monogram, and it exists because a CDN failure used to
 * mean twenty broken images.** There was no error path at all: `onError` did
 * not fire into anything, so the browser drew its own missing-image glyph in
 * every row. A monogram holds the slot instead. It carries no information —
 * the club's name is beside it either way — so its whole job is to not look
 * broken, which is why it takes no club colour (see the proposal's rejection 5)
 * and no border treatment that a crest does not have.
 *
 * **The club and match pages take the MARK instead of letters, and it is drawn
 * in `ink-muted` rather than in `primary`.** That colour is the whole of what
 * makes this safe. The mark is the *site's*, and a site badge sitting where a
 * club's crest belongs, in brand green, beside the word "Palmeiras", reads as a
 * claim that this is the club's badge — the twenty-first-club problem
 * `BrandMark`'s own comment gives as the reason the mark is not a crest shape.
 * Rendered at `ink-muted` inside the same disc the monogram uses, it reads as
 * what it is: the slot, held, by this site. Only the glyph changes; the chrome
 * is identical, so nothing about the surrounding layout moves.
 *
 * **It also renders where the monogram cannot.** `crestMonogram` returns `""`
 * for a club with neither a `tla` nor a usable short name, and this component
 * then draws *nothing at all* — a 56px hole beside the scoreline on the match
 * page. The mark does not depend on the club's name, so the `"mark"` branch
 * always has something to draw. That is the case worth having it for, and it is
 * why the branch sits above the monogram's own empty check rather than after it.
 *
 * Two call sites take it — `ClubView` at 44px and `MatchPage` at 56px — because
 * those are the sizes a picture is legible at. The 18px crest in a
 * classificação row keeps its letters: the arch and its three bars were checked
 * at 16px while the mark was being designed, and they are mush there, where
 * "PAL" still reads.
 *
 * **`ink-muted` on `surface-container` is chosen because the contrast gate
 * measures that pair**, not because it is the quietest available.
 * `backgroundsFor` in `scripts/generate-md3-tokens.ts` stops at
 * `surface-container`: `-high` and `-highest` are emitted, sit one and two
 * steps further from the ink, and are checked against **nothing**. Letters a
 * reader has to read on an unmeasured pairing is the trap that gate's own
 * comment describes, caught one step before it springs. Widening the gate is
 * the other way to reach `-high`, and that is a generator change rather than
 * this item.
 */
export function ClubCrest({ club, size = 20, fallback = "monogram" }: ClubCrestProps) {
  /**
   * The `src` that failed, not a boolean.
   *
   * A boolean would latch: this component is reconciled by its position in a
   * list, so a row that re-renders for a different club — or the same club once
   * the provider starts answering again — would keep rendering letters against
   * a crest that now loads. Comparing the recorded address to the current one
   * makes recovery free and costs nothing extra.
   */
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!club.crest || failedSrc === club.crest) {
    if (fallback === "mark") {
      return (
        <span
          aria-hidden="true"
          data-crest-fallback="mark"
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-container text-ink-muted"
          style={{ width: size, height: size }}
        >
          <BrandMark
            className="shrink-0"
            style={{ width: Math.round(size * MARK_SCALE), height: Math.round(size * MARK_SCALE) }}
          />
        </span>
      );
    }

    const monogram = crestMonogram(club);
    // Neither a crest nor a letter to stand in for one: render nothing, which
    // is exactly what this component did for a crestless club before the
    // fallback existed. An empty box would be a mark meaning nothing.
    if (!monogram) return null;

    return (
      <span
        aria-hidden="true"
        data-crest-fallback="monogram"
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-container font-semibold leading-none text-ink-muted"
        style={{
          width: size,
          height: size,
          fontSize: Math.round(size * MONOGRAM_SCALE),
        }}
      >
        {monogram}
      </span>
    );
  }

  return (
    <img
      src={club.crest}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(club.crest ?? null)}
      className="inline-block shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}
