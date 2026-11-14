# Testes end-to-end

*Quando ler:* Leia ao escrever ou depurar uma spec Playwright em `tests/e2e/`.

Extraído do `CLAUDE.md`, que ficou um índice. Esta é a fonte canônica do assunto.

---

## End-to-end tests

**Two targets.** The default boots `server.ts` through tsx with Vite in
middleware mode. `PLAYWRIGHT_TARGET=bundle` boots **`dist/server.cjs` under
`NODE_ENV=production`** instead — the branch the host actually runs, which
serves `dist/` through `express.static`, reads the shell once at boot and has
no Vite. Only `seo`, `page-meta` and `routing` run there, because those are the
specs reaching `registerSpaFallback` and `injectMeta`; the rest would re-assert
what the Vite run already proved. `npm run test:e2e:bundle` builds and runs it.
**`server.ts` refuses to start with `ACCOUNTS_DEV_LOGIN` set when `NODE_ENV` is
production**, so the config empties that variable in bundle mode rather than
omitting it — an inherited value would otherwise take the whole run down.

`tests/e2e/` runs against a server the config boots itself with
`DISABLE_FOOTBALL_DATA=true`, so the suite always sees the **frozen snapshot**.
This is deliberate and load-bearing: live scores, table positions and the current
round all change mid-match, so asserting against live data makes every run a coin
flip. It also keeps the suite from spending the 10 req/min budget.

**The browser's clock is frozen to the snapshot**, by the `page` fixture in
`tests/e2e/clock.ts` — which is why every spec imports `test` and `expect` from
there rather than from `@playwright/test`. `E2E_NOW` is **derived from
`SNAPSHOT_DATE`**, never written down, so a `sync-seed-data` run moves the data
and the clock together and nobody has to remember the second one.

It is `setFixedTime`, never `install`: the full fake replaces the timer queue as
well, which would hang `useNow`, every transition `motion.spec.ts` asserts on,
and `waitUntil: "networkidle"`. Only what `Date.now()` answers changes, and that
is the whole of what the app reads the clock for — `currentRound`, `liveBoard`,
`countdownLabel` and `clubFocus` all take `now` as a parameter.

**The failure it closes was live for four hours before anybody saw it.**
`meu-time.spec.ts` then skipped when the snapshot's soonest unplayed fixture was in
the past, and on 2026-08-30 that fixture (`2026-08-29T21:30Z`) slipped behind a real
clock. Two specs across two projects went silent, the suite reported
`690 passed`, and the only trace was a `4 skipped` line nobody reads. Running the
browser at *today* asks the app to reason about a world its data does not
describe, and the gap widens by a day every day.

**Code that runs in Node is not covered by it**, which is the half that is easy
to miss. The fixture `meu-time.spec.ts` follows is now produced by
`upcomingFixture` in `tests/e2e/matches-payload.ts`, in the test process where the
page's clock does not reach, so it is dated from `E2E_NOW` explicitly. Back when
that spec read the snapshot's soonest fixture instead, freezing the page alone left
all four specs still skipping.

**`tests/e2e/clock.spec.ts` is the spec that names the cause when the fixture
breaks**, because most specs assert shape rather than dates. Removing the
`setFixedTime` call once left `meu-time` green and only `clock.spec.ts` red — the
same green-means-nothing shape as the `page.route` stub that passed against the bug
it named. Measured again on 2026-09-11, after `meu-time` began producing its
fixture: the mutation now also reddens its two *Próximo jogo* specs in both
projects, since a kickoff a minute after the snapshot's noon is days in the past to
a real clock. Its LIVE spec stays green, because a match under way is under way
whatever the clock says.

Rules that follow from that:

- Never assert a specific round number or scoreline — the snapshot ages, and
  `currentRound` advances with the calendar. Assert shape (`/\d+ª rodada/`), not value.
- `allInnerTexts()` and `locator.all()` query immediately and do **not** auto-wait,
  unlike `expect(locator)`. Wait for the table to populate first, or they sample a
  half-rendered DOM — this produced a real flake.
