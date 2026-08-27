# Accounts for readers

An analysis of adding user accounts to Portal Brasileirão: what an account
would be *for*, what it costs, and every place in this codebase that an account
breaks an invariant currently held by every other feature.

Written 2026-08-26. This is a planning document, not a specification. Nothing
here has been built. Anything that contradicts `CLAUDE.md` or `CONTEXT.md` is
wrong — those describe what the code actually does, and they win.

**Read the summary if you read nothing else.** Accounts are the first feature
this app has considered that (a) creates state nothing can regenerate, (b)
processes personal data under the LGPD, and (c) breaks four documented
invariants at once. None of that makes it a bad idea; all of it makes the
sequencing matter more than the code does.

---

## 1. The decision that comes first

"Accounts" is not a feature. It is a mechanism, and it is only worth its cost
if something on the other side of it is worth having. So the first question is
not *how* but *what for* — and for most of the answers this app is likely to
want, **the account is not the cheapest way to get there.**

Candidate reasons a reader of a Brasileirão portal might want to be known:

| What the reader gets | Needs an account? | Cheaper mechanism |
| --- | --- | --- |
| **Meu time** — the app opens on their club, their fixtures first | No | `localStorage` |
| Remembering the theme | No | already `localStorage` (`useTheme`) |
| Remembering a followed player, a favourite ground | No | `localStorage` |
| Hiding scores until they choose to see them (spoiler guard) | No | `localStorage` |
| The same choices **on their phone and their laptop** | **Yes** | — |
| A kickoff reminder that arrives when the app is closed | **Yes** (push subscription must be stored server-side) | — |
| Palpites, comments, anything another reader sees | **Yes** | — |
| Anything the operator wants to count per-person | **Yes** | — |

Two thirds of the value people imagine when they hear "accounts" is
**device-local preference**, which this app already has the machinery for and
which costs no database, no LGPD posture, no session security, and no state
that can be lost.

**Recommendation: build Phase 0 first and ship it.** It is a day's work, it
delivers *Meu time*, and it answers the question the accounts feature is
really being asked to answer. Then, if the cross-device or notification need is
real, Phase 1 has a concrete migration story — the local preferences become the
first thing an account syncs, so the account has something to do on the day it
ships instead of being an empty shell asking for an email address.

### Phase 0 — device-local preference (no account)

Follows `useTheme` exactly, which is the precedent in this repo for a reader
choice that survives a reload:

- `preferences-core.ts` — pure: parse an unknown stored value into a
  `Preferences` shape, tolerate junk, resolve defaults. Unit-tested with no DOM,
  like `theme-core.ts`.
- `src/usePreferences.ts` — binds it to `localStorage`, wrapped in try/catch
  because storage throws in private mode (`useTheme` already learned this).
- Storage key `portal-brasileirao:preferences`, matching `THEME_STORAGE_KEY`'s
  namespace.
- UI: a star on the club page ("Seguir o Flamengo"), and a **Meu time** strip
  above the Classificação.

Nothing else changes. No route, no endpoint, no SEO rule, no deploy concern.

**What Phase 0 cannot do**, stated plainly so nobody has to discover it later:
it is per-browser and per-device; clearing site data loses it; it is invisible
to the server, so it cannot personalise the server-rendered shell or a link
preview; and it can never send a notification. If any of those is the actual
requirement, no amount of `localStorage` reaches it and the rest of this
document applies.

---

## 2. If accounts: which identity mechanism

Three ways to know who someone is, and the choice determines most of the rest
of the work.

### A. Email + password

~200 lines and no third party — until you notice that a password needs a reset
path, a reset needs email delivery, and email delivery is an SMTP provider, a
sending domain, SPF/DKIM/DMARC records, and a deliverability problem that
belongs to whoever runs the box. Without it, a forgotten password is a lost
account with no recovery, which is not a product you can ship.

It also puts a credential database on a single EC2 instance with no backup
story, in an app whose threat model until now has been "someone sends a weird
`Host` header". Password hashing would be `node:crypto`'s `scrypt` (no new
dependency, no native build on a small box; argon2id would be better and is not
worth a compiler on that host).

**Not recommended for v1.** The password is the least interesting part of the
feature and it drags in the most obligation.

### B. OAuth — "Entrar com o Google"

