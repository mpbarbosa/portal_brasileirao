import assert from "node:assert/strict";
import { test } from "node:test";

import { COACH_OVERRIDES } from "@/src/data/coach-overrides";
import { CLUBS } from "@/src/data/clubs";
import { CLUB_HYMNS } from "@/src/data/club-hymns";
import { CLUB_DISCORD } from "@/src/data/club-discord";
import { CLUB_REDDIT } from "@/src/data/club-reddit";
import { CLUB_WIKIPEDIA } from "@/src/data/club-wikipedia";
import {
  clubAddress,
  clubArticle,
  clubKey,
  clubMapUrl,
  clubMatches,
  coachOf,
  coachesOf,
  crestMonogram,
  discordInvite,
  discordUrl,
  findClub,
  hasClubArticle,
  hymnUrl,
  instagramHandle,
  instagramPostCode,
  instagramPostEmbedUrl,
  instagramPostUrl,
  instagramUrl,
  redditUrl,
  subredditName,
  lastFixture,
  nextFixture,
  ofClub,
  ofClubs,
  officialSiteUrl,
  playsIn,
  recentForm,
  resultFor,
  scorersFor,
  slugify,
  standingFor,
  videoEmbedUrl,
  videoPressedEmbedUrl,
  videoWatchUrl,
  wikipediaUrl,
  youtubeVideoId,
  withClubDetails,
  withCoachOverrides,
  withHymns,
  withInstagram,
  withReddit,
  withWikipedia,
} from "@/club-core";
import type { Match, Scorer, StandingsRow } from "@/src/types";

const match = (overrides: Partial<Match> & Pick<Match, "id">): Match => ({
  round: 1,
  kickoff: "2026-04-11T19:00:00Z",
  status: "FINISHED",
  homeCode: "A",
  awayCode: "B",
  homeGoals: 0,
  awayGoals: 0,
  ...overrides,
});

test("a club is in a match whether it plays home or away", () => {
  assert.equal(playsIn(match({ id: "m" }), "A"), true);
  assert.equal(playsIn(match({ id: "m" }), "B"), true);
  assert.equal(playsIn(match({ id: "m" }), "C"), false);
});

test("results are read from the club's point of view", () => {
  const home = match({ id: "m", homeGoals: 2, awayGoals: 1 });

  assert.equal(resultFor(home, "A"), "V");
  assert.equal(resultFor(home, "B"), "D");
  assert.equal(resultFor(match({ id: "d", homeGoals: 1, awayGoals: 1 }), "A"), "E");
});

test("an unfinished match has no result", () => {
  assert.equal(resultFor(match({ id: "s", status: "SCHEDULED", homeGoals: null }), "A"), null);
  assert.equal(
    resultFor(match({ id: "l", status: "LIVE", homeGoals: 3, awayGoals: 0 }), "A"),
    null,
  );
  assert.equal(resultFor(match({ id: "p", status: "POSTPONED" }), "A"), null);
});

test("a club not in the match has no result for it", () => {
  assert.equal(resultFor(match({ id: "m" }), "Z"), null);
});

test("club fixtures are chronological and exclude other clubs", () => {
  const all = [
    match({ id: "late", kickoff: "2026-05-01T19:00:00Z" }),
    match({ id: "other", homeCode: "C", awayCode: "D" }),
    match({ id: "early", kickoff: "2026-04-01T19:00:00Z" }),
  ];

  assert.deepEqual(clubMatches(all, "A").map((m) => m.id), ["early", "late"]);
});

test("form is the last results, oldest first", () => {
  const all = Array.from({ length: 7 }, (_, i) =>
    match({
      id: `m${i}`,
      kickoff: `2026-04-0${i + 1}T19:00:00Z`,
      homeGoals: i,
      awayGoals: 0,
    }),
  );

  // i=0 is a draw (0-0), the rest are wins.
  assert.deepEqual(recentForm(all, "A"), ["V", "V", "V", "V", "V"]);
  assert.deepEqual(recentForm(all, "A", 7), ["E", "V", "V", "V", "V", "V", "V"]);
});

test("a postponed fixture does not punch a hole in the form guide", () => {
  const all = [
    match({ id: "w", kickoff: "2026-04-01T19:00:00Z", homeGoals: 1, awayGoals: 0 }),
    match({ id: "p", kickoff: "2026-04-08T19:00:00Z", status: "POSTPONED", homeGoals: null }),
    match({ id: "l", kickoff: "2026-04-15T19:00:00Z", homeGoals: 0, awayGoals: 2 }),
  ];

  assert.deepEqual(recentForm(all, "A"), ["V", "D"]);
});

test("the next fixture is the earliest one still to be played", () => {
  const all = [
    match({ id: "done", kickoff: "2026-04-01T19:00:00Z" }),
    match({ id: "soon", kickoff: "2026-04-08T19:00:00Z", status: "SCHEDULED", homeGoals: null }),
    match({ id: "later", kickoff: "2026-04-15T19:00:00Z", status: "SCHEDULED", homeGoals: null }),
  ];

  assert.equal(nextFixture(all, "A")?.id, "soon");
});

test("a cancelled fixture is never offered as the next one", () => {
  const all = [
    match({ id: "cancelled", kickoff: "2026-04-08T19:00:00Z", status: "CANCELLED", homeGoals: null }),
    match({ id: "real", kickoff: "2026-04-15T19:00:00Z", status: "SCHEDULED", homeGoals: null }),
  ];

  assert.equal(nextFixture(all, "A")?.id, "real");
});

test("a postponed fixture is passed over while a real one is pending", () => {
  // The defect this rule exists for. A postponed match keeps its OLD kickoff until upstream
  // re-schedules it, so it sorts first and the club page led with a date already gone — on all
  // six clubs holding a postponed round-21 fixture in 2026, while the Meu time strip named the
  // real match four days out.
  const all = [
    match({ id: "adiado", kickoff: "2026-07-29T00:00:00Z", status: "POSTPONED", homeGoals: null }),
    match({ id: "real", kickoff: "2026-09-13T19:00:00Z", status: "SCHEDULED", homeGoals: null }),
  ];

  assert.equal(nextFixture(all, "A")?.id, "real");
});

test("a postponed fixture is still offered when it is all that is left", () => {
  // Passed over, never dropped: an empty section would tell a reader the season is finished.
  const all = [
    match({ id: "done", kickoff: "2026-04-01T19:00:00Z" }),
    match({ id: "adiado", kickoff: "2026-07-29T00:00:00Z", status: "POSTPONED", homeGoals: null }),
  ];

  assert.equal(nextFixture(all, "A")?.id, "adiado");
});

test("passing over the postponed one does not reorder what is left", () => {
  const all = [
    match({ id: "adiado", kickoff: "2026-07-29T00:00:00Z", status: "POSTPONED", homeGoals: null }),
    match({ id: "later", kickoff: "2026-09-20T19:00:00Z", status: "SCHEDULED", homeGoals: null }),
    match({ id: "soon", kickoff: "2026-09-13T19:00:00Z", status: "SCHEDULED", homeGoals: null }),
  ];

  assert.equal(nextFixture(all, "A")?.id, "soon");
});

