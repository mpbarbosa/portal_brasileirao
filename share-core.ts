/**
 * The **Compartilhar** action in the top app bar: which way a page can be
 * handed to somebody else, and what the reader is told afterwards.
 *
 * Pure like every other core module: the browser's `navigator` is passed in
 * as a structural shape rather than read here, so each branch is unit-tested
 * without a browser.
 *
 * **The Web Share API first, the clipboard second, and nothing third.** On a
 * phone `navigator.share` opens the platform's own sheet — WhatsApp, the
 * messaging apps, "copiar" — which is the whole point of the control. Desktop
 * Linux Chromium and Firefox have no such sheet, so there the link goes to the
 * clipboard and the reader is told so. A browser with neither (an insecure
 * origin: both APIs require a secure context) gets **no button at all**, which
 * is why `shareMethod` can answer `"none"` — a control that can only fail is
 * worse than an absent one.
 */

/** The part of `navigator` this module reads. Every member may be missing. */
export interface ShareCapabilities {
  share?: unknown;
  canShare?: (data: { title?: string; url?: string }) => boolean;
  clipboard?: { writeText?: unknown };
}

export type ShareMethod = "native" | "clipboard" | "none";

export interface SharePayload {
  title: string;
  url: string;
}

/**
 * `canShare` is consulted where it exists and trusted when it says no: a
 * browser may expose `share` and still refuse a given payload, and calling it
 * anyway rejects with a `TypeError` the reader cannot act on. Where `canShare`
 * is absent (older Safari) `share` alone is the answer.
 */
export function shareMethod(nav: ShareCapabilities | undefined, payload: SharePayload): ShareMethod {
  if (!nav) return "none";
  if (typeof nav.share === "function") {
    if (typeof nav.canShare !== "function" || nav.canShare(payload)) return "native";
  }
  if (typeof nav.clipboard?.writeText === "function") return "clipboard";
  return "none";
}

/**
 * The address and the title handed over.
 *
 * The address is the one in the reader's bar, **not** the canonical tag: in
 * development `APP_URL` points the canonical at production, and a reader who
 * shares `/clube/1783` is sharing what they are looking at — the server
 * resolves the old form either way. The fragment is dropped, since no route
 * here uses one and a stray `#` makes a link look broken in a message.
 */
export function sharePayload(title: string, href: string): SharePayload {
  const hash = href.indexOf("#");
  return { title, url: hash === -1 ? href : href.slice(0, hash) };
}

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/**
 * A rejected `navigator.share` is usually the reader closing the sheet, which
 * arrives as an `AbortError` and is **not** a failure — telling somebody
 * "não foi possível compartilhar" because they changed their mind is wrong.
 * Anything else is.
 */
export function outcomeOfShareError(error: unknown): "cancelled" | "failed" {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? (error as { name: unknown }).name
      : undefined;
  return name === "AbortError" ? "cancelled" : "failed";
}

/**
 * What the snackbar says, or null for nothing.
 *
 * A native share says nothing: the platform's sheet was the feedback, and a
 * second message after it would announce what the reader just did. Only the
 * clipboard path, which is otherwise silent, and a real failure are spoken.
 */
export function shareFeedback(method: Exclude<ShareMethod, "none">, outcome: ShareOutcome): string | null {
  if (outcome === "copied") return "Link copiado";
  if (outcome === "failed") {
    return method === "native" ? "Não foi possível compartilhar" : "Não foi possível copiar o link";
  }
  return null;
}
