import { expect, test } from "@playwright/test";

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

  test("an unknown route falls through to the SPA, not a 404", async ({ request }) => {
    const response = await request.get("/rodada/qualquer-coisa");

    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("Portal Brasileirão");
  });
});
