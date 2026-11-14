# Tráfego, contas e backup da base

*Quando ler:* Leia ao tocar no access log, em contas/autenticação, na recusa de endereços ou no backup da base de contas.

Extraído do `CLAUDE.md`, que ficou um índice. Esta é a fonte canônica do assunto.

---

## Tráfego — the access log, and the two windows onto it

Ported from `agora_na_copa_2026`, which had the whole idea first. Four pieces:

- `shell_scripts/12_traffic_report.sh` — runs **on the host**, summarises nginx's
  access log into one `summary-<stamp>.txt`. coreutils and awk only, so it works
  on a bare host; a `.mmdb` geolocation database and `mmdblookup` are optional
  and add the country and city sections — `14_install_geoip.sh` puts one there.
- `shell_scripts/13_install_traffic_timer.sh` — one-time provisioning, like 01,
  03 and 11. Installs the hourly timer and prunes to a month of snapshots.
- `shell_scripts/14_install_geoip.sh` — one-time provisioning too, and the only
  way the country and city sections ever have anything in them. See **The geo
  sections are opt-in, and were empty on the host for weeks** below.
- `/api/traffic-dashboard` and `/trafego` — the deployed page.
- `scripts/traffic-dashboard.ts` — a **local** window (`npm run traffic-dashboard`,
  `localhost:4317`).

**The report scripts live in `shell_scripts/` and not in `scripts/`, and that is
the delivery path rather than a filing preference.** CI packages
`dist package.json package-lock.json shell_scripts` and nothing else, so a report
script under `scripts/` is a script the host has never seen. The sibling keeps
its copy in `scripts/` and gets away with it because **its** host carries a git
checkout, and its scheduled wrapper runs `git pull` before every report — a
wrapper this repo therefore does not need and does not have. Ours is better on
its own terms: the report script always matches the release that shipped it,
which is the property `shell_scripts/` exists for.

**Nothing is committed, and the sibling commits everything.** Its snapshots are
tracked files; here the app reads `$DEPLOY_DIR/traffic-reports/` directly, so
the host is the source of truth and there is no copy in git to drift from it.
The directory is inside `DEPLOY_DIR` and outside `dist/` for exactly
`accounts.db`'s two reasons — `ProtectSystem=strict` with
`ReadWritePaths=${DEPLOY_DIR}` makes anywhere else read-only, and both rsyncs
delete `dist/` with `--delete` while `express.static` serves it over HTTP.
`/traffic-reports/` is gitignored, with the leading slash `/data/` carries.

**THE LOG FORMAT IS THE TRAP, and it fails silently in both directions.**
`04_setup_nginx.sh` writes no `log_format`, so nginx uses stock **combined**:

    $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent
      "$http_referer" "$http_user_agent"

The sibling parses its own `agora_timed` format, which **drops `$remote_user`**,
so every awk field index there is one lower than the index here. Porting its
awks unchanged does not error — measured against a fixture log, `$6`/`$8`/`$3`
report **one path `"GET`, one status `HTTP/1.1"`, and every request in hour
`-`**. Plausible-looking nonsense, twenty rows of it, and nothing anywhere goes
red. If this repo ever adds a `log_format`, the field map at the top of
`12_traffic_report.sh` is what has to change with it. The referrer is taken by
regex rather than as a field index, because it is quoted and routinely contains
spaces.

**The geo sections are opt-in, and were empty on the host for weeks.** The
report treats geolocation as optional and prints a note when it finds no
database — which is right, and is also why nobody noticed: `/trafego` served
"Países por endereço" and "Países por volume" side by side, each reading
"Sem dados.", **while the rodapé beneath them said "não há seções de país nem
de cidade"**. The page contradicted itself and no gate could see it, because
the city panels were conditional and the country ones were not. Both are gated
now, on their **rows** rather than on `geoSource`: a country-level database
answers the country sections and not the city ones, so one rule — draw a panel
when it has rows — covers both without a second condition to keep true.
`tests/e2e/trafego.spec.ts` is the first spec this page has ever had.

**The default database is DB-IP's City Lite, not GeoLite2, and the reason is
the signup rather than the data.** GeoLite2 has needed a MaxMind account and a
licence key since 2019, so a script defaulting to it cannot run on a fresh
host — the property `FOOTBALL_DATA_TOKEN` and Open-Meteo are both arranged to
avoid. DB-IP publish a City Lite build monthly in the same `.mmdb` format over
plain HTTPS with no key. Measured before choosing it rather than assumed: the
2026-09 build reports `Type: DBIP-City-Lite`, answers both `country names` and
`city names`, and satisfies the report's existing City detection unchanged, so
the keyless path is not a degraded one. `GEO_VENDOR=maxmind` is still there for
an operator who already has a key.

**The credit is a condition of use and travels with the database, never with
the page.** DB-IP's Lite editions are CC BY 4.0 — usable commercially only
while the attribution is displayed, which is exactly the bargain
`src/data/stadiums.ts` strikes for the Commons photographs. So
`12_traffic_report.sh` reads the `Type` out of the file **it actually used** and
prints a `Geo attribution:` line from it; `parseSummary` carries it as
`geoAttribution` and the page renders it verbatim. A component that composed
the credit from a filename would credit the wrong vendor the first time
somebody swapped the database underneath it. An unrecognised `Type` gets **no**
credit line, and that is deliberately not the same as "no credit is owed" —
nothing here may invent an attribution, and a database whose terms the report
does not know is one whose terms it must not state.

