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

**The envelope governs an ANSWER, and a refusal is not one** — which is the half
the rule above leaves out, and there are two shapes of refusal rather than one:

- **A malformed request** gets a status code and `{ error }` in pt-BR:
  `/api/matches?round=abc` and `/api/players/xyz` are both 400. §*Request
  validation* below owns this.
- **A well-formed request for something that does not exist** gets the same
  shape: `/api/stadium-weather/alguma-coisa` is a **404 `{ error: "Estádio não
  encontrado." }`**. That is neither an envelope nor one of the two written-down
  exceptions, and it went unstated here for the reason such things do — the rule
  it breaks is about successful responses, so nothing in the guide was pointed at
  it. Read the exception list as covering *routes*, and this as covering
  *requests a route declines*.

The line between the two is what the envelope is for: **a failure of the
upstream degrades, a failure of the request refuses.** `/api/stadium-weather`
does both, one per branch — an unknown slug is a 404, and a ground we know about
whose weather we could not read is a `fallback` envelope carrying `null`.

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
| `GET /api/stadium-weather/:slug` | Slug resolved against `STADIUMS`; an unknown one is a **404**, not an empty envelope. |
| `GET /api/traffic-dashboard` | This host's own nginx snapshots. |
| `GET /api/auth/google`, `GET /api/auth/callback`, `POST /api/auth/logout` | OAuth flow, not resources. Only `google` is rate limited. |
| `POST /api/auth/dev-login` | **Does not exist in production.** Registered inside `if (ACCOUNTS_DEV_LOGIN)`, and the server refuses to boot with it set under `NODE_ENV=production` — a stronger statement than a route that exists and declines. |
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

- Standings: a flat 60s.
- Fixtures: 60s, **dropping to 15s while any match is LIVE**. The drop is
  `matchesCacheTtl` and belongs to the fixtures alone — standings never take it,
  and the one sentence that covered both routes read as though they did.
- Scorers: 5 minutes.
- Squads and coaches: 6 hours, one entry, shared. The longest TTL in the app,
  because an elenco is the most static thing it serves.
- Player enrichment: 1 hour, on its own loader with its own breaker and a
  two-requests-a-minute budget — see `enrichment-core.ts`.
- Weather: 15 minutes **per ground**.
- Traffic dashboard: 5 minutes (its input is written hourly).

That caps the app at roughly five upstream calls a minute however many readers
arrive. **A crawler cannot spend a budget a reader would not** — which is the
argument that made the whole content API crawlable.

### There are TWO caches, and only one of them is about the budget

The TTLs above protect the **upstream**. Every content route but one also sets a
client-facing `Cache-Control`, which protects **this host**, and the two are
chosen separately — so a route needs both decided, not one.

| Route | Server TTL | `Cache-Control` |
| --- | --- | --- |
| `/api/standings` | 60s | `max-age=60` |
| `/api/matches` | 60s / 15s live | `max-age=30` |
| `/api/clubs` | the fixtures entry | **none** |
| `/api/scorers` | 5 min | `max-age=300` |
| `/api/squads`, `/api/coaches` | 6 h | `max-age=3600` |
| `/api/stadium-weather/:slug` | 15 min | `max-age=300` |
| `/api/traffic-dashboard` | 5 min | `max-age=300` |
| `/api/players/:id` | 1 h | `enrichmentCacheControl` — the TTL for an answer, `no-store` for a non-answer |
| `/api/health` | — | **none** |

Three things in that table are worth knowing before copying a row:

- **`/api/clubs` sets none**, alone among the content routes. It is a projection
  of the fixtures payload, which sets `max-age=30`, so the obvious value is that
  one — the omission is not a written-down decision, and nothing can see it,
  because the checklist below only ever asked about the server half.
- **`/api/matches` is a fixed 30s against a server TTL that halves to 15s while a
  match is live.** So in exactly the window the short TTL exists for, a browser
  may hold a copy twice as stale as the server's. The client polls an unsettled
  fixture for this reason — see `isAwaitingResult` — but the header does not
  follow the TTL, and a reader refreshing by hand can land on the older copy.