test("a live match outranks a later scheduled one, postponed rule or not", () => {
  const all = [
    match({ id: "adiado", kickoff: "2026-07-29T00:00:00Z", status: "POSTPONED", homeGoals: null }),
    match({ id: "agora", kickoff: "2026-09-13T19:00:00Z", status: "LIVE", homeGoals: 0 }),
    match({ id: "later", kickoff: "2026-09-20T19:00:00Z", status: "SCHEDULED", homeGoals: null }),
  ];

  assert.equal(nextFixture(all, "A")?.id, "agora");
});

test("there is no next fixture once everything is played", () => {
  assert.equal(nextFixture([match({ id: "done" })], "A"), null);
});

test("the last fixture is the most recently finished one", () => {
  const all = [
    match({ id: "first", kickoff: "2026-04-01T19:00:00Z" }),
    match({ id: "second", kickoff: "2026-04-08T19:00:00Z" }),
    match({ id: "upcoming", kickoff: "2026-04-15T19:00:00Z", status: "SCHEDULED", homeGoals: null }),
  ];

  assert.equal(lastFixture(all, "A")?.id, "second");
});

test("a club that has not played has no last fixture", () => {
  assert.equal(lastFixture([match({ id: "s", status: "SCHEDULED", homeGoals: null })], "A"), null);
});

test("standing and scorers are looked up by club code", () => {
  const row = { club: { code: "A", name: "A FC", shortName: "A" } } as StandingsRow;
  assert.equal(standingFor([row], "A"), row);
  assert.equal(standingFor([row], "Z"), null);

  const scorer = (code: string, name: string) =>
    ({ club: { code, name: code, shortName: code }, playerName: name }) as Scorer;
  const all = [scorer("A", "Um"), scorer("B", "Dois"), scorer("A", "Três")];

  assert.deepEqual(scorersFor(all, "A").map((s) => s.playerName), ["Um", "Três"]);
  assert.deepEqual(scorersFor(all, "Z"), []);
});

test("slugify makes a name URL-safe and readable", () => {
  assert.equal(slugify("Flamengo"), "flamengo");
  assert.equal(slugify("São Paulo"), "sao-paulo");
  assert.equal(slugify("Grêmio"), "gremio");
  assert.equal(slugify("Vitória"), "vitoria");
  assert.equal(slugify("Clube do Remo"), "clube-do-remo");
});

test("slugify keeps Atlético-MG and Athletico-PR apart", () => {
  // The H is the only thing distinguishing two real Série A clubs.
  assert.equal(slugify("Atlético-MG"), "atletico-mg");
  assert.equal(slugify("Athletico-PR"), "athletico-pr");
  assert.notEqual(slugify("Atlético-MG"), slugify("Athletico-PR"));
});

test("slugify collapses punctuation without leaving stray hyphens", () => {
  assert.equal(slugify("  A. B./C  "), "a-b-c");
  assert.equal(slugify("--Santos--"), "santos");
});

test("a name with nothing alphanumeric yields no slug", () => {
  assert.equal(slugify("!!!"), "");
  assert.equal(slugify(""), "");
});

const club = (code: string, shortName: string, slug?: string) => ({
  code,
  name: `${shortName} FC`,
  shortName,
  ...(slug ? { slug } : {}),
});

test("crestMonogram prefers the tla", () => {
  assert.equal(crestMonogram({ ...club("1783", "Flamengo"), tla: "FLA" }), "FLA");
  // Not an identity — Corinthians and Coritiba both report COR upstream, which
  // is fine for a mark and is why this is not keyed on.
  assert.equal(crestMonogram({ ...club("1779", "Coritiba"), tla: "cor" }), "COR");
});

test("crestMonogram falls back to the short name's initial, never the code", () => {
  // A club whose provider reports no tla gets a synthetic FD-<id>, and "FD-"
  // beside a club's name abbreviates nothing.
  assert.equal(crestMonogram(club("FD-1783", "Flamengo")), "F");
  assert.equal(crestMonogram({ ...club("FD-1783", "Flamengo"), tla: "   " }), "F");
  // Accents are kept: this is a letter to look at, not a URL segment.
  assert.equal(crestMonogram(club("FD-1", "Ática")), "Á");
});

test("crestMonogram returns empty rather than a box with nothing in it", () => {
  assert.equal(crestMonogram(club("FD-1", "")), "");
  assert.equal(crestMonogram(club("FD-1", "   ")), "");
});

test("clubKey prefers the slug and falls back to the code", () => {
  assert.equal(clubKey(club("1783", "Flamengo", "flamengo")), "flamengo");
  assert.equal(clubKey(club("9999", "???")), "9999");
});

test("findClub resolves a slug", () => {
  const clubs = [club("1783", "Flamengo", "flamengo"), club("1769", "Palmeiras", "palmeiras")];

  assert.equal(findClub(clubs, "palmeiras")?.code, "1769");
});

test("findClub still resolves a raw code, so old links keep working", () => {
  // /clube/1783 was published before slugs existed.
  const clubs = [club("1783", "Flamengo", "flamengo")];

  assert.equal(findClub(clubs, "1783")?.slug, "flamengo");
});

test("findClub is case-insensitive on slugs", () => {
  const clubs = [club("1783", "Flamengo", "flamengo")];

  assert.equal(findClub(clubs, "Flamengo")?.code, "1783");
});

test("findClub returns null for an unknown key", () => {
  assert.equal(findClub([club("1783", "Flamengo", "flamengo")], "nao-existe"), null);
  assert.equal(findClub([], "flamengo"), null);
});

test("a club site is normalised to an HTTPS origin", () => {
  assert.equal(officialSiteUrl("http://www.palmeiras.com.br"), "https://www.palmeiras.com.br/");
  assert.equal(officialSiteUrl("https://www.palmeiras.com.br/"), "https://www.palmeiras.com.br/");
});

test("a path is dropped, because this link means the club's home", () => {
  // The provider lists Flamengo as its basketball landing page.
  assert.equal(
    officialSiteUrl("https://www.flamengo.com.br/pagina-inicial-basquete"),
    "https://www.flamengo.com.br/",
  );
});

test("an unparseable or non-web address yields no link", () => {
  assert.equal(officialSiteUrl("not a url"), null);
  assert.equal(officialSiteUrl("javascript:alert(1)"), null);
  assert.equal(officialSiteUrl("ftp://files.example.com"), null);
  assert.equal(officialSiteUrl(""), null);
  assert.equal(officialSiteUrl(undefined), null);
});

test("websites are filled in from the committed club list", () => {
  // Standings and fixtures carry no website; the seed does.
  const live = [club("1769", "Palmeiras", "palmeiras")];
  const known = [{ ...club("1769", "Palmeiras", "palmeiras"), website: "https://www.palmeiras.com.br/" }];

  assert.equal(withClubDetails(live, known)[0].website, "https://www.palmeiras.com.br/");
});

test("a website already present is left alone", () => {
  const live = [{ ...club("1769", "Palmeiras", "palmeiras"), website: "https://already.example/" }];
  const known = [{ ...club("1769", "Palmeiras", "palmeiras"), website: "https://other.example/" }];

  assert.equal(withClubDetails(live, known)[0].website, "https://already.example/");
});

