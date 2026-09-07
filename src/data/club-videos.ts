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
 * Fluminense one on 2026-09-05, and the six velas of the 26ª on 2026-09-07;
 * every title and channel below is oEmbed's own string rather than anything
 * retyped.
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
 * Coverage is **partial and grows by hand**, like every curated file here. A
 * club with no entry renders no section at all rather than an empty heading.
 */
export const CLUB_VIDEOS: Record<ClubCode, ClubVideo[]> = {
  // Fluminense. Unlike the comparação below, this one is about a single club:
  // the campanha read as velas, which is what `scripts/manim/velas.py` draws
  // and what the Painel already shows this club on its own page. So it appears
  // under one code, and that is the file working as much as the repetition is.
  "1765": [
    {
      id: "doMq2ELvtrc",
      title: "Fluminense em velas: a campanha rodada a rodada do Brasileirão 2026 (até a 25ª)",
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

  // Flamengo. The same video, for the same reason.
  "1783": [
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
};
