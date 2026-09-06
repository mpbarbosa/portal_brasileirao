# Grêmio — scouts por rodada contra V/E/D

A **frozen analysis**, not a living document. Written 2026-09-06 against
`origin/main` = `9615b2d`, seed snapshot `2026-09-02`, rodadas 1..25.

Sixth per-club reading. Grêmio had played 24 of 25 — **7V-7E-10D, 28 pontos**,
rodada 21 postponed — and it is the club the
[division-wide comparison](divisao-scouts-vs-resultados.md) names as **the single
exception**: the only one of twenty where shot volume out-predicts conversão
(ρ 0,63 against 0,48), and the widest volume split in the league at +1,81
pts/jogo.

## Finding, in one line

**The exception is not an exception. It is the home ground** — and testing that
turned out to matter for the whole series, not just this club.

## The data

23 usable of 24 played; rodada 19's window is empty. The join validates **20 of
21** checkable matches on both orderings. Scoreline 27 goals against 25 in the
scouts with 1 own goal in its favour, and the dropped match (r19, lost 2-1 away)
contributes the remaining one.

| r | adversário | C/F | res | placar | fin | alvo | fora | trave | gols | conv% | defesas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Fluminense | F | D | 1-2 | 7 | 3 | 4 | 0 | 1 | 14 | 4 |
| 2 | Botafogo | C | V | 5-3 | 12 | 8 | 4 | 0 | 5 | 42 | 1 |
| 3 | São Paulo | F | D | 0-2 | 5 | 1 | 4 | 0 | 0 | 0 | 1 |
| 4 | Atlético-MG | C | V | 2-1 | 12 | 6 | 5 | 1 | 2 | 17 | 1 |
| 5 | Bragantino | C | E | 1-1 | 11 | 5 | 5 | 1 | 1 | 9 | 6 |
| 6 | Chapecoense | F | E | 1-1 | 9 | 4 | 4 | 1 | 1 | 11 | 0 |
| 7 | Vitória | C | V | 2-0 | 10 | 5 | 5 | 0 | 1 | 10 | 0 |
| 8 | Vasco da Gama | F | D | 1-2 | 9 | 3 | 6 | 0 | 1 | 11 | 2 |
| 9 | Palmeiras | F | D | 1-2 | 8 | 5 | 3 | 0 | 1 | 13 | 2 |
| 10 | Clube do Remo | C | E | 0-0 | 15 | 3 | 11 | 1 | 0 | 0 | 3 |
| 11 | Internacional | F | E | 0-0 | 4 | 1 | 3 | 0 | 0 | 0 | 3 |
| 12 | Cruzeiro | F | D | 0-2 | 6 | 1 | 4 | 1 | 0 | 0 | 4 |
| 13 | Coritiba | C | V | 1-0 | 12 | 6 | 6 | 0 | 1 | 8 | 4 |
| 14 | Athletico-PR | F | E | 0-0 | 6 | 0 | 6 | 0 | 0 | 0 | 4 |
| 15 | Flamengo | C | D | 0-1 | 5 | 3 | 2 | 0 | 0 | 0 | 4 |
| 16 | Bahia | F | E | 1-1 | 3 | 1 | 2 | 0 | 1 | 33 | 4 |
| 17 | Santos | C | V | 3-2 | 10 | 5 | 5 | 0 | 3 | 30 | 2 |
| 18 | Corinthians | C | D | 1-3 | 6 | 3 | 3 | 0 | 1 | 17 | 5 |
| 20 | Fluminense | C | E | 1-1 | 10 | 5 | 5 | 0 | 1 | 10 | 1 |
| 22 | São Paulo | C | V | 2-1 | 10 | 5 | 5 | 0 | 2 | 20 | 5 |
| 23 | Atlético-MG | F | D | 0-3 | 7 | 1 | 6 | 0 | 0 | 0 | 2 |
| 24 | Bragantino | F | D | 0-1 | 8 | 2 | 6 | 0 | 0 | 0 | 2 |
| 25 | Chapecoense | C | V | 3-1 | 9 | 5 | 4 | 0 | 3 | 33 | 7 |

## Correlation (n = 23)

| métrica | média ± dp | ρ (pontos) | p | r (saldo) | p |
|---|---|---|---|---|---|
| **Finalizações** | 8,43 ± 2,97 | **0,628** | **0,001** | 0,534 | 0,009 |
| **— no alvo** | 3,52 ± 2,09 | **0,652** | **<0,001** | 0,685 | <0,001 |
| — para fora | 4,70 ± 1,84 | 0,195 | 0,373 | 0,086 | 0,696 |
| Gols | 1,09 ± 1,24 | 0,660 | <0,001 | 0,678 | <0,001 |
| Conversão % | 12,09 ± 12,45 | 0,484 | 0,019 | 0,592 | 0,003 |
| Defesas do goleiro | 2,91 ± 1,88 | −0,055 | 0,803 | −0,006 | 0,978 |