test("a club the seed does not know keeps no website", () => {
  const live = [club("9999", "Desconhecido", "desconhecido")];

  assert.equal(withClubDetails(live, [])[0].website, undefined);
});

test("a full address survives cleaning unchanged", () => {
  assert.equal(
    clubAddress("Rua Álvaro Chaves 41, Bairro Laranjeiras Rio de Janeiro, RJ 22231-220"),
    "Rua Álvaro Chaves 41, Bairro Laranjeiras Rio de Janeiro, RJ 22231-220",
  );
});

test("upstream's interpolated nulls are stripped, leaving the city", () => {
  // Verbatim from /competitions/BSA/teams: football-data builds this string
  // without checking its own columns, so a missing street and postcode arrive
  // as the literal word. Three of the twenty clubs read exactly like this.
  assert.equal(clubAddress("null São Paulo, SP null"), "São Paulo, SP");
  assert.equal(clubAddress("null Rio de Janeiro, RJ null"), "Rio de Janeiro, RJ");
  assert.equal(clubAddress("null Mirassol, SP null"), "Mirassol, SP");
});

test("only the ends are stripped, never a null inside the line", () => {
  // The middle is a street and a neighbourhood as upstream wrote them. An
  // unanchored replace would edit an address this app cannot parse.
  assert.equal(
    clubAddress("Rua null Central 10, Centro Recife, PE"),
    "Rua null Central 10, Centro Recife, PE",
  );
  // And the token has to be the whole word: a street may begin with one.
  assert.equal(
    clubAddress("Nullo Marcheselli 12, Centro Santos, SP"),
    "Nullo Marcheselli 12, Centro Santos, SP",
  );
});

test("an address with nothing left in it is absent, not empty", () => {
  // The caller omits the line; it must never print a blank one.
  assert.equal(clubAddress("null null"), null);
  assert.equal(clubAddress("   "), null);
  assert.equal(clubAddress(""), null);
  assert.equal(clubAddress(null), null);
  assert.equal(clubAddress(undefined), null);
});

test("the sede pin points at the address, encoded", () => {
  // Google's documented Maps URLs form, the same one `stadiumMapUrl` builds.
  // The whole cleaned line is the search term: the address carries no
  // separators upstream, so there is nothing here to geocode with.
  assert.equal(
    clubMapUrl("Rua Palestra Italia nº 214, Perdizes São Paulo, SP 05005-030"),
    "https://www.google.com/maps/search/?api=1&query=" +
      "Rua%20Palestra%20Italia%20n%C2%BA%20214%2C%20Perdizes%20S%C3%A3o%20Paulo%2C%20SP%2005005-030",
  );
});

test("the address is cleaned before it is searched", () => {
  // Otherwise the three clubs whose street and postcode arrive as the literal
  // word send Google looking for "null".
  assert.equal(
    clubMapUrl("null São Paulo, SP null"),
    "https://www.google.com/maps/search/?api=1&query=S%C3%A3o%20Paulo%2C%20SP",
  );
});

test("no usable address means no link at all", () => {
  // The pin is not drawn rather than drawn pointing at an empty search — the
  // rule `stadiumMapUrl` follows for a ground with no verified coordinate.
  assert.equal(clubMapUrl("null null"), null);
  assert.equal(clubMapUrl("   "), null);
  assert.equal(clubMapUrl(null), null);
  assert.equal(clubMapUrl(undefined), null);
});

test("the sede is filled in from the committed club list", () => {
  // Same gap as the website: only the teams endpoint carries an address, and
  // only the seed generator calls it.
  const live = [club("1769", "Palmeiras", "palmeiras")];
  const known = [
    {
      ...club("1769", "Palmeiras", "palmeiras"),
      address: "Rua Palestra Italia nº 214, Perdizes São Paulo, SP 05005-030",
    },
  ];

  assert.equal(
    withClubDetails(live, known)[0].address,
    "Rua Palestra Italia nº 214, Perdizes São Paulo, SP 05005-030",
  );
  assert.equal(withClubDetails(live, [])[0].address, undefined);
});

test("the home state is filled in from the committed club list", () => {
  // The one field of the seven that was missing from the merge, and the only
  // bug here a test could never have seen: every suite runs against the frozen
  // snapshot, where the seed already carries `state`. Only the live payload —
  // which nothing asserts against — arrives without it.
  const live = [club("1765", "Fluminense", "fluminense")];
  const known = [{ ...club("1765", "Fluminense", "fluminense"), state: "RJ" }];

  assert.equal(withClubDetails(live, known)[0].state, "RJ");
  assert.equal(withClubDetails(live, [])[0].state, undefined);
});

test("every detail the club page reads survives one merge", () => {
  // A field-by-field test passes while the merge drops a field nobody listed,
  // which is exactly how `state` went missing. Assert the whole set at once, so
  // the eighth is added here or not at all.
  const known = [
    {
      ...club("1765", "Fluminense", "fluminense"),
      website: "https://www.fluminense.com.br/",
      instagram: "fluminensefc",
      hymn: "abcdefghijk",
      wikipedia: "Fluminense Football Club",
      address: "Rua Álvaro Chaves 41, Bairro Laranjeiras Rio de Janeiro, RJ 22231-220",
      coach: "Renato Gaúcho",
      state: "RJ",
    },
  ];
  const merged = withClubDetails([club("1765", "Fluminense", "fluminense")], known)[0];

  assert.deepEqual(merged, known[0]);
});

test("a handle becomes the canonical profile address", () => {
  assert.equal(instagramUrl("palmeiras"), "https://www.instagram.com/palmeiras/");
  assert.equal(instagramUrl("@palmeiras"), "https://www.instagram.com/palmeiras/");
});

test("a pasted profile URL is reduced to the handle", () => {
  // What a person actually copies out of the address bar. The locale hint is
  // Instagram's, means nothing to the next reader, and should not be stored.
  assert.equal(
    instagramUrl("https://www.instagram.com/palmeiras/?hl=pt-br"),
    "https://www.instagram.com/palmeiras/",
  );
  assert.equal(instagramUrl("instagram.com/ecbahia"), "https://www.instagram.com/ecbahia/");
});

test("anything that is not a handle yields no link", () => {
  // Renders as no link at all, rather than a broken one.
  assert.equal(instagramUrl("with spaces"), null);
  assert.equal(instagramUrl("https://www.instagram.com/"), null);
  assert.equal(instagramUrl("a".repeat(31)), null);
  assert.equal(instagramUrl(""), null);
  assert.equal(instagramUrl(undefined), null);
});

test("a post shortcode becomes the canonical post address", () => {
  assert.equal(instagramPostUrl("Dc1GBBADkfo"), "https://www.instagram.com/p/Dc1GBBADkfo/");
  assert.equal(
    instagramPostUrl("https://www.instagram.com/p/Dc1GBBADkfo/"),
    "https://www.instagram.com/p/Dc1GBBADkfo/",
  );
});

