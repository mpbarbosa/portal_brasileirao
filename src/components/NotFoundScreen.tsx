import { BACK_LINK } from "@/src/components/interaction";

/**
 * What a page naming one thing shows while that thing is not there: a way back,
 * and whether it is still loading or does not exist.
 *
 * One component because four pages wrote it out — the club page, the **Painel**,
 * the **Partida** and the stadium page — and the copies had already drifted: the
 * stadium page's sat a spacing step lower and never told a screen reader it was
 * loading. `loading` is the whole reason the screen has two sentences. Without
 * it an unknown key and a payload that has not landed look the same, and the
 * page announces "não encontrado" for a club that is one response away.
 */
export function NotFoundScreen({
  onBack,
  loading = false,
  loadingText = "Carregando página…",
  missingText,
}: {
  onBack: () => void;
  loading?: boolean;
  loadingText?: string;
  missingText: string;
}) {
  return (
    <>
      <button type="button" onClick={onBack} className={BACK_LINK}>
        ← Voltar
      </button>
      <p className="mt-4 text-body-medium text-ink-muted" role={loading ? "status" : undefined}>
        {loading ? loadingText : missingText}
      </p>
    </>
  );
}
