import { useRef, useState } from "react";

import { firstName, initials } from "@/account-core";
import { Button } from "@/src/components/Button";
import { GLYPH } from "@/src/components/ClubLinks";
import {
  BACK_LINK,
  FOCUS_RING,
  LINK_UNDERLINE,
  STATE_LAYER,
  STATE_LAYER_ON_PRIMARY_CONTAINER,
  TOUCH_TARGET,
} from "@/src/components/interaction";
import { Surface } from "@/src/components/Surface";
import { controlClasses } from "@/src/components/Button";
import {
  LANDING_OPTIONS,
  type FollowState,
  type LandingId,
} from "@/preferences-core";
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
 *
 * **The two states are different kinds of thing, so they are drawn as
 * different kinds of control.** Signed out, this is the only *action* on the
 * bar and the one thing a reader might not know is on offer — so it is a
 * filled tonal button, MD3's emphasis step below the filled one, carrying its
 * verb at every width. Signed in there is nothing to invite: the control's job
 * is to say *whose* page this is and to lead to the account, so it becomes an
 * avatar with a name beside it. They differ in fill, in shape, in colour role
 * and in wording at once, which is what makes the state readable at a glance
 * rather than by reading a label.
 *
 * Both were a bare muted-ink link before — `text-ink-soft` as that alias was
 * spelled at the time, `text-on-surface-variant` since M6 retired it. M6's
 * rename rewrote this sentence too, which made it assert the old code used a
 * name that did not exist yet; a mechanical rename cannot tell a class being
 * *used* from one being *quoted as history*. They were set apart only by the
 * words
 * "Entrar" and "Minha conta" — the same weight as a caption, and on a bar whose
 * current-section chip is filled, quieter than the navigation beside it.
 *
 * **`h-10` is stated on both, and on the theme toggle beside them.** Left to
 * padding the three controls in the trailing group measured 36, 40 and 38 —
 * three heights in one row of a bar 56 tall, which reads as a wobble rather
 * than as a difference. 40dp is MD3's size for a top-app-bar control; the
 * toggle only missed it because its 1px outline is part of its box and nothing
 * had ever compared the two.
 *
 * The avatar is initials, never a photograph: `publicAccount` carries a display
 * name and nothing else, because the name is all the sign-in asks Google for
 * and `/privacidade` says so.
 */
