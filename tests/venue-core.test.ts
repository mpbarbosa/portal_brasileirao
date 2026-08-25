import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStadiums,
  capacityLabel,
  findStadium,
  stadiumLocation,
  stadiumMatches,
  stadiumPhotoPage,
  stadiumPhotoUrl,
  stadiumSlug,
  venueName,
} from "@/venue-core";
import type { Club, Match, StadiumFacts, StadiumPhoto, Venue } from "@/src/types";

const club = (code: string, shortName: string): Club => ({
  code,
  name: shortName,
  shortName,
});

const CLUBS = [
  club("1", "Flamengo"),
  club("2", "Fluminense"),
  club("3", "Atlético-MG"),
  club("4", "Botafogo"),
];

const venue = (stadium: string, city = "Rio de Janeiro", state = "RJ"): Venue => ({
  stadium,
  city,
  state,
});

const match = (over: Partial<Match> & { id: string }): Match => ({
  round: 1,
  kickoff: "2026-08-01T20:00:00Z",
  status: "FINISHED",
  homeCode: "1",
  awayCode: "2",
  homeGoals: 1,
  awayGoals: 0,
  ...over,
});

const PHOTO: StadiumPhoto = {
  file: "Aerea2 maracana.jpg",
  alt: "Vista aérea do Maracanã",
  credit: "Erica Ramalho/Portal da Copa/Março de 2013",
  license: "CC BY 3.0 BR",
  licenseUrl: "https://creativecommons.org/licenses/by/3.0/br/",
};

const FACTS: Record<string, StadiumFacts> = {
  maracana: {
    name: "Maracanã",
    officialName: "Estádio Jornalista Mário Filho",
    capacity: 78838,
    opened: 1950,
    wikipedia: "Estádio Jornalista Mário Filho",
    photo: PHOTO,
  },
  "arena-mrv": { name: "Arena MRV", capacity: 44892 },
};

test("a stadium's identity is its slug, so CBF's casing drift merges", () => {
  assert.equal(stadiumSlug("ARENA MRV"), "arena-mrv");
  assert.equal(stadiumSlug("Arena MRV"), "arena-mrv");
  assert.equal(stadiumSlug("Maracanã"), "maracana");
  assert.equal(stadiumSlug("São Januário"), "sao-januario");
});

test("a venue string with nothing alphanumeric yields no slug", () => {
  assert.equal(stadiumSlug("—"), "");
  assert.equal(stadiumSlug(""), "");
});

test("two spellings of one ground build a single stadium", () => {
  const stadiums = buildStadiums(
    [
      match({ id: "a", homeCode: "3", venue: venue("ARENA MRV", "Belo Horizonte", "MG") }),
      match({ id: "b", homeCode: "3", venue: venue("Arena MRV", "Belo Horizonte", "MG") }),
    ],
    CLUBS,
    FACTS,
  );

  assert.equal(stadiums.length, 1);
  assert.equal(stadiums[0].slug, "arena-mrv");
  assert.equal(stadiums[0].matchCount, 2);
});

test("the curated name wins over CBF's spelling", () => {
  const stadiums = buildStadiums(
    [match({ id: "a", homeCode: "3", venue: venue("ARENA MRV", "Belo Horizonte", "MG") })],
    CLUBS,
    FACTS,
  );

  assert.equal(stadiums[0].name, "Arena MRV");
});

test("an uncurated stadium keeps CBF's spelling rather than vanishing", () => {
  const stadiums = buildStadiums(
    [match({ id: "a", homeCode: "4", venue: venue("Nilton Santos") })],
    CLUBS,
    FACTS,
  );

  assert.equal(stadiums.length, 1);
  assert.equal(stadiums[0].name, "Nilton Santos");
  assert.equal(stadiums[0].capacity, undefined);
  assert.equal(stadiums[0].opened, undefined);
});

test("a ground with two tenants lists both, most fixtures first", () => {
  const stadiums = buildStadiums(
    [
      match({ id: "a", homeCode: "2", venue: venue("Maracanã") }),
      match({ id: "b", homeCode: "1", venue: venue("Maracanã") }),
      match({ id: "c", homeCode: "1", venue: venue("Maracanã") }),
    ],
    CLUBS,
    FACTS,
  );

  assert.deepEqual(
    stadiums[0].homeClubs.map((entry) => entry.shortName),
    ["Flamengo", "Fluminense"],
  );
});

test("fixtures with no venue are skipped, not grouped under an empty key", () => {
  const stadiums = buildStadiums(
    [
      match({ id: "a", venue: venue("Maracanã") }),
      match({ id: "b" }),
      match({ id: "c", venue: venue("—") }),
    ],
    CLUBS,
    FACTS,
  );

  assert.equal(stadiums.length, 1);
  assert.equal(stadiums[0].slug, "maracana");
});