test("a pasted post link loses its share token", () => {
  // Exactly what Instagram's own "copy link" puts on the clipboard. `stkn`
  // identifies the account that copied it, so storing the raw URL would commit
  // somebody's share token — which is why `instagramPostCode` exists at all
  // rather than the data file holding permalinks.
  const pasted =
    "https://www.instagram.com/p/Dc1GBBADkfo/?utm_source=ig_web_copy_link&stkn=MzRlODBiNWFlZA==";
  assert.equal(instagramPostCode(pasted), "Dc1GBBADkfo");
  assert.equal(instagramPostUrl(pasted), "https://www.instagram.com/p/Dc1GBBADkfo/");
});

test("the frame address is the captioned embed and not the canonical post", () => {
  // Not interchangeable: `/p/<code>/` answers `X-Frame-Options: DENY` and
  // cannot be framed at all, and `/embed/` (uncaptioned) misreports its own
  // height by a factor of three, so a frame sized from its MEASURE clips the
  // picture. Both were measured in a browser; see `instagramPostEmbedUrl`.
  assert.equal(
    instagramPostEmbedUrl("Dc1GBBADkfo"),
    "https://www.instagram.com/p/Dc1GBBADkfo/embed/captioned/",
  );
  assert.notEqual(instagramPostEmbedUrl("Dc1GBBADkfo"), instagramPostUrl("Dc1GBBADkfo"));
});

test("a link that is not a post yields no post", () => {
  // Refuses rather than guesses. A reel and a `/tv/` post have their own path
  // kinds and nothing here has checked that `/p/` serves them, so they are out
  // until somebody checks — widening this is a deliberate change.
  assert.equal(instagramPostCode("https://www.instagram.com/reel/Dc1GBBADkfo/"), null);
  assert.equal(instagramPostCode("https://www.instagram.com/tv/Dc1GBBADkfo/"), null);
  // `/reels/` rather than `/reel/`, and the difference is the whole reason this
  // line exists: with the kind check deleted, those two are refused anyway
  // because "reel" and "tv" are shorter than a shortcode can be — they pass for
  // a reason that has nothing to do with what they are. "reels" is five
  // characters and clears the same regex, so only the kind check refuses it,
  // and the same holds for a profile handle. Confirmed by mutation.
  assert.equal(instagramPostCode("https://www.instagram.com/reels/Dc1GBBADkfo/"), null);
  assert.equal(instagramPostCode("https://www.instagram.com/palmeiras/"), null);
  assert.equal(instagramPostCode("https://www.instagram.com/"), null);
  assert.equal(instagramPostCode("with spaces"), null);
  assert.equal(instagramPostCode("abc"), null);
  assert.equal(instagramPostCode(""), null);
  assert.equal(instagramPostCode(undefined), null);
  // Every caller degrades to no post rather than to a frame pointing nowhere.
  assert.equal(instagramPostUrl("https://www.instagram.com/reel/Dc1GBBADkfo/"), null);
  assert.equal(instagramPostEmbedUrl("with spaces"), null);
});

test("a subreddit name becomes the canonical community address", () => {
  assert.equal(redditUrl("CRFla"), "https://www.reddit.com/r/CRFla/");
  assert.equal(redditUrl("r/CRFla"), "https://www.reddit.com/r/CRFla/");
  assert.equal(redditUrl("/r/CRFla"), "https://www.reddit.com/r/CRFla/");
});

test("a pasted subreddit URL is reduced to the name", () => {
  // What a person copies out of the address bar, share suffix and all.
  assert.equal(
    redditUrl("https://www.reddit.com/r/CRFla/?rdt=53291"),
    "https://www.reddit.com/r/CRFla/",
  );
  assert.equal(redditUrl("reddit.com/r/CRFla/new/"), "https://www.reddit.com/r/CRFla/");
  assert.equal(redditUrl("https://old.reddit.com/r/CRFla/"), "https://www.reddit.com/r/CRFla/");
});

test("a subreddit's casing survives, because the name is what the link says", () => {
  // Reddit resolves a sub case-insensitively but prints one canonical form, so
  // folding the value would reach the right page under a name the community
  // does not use. This is the one way the parser differs from its Instagram
  // sibling, and the assertion is what stops it being "tidied" into agreement.
  assert.equal(subredditName("CRFla"), "CRFla");
  assert.equal(subredditName("https://www.reddit.com/r/CRFla/"), "CRFla");
});

test("anything that is not a subreddit name yields no link", () => {
  // Renders as no link at all, rather than one landing on a Reddit search.
  assert.equal(redditUrl("with spaces"), null);
  assert.equal(redditUrl("https://www.reddit.com/"), null);
  assert.equal(redditUrl("r/"), null);
  // Reddit's own bounds: 3 to 21 characters.
  assert.equal(redditUrl("ab"), null);
  assert.equal(redditUrl("a".repeat(22)), null);
  // A user profile is not a community, and `u/` is one keystroke from `r/`.
  assert.equal(redditUrl("https://www.reddit.com/u/alguem/"), null);
  assert.equal(redditUrl(""), null);
  assert.equal(redditUrl(undefined), null);
});

test("curated subreddits attach to the club list by code", () => {
  const clubs = [club("1783", "Flamengo", "flamengo"), club("9999", "Outro", "outro")];

  const [flamengo, outro] = withReddit(clubs, { "1783": "CRFla" });

  assert.equal(flamengo.reddit, "CRFla");
  assert.equal(outro.reddit, undefined);
});

test("the subreddit rides along with the website into live payloads", () => {
  // `withClubDetails` is the one place where "works in CI" and "works in
  // production" genuinely differ: every suite runs the frozen seed, which
  // already carries the field, while production builds its clubs from a live
  // payload that carries none of these. A field left out of that function
  // renders offline and silently vanishes on the deployed site — which is
  // exactly how `state` went missing for as long as the list existed.
  const known = [{ ...club("1783", "Flamengo", "flamengo"), reddit: "CRFla" }];

  const [merged] = withClubDetails([club("1783", "Flamengo", "flamengo")], known);

  assert.equal(merged.reddit, "CRFla");
  assert.equal(withClubDetails([club("1783", "Flamengo", "flamengo")], [])[0].reddit, undefined);
});

test("curated handles attach to the club list by code", () => {
  const clubs = [club("1769", "Palmeiras", "palmeiras"), club("9999", "Outro", "outro")];

  const [palmeiras, outro] = withInstagram(clubs, { "1769": "palmeiras" });

  assert.equal(palmeiras.instagram, "palmeiras");
  assert.equal(outro.instagram, undefined);
});

test("the handle rides along with the website into live payloads", () => {
  // Fixtures and standings carry neither; both come from the committed list.
  const live = [club("1769", "Palmeiras", "palmeiras")];
  const known = [
    { ...club("1769", "Palmeiras", "palmeiras"), website: "https://www.palmeiras.com.br/", instagram: "palmeiras" },
  ];

  const [merged] = withClubDetails(live, known);

  assert.equal(merged.instagram, "palmeiras");
  assert.equal(merged.website, "https://www.palmeiras.com.br/");
});

