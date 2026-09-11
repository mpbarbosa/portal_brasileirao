---
name: place-instagram-post
description: Take one Instagram URL, verify in a browser what it actually is, and put it in the right curated file — a post in src/data/player-posts.ts, a player's profile in src/data/player-instagram.ts, a club's in src/data/club-instagram.ts — or establish that this app has nowhere to put it and say so. Use this whenever someone pastes a bare instagram.com link, says "add this post", "where does this Instagram go", "põe isto no card do jogador", "add the Instagram for <player>", or sends a "(CLUBE) Jogador — Instagram: <url>" line. Reach for it before editing any of those three files by hand: the URL a person pastes carries a share token, the parser takes a post or a reel and refuses every other kind of link, and curl cannot tell a real post from an invented one.
---

# Placing an Instagram URL

Ported from `agora_na_copa_2026`'s `place-instagram-highlight`. **Read it as a
rewrite rather than a copy**: that repo routes one URL across five JSON files —
players, national teams, coaches, referees, matches — and four of those five
have no counterpart here. What transfers is the discipline (*the content
decides, not the label somebody typed*); what does not transfer is the routing
table and the `WebFetch` verification. Reels transfer too, but only since a
browser showed this app's post embed serving one — see Stage 1.

It is called `place-instagram-post` and not `…-highlight` because **highlight**
already means something else in this repository: `src/data/highlights.ts` is
YouTube's *melhores momentos*, owned by the `find-highlights` skill, and nothing
on Instagram ever reaches it.

---

## The destinations — three, and the fourth row is the one to read

| The URL is… | Goes in | Keyed by | Value |
|---|---|---|---|
| a **post** (`/p/<code>/`) or a **reel** (`/reel/<code>/`) featuring a player | `src/data/player-posts.ts` | player id | `{ code, account, summary }` |
| a **profile** of a player | `src/data/player-instagram.ts` | player id | the handle alone |
| a **profile** of a club | `src/data/club-instagram.ts` | club code | the handle alone |
| a **post about a club, a match, a técnico or an árbitro, and no player** | **nowhere** | — | — |

**That last row is a real answer and the most likely one to be got wrong.** The
sibling would file such a post under `teamInstagram.json`, `coachInstagram.json`,
`refereeInstagram.json` or `matchInstagram.json`. This app has none of those
files, and — the half that matters — **no component that would render one**. A
post has exactly one surface here: the **Publicações** section of the **Card do
jogador**, which opens from an elenco row.

So when a post is about the club and not about a player, say that it has nowhere
to go and stop. Creating `club-posts.ts` is not a data edit: it is a type in
`src/types.ts`, a component, a place on a page, an entry in `CONTEXT.md`, a unit
test and an argument about whether the club page should mount a Meta frame at
all. That is a feature, and it needs its own claim in the ledger.

**Cross-listing exists here, but only across players.** `PLAYER_POSTS` is keyed
by player, and `tests/player-posts.test.ts` forbids the same code twice *under
one player* — not across two. A post genuinely featuring two players may be
listed under both, and each entry gets its own `summary` written from that
player's side.

---

## Stage 0 — worktree, then claim

`CLAUDE.md`'s first rule. Create the worktree and branch **before** writing the
ledger entry — git refuses a duplicate branch name, and a markdown file refuses
nothing:

```bash
git worktree add .claude/worktrees/<name> -b worktree-<name> origin/main
cp .env .claude/worktrees/<name>/.env
```

Then add the claim to
`/home/mpb/Documents/GitHub/portal_brasileirao/.claude/worktrees/COORDINATION.md`,
below its `HOW TO ADD AN ENTRY` header. Grep it first for `instagram`,
`player-posts` and the player's name: these three files are edited constantly and
several sessions have collided on them.

---

## Stage 1 — parse before you look at it

Do not read the URL by eye and do not hand-strip the query string. `club-core.ts`
holds the parsers the app itself uses, and running them is the only way to know
what the app will make of a value:

```bash
npx --no-install tsx -e 'import {instagramPostCode,instagramHandle} from "./club-core";
  const u=process.argv[1];
  console.log(JSON.stringify({code:instagramPostCode(u),handle:instagramHandle(u)}));' -- '<url>'
```

Note `process.argv[1]`, not `[2]` — under `tsx -e` the script path is absent, so
the argument lands one slot earlier than it does in a file. Getting that wrong
prints `null` for a perfectly good URL and reads as a refusal.

**Four results, measured, and the handle column is the trap:**

