import assert from "node:assert/strict";
import { test } from "node:test";

import {
  injectMeta,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  pageMeta,
  SITE_NAME,
  type PreviewImage,
} from "@/page-meta-core";
import { buildStadiums } from "@/venue-core";
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

const STADIUMS = buildStadiums(
  [
    {
      id: "1",
      round: 24,
      kickoff: "2026-08-01T20:00:00Z",
      status: "FINISHED",
      homeCode: "1783",
      awayCode: "1770",
      homeGoals: 1,
      awayGoals: 0,
      venue: { stadium: "Maracanã", city: "Rio de Janeiro", state: "RJ" },
    },
  ],
  CLUBS,
  { maracana: { name: "Maracanã", capacity: 78838 } },
);

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
  assert.equal(meta.image?.url, "https://crests.football-data.org/1783.png");
  assert.equal(meta.image?.shape, "square");
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

const WIDE: PreviewImage = {
  url: "https://x/card.png",
  shape: "wide",
  width: 1200,
  height: 630,
  alt: "cartão",
};

const SQUARE: PreviewImage = { url: "https://x/crest.png", shape: "square", alt: "escudo" };

test("an image is included only when there is one", () => {
  const withImage = injectMeta(HTML, { title: "t", description: "d", image: WIDE });
  const without = injectMeta(HTML, { title: "t", description: "d" });

  assert.match(withImage, /og:image" content="https:\/\/x\/card.png"/);
  assert.match(withImage, /twitter:image" content="https:\/\/x\/card.png"/);
  assert.ok(!without.includes("og:image"));
  assert.ok(!without.includes("twitter:image"));
});

test("the card type follows the image's shape", () => {
  // This was inverted: summary_large_image was declared exactly when there was
  // no image to fill it, and a crest was cramped into the wide layout.
  const wide = injectMeta(HTML, { title: "t", description: "d", image: WIDE });
  const square = injectMeta(HTML, { title: "t", description: "d", image: SQUARE });
  const none = injectMeta(HTML, { title: "t", description: "d" });

  assert.match(wide, /twitter:card" content="summary_large_image"/);
  assert.match(square, /twitter:card" content="summary"/);
  assert.match(none, /twitter:card" content="summary"/);
});

test("dimensions ride along only when they are known", () => {
  const wide = injectMeta(HTML, { title: "t", description: "d", image: WIDE });
  const square = injectMeta(HTML, { title: "t", description: "d", image: SQUARE });

  assert.match(wide, /og:image:width" content="1200"/);
  assert.match(wide, /og:image:height" content="630"/);
  // A crest arrives from the provider at an unspecified size; guessing would
  // tell a scraper to lay out a box the image does not fill.
  assert.ok(!square.includes("og:image:width"));
});

test("the image carries alt text, escaped", () => {
  const out = injectMeta(HTML, {
    title: "t",
    description: "d",
    image: { ...SQUARE, alt: 'Escudo do "X" & cia' },
  });

  assert.match(out, /og:image:alt" content="Escudo do &quot;X&quot; &amp; cia"/);
});

test("the locale is declared", () => {
  assert.match(injectMeta(HTML, { title: "t", description: "d" }), /og:locale" content="pt_BR"/);
});

test("a canonical URL is emitted when supplied", () => {
  const out = injectMeta(HTML, { title: "t", description: "d" }, {
    canonicalUrl: "https://site/clube/flamengo",
  });

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

test("a stadium page names the ground and who plays there", () => {
  const meta = pageMeta({ section: "estadio", key: "maracana" }, { stadiums: STADIUMS });

  assert.match(meta.title, /Maracanã/);
  assert.match(meta.description, /Rio de Janeiro – RJ/);
  assert.match(meta.description, /Casa do Flamengo/);
  assert.match(meta.description, /78\.838/);
});

test("an unknown stadium still gets a truthful title, not undefined", () => {
  const meta = pageMeta({ section: "estadio", key: "nao-existe" }, {});

  assert.match(meta.title, /Estádio/);
  assert.ok(!meta.title.includes("undefined"));
});

test("a noindex page says so, and still lets its links be followed", () => {
  const out = injectMeta(HTML, { title: "t", description: "d" }, { noindex: true });

  assert.match(out, /<meta name="robots" content="noindex, follow" \/>/);
});

test("an indexable page carries no robots tag at all", () => {
  assert.ok(!injectMeta(HTML, { title: "t", description: "d" }).includes('name="robots"'));
});

test("pre-rendered JSON-LD is placed inside the head", () => {
  const script = '<script type="application/ld+json">{"@type":"WebSite"}</script>';
  const out = injectMeta(HTML, { title: "t", description: "d" }, { jsonLd: script });

  assert.ok(out.includes(script));
  assert.ok(out.indexOf(script) < out.indexOf("</head>"));
});

const ORIGIN = "https://site.test";

test("every section carries the site's own card", () => {
  for (const route of [
    { section: "classificacao" },
    { section: "ao-vivo" },
    { section: "jogos", round: null },
    { section: "artilharia" },
    { section: "jogadores" },
    { section: "estadio", key: "nao-existe" },
  ] as const) {
    const image = pageMeta(route, {}, ORIGIN).image;

    assert.equal(image?.url, `${ORIGIN}${OG_IMAGE_PATH}`, route.section);
    assert.equal(image?.shape, "wide", route.section);
    assert.equal(image?.width, OG_IMAGE_WIDTH);
    assert.equal(image?.height, OG_IMAGE_HEIGHT);
  }
});

test("a fixture takes the site's card, not one of the two clubs' crests", () => {
  // Illustrating a match with the home crest asserts the page is about that
  // club, which is also how the away side reads it.
  const image = pageMeta({ section: "partida", id: "554970" }, { clubs: CLUBS, matches: [MATCH] }, ORIGIN).image;

  assert.equal(image?.url, `${ORIGIN}${OG_IMAGE_PATH}`);
  assert.equal(image?.shape, "wide");
});

test("a stadium takes the site's card, not the photograph of the ground", () => {
  // The page shows a CC BY-SA photo with its credit line beneath it. An
  // og:image is republication on somebody else's surface, where that credit
  // does not travel — so the card goes out instead of the photograph.
  const meta = pageMeta({ section: "estadio", key: "maracana" }, { stadiums: STADIUMS }, ORIGIN);

  assert.equal(meta.image?.url, `${ORIGIN}${OG_IMAGE_PATH}`);
  assert.equal(meta.image?.shape, "wide");
  assert.ok(!JSON.stringify(meta.image).includes("upload.wikimedia.org"));
  assert.ok(!JSON.stringify(meta.image).includes("/stadiums/"));
});

test("a stadium page declares the wide card, since the site card fills it", () => {
  const out = injectMeta(
    HTML,
    pageMeta({ section: "estadio", key: "maracana" }, { stadiums: STADIUMS }, ORIGIN),
  );

  assert.match(out, /twitter:card" content="summary_large_image"/);
  assert.match(out, new RegExp(`og:image" content="${ORIGIN}${OG_IMAGE_PATH}"`));
});

test("a club with no crest falls back to the site's card", () => {
  const image = pageMeta({ section: "clube", key: "botafogo" }, { clubs: CLUBS }, ORIGIN).image;

  assert.equal(image?.url, `${ORIGIN}${OG_IMAGE_PATH}`);
});

test("no origin means no card, rather than an unfetchable relative one", () => {
  // A scraper fetches from its own host: "/og-default.png" resolves nowhere.
  assert.equal(pageMeta({ section: "classificacao" }).image, undefined);
  assert.equal(pageMeta({ section: "partida", id: "554970" }, { matches: [MATCH] }).image, undefined);
});

test("a club's crest still wins on its own page, and it is square", () => {
  const image = pageMeta({ section: "clube", key: "flamengo" }, { clubs: CLUBS }, ORIGIN).image;

  assert.equal(image?.url, "https://crests.football-data.org/1783.png");
  assert.equal(image?.shape, "square");
  assert.match(image?.alt ?? "", /Flamengo/);
});

test("the jogadores page names itself rather than falling back to the site title", () => {
  const meta = pageMeta({ section: "jogadores" }, {}, "https://exemplo.test");

  assert.equal(meta.title, "Jogadores · Portal Brasileirão");
  assert.match(meta.description, /elencos/i);
  // The site card, not a crest: the page is twenty clubs, not one.
  assert.equal(meta.image?.url, "https://exemplo.test/og-default.png");
  assert.equal(meta.image?.shape, "wide");
});
