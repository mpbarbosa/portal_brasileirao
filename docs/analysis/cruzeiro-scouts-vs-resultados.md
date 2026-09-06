# Cruzeiro — scouts por rodada contra V/E/D

A **frozen analysis**, not a living document. Written 2026-09-06 against
`origin/main` = `17abfb9`, seed snapshot `2026-09-02`, rodadas 1..25.

Seventh per-club reading, and the first written with the venue control from
[Grêmio](gremio-scouts-vs-resultados.md) built in rather than added afterwards.
The others are [Athletico-PR](athletico-pr-scouts-vs-resultados.md),
[Palmeiras](palmeiras-scouts-vs-resultados.md),
[Flamengo](flamengo-scouts-vs-resultados.md),
[Corinthians](corinthians-scouts-vs-resultados.md) and
[Botafogo](botafogo-scouts-vs-resultados.md); the division-wide comparison is
[here](divisao-scouts-vs-resultados.md). Cruzeiro played all 25 — **11V-6E-8D,
39 pontos**.

## Finding, in one line

**This is the club where the venue control cannot explain anything, and
conversão survives it untouched** — which is what the Grêmio reading needed and
could not supply from its own data.

## The data is the cleanest of the seven

Nothing here is excluded and nothing is estimated:

- **25 of 25 matches usable**, no empty window, no missing rodada
- the join validates **24 of 24** checkable matches — **100%**
- coverage from `jogos_num` is **25**, equal to the fixture count
- the reconciliation closes **exactly**: scoreline **35** goals, scout **35**,
  own goals in its favour **0**

Every earlier document in this series had something to caveat — two lost matches
for Athletico-PR, a shifted join for Flamengo, three empty windows for Botafogo.
This one has none, which is why it is the right club to test the control on.

## The data

| r | adversário | C/F | res | placar | fin | alvo | fora | trave | gols | conv% | defesas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Botafogo | F | D | 0-4 | 11 | 4 | 7 | 0 | 0 | 0 | 1 |
| 2 | Coritiba | C | D | 1-2 | 15 | 4 | 11 | 0 | 1 | 7 | 0 |
| 3 | Mirassol | F | E | 2-2 | 5 | 4 | 1 | 0 | 2 | 40 | 8 |
| 4 | Corinthians | C | E | 1-1 | 9 | 3 | 6 | 0 | 1 | 11 | 1 |
| 5 | Flamengo | F | D | 0-2 | 10 | 4 | 6 | 0 | 0 | 0 | 3 |
| 6 | Vasco da Gama | C | E | 3-3 | 17 | 7 | 10 | 0 | 3 | 18 | 2 |
| 7 | Athletico-PR | F | D | 1-2 | 10 | 2 | 8 | 0 | 1 | 10 | 2 |
| 8 | Santos | C | E | 0-0 | 5 | 3 | 2 | 0 | 0 | 0 | 1 |
| 9 | Vitória | C | V | 3-0 | 8 | 5 | 3 | 0 | 3 | 38 | 0 |
| 10 | São Paulo | F | D | 1-4 | 10 | 7 | 3 | 0 | 1 | 10 | 1 |
| 11 | Bragantino | C | V | 2-1 | 12 | 7 | 5 | 0 | 2 | 17 | 3 |
| 12 | Grêmio | C | V | 2-0 | 16 | 6 | 9 | 1 | 2 | 13 | 1 |
| 13 | Clube do Remo | F | V | 1-0 | 6 | 6 | 0 | 0 | 1 | 17 | 1 |
| 14 | Atlético-MG | C | D | 1-3 | 7 | 2 | 5 | 0 | 1 | 14 | 1 |
| 15 | Bahia | F | V | 2-1 | 18 | 8 | 10 | 0 | 2 | 11 | 2 |
| 16 | Palmeiras | F | E | 1-1 | 9 | 4 | 5 | 0 | 1 | 11 | 1 |
| 17 | Chapecoense | C | V | 2-1 | 17 | 7 | 10 | 0 | 2 | 12 | 3 |
| 18 | Fluminense | C | E | 1-1 | 14 | 3 | 11 | 0 | 1 | 7 | 4 |
| 19 | Internacional | F | V | 2-1 | 9 | 5 | 4 | 0 | 2 | 22 | 2 |
| 20 | Botafogo | C | D | 0-1 | 11 | 5 | 6 | 0 | 0 | 0 | 2 |
| 21 | Coritiba | F | V | 1-0 | 9 | 5 | 4 | 0 | 1 | 11 | 2 |
| 22 | Mirassol | C | V | 3-1 | 9 | 3 | 6 | 0 | 3 | 33 | 2 |
| 23 | Corinthians | F | V | 2-1 | 11 | 6 | 4 | 1 | 2 | 18 | 5 |
| 24 | Flamengo | C | V | 2-1 | 13 | 6 | 7 | 0 | 2 | 15 | 2 |
| 25 | Vasco da Gama | F | D | 1-3 | 8 | 6 | 2 | 0 | 1 | 13 | 8 |

