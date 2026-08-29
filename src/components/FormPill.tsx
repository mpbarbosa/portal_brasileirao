import type { FormResult } from "@/club-core";

const FORM_CLASS: Record<FormResult, string> = {
  V: "bg-positive/20 text-primary",
  E: "bg-surface-container-high text-on-surface-variant",
  D: "bg-negative/20 text-error",
};

const FORM_TITLE: Record<FormResult, string> = {
  V: "Vitória",
  E: "Empate",
  D: "Derrota",
};

/**
 * One result in the **Forma** guide.
 *
 * A pill carries its meaning on two channels that a screen reader gets neither
 * of: a colour, and a single letter. `title` was the whole of its accessible
 * naming, and `title` is **not reliably announced and not reachable by touch at
 * all** — so what actually reached a screen reader was five list items reading
 * "V", "E", "D", which is a spelling test rather than a form guide.
 *
 * `RankSparkline` is the in-repo precedent and it is followed rather than
 * re-invented: `title` for the mouse, and the same fact in text for everyone
 * else. The one difference is which half gets hidden. There the visible half is
 * a drawing and an em dash, so the text is *added*; here the visible half is a
 * letter that a screen reader will happily read out, so the letter is
 * `aria-hidden` and the word replaces it. Announcing both gives "V Vitória" on
 * every pill — the same doubling `alt=""` on a crest exists to avoid, since the
 * name is already beside it.
 *
 * **It moved here at its second call site, which is what it was shaped for.**
 * It was written as a component inside `ClubView` precisely so the Classificação
 * would relocate a function rather than reconstruct a pill out of two lookup
 * tables and a span — the copy that would have inherited the `title`-only naming
 * this fixed. `WikipediaLink` left `ClubView` at the same threshold.
 *
 * **`size` is a second geometry, and `RankSparkline` is the precedent for that
 * being allowed.** Its `row` and `page` boxes are the same mark at two sizes;
 * what it refuses is a width that *follows the viewport*, because then a reader
 * does not recognise the same shape in both places. A pill is 28px beside a
 * heading and 20px in a table row for the same reason the sparkline is 480px on
 * a page and 72px in a cell: the row has twenty of them and the section has one.
 */
const FORM_BOX: Record<FormPillSize, string> = {
  page: "size-7 text-body-small",
  row: "size-4 text-label-small",
};

export type FormPillSize = "page" | "row";

export function FormPill({ result, size = "page" }: { result: FormResult; size?: FormPillSize }) {
  return (
    <li
      title={FORM_TITLE[result]}
      className={`flex items-center justify-center rounded-x-small font-bold ${FORM_BOX[size]} ${FORM_CLASS[result]}`}
    >
      <span aria-hidden="true">{result}</span>
      <span className="sr-only">{FORM_TITLE[result]}</span>
    </li>
  );
}
