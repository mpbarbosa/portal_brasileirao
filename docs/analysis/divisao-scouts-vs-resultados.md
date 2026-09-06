# A divisão — scouts por rodada contra V/E/D, nos vinte clubes

A **frozen analysis**, not a living document. Written 2026-09-06 against
`origin/main` = `015be77`, seed snapshot `2026-09-02`, rodadas 1..25.

Extends the three per-club readings —
[Athletico-PR](athletico-pr-scouts-vs-resultados.md),
[Palmeiras](palmeiras-scouts-vs-resultados.md),
[Flamengo](flamengo-scouts-vs-resultados.md) — to the whole division, as one
comparison rather than seventeen more documents.

## Finding, in one line

**Conversão predicts results in every club in the division; shot volume predicts
them in barely more than half, and hurts in a quarter.**

## Method, and the one rule that makes it work

Per club: difference the cumulative history into per-rodada counters, join
**window `rodada − 1` to the match played in that rodada**, and drop any window
whose five counters are flat.

**The join must be by round number, never by position.** Ten of the twenty clubs
have an unplayed rodada — four fixtures postponed in rodada 21 (eight clubs) and
one still scheduled in rodada 4 (Flamengo and Mirassol) — and a positional join
shifts everything after the gap by one round. That defect is why the Flamengo
report exists; it took that club's join from 29% to 96%.

Two columns in the table exist to let a reader check the work rather than trust
it:

- **junção** — the share of matches whose scout `goals` reproduces the scoreline
  minus own goals. It runs **91% to 100%** across the division.
- **ρ gols** — goals scored against points won. This is close to tautological, so
  it is not a finding; it is the **aferição**. It runs **0,40 to 0,82 and is
  positive for all twenty**. A value near zero would mean the join for that row
  is broken and nothing else in it can be read — which is exactly how the
  positional defect was caught.

`Δ volume` and `Δ conversão` are the points-per-match gap between the halves of a
median split on that metric.

## The division

Sorted by ρ conversão.

| clube | n | rodada ausente | junção | ρ gols | ρ finalizações | ρ conversão | fin V | fin E | Δ volume | Δ conversão |
|---|---|---|---|---|---|---|---|---|---|---|
| Atlético-MG | 24 | 21 | 100% | 0,78 | 0,13 | **0,73** | 9,70 | 10,17 | 0,17 | 1,83 |
| Flamengo | 23 | 4 | 96% | 0,82 | 0,36 | **0,68** | 12,23 | 9,00 | 0,98 | 1,69 |
| São Paulo | 24 | 21 | 100% | 0,80 | 0,04 | **0,67** | 9,75 | 9,17 | 0,00 | 1,50 |
| Vitória | 22 | — | 91% | 0,75 | 0,37 | **0,65** | 10,57 | 8,25 | 1,00 | 1,36 |
| Coritiba | 25 | — | 100% | 0,72 | -0,10 | **0,65** | 7,30 | 8,71 | 0,21 | 1,67 |
| Cruzeiro | 25 | — | 100% | 0,69 | 0,13 | **0,62** | 11,64 | 9,83 | -0,30 | 1,40 |
| Vasco da Gama | 23 | 21 | 100% | 0,71 | 0,13 | **0,61** | 12,67 | 12,14 | 0,69 | 0,86 |
| Botafogo | 21 | 21 | 91% | 0,64 | -0,03 | **0,60** | 9,14 | 14,20 | -0,50 | 1,79 |
| Mirassol | 22 | 4 | 92% | 0,61 | -0,26 | **0,60** | 8,40 | 9,83 | -0,45 | 0,64 |
| Athletico-PR | 23 | — | 96% | 0,63 | 0,22 | **0,53** | 9,92 | 11,33 | 0,19 | 1,54 |
| Bragantino | 23 | 21 | 96% | 0,73 | 0,40 | **0,52** | 13,40 | 12,50 | 0,57 | 1,27 |
| Palmeiras | 25 | — | 100% | 0,46 | -0,08 | **0,50** | 9,93 | 11,43 | 0,31 | 0,79 |
| Santos | 23 | 21 | 91% | 0,43 | -0,16 | **0,49** | 7,71 | 9,86 | -0,63 | 0,92 |
| Corinthians | 24 | — | 95% | 0,54 | 0,11 | **0,49** | 12,29 | 5,25 | 0,36 | 1,25 |
| Internacional | 25 | — | 100% | 0,47 | -0,25 | **0,49** | 10,60 | 9,40 | 0,32 | 1,28 |
| Grêmio | 23 | 21 | 95% | 0,66 | 0,63 | **0,48** | 10,71 | 8,29 | 1,81 | 0,92 |
| Clube do Remo | 25 | — | 100% | 0,59 | 0,37 | **0,48** | 10,80 | 10,38 | 0,37 | 1,29 |
| Chapecoense | 23 | 21 | 100% | 0,40 | -0,12 | **0,47** | 6,00 | 9,50 | -0,10 | 0,64 |
| Fluminense | 24 | — | 96% | 0,60 | 0,34 | **0,42** | 13,91 | 10,13 | 0,30 | 0,64 |
| Bahia | 24 | — | 100% | 0,45 | 0,04 | **0,39** | 10,78 | 12,20 | 0,08 | 0,59 |

