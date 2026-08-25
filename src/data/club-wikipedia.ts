import type { ClubCode } from "@/src/types";

/**
 * HAND-MAINTAINED — the data provider carries no encyclopedia link at any tier,
 * so these are curated, like `club-hymns.ts` and `club-instagram.ts`.
 *
 * Keyed by **our** club code (the upstream numeric id), never by `tla`, for the
 * reason given there: Corinthians and Coritiba both report `COR`, and sending a
 * reader to the wrong club's article is the failure that keying on an
 * abbreviation produces.
 *
 * The value is the article **title alone**, written with spaces because that is
 * what reads. `wikipediaUrl` in `club-core.ts` converts it to underscores and
 * percent-encodes it, so the edition is written once rather than twenty times
 * and a title copied out of an edit view loses its `?action=edit`.
 *
 * The title is not derivable from anything the app already holds. `name` is the
 * provider's abbreviated form ("SE Palmeiras", "CA Mineiro"), `shortName` is the
 * popular one ("Palmeiras"), and the article sits at the club's full legal
 * name — three different strings, with no rule mapping between them. Note also
 * that the exact spelling is the club's own and not a normalisation of it:
 * Athletico Paranaense keeps its "th", Grêmio its hyphenated "Foot-Ball", and
 * Coritiba spells "Foot Ball" as two words where Fluminense spells "Football"
 * as one.
 *
 * Every title here was confirmed against the MediaWiki API
 * (`/w/api.php?action=query&titles=…&redirects=1&prop=extracts&exintro=1`),
 * which reports whether the page exists, whether it is a redirect and what its
 * first sentence says. All twenty resolve directly — no redirect, no
 * disambiguation page — and each intro names the club. That check is not
 * ceremony: an article title that is merely plausible produces a link that
 * looks right in review and 404s for the reader, and "Santos" alone is the
 * city, not the club.
 */
export const CLUB_WIKIPEDIA: Record<ClubCode, string> = {
  // Athletico-PR
  "1768": "Club Athletico Paranaense",
  // Atlético-MG
  "1766": "Clube Atlético Mineiro",
  // Bahia
  "1777": "Esporte Clube Bahia",
  // Botafogo
  "1770": "Botafogo de Futebol e Regatas",
  // Bragantino
  "4286": "Red Bull Bragantino",
  // Chapecoense
  "1772": "Associação Chapecoense de Futebol",
  // Clube do Remo
  "4287": "Clube do Remo",
  // Corinthians
  "1779": "Sport Club Corinthians Paulista",
  // Coritiba
  "4241": "Coritiba Foot Ball Club",
  // Cruzeiro
  "1771": "Cruzeiro Esporte Clube",
  // Flamengo
  "1783": "Clube de Regatas do Flamengo",
  // Fluminense
  "1765": "Fluminense Football Club",
  // Grêmio
  "1767": "Grêmio Foot-Ball Porto Alegrense",
  // Internacional
  "6684": "Sport Club Internacional",
  // Mirassol
  "4364": "Mirassol Futebol Clube",
  // Palmeiras
  "1769": "Sociedade Esportiva Palmeiras",
  // Santos
  "6685": "Santos Futebol Clube",
  // São Paulo
  "1776": "São Paulo Futebol Clube",
  // Vasco da Gama
  "1780": "Club de Regatas Vasco da Gama",
  // Vitória
  "1782": "Esporte Clube Vitória",
};
