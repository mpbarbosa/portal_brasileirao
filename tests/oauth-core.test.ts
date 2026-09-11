import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

import {
  authorizeUrl,
  challengeFor,
  decodeIdTokenClaims,
  decodeSignInTransaction,
  encodeSignInTransaction,
  newVerifier,
  readCallback,
  SCOPES,
  verifyClaims,
  type SignInTransaction,
} from "@/oauth-core";

const CLIENT = "243361530076-example.apps.googleusercontent.com";

const idTokenFor = (claims: Record<string, unknown>): string =>
  ["header", Buffer.from(JSON.stringify(claims)).toString("base64url"), "signature"].join(".");

const validClaims = (over: Record<string, unknown> = {}) => ({
  iss: "https://accounts.google.com",
  aud: CLIENT,
  sub: "1029384756",
  exp: 2_000,
  nonce: "nonce-1",
  name: "Ana Torcedora",
  ...over,
});

test("the authorize URL asks for the code flow, PKCE, and nothing else", () => {
  const url = new URL(
    authorizeUrl({
      clientId: CLIENT,
      redirectUri: "https://brasileirao.mpbarbosa.com/api/auth/callback",
      state: "state-1",
      nonce: "nonce-1",
      codeChallenge: "challenge-1",
    }),
  );

  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("code_challenge"), "challenge-1");
  assert.equal(url.searchParams.get("state"), "state-1");
  assert.equal(url.searchParams.get("nonce"), "nonce-1");

  // Only the three non-sensitive scopes. Anything more is a verification
  // review and a privacy-notice change, not a code change.
  assert.deepEqual(url.searchParams.get("scope")?.split(" "), SCOPES);
  assert.deepEqual(SCOPES, ["openid", "email", "profile"]);

  // No refresh token: nothing here calls a Google API after sign-in, and a
  // credential we would never use is one we would still have to store.
  assert.equal(url.searchParams.get("access_type"), null);
});

test("PKCE is S256 over the verifier, and verifiers do not repeat", () => {
  const verifier = newVerifier(randomBytes);
  assert.notEqual(newVerifier(randomBytes), verifier);
  assert.equal(challengeFor(verifier), challengeFor(verifier));
  assert.notEqual(challengeFor(verifier), verifier);
  assert.match(challengeFor(verifier), /^[A-Za-z0-9_-]{43}$/);
});

test("a verifier is the bytes it was handed, and refuses too few of them", () => {
  // Fixed bytes give a fixed value, which is what the parameter buys.
  assert.equal(newVerifier((size) => new Uint8Array(size)), "A".repeat(43));
  assert.throws(() => newVerifier(() => new Uint8Array(16)), /expected 32 random bytes, got 16/);
});

test("claims are read out of the payload segment", () => {
  const claims = decodeIdTokenClaims(idTokenFor({ sub: "42" }));
  assert.equal(claims?.sub, "42");
});

test("a token that is not a token decodes to null rather than throwing", () => {
  assert.equal(decodeIdTokenClaims(""), null);
  assert.equal(decodeIdTokenClaims("nodots"), null);
  assert.equal(decodeIdTokenClaims("a..c"), null);
  assert.equal(decodeIdTokenClaims("a.bm90IGpzb24.c"), null);
  // Valid base64url of a JSON scalar, which is not a claims object.
  assert.equal(decodeIdTokenClaims(`a.${Buffer.from('"hi"').toString("base64url")}.c`), null);
});

test("a good token for this app, right now, is accepted", () => {
  const verdict = verifyClaims(validClaims(), {
    clientId: CLIENT,
    nonce: "nonce-1",
    now: 1_000_000,
  });
  assert.deepEqual(verdict, { ok: true, subject: "1029384756", name: "Ana Torcedora" });
});

test("every claim check refuses on its own", () => {
  const expected = { clientId: CLIENT, nonce: "nonce-1", now: 1_000_000 };
  const reasonFor = (over: Record<string, unknown>) => {
    const verdict = verifyClaims(validClaims(over), expected);
    return verdict.ok ? "accepted" : verdict.reason;
  };

  assert.equal(reasonFor({ iss: "https://evil.example" }), "issuer");
  // Minted for a different site the same reader also uses.
  assert.equal(reasonFor({ aud: "someone-else.apps.googleusercontent.com" }), "audience");
  assert.equal(reasonFor({ exp: 999 }), "expired");
  // Not tied to the authorization request this browser started.
  assert.equal(reasonFor({ nonce: "someone-elses-nonce" }), "nonce");
  assert.equal(reasonFor({ sub: "" }), "subject");
  assert.equal(reasonFor({ sub: 42 }), "subject");
  assert.deepEqual(verifyClaims(null, expected), { ok: false, reason: "malformed" });
});