export function AccountButton({ state }: { state: AccountState }) {
  if (state.status === "loading" || state.status === "disabled") return null;

  if (state.status === "signed-in") {
    const name = firstName(state.account.displayName);
    const mark = initials(state.account.displayName);

    return (
      <a
        href="/conta"
        data-account="signed-in"
        /* No `title`: it never appears on touch, and it competes with the
           accessible name for voice control — the same reason the destinations
           in `NavBar` carry none. */
        className={`relative inline-flex h-10 items-center gap-2 rounded-full p-1 text-label-large font-medium text-on-surface sm:pr-3 ${TOUCH_TARGET} ${STATE_LAYER}`}
      >
        {/* The accessible name says what the control *does* and then who it
            belongs to; the visible name is contained in it, which is what WCAG
            2.5.3 asks for and what keeps "clique em Ana" working. Everything
            visible is therefore `aria-hidden` — otherwise the disc's letters
            are read out as a word before the name. */}
        <span className="sr-only">Minha conta, {name}</span>
        <span
          aria-hidden="true"
          data-account-avatar
          className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-container text-label-large font-semibold text-on-secondary-container"
        >
          {/* A name of nothing but punctuation survives `normaliseDisplayName`,
              which refuses to fail a sign-in over a rendering concern. The
              glyph is what an empty disc would otherwise be. */}
          {mark || <AccountGlyph className="h-5 w-5" />}
        </span>
        {/* Hidden on a phone, where the disc alone is the pattern every app
            uses and the bar has a theme toggle beside it.

            Capped because a first name is short but not *bounded*: the provider
            sends whatever it has, and `normaliseDisplayName` only stops it at
            60 characters — a single word that long renders ~490px, and at 640px
            it pushed the document into a horizontal scroll. Measured with such
            a name rather than reasoned about; 80px is what 640px can afford,
            where the five inline tabs already wrap "Ao vivo" onto two lines.

            `truncate` works here on what reads like an inline span because the
            anchor is `inline-flex` and **a flex container blockifies its
            children** — so `max-width` and `overflow` apply, which on a genuine
            inline box they would not. Worth stating: the obvious fix when this
            looks broken is to reach for `inline-block`, and it changes
            nothing. */}
        <span aria-hidden="true" className="hidden max-w-20 truncate sm:inline md:max-w-28">
          {name}
        </span>
      </a>
    );
  }

  return (
    <a
      href="/entrar"
      data-account="signed-out"
      className={`relative inline-flex h-10 items-center gap-1.5 rounded-full bg-primary-container px-4 text-label-large font-semibold text-on-primary-container ${TOUCH_TARGET} ${STATE_LAYER_ON_PRIMARY_CONTAINER}`}
    >
      <AccountGlyph className="h-5 w-5" />
      Entrar
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
 * **Página inicial** — the section the app opens on.
 *
 * A native `<select>`, for the reason the round picker is one: the platform
 * control brings the mobile picker, the keyboard model and the accessibility
 * tree for nothing, where MD3's menu would buy an appearance and owe focus
 * management, typeahead and dismissal for ever. `controlClasses` already makes
 * it look like the buttons beside it.
 *
 * **It renders only for a signed-in reader**, and that is the setting's whole
 * shape rather than a permission check bolted on: this preference lives in the
 * account and nowhere else, so a guest has no place to keep one. See
 * `Preferences.landing`.
 *
 * The default is offered as an ordinary option rather than as an empty first
 * entry — "Classificação" is a real answer to "onde o Portal abre", and a blank
 * row above it would read as a fault. Choosing it stores **nothing**, so "chose
 * the default" and "has never chosen" stay one state, exactly as "follows
 * nobody" and "never picked a club" are one state a key over.
 */
function LandingChoice({
  landing,
  follow,
  onChoose,
}: {
  landing: LandingId | null;
  /** Only to tell a reader that `meu-time` has nothing to resolve to yet. */
  follow: FollowState;
  onChoose: (landing: LandingId | null) => void;
}) {
  const current = landing ?? "classificacao";
  const chosen = LANDING_OPTIONS.find((option) => option.id === current);
  // Chosen "Meu time" and following nobody. Not an error — the app falls back
  // to the table, which is what the option's own description says — but a
  // reader who set this and then unfollowed their club would otherwise have no
  // way to tell why nothing changed.
  const danglingClub = current === "meu-time" && follow.kind !== "following";

  return (
    <Surface filled className="mt-4 px-4 py-3" data-landing-card>
      <h3 className="text-body-medium font-semibold">Página inicial</h3>
      <p className="mt-1 max-w-prose text-body-small text-ink-muted">
        Onde o Portal abre quando você chega. Vale em todos os aparelhos em que
        você entrar.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="seletor-pagina-inicial" className="text-body-medium text-ink-muted">
          Abrir em
        </label>
        <select
          id="seletor-pagina-inicial"
          data-landing={current}
          /* No text-colour override: two utilities of equal specificity are
             resolved by stylesheet order rather than class order, so one here
             would be a coin flip. */
          className={controlClasses("sm", "bg-surface-container-low")}
          value={current}
          onChange={(event) => {
            const value = event.target.value as LandingId;
            onChoose(value === "classificacao" ? null : value);
          }}
        >
          {LANDING_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {chosen && (
        <p className="mt-2 max-w-prose text-body-small text-ink-faint" data-landing-hint>
          {chosen.description}
        </p>
      )}

      {danglingClub && (
        <p role="status" className="mt-2 max-w-prose text-body-small text-warning-ink">
          Você ainda não segue nenhum time, então o Portal continua abrindo na
          Classificação. Escolha um time na página do clube.
        </p>
      )}
    </Surface>
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
  landing,
  follow,
  onChooseLanding,
  onSignOut,
  onDelete,
  onBack,
}: {
  state: AccountState;
  /** Where the app opens for this reader, or `null` for the default. Held by
   *  `usePreferences` rather than read off `state.account.preferences`, so the
   *  control reflects a change before the fire-and-forget upload lands. */
  landing: LandingId | null;
  follow: FollowState;
  onChooseLanding: (landing: LandingId | null) => void;
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
          É tudo o que guardamos sobre você, além do seu time, da sua página
          inicial e de um registro por aparelho conectado. Veja{" "}
          <a href="/privacidade" className={LINK_UNDERLINE}>
            Privacidade
          </a>
          .
        </p>
      </Surface>

      <LandingChoice landing={landing} follow={follow} onChoose={onChooseLanding} />

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
