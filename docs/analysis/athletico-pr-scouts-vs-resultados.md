# Athletico-PR — scouts por rodada contra V/E/D

A **frozen analysis**, not a living document. Written 2026-09-06 against
`origin/main` = `58295e3`, seed snapshot `2026-09-02`, rodadas 1..25.

`docs/analysis/` holds dated readings like this one: each is correct for the data
it names and is never edited afterwards. A figure here is a measurement taken on
a day, not a claim about today — the same bargain `docs/perfil-ataque.md` makes,
and for the same reason. Where this document and the page disagree, the page is
right and this is older.

> **Corrected 2026-09-06.** One figure here was wrong rather than overtaken, so
> it was amended in place: the post-fix rank read **12º de 20** and is **14º**.
> The frozen rule above governs readings the world has moved past — it is not a
> licence to leave arithmetic that was never right. Nothing else changed; the
> per-match table, the correlations and every rate are as first published.
>
> The error was a **mixed reading**: the new rank was computed with Athletico's
> denominator corrected and the other nineteen clubs still on their old ones.
> The fix raises thirteen clubs' rates, so the club climbs three places, not
> five. 14º was read back off the bytes production serves — 219/23 = 9,5217,
> thirteen clubs strictly above, an exact tie with Chapecoense on 219/23.

## The question

The Perfil on the Painel reports six season rates for a club, read against the
division. It says what a club *is*; it cannot say whether any of it relates to
**winning**. This asks that: over Athletico-PR's 2026 season, do the scouts
move with vitória / empate / derrota?

## Finding, in one line

**Shot volume does not predict this club's results. Finishing does** — and the
two groups that separate on finishing had *identical* shot volume, which is what
makes it a finding rather than an artefact of goals being in both terms.

## Provenance — what is measured and what is reasoned

Everything numeric below is measured, and the derivation is stated so it can be
disagreed with. Two things are **reasoned** and marked as such at the point they
appear: the reading of *why* the empates cluster where they do, and the claim
that conversão is only partly mechanical.

### There is no per-round scout data — it had to be reconstructed

`src/data/club-scouts-history.ts` is **cumulative**, and `src/types.ts` says a
round's own figures are not recoverable: caRtola publishes weekly, so a midweek
round falls between two snapshots. Differencing consecutive rodadas is therefore
an assumption, not a given, and needed a test before anything was built on it.

**The test used is independent of the thing being tested**: each window's `goals`
delta must equal that match's scoreline, minus own goals read from
`src/data/goals.ts`.

| join | windows reproducing the scoreline |
|---|---|
| by **rodada** | **22 of 23 checkable** |
| by kickoff order | 19 of 23 |

So caRtola keys by rodada rather than by date, and the by-round join is the
correct one. `goals.ts` covers 23 of the 25 matches; the two it misses are both
0-0 for Athletico, so the club's own-goals-in-favour count is exactly **0** and
fully known — which is what makes the goals test exact here rather than a bound.

A second, independent check: the reconstructed per-match figures re-derive the
Perfil card exactly — 219 finalizações, 33/219 = 15,1% conversão, 64 defesas.

### Two matches are excluded, and it is not a judgement call

Windows 2 and 5 are **zero across all five counters**. They are exactly the two
fixtures Athletico played out of round order:

```
r1  2026-01-28
r2  2026-02-19   <- played AFTER r3
r3  2026-02-12
r4  2026-02-25
r5  2026-03-29   <- played AFTER r6, r7 and r8
r6  2026-03-15
```

The actions are **lost, not shifted** into a neighbouring window: the club's
scout goals are 33 against 37 scored, and the 4-goal gap is precisely round 5's
4-1. So the analysis runs on **23 of 25 matches**, and the two dropped are a
0-1 loss and a 4-1 win — an exclusion that is not neutral, and is stated rather
than buried.

Note the goals test is **blind in one direction here**: round 2 was a 0-0 for
Athletico's attack, so an empty window and a genuine zero are indistinguishable
by goals alone. Structural emptiness — all five counters flat — is what caught
it.

## The data

`fin` is `finishes` from `scouts-core.ts`: gols + defendidas + para fora + na
trave. `alvo` is gols + defendidas.

