import type { ClubCode, ClubVideo } from "@/src/types";

/**
 * HAND-MAINTAINED — no provider carries a video at any tier, so these are
 * curated, like `club-hymns.ts`, `club-instagram.ts` and `highlights.ts`.
 *
 * Keyed by **our** club code (the upstream numeric id), never by `tla`, for the
 * reason those files give: Corinthians and Coritiba both report `COR`, and a
 * video about one club on another club's page is exactly what keying on an
 * abbreviation produces.
 *
 * **The value is a list, and the same video may appear under more than one
 * club.** That is not a modelling accident to normalise away — a video is about
 * whatever it is about, and a comparação naming two clubs belongs on both
 * pages. `CLUB_VIDEOS` is the mapping *club → what to show*, not *video →
 * owner*, so the id repeating is the file working.
 *
 * `id` is the YouTube **video id alone**, as in `club-hymns.ts` and for the
 * same reason: `videoWatchUrl` derives the address, so a link copied while the
 * video played inside a playlist loses its `&list=…` rather than dropping every
 * reader into the next thing YouTube felt like playing.
 *
 * `title` and `channel` are both required, and neither is decoration:
 *
 * - The **title** is the only thing telling two entries apart. This is the one
 *   place in the app where a video title is the link text — `hymnUrl`'s entry
 *   deliberately reads "Hino do clube" instead, because there the *name* of the
 *   thing is better than its title. Here there is no such name.
 * - The **channel** says whose video it is. That matters most for the entries
 *   below, which are **ours**: presenting this app's own render in the same
 *   voice as a broadcaster's package would be the failure `CONTEXT.md`'s
 *   **Melhores momentos** entry avoids under "presenting the search as an
 *   official video".
 *
 * Confirm every id through YouTube's oEmbed endpoint before writing it down —
 * it reports the title and the uploading channel, which is the only way to tell
 * a video apart from a reupload or from a different season's:
 *
 *   curl -s "https://www.youtube.com/oembed?url=https%3A//www.youtube.com/watch%3Fv%3D<id>&format=json"
 *
 * The Palmeiras × Flamengo entries were confirmed that way on 2026-09-03, the
 * first Fluminense one on 2026-09-05, six velas of the 26ª on 2026-09-07, six
 * more on 2026-09-08, six on 2026-09-09 and the last two — Vasco da Gama and
 * Vitória — on 2026-09-10; every title and channel below is oEmbed's own string
 * rather than anything retyped.
 *
 * **The 2026-09-08 and 2026-09-09 sixes, and the 2026-09-10 pair, all answered
 * 200 straight away**, with none of the 403 lag the note below records. Read
 * that as the lag being a property of the moment rather than a stage every
 * upload passes through — three clean batches do not retire the warning, and
 * one 403 still does not establish that a flip failed.
 *
 * **Coverage is all twenty clubs, and the last two came a day late because of
 * the QUOTA rather than the work.** `videos.insert` costs 1600 of the 10.000
 * units a day and `thumbnails.set` 50, so 1650 a club puts six at 9.900 and a
 * seventh out of reach — which is why Vasco da Gama (`1780`) and Vitória
 * (`1782`) waited for the 2026-09-10 reset after the 2026-09-09 six.
 *
 * **That makes the empty state unreachable from this file**, which is the half
 * worth knowing before editing a spec: every club in the division now has an
 * entry, so no real club page can show what a club with none looks like.
 * `tests/e2e/club-videos.spec.ts` used to reach it through Vasco and no longer
 * can. The rule below still holds; it is only no longer demonstrable here.
 *
 * **The 403 has a second edge: oEmbed LAGS the visibility change.** The five
 * uploaded on 2026-09-07 answered 403 at 22:09:58Z with Studio already showing
 * them `Público`, and 200 at 22:11:18Z — nothing about them had changed in
 * between. So a single 403 does not establish that a video is private; it
 * establishes that it is not servable *yet*. Read it twice before concluding a
 * flip failed, which is the alarming reading and therefore the one to check.
 *
 * **A video that is not public yet answers 403, not 404**, which is worth
 * knowing because it is the state a freshly uploaded render sits in: the
 * Fluminense entry could not be written on the day it was rendered, and the
 * check that would have "confirmed" it — pasting the id from the upload page —
 * is exactly the one this file refuses. Wait for the 200.
 *
 * **Two entries are NOT ours — `aXDwyf9NGmk` under Flamengo and
 * `ry8aUbRUqpw` under Chapecoense, each from that club's own channel.** Read the `channel` rule above in
 * both directions: it was written to stop this app's render being taken for a
 * broadcaster's package, and it is the same field that stops a club's package
 * being taken for ours. Nothing here privileges the twenty-two renders; the
 * file is *club → what to show*, and what a club publishes about itself is
 * squarely that.
 *
 * **What does NOT belong here is a match's melhores momentos**, however
 * official the channel. That has its own file, keyed by match id
 * (`src/data/highlights.ts`), its own section on the Partida page and its own
 * skill — and the club's channel publishes one per fixture, so this is the
 * likeliest wrong turn anybody takes from here.
 *
 * Coverage **grows by hand**, like every curated file here, and a promoted club
 * arrives with no entry. A club with no entry renders no section at all rather
 * than an empty heading.
 */