test("a hymn link is the video id, however it was pasted", () => {
  assert.equal(hymnUrl("DiKvx0gRfaQ"), "https://www.youtube.com/watch?v=DiKvx0gRfaQ");
  // What a person copies while the video plays inside a mix. Keeping the radio
  // parameters would drop every reader into autoplay instead of the hymn.
  assert.equal(
    hymnUrl("https://www.youtube.com/watch?v=DiKvx0gRfaQ&list=RDDiKvx0gRfaQ&start_radio=1"),
    "https://www.youtube.com/watch?v=DiKvx0gRfaQ",
  );
  assert.equal(hymnUrl("https://youtu.be/DiKvx0gRfaQ?t=42"), "https://www.youtube.com/watch?v=DiKvx0gRfaQ");
  assert.equal(
    hymnUrl("https://www.youtube.com/embed/DiKvx0gRfaQ"),
    "https://www.youtube.com/watch?v=DiKvx0gRfaQ",
  );
});

/**
 * The player address, whose only caller is **Melhores momentos** on the Partida
 * page — tested here beside `hymnUrl` because what it must not do is disagree
 * with the watch address about which video it is. Two spellings of one video is
 * how a reader comes to press play on one package and be handed another.
 */
test("the embed address is the same video, on the privacy-enhanced host", () => {
  assert.equal(
    videoEmbedUrl("DiKvx0gRfaQ"),
    "https://www.youtube-nocookie.com/embed/DiKvx0gRfaQ?playsinline=1&rel=0",
  );
  // Curated highlights are stored as full watch URLs, not as bare ids — the
  // opposite of `club-hymns.ts` — so this is the shape the caller actually
  // hands it, and asserting only the bare id would test a case the app has.
  assert.equal(
    videoEmbedUrl("https://www.youtube.com/watch?v=DiKvx0gRfaQ"),
    "https://www.youtube-nocookie.com/embed/DiKvx0gRfaQ?playsinline=1&rel=0",
  );
  // The id both ways round: the frame and the link the same control carries
  // must name one video, and they read the id through one parser to guarantee
  // it. A `&t=` or a `&list=` in the curated line reaches neither.
  const pasted = "https://youtu.be/DiKvx0gRfaQ?t=42";
  assert.equal(youtubeVideoId(pasted), youtubeVideoId(videoEmbedUrl(pasted) ?? ""));

  // **The absence of `autoplay` is the assertion, not an omission from this
  // test.** The frame renders with the section rather than on a click, so a
  // video that started by itself would be the "hino que ninguém pediu" the
  // club page refuses a player over. Adding the parameter back breaks nothing
  // a person would see in a test run, which is exactly why it is pinned here.
  assert.doesNotMatch(videoEmbedUrl("DiKvx0gRfaQ") ?? "", /autoplay/);
  // iOS Safari takes a video fullscreen without this, which is the leaving of
  // the page that the whole section was changed to stop.
  assert.match(videoEmbedUrl("DiKvx0gRfaQ") ?? "", /[?&]playsinline=1(&|$)/);
});

test("the pressed address is the same player, plus the reader's own autoplay", () => {
  const id = "DiKvx0gRfaQ";

  // **Same origin, same parameters, one addition.** The two are built from one
  // `embedAddress` precisely so they cannot drift into two spellings of
  // YouTube — `videoWatchUrl`'s stated rule, applied to the third address.
  assert.equal(videoPressedEmbedUrl(id), `${videoEmbedUrl(id)}&autoplay=1`);
  assert.match(videoPressedEmbedUrl(id) ?? "", /[?&]playsinline=1(&|$|&)/);
  assert.match(videoPressedEmbedUrl(id) ?? "", /[?&]rel=0(&|$)/);

  // **And the split is the whole point: `videoEmbedUrl` must stay silent.**
  // That is the address a section may mount unasked, and the one the club page
  // spent three years refusing a player over. Two named functions rather than
  // a boolean parameter, for `serialiseDevicePreferences`' reason — a flag at a
  // call site is easy to pass wrong and impossible to see in a diff — and this
  // pair of assertions is what makes collapsing them back go red.
  assert.doesNotMatch(videoEmbedUrl(id) ?? "", /autoplay/);
  assert.match(videoPressedEmbedUrl(id) ?? "", /[?&]autoplay=1(&|$)/);

  // It degrades exactly as its two siblings do, so a caller that has no embed
  // to mount also has no half-built address to mount.
  for (const raw of ["short", "not a url/", "", undefined]) {
    assert.equal(videoPressedEmbedUrl(raw), null, `esperava null para ${String(raw)}`);
  }
});

test("the embed address refuses what the watch address refuses", () => {
  // The two degrade together, and the caller relies on it: an entry with no
  // embed keeps the plain link-out, so a parser that answered for one and not
  // the other would render a control that announces a player and opens a tab.
  for (const raw of ["short", "https://www.youtube.com/watch?v=nope", "not a url/", "", undefined]) {
    assert.equal(videoEmbedUrl(raw), null, `esperava null para ${String(raw)}`);
    assert.equal(videoWatchUrl(raw), null, `esperava null para ${String(raw)}`);
  }
});

test("anything that is not a video id yields no link", () => {
  // Renders as no link at all, rather than one that lands on YouTube's 404.
  assert.equal(hymnUrl("short"), null);
  assert.equal(hymnUrl("https://www.youtube.com/watch?v=nope"), null);
  assert.equal(hymnUrl("https://www.youtube.com/"), null);
  assert.equal(hymnUrl("not a url/"), null);
  assert.equal(hymnUrl(""), null);
  assert.equal(hymnUrl(undefined), null);
});

test("curated hymns attach to the club list by code", () => {
  const clubs = [club("1769", "Palmeiras", "palmeiras"), club("9999", "Outro", "outro")];

  const [palmeiras, outro] = withHymns(clubs, { "1769": "DiKvx0gRfaQ" });

  assert.equal(palmeiras.hymn, "DiKvx0gRfaQ");
  assert.equal(outro.hymn, undefined);
});

test("the hymn rides along into live payloads", () => {
  // Like the handle and the website: no endpoint carries it, so the committed
  // list is what supplies it at request time.
  const live = [club("1769", "Palmeiras", "palmeiras")];
  const known = [{ ...club("1769", "Palmeiras", "palmeiras"), hymn: "DiKvx0gRfaQ" }];

  const [merged] = withClubDetails(live, known);

  assert.equal(merged.hymn, "DiKvx0gRfaQ");
});

test("every club in the division has a hymn", () => {
  // The link is either on all twenty pages or it is a gap the reader notices.
  const missing = CLUBS.filter((entry) => !hymnUrl(CLUB_HYMNS[entry.code]));

  assert.deepEqual(missing.map((entry) => entry.shortName), []);
});

