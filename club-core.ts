/**
 * Pure per-club derivations. No I/O — the club view composes data the client
 * already holds (standings, fixtures, scorers), so this module exists to keep
 * the slicing rules testable rather than buried in a component.
 */
import { compareByKickoff, isConcluded } from "@/matches-core";
import { countsTowardStandings } from "@/standings-core";
import type {
  Club,
  ClubCode,
  ClubDiscord,
  ClubVideo,
  FormResult,
  Match,
  Scorer,
  StandingsRow,
} from "@/src/types";

/**
 * URL-safe form of a club name: "Atlético-MG" becomes "atletico-mg".
 *
 * Accents are stripped rather than percent-encoded so the address stays
 * readable and typeable. Returns "" when a name has nothing alphanumeric in it,
 * which the caller must treat as "no slug" — never as a valid empty path
 * segment.
 */
export const slugify = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** What a club's URL should say. Falls back to the code when it has no slug. */
export const clubKey = (club: Club): string => club.slug || club.code;

/**
 * The letters a crest falls back to when the image does not arrive.
 *
 * `tla` first, which is what it is carried on `Club` for — display, never
 * identity (Corinthians and Coritiba both report `COR`, so it may not be
 * unique, and a monogram does not need it to be).
 *
 * **It is optional upstream**, so the fallback needs its own fallback, and
 * `code` cannot be it: a club's code is the provider's numeric id (`"1783"`),
 * and a number beside a club's name is a rendering artefact rather than an
 * abbreviation of anything. The initial of the short name is derived from
 * what the reader can already see, which is the property that matters here —
 * the mark sits beside the club's name in text, so it carries no information
 * the reader lacks and its whole job is to hold the slot without looking
 * broken.
 *
 * One letter rather than initials-of-each-word on purpose: "Vasco da Gama"
 * wants a stopword list to reach `VG`, "Athletico-PR" wants a hyphen rule, and
 * every such rule is a way to print something wrong beside a name that is
 * already right. Accents are kept — this is a letter to look at, not a URL
 * segment, so `slugify`'s stripping would be a loss here.
 *
 * Returns "" when a club has neither, which the caller must treat as "no
 * monogram" — the same contract `slugify` states, and the case that renders
 * nothing at all rather than an empty box.
 */
export const crestMonogram = (club: Club): string => {
  const tla = club.tla?.trim();
  if (tla) return tla.toUpperCase();
  return (club.shortName.trim()[0] ?? "").toUpperCase();
};

/**
 * Resolve a club from a URL segment, accepting either a slug or a raw code.
 * Codes are still honoured because links to `/clube/1783` were published before
 * slugs existed, and a shared link should not rot.
 */
export const findClub = (clubs: Club[], key: string): Club | null => {
  const needle = key.toLowerCase();
  return (
    clubs.find((club) => club.slug === needle) ??
    clubs.find((club) => club.code === key) ??
    null
  );
};

/**
 * The article a Brazilian puts in front of a club's popular name: **o**
 * Palmeiras, **a** Chapecoense.
 *
 * Hand-kept, and it has to be. No provider reports grammatical gender, and the
 * article does not follow from the spelling — "a Chapecoense" and "o
 * Fluminense" end the same way, and "a Portuguesa" and "o Palmeiras" differ
 * from each other only in the word itself. Any rule on the final letter gets
 * both pairs wrong.
 *
 * **The table is exhaustive over `src/data/clubs.ts`, and that is the point of
 * it.** The first version was a set holding the four clubs that take "a", with
 * masculine as a silent default for everything else — which is the same shape
 * as the bug it was written to fix. It caught a *known* feminine club being
 * promoted and could not catch an unknown one: a Caldense or an Aparecidense
 * arriving in the division falls through to "o", the set of feminine clubs
 * still reads exactly as it did, and every test stays green while the wrong
 * article ships. `CLUBS.length === 20` cannot help either, since Série A is
 * always twenty and a promotion is a swap.
 *
 * So `tests/club-core.test.ts` asserts an entry per club instead, and a club
 * with none fails the build until a person writes its article down. That is
 * the rule `NATIONALITY_LABELS` already follows one module over, for the same
 * reason and after the same kind of incident.
 *
 * The three entries that are not in the division are the feminine names Série
 * B is likeliest to send up. They cost nothing, and they are exactly what an
 * exhaustiveness check cannot supply on its own — a judgement nobody has
 * written down yet.
 *
 * `clubArticle` still defaults to masculine at **runtime**, deliberately: club
 * objects also arrive from the live payload, which legitimately names clubs the
 * frozen snapshot does not, and a page has to render for them. The default is
 * what a reader sees; the test is what stops the default being load-bearing.
 */
export type ClubArticle = "o" | "a";

/**
 * Brazil's federative units, as they are suffixed to a club's popular name.
 *
 * `Athletico-PR` and `Atlético-MG` are in the snapshot today, so a promoted
 * `Portuguesa-RJ` would slug to `portuguesa-rj` and miss a table keyed on
 * `portuguesa`. The article belongs to the **name** rather than to the state —
 * "a Portuguesa" is "a Portuguesa" in any of them — so the suffix comes off
 * before the lookup and the table holds one entry per name.
 *
 * Anchored to the end and restricted to the 27 real UFs rather than matching
 * any two-letter tail, so a club whose name happens to end in a short word is
 * not silently truncated into somebody else's entry.
 */
const STATE_SUFFIX =
  /-(?:ac|al|am|ap|ba|ce|df|es|go|ma|mg|ms|mt|pa|pb|pe|pi|pr|rj|rn|ro|rr|rs|sc|se|sp|to)$/;