No password stored, no reset flow, no email sending, no credential breach to
have. What is stored is an opaque provider subject id (`sub`), a display name
and — only if a product reason exists — an email.

Costs: a `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` pair in the host's `.env`,
a redirect endpoint, and a third-party dependency **at sign-in only** (not at
request time, so it does not violate roadmap principle 4 the way a hotlinked
asset would — but say so explicitly in the commit, because it looks like it
does at a glance). Under the LGPD it is a data transfer to a foreign processor
and the privacy notice has to say so.

**Recommended for v1.** It is the smallest thing that is genuinely an account.

### C. Passkeys (WebAuthn)

No shared secret at rest anywhere, no email, no third party. The right long-term
answer, and the wrong first one: it is more code than B, and the recovery story
for a reader who loses their only device is either "you lose the account" or
"you also need one of A or B". Add it as a second factor path later.

### D. Magic link (passwordless email)

The reader types an address, receives a one-time link, and lands signed in. No
password at rest, and no reset flow — because the reset flow *is* this. That is
the observation worth carrying back to A: **email + password is this option plus
a credential database**, so A is never cheaper than D and never safer.

Its cost is the one A hides, and it is worth pricing concretely rather than as
"a deliverability problem". On this stack it means Amazon SES in `sa-east-1`,
where the instance already is; DKIM records on the sending domain; and — the
part with a lead time nobody plans for — **leaving the SES sandbox**, which is a
support request a human reviews, can take a day or more, and asks how bounces
and complaints are handled. Until then an account can only send to addresses it
has itself verified. Start that request before the code, not when the code is
blocked on it.

Two rules it brings, if it is ever chosen:

- **The request endpoint answers identically** whether or not the address
  belongs to an account. Anything else is an oracle for "does this person use
  this site", which is both a privacy leak and the first step of a targeted
  attack.
- **The link is a bearer credential living in a URL**, and URLs leak — into
  browser history, into the `Referer` of anything the landing page loads, into
  every log in between. Single use, short TTL, consumed on sight, and a redirect
  that drops the query so the address bar never holds it.

**Not recommended for v1**, for the same reason A is not: B needs no mail at
all. It is the first thing to reach for if the transfer-abroad point in §5 makes
Google unacceptable, or if some later feature needs a verified email anyway — at
which point one mail path serves both.

**Decision:** B for v1, C additive later. A and D both buy an email dependency
that B does not need; between those two, D is strictly the smaller, so if a
product reason ever forces email, it is D and not A that gets built.

---

## 3. What accounts break in *this* codebase

This is the part that generalises poorly from other projects, so it is the part
worth reading closely. Each item is an invariant the code holds today, how
accounts break it, and the fix.

### 3.1 The first state nothing can regenerate

Every byte this app persists today is either **derived** (standings, campanha,
stadiums), **fetched** (football-data), or **committed** (`src/data/*.ts`,
which is regenerable by a sync script). Lose the EC2 instance and you lose
nothing: a redeploy reconstructs the site exactly.

An accounts table is the first thing that is none of those. Lose it and the
readers are gone, and no script brings them back.

Consequences, all of them new work rather than opinions:

- **Backups become mandatory**, not prudent. Nightly `sqlite3 .backup` (or the
  `backup()` in `node:sqlite`) to S3, with the instance role granted
  `s3:PutObject` on a *separate prefix or bucket* from
  `portal-brasileirao-deploy-655139684612` — the deploy bucket is written by
  CI's OIDC role and read by the host; mixing reader data into it widens both
  blast radii.
- **A restore procedure has to exist and be tested**, in `shell_scripts/`,
  alongside the ones that already provision the host.
- **The single instance becomes a single point of data loss**, where today it is
  only a single point of *availability* loss. That is a different severity and
  the roadmap should say so.

### 3.2 Where the database file may live

Three constraints in the deploy machinery decide this, and getting it wrong is
silent until the next release:

- `scripts/deploy.sh` and `shell_scripts/07_install_release.sh` rsync
  `dist/` **with `--delete`**. A database under `dist/` is destroyed by the next
  deploy.
- `server.ts` serves `express.static(distPath)` in production. A database under
  `dist/` would also be **downloadable over HTTP** before it was destroyed.
