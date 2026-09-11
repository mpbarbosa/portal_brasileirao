import type { ComponentPropsWithoutRef, ReactNode } from "react";

type ExternalLinkProps = Omit<ComponentPropsWithoutRef<"a">, "target" | "rel" | "children"> & {
  href: string;
  /**
   * What the destination is, for a screen reader — "verbete do clube",
   * "no YouTube". Omit where the visible words already say it, and the reader
   * hears only that the link opens a new tab.
   */
  suffix?: string;
  children: ReactNode;
};

/**
 * A link that leaves this app, in a new tab.
 *
 * The contract is the part of an anchor nobody sees: `target="_blank"`,
 * `rel="noopener noreferrer"` and a screen-reader suffix saying a tab will open.
 * `ClubLinks` extracted that for two links and argued it in its header — a copy
 * missing `rel="noopener"` is a real defect that looks identical on the page —
 * and meanwhile the same three were written by hand in a dozen other places,
 * as five small link components and a scatter of raw anchors. Every copy happened
 * to be right; nothing made the next one so.
 *
 * Only the contract lives here. The mark, the words and the classes are the
 * caller's, because a thumbnail, a pill and an underlined word are all external
 * links and share nothing else.
 *
 * **A facade is not one of these, and that is why three anchors still write
 * `target` by hand.** The video cards in `ClubVideos`, the "Também por" row in
 * `MatchHighlights` and the post cards in `PlayerPosts` are links for a modified
 * click and play in place for a plain one, so what they announce depends on
 * which: "tocar aqui na página" is true of them and "abre em nova aba" is not.
 * Forcing them through this would put a false sentence in a screen reader's
 * ear, which is worse than an anchor written out.
 */
export function ExternalLink({ suffix, children, ...anchor }: ExternalLinkProps) {
  return (
    <a {...anchor} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only">
        {suffix ? ` — ${suffix} (abre em nova aba)` : " (abre em nova aba)"}
      </span>
    </a>
  );
}
