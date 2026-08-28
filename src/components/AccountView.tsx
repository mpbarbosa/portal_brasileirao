import { useRef, useState } from "react";

import { firstName } from "@/account-core";
import { Button } from "@/src/components/Button";
import { GLYPH } from "@/src/components/ClubLinks";
import { BACK_LINK, FOCUS_RING, LINK_UNDERLINE, STATE_LAYER } from "@/src/components/interaction";
import { Surface } from "@/src/components/Surface";
import { controlClasses } from "@/src/components/Button";
import type { AccountState } from "@/src/useAccount";

/** A person, outlined. The one glyph an account needs. */
export function AccountGlyph({ className }: { className?: string }) {
  return (
    <svg {...GLYPH} className={className ?? GLYPH.className}>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

/**
 * The account affordance in the top app bar.
 *
 * Not a sixth `NAV_ITEMS` entry: the navigation bar is at MD3's maximum of
 * five, and an account is a persistent affordance rather than a destination —
 * a trailing icon in the top app bar is where the spec puts one anyway, so
 * this is the answer rather than a workaround for a full bar.
 *
 * Renders **nothing at all** while the answer is in flight, and nothing when
 * accounts are switched off on this host. A control that appears 200ms after
 * paint and then changes its own label is worse than one that arrives once.
 */
export function AccountButton({ state }: { state: AccountState }) {
  if (state.status === "loading" || state.status === "disabled") return null;

  const signedIn = state.status === "signed-in";
  const label = signedIn ? "Minha conta" : "Entrar";

  return (
    <a
      href={signedIn ? "/conta" : "/entrar"}
      title={label}
      data-account={signedIn ? "signed-in" : "signed-out"}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-body-medium text-on-surface-variant ${STATE_LAYER} ${FOCUS_RING}`}
    >
      <AccountGlyph className="h-5 w-5" />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </a>
  );
}

/**
 * `/entrar` — the sign-in choice, which today is one provider.
 *
 * The sign-in control is a plain link to our own endpoint, not Google's
 * JavaScript button: no third-party script runs on the page, which keeps the
 * roadmap's rule that nothing external is a request-time dependency, and means
 * the whole flow is server-side and testable.
 */
export function SignInView({
  state,
  error,
  onBack,
}: {
  state: AccountState;
  /** The `erro` query parameter the callback redirects with, if any. */
  error?: string | null;
  onBack: () => void;
}) {
  const message =
    error === "state"
      ? "O pedido de entrada expirou. Tente de novo."
      : error === "denied"
        ? "Entrada cancelada."
        : error
          ? "Não foi possível entrar agora. Tente de novo em instantes."
          : null;

  return (
    <section aria-labelledby="entrar-titulo">
      <button type="button" onClick={onBack} className={BACK_LINK}>
        ← Voltar
      </button>

      <h2 id="entrar-titulo" className="mt-3 text-title-large font-bold">
        Entrar
      </h2>

      {state.status === "disabled" ? (
        <p className="mt-2 text-body-medium text-ink-muted">
          Contas não estão disponíveis nesta instalação.
        </p>
      ) : (
        <>
          <p className="mt-2 max-w-prose text-body-medium text-ink-muted">
            Entrar guarda o seu time e as suas preferências na sua conta, para
            encontrá-los em qualquer aparelho. Tudo no Portal Brasileirão
            continua aberto sem entrar — a tabela, os jogos, os elencos e os
            estádios são os mesmos.
          </p>

          {message && (
            <p
              role="status"
              data-sign-in-error
              className="mt-4 rounded-small border border-warning/30 bg-warning/10 px-3 py-2 text-body-small text-warning-ink"
            >
              {message}
            </p>
          )}

          {/* A real link, not a fetch: this has to be a top-level navigation
              for the browser to follow the redirect to Google and to send the
              SameSite=Lax cookie back on the way in. */}
          <a
            href="/api/auth/google"
            data-sign-in="google"
            className={`${controlClasses("md", "mt-4 inline-flex items-center gap-2", "tonal")} ${FOCUS_RING}`}
          >
            <AccountGlyph className="h-5 w-5" />
            Entrar com o Google
          </a>

          <p className="mt-4 max-w-prose text-body-small text-ink-faint">
            Guardamos o seu nome do Google e nada mais. Você pode apagar a conta
            a qualquer momento, e ela é apagada de verdade. Os detalhes estão em{" "}
            <a href="/privacidade" className={LINK_UNDERLINE}>
              Privacidade
            </a>
            .
          </p>
        </>
      )}
    </section>
  );
}

/**
 * `/conta` — what is held about a reader, and the two things they can do to it.
 *
 * The delete confirmation is a native `<dialog>` opened with `showModal()`, the
 * same answer `PlayerOverlayCard` reached: the browser supplies the focus trap,
 * `inert` behind, the top layer and focus restoration, none of which an overlay
 * div gets right by accident. Escape arrives as `cancel`, not `keydown`.
 */
export function AccountView({
  state,
  onSignOut,
  onDelete,
  onBack,
}: {
  state: AccountState;
  onSignOut: (everywhere?: boolean) => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === "loading") {
    return (
      <p role="status" className="text-body-medium text-ink-muted">
        Carregando…
      </p>
    );
  }

  if (state.status !== "signed-in") {
    return (
      <section>
        <button type="button" onClick={onBack} className={BACK_LINK}>
          ← Voltar
        </button>
        <h2 className="mt-3 text-title-large font-bold">Minha conta</h2>
        <p className="mt-2 text-body-medium text-ink-muted">
          {state.status === "disabled"
            ? "Contas não estão disponíveis nesta instalação."
            : "Você não está conectado."}
        </p>
        {state.status === "signed-out" && (
          <a href="/entrar" className={`mt-3 inline-block text-body-medium ${LINK_UNDERLINE}`}>
            Entrar
          </a>
        )}
      </section>
    );
  }

  const { account } = state;

  return (
    <section aria-labelledby="conta-titulo">
      <button type="button" onClick={onBack} className={BACK_LINK}>
        ← Voltar
      </button>

      <h2 id="conta-titulo" className="mt-3 text-title-large font-bold">
        Olá, {firstName(account.displayName)}
      </h2>

      <Surface filled className="mt-4 px-4 py-3" data-account-card>
        <dl className="space-y-2">
          <div className="flex items-baseline justify-between gap-4 border-b border-outline-variant pb-2">
            <dt className="text-body-small text-ink-muted">Nome</dt>
            <dd className="truncate text-body-medium">{account.displayName}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-body-small text-ink-muted">Entrou com</dt>
            <dd className="text-body-medium">Google</dd>
          </div>
        </dl>
        <p className="mt-3 text-body-small text-ink-faint">
          É tudo o que guardamos sobre você, além do seu time e de um registro
          por aparelho conectado. Veja{" "}
          <a href="/privacidade" className={LINK_UNDERLINE}>
            Privacidade
          </a>
          .
        </p>
      </Surface>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => onSignOut(false)} data-sign-out="this">
          Sair
        </Button>
        <Button onClick={() => onSignOut(true)} data-sign-out="all">
          Sair de todos os aparelhos
        </Button>
      </div>

      <div className="mt-8 border-t border-outline-variant pt-4">
        <h3 className="text-body-medium font-semibold">Apagar a conta</h3>
        <p className="mt-1 max-w-prose text-body-small text-ink-muted">
          A conta e todas as sessões são apagadas na hora. Não há como desfazer,
          e não guardamos uma cópia.
        </p>
        <Button
          onClick={() => dialogRef.current?.showModal()}
          data-delete-account
          className="mt-3 border-negative/40 text-error"
        >
          Apagar a minha conta
        </Button>
      </div>

      <dialog
        ref={dialogRef}
        // Tailwind's preflight resets margin to 0, which kills the user agent's
        // `dialog { margin: auto }` — so centring is explicit here.
        className="m-auto max-w-sm rounded-medium border border-outline-variant bg-surface-container-low p-5 text-on-surface shadow-level-3 backdrop:bg-scrim/60"
        onCancel={() => dialogRef.current?.close()}
      >
        <h3 className="text-title-medium font-bold">Apagar a conta?</h3>
        <p className="mt-2 text-body-medium text-ink-muted">
          Isto apaga a sua conta agora. Você continua podendo usar o Portal
          Brasileirão sem entrar.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => dialogRef.current?.close()} size="sm">
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={busy}
            data-confirm-delete
            className="border-negative/40 text-error"
            onClick={() => {
              setBusy(true);
              dialogRef.current?.close();
              onDelete();
            }}
          >
            Apagar
          </Button>
        </div>
      </dialog>
    </section>
  );
}
