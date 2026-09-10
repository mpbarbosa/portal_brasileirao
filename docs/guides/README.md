# Guias de engenharia

Adapted engineering guides for Portal Brasileirão. Each one states a principle
and then argues it **from this codebase** — real paths, real commands, and the
measurements that decided the rule. They exist to be **cited in review**: where
`CLAUDE.md` narrates decisions subsystem by subsystem, a guide answers *is this
change good, and by what standard*.

Where a guide and `CLAUDE.md` disagree, **`CLAUDE.md` is authoritative** and the
guide should be corrected.

## Provenance

| | |
| --- | --- |
| Library | `doc_template_lib` — `git@github.com:mpbarbosa/doc_template_lib.git` |
| Imported from | `0a105b4` (2026-06-18), working tree clean |
| Imported on | 2026-09-10 |
| Candidates assessed | 26 templates (excluding the library's own meta-docs) |
| Imported | 12 |

Every adapted guide is **shorter than its source** — measured at import,
2 524 lines against 3 789, a third removed. Adaptation removes. (That pair is a
reading taken on 2026-09-10, not a live count; re-derive it rather than citing
it after the guides are edited.)

## Imported

| Guide | Why it earns its place here |
| --- | --- |
| [CLEAN_ARCHITECTURE_GUIDE.md](./CLEAN_ARCHITECTURE_GUIDE.md) | The 46 pure root `*-core.ts` modules against `server.ts` **are** this repository's architecture. Carries the layer table, the judgement/transport split, and the one-line grep that proves purity. |
| [REFERENTIAL_TRANSPARENCY.md](./REFERENTIAL_TRANSPARENCY.md) | `now` is a parameter in nine core modules, and `events-core.ts` never constructs a `Date` at all. The timezone trap here renders correctly on this workstation and in CI while being wrong for every reader. |
| [HIGH_COHESION_GUIDE.md](./HIGH_COHESION_GUIDE.md) | Written around the case where the naive reading is wrong: `clubFocus` and `nextFixture` have the same shape, answer different questions, and must not be merged. |
| [DRY_GUIDE.md](./DRY_GUIDE.md) | "The second copy is where drift starts" recurs across a dozen files. Sorts this repo's answers into extract / generate / gate, and names the drift that actually happened. |
| [NAMING_GUIDE.md](./NAMING_GUIDE.md) | The codebase is **bilingual by layer** — pt-BR domain nouns, English identifiers — and `CONTEXT.md` records 108 rejected names. No generic guide can anticipate that boundary. |
| [DEFENSIVE_CODING_GUIDE.md](./DEFENSIVE_CODING_GUIDE.md) | This app's most distinctive practice: refuse rather than guess, reconcile rather than validate, and choose the failure direction from what a wrong answer costs. The first season-wide goal sync refused 25 matches and was right to. |
| [ERROR_HANDLING_GUIDE.md](./ERROR_HANDLING_GUIDE.md) | The app barely throws — it degrades inside `ApiEnvelope` and says so. Also carries fail-open versus fail-safe, and the eighteen hours production sat behind green ticks. |
| [REST_API_GUIDE.md](./REST_API_GUIDE.md) | 20 routes, a 10 req/min budget, and the `Disallow`-versus-`noindex` incident that made every content page a soft 404. Versioning and pagination are cut, with the reasons. |
| [UNIT_TEST_GUIDE.md](./UNIT_TEST_GUIDE.md) | `node:test`, no framework, and the trap that `test:unit` lists its 62 files explicitly — a new test simply never runs. Plus the practice of confirming a test red by mutation. |
| [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md) | 40 Playwright specs against a frozen snapshot and a frozen clock. Records that the harness configures the app **out of** production's shape, and the stub that passed against the bug it named. |
| [REACT_GUIDE.md](./REACT_GUIDE.md) | React 19 with no UI dependency, no data-fetching library and no component test tier. Carries the effect-declaration-order bug that only an end-to-end URL assertion could see. |
| [MOBILE_FIRST_GUIDE.md](./MOBILE_FIRST_GUIDE.md) | The nav bar is full at MD3's five destinations, and every layout rule here was measured at 320–375 dp after something shipped broken while every spec was green. |

## Not imported

Recorded so the question is not relitigated. A skip is conditional where it says
so — the **Re-examine when** column is what makes the next import run cheap.

| Guide | Why not | Re-examine when |
| --- | --- | --- |
| `code_quality/LOW_COUPLING_GUIDE.md` | Dependency direction is CLEAN_ARCHITECTURE's subject here, and this repo's coupling rule is the same rule: core modules receive payloads, `server.ts` fetches. A second guide would restate it. | The core modules acquire a dependency they do not receive as an argument. |
| `code_quality/INTERFACE_FIRST_GUIDE.md` | There are no ports and no injected interfaces — a core module never calls out, so there is nothing to define a contract against. `src/types.ts` is the one contract rule and CLEAN_ARCHITECTURE and NAMING both state it. | A plugin, adapter or second provider implementation appears. |
| `code_quality/SOLID_GUIDE.md` | Two classes exist in the whole repository (`TtlCache`, `CircuitBreaker`). LSP, ISP and OCP are class-shaped; SRP and DIP are already carried by HIGH_COHESION and CLEAN_ARCHITECTURE. | Class hierarchies or polymorphic dispatch appear. |
| `code_quality/OBSERVABILITY_GUIDE.md` | No structured logging, no metrics, no tracing. `/api/health`, `version-core.ts`, `traffic-report-core.ts` and `.github/workflows/reconcile.yml` are what stands in, and each is documented at its own site. | Structured logs, a metrics endpoint, or alerting arrives — the eighteen-hour green-tick incident is the case it would have covered. |
| `code_quality/CODE_QUALITY_CONTROL_GUIDE.md` | Its subject is the gate list, and `CLAUDE.md`'s **CI** section already holds it with more detail than a generic guide could: `tsc`, `test:unit`, `test:tokens`, `test:e2e`, `check-screenshots`, nine rehearsals. | The gate list stops being described anywhere authoritative. |
| `code_quality/INCREMENTAL_CHANGE_GUIDE.md` | Covered, and exceeded, by `CLAUDE.md`'s **Working alongside other sessions** and **The protocol for commit, push, merge and deploy** — worktree-per-session, explicit-path commits, the coordination ledger. | Those sections are extracted out of `CLAUDE.md`. |
| `code_quality/CLAUDE_CODE_WORKFLOW_GUIDE.md` | Same reason, more so. `CLAUDE.md` carries roughly 1 500 lines of session discipline with incidents attached; a 287-line generic guide beside it would be the weaker of two authorities on one subject. | Never, while `CLAUDE.md` holds it. |
| `code_quality/LLM_CONTEXT_GUIDE.md` | Its remedy is *structure the code*, and the code here is already small pure modules. The live context problem is the **size of `CLAUDE.md` itself**, which the guide does not address. | Someone takes on splitting `CLAUDE.md`; the guide is about code, so it would still need re-pointing. |
| `code_quality/INTEGRATION_TEST_GUIDE.md` | There is no integration tier. Tests are pure units over `*-core.ts` or full-stack Playwright. The nearest thing — `scripts/rehearse-*.sh` — tests **shell scripts** against stubs, which is a different subject. | A tier appears between the two, or the rehearsals grow enough to want a written standard. |
| `domain_specific/DDD_GUIDE.md` | No aggregates, entities, repositories or bounded contexts. A league table, a fixture list and a squad are records, not a domain needing strategic patterns. Importing it would make the real guides cheaper to ignore. | The domain acquires invariant-bearing aggregates. Unlikely. |
| `domain_specific/LIGHTWEIGHT_DDD_GUIDE.md` | Its live half here is Ubiquitous Language, and `CONTEXT.md` already does that better than a template can — with `_Avoid_` lines. NAMING carries the rest. | A second bounded context appears (a second competition, a second provider domain). |
| `domain_specific/DOMAIN_DESIGN_CONTROL_GUIDE.md` | Review gates for domain/API change. Overlaps REST_API, and `CLAUDE.md`'s four-file `Route`-variant rule is the concrete version of exactly this, including which three files `tsc` catches and which one fails silently. | The `Route`/`seo-core.ts` rule stops being documented. |
| `domain_specific/NODE_MODULE_GUIDE.md` | Layered Node module structure and dependency direction — the same subject as CLEAN_ARCHITECTURE for a single-process app that publishes no packages. | The server is split into packages or workspaces. |
| `meta/GUIDE_AUTHORING_GUIDE.md` | Describes how to add a guide **to the library**, including its `.workflow-config.yaml` registration. It is a library meta-doc filed in a template folder. | Never — contribute upstream instead. |

## How to use these

- **Starting on this codebase?** Read
  [CLEAN_ARCHITECTURE_GUIDE.md](./CLEAN_ARCHITECTURE_GUIDE.md) and
  [REFERENTIAL_TRANSPARENCY.md](./REFERENTIAL_TRANSPARENCY.md) first. Between
  them they explain why there are 46 files ending in `-core.ts` at the repository
  root, which is the first surprising thing anyone sees.
- **Adding a rule or a data source?**
  [DEFENSIVE_CODING_GUIDE.md](./DEFENSIVE_CODING_GUIDE.md), then
  [NAMING_GUIDE.md](./NAMING_GUIDE.md) before you name it, then
  [UNIT_TEST_GUIDE.md](./UNIT_TEST_GUIDE.md) — and add the test file to
  `test:unit`.
- **Adding an endpoint?** [REST_API_GUIDE.md](./REST_API_GUIDE.md) and
  [ERROR_HANDLING_GUIDE.md](./ERROR_HANDLING_GUIDE.md).
- **Touching the UI?** [REACT_GUIDE.md](./REACT_GUIDE.md) and
  [MOBILE_FIRST_GUIDE.md](./MOBILE_FIRST_GUIDE.md), then
  [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md) — it is the only place component
  behaviour is asserted at all.
- **Tempted to merge two similar functions?**
  [HIGH_COHESION_GUIDE.md](./HIGH_COHESION_GUIDE.md) and
  [DRY_GUIDE.md](./DRY_GUIDE.md) point opposite ways on purpose; both name the
  question that decides it.

## Re-importing later

Re-run against a newer library commit and check the **Re-examine when** column
above before re-litigating any skip. Two rules from the first pass are worth
carrying forward:

- **Discover the catalog; do not assume it.** The library's own `CLAUDE.md`
  carries the guide table, and folders grow between imports.
- **Verify every path as you write it.** `git ls-files --error-unmatch <path>`.
  A plausible-looking path is a trap for whoever follows it.
