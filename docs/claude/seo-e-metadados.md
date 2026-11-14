# Metadados de página, crawlers e link previews

*Quando ler:* Leia ao mexer em `<head>`, dados estruturados, sitemap/robots ou no cartão de link preview.

Extraído do `CLAUDE.md`, que ficou um índice. Esta é a fonte canônica do assunto.

---

## Page metadata

`page-meta-core.ts` maps a route plus loaded data to a title, description and preview
image. It is used **twice on purpose**: `usePageMeta` sets `document.title` on the client,
and the production SPA handler injects the same values into the HTML it serves.

Both halves are needed. The client half updates the browser tab; **link previews never run
JavaScript**, so without the server half every shared URL unfurls as the generic site
name. `injectMeta` replaces the existing title and description rather than appending, so
the document never carries two, and escapes every value it writes.

The server only loads data for routes that name something (`clube`, `partida`,
`estadio`), and takes it from the same cached payload the API serves — no extra upstream
request. The stadium list is *derived* from that payload rather than fetched, for the
reason `venue-core.ts` gives. If that load fails the page still renders with generic
metadata: metadata is a nicety, never a reason to fail a page.

Canonical and `og:url` come from **`APP_URL`** in the host's `.env`. If that is stale,
every canonical points at the wrong origin.

## Crawlers and structured data

`seo-core.ts` and `structured-data-core.ts` are pure, like every other core module, and
cover the three things `page-meta-core.ts` does not: the canonical address of a route,
whether that address is worth indexing, and the JSON-LD that lets a fixture page be read
as a fixture rather than as prose about one.

**The app answers something for every path, and that is right for a reader and wrong for a
crawler.** `parseRoute` sends anything unrecognised to the table, so `/qualquer-coisa`
served a 200 was an indexable duplicate of the home page — and there are infinitely many
of those. `pageStatus` is where the two audiences part company: the body stays friendly,
the status code and `noindex` tell the truth. Unknown sections, a club or fixture that does
not resolve, a round outside the season and an undecodable path are all 404 + noindex with
the classificação still rendered beneath.

**Absent data is not proof of absence.** `pageStatus` only declares a club missing when the
club list actually arrived. Otherwise a provider outage would 404 all 380 fixture pages at
once and a crawler would drop them over an incident lasting minutes.

**`Disallow` and `noindex` are not two strengths of one knob, and getting that wrong
made every content page a soft 404.** This app renders on the client, so a fixture page
is an empty shell until `/api/matches` answers. `robots.txt` carried `Disallow: /api/`
to keep JSON envelopes out of the index — and what it actually did was stop Googlebot
fetching the payloads the *pages* are built from. Measured 2026-08-30 on the live site:
Search Console's live test on `/partida/554977` reported **Erro soft 404** with **5 of 7
resources** refused as "bloqueado pelo robots.txt", and the fixture sat *"Detectada, mas
não indexada"*, último rastreamento **N/D**. The rendered title Google held was the
generic `Partida · Portal Brasileirão` where curl got `Palmeiras 4 x 1 Vasco da Gama`
twelve times out of twelve.

**Nothing was wrong server-side, which is why nothing caught it** — 200, self-canonical,
correct title and description, no `noindex`, every spec green. Only a crawler's own
render could see it, and the home page was indexed throughout because enough of its
meaning survives in the server-injected shell.

So the content API is **crawlable**, and `X-Robots-Tag: noindex` on every `/api` response
(a middleware mounted in `server.ts` immediately after `const app = express()`) is what
keeps the JSON out of the index. That is the tool for the job because a crawler can obey
`noindex` **only on a resource it was allowed to fetch** — blocking the fetch is what
prevents the instruction being read. The middleware sits at the top rather than beside
the content routes because `app.use` applies only to what follows it, and `/api/auth` and
`/api/account` are registered several hundred lines above them. Those two stay
`Disallow`ed: per-session, needed to render nothing, and the only `/api` endpoints where
a fetch has a side effect.

The upstream budget was the other reason for the blanket rule, and the cache answers it:
60s for standings and fixtures, 15s while a match is LIVE, so the app makes roughly five
upstream calls a minute at any traffic level. **A crawler cannot spend a budget a reader
would not.**

**The sitemap is load-bearing, not a nicety.** The round picker is a `<select>`, not a set
of links, so every round but the current one — and with it nearly every fixture page — has
no inbound link anywhere on the site. `/sitemap.xml` is the only way a crawler reaches
them. **488 URLs at full season — count the file rather than this sentence.** It read 442
for months, and 442 was *correct when written*: the gap is exactly the 19 estádio pages,
`/jogadores` and `/privacidade`, each of which added itself to the sitemap without touching
this line. Nothing here went red, because a number in prose has no gate on it — Search
Console is what noticed, reporting 463 páginas encontradas against a paragraph still
claiming 442. **Adding a section changes this count**, which is the half of the four-file
rule above that no compiler can hold.

