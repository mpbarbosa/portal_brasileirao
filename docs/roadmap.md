# Roadmap

Where Portal Brasileirão is, what is next, and the phased plan for adopting
Material Design 3 — which is now **complete and deployed**. Written 2026-08-25;
the migration ran the same day.

This is a planning document, not a specification. Anything here that contradicts
`CLAUDE.md` or `CONTEXT.md` is wrong — those describe what the code actually
does, and they win.

## Where the project is

Live at <https://brasileirao.mpbarbosa.com>, deployed from `main` by GitHub
Actions through OIDC → S3 → SSM, with no long-lived credentials and no SSH.
Every running instance reports the commit it was built from at `/api/health`,
and the deploy asserts that the live commit is the one it just built. That
pipeline has since gained an ancestry guard, a reconciler, build-once-promote
and a rollback; `docs/cicd-plan.md` carries the phases and **The deploy
pipeline — what is still open** below carries what they did not close.

- **Data** — football-data.org free tier (`BSA`, 10 requests/minute), cached
  60s/15s with a circuit breaker. Everything the provider does not carry is
  curated on a workstation and committed: broadcasts, venues, highlights, club
  Instagram handles, broadcaster marks.
- **Shape** — 27 pure `*-core.ts` modules, every one with its own
  `tests/<name>-core.test.ts`, and 23 components, one Express process serving the
  API and the SPA. Counted on 2026-08-27: `ls *-core.ts`, `ls src/components/*.tsx`.
- **Tests** — 570 unit and 548 end-to-end across desktop and mobile on
  2026-08-27 (`npm run test:unit`, `npx playwright test --list`), all against a
  frozen snapshot so a red build always means the code broke.
- **Design** — Tailwind v4 with **Material Design 3** throughout: 47 colour
  tokens generated from one seed, a shape scale, a type scale, state layers and
  motion, in two themes. Contrast is **enforced rather than recorded** —
  `npm run test:tokens` runs in CI and refuses a palette whose text pairings
  fall below AA. Worst text pairing 4.59, across 76 pairings on 2026-08-27 —
  both figures are printed by that command rather than kept here. Primitives:
  `Surface`, `Button`, `StatusChip`, and the interaction constants.

## In progress

Nothing. The section is deliberately empty rather than deleted — an empty
heading says "we looked"; a missing one says nothing at all.

~~**Highlights backfill.**~~ **Shipped.** All **235** finished matches carry a
curated "melhores momentos"; no round has a gap. `scripts/find-highlights.ts`
finds a fixture's package on ge tv, CazéTV or UOL Esporte and verifies it against
kickoff, and it ran by round in phases, newest first.

Two things learned while starting it, both fixed at the time: a single failed
fetch used to abort a whole run, and the end-to-end specs depended on some
fixture in round 24 *not* being curated, so a successful backfill would have
broken CI.

**This entry described unfinished work for some time after it finished**, saying
"a handful are curated" of a set that was fully curated, while Near term still
asked to finish it. Nothing signals that transition: the last phase of a backfill
looks exactly like the previous ones, and the only thing that changes is a count
nobody re-runs. The check is two lines of Python over `matches.ts` and
`highlights.ts` — cheap, and worth running before trusting either section.

## Near term

- Re-run `sync-broadcasts` weekly as the season advances; the cron already does.
- Watch for broadcasters CBF names that we render as wordmarks, and add marks
  where a public-domain one exists. **Surveyed 2026-08-27 and there is nothing
  to add**: of the 8 channels in `broadcasts.ts` only Record lacks a mark, and
  Commons has no free national Record logo — the category tree, Wikidata's
  `P154` and five title searches all come back empty, and the one CC0 file is
  the 1982 rainbow logo. `broadcast-core.ts` carries the full finding so it is
  not re-derived. ESPN/Disney+, Band and SportyNet were named here from a doc
  comment illustrating separator parsing, not from data — none has ever been in
  `broadcasts.ts`. Re-check when a sync introduces a channel, not before.
- Move the Node major from 22 to 24 before 2027-04-30, host first — see below.
  Nothing will open a pull request for this.
- Watch `tests/e2e/scorers.spec.ts` "switching away and back keeps the table"
  (**mobile only**, Pixel 7). One failure on 2026-08-27, passing on re-run and
  on both #103 and #108 in CI. Recorded rather than diagnosed — one occurrence is
  not a flake diagnosis — but with what a second occurrence would need, since
  the evidence is gone by then: it aborted on the **`.click()`** of the Artilharia
  nav link (`scorers.spec.ts:4:57`) reached from **line 73**, i.e. the *second*
  navigation, after Classificação — not on the table assertion below it and not
  in `beforeEach`, both of which had already passed in the same test. Playwright
  auto-waits for actionability on a click, so a timeout there says the link
  never became **stable**, which points at layout movement rather than at data or a
  missing row. Two things in this repo make that the expected place for it, both
  documented in `CLAUDE.md`: the nav bar is deliberately at its width limit on a
  phone (five 64dp MD3 indicators is 320dp exactly, degrading to `w-14` under
  `min-[360px]:`), and Classificação is the heaviest layout in the suite — 20
  rows, two frozen columns and 20 sparklines — so returning *from* it is the one
  transition where the bar is most likely to still be settling. Capture the
  trace next time rather than re-running; `settle`'s existence is the precedent
  that MD3's 200ms transitions are real in tests.
- ~~**`scripts/deploy.sh` neither retains the previous release nor flips back to
  it.**~~ **Done, in the shape this entry prescribed** — it hands off to
  `07_install_release.sh` rather than learning the trick, so the change **deletes**
  the third copy of the restart-and-health logic instead of adding a fourth.
  `deploy.sh` now rsyncs the release into a fresh staging directory on the host
  and runs `07` from that staging copy, which is exactly what CI does after
  untarring from S3.

  **Two claims were already asserting this had happened.** `CLAUDE.md` said the
  two routes "converge and only the transport differs", and `07`'s own header
  said the same. Both were memories of a design, not readings of the code, and
  neither could be contradicted by anything — nothing in CI ran `deploy.sh` at
  all. That is this file's own *a claim that produces no work when it holds is
  never exercised*, one more time, in the two documents describing the path.

  **`scripts/rehearse-deploy-sh.sh` is the first behavioural coverage that script
  has ever had**, and it is what turns the sentence into something that can fail.
  It stubs `ssh` to run the command locally — the way a real `ssh` runs it through
  the login shell, which is why one stub serves both `ssh host 'mktemp -d'` and
  the `ssh host rsync --server` rsync invokes — and asserts the state of the host
  afterwards rather than the exit code alone. Confirmed **red against the previous
  `deploy.sh`**: ten assertions across retention, flip-back and the exit code.

  **Two of those ten were mine, and they had been green against the old script.**
  "the staging directory was cleaned up" is satisfied by never having created
  one, so it passed against a script that does not stage — a test green against
  the absence of the thing it tests, found only by running the mutation. It now
  asserts a staging directory was *named* first.

  **The first-deploy case moved into `07` and gained exit 4.** `deploy.sh` used
  to answer it inline and exit **0**, which contradicted its own documented
  meaning of 0 ("deployed and health-checked") — a host with no service unit has
  nothing serving. Only the script that installs the payload can know the payload
  has landed, which is why the check belongs there rather than in a pre-flight.
