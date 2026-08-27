/**
 * Sessions: minting, hashing, expiry, renewal, and the cookie they travel in.
 *
 * Pure in the sense this repo means it — no network, no disk, no clock. `now`
 * arrives as a parameter exactly as it does in `cache-core.ts` and
 * `live-core.ts`, so expiry and renewal are tested at boundary instants rather
 * than by sleeping.
 *
 * `node:crypto` is used for random bytes and hashing. That is not I/O: nothing
 * is read or written, and the one function whose output cannot be asserted by
 * value (`mintToken`) is asserted by shape.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The cookie name, with the `__Host-` prefix, which a browser enforces as a
 * rule rather than treating as a hint: it refuses the cookie unless it is
 * `Secure`, has `Path=/`, and carries **no `Domain`**. That last part is the
 * one worth having — it means no sibling subdomain can set or overwrite this
 * app's session cookie.
 */
export const SESSION_COOKIE = "__Host-pb_sess";

/** Thirty days, rolling — see `shouldRenew`. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Renew once the session is more than halfway to expiry.
 *
 * Not on every request: a write per request turns a read-mostly SQLite file
 * into a write-mostly one for no benefit, and rewriting the cookie on every
 * response is a `Set-Cookie` header on every page. Halfway means a reader who
 * visits at all regularly never sees an expiry, and one who disappears for a
 * month is signed out — which is the point of an expiry.
 */
export const RENEW_AFTER_MS = SESSION_TTL_MS / 2;

export interface SessionRecord {
  /** SHA-256 of the cookie value. The cookie itself is never stored. */
  tokenHash: string;
  accountId: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * A new session token: 32 bytes of randomness, base64url.
 *
 * 256 bits, so there is nothing to guess and nothing to rate-limit against.
 * base64url rather than hex because it travels in a cookie and hex would be
 * twice the length for the same entropy.
 */
export const mintToken = (): string => randomBytes(32).toString("base64url");

/**
 * The value stored for a token.
 *
 * Plain SHA-256 with no salt and no KDF, which is right here and would be wrong
 * for a password: the input is 256 bits of uniform randomness, so there is no
 * dictionary to build and no work factor worth paying. What this buys is that a
 * database read — a leaked backup, an SQL injection somewhere downstream, a
 * support engineer with the file — yields no usable session.
 */
export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

/**
 * Constant-time comparison of two hex digests.
 *
 * `timingSafeEqual` throws on length mismatch, which would itself leak a fact
 * and crash the request, so the lengths are checked first and a mismatch is a
 * plain false.
 */
export const digestsMatch = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
};

export type SessionState = "valid" | "expired";

export const sessionState = (session: SessionRecord, now: number): SessionState =>
  now < session.expiresAt ? "valid" : "expired";

export const shouldRenew = (session: SessionRecord, now: number): boolean =>
  sessionState(session, now) === "valid" && session.expiresAt - now < RENEW_AFTER_MS;

export interface CookieOptions {
  /**
   * Whether to mark the cookie `Secure`.
   *
   * **Read from configuration, never from the request.** Express's own
   * `trust proxy` is off here on purpose — `TRUST_PROXY` is this app's own flag
   * and feeds only the canonical origin — so behind nginx `req.protocol` is
   * `"http"` and `req.secure` is `false`. A cookie whose `Secure` flag came
   * from the request would ship **without** it in production, which is a
   * session that leaks over any plaintext request.
   */
  secure: boolean;
  maxAgeMs?: number;
}

/**
 * Build a `Set-Cookie` value.
 *
 * `SameSite=Lax` rather than `Strict`: the sign-in flow ends in a top-level
 * navigation *from Google*, and a `Strict` cookie is not sent on that
 * navigation — the reader would land on `/conta` signed out, on the request
 * that just signed them in. `Lax` still blocks the cross-site POST that CSRF
 * needs.
 */
export const serialiseCookie = (
  name: string,
  value: string,
  { secure, maxAgeMs }: CookieOptions,
): string => {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  if (maxAgeMs !== undefined) parts.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`);
  return parts.join("; ");
};

/** Expire a cookie now. `Max-Age=0` with the same attributes it was set with. */
export const clearCookie = (name: string, options: CookieOptions): string =>
  serialiseCookie(name, "", { ...options, maxAgeMs: 0 });

/**
 * Read one cookie out of a `Cookie` header.
 *
 * Twelve lines rather than a dependency. Express 4 does not parse cookies, and
 * `cookie-parser` would have to go in `dependencies` — the production host runs
 * `npm ci --omit=dev` — to do this.
 *
 * Values are returned verbatim rather than URI-decoded: everything this app
 * stores in a cookie is base64url or hex, and decoding would turn a stray `%`
 * in a hand-crafted header into a thrown `URIError` inside the request path.
 */
export const readCookie = (header: string | undefined, name: string): string | null => {
  if (!header) return null;
  for (const pair of header.split(";")) {
    const index = pair.indexOf("=");
    if (index === -1) continue;
    if (pair.slice(0, index).trim() === name) return pair.slice(index + 1).trim();
  }
  return null;
};
