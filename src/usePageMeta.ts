import { useEffect } from "react";

import { pageMeta, type MetaContext } from "@/page-meta-core";
import type { Route } from "@/route-core";
import { canonicalPath, pageStatus, subjectResolved } from "@/seo-core";

/** Upsert a `<meta>` by its identifying attribute, so a navigation never leaves
 *  the document carrying two of the same tag. */
const setMetaTag = (attr: "name" | "property", key: string, content: string): void => {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);

  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }

  tag.setAttribute("content", content);
};

/**
 * The origin the server canonicalised to.
 *
 * Read back off the tag the server wrote rather than taken from
 * `location.origin`, so a client-side navigation keeps emitting the deployed
 * `APP_URL` origin instead of whichever host the reader happened to reach —
 * which is the whole reason the canonical tag exists. Falls back to the current
 * origin when the server wrote none, which is the case in a bare dev shell.
 */
const canonicalOrigin = (): string => {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  try {
    if (existing?.href) return new URL(existing.href).origin;
  } catch {
    // A hand-edited href is not worth failing a navigation over.
  }

  return window.location.origin;
};

/**
 * Keep the document head in step with the route.
 *
 * Runs again when the data arrives, not just on navigation: a club page is
 * rendered before its name is known, so the title starts generic and sharpens
 * once the fetch resolves.
 *
 * The server injects the same values into the HTML it serves, and that is what
 * link previews read — they never execute JavaScript. This half matters for the
 * browser tab, for the crawlers that *do* render, and for one thing neither of
 * those covers: after an in-app navigation the server's tags describe the page
 * the reader arrived on, not the one they are looking at. A canonical left
 * pointing at the entry page is worse than none at all.
 */
export function usePageMeta(route: Route, context: MetaContext): void {
  const { title, description } = pageMeta(route, context);
  const path = canonicalPath(route, context);
  // Before the fetch lands there is nothing here the server did not already
  // know better. Writing anyway would replace a resolved canonical with the raw
  // key, and strip the `noindex` off a page that really is missing.
  const resolved = subjectResolved(route, context);
  // Depended on individually below: `context` is a fresh object literal on every
  // render, so listing it would re-run the effect on every render rather than
  // when the data actually changed. These two come straight from state.
  const { clubs, matches } = context;

  useEffect(() => {
    document.title = title;

    setMetaTag("name", "description", description);
    setMetaTag("property", "og:title", title);
    setMetaTag("property", "og:description", description);
    setMetaTag("name", "twitter:title", title);
    setMetaTag("name", "twitter:description", description);

    if (!resolved) return;

    const href = `${canonicalOrigin()}${path}`;

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = href;

    setMetaTag("property", "og:url", href);

    // Same rule the server applied, from the same function — so a reader who
    // lands on a made-up club and then clicks through to a real page does not
    // carry the `noindex` with them.
    const { index } = pageStatus(window.location.pathname, { clubs, matches });
    const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');

    if (index) {
      robots?.remove();
    } else {
      setMetaTag("name", "robots", "noindex, follow");
    }
  }, [title, description, path, resolved, clubs, matches]);
}
