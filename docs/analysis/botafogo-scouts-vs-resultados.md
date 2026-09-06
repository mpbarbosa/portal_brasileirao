# Botafogo — scouts por rodada contra V/E/D

A **frozen analysis**, not a living document. Written 2026-09-06 against
`origin/main` = `da1ca43`, seed snapshot `2026-09-02`, rodadas 1..25.

Fifth per-club reading, after [Athletico-PR](athletico-pr-scouts-vs-resultados.md),
[Palmeiras](palmeiras-scouts-vs-resultados.md),
[Flamengo](flamengo-scouts-vs-resultados.md) and
[Corinthians](corinthians-scouts-vs-resultados.md); the division-wide comparison
is [here](divisao-scouts-vs-resultados.md). Botafogo had played 24 of 25 —
**8V-6E-10D, 30 pontos** — with its rodada-21 fixture postponed.

**This club is the exact mirror of Corinthians**, on both axes the earlier
documents name.

## Finding, in one line

**Shooting more cost this side points.** Its volume split is *negative*, its
wins are its **lowest**-volume matches, and its two highest-volume matches of the
season were both heavy defeats.

## Read the data caveat first

This is the weakest data of the five clubs read so far:

- **21 usable of 24 played.** Three windows are empty — rodadas 4, 5 and 19 —
  because caRtola recorded no actions for them.
- coverage from `jogos_num` is **21**, and the join validates **21 of 23**.
- rodada 21 was postponed and is absent from the season entirely.

**The gap reconciles exactly, which is what makes the rest usable.** Scoreline
37 goals against 34 in the scouts, own goals in its favour 0 — a shortfall of
three. The three dropped matches are r4 (0-0), r5 (lost 4-1, one goal) and r19
(won 2-1, two goals): **0 + 1 + 2 = 3.** Nothing is missing that is not
accounted for.

The three exclusions are not neutral — one win, one draw and one defeat — and
they are spread across results rather than concentrated, which is the best that
can be said for them.

## The data

| r | adversário | C/F | res | placar | fin | alvo | fora | trave | gols | conv% | defesas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Cruzeiro | C | V | 4-0 | 10 | 5 | 5 | 0 | 4 | 40 | 4 |
| 2 | Grêmio | F | D | 3-5 | 7 | 4 | 2 | 1 | 3 | 43 | 3 |
| 3 | Fluminense | F | D | 0-1 | 5 | 3 | 1 | 1 | 0 | 0 | 4 |
| 6 | Flamengo | C | D | 0-3 | 5 | 1 | 4 | 0 | 0 | 0 | 3 |
| 7 | Palmeiras | F | D | 1-2 | 5 | 3 | 2 | 0 | 1 | 20 | 5 |
| 8 | Bragantino | F | V | 2-1 | 6 | 2 | 3 | 1 | 2 | 33 | 5 |
| 9 | Mirassol | C | V | 3-2 | 9 | 6 | 2 | 1 | 3 | 33 | 2 |
| 10 | Vasco da Gama | F | V | 2-1 | 12 | 8 | 4 | 0 | 2 | 17 | 5 |
| 11 | Coritiba | C | E | 2-2 | 16 | 7 | 9 | 0 | 2 | 13 | 3 |
| 12 | Chapecoense | F | V | 4-1 | 12 | 8 | 4 | 0 | 4 | 33 | 2 |
| 13 | Internacional | C | E | 2-2 | 12 | 6 | 5 | 1 | 2 | 17 | 2 |
| 14 | Clube do Remo | C | D | 1-2 | 13 | 5 | 8 | 0 | 1 | 8 | 7 |
| 15 | Atlético-MG | F | E | 1-1 | 13 | 5 | 7 | 1 | 1 | 8 | 5 |
| 16 | Corinthians | C | V | 3-1 | 10 | 5 | 4 | 1 | 3 | 30 | 1 |
| 17 | São Paulo | F | E | 1-1 | 14 | 6 | 8 | 0 | 1 | 7 | 2 |
| 18 | Bahia | F | D | 1-2 | 11 | 6 | 5 | 0 | 1 | 9 | 8 |
| 20 | Cruzeiro | F | V | 1-0 | 5 | 3 | 2 | 0 | 1 | 20 | 5 |
| 22 | Fluminense | C | E | 1-1 | 16 | 9 | 7 | 0 | 1 | 6 | 3 |
| 23 | Vitória | F | D | 0-1 | 7 | 2 | 4 | 1 | 0 | 0 | 2 |
| 24 | Athletico-PR | C | D | 2-3 | 22 | 8 | 11 | 3 | 2 | 9 | 3 |
| 25 | Flamengo | F | D | 0-3 | 19 | 7 | 12 | 0 | 0 | 0 | 3 |

