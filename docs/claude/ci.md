# CI — workflows, portões e armadilhas

*Quando ler:* Leia ao mexer em `.github/workflows/`, ou quando um job do CI reprovar.

Extraído do `CLAUDE.md`, que ficou um índice. Esta é a fonte canônica do assunto.

---

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull request,
in two parallel jobs:

- **check** — `tsc --noEmit`, unit tests, build, then boots `dist/server.cjs` and
  smoke-tests it, then shellchecks the deploy scripts and **runs the rehearsals**
  — count the `rehearse-` steps in the workflow rather than a number here;
  `tests/workflow-lists.test.ts` fails when a script is not among them. The boot step is the one that catches a runtime
  dependency stranded in `devDependencies`; the rehearsals are the only thing
  that catches a script which no longer does what it says. The two host-script
  ones gate the deploy because `shell_scripts/` is packaged into the payload by
  this same job, a few steps later — so the bytes that ship have been exercised,
  not just read.
  They run on `.nvmrc`'s Node rather than a developer's, which is the whole
  point: the first bug this placement found was invisible on a newer major.
  **Count the `run:` lines rather than this sentence** — it said "both" for as
  long as there were three, which is the failure the capture-count paragraph
  below records about a number written in prose.
- **e2e** — Playwright, with the browser cached on the exact `@playwright/test`
  version. A version bump needs a matching browser build, so the cache key must
  include it or the run fails with "Executable doesn't exist".

A third job, **screenshots**, checks that `docs/screenshots` still depicts the app. It is
advisory — never in `deploy`'s `needs`, for the reason the workflow gives — and it asks two
questions rather than one. First, are the appearance sources at the commit the images
*depict* identical to HEAD's? That is a content comparison, and it replaced an ancestry
test that went red for merges which changed nothing on main. Second, for whatever genuinely
differs, is every commit accounted for?

**Which commit the images depict is not the commit that stored them.** The anchor is the
sha inside `docs/screenshots/CAPTURED`, falling back to `git log -1 -- docs/screenshots`
only when that cannot be read. The two differ exactly when a capture is taken, main moves
underneath it, and the images are committed after: the image commit's *tree* then carries
an appearance change the photographs do not show, and the weaker anchor calls that current.
CAPTURED is trusted the way the trailer below is — a person's assertion standing in a diff,
not something the check can verify.

**An appearance path can move without a pixel moving.** A rule that is never in effect
during a paint, a selector nothing matches, a comment: the edit is real and the render is
identical. `docs/screenshots/CAPTURED` records which commit the images depict, so a refresh
always leaves something to commit — that is the mechanical answer and it is the right one
wherever it applies. But it still charges **twenty-eight** captures from a live-data
production build to certify that nothing changed, and records no reason.

**`src/data` is a watched path, and it is the one on the list that reports too
much.** The other four are markup and CSS; this one is data that gets *merged
into what production serves* — broadcaster marks onto four captured pages, a
stadium's name and photograph onto the estádio page, a curated player name onto
Jogadores. So an edit there moves a captured pixel with nothing in
`src/components`, `src/index.css`, `src/App.tsx` or `index.html` having changed,
and before it was added the gate could not see that at all. It was found by
asking whether #221 owed a refresh: it edits `src/data/player-overrides.ts`, the
gate said nothing, and only reading the data *diff* established that the one new
entry is a nationality — which renders on the player card, and no capture opens
one.

**The cost, which is real and was accepted rather than missed: the seed snapshot
cannot move a capture and is watched anyway.** `matches.ts`, `clubs.ts`,
`squads.ts`, `rank-history.ts` and `scorers.ts` are the offline fallback, and
every capture is taken from **production**, which serves live provider data — so
a `sync-seed-data` run reddens the gate for something structurally incapable of
changing an image. A `Screenshots-unaffected:` trailer is the answer, and that is
the mechanism working rather than a workaround for it. A path list cannot
separate `matches.ts` from `broadcasts.ts`, and between a gate that reports too
much and one that reports nothing, this is the direction to fail in.
`tests/check-screenshots.test.ts` holds both halves — one test that a curated
edit is caught, one that a seed sync is listed and cleared by a trailer. The
second replaced a test asserting the opposite, whose reasoning was correct about
the seed and wrong about the file it generalised from.