test("an article link is the title, however it was pasted", () => {
  assert.equal(
    wikipediaUrl("Sociedade Esportiva Palmeiras"),
    "https://pt.wikipedia.org/wiki/Sociedade_Esportiva_Palmeiras",
  );
  // Underscores are what the address uses; either spelling names one article.
  assert.equal(
    wikipediaUrl("Sociedade_Esportiva_Palmeiras"),
    "https://pt.wikipedia.org/wiki/Sociedade_Esportiva_Palmeiras",
  );
  // What a person copies from the address bar, from a section, or from the
  // edit view. None of the three belongs in the file.
  assert.equal(
    wikipediaUrl("https://pt.wikipedia.org/wiki/Sociedade_Esportiva_Palmeiras"),
    "https://pt.wikipedia.org/wiki/Sociedade_Esportiva_Palmeiras",
  );
  assert.equal(
    wikipediaUrl("https://pt.wikipedia.org/wiki/Sociedade_Esportiva_Palmeiras#História"),
    "https://pt.wikipedia.org/wiki/Sociedade_Esportiva_Palmeiras",
  );
  assert.equal(
    wikipediaUrl("https://pt.wikipedia.org/wiki/Santos_Futebol_Clube?action=edit"),
    "https://pt.wikipedia.org/wiki/Santos_Futebol_Clube",
  );
});

test("an accented title is encoded, not transliterated", () => {
  // The opposite of a club slug: stripping the accent there keeps the address
  // typeable, but "Gremio Foot-Ball Porto Alegrense" is simply not an article.
  assert.equal(
    wikipediaUrl("Grêmio Foot-Ball Porto Alegrense"),
    "https://pt.wikipedia.org/wiki/Gr%C3%AAmio_Foot-Ball_Porto_Alegrense",
  );
  // Already-encoded input survives a round trip rather than being encoded twice.
  assert.equal(
    wikipediaUrl("https://pt.wikipedia.org/wiki/Gr%C3%AAmio_Foot-Ball_Porto_Alegrense"),
    "https://pt.wikipedia.org/wiki/Gr%C3%AAmio_Foot-Ball_Porto_Alegrense",
  );
});

test("anything that is not a pt article yields no link", () => {
  // Renders as no link at all, rather than one that lands on a 404. Another
  // edition is not rewritten: the pt title is rarely the en one, so an "en."
  // link rewritten to "pt." would look right and resolve to nothing.
  assert.equal(wikipediaUrl("https://en.wikipedia.org/wiki/Santos_FC"), null);
  assert.equal(wikipediaUrl("https://pt.wikipedia.org/w/index.php?title=Santos_Futebol_Clube"), null);
  assert.equal(wikipediaUrl("https://example.com/wiki/Santos_Futebol_Clube"), null);
  // Characters Wikipedia forbids in a title.
  assert.equal(wikipediaUrl("Santos [Futebol] Clube"), null);
  assert.equal(wikipediaUrl("not a url/"), null);
  assert.equal(wikipediaUrl("   "), null);
  assert.equal(wikipediaUrl(""), null);
  assert.equal(wikipediaUrl(undefined), null);
});

test("curated articles attach to the club list by code", () => {
  const clubs = [club("1769", "Palmeiras", "palmeiras"), club("9999", "Outro", "outro")];

  const [palmeiras, outro] = withWikipedia(clubs, { "1769": "Sociedade Esportiva Palmeiras" });

  assert.equal(palmeiras.wikipedia, "Sociedade Esportiva Palmeiras");
  assert.equal(outro.wikipedia, undefined);
});

test("the article rides along into live payloads", () => {
  // Like the handle, the website and the hymn: no endpoint carries it, so the
  // committed list is what supplies it at request time.
  const live = [club("1769", "Palmeiras", "palmeiras")];
  const known = [
    { ...club("1769", "Palmeiras", "palmeiras"), wikipedia: "Sociedade Esportiva Palmeiras" },
  ];

  const [merged] = withClubDetails(live, known);

  assert.equal(merged.wikipedia, "Sociedade Esportiva Palmeiras");
});

test("every club in the division has an article", () => {
  // The link is either on all twenty pages or it is a gap the reader notices.
  const missing = CLUBS.filter((entry) => !wikipediaUrl(CLUB_WIKIPEDIA[entry.code]));

  assert.deepEqual(missing.map((entry) => entry.shortName), []);
});

test("no two clubs share an article", () => {
  // A title keyed to the wrong club id is invisible in review — both pages
  // render a working link, and one of them is another club's. The same failure
  // the seed generator rejects for names and codes.
  const titles = CLUBS.map((entry) => CLUB_WIKIPEDIA[entry.code]);

  assert.equal(new Set(titles).size, titles.length);
});

test("every curated subreddit names a club in the division", () => {
  // Coverage is deliberately partial — unlike the hymn and the article, which
  // are on all twenty pages — so there is no "every club has one" gate here.
  // What CAN be checked is that no entry is keyed to nothing: a code that is
  // not in the division renders no link and reports nothing, which is the same
  // silent failure `player-core.test.ts` guards for an id no longer in a squad.
  const codes = new Set(CLUBS.map((entry) => entry.code));
  const orphans = Object.keys(CLUB_REDDIT).filter((code) => !codes.has(code));

  assert.deepEqual(orphans, []);
});

test("every curated subreddit survives its own parser", () => {
  // A value the parser refuses renders as no link at all, which looks exactly
  // like a club that simply has no entry — so a typo here is invisible on the
  // page and invisible in review. The parser is the only thing that can say.
  const unusable = Object.entries(CLUB_REDDIT).filter(([, sub]) => !redditUrl(sub));

  assert.deepEqual(unusable, []);
});

test("the curated subreddits are not empty, and no two clubs share one", () => {
  // The emptiness half is what stops the two tests above passing vacuously if
  // the file is ever cleared — `tests/e2e/coaches.spec.ts` carries the same
  // guard over `coach-overrides.ts`, and for the same reason.
  //
  // The distinctness half was VACUOUS at one entry and has teeth at seven. The
  // failure it names is invisible in review: a sub keyed to the wrong club id
  // renders a working link on both pages, and one of them sends a club's
  // supporters into their rivals' community. It is the `no two clubs share an
  // article` gate, one file over — and the file it guards is now exactly the
  // shape that gate exists for, six of the seven having been added at once.
  const subs = Object.values(CLUB_REDDIT);

  assert.ok(subs.length > 0);
  assert.equal(new Set(subs).size, subs.length);
});

test("discordInvite keeps only the invite code, whatever was written down", () => {
  // The code and the URL must never disagree about which server they mean,
  // which is `subredditName`'s rule one host over.
  assert.equal(discordInvite("https://discord.gg/aBcD1234"), "aBcD1234");
  assert.equal(discordInvite("https://discord.com/invite/aBcD1234"), "aBcD1234");
  assert.equal(discordInvite("discord.gg/flamengo?event=123"), "flamengo");
  assert.equal(discordInvite("  aBcD1234  "), "aBcD1234");
  assert.equal(discordInvite("não é um convite"), null);
  assert.equal(discordInvite(undefined), null);
});