## What the columns say

**Conversão, ρ against pontos:** positive in **20 of 20**, mean **0,553**.

**Finalizações, ρ against pontos:** positive in **13 of 20**, mean **0,114** —
and negative in seven, reaching −0,26 (Mirassol) and −0,25 (Internacional).

**Conversão out-predicts volume in 19 of 20 clubs.** The single exception is
**Grêmio** (0,63 against 0,48), which is also the club with the widest volume
split in the league at +1,81 pts/jogo.

The median splits say it more plainly than the correlations do:

| | positive | ≥ +0,5 pts/jogo | negative |
|---|---|---|---|
| Δ conversão | **20 of 20** | **20 of 20** | **0** |
| Δ volume | 14 of 20 | 5 of 20 | **5** |

Mean Δ conversão is **+1,19 pts/jogo** against **+0,27** for volume — the
conversion split is about four times as wide. Every club in the division gains at
least half a point a match from the top half of its conversion split, and **the
weakest of those twenty (Bahia, +0,59) is still wider than sixteen of the twenty
volume splits.**

## The shapes, and a correction to the impression the three reports give

Athletico-PR and Palmeiras both draw their **highest-volume** matches: the
"dominei e empatei" shape. Flamengo inverts it — its draws are its lowest-volume
matches.

**Across the division that split is 9 to 11.** Draws out-shoot wins in **nine of
twenty** clubs. So the shape the first two reports found is common, and it is
**not** the division's default — reading those two documents alone would leave
the opposite impression, and picking them first was luck rather than design.

The nine where draws out-shoot wins: Atlético-MG, Coritiba, Botafogo, Mirassol,
Athletico-PR, Palmeiras, Santos, Chapecoense, Bahia. The largest gap is
**Botafogo**, drawing at 14,2 finalizações against 9,1 in wins — 5,1 more shots
in the matches it fails to win.

At the other end, **Corinthians** wins at 12,3 and draws at 5,2, a 7,0 gap the
other way: when that side does not shoot, it does not win.

**Neither shape is better.** Botafogo and Corinthians sit either side of this
axis and neither is near the top of the table; Palmeiras leads the division from
the "dominei e empatei" side. What the axis describes is *how* a club fails to
convert territory into points, not whether it does.

## Limits

1. **Conversão is gols/finalizações and gols decide results**, so part of every
   ρ conversão in that table is arithmetic. The claim that survives it is the
   **volume** half: nothing tautological makes shot count uninformative, and it
   is uninformative or worse in seven clubs.
2. **Per-club n is 20 to 25.** No single row here would clear a corrected
   significance bar on its own. The argument is the agreement across twenty
   independent rows, not any one of them.
3. **These are season-to-rodada-25 readings**, on counters that are a weekly
   snapshot and stale by construction.
4. **Descriptive, not predictive.** Nothing here says a club that converts more
   *will* win.
5. **Ten clubs are missing a rodada** and one more window is dropped for
   Athletico-PR (2), Flamengo (1) and others where caRtola recorded no actions.
   The `n` column is the honest count.

## Reproducing

```sh
# per club, with CLUB_SCOUTS_HISTORY[code] differenced into per-rodada deltas
window = delta[match.round - 1]        # never delta[i]
skip if all five counters are flat
```

Check **ρ gols** first. If it is not strongly positive for a club, that club's
join is wrong and no other number in its row means anything.
