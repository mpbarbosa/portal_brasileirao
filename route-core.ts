/**
 * Pure URL ↔ app-state mapping. No History API, no React — parsing and
 * formatting are total functions over strings, so every path shape is testable
 * without a browser (tests/route-core.test.ts).
 */


export type Route =
  | { section: "classificacao" }
  /** What is being played right now, plus what is next and what just ended. */
  | { section: "ao-vivo" }
  /** `round: null` means "whatever the current round is" — a link that stays
   *  useful next week, which `/jogos/24` does not. */
  | { section: "jogos"; round: number | null }
  | { section: "artilharia" }
  /** Every club's elenco, on one page. Takes no argument: it is an index of
   *  the whole division, not a drill-down into one club. */
  | { section: "jogadores" }
  /**
   * `key` is what the URL says — a slug like "flamengo", or a raw club code for
   * links published before slugs existed. Resolving it to a club is the view's
   * job (`findClub`), not the router's.
   */
  | { section: "clube"; key: string }
  /** A single fixture, addressed by our match id. */
  | { section: "partida"; id: string }
  /**
   * One ground, addressed by its slug ("maracana"). A detail view reached from
   * a match or a club, not a nav destination — there is no stadium without a
   * fixture that names one, exactly as there is no `clube` without a club.
   */
  | { section: "estadio"; key: string };

export const HOME: Route = { section: "classificacao" };

const isRound = (value: string): boolean => /^[1-9]\d*$/.test(value);

/**
 * Split and percent-decode a pathname, treating an undecodable one as empty.
 *
 * `decodeURIComponent` throws `URIError` on a malformed escape — `/clube/%`,
 * `/clube/%E0%A4%A` — and a crawler will eventually send one. Left to throw,
 * that surfaces as a 500 from the SPA handler, which is both the wrong answer
 * and the one shape of failure this module exists to rule out: every path is
 * supposed to resolve to something. It resolves to the table, and `pageStatus`
 * in `seo-core` is what gives it a 404 rather than an indexable duplicate.
 */
const decodeSegments = (pathname: string): string[] => {
  const raw = pathname.split("/").filter(Boolean);
  try {
    return raw.map(decodeURIComponent);
  } catch {
    return [];
  }
};

/**
 * Read a route from a pathname. Anything unrecognised falls back to the table
 * rather than erroring: a stale or mistyped link should land somewhere useful.
 */
export const parseRoute = (pathname: string): Route => {
  const [first, second] = decodeSegments(pathname);

  switch (first) {
    case undefined:
    case "classificacao":
      return HOME;

    case "ao-vivo":
      return { section: "ao-vivo" };

    case "jogos":
      // A non-numeric or zero round is treated as "current" rather than 404 —
      // /jogos/abc still shows fixtures.
      return { section: "jogos", round: second && isRound(second) ? Number(second) : null };

    case "artilharia":
      return { section: "artilharia" };

    case "jogadores":
      return { section: "jogadores" };

    case "clube":
      return second ? { section: "clube", key: second } : HOME;

    case "partida":
      return second ? { section: "partida", id: second } : HOME;

    case "estadio":
      return second ? { section: "estadio", key: second } : HOME;

    default:
      return HOME;
  }
};

/** The canonical path for a route. `formatRoute(parseRoute(p))` is stable. */
export const formatRoute = (route: Route): string => {
  switch (route.section) {
    case "classificacao":
      return "/";
    case "ao-vivo":
      return "/ao-vivo";
    case "jogos":
      return route.round === null ? "/jogos" : `/jogos/${route.round}`;
    case "artilharia":
      return "/artilharia";
    case "jogadores":
      return "/jogadores";
    case "clube":
      return `/clube/${encodeURIComponent(route.key)}`;
    case "partida":
      return `/partida/${encodeURIComponent(route.id)}`;
    case "estadio":
      return `/estadio/${encodeURIComponent(route.key)}`;
  }
};

export const sameRoute = (a: Route, b: Route): boolean =>
  formatRoute(a) === formatRoute(b);