- The systemd unit sets `ProtectSystem=strict` with
  `ReadWritePaths=${DEPLOY_DIR}`. Anywhere outside `/var/www/portal_brasileirao`
  (`/var/lib/...`, the conventional choice) is **read-only to the process** until
  `03_install_systemd_service.sh` is edited and the unit reinstalled.

**Answer:** `${DEPLOY_DIR}/data/accounts.db`, created mode 600 by a new
`shell_scripts/09_setup_account_store.sh`. It is inside `ReadWritePaths`,
outside `dist/`, untouched by both rsyncs (the second has no `--delete` and
targets only two named files), and not reachable by `express.static`.

### 3.3 `ApiEnvelope` does not describe account data, and must not be made to

`CLAUDE.md`: *"New endpoints keep this shape and degrade to local data rather
than returning a 500."* That rule is right for football data and wrong for an
account, and the conflict must be resolved explicitly rather than by whichever
one the implementer read most recently.

`source` / `note` / `updatedAt` answer "how fresh is this and where did it come
from" — questions about a *third party's* data with a seed fallback behind it.
Account data has no upstream, no staleness, and no honest fallback: "não foi
possível ler a sua conta" must be a **401 or a 503**, never a cheerful envelope
containing somebody else's defaults.

**Decision:** `/api/account/*` and `/api/auth/*` are the documented exception —
plain JSON, real status codes, `{ error }` in pt-BR on failure (the shape
`/api/players/:id` already uses for its 400). Write the exception into
`CLAUDE.md` in the same commit, because an undocumented exception to a
documented rule is how the rule stops being believed.

### 3.4 Every API route today says `Cache-Control: public`

`/api/standings`, `/api/matches`, `/api/scorers`, `/api/squads` and
`/api/players/:id` all set `public, max-age=…`, which is correct: the payload is
identical for every reader.

A per-reader response with those headers is a data leak the moment anything
caches it. Today nginx has no `proxy_cache` — but that file is **rewritten in
place by certbot** and `04_setup_nginx.sh` overwrites it again, so "there is no
shared cache in front" is a fact about a file nobody owns, not an invariant.

**Rules for account routes:** `Cache-Control: private, no-store`, and
`Vary: Cookie` on anything whose body depends on the session. A one-line test in
`tests/e2e/api.spec.ts` asserting no account route ever answers `public` is
worth more than the discipline, because the discipline is one copy-paste away
from being lost.

### 3.5 `pageStatus` has no way to say "real page, do not index"

`seo-core.ts` has exactly two verdicts: `FOUND` (200, indexable) and
`missing(reason)` (404, not indexable). A `/conta` page is neither — it is a
200 that must never be indexed.

The `PageStatus` *type* already permits it (`status: 200 | 404` and
`index: boolean` are independent); no constructor produces it. So:

- add `PRIVATE: PageStatus = { status: 200, index: false, reason: "private" }`
  and `"private"` to the `StatusReason` union;
- return it for the account sections;
- **omit those paths from `sitemapEntries`** — a sitemap entry for a page
  carrying `noindex` is a contradiction a crawler reports;
- add `Disallow: /conta` and `Disallow: /entrar` to `robotsTxt`.

Note `usePageMeta` already maintains `robots` on the client from `pageStatus`,
so the client half comes free once the verdict exists.

### 3.6 A new `Route` variant is a four-file change and three of them fail silently

Straight from `CLAUDE.md`, and it applies twice here (`/conta` and `/entrar`):
`route-core.ts`, `page-meta-core.ts`, `seo-core.ts`, `structured-data-core.ts`.
Only `structured-data-core`'s `trailFor` is caught by the compiler.

The failure that matters is the one already documented: `pageStatus` answers
**200 with a copy of the shell** for every unrecognised argument under a new
section. `/conta/qualquer-coisa` would be an unbounded set of indexable
duplicates, exactly as `/estadio/qualquer-coisa` was. Both new sections take no
argument, so the `default` branch's "a section that takes no argument does not
acquire one" rule covers it — *provided* the section is added to `SECTIONS` and
given the `PRIVATE` verdict rather than `FOUND`.

Structured data for an account page: **none**. There is nothing to describe, and
`trailFor` should return a breadcrumb ending at the site root.

### 3.7 The navigation bar is full, and the header is where this goes

