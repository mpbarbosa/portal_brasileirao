# Atlético-MG — scouts por rodada contra V/E/D

A **frozen analysis**, not a living document. Written 2026-09-06 against
`origin/main` = `f04c569`, seed snapshot `2026-09-02`, rodadas 1..25.

Ninth per-club reading, and the first chosen by a number rather than by size:
the eight before it never took the top of the column the whole series is about.
The others are [Athletico-PR](athletico-pr-scouts-vs-resultados.md),
[Palmeiras](palmeiras-scouts-vs-resultados.md),
[Flamengo](flamengo-scouts-vs-resultados.md),
[Corinthians](corinthians-scouts-vs-resultados.md),
[Botafogo](botafogo-scouts-vs-resultados.md),
[Grêmio](gremio-scouts-vs-resultados.md),
[Cruzeiro](cruzeiro-scouts-vs-resultados.md) and
[Internacional](internacional-scouts-vs-resultados.md); the division-wide
comparison is [here](divisao-scouts-vs-resultados.md). Atlético-MG has played
24 — **10V-6E-8D, 36 pontos, 8º, saldo +4**.

## Finding, in one line

**This is the club where conversão predicts hardest in the division (ρ = 0,725),
and — the part that matters — the two halves of its season split by conversão
shoot the SAME amount.** The high half averages 9,5 finalizações and the low
half 9,6, a gap of **−0,08 shots**, and they take 2,42 against 0,58 points a
game. Whatever conversão is measuring here, it is not volume wearing a hat.

That is the objection every earlier document in this series had to argue around
rather than settle. This club settles it arithmetically.

## The data

Nothing is excluded and nothing is estimated:

- **24 matches, all usable** — no empty window, no zeroed rodada
- the missing rodada is **21**, and it is not a data gap: fixture `554940`,
  Atlético-MG × Bragantino, is **POSTPONED** in the seed with a kickoff of
  2026-07-29 that never happened. The match does not exist to be counted.
- the join validates **23 of 23** checkable matches — **100%**
- coverage from `jogos_num` is **24**, equal to the fixture count
- the reconciliation closes **exactly**: scoreline **32** goals, scout **31**,
  own goals in its favour **1** — and 31 + 1 = 32

That single own goal is rodada 1, the 2-2 with Palmeiras: the scoreline gives
Atlético-MG two, the scout counters one, and the difference is a Palmeiras
player. It is the only match in the season where the two measures disagree, and
they disagree by exactly the amount `goals.ts` says they should.

| r | adversário | C/F | res | placar | fin | alvo | fora | trave | gols | conv% | defesas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Palmeiras | C | E | 2-2 | 9 | 2 | 7 | 0 | 1 | 11 | 4 |
| 2 | Bragantino | F | D | 0-1 | 5 | 1 | 3 | 1 | 0 | 0 | 4 |
| 3 | Clube do Remo | C | E | 3-3 | 15 | 8 | 5 | 2 | 3 | 20 | 3 |
| 4 | Grêmio | F | D | 1-2 | 5 | 2 | 3 | 0 | 1 | 20 | 5 |
| 5 | Internacional | C | V | 1-0 | 7 | 3 | 4 | 0 | 1 | 14 | 8 |
| 6 | Vitória | F | D | 0-2 | 8 | 3 | 5 | 0 | 0 | 0 | 2 |
| 7 | São Paulo | C | V | 1-0 | 8 | 4 | 4 | 0 | 1 | 13 | 3 |
| 8 | Fluminense | F | D | 0-1 | 11 | 5 | 5 | 1 | 0 | 0 | 3 |
| 9 | Chapecoense | F | V | 4-0 | 13 | 7 | 4 | 2 | 4 | 31 | 4 |
| 10 | Athletico-PR | C | V | 2-1 | 11 | 5 | 6 | 0 | 2 | 18 | 2 |
| 11 | Santos | F | D | 0-1 | 7 | 3 | 4 | 0 | 0 | 0 | 1 |
| 12 | Coritiba | F | D | 0-2 | 18 | 7 | 10 | 1 | 0 | 0 | 0 |
| 13 | Flamengo | C | D | 0-4 | 14 | 3 | 9 | 2 | 0 | 0 | 3 |
| 14 | Cruzeiro | F | V | 3-1 | 6 | 4 | 2 | 0 | 3 | 50 | 1 |
| 15 | Botafogo | C | E | 1-1 | 12 | 6 | 6 | 0 | 1 | 8 | 4 |
| 16 | Mirassol | C | V | 3-1 | 12 | 6 | 6 | 0 | 3 | 25 | 1 |
| 17 | Corinthians | F | D | 0-1 | 3 | 0 | 3 | 0 | 0 | 0 | 3 |
| 18 | Vasco da Gama | F | V | 1-0 | 7 | 5 | 2 | 0 | 1 | 14 | 7 |
| 19 | Bahia | C | E | 1-1 | 12 | 4 | 7 | 1 | 1 | 8 | 3 |
| 20 | Palmeiras | F | V | 2-1 | 7 | 4 | 3 | 0 | 2 | 29 | 5 |
| 22 | Clube do Remo | F | E | 2-2 | 5 | 2 | 3 | 0 | 2 | 40 | 2 |
| 23 | Grêmio | C | V | 3-0 | 12 | 5 | 6 | 1 | 3 | 25 | 1 |
| 24 | Internacional | F | E | 0-0 | 8 | 5 | 3 | 0 | 0 | 0 | 3 |
| 25 | Vitória | C | V | 2-1 | 14 | 8 | 6 | 0 | 2 | 14 | 2 |