**The database is installed under its own vendor's filename**, so the probe
list carries `dbip-city-lite.mmdb` and `dbip-country-lite.mmdb` beside the two
GeoLite2 names. Writing DB-IP's bytes as `GeoLite2-City.mmdb` would make every
later reading of that host wrong about what it is running — the report's own
comment already says to ask a database what it is rather than to read its name,
and this is the other half of that rule.

Two things carried over from the sibling verbatim because they were paid for
there:

- **Ranked sections end in `awk 'NR <= n'`, never `head -n`.** `head` closes the
  pipe, the upstream `sort` dies of EPIPE, and under `set -euo pipefail` that
  aborts the whole script after the first section — which truncated every one of
  the sibling's reports on a large log, silently, for weeks.
- **Geo lookups run once per UNIQUE address**, not per line, and `mmdblookup`
  is allowed to fail: it exits non-zero when a path is absent from a record,
  which is routine for `city`, and on `set -e` that aborts the run.

**The page is unlisted, which is not private, and the distinction is its whole
security story.** `/trafego` is absent from `NAV_ITEMS`, `noindex`, `Disallow`ed
and out of the sitemap — but the address works for anybody who has it. That is
acceptable only because the payload is aggregates with no visitor address in it;
if that stops being true, the page needs a session before the data does. It is
not a nav destination for a reason `conta` and `entrar` only half share: the bar
is **full** at MD3's five, and this would not belong in it at six either.

**Deleting `case "trafego":` from `pageStatus` is the silent failure**, and it
was confirmed by mutation rather than reasoned about: without it the page is a
200 a crawler may index, one test in `tests/seo-core.test.ts` goes red and
nothing else does. The neighbouring 404-on-an-extra-segment case is held by
`default` and passes either way — worth knowing before reading it as coverage.

