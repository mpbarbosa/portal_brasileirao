/**
 * HAND-MAINTAINED — the one data file in `src/data/` that is not generated.
 *
 * No provider we use carries broadcast data: football-data has no such field at
 * any tier, API Futebol's OpenAPI spec has none across its 17 endpoints, and
 * CBF's own "Onde assistir" page is a client-rendered app behind a token
 * endpoint. So these are transcribed by hand from
 * https://www.cbf.com.br/futebol-brasileiro/onde-assistir
 *
 * Keyed by **our match id**, deliberately. CBF's three-letter codes are not
 * unique across competitions — a single day's page showed `ATH` as both
 * Athletic Club (Série B) and Athletico-PR (Série A) — so any key built from
 * abbreviations would eventually attach the wrong channels to the wrong match.
 *
 * Transcription notes:
 * - CBF prints local times (`20h00`). Brazil has had no DST since 2019, so BRT
 *   is UTC-3 year-round: 20h00 → 23:00Z. Match on that instant.
 * - Separators vary on the page (`ESPN / Disney+`, `Premiere, Sportv`). Split
 *   them here; store one channel per entry.
 * - Names are normalised to the broadcaster's own branding, so `Sportv`
 *   becomes `SporTV`.
 * - Only Série A rows belong here; the page also lists Série B, women's and
 *   youth competitions.
 */
export const BROADCASTS: Record<string, string[]> = {
  // Rodada 24 — Botafogo x Athletico-PR, 2026-08-24 20h00 BRT, Nilton Santos.
  "554970": ["Premiere", "SporTV"],
};