- **`/api/health` sets none, and it is the one payload where that has a
  consequence.** `useVersionWatch` polls it to decide whether the open page is
  running a stale bundle. nginx carries no `proxy_cache` (only `/assets/` gets
  headers), so this is browser heuristic freshness and not a cache we operate —
  low risk in practice, and unstated, on the endpoint whose whole job is telling
  a client it is out of date.

## Two rules about route ORDER, both of which failed silently

- **The SPA catch-all must be registered after the API routes**, or `/api/*` is
  swallowed by it.
- **The `X-Robots-Tag: noindex` middleware is mounted immediately after
  `const app = express()`**, before any route, because `app.use` applies only to
  what follows it, and `/api/auth` and `/api/account` are registered several
  hundred lines further down. Grep for `X-Robots-Tag` rather than trusting a
  line number: this paragraph carried `line 239, with the header set at line
  256`, which was exact the day it was written and was off by eight the next —
  the mount is a `const` declaration away from whatever lands above it.

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
- **Every mutating account route checks `sameOrigin(req)` and answers 403
  `{ error: "Origem inválida." }`.** Four call sites, and they are exactly the
  four routes that change something — `logout`, `dev-login`, the preferences
  `PUT` and the account `DELETE`. `GET /api/account/me` takes no such check
  because reading is not a thing another origin can make a browser do usefully
  here. The rule itself is `isSameOriginRequest`'s; the route only reads the
  request. A cookie-authenticated mutation with no origin check is a CSRF, and
  `SameSite` is a mitigation rather than the check.
- **Every account response sets `private, no-store` and `Vary: Cookie`**
  (`noStore`, eight call sites). Its comment carries the reason and it is the
  better half of the rule: *"there is no shared cache in front of this"* is a
  fact about an nginx config file that certbot and `04_setup_nginx.sh` both
  rewrite, so it is nobody's to guarantee. A personal payload says so itself
  rather than relying on the deployment staying the shape it is today.

## Required rules

1. **A new data endpoint returns `ApiEnvelope<T>` and degrades to local data.**
   If it cannot, it is an exception and must be written down as one.
2. **Decide BOTH caches in the same change** — the server TTL against the 10/min
   budget, and the client `Cache-Control` against how stale a reader may be. They
   are different questions and `/api/clubs` is what answering only the first
   looks like.
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
- **Every DATA route in the table above is now requested against the real
  server.** `tests/e2e/api.spec.ts` drives health, standings, clubs, coaches,
  scorers, the traffic dashboard, the SPA fallthrough, `/api/matches` with both
  its 400s, the **`/api/players/:id` 400** and the **`/api/stadium-weather/:slug`
  404**; `/api/squads` is reached from `coaches.spec.ts`. Each refusal is paired
  with the answer beside it, because a route that refused *everything* would pass
  a refusal-only spec.
- **The OAuth routes are the exception, and one of them is not covered at all.**
  `/api/auth/google` and `/api/auth/callback` are named in no spec, which is
  defensible — a sign-in is exercised through `dev-login`, and asserting a
  redirect by path would test the spelling of a URL rather than the flow.
  **`POST /api/auth/logout` is the one with no coverage by any route**: nothing in
  the suite requests it, and nothing clicks the control either — searched by path,
  by handler (`signOut`) and by every label the button carries. So the rate-limit
  row below and the `sameOrigin` row above both describe a route whose 403 branch,
  whose `?todos=true` variant and whose session revocation have never run in a
  test. Recorded rather than fixed: it wants a spec of its own that signs in,
  signs out and proves the session is gone, which is not a shape assertion.
- **What the last two cases assert is a COUPLING, not a value**, which is the only
  kind of shape assertion worth the line. A count of scorers or the name of
  whoever leads them are facts about when `sync-seed-data` ran; that the positions
  are a dense 1..N, that goals never rise down the list, that every scorer's club
  resolves against `/api/clubs`, and that `timeline.length` equals
  `snapshotCount` are properties of the payload that cannot drift with the data.
  Two measurements shaped them and are worth knowing before copying: a scorer's
  nullable fields are **genuinely null for somebody**, so a null-or-number check
  is not vacuous; and **club codes are not unique** across the artilharia — two
  scorers share a club — so the uniqueness assertion the standings spec makes
  would be *wrong* here rather than merely absent.
