# HTTP API Guide

Adapted for Portal Brasileirão from `doc_template_lib/domain_specific/REST_API_GUIDE.md`.

## Scope, and what was cut

This is **not** a public REST API. It is a private read-only surface serving one
first-party SPA from the same process, plus a small accounts subsystem. Three
sections of the source guide were dropped because they describe problems this API
does not have, and inventing them would be worse than omitting them:

- **Versioning.** There is none, and none is owed: the client and the server ship
  in one bundle from one process, so no consumer can be running an old contract
  for long. `version-core.ts` solves the problem from the other end — it compares
  the client's build against the host's and reloads the page once when they
  differ. The versioning question here is *how fast does a stale client heal*,
  not *how long do we support one*.
- **Pagination.** No collection is unbounded: 20 clubs, 380 fixtures, ~950
  players. `/api/matches` deliberately ships **the whole season** in one response,
  which is why `rank-history-core.ts` computes the campanha on the client — a
  second endpoint would buy nothing.
- **`201 Created` and `Location`.** Nothing here creates an addressable resource.

## The envelope is the contract

Every data endpoint returns `ApiEnvelope<T>` — see
[ERROR_HANDLING_GUIDE.md](./ERROR_HANDLING_GUIDE.md), which owns that rule and
its two written-down exceptions (`/api/health`, and `/api/auth/*` +
`/api/account/*`).

The API-design consequence is the one worth repeating here: **a data endpoint
degrades rather than failing.** A 500 from `/api/standings` is a defect; a
`source: "fallback"` envelope carrying the frozen seed is the designed behaviour.

## Current routes

| Route | Notes |
| --- | --- |
| `GET /api/health` | Not an envelope. Describes the process: sha, uptime, node, provider. |
| `GET /api/clubs` | |
| `GET /api/standings` | `TOTAL` group only, never the HOME/AWAY splits. |
| `GET /api/scorers` | |
| `GET /api/squads` | Every club's elenco from **one** upstream request. |
| `GET /api/coaches` | A **projection of the squads payload** — same cache entry, zero upstream cost. |
| `GET /api/players/:id` | Numeric id, else **400**. Enrichment only; answers `null` offline. |
| `GET /api/matches` | Optional `?round=`; a non-integer or `< 1` is **400**. |
| `GET /api/stadium-weather/:slug` | Slug resolved against `STADIUMS`. |
| `GET /api/traffic-dashboard` | This host's own nginx snapshots. |
| `GET /api/auth/google`, `GET /api/auth/callback`, `POST /api/auth/logout`, `POST /api/auth/dev-login` | OAuth flow, not resources. |
| `GET /api/account/me`, `PUT /api/account/preferences`, `DELETE /api/account` | Plain JSON, real status codes, `{ error }` in pt-BR. |
| `GET /robots.txt`, `GET /sitemap.xml` | Generated from `seo-core.ts`. |
| `GET /{*splat}` | SPA catch-all. **Must stay registered after the API routes.** |

**`/api/coaches` is the pattern to copy when a page needs a slice of data that
already arrives.** The club page is built from fixtures and standings and neither
carries a coach; rather than a new upstream call, the route projects the squads
payload it already has and shares that cache entry.

## Caching is a design constraint, not an optimisation

The free tier allows **10 requests a minute**. Caching is what makes production
viable at any traffic level, so a cache decision belongs in the route's design
rather than after it:

- Standings and fixtures: 60s, dropping to 15s while any match is LIVE.
- Weather: 15 minutes **per ground**.
- Traffic dashboard: 5 minutes (its input is written hourly).
- Squads and coaches: one entry, shared.

That caps the app at roughly five upstream calls a minute however many readers
arrive. **A crawler cannot spend a budget a reader would not** — which is the
argument that made the whole content API crawlable.

## Two rules about route ORDER, both of which failed silently

- **The SPA catch-all must be registered after the API routes**, or `/api/*` is
  swallowed by it.
- **The `X-Robots-Tag: noindex` middleware is mounted immediately after
  `const app = express()`** — line 239, with the header set at line 256 — because
  `app.use` applies only to what follows it, and `/api/auth` and `/api/account`
  are registered several hundred lines further down.

## `Disallow` and `noindex` are not two strengths of one knob

This is the API-design lesson that cost the most, and it is not obvious.

`robots.txt` carried `Disallow: /api/` to keep JSON envelopes out of the index.
What it actually did was stop Googlebot fetching the payloads the **pages** are
built from. Measured on the live site: `/partida/554977` reported **Erro soft
404**, with 5 of 7 resources refused as blocked, while `curl` got the correct
title twelve times out of twelve. Nothing was wrong server-side — 200,
self-canonical, correct metadata, every spec green.

A crawler can obey `noindex` **only on a resource it was allowed to fetch**.
Blocking the fetch is what prevents the instruction being read.

So the content API is crawlable and carries `X-Robots-Tag: noindex`.
`/api/auth` and `/api/account` stay `Disallow`ed: per-session, needed to render
nothing, and the only `/api` endpoints where a fetch has a side effect.

## Request validation

A malformed **request** gets a status code; a malformed **upstream** gets a
degraded payload.

- `?round=` — a non-integer or `< 1` is a 400, not a clamp.
- `/api/players/:id` — non-numeric is a 400. A valid id with no upstream answers
  `null`, because enrichment is allowed to be absent.
