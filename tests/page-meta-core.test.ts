import assert from "node:assert/strict";
import { test } from "node:test";

import { injectMeta, pageMeta, SITE_NAME } from "@/page-meta-core";
import type { Club, Match, StandingsRow } from "@/src/types";

const club = (code: string, shortName: string, slug: string, crest?: string): Club => ({
  code,
  name: `${shortName} FC`,
  shortName,
  slug,
  ...(crest ? { crest } : {}),
});

const CLUBS = [
  club("1783", "Flamengo", "flamengo", "https://crests.football-data.org/1783.png"),
  club("1770", "Botafogo", "botafogo"),
];

const MATCH: Match = {
  id: "554970",
  round: 24,
  kickoff: "2026-08-24T23:00:00Z",
  status: "FINISHED",
  homeCode: "1783",
  awayCode: "1770",
  homeGoals: 2,
  awayGoals: 1,
};

test("the table is the site's own title, not a suffixed section", () => {
  const meta = pageMeta({ section: "classificacao" });

  assert.equal(meta.title, `${SITE_NAME} — Campeonato Brasileiro Série A`);
  assert.ok(meta.description.length > 0);
});

test("ao vivo is a titled section, and says what it is", () => {
  const meta = pageMeta({ section: "ao-vivo" });

  assert.equal(meta.title, `Ao vivo · ${SITE_NAME}`);
  assert.match(meta.description, /Série A/);
});

test("a round names itself in the title", () => {
  assert.equal(pageMeta({ section: "jogos", round: 25 }).title, `25ª rodada · ${SITE_NAME}`);
  assert.equal(pageMeta({ section: "jogos", round: null }).title, `Jogos · ${SITE_NAME}`);
});

test("a club page is titled by the club", () => {
  const meta = pageMeta({ section: "clube", key: "flamengo" }, { clubs: CLUBS });

  assert.equal(meta.title, `Flamengo · ${SITE_NAME}`);
  assert.equal(meta.image, "https://crests.football-data.org/1783.png");
});

test("a club page resolves by code as well as slug", () => {
  assert.equal(
    pageMeta({ section: "clube", key: "1783" }, { clubs: CLUBS }).title,
    `Flamengo · ${SITE_NAME}`,
  );
});

test("a club's standing enriches the description when known", () => {
  const standings = [
    { club: CLUBS[0], position: 2, points: 45, played: 23 } as StandingsRow,
  ];
  const meta = pageMeta({ section: "clube", key: "flamengo" }, { clubs: CLUBS, standings });

  assert.match(meta.description, /2º lugar/);
  assert.match(meta.description, /45 pontos/);
  assert.match(meta.description, /23 jogos/);
});

test("singular and plural agree in the description", () => {
  const standings = [{ club: CLUBS[0], position: 20, points: 1, played: 1 } as StandingsRow];
  const meta = pageMeta({ section: "clube", key: "flamengo" }, { clubs: CLUBS, standings });

  assert.match(meta.description, /1 ponto\b/);
  assert.match(meta.description, /1 jogo\b/);
});

test("a match page names both clubs and the score", () => {
  const meta = pageMeta(
    { section: "partida", id: "554970" },
    { clubs: CLUBS, matches: [MATCH] },
  );

  assert.equal(meta.title, `Flamengo 2 x 1 Botafogo · ${SITE_NAME}`);
  assert.match(meta.description, /24ª rodada/);
});

test("an unplayed match shows no score in the title", () => {
  const meta = pageMeta(
    { section: "partida", id: "554970" },
    { clubs: CLUBS, matches: [{ ...MATCH, status: "SCHEDULED", homeGoals: null, awayGoals: null }] },
  );

  assert.equal(meta.title, `Flamengo x Botafogo · ${SITE_NAME}`);
});

test("a match description carries venue and channels when known", () => {
  const meta = pageMeta(
    { section: "partida", id: "554970" },
    {
      clubs: CLUBS,
      matches: [
        {
          ...MATCH,
          venue: { stadium: "Maracanã", city: "Rio de Janeiro", state: "RJ" },
          broadcasters: ["Premiere", "SporTV"],
        },
      ],
    },
  );

  assert.match(meta.description, /Maracanã, Rio de Janeiro/);
  assert.match(meta.description, /Premiere, SporTV/);
});

test("metadata degrades to the section when the data has not loaded", () => {
  // Titles are set before the fetch resolves; a blank or "undefined" would ship.
  assert.equal(pageMeta({ section: "clube", key: "flamengo" }).title, `Clube · ${SITE_NAME}`);
  assert.equal(pageMeta({ section: "partida", id: "554970" }).title, `Partida · ${SITE_NAME}`);
});

const HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <title>Original</title>
    <meta name="description" content="Original description" />
  </head>
  <body></body>
</html>`;

test("injection replaces the title rather than adding a second", () => {
  const out = injectMeta(HTML, { title: "Flamengo", description: "d" });

  assert.equal((out.match(/<title>/g) ?? []).length, 1);
  assert.match(out, /<title>Flamengo<\/title>/);
  assert.ok(!out.includes("<title>Original</title>"));
});

test("injection replaces the description rather than adding a second", () => {
  const out = injectMeta(HTML, { title: "t", description: "Nova descrição" });

  assert.equal((out.match(/name="description"/g) ?? []).length, 1);
  assert.match(out, /content="Nova descrição"/);
});

test("Open Graph and Twitter tags are added before the head closes", () => {
  const out = injectMeta(HTML, { title: "Flamengo", description: "d" });

  assert.match(out, /<meta property="og:title" content="Flamengo" \/>/);
  assert.match(out, /<meta name="twitter:title" content="Flamengo" \/>/);
  assert.ok(out.indexOf("og:title") < out.indexOf("</head>"));
});

test("an image is included only when there is one", () => {
  const withImage = injectMeta(HTML, { title: "t", description: "d", image: "https://x/y.png" });
  const without = injectMeta(HTML, { title: "t", description: "d" });

  assert.match(withImage, /og:image" content="https:\/\/x\/y.png"/);
  assert.ok(!without.includes("og:image"));
});

test("a canonical URL is emitted when supplied", () => {
  const out = injectMeta(HTML, { title: "t", description: "d" }, "https://site/clube/flamengo");

  assert.match(out, /<link rel="canonical" href="https:\/\/site\/clube\/flamengo" \/>/);
  assert.match(out, /og:url" content="https:\/\/site\/clube\/flamengo"/);
});

test("HTML in a value is escaped, not injected", () => {
  const out = injectMeta(HTML, {
    title: 'Club "X" <script>alert(1)</script>',
    description: "a & b",
  });

  assert.ok(!out.includes("<script>alert(1)</script>"));
  assert.match(out, /&lt;script&gt;/);
  assert.match(out, /&quot;X&quot;/);
  assert.match(out, /a &amp; b/);
});

test("a document with no head is returned unchanged rather than blanked", () => {
  const fragment = "<p>no head here</p>";

  assert.equal(injectMeta(fragment, { title: "t", description: "d" }), fragment);
});
