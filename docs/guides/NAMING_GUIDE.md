# Naming Guide

Adapted for Portal Brasileirão from `doc_template_lib/code_quality/NAMING_GUIDE.md`.

## Goal

A name should be readable cold. This project has an unusual constraint the
generic rule cannot anticipate: it is **bilingual by layer**, and getting the
boundary wrong is the commonest naming mistake here.

## The bilingual rule

| What | Language | Examples |
| --- | --- | --- |
| Domain nouns — the things the app is about | **pt-BR** | rodada, campanha, escalação, acontecimento, súmula, artilharia, painel, velas, mandantes, saldo |
| User-facing copy, in the football-broadcast voice | **pt-BR** | "Bola rolando", "A realizar", "Começa em 20h37" |
| Routes and slugs | **pt-BR** | `/clube/`, `/partida/`, `/jogos/`, `/estadio/`, `/painel/`, `/jogadores/`, `/trafego` |
| Code identifiers — functions, types, parameters | **English** | `computeStandings`, `clubFocus`, `liveBoard`, `countsTowardStandings` |
| Provider fields, kept verbatim | **as received** | `fullTime.home`, `reserva`, `entrou_jogando`, `tempo_jogo` |

So `computeRankCandles` computes the **velas**, `SeasonEvents` renders the
**Acontecimentos**, and `LINEUPS` holds the **escalações**. The English name
says what the code does; the pt-BR word is what a reader sees and what
`CONTEXT.md` governs.

**Two exceptions, both at the provider's edge.** A type that describes a
provider's payload may carry that provider's word, because it is read against
the payload: `CbfAtleta`, `CbfJogo`, and `SumulaDocumento` for CBF's
`documentos`. And **súmula** keeps its word in identifiers — `SumulaGoal`,
`parseSumulaGoals` — because it names CBF's own document, there is no English
equivalent, and `CONTEXT.md` rejects "match report" as not CBF's word. Nothing
of ours takes that exception: `Lineup` and not `Escalacao`, `FollowedClubStrip`
and not `MeuTimeStrip`.

## `CONTEXT.md` is the glossary, and it records rejections

Read it before naming a new concept, and **add the term in the same commit that
introduces it**. Its distinguishing feature is that each entry carries an
`_Avoid_` line — 110 when counted on 2026-09-11; count the file rather than
trusting the figure — recording names that were considered and rejected, so a
rejected name does not quietly come back:

> **Classificação** — _Avoid_: "tabela" (ambiguous — reads as the HTML `<table>`
> element as often as the league table), "ranking" (not the Brazilian football
> word), "leaderboard".

Two entries exist purely to keep near-synonyms apart, and both were paid for:

- **elenco** (`src/data/squads.ts` — everyone under contract) versus
  **escalação** (`src/data/escalacoes.ts` — a claim about one match).
- **Acontecimento** (off-pitch, dated) versus **Partida**, which is what
  `structured-data-core.ts` already calls an `Event` in schema.org's vocabulary.

## File-name conventions, which are load-bearing

A suffix here is a promise, and reviewers read it as one:

| Pattern | Promise |
| --- | --- |
| `*-core.ts` (root) | Pure. No I/O, no clock, no environment. |
| `*-store.ts` (root) | The opposite: this file knows where the bytes go. |
| `src/data/*.ts` | Committed data — generated or curated, no logic. |
| `scripts/sync-*.ts` | Writes a generated file. Runs on a workstation, never in production. |
| `scripts/check-*.ts` | Verifies curated data against its third-party source. Changes nothing. |
| `scripts/rehearse-*.sh` | Behavioural coverage of a shell script, against stubs. |
| `shell_scripts/NN_*.sh` | Host provisioning or deploy, numbered by order. |
| `tests/*.test.ts` | `node:test`, pure, in `test:unit`'s explicit list. |
| `tests/e2e/*.spec.ts` | Playwright, against a booted server. |

Naming a new root file `something-core.ts` asserts it performs no I/O. If it
does, it is a `-store`.

## Naming that prevents a bug class

Three names here exist in their current form because a shorter one produced a
defect:

- **`Goal.clubCode` is the club a goal counts *for*, not the scorer's club.**
  CBF files an own goal under the scoring player's club, so the two differ.
  `scorerClubCode(goal, homeCode, awayCode)` is the separate accessor for
  "whose squad do I look this player up in", and using `clubCode` there resolves
  **0 of the season's 20 own goals** — silently, because a name looked up in the
  wrong squad simply finds nobody and costs a link.
- **`rankMovement` returns a direction and a count, never a signed number.** The
  sign of a position runs backwards — 5º → 3º is a club climbing while its
  number falls — so every call site that subtracts is one `-` away from drawing
  the arrow the wrong way. The type makes the subtraction unavailable.
- **`--shadow-level-*`, not `--elevation-*`.** A Tailwind v4 utility exists only
  where a theme namespace says it does, so `--elevation-3` would be a real
  custom property that no `elevation-3` class could reach — compiling to nothing
  and silently leaving the default in place.

## Provider vocabulary is never renamed, and never trusted

`escalacao-core.ts` documents three CBF fields whose names lie:

- `reserva` is the **string** `"false"`, so `if (a.reserva)` is true for all 46
  players and reports nobody as a starter.
- `entrou_jogando` reads as "came on" and is true for precisely the players who
  **started**.
- `apelido` carries the shirt number welded to the front, in a different format
  from `numero_camisa` beside it.