**`rank-candles-core.ts` is on the list too, and it is the first entry that is
neither markup nor data.** It holds the geometry that places every candle rect
on the Painel — the band arithmetic, the zone guides, `tickHeight` — and
`RankCandles.tsx` renders what it returns and decides nothing itself. So #351
took the vela's opening stub from **1.90px to 3.56px**, moving pixels inside
`painel-palmeiras-{light,dark}`, while *"README screenshots are current"* passed
green on its own pull request. Same lesson as `src/data` one paragraph up, one
directory further out: the list described where the *markup* lives, and the
thing that decides the drawing lives somewhere else.

**The list now carries every root-level `*-core.ts` the client imports — 27 of
the 42 — and `tests/appearance-paths.test.ts` is what keeps it that way.** The
one-file fix closed one instance and left the mechanism intact: nothing stopped
the next module arriving unwatched exactly as this one had. So the rule is
stated as a property instead — *every root core module `src/` imports is a
watched path* — and a new one fails on the commit that introduces it rather than
years later when somebody measures a frame by hand. The second test runs the
other way, so the list cannot accumulate entries for modules nothing imports any
more.

**Do not hand-maintain the list against a number in prose.** The first pass
counted imports in `src/components` and `src/App.tsx` and got **25**; the real
figure is **27**, because `page-meta-core` and `seo-core` arrive through
`src/usePageMeta.ts`, a hook in neither place. That is this file's own recurring
failure — a count nobody recomputes — reached while writing the paragraph that
warns about it. The test computes it; no number here needs to stay true.

**The rule is "imported by `src/`", deliberately, and not "renders
something".** Those same two modules write the document head and cannot move a
captured pixel, so watching them over-reports — the direction `src/data`
already fails in for the seed snapshot, and the price of a rule with no
carve-out list. A carve-out is precisely the shape this file warns about
elsewhere: a claim that produces no work while it holds, so nothing
distinguishes *still true* from *quietly false*.

**A glob was the other candidate and is worse in both directions.** Bare
`*-core.ts` reached `scripts/manim/capa-core.ts`, which draws thumbnails and no
page (since renamed `capa-shared.ts`, for doing I/O under the one suffix here
that promises none); `:(glob)*-core.ts` stays at the root but admits all 42, including
`oauth-core`, `session-core` and `rate-limit-core`, which no capture can
contain. Enumeration plus a completeness test costs one file and describes what
it watches.

**A curated file can also move without reaching a capture, and that case is
easy to mis-call in the alarming direction.** `cfa01d5` gave five fixtures their
substitutions — `554740`, `554741`, `554744`, `554752`, `554762` — and the
capture set photographs `554951` and `554977`. Disjoint, so no pixel in it could
have moved; the pull request that shipped it nonetheless said a re-shoot was
owed and that no trailer applied, and both halves were wrong.

The check is one command against the commit, not a judgement about the file:

```sh
git show -U0 <sha> -- src/data/escalacoes.ts | grep -cE '^[+-][^+-].*"(554951|554977)"'
```

**`-U0` and the `^[+-]` filter are the check, not decoration.** A diff prints
**context** lines around every change, so a record sitting beside the one that
changed appears in the output without having been touched — and most curated files
here are one keyed record per line, which puts the captured record beside
something sooner or later. Measured on `6ceb6b3`, which added Athletico-PR directly
above Palmeiras in `club-discord.ts`: the plain `grep -c '"1769"'` answered **3**
for a club that commit never touched, the filtered form answers **0**, and it
answers **1** both for `"1768"` in the same commit and for `"1769"` on `1cfe990`,
the commit that really added Palmeiras. It fails in the **safe-looking** direction
this paragraph describes — *you owe a re-shoot* — so nothing downstream ever
catches it.

