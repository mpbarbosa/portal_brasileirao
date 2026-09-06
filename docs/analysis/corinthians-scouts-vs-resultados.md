# Corinthians — scouts por rodada contra V/E/D

A **frozen analysis**, not a living document. Written 2026-09-06 against
`origin/main` = `1710b35`, seed snapshot `2026-09-02`, rodadas 1..25.

Fourth per-club reading, after [Athletico-PR](athletico-pr-scouts-vs-resultados.md),
[Palmeiras](palmeiras-scouts-vs-resultados.md) and
[Flamengo](flamengo-scouts-vs-resultados.md); the division-wide comparison is
[here](divisao-scouts-vs-resultados.md). Corinthians had played all 25 at the
snapshot — **8V-8E-9D, 32 pontos**.

This is the club the division report names as one end of an axis: it **wins at
12,29 finalizações and draws at 5,25**, a 7,0 gap and the largest in the league
in that direction. (Both figures are quoted to two decimals to match the division
table exactly; rounded to one they are 12,3 and 5,3, and the division report's
prose rounds the second down to 5,2 — same number, different convention.)

## Finding, in one line

**Conversão predicts points here as everywhere. What is unusual is the draws:
they are matches in which this side did not shoot at all** — and its defeats are
high-volume matches thrown away at 5,9% conversão.

## The data

25 played, no missing rodada. Rodada 2's window is empty — caRtola recorded no
actions — so it is dropped, leaving 24. The join validates **20 of 21**
checkable matches, on both orderings.

| r | adversário | C/F | res | placar | fin | alvo | fora | trave | gols | conv% | defesas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Bahia | C | D | 1-2 | 12 | 5 | 6 | 1 | 1 | 8 | 4 |
| 3 | Bragantino | C | V | 2-0 | 14 | 5 | 9 | 0 | 2 | 14 | 3 |
| 4 | Cruzeiro | F | E | 1-1 | 4 | 2 | 2 | 0 | 1 | 25 | 2 |
| 5 | Coritiba | C | D | 0-2 | 8 | 1 | 7 | 0 | 0 | 0 | 1 |
| 6 | Santos | F | E | 1-1 | 7 | 4 | 3 | 0 | 1 | 14 | 4 |
| 7 | Chapecoense | F | E | 0-0 | 9 | 3 | 5 | 1 | 0 | 0 | 4 |
| 8 | Flamengo | C | E | 1-1 | 5 | 2 | 3 | 0 | 1 | 20 | 1 |
| 9 | Fluminense | F | D | 1-3 | 11 | 5 | 6 | 0 | 1 | 9 | 6 |
| 10 | Internacional | C | D | 0-1 | 7 | 2 | 5 | 0 | 0 | 0 | 2 |
| 11 | Palmeiras | C | E | 0-0 | 6 | 4 | 2 | 0 | 0 | 0 | 4 |
| 12 | Vitória | F | E | 0-0 | 3 | 0 | 3 | 0 | 0 | 0 | 1 |
| 13 | Vasco da Gama | C | V | 1-0 | 13 | 5 | 8 | 0 | 1 | 8 | 7 |
| 14 | Mirassol | F | D | 1-2 | 9 | 3 | 6 | 0 | 1 | 11 | 3 |
| 15 | São Paulo | C | V | 3-2 | 14 | 6 | 8 | 0 | 3 | 21 | 3 |
| 16 | Botafogo | F | D | 1-3 | 12 | 1 | 10 | 1 | 1 | 8 | 2 |
| 17 | Atlético-MG | C | V | 1-0 | 9 | 4 | 5 | 0 | 1 | 11 | 0 |
| 18 | Grêmio | F | V | 3-1 | 19 | 9 | 10 | 0 | 3 | 16 | 1 |
| 19 | Clube do Remo | C | V | 3-0 | 12 | 7 | 5 | 0 | 3 | 25 | 0 |
| 20 | Bahia | F | E | 1-1 | 3 | 2 | 1 | 0 | 1 | 33 | 1 |
| 21 | Athletico-PR | C | E | 0-0 | 5 | 4 | 1 | 0 | 0 | 0 | 1 |
| 22 | Bragantino | F | V | 2-0 | 5 | 3 | 2 | 0 | 2 | 40 | 2 |
| 23 | Cruzeiro | C | D | 1-2 | 12 | 6 | 5 | 1 | 1 | 8 | 4 |
| 24 | Coritiba | F | D | 1-2 | 12 | 3 | 9 | 0 | 1 | 8 | 1 |
| 25 | Santos | C | D | 0-1 | 10 | 2 | 8 | 0 | 0 | 0 | 3 |

