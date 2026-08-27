import { useCallback, useEffect, useState } from "react";

import type { PublicAccount } from "@/account-core";

/**
 * Four states, not two, and the extra pair is what keeps the page honest.
 *
 * `loading` is not `signed-out`: rendering "Entrar" for the 200ms before the
 * answer arrives means a signed-in reader watches the control change under
 * them on every page load.
 *
 * `disabled` is not `signed-out` either. A host with no Google client
 * configured has no accounts at all, and offering to sign in there is an
 * invitation to a dead end — `/api/account/me` answers 404 in that case, which
 * is how the client can tell.
 */
export type AccountState =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "signed-out" }
  | { status: "signed-in"; account: PublicAccount };

/**
 * Deliberately not built on `src/api.ts`.
 *
 * Every helper there unwraps an `ApiEnvelope` — `source`, `note`, `updatedAt` —
 * which describes how fresh a third party's data is and how far it has degraded.
 * An account has no upstream, no staleness and no honest fallback, so these
 * endpoints are plain JSON with real status codes. `docs/accounts.md` §3.3 is
 * where that exception is argued; this is the second one after `/api/health`.
 */
const fetchAccount = async (): Promise<AccountState> => {
  const response = await fetch("/api/account/me", { credentials: "same-origin" });

  if (response.status === 404) return { status: "disabled" };
  if (!response.ok) return { status: "signed-out" };

  const account = (await response.json()) as PublicAccount | null;
  return account ? { status: "signed-in", account } : { status: "signed-out" };
};

export function useAccount(): {
  state: AccountState;
  signOut: (everywhere?: boolean) => Promise<void>;
  deleteAccount: () => Promise<boolean>;
  refresh: () => void;
} {
  const [state, setState] = useState<AccountState>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchAccount();
        if (!cancelled) setState(next);
      } catch {
        // A failed request is not a signed-out reader, but there is nothing
        // else to render, and an error banner over a page that otherwise works
        // is worse than a control that reads "Entrar".
        if (!cancelled) setState({ status: "signed-out" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  const signOut = useCallback(async (everywhere = false) => {
    await fetch(`/api/auth/logout${everywhere ? "?todos=true" : ""}`, {
      method: "POST",
      credentials: "same-origin",
    });
    setState({ status: "signed-out" });
  }, []);

  const deleteAccount = useCallback(async () => {
    const response = await fetch("/api/account", {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!response.ok) return false;
    setState({ status: "signed-out" });
    return true;
  }, []);

  return { state, signOut, deleteAccount, refresh };
}
