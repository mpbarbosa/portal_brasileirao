import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ageOn,
  birthDateLabel,
  mergePlayer,
  playerInstagram,
  PLAYER_PHOTO_WIDTHS,
  playerPhotoPage,
  playerPhotoUrl,
  playerSearchUrls,
  playerSofascore,
  playerWikipedia,
  positionLabel,
  sofascoreUrl,
} from "@/player-core";
import type { Player } from "@/src/types";

test("broad positions are translated", () => {
  assert.equal(positionLabel("Goalkeeper"), "Goleiro");
  assert.equal(positionLabel("Defence"), "Defesa");
  assert.equal(positionLabel("Midfield"), "Meio-campo");
  assert.equal(positionLabel("Offence"), "Ataque");
});

test("specific roles are translated too", () => {
  assert.equal(positionLabel("Centre-Back"), "Zagueiro");
  assert.equal(positionLabel("Defensive Midfield"), "Volante");
  assert.equal(positionLabel("Centre-Forward"), "Centroavante");
});

test("an unmapped position is shown verbatim rather than guessed at", () => {
  assert.equal(positionLabel("Sweeper"), "Sweeper");
});

test("a missing position yields null, not an empty label", () => {
  assert.equal(positionLabel(undefined), null);
  assert.equal(positionLabel(""), null);
  assert.equal(positionLabel("   "), null);
});

const at = (iso: string) => new Date(iso);

test("age counts whole years", () => {
  assert.equal(ageOn("1997-06-20", at("2026-08-24T00:00:00Z")), 29);
});

test("a birthday counts on the day itself, not before", () => {
  assert.equal(ageOn("1997-06-20", at("2026-06-19T23:00:00Z")), 28);
  assert.equal(ageOn("1997-06-20", at("2026-06-20T00:00:00Z")), 29);
});

test("a birthday later in the year has not happened yet", () => {
  assert.equal(ageOn("1997-12-31", at("2026-01-01T00:00:00Z")), 28);
});

test("a leap-day birth is handled without going backwards", () => {
  assert.equal(ageOn("2000-02-29", at("2026-02-28T00:00:00Z")), 25);
  assert.equal(ageOn("2000-02-29", at("2026-03-01T00:00:00Z")), 26);
});

test("a missing or unparseable date yields null", () => {
  assert.equal(ageOn(undefined, at("2026-08-24T00:00:00Z")), null);
  assert.equal(ageOn("not-a-date", at("2026-08-24T00:00:00Z")), null);
});

test("a date in the future yields null rather than a negative age", () => {
  assert.equal(ageOn("2030-01-01", at("2026-08-24T00:00:00Z")), null);
});

const base: Player = { id: "1", name: "Pedro" };

test("enrichment fills gaps without blanking what is known", () => {
  const merged = mergePlayer(
    { ...base, position: "Offence" },
    { id: "1", name: "Pedro", shirtNumber: 9 },
  );

  assert.equal(merged.shirtNumber, 9);
  assert.equal(merged.position, "Offence");
  assert.equal(merged.name, "Pedro");
});

test("enrichment wins where both have a value", () => {
  const merged = mergePlayer(
    { ...base, shirtNumber: 1 },
    { id: "1", name: "Pedro", shirtNumber: 9 },
  );

  assert.equal(merged.shirtNumber, 9);
});

test("a failed enrichment leaves the card as it was", () => {
  const withData = { ...base, shirtNumber: 9, position: "Offence" };

  assert.deepEqual(mergePlayer(withData, null), withData);
});

test("playerInstagram resolves a recorded handle and ignores an unknown id", () => {
  const handles = { "8472": "memphisdepay" };

  assert.equal(playerInstagram("8472", handles), "memphisdepay");
  // Absence, not an error: most of the division has no recorded account, and a
  // player with none must render no link rather than one that lands on a 404.
  assert.equal(playerInstagram("1", handles), null);
});