```
/p/CkUdiQ-r9jr/?utm_source=ig_web_copy_link&stkn=…  code "CkUdiQ-r9jr"  handle "p"
/reel/Dc1GBBADkfo/                                  code "Dc1GBBADkfo"  handle "reel"
/reels/Dc1GBBADkfo/                                 code null           handle "reels"
/pedroguilherme/                                    code null           handle "pedroguilherme"
```

`instagramHandle` is **not** a test for "is this a profile?". It returns the
first path segment of whatever it is given, so a post URL yields `p`, a reel
yields `reel`, and a bare shortcode yields itself. Decide the *kind* from the
URL's own path — `/p/`, `/reel/`, `/tv/`, `/stories/`, `/explore/`, or none of
them — and only then call the matching parser. A handle of `p` written into
`player-instagram.ts` type-checks, passes every unit test, and links to nothing.

**`/reel/` is accepted, and a reel is stored exactly as a post is.** A reel's
shortcode is a post's: the `/p/<code>/embed/captioned/` page renders it with its
author, badge and video, and `/p/<code>/` opens it — measured in a browser on
`DbHq1mExfG9`, Pedro's own reel, before the parser was widened. So the card
frames and links `/p/` for both, and nothing records which one it was.

**`/tv/` and `/reels/` are still refused, deliberately.** Nothing here has seen
the `/p/` embed serve the first, and the second answered only the login wall when
opened logged out. `instagramPostCode` returns null for both, and this file's
rule is that it refuses rather than guesses: a link of either kind is a **stop**,
not a value to coerce into `/p/` by hand. Widening it again is a change to
`club-core.ts` with a check attached.

**Only the shortcode is ever stored.** Instagram's "copy link" appends
`?utm_source=ig_web_copy_link&stkn=…`, and `stkn` is a **share token identifying
whoever copied the link** — not a thing to commit to a public repository.
`tests/player-posts.test.ts` enforces the round trip, which is what makes a
pasted permalink fail rather than persist.

---

## Stage 2 — verify in a browser, because nothing else can

**Do not `WebFetch` it, and do not conclude anything from a `curl`.** This is
where the sibling's Stage 1 does not transfer at all. Measured for this
repository and re-measured for `scripts/check-player-posts.ts`: `curl` of a real
shortcode's embed and of an invented one come back **620 681 and 620 686 bytes**,
same `<title>Instagram</title>`, same everything — the login shell, for both. An
HTTP check reports "200 OK" for a post that does not exist. The same is true of a
profile: `src/data/player-instagram.ts` records why there is no
`check-player-instagram` script.

Open the embed in the Browser pane, which renders it:

```
https://www.instagram.com/p/<code>/embed/captioned/
```

That page is client-rendered, so a real engine sees the account, the verified
badge, the follower count and the whole caption. Read from it:

- **who published it** — the first line of the header, which becomes `account`;
- **what it is** — which becomes `summary`, in pt-BR, in your own words;
- **whether the account is verified**, and whether the handle matches the one
  `club-instagram.ts` or `player-instagram.ts` already records.

For the **date**, open the canonical `https://www.instagram.com/p/<code>/`: the
embed does not carry one. Instagram prints a bare `April 2` for the current year
and `April 27, 2025` for anything older — that difference is the whole tell.

A **profile** is verified the same way: open it and read the title
(`Carlos Vinicius (@carlosvinicius95)`), the follower count and the bio. An
invented handle answers *"Profile isn't available"*; that is the known-negative
to check against before trusting any candidate.

One locale note, inherited from `check-player-posts.ts`: Instagram serves the
badge in the negotiated language, so a pt-BR machine reads **"Verificado"** and
**"seguidores"**. Harmless when a person is reading; it is why the checker pins
`en-US`.

---

## Stage 3 — the bar, and what it rejects

`src/data/player-posts.ts` states two rules and both bind on every entry:

- **The account is the club's own or the player's own, and verified.** Not
  "whoever posted something true".
- **Current season.**

**9 of 11 candidates were rejected** on the file's second pass — a far worse rate
than the 13-of-70 `player-instagram.ts` records for handles. The rejections are
the argument, because every one reads as a reasonable match in a list of search
results: a broadcaster's advertisement, two fan pages, a news outlet, a **rival
club's** analysis account posting a Palmeiras goal, a gossip account whose Neymar
caption is about a poker tournament, one **dead** shortcode, and two posts from
the right club's own verified account that were simply a year old.

So: **never paste a link from a search result.** Every entry is opened.

If the browser cannot settle who or what the post is, **stop and ask** rather
than guess — the sibling's rule, and it holds here for a sharper reason: a wrong
entry puts somebody else's post under a named footballer on a public page.

