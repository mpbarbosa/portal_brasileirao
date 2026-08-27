/**
 * The parts of Google's OpenID Connect flow that are arithmetic rather than
 * network: the authorization URL, the PKCE pair, and what the returned
 * `id_token` is allowed to claim.
 *
 * The one HTTP call — exchanging the code at the token endpoint — stays in
 * `server.ts`, for the reason every `*-core.ts` module exists: the judgement
 * here is the part that must not be wrong, and it is testable without a
 * network or a Google client.
 */

import { createHash, randomBytes } from "node:crypto";

export const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Only what sign-in needs.
 *
 * These three are Google's **non-sensitive** scopes, which is what lets this
 * app publish its consent screen without a verification review. Adding another
 * scope is not a code change — it is a review, a privacy-notice change under
 * §5 of `docs/accounts.md`, and a consent screen that warns the reader.
 */
export const SCOPES = ["openid", "email", "profile"];

/** A high-entropy PKCE verifier. */
export const newVerifier = (): string => randomBytes(32).toString("base64url");

/** S256, which is the only challenge method worth offering. */
export const challengeFor = (verifier: string): string =>
  createHash("sha256").update(verifier).digest("base64url");

export interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}

export const authorizeUrl = (params: AuthorizeParams): string => {
  const query = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    state: params.state,
    nonce: params.nonce,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
    // No `access_type=offline`, so no refresh token is issued: nothing here
    // ever calls a Google API on the reader's behalf after sign-in, and a
    // credential we would never use is one we would still have to store.
    prompt: "select_account",
  });
  return `${GOOGLE_AUTHORIZE_URL}?${query.toString()}`;
};

/**
 * Read the claims out of an `id_token` **without verifying its signature**, and
 * that is correct here rather than a shortcut worth flagging in review.
 *
 * OpenID Connect says so directly: in the authorization-code flow, where the
 * token is fetched from the token endpoint over TLS, the transport
 * authenticates the issuer and signature validation is not required. We POST to
 * `https://oauth2.googleapis.com/token` ourselves, with our own client secret,
 * and read the response — there is no browser and no third party in that
 * exchange for a forged token to arrive through.
 *
 * The claims below are still checked, because TLS establishes who *sent* the
 * token and says nothing about who it was minted *for*.
 */
export const decodeIdTokenClaims = (idToken: string): Record<string, unknown> | null => {
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const value: unknown = JSON.parse(json);
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

export type ClaimsVerdict =
  | { ok: true; subject: string; name: string | null }
  | { ok: false; reason: "malformed" | "issuer" | "audience" | "expired" | "nonce" | "subject" };

/**
 * Whether these claims describe a sign-in to *this* app, right now.
 *
 * Each check answers a different question and dropping any one leaves a real
 * hole: the issuer says Google minted it, the audience says it was minted for
 * us rather than for some other site the same reader uses, `exp` says it is not
 * a replay of an old one, and the nonce ties it to the authorization request
 * this browser actually started — which is what stops a token obtained
 * elsewhere being presented at our callback.
 */
export const verifyClaims = (
  claims: Record<string, unknown> | null,
  expected: { clientId: string; nonce: string; now: number },
): ClaimsVerdict => {
  if (!claims) return { ok: false, reason: "malformed" };

  const iss = claims.iss;
  if (typeof iss !== "string" || !GOOGLE_ISSUERS.has(iss)) return { ok: false, reason: "issuer" };

  if (claims.aud !== expected.clientId) return { ok: false, reason: "audience" };

  // `exp` is in **seconds** and `now` in milliseconds. Comparing them directly
  // is the mistake that makes every token look valid for a thousand times
  // longer than it is, and it passes every test written against a fresh token.
  const exp = claims.exp;
  if (typeof exp !== "number" || exp * 1000 <= expected.now) return { ok: false, reason: "expired" };

  if (claims.nonce !== expected.nonce) return { ok: false, reason: "nonce" };

  const sub = claims.sub;
  if (typeof sub !== "string" || sub.length === 0) return { ok: false, reason: "subject" };

  return { ok: true, subject: sub, name: typeof claims.name === "string" ? claims.name : null };
};

/**
 * pt-BR for what went wrong, for the one place a reader sees it.
 *
 * Deliberately vague about *which* check failed. A reader can do nothing with
 * "audience mismatch", and an attacker probing the callback can do a great deal
 * with it. The specific reason goes to the server log, keyed by nothing that
 * identifies a person.
 */
export const signInErrorLabel = (reason: string): string => {
  switch (reason) {
    case "state":
      return "O pedido de entrada expirou. Tente de novo.";
    case "denied":
      return "Entrada cancelada.";
    default:
      return "Não foi possível entrar agora. Tente de novo em instantes.";
  }
};