- `/api/stadium-weather/:slug` resolves the coordinate from `STADIUMS`, so **the
  deploy is not an open weather proxy for any point on earth.** The sibling repo
  takes `?lat&lng`, which is simpler and turns a deploy into somebody else's free
  geolocation service on our bandwidth. Derive a coordinate from an id you own;
  never accept one.

## Payload shape decisions worth copying

- **`/api/matches` ships the clubs it saw alongside the fixtures**, so the UI
  resolves names from the payload. Upstream club codes are not the seed codes —
  São Paulo is `PAU` upstream, not `SAO` — so a client resolving names against
  the local seed breaks the moment a provider is connected.
- **`mapSquads` does not copy the club onto each of ~950 players.** It is what
  the enclosing `Squad` already says, and repeating it took the payload from
  109 KB to 255 KB.
- **Club identity is the upstream numeric id, never `tla`.** Corinthians and
  Coritiba both report `tla: "COR"`, so keying on it merges two clubs into one
  standings row.

## Accounts: session handling

- **`__Host-` cookies are `Secure` unconditionally.** Deriving it from `APP_URL`
  made sign-in *appear* to work on a fresh clone: the server set the cookie, the
  browser silently dropped it, `/api/account/me` answered null, nothing errored.
  `localhost` and `127.0.0.1` are secure contexts, so plain-http development is
  unaffected.
- **There is no `SESSION_SECRET`.** A session is 256 bits of randomness stored as
  a SHA-256 digest, so there is nothing to sign and nothing to rotate.
- **`PUT /api/account/preferences` replaces the whole set**, which is why the
  wire serialiser writes every key while the device serialiser writes only some.
  A partial upload would clear a preference every time another one changed.

## Required rules

1. **A new data endpoint returns `ApiEnvelope<T>` and degrades to local data.**
   If it cannot, it is an exception and must be written down as one.
2. **Decide its cache TTL in the same change**, against the 10/min budget.
3. **Prefer a projection of an existing cached payload** to a new upstream call.
4. **Validate route parameters into a 400**; do not clamp or coerce.
5. **Never accept a coordinate, URL or host from the client** where an id you own
   can be resolved to it.
6. **A new `/api` route is crawlable and `noindex`ed** unless a fetch of it has a
   side effect, in which case it is `Disallow`ed too.
7. **Register it above the SPA catch-all**, and below the `X-Robots-Tag`
   middleware.
8. **Ship the identifiers the client needs to resolve names**, rather than
   assuming it shares the server's seed.

## Current reality

- **Path naming is not uniformly plural-noun.** `/api/standings`, `/api/health`,
  `/api/traffic-dashboard`, `/api/stadium-weather/:slug` and `/api/account` are
  not, and the OAuth routes are verbs. The OAuth ones are conventional and fine;
  the rest are historical and not worth a breaking rename on a private API.
- **Error bodies have no machine-readable `code`.** `/api/account/*` returns
  `{ error }` as a pt-BR string, discriminated by status code. The only client is
  ours and it branches on the code, so a taxonomy would have one consumer.
- **Field naming is camelCase throughout**, matching `src/types.ts`.
- **There is no rate limiting on the read routes.** `rate-limit-core.ts` exists
  and is applied to the auth surface; the cache is what protects the read side,
  and it protects the *upstream* rather than this host.

## Review heuristics

**Envelope test.** Envelope, or a written-down exception?

**Budget test.** How many upstream requests does this add per minute at peak?

**Projection test.** Does a cached payload already contain this?

**Trust test.** Does any parameter reach an outbound request or a filesystem path?

**Order test.** Is the route above the catch-all and below the robots middleware?

**Crawl test.** Does a page need this payload to render? Then it must be
fetchable, and `noindex`ed rather than `Disallow`ed.

## Positive signals

- A new route's diff includes its TTL and its `seo-core.ts` treatment.
- A page's data need is met by widening an existing payload.
- A 400 names the parameter it rejected.
- Identifiers travel with the data that uses them.

## Warning signs

- A `500` from a data route, or a `200` carrying an error.
- A new upstream call where a projection would do.
- A parameter interpolated into an outbound URL or a path.
- `Disallow` on a payload a page needs to render.
- A route registered after the catch-all, or before the robots middleware.
- A client resolving names against `src/data/clubs.ts` rather than the payload.

## Related guides

- [ERROR_HANDLING_GUIDE.md](./ERROR_HANDLING_GUIDE.md) — the envelope, its exceptions, degrade-versus-refuse.
- [DEFENSIVE_CODING_GUIDE.md](./DEFENSIVE_CODING_GUIDE.md) — validating what arrives.
- [CLEAN_ARCHITECTURE_GUIDE.md](./CLEAN_ARCHITECTURE_GUIDE.md) — keeping the handler thin over a core module.
- [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md) — `tests/e2e/api.spec.ts` and the shapes the suite cannot see.

## Checklist

- [ ] Returns `ApiEnvelope<T>`, or is a documented exception.
- [ ] Cache TTL chosen against the 10 req/min budget.
- [ ] Reuses an existing cached payload where one would serve.
- [ ] Route parameters validated into a 400, not coerced.
- [ ] No client-supplied coordinate, host or path reaches an outbound call.
- [ ] Crawlable and `noindex`ed, unless a fetch has a side effect.
- [ ] Registered below the robots middleware and above the SPA catch-all.
