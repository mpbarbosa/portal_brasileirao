# Palmeiras — scouts por rodada contra V/E/D

A **frozen analysis**, not a living document. Written 2026-09-06 against
`origin/main` = `8afc286`, seed snapshot `2026-09-02`, rodadas 1..25.

Same question and same method as
[`athletico-pr-scouts-vs-resultados.md`](athletico-pr-scouts-vs-resultados.md),
on a club at the other end of the table: Palmeiras finished rodada 25 **1º com 52
pontos**, 15V-7E-3D.

## Finding, in one line

**The same result as Athletico-PR, and sharper: shot volume does not predict this
club's results — conversão does.** Here the low-conversion matches carry *more*
shots than the high-conversion ones, where Athletico's two groups were level.

## The data is clean, and that is worth stating first

Athletico's analysis had to exclude two matches whose caRtola windows were empty.
**Palmeiras has none.** All 25 matches are usable, and the reconciliation closes
exactly:

- scoreline **45** goals − **2** own goals in its favour = **43**, which is the
  scout total to the unit
- the join validates **22 of 22** checkable matches — and on *both* orderings,
  because Palmeiras played no fixture out of round order, so joining by rodada
  and by kickoff are the same list
- coverage from `jogos_num` is **25 of 25**; this club is not one of the thirteen
  the denominator fix found short

So nothing here rests on an exclusion, which removes the one place the Athletico
reading had to argue for itself.

## The data

`fin` is `finishes` from `scouts-core.ts`: gols + defendidas + para fora + na trave.

| r | adversário | C/F | res | placar | fin | alvo | fora | trave | gols | conv% | defesas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Atlético-MG | F | E | 2-2 | 9 | 6 | 3 | 0 | 2 | 22 | 1 |
| 2 | Vitória | C | V | 5-1 | 14 | 8 | 5 | 1 | 5 | 36 | 3 |
| 3 | Internacional | F | V | 3-1 | 10 | 7 | 3 | 0 | 3 | 30 | 3 |
| 4 | Fluminense | C | V | 2-1 | 10 | 6 | 2 | 2 | 2 | 20 | 6 |
| 5 | Vasco da Gama | F | D | 1-2 | 6 | 3 | 3 | 0 | 1 | 17 | 4 |
| 6 | Mirassol | C | V | 1-0 | 10 | 4 | 6 | 0 | 1 | 10 | 2 |
| 7 | Botafogo | C | V | 2-1 | 16 | 6 | 10 | 0 | 2 | 13 | 2 |
| 8 | São Paulo | F | V | 1-0 | 6 | 2 | 4 | 0 | 1 | 17 | 1 |
| 9 | Grêmio | C | V | 2-1 | 11 | 4 | 7 | 0 | 2 | 18 | 4 |
| 10 | Bahia | F | V | 2-1 | 6 | 5 | 1 | 0 | 1 | 17 | 4 |
| 11 | Corinthians | F | E | 0-0 | 6 | 3 | 3 | 0 | 0 | 0 | 4 |
| 12 | Athletico-PR | C | V | 1-0 | 8 | 2 | 6 | 0 | 1 | 13 | 3 |
| 13 | Bragantino | F | V | 1-0 | 6 | 3 | 3 | 0 | 1 | 17 | 3 |
| 14 | Santos | C | E | 1-1 | 15 | 3 | 12 | 0 | 1 | 7 | 3 |
| 15 | Clube do Remo | F | E | 1-1 | 16 | 6 | 10 | 0 | 1 | 6 | 3 |
| 16 | Cruzeiro | C | E | 1-1 | 12 | 2 | 10 | 0 | 1 | 8 | 3 |
| 17 | Flamengo | F | V | 3-0 | 10 | 6 | 4 | 0 | 3 | 30 | 3 |
| 18 | Chapecoense | C | V | 1-0 | 9 | 4 | 5 | 0 | 1 | 11 | 3 |
| 19 | Coritiba | F | V | 3-1 | 11 | 6 | 3 | 2 | 3 | 27 | 5 |
| 20 | Atlético-MG | C | D | 1-2 | 15 | 6 | 9 | 0 | 1 | 7 | 2 |
| 21 | Vitória | F | V | 4-0 | 13 | 5 | 7 | 1 | 3 | 23 | 3 |
| 22 | Internacional | C | E | 0-0 | 13 | 3 | 10 | 0 | 0 | 0 | 2 |
| 23 | Fluminense | F | D | 2-3 | 9 | 5 | 4 | 0 | 2 | 22 | 3 |
| 24 | Vasco da Gama | C | V | 4-1 | 9 | 4 | 4 | 1 | 4 | 44 | 3 |
| 25 | Mirassol | F | E | 1-1 | 9 | 3 | 6 | 0 | 1 | 11 | 4 |

## Correlation (n = 25)

Spearman ρ against pontos (V=3, E=1, D=0); Pearson r against saldo de gols.

| métrica | média ± dp | ρ (pontos) | p | r (saldo) | p |
|---|---|---|---|---|---|
| **Finalizações** | 10,36 ± 3,21 | **−0,078** | 0,711 | 0,096 | 0,648 |
| — no alvo | 4,48 ± 1,69 | 0,192 | 0,358 | 0,397 | 0,049 |
| — para fora | 5,60 ± 3,03 | −0,237 | 0,254 | −0,220 | 0,290 |
| Gols | 1,72 ± 1,21 | 0,458 | 0,021 | 0,782 | <0,001 |
| **Conversão %** | 17,00 ± 10,78 | **0,497** | **0,011** | 0,701 | <0,001 |
| Defesas do goleiro | 3,08 ± 1,12 | 0,072 | 0,733 | 0,082 | 0,696 |