**`-U0` is right only where a record is ONE line, and `src/data/club-videos.ts` is
where it fails silently.** There each club is a multi-line list under a key line,
`"1776": [`, and a video swap edits the `id` and `title` lines *beneath* it — so the
code is on a line the diff never marks changed, and the filtered grep answers **0**
for a club whose record did change. Measured on `5a60f6c`, which swapped São Paulo's
video: `"1776"` counts 0. Across that file's history, **three of the four commits that
changed Palmeiras' videos count 0** (`df8f4f2`, `0fbbadb`, `f7cd7ff`); only `7a5a757`,
which added the key, counts 1. This fails in the **reassuring** direction, the
opposite of the context-line trap above, and it is the one that let `5a60f6c`'s
trailer name Palmeiras as *"the captured club page"* while changing São Paulo's.

For a multi-line record, compare the record itself at the commit and its parent:

```sh
rec() { git show "${1}:src/data/club-videos.ts" 2>/dev/null |
  awk -v k="\"${2}\": [" 'index($0, k) {f=1} f {print} f && /^  \],?$/ {exit}'; }
[ "$(rec <sha>^ 1776)" = "$(rec <sha> 1776)" ] && echo unchanged || echo CHANGED
```

On `5a60f6c` that answers CHANGED for `1776`, `4241` and `4287` and unchanged for
`1769`, `1770` and `1772`, and CHANGED on all four Palmeiras commits above. The braces
in `${1}:` are not style: the Bash tool runs zsh, which reads `$1:s…` as a modifier
and fails with *bad substitution* (checked).
A club absent at both ends compares equal, which is right. The closing pattern is
this file's two-space layout, so pointing `rec` at another file means reading that
file's shape first.

**A changed record is still not a moved pixel.** The next question is whether the
section it feeds is inside the crop, and for `club-videos.ts` it is not: every clube
capture's frame ends above the videos (measured 2026-09-15, see the clube captures
under the volatile count below), which is why `5a60f6c` owed no re-shoot despite a
false reason. Answer both, in that order.

**Answer it before reaching for the camera.** Twenty-eight captures from a live
production build to photograph nothing is exactly what the trailer exists to
avoid — and the mistake runs the safe-looking way, which is why nothing catches
it: an unnecessary re-shoot passes the gate, costs an hour, and commits the
per-deploy and per-minute noise of the six images that never come back
byte-identical.

**The same shape reached a RENDERING change, which is the harder half, and the
wrong answer came from the commit's own author.** `b957cc9` adds the club's
subreddit to the link row on the club page — markup and a component, not a
fixture id — so *"this cannot reach a paint"* is plainly false as a statement
about the app, and its message says in as many words that it moves pixels in
`clube-*`. It moved them on **Flamengo's** page. At that commit `club-reddit.ts`
held one entry, `"1783"`, the anchor renders only under `sub && subName`, and
the committed capture is `/clube/palmeiras`, code `1769` — so nothing in the set
of twenty could change. **That is a reading of that commit, not of the file
now:** Palmeiras has had a subreddit since, so the same edit today does reach
`clube-palmeiras-*`, and the command below is how to tell rather than this
paragraph, which said *holds one entry* for as long as it took the file to grow. The paragraph above generalises: *reaches paint* and
*reaches a captured frame* are different questions, and only the second is the
one the gate is asking.

So the check is the same one command, pointed at the club the capture actually
photographs rather than at the file:

```sh
git show -U0 <sha> -- src/data/club-reddit.ts | grep -cE '^[+-][^+-].*"1769"'   # the CAPTURED club
```

**Which club that is has to be read, never assumed** — the captures name
Palmeiras while the seed is led by Flamengo, so the club a spec opens with
`openClubAt(page, 1)` and the club in `clube-palmeiras-*.png` are two different
clubs, and a curated file covering only the first reaches no capture at all.
That asymmetry is what made the author's reading wrong while every word of the
reasoning around it was right.

**A rendering change accounted for by a trailer is the rarer case and stays
rare.** The bar is unchanged and is not *the diff looked small to me*: the
render is genuinely unreachable from every committed frame, and it is
established by naming the frame, not by reading the component.