test("playerInstagram normalises whatever form the handle was written in", () => {
  // The table is hand-maintained, so the value may arrive as a pasted profile
  // URL with Instagram's locale hint on it, or with the @ still attached.
  assert.equal(playerInstagram("a", { a: "@memphisdepay" }), "memphisdepay");
  assert.equal(
    playerInstagram("b", { b: "https://www.instagram.com/memphisdepay/?hl=pt-br" }),
    "memphisdepay",
  );
  // Not a plausible handle: no link at all, rather than a broken one.
  assert.equal(playerInstagram("c", { c: "não é um perfil" }), null);
});

test("playerWikipedia builds the article address from a stored title", () => {
  const articles = { "8472": "Memphis Depay" };

  assert.equal(
    playerWikipedia("8472", articles),
    "https://pt.wikipedia.org/wiki/Memphis_Depay",
  );
  // Absence, not an error: most of the division has no article recorded.
  assert.equal(playerWikipedia("1", articles), null);
});

test("playerWikipedia carries a disambiguated title through intact", () => {
  // Half the recorded titles are disambiguated, because the popular name is
  // shared — this is precisely why the title cannot be derived from the name
  // the app already holds, and has to be stored.
  assert.equal(
    playerWikipedia("a", { a: "Dudu (futebolista, 1992)" }),
    "https://pt.wikipedia.org/wiki/Dudu_(futebolista%2C_1992)",
  );
});

test("playerPhotoUrl addresses our own origin, keyed by player id", () => {
  // Not Commons: the bytes are vendored, and a path pointing back at Commons is
  // the 429 that vendoring exists to avoid.
  assert.equal(playerPhotoUrl("8472", 64), "/players/8472-64.jpg");
  assert.equal(playerPhotoUrl("8472", 128), "/players/8472-128.jpg");
});

test("every width the card asks for is one the sync writes", () => {
  // Two copies of this list is how the card comes to request a size nobody
  // vendored — which fails as a missing image, not as a build error.
  assert.deepEqual([...PLAYER_PHOTO_WIDTHS], [64, 128]);
});

test("playerPhotoPage links the Commons file page the licence requires", () => {
  const photo = {
    file: "Memphis Depay 2019.jpg",
    alt: "…",
    credit: "Derivative work: Joe Sins",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  };
  // Underscores first, then encoding — the other order percent-encodes the
  // underscores it just introduced and lands on no page at all.
  assert.equal(
    playerPhotoPage(photo),
    "https://commons.wikimedia.org/wiki/File:Memphis_Depay_2019.jpg",
  );
});

test("birthDateLabel writes the date the way a reader does", () => {
  assert.equal(birthDateLabel("1994-02-13"), "13 fev. 1994");
  assert.equal(birthDateLabel("1995-04-26"), "26 abr. 1995");
  // First and last month, because an off-by-one in the month table shows up
  // only at the ends of the year.
  assert.equal(birthDateLabel("2004-01-01"), "1 jan. 2004");
  assert.equal(birthDateLabel("2004-12-31"), "31 dez. 2004");
});

test("birthDateLabel reads the date in UTC, not in the reader's calendar", () => {
  // The upstream sends a bare date, which `Date` parses as UTC midnight. Read
  // through a local calendar in Brazil (UTC-3) that midnight is the previous
  // evening, so every date on the card would be a day early. Pinned here
  // because the failure is silent and off by exactly one.
  const previous = process.env.TZ;
  process.env.TZ = "America/Sao_Paulo";
  try {
    assert.equal(birthDateLabel("1994-02-13"), "13 fev. 1994");
  } finally {
    process.env.TZ = previous;
  }
});

test("birthDateLabel answers null for what it cannot read", () => {
  // Same contract as `ageOn` and `positionLabel`: an absent value renders as no
  // row at all, never as a dash or the string "Invalid Date".
  assert.equal(birthDateLabel(undefined), null);
  assert.equal(birthDateLabel(""), null);
  assert.equal(birthDateLabel("não é uma data"), null);
});