- **The summary's figures are hand-kept, and every one that could drift had.**
  On 2026-08-27 **Where the project is** claimed 14 `*-core.ts` modules against
  27, 15 components against 22, 256 unit tests against 558 and 316 end-to-end
  against 548 — each roughly half the truth, in the first screen a new reader
  meets. Corrected against measurement, and each figure now carries its date and
  the command that prints it, which is the pattern #108 already used for the
  host's Node version. Two figures had **not** drifted, and they are the two
  describing a generated artefact that has not moved since M1: 47 colour tokens
  and the 4.59 worst pairing. That is the whole argument for dating a number or
  not writing it down — **nothing in CI reads this file**, so a count here is a
  hand-kept copy of something a command already prints, exactly as
  `What is left` was of **Near term**. Two more copies of the same numbers were
  found and de-counted rather than refreshed (D6's "all 316 specs", M1's "70
  pairings"), because in both the count was never the point.

Left over from **Árbitro** (item 1 below), which surfaced more about the
provider than it needed to build:

- **Refresh the README screenshots — now due, and larger than this item.**
  #104, #106 and #107 are merged and deployed; `/api/health` served `f72c169`
  while this was written. So the precondition is met and the capture job is red
  on `main`. No `Screenshots-unaffected:` trailer applies — the changes reach a
  paint.

  **The scope grew while it was queued, and whoever takes it should size it from
  the diff rather than from this list.** Comparing `docs/screenshots/CAPTURED`
  (`00fecde`) against `main` at the time of writing, **five** appearance paths
  had moved, not the one this item was written for:

  ```
  src/App.tsx  ·  src/components/AccountView.tsx  ·  src/components/MatchPage.tsx
  src/components/NavBar.tsx  ·  src/components/PlayersView.tsx
  ```

  `NavBar` is the one that decides the cost: the bar is on every route, so the
  refresh is **all sixteen images**, not the two `MatchPage` owns. The plan
  agreed between sessions — capture last, once, after everything lands — is still
  right; it was simply costed against two changes and now covers several.

  ~~The árbitro row renders **only against live data**, so the sequence remains:
  merge, deploy, capture from the live site.~~ **That was done — #118 refreshed
  all sixteen and `CAPTURED` now reads `10b7c1a` — and it did not photograph the
  árbitro row, because it never could.** See the next item. Re-check the diff
  above before starting anything here, since `main` moves.

  **It was also wrong, which is worth separating from its being finished.** It
  named production as the *only* route; the check's own failure text does not,
  accepting "a local production build of HEAD (`npm run build && npm start`) —
  the normal case, and the only one available while a change is unreleased". The
  rule is the one stated two items below — the live site, or a local build whose
  `.env` matches the host's. And when that sentence was written **neither route
  worked**: `fetchAccount` held the 404's response stream open, so no capture
  reached `networkidle` from anywhere until #118. A struck claim still teaches
  whoever reads the strikethrough, and this one should not be read as a rule that
  was right and has now been carried out.
- **The árbitro row cannot be photographed by any refresh, and needs a second
  fixture in the capture set.** This is the one item on this page that
  waiting does *not* fix, which is why it is stated separately from the refresh
  above rather than as a caveat inside it.

  `partida-554977` is the only match page in the capture set, and the provider
  reports no officials for it. Measured against production on 2026-08-27, and
  again after #118 landed:

  ```
  380 fixtures, 157 carry `referees`
  554977 -> None
  554740 -> [{"name": "Bruno de Araújo", "role": "REFEREE"}]
  ```

  `MatchPage` renders `match.referees ?? []`, so that pair shows nothing
  whenever and however it is captured.

  **Whether it might fill in on its own is worth stating precisely, because the
  obvious summary is wrong.** 554977 is **round 24**, FINISHED, and carries no
  officials. Coverage is not a simple prefix: rounds **1–15 and 20–22** carry
  them; **16–19 and 23 onward** do not. Rounds 23 and 24 are FINISHED and carry
  none while earlier finished rounds do, so officials plainly do not arrive with
  the result, and round 24 may gain one later. (A snapshot cannot see *when* any
  of it arrived, so the arrival order is not observable from here; what is
  observable is that a played round can sit empty.) But nothing guarantees it,
  nothing schedules it, and **nothing would notice if it happened**: the gate
  compares appearance *sources* and cannot see what a picture depicts. Waiting
  is therefore not a plan, only a hope.

  The fix is a change to **what is photographed** — but **not** by repointing the
  existing pair, which is the obvious move and costs more than it buys. No
  fixture can carry both the árbitro line and the Estádio and emissoras lines:

  ```
  referees           157 fixtures, rounds 1-15 and 20-22   (from the provider)
  venue + emissoras   30 fixtures, rounds 24, 25 and 26    (curated forward)
  intersection         0 — not one shared round
  ```

  `venues.ts` and `broadcasts.ts` are written by the same `sync-broadcasts` run
  and cover *coming* rounds, while the provider names officials for *played*
  ones — so the disjointness is structural, not a fact about today's data.
  Repointing 554977 would trade the Estádio line, the stadium link and the
  broadcaster marks for the árbitro line, taking `BroadcasterMark` out of the
  captured surface entirely — a component nine e2e specs select on.

  So the set gains a **second** match page rather than exchanging the one it has.
  **PR #124** adds `partida-554951` — Botafogo 1x1 Fluminense, round 22, Bruno
  Arleu de Araujo — in both themes, with its own alt text. Note that is a
  seventeenth *and* eighteenth image: every entry in the set is a light/dark
  pair, so no capture is ever added singly. Either way it is a change to the
  capture set, not a refresh of it — different work, different review.

  **Do not treat the green gate as evidence this is done.** #118 cleared it by
  advancing `CAPTURED` past #104, so the images are now certified current for a
  commit whose headline feature they do not show. The gate is working as
  designed; it was never a claim about content.
- **A local production build can commit an image production cannot serve, and
  nothing in the toolchain can catch it.** `scripts/screenshot.ts` accepts a
  capture whose build matches HEAD on the appearance paths and is serving real
  provider data. A **local** production build with `GOOGLE_CLIENT_ID`/`SECRET`
  in its `.env` satisfies both — and renders the Contas "Entrar" control, which
  the host does not: `/api/account/me` is **404**
  (`Contas não estão disponíveis nesta instalação.`) on production, so
  `AccountView` returns `null` there. The resulting image would land in
  `docs/screenshots` looking exactly like a good capture, showing an affordance
  no visitor has. Capture from the live site, or from a local build whose `.env`
  matches the host's. Contas, unlike árbitro, *is* a scheduling problem: it
  resolves the day credentials reach the host.
- **Four of the eighteen captures can never come back byte-identical, and that
  is a property of the tooling rather than of any change.** Two vary per
  *deploy*: `scripts/screenshot.ts` sets `fullPage = !mobile && route === "/"`,
  so `classificacao-dark.png` and `classificacao-light.png` are the only
  full-page shots — and a full-page `/` includes the rodapé, which prints
  `Versão <sha>`. Two more vary per *minute*: `ao-vivo-{dark,light}.png` carry
  `countdownLabel`'s "Começa em 20h37" against a live fixture list. Those four
  therefore change on **every** refresh whatever the code did — and the Ao vivo
  pair changes between two refreshes of the *same* deploy, which is how it was
  found. See CLAUDE.md under **CI** for the measurement. The consequence worth carrying:
  *"the refresh showed no pixel change"* is not an observable state for them, so
  the capture set cannot distinguish "nothing changed" from "something changed"
  on the page most likely to be looked at. `CAPTURED`'s mechanical answer — that
  a refresh always leaves something to commit — is trivially true there and
  proves nothing. Do not read a two-image delta after a deploy as a regression;
  the delta is the sha plus whatever live data moved.

  A useful companion property, in the other direction: **a committed capture's
  provider state is provable from its path.** `screenshot-core.ts` refuses any
  provider that is not `football-data` ("frozen seed data") and
  `scripts/screenshot.ts` writes refused captures to `docs/screenshots/local`
  instead. So an image sitting in `docs/screenshots` cannot have been shot
  against the seed, and a reviewer need not take the capturer's word for it. It
  says nothing about which *host* was captured — a local production build with a
  token passes identically, and only the rodapé sha distinguishes it.

- **Watch whether upstream backfills the officials for rounds 16–24.** BSA names
  a referee on 157 of 380 fixtures — rounds 1–15 complete, 16 onward mostly not
  — so the row is absent from roughly 60% of match pages today. It fills in
  **retroactively**, since finished matches gain one, so this may resolve
  itself and nothing in the app needs changing if it does. Worth knowing before
  someone reads a missing row as a bug and goes looking for one.
- **Do not translate a role the payload has not sent, and do not prettify one it
  has.** `refereeRoleLabel` maps `REFEREE` alone, because that is every one of
  the 356 entries across BSA, PL and CL. If the tier ever widens, an assistant
  reaches the page as `ASSISTANT_REFEREE_N1` — ugly on purpose, and the visible
  prompt to add the row rather than a rendering defect to patch over.
- **The officials' `nationality` is deliberately dropped, and the reason is a
  live example rather than a principle.** It reads `Brazil` for 156 of the 157
  entries, and the one exception is an **upstream error**: a French official
  recorded against Coritiba × Chapecoense in round 22. So the field offers one
  word repeated on every page, plus one that is wrong.

### Node: one major, and a date it has to move

`.nvmrc` now holds the single Node major, and `package.json`'s `engines`, the
`@types/node` pin, `REQUIRED_NODE_MAJOR` in `shell_scripts/01` and both
workflows' `node-version-file` are asserted equal to it by
`tests/node-version.test.ts` (#103). The reasoning — including why raising the
runtime to meet the typings is *not* the fix — is in `CLAUDE.md` under **CI**.

One of the two questions this raised is now answered; the other has a deadline.

**What the host runs is now a measured fact: Node 22.23.2.** Read off
`/api/health` at sha `45b5531` on 2026-08-27, minutes after #103 deployed. It
had never been knowable before — nothing in the repo pinned it and the endpoint
did not report it, so every statement about it was an assumption.

The answer vindicates the pin: production was on 22, CI was on 22, and the
typings had been on **26** since #91 — four majors ahead of the runtime they
were certifying. Had this come back 24, the right move would have been to raise
the five numbers to meet the host rather than to assume the host was wrong; it
did not, so nothing further is owed here.

**22 is already the maintenance line.** Read off nodejs/Release on 2026-08-27:

| line | status today | end of life |
| --- | --- | --- |
| 22 | maintenance since 2025-10-21 | **2027-04-30** |
| 24 | **active LTS** since 2025-10-28 | 2028-04-30 |
| 26 | becomes LTS 2026-10-28 | 2029-04-30 |

So 22 was the right pin to land — it is what CI **and the host** were already
running, and changing the runtime and the typings in one commit would have made
a failure ambiguous — but it is not the right pin to *stay* on. The move is to
**24**, the active LTS, and it is a deliberate five-file commit starting at
`.nvmrc`, with `npm run test:unit` refusing anything partial. It needs the host
raised to 24 first, since `shell_scripts/01` requires an exact major.

**Nothing will remind you.** `.github/dependabot.yml` ignores the *major* for
`@types/node` by design, which is what stops the typings running ahead of the
runtime again — and the cost of that is precisely that no pull request will ever
appear proposing it. This entry is the reminder, and it is now the only
thing tracking it. Before 2027-04-30.

## The deploy pipeline — what is still open

The phased plan and its reasoning live in `docs/cicd-plan.md`. **Every phase and
every gap in it has now shipped** — D0 through D7 — and each was verified against
production rather than against CI. What follows is only what is **still open**,
split by whether it needs a decision or needs work, because the two get confused
and a question waiting on an answer looks exactly like a task nobody has picked
up.

Two of the three remaining items are not changes to this repository at all: one
is a GitHub setting and one is a dispatch. That is worth saying at the top,
because a reader looking for work here will otherwise keep finding decisions.

### Questions, not work

- **What does the release bucket actually retain? Still unknown, and now
  *blocked* rather than merely unasked.** Nothing in this repository defines a
  lifecycle policy on `s3://…/releases/`, and no session working from a checkout
  can read one. It is the precondition for `rollback.yml` being worth anything: a
  30-day expiry would make an artifact-reinstall rollback fail precisely when a
  long-lived regression is found, and would push the design toward keeping the
  previous release **on the host** instead. Dispatching `rollback.yml` with an
  empty sha is how you look — but see the next item for why that currently
  answers nothing.
- **Does the deploy role hold `s3:ListBucket`? No — answered by dispatching it,
  2026-08-27.** The list-only mode returned `AccessDenied` naming that exact
  action, which is a definite answer rather than the "probably not" this entry
  carried. So the bucket question above cannot be answered without a small IAM
  change. A rollback still works without it — naming a sha has the host fetch the
  object with permissions the daily release already exercises — and since gap D
  the **deploy tags are a release inventory readable from git**, needing no AWS
  permission at all. What the tags cannot tell you is whether an object still
  exists behind them, which is precisely the question `s3:ListBucket` would
  settle. Note that observation predates a later IAM edit for the Deployments
  trust policy, so re-dispatch rather than trusting this line.
- ~~**`allow_non_descendant` has no door.**~~ **Removed deliberately**, which is
  the second of the two options this entry offered, and the shipped step now
  points at `rollback.yml` instead.

  **The guard and its override were reachable on disjoint events**, which is
  sharper than "no door" and is what settled it. On a **push** — the only event
  where the guard realistically fires, since a queue draining out of order
  installs an older `main` commit over a newer one — `github.event` carries no
  `inputs` key at all, so the override always evaluated to `false`. On a
  **dispatch**, where the box can be ticked, `GITHUB_SHA` is the chosen ref's
  *tip*; on `main` that is the newest commit, which is an ancestor of live only
  if `main` has been rewound. So the override could only be set where the guard
  would not fire.

  Worse, the refusal told the operator to *"re-run from the Actions tab with
  allow_non_descendant=true"* — and re-running a push run replays its payload,
  inputs and all, so that instruction could not be followed.

  **Neither door was worth building.** To recover from an out-of-order queue you
  want the *newer* commit, and dispatching `ci.yml` on `main` installs exactly
  that and passes the guard unaided. To go backwards deliberately you want
  `rollback.yml`, which does its own SSM install and carries no guard on
  purpose. A second way to install a chosen sha through `ci.yml` would be a
  second copy of the deploy path, which is the thing the reconciler was
  deliberately built not to become.

  Verified by extracting the shipped step and driving all six branches against
  real git history and a real HTTP server — ahead, equal, backwards, diverged,
  site down, and a stale `ALLOW_NON_DESCENDANT=true` left in the environment,
  which no longer opens the gate. The equality case matters and passes: a guard
  refusing an ancestor also refuses to redeploy the current commit unless
  equality is short-circuited, and it is.
- ~~**#90 (`@vitejs/plugin-react` 5 → 6) cannot merge and will not fix
  itself.**~~ **Done, and this entry was two claims behind.** #90 was closed
  unmerged on 2026-08-27, superseded by the regrouped Dependabot pull requests.
  The reasoning was kept because the underlying work was not done — and both
  halves of it have since landed without this line noticing.

  **Vite 6 → 8 landed in `ad8853c`**, so "still outstanding" was false from that
  merge onward; `package.json` read `"vite": "^8.2.2"` while this said
  otherwise. And with vite 8 in place the plugin bump stopped being blocked at
  `npm ci`, which is the whole of what made #90 unmergeable.

  The plugin is now **`^6.1.1`**. Its three new peers —
  `oxc-transform-react`, `@rolldown/plugin-babel`, `babel-plugin-react-compiler`
  — are all `optional: true`, so nothing was added to satisfy it, and
  `npm ls @vitejs/plugin-react` reports no unmet peer. Verified through the
  paths a bundler change can actually break: `tsc`, the Vite build, the esbuild
  server bundle, a production boot serving `/`, `/api/health`, `/api/standings`
  and a deep link, **798 unit, 750 e2e, and the 96-spec bundle target**.

  **The lesson is the entry rather than the upgrade.** A dependency claim in a
  planning document has a shelf life measured in merges, and this one outlived
  its truth by a day while reading as current. Check `package.json` before
  believing a line about a version — it is the reading, the prose is the memory.

### Work, sequenced in `docs/cicd-plan.md`

**Nothing here is outstanding.** Every item below has landed — most struck
through, the D5b entry simply saying so in its first line. They are kept, with
their reasoning, because the reasoning is what a later reader needs, and because
a list that deletes what it finished cannot be told apart from one nobody wrote.

- **D5b landed while this section was being written, and what is left of it is
  recorded above under the deploy-script note rather than here.**
  `07_install_release.sh` now keeps the outgoing release in
  `$DEPLOY_DIR/previous/` and `06_redeploy.sh` restores it when the health check
  fails, so the CI path no longer destroys the running build before the new one
  is proven. `rollback.yml` remains the deliberate, operator-driven way back;
  the flip-back is the automatic one, and between them the defect is closed for
  releases that go through CI. The gap that survives is `deploy.sh`, the
  workstation path, which carries its own inline remote block and calls neither
  script — latent rather than live, since `CLAUDE.md` already forbids running it
  by hand.

  **The flip-back has now run against production, and it worked.** Drill
  `33079608222` on 2026-08-27 installed a payload byte-identical to the live
  release except for the health literal, and the host answered:

  ```
  Error: portal-brasileirao did not become healthy.
  ==> Flipping back to the retained release in …/previous...
  ROLLED BACK: portal-brasileirao is serving the PREVIOUS release
  SEVEN_EXIT=2
  ```

  `/api/health` came back `ok` on `8ed6f60` — the release that was live before —
  and `/`, `/classificacao` and `/ao-vivo` served 200 throughout, which is what
  the starts-but-unhealthy variant was chosen for. Both halves of D5 are now
  demonstrated in production: retention on every deploy, and the restore on
  demand via [`flip-back-drill.md`](flip-back-drill.md).

  **Crash-on-boot is drilled too, and it is the one that took the site down.**
  Run `33096969376`, 2026-08-27, `mode=crash`: the bundle exits on boot, so
  systemd has nothing healthy to restart into and `Restart=on-failure` cannot
  help. Same verdict — `07 exit: 2`, `ROLLED BACK: yes`, health back on
  `0e07d83`.

  **The outage was measured, not estimated.** Polling production from outside
  every 2s across the drill caught exactly three non-200 samples, `17:10:05` to
  `17:10:09` — a real outage between four and eight seconds, against a written
  estimate of ten to fifteen. That is the number to quote for what an unbootable
  release now costs.

  Both variants therefore hold in production: *starts-but-unhealthy* (which
  systemd cannot detect, since the process is alive) and *crash-on-boot* (which
  it detects and cannot fix). Nothing about the flip-back is untested any more.

- ~~**`scripts/rehearse-flip-back.sh` is the only behavioural coverage the two
  host scripts have, and nothing runs it.**~~ **Landed**: `check` runs it — and
  `rehearse-accounts-backup.sh` beside it — on every push and pull request,
  before the release is packaged. The reasoning, kept, because only the last
  clause of it expired: `npm run lint` is TypeScript and cannot see shell, so
  shellcheck is all CI asks of `06_redeploy.sh` and `07_install_release.sh`
  statically, and the rehearsal remains their *only* behavioural coverage. It
  drives all eight branches against stubs — 31 assertions, including the
  flip-back-itself-fails case — and three deliberate mutations were used to
  confirm it goes red rather than passing vacuously.

  **What placing it in CI changed is the failure it can no longer reach the host
  through.** `shell_scripts/` travels *inside the release tarball*, so a broken
  edit ships with the release that carries it and the host executes it
  immediately, before anything has a chance to health-check the result — which
  is why it gates packaging rather than merely preceding it. It can gate at all
  because it is hermetic: bash, python3, rsync, curl, no network, no AWS, no
  token. That is the property that separates it from `check-hymns`, not whether
  a person or a workflow types the command. Run it by hand while editing either
  script anyway; CI is the floor, and reading the output is not the same as
  seeing a green tick.
- ~~**D6 — the end-to-end suite boots the dev server, never the bundle.**~~ **Landed** in #122: `playwright.config.ts` takes a target, `isBundle` boots `node dist/server.cjs`, and CI drives the suite against it. The reasoning, kept: Every
  spec runs against `npx tsx server.ts`, so `dist/server.cjs` — what production
  actually runs — is only asked three questions by `check`'s smoke test. The
  production-only paths (`registerSpaFallback`, `injectMeta`, the 404 rules, the
  JSON-LD) are the gap. Related, and worth fixing together: since D3 gates
  packaging to deploy-capable runs, **the promotion path is never exercised on a
  pull request at all** — its first run each time is the merge.
- ~~**D7 — hygiene, led by the advisory job that reddens successful releases.**~~ **Landed:** `ci.yml` carries `continue-on-error: true` on the screenshots job, so a red advisory no longer concludes a successful release as failure. The reasoning, kept:
  `screenshots` is deliberately outside `deploy`'s `needs`, which is right; but a
  red advisory sets the whole run to `failure` while the deploy succeeds, and
  that has now been observed doing so more than half a dozen times, including on
  this plan's own pull requests. `continue-on-error: true` plus a step summary
  keeps the debt visible without lying about the release.

### Smaller, recorded so they are not rediscovered

- ~~**Deployments are invisible to GitHub.**~~ **Done, on the second attempt,
  and the first attempt is the part to remember.** `deploy` declares
  `environment: production`, so there is a Deployments tab and a per-environment
  history. Shipped in #151, it broke **every release for ten commits**: attaching
  a job to an environment rewrites the OIDC subject claim from
  `…:ref:refs/heads/main` to `…:environment:production`, and the trust policy
  pinned the first form with `StringEquals`. Reverted in #156, relanded in #159
  once the policy accepted **both** — both, because `rollback.yml` and
  `flip-back-drill.yml` carry no environment and keep sending the ref form.
  "Two lines" was true and beside the point.
- ~~**`sync-broadcasts` pushes straight to `main`.**~~ **Done** — it commits to
  `automation/sync-broadcasts` and opens a pull request, building on an open one
  rather than replacing it. One correction worth carrying: *"the PR would be
  green on arrival"* is false. A pull request opened with the repository's own
  `GITHUB_TOKEN` starts **no** workflow run, so it arrives with no checks rather
  than passing ones — which means branch protection (the next item) would make
  it unmergeable until somebody grants that branch an exemption or a different
  token. `docs/cicd-plan.md` gap E has the detail.
- **`main` is protected by convention only — verified, designed, and waiting on a
  GitHub setting.** The API reports `main` as `protected: false`: no rule set, no
  required check, no required review. **But the motivation does not survive
  contact.** Required status checks stop a red merge; they do not stop a session
  merging a *green* pull request. Only required approvals would, and with one
  human maintainer that setting blocks every merge including theirs, because
  GitHub does not let an author approve their own. So "no session merges to
  `main`" stays a social rule whatever is configured; what this buys is narrower
  and still real — nothing pushed directly, nothing red merged.

  Two traps, each of which costs a day. The required checks must be spelled as
  the job's **name** (`Type-check, unit tests, build`, `End-to-end (Playwright)`),
  never its id — a name matching no check leaves every pull request *waiting*
  rather than reporting a misconfiguration. And `sync-broadcasts`' weekly pull
  request arrives with **no checks at all**, so it would be permanently
  unmergeable without an exemption for `automation/sync-broadcasts` or a
  credential that is not `GITHUB_TOKEN`. Decide that before switching the rule
  set on. `docs/cicd-plan.md` gap F has the full settings and the four deliberate
  choices behind them.
- ~~**The curated-data checkers never run on their own.**~~ **Done, in exactly
  that shape.** `.github/workflows/curated-data.yml` runs the four monthly and
  reports into an **issue** — opening one, commenting while the failure persists,
  closing it when everything resolves. The job is always green, because CI has no
  network dependency on a third party and a link rotting on someone else's server
  is not a reason for a red build on a commit that did not touch it.

  **Do not "tidy" its `set -uo pipefail` into `set -euo pipefail`.** Today that
  changes nothing — a command in an `if` condition is exempt from `set -e` — but a
  bare `npm run check-…` added outside an `if` exits 0 as written and **1** under
  `set -euo`, which turns the rule above into a red build. **Still unobserved: a
  real run.** The cron is monthly, so the only way to see it work sooner is a
  dispatch, and that spends third-party rate limit and may open a genuine issue.

## From the Brasileirão Pro import

`brasileirao-pro.zip` — an AI Studio prototype of a Série A analytics dashboard —
was read for ideas on 2026-08-27. Its design spec is imported verbatim at
[`brasileirao-pro-design.md`](brasileirao-pro-design.md) and the full judgement,
including six rejections and the reason for each, is
[`brasileirao-pro-proposal.md`](brasileirao-pro-proposal.md). **Read the proposal
before starting any of these** — every item below carries a trap that is stated
there and not repeated here.

Nothing in this list needs a new upstream request. One item surfaces a field the
provider already sends; the rest are derivations or rules.

**Now — no decision to make.** Six of these are one attribute, one element or a
paragraph of prose.

1. ~~**Árbitro on the match page.**~~ **Shipped.** `refereeRoleLabel` translates
   at the edge and the row is absent when upstream names nobody, which is 223 of
   the 380 fixtures — finished ones included, so the field fills in
   retroactively rather than at kickoff. Two things the payload settled that the
   proposal could only guess at: **every** one of the 356 entries across BSA, PL
   and CL is `REFEREE`, so the wider vocabulary it predicted is not reachable on
   this tier and only that one value is translated; and the field is
   **live-only**, since the seed snapshot carries no officials and the e2e suite
   boots frozen. Green e2e is therefore not evidence that it renders —
   `tests/football-data-core.test.ts` covers the mapper against a captured
   payload, per the rule in `CLAUDE.md`.
2. ~~**Aproveitamento (%).**~~ **Shipped.** `pointsPercentage` and
   `pointsPercentageLabel` in `standings-core.ts`, the `%` column of the
   classificação and the fifth tile of the club page, with the `CONTEXT.md`
   entry in the same commit.

   Three things the build settled that the proposal left open. It says "render
   on the club page and in the classificação's **row detail**", and there is no
   row detail — the classificação has never had one, so it became a column, last,
   where a Brazilian table puts it and where the header entry **P, J, V, E, D,
   SG** stopped one short. It is **derived, never a field on `StandingsRow`**:
   `/api/standings` serves upstream's table when the provider is reachable and
   the computed one otherwise, and a value read from `points` and `played` cannot
   disagree with the two numbers beside it whichever arrived. And a club with no
   game played gets an **em dash rather than `0%`** — 0% is a club that has
   played and taken nothing, which is a claim about the club where the other is
   an absence, the same rule the artilharia applies to an unreported tally.

   The postponed-fixture argument is visible in the frozen snapshot rather than
   only in the reasoning, which is worth knowing before anyone reads the column
   as redundant: Atlético-MG sits **below** Coritiba on 33 points to 34 and
   **above** it on aproveitamento, 48% to 47%, on one game fewer.
3. **A legend for the G4/Z4 rail.** — **done.** `zoneClass` painted the rail and
   nothing on the page said what the colours meant. It was also hue-only, where
   the same data on the club page carries a letter *and* a colour. The key sits
   outside the table's scroll container and names *which positions* each zone
   covers, which is what puts the fact on a channel other than hue — the rail now
   confirms the key rather than being the only place the zones are stated. A
   **row** still announces no zone of its own to a screen reader — the rail is a
   CSS border, and a border has no text. That half is item 14.
4. ~~**`referrerPolicy="no-referrer"` on crests.**~~ **Shipped**, with item 5 —
   the proposal's D5 says to do them together and they are the same twenty
   lines of `ClubCrest`. Measured rather than assumed: 20 crest requests per
   render of the classificação, **0** now carrying a `Referer`, and the crests
   still load. The attribute *and* the header are both asserted, because a
   policy the browser declined to honour would leave the attribute looking
   right.
5. ~~**A crest fallback.**~~ **Shipped.** `crestMonogram` in `club-core.ts`,
   rendered as the club's `tla` in a quiet disc occupying the box the crest
   would have taken.

   Three things worth carrying. **`code` cannot be the second fallback** — a
   club whose provider reports no `tla` gets a synthetic `FD-<id>`, and "FD-"
   beside a club's name abbreviates nothing, so it is the short name's
   **initial**, one letter, not initials word by word: "Vasco da Gama" needs a
   stopword list to reach `VG` and every such rule is a way to print something
   wrong beside a name that is already right. **The `no crest` and `crest
   failed` paths were unified** rather than left as two answers to one
   question — a club the provider gives no crest for previously rendered
   nothing, and now gets the same disc. And the failed **`src`** is recorded,
   not a boolean: a latching flag would keep drawing letters for a club whose
   crest starts loading again, or for a different club reconciled into the same
   row.

   **`ink-muted` on `surface-container` is chosen because the gate measures
   it.** `backgroundsFor` in `scripts/generate-md3-tokens.ts` stops at
   `surface-container`; `-high` and `-highest` are emitted, sit further from the
   ink, and are checked against nothing — so the obvious quieter disc would have
   put letters a reader must read on an unmeasured pairing. Worth knowing before
   the next component reaches for a container step.

   Both e2e specs were run against a deliberately unmutated-then-mutated
   component — attribute removed, fallback branch removed — and both went red,
   so neither is passing vacuously.
6. ~~**`sr-only` names on the existing form pills.**~~ **Shipped.** The letter is
   `aria-hidden` and an `sr-only` span carries the word, so a pill announces
   "Vitória" rather than "V" or "V Vitória" — the one place this differs from
   `RankSparkline`, whose visible half is a drawing and so gets text *added*
   rather than substituted. The list also names its own direction, because
   "Últimos resultados" says which matches these are and never which end is now.
   `FormPill` is a component so item 10 moves it rather than copying it; the
   repo's rule is to extract at the second call site, and this keeps that one
   cheap.

   **The spec written for it passed against the bug it named, and the second
   mutation is what caught that.** "Naming the pills does not resize them"
   measured the pill's own width — but `h-7 w-7` fixes a pill at 28px whatever
   it contains, so an un-hidden word spills out *visibly* while the measurement
   stays 28×28. Under the mutation the pill still read 28×28 with `scrollWidth`
   40 and the word's own box 43×16. It now asserts the word's box and the
   pill's overflow, and goes red. The first mutation had hidden this by
   removing the `aria-label` too, which broke the selector and failed all three
   specs for one reason — **a mutation that breaks your locator tests the
   locator, not the assertion.**
7. ~~**Write down the radius step-down rule.**~~ **Shipped, and it was not
   documentation only.** The rule is written beside the scale in
   `src/index.css`, restated in `CLAUDE.md` and `CONTEXT.md`.

   **Two things the survey settled, and the item was wrong about both.**

   *"It is already true"* was false. All 30 `rounded-*` call sites under `src/`
   were read, and one contradicted the rule: the Contas confirmation dialog was
   `rounded-medium` against the player card's `rounded-x-large` — same element,
   same `shadow-level-3`, same container colour, a different corner. The dates
   are the whole story: **M4 set the dialog step at x-large on 2026-08-25 and
   the Contas dialog was written at `medium` two days later.** So this is not an
   old inconsistency the scale inherited; it is the drift this very item names,
   recurring *after* the scale was adopted and *because* nothing was written
   down. It is corrected here, which is the one pixel this item moves.

   *"Step-down by nesting depth"* is not the rule either, and writing it as
   stated would have documented something false. **A step is chosen by what the
   thing is** — marks and inline targets x-small, panels and banners small, a
   modal `<dialog>` x-large, an MD3 pill control `full`. A mark inside a card
   does sit a step below the card, but that falls out of the assignment rather
   than being a rule, and as a rule it gives the wrong answer the first time
   something nests two deep. `medium` holds only the player card's photograph;
   **`large` is used nowhere**, which is a fact about the app rather than a gap
   to fill.

   **The half a test can hold is not "which step" but "do they agree".** No gate
   can know the right step — `design-tokens-core.test.ts` keeps the vocabulary
   and stops there — so `tests/e2e/contas.spec.ts` opens both dialogs and
   asserts one radius equals the other, reading the value rather than pinning
   it, so the spec survives the step moving. Confirmed against the shipped
   drift: `Expected "12px", Received "28px"`.
8. ~~**A name filter on Jogadores.**~~ **Shipped**, and with it the whole "Now"
   list. `filterSquads` and `foldForSearch` in `squad-core.ts`, a `type="search"`
   box above the panels, no route change and no request.

   **The fold is not `slugify`, and one real name decides it.** The obvious
   reuse is the normaliser `venue-core.ts` shares with `club-core.ts` — but
   `slugify` turns punctuation into a **hyphen**, which is right for an address
   and wrong for substring matching: the division carries `Ariel Sant'Anna`, and
   `santanna` does not occur in `ariel-sant-anna`. Measured across all 948
   names, punctuation appears in exactly one, so the rule is written for a real
   case rather than a hypothetical. Punctuation is **dropped** rather than
   spaced — run both ways against that name, dropping wins four queries to
   three — and **spaces survive**, so a match cannot straddle two words and
   `Carlos Antonio` does not answer to `osan`. Accent folding also absorbs an
   upstream defect for free: the seed carries `Joāo Paulo` with a macron where
   the name has a tilde.

   **The `<details>` key carries the query, and that is not a tidy-up.** React
   holds the `open` prop across renders, so a reader who filters, closes one
   panel, then edits the query leaves that club shut while it now matches
   something else — React sees no change and never touches the DOM. Measured:
   11 of 12 open, and 12 of 12 once the key carries the query. It remounts on
   every keystroke, which was measured before being chosen — **20ms per
   keystroke over 948 players**.

   **One spec skipped itself at first, which is how a spec stops running.** The
   closed-panel case needed two matching clubs and asked `test.skip` for them;
   it reported "1 skipped", which nobody reads. It now shortens a real player's
   name until two clubs match. Both behaviours were then confirmed by mutation —
   key without the query, and `open` never forced — one property at a time.

**Next — one decision each, stated in the proposal.**

9. ~~**Distinguish the leader.**~~ **Shipped**, and it spends `tertiary` — the
   role the note below this list says to pick up here rather than give an item
   of its own. The leader's position number sits in a filled disc with " —
   líder" as `sr-only`; nothing else is tiered, for the reason the item gives.

   **`tertiary-container` is the obvious fill and it is invisible.** MD3 uses
   the `-container` role for a filled badge, and against `surface` it measures
   **1.23:1 on light** and 2.00 on dark — a disc carrying hue and nothing else,
   which is the single-channel encoding the G4/Z4 legend exists to correct one
   column away. The solid role is 6.11 and 10.96, past the 3:1 non-text floor,
   so the *shape* survives grayscale and colour-blindness. Confirmed by looking
   at a grayscale render, not only by the numbers.

   **The gate could not previously ask that question, and now can.** Every
   pairing it held was text on a background, so a fill was only ever checked as
   somebody's *background*, never as a foreground of its own — a mark whose ink
   is perfectly legible can still be invisible, because what makes a mark a mark
   is its edge against the page. `markPairings` adds fill-on-page at the 3:1
   floor for all four roles; 70 pairings became 86. Verified by pointing it at
   the container and watching it refuse: `1.23:1 (needs 3)`.

   **The existing suite caught every consequence of getting the size wrong**,
   which is worth recording as a vote of confidence in those specs. A 24px disc
   pushed the frozen `#` column from 48px to 50 and the leader's row from 37px
   to 41, and four specs went red at once: the positions list, both frozen-column
   invariants, and *no club name wraps to a second line*. A 20px disc restores
   all four. Nothing was re-baselined.

   One spec did have to move: `numbers positions 1 through 20 in order` compared
   the cell's whole text, which is now `1 — líder`. **Hidden text is still
   text** — the third instance, after the forma pills and the club name that
   became a link. It strips `.sr-only` before comparing rather than trimming a
   known suffix, so the wording can change without it.
10. ~~**Forma in the classificação.**~~ **Shipped — but not as a column, because
    there is no width for one.** The mark column now shows either the campanha
    or the forma, chosen by a button above the table.

    **The measurement is what decided it.** At desktop the table is 734px inside
    a 734px container — no surplus at all. An eleventh column of five 28px pills
    (the club page's size) overflowed by **22px**; at 20px it fitted but took
    **154px** out of the tallies, and on a phone the horizontal scroll would
    have grown from 362px to ~520px. Sharing the existing column costs nothing:
    zero overflow in both modes, and the phone scroll is unchanged.

    **The proposal's answer was `hidden md:table-cell`, "following the campanha
    column's own precedent" — and no such precedent exists.** `showCampaign` is
    `lastRound > 0`, a *data* condition; no column in this table hides by
    viewport. It would also have been aimed at the wrong end: it is desktop that
    has no room, not mobile, and hiding on a phone means the data is
    unreachable where scrolling means it is not.

    **It is a second preference, not a third `CampaignPlotKind`.** #235 made the
    plot kind global — one mark across the Classificação, the Clube page and the
    Partida page — so folding "forma" in would put pill strips on the club page
    directly above its own **Últimos resultados**: the same five results twice.
    Two questions, two lifetimes, two keys; when the column shows the campanha
    the plot kind still decides its mark, so the choices compose. A spec asserts
    the club page still draws a campanha while the table shows the forma.

    `FormPill` moved out of `ClubView` at its second call site, which is what it
    was shaped for in item 6 — the Classificação relocated a function rather
    than reconstructing a pill and inheriting the `title`-only naming item 6
    fixed. Its `row` size (16px against the page's 28px) is `RankSparkline`'s
    own row/page precedent: the same mark at two sizes is fine, a width that
    *follows the viewport* is not.
11. ~~**Casa / Fora split.**~~ **Shipped.** `computeStandings` takes a
    `StandingsSide`, a segmented control sits above the table, and all three
    views come from the one fixture list — never from upstream's `HOME`/`AWAY`
    groups, for the documented reason: the provider counts `IN_PLAY` and this
    app does not, so mixing sources puts a contradiction one button-press away.
    A unit test asserts casa + fora = completa club by club and field by field,
    which is what makes the three one answer rather than three.

    **Two things the split breaks that the item does not mention, both visible
    the moment it rendered.** A split has no *líder* — position 1 of the Casa
    table is the best host — so the leader disc is suppressed. And both marks
    the column can hold are **whole-season** facts, a campanha being a
    trajectory through the real table and a forma the last five wherever they
    were played; beside home-only tallies each describes a different table from
    the row it sits in, which is the same contradiction one layer down. The mark
    column and its controls are hidden in a split.

    **The control is a segmented button, the app's first**, written as its own
    component rather than folded into `Button`: that component's variants are a
    single control's shape, where a segment needs a shared outline, collapsed
    inner borders and end caps that only mean anything as a group. It is a
    `radiogroup` — the choices are mutually exclusive and exactly one is always
    on, which is a radio's contract and not a button's, and it brings arrow-key
    selection for nothing.

    **The choice is deliberately not persisted**, unlike the theme and the mark
    kind. Those are how a reader likes the page drawn; this is a question asked
    of one table and then done with, and a reader arriving at the Classificação
    expects the Classificação.
12. ~~**Derived league statistics.**~~ **Shipped** as **Números da temporada**,
    beneath the Classificação: gols, gols por jogo, vitórias do mandante, and
    the two leaderboards. `league-stats-core.ts`, every figure a reduction over
    data the client already holds.

    **Not a sixth `NAV_ITEMS` entry**, and a spec asserts the bar still has
    five — the item is right that nothing in the tooling would tell you, so the
    refusal is written as a test rather than left to review.

    **Two absence-is-not-zero traps, and the second is the sharper one.**
    Averages divide by matches *finished*, never the 380 a season schedules —
    the prototype divides by the fixture count and is wrong every week but the
    last. And a club with **no match played is left out of the leaderboards**
    rather than ranked: it has conceded none, so it would *lead* the meanest
    defence on no evidence, which unlike a blank average looks like an answer.

    **One naming collision the glossary caught.** The proposal calls the
    home-win share "aproveitamento dos mandantes"; **Aproveitamento** is already
    a defined term here meaning points taken over points available, so it ships
    as **Vitórias do mandante**. That is what `CONTEXT.md` is for, and the
    `_Avoid_` line records it.

    Specs address the figures by `data-figure` rather than regexing rendered
    prose — a spec that breaks on a decimal comma is a spec that gets deleted.
13. ~~**Inset the scoreline.**~~ **Shipped — but not on `surface-dim`, which
    this palette cannot carry.** The item names the token; the gate refused it.

    `surface-dim` was emitted at MD3's own tones (dark 6, light 87) and
    `npm run test:tokens` failed at once: on light, `ink-faint` measured
    **3.83:1** against a 4.5 floor and `ink-ghost` **2.69:1** against 3. That is
    not a near miss to tune away. Tone by tone from 87 to 93, the faintest ink
    reached only **4.49** at the lightest candidate — still short — by which
    point the tray had faded to **1.08** against the card. **No tone exists that
    this palette's inks can sit on and that still reads as a tray.** The cause is
    structural: every ink is swept against every background, and `ink-faint` on
    `surface-container` already clears by 0.09, so nothing dimmer fits beneath it.

    **Elevation is the way through, and it is MD3's own model rather than a
    workaround.** The tray is *lower* than the card, and a lower surface is
    darker on dark and brighter on light — so `surface-container-lowest` gives a
    genuinely inset well on dark (tone 4 against the card's 10) and a bright
    recess on light (100 against 96), which is the light-theme convention
    anyway. Every ink is **better** on it than on the card in both themes (3.75
    vs 3.39 light, 4.30 vs 3.81 dark), so unlike `surface-dim` it cannot
    introduce a failure — and it is added to the gate's background list, which
    now has four.

    **The specs assert the difference, not the colour**: the tray's background
    is compared against the card's rather than pinned, so a palette
    regeneration cannot break them, and a second spec asserts the direction
    reverses between themes — which is what catches a token that happens to
    differ on one theme and match on the other.
14. ~~**Say the zone on the row, not only in the key.**~~ **Shipped.** An
    `sr-only` span in the position cell, beside the number rather than replacing
    it, naming the band off `ZONES` — `Libertadores`, `Pré-Libertadores`,
    `Sul-Americana`, `Rebaixamento` — and saying nothing at all for 12th to
    16th, where silence is the correct announcement. It names the zone and never
    the rule: the key says "as quatro primeiras posições" once, and a row that
    repeated it would say it four times running.

    **It also uncovered a defect #248 shipped, which is the more useful half.**
    Casa and Fora re-rank the table against a subset of the fixtures, so
    position 4 of the Casa table is the fourth-best host and not a Libertadores
    place — and the rail went on painting it green while the key went on saying
    so beneath. #248 suppressed the leader disc and the mark column for exactly
    this reason and missed the two marks that state the bands outright. Saying
    the zone aloud would have announced the falsehood fifteen times per view,
    which is how it surfaced.

    **The rule, restated because asking three of five is how the wrong two
    survive: when a view narrows what counts, every derived mark on the row has
    to be re-asked whether it narrowed too.**

    One testing note. The zone rides in an absolutely positioned `sr-only` span,
    and `innerText` inserts a space at that boundary — `"2 , Libertadores"` —
    which is a rendering artefact rather than the markup. The DOM is
    `2<span class="sr-only">, Libertadores</span>` and `textContent` reads
    `"2, Libertadores"`. Assert on `textContent`; it is the mirror of the
    `toHaveText` trap, which reads textContent and so misses a CSS `uppercase`.

**Alongside**: `--color-tertiary` and `--color-tertiary-container` are emitted into
all three theme blocks and referenced by **zero** components. The accent is already
generated, toned and contrast-checked; it has simply never been spent. Pick it up
with item 9 rather than giving it an item of its own.

**Explicitly not doing**, each with the reason in the proposal: lance a lance and
match statistics (no reachable source carries possession or shot counts);
título/Z4 probabilities as the prototype presents them; the localStorage
image-URL manager (the inverse of the vendoring-with-attribution rule); the
webfont pair; the hand-picked hexes; club-brand colours; the desktop sidebar.

**Two of those were struck on a premise that turned out to be false, and the
correction is worth more than the items.** The list read "lance a lance,
escalações and match statistics (no reachable tier carries them)", and the
proposal's §1 expands it: a football-data match object carries no events and no
lineups "at any tier this app can reach", so *"do not build these until a
provider that carries them is adopted, which is a cost decision"*.

Every word of that is true **about football-data** — re-verified against a live
Série A match and a live Premier League one, both free TIER_ONE, both answering
200 with no `goals` key at all. What was wrong was the generalisation from *that
provider* to *every reachable source*. CBF — already adopted here, already
synced from for `broadcasts.ts` and `venues.ts` — carries goals, both starting
elevens and substitutions on `/api/cbf/jogos/{id_jogo}`, an endpoint nobody had
looked at because the CBF survey stopped at the broadcast page. The condition
the proposal set was satisfiable for free.

**Goals shipped on the back of that** — `goals-core.ts`, `scripts/sync-goals.ts`,
`src/data/goals.ts`, and the scorers under the Partida page's scoreline.
**Escalações did not**, and are no longer on this list in either direction: the
data exists, so the reason for refusing them has to be a UI one now, argued on
its own merits, rather than an inherited claim about what is available.

The shape of the error is the one `CLAUDE.md` names under *check the prompt that
sent you*: a claim that produces no work when it holds is never exercised. "No
provider carries this" is self-sealing — believing it means never looking again,
so nothing can ever contradict it. It survived because it was **true when
written and about the right provider**, which is the hardest kind to catch.

## Contas — what Phase 1 leaves outstanding

Phase 1 ships sign-in with Google, sessions in SQLite, `/entrar`, `/conta`, and
the rule that the whole feature is absent unless the host is configured for it.
What follows is everything flagged while building it and not done, recorded here
rather than left in a pull-request thread.

**On the host, before accounts do anything.** Nothing in the code waits on any of
these — it deploys and behaves exactly as it did before.

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` into the host's `.env`. Note
  `02_create_env.sh` rewrites the **whole** file after a confirm, so the same run
  must re-enter `FOOTBALL_DATA_TOKEN` or the site drops to seed data.
- Google Auth Platform → **Público-alvo**: add a test user, or publish. While the
  client is in *Testing* with no test users, every sign-in returns "acesso
  bloqueado" — which looks exactly like a bug in the code, and is the most
  likely first hour lost.
- **Confirm the host's exact Node.** `01_setup_app_directory.sh` now pins major
  **22**, which is enough — but `node:sqlite` arrived in **22.5**, so a host
  sitting on 22.0–22.4 satisfies the pin and still has no store. The code
  degrades rather than crashing (`openStore` loads it through `createRequire`
  precisely so such a host boots with accounts simply absent), so this is a
  check for the day accounts are switched on, never a deploy blocker.
- **One manual pass of the Google round trip.** CI cannot cover it: it needs a
  secret and a network, and CI has neither by design. Verify once against the
  deployed host and record it in the runbook, the way the live provider path was.

**Phase 2 — three of five done.**

- ~~`/privacidade`~~ — **done.** Public and indexable, unlike the account pages,
  and in the sitemap because the only links to it sit on two pages a crawler is
  told not to fetch.
- ~~The preferences table and the merge that gives it a caller~~ — **done.**
  *Meu time* now follows the account between aparelhos. The merge is **not**
  last-write-wins, which §4 sketched; the argument for the simpler rule is in
  `preferences-core.ts` beside `planSync` and summarised in `CLAUDE.md`.
- ~~Session pruning on a schedule~~ — **done.** Hourly, and once at boot.
- ~~Backups~~ — **done, and verified end to end on 2026-08-27.**
  `09_backup_accounts.sh`, `10_restore_accounts.sh` and the timer in
  `11_install_backup_timer.sh` ship, and `scripts/rehearse-accounts-backup.sh`
  drives the round trip in 23 cases — real SQLite, real `VACUUM INTO`, real
  integrity check, rows counted at both ends. It caught three real bugs in
  scripts that read as correct, which is the argument for having it.
  The half it **could not** prove — `aws` is stubbed there — has now been proven
  against the real account: a throwaway database on the host, the service run,
  and the resulting object **pulled back down and opened** (integrity ok, schema
  v2, the planted row present), then the probe removed from host and bucket. The
  timer is enabled on `i-03a9afc8a469edc89`, next 04:17 UTC, running as `ubuntu`.
  So this is no longer the reason accounts should stay off. What remains before
  switching them on is the Google side only: the two credentials on the host, a
  test user under **Público-alvo**, and one manual sign-in.
- **The retention promise, or its removal from the notice.** An unenforced
  retention promise is worse than no promise. The notice as shipped makes **no**
  retention claim, so nothing is currently false; adding one means implementing
  it in the same commit.

**Screenshots.** The top app bar gained a control, so the advisory job is red and
should be. But that control is invisible until a host is configured, so a refresh
today photographs no change at all — take it after the credentials are live, not
after the merge.

**One rule to follow rather than an item to do.** Every string that puts a
preposition in front of a club name goes through `club-core.ts`, whose article
table is **exhaustive over `src/data/clubs.ts`** — a club with no entry fails the
build until somebody writes its article down, the way `NATIONALITY_LABELS` works
over `squads.ts`. That landed after this section was first drafted, and it is
worth knowing before writing any Phase 2 copy: `/privacidade` and the account
pages will want "a sua conta", not a club name, but the moment anything says
"do <clube>" it belongs in that helper and not in a template literal.

## From the club-article fix

[#101](https://github.com/mpbarbosa/portal_brasileirao/pull/101) made the
**Artigo do clube** a table exhaustive over `src/data/clubs.ts` and moved it to
`club-core.ts`, after the first attempt shipped a set of the four exceptions and
a silent masculine default — which could catch a *known* feminine club being
promoted and not an unknown one. Four things it did not close. None of them is
red anywhere, which is the only reason they are written down.

1. **Coverage stops at the snapshot, and no test can extend it.** The
   exhaustiveness guard runs over `CLUBS`, so it bites at `sync-seed-data` and
   nowhere else. Upstream already names clubs the seed does not — that is why
   `/api/matches` ships the clubs it saw — and one of those falls through to "o"
   with nothing to say so. A live test cannot close it: CI has no network by
   design, and adding one would trade a red build that always means the code
   broke for one that sometimes means the upstream had a bad minute. The place
   that *can* is `scripts/sync-seed-data.ts`, which runs on a workstation at the
   exact moment the division changes: have it refuse, or at least warn, when it
   writes a club `hasClubArticle` does not know. That is the same shape as the
   generator's existing duplicate-slug check.

2. **Only *de* is contracted.** `ofClub` returns "do"/"da" and nothing else,
   because that is what all four call sites needed. pt-BR contracts three more
   prepositions with the article — em → "no"/"na", a → "ao"/"à", por →
   "pelo"/"pela" — so the first line of copy reading "no Flamengo" or "pela
   Chapecoense" will hand-write the article again, which is precisely how it came
   to be wrong in four files at once. Extend the module rather than inlining at
   the call site — which is the same rule **Contas** states just above, from the
   other side. The *un*contracted case already has its answer: `clubArticle`
   returns the bare word, which is what "contra a Chapecoense" and the **Meu
   time** control both want.

3. **A `Screenshots-unaffected:` trailer outside the last paragraph is not a
   trailer.** Git's trailer block is the final paragraph of the message only, so
   one sitting in its own paragraph above `Co-Authored-By:` is body prose:
   `git interpret-trailers --parse` returns nothing for it and
   `check-screenshots.sh` reports the commit as unaccounted while a correct,
   specific reason sits six lines up in the same message. Cost was a red advisory
   job, an amend and a force-push. The script already prints the trailer's syntax
   on failure; what it cannot currently say is *this*. It reads only the parsed
   side, through `%(trailers:key=…)`, so an unparsed claim is indistinguishable
   from no claim at all — but a second `--format=%B` over the same commits would
   separate them, and a line present in the message and absent from the trailers
   is exactly the case worth naming instead of printing the generic how-to at
   somebody who has already followed it. Worth stating in the help text either
   way: continuation lines must be **indented**, and the block must be last.

4. **A spec keyed on which club sorts first.** `tests/e2e/players.spec.ts`
   selected the club link by `/^Ver a página do/`. The "do" was never a fact
   about the page — it was Athletico-PR happening to sort first in the snapshot,
   and a promoted Portuguesa would have turned that locator red on a change that
   had nothing to do with it. `CLAUDE.md` already carries "assert shape, not
   value" for rounds and scorelines; this is the same rule applied to **copy that
   varies by club**, which was not on the list. No sweep has been done for
   others.

## From the account-store test fix

[#113](https://github.com/mpbarbosa/portal_brasileirao/pull/113) made
`an unopenable path is null, not a throw` provoke its failure with a **regular
file standing where a directory has to be**, after it had used a merely missing
one. A missing directory is the one case `openStore` is built to survive — it
mkdirs deliberately, for `${DEPLOY_DIR}/data` before the first deploy (§3.2) and
`./test-results` before Playwright runs (§3.11) — so the old assertion was
unopenable only for a uid that cannot mkdir at `/`. It passed on CI's
unprivileged runner and failed in a root container. Three things it did not
close. None of them is red anywhere, which is the only reason they are written
down.

1. **The rule it followed is not written down anywhere.** `CLAUDE.md` carries
   "assert shape, not value" for rounds and scorelines, and the club-article
   section above adds the same rule for **copy that varies by club**. Neither
   covers this one: *a test that provokes a failure must provoke it the same way
   for every uid.* The sweep was done rather than assumed — only two test files
   touch the real filesystem, `check-screenshots.test.ts` builds histories rather
   than provoking failures, and the full suite is 558/558 at uid 0 **and** at uid
   1000. So there is no second instance today and the gap is entirely
   prospective; it bites on the next test that reaches for a path it expects to
   be unopenable. The distinction worth recording beside the rule is the
   mechanism, because it is not obvious: resolving a path *through* a regular
   file is `ENOTDIR` for every uid, while a permission failure is not — root's
   `CAP_DAC_OVERRIDE` relaxes permission checks and does not relax path
   resolution. Naming the file directly as the parent is a third thing again
   (`EEXIST`, out of Node's own recursive-mkdir bookkeeping) and a weaker thing
   to rest a guarantee on.

2. **CI cannot go red on this class, by construction.** The runner is
   unprivileged, so a uid-dependent test passes there and fails only on the
   machine of whoever is developing in a root container — the reverse of the
   usual asymmetry, where CI is the strict one and the workstation is lax. That
   is what makes the class worth naming at all: the normal safety net is the part
   that cannot see it. A second unit-test job running the suite as `-u 0` would
   close it, and it is **not** obviously worth doing — it buys one narrow class
   of defect for a whole job, against a class with exactly one known instance,
   now fixed. The cheap half is a one-line check a person can run when writing
   such a test, and it needs no CI change:

   ```sh
   docker run --rm -u 0 -v "$PWD:/app:ro" -w /app node:26-bookworm \
     sh -c 'npm run test:unit'
   ```

   Prefer stating the rule next to that command; revisit the job only if a second
   instance ever appears.

3. **A `Screenshots-unaffected:` trailer on a commit touching no appearance path
   is inert, and nothing says so.** The gate's accounting set is
   `git log "$anchor..HEAD" -- "${SURFACE[@]}"` (`check-screenshots.sh`), and
   `scripts/appearance-paths.txt` names four paths, none of them under `tests/`.
   So the trailer #113 carried — correct, specific, well-formed — was never read,
   and the run was green for a reason unrelated to it. This is the neighbour of
   item 3 in the club-article section, not a repeat of it: that one is a
   *malformed* trailer being reported as absent, this one is a *well-formed*
   trailer with nothing to attach to. It costs nothing today, which is why it is
   a note rather than a task. The risk it carries is a reader learning the
   trailer as "the way to keep the advisory job green" and reaching for it on
   commits that never needed one — or concluding from a green run that their
   trailer was accepted, when the paths were doing the work.

## Constraints that must survive any redesign

Recorded here because they are easy to undo by accident:

1. **Contrast is measured, not eyeballed.** Every text token clears AA. A
   redesign that ships a token without checking it is a regression even if it
   looks fine on the designer's monitor.
2. **The theme is chosen before first paint** by an inline script in
   `index.html`. Any theming change must keep that, or the page flashes.
3. **Copy is Brazilian Portuguese** in the football-broadcast voice, and
   `CONTEXT.md` is the glossary. New concepts get an entry in the same commit.
4. **No runtime dependency on a third party for assets.** Crests come from the
   provider; broadcaster marks are served from our own origin precisely because
   hotlinking Commons earns a 429. Stadium photographs briefly shipped hotlinked
   and were vendored into `public/stadiums/` by `npm run sync-stadium-photos`;
   the principle has no exceptions again.
5. **CI needs no secrets.** Do not add a provider token to test "the live path".

---

# Migrating to Material Design 3

**Complete, and deployed.** All six phases shipped between M0 and NavBar; the
plan below is kept as written, with each phase carrying a note on what it
actually did and what it cost. Where a phase departed from this plan — and
several did — the departure and its reason sit under that phase rather than
being edited out, because the reasoning is the part worth keeping.

**Three things it did that were not on the plan**, each an accessibility gap
that no test in the suite would have failed on:

1. The app had **no focus styles at all** — no `focus:`, no `focus-visible:`, no
   ring anywhere. Found in M2.
2. The player card was **modal in name only**: it carried `aria-modal="true"`
   while Tab walked straight out of it. Fixed in M4.
3. **`prefers-reduced-motion` was honoured nowhere.** That gap *grew* during the
   migration rather than shrinking — M2 added state layers and M4 added a
   dialog, both motion, while nothing checked the preference. Closed in M5.

**One documentation gap it exposed and did not close.** Every image in the
README is a 960px capture, which is above the `sm` breakpoint — so the
migration's single most visible change, a navigation bar replacing a hamburger
below that width, appears in none of them. Whether the README documents one
viewport or two is a product question, not a bug.

## The decision that comes first

"Adopting MD3" can mean two quite different things, and they have very different
costs here:

**A. MD3 as a design system.** Adopt its colour roles, tonal palettes, shape
scale, elevation model, state layers and type scale — expressed as our own
tokens, still rendered by Tailwind. No new runtime dependency.

**B. MD3 as a component library.** Add `@material/web` (Google's own web
components) or MUI, and rebuild the UI on their components.

**Recommendation: A, with B considered only for the player dialog.**

The reasoning is specific to this project rather than a general preference:

- The hard part of MD3 is its colour system, and this app already has the shape
  of one — 64 semantic tokens, no raw palette shades in components, two themes
  driven by the same names. Mapping those to MD3 roles is a rename plus a
  palette regeneration, not a rewrite.
- The component surface is 12 components, several of which (`StandingsTable`,
  `MatchList`) are domain-specific and have no MD3 counterpart. A library buys
  little and costs a lot.
- The current client bundle is ~231 kB. `@material/web` plus its Sass output
  would be a large fraction of that again, for components we would use once.
- The accessibility work — measured contrast, `role="status"` on the loading
  line, accessible names that do not depend on an image loading — is ours and
  is easy to lose in a port.

Option B is worth revisiting for `PlayerOverlayCard`, where MD3's dialog gets
focus trapping, scrim behaviour and motion right and ours is hand-rolled.

**It was not needed.** M4 rebuilt that card on the browser's own `<dialog>` with
`showModal()`, which supplies the focus trap, `inert` behind, the top layer and
focus restoration — everything the library would have been imported for, at no
bundle cost. So option B was never adopted anywhere, and the app still ships no
UI dependency.

## Phases

Each phase is one pull request, keeps all tests green, and re-measures contrast
before merge. Screenshots in both themes go in the PR so the visual delta is
reviewable rather than described.

### M0 — Decide and pin down (no code)

- Confirm A vs B above.
- Choose the **seed colour**. MD3 generates tonal palettes from one seed; the
  natural candidates are the Brasileirão green, a neutral, or the current
  accent. This is a brand decision, not a technical one, and it determines every
  colour in the app.
- Decide the **typeface question**: MD3 assumes Roboto/Roboto Flex. Self-hosting
  a variable font costs ~100 kB and a render-blocking decision; the system stack
  costs nothing and is what ships today. These are separable — the type *scale*
  can be adopted without the typeface.
- Write down what "done" means: contrast at least as good as today, no bundle
  regression beyond an agreed budget, all 283 end-to-end tests green.

**Exit criteria:** the seed colour and typeface decision are recorded in
`CONTEXT.md`.

**Decided, 2026-08-25:**

- **A, not B.** MD3 as a design system in our own tokens. No new runtime
  dependency; the generator runs on a workstation and commits hexes. Confirmed
  by the measured result — the client bundle is unchanged at 231.35 kB.
- **Seed: `#10b981`**, the emerald the app already used as its accent. Recorded
  in `CONTEXT.md` under **Semente**.
- **Bundle budget:** no JS increase at all. CSS may grow by the size of the role
  vocabulary; M1 spent 1.83 kB raw / 0.41 kB gzipped, part of which returns in
  M2 when the legacy aliases are deleted.
- **Typeface: the system stack.** Decided 2026-08-25, at the start of M3. No
  webfont is shipped; the app keeps Tailwind's default `--font-sans` and each
  platform renders in its own UI face.

  The reasoning is specific to this app rather than a general preference.
  A subsetted Roboto Flex is roughly 40–100 kB, which would be the single
  largest asset on a page whose whole value is glancing at a score, often on
  mobile data mid-match. **Roboto is already fourth in the default stack**, so
  Android — the dominant platform for a Brazilian football app — renders in
  MD3's own typeface at zero cost. And pt-BR strings run long: "Melhores
  momentos" and "Onde assistir" already sit close to their containers on
  mobile, so a swap that changes metrics risks reflowing exactly the strings
  with least room.

  What is given up: MD3's letter-spacing values are tuned for Roboto and are
  marginally off on SF Pro and Segoe UI, and line lengths vary a little by
  platform. Revisit only if the app gains a brand identity that needs a
  specific face — this is a brand decision, not a technical one, and the type
  *scale* below is unaffected either way.

### M1 — Colour roles and tonal palettes — **done**

The largest phase, and the one that carries the most value.

Implemented by `scripts/md3-color-core.ts` (HCT: the CAM16 transform and the
gamut solver) and `scripts/generate-md3-tokens.ts` (palettes, role mapping,
contrast gate). Regenerate with `npm run sync-md3-tokens`; verify with
`npm run test:tokens`, which fails if `src/index.css` has drifted from the
generator or if any pairing falls below its floor.

Two departures from a naive reading of the spec, both deliberate:

- **The neutral palettes do not follow the seed.** MD3 derives neutrals from the
  seed hue, which here would tint every surface green — a *larger* change than
  the migration was asked to make, since the app's surfaces are slate and the
  seed is 90 degrees away. The neutral hue is pinned to the existing slate;
  Material's own `DynamicScheme` accepts explicit neutral palettes, so this is a
  supported configuration rather than a departure from the system.
- **`surface` is not emitted under its MD3 name.** MD3 spells the page
  `surface`; this codebase spells the page `canvas` and a *card* `surface`.
  Emitting both would declare `--color-surface` twice and leave the winner to
  source order. `canvas` carries the role until M2 renames the call sites, which
  keeps M1's promise that no component changes in the phase that changes colour.

- Generate tonal palettes (0–100) from the seed.
- Introduce MD3 role tokens: `primary`/`on-primary`/`primary-container`,
  `surface` and the `surface-container` ladder, `outline`/`outline-variant`,
  `error`, and their `on-` pairs.
- Map today's tokens onto them rather than replacing them at every call site:
  `canvas` → `surface`, `raised` → `surface-container`, `ink` → `on-surface`,
  `line` → `outline-variant`, `negative` → `error`. Keeping the aliases for one
  phase means components do not change in the same PR that colours do, so a
  visual regression has one obvious cause.
- Re-measure every text pairing. MD3's roles are designed to hit contrast by
  construction, so this should improve on today's worst case of 4.55 — but
  "should" is not "did".

**Risk:** MD3's light and dark schemes are generated, not hand-tuned. The
current light theme was deliberately *not* the dark one inverted — status
colours were darkened to stay readable on a light page. Check that generated
palettes preserve that, and override where they do not.

**How that risk landed.** It was real, and the generated tones did not preserve
it on their own. Light's faint tones had to be pulled darker than the mirrored
dark tones would suggest, because the two themes' backgrounds are not mirror
images: `raised` sits at tone 94 on light but tone 12 on dark, so light has far
less room beneath it before AA fails. Tone 50 measured 3.86:1 against `raised`
and now sits at 45.

The gate also caught a pre-existing hazard rather than one the migration
introduced. The 4.55 worst case recorded above was measured against `canvas`
only, and stated as though it covered everything; light's `ink-faint` on
`bg-raised` sat at about 4.35 and had never been checked.

Be precise about the severity, because it is easy to overstate: that pairing is
**latent, not shipped**. Every `bg-raised` call site pairs with `ink-soft` or
`ink-muted`, and `ink-faint` appears only inside filled surfaces, where
`bg-surface/50` over `canvas` resolves to about 4.64. Nothing renders the
failing combination today.

That makes it worth fixing rather than less so. A latent pairing below AA is a
trap that springs the first time someone puts faint text on a badge, a hover
state or a dialog — and it would ship silently, because a contrast figure
recorded in a comment ages the moment anyone adds a background token. The
generator now tests every text token against all three backgrounds on every
run. **Worst text pairing is 4.59:1, across every pairing it checks, both
themes.**

The theme-invariant tokens survived: `scrim` is MD3's own neutral tone 0, and
the `plate` trio is excluded from the tonal system by name, so the broadcaster
marks still sit on a light backing in both themes.

### M2 — Shape, elevation and state layers — **done**

**Read the gate's margin report before retoning anything.** MD3 expresses
elevation as tonal surface tint, so this phase moves the very surface tones the
text tokens are measured against. `npm run test:tokens` prints the tightest
pairings with their headroom, split into what components actually render and
what is merely latent.

Headroom is the number to read, not the ratio: a text pairing and a graphic
pairing at the same ratio are not equally safe, because their floors differ
(4.5 against 3:1). At the end of M1 the tightest *rendered* pairing is
`light: ink-faint on surface` at **+0.33**; the tightest overall is
`light: ink-faint on raised` at +0.09, but nothing paints it — every
`bg-raised` call site pairs with `ink-soft` or `ink-muted`. Spend the scarce
headroom on the first, not the second.

**Backgrounds are not the same thing as background tokens.** A filled `Surface`
is `bg-surface/50`, so the colour behind a card's text is a composite of
`surface` over `canvas`, and measuring against the solid token measures a colour
the app never paints. The gate composites it (`blend` in `md3-color-core.ts`).
Note the direction of that correction flipped with the migration: the old
palette's `canvas` was lighter than its `surface`, so compositing cost contrast;
under MD3 the page is tone 98 and the card tone 96, so it gains a little. Do not
carry the old intuition forward — `surface/50 over canvas` currently measures
+0.46, safer than the solid token, and that relationship is a property of the
tone ordering rather than a fact about alpha.

- **Shape scale.** Replace the three ad-hoc radii (`rounded-lg`, `rounded-xl`,
  `rounded`) with MD3's extra-small through extra-large tokens. Small surface
  area — about a dozen usages.
- **Elevation.** MD3 expresses elevation as *tonal* surface tint, not shadow.
  This suits the app, which already distinguishes `surface`/`raised` by colour
  rather than shadow, and it is what makes MD3 dark themes legible.

  **Open question: should `Surface`'s filled variant stop being `bg-surface/50`?**
  MD3 encodes elevation in the token, so applying 50% alpha to it halves the
  system's own signal. Worth deciding deliberately rather than inheriting.

  Measure before deciding, because the intuitive argument overstates it. The
  alpha halves the separation in *every* palette — that is what 50% does — so
  this is not something the migration introduced. Tone separation between page
  and card, solid then composited:

  | | solid | after `/50` |
  |---|---|---|
  | MD3 light | −2.06 | −1.01 |
  | pre-migration light | +1.82 | +1.09 |
  | MD3 dark | +4.24 | +2.22 |
  | pre-migration dark | +6.11 | +2.75 |

  Light is essentially unchanged (1.01 against 1.09). The sign flips — MD3's
  card is *darker* than its page, so the composite moves it lighter, toward the
  page — but the magnitude does not. Dark is where MD3 differs: its ladder is
  deliberately tighter, compensated by having more rungs.

  Both palettes landing within a hundredth of one tone unit is the useful part:
  "is one tone unit of separation enough?" was never an MD3 question. The
  migration inherited it, unchanged, from what shipped before. So M2 decides
  this on the merits — there is no previous behaviour worth preserving, and no
  regression to weigh against the elevation model.

  And tone is not the only cue. A filled `Surface` is `rounded-lg border
  border-line` before it is a fill, and MD3 strengthens that border
  considerably — `line` against `canvas` goes from 1.18:1 to **1.62:1** in
  light and 1.38:1 to **1.99:1** in dark. The card reads as a card mostly
  through its outline, which the migration improved by about 40%. So this is a
  design call about honouring the elevation model, not a legibility defect.
  `MatchPage`'s article uses the same 50% fill and should be decided with it.
- **State layers.** The seven hand-written `hover:` utilities become a
  consistent overlay at MD3's prescribed opacities for hover, focus and pressed.
  This fixes a known inconsistency — a stepper with a `transition` its neighbour
  lacks — rather than merely restyling it.

**Exit criteria:** no raw radius or hover colour in any component. **Met** — a
strict grep for Tailwind's own radius names and for `hover:` colours across
`src/**/*.tsx` returns nothing but prose in comments.

**What was decided, and what it cost.**

- **The shape scale was adopted at today's values, not MD3's per-component
  assignments.** Tailwind's `rounded`/`rounded-lg`/`rounded-xl` are 4/8/12px and
  land exactly on MD3's extra-small/small/medium, so all 15 call sites moved with
  no visual change at all. MD3's *assignments* — pill buttons, a 28dp dialog,
  12dp cards — are a separate, visible restyle and remain unadopted. That is a
  deliberate split: the scale is infrastructure, the assignments are design.
- **`Surface`'s filled variant went solid.** `bg-surface/50` was diluting the
  elevation MD3 encodes in the token; the page-to-card separation roughly
  doubles, from about one tone unit to two. The composite disappears from the
  contrast gate with it, though `blend` stays in `md3-color-core.ts` for the
  next translucent fill.
- **The surface ladder took its MD3 names**; `ink` and `line` did not. Renaming
  `ink` alone is 57 call sites and has nothing to do with elevation, so it is a
  separate pass rather than a rider on this one.

**Two things found while doing it, neither of which was on the list.**

The app had **no focus styles at all** — no `focus:`, no `focus-visible:`, no
ring anywhere. Keyboard users got whatever the browser drew. MD3's state layer
model covers focus, so `FOCUS_RING` closes it.

`MatchPage` had **two** panels wearing `Surface`'s chrome by hand, and the
difference between them is the better argument for the exit criterion.

The scoreboard was `rounded-xl` where every `Surface` is `rounded-lg` — visibly
a step off, and the kind of thing review eventually catches. The campanha panel
below it was `rounded-lg`: pixel-identical to the component it duplicated, and
therefore invisible. That is the dangerous one. Copied chrome looks correct on
the day it lands and only separates when the shared component moves — and this
phase is exactly that event. Moving `Surface` onto the shape tokens would have
left the copy behind at the old radius while every real `Surface` advanced.

Both are `<Surface>` now. The `as` matters on the scoreboard: an end-to-end spec
selects `main article`, and a bare div would have matched nothing.

**A verification trap worth recording, because it cost two wrong readings.**
Tailwind's `transition` covers `background-color` *and* `outline-color`. Reading
a computed style immediately after `hover()` or `Tab` samples the animation at
t=0 and reports the *rest* value — which looked exactly like "the state layer
does not work", then like "the focus ring is the wrong colour". Both were the
measurement. Wait out the transition before reading, or the DOM will lie to you
in a way that looks like a CSS bug.

### M3 — Typography — **done**

- Adopt the MD3 type scale (display / headline / title / body / label, each in
  large / medium / small) as tokens.
- Apply per component, checking pt-BR strings specifically: Portuguese runs
  longer than English, and "Onde assistir" and "Melhores momentos" already sit
  close to their containers on mobile.
- Typeface per the M0 decision.

**Exit criteria:** no bare Tailwind text size and no `tracking-*` utility in any
component. **Met** — a strict grep returns nothing.

**Each step carries size, line height and letter spacing together**, so a
component names one thing rather than pairing a size with a leading and hoping
the next component pairs them the same way. That is most of the value: the app
previously wrote `text-sm` and its leading independently at 28 call sites.

**Weight is deliberately not in the scale.** MD3 prescribes 500 for title and
label steps, but this app's headings are bold by choice and flattening them is a
restyle rather than a scale adoption. Components keep their explicit `font-*` —
weight is separable from the scale exactly as the typeface is.

**Four of the seven sizes already matched.** 12, 14, 16 and 24px are MD3's
body-small, body-medium, title-medium and headline-small precisely, the same
coincidence the shape scale had. Three did not exist in MD3 and moved:

| was | now | change |
|---|---|---|
| `text-lg` 18px — player name | `title-large` 22px | +4px |
| `text-xl` 20px — club name | `title-large` 22px | +2px |
| `text-3xl` 30px — the score | `headline-medium` 28px | −2px |

The first two are the point rather than a side effect: the player name and the
club name are the same kind of heading — the entity a detail view is about — and
they were two different sizes. The scale makes them one.

`display-*` and `headline-large` are defined nowhere, following the rule
`Button`'s size list already sets: steps that nothing uses are not written down.

**The pt-BR risk did not materialise.** Measured rather than eyeballed: five
routes in both themes at 375px, checking page scroll width and every element's
own overflow, ignoring `sr-only` (clipped to 1px by design) and `overflow-x`
containers (meant to scroll). Zero page overflow, zero clipped visible text.
Worth keeping the method — the first run reported 40-odd "overflows" that were
entirely screen-reader text and scrollable tables.

### M4 — Components — **done**

In ascending order of risk:

1. **Chips** — broadcaster marks and status badges become MD3 assist chips. The
   plate already behaves like one.
2. **`Button`** — map to MD3's filled / tonal / outlined / text variants. Today
   there is one variant; the round stepper and the highlights links would
   naturally differ.
3. **`Surface`** — becomes an MD3 card, with the elevation from M2.
4. **`NavBar`** — MD3 navigation bar on mobile, navigation rail or tabs on
   desktop. This is the one component whose *structure* changes, and
   `CLAUDE.md` currently promises "NavBar never changes" when a section is
   added — that promise must survive.
5. **`PlayerOverlayCard`** — the candidate for a real MD3 dialog implementation.

**Shapes were adopted only where a component was rebuilt.** The dialog takes
MD3's extra-large corner because it *is* rebuilt; the outlined controls and
`Surface` keep the shape scale they already had. That split is not a
half-measure: a pill sitting against a right-aligned `tabular-nums` column reads
as floating, because the eye takes the pill's widest point as its edge while the
number's edge is the glyph box — and the round stepper and the goals link both
sit against tables. The tonal links sit in open prose, where nothing misaligns.

**1. Chips — done, and it removed a real duplication.** `MatchList` and
`MatchPage` each carried their own copy of the label map *and* the colour map,
identical, five values apiece. `StatusChip` owns both now. Two copies of a lookup
table is how a new status renders in one place and blank in the other.

**Broadcaster marks were deliberately *not* converted.** The roadmap assumed
"the plate already behaves like a chip". It behaves like one superficially and
differs where it matters, and the difference is fatal: a chip takes its container
colour from the tonal system, and `--color-plate` is `#ffffff` in *every* theme
because Globo's circle, the YouTube wordmark and CazéTV are dark artwork on
transparent grounds. On a dark container they do not look worse — they disappear,
silently, with the `img` present and the accessible name correct. The plate is a
background for foreign artwork; a chip is a container for our own content. Kept
as a plate, and verified in a browser in both themes rather than assumed.

**2. Button — two variants, not four.** `outlined` (everything that was there
before) and `tonal`. MD3's *filled*, *elevated* and *text* are absent for the
same reason `ControlSize` is short: nothing renders them, and a variant with no
call site is a guess about the future that later has to be maintained or deleted.

`tonal` went to the one place the app already drew a distinction in prose but not
in pixels — a *curated* highlights link beside the search fallback. The comment
there has always said one is a real answer and the other is a guess; they
rendered identically until M4.

**3. `Surface` — already an MD3 outlined card.** Border plus surface tone at the
shape scale is exactly that. No restyle was invented to fill the item.

**5. The dialog was modal in name only.** It carried `aria-modal="true"` while
Tab walked straight out of it into the page behind. It is now a native
`<dialog>` opened with `showModal()`, which buys a focus trap, `inert` on
everything behind, the top layer, and focus returned to whatever opened it —
each fiddly to hand-roll and easy to get subtly wrong. Body scroll is locked
separately, because modality does not stop the page scrolling behind.

The spec that asserted `aria-modal="true"` now asserts modality instead:
`dialog.matches(":modal")`, and that focusing a control behind the card fails.
That is the same lesson as the focus rings — the old assertion tested the label,
and the label was true while the behaviour was not.

**A bug worth recording, because the cause is not obvious.** The dialog rendered
hard against the left edge on desktop. A native dialog is centred by the user
agent's `dialog { margin: auto }`, and **Tailwind's preflight resets `margin: 0`
on every element**, so that rule never applied. Vertical centring worked because
`my-auto` was set explicitly, which made it look deliberate rather than broken.
Caught by looking at a screenshot, confirmed by reading computed margins, and now
guarded by a spec — no other test in the suite has an opinion about where a
dialog sits.

**4. `NavBar` — done, in its own phase.** The ceiling was settled first and
accepted: MD3's navigation bar carries **3 to 5 destinations**, `NAV_ITEMS` has
three, two more fit, and a sixth wants MD3's navigation *drawer* rather than a
sixth entry. That bound now sits beside the promise in `CLAUDE.md`, described as
what it is — the one constraint in that file no tooling can check.

The hamburger is gone. Below `sm` the three destinations are a navigation bar
fixed to the bottom edge, each an icon above its label, the current one marked by
a pill behind the *icon* rather than a fill behind the whole item. Above `sm`
nothing changed: the destinations stay inline in the header, which is already
MD3's tab arrangement.

This is the phase's real justification rather than spec compliance. **Three links
behind a hamburger is the arrangement the navigation bar pattern exists to
correct** — they were one tap away instead of zero, in the corner furthest from a
thumb.

**The icons live on the `NAV_ITEMS` entry, not in a lookup inside `NavBar`.**
That is what preserves the promise: a lookup keyed by section id would have meant
`NavBar` needing a change the next time someone added a section, quietly
converting the promise into a lie. Three glyphs are drawn in
`src/components/SectionIcons.tsx` rather than pulled from a set — the app ships no
UI dependency and draws its own sparkline already.

**Seven specs' worth of disclosure behaviour was deleted, not rewritten.** The
old tests asserted `aria-expanded`, that Escape closed the panel and restored
focus, that an outside click dismissed it. None of that behaviour exists now, and
rewriting them to click something else would have kept the letter of a contract
whose subject was gone. What survives is the property that mattered — every
section reachable at every width, and the current one saying so — plus a new
guard that exactly *one* presentation of the destinations is visible at a time,
which protects every `getByRole("link")` in the suite from a strict-mode
violation.

Eight spec files carried `if (isCollapsed(page)) await menuToggle(page).click()`
before every navigation. All of it went: destinations are visible at every width,
and Playwright's role selectors already exclude the `display: none` copy.

**The fixed bar needs the page to make room for it.** `pb-28 sm:pb-6` on the
layout wrapper — without it the last row of a twenty-club table sits underneath
the bar, invisible until someone scrolls to the very end, which is exactly when
nobody is looking. Verified by measurement: last row bottom 699, bar top 739.

### M5 — Motion — **done**

- MD3 easing and duration tokens for the theme toggle, dialog and round changes.
- Honour `prefers-reduced-motion`, which the app does not currently check.

**Two curves and two durations, not the whole scale.** MD3 defines four
durations in each of four bands and half a dozen easings; the app uses
`standard` for small frequent changes and `emphasized-decelerate` for the dialog
arriving. The rest are omitted for the same reason `ControlSize` is short.

**`transition` was redefined rather than annotated.** Overriding
`--default-transition-duration` and `--default-transition-timing-function` makes
a bare `transition` *mean* MD3 standard, so no call site repeats the pair and
none can drift from the others.

That was not the first attempt, and the first one failed silently. **Tailwind v4
has no `--duration-*` utility namespace**, so `duration-short-4` compiled to
nothing at all: the class sat in three call sites looking correct while every
transition kept the framework's 150ms default. Nothing would have caught it —
the CSS was valid, the build was clean, and no test watches things move. The
tokens are still real custom properties, which is why the hand-written dialog
animation can reference them; only the *utility* does not exist.

**`prefers-reduced-motion` is honoured for the first time.** The gap mattered
more than when the roadmap was written, because M2 and M4 both *added* motion —
state layers and a dialog — so it widened while nothing flagged it.

Near-zero rather than `none`: a 0.01ms duration still fires `transitionend`, so
anything waiting on that event keeps working. Colour feedback deliberately
survives; only movement stops. A control that stops reacting to hover and focus
is harder to use, not calmer, and that is asserted rather than assumed.

**`tests/e2e/motion.spec.ts` asserts both directions**, because a test for only
the reduced case would pass on an app with no motion at all. One trap found
writing it: `test.use({ reducedMotion })` in a *nested* describe silently did not
apply, and the page kept reporting `no-preference` — which reads as "reduced
motion is broken" rather than "the test never enabled it". Uses
`page.emulateMedia` with an assertion that the emulation took effect.

**A miss from M3, found here and fixed.** `BACK_LINK` in `interaction.ts` still
carried `text-sm`. M3's exit-criteria grep was scoped to `*.tsx`, and that file
is `.ts` — so "no bare Tailwind text size in any component" was true of every
component and not of the module three of them share. Same pixel size, missing
tracking, which is why it looked right. **Check `--include='*.ts'` too.**

## What this does not change

Data, routing, caching, the provider integration, the deploy pipeline, and every
`*-core.ts` module. The migration is confined to `src/index.css` and
`src/components/`, which is the strongest argument that it is safe to attempt
incrementally — and the reason each phase can ship on its own.

## Open questions — answered, except one

- ~~Does the seed colour come from the competition, the app's own identity, or
  stay neutral?~~ **The app's own identity.** `#10b981`, the emerald already in
  use, so the migration re-derived the palette the reader knew rather than
  rebranding underneath them. Recorded in M0.
- ~~Is a bundle increase acceptable at all?~~ **None was needed.** JS did not
  grow at any phase. HCT is implemented in-repo, the icons are drawn in-repo, and
  the dialog uses the browser's own `<dialog>` — each a place a dependency would
  normally arrive. CSS is up about 4 kB raw for the token vocabulary.
- **Still open: MD3 dynamic colour** — a palette derived from the club being
  viewed. Not attempted, and the argument against is unchanged: this is a
  scoreboard people scan in seconds, and a palette that shifts per club trades
  recognition for novelty. The machinery would be cheap now that
  `md3-color-core.ts` exists, which is exactly why it deserves a deliberate no
  rather than a drift into yes.

## What is left

**The standard is not finished; this migration is.**
`docs/md3-completion-plan.md` continues the numbering as M6–M9: the alias
vocabulary M2 deferred (57 `ink` call sites then, 186 across the whole alias set
now), the elevation half M2 has in its own title and did not build, an
enforcement gate for the conventions M2–M4 introduced and nothing checks, and the
components MD3 specifies that this app draws by hand. It re-opens none of M0–M5.

Nothing in this migration. Everything still outstanding is written up where it
belongs and is deliberately **not** restated here — this is an index of the
sections, not a copy of them:

- **Near term**
- **The deploy pipeline — what is still open**
- **From the Brasileirão Pro import**
- **Contas — what Phase 1 leaves outstanding**
- **From the club-article fix**
- **From the account-store test fix**

No count is given for any of them, on purpose: a number here is a second copy of
something four hundred lines away, and it is wrong the first time anybody adds an
item. The index itself is still hand-kept and nothing checks it, so **add a line
here when you add a section there** — this list was one short within the hour it
was written. **From the club-article fix** is the one to read before writing a
sentence with a club's name in it; it and **From the account-store test fix**
hold half each of what there is to know about a `Screenshots-unaffected:`
trailer — a malformed one, and a well-formed one with nothing to attach to.
Named rather than pointed at by position: this sentence said "the last entry"
until a section was appended after it, at which point it silently meant the
wrong one.

This line used to enumerate Near term as "the highlights backfill and the weekly
broadcast sync". That was two bullets behind within a day of the list growing,
and would have gone stale again on the next one: a summary standing three feet
from the list it summarises is a hand-kept second copy, and nothing can tell you
it has drifted. Do not re-add one.

It also sent the reader to "the README viewport question noted at the top of this
section", which never resolved — that note has sat at the **end** of
**Constraints that must survive any redesign** since both were written in the
same commit. It is still open, and still a product decision rather than work:
every README image is a 960px capture, above the `sm` breakpoint, so the
navigation bar that replaced the hamburger below that width appears in none of
them.
