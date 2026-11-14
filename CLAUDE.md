# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before anything else: take a worktree

Several Claude sessions share this checkout. **Do your work in a git worktree, never in
the root checkout** — root is for integration.

```sh
git worktree add .claude/worktrees/<name> -b worktree-<name>
cp .env .claude/worktrees/<name>/.env   # gitignored, so it does not come along
cd .claude/worktrees/<name> && npm ci   # each worktree needs its own node_modules
```

This is the one rule here that protects *other people's* work rather than your own, which
is why it is at the top rather than filed under a section you reach after deciding what to
do. A branch switch in the shared root carries whatever is uncommitted across into
whatever gets checked out next. That is how a merged, deployed commit came to look like a
deliberate revert — several sessions spent an hour diagnosing files nobody had edited. The
tree was nine paths dirty at the time and nothing about it looked wrong.

The failure repeats because it resets: a session that has been told this moves out and
works cleanly, and the next one starts in root again. Assume you are the next one.

Regras completas — commits, stashes, portas, e por que o diretório é gitignored —
em [`docs/claude/sessoes-concorrentes.md`](docs/claude/sessoes-concorrentes.md).

## Project

"Portal Brasileirão" — a companion app for the Campeonato Brasileiro Série A: standings and
round-by-round match detail. React 19 + Vite + TypeScript + Tailwind v4, served by an
Express backend that also runs Vite in dev. Deploy target is AWS.

Modeled on the sibling repo `../agora_na_copa_2026` (a World Cup 2026 companion built the
same way). When a structural question isn't answered here, that repo is the reference
implementation — read it rather than inventing a new pattern.

`docs/guides/` holds twelve engineering guides adapted to this codebase from
`../doc_template_lib`, plus one written here where no template covers the subject
(`VIDEO_GUIDE.md`), with `docs/guides/README.md` as the index — it also records
the fourteen guides deliberately **not** imported, and why, so those are not
re-litigated. They are the citable form of what this file narrates: **this file
stays authoritative**, and where a guide disagrees with it, the guide is wrong.

## Commands

- `npm run dev` — start `server.ts` via `tsx`; it runs Vite in middleware mode, so this is
  the single command for full-stack dev (port 3000, walking to the next free port if busy).
- `npm run build` — build the frontend with Vite, then bundle `server.ts` into
  `dist/server.cjs` with esbuild (`--packages=external`).
- `npm start` — run the production build (`NODE_ENV=production node dist/server.cjs`).
- `npm run lint` — `tsc --noEmit` over the whole project. There is no ESLint; this is the
  lint gate.
- `npm run test:unit` — Node's built-in test runner over the core-module tests.
- `npm run sync-og-image` — redraw `public/og-default.png`, the link-preview card.
- `npm run test:e2e` — Playwright, booting its own server on port 3100.
- One test file: `node --import tsx --test tests/standings-core.test.ts`
- One test by name: `node --import tsx --test --test-name-pattern "tie-breakers" tests/standings-core.test.ts`

`npm run test:unit` lists its test files explicitly, mirroring the sibling repo. A new
`tests/*.test.ts` file does **not** run until it is added to that script.

## Architecture

A arquitetura, as convenções, o CI e o deploy **saíram deste arquivo** para
`docs/claude/`, e isto é deliberado: o `CLAUDE.md` é relido em *toda* chamada de
ferramenta de *toda* sessão deste repo, enquanto um doc separado custa zero
enquanto não é lido. Este arquivo passou de **429KB (~107k tokens por chamada)**
para o tamanho que você está lendo. Nada foi apagado — cada seção está num dos
arquivos abaixo, e eles são a **fonte canônica** do assunto que carregam.

**Leia o doc da área ANTES de tocar nela.** O índice diz quando:

| Doc | Quando ler |
|---|---|
| [`docs/claude/arquitetura-core.md`](docs/claude/arquitetura-core.md) | Antes de criar ou mexer num `*-core.ts`, ou ao tocar em `server.ts`. O servidor de processo único e o contrato dos módulos puros. |
| [`docs/claude/dados-provedor-e-rotas.md`](docs/claude/dados-provedor-e-rotas.md) | Ao tocar no provedor de dados, no cache, no envelope da API, em `src/data/` ou nas rotas — inclui o caso em que o provedor regride registros e o app lembra. |
| [`docs/claude/trafego-e-contas.md`](docs/claude/trafego-e-contas.md) | Ao tocar no access log, em contas/autenticação, na recusa de endereços ou no backup da base de contas. |
| [`docs/claude/seo-e-metadados.md`](docs/claude/seo-e-metadados.md) | Ao mexer em `<head>`, dados estruturados, crawlers ou no cartão de link preview. |
| [`docs/claude/publicando-video-youtube.md`](docs/claude/publicando-video-youtube.md) | Antes de renderizar ou publicar mídia — `docs/medias/`, `scripts/manim/`, upload no YouTube. |
| [`docs/claude/convencoes.md`](docs/claude/convencoes.md) | Ao escrever código novo em `src/` ou `tests/`, antes de escolher um padrão. |
| [`docs/claude/testes-e2e.md`](docs/claude/testes-e2e.md) | Ao escrever ou depurar uma spec Playwright em `tests/e2e/`. |
| [`docs/claude/ci.md`](docs/claude/ci.md) | Ao mexer em `.github/workflows/`, ou quando um job do CI reprovar. |
| [`docs/claude/deploy.md`](docs/claude/deploy.md) | Ao investigar um release, a infraestrutura AWS ou a versão de Node. |
| [`docs/claude/sessoes-concorrentes.md`](docs/claude/sessoes-concorrentes.md) | Ao criar, adotar ou remover um worktree, ou ao coordenar com outra sessão. |
| [`docs/claude/protocolo-commit-push-merge-deploy.md`](docs/claude/protocolo-commit-push-merge-deploy.md) | **Antes do primeiro `git commit`, `git push`, ou qualquer conversa sobre merge e deploy.** |

Dezenas de comentários no código citam «`CLAUDE.md`» e às vezes uma seção pelo
nome — *Key conventions*, *Contas*, *Architecture*. Eles continuam válidos: a
regra citada está no doc desta tabela que cobre o assunto, e `grep -rn '<termo>'
docs/claude/` acha. Não houve corte de conteúdo, só de endereço.

## As regras que valem antes da primeira ação

Estas quatro não estão num doc separado porque uma sessão já as violou antes de
ter motivo para abrir qualquer arquivo. O detalhe, o porquê e as armadilhas estão
em `docs/claude/protocolo-commit-push-merge-deploy.md` e
`docs/claude/sessoes-concorrentes.md`.

- **Trabalhe num worktree, nunca na raiz** — a seção no topo deste arquivo.
- **Reivindique o trabalho antes de começar**, no ledger, que não está em nenhum
  worktree e só abre por caminho absoluto:
  `/home/mpb/Documents/GitHub/portal_brasileirao/.claude/worktrees/COORDINATION.md`.
  **Leia-o com `grep`, nunca com intervalo de linhas** — o arquivo tem duas
  convenções de inserção e não há "fim" acordado.
- **Commit de caminhos explícitos, nunca `git add -A`**; e **nunca `git stash`**
  no checkout compartilhado. A árvore quase certamente tem trabalho de outra
  sessão.
- **Push só da sua própria branch. Merge: proponha, não execute. Deploy só pelo
  pipeline.** Abra a PR e entregue ao utilizador.

## Not built yet

*(Nothing outstanding — deploys are automated; see below.)*

### TLS

Certbot holds the certificate for `brasileirao.mpbarbosa.com` and rewrote the nginx site in
place to add the 443 listener and the HTTP→HTTPS redirect. `certbot.timer` runs twice daily
and `certbot renew --dry-run` passes, so renewal is unattended.

Because certbot owns that file, **re-running `04_setup_nginx.sh` overwrites its edits** and
drops the site back to plain HTTP. That is recoverable — re-run `05_setup_tls.sh` — but the
site serves HTTP in between, so do not run `04` casually on a host that already has TLS.

The live provider path is verified: with a real token the app renders the current Série A
table from football-data.org. Verified against a live payload, v4 reports scores as
`fullTime.home`/`away`.

**Every one of those paths has now run against the real host**, and this paragraph
used to say the opposite long after it stopped being true — which is worth knowing
about a file whose whole claim is that it describes what the code does. `06` and
`07` execute on every release, and the rsync semantics, including that the remote
`.env` survives, are exercised rather than reasoned about. What actually runs is
**The deploy pipeline** above.

One known data mismatch: upstream club codes are not always the local seed codes — São
Paulo is `PAU` upstream, not `SAO`, and the real 2026 division includes clubs absent from
`src/data/clubs.ts`. This is why `/api/matches` ships the clubs it saw; do not reintroduce
a dependency on the seed codes for name resolution.