## Correlation (n = 24)

Spearman ρ against pontos (3/1/0), Pearson r against saldo de gols.

| métrica | média ± dp | ρ (pontos) | p | r (saldo) | p |
|---|---|---|---|---|---|
| Finalizações | 9,54 ± 3,80 | 0,129 | 0,5494 | 0,006 | 0,9794 |
| — no alvo | 4,25 ± 2,11 | 0,438 | 0,0322 | 0,385 | 0,0631 |
| — para fora | 4,83 ± 2,08 | −0,111 | 0,6045 | −0,346 | 0,0972 |
| Gols | 1,29 ± 1,23 | **0,781** | 0,0000 | 0,821 | 0,0000 |
| Conversão % | 14,19 ± 13,89 | **0,725** | 0,0001 | 0,683 | 0,0002 |
| Defesas | 3,08 ± 1,89 | 0,063 | 0,7684 | 0,076 | 0,7229 |

**Under Bonferroni at six metrics (0,05/6 ≈ 0,0083) exactly two survive: gols
and conversão.** `no alvo` at p = 0,0322 does **not**, and it is the one a
reader would most want to keep — so it is named here as failing rather than
quietly reported at its uncorrected value.

ρ gols = 0,781 is the sanity check, not a finding: goals against points is
near-tautological, so a value near zero would mean the join had slipped. It did
not.

### Médias por resultado

| res | n | fin | alvo | gols | conv% | defesas | sofridos |
|---|---|---|---|---|---|---|---|
| V | 10 | 9,7 | 5,1 | 2,20 | 23,3 | 3,40 | 0,50 |
| E | 6 | 10,2 | 4,5 | 1,33 | 14,6 | 3,17 | 1,50 |
| D | 8 | 8,9 | 3,0 | 0,13 | 2,5 | 2,63 | 1,75 |

Read the columns against each other. **Finalizações barely move** — 9,7 / 10,2 /
8,9, with the draws *above* the wins, which puts this club among the nine the
division report lists as drawing its higher-volume matches. **Conversão moves by
an order of magnitude**: 23,3% → 14,6% → **2,5%**.

## The defeats, which are the whole shape

**Eight defeats, one goal.** Not one goal a game — one goal, total, across all
eight; seven of them are shutouts. The exception is rodada 4 at Grêmio, lost
1-2.

Eight of the 24 matches ended scoreless for Atlético-MG, and **seven of those
eight are the defeats**. The eighth is rodada 24, the 0-0 away at Internacional,
which is the only time this season it failed to score and did not lose.

So the club's defeats are not matches it lost narrowly on chances. They are
matches where the conversion rate is *zero* and the volume is ordinary — 8,9
finalizações, against 9,7 in the wins. It shot within one attempt of its winning
average and scored one goal in eight games.

## The splits, and the one that carries the finding

Median finalizações **8,5**; median conversão **13,4%**.

| corte | n | campanha | pts/jogo | fin | conv% |
|---|---|---|---|---|---|
| fin ≥ 8,5 | 12 | 5V-4E-3D | 1,58 | 12,8 | 13,4 |
| fin < 8,5 | 12 | 5V-2E-5D | 1,42 | 6,3 | 15,0 |
| conv ≥ 13,4% | 12 | **9V-2E-1D** | **2,42** | 9,5 | 25,0 |
| conv < 13,4% | 12 | **1V-4E-7D** | **0,58** | 9,6 | 3,4 |

The volume split does almost nothing: 1,58 against 1,42 points a game, and the
half that shoots **half as much** (6,3 against 12,8) converts *better* (15,0%
against 13,4%).