| r | adversário | C/F | res | placar | fin | alvo | fora | trave | gols | conv% | defesas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Internacional | F | V | 1-0 | 6 | 2 | 4 | 0 | 1 | 17 | 5 |
| 3 | Santos | C | V | 2-1 | 10 | 5 | 5 | 0 | 2 | 20 | 4 |
| 4 | Bragantino | F | E | 1-1 | 12 | 4 | 8 | 0 | 1 | 8 | 2 |
| 6 | Fluminense | F | D | 2-3 | 4 | 2 | 2 | 0 | 2 | 50 | 7 |
| 7 | Cruzeiro | C | V | 2-1 | 8 | 4 | 3 | 1 | 2 | 25 | 1 |
| 8 | Coritiba | C | V | 2-0 | 5 | 4 | 1 | 0 | 2 | 40 | 1 |
| 9 | Bahia | F | D | 0-3 | 9 | 4 | 4 | 1 | 0 | 0 | 2 |
| 10 | Atlético-MG | F | D | 1-2 | 7 | 3 | 4 | 0 | 1 | 14 | 3 |
| 11 | Chapecoense | C | V | 2-0 | 14 | 7 | 7 | 0 | 2 | 14 | 1 |
| 12 | Palmeiras | F | D | 0-1 | 5 | 3 | 2 | 0 | 0 | 0 | 1 |
| 13 | Vitória | C | V | 3-1 | 20 | 11 | 8 | 1 | 3 | 15 | 1 |
| 14 | Grêmio | C | E | 0-0 | 10 | 5 | 5 | 0 | 0 | 0 | 0 |
| 15 | Vasco da Gama | F | D | 0-1 | 7 | 3 | 3 | 1 | 0 | 0 | 5 |
| 16 | Flamengo | C | E | 1-1 | 15 | 5 | 8 | 2 | 1 | 7 | 2 |
| 17 | Clube do Remo | F | V | 2-1 | 14 | 11 | 3 | 0 | 2 | 14 | 1 |
| 18 | Mirassol | C | V | 1-0 | 9 | 2 | 6 | 1 | 1 | 11 | 3 |
| 19 | São Paulo | F | V | 2-1 | 8 | 4 | 2 | 2 | 2 | 25 | 2 |
| 20 | Internacional | C | V | 2-0 | 12 | 3 | 9 | 0 | 2 | 17 | 4 |
| 21 | Corinthians | F | E | 0-0 | 2 | 1 | 0 | 1 | 0 | 0 | 4 |
| 22 | Santos | F | V | 2-0 | 5 | 4 | 1 | 0 | 2 | 40 | 2 |
| 23 | Bragantino | C | E | 1-1 | 17 | 8 | 8 | 1 | 1 | 6 | 4 |
| 24 | Botafogo | F | V | 3-2 | 8 | 6 | 2 | 0 | 3 | 38 | 6 |
| 25 | Fluminense | C | E | 3-3 | 12 | 9 | 3 | 0 | 3 | 25 | 3 |

## Correlation (n = 23)

Spearman ρ against pontos (V=3, E=1, D=0); Pearson r against saldo de gols.

| métrica | média ± dp | ρ (pontos) | p | r (saldo) | p |
|---|---|---|---|---|---|
| Finalizações | 9,5 ± 4,5 | 0,22 | 0,319 | 0,24 | 0,272 |
| — no alvo | 4,8 ± 2,7 | 0,28 | 0,195 | 0,28 | 0,204 |
| — para fora | 4,3 ± 2,7 | 0,06 | 0,780 | 0,15 | 0,487 |
| Gols | 1,4 ± 1,0 | 0,63 | 0,001 | 0,64 | 0,001 |
| **Conversão %** | 16,8 ± 14,4 | **0,53** | **0,009** | 0,42 | 0,046 |
| Defesas do goleiro | 2,8 ± 1,8 | −0,17 | 0,432 | −0,19 | 0,382 |

**Gols is near-tautological** — goals decide results — and is listed as a sanity
check on the reconstruction rather than as a finding.

### Médias por resultado

| res | n | fin | alvo | fora | gols | conv% | defesas | gols sofridos |
|---|---|---|---|---|---|---|---|---|
| V | 12 | 9,9 | 5,3 | 4,3 | 2,00 | 23,0 | 2,58 | 0,58 |
| E | 6 | **11,3** | 5,3 | 5,3 | 1,00 | **7,6** | 2,50 | 1,00 |
| D | 5 | 6,4 | 3,0 | 3,0 | 0,60 | 12,9 | 3,60 | 2,00 |

Empates carry **more** finalizações than vitórias. That single row is most of
the finding.

## The split that carries it

```
conversão >= 14%   n=14   11V-1E-2D   2,43 pts/jogo   fin=9,5
conversão <  14%   n= 9    1V-5E-3D   0,89 pts/jogo   fin=9,6
```

**Identical volume — 9,5 against 9,6 finalizações — and a 1,5 pts/jogo gap.**
Splitting on volume instead barely moves anything:

```
finalizações >= 9  n=12   6V-5E-1D   1,92 pts/jogo
finalizações <  9  n=11   6V-1E-4D   1,73 pts/jogo
```

### Where the points leak

Five of the six empates came with conversão at or below 8%; and four of the six
— three of them among those five — carried ≥12 finalizações:

| r | adversário | placar | fin | gols | conv% |
|---|---|---|---|---|---|
| 4 | Bragantino (F) | 1-1 | 12 | 1 | 8 |
| 14 | Grêmio (C) | 0-0 | 10 | 0 | 0 |
| 16 | Flamengo (C) | 1-1 | 15 | 1 | 7 |
| 21 | Corinthians (F) | 0-0 | 2 | 0 | 0 |
| 23 | Bragantino (C) | 1-1 | 17 | 1 | 6 |
| 25 | Fluminense (C) | 3-3 | 12 | 3 | 25 |

### Casa e fora

```
em casa   n=11   7V-4E-0D   2,27 pts/jogo   fin=12,0
fora      n=12   5V-2E-5D   1,42 pts/jogo   fin= 7,3
```

Unbeaten at home; all five defeats away, on 40% less volume.

## Reading it

This is consistent with the club's own Perfil identity — **below-median volume,
top-five conversão** (17º/4º de 20 in the data named
above; 14º/4º since [#390](https://github.com/mpbarbosa/portal_brasileirao/pull/390)
merged as `132fce2`, for the denominator reason below) — and gives it a direction: **a side whose season
turns on the finishing rather than on chance creation, and which drops points
precisely in the matches it dominates.** The volume rank moves with that fix and
the argument does not: every per-match figure here is a counter difference, and
the split that carries the finding holds volume fixed at 9,5 against 9,6. *(Reasoned, not measured: the data establishes the
association; that the empates are dominated matches rather than, say, matches
against deep defences is a reading, and the fixtures — Flamengo, Bragantino
twice, Grêmio — are consistent with either.)*

Defesas do goleiro carries no usable signal (ρ = −0,17, p = 0,43). Derrotas
simply saw more shots faced. It is a proxy for pressure, and a beaten defence in
front of a beaten goleiro reads *lower* than the pressure on it was — the caveat
`scouts-core.ts` already states about that axis.

## Limits, stated rather than implied

1. **Conversão is partly mechanical.** It is gols/finalizações and gols decide
   results, so some of ρ = 0,53 is arithmetic. The half that is not is the equal
   volume across the two conversion groups — that comparison holds volume fixed
   and still separates by 1,5 pts/jogo.
2. **n = 23, six metrics tested.** p = 0,009 sits about at a Bonferroni
   threshold (0,05/6 ≈ 0,008), not comfortably past it. Treat it as one season's
   description, not as an established effect.
3. **Five derrotas.** Every D-row mean rests on five matches.
4. **Descriptive, not predictive.** Nothing here says a club that converts more
   *will* win; it says this club's wins and its conversion moved together.
5. **Two matches are missing**, one of them a 4-1 win — see the exclusion above.
6. **The counters are a weekly snapshot** and stale by construction, and the
   analysis inherits that.

## What this found in passing

Establishing the exclusion above surfaced a real defect: `ClubScouts.matches`
was the **fixture count**, while the counters did not always cover those
fixtures. Athletico-PR's 219 finalizações were divided by 25 where the covered
matches give 23 — **8,8 a game reported against 9,5, and 17º de 20 against 14º**
— with 13 of the 20 clubs affected.

Filed as [#385](https://github.com/mpbarbosa/portal_brasileirao/issues/385) and
fixed in [#390](https://github.com/mpbarbosa/portal_brasileirao/pull/390), merged
as `132fce2` on 2026-09-06, which reads the denominator from caRtola's own
`jogos_num`. **The data this report names predates that merge** — the provenance
above is unchanged and deliberately so. **This report's per-match
figures are unaffected by that fix** — they come from counter *differences* and
never touch the denominator — and were re-derived identically before and after
it. Only the card's own reading changes: 8,8 / 17º before, 9,5 / 14º after — and
that second rank is corrected, per the note at the head of this document.

## Reproducing

Difference `CLUB_SCOUTS_HISTORY["1768"]`, join to the club's finished seed
fixtures **by rodada**, and drop any window whose five counters are all flat.
`finishes` in `scouts-core.ts` is the shot total; `src/data/goals.ts` gives own
goals for the validation.

```sh
npm run test:unit   # tests/club-scouts-history.test.ts gates the empty-window case
```