**The stuck-clipboard signature transfers verbatim.** If one permalink arrives
attributed to several different owners in a row, do not fan it out. Flag it, and
let the verified content decide.

---

## Stage 4 — find the key

```bash
grep -n '"<player name>"' -i src/data/squads.ts | head        # → the player id
grep -n '<handle>' src/data/player-instagram.ts src/data/club-instagram.ts
```

Both `player-posts.ts` and `player-instagram.ts` are keyed by **our player id**,
never by name — one club lists three players called Arthur and another four
called Lucas. `club-instagram.ts` is keyed by **club code** (the upstream numeric
id) and never by `tla`: Corinthians and Coritiba both report `COR`.

---

## Stage 5 — insert, respecting each file's conventions

**`player-posts.ts`** — `Record<string, PlayerPost[]>`:

- the player already has an array → append to it;
- otherwise create `"<id>": [ … ]`.

Every entry carries a **comment above it** saying why that post is that player's
— it is the house rule in that file, and a generated-sounding one is padding
rather than a reason. Say who published it and what it shows.

`account` is **the publisher and often not the player**. The seed entry is the
case: `Dc1GBBADkfo` is Athletico-PR's post with Viveros as a collaborator. Read
the field as *who published this*, never as *whose player this is*.

`summary` is what a reader presses **before any frame is mounted**, so it carries
the whole offer on its own. Do not copy Instagram's caption into it: the embed
renders the caption, and a second copy here is the author's words going stale
beside theirs.

**`player-instagram.ts` / `club-instagram.ts`** — the handle alone, without the
`@` and without a URL. `instagramUrl` derives the address, so a pasted
`?hl=pt-br` never reaches the file.

**An `<img src="…cdninstagram.com">` anywhere near this work is the bug.** Those
addresses expire, and copying the image is exactly what `src/data/player-photos.ts`
refuses — an embed is republication *with* the author's avatar, handle and link
back, which is the attribution; a copied JPEG strips all of it.

---

## Stage 6 — the gates that actually bite

```bash
./node_modules/.bin/tsc --noEmit
node --import tsx --test tests/player-posts.test.ts
node --import tsx --test tests/player-instagram.test.ts
npm run check-player-posts        # drives Chromium; needs the network
```

`tests/player-posts.test.ts` is the one that catches the ordinary mistakes: a
stored URL rather than a shortcode, an `account` that is not a bare handle, an
empty summary, a summary that is just the code, the same post twice under one
player, and a key that has left `squads.ts`.

`npm run check-player-posts` is the only thing that sees a **deleted** post,
which renders as an empty white frame inside the card while the facade still
reads correctly. Run it after adding, not instead of opening the post.

---

## Stage 7 — ship

`src/data` is a watched appearance path, so the screenshot gate **will** list the
commit. It cannot have moved a pixel: `scripts/screenshot.ts` has exactly one
`.click()`, and it is `[data-squad] summary` — no capture in the set opens a
**Card do jogador** at all. So the trailer applies, and its reason is that
sentence:

```
A Publicação do <Jogador> entra, e a conta que publica é o clube

Screenshots-unaffected: nenhuma das capturas abre um card de jogador — o único
  .click() de screenshot.ts é o disclosure [data-squad] summary.
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

**The sibling's `data: add …` prefix does not transfer.** This repository writes
subjects as pt-PT sentences naming what changed *and* what was interesting about
it — *"O Instagram do Carlos Vinícius entra, e a proveniência é o próprio
perfil"*, *"Mais duas Publicações, e a regra que recusou nove candidatos em
onze"*. Read `git log --no-merges --format='%s' -n 20` before writing one.

It must sit in the message's **last paragraph**, beside `Co-Authored-By:`, or git
does not parse it as a trailer and the gate silently reports the commit as owing
a capture. Verify rather than trusting the shape:

```bash
git log -1 --format='%(trailers:key=Screenshots-unaffected,valueonly,unfold)'
```

Empty output means the claim does not exist as far as the gate is concerned.

Commit **explicit paths** — never `git add -A`, another session's work is
probably in the tree — push the branch, open the pull request, and **do not
merge**. No session merges into `main`.

---

## Notes

- Batch several posts into one branch and ship once; each still gets its own
  browser viewing and its own comment.
- `CONTEXT.md` holds the pt-BR terms — **Publicação do jogador**, **Instagram do
  jogador**, **Instagram do clube**. Read them before naming anything new.
- The **Publicações** section is a facade: nothing is fetched from Meta until a
  reader presses it. Keep it that way — a thumbnail would have to come from
  Instagram's CDN, which is the copy this whole feature refuses.
