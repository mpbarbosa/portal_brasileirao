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
 * The Palmeiras × Flamengo entries were confirmed that way on 2026-09-03 and the
 * Fluminense one on 2026-09-05; every title and channel below is oEmbed's own
 * string rather than anything retyped.
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

  // Palmeiras. The campanha render is a comparação, so it sits here and under
  // Flamengo below — see the note on repetition above.
  "1769": [
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
};