`NAV_ITEMS` is at **five of MD3's maximum five** and `CLAUDE.md` is explicit
that the bound is spent. An account is not a sixth destination.

It belongs in the header, beside the theme toggle — which is where MD3 puts an
account affordance anyway (a top app bar trailing icon), so this is the spec's
answer rather than a workaround.

**But the header has its own width arithmetic, and it is untested.** Above `sm`
the header already carries: brand block + five inline tabs + theme `Button`,
inside `max-w-3xl`. The five tabs at `px-3` plus labels as long as
"Classificação" leave little slack at 640–768px, and a second 40dp button takes
some of it. The bottom navigation bar's fifth entry was clipped at the screen
edge *with no horizontal scroll to reveal it*, invisible to every test in the
suite until `tests/e2e/players.spec.ts` measured boxes — this is the same shape
of failure one breakpoint up.

**Measure it before shipping it**, the way that spec does: assert the header's
children fit inside its box at 640, 768 and 1024px. If they do not, the account
control collapses into a menu with the theme toggle inside it, or the tabs lose
`px-3` — but that is a decision to make from a measurement, not from a mockup.

On mobile the header carries only the brand and the theme toggle, so there is
room; the account control must be reachable there too, since the bottom bar
cannot carry it.

### 3.8 The server-rendered shell must stay impersonal

`renderShell` injects per-route metadata into one HTML string, and in production
that string is read **once at boot** (`readFileSync` outside the handler). It is
the same document for everyone, which is what makes link previews work.

