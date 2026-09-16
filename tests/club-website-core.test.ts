import assert from "node:assert/strict";
import test from "node:test";

import { MIN_READABLE_TEXT, clubNameWords, readableText, siteVerdict } from "@/club-website-core";

/** Enough readable text to clear `MIN_READABLE_TEXT`, naming nobody. */
const filler = "lorem ipsum dolor sit amet ".repeat(40);

/* ------------------------------------------------------------- the trap --- */

test("a squatted domain does not pass on its own permalinks", () => {
  // The case this module exists for, reduced to its shape: `bragantino.net`
  // serves a Vietnamese jobs blog whose every internal link still spells the
  // club's name, because the club's name is the domain. A rule reading the raw
  // HTML answers NAMES_CLUB here — which is a checker certifying the exact
  // entry it was written to catch.
  const squatted =
    `<a href="https://www.bragantino.net/top-5-website">Kiếm việc làm</a>` +
    `<a href="https://www.bragantino.net/sale-online">tuyển dụng</a>` +
    filler;

  assert.equal(siteVerdict(squatted, "Bragantino"), "no-name");
  assert.ok(squatted.includes("bragantino"), "the raw HTML does carry the name — that is the trap");
  assert.ok(!readableText(squatted).includes("bragantino"), "the readable text must not");
});

test("the club's own site passes on its text", () => {
  const real = `<title>Red Bull Bragantino</title><h1>Massa Bruta em campo</h1>${filler}`;
  assert.equal(siteVerdict(real, "Bragantino"), "names-club");
});

test("an address printed as visible text does not vouch for the page either", () => {
  // The case the tag strip cannot reach, and the reason the bare-URL rule is
  // not redundant with it: a footer or a citation printing the address as prose
  // puts the domain into readable text with no attribute to remove. Confirmed
  // by mutation — deleting the bare-URL rule reddens this and nothing else.
  const cited = `<p>Fonte: https://www.bragantino.net/sobre</p>${filler}`;

  assert.ok(!readableText(cited).includes("bragantino"));
  assert.equal(siteVerdict(cited, "Bragantino"), "no-name");
});

/* --------------------------------------------------------- the spelling --- */

test("a club that spells its own name two ways still passes", () => {
  // Measured, not hypothetical: `shortName` is "Athletico-PR" and the site at
  // the recorded address is titled "Clube Atlético Paranaense - Site Oficial".
  // Without the fold this is a NO_NAME on a correct entry every month.
  const page = `<title>Clube Atlético Paranaense - Site Oficial</title>${filler}`;
  assert.equal(siteVerdict(page, "Athletico-PR"), "names-club");
});

test("folding cannot make two different clubs equal", () => {
  // The bound on the rule above: it widens how a name may be written, never
  // what counts as a match.
  const page = `<title>Sociedade Esportiva Palmeiras</title>${filler}`;
  assert.equal(siteVerdict(page, "Corinthians"), "no-name");
});

test("accents are folded in both directions", () => {
  assert.equal(siteVerdict(`<p>Grêmio Foot-Ball Porto Alegrense</p>${filler}`, "Gremio"), "names-club");
  assert.equal(siteVerdict(`<p>Vitoria</p>${filler}`, "Vitória"), "names-club");
});

/* ------------------------------------------------------- every word, not --- */

test("every word of a multi-word name has to appear", () => {
  // "Clube" alone is carried by three clubs in this division and is no
  // evidence; an any-word rule would accept it.
  assert.equal(siteVerdict(`<p>Clube de alguma outra coisa</p>${filler}`, "Clube do Remo"), "no-name");
  assert.equal(siteVerdict(`<p>Clube do Remo, Belém</p>${filler}`, "Clube do Remo"), "names-club");
});

test("short words are not searched for", () => {
  // "-PR", "do", "da" carry nothing and would match almost any page.
  assert.deepEqual(clubNameWords("Athletico-PR"), ["atletico"]);
  assert.deepEqual(clubNameWords("Vasco da Gama"), ["vasco", "gama"]);
  assert.deepEqual(clubNameWords("São Paulo"), ["sao", "paulo"]);
});

/* -------------------------------------------------------- inconclusive ---- */

test("a client-rendered shell is inconclusive, never a failure", () => {
  // Coritiba serves 66 characters and Grêmio none. That is a fact about how the
  // site is built, not evidence about whose it is — and reporting it as a
  // failure is how a monthly checker trains its reader to skip the report.
  assert.equal(siteVerdict(`<div id="root"></div>`, "Coritiba"), "inconclusive");
  assert.equal(siteVerdict("", "Grêmio"), "inconclusive");
});

test("a thin page that DOES name the club still passes", () => {
  // Order matters inside `siteVerdict`: the match is asked first, so a short
  // page carrying the name is not thrown away as inconclusive. Cruzeiro's own
  // site renders 88 characters and names the club in them.
  const thin = `<title>Cruzeiro Esporte Clube</title>`;
  assert.ok(readableText(thin).length < MIN_READABLE_TEXT);
  assert.equal(siteVerdict(thin, "Cruzeiro"), "names-club");
});

test("script and style contents are not readable text", () => {
  // A club name inside a tracking blob or a CSS comment is not the page saying
  // anything to a reader.
  const buried = `<script>var club = "Palmeiras";</script><style>/* Palmeiras */</style>${filler}`;
  assert.equal(siteVerdict(buried, "Palmeiras"), "no-name");
});
