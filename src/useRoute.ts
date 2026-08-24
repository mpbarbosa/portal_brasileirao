import { useCallback, useEffect, useState } from "react";

import { formatRoute, parseRoute, sameRoute, type Route } from "@/route-core";

/**
 * Binds the History API to the parsed route.
 *
 * All the interesting logic lives in `route-core`; this hook only pushes,
 * replaces and listens, so there is very little here that a test could not
 * already reach through `parseRoute`/`formatRoute`.
 */
export function useRoute(): {
  route: Route;
  navigate: (next: Route, options?: { replace?: boolean }) => void;
  href: (route: Route) => string;
} {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));

  // popstate fires for back/forward, and for a programmatic history.back().
  useEffect(() => {
    const onPopState = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback(
    (next: Route, options?: { replace?: boolean }) => {
      const path = formatRoute(next);

      // Navigating to where you already are must not stack history entries —
      // otherwise Back appears to do nothing.
      if (sameRoute(next, parseRoute(window.location.pathname))) {
        setRoute(next);
        return;
      }

      if (options?.replace) {
        window.history.replaceState(null, "", path);
      } else {
        window.history.pushState(null, "", path);
      }
      setRoute(next);
    },
    [],
  );

  return { route, navigate, href: formatRoute };
}