**Shot volume's correlation with points is slightly negative** — not merely
absent. Gols is near-tautological and is listed as a check on the reconstruction,
not as a finding.

### Médias por resultado

| res | n | fin | alvo | gols | conv% | defesas | gols sofridos |
|---|---|---|---|---|---|---|---|
| V | 15 | 9,9 | 4,8 | 2,20 | **21,7** | 3,20 | 0,53 |
| E | 7 | **11,4** | 3,7 | 0,86 | **7,8** | 2,86 | 0,86 |
| D | 3 | 10,0 | 4,7 | 1,33 | 15,2 | 3,00 | 2,33 |

Empates carry the **most** finalizações and the **worst** conversão. Vitórias are
the lowest-volume group of the three.

## The split that carries it

```
conversão >= 17%   n=14   11V-1E-2D   2,43 pts/jogo   fin=9,3
conversão <  17%   n=11    4V-6E-1D   1,64 pts/jogo   fin=11,7
```

**The losing half shoots more.** That is stronger than Athletico-PR, where the
two conversion groups were level at 9,5 against 9,6 finalizações; here the
low-conversion group out-shoots the high-conversion one by 2,4 a game and takes
0,8 fewer points.

Splitting on volume instead barely separates anything:

```
finalizações >= 10  n=14   9V-4E-1D   2,21 pts/jogo
finalizações <  10  n=11   6V-3E-2D   1,91 pts/jogo
```

### Where the points leak

Five of the seven empates came with conversão ≤ 11%, and the three worst are the
three highest-volume matches of the season bar one:

| r | adversário | placar | fin | alvo | gols | conv% |
|---|---|---|---|---|---|---|
| 1 | Atlético-MG (F) | 2-2 | 9 | 6 | 2 | 22 |
| 11 | Corinthians (F) | 0-0 | 6 | 3 | 0 | 0 |
| 14 | Santos (C) | 1-1 | 15 | 3 | 1 | 7 |
| 15 | Clube do Remo (F) | 1-1 | 16 | 6 | 1 | 6 |
| 16 | Cruzeiro (C) | 1-1 | 12 | 2 | 1 | 8 |
| 22 | Internacional (C) | 0-0 | 13 | 3 | 0 | 0 |
| 25 | Mirassol (F) | 1-1 | 9 | 3 | 1 | 11 |

Rodadas 14, 15 and 16 are consecutive: 43 finalizações for 3 goals, three draws.

### Casa e fora

```
em casa   n=12   8V-3E-1D   2,25 pts/jogo   fin=11,8   conv=14,8%
fora      n=13   7V-4E-2D   1,92 pts/jogo   fin= 9,0   conv=18,8%
```

More shots at home, better conversion away — the two move in opposite directions,
which is the same relationship the split above describes, arriving through the
fixture list rather than through a median cut.

## Does it generalise? A division-wide check

Two clubs agreeing is not a result, so the same per-club correlation was run
across all twenty, on the same data and the same exclusion rule:

| | finalizações | conversão |
|---|---|---|
| mean ρ against pontos | **0,108** | **0,461** |
| positive in | 13 of 20 clubs | **19 of 20** |
| higher than the other metric in | 2 of 20 | **18 of 20** |

So the shape is the division's, not this club's. The one club where volume
out-predicts conversão by a wide margin is **Grêmio** (0,537 against 0,169), and
the only negative conversão correlation in the league is **Flamengo**'s (−0,021,
i.e. none).

**This does not remove the mechanical component** — conversão is gols/finalizações
and gols decide results, so some of every one of those twenty numbers is
arithmetic. What the sweep establishes is that the *volume* half is genuinely
uninformative across the division, which no amount of tautology explains.

## Limits, stated rather than implied

1. **Three defeats.** Every figure in the D row rests on three matches, and this
   is the weakest part of the reading. Palmeiras' problem in 2026 was drawing,
   not losing.
2. **Conversão is partly mechanical**, as above. The half that is not is the
   volume comparison across the two conversion groups.
3. **n = 25, six metrics.** p = 0,011 sits **outside** a Bonferroni threshold
   (0,05/6 ≈ 0,008), so on this club alone it would not clear a corrected bar.
   What carries it is the division-wide sweep, not this p-value.
4. **Descriptive, not predictive.**
5. **The counters are a weekly snapshot** and stale by construction.
6. **Defesas do goleiro carries no signal here either** (ρ = 0,072). It is a
   proxy for pressure faced and names what it counts, per `scouts-core.ts`.

## Where the Perfil puts this club

Against the division, on the corrected denominators: **9º em finalizações
(10,4 por jogo), 2º em conversão (16,6%)**. Read with the finding above, that is
a side whose ranking is built on the second number.

## Reproducing

Difference `CLUB_SCOUTS_HISTORY["1769"]`, join to the club's finished seed
fixtures by rodada, and drop any window whose five counters are all flat (none
here). `finishes` in `scouts-core.ts` is the shot total; `src/data/goals.ts`
gives own goals for the reconciliation.

**Note the club code is `1769`.** Palmeiras is not `1776` — that is São Paulo.
Read the code off `src/data/clubs.ts` rather than from memory; a hand-written map
scrambled seven clubs while this analysis was being prepared.
