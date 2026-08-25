import type { Highlight } from "@/src/types";

/**
 * HAND-MAINTAINED — never generated, and the sync script does not touch it.
 *
 * Links to a match's highlights, keyed by **our** match id, same as
 * `broadcasts.ts`. No provider we use exposes highlight links, so these are
 * supplied by hand.
 *
 * A match can have several: broadcasters each publish their own package, and
 * one may be longer, better, or simply still up when another is gone. The page
 * lists them all, labelled by channel, so the reader picks. When a match has
 * none, the page falls back to a YouTube *search* and says so — see
 * `highlightsSearchUrl` in `match-core.ts`.
 *
 * Rules for entries:
 * - YouTube only, over HTTPS. `isHighlightUrl` rejects anything else and that
 *   entry is dropped, so one bad line does not take the others with it.
 * - Prefer the rights-holder's own upload. A reupload can vanish or be taken
 *   down. `KNOWN_CHANNELS` in `highlight-search-core.ts` holds the ones we
 *   link, in preference order: ge tv, CazéTV, UOL Esporte.
 * - List them in that order, since it is the order the reader meets them.
 * - `channel` is the label the reader sees, so write it the way the channel
 *   writes itself: "ge tv", "CazéTV", "UOL Esporte".
 * - Any match that finished with a score, a 0-0 included — see `hasHighlights`.
 *
 * Filling this in is a script, not a chore:
 *   npx tsx scripts/find-highlights.ts --round 24 --write
 *
 * To find a match id: open the fixture in the app and read it from the URL
 * (`/partida/554975`), or run
 *   curl -s https://brasileirao.mpbarbosa.com/api/matches?round=24 | jq
 */
