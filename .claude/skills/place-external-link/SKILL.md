---
name: place-external-link
description: Take an external URL somebody pasted — a Discord server, a supporters' forum, a club's channel on some site — establish whether it is a form a stranger can actually open and a form a machine can verify, then add it to a curated file with a parser that refuses, a checker that confirms identity, and the wiring the club page needs. Use this whenever someone pastes a link and says "add this to the club page", "põe este link no clube", "add the Discord for Flamengo", "where does this go", or sends a bare URL with no instruction at all. Reach for it BEFORE editing any `src/data/club-*.ts` or `src/data/player-*.ts` by hand, and before writing a parser: the address bar's URL is routinely the one form that does not work for anybody else, and the host frequently answers 200 for an invented id. Not for Instagram links (`place-instagram-post`), a match's melhores momentos (`find-highlights`), or a club's campanha video (`campanha-video`).
---

# Placing an external URL

The job is not "paste the string into a file". It is to answer two questions
about the URL, in this order, before anything is written down:

1. **Can a stranger open it?** Not you — you are logged in and a member.
2. **Can a machine confirm it?** If not, this repository's whole curated-data
   convention has nothing to stand on.

Those two decide the *stored shape*, and the stored shape decides everything
downstream. Get them backwards and you write a parser for a value that should
never have been stored.

**Not for:** an Instagram post or profile (`place-instagram-post`), a match's
melhores momentos (`find-highlights`), a club's campanha video
(`campanha-video`). Those have their own routing and their own traps.

---

## 1. The URL in the address bar is the suspect one

The single most common failure is that somebody copies what their browser shows
while they are *inside* the thing, and that address is a pointer for people who
are already inside it.

Measured case, and the reason this skill exists:
`https://discord.com/channels/956003357129076746/@home` is the address bar's
view of a server you have joined. A non-member following it gets **their own**
Discord — no join button, no error, no sign that anything was meant to happen.
The shareable form is a different URL entirely (`discord.gg/<code>`), reachable
only from a menu the member has to go and use.

So the first move is always: **ask the person for the shareable form**, and say
why in one line. Do not lift an identifier out of the member-only URL and build
a link from it — see §4.

Other shapes with the same disease: a Google Drive file URL from a logged-in
tab, a Slack `archives/` permalink, anything under a `/settings/` or `/admin/`
path, a share URL carrying a token that identifies whoever copied it.

---

## 2. Verifiability is a property of the host, not of your diligence

`src/data/player-instagram.ts` has no checker and `src/data/club-hymns.ts` has
one. That is not a difference in care — it is that YouTube answers a machine
honestly and Instagram does not. Establish which you are dealing with **before**
choosing what to store, because the verifiable form is usually the right form.

Probe it, and **always include an invented id in the same output**:

```sh
curl -s -o real.html -w "%{http_code} %{size_download}\n" "<url with the real id>"
curl -s -o fake.html -w "%{http_code} %{size_download}\n" "<same url, digits changed>"
```

If those two lines match, the endpoint cannot tell you anything and neither can
a checker built on it. Measured for Discord guild ids: **200 / 63681 B** against
**200 / 63657 B**, both `<title>Discord</title>`. Same trap as Instagram.

Then look for an endpoint that *does* discriminate. For Discord it is the invite
API, unauthenticated:

```sh
curl -s "https://discord.com/api/v10/invites/<code>?with_counts=true"
# real  -> {"code":"flamengo","guild":{"id":"956003357129076746","name":"FlaDiscord"},...}
# fake  -> {"message": "Unknown Invite", "code": 10006}
```

**A discriminating endpoint is the argument for the stored shape.** The invite
is both the form a stranger can open *and* the form a machine can confirm; the
guild id is neither. That is the whole design decision, and it is made here
rather than in the parser.

---

## 3. What to store