test("a club the payload does not name is dropped rather than faked", () => {
  const stadiums = buildStadiums(
    [match({ id: "a", homeCode: "999", venue: venue("Maracanã") })],
    CLUBS,
    FACTS,
  );

  assert.deepEqual(stadiums[0].homeClubs, []);
  // The stadium itself still exists — the fixture happened somewhere.
  assert.equal(stadiums[0].matchCount, 1);
});

test("stadiums come back alphabetical by display name", () => {
  const stadiums = buildStadiums(
    [
      match({ id: "a", homeCode: "4", venue: venue("Nilton Santos") }),
      match({ id: "b", homeCode: "3", venue: venue("ARENA MRV", "Belo Horizonte", "MG") }),
      match({ id: "c", homeCode: "1", venue: venue("Maracanã") }),
    ],
    CLUBS,
    FACTS,
  );

  assert.deepEqual(
    stadiums.map((entry) => entry.name),
    ["Arena MRV", "Maracanã", "Nilton Santos"],
  );
});

test("fixtures at a stadium come back in kickoff order", () => {
  const matches = [
    match({ id: "late", kickoff: "2026-08-03T20:00:00Z", venue: venue("Maracanã") }),
    match({ id: "early", kickoff: "2026-08-01T20:00:00Z", venue: venue("Maracanã") }),
    match({ id: "elsewhere", venue: venue("Nilton Santos") }),
  ];

  assert.deepEqual(
    stadiumMatches(matches, "maracana").map((entry) => entry.id),
    ["early", "late"],
  );
});

test("a stadium resolves from its slug, accents and all", () => {
  const stadiums = buildStadiums(
    [match({ id: "a", venue: venue("Maracanã") })],
    CLUBS,
    FACTS,
  );

  assert.equal(findStadium(stadiums, "maracana")?.name, "Maracanã");
  // A hand-typed accented segment still lands, rather than 404-ing.
  assert.equal(findStadium(stadiums, "Maracanã")?.name, "Maracanã");
  assert.equal(findStadium(stadiums, "vila-belmiro"), null);
  assert.equal(findStadium(stadiums, ""), null);
});

test("the match page names a ground the same way the stadium page does", () => {
  assert.equal(venueName(venue("ARENA MRV", "Belo Horizonte", "MG"), FACTS), "Arena MRV");
  // Nothing curated: CBF's own spelling, rather than a blank.
  assert.equal(venueName(venue("Nilton Santos"), FACTS), "Nilton Santos");
  assert.equal(venueName(venue("Nilton Santos")), "Nilton Santos");
});

test("location reads as city and state", () => {
  const [stadium] = buildStadiums(
    [match({ id: "a", venue: venue("Maracanã") })],
    CLUBS,
    FACTS,
  );

  assert.equal(stadiumLocation(stadium), "Rio de Janeiro – RJ");
});

test("capacity is grouped pt-BR, and absent when uncurated", () => {
  const [curated] = buildStadiums(
    [match({ id: "a", venue: venue("Maracanã") })],
    CLUBS,
    FACTS,
  );
  const [bare] = buildStadiums(
    [match({ id: "b", venue: venue("Nilton Santos") })],
    CLUBS,
    FACTS,
  );

  assert.equal(capacityLabel(curated), "78.838");
  // Not "0" and not "—": the caller leaves the tile out entirely.
  assert.equal(capacityLabel(bare), null);
});

test("a curated photo reaches the built stadium, and an uncurated one is absent", () => {
  const [curated] = buildStadiums(
    [match({ id: "a", venue: venue("Maracanã") })],
    CLUBS,
    FACTS,
  );
  const [bare] = buildStadiums(
    [match({ id: "b", venue: venue("Arena MRV", "Belo Horizonte", "MG") })],
    CLUBS,
    FACTS,
  );

  assert.deepEqual(curated.photo, PHOTO);
  // Absent, not an empty object: the view keys the whole figure off this, and
  // an empty one would render an image with no source and no credit.
  assert.equal(bare.photo, undefined);
});

test("a photo address asks Commons for the width the page will draw", () => {
  assert.equal(
    stadiumPhotoUrl(PHOTO, 736),
    "https://commons.wikimedia.org/wiki/Special:FilePath/Aerea2%20maracana.jpg?width=736",
  );
  // Different widths are different addresses, which is what makes a srcSet
  // worth writing — one entry per width the browser may choose.
  assert.notEqual(stadiumPhotoUrl(PHOTO, 480), stadiumPhotoUrl(PHOTO, 1472));
});

test("a file page keeps its underscores, and encodes only the accents", () => {
  const accented: StadiumPhoto = { ...PHOTO, file: "Estádio Cícero de Souza Marques (3).jpg" };

  // Spaces become underscores first, so the encoder never sees them — an
  // encoded underscore (%5F) is a different Commons title and 404s.
  assert.equal(
    stadiumPhotoPage(accented),
    "https://commons.wikimedia.org/wiki/File:Est%C3%A1dio_C%C3%ADcero_de_Souza_Marques_(3).jpg",
  );
  assert.ok(!stadiumPhotoPage(accented).includes("%5F"));
});
