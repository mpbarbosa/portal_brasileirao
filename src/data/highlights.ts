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
  // Coritiba 2 x 2 Internacional, rodada 15.
  "554883": [
    { url: "https://www.youtube.com/watch?v=HaMLeDPBG0g", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=v3OAcZq8cns", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=xPkkWrCy_jQ", channel: "UOL Esporte" },
  ],
  // Fluminense 2 x 2 Vitória, rodada 15.
  "554884": [
    { url: "https://www.youtube.com/watch?v=9LCcESj8TJM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=ONLAnf0BELc", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=bmRVCG5Egfs", channel: "UOL Esporte" },
  ],
  // Bahia 1 x 2 Cruzeiro, rodada 15.
  "554881": [
    { url: "https://www.youtube.com/watch?v=UdxyBjMBuCI", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=keYz8aItEuk", channel: "UOL Esporte" },
  ],
  // Atlético-MG 1 x 1 Botafogo, rodada 15.
  "554880": [
    { url: "https://www.youtube.com/watch?v=kYMhNwt0EBA", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=RhqpVAqaZPw", channel: "UOL Esporte" },
  ],
  // Clube do Remo 1 x 1 Palmeiras, rodada 15.
  "554887": [
    { url: "https://www.youtube.com/watch?v=Qx-nWPclq3g", channel: "ge tv" },
  ],
  // Botafogo 1 x 2 Clube do Remo, rodada 14.
  "554871": [
    { url: "https://www.youtube.com/watch?v=b4CePw13wQk", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=4v0jmGXv7Ho", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=dfB_u2Tcj6Y", channel: "UOL Esporte" },
  ],
  // Palmeiras 1 x 1 Santos, rodada 14.
  "554877": [
    { url: "https://www.youtube.com/watch?v=9XOe8LUt8X0", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=FtKuCInPjC4", channel: "UOL Esporte" },
  ],
  // Vitória 4 x 1 Coritiba, rodada 14.
  "554879": [
    { url: "https://www.youtube.com/watch?v=9FEuJfzr6oQ", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=Y0CzrHAHbCE", channel: "UOL Esporte" },
  ],
  // Athletico-PR 0 x 0 Grêmio, rodada 14.
  "554870": [
    { url: "https://www.youtube.com/watch?v=41aeBMPwpMc", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=8icQXrTSWjQ", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=IhG8Z8hAgKw", channel: "UOL Esporte" },
  ],
  // Cruzeiro 1 x 3 Atlético-MG, rodada 14.
  "554873": [
    { url: "https://www.youtube.com/watch?v=RqBKYW_BiOM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=DM_u5z8W2co", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=SqEpBBRP8vU", channel: "UOL Esporte" },
  ],
  // Flamengo 2 x 2 Vasco da Gama, rodada 14.
  "554874": [
    { url: "https://www.youtube.com/watch?v=QBuv48EdANQ", channel: "UOL Esporte" },
  ],
  // Bahia 2 x 2 Santos, rodada 13.
  "554862": [
    { url: "https://www.youtube.com/watch?v=x1Tt6BuyLWw", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=NS-n15v9b5o", channel: "UOL Esporte" },
  ],
  // Botafogo 2 x 2 Internacional, rodada 13.
  "554863": [
    { url: "https://www.youtube.com/watch?v=vbw5qq1nuw0", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=vyxHQPmdLTw", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=jLxMVQXY_SI", channel: "UOL Esporte" },
  ],
  // Chapecoense 1 x 4 Botafogo, rodada 12.
  "554851": [
    { url: "https://www.youtube.com/watch?v=e-Pafpu-ZPQ", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=n7_twCL5Ork", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=Ev95u_dyOxY", channel: "UOL Esporte" },
  ],
  // Vasco da Gama 2 x 1 São Paulo, rodada 12.
  "554858": [
    { url: "https://www.youtube.com/watch?v=UGShnCuObDc", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=A5fJfTCiQ_4", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=cng4BTNPY-E", channel: "UOL Esporte" },
  ],
  // Vitória 0 x 0 Corinthians, rodada 12.
  "554859": [
    { url: "https://www.youtube.com/watch?v=oGScXAhbctA", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=qM4ta3wnuUQ", channel: "UOL Esporte" },
  ],
  // Cruzeiro 2 x 0 Grêmio, rodada 12.
  "554853": [
    { url: "https://www.youtube.com/watch?v=YH6oc5zF2_k", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=lTPTRutjk7A", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=45yb_r9ZlKY", channel: "UOL Esporte" },
  ],
  // Internacional 1 x 2 Mirassol, rodada 12.
  "554855": [
    { url: "https://www.youtube.com/watch?v=YuT2NBosl7Y", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=nOLZ1QxqTnI", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=KsnjHHqkH8w", channel: "UOL Esporte" },
  ],
  // Coritiba 2 x 0 Atlético-MG, rodada 12.
  "554852": [
    { url: "https://www.youtube.com/watch?v=wmFfeifZDng", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=csRJeDkrk18", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=2hQO_S2FVYU", channel: "UOL Esporte" },
  ],
  // Santos 2 x 3 Fluminense, rodada 12.
  "554857": [
    { url: "https://www.youtube.com/watch?v=ShBPsmvN1hs", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=Qcck50aOHGg", channel: "UOL Esporte" },
  ],
  // Bragantino 4 x 2 Clube do Remo, rodada 12.
  "554850": [
    { url: "https://www.youtube.com/watch?v=wsG8YJuASWc", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=FSxJLr1oOdI", channel: "UOL Esporte" },
  ],
  // Palmeiras 1 x 0 Athletico-PR, rodada 12.
  "554856": [
    { url: "https://www.youtube.com/watch?v=fM2gNGQpjnc", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=tvN8EdG5c4s", channel: "UOL Esporte" },
  ],
  // Clube do Remo 1 x 1 Vasco da Gama, rodada 11.
  "554847": [
    { url: "https://www.youtube.com/watch?v=6rJUxyC7x4A", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=iNcGqrGr9pU", channel: "UOL Esporte" },
  ],
  // Vitória 2 x 0 São Paulo, rodada 11.
  "554849": [
    { url: "https://www.youtube.com/watch?v=Yp9OCosEKCI", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=cKWQpGC43eQ", channel: "UOL Esporte" },
  ],
  // Mirassol 1 x 2 Bahia, rodada 11.
  "554846": [
    { url: "https://www.youtube.com/watch?v=cwoPLjBnDzw", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=3HQuQJ8WNu4", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=sPe9uCeSKY0", channel: "UOL Esporte" },
  ],
  // Santos 1 x 0 Atlético-MG, rodada 11.
  "554848": [
    { url: "https://www.youtube.com/watch?v=bq20fy0L7R0", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=U4ETyRMQffw", channel: "UOL Esporte" },
  ],
  // São Paulo 4 x 1 Cruzeiro, rodada 10.
  "554838": [
    { url: "https://www.youtube.com/watch?v=yrYakwTdtUw", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=NUGD4_rkgOI", channel: "UOL Esporte" },
  ],
  // Coritiba 1 x 1 Fluminense, rodada 10.
  "554834": [
    { url: "https://www.youtube.com/watch?v=ifSUyNaqEKI", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=U7M454cxW0s", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=kbskueEX9aI", channel: "UOL Esporte" },
  ],
  // Vasco da Gama 1 x 2 Botafogo, rodada 10.
  "554839": [
    { url: "https://www.youtube.com/watch?v=Nt7Ousj8jd8", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=aDPhqwn4qj0", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=8VBi3aTz6UE", channel: "UOL Esporte" },
  ],
  // Chapecoense 1 x 1 Vitória, rodada 10.
  "554832": [
    { url: "https://www.youtube.com/watch?v=ompUEqd45qk", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=lQECBYwj1NU", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=rh60dpgnlwE", channel: "UOL Esporte" },
  ],
  // Atlético-MG 2 x 1 Athletico-PR, rodada 10.
  "554830": [
    { url: "https://www.youtube.com/watch?v=S6trg50w4os", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=x-Ouit4x-6o", channel: "UOL Esporte" },
  ],
  // Flamengo 3 x 1 Santos, rodada 10.
  "554835": [
    { url: "https://www.youtube.com/watch?v=T939YUUrLB8", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=iP7FZ6txyvA", channel: "UOL Esporte" },
  ],
  // Bahia 1 x 2 Palmeiras, rodada 10.
  "554831": [
    { url: "https://www.youtube.com/watch?v=mY0NrRd7ijQ", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=ORBSL5V2yPI", channel: "UOL Esporte" },
  ],
  // Corinthians 0 x 1 Internacional, rodada 10.
  "554833": [
    { url: "https://www.youtube.com/watch?v=52iMcP983Cs", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=iIw6-r3pPqY", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=szx8I4Zq3Lo", channel: "UOL Esporte" },
  ],
  // Mirassol 0 x 1 Bragantino, rodada 10.
  "554837": [
    { url: "https://www.youtube.com/watch?v=DBwsEvxAjp4", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=KwfWCdnqdQg", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=4VFUAJnFYeE", channel: "UOL Esporte" },
  ],
  // Grêmio 0 x 0 Clube do Remo, rodada 10.
  "554836": [
    { url: "https://www.youtube.com/watch?v=NL1Sduo3Ajg", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=lsrmDNVbSbI", channel: "UOL Esporte" },
  ],
  // Botafogo 3 x 2 Mirassol, rodada 9.
  "554821": [
    { url: "https://www.youtube.com/watch?v=hdKtloqPBvw", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=_MIKO8XqLO4", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=nO5v_Lnt9oM", channel: "UOL Esporte" },
  ],
  // Internacional 1 x 1 São Paulo, rodada 9.
  "554827": [
    { url: "https://www.youtube.com/watch?v=zYLUjsOsvSo", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=CighhMUEP04", channel: "UOL Esporte" },
  ],
  // Bahia 3 x 0 Athletico-PR, rodada 9.
  "554820": [
    { url: "https://www.youtube.com/watch?v=n2TgdGUquDM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=AH4DgHowMO4", channel: "UOL Esporte" },
  ],
  // Cruzeiro 3 x 0 Vitória, rodada 9.
  "554825": [
    { url: "https://www.youtube.com/watch?v=yobWPbnNk6I", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=BnANJj9_L-s", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=V88obG0kl1g", channel: "UOL Esporte" },
  ],
  // Coritiba 1 x 1 Vasco da Gama, rodada 9.
  "554824": [
    { url: "https://www.youtube.com/watch?v=gtgxsgza04A", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=CZpz7UxpTic", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=2jIX0lRKhh0", channel: "UOL Esporte" },
  ],
  // Fluminense 3 x 1 Corinthians, rodada 9.
  "554826": [
    { url: "https://www.youtube.com/watch?v=rih5X2O1g2s", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=EPFrnvKi0hg", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=0Kdw6Olmn08", channel: "UOL Esporte" },
  ],
  // Chapecoense 0 x 4 Atlético-MG, rodada 9.
  "554823": [
    { url: "https://www.youtube.com/watch?v=a3V_OXzQg7k", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=dlEU6be1db4", channel: "UOL Esporte" },
  ],
  // Santos 2 x 0 Clube do Remo, rodada 9.
  "554829": [
    { url: "https://www.youtube.com/watch?v=mhQbQsORRjQ", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=Q-uI30IBYCU", channel: "UOL Esporte" },
  ],
  // Bragantino 3 x 0 Flamengo, rodada 9.
  "554822": [
    { url: "https://www.youtube.com/watch?v=WeelSn2yChA", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=wLtTdKuPrA0", channel: "UOL Esporte" },
  ],
  // Palmeiras 2 x 1 Grêmio, rodada 9.
  "554828": [
    { url: "https://www.youtube.com/watch?v=pPybRkhxi50", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=ITePwjgl18c", channel: "UOL Esporte" },
  ],
  // Internacional 0 x 0 Grêmio, rodada 11.
  "554845": [
    { url: "https://www.youtube.com/watch?v=MBrIjGGNlIU", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=VnEQtEqXvKY", channel: "UOL Esporte" },
  ],
  // Athletico-PR 2 x 0 Chapecoense, rodada 11.
  "554840": [
    { url: "https://www.youtube.com/watch?v=NDY9kKCD2Ck", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=vIVM2HWmOCY", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=nNHw1Deleuc", channel: "UOL Esporte" },
  ],
  // Botafogo 2 x 2 Coritiba, rodada 11.
  "554841": [
    { url: "https://www.youtube.com/watch?v=YyJJy7xzO4E", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=WngdRLgZDnA", channel: "CazéTV" },
  ],
  // Fluminense 1 x 2 Flamengo, rodada 11.
  "554844": [
    { url: "https://www.youtube.com/watch?v=_iv8a01qhFU", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=ES8Wv_gZhQI", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=J_EJJHvBTSo", channel: "UOL Esporte" },
  ],
  // Corinthians 0 x 0 Palmeiras, rodada 11.
  "554842": [
    { url: "https://www.youtube.com/watch?v=pkEilpglG1A", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=rez0Lc3DCrs", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=Z0mge6PxsIg", channel: "UOL Esporte" },
  ],
  // Cruzeiro 2 x 1 Bragantino, rodada 11.
  "554843": [
    { url: "https://www.youtube.com/watch?v=5eGCAF_zLxY", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=mpo4k-qJOoA", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=tzKrRNiiScE", channel: "UOL Esporte" },
  ],
  // Flamengo 2 x 0 Bahia, rodada 12.
  "554854": [
    { url: "https://www.youtube.com/watch?v=vOYsDet-tdw", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=MY0b-N7PH5A", channel: "UOL Esporte" },
  ],
  // Clube do Remo 0 x 1 Cruzeiro, rodada 13.
  "554868": [
    { url: "https://www.youtube.com/watch?v=JHFhEwm3-4c", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=jz7CsvB7ab8", channel: "UOL Esporte" },
  ],
  // São Paulo 1 x 0 Mirassol, rodada 13.
  "554869": [
    { url: "https://www.youtube.com/watch?v=q8XylGVU-fI", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=KCtz_onwp9k", channel: "UOL Esporte" },
  ],
  // Corinthians 1 x 0 Vasco da Gama, rodada 13.
  "554865": [
    { url: "https://www.youtube.com/watch?v=GZyN5Gg_dw4", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=9A3mMQBQBBA", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=F80TMwft4iY", channel: "UOL Esporte" },
  ],
  // Grêmio 1 x 0 Coritiba, rodada 13.
  "554867": [
    { url: "https://www.youtube.com/watch?v=QO3z6z_DdRI", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=KyqYWKDlMno", channel: "UOL Esporte" },
  ],
  // Athletico-PR 3 x 1 Vitória, rodada 13.
  "554860": [
    { url: "https://www.youtube.com/watch?v=BT-26X4IK14", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=dp3a2PScpcI", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=lo_JH_ixAnY", channel: "UOL Esporte" },
  ],
  // Bragantino 0 x 1 Palmeiras, rodada 13.
  "554864": [
    { url: "https://www.youtube.com/watch?v=Do17e3HSAD0", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=AFRulA5E9DI", channel: "UOL Esporte" },
  ],
  // Atlético-MG 0 x 4 Flamengo, rodada 13.
  "554861": [
    { url: "https://www.youtube.com/watch?v=gS1HKiLYoAk", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=5XDPtemqbVs", channel: "UOL Esporte" },
  ],
  // Fluminense 2 x 1 Chapecoense, rodada 13.
  "554866": [
    { url: "https://www.youtube.com/watch?v=KoUWrWHt_5o", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=rYZGo3V8w-4", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=mlBx7HTRbew", channel: "UOL Esporte" },
  ],
  // São Paulo 2 x 2 Bahia, rodada 14.
  "554878": [
    { url: "https://www.youtube.com/watch?v=eqCpTvgAfLM", channel: "UOL Esporte" },
  ],
  // Chapecoense 1 x 2 Bragantino, rodada 14.
  "554872": [
    { url: "https://www.youtube.com/watch?v=-8jrnsHan10", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=1KSF7dyRrRY", channel: "UOL Esporte" },
  ],
  // Internacional 2 x 0 Fluminense, rodada 14.
  "554875": [
    { url: "https://www.youtube.com/watch?v=INigg6LRJVQ", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=TqBwntBe_hE", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=-LvcBouiN94", channel: "UOL Esporte" },
  ],
  // Mirassol 2 x 1 Corinthians, rodada 14.
  "554876": [
    { url: "https://www.youtube.com/watch?v=x9nVaGLVN5M", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=vJG_yhUM9As", channel: "UOL Esporte" },
  ],
  // Corinthians 3 x 2 São Paulo, rodada 15.
  "554882": [
    { url: "https://www.youtube.com/watch?v=2uaqny9xfNk", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=8V6pxWDwBw4", channel: "CazéTV" },
  ],
  // Mirassol 1 x 1 Chapecoense, rodada 15.
  "554886": [
    { url: "https://www.youtube.com/watch?v=JwCiulnaD_Q", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=Ct-T6oos7x8", channel: "UOL Esporte" },
  ],
  // Santos 2 x 0 Bragantino, rodada 15.
  "554888": [
    { url: "https://www.youtube.com/watch?v=Y1s5lY8SC6M", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=5w8DxFfWlxo", channel: "UOL Esporte" },
  ],
  // Grêmio 0 x 1 Flamengo, rodada 15.
  "554885": [
    { url: "https://www.youtube.com/watch?v=usIs7gj-i3c", channel: "ge tv" },
  ],
  // Vasco da Gama 1 x 0 Athletico-PR, rodada 15.
  "554889": [
    { url: "https://www.youtube.com/watch?v=NAl-AiA99qM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=h33A0bKVQgM", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=ueZpE5_TRvQ", channel: "UOL Esporte" },
  ],
  // Bragantino 1 x 2 Botafogo, rodada 8.
  "554811": [
    { url: "https://www.youtube.com/watch?v=b8XNTsi-yGo", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=ubPCXrgmLR8", channel: "UOL Esporte" },
  ],
  // Fluminense 1 x 0 Atlético-MG, rodada 8.
  "554814": [
    { url: "https://www.youtube.com/watch?v=FJV2dyVeCZY", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=jG8MTPuKw2s", channel: "UOL Esporte" },
  ],
  // São Paulo 0 x 1 Palmeiras, rodada 8.
  "554817": [
    { url: "https://www.youtube.com/watch?v=qxOwbqEWLSM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=9OzNjaEUSTQ", channel: "UOL Esporte" },
  ],
  // Athletico-PR 2 x 0 Coritiba, rodada 8.
  "554810": [
    { url: "https://www.youtube.com/watch?v=_-kNViQMi6E", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=J9o1ZuAoDNY", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=WyrJ6gStmLc", channel: "UOL Esporte" },
  ],
  // Cruzeiro 0 x 0 Santos, rodada 8.
  "554813": [
    { url: "https://www.youtube.com/watch?v=Mn9-RfW45_w", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=vRA70MSy-eg", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=NrsaH8xjZPc", channel: "UOL Esporte" },
  ],
  // Clube do Remo 4 x 1 Bahia, rodada 8.
  "554816": [
    { url: "https://www.youtube.com/watch?v=Yr6qvidWFpY", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=Vni2JpTICt4", channel: "UOL Esporte" },
  ],
  // Vasco da Gama 2 x 1 Grêmio, rodada 8.
  "554818": [
    { url: "https://www.youtube.com/watch?v=qXgokWafhnA", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=RrwWWlWJxiU", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=cAm28wKiNxo", channel: "UOL Esporte" },
  ],
  // Internacional 2 x 0 Chapecoense, rodada 8.
  "554815": [
    { url: "https://www.youtube.com/watch?v=hmyogV59Z4w", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=X2qHw5ykTpM", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=WP5iwZ4Gs08", channel: "UOL Esporte" },
  ],
  // Vitória 1 x 0 Mirassol, rodada 8.
  "554819": [
    { url: "https://www.youtube.com/watch?v=z6i1uXEpdXU", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=X0u1Uy5mhxE", channel: "UOL Esporte" },
  ],
  // Corinthians 1 x 1 Flamengo, rodada 8.
  "554812": [
    { url: "https://www.youtube.com/watch?v=6qi41mARq3k", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=fjpn9aGyvmM", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=BwDvtJ4ktGE", channel: "UOL Esporte" },
  ],
  // Bahia 2 x 0 Bragantino, rodada 7.
  "554802": [
    { url: "https://www.youtube.com/watch?v=VYzRoqJ_b5Q", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=0crCxT7vSF4", channel: "UOL Esporte" },
  ],
  // Palmeiras 2 x 1 Botafogo, rodada 7.
  "554807": [
    { url: "https://www.youtube.com/watch?v=IG0WnIVMfew", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=3ly_UMoM2-k", channel: "UOL Esporte" },
  ],
  // Athletico-PR 2 x 1 Cruzeiro, rodada 7.
  "554800": [
    { url: "https://www.youtube.com/watch?v=f3XHf7lW5c8", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=-JYlmvRjBKA", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=9d3Earul-co", channel: "UOL Esporte" },
  ],
  // Atlético-MG 1 x 0 São Paulo, rodada 7.
  "554801": [
    { url: "https://www.youtube.com/watch?v=LrsCTm4ceko", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=WneDcWNUh-A", channel: "UOL Esporte" },
  ],
  // Mirassol 0 x 1 Coritiba, rodada 7.
  "554806": [
    { url: "https://www.youtube.com/watch?v=XFjSDJkxT9s", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=2GBJynT32Ds", channel: "CazéTV" },
  ],
  // Santos 1 x 2 Internacional, rodada 7.
  "554808": [
    { url: "https://www.youtube.com/watch?v=ZzEelQILA7U", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=YiL2mMfBMBo", channel: "UOL Esporte" },
  ],
  // Vasco da Gama 3 x 2 Fluminense, rodada 7.
  "554809": [
    { url: "https://www.youtube.com/watch?v=uUJNJWUYAHc", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=fo6Gwo7xxkU", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=jCLWo695sMc", channel: "UOL Esporte" },
  ],
  // Grêmio 2 x 0 Vitória, rodada 7.
  "554805": [
    { url: "https://www.youtube.com/watch?v=pjQ5DBu0bC0", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=9D9L-bP-2DQ", channel: "UOL Esporte" },
  ],
  // Flamengo 3 x 0 Clube do Remo, rodada 7.
  "554804": [
    { url: "https://www.youtube.com/watch?v=RCIj5udZRaI", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=BBefVVWWcug", channel: "UOL Esporte" },
  ],
  // Chapecoense 0 x 0 Corinthians, rodada 7.
  "554803": [
    { url: "https://www.youtube.com/watch?v=36qv7dLCDsc", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=uZdkQZpu6Zo", channel: "CazéTV" },
  ],
  // Vitória 2 x 0 Atlético-MG, rodada 6.
  "554799": [
    { url: "https://www.youtube.com/watch?v=J25VYgXJ-Jk", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=q8HxYNATUsw", channel: "UOL Esporte" },
  ],
  // Botafogo 0 x 3 Flamengo, rodada 6.
  "554790": [
    { url: "https://www.youtube.com/watch?v=FZ5_oGQtbzc", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=hxEvu1AxmZE", channel: "CazéTV" },
  ],
  // Fluminense 3 x 2 Athletico-PR, rodada 6.
  "554795": [
    { url: "https://www.youtube.com/watch?v=WMbFQUs2uHM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=wIVNJXzKpF0", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=AhZ_w_9NT2w", channel: "UOL Esporte" },
  ],
  // Internacional 0 x 1 Bahia, rodada 6.
  "554796": [
    { url: "https://www.youtube.com/watch?v=6TvTBFjXe4A", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=Tu5LLP9cY7o", channel: "CazéTV" },
  ],
  // Santos 1 x 1 Corinthians, rodada 6.
  "554798": [
    { url: "https://www.youtube.com/watch?v=qZl9ExmJZCM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=iHCZuNNXqzA", channel: "UOL Esporte" },
  ],
  // Coritiba 1 x 0 Clube do Remo, rodada 6.
  "554793": [
    { url: "https://www.youtube.com/watch?v=78q1uh6asNk", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=AtZDhRC9SPk", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=kuoSK2XEDZc", channel: "UOL Esporte" },
  ],
  // Palmeiras 1 x 0 Mirassol, rodada 6.
  "554797": [
    { url: "https://www.youtube.com/watch?v=_VFbHS7Bpu4", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=_-LfpDSym0k", channel: "UOL Esporte" },
  ],
  // Bragantino 1 x 2 São Paulo, rodada 6.
  "554791": [
    { url: "https://www.youtube.com/watch?v=eo9UGMauFBo", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=xj2bKApMSrY", channel: "UOL Esporte" },
  ],
  // Cruzeiro 3 x 3 Vasco da Gama, rodada 6.
  "554794": [
    { url: "https://www.youtube.com/watch?v=nEbLpiI2xs0", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=xkVIuyeeANY", channel: "CazéTV" },
  ],
  // Chapecoense 1 x 1 Grêmio, rodada 6.
  "554792": [
    { url: "https://www.youtube.com/watch?v=TN5miHjBzxU", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=1uk352G7QJM", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=kIZgm369riw", channel: "UOL Esporte" },
  ],
  // Mirassol 2 x 2 Santos, rodada 5.
  "554786": [
    { url: "https://www.youtube.com/watch?v=DY28GUWx8_w", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=4PAm0Z9kKs8", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=LeezduYU6uQ", channel: "UOL Esporte" },
  ],
  // Atlético-MG 1 x 0 Internacional, rodada 5.
  "554781": [
    { url: "https://www.youtube.com/watch?v=FdXjAuRhMfA", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=G_Rg0FPmtxU", channel: "UOL Esporte" },
  ],
  // Bahia 1 x 1 Vitória, rodada 5.
  "554782": [
    { url: "https://www.youtube.com/watch?v=6Cz_8lqTYUY", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=CEojVBiUEH4", channel: "UOL Esporte" },
  ],
  // Corinthians 0 x 2 Coritiba, rodada 5.
  "554783": [
    { url: "https://www.youtube.com/watch?v=0BrO96wiQ40", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=Zjl2iwmcGzU", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=f-0ikowiE00", channel: "UOL Esporte" },
  ],
  // Flamengo 2 x 0 Cruzeiro, rodada 5.
  "554784": [
    { url: "https://www.youtube.com/watch?v=sSiSTWgaJZk", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=7hcSQdcaBwI", channel: "UOL Esporte" },
  ],
  // Clube do Remo 0 x 2 Fluminense, rodada 5.
  "554787": [
    { url: "https://www.youtube.com/watch?v=yBrCJBqd6JE", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=bZu_XdXAAdU", channel: "UOL Esporte" },
  ],
  // Vasco da Gama 2 x 1 Palmeiras, rodada 5.
  "554789": [
    { url: "https://www.youtube.com/watch?v=QbPbqyRdpRU", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=PEr8h1_O3i4", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=zimZzOE5WD8", channel: "UOL Esporte" },
  ],
  // São Paulo 2 x 0 Chapecoense, rodada 5.
  "554788": [
    { url: "https://www.youtube.com/watch?v=mAzDBxanPp4", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=ozp5H-Xf2hk", channel: "UOL Esporte" },
  ],
  // Grêmio 1 x 1 Bragantino, rodada 5.
  "554785": [
    { url: "https://www.youtube.com/watch?v=Xd1hmbdoiTA", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=lpU-drolWo8", channel: "UOL Esporte" },
  ],
  // Athletico-PR 4 x 1 Botafogo, rodada 5.
  "554780": [
    { url: "https://www.youtube.com/watch?v=4kog4z5qiMc", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=zv0WtqkKdTc", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=4X1QHbDN5UA", channel: "UOL Esporte" },
  ],
  // Bragantino 1 x 1 Athletico-PR, rodada 4.
  "554772": [
    { url: "https://www.youtube.com/watch?v=c1faENo0sI8", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=vBIOKU6RJak", channel: "UOL Esporte" },
  ],
  // Clube do Remo 1 x 1 Internacional, rodada 4.
  "554778": [
    { url: "https://www.youtube.com/watch?v=1qXbWnGahJw", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=YLEvnRxp6p0", channel: "UOL Esporte" },
  ],
  // Coritiba 0 x 1 São Paulo, rodada 4.
  "554773": [
    { url: "https://www.youtube.com/watch?v=ydXfIvuFsyw", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=fAUVLXseN50", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=YnFfpVq665o", channel: "UOL Esporte" },
  ],
  // Cruzeiro 1 x 1 Corinthians, rodada 4.
  "554774": [
    { url: "https://www.youtube.com/watch?v=cMj0TmvGWek", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=8GkO4ncXiEI", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=ZmBgmQRYhxc", channel: "UOL Esporte" },
  ],
  // Grêmio 2 x 1 Atlético-MG, rodada 4.
  "554776": [
    { url: "https://www.youtube.com/watch?v=7uHe8mQwnfo", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=QkTq8GKcRKo", channel: "UOL Esporte" },
  ],
  // Palmeiras 2 x 1 Fluminense, rodada 4.
  "554777": [
    { url: "https://www.youtube.com/watch?v=29XTXvycS5U", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=JgWVw5FtsxI", channel: "UOL Esporte" },
  ],
  // Santos 2 x 1 Vasco da Gama, rodada 4.
  "554779": [
    { url: "https://www.youtube.com/watch?v=n_HH1GeUIUk", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=0QGJ5WJpiAY", channel: "UOL Esporte" },
  ],
  // Bahia 2 x 0 Chapecoense, rodada 4.
  "554770": [
    { url: "https://www.youtube.com/watch?v=N9uq5jiSF5k", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=bQOiH-8ShZE", channel: "UOL Esporte" },
  ],
  // Botafogo 0 x 0 Vitória, rodada 4.
  "554771": [
    { url: "https://www.youtube.com/watch?v=mFnVnYCuv14", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=Cmp29kCvtXA", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=3bQbYXrjnFg", channel: "UOL Esporte" },
  ],
  // Vitória 1 x 2 Flamengo, rodada 3.
  "554769": [
    { url: "https://www.youtube.com/watch?v=fIMnEts7U-c", channel: "ge tv" },
  ],
  // Chapecoense 3 x 3 Coritiba, rodada 3.
  "554762": [
    { url: "https://www.youtube.com/watch?v=rwkVgHARhKM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=7JJrHjL6G9Q", channel: "CazéTV" },
  ],
  // Mirassol 2 x 2 Cruzeiro, rodada 3.
  "554766": [
    { url: "https://www.youtube.com/watch?v=NHADqojGnys", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=DaXrNVkYhtI", channel: "CazéTV" },
  ],
  // Atlético-MG 3 x 3 Clube do Remo, rodada 3.
  "554761": [
    { url: "https://www.youtube.com/watch?v=27P8UDErNZE", channel: "ge tv" },
  ],
  // São Paulo 2 x 0 Grêmio, rodada 3.
  "554767": [
    { url: "https://www.youtube.com/watch?v=0q5dpW_ckNw", channel: "ge tv" },
  ],
  // Vasco da Gama 0 x 1 Bahia, rodada 3.
  "554768": [
    { url: "https://www.youtube.com/watch?v=8y0kvecpEMs", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=4PYeaF__mHw", channel: "CazéTV" },
  ],
  // Athletico-PR 2 x 1 Santos, rodada 3.
  "554760": [
    { url: "https://www.youtube.com/watch?v=gxECf2WRBtk", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=EFL47Q4mDKM", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=KteDfOVzzjw", channel: "UOL Esporte" },
  ],
  // Fluminense 1 x 0 Botafogo, rodada 3.
  "554764": [
    { url: "https://www.youtube.com/watch?v=Ej65rRQQjcY", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=-NWSl6vi588", channel: "CazéTV" },
  ],
  // Corinthians 2 x 0 Bragantino, rodada 3.
  "554763": [
    { url: "https://www.youtube.com/watch?v=4PWW9kcVJqs", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=S5neov_FajU", channel: "CazéTV" },
  ],
  // Internacional 1 x 3 Palmeiras, rodada 3.
  "554765": [
    { url: "https://www.youtube.com/watch?v=_j30mT_-i1Q", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=eWHS_m7L79M", channel: "CazéTV" },
  ],
  // Bragantino 1 x 0 Atlético-MG, rodada 2.
  "554752": [
    { url: "https://www.youtube.com/watch?v=o7YXJg4Gg_I", channel: "ge tv" },
  ],
  // Flamengo 1 x 1 Internacional, rodada 2.
  "554754": [
    { url: "https://www.youtube.com/watch?v=udLyHeD2pOk", channel: "ge tv" },
  ],
  // Clube do Remo 2 x 2 Mirassol, rodada 2.
  "554757": [
    { url: "https://www.youtube.com/watch?v=a0WVoq96pCA", channel: "ge tv" },
  ],
  // Santos 1 x 1 São Paulo, rodada 2.
  "554758": [
    { url: "https://www.youtube.com/watch?v=iCe1o6hKgkc", channel: "ge tv" },
  ],
  // Grêmio 5 x 3 Botafogo, rodada 2.
  "554755": [
    { url: "https://www.youtube.com/watch?v=iGea4eVsbFw", channel: "ge tv" },
  ],
  // Palmeiras 5 x 1 Vitória, rodada 2.
  "554756": [
    { url: "https://www.youtube.com/watch?v=g-ZhIznI0eg", channel: "ge tv" },
  ],
  // Bahia 1 x 1 Fluminense, rodada 2.
  "554751": [
    { url: "https://www.youtube.com/watch?v=O0IawqkArEY", channel: "ge tv" },
  ],
  // Vasco da Gama 1 x 1 Chapecoense, rodada 2.
  "554759": [
    { url: "https://www.youtube.com/watch?v=6VV6rSC4ImM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=nISUhAxUjcE", channel: "CazéTV" },
  ],
  // Cruzeiro 1 x 2 Coritiba, rodada 2.
  "554753": [
    { url: "https://www.youtube.com/watch?v=VNY2hayxxaA", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=4nLMDCPxbUU", channel: "CazéTV" },
  ],
  // Athletico-PR 0 x 1 Corinthians, rodada 2.
  "554750": [
    { url: "https://www.youtube.com/watch?v=y6mvjj5fLOc", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=CrPhrMsVm7w", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=PBDMptzByY0", channel: "UOL Esporte" },
  ],
  // Atlético-MG 2 x 2 Palmeiras, rodada 1.
  "554740": [
    { url: "https://www.youtube.com/watch?v=TOLBGl2aYwg", channel: "ge tv" },
  ],
  // Coritiba 0 x 1 Bragantino, rodada 1.
  "554744": [
    { url: "https://www.youtube.com/watch?v=13GFSGyQq2A", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=6W8oaQ_9fRs", channel: "CazéTV" },
  ],
  // Internacional 0 x 1 Athletico-PR, rodada 1.
  "554746": [
    { url: "https://www.youtube.com/watch?v=_RR8r3jvYLA", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=8JzThYMb43w", channel: "CazéTV" },
  ],
  // Vitória 2 x 0 Clube do Remo, rodada 1.
  "554749": [
    { url: "https://www.youtube.com/watch?v=vDrdK3uyIt0", channel: "ge tv" },
  ],
  // Fluminense 2 x 1 Grêmio, rodada 1.
  "554745": [
    { url: "https://www.youtube.com/watch?v=TwcRtNNwoio", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=EKzMKFz2HAc", channel: "CazéTV" },
  ],
  // Chapecoense 4 x 2 Santos, rodada 1.
  "554742": [
    { url: "https://www.youtube.com/watch?v=c8-n_qrhAtg", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=XvkyV08bLOo", channel: "CazéTV" },
  ],
  // Corinthians 1 x 2 Bahia, rodada 1.
  "554743": [
    { url: "https://www.youtube.com/watch?v=ugVugFQ8IVo", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=K8O6NPlcJvU", channel: "CazéTV" },
  ],
  // São Paulo 2 x 1 Flamengo, rodada 1.
  "554748": [
    { url: "https://www.youtube.com/watch?v=6kVcqMqFz7I", channel: "ge tv" },
  ],
  // Mirassol 2 x 1 Vasco da Gama, rodada 1.
  "554747": [
    { url: "https://www.youtube.com/watch?v=mh2DZo6wBl4", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=XLbYlCJbSzU", channel: "CazéTV" },
  ],
  // Botafogo 4 x 0 Cruzeiro, rodada 1.
  "554741": [
    { url: "https://www.youtube.com/watch?v=fSlD5YosPSE", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=INtHSOP1rK4", channel: "CazéTV" },
  ],
  // Botafogo 2 x 3 Athletico-PR, rodada 24.
  //
  // Added by hand: find-highlights.ts refused this one, correctly. ge tv titled
  // it "BOTAFOGO 1 X 3 ATHLETICO-PR" and the fixture was 2-3, so the score
  // check did exactly what it exists to do. The title is simply wrong — the
  // video is this match, confirmed by channel id, round 24, an upload 2.1h
  // after kickoff, and a description narrating it ("abrem 3 a 0 no Rio de
  // Janeiro, veem o time da casa reduzir no fim"). Two other channels covering
  // the match title it 2x3, as does the provider.
  //
  // Do not relax the score check to accommodate this. A broadcaster's typo is
  // rare; a previous season's identical fixture is not, and that check is the
  // only thing standing between the two.
  "554970": [
    { url: "https://www.youtube.com/watch?v=pJBVrWUNq-s", channel: "ge tv" },
  ],
  // Mirassol 1 x 1 Palmeiras, rodada 25.
  "554986": [
    { url: "https://www.youtube.com/watch?v=z3J2HPWvJZI", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=WdWqybj-mVA", channel: "UOL Esporte" },
  ],
};
