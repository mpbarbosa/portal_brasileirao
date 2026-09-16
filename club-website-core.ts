/**
 * Whether a page served at a club's recorded address is still that club's site.
 *
 * Pure, and separate from `scripts/check-club-websites.ts` for the reason
 * `commons-core.ts` is separate from `scripts/commons-api.ts`: the judgement is
 * what is worth unit-testing, and it cannot be tested through a network.
 *
 * **It exists because the failure it looks for answers 200.** A club's lapsed
 * domain is worth money to whoever wants its inbound links, so the shape to
 * expect is not a timeout but a healthy page full of somebody else's content —
 * which is what `bragantino.net` became, and which every check short of reading
 * the page passes. Status codes, redirects and response sizes all looked
 * correct throughout.
 *
 * **It is a HINT, like `check-club-twitter` and unlike `check-club-discord`.**
 * Those two compare an id the host states against an id we recorded; a website
 * has no id to compare, so the only question available is whether the page still
 * *says* the club's name. That narrows what a person has to read. It does not
 * prove the site is the club's, and nothing here should be read as if it did.
 */

/** A club's name as it may be *written*, not as it must be spelled. */
const fold = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Brazilian football spells one sound two ways, and a club may use both of
    // them itself: `shortName` is "Athletico-PR" while its own site is titled
    // "Clube Atlético Paranaense". This widens how a name may be WRITTEN and
    // not what counts as a match — folding `th` cannot make two different names
    // equal — which is the line `check-player-wikipedia` already draws when it
    // accepts `1º` beside `1` and folds the case of a month. Measured: without
    // it Athletico-PR reports NO_NAME on its own official site, every run,
    // for ever, which is how a checker earns being ignored.
    .replace(/th/g, "t");

/**
 * Everything on the page a reader could see, with every URL removed.
 *
 * **Keeping a domain out of the text is the whole of what makes this work, and
 * a rule reading the raw HTML passes the exact entry this was written for.**
 * The Vietnamese blog at `bragantino.net` contains the string "bragantino" 53
 * times — once in every permalink it prints, because the club's name is still
 * the domain it squats. So the match has to run over text, where the domain
 * cannot vouch for the page.
 *
 * Two rules do that and they are **not** redundant, which was established by
 * mutation rather than by reading: stripping tags removes every `href`, and
 * covers the case above on its own — deleting the bare-URL rule leaves every
 * test green. The bare-URL rule is for an address printed as visible text, in
 * a footer or a citation, which no tag strip can reach. Each has its own case
 * below for that reason, and only deleting both reddens the squat fixture.
 */
export const readableText = (html: string): string =>
  fold(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      // Tags **and their attributes**, which is where every href lives.
      .replace(/<[^>]*>/g, " ")
      // A bare URL printed as text, which a footer or a citation may carry.
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/&[a-z]+;/gi, " "),
  );

/**
 * Below this many characters of readable text, the page has not told us
 * anything either way.
 *
 * Measured over the division on 2026-09-15: sixteen club sites render between
 * 1 560 and 72 157 characters server-side, and three render almost nothing —
 * Coritiba 66 and Grêmio 0, both client-rendered shells, and Vasco 84 behind a
 * 403. Those three are INCONCLUSIVE rather than failures, because "this site is
 * a JavaScript shell" is a fact about how it is built and not evidence about
 * whose it is. The floor sits an order of magnitude below the smallest real
 * page and an order of magnitude above the largest shell, so no reading in that
 * sweep was close to it.
 */
export const MIN_READABLE_TEXT = 400;

export type SiteVerdict = "names-club" | "no-name" | "inconclusive";

/** The words of a club's name worth looking for — "-PR" and "do" are not. */
export const clubNameWords = (shortName: string): string[] =>
  fold(shortName)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);

/**
 * Whether this page still names this club.
 *
 * **Every word has to appear**, so "Clube do Remo" needs both `clube` and
 * `remo`. Any-word would accept a page naming only `clube`, which is a word
 * three of these twenty carry and no evidence at all.
 */
export const siteVerdict = (html: string, shortName: string): SiteVerdict => {
  const text = readableText(html);
  const words = clubNameWords(shortName);

  // A club whose name is all short words has nothing to search for; saying so
  // is honest where reporting NAMES_CLUB on an empty search would not be.
  if (words.length === 0) return "inconclusive";
  if (words.every((word) => text.includes(word))) return "names-club";

  // Order matters: a thin page that happens to contain the name is still a
  // pass, and only a page that fails the match is asked whether it had enough
  // text to be asked at all.
  return text.length < MIN_READABLE_TEXT ? "inconclusive" : "no-name";
};
