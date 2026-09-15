import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/src/components/Button";
import { ShareIcon } from "@/src/components/SectionIcons";
import {
  outcomeOfShareError,
  shareFeedback,
  shareMethod,
  sharePayload,
  type ShareOutcome,
} from "@/share-core";

const LABEL = "Compartilhar esta página";

/** Long enough to read "Não foi possível copiar o link" twice; MD3's short snackbar. */
const FEEDBACK_MS = 4000;

/**
 * **Compartilhar**, the first action in the top app bar's trailing group.
 *
 * Which path it takes and what it says afterwards is `share-core.ts`; this is
 * the half that touches `navigator`.
 *
 * **Hidden below 360dp, and that is arithmetic rather than taste.** Below `sm`
 * the brand gets the row minus the trailing group, and the group with this
 * control in it is three 40dp boxes and two 8px gaps. From 360 up that leaves
 * the brand `width − 180`, which clears its 174px subtitle; at 320 it would
 * leave 140 against a 160px title line, so the app's own name would be cut. The
 * Entrar pill gives up its word below `sm` for the same sum — see
 * `AccountButton`. The wrapper is `contents` so the button stays the flex item
 * the `gap-2` is measured between, and the display is on the wrapper because
 * `hidden` passed through `Button`'s `extra` would race its `inline-flex` on
 * stylesheet order.
 *
 * **The snackbar is portalled to `body`**, and it has to be: the header carries
 * `backdrop-blur`, and a `backdrop-filter` makes an element the containing block
 * for its `fixed` descendants — so a snackbar rendered in place would be pinned
 * to the header rather than to the screen.
 *
 * The live region is **always mounted** and only its text changes. A region
 * inserted already holding its message is announced unreliably, which is the
 * one reader this message exists for when the icon gives no visible sign.
 */
export function ShareButton() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const available =
    typeof navigator !== "undefined" &&
    shareMethod(navigator, sharePayload(document.title, window.location.href)) !== "none";
  if (!available) return null;

  const show = (text: string | null) => {
    window.clearTimeout(timer.current);
    setMessage(text);
    if (text) timer.current = window.setTimeout(() => setMessage(null), FEEDBACK_MS);
  };

  const share = async () => {
    const payload = sharePayload(document.title, window.location.href);
    const method = shareMethod(navigator, payload);
    if (method === "none") return;

    let outcome: ShareOutcome;
    try {
      if (method === "native") {
        await navigator.share(payload);
        outcome = "shared";
      } else {
        await navigator.clipboard.writeText(payload.url);
        outcome = "copied";
      }
    } catch (error) {
      outcome = method === "native" ? outcomeOfShareError(error) : "failed";
    }
    show(shareFeedback(method, outcome));
  };

  return (
    <>
      <span className="hidden min-[360px]:contents">
        <Button
          onClick={share}
          aria-label={LABEL}
          title={LABEL}
          data-share
          /* The theme toggle's size, for the reason stated there: MD3's 40dp
             top-app-bar control, level with its two neighbours. */
          size="bar"
        >
          <ShareIcon className="h-5 w-5" />
        </Button>
      </span>
      {createPortal(
        /* Above the bottom navigation bar on a phone — that bar is `fixed` to
           the same edge and ~80px tall — and near the edge above `sm`, where it
           does not render. */
        <div
          role="status"
          aria-live="polite"
          data-share-feedback
          className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4 sm:bottom-6"
        >
          {message && (
            <span className="rounded-x-small bg-inverse-surface px-4 py-3 text-body-medium text-inverse-on-surface shadow-level-3">
              {message}
            </span>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