Store the **identifier, never the URL** — every curated file here does, and
`club-core.ts` derives the address (`instagramUrl`, `redditUrl`, `hymnUrl`,
`discordUrl`). That is what stops a pasted `?utm_source=…`, `?rdt=…`,
`&list=RD…` or a share token reaching a committed file.

Store a **second field when identity can drift from address**. `ClubDiscord` is
`{ invite, guild }` because a vanity code is *transferable*: Discord releases it
when a server drops below the boost level that earned it, and whoever claims it
next inherits our link. The invite is what a reader follows; the guild id is
what says which server that is. Ask: *could this string one day open something
else, with nothing about the string changing?* If yes, record the identity too.

---

## 4. The parser refuses; it never salvages

Follow `instagramPostCode`'s rule — it accepts `/p/` and refuses a reel, rather
than guessing that `/p/` serves reels too. A parser that is *helpful* about a
bad input produces a link that looks right and goes nowhere, which is worse than
no parser.

**And then mutate it, because the obvious test for a refusal passes without the
refusal.** This is the trap worth the whole section:

```
discordInvite("https://discord.com/channels/956…/@home")   -> null  (WITHOUT the refusal too)
```

The full URL is already refused by the character rule — its first path segment
is `https:`. So three assertions built from full URLs were **green against a
parser with no refusal in it at all**. The shapes that actually reach the
refusal are the trimmed ones:

```
"channels/956…/@home"   -> "channels"          stored as an invite code
"956003357129076746"    -> the id itself       builds discord.gg/956…
```

The second is the likeliest hand-edit anyone makes from a member-only URL — they
delete the wrapper themselves and write down the number. Refuse it on *shape*
(a 17–20 digit snowflake is not an invite code), and pin the bound with a test
saying a short numeric code still stands, so nobody widens it later into
refusing real values.

**Delete each refusal in turn and watch a test named for it go red.** If nothing
goes red, the test is decorative.

---

## 5. The checker asserts identity, not resemblance

`check-hymns` asks whether a video's *title* names the club, because a title is
all YouTube offers, and its own header calls that "evidence, not proof". Where
the host gives you an **id**, use the id and make the check exact.

This was learned the expensive way. `check-club-discord` first asked whether the
guild's name named the club, and **refused the only correct entry in the file**:
the server is called *FlaDiscord*, which contains no word of "CR Flamengo".
Supporters name their servers the way supporters talk. A rule strict enough to
be worth something rejects that; a rule loose enough to accept it accepts nearly
anything. **That is a false negative, the direction a gate must never fail in,
and it was reached by trying to be careful.**

Model the script on `scripts/check-hymns.ts`:

- talk to **one** host, never the football-data budget;
- go **sequential** — a burst at a host that owes us nothing earns a rate limit;
- print the **whole table**, passes included, because the name and member count
  are what a person reads to decide it is still the community they meant;
- accept an optional app URL and compare against what the deploy serves;
- register it in `package.json` **and** in the `for c in` line of
  `.github/workflows/curated-data.yml` (count that line, do not trust a number
  written in prose);
- exit 1 on any failure, and confirm it by mutation in both directions — the
  recorded id changed, and the link re-pointed at something else.

---

## 6. Wiring a new link into the club page

Measured on the Discord change; every one of these was needed:

| file | what |
|---|---|
| `src/data/club-<thing>.ts` | the curated record, keyed by **our club code**, never `tla` |
| `src/types.ts` | the optional field on `Club`, plus a shape if the value is an object |
| `club-core.ts` | the parser, the URL builder, and a `withX(clubs, record)` attacher |
| `server.ts` | fold `withX` into the `CLUBS` chain — one site, and `withClubDetails` must re-emit the field or it dies at the API edge |
| `ClubView.tsx` | the glyph and the anchor |
| `tests/club-core.test.ts` | parser cases, orphan keys, parser-survives, distinctness, not-empty |
| `scripts/check-…` + workflow | §5 |
| `CLAUDE.md` | a paragraph in the **Data** section |

Two details that are decided, not free:

**The glyph names the thing, never the host.** Reddit gets a speech bubble, not
Snoo; Discord gets a headset, not the blurple wordmark. Third-party marks are
artwork with a fixed form and a fixed colour, so they cannot take `currentColor`
and sit cold beside links that warm on hover. And **do not draw a second glyph
that resembles a neighbour** — a second speech bubble beside Reddit's is
indistinguishable at 16px.

**Whose voice is it?** A supporters' server or subreddit is *not* the club
talking. The screen-reader suffix says "comunidade de torcedores"; only the club
site and the club's own profile say "oficial do clube". Getting this wrong is
the kind of wrong that looks right.

---

## 7. Two specs will go red without being wrong

**`tests/e2e/club.spec.ts`'s `siteLink` is defined by EXCLUSION** — it is every
external header link that is not one of the known hosts. Every link added beside
it must be excluded there too, or both site-link specs fail with *strict mode
violation: resolved to 2 elements*. The hymn was the first, the sede map the
second, the subreddit the third, the Discord the fourth. **This is the locator
doing its job**, so extend the list; do not rewrite it positively.

**`ClubView` resolves its club from `/api/standings` FIRST**, falling back to
`/api/matches`. A fixture that prepares only the fixtures payload injects into
the copy that loses, and the link silently never renders — measured, with the
page holding the field on the club it was handed and drawing nothing while the
neighbouring link drew fine. Prepare **both**, and say so in the fixture, so the
spec does not encode which one wins.

---

## 8. A curated file that starts empty needs a prepared payload

Coverage here is partial by design, so a new link usually ships with one entry
or none. If it ships with none, the anchor renders nowhere and **the feature
would ship having never once rendered**. Write the spec against a prepared
payload — `meu-time.spec.ts`' arrangement — fulfilled **from memory**, never
`route.fetch()` per request.

And confirm it: delete the anchor from the component and watch the spec fail.

---

## 9. Before you commit

- `./node_modules/.bin/tsc --noEmit` (`npm run lint` is mangled by rtk here).
- `npm run test:unit`, `npm run test:tokens`, and the e2e suite — **check the
  exit code of the test command itself**, never a `| tail`, which exits 0 on a
  failing run and whose last lines look exactly like a passing one.
- Run your new checker for real.
- **Screenshots:** `src/data`, `src/components` and `club-core.ts` are all
  watched appearance paths, so the gate will list the commit. Establish whether
  a captured frame can actually change — the captured club is **Palmeiras
  (1769)** while the seed is led by Flamengo, so a curated entry for another
  club reaches no capture:

  ```sh
  git diff -U0 origin/main...HEAD -- src/data/club-<thing>.ts | grep -cE '^[+-][^+-].*"1769"'
  # 0 = no captured frame moves; >0 = you owe a RE-SHOOT, not a trailer
  ```

  **`-U0` and the `^[+-]` filter are not decoration, and a plain `grep -c` is
  wrong the moment the file already has an entry near yours.** A diff prints
  **context** lines as well as changed ones, so inserting an entry directly above
  `"1769"` makes the captured club appear in the output having not been touched:
  measured on the Athletico-PR entry, the naive form answered **1** for a club
  whose line is pure context, while the filtered form answers **0** and still
  answers **1** for the club actually added. `-U0` removes the context and the
  `[^+-]` guard drops the `+++`/`---` headers.

  Note this failure runs the *opposite* way to the one above it: no refs at all
  says **"you owe nothing"** and ships a stale capture, while counting context
  says **"you owe a re-shoot"** and costs twenty captures to photograph nothing —
  which this file's own gate paragraph calls out as the mistake nothing catches,
  because an unnecessary re-shoot passes every check. Two directions, one command,
  both found by running it rather than reading it.

  **Name the refs. The bare `git diff -- <path>` this skill used to prescribe is
  wrong twice, and both were measured after it shipped.** It compares the
  working tree to `HEAD`, so it answers about wherever you are standing — run it
  in the shared root, which is where somebody re-checking your claim will run
  it, and a clean tree gives **0**. Worse, it gives **0 in the correct worktree
  too, the moment you commit**, because the tree is clean again. So it fails
  toward *you owe nothing*, which is exactly how a stale screenshot reaches
  production, and it happens to be right only while the change is unstaged —
  which is the accident that let it look correct on the commit that introduced
  it. The three-dot form asks what this branch changed and is correct from
  anywhere, at any commit state.

  **This generalises past screenshots: any command in a skill that reads "the
  change" must name its refs**, because it will be run from the shared root, or
  after committing, or by somebody else. `git show origin/main:<path>` and
  `git show HEAD:<path>` are the same discipline for file contents; `git ls-tree
  origin/main <dir>` for a listing.

  If it comes back non-zero, **a trailer is not available to you** — a captured
  frame really does change, and the honest answer is a re-shoot taken from
  production after the deploy. The gate will be red in between; it is advisory
  and is not in `deploy`'s `needs`.

  If it is zero, verify it in a real render rather than by reading, then write a
  `Screenshots-unaffected:` trailer **in the last paragraph**, beside
  `Co-Authored-By:` — a blank line above it means git does not parse it and the
  claim is silently dropped. Check with:

  ```sh
  git log -1 --format='%(trailers:key=Screenshots-unaffected,valueonly,unfold)'
  ```