- **Never assert how much curated data exists**, and that includes *which* record
  happens to hold a value. `broadcasts.ts` grows on every sync, so a test counting
  curated fixtures fails the next time the script runs. Assert the *shape* of a rendered
  line instead. This broke CI **twice**: once on a count, and once on
  `goals.spec.ts` pinning fixture 554977 as the match with no minute, on a comment
  reading "554977 predates the join". A later `sync-goals` run gave it one. Seven of the
  184 matches carry a minute today and none is mixed, so which fixture lacks one moves
  every sync. `withoutGoals` in that same file already had the answer — **produce the
  state with a prepared payload rather than hunting the season for a fixture in it** —
  and the minute spec did not follow it. `tests/e2e/matches-payload.ts` holds the
  helpers, and `tests/e2e-fixture.test.ts` refuses a `test.skip` or `test.fixme` in
  any spec, and a literal fixture id: a skip waiting for the data to hold a state
  reports as a count nobody reads, and an id is a claim about which record holds
  it.
- **Do not pipe a test run through `head` or `tail`.** This is the ledger rule under
  **The protocol for commit, push, merge and deploy**, and it is *worse* here, because
  two things fail together:

  1. **A pipeline's exit status is the last command's**, so `npx playwright test | tail`
     exits **0** however many specs failed.
  2. **Playwright prints the failed-test list BEFORE the `N passed` summary.** So the
     last four lines of a *failing* run are three failure lines and then `754 passed` —
     character-for-character the shape of a passing run's tail. The `N failed` header is
     the line above the window.

  Measured: the escalações work ran the suite twice through `| tail -4`, read `758
  passed` both times, and shipped a red `main` that skipped every deploy for over
  twenty minutes. Write the run to a file and grep it for `failed`/`flaky`, or use
  `--reporter=line`; either way check the exit status of **the test command itself**.
  And note the truncation destroys the evidence: with `tail` inside the command, only
  those four lines are ever written, so afterwards you cannot even establish whether the
  specs failed outright or were flaky.
- **Turning text into a control changes its element.** Making a club or player name
  clickable turned a `span` into a `button` (later an `<a>`), which silently broke every
  spec selecting `span:first-child`. Select the cell's element children (`td > *`) rather
  than a tag name.
- `getByText("...")` is case-insensitive substring matching by default. A bare
  `getByText("Ao vivo")` also matches the banner's "…para dados ao vivo". Scope the
  locator and pass `exact: true`.
- **`page.route` fulfilment completes Playwright's own request accounting, so a stub
  cannot reproduce a failure whose nature is that the accounting never completes.**
  `useAccount` returned on a 404 without reading the response body; Chromium held the
  stream open, the request never reached `finished`, and `waitUntil: "networkidle"`
  therefore never resolved — which broke every `screenshot.ts` capture while the page
  itself rendered perfectly. The obvious guard is to stub that 404 with `page.route` and
  assert the page reaches idle. It was written, run against the **known-broken** code,
  and **passed**: Playwright settles what it fulfils. A test that passes against the bug
  it names is worse than no test, because it converts an open question into a false
  answer — the next reader sees green and stops. It was deleted; the reasoning lives in
  `src/useAccount.ts` where the next person will meet it. Where a stub cannot reach,
  measure the real thing: `requestfinished` against a real server is what settled this.
- **The harness does not merely miss some configurations — it configures the app out of
  them.** `env` in `playwright.config.ts` sets `DISABLE_FOOTBALL_DATA: "true"` *and*
  `ACCOUNTS_DEV_LOGIN: "true"`. That second one is why nothing caught the bug above:
  with dev login on, `/api/account/me` answers 200 and the body is consumed by
  `response.json()` on the way past, so the suite never takes the 404 branch at all —
  and the 404 branch is **production's** shape, and every fresh clone's. A green suite
  says the app works in a configuration nothing ships. Before trusting coverage of
  anything touching accounts or the provider, check which side of that `env` block the
  code under test falls on.
