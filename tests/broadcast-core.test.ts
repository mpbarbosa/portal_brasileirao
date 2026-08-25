import assert from "node:assert/strict";
import { test } from "node:test";

import {
  channelsFor,
  channelsOf,
  hasProvisionalKickoff,
  joinMatch,
  kickoffToIso,
  matchClub,
  parseChannels,
  venueFromLocal,
  withBroadcasters,
  withVenues,
  markKey,
  broadcasterMarkUrl,
} from "@/broadcast-core";
import type { Club, Match } from "@/src/types";

const match = (id: string): Match => ({
  id,
  round: 24,
  kickoff: "2026-08-24T23:00:00Z",
  status: "SCHEDULED",
  homeCode: "1770",
  awayCode: "1768",
  homeGoals: null,
  awayGoals: null,
});

test("channels are returned for a match that has them", () => {
  assert.deepEqual(channelsFor({ "554970": ["Premiere", "SporTV"] }, "554970"), [
    "Premiere",
    "SporTV",
  ]);
});

test("a match with no entry has no channels", () => {
  assert.equal(channelsFor({}, "554970"), null);
});

test("an empty list reads the same as no entry", () => {
  // Both mean "we do not know where this is shown".
  assert.equal(channelsFor({ "554970": [] }, "554970"), null);
});

test("matches with channels carry them; others are untouched", () => {
  const [withChannels, without] = withBroadcasters(
    [match("554970"), match("999999")],
    { "554970": ["Premiere", "SporTV"] },
  );

  assert.deepEqual(withChannels.broadcasters, ["Premiere", "SporTV"]);
  assert.equal("broadcasters" in without, false);
});

test("a curated entry for an unknown match is ignored, not an error", () => {
  // A rescheduled fixture can leave a stale id behind.
  const result = withBroadcasters([match("554970")], {
    "554970": ["Premiere"],
    "000000": ["Canal Fantasma"],
  });

  assert.equal(result.length, 1);
  assert.deepEqual(result[0].broadcasters, ["Premiere"]);
});

test("attaching channels does not mutate the input", () => {
  const original = match("554970");
  withBroadcasters([original], { "554970": ["Premiere"] });

  assert.equal("broadcasters" in original, false);
});

test("channel strings split on the separators CBF actually uses", () => {
  // Both appear in a single day's table.
  assert.deepEqual(parseChannels("ESPN / Disney+"), ["ESPN", "Disney+"]);
  assert.deepEqual(parseChannels("Premiere, Sportv"), ["Premiere", "Sportv"]);
  assert.deepEqual(parseChannels("CBF TV, TV Brasil"), ["CBF TV", "TV Brasil"]);
});

test("a single channel needs no splitting", () => {
  assert.deepEqual(parseChannels("Premiere"), ["Premiere"]);
});

test("blank fragments are dropped", () => {
  assert.deepEqual(parseChannels("Premiere,, / SporTV "), ["Premiere", "SporTV"]);
  assert.deepEqual(parseChannels("   "), []);
  assert.deepEqual(parseChannels(""), []);
});

// ---------------------------------------------------------------------------
// Joining CBF fixtures to ours
// ---------------------------------------------------------------------------

const club = (code: string, shortName: string, slug: string): Club => ({
  code,
  name: `${shortName} FC`,
  shortName,
  slug,
});

const CLUBS = [
  club("1770", "Botafogo", "botafogo"),
  club("1766", "Atlético-MG", "atletico-mg"),
  club("1768", "Athletico-PR", "athletico-pr"),
  club("4287", "Clube do Remo", "clube-do-remo"),
  club("4286", "Bragantino", "bragantino"),
  club("6685", "Santos", "santos"),
  club("4241", "Coritiba", "coritiba"),
  club("1780", "Vasco da Gama", "vasco-da-gama"),
];

test("CBF local time converts to the right instant", () => {
  // BRT is UTC-3 year-round; Brazil abolished DST in 2019.
  assert.equal(kickoffToIso("24/08/2026", "20:00"), "2026-08-24T23:00:00.000Z");
  assert.equal(kickoffToIso("30/08/2026", "11:00"), "2026-08-30T14:00:00.000Z");
});

test("a late kickoff rolls into the next UTC day", () => {
  assert.equal(kickoffToIso("29/08/2026", "21:20"), "2026-08-30T00:20:00.000Z");
});

test("a malformed date or time yields null, not a wrong instant", () => {
  assert.equal(kickoffToIso("2026-08-24", "20:00"), null);
  assert.equal(kickoffToIso("24/08/2026", "8pm"), null);
  assert.equal(kickoffToIso("", ""), null);
});

test("club names that match outright are resolved", () => {
  assert.equal(matchClub(CLUBS, "Botafogo")?.code, "1770");
});

