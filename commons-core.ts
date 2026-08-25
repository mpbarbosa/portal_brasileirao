/**
 * Reading Wikimedia Commons' metadata, as pure functions (tests/commons-core.test.ts).
 *
 * Extracted from `scripts/check-stadium-photos.ts` when `sync-stadium-photos`
 * became its second caller. The rules here decide whether the app is entitled
 * to publish a picture and whether the credit beside it is the one the
 * photographer is owed — a second copy of that judgement is how the checker
 * comes to pass a file the sync would refuse, or the reverse.
 */

/** Commons returns these fields as HTML — a linked username, an italicised
 *  studio name. The page shows plain text, so compare plain text. */
export const plain = (value: string): string =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Accents off, case off, punctuation off. "Erica Ramalho/Portal da Copa" and
 *  "Erica Ramalho / Portal da Copa" are the same credit written two ways. */
export const fold = (value: string): string =>
  plain(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The canonical deed URL for a licence as Commons names it, or null when the
 * name is not one we recognise.
 *
 * Null is meaningful rather than an error case: it is what
 * `redistributable` reads as "unknown licence", and an unknown licence is
 * refused rather than guessed at.
 */
export const deedFor = (license: string): string | null => {
  const folded = fold(license);
  if (folded === "cc0") return "https://creativecommons.org/publicdomain/zero/1.0/";

  const match = /^cc by(?: (sa))? (\d+ \d+)(?: ([a-z]{2}))?$/.exec(folded);
  if (!match) return null;

  const [, sa, version, jurisdiction] = match;
  const path = `by${sa ? "-sa" : ""}/${version.replace(" ", ".")}/`;
  return `https://creativecommons.org/licenses/${path}${jurisdiction ? `${jurisdiction}/` : ""}`;
};

/**
 * Whether the app may host a copy of this file on its own origin.
 *
 * **This is a different question from whether the page may display it**, and
 * the difference is the whole reason the function exists. Hotlinking shows
 * someone else's copy; vendoring makes us the publisher of ours. CC BY and
 * CC BY-SA both allow that provided the credit travels with the image, which
 * is what `StadiumPhoto` makes a required field and what the page renders.
 *
 * The broadcaster marks take the stricter rule — public domain only — because
 * a mark is drawn without a credit line beside it. That is the right rule for
 * marks and the wrong one here; the obligation is met differently, not avoided.
 *
 * Anything unrecognised is refused. A licence this cannot name is one nobody
 * has checked, and a NonCommercial or NoDerivatives file would otherwise be
 * copied into a public directory on the strength of not matching a blocklist.
 */
export const redistributable = (license: string): boolean => deedFor(license) !== null;

/**
 * Whether a stored credit still says what Commons says.
 *
 * Commons publishes two fields and they are not interchangeable: `Attribution`
 * is wording the photographer dictated, `Artist` is who Commons recorded. Where
 * an `Attribution` exists it is the one with legal force, so it is what the
 * data must match; otherwise the `Artist` is.
 *
 * Compared folded, because the same credit is written several ways and a
 * spacing change around a slash is not a licensing event.
 */
export const creditMatches = (
  stored: string,
  facts: { attribution?: string; artist?: string },
): boolean => {
  const expected = facts.attribution?.trim() ? facts.attribution : (facts.artist ?? "");
  return fold(stored) === fold(expected);
};