- If a spec fails that you cannot connect to your change, **measure a baseline**
  before calling it pre-existing: a throwaway worktree at `origin/main` with
  `node_modules` symlinked, and run it several times.
  `version-reload.spec.ts` [mobile] is a known flake (*Execution context was
  destroyed*) — 3 of 4 on a clean baseline.

---

## Worked example: the Discord that started this

1. Given `discord.com/channels/956003357129076746/@home`. Probed: widget 403,
   `/preview` 401, page 200 for the real id **and two invented ones**. Not
   shareable, not verifiable → asked for an invite.
2. Given `discord.com/invite/flamengo`. Resolved to guild `956003357129076746`
   — **the same server as the original URL**, which is what confirmed the entry.
   `expires_at: null`, 49 862 members, name *FlaDiscord*.
3. Stored `{ invite: "flamengo", guild: "956003357129076746" }`.
4. `discordInvite` refuses `channels/` and bare snowflakes; both mutation-red.
5. `check-club-discord` compares guild ids exactly; both mutation-red.
6. Ask for **Expire after: Never** and **Max uses: No limit** — Discord's
   default is 7 days and one use, so an unedited invite is dead within a week.

## The second one, which went differently in two ways

`discord.com/invite/palmeiras` → guild `794150101504491530`, «Palmeiras •
ＯＢＳＥＳＳÃＯ», 20 010 members, never expires. One line of data, since the
plumbing already existed. Both differences are worth recognising when they recur:

**No independent anchor.** Flamengo's guild id was confirmed against the
`channels/<guild>` URL the person had pasted — two sources agreeing on one
number. Here only the invite arrived, so the evidence is the server describing
itself: *"O servidor **não oficial** da Sociedade Esportiva Palmeiras…"*, which
names the club by its legal name **and** says non-official, matching the
"comunidade de torcedores" suffix the link carries. Put that in the entry's
comment; it is what the next person needs before touching it.

(Note the guild name here *does* contain "Palmeiras", so the discarded
name-matching checker would have passed it. That changes nothing — what is
stored and checked is the id, and that is what catches a vanity changing hands.)

**It moved a captured frame.** Palmeiras is `1769`, the club the screenshots
photograph, so this one owed a **re-shoot** where Flamengo owed a trailer. The
ranged `git diff` above returns 1 for it and 0 for Flamengo. Expect the gate to
name your commit — *"appearance changed since, in: … "* — and expect it to stay
red until the re-shoot lands, taken from production after the deploy.
