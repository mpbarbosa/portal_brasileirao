/**
 * Pure derivations whose subject is a club. No I/O — the club view composes data
 * the client already holds (standings, fixtures, scorers), so this module exists
 * to keep the slicing rules testable rather than buried in a component.
 *
 * A function whose subject is a third-party host's address grammar, or a
 * normaliser with no subject at all, lives in a module named for it —
 * `slug-core`, `youtube-core`, `instagram-core`, `wikipedia-core` — even where a
 * club is one of its callers: players, matches, stadiums and scripts call them
 * as much as clubs do. The subreddit, Discord, X and Facebook parsers stay here because
 * only a club carries any of them.
 */
import { compareByKickoff, isConcluded } from "@/matches-core";
import { slugify } from "@/slug-core";
import { countsTowardStandings } from "@/standings-core";
import { videoWatchUrl, youtubeVideoId } from "@/youtube-core";
import type {
  Club,
  ClubCode,
  ClubDiscord,
  ClubFacebook,
  ClubVideo,
  ClubYouTube,
  FormResult,
  Match,
  Scorer,
  StandingsRow,
} from "@/src/types";

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

  // Discord's own rule for a MINTED code is alphanumeric inside 2–32
  // characters, and that bound stood here until a real one broke it: the
  // vanity Discord issues for a large Discoverable community embeds the
  // guild's own snowflake — `cruzeiro-e-c-1k-1168068145848799313`, 35
  // characters — confirmed by the invite API returning it as the guild's own
  // `vanity_url_code`, not merely accepted as a code. The snowflake-only
  // refusal above still catches a bare id lifted out of a `channels/` URL,
  // because this shape is never *all* digits; only the ceiling had to move.
  return (/^[A-Za-z0-9-]{2,32}$/.test(code) || /^(?=.{33,60}$)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*-[0-9]{17,20}$/.test(code)) ? code : null;
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
 * X's own app paths. Each satisfies the handle rule below and none is an
 * account, and most answer 200 exactly as an account does — measured
 * 2026-09-15 without a session: `home`, `search`, `hashtag`, `settings`,
 * `messages`, `notifications`, `login`, `signup`, `compose`, `share` and `jobs`
 * all 200. `i` is the one that matters most: a logged-out browser is redirected
 * to `x.com/i/flow/login?…`, which is the address bar somebody copies from.
 */
const X_APP_PATHS = new Set([
  "about", "compose", "explore", "hashtag", "home", "i", "intent", "jobs", "login",
  "messages", "notifications", "privacy", "search", "settings", "share", "signup", "tos",
]);

/**
 * The X (formerly Twitter) handle alone, from whatever was written down.
 *
 * `subredditName`'s shape: accepts a bare handle, an `@handle`, or a pasted
 * `x.com/…` or `twitter.com/…` address — a post's permalink included, whose
 * first segment is the account that posted it — and keeps only the handle, so a
 * pasted link's `?s=20` share suffix does not survive into the file.
 *
 * **The casing survives**, for `subredditName`'s reason: X resolves a handle
 * case-insensitively (`x.com/FLAMENGO` answers byte-for-byte what
 * `x.com/Flamengo` does) but the account displays one form, and the handle is
 * what the link *says*.
 *
 * **X's app paths are refused**, because they pass the character rule and
 * answer 200 — so a pasted login redirect would be stored as the handle `i` and
 * pass `check-club-twitter` too. A refusal that reads as an acceptance is
 * `discordInvite`'s trap, one host over.
 *
 * Returns null for anything that is not a plausible handle — X's rule is
 * letters, digits and underscores, up to 15 characters.
 */