**Count the directory rather than this paragraph.** It said sixteen for as long as there
were sixteen, `partida-554977-{light,dark}` made it eighteen without anything here
noticing, and `painel-palmeiras-{light,dark}` made it twenty. On 2026-09-13
`clube-palmeiras-mobile-{light,dark}` (`af3f134`) and three more clubs' pages,
`clube-{sao-paulo,botafogo,chapecoense}-{light,dark}` (`e736704`), made it
**twenty-eight** — and this paragraph went on saying twenty for two days, through a
re-shoot of all 28 (#629). A number in prose has no gate on it — this one has now been
wrong three times, and the last two times it was wrong in a paragraph telling you it
would be.

**Ten of the twenty-eight can no longer be relied on to come back byte-identical, and this
paragraph has now said fewer than the truth five times.** Six vary for three unrelated
reasons on three different clocks; the other four vary because somebody else's server
decides to. **Four of those five understatements were the count rising underneath the
line — a feature landing, or a re-shoot measuring something nobody had predicted. The
fifth, this one, was a plain miscount**, and the sentence that used to stand here denied
it could be: it read *"never because anyone miscounted"*. What slipped was the **unit**.
The bullets below count in **pairs** — "the two partida pairs", "the three above" — while
this header counts in **images**, and *eight* is exactly what you get by reading that last
bullet as two images instead of the four it names. So re-derive it from what the pages
render rather than trusting the number here:

- **The desktop Classificação pair, per deploy.** `fullPage` is `!mobile && route === "/"`,
  so it photographs the whole page — including the **Rodapé**, whose Saúde do serviço
  prints `Versão`, `Compilado` and `No ar desde`. All three move on every deploy.
  `bb223e2` is where that started, and `0719e73 Re-shoot at bb7a2ec: sixteen captures,
  zero pixels moved` is an outcome that can no longer occur.
- **The Ao vivo pair, per minute.** `countdownLabel` prints "Começa em 20h37" against a
  live fixture list, so the label is different every time the page is drawn. This was
  found by two sessions refreshing the set within a minute of each other: 16 of their 18
  images were byte-identical and the two Ao vivo ones were not. The difference is three
  bands 14px tall in a column 10px wide — the minute digits of the three nearest kickoffs,
  and nothing else on the page. Fixtures more than a day out read "Começa em 1 dia" and do
  not move, which is why the band is three rows and not six.

- **The estádio pair, per reading.** `StadiumWeather` prints a temperature, a sensação, a
  umidade, a vento and the instant it was read — "Leitura das 23:03, do Open-Meteo" — so the
  card is different on any two captures far enough apart for the 15-minute cache to turn
  over. This joined the list with the weather itself, in #240, and was found by re-shooting
  rather than by anyone predicting it.

- **The two partida pairs, on nobody's clock at all** — and these are a different kind
  from the three above, which is why they are worth more than the count they add. The
  **Melhores momentos** facade hotlinks its thumbnail from `img.youtube.com`, so those
  bytes are a third party's to re-encode whenever they like. Measured on the #475
  re-shoot: `partida-554951-{light,dark}` and `partida-554977-{light,dark}` each differed
  in a **32x32 px** square with a **maximum channel delta of 10** and a mean of 1.9 —
  inside the ge tv channel avatar, invisible to a reader, with the layout and every value
  on the page unchanged.

  **The distinction matters more than the number.** The six above move *by construction*
  and on a schedule you can name — per deploy, per minute, per reading — so two shoots far
  enough apart are **expected** to differ. These **four** — two pairs, and counting them as
  two images is what put *eight* in the header above — may come back identical any number of
  times and then not, with nothing on our side having changed and nothing to predict it
  from. So they do not belong in the "expected to disagree" set below; they belong in a
  set of their own: **a difference here is not automatically real, and confirming it means
  measuring the delta rather than trusting that the bytes moved.** A 32x32 patch at delta
  10 is noise; the same image moving by a legible amount is not.

All three of the *clocked* ones are the same lesson at different speeds, and the Ao vivo
one is the sharpest: the
Classificação pair moves only when something shipped, the estádio pair when Open-Meteo is
re-read, while Ao vivo moves while you are looking at it. **Two refreshes of one build are
expected to disagree on those six images**, and *may* disagree on the four partida ones.
Disagreeing on any of the other eighteen is a real difference and worth reading.

**The eight clube captures added on 2026-09-13 are stable, and that was measured rather
than read off `ClubView`.** They were shot three times from production against one build,
`bb2b1d1`, with the live sha read before and after every run: twice back to back
(17:28:10–17:29:46Z on 2026-09-15) and once sixteen minutes later (17:45:01–17:46:06Z),
long enough for a 15-minute cache to turn over. All 24 comparisons came back
byte-identical. The instrument could have said otherwise — every capture logged a fresh
write, and the first run differed from the committed images by #635's share button — so
identity here is not a stale file copied three times.

Opening the frames says why. The desktop crop ends at *Artilheiros do clube*, above the
thumbnails `ClubVideos` hotlinks from `img.youtube.com`, and the mobile one at the
*Painel do clube* band, so neither holds a thumbnail, a countdown, a weather reading
or the Rodapé. The mobile crop ended at the *Últimos resultados* heading until #641's X
handle added a line to the link row, which is the crop sentence below arriving from above:
a section that grows pushes the next one out of the frame. **So the set is ten volatile and eighteen stable.** Two things the
measurement does not reach. **A matchday**: the position, the points and *Próximo jogo*
follow live standings and move mid-build while a club plays — the exposure `jogos` and
`classificacao-mobile` already carry and are counted stable with. And **the crop**: it
stops at the last section fitting in 1080 CSS px, so a section removed above the club
page's lists could pull the video thumbnails into frame and put these images in the
partida pairs' set. Re-measure then, rather than trusting this paragraph.

**That "twelve" has now been wrong twice, and the second time is the instructive one
because the repair itself looked like it closed.** The first was staleness from the era of
eighteen captures, where `6 + 12 = 18` sat here through every re-shoot. The repair took the
header to *eight*, and `8 + 12 = 20` **balances** — which is precisely why nobody looked
again. A total that adds up is not a total that is right: the header was already short by
two, because the partida bullet names two *pairs* and the header counted them as two
*images*. Ten volatile and ten stable is what the enumeration has said all along.

**It was caught from the data rather than from the prose**, and by a session that had no
stake in this paragraph: re-shooting all twenty against one build, **six** came back
byte-identical — `classificacao-mobile-{light,dark}`, `jogadores-{light,dark}`,
`jogos-{light,dark}` — and fourteen moved, of which four were a real appearance change.
Fourteen minus four is ten, reached without reading a word of the list above. Two
independent routes to the same number is what makes this a correction rather than a
re-count.

Worth keeping from that measurement: **`classificacao-mobile` does not move while the
desktop pair does**, which is not noise and is already implied by the first bullet —
`fullPage` is `!mobile && route === "/"`, so only the desktop capture photographs the
Rodapé and its sha. The bullet is right as written; it was only ever the total that failed
to close. **A number repaired once is not a number that stays repaired** — this file says
that about the sitemap a thousand lines up, and has now demonstrated it about itself.
**Count the directory, and count the bullets in images.**

**Those same six captures' CAPTIONS rot too — the six on clocks, and not the two partida
ones, whose delta of 10 changes no value a caption could state — and that is a different
cost from the byte-noise above.** The list is framed as image reproducibility — two
shoots of one build disagree, and that is a nuisance. A caption describing values no
longer in the frame is a defect, and the two sit under one heading.

**A caption is true of its own image and stays true; it goes false at the re-shoot.**
Alt text describes a picture, and the picture never changes once committed — so
nothing is wrong on the day the sky changes. What happens is that the *next* frame
carries different values, and the sentence beneath it was written for the last one.
The obligation therefore lands on whoever shoots, in exactly the case nothing will
ask them: **the frame changed with the sky rather than with an appearance-path
commit, so no commit exists for the gate to enumerate.** That is the cut, and it is
not live-versus-static:

    weather, Ao vivo fixtures, standings   live upstream     no commit, gate blind
    scorers and minutes                    src/data/goals    watched path, listed

The second row is not hypothetical — `sync-goals` gave `554977` its minutes, the
gate duly listed it, and that is how `goals.spec.ts`'s pinned "minuteless fixture"
broke. Those captions rot as well, and something can see them coming. For the first
row nothing ever will.

**The rule that does not follow is "quote fewer live values", and the evidence
against it is the commit that discovered the problem.** #296 found the estádio
caption describing *"um ícone de nuvem, 22 °C, «Nublado»"* against a frame reading
sun, 26 °C, *"Céu limpo"* — and the careful response, from a session that had just
learned this, was to write **more**: three quoted values became six, gaining the
sensação, the umidade and the vento. Measured eight minutes after that merged, four
of the six already read differently upstream. **That does not make the caption false**
— the image still shows what it says, and reading it as false is the alarming
misread this file warns about elsewhere. What it measures is the re-write cost at
the next shoot, which #296 doubled. Trimming it back would also reverse house
precedent: `eb628f0` deliberately rewrote captions to describe what is *in the
frame*, and the Ao vivo caption names a live *"Bahia 3 × 2 Internacional"* while the club
caption names *"1º lugar, 52 pontos, 25 jogos, saldo +24 e 69% de aproveitamento"*. A rule that strips those needs a
better argument than the estádio card provides.

**And do not read the dark captions as the drift-proof half.** `estadio-maracana-dark`
says *"o mesmo cartão do clima com a hora da leitura"*, which looks like somebody
choosing stable phrasing and is not: **every** dark caption in the README says "the
same X", because it describes a repeat of the light one. The asymmetry is real and
that explanation of it is wrong — it is a property of being second, not a technique
to copy.

Nothing automated is affected — `check-screenshots.sh` compares appearance *sources*
between CAPTURED's sha and HEAD and never compares image bytes. What is lost is a **human**
signal: "classificacao-light.png changed" used to mean the table looks different, and now
means a deploy happened, on the two most information-dense images in the set. Accepted
rather than fixed, because the alternatives all give up something real — the rodapé is in
that frame deliberately, and the README alt text describes it. Where an edit *provably* cannot reach a paint, say so instead:

```
Screenshots-unaffected: <why no rendered pixel can change>
Screenshots-unaffected: <sha>: <why>   # for a commit already on main
```

The reason is required, and is printed on every run, green or red — a claim nobody reads is
the thing this replaced. Nothing verifies it. **"It looks the same to me" is a refresh, not
a trailer**; reach for it only when the edit cannot reach a paint at all.

**A trailer used to be unable to survive its own merge, which halved what this
paragraph promised.** The gate enumerated merge commits alongside the topic commits they
land, and a merge made from the GitHub button has nowhere to carry a trailer — so it
credited the claim, printed the reason, then flagged the identical edit again under the
merge sha. #205, #202 and #217 all hit it, and the effect was that a trailer *deferred* a
re-shoot rather than removing it. Fixed: a merge whose **combined** diff over the
appearance paths is empty introduced nothing of its own and is skipped, `git show --cc`
being git's own statement of that. An **evil merge** — a conflict resolved by hand into an
appearance path — is exactly what `--cc` does print, so it stays enumerated and still owes
a trailer or a capture. That is why the fix is not `--no-merges`, which is simpler and
blinds the gate to the one merge that can genuinely change a pixel.

**The gate was already covered, and the coverage had a gap exactly where the defect
was** — which is a more useful fact than "it had no tests", and it is what a first pass
at this got wrong by not looking. `tests/check-screenshots.test.ts` builds real git
histories in temp directories and runs the real script; it had a case for the *catch-up*
merge and none for the merge that lands a pull request, one test apart. The defect lived
in the gap between two adjacent cases, through three pull requests, in a script everybody
had read.

Three cases now close it, and each earns its place against a specific wrong fix: a trailer
surviving its merge, an untrailered change still refused when a merge lands it, and an
**evil merge** still refused. Mutating the fix to `--no-merges` passes the first two and
fails the third, which is the whole argument for the combined-diff test.

**The first fixture written for the merge case passed against the unfixed gate**, because
it merged a branch into a main that had not moved: the merge is then TREESAME to its topic
parent on the appearance paths, git's history simplification never lists it, and there is
nothing for the gate to get wrong. The defect needs a merge differing from *both* parents,
which is what a shared checkout produces daily and a lone branch never does — the same
trap the catch-up case already records about forking before the merge, one topology
further on. **A fixture simpler than this repository can be too simple to contain the
bug.**

**It must sit in the message's *last* paragraph, beside `Co-Authored-By:`.** Git parses
trailers out of the final paragraph only, so one separated from that block by a blank line
is not a trailer at all — `git interpret-trailers --parse` prints only the co-author, the
gate honours nothing, and the commit is listed as owing a capture. Nothing says so: the
message reads correctly to a person, the wording is exactly what the gate documents, and
the claim is silently dropped. It happened on `6a876d9`. Check with:

```sh
git log -1 --format=%B <sha> | git interpret-trailers --parse
```

Wrapping across lines is fine — the script unfolds it. It is the blank line that kills it.

**It has to be a real git trailer, and a malformed one is dropped in silence.**
This is the failure mode to know, because it is invisible from both ends: the check
collects trailers with `%(trailers:key=Screenshots-unaffected,...)`, and git parses
trailers **only in the commit message's last paragraph**. A trailer git does not parse
is never collected, and since the run only prints trailers it *has* collected, nothing
anywhere says the claim was ignored. The gate simply reports the commit as
unaccounted, which reads as "nobody wrote one".

Two shapes break it independently, and M6's `c842640` had both — its trailer never
once reached the check, and #172's refresh went red on the next run because of it:

```
Screenshots-unaffected: a reason that wraps onto
a second line with no indent.                    <- DROPPED: unindented continuation

Screenshots-unaffected: a reason, then a blank line.

Co-Authored-By: …                                <- DROPPED: not the last paragraph
```

Both forms below parse, verified in a throwaway repo rather than reasoned out — a
continuation indented by any whitespace folds, and the trailer may sit *beside*
`Co-Authored-By:` so long as no blank line separates them:

```
Screenshots-unaffected: a reason that wraps onto
  a second line, indented.
Co-Authored-By: …
```

Check it rather than trusting the shape, in the commit you are about to push:

```sh
git log -1 --format='%(trailers:key=Screenshots-unaffected,valueonly,unfold)'
```

Empty output means the claim does not exist as far as the gate is concerned. The
retroactive `<sha>:` form is the fix once the commit is on main and cannot be amended.

**A capture waits for the page to stop moving, and that is not a nicety.**
Playwright's `click` moves the pointer to the element and leaves it there, so the
Jogadores shot — the one capture that clicks anything — sat on the club summary
with `STATE_LAYER`'s 8% veil fading in over 200ms, and photographed an arbitrary
point in that fade. Measured at alpha 0.008 against a settled 0.08. Two
consequences, and the second is the one that matters: the image was **not
reproducible** (three captures of one build against one payload all differed
across the summary row, so every re-shoot committed that band as noise), and it
documented the page **as it looks with a cursor resting on it**, which is not
what a reader sees. `settle` now parks the pointer at `(0, 0)` — the bare sticky
header, which carries no state layer — and awaits every running transition.

**It awaits `CSSTransition` only, never everything `getAnimations()` returns.**
`animate-pulse` on the Ao vivo live indicator is a `CSSAnimation` with infinite
iterations whose `finished` promise never resolves; awaiting it hangs the capture
for the full timeout on exactly the page where a live match is the thing worth
photographing. Verified both ways — awaiting all animations hung, the filtered
form settled in 2ms.

**A capture is cropped at the last section that fits in 1080 CSS px, so content ADDED ABOVE
a section evicts that section from the frame** — silently, and with no gate anywhere that can
see it. Both halves of the 2026-08-30 re-shoot hit it: `Gols` inside the scoreboard pushed the
campanha *and* the melhores momentos out of `partida-554977`, which lost **581px**, and the
clima card pushed the fixture list out of `estadio-maracana`, which grew 33px while losing the
list beneath. The page is fine in a browser both times; only the photograph lost it. So a
capture that gets **shorter** is content leaving the frame and one that gets **longer** is
content arriving, and both oblige a re-read of the alt text — record the predecessors'
heights before overwriting, because afterwards there is nothing left to compare against.

`scripts/screenshot.ts` deliberately does **not** honour the trailer. It refuses a capture
whose build differs from HEAD on any appearance path, which stays a plain file comparison —
its refusal writes to `docs/screenshots/local` and self-clears on the next deploy, so it is
a nuisance where the gate was a deadlock.

**The weekly broadcast sync opens a pull request; it does not push to `main`.**
`sync-broadcasts.yml` commits the refreshed `broadcasts.ts` to
`automation/sync-broadcasts` and opens a pull request from it, adding to the
open one rather than replacing it when a previous week's is still waiting — the
sync merges across the window it is asked about, so restarting from `main` each
week would drop whatever had aged out of that window.

**That pull request arrives with no checks on it, and that is the token rather
than a fault.** GitHub starts no workflow run for an event raised with the
repository's own `GITHUB_TOKEN`, so neither the push nor the pull request
triggers `ci.yml`. The gate is inside the sync's own run instead: it lints and
unit-tests the written file and fails the job rather than committing. Two things
follow — an empty commit from a person is what gets the full suite to run on it,
and **branch protection requiring `check` and `e2e` would make it permanently
unmergeable** without an exemption or a different token. `docs/cicd-plan.md`
gaps E and F carry that coupling.

`scripts/rehearse-broadcast-sync-pr.sh` is that workflow's only behavioural
coverage and `check` runs it, beside the two host-script rehearsals. It matters
more than the shellcheck it sits next to: the workflow is **scheduled**, so no
pull request can exercise it, and a green tick on a change to that file says
only that the other workflows still pass. It extracts the steps from the shipped
YAML rather than holding a copy — and refuses loudly when it cannot find them,
because a rehearsal that quietly tests nothing reports as a broken workflow
rather than as a broken rehearsal.

**Dependabot keeps the pins current**, weekly on Monday, for `github-actions`
and `npm` (`.github/dependabot.yml`). Actions are grouped into one pull request;
npm's minor and patch updates are grouped while a **major arrives on its own**,
because `express`, `vite` or `react` crossing a major is a change to read rather
than one to approve. Monday rather than Tuesday, because `sync-broadcasts`
already runs Tuesday and two automated pushes on one morning is how the second
gets merged unread beside the first.

It exists because the manual alternative was measured: a node20 deprecation
warning on the deploy of `35a7074` cost a survey of six actions across three
workflows, two release-note readings, a PR, a merge and a deploy — all of which
Dependabot would have pre-empted. Note the rule below is what makes it work
without further configuration: a Dependabot pull request gets a read-only token
and no secrets, and since CI needs neither, it sees the same signal as any other.

**CI needs no secrets.** Both jobs run against the frozen snapshot with no token,
so a red build always means the code broke — never that the upstream had a bad
minute or the free-tier budget ran out. Keep it that way: do not add
`FOOTBALL_DATA_TOKEN` as a repository secret to "test the live path". If the live
mapping needs coverage, add a unit test with a captured payload.

**That sentence was true of the API and false of the crest CDN for as long as it
had been written**, and the gap is worth keeping because of how it presented.
`DISABLE_FOOTBALL_DATA` takes the *API* out of the suite; it does nothing about
`crests.football-data.org`, which all twenty clubs in `clubs.ts` hotlink and
which nothing stubbed. Same third party, same bad minute, and no token involved
— so the "no secrets" test that the paragraph rests on simply does not detect
it.

It fails in a shape that reads as a broken app rather than a slow network:
`page.goto` waits for `load`, `load` waits for images, and twenty crests against
a browser's ~6 connections per host exceeds the 30s test timeout, surfacing as
**`net::ERR_ABORTED` on the navigation** — never a failed assertion. Measured
2026-09-03 on an unmodified `main`: **85 failed / 765 passed**, clustered on
exactly the club-list pages, while CI stayed green because its path to that host
is not a workstation's.

`tests/e2e/fixtures.ts` closes it, and **fulfils rather than aborts** because
three existing assertions constrain the shape: `standings.spec.ts` reads the
crest `referrerpolicy` off the DOM *and* the `Referer` off the wire, so the
request must still be made and the `src` must stay the real external URL; a
second case there drives a **503** to prove the letter fallback, which a global
abort would raise on every page; and the images must load fast. Verified by
counting: **20 requests issued and 0 served from the network** with the stub, 20
of 20 from the network without it.

**Every spec takes `test` from that fixture, and `tests/e2e-fixture.test.ts`
refuses one that does not.** Three specs imported `test` from `@playwright/test`
directly — each for its own reason and none wrong at the time, because there was
nothing in the fixture to miss — and a fourth would have opted out of
hermeticity silently. A grep rather than an ESLint rule, for
`design-tokens-core.test.ts`' reason.
