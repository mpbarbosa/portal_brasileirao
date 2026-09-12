import { expect, test } from "@/tests/e2e/clock";
import { STADIUMS } from "@/src/data/stadiums";

/** The envelope contract every data endpoint must honour. */
const expectEnvelope = (body: Record<string, unknown>) => {
  expect(body).toHaveProperty("source");
  expect(body).toHaveProperty("note");
  expect(body).toHaveProperty("updatedAt");
  expect(body).toHaveProperty("data");
  expect(["football-data", "placeholder", "fallback"]).toContain(body.source);
  expect(String(body.note).length).toBeGreaterThan(0);
  expect(Number.isNaN(Date.parse(String(body.updatedAt)))).toBe(false);
};

test.describe("API", () => {
  test("/api/health reports status and the active provider", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body).toHaveProperty("uptime");
    // The kill switch is on for this suite.
    expect(body.provider).toBe("seed");

    // Build identity: what is actually running. Bundled builds carry the commit;
    // running from source there is no bundler to inject it, hence "dev".
    expect(typeof body.sha).toBe("string");
    expect(body.sha.length).toBeGreaterThan(0);
    expect(body).toHaveProperty("builtAt");
  });

  test("/api/health no longer reports a version that never changed", async ({ request }) => {
    // It sat at 0.1.0 for every deploy ever made and answered nothing.
    const body = await (await request.get("/api/health")).json();

    expect(body.version).toBeUndefined();
  });

  test("/api/standings returns 20 rows in an envelope", async ({ request }) => {
    const response = await request.get("/api/standings");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expectEnvelope(body);
    expect(body.data).toHaveLength(20);

    const [top] = body.data;
    expect(top.position).toBe(1);
    expect(top.club).toHaveProperty("code");
    expect(top.club).toHaveProperty("shortName");
  });

  test("club codes in the table are unique", async ({ request }) => {
    const body = await (await request.get("/api/standings")).json();
    const codes = body.data.map((row: { club: { code: string } }) => row.club.code);

    expect(new Set(codes).size).toBe(codes.length);
  });

  test("/api/matches ships fixtures with the clubs needed to name them", async ({ request }) => {
    const response = await request.get("/api/matches");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expectEnvelope(body);
    expect(Array.isArray(body.data.matches)).toBe(true);
    expect(Array.isArray(body.data.clubs)).toBe(true);
    expect(body.data.matches.length).toBeGreaterThan(0);

    // Every club referenced by a fixture must be resolvable from the payload.
    const known = new Set(body.data.clubs.map((club: { code: string }) => club.code));
    for (const match of body.data.matches) {
      expect(known.has(match.homeCode)).toBe(true);
      expect(known.has(match.awayCode)).toBe(true);
    }
  });

  test("/api/matches?round=N returns only that round", async ({ request }) => {
    const body = await (await request.get("/api/matches?round=7")).json();

    expect(body.data.currentRound).toBe(7);
    expect(body.data.matches.length).toBeGreaterThan(0);
    for (const match of body.data.matches) {
      expect(match.round).toBe(7);
    }
  });

  test("/api/matches rejects a non-numeric round", async ({ request }) => {
    const response = await request.get("/api/matches?round=abc");

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("round");
  });

  test("/api/matches rejects a zero or negative round", async ({ request }) => {
    expect((await request.get("/api/matches?round=0")).status()).toBe(400);
    expect((await request.get("/api/matches?round=-3")).status()).toBe(400);
  });

  test("/api/clubs lists the 20 clubs of the division", async ({ request }) => {
    const body = await (await request.get("/api/clubs")).json();

    expectEnvelope(body);
    expect(body.data).toHaveLength(20);
  });

  test("/api/coaches maps club codes to coaches", async ({ request }) => {
    const response = await request.get("/api/coaches");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expectEnvelope(body);

    // Never a count: the snapshot carries a coach only for the clubs upstream
    // named one for when it was taken, and a club between coaches has none.
    // What must hold is that every entry is a club in the division under a
    // name worth printing — an absence is an absent key, never an empty value.
    const clubs = await (await request.get("/api/clubs")).json();
    const codes = new Set(clubs.data.map((club: { code: string }) => club.code));

    for (const [code, coach] of Object.entries(body.data as Record<string, string>)) {
      expect(codes).toContain(code);
      expect(typeof coach).toBe("string");
      expect(coach.trim().length).toBeGreaterThan(0);
    }
  });

  /**
   * The two refusals nothing asserted until this landed.
   *
   * `docs/guides/REST_API_GUIDE.md` states both as rules and its *Trust test*
   * rests on the second, and neither had a case anywhere: `weather.spec.ts`
   * reaches that route only through `page.route`, and a fulfilled stub settles
   * Playwright's own accounting, so it cannot exercise the route it replaced.
   *
   * **Each asserts the refusal AND the answer beside it**, because a route that
   * refused *everything* would pass a refusal-only spec. That pairing is the
   * whole design here — the 400 has to be about the shape of the id, and the
   * 404 about this slug rather than about the endpoint being broken.
   */
  test("/api/players/:id refuses a non-numeric id, and answers null for a numeric one", async ({
    request,
  }) => {
    const refused = await request.get("/api/players/nao-sou-um-numero");
    expect(refused.status()).toBe(400);

    const error = await refused.json();
    // Names what it rejected, which is the difference between a 400 a caller
    // can act on and one they have to guess at.
    expect(String(error.error)).toMatch(/num[eé]ric/i);
    // A refusal is not an answer: no envelope to mistake for a degraded one.
    expect(error).not.toHaveProperty("source");
    expect(error).not.toHaveProperty("data");

    // The known-negative, and the guide's "answers null offline" in one: an id
    // that is well-formed is NOT refused, even though no such player exists and
    // the provider is switched off for this suite. Enrichment is allowed to be
    // absent, so the honest answer is an envelope carrying null — never a 404,
    // which would say the route itself was wrong.
    const allowed = await request.get("/api/players/1");
    expect(allowed.status()).toBe(200);

    const body = await allowed.json();
    expectEnvelope(body);
    expect(body.data).toBeNull();
    // Refused once is not refused for an hour by the reader's own browser.
    expect(allowed.headers()["cache-control"]).toContain("no-store");
  });

  test("/api/stadium-weather/:slug refuses a slug that names no ground", async ({ request }) => {
    const refused = await request.get("/api/stadium-weather/estadio-que-nao-existe");
    // A 404 and not an empty envelope: the request is well formed and asks for
    // something that does not exist, which is a different answer from a ground
    // we know about whose weather we could not read.
    expect(refused.status()).toBe(404);

    const error = await refused.json();
    expect(String(error.error).length).toBeGreaterThan(0);
    expect(error).not.toHaveProperty("source");

    // The known-negative: a real ground answers 200. Read off `STADIUMS` rather
    // than typed, so this cannot rot when the curated list grows — and it is
    // what separates "this slug names nothing" from "the route 404s everything".
    const [known] = Object.keys(STADIUMS);
    expect(known, "src/data/stadiums.ts is empty").toBeTruthy();

    const answered = await request.get(`/api/stadium-weather/${known}`);
    expect(answered.status()).toBe(200);

    const body = await answered.json();
    expectEnvelope(body);
    // `DISABLE_WEATHER` is on for this suite, so the designed degradation is
    // what comes back — null data under a `fallback` source, never a 5xx.
    expect(body.source).toBe("fallback");
    expect(body.data).toBeNull();
  });

  /**
   * The slug is re-slugified before it is looked up, so a ground is reachable
   * as a reader would type it — and this is the other half of the *Trust test*:
   * what arrives is normalised into a key, never used to build a request.
   */
  test("/api/stadium-weather/:slug resolves a hand-typed slug rather than 404-ing on it", async ({
    request,
  }) => {
    const [known] = Object.keys(STADIUMS);
    const shouted = String(known).toUpperCase();
    expect(shouted).not.toBe(known);

    expect((await request.get(`/api/stadium-weather/${shouted}`)).status()).toBe(200);
  });

  test("an unknown route falls through to the SPA rather than the API", async ({ request }) => {
    // Still the app shell, not a JSON error: the catch-all is registered after
    // the API routes and neither swallows the other. The status is 404 because
    // the path names nothing — see the routing spec for why the body stays.
    const response = await request.get("/rodada/qualquer-coisa");

    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"]).toContain("text/html");
    expect(await response.text()).toContain("Portal Brasileirão");
  });
});