/**
 * The key a club's article is filed under. `slugify` is reused rather than
 * reimplemented, exactly as `venue-core` reuses it: a second normaliser is how
 * "Ponte Preta" and "ponte-preta" come to disagree about the same club.
 */
const articleKey = (club: Club): string => slugify(club.shortName).replace(STATE_SUFFIX, "");

const CLUB_ARTICLES: Record<string, ClubArticle> = {
  // The twenty in `src/data/clubs.ts`, keyed as above.
  athletico: "o", // Athletico-PR
  atletico: "o", // Atlético-MG
  bahia: "o",
  botafogo: "o",
  bragantino: "o",
  chapecoense: "a",
  "clube-do-remo": "o",
  corinthians: "o",
  coritiba: "o",
  cruzeiro: "o",
  flamengo: "o",
  fluminense: "o",
  gremio: "o",
  internacional: "o",
  mirassol: "o",
  palmeiras: "o",
  santos: "o",
  "sao-paulo": "o",
  "vasco-da-gama": "o",
  vitoria: "o",

  // Not in the division, written down ahead of a promotion.
  ferroviaria: "a",
  "ponte-preta": "a",
  portuguesa: "a",
};

/**
 * Whether the table names this club — the exhaustiveness guard's whole
 * question, phrased so the test does not need a copy of the key rule.
 */
export const hasClubArticle = (club: Club): boolean =>
  Object.hasOwn(CLUB_ARTICLES, articleKey(club));

/** "o" or "a", for a club's popular name. */
export const clubArticle = (club: Club): ClubArticle => CLUB_ARTICLES[articleKey(club)] ?? "o";

const CONTRACTED: Record<ClubArticle, string> = { o: "do", a: "da" };

/**
 * A club in the possessive — "do Flamengo", "da Chapecoense".
 *
 * Exported beside the bare article because every caller but `followLabel`
 * wants *this* form, and a caller writing `` `do ${club.shortName}` `` for
 * itself is precisely how one wrong article came to be in four files at once.
 */
export const ofClub = (club: Club): string => `${CONTRACTED[clubArticle(club)]} ${club.shortName}`;

/**
 * Several clubs in the possessive, joined the way pt-BR joins a list: "do
 * Fluminense e do Flamengo", "do A, do B e do C".
 *
 * The article is repeated per club rather than applied once to the head of the
 * list. "Casa do Fluminense e Flamengo" is wrong even where both clubs are
 * masculine, and a ground shared by Chapecoense and anybody else has no single
 * article that could serve both.
 *
 * An empty list returns an empty string rather than a dangling "do", which the
 * caller avoids reaching by omitting the clause entirely.
 */
export const ofClubs = (clubs: Club[]): string => {
  const parts = clubs.map(ofClub);
  if (parts.length < 2) return parts[0] ?? "";

  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
};

/** Re-exported, not redefined: the type moved to `src/types.ts` when
 *  `RoundCandle` became its second reader, and every existing caller imports it
 *  from here. */
export type { FormResult };

export const playsIn = (match: Match, code: ClubCode): boolean =>
  match.homeCode === code || match.awayCode === code;

export const clubMatches = (matches: Match[], code: ClubCode): Match[] =>
  matches.filter((match) => playsIn(match, code)).sort(compareByKickoff);

/**
 * Result of a finished match from one club's point of view. Returns null when
 * the match cannot be scored yet — a live or unplayed fixture has no result,
 * and neither does one the club is not in.
 */
export const resultFor = (match: Match, code: ClubCode): FormResult | null => {
  if (!countsTowardStandings(match) || !playsIn(match, code)) return null;

  const scored = match.homeCode === code ? match.homeGoals : match.awayGoals;
  const conceded = match.homeCode === code ? match.awayGoals : match.homeGoals;

  if (scored > conceded) return "V";
  if (scored === conceded) return "E";
  return "D";
};

/**
 * The club's last `size` results, oldest first — the reading order of a form
 * guide. Only finished matches count, so a postponed fixture in the middle of
 * the run does not punch a hole in it.
 */
export const recentForm = (matches: Match[], code: ClubCode, size = 5): FormResult[] =>
  clubMatches(matches, code)
    .map((match) => resultFor(match, code))
    .filter((result): result is FormResult => result !== null)
    .slice(-size);

/**
 * The next fixture still to be played, or null once the season is over.
 *
 * **A postponed fixture is passed over while anything else is pending**, and that is the whole
 * of what this does beyond ordering by kickoff. `isConcluded` deliberately counts POSTPONED as
 * still to come — a postponed match really is owed — but its stored kickoff is the *old* one,
 * which upstream keeps until the match is re-scheduled. So the earliest pending fixture is
 * routinely a date that has already passed, and the club page led with it: measured on the 2026
 * season, all six clubs holding a postponed round-21 fixture had their **Próximo jogo** naming a
 * 29 July match while the Meu time strip named their real one, four days out.
 *
 * **It is a claim about STATUS and not about time, which is why there is still no clock here.**
 * `clubFocus` in `next-match-core.ts` is the one that reads `now`, and the two must stay apart:
 * this answers *what does this club still owe* for a season at a glance, and gaining a clock is
 * exactly what that module's own comment says must not happen to it. A postponed fixture loses
 * its place in the queue because it has no usable date, not because of what the hour is.
 *
 * **It falls back to the postponed one when there is nothing else**, so a club whose only
 * remaining fixture is postponed still sees it, chip and all, rather than an empty section.
 */
export const nextFixture = (matches: Match[], code: ClubCode): Match | null => {
  const pending = clubMatches(matches, code).filter((match) => !isConcluded(match));
  return pending.find((match) => match.status !== "POSTPONED") ?? pending[0] ?? null;
};