**Every mark on the page is one tone, and the status classes are the single
exception.** The first version gave each panel its own role, and two things
were wrong. On the light palette `secondary` (#4d6357) and `tertiary` (#3d6473)
are two desaturated darks indistinguishable in a 6px bar — `RankCandles`' two
greys again, measured in the page rather than guessed. The one that matters is
that **the colour encoded nothing**: every bar list is a single series, so a hue
per panel invites a reader to think blue means something green does not. It
matters most where the two panels sit side by side — "Países por endereço" and
"Países por volume" are read *against* each other, same quantity and two
questions, so painting them alike is what says so.

**The rate chart is the one place two series share a panel, and it holds that
rule rather than being an exception to it.** `Visitantes` and `Físico` are the same
tone and are told apart by **dash and weight** — 2px solid against 1.5px dashed
at 45% — because the argument above applies with more force to two strokes than
to two panels: a second hue on a line beside a first is read as encoding a
second *kind* of thing, where these are one quantity over two populations. It is
`RankCandles` drawing an unplayed round hollow and `scatterTrail` ramping
opacity, one drawing further on. Two consequences follow. **Both series are
scaled over the union of their values**, since scaling each to its own maximum
would draw the smaller as tall as the larger and reverse the only comparison
the pair exists to make. And **a stroke difference carries no meaning a reader
can guess**, so the panel owes a key — `LineKey`, stated once beside the
figure, in `ScatterKey`'s arrangement.

**The local window imports the same core, and the sibling's does not.** Its
dashboard is a standalone `.mjs` carrying its own copy of the parsing, which was
later extracted into a core module precisely because two copies is where drift
starts — the `commons-core.ts` / `scripts/commons-api.ts` line. Being a `.ts`
run through tsx is what buys one parser; nothing about the page needs it.

**`--url` is the half the sibling has no need of**, and on this workstation it is
the only way that window gets real data: the snapshots live on the host, and
this machine has no SSH, no SSM and no S3 access to fetch them with.

```sh
npm run traffic-dashboard                       # a local ./traffic-reports
npm run traffic-dashboard -- --url https://brasileirao.mpbarbosa.com
```

**The first real run found two bugs, and both were invisible to every gate that
existed.** It is worth reading before adding a section to that script, because
neither is about traffic:

- **The date range ran BACKWARDS**, and went straight onto the page:
  `04/Sep/2026:00:07:19 -> 26/Aug/2026:23:41:49`. `zcat -f "$ACCESS_LOG"*`
  concatenates in the shell's **lexical** glob order — `access.log`, `.1`,
  `.10.gz`, `.11.gz`, `.2.gz` — so the buffer is neither chronological nor
  reverse-chronological, and reading line 1 and the last line reports two
  arbitrary interior stamps. It now scans for the true min and max. Sorting the
  glob would fix the endpoints and leave the middle interleaved, which is why
  the scan is the honest fix rather than the tidy one.
- **An empty log truncated the report to four of eleven sections and exited 1.**
  `grep` exits 1 when nothing matches, `pipefail` propagates it, `set -e` kills
  the brace group mid-stream — and a *partial* summary is still written, so the
  file exists and simply stops. This is the `head`/EPIPE trap the script already
  carried a paragraph about, in a second costume, three sections further down.
  A freshly rotated log at midnight reaches it, and so does one holding only
  malformed probe traffic.

**`scripts/rehearse-traffic-report.sh` is the coverage that now exists, and CI
runs it.** It drives the real script against real fixture logs — including
rotations whose glob order is not chronological, which is what reproduces the
first bug. Two of its assertions are worth keeping when it is extended: it
counts **section headings**, because "exited 0" and "a summary exists" both pass
against a truncated report and only the count says the run finished; and it
takes `DISABLE_GEO=true`, because this repo's own workstation carries a
GeoLite2 database while CI does not, so without the switch the geo assertion
answers differently on the two machines — `rehearse-sync-schedule.sh`'s
environment-inheriting failure, caught this time before it merged rather than
fifty minutes after.

**`DISABLE_GEO` is a real operator knob and not a test hook**, in
`DISABLE_FOOTBALL_DATA`'s idiom: one lookup per unique address is by far the
slowest part of a run on a large log.

**One thing stays unexercised.** Nothing has run
`13_install_traffic_timer.sh` in CI — so the `adm` group membership
it relies on (systemd has no terminal for `sudo` to prompt at) is a designed
answer rather than a verified one. Run the service by hand once after installing
the timer. The
parsing half **is** exercised: `tests/traffic-report-core.test.ts` runs in
`test:unit`, and its fixture is the output of a real run of the script rather
than a summary composed to match the parser.

**A snapshot name has one-second resolution**, so two runs inside the same
second overwrite rather than accumulate. Harmless under an hourly timer and not
harmless when generating a series by hand — it is the sibling's backup-rehearsal
trap in another costume, where several cases backing up in one second made
"newest" undefined between them.

## Contas

Phase 1 of `docs/accounts.md`: sign in with Google, `/entrar` and `/conta`, sessions in
SQLite. **Off unless configured**, and that is the whole of its deployment story —
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` unset means the feature is *absent*: no
control renders, `/api/auth/*` and `/api/account/*` answer 404, and the app is exactly
what it was. The same idiom as `FOOTBALL_DATA_TOKEN`, and it is what lets this ship to a
host nobody has configured yet.

**`/api/account/*` and `/api/auth/*` are the documented exception to the `ApiEnvelope`
rule**, and this paragraph is where that exception lives so the rule above stays
believable. `source`, `note` and `updatedAt` answer "how fresh is this third party's data
and how far has it degraded" — an account has no upstream, no staleness and no honest
fallback, and "não foi possível ler a sua conta" must be a real status code rather than a
cheerful envelope containing somebody else's defaults. Plain JSON, real codes, `{ error }`
in pt-BR. `/api/health` was the first exception; these are the second.

**There is no `SESSION_SECRET`, and the plan expected one.** A session is 256 bits of
randomness stored as a SHA-256 digest in a table, so there is nothing to sign, nothing to
rotate, and no secret whose absence needs a safe default. The same reasoning covers the
sign-in transaction: `state`, `nonce` and the PKCE verifier only have to survive from our
own response to our own next request, and the `__Host-` prefix is what stops any other
origin writing that cookie.

Traps, each of which cost something to find:

- **A `__Host-` cookie without `Secure` is refused by the browser**, silently. Deriving
  `Secure` from `APP_URL` made sign-in *appear* to work on a fresh clone: the server set
  the cookie, the browser dropped it, `/api/account/me` answered null, nothing errored.
  It is now unconditional — `localhost` and `127.0.0.1` are secure contexts, so plain http
  development is unaffected. Note `curl` declines to *send* a `Secure` cookie over http,
  which is a property of curl and not of the browser: verify this path with Playwright.
- **`node:sqlite` is loaded with `createRequire` inside `openStore`, never imported at the
  top.** A static import is evaluated at boot, so a runtime without the module throws
  `ERR_UNKNOWN_BUILTIN_MODULE` and the **whole process fails to start** — a site that is
  down, on a release that only added a feature nobody had switched on. The host pins Node
  22, which is not the same as having this: the module arrived in **22.5**, so 22.0–22.4
  satisfies the pin and still lacks it. The pin is not a substitute for the lazy load.
- **SQLite creates the file but not the directory above it**, and fails with a message that
  reads like a permissions problem. `openStore` makes its own directory.
- **`PRAGMA foreign_keys` is OFF by default**, which would make `ON DELETE CASCADE`
  decorative — a deleted account would leave working sessions pointing at a row that is
  gone.
- **`ACCOUNTS_DEV_LOGIN` mints a session for anybody who asks.** It exists so the e2e suite
  can test sign-in without a Google client or a network, keeping CI secret-free. The server
  **refuses to start** with it set when `NODE_ENV=production`, and the route is registered
  conditionally, so in production it does not exist rather than existing and declining.
- **The sign-in rate limiter keys on the LAST `X-Forwarded-For` entry, never the
  first.** nginx's `$proxy_add_x_forwarded_for` appends the address it saw to
  whatever the client sent, so the first entry is the client's to write — and the
  limiter shipped keyed on it, following `docs/accounts.md` §3.13, so rotating a
  forged header bought a fresh bucket per request. `clientKey` in
  `rate-limit-core.ts` is the rule. It holds for exactly **one** proxy: put a CDN
  in front of nginx and the last entry becomes the CDN's, every reader shares one
  bucket, and sign-in fails closed for everybody — revisit it then.
  `firstHeaderValue` (`seo-core.ts`) still takes the first entry, which is right
  for `X-Forwarded-Proto`/`Host` and wrong for anything keyed on who is asking.
- `pageStatus` gained **`PRIVATE`** — 200, `index: false` — because `/conta` is a real page
  whose content differs per requester. The type always allowed it; no constructor produced
  it, because until accounts every page this app served was the same for everybody. Both
  sections are `Disallow`ed in `robots.txt` and absent from the sitemap.

Phase 2 adds the **preferences** table and `/privacidade`. Two things about it are
decisions rather than mechanics:

- **`planSync` is not last-write-wins**, which §4 sketched. Timestamps would resolve
  exactly one case — signed out on device A, changed there, then signed in on device B —
  and would cost a stamp beside every value, a storage-shape migration for everyone who
  already has a preference, and a rule nobody can predict from outside because the
  deciding value is invisible. The rule instead is one sentence: **the account is the
  source of truth, and a device seeds an account that has none yet.** That keeps the case
  the plan actually cared about (a sign-in never discards the choice just made) and gives
  up the A-then-B case. This paragraph said "revisit at the second key"; the second key
  has arrived and the answer held, for a reason worth more than either key: **a merge
  rule is owed only where both sides can hold a value.** `landing` is account-only — no
  `localStorage` copy exists, by construction — so there is nothing to reconcile and no
  clock to buy. Ask which side *owns* a key before asking how to reconcile it.
- **Deleting the account drops the device copy; signing out keeps it.** That asymmetry
  is the one place `planSync`'s seeding rule had to be qualified, and it shipped
  unqualified: the club survived on the machine, so the next sign-in seeded it straight
  back into the freshly created account and a reader who asked for erasure got the club
  they deleted recreated server-side, from a copy this app planted. `/privacidade` had
  been promising the opposite in as many words — *"a conta, as sessões, o time que você
  segue e a sua página inicial, tudo de uma vez"*. The erase is pushed in from `App`'s
  `onDelete` rather than observed by the hook, because the hook sees only `account.id`
  going null and a **sign-out does that too**; and it clears React state as well as the
  key, since the reconcile effect seeds from state, so a copy wiped on disk and left in
  memory uploads exactly as before.
  **`tests/e2e/contas-preferencias.spec.ts` asserted this from the day it was written and
  could not fail on it**, which is the half worth carrying away. Its only check was
  `expect.poll(…).toBeNull()` on the account — and a poll passes on the **first** null it
  sees, so it was racing the seeding upload rather than testing anything: green alone,
  green on a re-run, red at 923 specs, and red in whichever project happened to lose. A
  poll for an *absence* is a race dressed as an assertion wherever the thing polled for
  arrives late. The spec now asserts the `localStorage` key is gone directly, which fails
  deterministically in isolation and was confirmed red against the unfixed code.
- **The upload is fire-and-forget**, so the page is usable before it lands. That is right
  for a reader and a trap for a test: a spec that follows a club and immediately asks the
  API what the account holds is racing it. Poll, or assert through the browser.

**The second key is `landing` — the Página inicial**, the section a signed-in reader opens
on. Three things about it are decisions rather than mechanics, and the third cost a red
suite to find:

- **It is account-only, and `serialiseDevicePreferences` is the whole of that rule.** The
  device serialiser writes the club and drops the landing; the wire serialiser writes both,
  because `PUT /api/account/preferences` **replaces the whole set** and a partial upload
  would clear a landing choice every time somebody followed a club. Two serialisers rather
  than a boolean argument: a flag at a call site is easy to pass wrong and impossible to
  see.
- **It redirects rather than rendering another section under `/`.** Serving different
  content at one address would leave the canonical tag, the `og:` metadata and the JSON-LD
  describing the Classificação while the reader looks at the artilharia — and those are
  injected server-side, where there is no session to consult. Moving the address keeps all
  three true. Crawlers have no session, so `/` stays the table for them permanently. The
  redirect is `replace`, never push, or Back returns to `/` and is sent forward again.
- **`usePreferences` publishes `syncedAccountId`, and a caller that infers it instead is
  wrong in a way nothing reports.** Effects run in declaration order within one commit, so
  when the account lands, an effect declared *after* `usePreferences` in the same component
  sees `accountState` already saying "signed-in" while `preferences` still holds the
  pre-account values. `App`'s redirect ran exactly once, on that render, found no landing,
  latched its ref and never moved the page — with `tsc`, the unit suite and every existing
  spec green. Only an end-to-end assertion on the URL could see it. Gate on the published
  id, not on `accountState.status`.

And one testing trap that is a property of the cookie rather than of the code: **`page.request` cannot carry a session.** It is a Node-side fetch with no notion of a
potentially trustworthy origin, so it will not send a `Secure` `__Host-` cookie over
`http://127.0.0.1` — every signed-in call through it answers 401 while the browser beside
it is signed in. It is still fine for *establishing* a session, because the `Set-Cookie` it
receives lands in the context's jar and the browser is what later sends it. Read and write
account state with `page.evaluate(fetch)`.

## Refusing an address

`shell_scripts/blocklist.txt` is the list; `15_install_blocklist.sh` renders it
into `/etc/nginx/conf.d/blocklist.conf` and reloads. One-time provisioning like
11, 13 and 14 — **a deploy does not run it**, so changing the list is a merge
*and* a manual run.

**In `conf.d/` and not in the site file**, because certbot rewrites
`sites-available/<site>` in place and `04_setup_nginx.sh` overwrites it
outright: a `deny` put there is lost without a word. At `http` level it is
inherited by every server block rather than needing a copy per site.

**The list is in the repository and the host's copy is generated**, which is the
half worth arguing for. It began as a file somebody wrote on the host by hand:
nothing reproduced it, nothing reviewed it, and a rebuilt host silently started
empty — the shape this file keeps naming, where *a claim that produces no work
while it holds is never exercised*. In git, an address is a reviewed one-line
diff with a reason and a date attached, and `shell_scripts/` is what CI packages,
so the list matches the release that shipped it. An address added by hand on the
host is **overwritten on the next run**.

**Four refusals, and every one of them is a way the site goes off the air or an
operator gets locked out:**

- **A malformed entry**, named by line. nginx rejects `deny not-an-ip;` at
  config test, so without this the failure arrives as a rolled-back reload
  rather than as a sentence naming the bad line.
- **A `/0` catch-all.** `deny 0.0.0.0/0;` is perfectly valid nginx and takes the
  whole site down; a config test cannot object to it.
- **The address you are connected from**, read from `$SSH_CLIENT`. This one is
  paid for: proving a deny worked by temporarily blocking this workstation
  locked it out of the site, and the cleanup command — a `pkill -f` whose
  pattern matched **its own ssh session's command line** — killed the shell
  before it could undo it, returning no output at all. `ALLOW_SELF_BLOCK=true`
  is the deliberate override.
- **nginx rejecting the render**, which restores the previous file, re-tests it,
  and exits **2** rather than 1 — "the blocklist did not install" and "the site
  is down" need different responses, the same split `06_redeploy.sh` draws.

**An empty list is valid and writes a file with no denies.** That is how you
unblock everybody and it has to keep working — `tests` for it live in the
rehearsal, because the obvious implementation refuses an empty list as an error.

**A graceful reload keeps old workers alive**, so the first request or two after
a deny lands can still be served under the previous config. Measured on the
host: immediately after loading a rule, `/` answered **200** while `/api/health`
answered **403** — same client, same second — which reads exactly like *the deny
only half applies* and is nothing of the kind. Seconds later all four paths
tested were 403. Re-test before concluding anything about a deny's scope.

**ufw is inactive on this host and must stay that way unless somebody plans it.**
Its default incoming policy would cut SSH and the site; the real perimeter is
the AWS security group, which is allow-only and cannot express a deny at all.

`scripts/rehearse-blocklist.sh` is the only behavioural coverage, and `check`
runs it — the script ships **inside the release tarball**, so a broken one
arrives on the host with the release that carries it. It stubs `nginx`,
`systemctl` and `sudo`, writes into a temp directory, and each of the four
refusals was confirmed by deleting it and watching the named case go red.

The first entry is `35.234.190.67` — 643 requests in one hour on 2026-09-05,
660 distinct paths, 635 of them 404, hunting `/wp-config.php.bak`, `/aws/*`,
`/.github/workflows/*` and Vite's `/@fs/`, rotating five spoofed AI-crawler user
agents from one address. Its rDNS is `…bc.googleusercontent.com`, an **ephemeral
GCP VM**, so it has probably been gone since and the address may already belong
to somebody unrelated. **Blocking buys quiet, not protection** — every one of
those probes already 404'd — which is why `blocklist.txt` asks for a date and a
reason beside each address: an entry nobody can date is one nobody will dare
remove.

## Backing the accounts database up

`09_backup_accounts.sh` snapshots it to S3 nightly; `10_restore_accounts.sh` puts one
back; `11_install_backup_timer.sh` installs the systemd timer. All three travel inside
the release tarball, like the deploy scripts.

**`VACUUM INTO`, never `cp`.** SQLite in WAL mode keeps recent commits in a sidecar, so
copying `accounts.db` alone captures a database missing its most recent writes — and it
*looks* fine, because the result opens. There is a case in the rehearsal that inserts a
row, leaves the connection open so it never checkpoints, and asserts the row is in the
snapshot.

**Every artefact is opened and read before it is trusted** — on the way out by the backup,
and again on the way in by the restore, *before* anything is stopped or moved. A restore
that takes the site down and then discovers the artefact is unreadable has turned a
recoverable morning into an outage. An unreadable database exits **2** where a failed
upload exits 1: "the upload failed" is a retry and "the database will not open" is an
incident, and a timer reporting both the same way is one nobody reads.

**The displaced database is never deleted** — moved aside with a timestamp and left. And
its `-wal`/`-shm` are removed with it, because those belong to the file they were written
beside; leaving them next to a *different* database is how a restored copy is read with
another database's uncommitted tail.

**`scripts/rehearse-accounts-backup.sh` is the only behavioural coverage these have**, and
it is worth running rather than reading: it caught four real bugs in scripts that had been
read carefully and looked right.

- `JSON.stringify` for the `VACUUM INTO` path emits **double** quotes, which SQLite reads
  as an *identifier* — so the statement failed with "no such column: /var/www/…" and the
  backup had never once worked.
- A single-quoted `node -e '…'` body **cannot contain a single quote**, and SQL string
  literals are single-quoted. The shell silently ended the argument and handed node bare
  words. Both programs are quoted heredocs now, where nothing is special.
- `PRAGMA integrity_check` returns a column named **`integrity_check`**, not `result`.
  Destructuring the wrong name yields `undefined`, which is not `"ok"`, so every artefact
  failed verification and a perfectly good database exited 2.
- **`2>&1` inside a command substitution folds stderr into the value.** That is the trap,
  and it is not about backups: any `X="$(cmd 2>&1)"` inherits it, and an **experimental
  builtin makes it fire on every invocation** rather than only when something goes wrong.
  `node:sqlite` is experimental on the pinned major, so the warning landed *inside* the
  row count, printing the number, the warning and the unit across three lines. The fix is
  `--disable-warning=ExperimentalWarning` at each `node` call; `09` and `10` were the two
  sites that had it, and nothing stops a third being written tomorrow.
  **The blast radius was cosmetic, and saying so matters** — "a backup bug" reads as data
  loss. The backup ran, verified and uploaded correctly; what was mangled was only the
  printed count, which is the one number a person reads to see the artefact is not empty.
  `10`'s copy was merely *lucky*: `read` takes the first line, which is the count only
  because the warning is deferred past it. Ordering is not a guarantee to rest a restore on.
  This is the bug that only appears on the **pinned** major: Node 26 emits no such warning
  at all, so a local green run said nothing about the host — and the host runs **22.23.2**,
  read off `/api/health`, so this was live there rather than latent in CI. Say *silent*
  rather than *stable*: silence is what was measured and all the argument needs, where a
  stability index is a claim nobody here checked. It surfaced the day CI began running the
  rehearsal on `.nvmrc`'s Node.
  **The catch was itself verified, by reverting only the flag** — the same discipline the
  flip-back harness's three deliberate mutations record, which live in `docs/cicd-plan.md`
  and `docs/roadmap.md` rather than in this file. Reverted: 22 ok / 1 not ok on Node 22,
  failing exactly on `did not count rows`; with the fix, 23 / 0. The *unfixed* script is
  23 / 0 on Node 26, which is the leg that proves the harness is reading the runtime rather
  than merely passing. Re-run it the way CI does before trusting a local pass:

  ```sh
  docker run --rm -v "$PWD":/repo:ro -w /repo node:22-bookworm \
    ./scripts/rehearse-accounts-backup.sh
  ```

The database half is **real** in that harness — a real SQLite file through the real schema,
real `VACUUM INTO`, real `integrity_check`, rows counted at both ends. Only `aws`,
`systemctl` and `sudo` are stubbed. So **S3 credentials, the bucket policy, the instance
profile's `s3:PutObject` and the lifecycle rule are unexercised, and the first real upload
is still a first.** Run the service unit by hand once after installing the timer; that is
the only thing that proves the IAM permission exists.

Each case in the harness uses its **own bucket prefix**. They shared one at first and case
8's `latest` resolved to case 3's artefact — restoring four accounts where nine were
expected, with the restore exiting 0 because it did exactly what it was asked. Snapshot
names carry a one-second timestamp and several cases back up inside the same second, so
"newest" was not well defined across them. Same shape as the end-to-end suite sharing one
database across two projects.

The database lives at `ACCOUNTS_DB`, defaulting to `./data/accounts.db`. On the host it
must stay **inside `DEPLOY_DIR`** — the systemd unit sets `ProtectSystem=strict` with
`ReadWritePaths=${DEPLOY_DIR}`, so `/var/lib` is read-only to the process — and **outside
`dist/`**, which both rsyncs delete with `--delete` and `express.static` serves over HTTP.
It is the first state in this app that no script can regenerate, so backups are now an
obligation rather than a nicety; that is Phase 2, and `docs/accounts.md` §3.1 is the plan.

Adding a section is: a `NAV_ITEMS` entry in `src/navigation.ts`, a `Route` variant plus
parse/format cases in `route-core.ts`, a case in `App`'s view switch, and — if it needs new
data — a pure mapper in `football-data-core.ts`, a seed snapshot in
`scripts/sync-seed-data.ts`, and a cached route in `server.ts`. `NavBar` needs no change
*for the entry itself* — that promise held when Jogadores was added — but see the width
arithmetic below: the bar had slack for four items' padding and not for five.

**A new `Route` variant is a four-file change, and the half of it that is enforced is
not the half that matters.** Since the crawl surface landed, a variant also needs a case
in `page-meta-core.ts`, a `pageStatus` rule and sitemap entry in `seo-core.ts`, and
breadcrumbs in `structured-data-core.ts`. **Three** things go red on their own, measured
by adding the `painel` variant and running `tsc`: `structured-data-core`'s `trailFor`,
`page-meta-core`'s `pageMeta`, and `src/navigation.ts`'s `SectionId` — the first two
because their switches return a value, so a missing case makes them non-exhaustive, and
the third because `NavBar` takes `route.section` as that type whether or not the section
is a nav destination.

This paragraph said "only `structured-data-core`" for months, and it was believed
because nobody had added a variant since it was written — the claim produces no work
when it holds, which is the shape this file warns about elsewhere. Read the correction
as a floor rather than a promise: **only `structured-data-core` says in its own comments
that the exhaustiveness is deliberate.** The other two happen to be exhaustive today,
nothing declares that they must stay so, and a `default` branch added to either for
tidiness would remove the check with no test going red.

**Adding `trafego` exercised that, and the count held with one correction to
where the third error LANDS.** Measured by adding the `Route` variant and then
deleting the four downstream cases: `tsc` reported exactly three files —

    page-meta-core.ts(156,4)       Function lacks ending return statement
    structured-data-core.ts(254,56) Function lacks ending return statement
    src/App.tsx(425,9)             Type '…| "trafego"' is not assignable to 'SectionId'

— and said nothing whatever about `seo-core.ts`. So three and not four, as the
paragraph above predicts. But the `SectionId` failure surfaces at
**`src/App.tsx`**, the consuming site, not at `src/navigation.ts` where the type
is declared: the union there is a *widening*, which is legal on its own and only
fails where something narrow is expected. A session grepping the named file for
an error will not find one.

**`seo-core.ts` is the file that fails silently, and it is the one that matters.** Both
its rules fall through to defaults: the page is absent from the sitemap, and —
the real cost — `pageStatus` answers **200 with a copy of the shell** for every
unrecognised argument under the new section. That is an unbounded set of duplicate pages
offered to a crawler, and nothing goes red. `/estadio/qualquer-coisa` did exactly this
until the rule was added. `SECTIONS` is a `Set<string>`, so no compiler can reach it;
`tests/seo-core.test.ts` is where a new section earns a 404 case. Adding the variant is
the easy half; grep `seo-core.ts` for a sibling section (`"partida"` is the closest
analogue, and `"clube"` if the new one is addressed by a club key) and follow it
through.

**The desktop destinations are MD3 primary tabs as of M9**, not the filled chip they
were: the active label is `primary` over a 3dp indicator drawn as an `after`
pseudo-element, and the bar now states "selected" the same way at both breakpoints.
`bg-on-surface`/`text-inverse-on-surface` was an inverse-surface pairing MD3 uses for
selection nowhere, so a reader crossing `sm` met two idioms for one idea. The
appearance is MD3's and the semantics stay navigation — no `role="tab"`, because these
change the address and a tab role promises a `tabpanel` and arrow-key selection that do
not exist here.

**They sit on a row of their own beneath the app bar's, and the reason is arithmetic
rather than taste.** Sharing one row with the brand and the trailing controls was
over-subscribed, not merely tight: signed in at 640dp that row had to hold 345dp of tab
labels, a 128dp wordmark, a 108dp account control and a 40dp toggle inside 608dp of
content. The brand was the only elastic member, so it absorbed the whole shortfall and
rendered **27dp wide** — the app's own name reading "P…". At 1280 the same sum left it
115dp against 128dp needed, so `lg:px-3` on five tabs was enough to cut it on a full
desktop too. Both states shipped, and every spec was green throughout, because
`navigation.spec.ts` asserted the wordmark was **visible** and a truncated element is
visible. That spec now measures `scrollWidth` against `clientWidth` at seven widths in
the signed-in state, and it was confirmed red against the old markup before being
believed.

No padding, breakpoint or type step fixes a row whose contents do not fit. MD3 does not
put a five-destination tab row inside a top app bar either — **tabs are a component
placed beneath one** — so the second row is the spec's own arrangement as well as the
one the numbers allow. The cost is **32dp of sticky chrome above `sm`** (73 → 105);
below `sm` the bottom navigation bar is unchanged, the tab row does not render, and the
header stays 73. The tabs are still inside `<header>`, so every spec selecting
`header nav[aria-label="Seções"] a` is untouched — only their line moved.

Two details there are load-bearing and each looks like a tidy-up. The tabs are
**content-sized and left-aligned**, never `flex-1`: the indicator is an `after` inset
from the tab's own padding, so an equal-width tab would draw a 131dp rule under
"Jogos", where MD3's primary-tab indicator hugs its label. And the nav carries
**`-ml-3`** to cancel the first tab's own `px-3`, so the first *label* starts on the
same left edge as the wordmark above it — both are the leading edge of this bar, and 12dp
of disagreement reads as a mistake rather than as spacing.

**The wordmark is a link home.** It was two `<p>` elements, so the one control every
site on the web puts in that corner did nothing here and a reader on a club page had to
find "Classificação" among the destinations to get back. It takes `STATE_LAYER` with
`-mx-2 px-2`, the negative margin buying the veil room to sit in without moving the text
off the content column's left edge.

**The brand mark sits beside the TITLE LINE, not beside the two-line block, and
that is arithmetic.** `BrandMark` is a filled arch — the portal — with a rising
campanha knocked out of it, drawn in `currentColor` at `text-primary`, and it lives
in its own file rather than in `SectionIcons.tsx`: that file draws the app's
standalone stroked icons from `GLYPH_STROKE` in `src/components/glyph.ts` (`fill:
none`, `stroke: currentColor`, width 2), and this mark shares none of that contract. **Filled rather than stroked** because a favicon is read at 16px, where the
same geometry stroked is mush — measured at 16, 24 and 28 in both themes.

Below `sm` the brand's widest line is the **subtitle** at 174px against 128px of
title. So a mark placed beside the *block* adds its width to the widest line: the
subtitle overflowed its box by 3.6px and painted under the Entrar pill. Beside the
title it costs nothing, because 24 + 8 + 128 = 160 is still inside the 174 the
subtitle already claims; above `sm` there is no subtitle and the two arrangements
are the same element in the same place.

**The block's width is `viewport − 189` signed out, and below 363dp that is less
than the subtitle.** This paragraph said the block got 202px at 375; measured on
production on 2026-09-11 it was 186, and at 320 it was 131 — so both brand lines
ran 30px under the Entrar pill there, with every spec green, because the subtitle
spec measured 375 alone. The signed-out control now gives way where the arithmetic
forces it, on the nav indicator's `min-[360px]:` breakpoint: no glyph from 360 to
374, and below 360 a 40dp disc whose word is only its accessible name. From 375 up
it is unchanged. Note **the widest trailing state flips at `sm`** — signed in
carries a name above it and is an avatar below — which is why that spec now runs
both states at 320, 360 and 375.

**Compartilhar spent that slack, and the Entrar pill is a disc below `sm` now.**
The share button (`ShareButton`, `share-core.ts`) joined the trailing group as a
third 40dp control, and 48px more put even the *title line* under the pill up to
411dp — past a 390dp iPhone. So below `sm` all three trailing controls are 40dp
boxes in both account states, the brand gets `width − 180`, and that clears the
174px subtitle from 360 up with 6px to spare. Below 360 the share button hides
rather than the brand giving way, so 320 is the two-control row it always was.
The word "Entrar" stays in the accessible name at every width, and from `sm` up
nothing changed.

**The whole suite was green over that, 802 specs, and the spec that should have caught
it is the one directly above the new one.** "Shows the brand at every width, whole and
never cut" asserts the subtitle is *visible* — and an element overflowing its box is
visible, painting over its neighbour, which is the same trap that spec's own comment
records about a truncated element. The replacement measures `scrollWidth` against
`clientWidth` **and** the gap to the next control, because those fail independently,
and it was confirmed red against the beside-the-block markup before being believed.

`public/logo.svg` and `public/favicon.svg` carry the same geometry with explicit fills
and a `prefers-color-scheme` block, because a file loaded as an image inherits no
colour from anything; the favicon's viewBox is the mark's own bounding box so it fills
a 16px tab slot instead of sitting inside 3px of transparent margin. They replaced a
`⚽` emoji data URI, which the platform's emoji font drew — a different picture on
every OS, and none of them this app. **`public/og-default.png` still carries no mark**:
`sync-og-image` would have to draw it, and that is a separate change to a committed
raster, not a line to slip into this one.

**The theme toggle draws SVGs, not `☀` and `☽`.** A font decides a character's size and
weight, and those two are decided by different parts of it: measured in the shipped
bundle, the crescent drew about a third the height of the 24px icons beside it, so one
control had two optical sizes depending on which theme was on — in the one row of this
app that had been levelled to the pixel by #173 and M9. `☀` is also emoji-presentation on
several platforms, which would put a colour glyph in a monochrome bar. `SunIcon` and
`MoonIcon` live in `SectionIcons.tsx` despite not being sections, because that file draws
the app's standalone icons. The stroke every hand-drawn glyph shares is `GLYPH_STROKE`
in `src/components/glyph.ts`, where `SectionIcons`' own `base`, `ClubLinks`' `GLYPH` and
a copy typed out by hand in `StadiumView` were merged: each of the three had a comment
saying it existed so a glyph defined beside its call site could not drift, which only
holds while there is one of it.

The `NAV_ITEMS` entry carries its own `Icon`, which is *why* `NavBar` never changes — an
icon looked up by id inside `NavBar` would break that promise the first time anyone added
a section.

**The promise is bounded, and the bound is now spent.** Material Design 3's navigation bar
carries **three to five** destinations. Ao vivo made it four; Jogadores took the fifth.
**The bar is full.** A sixth section wants MD3's navigation *drawer*, not a sixth entry
here — and at the sixth nothing fails, no build breaks and no test goes red, which is why
this is a real limit rather than a style note: the tooling cannot check it for you.

**The fifth entry was not free, and what it cost was measured rather than eyeballed.** A
nav item's minimum width is its 64dp MD3 indicator plus whatever padding it carries; at
`px-2` that is 80dp, and five of those is 400dp on a 375dp screen. The fifth label was
clipped at the screen edge with **no horizontal scroll to reveal it** — invisible on a
desktop, and invisible to every test in the suite until `tests/e2e/players.spec.ts` began
measuring each item's box against the bar's at 320, 360 and 375dp. The padding is what gave
way, because MD3 does not specify it while it does specify the indicator. Below 360dp even
that is not enough: five indicators at 64dp is 320dp exactly, leaving nothing for
"Classificação", whose label alone measures 79dp — so the indicator degrades to 56dp under
`min-[360px]:`, and only there, where the spec cannot be satisfied at all. A sixth entry has
no such slack left to find.