**It has gone stale twice now, and the second time is the sharper lesson.** The repair to
463 merged on 2026-08-30; on 2026-09-01 the served file was **488**. Twenty of those
twenty-five are `/painel/<key>` — a section documented under **Routing** below, in a
sentence that says in its own words "20 more URLs" — so the two paragraphs contradicted
each other from the day the painel landed, and this count was wrong when it was written
rather than drifting there afterwards. The remaining five are estádios, 19 to 24, which is
the ordinary growth the paragraph already anticipates. **A number repaired once is not a
number that stays repaired.** The rule the whole passage argues for is the one that keeps
being proved: count the file.

```sh
curl -sf https://brasileirao.mpbarbosa.com/sitemap.xml | grep -c '<loc>'
# 488 = 380 partida + 39 jogos + 24 estadio + 20 painel + 20 clube + 5 standalone
```

None of those figures is anywhere near the 50,000 limit, so no sitemap index is needed. A
finished match takes its kickoff as `lastmod`, because that is when the page stopped
changing; claiming today's date for a fixture played in April trains a crawler to stop
believing the field.

**The origin comes from `APP_URL` first and the request second.** The request fallback
keeps a fresh clone emitting working canonicals with no `.env`, and `resolveOrigin`
validates the host against a strict pattern before using it — the value lands in
`<link rel="canonical">`, so an unvalidated `Host` header lets a third party claim
ownership of this site's content. `X-Forwarded-*` is consulted only when `TRUST_PROXY=true`,
and that choice is `requestOrigin` beside `resolveOrigin` — the same origin feeds the CSRF
same-origin check and the OAuth `redirect_uri`, so it is tested there rather than read by
hand in a handler.

**The client half must not overwrite the server half before its data lands.** `usePageMeta`
now maintains canonical, `og:url` and robots as well as the title — an in-app navigation
otherwise leaves the canonical claiming the entry page owns every later one. But it renders
before its fetch resolves, and writing then would replace `/clube/athletico-pr` with
`/clube/1768` and strip the `noindex` off a page that really is missing. `subjectResolved`
gates it: where it is false, the server's tags stand.

Two traps, both found by their own tests rather than by reading:

- **The catch-all matches through a wildcard *parameter*, and Express percent-decodes
  parameters while matching.** So `/clube/%` throws `URIError` inside the router and
  Express answers its own 400 error page before any handler runs. The guard registered by
  `registerSpaFallback` decodes first and hands the request to the normal renderer.
  **Express 5 did not change this** — `decodeParam` in path-to-regexp v8 throws the same
  way — so do not read the guard as Express 4 residue and delete it. What *did* change is
  the spelling: a bare `"*"` is rejected at **registration** time by path-to-regexp v8
  (`Missing parameter name at index 1`), which means the server does not boot at all
  rather than misbehaving at request time. It is now `app.get("/{*splat}", serve)`,
  checked against express 5.2.1 to match `/`, any depth of deep link and HEAD, while
  still 404-ing a POST and leaving `/api/*` untouched.
- **`vite.transformIndexHtml` decodes the URL it is given**, to resolve which HTML file is
  being asked for. Passing an undecodable `originalUrl` turns that 400 into a 500 from our
  own handler, which is why the dev branch passes `/` when the request URL will not decode.

**The dev server injects metadata too, and `appType` is `"custom"` for that reason.**
Vite's `"spa"` fallback serves `index.html` itself with a 200 and an untouched head, which
took the handler out of the loop and hid the metadata, the JSON-LD and every 404 rule from
the whole e2e suite. Assets still resolve because `vite.middlewares` runs first.

schema.org's event statuses describe **whether an event happened as announced**, not where
it is in its lifecycle: there is no "in progress" and no "finished". LIVE and FINISHED are
therefore both `EventScheduled`, and only POSTPONED and CANCELLED get a value of their own.

**A fixture page emits exactly one Event node, and the second one it used to emit was
rejected.** `superEvent` was `{"@type": "SportsEvent", name: COMPETITION}` — a name and
nothing else. Google validates a nested Event **as an Event**, and an Event requires
`startDate` and `location`, so every one of the 380 fixture pages reported a second,
invalid item ("Campeonato Brasileiro Série A", two critical errors) beside a fixture item
that was itself valid. It only disqualified the page from Event rich results; indexing was
never affected.

