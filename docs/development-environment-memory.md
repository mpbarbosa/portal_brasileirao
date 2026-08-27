# Development environment memory

Captured: 2026-08-27T07:38-03:00. Imported from the sibling repo
`agora_na_copa_2026`, which keeps the same pair of documents; every value below
was re-measured on this machine rather than carried across, because the two
projects deploy to different hosts by different routes.

## Role

- This machine is the **development environment** for `portal_brasileirao`.
- The **production environment is a different machine** — an EC2 instance — and
  has its own memory doc in `docs/production-environment-memory.md`.
- Nothing is built on the production host. It receives a prebuilt payload; see
  **The deploy pipeline** in `CLAUDE.md`.

## Repository context

- Repository: `mpbarbosa/portal_brasileirao`
- Remote: `git@github.com:mpbarbosa/portal_brasileirao.git`
- Working tree root: `/home/mpb/Documents/GitHub/portal_brasileirao`
- Integration branch: `main`
- Reference implementation, checked out beside it:
  `/home/mpb/Documents/GitHub/agora_na_copa_2026`

**This checkout is shared by several Claude sessions**, which is the fact that
most changes how work is done here and has no counterpart in the sibling repo's
copy of this document. Work happens in a git worktree under
`.claude/worktrees/` (gitignored), never in the root checkout; `git worktree
list` shows who is where. The rules — explicit paths on every commit, never
`git stash`, no session merges to `main` — are in `CLAUDE.md` under **Working
alongside other sessions**.

## Machine and runtime

- Hostname: `tatooine`
- OS: `Linux 7.0.0-29-generic x86_64 GNU/Linux`
- Node.js on the default `PATH`: `v26.7.0`
- npm on the default `PATH`: `12.0.2`

**That Node is the wrong major for this repository, and nothing here will tell
you so.** `.nvmrc`, `package.json`'s `engines`, `REQUIRED_NODE_MAJOR` in
`shell_scripts/01_setup_app_directory.sh` and both workflows all name **22**,
and production runs 22.23.2. `nvm` on this machine has `v22.15.0` installed
alongside eleven 26.x builds, so `nvm use` in the worktree is the fix. The trap
is quiet by construction: `tsc --noEmit` is this repo's only lint gate and it
type-checks against `@types/node`'s pinned surface whatever the shell is
running, so a 26-only API passes the gate and throws on the host. `CLAUDE.md`,
**One Node major, named in five places**, is the long version.

## Hardware

- CPU: `Intel(R) Core(TM) Ultra 5 135U`
- Architecture: `x86_64`
- Logical CPU cores: `14`
- Memory: `30 GiB`
- Swap: `2.0 GiB`
- Root filesystem: `441G total, 91G free` (79% used at capture time)

Comfortably larger than the `t3.micro` it deploys to, in every dimension. Do not
reason about production performance, memory headroom or build feasibility from
what happens here.

## Application commands available here

- `npm run dev` — `tsx server.ts`; Express with Vite in middleware mode, so this
  is the single command for full-stack dev. Port 3000, walking upward if busy —
  which is what makes concurrent worktrees workable.
- `npm run build` — Vite build, then esbuild bundles `server.ts` into
  `dist/server.cjs`.
- `npm start` — runs the production bundle locally.
- `npm run lint` — `tsc --noEmit`. There is no ESLint; this is the lint gate.
- `npm run test:unit` — Node's test runner over the `*-core.ts` tests. A new
  `tests/*.test.ts` file does not run until it is added to that script.
- `npm run test:e2e` — Playwright, booting its own server on port 3100 with
  `STRICT_PORT`. A second concurrent run **fails rather than walks**; pass
  `E2E_PORT=3101` to run one alongside another session's.
- `npm run test:tokens` — re-runs the MD3 token generator in `--check` mode and
  the contrast gate.

Data and asset syncs, none of which run automatically: `sync-seed-data`,
`sync-broadcasts`, `sync-rank-history`, `sync-md3-tokens`, `sync-og-image`,
`sync-marks`, `sync-stadium-photos`, `sync-player-photos`, `find-highlights`.
Link checkers: `check-hymns`, `check-player-wikipedia`, `check-player-photos`,
`check-stadium-photos`. The football-data free tier allows **10 requests per
minute**, and `sync-seed-data` spends 3 of them — this machine shares that
budget with production.

## Deployment helpers available here

- `scripts/deploy.sh` — the **workstation** path: rsync over SSH, ending in the
  host's `06_redeploy.sh`. It builds from the **working tree**, not from a git
  ref, so it ships whatever is uncommitted and can change the host's dependency
  set. In a checkout several sessions are editing, that makes running it by hand
  a way to publish someone else's half-finished work. `CLAUDE.md` says never to.
- `scripts/deploy-preflight.sh` — builds and validates the payload locally,
  touching no host.
- `scripts/aws-allow-my-ip.sh` — the security group is pinned to this
  machine's address, so a changed IP is why SSH stops working.
- `scripts/rehearse-flip-back.sh` — drives all eight branches of
  `06_redeploy.sh` and `07_install_release.sh` against stubs. It is the only
  behavioural coverage those two have, and nothing runs it automatically:
  re-run it by hand after editing either.
- `shell_scripts/*` — provisioning and release scripts that travel *inside the
  release tarball* and execute on the host, not here.

**The normal way to deploy is to merge to `main`.** CI builds the payload once,
boots it, smoke-tests it, and promotes those exact bytes over OIDC → S3 → SSM.
This differs from the sibling repo, whose `npm run deploy` publishes a subtree
into a staging repository; that model does not exist here, and neither does the
`mpbarbosa.com` staging checkout its document depends on.

## Notes for future memory use

- Treat this document as environment-specific context for **development** tasks.
- Confirm the active Node major before trusting a green `npm run lint`.
- Do not assume the production host shares this machine's Node version,
  filesystem paths, memory headroom, or the ability to build anything.
- The values here were measured once, at the timestamp above. A hardware or
  runtime claim that matters is worth re-measuring rather than cited.
