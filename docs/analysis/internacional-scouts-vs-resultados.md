# Internacional — scouts por rodada contra V/E/D

A **frozen analysis**, not a living document. Written 2026-09-06 against
`origin/main` = `8ae517a`, seed snapshot `2026-09-02`, rodadas 1..25.

Eighth per-club reading. The others are
[Athletico-PR](athletico-pr-scouts-vs-resultados.md),
[Palmeiras](palmeiras-scouts-vs-resultados.md),
[Flamengo](flamengo-scouts-vs-resultados.md),
[Corinthians](corinthians-scouts-vs-resultados.md),
[Botafogo](botafogo-scouts-vs-resultados.md),
[Grêmio](gremio-scouts-vs-resultados.md) and
[Cruzeiro](cruzeiro-scouts-vs-resultados.md); the division-wide comparison is
[here](divisao-scouts-vs-resultados.md). Internacional played all 25 —
**5V-10E-10D, 25 pontos**.

## Finding, in one line

**This club is where the volume figure comes apart into its two halves**, which
pull in opposite directions — and the division does the same thing.

## The data

25 of 25 usable, no missing rodada, no empty window. The join validates
**22 of 22** checkable matches — **100%** — and the reconciliation closes
exactly: scoreline **26**, own goals in its favour **1**, scout **25**.

| r | adversário | C/F | res | placar | fin | alvo | fora | trave | gols | conv% | defesas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Athletico-PR | C | D | 0-1 | 13 | 5 | 8 | 0 | 0 | 0 | 1 |
| 2 | Flamengo | F | E | 1-1 | 9 | 5 | 4 | 0 | 1 | 11 | 3 |
| 3 | Palmeiras | C | D | 1-3 | 15 | 4 | 10 | 1 | 1 | 7 | 4 |
| 4 | Clube do Remo | F | E | 1-1 | 15 | 4 | 10 | 1 | 1 | 7 | 5 |
| 5 | Atlético-MG | F | D | 0-1 | 18 | 8 | 10 | 0 | 0 | 0 | 2 |
| 6 | Bahia | C | D | 0-1 | 10 | 2 | 8 | 0 | 0 | 0 | 2 |
| 7 | Santos | F | V | 2-1 | 11 | 6 | 5 | 0 | 1 | 9 | 1 |
| 8 | Chapecoense | C | V | 2-0 | 13 | 7 | 6 | 0 | 2 | 15 | 0 |
| 9 | São Paulo | C | E | 1-1 | 6 | 4 | 2 | 0 | 1 | 17 | 2 |
| 10 | Corinthians | F | V | 1-0 | 4 | 3 | 1 | 0 | 1 | 25 | 2 |
| 11 | Grêmio | C | E | 0-0 | 7 | 3 | 4 | 0 | 0 | 0 | 1 |
| 12 | Mirassol | C | D | 1-2 | 17 | 9 | 8 | 0 | 1 | 6 | 1 |
| 13 | Botafogo | F | E | 2-2 | 7 | 4 | 3 | 0 | 2 | 29 | 5 |
| 14 | Fluminense | C | V | 2-0 | 14 | 9 | 5 | 0 | 2 | 14 | 5 |
| 15 | Coritiba | F | E | 2-2 | 16 | 4 | 12 | 0 | 2 | 13 | 1 |
| 16 | Vasco da Gama | C | V | 4-1 | 11 | 7 | 4 | 0 | 4 | 36 | 2 |
| 17 | Vitória | F | D | 0-2 | 14 | 2 | 12 | 0 | 0 | 0 | 2 |
| 18 | Bragantino | F | D | 1-3 | 5 | 2 | 3 | 0 | 1 | 20 | 5 |
| 19 | Cruzeiro | C | D | 1-2 | 14 | 3 | 11 | 0 | 1 | 7 | 2 |
| 20 | Athletico-PR | F | D | 0-2 | 10 | 3 | 6 | 1 | 0 | 0 | 1 |
| 21 | Flamengo | C | E | 1-1 | 12 | 5 | 7 | 0 | 1 | 8 | 3 |
| 22 | Palmeiras | F | E | 0-0 | 5 | 2 | 3 | 0 | 0 | 0 | 2 |
| 23 | Clube do Remo | C | E | 1-1 | 7 | 3 | 4 | 0 | 1 | 14 | 2 |
| 24 | Atlético-MG | C | E | 0-0 | 10 | 2 | 8 | 0 | 0 | 0 | 4 |
| 25 | Bahia | F | D | 2-3 | 10 | 3 | 7 | 0 | 2 | 20 | 4 |

## Correlation (n = 25)

| métrica | média ± dp | ρ (pontos) | p | r (saldo) | p |
|---|---|---|---|---|---|
| Finalizações | 10,92 ± 3,98 | −0,250 | 0,228 | −0,109 | 0,605 |
| — **no alvo** | 4,36 ± 2,18 | **+0,330** | 0,108 | 0,471 | 0,017 |
| — **para fora** | 6,44 ± 3,19 | **−0,501** | **0,011** | −0,423 | 0,035 |
| Gols | 1,00 ± 0,96 | 0,473 | 0,017 | 0,640 | <0,001 |
| Conversão % | 10,32 ± 10,06 | 0,489 | 0,013 | 0,538 | 0,006 |
| Defesas do goleiro | 2,48 ± 1,50 | −0,034 | 0,871 | −0,099 | 0,639 |

