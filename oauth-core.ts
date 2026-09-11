/**
 * The parts of Google's OpenID Connect flow that are arithmetic rather than
 * network: the authorization URL, the PKCE pair, the sign-in transaction and the
 * order Google's redirect back is refused in, and what the returned `id_token`
 * is allowed to claim.
 *
 * The one HTTP call — exchanging the code at the token endpoint — stays in
 * `server.ts`, for the reason every `*-core.ts` module exists: the judgement
 * here is the part that must not be wrong, and it is testable without a
 * network or a Google client.
 */

import { createHash } from "node:crypto";

import { digestsMatch } from "@/session-core";

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

const VERIFIER_BYTES = 32;

/**
 * A high-entropy PKCE verifier, from bytes the caller supplies.
 *
 * The entropy is a parameter — `newVerifier(randomBytes)` — rather than a call
 * made here, so this module reads nothing it was not handed: `newAccountId`'s
 * shape in `account-core.ts`. A source that returns any other number of bytes
 * throws rather than minting a malformed verifier, because a verifier built from
 * nothing is one every sign-in shares.
 */
export const newVerifier = (random: (size: number) => Uint8Array): string => {
  const bytes = random(VERIFIER_BYTES);
  if (bytes.length !== VERIFIER_BYTES) {
    throw new Error(`newVerifier: expected ${VERIFIER_BYTES} random bytes, got ${bytes.length}`);
  }
  return Buffer.from(bytes).toString("base64url");
};

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
 * What a sign-in has to remember between our redirect to Google and Google's
 * redirect back.
 *
 * It travels in a `__Host-` cookie rather than in a table, and needs no
 * signature: all three values only have to survive from our own response to our
 * own next request, and the prefix is what a browser enforces to keep any other
 * origin from writing that cookie.
 */
export interface SignInTransaction {
  state: string;
  nonce: string;
  verifier: string;
}

/** The transaction as its cookie carries it: JSON in base64url, an alphabet
 *  `readCookie` returns verbatim. */
export const encodeSignInTransaction = (transaction: SignInTransaction): string =>
  Buffer.from(JSON.stringify(transaction)).toString("base64url");

/**
 * The transaction back out of its cookie, or null.
 *
 * Null for anything that is not one — not base64url, not JSON, or JSON of some
 * other shape. The encode and the decode lived in two handlers forty-six lines
 * apart, and the decode was a cast: a hand-written cookie holding `{}` got past
 * it and threw inside the callback. Anything this returns has three strings.
 */
export const decodeSignInTransaction = (raw: string): SignInTransaction | null => {
  try {
    const value: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof value !== "object" || value === null) return null;
    const { state, nonce, verifier } = value as Record<string, unknown>;
    return typeof state === "string" && typeof nonce === "string" && typeof verifier === "string"
      ? { state, nonce, verifier }
      : null;
  } catch {
    return null;
  }
};

/**
 * Whether Google's redirect back may go on to the token exchange.
 *
 * `reason` is the short word the callback puts in `/entrar?erro=`, which
 * `signInErrorLabel` turns into one deliberately vague sentence; `detail` is
 * what the server logs. `clearsTransaction` says whether the exit spends the
 * transaction cookie — every exit that read it does, success or not, because a
 * state that has been presented once must never be presentable again. A reader
 * who declined at Google presented nothing, and that exit leaves it.
 */
export type CallbackVerdict =
  | { ok: true; code: string; transaction: SignInTransaction; clearsTransaction: true }
  | { ok: false; reason: "denied" | "state"; detail: string; clearsTransaction: boolean };

const stateRefusal = (detail: string): CallbackVerdict => ({
  ok: false,
  reason: "state",
  detail,
  clearsTransaction: true,
});

/**
 * The callback's refusals, in the order they are checked: Google reporting a
 * refusal, then the transaction cookie missing, then unreadable, then the query
 * lacking a code or a state, then the state not matching the one we issued.
 *
 * The state comparison is constant-time, through `digestsMatch`. Everything
 * after this — the token exchange and the claim checks — needs the network and
 * stays in `server.ts`, where its refusals are all `provider`.
 */
export const readCallback = (
  query: { error?: unknown; code?: unknown; state?: unknown },
  transactionCookie: string | null,
): CallbackVerdict => {
  if (typeof query.error === "string") {
    return { ok: false, reason: "denied", detail: `provider: ${query.error}`, clearsTransaction: false };
  }

  if (!transactionCookie) return stateRefusal("no transaction cookie");

  const transaction = decodeSignInTransaction(transactionCookie);
  if (!transaction) return stateRefusal("unreadable transaction cookie");

  const { code, state } = query;
  if (typeof code !== "string" || typeof state !== "string") return stateRefusal("missing code");
  if (!digestsMatch(state, transaction.state)) return stateRefusal("state mismatch");

  return { ok: true, code, transaction, clearsTransaction: true };
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