test("playerSearchUrls quotes the name and narrows by club", () => {
  const { google } = playerSearchUrls("Pedro", "Flamengo");
  const query = new URL(google).searchParams.get("q");

  // The quotes are what stop a one-word name returning the whole division, and
  // the club is what tells two players of the same name apart.
  assert.equal(query, '"Pedro" Flamengo futebol');
  assert.equal(new URL(google).searchParams.get("hl"), "pt-BR");
  assert.equal(new URL(google).searchParams.get("gl"), "BR");
});

test("playerSearchUrls works for a player whose club the card does not know", () => {
  // Opened from the artilharia with the provider down, the card may hold a name
  // and nothing else. A search for a name alone is still worth offering; a
  // query reading `"Pedro" undefined futebol` is not.
  const { google } = playerSearchUrls("Pedro");
  assert.equal(new URL(google).searchParams.get("q"), '"Pedro" futebol');
});

test("the news link is the same query, not a second one", () => {
  // Two independently built queries is how the two tabs come to search for
  // different things after someone edits one of them.
  const { google, news } = playerSearchUrls("Memphis Depay", "Corinthians");
  assert.ok(news.startsWith(google));
  assert.equal(new URL(news).searchParams.get("tbm"), "nws");
  assert.equal(
    new URL(news).searchParams.get("q"),
    new URL(google).searchParams.get("q"),
  );
});

test("sofascoreUrl drops the slug rather than storing one", () => {
  // The slug is decoration: `_` in that position resolves by id, which is what
  // lets the table hold a bare number and cannot rot when Sofascore renames a
  // player's URL.
  assert.equal(
    sofascoreUrl("138833"),
    "https://www.sofascore.com/player/_/138833",
  );
});

test("sofascoreUrl accepts whatever form the profile was pasted in", () => {
  // The table is hand-maintained, so the value may arrive as the address a
  // reader copied out of the browser — with the locale prefix, the sport, the
  // slug and a tab anchor on it. Only the id survives.
  const expected = "https://www.sofascore.com/player/_/138833";

  assert.equal(
    sofascoreUrl("https://www.sofascore.com/pt/football/player/memphis-depay/138833"),
    expected,
  );
  assert.equal(sofascoreUrl("https://www.sofascore.com/player/_/138833"), expected);
  assert.equal(
    sofascoreUrl("https://www.sofascore.com/football/player/memphis-depay/138833#tab:statistics"),
    expected,
  );
});

test("sofascoreUrl refuses anything that is not a plausible id", () => {
  // No link at all, rather than one that lands on Sofascore's 404 — the same
  // rule `wikipediaUrl` and `instagramUrl` follow.
  assert.equal(sofascoreUrl("memphis-depay"), null);
  assert.equal(sofascoreUrl("1"), null);
  assert.equal(sofascoreUrl("12345678"), null);
  assert.equal(sofascoreUrl(""), null);
  assert.equal(sofascoreUrl(undefined), null);
  // Another host's URL is not rewritten into a Sofascore one: that would build
  // a plausible address out of somebody else's identifier.
  assert.equal(sofascoreUrl("https://www.transfermarkt.com/player/138833"), null);
  assert.equal(sofascoreUrl("not a url/138833"), null);
});

test("playerSofascore builds the profile address from a stored id", () => {
  const profiles = { "8472": "138833" };

  assert.equal(
    playerSofascore("8472", profiles),
    "https://www.sofascore.com/player/_/138833",
  );
  // Absence, not an error: coverage is partial and roughly half the listed
  // players have no recorded profile.
  assert.equal(playerSofascore("1", profiles), null);
});

test("playerSofascore tells two players of one name apart", () => {
  // Athletico-PR really does list two Dudus, and they are two men ten years
  // apart with two Sofascore profiles. This is the whole reason the table is
  // keyed by player id rather than by name.
  const profiles = { "1584": "859083", "211606": "1482354" };

  assert.equal(
    playerSofascore("1584", profiles),
    "https://www.sofascore.com/player/_/859083",
  );
  assert.equal(
    playerSofascore("211606", profiles),
    "https://www.sofascore.com/player/_/1482354",
  );
});
