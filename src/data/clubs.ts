import type { Club } from "@/src/types";

/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: npx tsx scripts/sync-seed-data.ts
 *
 * Source: football-data.org competition BSA, season
 * 2026-01-28 to 2026-12-02. Snapshot taken 2026-08-25.
 *
 * `code` is the upstream numeric id, not `tla`: the abbreviation is not unique
 * (Corinthians and Coritiba both report "COR").
 */
export const CLUBS: Club[] = [
  { code: "1768", name: "CA Paranaense", shortName: "Athletico-PR", tla: "CAP", slug: "athletico-pr", crest: "https://crests.football-data.org/1768.png", website: "https://www.atleticoparanaense.com/", state: "PR" },
  { code: "1766", name: "CA Mineiro", shortName: "Atlético-MG", tla: "CAM", slug: "atletico-mg", crest: "https://crests.football-data.org/1766.png", website: "https://www.atletico.com.br/", state: "MG" },
  { code: "1777", name: "EC Bahia", shortName: "Bahia", tla: "BAH", slug: "bahia", crest: "https://crests.football-data.org/1777.png", website: "https://www.esporteclubebahia.com.br/", state: "BA" },
  { code: "1770", name: "Botafogo FR", shortName: "Botafogo", tla: "BOT", slug: "botafogo", crest: "https://crests.football-data.org/1770.png", website: "https://www.botafogo.com.br/", state: "RJ" },
  { code: "4286", name: "RB Bragantino", shortName: "Bragantino", tla: "RBB", slug: "bragantino", crest: "https://crests.football-data.org/4286.png", website: "https://www.bragantino.net/", state: "SP" },
  { code: "1772", name: "Chapecoense AF", shortName: "Chapecoense", tla: "CHA", slug: "chapecoense", crest: "https://crests.football-data.org/1772_large.png", website: "https://www.chapecoense.com/", state: "SC" },
  { code: "4287", name: "Clube do Remo", shortName: "Clube do Remo", tla: "CRE", slug: "clube-do-remo", crest: "https://crests.football-data.org/4287.png", website: "https://www.clubedoremo.com.br/", state: "PA" },
  { code: "1779", name: "SC Corinthians Paulista", shortName: "Corinthians", tla: "COR", slug: "corinthians", crest: "https://crests.football-data.org/1779.png", website: "https://www.corinthians.com.br/", state: "SP" },
  { code: "4241", name: "Coritiba FBC", shortName: "Coritiba", tla: "COR", slug: "coritiba", crest: "https://crests.football-data.org/4241.png", website: "https://www.coritiba.com.br/", state: "PR" },
  { code: "1771", name: "Cruzeiro EC", shortName: "Cruzeiro", tla: "CRU", slug: "cruzeiro", crest: "https://crests.football-data.org/1771.png", website: "https://www.cruzeiro.com.br/", state: "MG" },
  { code: "1783", name: "CR Flamengo", shortName: "Flamengo", tla: "FLA", slug: "flamengo", crest: "https://crests.football-data.org/1783.png", website: "https://www.flamengo.com.br/", state: "RJ" },
  { code: "1765", name: "Fluminense FC", shortName: "Fluminense", tla: "FLU", slug: "fluminense", crest: "https://crests.football-data.org/1765.png", website: "https://www.fluminense.com.br/", state: "RJ" },
  { code: "1767", name: "Grêmio FBPA", shortName: "Grêmio", tla: "FBP", slug: "gremio", crest: "https://crests.football-data.org/1767.png", website: "https://www.gremio.net/", state: "RS" },
  { code: "6684", name: "SC Internacional", shortName: "Internacional", tla: "SCI", slug: "internacional", crest: "https://crests.football-data.org/6684.png", website: "https://www.internacional.com.br/", state: "RS" },
  { code: "4364", name: "Mirassol FC", shortName: "Mirassol", tla: "MIR", slug: "mirassol", crest: "https://crests.football-data.org/4364.png", website: "https://www.mirassolfc.com.br/", state: "SP" },
  { code: "1769", name: "SE Palmeiras", shortName: "Palmeiras", tla: "PAL", slug: "palmeiras", crest: "https://crests.football-data.org/1769.png", website: "https://www.palmeiras.com.br/", state: "SP" },
  { code: "6685", name: "Santos FC", shortName: "Santos", tla: "SAN", slug: "santos", crest: "https://crests.football-data.org/6685.png", website: "https://santosfc.com.br/", state: "SP" },
  { code: "1776", name: "São Paulo FC", shortName: "São Paulo", tla: "PAU", slug: "sao-paulo", crest: "https://crests.football-data.org/1776.png", website: "https://www.saopaulofc.net/", state: "SP" },
  { code: "1780", name: "CR Vasco da Gama", shortName: "Vasco da Gama", tla: "VAS", slug: "vasco-da-gama", crest: "https://crests.football-data.org/1780.png", website: "https://www.vasco.com.br/", state: "RJ" },
  { code: "1782", name: "EC Vitória", shortName: "Vitória", tla: "VIT", slug: "vitoria", crest: "https://crests.football-data.org/1782.png", website: "https://www.ecvitoria.com.br/", state: "BA" },
];

export const CLUBS_BY_CODE = new Map(CLUBS.map((club) => [club.code, club]));
