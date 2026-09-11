import assert from "node:assert/strict";
import { test } from "node:test";

import {
  LIVE_MATCHES_CACHE_TTL_MS,
  SCORERS_CACHE_TTL_MS,
  SQUADS_CACHE_TTL_MS,
  STANDINGS_CACHE_TTL_MS,
} from "@/cache-core";
import { CircuitBreaker } from "@/circuit-breaker-core";
import {
  createEnrichmentLoader,
  ENRICHMENT_BUDGET,
  type EnrichmentLoaderOptions,
} from "@/enrichment-core";
import { isNoSuchResource, ProviderStatusError } from "@/football-data-core";

const MINUTE = 60_000;

const loaderFor = (overrides: Partial<EnrichmentLoaderOptions> = {}) =>
  createEnrichmentLoader<string>({
    ttlMs: 60 * MINUTE,
    budget: { capacity: 10, refillMs: MINUTE },
    upstreamDown: () => false,
    isAbsent: isNoSuchResource,
    ...overrides,
  });

/** What football-data answers for an id nobody issued. */
const noSuchPerson = async (): Promise<string | null> => {
  throw new ProviderStatusError("https://api.football-data.org/v4/persons/99999999", 404);
};

const providerDown = async (): Promise<string | null> => {
  throw new ProviderStatusError("https://api.football-data.org/v4/persons/1", 503);
};

test("an unknown person is an answer, and is cached like one", async () => {
  const loader = loaderFor();
  let calls = 0;
  const counted = () => {
    calls += 1;
    return noSuchPerson();
  };

  assert.deepEqual(await loader.load("player:9", counted, 0), {
    kind: "answered",
    value: null,
    storedAt: 0,
  });
  assert.deepEqual(await loader.load("player:9", counted, 1000), {
    kind: "answered",
    value: null,
    storedAt: 0,
  });
  assert.equal(calls, 1);
});

test("ids nobody issued never stop the next lookup, and never reach the shared breaker", async () => {
  // The defect this module exists for: three such requests used to open the one
  // breaker standings, fixtures, scorers and squads all sit behind.
  const shared = new CircuitBreaker();
  const loader = loaderFor({ upstreamDown: (now) => shared.isOpen(now) });

  for (const id of ["1", "2", "3", "4", "5"]) await loader.load(`player:${id}`, noSuchPerson, 0);

  let reached = false;
  const answer = await loader.load(
    "player:6",
    async () => {
      reached = true;
      return "Pedro";
    },
    0,
  );

  assert.equal(reached, true, "five absences did not open the loader's own breaker");
  assert.deepEqual(answer, { kind: "answered", value: "Pedro", storedAt: 0 });
  assert.equal(shared.isOpen(0), false);
});

test("a real failure opens the loader's own breaker and not the shared one", async () => {
  const shared = new CircuitBreaker();
  const loader = loaderFor({ upstreamDown: (now) => shared.isOpen(now) });

  for (const id of ["1", "2", "3"]) {
    assert.deepEqual(await loader.load(`player:${id}`, providerDown, 0), { kind: "unavailable" });
  }

  let reached = false;
  const probe = async () => {
    reached = true;
    return "Pedro";
  };
  assert.deepEqual(await loader.load("player:4", probe, 1000), { kind: "unavailable" });
  assert.equal(reached, false, "its own breaker is open, so it does not probe");
  assert.equal(shared.isOpen(1000), false, "and the data routes never heard about it");

  // A failure is not cached: once the window passes, the same key is asked again.
  assert.deepEqual(await loader.load("player:1", probe, 1000 + MINUTE), {
    kind: "answered",
    value: "Pedro",
    storedAt: 1000 + MINUTE,
  });
});

test("the budget caps what the loader asks upstream for, whatever the ids", async () => {
  const loader = loaderFor({ budget: { capacity: 3, refillMs: MINUTE } });
  let calls = 0;
  const counted = () => {
    calls += 1;
    return noSuchPerson();
  };

  for (const id of ["1", "2", "3", "4"]) await loader.load(`player:${id}`, counted, 0);
  assert.equal(calls, 3, "the fourth fresh id was not sent upstream");
  assert.deepEqual(await loader.load("player:5", counted, 0), { kind: "unavailable" });

  // One token a third of a minute.
  await loader.load("player:5", counted, MINUTE / 3);
  assert.equal(calls, 4);
});

test("a cached answer spends no budget", async () => {
  const loader = loaderFor({ budget: { capacity: 2, refillMs: MINUTE } });
  let calls = 0;
  const counted = async () => {
    calls += 1;
    return "Pedro";
  };

  for (let i = 0; i < 5; i += 1) await loader.load("player:1", counted, 0);
  const second = await loader.load("player:2", counted, 0);

  assert.equal(calls, 2);
  assert.equal(second.kind, "answered", "five cached reads left the second token unspent");
});

test("while the shared breaker is open the loader neither probes nor spends", async () => {
  let down = true;
  const loader = loaderFor({
    budget: { capacity: 1, refillMs: MINUTE },
    upstreamDown: () => down,
  });
  let calls = 0;
  const counted = async () => {
    calls += 1;
    return "Pedro";
  };

  assert.deepEqual(await loader.load("player:1", counted, 0), { kind: "unavailable" });
  assert.equal(calls, 0);

  down = false;
  assert.equal((await loader.load("player:1", counted, 0)).kind, "answered");
  assert.equal(calls, 1, "the only token was still there");
});

test("the budget fits beside the data routes inside football-data's ten a minute", () => {
  // Steady state for the data routes while a match is live, plus a token
  // bucket's worst minute: its whole capacity at once and a minute's refill.
  const perMinute = (ttlMs: number) => MINUTE / ttlMs;
  const dataRoutes =
    perMinute(LIVE_MATCHES_CACHE_TTL_MS) +
    perMinute(STANDINGS_CACHE_TTL_MS) +
    perMinute(SCORERS_CACHE_TTL_MS) +
    perMinute(SQUADS_CACHE_TTL_MS);
  const enrichment =
    ENRICHMENT_BUDGET.capacity + (ENRICHMENT_BUDGET.capacity * MINUTE) / ENRICHMENT_BUDGET.refillMs;

  assert.ok(
    dataRoutes + enrichment <= 10,
    `${dataRoutes.toFixed(2)} + ${enrichment} requests a minute against a budget of 10`,
  );
});

test("only a 404 is an absence", () => {
  const url = "https://api.football-data.org/v4/persons/1";
  assert.equal(isNoSuchResource(new ProviderStatusError(url, 404)), true);
  // A tier this token cannot reach, the budget, and an outage: the provider
  // declining to answer, never answering no.
  for (const status of [403, 429, 500, 503]) {
    assert.equal(isNoSuchResource(new ProviderStatusError(url, status)), false, String(status));
  }
  assert.equal(isNoSuchResource(new Error("respondeu 404")), false);
  assert.equal(isNoSuchResource(new DOMException("timeout", "TimeoutError")), false);
});