/** The most recently finished match, or null before the club has played. */
export const lastFixture = (matches: Match[], code: ClubCode): Match | null => {
  const played = clubMatches(matches, code).filter(countsTowardStandings);
  return played.length ? played[played.length - 1] : null;
};

export const standingFor = (rows: StandingsRow[], code: ClubCode): StandingsRow | null =>
  rows.find((row) => row.club.code === code) ?? null;

/** The club's entries in the top-scorer table, best first. */
export const scorersFor = (scorers: Scorer[], code: ClubCode): Scorer[] =>
  scorers.filter((scorer) => scorer.club.code === code);

/**
 * The curated videos about a club, in file order — which is the order the
 * reader meets them, so the file is where the ordering decision lives.
 *
 * Entries whose id will not parse are **dropped rather than rendered**, one at
 * a time, so a single bad line does not take the rest of a club's rail with it
 * — `highlights.ts`' rule for `isHighlightUrl`, met one file over. A club with
 * no entry, or whose only entries were dropped, returns an empty list and the
 * section is left out entirely.
 */
export const videosFor = (
  videos: Record<ClubCode, ClubVideo[]>,
  code: ClubCode,
): ClubVideo[] => (videos[code] ?? []).filter((video) => youtubeVideoId(video.id) !== null);


/**
 * Normalise a club's official site to an HTTPS origin.
 *
 * Two corrections, both from real provider data:
 *
 * - **Scheme.** Most clubs are listed as `http://`. Every one of the twenty
 *   terminates TLS — checked by hand, including the ones whose bot protection
 *   answers a script with 403 — so upgrading is safe and linking a reader to
 *   plaintext is not.
 * - **Path.** Flamengo is listed as `/pagina-inicial-basquete`, the basketball
 *   landing page. This link means "the club's official site", so only the origin
 *   is kept. No club here lives at a path, and dropping one is a smaller error
 *   than sending football readers to a basketball page.
 *
 * Returns null for anything unparseable, which the UI renders as no link at all.
 */
export const officialSiteUrl = (raw: string | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;

  return `https://${url.hostname}/`;
};

/**
 * The handle alone, from whatever was written down.
 *
 * Accepts what a person is likely to paste — a bare handle, an `@handle`, or a
 * full URL carrying Instagram's `?hl=pt-br` locale hint — because the handle
 * list is hand-maintained and being strict about the input format buys nothing.
 * Only the handle is kept, so the stored data does not accumulate query strings
 * that mean nothing to another reader.
 *
 * Returns null for anything that is not a plausible handle, which the UI
 * renders as no link rather than a broken one.
 */