test("discordInvite refuses a server address, rather than lifting an id out of it", () => {
  // THE test on this parser, and the reason it exists at all. A
  // `channels/<guild>` URL is what a person actually pastes — it is what the
  // address bar shows while they read the server — and it is not a link
  // anybody outside the server can use: a non-member following it gets their
  // own Discord, no join affordance, no sign anything was meant to happen.
  //
  // The failure this guards is the parser being *helpful*: `956…` is a
  // perfectly good first path segment, so a rule that merely split on `/`
  // would store it as an invite code and build `discord.gg/956…`, which is a
  // working-looking link to nothing. That is a refusal reading as an
  // acceptance, which is worse than no parser — `instagramPostCode`'s rule
  // about reels, and the same bar `matchPlayerByName` sets.
  assert.equal(discordInvite("https://discord.com/channels/956003357129076746/@home"), null);
  assert.equal(discordInvite("https://discord.com/channels/956003357129076746/1234567890"), null);
  assert.equal(discordInvite("discord.com/channels/956003357129076746"), null);
  assert.equal(discordUrl("https://discord.com/channels/956003357129076746/@home"), null);

  // THE case, and the three above it are not it. Measured with the refusal
  // deleted: all three are already refused by the character rule, because
  // their first path segment is `https:` or `discord.com` — so a test built
  // only from them PASSES against the mutation it is named for, which is this
  // repo's own `page.route` trap arriving in a unit test. The shape that
  // actually reaches the refusal is the one with the host trimmed off, which
  // yields the segment `channels` and would be stored as an invite code.
  assert.equal(discordInvite("channels/956003357129076746/@home"), null);
});

test("discordInvite refuses a bare guild id, which is not an invite code", () => {
  // The likeliest hand-edit of all: somebody reads the rule above, deletes the
  // `channels/` wrapper themselves, and writes down the number. It satisfies
  // every other rule — 18 characters, all inside the alphabet — and builds
  // `discord.gg/956…`, which looks minted and resolves to nothing.
  //
  // Refused on the SHAPE rather than on a host check, because by this point
  // there is no host left to read. Discord mints codes of 7–10 characters and
  // vanities are words, so nothing legitimate is 17+ digits.
  assert.equal(discordInvite("956003357129076746"), null);
  assert.equal(discordUrl("956003357129076746"), null);

  // The bound, stated so the rule cannot be widened into refusing real codes:
  // digits are perfectly good inside an invite, and a short numeric one stands.
  assert.equal(discordInvite("12345678"), "12345678");
});

test("discordUrl builds the short form, from the parsed code and not the raw value", () => {
  // `discord.gg` rather than `discord.com/invite`: the two resolve to the same
  // place, and the short one is what Discord's own copy button produces, so
  // the address on the page is one a reader has seen before.
  assert.equal(discordUrl("https://discord.com/invite/aBcD1234"), "https://discord.gg/aBcD1234");
  assert.equal(discordUrl("aBcD1234"), "https://discord.gg/aBcD1234");
  assert.equal(discordUrl(""), null);
});

test("every curated Discord invite names a club in the division", () => {
  // Coverage is partial by design, like the subreddits, so there is no "every
  // club has one" gate. What can be checked is that no entry is keyed to
  // nothing: a code outside the division renders no link and reports nothing.
  const codes = new Set(CLUBS.map((entry) => entry.code));
  const orphans = Object.keys(CLUB_DISCORD).filter((code) => !codes.has(code));

  assert.deepEqual(orphans, []);
});

test("every curated Discord invite survives its own parser", () => {
  // A value the parser refuses renders as no link, which looks exactly like a
  // club that has no entry — so a typo here is invisible on the page and in
  // review. This is where a pasted `channels/<guild>` URL is caught: the
  // refusal above proves the parser says no, and this proves the FILE never
  // holds one.
  const unusable = Object.entries(CLUB_DISCORD).filter(([, entry]) => !discordUrl(entry.invite));

  assert.deepEqual(unusable, []);
});

test("the curated Discord entries are not empty, and no two clubs share a server", () => {
  // The emptiness half is what stops the two tests above passing vacuously —
  // `club-reddit.ts`' sibling gate, and it was owed the moment the first entry
  // landed: while the file shipped empty this test said so in its own comment
  // rather than looking like coverage it did not have.
  //
  // The distinctness half is checked on the GUILD and not on the invite, and
  // that is not the same assertion. Two clubs could carry two different vanity
  // codes that resolve to one server — different strings, one community — and
  // an invite-keyed Set would call that distinct. The failure is the `no two
  // clubs share an article` one at a third host: both pages render a working
  // link, and one of them drops a club's supporters among their rivals.
  const entries = Object.values(CLUB_DISCORD);
  const guilds = entries.map((entry) => entry.guild);

  assert.ok(entries.length > 0);
  assert.equal(new Set(guilds).size, guilds.length);
});

test("instagramHandle keeps only the handle, whatever was written down", () => {
  // The handle and the URL must never disagree about which profile they mean,
  // which is why the link component prints this rather than the raw value.
  assert.equal(instagramHandle("@palmeiras"), "palmeiras");
  assert.equal(instagramHandle("https://www.instagram.com/palmeiras/?hl=pt-br"), "palmeiras");
  assert.equal(instagramHandle("  ecbahia  "), "ecbahia");
  assert.equal(instagramHandle("não é um perfil"), null);
  assert.equal(instagramHandle(undefined), null);
});

test("the coach printed on a club page prefers the live map to the frozen one", () => {
  // clubs.ts is regenerated a few times a season and a Série A club changes
  // coach far more often than that, so the snapshot is the floor and
  // /api/coaches is the answer. This is the reverse of withClubDetails' rule,
  // where the committed list supplies what no live payload carries.
  const palmeiras = { ...club("1769", "Palmeiras", "palmeiras"), coach: "Técnico Antigo" };

  assert.equal(coachOf(palmeiras, { "1769": "Abel Ferreira" }), "Abel Ferreira");
});

test("a failed coaches request still leaves the club page naming someone", () => {
  // The map is undefined until it lands and stays undefined if it never does.
  const palmeiras = { ...club("1769", "Palmeiras", "palmeiras"), coach: "Abel Ferreira" };

  assert.equal(coachOf(palmeiras, undefined), "Abel Ferreira");
  assert.equal(coachOf(palmeiras, {}), "Abel Ferreira");
});

test("a club nothing knows a coach for gets no line", () => {
  // Null, never "" and never a dash: the page leaves the line out entirely.
  assert.equal(coachOf(club("9999", "Desconhecido", "desconhecido")), null);
  assert.equal(coachOf({ ...club("9999", "Desconhecido", "desconhecido"), coach: "  " }), null);
  assert.equal(coachOf(club("1769", "Palmeiras", "palmeiras"), { "1769": "   " }), null);
});

test("the coaches map leaves out the clubs that have none", () => {
  // What /api/coaches answers with. An absence survives the round trip as an
  // absence rather than arriving as a value the page must test a second time.
  const clubs = [
    { ...club("1769", "Palmeiras", "palmeiras"), coach: "Abel Ferreira" },
    club("1783", "Flamengo", "flamengo"),
  ];

  assert.deepEqual(coachesOf(clubs), { "1769": "Abel Ferreira" });
});

test("the coach rides along with the website into live payloads", () => {
  // Fixtures and standings name two clubs and no coach; the committed list is
  // what fills the gap until /api/coaches answers.
  const live = [club("1769", "Palmeiras", "palmeiras")];
  const known = [{ ...club("1769", "Palmeiras", "palmeiras"), coach: "Abel Ferreira" }];

  assert.equal(withClubDetails(live, known)[0].coach, "Abel Ferreira");
});