test("a suffix CBF adds is tolerated", () => {
  // "Santos FC", "Coritiba SAF", "Vasco da Gama Saf".
  assert.equal(matchClub(CLUBS, "Santos FC")?.code, "6685");
  assert.equal(matchClub(CLUBS, "Coritiba SAF")?.code, "4241");
  assert.equal(matchClub(CLUBS, "Vasco da Gama Saf")?.code, "1780");
});

test("structurally different names resolve through the alias map", () => {
  // No prefix relation exists for any of these.
  assert.equal(matchClub(CLUBS, "Atlético Mineiro")?.code, "1766");
  assert.equal(matchClub(CLUBS, "Athletico Paranaense")?.code, "1768");
  assert.equal(matchClub(CLUBS, "Remo")?.code, "4287");
  assert.equal(matchClub(CLUBS, "Red Bull Bragantino")?.code, "4286");
});

test("the two Athletico/Atlético clubs never resolve to each other", () => {
  // One letter apart, different states, both in the division.
  assert.notEqual(
    matchClub(CLUBS, "Atlético Mineiro")?.code,
    matchClub(CLUBS, "Athletico Paranaense")?.code,
  );
});

test("an unknown club resolves to nothing rather than a guess", () => {
  assert.equal(matchClub(CLUBS, "Clube Inexistente"), null);
  assert.equal(matchClub(CLUBS, ""), null);
});

test("channels are split, normalised and de-duplicated", () => {
  assert.deepEqual(
    channelsOf({ transmissoes: [{ nome: "Premiere" }, { nome: "Sportv" }] }),
    ["Premiere", "SporTV"],
  );
  // CBF sometimes packs several into one entry.
  assert.deepEqual(channelsOf({ transmissoes: [{ nome: "ESPN / Disney+" }] }), [
    "ESPN",
    "Disney+",
  ]);
  assert.deepEqual(
    channelsOf({ transmissoes: [{ nome: "Premiere" }, { nome: "Premiere" }] }),
    ["Premiere"],
  );
});

test("a fixture with no listed channels yields none", () => {
  assert.deepEqual(channelsOf({}), []);
  assert.deepEqual(channelsOf({ transmissoes: [] }), []);
  assert.deepEqual(channelsOf({ transmissoes: [{ nome: "" }] }), []);
});

const OURS: Match[] = [
  { ...match("554970"), kickoff: "2026-08-24T23:00:00Z", homeCode: "1770" },
  { ...match("554981"), kickoff: "2026-08-29T21:30:00Z", homeCode: "1766" },
];

test("a CBF fixture joins to our match id", () => {
  const id = joinMatch(OURS, CLUBS, {
    data: "24/08/2026",
    hora: "20:00",
    mandante: { nome: "Botafogo" },
  });

  assert.equal(id, "554970");
});

test("the join tolerates the two ISO spellings of one instant", () => {
  // Ours lacks milliseconds; the conversion produces them.
  const id = joinMatch(OURS, CLUBS, {
    data: "29/08/2026",
    hora: "18:30",
    mandante: { nome: "Atlético Mineiro" },
  });

  assert.equal(id, "554981");
});

test("a fixture we do not have does not join", () => {
  assert.equal(
    joinMatch(OURS, CLUBS, {
      data: "01/01/2027",
      hora: "20:00",
      mandante: { nome: "Botafogo" },
    }),
    null,
  );
});

test("an unresolvable club does not join", () => {
  assert.equal(
    joinMatch(OURS, CLUBS, {
      data: "24/08/2026",
      hora: "20:00",
      mandante: { nome: "Clube Inexistente" },
    }),
    null,
  );
});

test("an incomplete fixture does not join", () => {
  assert.equal(joinMatch(OURS, CLUBS, { hora: "20:00", mandante: { nome: "Botafogo" } }), null);
  assert.equal(joinMatch(OURS, CLUBS, { data: "24/08/2026", hora: "20:00" }), null);
});

test("a provisional kickoff is recognised by its midnight time", () => {
  assert.equal(hasProvisionalKickoff(match("x")), false);
  assert.equal(
    hasProvisionalKickoff({ ...match("x"), kickoff: "2026-09-19T00:00:00Z" }),
    true,
  );
});

test("a fixture whose time is not yet confirmed still joins by date", () => {
  // Rounds 27-38 all sit at T00:00:00Z until the times are set. Without this
  // the join would fail for most of the remaining season.
  const provisional: Match[] = [
    { ...match("555010"), kickoff: "2026-09-19T00:00:00Z", homeCode: "1770" },
  ];

  const id = joinMatch(provisional, CLUBS, {
    data: "19/09/2026",
    hora: "16:00",
    mandante: { nome: "Botafogo" },
  });

  assert.equal(id, "555010");
});