## Correlation (n = 25)

| métrica | média ± dp | ρ (pontos) | p | r (saldo) | p |
|---|---|---|---|---|---|
| Finalizações | 10,76 ± 3,70 | 0,127 | 0,544 | 0,135 | 0,519 |
| — no alvo | 4,88 ± 1,69 | 0,430 | 0,032 | 0,238 | 0,252 |
| — para fora | 5,80 ± 3,15 | −0,074 | 0,727 | 0,006 | 0,976 |
| Gols | 1,40 ± 0,91 | 0,694 | <0,001 | 0,705 | <0,001 |
| **Conversão %** | 13,88 ± 10,56 | **0,615** | **0,001** | 0,578 | 0,003 |
| Defesas do goleiro | 2,32 ± 2,06 | 0,108 | 0,609 | −0,082 | 0,696 |

ρ conversão at p 0,001 clears a Bonferroni bar for six metrics
(0,05/6 ≈ 0,008); nothing else here does, `Gols` aside, which is the sanity
check rather than a finding.

### Médias por resultado

| res | n | fin | alvo | gols | conv% | defesas | gols sofridos |
|---|---|---|---|---|---|---|---|
| V | 11 | 11,6 | 5,8 | 2,00 | **18,8** | 2,09 | 0,64 |
| E | 6 | 9,8 | 4,0 | 1,33 | 14,5 | 2,83 | 1,33 |
| D | 8 | 10,3 | 4,3 | 0,63 | **6,7** | 2,25 | 2,63 |

## The splits, and a negative one

```
conversão >= 12%   n=13   9V-2E-2D   2,23 pts/jogo   fin=10,6   conv=20,7%
conversão <  12%   n=12   2V-4E-6D   0,83 pts/jogo   fin=10,9   conv= 6,5%

finalizações >= 10 n=14   6V-2E-6D   1,43 pts/jogo   fin=13,2   conv= 9,8%
finalizações <  10 n=11   5V-4E-2D   1,73 pts/jogo   fin= 7,6   conv=19,1%
```

**The volume split is negative** — 1,43 against 1,73 — on near-identical
conversion volume in the other direction. And the two halves inverted: the side
of the split that shoots *more* converts **9,8%**, the side that shoots less
converts **19,1%**. Shooting and scoring pull against each other for this club.

The conversão split is 1,40 pts/jogo on volume that barely differs (10,6 against
10,9), which is the shape Athletico-PR and Flamengo both showed.

## The venue control, and why this club is the one that settles it

The [Grêmio reading](gremio-scouts-vs-resultados.md) found that the division's
apparent volume signal was **playing at home**: for that club ρ(playing at home,
points) was **identically** its ρ(finalizações, points), 0,628, and within venue
the effect fell apart. That raised an obvious worry the Grêmio data could not
answer — **does the control simply flatten everything, conversão included?**

Cruzeiro answers it, because here **venue barely exists**:

| | ρ |
|---|---|
| jogar em casa → pontos | **0,125** |
| jogar em casa → finalizações | 0,257 |
| jogar em casa → conversão | 0,039 |

1,69 pts/jogo at home against 1,42 away. There is almost no home advantage to
confound anything with.

Correlating *within* each venue half:

| | em casa (n=13) | fora (n=12) | overall |
|---|---|---|---|
| ρ finalizações → pontos | 0,181 | **−0,081** | 0,127 |
| ρ **conversão** → pontos | **0,620** | **0,641** | 0,615 |

**Conversão is unmoved** — 0,620 and 0,641 against 0,615 for the season, so the
control costs it nothing, and it is if anything *stronger* away. Volume is
nothing in both halves and turns negative away from home.

So the venue control is not a flattener. It removes the volume signal, in the
division and in Grêmio, and it leaves conversão exactly where it was in a club
where venue has no work to do.

## Limits

1. **Conversão is partly mechanical** — gols/finalizações, and gols decide
   results. Every document in this series says so. What the venue control adds
   is that the *volume* half, which carries no such objection, is negative here.
2. **n = 25**, and the venue halves are 13 and 12. Those within-venue ρ values
   rest on a dozen matches each and should be read as consistent with the
   season figure rather than as independent measurements.
3. **One control is not a model.** Venue is the crudest available confounder.
   Opponent strength is untouched here as in every other document in this
   series.
4. **Descriptive, not predictive.**

## Reproducing

Difference `CLUB_SCOUTS_HISTORY["1771"]` and join **window `round − 1` to the
match played in that round**. Check ρ gols against points first — 0,694 here.
For the venue control, partition on whether the club is the fixture's `homeCode`
and correlate within each half.