Never inject a reader's name, club or session state into it. Beyond the obvious
(a proxy or a browser cache serving one reader's shell to another), it would put
personal data into a response whose whole purpose is to be scraped and cached by
Facebook, X and WhatsApp.

Account pages are **client-rendered from `/api/account/me`**, on a static shell,
with `noindex` from §3.5. There is a real cost — a flash of "carregando" on
`/conta` — and it is the right trade.

### 3.9 New env vars must work when unset, and a session secret cannot

`CLAUDE.md`: *"the production `.env` is not updated automatically on deploy, so
every new variable needs a safe in-code default."*

A `SESSION_SECRET` has no safe default. Random-per-boot logs every reader out on
every restart (and `Restart=on-failure` means restarts are routine).
A committed constant is a forged-session vulnerability shipped to a public repo.

**The idiom this repo already has is the answer.** `FOOTBALL_DATA_TOKEN` unset
is *a supported state*: the app serves seed data and says so. Do the same:

```
accountsEnabled() === Boolean(SESSION_SECRET && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)
```

Unset ⇒ **accounts are off**: `/api/auth/*` answers 404, the header shows no
account control, `/conta` renders "Contas não estão disponíveis nesta
instalação." A fresh clone and CI both run exactly as they do today, and the
deploy that ships the code does not silently half-enable a feature against an
unconfigured host.

Turning it on is then a deliberate act on the host. `02_create_env.sh` gains
the three prompts — and note its existing trap: it **overwrites** the whole
`.env` after a confirm, so a run that adds account variables must re-enter the
football-data token or lose it.

### 3.10 CI has no secrets, and must not gain any

An OAuth round trip in the e2e suite would need a Google client and network
access, breaking the rule that *a red build always means the code broke*.

**Solution, shaped like `DISABLE_FOOTBALL_DATA`:** a local identity stub.
`ACCOUNTS_DEV_LOGIN=true` enables `POST /api/auth/dev-login`, which mints a
session for a named test identity with no third party involved. It must
**refuse to start** when `NODE_ENV === "production"` — a fail-fast at boot, not
a runtime check, so a misconfigured host dies loudly instead of running an open
door. The Playwright config already sets `DISABLE_FOOTBALL_DATA`; it gains
`ACCOUNTS_DEV_LOGIN` and a per-run database path beside it.

### 3.11 Test isolation: one server, two projects, `fullyParallel`

The suite boots **one** server (`webServer`) and runs `desktop` and `mobile`
projects fully parallel against it. Every spec today is read-only, so this is
free. Account specs mutate shared state.

- Give each spec its **own identity** (`dev-login` takes a name), so two workers
  never touch one row.
- Point the store at a fresh file per run:
  `ACCOUNTS_DB=./test-results/accounts-${E2E_PORT}.db`, deleted on boot.
  `E2E_PORT` is already the knob that lets two worktrees run at once.
- Never assert a count of accounts — the same rule that already applies to
  curated broadcasts, for the same reason.

And the unit-test trap: **a new `tests/*.test.ts` does not run until it is added
to the `test:unit` script.** `account-core` and `session-core` tests need to be
listed there in the commit that adds them.

### 3.12 Cookies behind nginx: `req.secure` is a lie here

Express's own `trust proxy` setting is **not** enabled in `server.ts`. The
`TRUST_PROXY` env var is this app's own flag, read by hand in `originFor` and
consulted only for the canonical origin.

So behind nginx (which sets `X-Forwarded-Proto: https`), `req.protocol` is
`"http"` and `req.secure` is `false`. A session cookie whose `Secure` flag is
computed from the request would ship **without** it in production — a cookie
that leaks over any plaintext request.

**Set it from configuration, never from the request:**
`secure: APP_URL.startsWith("https://") || NODE_ENV === "production"`.
Do not turn on Express's `trust proxy` just for this: it changes `req.ip` and
`req.protocol` app-wide, including the code that feeds the canonical tag, whose
comments explain at length why it does not believe those headers by default.

Cookie shape: `__Host-pb_sess`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`,
no `Domain`, ~30 days rolling. Express 4 does not parse cookies —
`cookie-parser` (or twelve lines of `split(";")`) goes in **`dependencies`**,
never `devDependencies`, or the production `npm ci --omit=dev` strands it and
CI's "verify the bundled server boots" step catches it, which is exactly the
step that exists for this.

**Rotate on sign-in.** Issue a new token whenever a session is created, even if
the request already carried one, and never adopt a session identifier that
arrived from outside. Session fixation is a few lines to prevent here and
awkward to retrofit, because by then something is relying on the id being
stable across a sign-in.

### 3.13 There is no rate limiter, and sign-in is the first endpoint that needs one

Every route today is a cached GET in front of a circuit breaker. An auth
endpoint on a small single instance is a new abuse surface: callback flooding,
session-creation spam, and enumeration.

An in-memory token bucket in the style of `cache-core.ts` — pure, taking `now`
as a parameter, unit-tested without sleeping — is enough for one process, and it
is the only shape that fits this codebase's testing rules. Key on
`X-Forwarded-For`'s client-most value (nginx sets it; the same "a chain, take
the first" logic `firstHeaderValue` already implements).

### 3.14 CSRF

`SameSite=Lax` blocks cross-site POSTs, which is most of it. Add an `Origin`
header check on every state-changing request (reject when present and not our
own origin) rather than a token round trip: no plumbing through the client, no
hidden field, and it fails closed. A token scheme is worth it only if the app
ever needs `SameSite=None`.

### 3.15 A stored club is not evidence the club still exists

`seo-core.ts` already holds this rule for a different reason: `pageStatus`
declares a club missing only when the club list actually arrived, because
otherwise a provider outage 404s all 380 fixture pages at once and a crawler
drops them over an incident lasting minutes.

The same trap is waiting for **Meu time**, and it bites harder here. A
preference holding a club id that does not resolve looks exactly like a dangling
reference, so the tempting fix is a nightly "tidy up orphaned preferences" pass
— which, the first time football-data has a bad five minutes and the club list
comes back empty, deletes every reader's club at once, from the one table
nothing can regenerate (§3.1).

**Rule: never drop a preference because its referent failed to resolve.** The UI
says it cannot find the club right now; the row stays; a club id is cleared only
when the reader clears it. This applies identically to Phase 0's `localStorage`
copy, where the temptation is greater still because the parse step is already
there — `preferences-core.ts` tolerating junk must not tolerate it by discarding
a value it merely cannot resolve today.

---

## 4. The proposed shape

Nothing here is more than a sketch, but it follows the repo's own layout rather
than a generic one.

### Modules

Pure (`*-core.ts`, no I/O, unit-tested):

- `account-core.ts` — display-name validation and normalisation, the pt-BR
  labels, what a `PublicAccount` may expose, preference merge (device-local vs
  server-held: last-write-wins per key, with the local copy winning on a tie so
  a sign-in never silently discards what the reader just chose).
- `session-core.ts` — token shape, expiry and rolling-renewal arithmetic, all
  taking `now` as a parameter, exactly like `cache-core.ts`.

I/O, deliberately outside the pure modules (the split that lets the rules be
tested without a database, mirroring `commons-core.ts` / `scripts/commons-api.ts`):

- `account-store.ts` — opens the SQLite file, applies migrations, reads and
  writes. The only file that knows SQL.

Client:

- `src/useAccount.ts`, `src/components/AccountButton.tsx`,
  `src/components/AccountView.tsx`.

### Storage

`node:sqlite` (`DatabaseSync`) — zero dependencies, in core Node. Verified on
Node **v22.22**: it imports and runs without a flag, emitting an
`ExperimentalWarning`. Two things follow:

- **The host's Node floor rises.** `01_setup_app_directory.sh` enforces 20+, and
  `node:sqlite` does not exist on 20. Raise the check to 22 (24 preferred, where
  the API is stable) and say why in the script.
- The warning lands in the journal on every boot. Note it in the runbook so it
  is not mistaken for a fault.

The alternative, `better-sqlite3`, is a native module in `dependencies` compiled
or prebuilt during `npm ci --omit=dev` **on the production box** — the box the
deploy scripts already avoid building on for memory reasons. Prefer core Node.

Schema (v1), with `PRAGMA user_version` as the migration marker:

```sql
accounts(id TEXT PRIMARY KEY,            -- opaque, ours, never the provider's
         provider TEXT NOT NULL,          -- 'google'
         subject TEXT NOT NULL,           -- provider's `sub`
         display_name TEXT NOT NULL,
         created_at TEXT NOT NULL,
         last_seen_at TEXT NOT NULL,
         UNIQUE(provider, subject))

sessions(token_hash TEXT PRIMARY KEY,     -- SHA-256 of the cookie value; the
                                          -- cookie itself is never stored, so a
                                          -- database read does not yield a
                                          -- usable session
         account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
         created_at TEXT NOT NULL,
         expires_at TEXT NOT NULL)

preferences(account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            key TEXT NOT NULL,
            value TEXT NOT NULL,          -- JSON scalar
            updated_at TEXT NOT NULL,
            PRIMARY KEY(account_id, key))
```

No email column in v1. It is not needed to sign in with Google, it is the most
sensitive field on the table, and the LGPD's minimisation principle asks why it
is there before it asks how it is protected. Add it when a feature needs it.

### Endpoints

| Route | Purpose |
| --- | --- |
| `GET /api/auth/google` | redirect to the provider (state + PKCE in a short-lived cookie) |
| `GET /api/auth/callback` | exchange, upsert account, set session, redirect to `/conta` |
| `POST /api/auth/logout` | revoke this session |
| `POST /api/auth/dev-login` | test-only; refuses to exist in production |
| `GET /api/account/me` | `null` when signed out — not a 401, so the header renders without an error path |
| `PUT /api/account/preferences` | replace the reader's preference set |
| `DELETE /api/account` | delete the account and everything joined to it |

All `private, no-store`. All plain JSON (§3.3).

### Routes

`/conta` (the reader's own page) and `/entrar` (the sign-in choice). Both
`PRIVATE` in `pageStatus`, both absent from the sitemap, both `Disallow`ed.

---

## 5. LGPD

The readers are in Brazil, the app is in pt-BR, and the moment it stores a
display name and a provider id it is processing personal data under Lei
13.709/2018. This is not boilerplate — it changes what gets built.

- **Legal basis.** Consent, obtained at sign-in, for a purpose stated in plain
  pt-BR. The purpose is "guardar as suas preferências e o seu time"; it does not
  stretch to analytics or marketing without asking again.
- **Minimisation.** Store the club they follow, not what they read. No pageview
  log keyed to an account. This is a design constraint, not a policy page —
  once the join exists, someone will use it.
- **Rights.** Access and portability are `GET /api/account/me` returning
  everything held. Deletion is `DELETE /api/account`, and it must actually
  delete (`ON DELETE CASCADE` above), including from the next backup — say in
  the notice how long backups retain deleted data (e.g. 30 days) rather than
  claiming an instant erasure the backups make untrue.
- **Transfer abroad.** Google sign-in sends the reader to a foreign controller.
  The notice must say so.
- **Logs are personal data too.** nginx already logs IPs; today they identify
  nobody in particular, and after accounts they are linkable to a session. Set a
  retention period on `/var/log/nginx/portal-brasileirao.access.log` and mean it.
- **Deliverables:** a `/privacidade` page (public, indexable, unlike the account
  pages) and a named contact. Both are content, not code, and both block
  launch rather than following it.

---

## 6. Testing plan

Matching how this repo already tests things, rather than adding a new style:

**Unit** (pure, no I/O — added to the `test:unit` list in the same commit):
session expiry and rolling renewal at boundary instants; preference merge
including the tie case; display-name normalisation; every pt-BR label;
`pageStatus` returning `PRIVATE` for both account routes and 404 for
`/conta/qualquer-coisa`; `sitemapEntries` containing neither; `robotsTxt`
carrying both `Disallow`s.

**End-to-end** (frozen snapshot, `ACCOUNTS_DEV_LOGIN=true`, per-run database):
sign in → the header shows the account → reload keeps it → sign out clears it;
`/conta` while signed out invites sign-in rather than erroring; `/conta` carries
`noindex`; no account route ever answers `Cache-Control: public`; the header
fits its box at 640, 768 and 1024px (§3.7); with accounts *disabled*, the app
behaves exactly as it does today — which is the spec that protects every reader
who is not signed in from every future account bug.

**Deliberately not tested:** the Google round trip. It needs a secret and a
network, and CI has neither by design. It is verified by hand against the
deployed host, once, and recorded in the runbook.

---

## 7. Sequencing and cost

| Phase | What ships | Rough size |
| --- | --- | --- |
| **0** | Device-local *Meu time* and follows. No account. | ~250 lines, 1 day |
| **1** | Store, sessions, Google sign-in, `/entrar`, `/conta`, header control, SEO verdicts, feature flag off by default | ~900 lines, 3–4 days |
| **2** | Preference sync (Phase 0's data becomes the account's), deletion, privacy notice, backups + restore script | ~400 lines, 2 days |
| **3** | Whatever actually needed the account: notifications, palpites | out of scope here |

**Exit criteria**, since a size estimate is not a finish line:

- **0** — a reader's club survives a reload and a redeploy; no server-side
  behaviour changed at all; `preferences-core` is listed in `test:unit`.
- **1** — with the flag unset, the deployed app behaves exactly as the previous
  release did, asserted by the spec in §6 rather than observed; with the flag
  set on the host, one real Google account signs in, signs out, and signs back
  in against the same row.
- **2** — a backup taken today has been restored into a running app, and a
  `DELETE /api/account` has been verified as *gone from the database* rather
  than flagged.

Phase 1 is deployable with accounts **disabled**, and should be deployed that
way first: the flag makes the release a no-op for every existing reader, which
is the only way to separate "the account code is broken" from "something else
regressed" on a single production instance with no staging.

---

## 8. What I would push back on

- **Accounts as a goal.** If the honest answer to "what for" is *Meu time*,
  Phase 0 is the whole feature and Phases 1–3 are cost with no return. Ask
  before building.
- **Storing an email in v1.** Nothing in the plan needs it.
- **Any personalisation of the server-rendered shell.** §3.8.
- **Comments or palpites in the first cut.** They add moderation, abuse, and
  content liability — a different project wearing this one's clothes.
- **A hosted auth service (Cognito, Auth0, Clerk).** It removes maybe 300 lines
  and adds a runtime dependency, a bill, another processor in the LGPD notice,
  and a vendor between the reader and a site that currently runs on one small
  box with no dependency it does not control.

---

## 9. Glossary terms to add to `CONTEXT.md`

Required by the repo's own rule that a new concept gets its entry in the commit
that introduces it. Note the collision to avoid: **`Conta para a classificação`
already exists** and means *counts toward the table* — the verb, not the noun.
Any account term has to be unambiguous beside it.

- **Conta** — a reader's account. Distinguish from `Conta para a classificação`
  in the entry itself.
- **Entrar / Sair** — sign in and sign out. _Avoid_: "login"/"logout" as verbs
  in pt-BR copy, "logar".
- **Meu time** — the club a reader follows. _Avoid_: "favorito" (reads as a
  bookmark), "time do coração" (warm, but it is a setting, not a declaration).
- **Preferências** — what the app remembers about a reader, device-local or
  account-held.