test("an exact instant wins over a same-day provisional fixture", () => {
  const mixed: Match[] = [
    { ...match("exact"), kickoff: "2026-08-24T23:00:00Z", homeCode: "1770" },
    { ...match("provisional"), kickoff: "2026-08-24T00:00:00Z", homeCode: "1770" },
  ];

  const id = joinMatch(mixed, CLUBS, {
    data: "24/08/2026",
    hora: "20:00",
    mandante: { nome: "Botafogo" },
  });

  assert.equal(id, "exact");
});

test("a confirmed fixture on the same day is never matched by date alone", () => {
  // Only provisional fixtures are eligible for the date fallback; otherwise a
  // wrong kickoff would quietly attach channels to the wrong match.
  const confirmed: Match[] = [
    { ...match("555011"), kickoff: "2026-09-19T22:00:00Z", homeCode: "1770" },
  ];

  assert.equal(
    joinMatch(confirmed, CLUBS, {
      data: "19/09/2026",
      hora: "16:00",
      mandante: { nome: "Botafogo" },
    }),
    null,
  );
});

test("a venue string splits into stadium, city and state", () => {
  assert.deepEqual(venueFromLocal("Nilton Santos - Rio de Janeiro - RJ"), {
    stadium: "Nilton Santos",
    city: "Rio de Janeiro",
    state: "RJ",
  });
});

test("stray whitespace around the parts is trimmed", () => {
  // A real CBF row arrived as " Cícero de Souza Marques - Braganca Paulista - SP".
  assert.deepEqual(venueFromLocal("  Cícero de Souza Marques - Braganca Paulista - SP "), {
    stadium: "Cícero de Souza Marques",
    city: "Braganca Paulista",
    state: "SP",
  });
});

test("CBF's own casing and missing accents are preserved, not corrected", () => {
  // Correcting these would mean guessing at proper names.
  assert.deepEqual(venueFromLocal("ARENA MRV - Belo Horizonte - MG"), {
    stadium: "ARENA MRV",
    city: "Belo Horizonte",
    state: "MG",
  });
  assert.equal(venueFromLocal("Morumbi - Sao Paulo - SP")?.city, "Sao Paulo");
});

test("a state code is normalised to upper case", () => {
  assert.equal(venueFromLocal("Maracanã - Rio de Janeiro - rj")?.state, "RJ");
});

test("anything not in the expected shape yields no venue", () => {
  assert.equal(venueFromLocal("Maracanã - Rio de Janeiro"), null);
  assert.equal(venueFromLocal("Maracanã - Rio de Janeiro - Brasil"), null);
  assert.equal(venueFromLocal(" - - "), null);
  assert.equal(venueFromLocal(undefined), null);
});

test("venues attach only to the matches that have one", () => {
  const venue = { stadium: "Nilton Santos", city: "Rio de Janeiro", state: "RJ" };
  const [withVenue, without] = withVenues([match("554970"), match("999999")], {
    "554970": venue,
  });

  assert.deepEqual(withVenue.venue, venue);
  assert.equal("venue" in without, false);
});

test("channel spellings converge on one lookup key", () => {
  // CBF writes "GE TV" and "Cazé TV"; the channels write themselves "ge tv"
  // and "CazéTV". Accents, spaces and case carry no meaning here.
  assert.equal(markKey("GE TV"), markKey("ge tv"));
  assert.equal(markKey("Cazé TV"), markKey("CazéTV"));
  assert.equal(markKey("SporTV"), "SPORTV");
});

test("a known broadcaster resolves to a Commons file", () => {
  const url = broadcasterMarkUrl("Globo");

  assert.ok(url?.startsWith("https://commons.wikimedia.org/wiki/Special:FilePath/"));
  // A thumbnail, not the full asset — these render at 18 pixels tall.
  assert.match(url ?? "", /\?width=\d+$/);
});

test("both spellings of a channel find the same mark", () => {
  assert.equal(broadcasterMarkUrl("Cazé TV"), broadcasterMarkUrl("CazéTV"));
  assert.equal(broadcasterMarkUrl("GE TV"), broadcasterMarkUrl("ge tv"));
});

test("a filename with spaces and an accent is escaped", () => {
  // "CazéTV wordmark.svg" would otherwise produce a broken URL.
  const url = broadcasterMarkUrl("CazéTV") ?? "";

  assert.ok(!url.includes(" "));
  assert.ok(url.includes("Caz%C3%A9TV%20wordmark.svg"));
});

test("an unknown broadcaster yields no mark rather than a guess", () => {
  // CBF's feed already names these, and the UI renders them as wordmarks.
  assert.equal(broadcasterMarkUrl("ESPN / Disney+"), null);
  assert.equal(broadcasterMarkUrl("SportyNet"), null);
  assert.equal(broadcasterMarkUrl("Record"), null);
  assert.equal(broadcasterMarkUrl(""), null);
});
