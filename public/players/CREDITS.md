# Player photographs

Downloaded from Wikimedia Commons by `scripts/sync-player-photos.ts` and served
from this app's own origin rather than hotlinked — Commons rate-limits
third-party embedding, and rightly so. Opening several player cards in a row is
the ordinary way to read the Jogadores page, which is precisely the request
pattern that earns a 429.

**None of these came from a player's own Instagram, and none can.** A player's
photographs are their copyright; a public profile licenses nothing. Every file
here carries a licence that says what a reuser may do.

Like `public/stadiums/` and unlike `public/marks/`, these are **not** public
domain. Each is used under the licence named below, which requires the
photographer to be credited wherever the picture appears. That credit renders
inside the player card as a condition of showing the photograph, and
`npm run check-player-photos` re-reads each licence and credit from Commons so
this table cannot drift from what is served.

| File | Player | Club | Source on Commons | Licence | Credit |
| --- | --- | --- | --- | --- | --- |
| `8472-*.jpg` | Memphis Depay | Corinthians | [Memphis Depay 2019.jpg](https://commons.wikimedia.org/wiki/File:Memphis_Depay_2019.jpg) | CC BY-SA 4.0 | Derivative work: Joe Sins |
