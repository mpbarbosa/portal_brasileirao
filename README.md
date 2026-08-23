# Portal Brasileirão

Companion app for the Brazilian football championship — live match detail, standings, and
club data for the Campeonato Brasileiro Série A.

**React 19 · TypeScript · Express · AWS.** Built end-to-end by directing the AI coding
agent Claude Code.

> **Status:** early scaffolding. The stack below is the target architecture; the
> production deployment is not up yet. This section gets replaced with the live URL
> once it ships.

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 19 + TypeScript, Vite dev server and build |
| Styling | Tailwind CSS |
| API / SSR host | Express (TypeScript, bundled with esbuild for production) |
| Hosting | AWS |
| Tests | `node --test` for unit logic, Playwright for end-to-end |

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
- `npm run test:e2e` — run the Playwright end-to-end suite

## Layout

```
src/         React application
server.ts    Express host: API routes, data sync, static serving
tests/       unit and end-to-end tests
scripts/     build, deploy, and data-sync helpers
docs/        design notes and architecture decisions
```

## Working with Claude Code

This repository is developed by directing Claude Code rather than by hand. Project
conventions, domain glossary, and agent instructions live in `CLAUDE.md` and `CONTEXT.md`
at the repo root — read those first before changing behaviour, and update them in the same
commit when a convention changes.

## License

MIT — see [LICENSE](LICENSE).
