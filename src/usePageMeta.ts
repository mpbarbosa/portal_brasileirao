import { useEffect } from "react";

import { pageMeta, type MetaContext } from "@/page-meta-core";
import type { Route } from "@/route-core";

/**
 * Keep the document's title and description in step with the route.
 *
 * Runs again when the data arrives, not just on navigation: a club page is
 * rendered before its name is known, so the title starts generic and sharpens
 * once the fetch resolves.
 *
 * This only affects the browser tab and history. Link previews never execute
 * JavaScript — the server injects the same values into the HTML it serves.
 */
export function usePageMeta(route: Route, context: MetaContext): void {
  const { title, description } = pageMeta(route, context);

  useEffect(() => {
    document.title = title;

    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.name = "description";
      document.head.appendChild(tag);
    }
    tag.content = description;
  }, [title, description]);
}
