/**
 * The external links a club carries, and the marks beside them.
 *
 * Extracted from `ClubView` when the Wikipédia link gained a second call site
 * on the match page. The rule the club view states — a glyph stays local while
 * it has one call site — is what puts this here the moment that stops being
 * true, and what keeps the other three glyphs where they are.
 *
 * The whole anchor moves, not just the mark. `target`, `rel` and the
 * screen-reader suffix are the parts that drift when a link is copied: a second
 * copy missing `rel="noopener"` is a real defect that looks identical on the
 * page, and one missing the suffix reads to a screen reader as a bare word.
 */
import { instagramHandle, instagramUrl, wikipediaUrl } from "@/club-core";
import { LINK_UNDERLINE } from "@/src/components/interaction";
import type { Club } from "@/src/types";

/**
 * Shared attributes for the marks beside a club's links. Monochrome outlines
 * taking `currentColor`, so they warm on hover with the text and need nothing
 * of their own in either theme.
 *
 * `inline-block` is load-bearing rather than incidental: text-decoration is not
 * drawn through an atomic inline box, so each link's underline stops at its
 * icon instead of running under it.
 *
 * `aria-hidden` because the text beside the mark already names the link and the
 * screen-reader suffix already says which kind it is — an announced icon would
 * read the destination twice.
 */
export const GLYPH = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
  className: "mr-1 inline-block h-[1em] w-[1em] align-[-0.125em]",
};

/** An open book: the club's article. Wikipedia's own mark is a *globe*, which
 *  would read as a second official site beside the one already there — and it
 *  is artwork with a fixed form rather than an outline that takes
 *  `currentColor`. */
export function WikipediaGlyph() {
  return (
    <svg {...GLYPH}>
      <path d="M12 7v13" />
      <path d="M12 7C10.5 5 8 4.5 4 4.5v13C8 17.5 10.5 18 12 20c1.5-2 4-2.5 8-2.5v-13c-4 0-6.5.5-8 2.5" />
    </svg>
  );
}

/**
 * The club's article on the Portuguese Wikipedia, or nothing when it has none —
 * an absent article renders as no link rather than a broken one.
 *
 * Reads as a name rather than an address, like the hymn: "Sociedade Esportiva
 * Palmeiras" is the club's full legal name, and nobody scanning a row of links
 * is looking for it. Here the name is the host, which is what a reader
 * recognises.
 *
 * `extra` is for the caller's own layout only. The club header sets its type
 * from the surrounding row; the match page sets a smaller step so the link does
 * not compete with the score.
 */
export function WikipediaLink({ club, extra = "" }: { club: Club; extra?: string }) {
  const href = wikipediaUrl(club.wikipedia);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`truncate ${LINK_UNDERLINE} ${extra}`}
    >
      <WikipediaGlyph />
      Wikipédia
      <span className="sr-only"> — verbete do clube (abre em nova aba)</span>
    </a>
  );
}

/** Instagram's own outline rather than Meta's gradient mark: artwork with a
 *  fixed form cannot take `currentColor`, so it would sit cold beside links
 *  that warm on hover, and would need a second copy for the light theme. */
export function InstagramGlyph() {
  return (
    <svg {...GLYPH}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * A profile on Instagram, or nothing when there is no handle — an absent
 * account renders as no link rather than one that lands on a 404.
 *
 * Left `ClubView` when the player card became its second caller, for the same
 * reason the Wikipédia link did: the parts that drift when an anchor is copied
 * are `target`, `rel` and the screen-reader suffix, not the mark.
 *
 * `subject` is what the suffix says the profile belongs to — "do clube", "do
 * jogador". It is a required argument rather than a default, because the one
 * thing a screen reader must not be told is that a player's account is the
 * club's.
 *
 * The printed `@handle` comes from `instagramHandle`, not from the raw stored
 * value, so the words on the page and the address behind them are the same
 * profile even if someone writes down a pasted URL.
 */
export function InstagramLink({
  handle,
  subject,
  extra = "",
}: {
  handle: string | undefined;
  subject: string;
  extra?: string;
}) {
  const href = instagramUrl(handle);
  const shown = instagramHandle(handle);
  if (!href || !shown) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`truncate ${LINK_UNDERLINE} ${extra}`}
    >
      <InstagramGlyph />
      @{shown}
      <span className="sr-only"> — Instagram {subject} (abre em nova aba)</span>
    </a>
  );
}