**It was pre-existing and simply unobservable.** No `Eventos` report can exist while
`robots.txt` stops Googlebot rendering the page at all, so the crawl fix (#273) is what
made a months-old defect visible — worth knowing before reading it as a regression of the
commit that surfaced it.

**Completing the node was the obvious fix and is the wrong one.** The season's first
kickoff is derivable from the fixture list and the location is Brasil, but that buys the
two criticals and leaves a permanent second item carrying its own warnings — and a
competition played across twenty grounds has no `location` in the sense an Event means it.
Inventing structure to satisfy a validator is the `maximumAttendeeCapacity` mistake in
another costume. The node is dropped instead, and **the league association is not lost**:
both teams carry `memberOf` the competition, which is where membership actually belongs.

**A fixture with no venue emits no Event at all, for the same reason.** `location` is
required of an Event, and a missing venue used to be answered by omitting the field
("rather than inventing one"), which traded an invented stadium for an invalid item.
Search Console's live test on `/partida/555110` (2026-09-11), a round-38 fixture the
provider has not placed, reported Eventos **1 item inválido**, critical `O campo "location"
não foi encontrado`. On that day's payload **120 of 380** fixtures had no venue: 114
scheduled, 3 postponed, 3 finished. Putting them at the home club's ground is the invented
structure the paragraph above rejects (clubs play away from home and share grounds), so
`structuredData` emits the Event only once `match.venue` exists, and the page keeps its
breadcrumbs meanwhile.

**It also keeps every fictional midnight out of the markup, but only by coincidence of the
data.** The 80 fixtures `withKickoffPrecision` marks date-only all lacked a venue that day,
so none emitted a `startDate` of `00:00Z`. A round that gains its venues before its kickoff
times would bring that back: `startDate` has no date-only branch.

`organizer` (the CBF) and `image` (the page's own preview card, passed in from
`page-meta-core` rather than rebuilt, so the two cannot disagree) answer two of Google's
recommended fields. **Three stay absent on purpose** — `endDate`, because no source here
reports a final whistle and stoppage time is unbounded; `offers`, because this app sells
nothing; and `performer`, because the performers are the two clubs that `homeTeam` and
`awayTeam` already name. Nothing here is compiler-enforced the way `trailFor` is, so
`tests/structured-data-core.test.ts` holds each of those decisions instead — including the
count of Event nodes, confirmed red by reinstating `superEvent` before it was believed.

`jsonLdScript` escapes `<` as `\u003c`, not as `&lt;`: a `script` element's contents are
not HTML-parsed, so an entity would reach the JSON parser literally and break it, while an
unescaped `</script>` in a club name would close the tag and spill the payload into the
document.

## Link previews

`public/og-default.png` is the 1200×630 card, drawn by `npm run sync-og-image`
(`scripts/generate-og-image.ts`) and **committed**, because a preview has to resolve on a
host that only ever runs `npm ci --omit=dev`.

**It has to be a raster image.** No platform that matters renders SVG for `og:image` —
Facebook, X, LinkedIn and WhatsApp all reject or blank it — so the card is drawn with the
same headless Chromium `scripts/screenshot.ts` already uses rather than by adding an image
dependency. The colours are read out of `src/index.css` at generation time rather than
written into the script: every value in that file is emitted by `sync-md3-tokens`, and a
second hand-kept copy is how the card ends up a shade off the site it advertises. A token
that has been renamed away fails the run instead of drawing in black.

There is deliberately **no `--check` mode**, unlike `test:tokens`: the bytes vary with the
Chromium build and the host's fonts, so a byte-comparison gate would go red on an unrelated
browser bump. Regenerate by hand when the palette or the wording changes.

**Which image a page gets is a judgement, not a default.** A club page takes its crest,
because that is genuinely what the page is about. Everything else — including a fixture —
takes the site card: a match is *two* clubs, and illustrating it with the home crest asserts
the page is about that one, which is also how the away side's supporters read it.

A **stadium** page still takes the site card, even though it now shows a photograph of
the ground and that photograph would fill a wide card properly. Not an oversight: an
`og:image` is republication on somebody else's surface, where the credit line the
licence requires does not travel with it. Serving the site card is the choice that
does not put an unattributed CC BY-SA photo into every scraper's cache.

**`twitter:card` follows the image's shape**, which is what its two values mean. It used to
be inverted — `summary` whenever an image existed and `summary_large_image` when none did,
declaring the wide layout precisely when there was nothing to fill it. A square crest in a
wide card is a logo adrift in whitespace, so a crest takes `summary` and the site card takes
`summary_large_image`.

`og:image:width`/`height` ride along only for the site card. A crest arrives from the
provider at an unspecified size, and guessing would tell a scraper to reserve a box the
image does not fill. As with the canonical tag and the sitemap, no origin means **no
image tag at all** rather than a root-relative URL — a scraper fetches from its own host, so
`/og-default.png` resolves nowhere and renders as a broken preview rather than a plain one.
