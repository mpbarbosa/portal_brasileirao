# Flamengo — scouts por rodada contra V/E/D

A **frozen analysis**, not a living document. Written 2026-09-06 against
`origin/main` = `8f390d4`, seed snapshot `2026-09-02`, rodadas 1..25.

Third in the series, after
[Athletico-PR](athletico-pr-scouts-vs-resultados.md) and
[Palmeiras](palmeiras-scouts-vs-resultados.md). Flamengo had played 24 of 25 at
the snapshot — 13V-6E-4D — and its round-4 fixture was still unplayed.

**This club broke the method, and fixing it is the most useful thing here.**
Read the next section before the findings.

## The join must be by ROUND NUMBER, not by position

The first two analyses differenced the history and joined **the i-th window to
the i-th played match**. That is correct only when a club has played every
round — and both of those clubs had.

Flamengo has **not** played round 4 (`554775`, v Mirassol, still `SCHEDULED`).
The seed list skips it, so from position 4 onward every window was joined to the
*next* round's match. Under that join:

- the goals check validated **7 of 24** matches
- `Gols` correlated with points at **ρ = −0,006**
- the club appeared to score **more** in draws (2,17) than in wins (1,75)

**That last pair is the tell, and it is worth more than the fix.** Goals scored
must correlate with points; it is nearly tautological. A ρ of zero there is not a
finding about Flamengo, it is a receipt for a broken join — and it is a check
that costs nothing and cannot be argued with, unlike any of the metrics the
analysis is actually about.

Joining on `d[match.round - 1]` instead:

| | positional | by round number |
|---|---|---|
| Flamengo join validation | 29% | **96%** |
| Mirassol | 58% | **92%** |
| mean across the division | 87,3% | **97,0%** |
| clubs at ≥90% | 12 of 20 | **20 of 20** |

**The delta is exactly zero for all ten clubs with no missing round**, and
positive for all ten that have one. That is the diagnostic: the flaw can only
touch a club with a fixture gap.

### What this does and does not invalidate

- **Athletico-PR and Palmeiras are unaffected.** Both played all 25 rounds, so
  their two joins coincide, delta 0. Every number in those two documents stands.
- **The division-wide sweep published in the Palmeiras report is wrong** and is
  corrected there and below. It used the positional join across all twenty.

## Finding, in one line

**Conversão predicts results here as it does elsewhere — but unlike the first
two clubs, volume predicts too.** Flamengo's wins are its highest-volume matches,
where Athletico's and Palmeiras' were not.

## The data

Round 3's window is empty — caRtola never recorded that match — so it is dropped,
leaving 23. The join validates **23 of 24** checkable matches.

| r | adversário | C/F | res | placar | fin | alvo | fora | trave | gols | conv% | defesas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | São Paulo | F | D | 1-2 | 11 | 5 | 6 | 0 | 1 | 9 | 2 |
| 2 | Internacional | C | E | 1-1 | 9 | 4 | 5 | 0 | 1 | 11 | 3 |
| 5 | Cruzeiro | C | V | 2-0 | 13 | 5 | 6 | 2 | 2 | 15 | 4 |
| 6 | Botafogo | F | V | 3-0 | 15 | 6 | 9 | 0 | 3 | 20 | 1 |
| 7 | Clube do Remo | C | V | 3-0 | 7 | 3 | 4 | 0 | 3 | 43 | 1 |
| 8 | Corinthians | F | E | 1-1 | 8 | 1 | 6 | 1 | 1 | 13 | 1 |
| 9 | Bragantino | F | D | 0-3 | 4 | 1 | 3 | 0 | 0 | 0 | 3 |
| 10 | Santos | C | V | 3-1 | 12 | 4 | 7 | 1 | 3 | 25 | 1 |
| 11 | Fluminense | F | V | 2-1 | 12 | 8 | 3 | 1 | 2 | 17 | 4 |
| 12 | Bahia | C | V | 2-0 | 16 | 8 | 6 | 2 | 2 | 13 | 6 |
| 13 | Atlético-MG | F | V | 4-0 | 7 | 6 | 0 | 1 | 4 | 57 | 5 |
| 14 | Vasco da Gama | C | E | 2-2 | 9 | 6 | 3 | 0 | 2 | 22 | 3 |
| 15 | Grêmio | F | V | 1-0 | 14 | 5 | 7 | 2 | 1 | 7 | 3 |
| 16 | Athletico-PR | F | E | 1-1 | 9 | 2 | 6 | 1 | 1 | 11 | 4 |
| 17 | Palmeiras | C | D | 0-3 | 15 | 3 | 12 | 0 | 0 | 0 | 3 |
| 18 | Coritiba | C | V | 3-0 | 17 | 9 | 8 | 0 | 3 | 18 | 2 |
| 19 | Chapecoense | F | V | 4-0 | 9 | 6 | 3 | 0 | 3 | 33 | 3 |
| 20 | São Paulo | C | E | 1-1 | 13 | 5 | 7 | 1 | 1 | 8 | 0 |
| 21 | Internacional | F | E | 1-1 | 6 | 4 | 2 | 0 | 1 | 17 | 4 |
| 22 | Vitória | C | V | 2-0 | 13 | 5 | 7 | 1 | 2 | 15 | 1 |
| 23 | Mirassol | F | V | 5-1 | 11 | 7 | 4 | 0 | 5 | 45 | 4 |
| 24 | Cruzeiro | F | D | 1-2 | 10 | 3 | 7 | 0 | 1 | 10 | 4 |
| 25 | Botafogo | C | V | 3-0 | 13 | 6 | 7 | 0 | 3 | 23 | 4 |

