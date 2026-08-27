import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clearCookie,
  digestsMatch,
  hashToken,
  mintToken,
  readCookie,
  RENEW_AFTER_MS,
  serialiseCookie,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  sessionState,
  shouldRenew,
  type SessionRecord,
} from "@/session-core";

const at = (expiresAt: number): SessionRecord => ({
  tokenHash: "hash",
  accountId: "acc_1",
  createdAt: expiresAt - SESSION_TTL_MS,
  expiresAt,
});

test("a minted token is 256 bits, base64url, and never repeats", () => {
  const one = mintToken();
  const two = mintToken();
  assert.notEqual(one, two);
  assert.match(one, /^[A-Za-z0-9_-]+$/);
  // 32 bytes in base64url, unpadded.
  assert.equal(Buffer.from(one, "base64url").length, 32);
});

test("the stored value is a hash, so a database read yields no session", () => {
  const token = mintToken();
  const stored = hashToken(token);
  assert.notEqual(stored, token);
  assert.match(stored, /^[0-9a-f]{64}$/);
  // Deterministic, or a returning reader could never be recognised.
  assert.equal(hashToken(token), stored);
});

test("digest comparison is total, including on a length mismatch", () => {
  // timingSafeEqual throws on differing lengths, which would crash the request
  // rather than reject the token.
  assert.equal(digestsMatch("abc", "abc"), true);
  assert.equal(digestsMatch("abc", "abd"), false);
  assert.equal(digestsMatch("abc", "abcd"), false);
  assert.equal(digestsMatch("", ""), true);
});

test("a session is valid until the instant it expires, and not after", () => {
  const session = at(1_000);
  assert.equal(sessionState(session, 999), "valid");
  assert.equal(sessionState(session, 1_000), "expired");
  assert.equal(sessionState(session, 1_001), "expired");
});

test("renewal happens past the halfway mark, and never for a dead session", () => {
  const expiresAt = 10_000_000_000;
  const session = at(expiresAt);

  // Just after issue: more than half the life remains.
  assert.equal(shouldRenew(session, expiresAt - SESSION_TTL_MS + 1), false);
  // Exactly at the threshold: not yet.
  assert.equal(shouldRenew(session, expiresAt - RENEW_AFTER_MS), false);
  // Past it.
  assert.equal(shouldRenew(session, expiresAt - RENEW_AFTER_MS + 1), true);
  // Expired sessions are ended, not renewed.
  assert.equal(shouldRenew(session, expiresAt), false);
});

test("the cookie carries every attribute the __Host- prefix requires", () => {
  const value = serialiseCookie(SESSION_COOKIE, "abc", { secure: true, maxAgeMs: SESSION_TTL_MS });

  // A browser refuses a __Host- cookie without these, so getting one wrong
  // fails as "sign-in silently does nothing" rather than as an error.
  assert.match(value, /^__Host-pb_sess=abc/);
  assert.match(value, /; Path=\//);
  assert.match(value, /; Secure/);
  assert.doesNotMatch(value, /Domain=/);

  assert.match(value, /; HttpOnly/);
  // Lax, not Strict: the sign-in flow ends in a top-level navigation from
  // Google, and Strict withholds the cookie on exactly that request.
  assert.match(value, /; SameSite=Lax/);
  assert.match(value, /; Max-Age=2592000/);
});

test("an insecure cookie is only possible by asking for one", () => {
  // Secure comes from configuration, never from the request: behind nginx
  // req.secure is false, and a cookie that believed it would ship unprotected.
  const value = serialiseCookie(SESSION_COOKIE, "abc", { secure: false });
  assert.doesNotMatch(value, /; Secure/);
  assert.doesNotMatch(value, /Max-Age/);
});

test("clearing a cookie keeps its attributes and zeroes its life", () => {
  const value = clearCookie(SESSION_COOKIE, { secure: true });
  assert.match(value, /^__Host-pb_sess=;/);
  assert.match(value, /; Max-Age=0/);
  assert.match(value, /; Secure/);
});

test("one cookie is read out of a header holding several", () => {
  const header = "theme=dark; __Host-pb_sess=abc123; other=1";
  assert.equal(readCookie(header, SESSION_COOKIE), "abc123");
  assert.equal(readCookie(header, "theme"), "dark");
  assert.equal(readCookie(header, "missing"), null);
});

test("a malformed cookie header yields null rather than throwing", () => {
  // This header is attacker-controlled, so every shape has to be survivable.
  assert.equal(readCookie(undefined, SESSION_COOKIE), null);
  assert.equal(readCookie("", SESSION_COOKIE), null);
  assert.equal(readCookie("garbage", SESSION_COOKIE), null);
  assert.equal(readCookie("=novalue", SESSION_COOKIE), null);
  // A stray percent would throw inside decodeURIComponent, which is why values
  // are returned verbatim.
  assert.equal(readCookie("__Host-pb_sess=%", SESSION_COOKIE), "%");
});

test("a cookie name that is a prefix of another is not matched", () => {
  assert.equal(readCookie("__Host-pb_session=wrong", SESSION_COOKIE), null);
});