## Correlation (n = 24)

| métrica | média ± dp | ρ (pontos) | p | r (saldo) | p |
|---|---|---|---|---|---|
| Finalizações | 9,21 ± 4,05 | 0,111 | 0,605 | 0,190 | 0,373 |
| **— no alvo** | 3,67 ± 2,10 | **0,428** | **0,037** | 0,536 | 0,007 |
| — para fora | 5,38 ± 2,83 | −0,131 | 0,542 | −0,080 | 0,711 |
| Gols | 1,04 ± 0,95 | 0,538 | 0,007 | 0,674 | <0,001 |
| **Conversão %** | 11,73 ± 11,12 | **0,493** | **0,014** | 0,534 | 0,007 |
| Defesas do goleiro | 2,50 ± 1,79 | −0,217 | 0,308 | −0,233 | 0,273 |

Only **1,04 gols a match** and **11,7% conversão** — the lowest of the four clubs
read so far, and the shape of a 32-point season.

### Médias por resultado

| res | n | fin | alvo | gols | conv% | defesas | gols sofridos |
|---|---|---|---|---|---|---|---|
| V | 7 | 12,3 | 5,6 | 2,14 | 19,3 | 2,29 | 0,43 |
| E | 8 | **5,3** | **2,6** | 0,50 | 11,6 | 2,25 | **0,50** |
| D | 9 | 10,3 | 3,1 | 0,67 | **5,9** | 2,89 | 2,00 |

**The empate row is the club.** 5,3 finalizações and 2,6 on target is not a match
this side dominated and failed to convert — it is a match in which nothing
happened, at either end: 0,50 goals scored and 0,50 conceded. Three of the eight
draws are 0-0 with six shots or fewer, and one (r12, Vitória) had **zero** shots
on target.

The defeats are the opposite: **10,3 finalizações at 5,9% conversão**, conceding
2,00. Territory without a finish.

## The splits, and why the volume one is misleading

```
conversão >= 9%    n=12   6V-4E-2D   1,83 pts/jogo   fin=9,3
conversão <  9%    n=12   1V-4E-7D   0,58 pts/jogo   fin=9,1

finalizações >= 9  n=14   6V-1E-7D   1,36 pts/jogo   fin=12,0
finalizações <  9  n=10   1V-7E-2D   1,00 pts/jogo   fin= 5,3
```

The conversão split behaves as it does across the division: a 1,25 pts/jogo gap
on near-identical volume.

**The volume split is the interesting one, and it is nearly flat in points —
1,36 against 1,00 — while being anything but flat in outcome.** Shooting more
brought six wins *and* seven defeats; shooting less brought seven draws out of
ten matches. The points cancel; the distribution does not.

```
finalizações >= 9   93% of matches decided (13 of 14)
finalizações <  9   30% of matches decided ( 3 of 10)
```

## A hypothesis I tested and dropped

That split suggests something tidy: **perhaps volume predicts whether a match is
*decided*, rather than who wins it.** It is a good story and it fits this club
perfectly — ρ(finalizações, decisive) = **0,73**, and a **+63 percentage-point**
gap, the largest in the division.

**It does not survive the division.** Run across all twenty clubs on the same
join:

| | |
|---|---|
| mean ρ(finalizações, decisive) | **0,000** |
| positive in | **9 of 20** clubs |
| mean gap, high vs low volume half | **−1,0 pp** |
| gap positive in | 7 of 20 |

Botafogo is the mirror image at **−0,51 and −45pp**: its low-volume matches are
the decisive ones. So there is no division-wide law here, and Corinthians is an
**outlier**, not an instance of a rule.

It is recorded because the club really does behave this way this season, and
because the negative result is the useful half: had this document stopped at the
Corinthians number, it would have published a law that twenty clubs contradict.

## Limits

1. **Conversão is partly mechanical** — gols/finalizações, and gols decide
   results. The volume half is what survives that, and here it is flat.
2. **n = 24**, and the split cells are 7 to 14 matches. ρ 0,428 for shots on
   target sits outside a Bonferroni bar for six metrics (0,05/6 ≈ 0,008); it is
   suggestive, not established.
3. **One window is dropped** (rodada 2) because caRtola recorded nothing for it.
4. **Descriptive, not predictive.**

## Reproducing

Difference `CLUB_SCOUTS_HISTORY["1779"]` and join **window `round − 1` to the
match played in that round**. Check ρ gols against points first — it is 0,538
here, so the join is sound.
