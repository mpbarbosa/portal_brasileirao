import type { ClubCode } from "@/src/types";

/**
 * HAND-MAINTAINED — the data provider carries no hymn at any tier, so these are
 * curated, like `club-instagram.ts` and `broadcasts.ts`.
 *
 * Keyed by **our** club code (the upstream numeric id), never by `tla`, for the
 * reason given there: Corinthians and Coritiba both report `COR`, and playing
 * one club's hymn on another club's page is the failure that keying on an
 * abbreviation produces.
 *
 * The value is the YouTube **video id alone**. The watch address is derived by
 * `hymnUrl` in `club-core.ts`, so the origin is written once rather than twenty
 * times — and a link copied while the video played inside a mix loses its
 * `&list=RD…&start_radio=1` instead of dropping every reader into autoplaying
 * radio.
 *
 * Every id here was confirmed against YouTube's oEmbed endpoint, which reports
 * the title and the uploading channel:
 *
 *   curl -s "https://www.youtube.com/oembed?url=https%3A//www.youtube.com/watch%3Fv%3D<id>&format=json"
 *
 * That check is not ceremony. A search for "hino do Santos oficial" returns,
 * among the club's hymn, the hymn of the *city* of Santos — same words, wrong
 * song, and nothing in the URL says so.
 *
 * Preference order, same spirit as `highlights.ts` favouring the rights-holder:
 * **Gravadora Cid**, then its auto-generated **Orquestra e Coro Cid - Topic**
 * channel — the label that recorded the canonical hymn of nearly every club —
 * then a channel whose upload is titled as the club's official hymn. A reupload
 * can vanish; the label's own cannot without the label.
 *
 * Palmeiras, Botafogo and Flamengo are not chosen by that rule: all three are
 * videos supplied by hand, and all three are the same channel. Left as given.
 * The rule exists to pick between candidates nobody has an opinion about, and
 * it yields to somebody who does.
 */
export const CLUB_HYMNS: Record<ClubCode, string> = {
  // Hino Oficial do Fluminense (Lyric Video) — Gravadora Cid
  "1765": "hE4Zk6lv2m0",
  // Hino do Atlético Mineiro (Oficial) — Orquestra e Coro Cid - Topic
  "1766": "SeERcAA-CJw",
  // HINO OFICIAL DO GRÊMIO — Gravadora Cid
  "1767": "bB6F7VIhVUY",
  // Hino Oficial do Club Athletico Paranaense — Hinos do Futebol Mundial
  "1768": "Z6-NYoaI9Gc",
  // HINO DO PALMEIRAS — golaudio
  "1769": "DiKvx0gRfaQ",
  // HINO DO BOTAFOGO-RJ — golaudio
  "1770": "n9eubiXerB8",
  // Hino Oficial do Cruzeiro (Lyric Video) — Gravadora Cid
  "1771": "CM9eHx2SV1E",
  // Hino oficial da Associação Chapecoense de Futebol — Hinos do Futebol Mundial
  "1772": "eNaYhyVrTbE",
  // HINO OFICIAL DO SÃO PAULO — Gravadora Cid
  "1776": "t50GE-hSh2M",
  // Hino do Bahia (Oficial) — Orquestra e Coro Cid - Topic
  "1777": "960Fx8gcnIY",
  // Hino Oficial do Corinthians (Lyric Video) — Gravadora Cid
  "1779": "vy9yyMN5HSA",
  // Hino Oficial do Vasco da Gama (Lyric Video) — Gravadora Cid
  "1780": "wjWig2aKcdE",
  // Hino do Vitória - Hino Oficial do Esporte Clube Vitória — Hinos do Futebol Mundial
  "1782": "XveVhtInOrM",
  // HINO DO FLAMENGO — golaudio
  "1783": "Sx86-18V3m8",
  // Hino do Coritiba (Oficial) — Orquestra e Coro Cid - Topic
  "4241": "G63BSW7sSZk",
  // Red Bull Bragantino - Hino Oficial — Vitrola Sports
  "4286": "tIAWfcA6fKg",
  // Hino Oficial do Remo — Guia de Mídia do Brasil
  "4287": "8vd8Q6SyreI",
  // Hino do Mirassol Futebol Clube ( SP ) | Oficial — Guia de Mídia do Brasil
  "4364": "yqxnaQM1Mwk",
  // HINO OFICIAL DO INTERNACIONAL — Gravadora Cid
  "6684": "AoLFJxM3deg",
  // Hino Oficial do Santos (Leão do Mar) - (Lyric Video) — Gravadora Cid
  "6685": "Mu5y4lL59l4",
};
