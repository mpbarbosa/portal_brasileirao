# Portal Brasileirão

Companion app for the Brazilian football championship — live match detail, standings, and
club data for the Campeonato Brasileiro Série A.

**React 19 · TypeScript · Express · AWS.** Built end-to-end by directing the AI coding
agent Claude Code.

> **Status:** working scaffold. The app builds and runs, but it serves **placeholder
> fixtures** (`src/data/matches.ts`) rather than real results — no data provider is
> connected yet, and there is no production deployment. This section gets replaced with
> the live URL once it ships.

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 19 + TypeScript, Vite dev server and build |
| Styling | Tailwind CSS |
| API / SSR host | Express (TypeScript, bundled with esbuild for production) |
| Hosting | AWS |
| Tests | `node --test` for unit logic |

The Express server owns the data-sync layer (fetching and normalizing match, table, and
club data) and serves the built React bundle, so development and production run the same
single process.

## Local setup

1. Install dependencies:

```sh
npm install
```

2. Copy `.env.example` to `.env` and fill in the values.

3. Start the development server:

```sh
npm run dev
```

The dev server listens on port `3000`, or the next free port if `3000` is taken.

## Commands

- `npm run dev` — start the Express + Vite development server
- `npm run build` — build the frontend and bundle the server
- `npm start` — run the production build
- `npm run lint` — type-check with TypeScript
- `npm run test:unit` — run the Node unit test suite
- `npm run clean` — remove `dist`

Run a single test file with `node --import tsx --test tests/standings-core.test.ts`.

## Layout

```
src/                React application, shared types, seed data
standings-core.ts   pure table computation (no I/O)
matches-core.ts     pure round filtering and feed ordering (no I/O)
server.ts           Express host: API routes, Vite in dev, static serving in prod
tests/              unit tests for the core modules
```

Calculation logic lives in root-level `*-core.ts` modules that do no I/O, so it can be
unit-tested without mocking HTTP. `server.ts` does any fetching and passes payloads in.

## API

Every data endpoint returns `{ source, note, updatedAt, data }`. While seed fixtures are
the only source, `source` is `"placeholder"` and the UI renders `note` as a banner.

- `GET /api/health` — status, version, uptime
- `GET /api/clubs` — the 20 Série A clubs
- `GET /api/standings` — the computed table
- `GET /api/matches[?round=N]` — fixtures, defaulting to the whole feed

## Working with Claude Code

This repository is developed by directing Claude Code rather than by hand. Project
conventions, domain glossary, and agent instructions live in `CLAUDE.md` and `CONTEXT.md`
at the repo root — read those first before changing behaviour, and update them in the same
commit when a convention changes.

## License

MIT — see [LICENSE](LICENSE).