export const instagramHandle = (raw: string | null | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  // Take the first path segment of a URL, or the value itself.
  const handle = (value.includes("instagram.com/")
    ? (value.split("instagram.com/")[1] ?? "")
    : value
  )
    .split(/[/?#]/)[0]
    .replace(/^@/, "");

  // Instagram's own rule: letters, digits, dots and underscores, up to 30.
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? handle : null;
};

/**
 * The address for a handle, built from the normalised handle rather than from
 * the raw value — so a link and the `@handle` printed beside it cannot come to
 * disagree about which profile they mean.
 */
export const instagramUrl = (raw: string | null | undefined): string | null => {
  const handle = instagramHandle(raw);
  return handle && `https://www.instagram.com/${handle}/`;
};

/** The path kinds whose code the `/p/` addresses were measured to serve. */
const POST_PATH = /^(?:p|reel)\//;

/**
 * The shortcode of one Instagram **post**, from whatever was written down.
 *
 * `instagramHandle`'s shape one level down: accepts a bare code or a pasted
 * permalink, and keeps only the code. That matters more here than it does for a
 * handle, because Instagram's own "copy link" appends
 * `?utm_source=ig_web_copy_link&stkn=…` — a **share token identifying whoever
 * copied it**, which has no business in a committed file.
 *
 * **`/p/` and `/reel/` are accepted; `/tv/`, `/reels/` and everything else are
 * refused.** A reel's shortcode is a post's shortcode, and that was measured
 * rather than assumed — in a browser on 2026-09-11, against `DbHq1mExfG9`, a
 * reel published by Pedro's own account: `/p/<code>/embed/captioned/` rendered
 * it with its author, the verified badge and the video, and `/p/<code>/` opened
 * it without redirecting. Mounted in the player card in headless Chromium it
 * also reported its own height by `MEASURE` — 899px in the 470px frame, against
 * 953px for Viveros' post in the same run — so `PlayerPosts` sizes it with no
 * special case. A reel is therefore stored like any other post and every
 * address below stays `/p/`; nothing downstream needs to know which it was.
 *
 * `/reels/<code>/` is refused although it carries a code too: logged out it
 * answered Instagram's login wall and nothing else, so nothing here has seen it
 * serve a reel. `/tv/` is refused for the reason reels were until somebody
 * checked. This file's rule everywhere else is that it refuses rather than
 * guesses — `matchPlayerByName`'s bar — so a further path kind is a deliberate
 * change with a check attached, not a regex loosened in passing.
 *
 * Returns null for anything that is not a plausible shortcode — Instagram's are
 * URL-safe base64 of 5 to 30 characters — which the UI renders as no post
 * rather than an empty frame.
 */
export const instagramPostCode = (raw: string | null | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  // The path after the host in a URL, or null for a bare code.
  const path = value.includes("instagram.com/") ? (value.split("instagram.com/")[1] ?? "") : null;

  // A pasted URL of another kind (`/reels/…`, `/tv/…`, a profile) still has a
  // first segment, so stripping a kind below is not on its own a filter — this
  // is. Refusing here rather than later keeps one rule instead of two.
  if (path !== null && !POST_PATH.test(path)) return null;

  const code = (path === null ? value : path.replace(POST_PATH, "")).split(/[/?#]/)[0];
  return /^[A-Za-z0-9_-]{5,30}$/.test(code) ? code : null;
};

/**
 * The address a reader opens, built from the normalised code rather than from
 * the raw value — `instagramUrl`'s rule, so the link and the frame beside it
 * cannot come to disagree about which post they mean.
 */
export const instagramPostUrl = (raw: string | null | undefined): string | null => {
  const code = instagramPostCode(raw);
  return code && `https://www.instagram.com/p/${code}/`;
};

/**
 * The address a **frame** loads: Instagram's own `/embed/captioned/` page.
 *
 * **The canonical post URL cannot be framed and this one can**, which is the
 * whole reason the two functions differ. `/p/<code>/` answers
 * `X-Frame-Options: DENY`; `/p/<code>/embed/captioned/` ships without it,
 * because it exists to be put in an iframe — it is the page Instagram's own
 * `embed.js` builds one of internally. Measured in a browser against a
 * third-party origin, not inferred: a `curl` of either address follows to the
 * login wall, which carries `DENY` and is byte-for-byte the same shell for a
 * real shortcode and an invented one, so the command line cannot answer this
 * question at all — the trap `src/data/player-instagram.ts` already records.
 *
 * **`captioned`, and that is not a preference about captions.** The embed
 * reports its own height by `postMessage`, which is the only way a frame can be
 * sized without Instagram's script, and the two variants do not report it
 * equally well: measured on the seed post at four widths, `/embed/` says **226**
 * against a true content height of **684**, while `/embed/captioned/` says
 * **818** and fits to the pixel. So a frame on `/embed/` sized from its own
 * message clips the picture — which is the shape the sibling repo's
 * `InstagramPostFrame` ships — and the fix is the endpoint rather than the
 * arithmetic.
 */
export const instagramPostEmbedUrl = (raw: string | null | undefined): string | null => {
  const code = instagramPostCode(raw);
  return code && `https://www.instagram.com/p/${code}/embed/captioned/`;
};

/**
 * The subreddit name alone, from whatever was written down.
 *
 * Accepts what a person is likely to paste — a bare name, `r/CRFla`, `/r/CRFla`
 * or a full `reddit.com/r/CRFla/` link — because the list is hand-maintained and
 * being strict about the input format buys nothing. `instagramHandle`'s rule,
 * and this is deliberately the same shape rather than a second idea about how a
 * social identifier is parsed.
 *
 * **The casing survives**, which is the one way this differs from its two
 * neighbours. Reddit resolves a sub case-insensitively but prints one canonical
 * form, so folding the value would reach the right page under a name the
 * community does not use — and the name is what the link *says*, not merely
 * where it goes.
 *
 * Returns null for anything that is not a plausible name — Reddit's own rule is
 * letters, digits and underscores, 3 to 21 characters — which the UI renders as
 * no link rather than a broken one.
 */
export const subredditName = (raw: string | null | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  // Take what follows the last `r/` in a URL or a prefixed name, or the value
  // itself. A bare name is the common case; the rest is what a paste carries.
  const afterHost = value.includes("reddit.com/")
    ? (value.split("reddit.com/")[1] ?? "")
    : value;
  const name = afterHost.replace(/^\/?r\//, "").split(/[/?#]/)[0];

  return /^[A-Za-z0-9_]{3,21}$/.test(name) ? name : null;
};

/**
 * The address for a subreddit, built from the normalised name rather than from
 * the raw value — so the link and the `r/name` printed beside it cannot come to
 * disagree about which community they mean. `instagramUrl`'s rule.
 */
export const redditUrl = (raw: string | null | undefined): string | null => {
  const name = subredditName(raw);
  return name && `https://www.reddit.com/r/${name}/`;
};

/**
 * The Discord **invite code** alone, from whatever was written down.
 *
 * `subredditName`'s shape one level over: accepts a bare code, a `discord.gg/`
 * short link or a `discord.com/invite/` link, and keeps only the code — so a
 * pasted invite's `?event=…` suffix does not survive into the file, and the
 * origin is written once.
 *
 * **A `discord.com/channels/<guild>/…` address is REFUSED, and that refusal is
 * the whole reason this parser exists rather than a bare string in the data
 * file.** It is the shape somebody actually pastes, because it is what the
 * browser's address bar shows while they are reading the server — and it is
 * not a link to a server at all. It is an in-app pointer for a reader who is
 * **already a member**: a non-member opening it gets their own Discord with no
 * join affordance and no indication that anything was meant to happen. Storing
 * one would put a link on nineteen readers' club page that silently does
 * nothing for the eighteen who are not in it, which is `instagramPostCode`'s
 * argument against reels and `matchPlayerByName`'s bar — refuse rather than
 * guess.
 *
 * The second half of that argument is verification, and it is measured rather
 * than asserted. A guild id can be checked against **nothing**: `widget.json`
 * answers 403 unless the server has opted in, `/v10/guilds/<id>/preview` is
 * 401, and `discord.com/channels/<id>/@home` is 200 with `<title>Discord</title>`
 * for a real id **and for invented ones**, within 50 bytes of each other — the
 * trap `src/data/player-instagram.ts` records for Instagram, met again. An
 * invite is public: `api/v10/invites/<code>` names the guild without auth and
 * answers `Unknown Invite` for a code nobody minted, which is what lets
 * `scripts/check-club-discord.ts` exist at all.
 *
 * Returns null for anything else, which the UI renders as no link rather than
 * one that lands nowhere.
 */
export const discordInvite = (raw: string | null | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  // A server address rather than an invite. Anchored on `channels/` wherever it
  // appears rather than on the host, because the shape that actually slips
  // through is the one with the host already gone: measured, a full
  // `https://discord.com/channels/956…/@home` is refused by the character rule
  // below anyway — its first segment is `https:` — while a hand-trimmed
  // `channels/956…/@home` yields the segment `channels` and would be stored as
  // the invite code **"channels"**, building `discord.gg/channels`. A refusal
  // that reads as an acceptance is worse than no parser.
  if (/(^|\/)channels\//i.test(value)) return null;

  // What follows `discord.gg/` or `.com/invite/`, or the value itself.
  const afterHost = value
    .replace(/^.*discord(app)?\.com\/invite\//i, "")
    .replace(/^.*discord\.gg\//i, "");
  const code = afterHost.split(/[/?#]/)[0];

  // A **snowflake**, which is the guild id itself — the single likeliest thing
  // for somebody to lift out of a `channels/<guild>/…` address by hand, and the
  // one shape that satisfies every rule below while being categorically not an
  // invite. Discord mints codes of 7–10 characters and vanities are words, so
  // nothing legitimate is 17 or more digits; an id stored here would build
  // `discord.gg/956…`, a link that looks minted and resolves to nothing.
  if (/^[0-9]{17,20}$/.test(code)) return null;

  // Discord's own rule: a minted code is alphanumeric, a vanity URL may carry
  // hyphens, and both sit inside 2–32 characters.
  return /^[A-Za-z0-9-]{2,32}$/.test(code) ? code : null;
};

/**
 * The address for an invite, built from the normalised code rather than from
 * the raw value — so the link and the `discord.gg/code` printed beside it
 * cannot come to name two different servers. `redditUrl`'s rule.
 *
 * `discord.gg` rather than `discord.com/invite`, because the two resolve to the
 * same place and the short form is what Discord's own copy button produces —
 * so the address on the page is the one a reader has seen before.
 */
export const discordUrl = (raw: string | null | undefined): string | null => {
  const code = discordInvite(raw);
  return code && `https://discord.gg/${code}`;
};

/**
 * The video id inside whatever a person pasted.
 *
 * Accepts a bare id, a `watch?v=` link, a `youtu.be` short link or an `embed/`
 * link, because every list that feeds this is hand-maintained and being strict
 * about the input format buys nothing. Only the id is kept, so a link copied
 * while the video played inside a mix or a playlist does not carry
 * `&list=RD…&start_radio=1` into the file and drop every reader into whatever
 * YouTube plays next.
 *
 * Returns null for anything that is not a plausible id — YouTube's are exactly
 * 11 characters of the URL-safe alphabet — which every caller renders as no
 * link rather than as a broken one.
 *
 * **One parser, two curated files.** `club-hymns.ts` and `club-videos.ts` store
 * the same kind of value and a second copy of this is how one of them comes to
 * accept a `youtu.be` link the other rejects. It is the rule `slugify` already
 * carries in this file, and the one `venue-core.ts` reuses it under.
 */
export const youtubeVideoId = (raw: string | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  let id = value;
  if (value.includes("/")) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    id =
      url.searchParams.get("v") ??
      // youtu.be/<id>, /embed/<id>, /shorts/<id> — the last path segment.
      (url.pathname.split("/").filter(Boolean).pop() ?? "");
  }

  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
};

/** The canonical watch address for a video id, or null if there is no id to
 *  build one from. The origin is written **here and nowhere else**, so the
 *  hymn link and the Vídeos rail cannot come to point at two spellings of
 *  YouTube. */
export const videoWatchUrl = (raw: string | undefined): string | null => {
  const id = youtubeVideoId(raw);
  return id && `https://www.youtube.com/watch?v=${id}`;
};

/**
 * The **player** address for a video — the one that goes in an `<iframe>`.
 *
 * Written here beside `videoWatchUrl` for that function's stated reason: the
 * origin is spelled in one place, so the link a reader can copy and the frame
 * a reader can watch cannot come to disagree about what YouTube is.
 *
 * **The host is `youtube-nocookie.com`, which is YouTube's own
 * privacy-enhanced mode**, and it is the whole reason an embed is defensible
 * here at all: it serves the same player from the same API without writing
 * the tracking cookies `www.youtube.com` writes on load. `CONTEXT.md`'s
 * **Hino do clube** and **Vídeos do clube** entries both refuse an embedded
 * player, and both are about the **club** page, where a video is one of a
 * dozen things offered. `MatchHighlights` records why the Partida page is the
 * one place that argument does not reach; neither entry's own decision
 * changes.
 *
 * **There is deliberately no `autoplay`, and that absence is the load-bearing
 * half.** The frame renders with the section rather than on a click, so a
 * video that started by itself would be **Hino do clube**'s objection exactly
 * — a video nobody asked for, playing at whatever volume the reader's device
 * is on, on a page they may have opened for the scoreline. What renders is a
 * poster and YouTube's own play button, which is one press either way, and the
 * press is the reader's.
 *
 * The two parameters it does set:
 *
 * - **`playsinline=1`** — without it iOS Safari takes the video fullscreen and
 *   out of the page, which is exactly the leaving-the-page this replaces.
 * - **`rel=0`** — since 2018 this no longer removes the end-of-video
 *   suggestions, it restricts them to the **same channel**. That is the honest
 *   description and it is still worth setting: what follows a broadcaster's
 *   package is then more of that broadcaster, not whatever the platform would
 *   like a reader to watch next.
 *
 * Null for anything `youtubeVideoId` will not parse, which the caller renders
 * as an ordinary link-out — the degradation `videoThumbnailUrl` and
 * `hymnUrl` already take.
 */
/**
 * The origin and the parameters every player address here is built from,
 * written **once** for `videoWatchUrl`'s stated reason: two spellings of
 * YouTube is how the link a reader can copy and the frame a reader can watch
 * come to disagree about what YouTube is.
 */
const embedAddress = (id: string, params: string): string =>
  `https://www.youtube-nocookie.com/embed/${id}?${params}`;

const PLAYER_PARAMS = "playsinline=1&rel=0";

export const videoEmbedUrl = (raw: string | undefined): string | null => {
  const id = youtubeVideoId(raw);
  return id && embedAddress(id, PLAYER_PARAMS);
};

/**
 * The player address for a video the reader has just **pressed play on**, which
 * is the only address in this file that carries `autoplay`.
 *
 * **Two named functions rather than one taking a flag**, which is the rule
 * `serialiseDevicePreferences` already states: a boolean at a call site is easy
 * to pass wrong and impossible to see in a diff, and the thing being got wrong
 * here is the single parameter `CONTEXT.md` spends two entries refusing.
 *
 * **`autoplay` is not a softening of that refusal — it is what keeps the press
 * count at one.** `videoEmbedUrl` above is for a frame that renders *with* its
 * section, where the reader has asked for nothing and the poster plus YouTube's
 * own play button is the whole safeguard. This one is for a frame that exists
 * **because** the reader pressed play: `ClubVideos` mounts it in the click
 * handler, so without `autoplay` their press would put a second play button
 * under their cursor and ask them to press it again. The video still starts on
 * a user gesture and never on a page load, which is what the objection was
 * always about.
 *
 * Never call it where a frame renders unasked. `ClubVideos` is its only caller
 * and mounts nothing until a card is pressed; `MatchHighlights`, whose frame
 * *does* render with its section, takes `videoEmbedUrl` and must keep to it.
 */
export const videoPressedEmbedUrl = (raw: string | undefined): string | null => {
  const id = youtubeVideoId(raw);
  return id && embedAddress(id, `${PLAYER_PARAMS}&autoplay=1`);
};

/**
 * YouTube's own thumbnail for a video, at the size that always exists.
 *
 * `hqdefault` is 480×360 and is generated for every video — the higher
 * `maxresdefault` is **not**, and 404s for anything uploaded below that
 * resolution, which renders as a broken image on exactly the entries a curator
 * is least likely to re-check. So this is the address the rail falls back to,
 * and `videoThumbnailHdUrl` is the one it tries first; see that function for
 * why the rail needs a second size at all.
 *
 * **Hotlinked rather than vendored, which is the opposite of the stadium and
 * player photographs and rests on a different argument.** Those are somebody's
 * copyrighted work fetched from a volunteer-run host that answers a burst with a
 * 429; this is the platform's own artwork for the video, served from its image
 * CDN for precisely this purpose. Vendoring it would also freeze it: an uploader
 * who changes a thumbnail would leave us serving the old one for ever, with
 * nothing to notice.
 *
 * The host is still a third party the **e2e suite must not reach**, so it is in
 * `OFFLINE_HOSTS` in `tests/e2e/fixtures.ts` beside the crest CDN — that list
 * exists for exactly this decision.
 */
export const videoThumbnailUrl = (raw: string | undefined): string | null => {
  const id = youtubeVideoId(raw);
  return id && `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
};

/**
 * The same thumbnail at 1280×720, which the rail asks for first.
 *
 * **It exists because of the reader's screen rather than the card's width.**
 * The card is capped at 26rem, and `hqdefault` covers that at 1× — 480 CSS px
 * of picture behind 416 of card. Every phone this app is read on is 2× or 3×,
 * so a 328px card on a 360dp screen is asking for **984 device pixels** and
 * `hqdefault` has 480 of them. These entries are Manim renders full of small
 * type, which is the content that shows it first.
 *
 * **It is also the one that is not letterboxed.** `hqdefault` is 4:3 with the
 * picture inside black bars, so the rail's `object-cover` is cropping them
 * away; `maxresdefault` is native 16:9 and nothing is cropped. Two reasons, and
 * the crop is the one that would be easy to read as a rendering bug rather than
 * as the source.
 *
 * **This address may 404 and the caller must survive it**, which is the whole
 * reason the two are separate functions rather than a size parameter with a
 * default: a parameter reads as a preference, and this is a promise the
 * platform does not make. `ClubVideos` swaps to `videoThumbnailUrl` on `error`,
 * the way `ClubCrest` swaps to a monogram. Measured 2026-09-06 against the two
 * ids in `club-videos.ts`: both answer 200 at 1280×720 — which is a reading of
 * today's entries, not a property of the file, since a curator may add a video
 * that was never uploaded above 480p.
 *
 * **Never let this one reach the e2e suite either.** It is the same host, so
 * `img.youtube.com` in `OFFLINE_HOSTS` already covers it — and note what that
 * stub does to the fallback: it fulfils **200**, so the `error` branch is
 * unreachable by default and a spec asserting it has to route a 404 itself, as
 * `crest-fallback.spec.ts` drives a 503.
 */
export const videoThumbnailHdUrl = (raw: string | undefined): string | null => {
  const id = youtubeVideoId(raw);
  return id && `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
};

/**
 * The canonical watch address for a hymn video.
 *
 * Kept as its own name rather than folded into `videoWatchUrl`, because the two
 * read differently at the call site and `ClubView` has both: one is *the club's
 * hymn*, the other is *an entry in the rail*. They are the same function today
 * and there is no second implementation to drift.
 */
export const hymnUrl = (raw: string | undefined): string | null => videoWatchUrl(raw);

/**
 * The canonical article address for a Wikipedia title.
 *
 * Accepts what a person is likely to paste — a bare title with spaces or with
 * underscores, or a full `pt.wikipedia.org/wiki/…` link — because the list is
 * hand-maintained and being strict about the input format buys nothing. Only
 * the title is kept, so a link copied from the article's edit view or from a
 * section heading does not carry `?action=edit` or `#História` into the file.
 *
 * The edition is fixed to **pt**, and a URL naming another one returns null
 * rather than being rewritten: `Grêmio Foot-Ball Porto Alegrense` is not an
 * article on the English Wikipedia, so rewriting an `en.` link would produce a
 * plausible address that 404s, and the whole app is pt-BR anyway.
 *
 * Underscores are what the address uses and spaces are what the file reads, so
 * the title is stored with spaces and converted here. The rest is
 * percent-encoded rather than transliterated — unlike a club **slug**, where
 * stripping accents keeps the address typeable, `Gremio…` is simply a different
 * article title and would not resolve.
 *
 * Returns null for anything that is not a plausible title — Wikipedia forbids
 * `#<>[]|{}` in one — which the UI renders as no link rather than a broken one.
 */
export const wikipediaUrl = (raw: string | null | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  let title = value;
  if (value.includes("/")) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    if (url.hostname !== "pt.wikipedia.org") return null;
    if (!url.pathname.startsWith("/wiki/")) return null;
    try {
      title = decodeURIComponent(url.pathname.slice("/wiki/".length));
    } catch {
      return null;
    }
  }

  title = title.replace(/_/g, " ").trim();
  if (!title || /[#<>[\]|{}]/.test(title)) return null;

  return `https://pt.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
};

/** Attach curated handles to a club list, keyed by code. */
export const withInstagram = (clubs: Club[], handles: Record<string, string>): Club[] =>
  clubs.map((club) => {
    const handle = handles[club.code];
    return handle && !club.instagram ? { ...club, instagram: handle } : club;
  });

/** Attach curated hymn video ids to a club list, keyed by code. */
export const withHymns = (clubs: Club[], hymns: Record<string, string>): Club[] =>
  clubs.map((club) => {
    const hymn = hymns[club.code];
    return hymn && !club.hymn ? { ...club, hymn } : club;
  });

/** Attach curated subreddit names to a club list, keyed by code. */
export const withReddit = (clubs: Club[], subs: Record<string, string>): Club[] =>
  clubs.map((club) => {
    const reddit = subs[club.code];
    return reddit && !club.reddit ? { ...club, reddit } : club;
  });

/** Attach curated Discord invites to a club list, keyed by code. A server is
 *  the supporters' and not the club's, exactly as a subreddit is — see
 *  `src/data/club-discord.ts` for what that costs the screen-reader suffix.
 *
 *  Only the **invite** travels onto the club: the guild id beside it in the
 *  curated file is evidence for `check-club-discord` and is not something any
 *  page renders, so putting it on twenty club objects and through every payload
 *  would be upkeep for no reader — the rule `Club.coach` already states about a
 *  shirt number nothing dereferences. */
export const withDiscord = (clubs: Club[], invites: Record<string, ClubDiscord>): Club[] =>
  clubs.map((club) => {
    const discord = invites[club.code]?.invite;
    return discord && !club.discord ? { ...club, discord } : club;
  });

/** Attach curated Wikipedia article titles to a club list, keyed by code. */
export const withWikipedia = (clubs: Club[], articles: Record<string, string>): Club[] =>
  clubs.map((club) => {
    const wikipedia = articles[club.code];
    return wikipedia && !club.wikipedia ? { ...club, wikipedia } : club;
  });

/**
 * The name to print as a club's head coach, or null when nothing knows one.
 *
 * Two sources, and the precedence is the point. `/api/coaches` is read from the
 * team list on the request, while `club.coach` is whatever the last
 * `sync-seed-data` froze into `clubs.ts` — so the map wins where it has an
 * answer and the club's own field is the floor beneath it. That is the opposite
 * of `withClubDetails`' rule, deliberately: there the committed list supplies
 * what a live payload never carries, here it holds a copy that expires.
 *
 * Falling back at all is what keeps the line on the page when that request
 * fails, which is the same reasoning the API envelope follows one layer up.
 */
export const coachOf = (
  club: Club,
  coaches?: Record<ClubCode, string>,
): string | null => coaches?.[club.code]?.trim() || club.coach?.trim() || null;

/**
 * The coaches a club list knows about, keyed by club code.
 *
 * The inverse of `coachOf`, and what `/api/coaches` answers with: a club with no
 * coach is left out entirely rather than mapped to an empty string, so the
 * absence survives the round trip instead of arriving as a value the page would
 * have to test for a second time.
 */
export const coachesOf = (clubs: Club[]): Record<ClubCode, string> => {
  const coaches: Record<ClubCode, string> = {};

  for (const club of clubs) {
    if (club.coach) coaches[club.code] = club.coach;
  }

  return coaches;
};

/**
 * The club's **sede** as one readable line, or null when there is nothing to
 * show.
 *
 * football-data builds this field by interpolation and does not check its own
 * columns first, so a club whose street or postcode is unknown arrives with the
 * literal word `null` standing in that position — three of the twenty read
 * `"null São Paulo, SP null"`. Rendered verbatim, that is what the page says,
 * and it looks like our bug rather than upstream's.
 *
 * Only a **leading and a trailing** token is stripped, anchored rather than
 * replaced wherever it occurs: everything between them is a street and a
 * neighbourhood copied as upstream wrote them, and an address this app cannot
 * parse is not one it should be editing. It cannot parse it because there is no
 * separator between the neighbourhood and the city — `"Bairro Laranjeiras Rio de
 * Janeiro, RJ"` — which is also why the result is a line rather than components.
 *
 * A club left with only its city keeps that; a club left with nothing at all
 * returns null, so the caller omits the row instead of printing an empty one.
 */
export const clubAddress = (raw: string | null | undefined): string | null => {
  const line = (raw ?? "")
    .replace(/^\s*null\b\s*/i, "")
    .replace(/\s*\bnull\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return line || null;
};

/**
 * The club's **sede** on Google Maps — or null where the provider reported no
 * usable address, in which case the caller renders no pin at all rather than a
 * link that searches for nothing.
 *
 * The sibling of `stadiumMapUrl` in `venue-core.ts`, and deliberately the same
 * documented `?api=1&query=` form rather than a second convention: that is
 * Google's published Maps URLs contract, where the `/maps/place/…` shape a
 * browser's address bar hands you is the app's own internal address and changes
 * without notice. What differs is only what there is to point at. A ground has
 * a verified coordinate; a sede has a **postal line and nothing else** — the
 * provider interpolates it without separators, so it cannot be split into
 * fields (see `clubAddress`) and there is nothing here to geocode with. The
 * whole line therefore goes in as a search term, which is what `query` accepts.
 *
 * That is why this returns a *search*, not a pin: a coordinate names a point
 * and an address names whatever Google decides it names. It can land on the
 * street rather than the door, and for a club whose address arrived
 * half-populated it can land on the city. Pointing a reader at the right city
 * is worth more than an inert glyph, but it is not the same promise the
 * estádio pin makes, and the two should not be read as one.
 *
 * The address is passed through `clubAddress` first, so a `"null São Paulo, SP
 * null"` from upstream is searched as the part that is real. Encoding is
 * `encodeURIComponent`, which is what makes `nº`, the accents and the commas
 * survive the trip — a raw `+`-joined query would corrupt exactly the clubs
 * whose addresses carry them.
 */
export const clubMapUrl = (raw: string | null | undefined): string | null => {
  const address = clubAddress(raw);
  if (!address) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
};

/**
 * Fill in details the live payloads omit.
 *
 * Club objects embedded in standings and fixtures carry only id, name, crest
 * and abbreviation — the website, the sede, the head coach and the home state
 * come from the teams endpoint, and the Instagram handle, the subreddit, the
 * hymn and the Wikipedia article from no endpoint at all. So the committed club
 * list supplies all eight at request time.
 *
 * The coach is the one of the seven that goes stale between snapshots — a club
 * changes técnico far more often than it moves or renames itself — which is why
 * it is also served live by `/api/coaches`. What the seed supplies here is the
 * floor, not the whole answer.
 *
 * **`state` was missing from this list for as long as the list existed**, and
 * nothing could have caught it. It is the UF beside the club's full name, so a
 * production page read "Fluminense FC" where the offline one read "Fluminense FC
 * · RJ" — and every test in the suite runs against the frozen snapshot
 * (`DISABLE_FOOTBALL_DATA=true`), where the seed carries the field and the line
 * is therefore correct. The only build that rendered the bug was the one nothing
 * asserts against. Worth remembering before adding the ninth: this function is
 * the one place where "works in CI" and "works in production" genuinely differ.
 * `reddit` was the eighth, and it was written here in the same commit as the
 * field itself for exactly that reason — the seed branch every suite runs would
 * have rendered the link while production, which builds its clubs from the live
 * payload, quietly rendered nothing.
 */
/**
 * Replace a club's técnico where the provider names the wrong person.
 *
 * **Separate from `withClubDetails` on purpose, and it is the same split
 * `player-overrides.ts` draws from `squads.ts`.** That function *fills* — it
 * supplies what no live payload carries, so it reads `club.coach ?? source`
 * and the provider wins every tie. This one *corrects*, so the override wins.
 * Folding the two together would make `withClubDetails` mean both, and the
 * next reader could not tell from a call site which one a field got.
 *
 * A code with no override passes through untouched, and an override naming a
 * club that is not in the list is simply unused rather than an error — the list
 * is whatever the caller happens to hold, and a standings payload missing a
 * promoted club is not this function's problem. `tests/club-core.test.ts` is
 * where an override naming a club nobody has earns its complaint.
 */
export const withCoachOverrides = (
  clubs: Club[],
  overrides: Record<ClubCode, string>,
): Club[] =>
  clubs.map((club) => {
    const coach = overrides[club.code]?.trim();
    return coach ? { ...club, coach } : club;
  });

export const withClubDetails = (clubs: Club[], known: Club[]): Club[] => {
  const byCode = new Map(known.map((club) => [club.code, club]));

  return clubs.map((club) => {
    const source = byCode.get(club.code);
    const website = club.website ?? source?.website;
    const instagram = club.instagram ?? source?.instagram;
    const reddit = club.reddit ?? source?.reddit;
    const discord = club.discord ?? source?.discord;
    const hymn = club.hymn ?? source?.hymn;
    const wikipedia = club.wikipedia ?? source?.wikipedia;
    const address = club.address ?? source?.address;
    const coach = club.coach ?? source?.coach;
    const state = club.state ?? source?.state;

    return {
      ...club,
      ...(website ? { website } : {}),
      ...(instagram ? { instagram } : {}),
      ...(reddit ? { reddit } : {}),
      ...(discord ? { discord } : {}),
      ...(hymn ? { hymn } : {}),
      ...(wikipedia ? { wikipedia } : {}),
      ...(address ? { address } : {}),
      ...(coach ? { coach } : {}),
      ...(state ? { state } : {}),
    };
  });
};
