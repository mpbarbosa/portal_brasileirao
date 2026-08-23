import type { Club } from "@/src/types";

/** The 20 Série A clubs, keyed by the codes used throughout the app. */
export const CLUBS: Club[] = [
  { code: "FLA", name: "Clube de Regatas do Flamengo", shortName: "Flamengo", state: "RJ" },
  { code: "PAL", name: "Sociedade Esportiva Palmeiras", shortName: "Palmeiras", state: "SP" },
  { code: "CRU", name: "Cruzeiro Esporte Clube", shortName: "Cruzeiro", state: "MG" },
  { code: "BOT", name: "Botafogo de Futebol e Regatas", shortName: "Botafogo", state: "RJ" },
  { code: "SAO", name: "São Paulo Futebol Clube", shortName: "São Paulo", state: "SP" },
  { code: "BAH", name: "Esporte Clube Bahia", shortName: "Bahia", state: "BA" },
  { code: "MIR", name: "Mirassol Futebol Clube", shortName: "Mirassol", state: "SP" },
  { code: "FLU", name: "Fluminense Football Club", shortName: "Fluminense", state: "RJ" },
  { code: "COR", name: "Sport Club Corinthians Paulista", shortName: "Corinthians", state: "SP" },
  { code: "GRE", name: "Grêmio Foot-Ball Porto Alegrense", shortName: "Grêmio", state: "RS" },
  { code: "INT", name: "Sport Club Internacional", shortName: "Internacional", state: "RS" },
  { code: "CAM", name: "Clube Atlético Mineiro", shortName: "Atlético-MG", state: "MG" },
  { code: "CAP", name: "Athletico Paranaense", shortName: "Athletico-PR", state: "PR" },
  { code: "VAS", name: "Club de Regatas Vasco da Gama", shortName: "Vasco", state: "RJ" },
  { code: "SAN", name: "Santos Futebol Clube", shortName: "Santos", state: "SP" },
  { code: "CEA", name: "Ceará Sporting Club", shortName: "Ceará", state: "CE" },
  { code: "FOR", name: "Fortaleza Esporte Clube", shortName: "Fortaleza", state: "CE" },
  { code: "JUV", name: "Esporte Clube Juventude", shortName: "Juventude", state: "RS" },
  { code: "VIT", name: "Esporte Clube Vitória", shortName: "Vitória", state: "BA" },
  { code: "SPT", name: "Sport Club do Recife", shortName: "Sport", state: "PE" },
];

export const CLUBS_BY_CODE = new Map(CLUBS.map((club) => [club.code, club]));