**Nothing here clears a Bonferroni bar for six metrics** (0,05/6 ≈ 0,008) —
`para fora` at 0,011 comes closest and does not make it. This is a 25-point side
with **ten draws**, so its points are compressed into a narrow band and every
correlation has less to work with. Read the whole document accordingly.

### Médias por resultado

| res | n | fin | alvo | gols | conv% | defesas | gols sofridos |
|---|---|---|---|---|---|---|---|
| V | 5 | 10,6 | **6,4** | 2,00 | 20,0 | 2,00 | 0,40 |
| E | 10 | 9,4 | 3,6 | 0,90 | 9,8 | 2,80 | 0,90 |
| D | 10 | **12,6** | 4,1 | 0,60 | 6,0 | 2,40 | 2,00 |

**Defeats are the highest-volume group** — 12,6 against 10,6 in wins. That is a
different inversion from Athletico-PR's and Palmeiras', where the *draws* were
the high-volume group. Here the shooting happens in matches this side loses.

## The splits

```
conversão >= 8%    n=13   5V-6E-2D   1,62 pts/jogo   fin= 9,6   conv=17,8%
conversão <  8%    n=12   0V-4E-8D   0,33 pts/jogo   fin=12,3   conv= 2,2%

finalizações >= 11 n=13   4V-3E-6D   1,15 pts/jogo   fin=14,1   conv= 9,4%
finalizações <  11 n=12   1V-7E-4D   0,83 pts/jogo   fin= 7,5   conv=11,3%
```

**Twelve matches at 2,2% conversion produced no wins at all** — and that half
shot *more* than the winning half (12,3 against 9,6).

## The decomposition, which is what this club adds

Every earlier document treated `finalizações` as one number and found it inert.
Internacional splits it visibly:

| | ρ vs pontos |
|---|---|
| finalizações **no alvo** | **+0,330** |
| finalizações **para fora** | **−0,501** |
| total | −0,250 |

The total is not a weak signal; it is **two signals cancelling**. And this is not
one club's quirk — run across all twenty on the same join:

| | mean ρ | direction |
|---|---|---|
| **no alvo** | **+0,374** | positive in **20 of 20** |
| **para fora** | **−0,139** | negative in **15 of 20** |
| finalizações (total) | +0,114 | positive in 13 of 20 |

`no alvo` out-predicts the total in **19 of 20** clubs. Internacional is the
**second** most negative on `para fora`; Mirassol is first at −0,520.

### Which half of that is mechanically clean, and which is not

This matters more than the numbers. **`no alvo` is gols + defendidas — it
contains the goals.** So its correlation with points carries exactly the same
tautological component this series has flagged for conversão throughout, and it
should not be read as independent evidence.

**`para fora` contains no goals at all.** It is purely the shots that produced
nothing, and it correlates *negatively* with points in fifteen of twenty clubs.
Nothing mechanical produces that. It is the same clean half the negative volume
splits at [Botafogo](botafogo-scouts-vs-resultados.md) and
[Cruzeiro](cruzeiro-scouts-vs-resultados.md) rest on, isolated as its own
counter.

## The venue control

Applied as in [Grêmio](gremio-scouts-vs-resultados.md), where the division's
apparent volume signal turned out to be playing at home. Here there is almost no
home advantage to confound with:

| | ρ |
|---|---|
| jogar em casa → pontos | **0,060** |
| jogar em casa → finalizações | 0,145 |
| jogar em casa → conversão | −0,085 |

1,08 pts/jogo at home against 0,92 away. Within each half:

| | em casa (n=13) | fora (n=12) | overall |
|---|---|---|---|
| ρ finalizações → pontos | **−0,303** | **−0,258** | −0,250 |
| ρ conversão → pontos | 0,655 | 0,339 | 0,489 |

**The negative volume correlation survives in both halves**, so it is not a
venue artefact. Conversão stays positive in both, weaker away.

## Limits

1. **Nothing clears a corrected significance bar for this club.** Ten draws
   compress the outcome variable. The division-wide decomposition is what
   carries the reading, not any figure in this club's own table.
2. **`no alvo` is partly mechanical**, as above; **`para fora` is not**, which is
   why the argument rests on the second.
3. **Five wins.** The V row is five matches.
4. **One control is not a model** — opponent strength is untouched here as
   everywhere in this series.
5. **Descriptive, not predictive.**

## Reproducing

Difference `CLUB_SCOUTS_HISTORY["6684"]`, join **window `round − 1` to the match
played in that round**, and check ρ gols against points first — 0,473 here. The
decomposition is `shotsOff` against `goals + shotsSaved`, both already in the
tuple.