test("a coach already on a live club is not overwritten by the snapshot", () => {
  // Clubs on /api/squads come from the teams endpoint and carry their own.
  const live = [{ ...club("1769", "Palmeiras", "palmeiras"), coach: "Técnico Atual" }];
  const known = [{ ...club("1769", "Palmeiras", "palmeiras"), coach: "Técnico Antigo" }];

  assert.equal(withClubDetails(live, known)[0].coach, "Técnico Atual");
});

test("every club in the snapshot has a definite article written down", () => {
  // The guard that stops the table falling behind the division, and the one
  // the first version of this got wrong. Asserting *which* clubs take "a"
  // catches a known feminine club being promoted and misses an unknown one: a
  // Caldense or an Aparecidense falls through to the masculine default and the
  // list of feminine clubs reads exactly as it did before. `CLUBS.length ===
  // 20` cannot help either — Série A is always twenty, so a promotion is a
  // swap. Only an entry per club turns the next `sync-seed-data` red instead of
  // silently shipping "do Chapecoense".
  const missing = CLUBS.filter((club) => !hasClubArticle(club)).map((club) => club.shortName);

  assert.deepEqual(missing, [], `no article recorded for: ${missing.join(", ")}`);
});

test("the clubs Brazilians call 'a' are the ones that get it", () => {
  // Exhaustiveness says every club has *an* article; this says the articles are
  // right. Chapecoense is 20th in the division, so "o Chapecoense" is a string
  // a reader meets rather than one a linguist imagines.
  const feminine = CLUBS.filter((club) => clubArticle(club) === "a").map((club) => club.shortName);

  assert.deepEqual(feminine, ["Chapecoense"]);
});

test("the definite article survives accents and spacing, because slugify normalises both", () => {
  assert.equal(clubArticle(club("x", "Ferroviária")), "a");
  assert.equal(clubArticle(club("y", "Ponte Preta")), "a");
});

test("a state suffix does not hide a club from its own definite article", () => {
  // Athletico-PR and Atlético-MG are both in the snapshot, so a promoted
  // Portuguesa-RJ is the shape to expect rather than a hypothetical one: it
  // slugs to `portuguesa-rj` and would miss an entry keyed on `portuguesa`.
  assert.equal(clubArticle(club("z", "Portuguesa-RJ")), "a");
  assert.equal(clubArticle(club("w", "Portuguesa-SP")), "a");
  assert.equal(clubArticle(club("v", "Athletico-PR")), "o");

  // …and the two spellings stay two clubs, one letter apart.
  assert.equal(hasClubArticle(club("v", "Athletico-PR")), true);
  assert.equal(hasClubArticle(club("u", "Atlético-MG")), true);
});

test("a club the table has never seen still renders, masculine", () => {
  // Club objects also arrive from the live payload, which names clubs the
  // frozen snapshot does not. The default is what a reader sees; the
  // exhaustiveness test above is what stops it being load-bearing.
  assert.equal(clubArticle(club("q", "Clube Inventado")), "o");
  assert.equal(hasClubArticle(club("q", "Clube Inventado")), false);
});

test("the possessive form contracts the article rather than leaving it bare", () => {
  assert.equal(ofClub(club("1783", "Flamengo")), "do Flamengo");
  assert.equal(ofClub(club("1772", "Chapecoense")), "da Chapecoense");
});

test("a list of clubs repeats the article rather than sharing one", () => {
  // "Casa do Fluminense e Flamengo" is wrong even where both clubs are
  // masculine, and a ground shared with Chapecoense has no single article that
  // could serve both.
  assert.equal(
    ofClubs([club("1765", "Fluminense"), club("1783", "Flamengo")]),
    "do Fluminense e do Flamengo",
  );
  assert.equal(
    ofClubs([club("1772", "Chapecoense"), club("1783", "Flamengo")]),
    "da Chapecoense e do Flamengo",
  );
  assert.equal(
    ofClubs([club("a", "Fluminense"), club("b", "Flamengo"), club("c", "Vasco da Gama")]),
    "do Fluminense, do Flamengo e do Vasco da Gama",
  );
});

test("one club needs no join, and none needs no article", () => {
  assert.equal(ofClubs([club("1783", "Flamengo")]), "do Flamengo");
  assert.equal(ofClubs([]), "");
});

/* ------------------------------------------------- técnico corrections ---- */

const clubWith = (code: string, coach?: string) =>
  ({ code, name: `Club ${code}`, shortName: code, state: "SP", ...(coach ? { coach } : {}) });

test("an override replaces the provider's coach rather than filling a gap", () => {
  // The whole difference from `withClubDetails`, which reads `club.coach ??
  // source` and lets the provider win. Here the provider is what is wrong.
  const [club] = withCoachOverrides([clubWith("1767", "Jéssica Lima")], { "1767": "Luís Castro" });
  assert.equal(club?.coach, "Luís Castro");
});

test("a club with no override is returned untouched", () => {
  const original = clubWith("9999", "Alguém");
  const [club] = withCoachOverrides([original], { "1767": "Luís Castro" });
  assert.equal(club, original, "the object itself, not a copy — nothing to change");
});

test("an override fills nothing: a club the provider names no coach for still gets one", () => {
  // Deliberate. The correction is keyed to the club, not to the provider having
  // said something — a club between coaches upstream is exactly when the frozen
  // wrong name would otherwise surface through `withClubDetails`' fallback.
  const [club] = withCoachOverrides([clubWith("1767")], { "1767": "Luís Castro" });
  assert.equal(club?.coach, "Luís Castro");
});

test("an override naming a club that is not in the list is unused, not an error", () => {
  const clubs = withCoachOverrides([clubWith("9999", "Alguém")], { "1767": "Luís Castro" });
  assert.equal(clubs.length, 1);
  assert.equal(clubs[0]?.coach, "Alguém");
});

test("a blank override is ignored rather than blanking the name", () => {
  const [club] = withCoachOverrides([clubWith("1767", "Jéssica Lima")], { "1767": "   " });
  assert.equal(club?.coach, "Jéssica Lima");
});

/* --------------------------------------------------- the committed data --- */

test("every coach override names a club in this division, and changes something", () => {
  // Asserting the data, the way `player-photos.test.ts` does: the compiler is
  // satisfied by an entry for a club that was relegated two seasons ago.
  const byCode = new Map(CLUBS.map((club) => [club.code, club]));

  for (const [code, coach] of Object.entries(COACH_OVERRIDES)) {
    const club = byCode.get(code);
    assert.ok(club, `${code} is not a club in this division`);
    assert.ok(coach.trim().length > 0, `${code} has an empty override`);
    // An override that agrees with the seed is one upstream has since fixed —
    // which arrives as a regenerated seed and in no other way. It should be
    // deleted rather than left to look load-bearing.
    assert.notEqual(
      coach,
      club?.coach,
      `${code}: the override equals the seed's own value, so upstream has fixed it`,
    );
  }
});
