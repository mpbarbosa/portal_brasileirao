import assert from "node:assert/strict";
import { test } from "node:test";

import { CLUBS } from "@/src/data/clubs";
import { CLUB_HYMNS } from "@/src/data/club-hymns";
import { CLUB_WIKIPEDIA } from "@/src/data/club-wikipedia";
import {
  clubKey,
  clubMatches,
  findClub,
  lastFixture,
  nextFixture,
  playsIn,
  recentForm,
  resultFor,
  officialSiteUrl,
  scorersFor,
  slugify,
  standingFor,
  withClubDetails,
  withHymns,
  withInstagram,
  withWikipedia,
  hymnUrl,
  instagramUrl,
  wikipediaUrl,
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
