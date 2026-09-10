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
    // **The 26ª render, REPLACING `doMq2ELvtrc` (the 25ª)** — the same
    // substitution Palmeiras took one entry down, for the same reason and on
    // the same grounds: the two are one drawing at two moments, and a club page
    // offering both would ask a reader to pick a rodada, which is not a question
    // the section poses anywhere else. `89d3cb2` redrew this along with the
    // other 130 artefactos.
    //
    // The superseded video is still on the channel — nothing here can unlist it,
    // since this app holds only `youtube.upload` and `videos.update` refuses
    // that scope. It is a Studio action.
    {
      id: "Vdz1qJwHYYc",
      title: "Fluminense: 3º ao 6º em 26 rodadas, a campanha mais confinada da Série A",
      channel: "Marcelo Barbosa",
    },
  ],

  // Palmeiras, and the one club carrying two entries. They are not a duplicate
  // of each other: the velas is about this club and appears under this code
  // alone, while the campanha render is a comparação and sits here *and* under
  // Flamengo below — see the note on repetition above. The velas leads because
  // it is the club's own season; the comparação is about a pair this club
  // happens to be half of.
  //
  // **The velas is the 26ª render and REPLACES the 25ª (`xc8kDALBFnM`)**, which
  // `89d3cb2` redrew along with the other 130 artefactos. It is a replacement
  // rather than a second entry because the two are one drawing at two moments:
  // a club page offering both would be asking a reader to pick a rodada, which
  // is not a question the section poses anywhere else. The superseded video is
  // still on the channel — nothing here can unlist it, since this app holds
  // only `youtube.upload` and `videos.update` refuses that scope.
  //
  // Note the title carries no rodada, unlike the five below. That is the copy
  // in `velas-palmeiras-youtube.md` as `89d3cb2` rewrote it, not a transcription
  // choice: this file only ever writes oEmbed's own string.
  "1769": [
    {
      id: "vYD1n_TiXYA",
      title: "Palmeiras liderou 19 rodadas e perdeu a ponta: a campanha em velas",
      channel: "Marcelo Barbosa",
    },
    {
      id: "8Kr9MLphoEc",
      title: "Palmeiras × Flamengo: a campanha rodada a rodada do Brasileirão 2026 (até a 25ª)",
      channel: "Marcelo Barbosa",
    },
  ],

  // Flamengo, and the second club to carry two entries — for exactly the reason
  // Palmeiras does, and in the same order. The velas is about this club alone
  // and sits under this code only; the comparação is about a pair this club
  // happens to be half of, and repeats under Palmeiras above. The velas leads
  // because it is the club's own season.
  "1783": [
    {
      id: "vU4ntqwfm2M",
      title: "Flamengo assume a ponta na 26ª: a campanha em velas do Brasileirão 2026",
      channel: "Marcelo Barbosa",
    },
    {
      id: "8Kr9MLphoEc",
      title: "Palmeiras × Flamengo: a campanha rodada a rodada do Brasileirão 2026 (até a 25ª)",
      channel: "Marcelo Barbosa",
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
  "1768": [
    {
      id: "bPUhuQ7w7Pw",
      title: "Athletico-PR: 10 rodadas invicto e o 3º lugar até a 26ª rodada",
      channel: "Marcelo Barbosa",
    },
  ],

  // Atlético-MG.
  "1766": [
    {
      id: "tEvdFjdFKRU",
      title: "Atlético-MG em velas: fecha entre o 8º e o 17º até a 26ª rodada",
      channel: "Marcelo Barbosa",
    },
  ],

  // Bahia.
  "1777": [
    {
      id: "wmT_kLbpKn4",
      title: "Bahia em velas: 10 empates, o maior número do Brasileirão até a 26ª",
      channel: "Marcelo Barbosa",
    },
  ],

  // Botafogo. Its title carries no rodada either, for `velas-palmeiras`' reason.
  "1770": [
    {
      id: "X-Ly45in7qc",
      title: "Botafogo: do 1º ao 13º, a segunda maior queda do Brasileirão em velas",
      channel: "Marcelo Barbosa",
    },
  ],

  // Bragantino. Code 4286 rather than a 17xx like its neighbours — the club
  // entered the division later, and the id is upstream's, never ours to tidy.
  "4286": [
    {
      id: "wPcIydfzJZU",
      title: "Bragantino liderou na 2ª e fechou em 9º: a campanha em velas até a 26ª",
      channel: "Marcelo Barbosa",
    },
  ],

  // Chapecoense.
  "1772": [
    {
      id: "dsqz7J0pcgA",
      title: "Chapecoense: 14 derrotas em 25 jogos, a campanha em velas até a 26ª",
      channel: "Marcelo Barbosa",
    },
  ],

  // Clube do Remo. Code 4287, beside Bragantino's 4286 rather than in the 17xx
  // block, for that entry's reason: the id is upstream's.
  "4287": [
    {
      id: "4FmqjHMkRlE",
      title: "Clube do Remo: nunca fechou acima do 16º em 26 rodadas | Brasileirão",
      channel: "Marcelo Barbosa",
    },
  ],

  // Corinthians — 1779, and NOT Coritiba below. The two report the same
  // `tla: "COR"`, which is the collision this file's own header names as the
  // reason the key is the upstream numeric id; a velas filed by abbreviation
  // would put one club's season on the other's page. The codes were read from
  // `clubs.ts` rather than derived.
  "1779": [
    {
      id: "RgYGW3XIdYI",
      title: "Corinthians em velas: do 5º ao 17º até a 26ª rodada do Brasileirão",
      channel: "Marcelo Barbosa",
    },
  ],

  // Coritiba — 4241, the other half of that collision.
  "4241": [
    {
      id: "Ke9ccxusaeQ",
      title: "Coritiba em velas: do 16º ao 7º até a 26ª rodada do Brasileirão",
      channel: "Marcelo Barbosa",
    },
  ],

  // The six below are the third batch through `npm run upload-video`, and each
  // is again one club's own campanha em velas through the 26ª — so each sits
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
  // the 26ª — which is what its title names and what the velas draws.
  "1771": [
    {
      id: "nOzTbO2YYrs",
      title: "Cruzeiro: do 20º ao 6º em 26 rodadas, a campanha em velas",
      channel: "Marcelo Barbosa",
    },
  ],

  // Grêmio — 1767, and the one title in the file that names a number of JOGOS
  // rather than of rodadas, because this club has two fixtures in arrears: 24
  // played inside 26 rodadas. The velas draws that as two rounds the club did
  // not play, which `rank-candles-core.ts` renders hollow rather than grey.
  "1767": [
    {
      id: "KwEJKDlZhEA",
      title: "Grêmio em velas: 28 pontos em 24 jogos, com partidas em atraso",
      channel: "Marcelo Barbosa",
    },
  ],

  // Internacional — 6684, a code outside the 17xx block like Bragantino's and
  // Clube do Remo's, and upstream's rather than ours to tidy. Ten empates is
  // the most of any club in this batch, which is the fact its title leads with.
  "6684": [
    {
      id: "1ogVcWlYPYk",
      title: "Internacional: 10 empates e 5 vitórias em 26 jogos, a campanha em velas",
      channel: "Marcelo Barbosa",
    },
  ],

  // Mirassol — 4364. Its title states a subtraction rather than a range: the
  // club's best fechamento was 4º and it ends 16º, and 12 is that difference.
  "4364": [
    {
      id: "GXk_VFdV8Uw",
      title: "Mirassol: do 4º ao 16º, 12 posições perdidas | Brasileirão em velas",
      channel: "Marcelo Barbosa",
    },
  ],

  // Santos — 6685, beside Internacional's 6684 and not in the 17xx block, for
  // that entry's reason. Its campanha never closes outside 12º–18º, which is
  // the "sem movimento" the title names — the narrowest band in this batch.
  "6685": [
    {
      id: "qZof-bgho5E",
      title: "Santos em velas: 12º ao 18º em 26 rodadas, uma campanha sem movimento",
      channel: "Marcelo Barbosa",
    },
  ],

  // São Paulo — 1776. The `tla` is `PAU` and not `SAO`, which `CLAUDE.md` names
  // as a live mismatch between upstream's abbreviation and the local seed; the
  // numeric code is what keeps this entry on the right page regardless.
  "1776": [
    {
      id: "pQ85KZWH2_4",
      title: "São Paulo: do 1º ao 10º em 26 rodadas, a campanha em velas",
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