The rule that follows: keep the provider's spelling at the boundary so a reader
can match it against the payload, and give *our* type an honest name —
`LineupPlayer.starter`, not `naoReserva`. `tests/escalacao-core.test.ts` builds
its fixtures with string booleans for exactly this reason; real ones would make
every test pass against the bug.

## Required rules

1. **Predicate form for booleans.** `isKnownGoalResult`, `isAwaitingResult`,
   `isConcluded`, `isImminent`, `countsTowardStandings`, `hasLiveMatch`,
   `hasProvisionalKickoff`, `redistributable`, `retractsResult` — all read
   correctly inside an `if`. A function that also acts names the outcome it
   reports: `refusedWithoutAccounts(res)` sends the 404 and returns whether it
   did, so `if (refusedWithoutAccounts(res)) return;` reads true — where the
   `requireAccounts` it replaced read as an order and returned the opposite.
2. **A function is named for what it does or for what it returns.** One that
   acts or transforms takes a verb (`computeStandings`, `parseWeather`,
   `mergeByFreshness`). A pure accessor may be named for its answer —
   `clubFocus`, `liveBoard`, `birthDateLabel`, `channelsFor`, `clubAddress` —
   and that is house style rather than an exception: roughly half of the
   exported functions in the core modules and `src/` are named that way
   (counted 2026-09-11). What is ruled out is a name that is neither: `handle`,
   `process`, `data`.
3. **No `utils`, `helpers`, `common`, `manager`.** There are none; do not start.
4. **A new domain term goes in `CONTEXT.md` in the same commit**, with its
   `_Avoid_` line.
5. **Colour tokens use MD3's role names where MD3 has a role** — `on-surface`,
   `outline`, `surface-container` — and an extension name only where it does
   not: `ink-muted`, `ink-faint`, `positive`/`negative`/`warning`. **No extension
   may duplicate a role**, and `npm run test:tokens` fails a palette where one
   does.
6. **A test name states the scenario and the expected outcome**, not the function.
   `tests/e2e/escalacoes.spec.ts` carries the cautionary case: a spec titled
   *"names a goalkeeper"* passed for its first week (added 2026-08-30, retitled
   2026-09-06) because the one fixture it opened happened to be flagged
   correctly.

## Current reality

- **The bilingual boundary is convention, not enforced.** Nothing stops an
  English domain noun or a pt-BR identifier.
- **File names are outside the bilingual rule, and mixed.** A file may carry the
  pt-BR domain noun — `escalacao-core.ts`, `src/data/escalacoes.ts`,
  `MeuTime.tsx` — while the identifiers inside it are English (`Lineup`,
  `LINEUPS`, `FollowedClubStrip`), and `goals-core.ts` and `squads.ts` sit
  beside them in English. The rule binds identifiers; renaming a file is churn
  across imports and prose for no reader's benefit.
- **`CONTEXT.md` is authoritative and large.** Grep it for the concept before
  inventing a word; the `_Avoid_` line often already contains the word you were
  about to pick.
- **`src/types.ts` holds 35 exported interfaces and 12 type aliases** and is the
  single source of truth for shared shapes. Extend it before adding fields
  anywhere.
- **The one enforced naming rule is the token vocabulary.**
  `tests/design-tokens-core.test.ts` fails a palette shade, a Tailwind radius, a
  bare type step, a `tracking-*`, a `duration-*`/`ease-*` utility, a hand-written
  `hover:`/`focus:` colour and a bare `shadow-*`. Everything else here is review.

## Review heuristics

**Cold-read test.** From the identifier alone, can you predict what it returns?

**Language test.** Is this a domain noun in English, or an identifier in pt-BR?
Both are the mistake.

**Glossary test.** Does `CONTEXT.md` already have a word for this? Does its
`_Avoid_` line name the one you just chose?

**Suffix test.** Does the file's suffix promise something the file does not do?

**Sign test.** Does the name imply an arithmetic that runs backwards — a
position, a rank, a "score" where lower is better?

## Positive signals

- A new concept arrives with its `CONTEXT.md` entry in the same diff.
- A boolean reads correctly inside `if (...)`.
- A `-core` file's imports confirm the promise its name makes.
- A provider's odd field keeps its odd name, and our type does not inherit it.

## Warning signs

- A new `utils.ts`, `helpers.ts` or `shared/`.
- A pt-BR identifier, or an English word on the page.
- A term in a component that `CONTEXT.md` has never heard of.
- A boolean named `checkX` or `validateX`, or a guard named as an order
  (`requireX`) that returns whether it let you through.
- A signed number standing for a movement in rank.
- A test whose title names the function rather than the scenario.

## Related guides

- [HIGH_COHESION_GUIDE.md](./HIGH_COHESION_GUIDE.md) — a name that needs "and" is two files.
- [DRY_GUIDE.md](./DRY_GUIDE.md) — an extracted concept needs a name before it has a home.
- [CLEAN_ARCHITECTURE_GUIDE.md](./CLEAN_ARCHITECTURE_GUIDE.md) — what `-core` and `-store` promise.
- [DEFENSIVE_CODING_GUIDE.md](./DEFENSIVE_CODING_GUIDE.md) — provider fields that lie.

## Checklist

- [ ] Domain nouns are pt-BR; identifiers are English.
- [ ] New term added to `CONTEXT.md` with its `_Avoid_` line, same commit.
- [ ] Booleans read correctly in a conditional.
- [ ] The file's suffix is true of its contents.
- [ ] No generic container name introduced.
- [ ] Colour, radius, type and motion names come from the token vocabulary.
- [ ] Test titles name the scenario, and are true of the fixture they open.