## Correlation (n = 21)

| métrica | média ± dp | ρ (pontos) | p | r (saldo) | p |
|---|---|---|---|---|---|
| **Finalizações** | 10,90 ± 4,81 | **−0,031** | 0,895 | −0,060 | 0,796 |
| — no alvo | 5,19 ± 2,25 | 0,205 | 0,373 | 0,244 | 0,286 |
| — para fora | 5,19 ± 3,06 | −0,188 | 0,415 | −0,251 | 0,273 |
| Gols | 1,62 ± 1,24 | 0,641 | 0,002 | 0,751 | <0,001 |
| **Conversão %** | 16,46 ± 13,90 | **0,600** | **0,004** | 0,635 | 0,002 |
| Defesas do goleiro | 3,67 ± 1,77 | −0,175 | 0,449 | −0,135 | 0,560 |

### Médias por resultado

| res | n | fin | alvo | gols | conv% | defesas | gols sofridos |
|---|---|---|---|---|---|---|---|
| V | 7 | **9,1** | 5,3 | 2,71 | **29,5** | 3,43 | 0,86 |
| E | 5 | **14,2** | 6,6 | 1,40 | 10,1 | 3,00 | 1,40 |
| D | 9 | 10,4 | 4,3 | 0,89 | 9,9 | 4,22 | 2,44 |

**Wins are the lowest-volume group and draws the highest** — a 5,1 gap, the
largest in the division in that direction. When this side wins it does so on
nine shots at 29,5%; when it draws it takes fourteen and converts one in ten.

## The splits, and a negative one

```
conversão >= 13%   n=11   7V-2E-2D   2,09 pts/jogo   fin= 9,5
conversão <  13%   n=10   0V-3E-7D   0,30 pts/jogo   fin=12,5

finalizações >= 11 n=11   2V-5E-4D   1,00 pts/jogo   fin=14,5
finalizações <  11 n=10   5V-0E-5D   1,50 pts/jogo   fin= 6,9
```

Two things there are worth stating separately.

**The conversão split is the widest of the five clubs read — 1,79 pts/jogo — and
its lower half contains no wins at all.** Eleven matches at 26,0% conversion
produced 7V-2E-2D; ten at 5,6% produced 0V-3E-7D. And the low-conversion half
shot *more* (12,5 against 9,5).

**The volume split is negative.** Shooting at or above the median was worth
**half a point a match less** than shooting below it. That is not a subtlety of
ranking — it is 2V-5E-4D against 5V-0E-5D. The club's two highest-volume matches
of the season are both defeats: **22 finalizações in a 2-3** (r24, Athletico-PR)
and **19 in a 0-3** (r25, Flamengo).

Note also that the low-volume half produced **no draws at all** — every one of
those ten matches was decided.

## The mirror of Corinthians

The [Corinthians reading](corinthians-scouts-vs-resultados.md) tested whether
volume predicts that a match is *decided* rather than who wins it, found ρ 0,73
and a +63pp gap for that club, and then **dropped the hypothesis** because the
division as a whole gives mean ρ 0,000, positive in 9 of 20.

Botafogo is the other pole of that same null result:

| | Corinthians | Botafogo |
|---|---|---|
| ρ(finalizações, decidido) | **+0,73** | **−0,51** |
| decided, high-volume half | 93% | 55% |
| decided, low-volume half | 30% | **100%** |
| gap | **+63pp** | **−45pp** |

Both are extremes of a distribution whose mean is zero, and they point in
opposite directions. Neither is evidence of a rule; together they are quite good
evidence that there isn't one.

## Limits

1. **Three of twenty-four matches are missing**, one of each result. The weakest
   data of the five clubs, though the goal shortfall reconciles exactly.
2. **n = 21**, and the split cells are 10 and 11. ρ conversão 0,600 at p 0,004
   does clear a Bonferroni bar for six metrics (0,05/6 ≈ 0,008); nothing else
   here does.
3. **Conversão is partly mechanical.** As everywhere in this series, the volume
   half is what survives that — and here it is negative, which no tautology
   produces.
4. **Five draws** is a thin group.
5. **Descriptive, not predictive.**

## Reproducing

Difference `CLUB_SCOUTS_HISTORY["1770"]` and join **window `round − 1` to the
match played in that round**. Check ρ gols first: it is 0,641 here, so the join
is sound despite the three empty windows.
