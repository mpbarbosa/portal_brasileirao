import assert from "node:assert/strict";
import test from "node:test";

import {
  MIN_READABLE_TEXT,
  clubNameWords,
  isBotChallenge,
  readableText,
  siteVerdict,
} from "@/club-website-core";

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

/* ------------------------------------------------------ bot challenges ---- */

/** Just enough of a `Headers` for the structural test. */
const headers = (pairs: Record<string, string>) => ({
  get: (name: string) => pairs[name.toLowerCase()] ?? null,
});

test("a Cloudflare challenge is told apart from an ordinary refusal", () => {
  // Measured on Vasco 2026-09-16: 403, `cf-mitigated: challenge`, `server:
  // cloudflare`. Permanent by design, so it must not read as a lead.
  assert.equal(
    isBotChallenge(403, headers({ "cf-mitigated": "challenge", server: "cloudflare" })),
    true,
  );
});

test("it reads the HEADERS, never the challenge page's words", () => {
  // The page is localised — "Um momento…" to a pt-BR client, "Just a moment..."
  // to an en one, both measured. A title rule would be orthography-matching in
  // every language the vendor ships, which is the join this repo refuses.
  const localised = `<title>Um momento…</title><p>Verificando o seu navegador</p>`;
  assert.equal(isBotChallenge(403, headers({})), false, "no headers, no claim");
  assert.equal(isBotChallenge(200, headers({ server: "cloudflare" })), false, "a 200 is not a challenge");
  assert.ok(localised.includes("momento"), "the page says so and is still not the evidence");
});

test("an ordinary 404 or 500 is not a challenge", () => {
  // These are the rows that stay INCONCLUSIVE and may be worth a second look;
  // conflating them with a refusal would hide a dead host.
  assert.equal(isBotChallenge(404, headers({ server: "nginx" })), false);
  assert.equal(isBotChallenge(500, headers({ server: "cloudflare" })), false);
});

test("a cloudflare-fronted site that ANSWERS is not challenged", () => {
  // Much of the web sits behind this vendor. Only the refusal statuses count,
  // or every club on the CDN would be reported as refusing automation.
  assert.equal(isBotChallenge(200, headers({ server: "cloudflare" })), false);
  assert.equal(isBotChallenge(301, headers({ server: "cloudflare" })), false);
});

test("the mitigation header alone is enough, whatever the server says", () => {
  // A vendor may front the site under another name; the header is the claim.
  assert.equal(isBotChallenge(429, headers({ "cf-mitigated": "challenge" })), true);
});