- **One known bound, stated rather than left to be discovered.** The suite's cwd
  has no `traffic-reports/` directory, so that route answers its empty shape and
  the populated branches of its spec are guarded and therefore vacuous *there* —
  `tests/traffic-report-core.test.ts` covers them against the output of a real run
  of the shell script. What the end-to-end case adds is the half no unit test
  reaches: that the route exists, is wired to the parser, and answers an envelope.
  It deliberately does not pin `source: "fallback"`, which is a fact about whether
  a directory exists beside the server rather than about the route.
- **A refusal earns a case in `api.spec.ts`, not a stub.** `weather.spec.ts`
  reaches that route only through `page.route`, which is right for serving a
  prepared payload and cannot test a refusal at all: a fulfilled stub settles
  Playwright's own accounting, so it cannot reproduce a failure of the route it
  replaced — the trap `CLAUDE.md` records about a spec that passed against the
  very bug it named. The three mutations the new cases were confirmed against are
  the guard each one is about: drop `isPersonId`, drop the `!facts` refusal, drop
  the `slugify` on the incoming slug.
- **Rate limiting is one route, not a surface.** `rateLimited` has exactly **one**
  call site — `/api/auth/google`, where a sign-in begins. `callback`, `logout`,
  `dev-login` and all three `/api/account/*` routes are unlimited, as are every
  read route. "Applied to the auth surface" is how this paragraph used to read and
  it claimed six routes' worth of protection for one. The read side is protected
  by the cache, which protects the *upstream* rather than this host.

## Review heuristics

**Envelope test.** Envelope, or a written-down exception?

**Budget test.** How many upstream requests does this add per minute at peak?

**Staleness test.** What `Cache-Control` does it send, and is a reader allowed to
hold it for longer than the server will?

**Projection test.** Does a cached payload already contain this?

**Trust test.** Does any parameter reach an outbound request or a filesystem path?

**Order test.** Is the route above the catch-all and below the robots middleware?

**Crawl test.** Does a page need this payload to render? Then it must be
fetchable, and `noindex`ed rather than `Disallow`ed.

## Positive signals

- A new route's diff includes both cache decisions and its `seo-core.ts` treatment.
- A page's data need is met by widening an existing payload.
- A 400 names the parameter it rejected.
- Identifiers travel with the data that uses them.

## Warning signs

- A `500` from a data route, or a `200` carrying an error.
- A new upstream call where a projection would do.
- A parameter interpolated into an outbound URL or a path.
- `Disallow` on a payload a page needs to render.
- A route registered after the catch-all, or before the robots middleware.
- A route with a server TTL and no `Cache-Control`, or a `Cache-Control` longer
  than the TTL behind it.
- A refusal branch — a 400, a 404 — with no case in `tests/e2e/api.spec.ts`.
- A client resolving names against `src/data/clubs.ts` rather than the payload.

## Related guides

- [ERROR_HANDLING_GUIDE.md](./ERROR_HANDLING_GUIDE.md) — the envelope, its exceptions, degrade-versus-refuse.
- [DEFENSIVE_CODING_GUIDE.md](./DEFENSIVE_CODING_GUIDE.md) — validating what arrives.
- [CLEAN_ARCHITECTURE_GUIDE.md](./CLEAN_ARCHITECTURE_GUIDE.md) — keeping the handler thin over a core module.
- [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md) — `tests/e2e/api.spec.ts` and the shapes the suite cannot see.

## Checklist

- [ ] Returns `ApiEnvelope<T>`, or is a documented exception.
- [ ] Server cache TTL chosen against the 10 req/min budget.
- [ ] Client `Cache-Control` chosen, and not quietly longer than that TTL.
- [ ] Reuses an existing cached payload where one would serve.
- [ ] Route parameters validated into a 400, not coerced.
- [ ] No client-supplied coordinate, host or path reaches an outbound call.
- [ ] Crawlable and `noindex`ed, unless a fetch has a side effect.
- [ ] Registered below the robots middleware and above the SPA catch-all.