test("exp is compared in the same unit it arrives in", () => {
  // exp is seconds and now is milliseconds. Comparing them directly makes every
  // token look valid for a thousand times longer than it is — and passes any
  // test written with a freshly minted token, which is why this one is written
  // with an expiry that has just gone by.
  const expected = { clientId: CLIENT, nonce: "nonce-1", now: 2_000_500 };
  assert.equal(verifyClaims(validClaims({ exp: 2_000 }), expected).ok, false);
  assert.equal(verifyClaims(validClaims({ exp: 2_001 }), expected).ok, true);
});

test("a nameless account is accepted, because a name is not identity", () => {
  const verdict = verifyClaims(validClaims({ name: undefined }), {
    clientId: CLIENT,
    nonce: "nonce-1",
    now: 1_000_000,
  });
  assert.deepEqual(verdict, { ok: true, subject: "1029384756", name: null });
});

const TRANSACTION: SignInTransaction = { state: "state-1", nonce: "nonce-1", verifier: "verifier-1" };
const COOKIE = encodeSignInTransaction(TRANSACTION);
const cookieOf = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

test("a sign-in transaction survives its cookie", () => {
  assert.deepEqual(decodeSignInTransaction(COOKIE), TRANSACTION);
  // base64url, so `readCookie` hands it back verbatim.
  assert.match(COOKIE, /^[A-Za-z0-9_-]+$/);
});

test("a cookie that is not a transaction decodes to null rather than throwing", () => {
  assert.equal(decodeSignInTransaction("%%%"), null);
  assert.equal(decodeSignInTransaction(Buffer.from("not json").toString("base64url")), null);
  assert.equal(decodeSignInTransaction(cookieOf("a string")), null);
  assert.equal(decodeSignInTransaction(cookieOf(null)), null);
  // The shape that used to reach `digestsMatch` and throw there.
  assert.equal(decodeSignInTransaction(cookieOf({})), null);
  assert.equal(decodeSignInTransaction(cookieOf({ ...TRANSACTION, verifier: 7 })), null);
});

test("a callback carrying the state we issued goes on to the token exchange", () => {
  assert.deepEqual(readCallback({ code: "code-1", state: "state-1" }, COOKIE), {
    ok: true,
    code: "code-1",
    transaction: TRANSACTION,
    clearsTransaction: true,
  });
});

test("a reader who declined at Google is refused first, and the transaction is left alone", () => {
  assert.deepEqual(readCallback({ error: "access_denied" }, null), {
    ok: false,
    reason: "denied",
    detail: "provider: access_denied",
    clearsTransaction: false,
  });
  // Ahead of everything, including a perfectly good callback beside it.
  assert.equal(readCallback({ error: "access_denied", code: "c", state: "state-1" }, COOKIE).ok, false);
});

test("each state refusal is its own, and every one spends the transaction", () => {
  const refusal = (query: Record<string, unknown>, cookie: string | null) => {
    const verdict = readCallback(query, cookie);
    assert.equal(verdict.clearsTransaction, true);
    return verdict.ok ? "accepted" : `${verdict.reason}: ${verdict.detail}`;
  };
  const good = { code: "code-1", state: "state-1" };

  assert.equal(refusal(good, null), "state: no transaction cookie");
  assert.equal(refusal(good, ""), "state: no transaction cookie");
  assert.equal(refusal(good, cookieOf({})), "state: unreadable transaction cookie");
  assert.equal(refusal({ state: "state-1" }, COOKIE), "state: missing code");
  assert.equal(refusal({ code: "code-1" }, COOKIE), "state: missing code");
  assert.equal(refusal({ code: ["a", "b"], state: "state-1" }, COOKIE), "state: missing code");
  assert.equal(refusal({ code: "code-1", state: "somebody-elses" }, COOKIE), "state: state mismatch");
});

test("the refusals are checked in order: the cookie before the query, the query before the state", () => {
  const detail = (query: Record<string, unknown>, cookie: string | null) => {
    const verdict = readCallback(query, cookie);
    return verdict.ok ? "accepted" : verdict.detail;
  };

  assert.equal(detail({}, null), "no transaction cookie");
  assert.equal(detail({}, "%%%"), "unreadable transaction cookie");
  assert.equal(detail({ state: "wrong" }, COOKIE), "missing code");
});