export const twitterHandle = (raw: string | null | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  const afterHost = value.replace(/^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\//i, "");
  const handle = afterHost.split(/[/?#]/)[0].replace(/^@/, "");

  if (X_APP_PATHS.has(handle.toLowerCase())) return null;
  return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? handle : null;
};

/**
 * The address for a handle, built from the normalised handle rather than from
 * the raw value — so the link and the `@handle` printed beside it cannot come to
 * name two different accounts. `redditUrl`'s rule.
 *
 * `x.com` rather than `twitter.com`, because the old host answers every profile
 * with a redirect to the new one.
 */
export const twitterUrl = (raw: string | null | undefined): string | null => {
  const handle = twitterHandle(raw);
  return handle && `https://x.com/${handle}`;
};

/**
 * Facebook's own routes. Each is a path under `facebook.com` that is not a page
 * and passes the username rule below, so a pasted link to a group, a video or
 * the login screen would otherwise be stored as a page called `groups`, `watch`
 * or `login`. `profile.php` and the other `.php` routes are refused beside this
 * set rather than listed in it.
 */
const FACEBOOK_ROUTES = new Set([
  "business", "events", "gaming", "groups", "hashtag", "login", "marketplace",
  "messages", "notifications", "pages", "people", "photo", "photos", "policies",
  "privacy", "reels", "search", "settings", "share", "sharer", "stories", "watch",
]);

/**
 * A Facebook page's username alone, from whatever was written down.
 *
 * `twitterHandle`'s shape: a bare username, an `@username`, or a pasted
 * `facebook.com/…` address — with a tab or a post after the username, a
 * tracking suffix, or a locale host like `pt-br.facebook.com`, which is what
 * Chapecoense's own site links — and keeps only the username.
 *
 * **The casing survives**, for `twitterHandle`'s reason: Facebook resolves a
 * username case-insensitively (`VascodaGama` opens the page whose own address
 * reads `vascodagama`), but each page states one form.
 *
 * **Refused rather than salvaged**, each for a reason:
 *
 * - Facebook's routes and anything ending `.php`. A page with no username is
 *   `profile.php?id=…`, which would otherwise be stored as `profile.php`.
 * - An all-digit value. That is a page **id**, the other half of
 *   `ClubFacebook`, and stored as the username it would build an address that
 *   `check-club-facebook` confirms against itself — `discordInvite`'s snowflake
 *   refusal, one host over.
 * - A value ending like a domain. Pasted without its scheme, another host's
 *   address (`instagram.com/flamengo`) would otherwise pass as a dotted
 *   username, since full stops are legal in one.
 *
 * Returns null for anything else that is not a plausible username — letters,
 * digits and full stops, at least five characters.
 */
export const facebookHandle = (raw: string | null | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  const afterHost = value.replace(
    /^(?:https?:\/\/)?(?:(?:www|m|web|[a-z]{2}-[a-z]{2})\.)?facebook\.com\//i,
    "",
  );
  const handle = afterHost.split(/[/?#]/)[0].replace(/^@/, "");

  if (FACEBOOK_ROUTES.has(handle.toLowerCase()) || /\.php$/i.test(handle)) return null;
  if (/^[0-9]+$/.test(handle) || /\.(?:com|net|org)(?:\.br)?$/i.test(handle)) return null;
  return /^[A-Za-z0-9.]{5,50}$/.test(handle) ? handle : null;
};

/**
 * The address for a page, built from the normalised username rather than from
 * the raw value — `redditUrl`'s rule. With the trailing slash, because that is
 * the form every page states as its own canonical address (`og:url`).
 */
export const facebookUrl = (raw: string | null | undefined): string | null => {
  const handle = facebookHandle(raw);
  return handle && `https://www.facebook.com/${handle}/`;
};

/** A Facebook page id: digits only, as a page's own markup states it. */
export const isFacebookPageId = (value: string): boolean => /^[0-9]{5,20}$/.test(value);

/**
 * The canonical watch address for a hymn video.
 *
 * Kept as its own name rather than folded into `videoWatchUrl`, because the two
 * read differently at the call site and `ClubView` has both: one is *the club's
 * hymn*, the other is *an entry in the rail*. They are the same function today
 * and there is no second implementation to drift.
 */
export const hymnUrl = (raw: string | undefined): string | null => videoWatchUrl(raw);

/** Attach curated handles to a club list, keyed by code. */
export const withInstagram = (clubs: Club[], handles: Record<string, string>): Club[] =>
  clubs.map((club) => {
    const handle = handles[club.code];
    return handle && !club.instagram ? { ...club, instagram: handle } : club;
  });

/** Attach curated X handles to a club list, keyed by code. */
export const withTwitter = (clubs: Club[], handles: Record<string, string>): Club[] =>
  clubs.map((club) => {
    const twitter = handles[club.code];
    return twitter && !club.twitter ? { ...club, twitter } : club;
  });

/** Attach curated YouTube channel handles to a club list, keyed by code. Only
 *  the **handle** travels onto the club; the channel id beside it in the curated
 *  file is evidence for `check-club-youtube`, for `withDiscord`'s reason. */
export const withYouTube = (clubs: Club[], channels: Record<string, ClubYouTube>): Club[] =>
  clubs.map((club) => {
    const youtube = channels[club.code]?.handle;
    return youtube && !club.youtube ? { ...club, youtube } : club;
  });

/** Attach curated Facebook usernames to a club list, keyed by code. Only the
 *  **username** travels onto the club; the page id beside it in the curated
 *  file is evidence for `check-club-facebook`, for `withDiscord`'s reason. */
export const withFacebook = (clubs: Club[], pages: Record<string, ClubFacebook>): Club[] =>
  clubs.map((club) => {
    const facebook = pages[club.code]?.handle;
    return facebook && !club.facebook ? { ...club, facebook } : club;
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
 * payload, quietly rendered nothing. `twitter` arrived the same way, in the
 * commit that added the field.
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

/**
 * Replace a club's official site where the provider names an address that is no
 * longer the club's.
 *
 * `withCoachOverrides`' twin, and a *correction* for the same reason: a club's
 * `website` reaches a reader through `withClubDetails`, which **fills** from the
 * committed list and lets the payload win every tie. This one overrules both.
 *
 * **Today no live payload carries a website at all** — `clubFromTeam` maps id,
 * name, shortName, tla, slug, crest and coach and drops the `website` the teams
 * endpoint does serve, which is why `sync-seed-data` has to read that endpoint
 * itself to write `clubs.ts`. So the override could be applied to the frozen
 * list alone and every route would be right. It is applied at every site the
 * coach correction is applied at regardless, because "the mapper happens not to
 * read this field" is a claim that produces no work while it holds: adding one
 * line to `clubFromTeam` would put the provider's value back on the live squads
 * path, and nothing would go red — the suite runs the seed branch.
 *
 * A code with no override passes through untouched, and an override naming a
 * club the caller does not hold is unused rather than an error.
 * `tests/club-core.test.ts` is where an override naming a club nobody has, or
 * one that no longer corrects anything, earns its complaint.
 */
export const withWebsiteOverrides = (
  clubs: Club[],
  overrides: Record<ClubCode, string>,
): Club[] =>
  clubs.map((club) => {
    const website = overrides[club.code]?.trim();
    return website ? { ...club, website } : club;
  });

export const withClubDetails = (clubs: Club[], known: Club[]): Club[] => {
  const byCode = new Map(known.map((club) => [club.code, club]));

  return clubs.map((club) => {
    const source = byCode.get(club.code);
    const website = club.website ?? source?.website;
    const instagram = club.instagram ?? source?.instagram;
    const twitter = club.twitter ?? source?.twitter;
    const youtube = club.youtube ?? source?.youtube;
    const facebook = club.facebook ?? source?.facebook;
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
      ...(twitter ? { twitter } : {}),
      ...(youtube ? { youtube } : {}),
      ...(facebook ? { facebook } : {}),
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

/**
 * The keys more than one club shares — an empty list when every code, short name
 * and slug is unique.
 *
 * `sync-seed-data` refuses to write a seed where this is non-empty, for the
 * reason stated there: a display-name override keyed to the wrong id renames the
 * wrong club, which reads as perfectly plausible data, and two clubs sharing a
 * slug share a URL. It lived inline in that script, after its top-level
 * requests, so no test could reach it. An absent slug is not a duplicate of
 * another absent slug.
 */
export const duplicateClubKeys = (
  clubs: Pick<Club, "code" | "shortName" | "slug">[],
): { key: "code" | "shortName" | "slug"; values: string[] }[] =>
  (["code", "shortName", "slug"] as const)
    .map((key) => ({
      key,
      values: clubs
        .map((club) => club[key])
        .filter((value, i, all): value is string => Boolean(value) && all.indexOf(value) !== i),
    }))
    .filter((entry) => entry.values.length > 0);