The conversão split is the sharpest in the series — 9V-2E-1D against 1V-4E-7D,
four times the points — and it does it at **9,5 against 9,6 finalizações**.

**That −0,08 is the sentence.** A sceptic's first move against every document in
this series is that conversão is volume in disguise: convert well and you were
probably shooting from good positions, which means fewer, better chances. Here
the two halves of the season are separated by four times the points and by
**less than a tenth of one shot per match**. The confound is not controlled away
or argued about; it is simply absent from the data.

## The venue control

The control that [Grêmio](gremio-scouts-vs-resultados.md) forced on this series,
because that club's entire volume signal turned out to be home advantage.

| | n | pts/jogo | fin | conv% | ρ(fin, pts) | ρ(conv, pts) |
|---|---|---|---|---|---|---|
| em casa | 11 | 2,00 | 11,5 | 14,3 | **−0,431** | 0,693 |
| fora | 13 | 1,08 | 7,9 | 14,1 | 0,097 | 0,754 |

Campanha: **6V-4E-1D em casa, 4V-2E-7D fora.** Seven of the eight defeats are
away.

ρ(casa, pontos) = 0,387, ρ(casa, finalizações) = **0,541**, ρ(casa, conversão) =
**0,117**.

This is Grêmio's mechanism, reproduced exactly and then broken. Playing at home
raises the shot count hard (0,541) and the conversion rate barely at all
(0,117) — so the club's weak, non-significant volume correlation (0,129) is
made of home advantage and nothing else. Condition on venue and it does not
merely weaken: **at home it goes negative, −0,431.** Within its own home
matches, Atlético-MG shooting more went with taking fewer points.

Conversão does the opposite. It is 0,725 overall and **higher inside each half**
— 0,693 at home, 0,754 away — which is what a real effect looks like when a
confounder is removed rather than a spurious one.

## What this adds to the division

Two columns of the [division table](divisao-scouts-vs-resultados.md) have their
maximum here, and no other club holds either:

- **ρ conversão 0,73 — the highest of the twenty** (next: Flamengo 0,68)
- **Δ conversão 1,83 — the largest of the twenty** (next: Botafogo 1,79)

Against that, ρ finalizações is 0,13 — **8º de 20**, tied with Vasco and
Cruzeiro, and not significant on its own (p = 0,55). So the club that tops the
division on converting predictably is unremarkable on shooting, which is the
whole argument of this series stated in one club.

It is also the ninth reading and the **fourth** to sit on the "dominei e
empatei" side — after Athletico-PR, Palmeiras and Botafogo — with draws
out-shooting wins, 10,17 against 9,70. That gap is small, half a shot, and it is
the *sign* rather than the size that places it: the division splits 9 to 11 on
this, and reading only the first two documents in this series would leave the
opposite impression.

## Limits

- **n = 24, and one fixture is postponed rather than missing.** Rodada 21 will
  eventually be played, and when it is, every figure here moves. This document
  is frozen at the snapshot in its header and is not maintained.
- **The counters are weekly and the rodada is a window, not a match.** caRtola
  publishes cumulative snapshots; a rodada's figures are the difference between
  two of them. 94% of club-rounds in 2026 hold exactly one match, but the
  attribution is to the window, not to the fixture.
- **Conversão at zero finalizações is not defined**, and no such window exists
  here, so nothing was dropped for it.
- **Defesas is a proxy and a poor one.** It counts saves the goalkeeper made,
  not shots the club faced, so a defence beaten often reads lower than the
  pressure on it was. Its ρ of 0,063 should be read as "this metric says
  nothing here", not as "the defence did not matter".
- **The venue control is a stratification, not a model.** Eleven home and
  thirteen away matches is a small split, and no interaction is tested.
- **`no alvo` mechanically contains the goals** and so cannot be read as
  independent evidence for conversão; `para fora` is the clean half, and it is
  −0,111 and not significant.

## Reproducing

```sh
# per club, with CLUB_SCOUTS_HISTORY[code] differenced into per-rodada deltas
# and joined to fixtures on d[match.round - 1] — NEVER positionally on d[i],
# because a club with an unplayed or postponed rodada is off by one after it.
# Atlético-MG is code 1766. finalizações = gols + no alvo + para fora + trave,
# four counters and not three: the source stops counting a shot once it scores.
```

The join validated 23 of 23 checkable matches against `src/data/goals.ts`, and
ρ gols = 0,781 is the second gate on it. A positional join would show ρ gols
near zero, which is how the defect
[Flamengo](flamengo-scouts-vs-resultados.md) exposed was caught.