### Médias por resultado

| res | n | fin | alvo | gols | conv% | defesas | gols sofridos |
|---|---|---|---|---|---|---|---|
| V | 7 | **10,7** | 5,7 | 2,43 | 22,9 | 2,86 | 1,14 |
| E | 7 | **8,3** | 2,7 | 0,57 | 9,1 | 3,00 | 0,57 |
| D | 9 | **6,8** | 2,4 | 0,44 | 6,1 | 2,89 | 2,00 |

**A clean monotonic ladder** — 10,7 → 8,3 → 6,8 — which no other club in this
series produces. It is what makes the volume story look so convincing here.

## The splits

```
finalizações >= 9  n=12   7V-4E-1D   2,08 pts/jogo   fin=10,8
finalizações <  9  n=11   0V-3E-8D   0,27 pts/jogo   fin= 5,9

conversão >= 10%   n=13   6V-3E-4D   1,62 pts/jogo   fin= 8,8
conversão <  10%   n=10   1V-4E-5D   0,70 pts/jogo   fin= 7,9
```

**Zero wins in eleven matches below nine finalizações.** The volume split is
+1,81 pts/jogo against the conversão split's +0,92 — the only club in the
division where volume separates more sharply.

## And then the venue

```
em casa   n=12   7V-3E-2D   2,00 pts/jogo   fin=10,2   conv=16,4%
fora      n=11   0V-4E-7D   0,36 pts/jogo   fin= 6,5   conv= 6,9%
```

**No away wins at all**, and 3,7 fewer shots away than at home. Which raises the
question the volume story has to answer:

| | ρ |
|---|---|
| finalizações → pontos | **0,628** |
| **jogar em casa → pontos** | **0,628** |
| jogar em casa → finalizações | 0,654 |

Playing at home predicts this club's points **exactly as well** as shooting more
does, and it strongly predicts shooting more. That is the signature of a
confound, not of two separate effects.

Splitting by venue and correlating *within* each half settles it:

| | ρ(finalizações, pontos) |
|---|---|
| all 23 matches | **+0,628** |
| home only (n=12) | +0,364 |
| away only (n=11) | **−0,362** |

**The effect collapses inside the home matches and reverses inside the away
ones.** Grêmio's apparent volume signal is substantially *"this side is good at
home and hopeless away, and it shoots more at home"*.

The two ρ values being identical to three decimals is a coincidence of rank
correlation against a binary variable, but the mechanism is not: 0,654 between
venue and volume is what does the work.

## What this does to the division

Since the control had to be run for this club, it was run for all twenty — and
the same control must be applied to **both** metrics or the comparison is rigged:

| | overall | within venue |
|---|---|---|
| finalizações | 0,114 · positive 13/20 | **−0,038 · positive 9/20** |
| conversão | 0,553 · positive 20/20 | **0,559 · positive 20/20** |
| jogar em casa | 0,270 · positive 19/20 | — |

**The division's weak volume signal was venue.** Controlled, it is very slightly
negative and no better than a coin flip across clubs. **Conversão does not move
at all** — 0,553 to 0,559, still positive in every club.

This *strengthens* the central finding of the series rather than qualifying it:
the one channel that survives a venue control is the one the earlier documents
identified, and the channel that does not survive is the one they already called
uninformative.

## Limits

1. **This is one control, not a model.** Splitting by venue is the crudest way to
   remove it; it does not touch opponent strength, which is the obvious next
   confound and is not addressed anywhere in this series.
2. **n = 23**, and the venue halves are 12 and 11. The within-venue ρ values are
   noisy — the point is that they do not survive, not that −0,362 is a reliable
   estimate.
3. **Conversão remains partly mechanical** (gols/finalizações, and gols decide
   results). Venue control does not address that, and nothing here claims it does.
4. **Grêmio's away record is 0V-4E-7D**, so the away half has almost no variance
   in points to correlate against.
5. **Descriptive, not predictive.**

## Reproducing

Difference `CLUB_SCOUTS_HISTORY["1767"]` and join **window `round − 1` to the
match played in that round**. ρ gols is 0,660, so the join is sound. For the
venue control, partition on whether the club is `homeCode` and correlate within
each part.