export const CLUB_VIDEOS: Record<ClubCode, ClubVideo[]> = {
  // Fluminense. Unlike the comparação below, this one is about a single club:
  // the campanha read as velas, which is what `scripts/manim/velas.py` draws
  // and what the Painel already shows this club on its own page. So it appears
  // under one code, and that is the file working as much as the repetition is.
  "1765": [
    // **The 27ª render, REPLACING `Vdz1qJwHYYc` (the 26ª)**, which itself
    // replaced the 25ª (`doMq2ELvtrc`) — the same substitution Palmeiras took
    // one entry down, for the same reason and on the same grounds: the two are
    // one drawing at two moments, and a club page offering both would ask a
    // reader to pick a rodada, which is not a question the section poses
    // anywhere else.
    //
    // The superseded videos are still on the channel — nothing here can unlist
    // them, since this app holds only `youtube.upload` and `videos.update`
    // refuses that scope. It is a Studio action.
    {
      id: "bqiwNjdp0KE",
      title: "Fluminense: 3º ao 6º em 27 rodadas, a campanha mais confinada da Série A",
      channel: "Marcelo Barbosa",
    },
  ],

  // Palmeiras, one of the two clubs carrying two entries (Chapecoense is the
  // other, for a different reason — see its block). They are not a duplicate
  // of each other: the velas is about this club and appears under this code
  // alone, while the campanha render is a comparação and sits here *and* under
  // Flamengo below — see the note on repetition above. The velas leads because
  // it is the club's own season; the comparação is about a pair this club
  // happens to be half of.
  //
  // **The velas is the 27ª render, REPLACING `vYD1n_TiXYA` (the 26ª)**, which
  // itself replaced the 25ª (`xc8kDALBFnM`). Same substitution rule as
  // Fluminense above: the two are one drawing at two moments, and a club page
  // offering both would be asking a reader to pick a rodada, which is not a
  // question the section poses anywhere else. The superseded videos are still
  // on the channel — nothing here can unlist them, since this app holds only
  // `youtube.upload` and `videos.update` refuses that scope.
  //
  // Note the title carries no rodada, unlike the five below. That is the copy
  // in `velas-palmeiras-youtube.md` as it stands, not a transcription choice:
  // this file only ever writes oEmbed's own string, and the 27ª's oEmbed
  // returned this exact title unchanged from the 26ª's.
  "1769": [
    {
      id: "mVabGcXrGek",
      title: "Palmeiras liderou 19 rodadas e perdeu a ponta: a campanha em velas",
      channel: "Marcelo Barbosa",
    },
    {
      id: "8Kr9MLphoEc",
      title: "Palmeiras × Flamengo: a campanha rodada a rodada do Brasileirão 2026 (até a 25ª)",
      channel: "Marcelo Barbosa",
    },
  ],

  // Flamengo, and the only club carrying THREE entries — Palmeiras and Chapecoense
  // hold two and every other code one (counted, not assumed). The two drawings of ours
  // follow Palmeiras' rule, read one step further: how much of the drawing is
  // this club, and where that ties, whether the entry repeats under another
  // code. The velas is about this club alone and sits under this code only;
  // the comparação is about a pair this club happens to be half of, and
  // repeats under Palmeiras above. The velas leads because it is the club's
  // own season.
  // REPLACING `vU4ntqwfm2M` (the 26ª) with the 27ª render — Flamengo held the
  // lead through the round the 26ª ended on and still holds it a round later,
  // which the title now says.
  //
  // **The corrida de barras is OFF this page for now, and that is a photosensitivity
  // decision rather than an editorial one.** `BnoyC7n40UM` was rendered at the old
  // 0.45 s beat and fails `scripts/manim/check-flashes.py` — 0.375 of a 10° field
  // above three flashes a second, against a limit of 0.25 — so it was made PRIVATE
  // in Studio on 2026-09-21 (oEmbed 403, a public control 200). A private id on
  // this list renders as a card for a video nobody can play, so it came off until
  // a render at `BEAT_S = 0.70` (0.098 on the round-28 render) is uploaded and its
  // oEmbed answers 200. When it returns it goes back between the two drawings
  // below, for the reasons that follow, which still hold.
  //
  // **The corrida de barras sits between those two, and it is a third kind
  // rather than a second velas**: the drawing is the WHOLE division, twenty
  // bars, with this club's row marked — `BARRAS_FOCUS=1783` in
  // `scripts/manim/barras.py`, the corte de torcedor. It earns the place on
  // the test the comparação fails: it does not repeat, because the cut was
  // made for this torcida and exists for no other club. **Its presence is
  // not a claim that the video is about Flamengo only** — its own
  // `-youtube.md` says that promising one club and delivering twenty is the
  // defect this cut has to avoid. `barras-20-clubes`, the unfocused cut of
  // the same scene, is deliberately on NO club page: it belongs to the
  // division rather than to anybody, and only a focus names an owner.
  //
  // **This entry went in once already (#654) and was reverted (#659)**, and
  // the cause was not the data: it was the first club with three cards, and
  // each card's `sr-only` suffix escaped the rail's scroll clip and widened
  // the page on mobile, which #660 fixed with `relative` on the rail. That is
  // why a third and fourth card are safe here now and were not then.
  //
  // **The club's own video is APPENDED rather than ranked**,
  // which is the honest placement rather than the tidy one: the rule above
  // ranks *drawings* by how much of the drawing is this club, and it has
  // nothing to say about a video that is not one of ours. So it goes behind
  // the drawings of ours that answer this page's own subject — the campanha
  // the Classificação and the Painel already draw, and (when the barras is
  // back) the division this club leads — and the order among the drawings is
  // theirs, not its.
  // Whoever ranks it differently should write the rule that did it.
  //
  // **It is `Flamengo TV`'s, and the club is established by ID rather than by
  // name.** The watch payload's `channelId` is `UCOa-WaNwQaoyFHLCDk7qKIw`,
  // byte-identical to the channel `src/data/club-youtube.ts` already records
  // for `1783` — the same identity-not-resemblance test `check-club-youtube`
  // applies to the handle, met here from the video's end. A title naming the
  // club would have been resemblance, and half this channel's uploads name a
  // rival in the same breath.
  //
  // **Why this video and not the week's:** it is about the club rather than
  // about a fixture or a news cycle, so it does not go stale on a page that
  // carries no date for it. A coletiva, a FLAPRESS or a bastidores is read
  // once and wrong by Saturday; a melhores momentos is not this file's at all
  // (see the note at the top). Confirmed public, embeddable, family-safe, 16:9
  // and 8m12s before it was written down, and the title and channel below are
  // oEmbed's own strings — 200 against an invented id answering 400, so the
  // 200 is evidence rather than a shape.
  "1783": [
    {
      id: "jEIhdQ9BjD0",
      title: "Flamengo lidera o Brasileirão na 27ª: a campanha em velas de 2026",
      channel: "Marcelo Barbosa",
    },
    {
      id: "8Kr9MLphoEc",
      title: "Palmeiras × Flamengo: a campanha rodada a rodada do Brasileirão 2026 (até a 25ª)",
      channel: "Marcelo Barbosa",
    },
    {
      id: "aXDwyf9NGmk",
      title: "POR QUE A CAMISA DO FLAMENGO É CHAMADA DE MANTO SAGRADO? | CORRE O TEMPO NO OLHAR #2",
      channel: "Flamengo TV",
    },
  ],

  // The five below are each one club's own campanha em velas through the 26ª,
  // rendered by `scripts/manim/velas.py` from that club's `-youtube.md` copy,
  // and they belong here for the reason the Fluminense entry gives: a velas is
  // about a single club, so it sits under one code and repeats nowhere.
  //
  // They are also the first videos on this channel uploaded through
  // `npm run upload-video` rather than by hand — which is why their titles read
  // as a headline plus a rodada where the older entries read as a description.
  // The copy is the render's own; nothing here rewrites it.

  // Athletico-PR. Not Atlético-MG below: `athletico-pr` and `atletico-mg` differ
  // by one letter and are two real clubs, which is the collision `slugify` is
  // documented against — here the codes keep them apart, 1768 against 1766.
  // REPLACING `bPUhuQ7w7Pw` (the 26ª) with the 27ª render — the round-26
  // upload of `worktree-replace-velas-videos` (2026-09-11) never made it into
  // this file before round-27 superseded it, so this entry skips straight
  // from whatever it held before to the 27ª.
  "1768": [
    {
      id: "Blritj12rmU",
      title: "Athletico-PR: 10 rodadas invicto e o 3º lugar até a 27ª rodada",
      channel: "Marcelo Barbosa",
    },
  ],

  // Atlético-MG. REPLACING `tEvdFjdFKRU` (the 26ª, itself never registered)
  // with the 27ª render.
  "1766": [
    {
      id: "a4NvONbQrag",
      title: "Atlético-MG em velas: fecha entre o 7º e o 17º até a 27ª rodada",
      channel: "Marcelo Barbosa",
    },
  ],

  // Bahia. REPLACING `wmT_kLbpKn4` (the 26ª, itself never registered) with the
  // 27ª render.
  "1777": [
    {
      id: "Lc0NIBaAr_w",
      title: "Bahia em velas: 10 empates, o maior número do Brasileirão até a 26ª",
      channel: "Marcelo Barbosa",
    },
  ],

  // Botafogo. Its title carries no rodada either, for `velas-palmeiras`'
  // reason. REPLACING `X-Ly45in7qc` (the 26ª, itself never registered) with
  // the 27ª render.
  "1770": [
    {
      id: "cGHpyZcFyqI",
      title: "Botafogo: do 1º ao 14º, a segunda maior queda do Brasileirão em velas",
      channel: "Marcelo Barbosa",
    },
  ],

  // Bragantino. Code 4286 rather than a 17xx like its neighbours — the club
  // entered the division later, and the id is upstream's, never ours to tidy.
  // REPLACING `wPcIydfzJZU` (the 26ª, itself never registered) with the 27ª
  // render.
  "4286": [
    {
      id: "md8895JaaSQ",
      title: "Bragantino liderou na 2ª e fechou em 9º: a campanha em velas até a 27ª",
      channel: "Marcelo Barbosa",
    },
  ],

  // Chapecoense, and the SECOND club carrying a video that is not ours —
  // Flamengo's `aXDwyf9NGmk` was the first, and the header's rule reads the
  // same way here: the file is *club → what to show*, and what a club
  // publishes about itself is squarely that. The velas REPLACES `dsqz7J0pcgA`
  // (the 26ª, itself never registered) with the 27ª render.
  //
  // **It is `ChapeTv`'s, and the club is established by ID rather than by
  // name.** The watch payload's `channelId` is `UC5of5voGUqec9K9JqL9al4Q`,
  // byte-identical to the channel `src/data/club-youtube.ts` already records
  // for `1772` — the same identity-not-resemblance test `check-club-youtube`
  // applies to the handle, met here from the video's end. The title does name
  // the club, and that is resemblance rather than evidence: this channel names
  // an opponent in the same breath on every bastidores it publishes.
  //
  // **It is APPENDED rather than ranked**, which is Flamengo's rule and not a
  // fresh judgement: the drawing of ours answers this page's own subject — the
  // campanha the Classificação and the Painel already draw — and there is no
  // written rule ranking a club's own package against one of ours. Whoever
  // orders it differently should write the rule that did it.
  //
  // **It is a BASTIDORES of a fixture, which is the one thing the Flamengo
  // entry argues against, and it is here on the user's instruction rather than
  // on that argument.** That comment says a coletiva, a FLAPRESS or a
  // bastidores «is read once and wrong by Saturday»; this is the bastidores of
  // `554972` — Chapecoense 1x0 São Paulo, **rodada 24**, published 2026-08-24 —
  // sitting beside a velas that reads *até a 27ª*, so it arrives three rounds
  // old on a section that carries no date. The rule is not repealed by this
  // entry: whoever drops it when it stales is doing what the rule says rather
  // than reversing a decision.
  //
  // Confirmed before it was written down: `isPrivate` and `isUnlisted` both
  // false, `playableInEmbed` true, `isFamilySafe` true, 1280×720, 14m55s. The
  // title and channel below are oEmbed's own strings — 200 against an invented
  // id answering 400, so the 200 is evidence rather than a shape.
  "1772": [
    {
      id: "K6DdI6YDJtc",
      title: "Chapecoense: 15 derrotas em 26 jogos, a campanha em velas até a 27ª",
      channel: "Marcelo Barbosa",
    },
    {
      id: "ry8aUbRUqpw",
      title: "BASTIDORES | CHAPECOENSE 1 X 0 SÃO PAULO | CAMPEONATO BRASILEIRO SÉRIE A",
      channel: "ChapeTv",
    },
  ],

  // Clube do Remo. Code 4287, beside Bragantino's 4286 rather than in the 17xx
  // block, for that entry's reason: the id is upstream's. REPLACING
  // `4FmqjHMkRlE` (the 26ª) with the 27ª render.
  "4287": [
    {
      id: "jq_7zSsUhRk",
      title: "Clube do Remo: nunca fechou acima do 16º em 27 rodadas | Brasileirão",
      channel: "Marcelo Barbosa",
    },
  ],

  // Corinthians — 1779, and NOT Coritiba below. The two report the same
  // `tla: "COR"`, which is the collision this file's own header names as the
  // reason the key is the upstream numeric id; a velas filed by abbreviation
  // would put one club's season on the other's page. The codes were read from
  // `clubs.ts` rather than derived. REPLACING `RgYGW3XIdYI` (the 26ª) with
  // the 27ª render.
  "1779": [
    {
      id: "KSR_ODmXm3Q",
      title: "Corinthians em velas: do 5º ao 17º até a 27ª rodada do Brasileirão",
      channel: "Marcelo Barbosa",
    },
  ],

  // Coritiba — 4241, the other half of that collision. REPLACING
  // `Ke9ccxusaeQ` (the 26ª) with the 27ª render.
  "4241": [
    {
      id: "VCB-hZcAPrM",
      title: "Coritiba em velas: do 16º ao 8º até a 27ª rodada do Brasileirão",
      channel: "Marcelo Barbosa",
    },
  ],

  // The six below are the third batch through `npm run upload-video`, and each
  // is again one club's own campanha em velas, now through the 27ª — so each sits
  // under one code and repeats nowhere, for the reason the Fluminense entry
  // gives. Every code was read out of `clubs.ts` rather than derived from the
  // slug, which matters twice here: Grêmio reports `tla: "FBP"` and São Paulo
  // `tla: "PAU"`, so an abbreviation would not even have looked like the club.
  //
  // Their titles read as a headline plus a figure rather than a rodada, which
  // is the copy in each `velas-<clube>-youtube.md` and not a choice made here —
  // this file only ever writes oEmbed's own string.
  //
  // **All six answered 200 straight away**, with none of the 403 lag the header
  // records. That is now twice running; read it as the lag being a property of
  // the moment rather than a stage every upload passes through, and keep the
  // warning, since one 403 still does not establish that a flip failed.

  // Cruzeiro. The one climb in this batch — 20º after the first rodada to 6º at
  // the 27ª — which is what its title names and what the velas draws.
  // REPLACING `nOzTbO2YYrs` (the 26ª) with the 27ª render.
  "1771": [
    {
      id: "s3mZFbj-N8o",
      title: "Cruzeiro: do 20º ao 6º em 27 rodadas, a campanha em velas",
      channel: "Marcelo Barbosa",
    },
  ],

  // Grêmio — 1767, and the one title in the file that names a number of JOGOS
  // rather than of rodadas, because this club has one fixture in arrears (it
  // had two at the 26ª): 26 played inside 27 rodadas. The velas draws that as
  // a round the club did not play, which `rank-candles-core.ts` renders hollow
  // rather than grey. REPLACING `KwEJKDlZhEA` (the 26ª) with the 27ª render.
  "1767": [
    {
      id: "l4Xk1gXeeXc",
      title: "Grêmio em velas: 28 pontos em 26 jogos, com partida em atraso",
      channel: "Marcelo Barbosa",
    },
  ],

  // Internacional — 6684, a code outside the 17xx block like Bragantino's and
  // Clube do Remo's, and upstream's rather than ours to tidy. Ten empates is
  // the most of any club in this batch, which is the fact its title leads
  // with. REPLACING `1ogVcWlYPYk` (the 26ª) with the 27ª render.
  "6684": [
    {
      id: "03FAincqshA",
      title: "Internacional: 10 empates e 6 vitórias em 27 jogos, a campanha em velas",
      channel: "Marcelo Barbosa",
    },
  ],

  // Mirassol — 4364. Its title states a subtraction rather than a range: the
  // club's best fechamento was 4º and it ends 15º, and 11 is that difference.
  // REPLACING `GXk_VFdV8Uw` (the 26ª) with the 27ª render.
  "4364": [
    {
      id: "CsVBZfPCbWU",
      title: "Mirassol: do 4º ao 15º, 11 posições perdidas | Brasileirão em velas",
      channel: "Marcelo Barbosa",
    },
  ],

  // Santos — 6685, beside Internacional's 6684 and not in the 17xx block, for
  // that entry's reason. Through the 26ª its campanha never closed outside
  // 12º–18º, the narrowest band in the batch; the 27ª is the round it broke
  // out, to 10º, which is what the title now leads with. REPLACING
  // `qZof-bgho5E` (the 26ª, titled "sem movimento") with the 27ª render.
  "6685": [
    {
      id: "mKMG4dMTJpg",
      title: "Santos rompe a faixa estreita e chega ao 10º na 27ª rodada",
      channel: "Marcelo Barbosa",
    },
  ],

  // São Paulo — 1776. The `tla` is `PAU` and not `SAO`, which `CLAUDE.md` names
  // as a live mismatch between upstream's abbreviation and the local seed; the
  // numeric code is what keeps this entry on the right page regardless.
  // REPLACING `pQ85KZWH2_4` (the 26ª) with the 27ª render.
  "1776": [
    {
      id: "x_hiu5F4Lvc",
      title: "São Paulo: do 1º ao 11º em 27 rodadas, a campanha em velas",
      channel: "Marcelo Barbosa",
    },
  ],

  // The two below are the fourth batch through `npm run upload-video`, and the
  // last: with them every club in the division has its own campanha em velas
  // here. They came a day after the third batch because of the quota the header
  // names, not because of anything about them — both were rendered and their
  // copy passed on the same run as the six above.
  //
  // Both answered 200 on the FIRST oEmbed read, three batches running now. The
  // header keeps its warning about the 403 lag for the reason it gives.

  // Vasco da Gama — 1780. 25 pontos em 25 jogos, exactly a point a game, which
  // is what the title leads with. 25 jogos inside 26 rodadas because the club
  // did not play the 21ª, which `rank-candles-core.ts` draws as a hollow candle
  // rather than a grey one. Two réguas: Fernando Diniz after the 3ª, and the
  // paralisação para a Copa after the 18ª.
  "1780": [
    {
      id: "XUrSeih-NPE",
      title: "Vasco em velas: 25 pontos em 25 jogos e o 17º lugar até a 26ª",
      channel: "Marcelo Barbosa",
    },
  ],

  // Vitória — 1782. Also 25 jogos in 26 rodadas, but the round it did not play
  // is the LAST one, the 26ª — so this velas ends on a hollow candle and its
  // closing card reads «sem jogo nesta rodada» where every other video shows a
  // scoreline. That is the data and not a render fault. One régua, the
  // paralisação para a Copa after the 18ª.
  "1782": [
    {
      id: "2RWACTCVIOY",
      title: "Vitória em velas: 12 derrotas em 25 jogos até a 26ª rodada",
      channel: "Marcelo Barbosa",
    },
  ],
};
