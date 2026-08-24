import type { Club } from "@/src/types";

/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: npx tsx scripts/sync-seed-data.ts
 *
 * Source: football-data.org competition BSA, season
 * 2026-01-28 to 2026-12-02. Snapshot taken 2026-08-24.
 *
 * `code` is the upstream numeric id, not `tla`: the abbreviation is not unique
 * (Corinthians and Coritiba both report "COR").
 */
export const CLUBS: Club[] = [
  { code: "1768", name: "CA Paranaense", shortName: "Athletico-PR", tla: "CAP", state: "PR" },
  { code: "1766", name: "CA Mineiro", shortName: "Atlético-MG", tla: "CAM", state: "MG" },
  { code: "1777", name: "EC Bahia", shortName: "Bahia", tla: "BAH", state: "BA" },
  { code: "1770", name: "Botafogo FR", shortName: "Botafogo", tla: "BOT", state: "RJ" },
  { code: "4286", name: "RB Bragantino", shortName: "Bragantino", tla: "RBB", state: "SP" },
  { code: "1772", name: "Chapecoense AF", shortName: "Chapecoense", tla: "CHA", state: "SC" },
  { code: "4287", name: "Clube do Remo", shortName: "Clube do Remo", tla: "CRE", state: "PA" },
  { code: "1779", name: "SC Corinthians Paulista", shortName: "Corinthians", tla: "COR", state: "SP" },
  { code: "4241", name: "Coritiba FBC", shortName: "Coritiba", tla: "COR", state: "PR" },
  { code: "1771", name: "Cruzeiro EC", shortName: "Cruzeiro", tla: "CRU", state: "MG" },
  { code: "1783", name: "CR Flamengo", shortName: "Flamengo", tla: "FLA", state: "RJ" },
  { code: "1765", name: "Fluminense FC", shortName: "Fluminense", tla: "FLU", state: "RJ" },
  { code: "1767", name: "Grêmio FBPA", shortName: "Grêmio", tla: "FBP", state: "RS" },
  { code: "6684", name: "SC Internacional", shortName: "Internacional", tla: "SCI", state: "RS" },
  { code: "4364", name: "Mirassol FC", shortName: "Mirassol", tla: "MIR", state: "SP" },
  { code: "1769", name: "SE Palmeiras", shortName: "Palmeiras", tla: "PAL", state: "SP" },
  { code: "6685", name: "Santos FC", shortName: "Santos", tla: "SAN", state: "SP" },
  { code: "1776", name: "São Paulo FC", shortName: "São Paulo", tla: "PAU", state: "SP" },
  { code: "1780", name: "CR Vasco da Gama", shortName: "Vasco da Gama", tla: "VAS", state: "RJ" },
  { code: "1782", name: "EC Vitória", shortName: "Vitória", tla: "VIT", state: "BA" },
];

export const CLUBS_BY_CODE = new Map(CLUBS.map((club) => [club.code, club]));