export const HIGHLIGHTS: Record<string, Highlight[]> = {
  // Fluminense 2 x 1 Clube do Remo, rodada 24.
  "554975": [
    { url: "https://www.youtube.com/watch?v=o-_hD5Q8f4Q", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=AgycMjd6b-I", channel: "CazéTV" },
  ],
  // Internacional 0 x 0 Atlético-MG, rodada 24.
  "554976": [
    { url: "https://www.youtube.com/watch?v=4hGzHO6domw", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=lhEf7WoBd3k", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=IDv3BmGI8M4", channel: "UOL Esporte" },
  ],
  // Palmeiras 4 x 1 Vasco da Gama, rodada 24.
  "554977": [
    { url: "https://www.youtube.com/watch?v=0ceAn6TLVtE", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=ryRpY29ySvk", channel: "UOL Esporte" },
  ],
  // Cruzeiro 2 x 1 Flamengo, rodada 24.
  "554974": [
    { url: "https://www.youtube.com/watch?v=GhV-hg9QQCY", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=nEknyMrCHuA", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=n4ySCP9iff8", channel: "UOL Esporte" },
  ],
  // Bragantino 1 x 0 Grêmio, rodada 24.
  "554971": [
    { url: "https://www.youtube.com/watch?v=R6Rqm77dgTo", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=YlLLl0sW3vI", channel: "UOL Esporte" },
  ],
  // Vitória 0 x 2 Bahia, rodada 24.
  "554979": [
    { url: "https://www.youtube.com/watch?v=5PGO-tHVAX8", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=c3U4aUuxsQk", channel: "UOL Esporte" },
  ],
  // Chapecoense 1 x 0 São Paulo, rodada 24.
  "554972": [
    { url: "https://www.youtube.com/watch?v=M7b8fdPRajk", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=MBtZ8F5t1vc", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=PF8FX02A8P8", channel: "UOL Esporte" },
  ],
  // Santos 1 x 1 Mirassol, rodada 24.
  "554978": [
    { url: "https://www.youtube.com/watch?v=ES44RDZCbv4", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=y-FVCdxoik4", channel: "UOL Esporte" },
  ],
  // Coritiba 2 x 1 Corinthians, rodada 24.
  "554973": [
    { url: "https://www.youtube.com/watch?v=X8Eid2nGSyU", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=9YHN8rP0aHU", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=KhxocmJ2j5o", channel: "UOL Esporte" },
  ],
  // Fluminense 3 x 2 Palmeiras, rodada 23.
  "554964": [
    { url: "https://www.youtube.com/watch?v=cs1ykNb9lFw", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=doROk0Tgn8g", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=AzArDSBW3vQ", channel: "UOL Esporte" },
  ],
  // Athletico-PR 1 x 1 Bragantino, rodada 23.
  "554960": [
    { url: "https://www.youtube.com/watch?v=3s1Nu7bdEHU", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=RiFSmOlrQnQ", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=XTPBFbm5U5o", channel: "UOL Esporte" },
  ],
  // São Paulo 1 x 1 Coritiba, rodada 23.
  "554967": [
    { url: "https://www.youtube.com/watch?v=CKPXBY6BEEg", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=NcUuh7bRS4s", channel: "UOL Esporte" },
  ],
  // Chapecoense 3 x 3 Bahia, rodada 23.
  "554962": [
    { url: "https://www.youtube.com/watch?v=uLzRdhxVRB8", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=gjkJwL0JhEg", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=zozJDvv0ml8", channel: "UOL Esporte" },
  ],
  // Atlético-MG 3 x 0 Grêmio, rodada 23.
  "554961": [
    { url: "https://www.youtube.com/watch?v=84Yo81jENDk", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=ISHvEUlQXMI", channel: "UOL Esporte" },
  ],
  // Vasco da Gama 0 x 3 Santos, rodada 23.
  "554968": [
    { url: "https://www.youtube.com/watch?v=m1GECiycBSU", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=zlXzjxvRB1Q", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=_QumEZ1wdf4", channel: "UOL Esporte" },
  ],
  // Mirassol 1 x 5 Flamengo, rodada 23.
  "554966": [
    { url: "https://www.youtube.com/watch?v=UvlZbUMJpSo", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=GY714RKi0AY", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=yTCGc3-LDhQ", channel: "UOL Esporte" },
  ],
  // Vitória 1 x 0 Botafogo, rodada 23.
  "554969": [
    { url: "https://www.youtube.com/watch?v=eeF8CdvLfPo", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=elfzdoDFhrQ", channel: "UOL Esporte" },
  ],
  // Corinthians 1 x 2 Cruzeiro, rodada 23.
  "554963": [
    { url: "https://www.youtube.com/watch?v=V82bH90Xm-k", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=7MfuJ1o8uIY", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=CxK9CkowQ08", channel: "UOL Esporte" },
  ],
  // Internacional 1 x 1 Clube do Remo, rodada 23.
  "554965": [
    { url: "https://www.youtube.com/watch?v=q6Sn-QgweWM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=CBL4dK2FUes", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=LkeeEZHv76g", channel: "UOL Esporte" },
  ],
  // Grêmio 2 x 1 São Paulo, rodada 22.
  "554956": [
    { url: "https://www.youtube.com/watch?v=dGhO7ah73WM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=Huf9q1wy_X4", channel: "UOL Esporte" },
  ],
  // Clube do Remo 2 x 2 Atlético-MG, rodada 22.
  "554958": [
    { url: "https://www.youtube.com/watch?v=bU0OwHAuquA", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=b9rUHLiYqhs", channel: "UOL Esporte" },
  ],
  // Coritiba 2 x 1 Chapecoense, rodada 22.
  "554953": [
    { url: "https://www.youtube.com/watch?v=3oIEjO9bWtc", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=ydZuRz3aHyM", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=n8mhilun-qo", channel: "UOL Esporte" },
  ],
  // Botafogo 1 x 1 Fluminense, rodada 22.
  "554951": [
    { url: "https://www.youtube.com/watch?v=CT9UKBvQqXM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=4nGUP-nRuvc", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=2Nl3Ra6Uu0M", channel: "UOL Esporte" },
  ],
  // Cruzeiro 3 x 1 Mirassol, rodada 22.
  "554954": [
    { url: "https://www.youtube.com/watch?v=pxnpDWx-FDY", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=ouSGlMxcjMc", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=Pq9RYsFlqT8", channel: "UOL Esporte" },
  ],
  // Bahia 0 x 0 Vasco da Gama, rodada 22.
  "554950": [
    { url: "https://www.youtube.com/watch?v=kVk_eTpxKWo", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=wZAI-M5YbUw", channel: "UOL Esporte" },
  ],
  // Palmeiras 0 x 0 Internacional, rodada 22.
  "554957": [
    { url: "https://www.youtube.com/watch?v=LZQIyoiq3DM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=6FbRkxgaoG4", channel: "UOL Esporte" },
  ],
  // Bragantino 0 x 2 Corinthians, rodada 22.
  "554952": [
    { url: "https://www.youtube.com/watch?v=N6xN_VVkOJY", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=ahWXyPxy3_c", channel: "UOL Esporte" },
  ],
  // Santos 0 x 2 Athletico-PR, rodada 22.
  "554959": [
    { url: "https://www.youtube.com/watch?v=RGtIioFgreY", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=1lGT-pTc7aU", channel: "UOL Esporte" },
  ],
  // Flamengo 2 x 0 Vitória, rodada 22.
  "554955": [
    { url: "https://www.youtube.com/watch?v=Vrk4K9a3HVc", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=x7Oxl_A86nw", channel: "UOL Esporte" },
  ],
  // Internacional 1 x 1 Flamengo, rodada 21.
  "554946": [
    { url: "https://www.youtube.com/watch?v=16f9SC_lmD4", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=XKLyyBggHVk", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=gYUL9qzoeiY", channel: "UOL Esporte" },
  ],
  // Mirassol 2 x 1 Clube do Remo, rodada 21.
  "554947": [
    { url: "https://www.youtube.com/watch?v=tu5w4Lkswgk", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=5YV5oKBtaww", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=XmviNI3-KCY", channel: "UOL Esporte" },
  ],
  // Fluminense 0 x 0 Bahia, rodada 21.
  "554945": [
    { url: "https://www.youtube.com/watch?v=hpzwgVs192M", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=XuT4XHpFHlk", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=Ocej9gbVXCI", channel: "UOL Esporte" },
  ],
  // Vitória 0 x 4 Palmeiras, rodada 21.
  "554949": [
    { url: "https://www.youtube.com/watch?v=GBflPaGdMOg", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=lpT5WfRkxtM", channel: "UOL Esporte" },
  ],
  // Corinthians 0 x 0 Athletico-PR, rodada 21.
  "554943": [
    { url: "https://www.youtube.com/watch?v=PeRYa5eKVFU", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=Cu_81MV9LyM", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=CgWZrXeTXVk", channel: "UOL Esporte" },
  ],
  // Coritiba 0 x 1 Cruzeiro, rodada 21.
  "554944": [
    { url: "https://www.youtube.com/watch?v=dHVChLbiexc", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=21adoqe6d-A", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=Ttvo_dSxuhY", channel: "UOL Esporte" },
  ],
  // Athletico-PR 2 x 0 Internacional, rodada 20.
  "554930": [
    { url: "https://www.youtube.com/watch?v=OOq9U6FPeJM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=JDF3vatmswE", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=NoltITB7fIw", channel: "UOL Esporte" },
  ],
  // Santos 2 x 2 Chapecoense, rodada 20.
  "554938": [
    { url: "https://www.youtube.com/watch?v=F3fp9y9dz6U", channel: "ge tv" },
  ],
  // Vasco da Gama 1 x 1 Mirassol, rodada 20.
  "554939": [
    { url: "https://www.youtube.com/watch?v=Bg8BIFUJsIY", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=S9pOVL3an7A", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=dgx6k70BOsM", channel: "UOL Esporte" },
  ],
  // Bahia 1 x 1 Corinthians, rodada 20.
  "554931": [
    { url: "https://www.youtube.com/watch?v=uKyki2AJmzk", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=54KPkDgv7yw", channel: "UOL Esporte" },
  ],
  // Cruzeiro 0 x 1 Botafogo, rodada 20.
  "554933": [
    { url: "https://www.youtube.com/watch?v=CVq33t_itp8", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=atf1J8PULuY", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=3q9fZX8kQcY", channel: "UOL Esporte" },
  ],
  // Bragantino 0 x 0 Coritiba, rodada 20.
  "554932": [
    { url: "https://www.youtube.com/watch?v=2R6FzBLoKDY", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=gHTh21y6OBg", channel: "UOL Esporte" },
  ],
  // Flamengo 1 x 1 São Paulo, rodada 20.
  "554934": [
    { url: "https://www.youtube.com/watch?v=SLeA4eEgRyo", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=Cu6RnZSLabI", channel: "UOL Esporte" },
  ],
  // Grêmio 1 x 1 Fluminense, rodada 20.
  "554935": [
    { url: "https://www.youtube.com/watch?v=CUjzfV15UqA", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=WoHPbLm_aY4", channel: "UOL Esporte" },
  ],
  // Palmeiras 1 x 2 Atlético-MG, rodada 20.
  "554936": [
    { url: "https://www.youtube.com/watch?v=t8cvdQv2njI", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=sFfRJ9CoCas", channel: "UOL Esporte" },
  ],
  // Clube do Remo 2 x 0 Vitória, rodada 20.
  "554937": [
    { url: "https://www.youtube.com/watch?v=hBIngbxaVCU", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=Vz7pVdVq8XM", channel: "UOL Esporte" },
  ],
  // Botafogo 2 x 1 Santos, rodada 19.
  "554921": [
    { url: "https://www.youtube.com/watch?v=VFzOlR_6Y2M", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=laU3IwtR_Ls", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=gBLrUHr0Nkc", channel: "UOL Esporte" },
  ],
  // Vitória 1 x 0 Vasco da Gama, rodada 19.
  "554929": [
    { url: "https://www.youtube.com/watch?v=UrhgubyCVno", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=7maAG0-LShI", channel: "UOL Esporte" },
  ],
  // Fluminense 1 x 1 Bragantino, rodada 19.
  "554925": [
    { url: "https://www.youtube.com/watch?v=ZFeyRKdy_zM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=gDLGDsTjcy8", channel: "UOL Esporte" },
  ],
  // Mirassol 2 x 1 Grêmio, rodada 19.
  "554927": [
    { url: "https://www.youtube.com/watch?v=15Tnr4zxa44", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=D_qYFxrgQqI", channel: "UOL Esporte" },
  ],
  // Atlético-MG 1 x 1 Bahia, rodada 19.
  "554920": [
    { url: "https://www.youtube.com/watch?v=v2yFTERw2pM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=USAcASTA6UY", channel: "UOL Esporte" },
  ],
  // Coritiba 1 x 3 Palmeiras, rodada 19.
  "554924": [
    { url: "https://www.youtube.com/watch?v=kJiakOfYwmE", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=NBRN7zFoLTE", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=PYHrJue5L-A", channel: "UOL Esporte" },
  ],
  // Chapecoense 0 x 4 Flamengo, rodada 19.
  "554922": [
    { url: "https://www.youtube.com/watch?v=oEDVzw_rr6s", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=bzI1FT3LiSU", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=6V1n9gDPzSA", channel: "UOL Esporte" },
  ],
  // Internacional 1 x 2 Cruzeiro, rodada 19.
  "554926": [
    { url: "https://www.youtube.com/watch?v=jqf66cTmhO0", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=xb16yjRXMM8", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=v4hKZqQO-JU", channel: "UOL Esporte" },
  ],
  // São Paulo 1 x 2 Athletico-PR, rodada 19.
  "554928": [
    { url: "https://www.youtube.com/watch?v=8PjCJbHwmg4", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=nk6byrIE45w", channel: "UOL Esporte" },
  ],
  // Corinthians 3 x 0 Clube do Remo, rodada 19.
  "554923": [
    { url: "https://www.youtube.com/watch?v=9vmkyRL5cQc", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=jkX3F-s5jGo", channel: "UOL Esporte" },
  ],
  // Athletico-PR 1 x 0 Mirassol, rodada 18.
  "554910": [
    { url: "https://www.youtube.com/watch?v=8lbPeAVz0gI", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=S0JGHfL5Ci0", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=lK3WZRdZO4Q", channel: "UOL Esporte" },
  ],
  // Flamengo 3 x 0 Coritiba, rodada 18.
  "554914": [
    { url: "https://www.youtube.com/watch?v=icZUj00VKqM", channel: "ge tv" },
  ],
  // Bahia 2 x 1 Botafogo, rodada 18.
  "554911": [
    { url: "https://www.youtube.com/watch?v=bbFlHjHBWSI", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=TKhh4t-6jqk", channel: "UOL Esporte" },
  ],
  // Grêmio 1 x 3 Corinthians, rodada 18.
  "554915": [
    { url: "https://www.youtube.com/watch?v=WOFH97geNbk", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=GVUTZJvuCFg", channel: "UOL Esporte" },
  ],
  // Santos 3 x 1 Vitória, rodada 18.
  "554918": [
    { url: "https://www.youtube.com/watch?v=GifPxCn0KFI", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=FJsVJ8TJPLE", channel: "UOL Esporte" },
  ],
  // Bragantino 3 x 1 Internacional, rodada 18.
  "554912": [
    { url: "https://www.youtube.com/watch?v=yPeTWLWtbRo", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=_BpAXK-VPuA", channel: "UOL Esporte" },
  ],
  // Palmeiras 1 x 0 Chapecoense, rodada 18.
  "554916": [
    { url: "https://www.youtube.com/watch?v=MCRRJJ4Ql3U", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=c-qN4OeAfs4", channel: "UOL Esporte" },
  ],
  // Vasco da Gama 0 x 1 Atlético-MG, rodada 18.
  "554919": [
    { url: "https://www.youtube.com/watch?v=O3_2NqTJoAs", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=5UwkcNRaOTo", channel: "UOL Esporte" },
  ],
  // Cruzeiro 1 x 1 Fluminense, rodada 18.
  "554913": [
    { url: "https://www.youtube.com/watch?v=lpwqrOgNPYQ", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=pm1CjLNZN5E", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=jATl6_xgBeI", channel: "UOL Esporte" },
  ],
  // Clube do Remo 1 x 0 São Paulo, rodada 18.
  "554917": [
    { url: "https://www.youtube.com/watch?v=dzzEDgflY2c", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=DzQFcB2eTY0", channel: "UOL Esporte" },
  ],
  // São Paulo 1 x 1 Botafogo, rodada 17.
  "554907": [
    { url: "https://www.youtube.com/watch?v=AtW3UYxInNA", channel: "ge tv" },
  ],
  // Vitória 2 x 0 Internacional, rodada 17.
  "554909": [
    { url: "https://www.youtube.com/watch?v=-NNmJweJv5U", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=aOFok2rnBOU", channel: "UOL Esporte" },
  ],
  // Grêmio 3 x 2 Santos, rodada 17.
  "554904": [
    { url: "https://www.youtube.com/watch?v=rLmbHmiD1kA", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=xNKVxOsmnqM", channel: "UOL Esporte" },
  ],
  // Mirassol 1 x 0 Fluminense, rodada 17.
  "554905": [
    { url: "https://www.youtube.com/watch?v=4S7tg7olSTc", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=7smmYeL4jH4", channel: "UOL Esporte" },
  ],
  // Flamengo 0 x 3 Palmeiras, rodada 17.
  "554903": [
    { url: "https://www.youtube.com/watch?v=CWFlRPmg9-8", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=BsA6JaeHiCg", channel: "UOL Esporte" },
  ],
  // Cruzeiro 2 x 1 Chapecoense, rodada 17.
  "554902": [
    { url: "https://www.youtube.com/watch?v=m0G62AIPD7o", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=A7aKHHRjGfE", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=h0kGGf9RvrU", channel: "UOL Esporte" },
  ],
  // Clube do Remo 1 x 2 Athletico-PR, rodada 17.
  "554906": [
    { url: "https://www.youtube.com/watch?v=GolF2cvoBJ8", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=8mRd4wbQt9M", channel: "UOL Esporte" },
  ],
  // Corinthians 1 x 0 Atlético-MG, rodada 17.
  "554900": [
    { url: "https://www.youtube.com/watch?v=2AOGyqorZmw", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=yjyMy4XWRRk", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=ezIBovaOJw4", channel: "UOL Esporte" },
  ],
  // Vasco da Gama 0 x 3 Bragantino, rodada 17.
  "554908": [
    { url: "https://www.youtube.com/watch?v=bkd8yda04fc", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=GC_m7kzy5DU", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=1asUOlzbZJo", channel: "UOL Esporte" },
  ],
  // Coritiba 3 x 2 Bahia, rodada 17.
  "554901": [
    { url: "https://www.youtube.com/watch?v=Iz3K3TcXSYU", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=OXhQBpdBv08", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=qOr340kTmV8", channel: "UOL Esporte" },
  ],
  // Atlético-MG 3 x 1 Mirassol, rodada 16.
  "554891": [
    { url: "https://www.youtube.com/watch?v=2HSvNtRIDEg", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=WNlZy-T-fmk", channel: "UOL Esporte" },
  ],
  // Internacional 4 x 1 Vasco da Gama, rodada 16.
  "554897": [
    { url: "https://www.youtube.com/watch?v=9EH7-xec1Qw", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=BFhouOcq0L8", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=FXw7BOiCH9c", channel: "UOL Esporte" },
  ],
  // Fluminense 2 x 1 São Paulo, rodada 16.
  "554896": [
    { url: "https://www.youtube.com/watch?v=a-_UDi8ue68", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=4NGuckhoTqM", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=m0GovgkuXtk", channel: "UOL Esporte" },
  ],
  // Palmeiras 1 x 1 Cruzeiro, rodada 16.
  "554898": [
    { url: "https://www.youtube.com/watch?v=N2O7jnmAtdo", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=BNlNbuG4n2s", channel: "UOL Esporte" },
  ],
  // Santos 0 x 3 Coritiba, rodada 16.
  "554899": [
    { url: "https://www.youtube.com/watch?v=WBX9dRYnm3s", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=XamDZ6-9BW4", channel: "UOL Esporte" },
  ],
  // Bahia 1 x 1 Grêmio, rodada 16.
  "554892": [
    { url: "https://www.youtube.com/watch?v=T4VswpZOLE0", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=2S0TTpr9Hx4", channel: "UOL Esporte" },
  ],
  // Botafogo 3 x 1 Corinthians, rodada 16.
  "554893": [
    { url: "https://www.youtube.com/watch?v=tLE4ZPBQMO4", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=8bMk3zybqjA", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=hwAVIZBzt74", channel: "UOL Esporte" },
  ],
  // Bragantino 2 x 0 Vitória, rodada 16.
  "554894": [
    { url: "https://www.youtube.com/watch?v=MebqRPr_ZoU", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=VZ3V_uZYIUs", channel: "UOL Esporte" },
  ],
  // Chapecoense 2 x 3 Clube do Remo, rodada 16.
  "554895": [
    { url: "https://www.youtube.com/watch?v=cV-6am8eVnM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=3WQHSTg-4P4", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=glrx0DYYZDI", channel: "UOL Esporte" },
  ],
  // Athletico-PR 1 x 1 Flamengo, rodada 16.
  "554890": [
    { url: "https://www.youtube.com/watch?v=NGvbqX9u9dU", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=UdmS_uc94_E", channel: "UOL Esporte" },
  ],
};