## Correlation (n = 23)

| métrica | média ± dp | ρ (pontos) | p | r (saldo) | p |
|---|---|---|---|---|---|
| Finalizações | 11,00 ± 3,38 | 0,356 | 0,096 | 0,223 | 0,307 |
| **— no alvo** | 4,87 ± 2,12 | **0,637** | **0,001** | 0,611 | 0,002 |
| — para fora | 5,57 ± 2,59 | 0,013 | 0,951 | −0,245 | 0,259 |
| Gols | 1,96 ± 1,26 | 0,821 | <0,001 | 0,916 | <0,001 |
| **Conversão %** | 18,78 ± 14,16 | **0,683** | **<0,001** | 0,794 | <0,001 |
| Defesas do goleiro | 2,87 ± 1,52 | 0,078 | 0,723 | 0,064 | 0,771 |

**Finalizações no alvo is the metric that separates this club**, at ρ 0,637 — it
was 0,281 for Athletico-PR and 0,192 for Palmeiras, neither significant. Raw
volume is positive but does not reach significance; shots *off target* carry
nothing at all (0,013).

### Médias por resultado

| res | n | fin | alvo | gols | conv% | defesas | gols sofridos |
|---|---|---|---|---|---|---|---|
| V | 13 | **12,2** | 6,0 | 2,77 | 25,5 | 3,00 | 0,23 |
| E | 6 | **9,0** | 3,7 | 1,17 | 13,6 | 2,50 | 1,17 |
| D | 4 | 10,0 | 3,0 | 0,50 | 4,8 | 3,00 | 2,50 |

**This is the inversion.** For Athletico-PR and Palmeiras the empates were the
*highest*-volume group; for Flamengo they are the lowest. This club's draws are
matches it did not create in, not matches it dominated and failed to convert.

## The splits

```
conversão >= 15%   n=13   11V-2E-0D   2,69 pts/jogo   fin=11,1
conversão <  15%   n=10    2V-4E-4D   1,00 pts/jogo   fin=10,9

finalizações >= 11 n=13   10V-1E-2D   2,38 pts/jogo   fin=13,5
finalizações <  11 n=10    3V-5E-2D   1,40 pts/jogo   fin= 7,8
```

The conversão split is the widest of the three clubs studied — **1,69 pts/jogo,
and unbeaten in the top half** — on near-identical volume (11,1 against 10,9),
which is the Athletico-PR shape.

But **the volume split also separates here** (2,38 against 1,40), where it barely
moved for the other two (1,92/1,73 and 2,21/1,91). Both channels carry signal for
this club.

### Casa e fora

```
em casa   n=11   7V-3E-1D   2,18 pts/jogo   fin=12,5
fora      n=12   6V-3E-3D   1,75 pts/jogo   fin= 9,7
```

## The corrected division-wide sweep

Re-run on the round-number join, replacing the figures in the Palmeiras report:

| | finalizações | conversão |
|---|---|---|
| mean ρ against pontos | 0,114 | **0,553** |
| positive in | 13 of 20 | **20 of 20** |
| higher than the other metric in | 1 of 20 | **19 of 20** |

Compared with what was published there (0,108 / 0,461, positive 13/20 and 19/20,
conversão ahead in 18/20), **the corrected numbers are stronger on every line.**

And the sentence naming Flamengo as *"the only negative conversão correlation in
the league"* is withdrawn: it was not an exception, it was the most broken join
in the division. Under the corrected join its conversão ρ is **0,683**, among the
highest.

## Limits

1. **Four defeats**, so the D row is thin — the same caveat as Palmeiras' three.
2. **Conversão is partly mechanical**, as in both earlier documents. The half
   that is not is the equal volume across the two conversion groups.
3. **Round 3 is missing** from the counters and round 4 from the season, so this
   is 23 of a possible 25.
4. **Descriptive, not predictive.**

## Reproducing

Difference `CLUB_SCOUTS_HISTORY["1783"]` and join **window `round - 1` to the
match played in that round** — never the i-th window to the i-th match. Drop any
window whose five counters are flat.

**Check `Gols` against points before reading anything else.** If it is not
strongly positive, the join is wrong and no other number on the page means
anything.
